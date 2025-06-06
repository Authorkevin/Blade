from django.shortcuts import render, get_object_or_404
from django.contrib.auth.models import User
from rest_framework import generics, permissions, status, views
from .serializers import (
    UserSerializer, ProductSerializer, PostSerializer, UserProfileSerializer,
    FollowSerializer, FollowerSerializer, FollowingSerializer # Added Follow serializers
)
from .models import Product, Post, UserProfile, Follow, PostLike # Added Follow model, PostLike
from rest_framework.permissions import IsAuthenticated, AllowAny, IsAuthenticatedOrReadOnly
from rest_framework.response import Response
from rest_framework.views import APIView # Added APIView for PostLikeToggleView
# status is already available via from rest_framework import status
from rest_framework.parsers import MultiPartParser, FormParser
import logging # Import logging

logger = logging.getLogger(__name__) # Define logger for this module


# Custom Permission Class
class IsOwnerOrReadOnly(permissions.BasePermission):
    """
    Custom permission to only allow owners of an object to edit it.
    Assumes the model instance has an `owner` attribute.
    """
    def has_object_permission(self, request, view, obj):
        # Read permissions are allowed to any request,
        # so we'll always allow GET, HEAD or OPTIONS requests.
        if request.method in permissions.SAFE_METHODS:
            return True

        # Write permissions are only allowed to the owner of the product.
        return obj.owner == request.user

class CreateUserView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [AllowAny]

class ProductListCreateView(generics.ListCreateAPIView):
    serializer_class = ProductSerializer
    # queryset = Product.objects.all() # Will be handled by get_queryset

    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsAuthenticated()]
        return [AllowAny()]

    def get_queryset(self):
        queryset = Product.objects.all()
        user_id = self.request.query_params.get('user_id')
        if user_id is not None:
            queryset = queryset.filter(owner__id=user_id)
        return queryset

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)

class ProductRetrieveUpdateDestroyView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Product.objects.all()
    serializer_class = ProductSerializer
    permission_classes = [IsOwnerOrReadOnly] # Updated permission


class PostListCreateView(generics.ListCreateAPIView):
    serializer_class = PostSerializer
    permission_classes = [IsAuthenticatedOrReadOnly] # Allow reading for all, creating for authenticated

    def get_queryset(self):
        queryset = Post.objects.all().order_by('-created_at')
        user_id = self.request.query_params.get('user_id')
        if user_id is not None:
            queryset = queryset.filter(user__id=user_id)
        return queryset

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class PostRetrieveUpdateDestroyView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Post.objects.all()
    serializer_class = PostSerializer
    permission_classes = [IsOwnerOrReadOnly] # IsOwnerOrReadOnly checks for obj.user which matches Post model


class UserProfileRetrieveUpdateView(generics.RetrieveUpdateAPIView):
    serializer_class = UserProfileSerializer
    permission_classes = [IsAuthenticated]
    parser_classes = (MultiPartParser, FormParser) # To support file uploads for profile_picture

    def get_object(self):
        # Ensure UserProfile exists, create if not (should be handled by signals, but as a fallback)
        profile, created = UserProfile.objects.get_or_create(user=self.request.user)
        if created:
            logger.info(f"UserProfile created for user {self.request.user.id} on access in UserProfileRetrieveUpdateView.")
        return profile

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)

        # Include user data (like username and new profile pic URL) in the response
        user_serializer = UserSerializer(request.user, context={'request': request})
        return Response({
            "profile": serializer.data,
            "user": user_serializer.data # Contains the updated profile_picture_url
        })


class FollowToggleView(views.APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, user_id):
        followed_user = get_object_or_404(User, id=user_id)
        user = request.user

        if user == followed_user:
            return Response({"detail": "You cannot follow yourself."}, status=status.HTTP_400_BAD_REQUEST)

        follow_instance, created = Follow.objects.get_or_create(user=user, followed_user=followed_user)

        if created:
            return Response({"detail": f"Successfully followed {followed_user.username}."}, status=status.HTTP_201_CREATED)
        else:
            follow_instance.delete()
            return Response({"detail": f"Successfully unfollowed {followed_user.username}."}, status=status.HTTP_200_OK)

    def get(self, request, user_id):
        """ Checks if the request.user is following user_id """
        target_user = get_object_or_404(User, id=user_id)
        is_following = Follow.objects.filter(user=request.user, followed_user=target_user).exists()
        return Response({"is_following": is_following}, status=status.HTTP_200_OK)


class UserFollowersListView(generics.ListAPIView):
    serializer_class = FollowerSerializer # Shows users following the user_id in URL
    permission_classes = [AllowAny] # Anyone can see followers

    def get_queryset(self):
        user_id = self.kwargs['user_id']
        target_user = get_object_or_404(User, id=user_id)
        return Follow.objects.filter(followed_user=target_user).select_related('user__api_profile')


class UserFollowingListView(generics.ListAPIView):
    serializer_class = FollowingSerializer # Shows users followed by user_id in URL
    permission_classes = [AllowAny] # Anyone can see who a user is following

    def get_queryset(self):
        user_id = self.kwargs['user_id']
        target_user = get_object_or_404(User, id=user_id)
        return Follow.objects.filter(user=target_user).select_related('followed_user__api_profile')


class PostLikeToggleView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, post_id):
        post_instance = get_object_or_404(Post, id=post_id) # Renamed post to post_instance to avoid conflict
        user = request.user

        if PostLike.objects.filter(user=user, post=post_instance).exists():
            return Response({"detail": "You have already liked this post."}, status=status.HTTP_400_BAD_REQUEST)

        PostLike.objects.create(user=user, post=post_instance) # Use post_instance
        return Response({"detail": f"Post {post_id} liked."}, status=status.HTTP_201_CREATED)

    def delete(self, request, post_id):
        post_instance = get_object_or_404(Post, id=post_id) # Renamed post to post_instance
        user = request.user
        try:
            like = PostLike.objects.get(user=user, post=post_instance) # Use post_instance
            like.delete()
            return Response({"detail": f"Post {post_id} unliked."}, status=status.HTTP_200_OK)
        except PostLike.DoesNotExist:
            return Response({"detail": "You have not liked this post."}, status=status.HTTP_400_BAD_REQUEST)


class UserDetailView(generics.RetrieveAPIView):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [AllowAny] # Allow anyone to view user profiles
    lookup_field = 'pk' # Or 'id', depending on URL conf. 'pk' is common.
