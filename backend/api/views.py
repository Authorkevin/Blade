from django.shortcuts import render, get_object_or_404
from django.contrib.auth.models import User
from django.db.models import F # Import F object
from rest_framework import generics, permissions, status, views
from .serializers import (
    UserSerializer, ProductSerializer, PostSerializer, UserProfileSerializer,
    FollowSerializer, FollowerSerializer, FollowingSerializer, CommentSerializer # Added CommentSerializer
)
from .models import Product, Post, UserProfile, Follow, PostLike, Comment # Added Comment model
from recommender.models import Video, UserVideoInteraction, UserActivityKeyword # Added UserActivityKeyword
from rest_framework.permissions import IsAuthenticated, AllowAny, IsAuthenticatedOrReadOnly
from rest_framework.response import Response
from rest_framework.views import APIView # Added APIView for PostLikeToggleView
# status is already available via from rest_framework import status
from rest_framework.parsers import MultiPartParser, FormParser
import logging # Import logging

logger = logging.getLogger(__name__) # Define logger for this module


# Helper function to log keyword interactions
def log_keywords_for_post_interaction(user, post, interaction_type, score=1.0):
    """
    Logs keywords from a post for a given user interaction.
    """
    if not user or not post or not hasattr(post, 'keywords') or not post.keywords:
        return

    try:
        keywords_str = post.keywords
        keywords_list = [keyword.strip().lower() for keyword in keywords_str.split(',') if keyword.strip()]

        for keyword in keywords_list:
            if keyword: # Ensure keyword is not empty after strip and lower
                UserActivityKeyword.objects.create(
                    user=user,
                    keyword=keyword,
                    source_post=post,
                    interaction_type=interaction_type,
                    interaction_score=score
                )
        # logger.info(f"Logged keywords for user {user.id}, post {post.id}, type {interaction_type}, keywords: {keywords_list}")
    except Exception as e:
        logger.error(f"Error logging keyword interaction for user {user.id}, post {post.id}: {e}", exc_info=True)


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
        # Log keyword interaction for like
        log_keywords_for_post_interaction(user, post_instance, 'like', score=1.5)
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


class CommentListCreateView(generics.ListCreateAPIView):
    serializer_class = CommentSerializer
    permission_classes = [IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        post_id = self.kwargs.get('post_pk') # Ensure this matches the URL kwarg
        return Comment.objects.filter(post_id=post_id).order_by('-created_at')

    def perform_create(self, serializer):
        post_id = self.kwargs.get('post_pk')
        post = get_object_or_404(Post, id=post_id)
        comment = serializer.save(user=self.request.user, post=post) # Assign saved comment

        # Log keyword interaction for comment
        log_keywords_for_post_interaction(self.request.user, post, 'comment', score=2.0)

        # Update UserVideoInteraction if the post is linked to a video
        try:
            if hasattr(post, 'recommender_video_entry') and post.recommender_video_entry:
                video = post.recommender_video_entry # Access the related Video object
                user = self.request.user # Already defined as self.request.user

                if user.is_authenticated: # Ensure user is authenticated
                    interaction, created = UserVideoInteraction.objects.get_or_create(
                        user=user,
                        video=video,
                        defaults={'commented': True} # Set commented true on creation
                    )
                    if not created: # If interaction already existed
                        interaction.commented = True
                        interaction.save(update_fields=['commented'])

                    logger.info(f"UserVideoInteraction updated for comment by User {user.id} on Video {video.id}. 'commented' set to True.")
            else:
                logger.info(f"Comment created for Post {post_id}, but it's not linked to a recommender.Video. No UserVideoInteraction updated.")
        except Video.DoesNotExist: # This specific exception for Video model
            logger.error(f"Video associated with Post {post_id} not found. Cannot update UserVideoInteraction for comment.")
        except Exception as e: # Catch other potential errors
            logger.error(f"Error updating UserVideoInteraction for comment on Post {post_id}: {e}", exc_info=True)


class RecordEngagementView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, post_pk): # Ensure this matches the URL kwarg
        post_obj = get_object_or_404(Post, pk=post_pk)
        current_user = request.user

        watch_time_increment_str = request.data.get('watch_time_increment')
        watch_time_increment_float = 0.0
        is_watch_time_update = False

        if watch_time_increment_str:
            try:
                watch_time_increment_float = float(watch_time_increment_str)
                if watch_time_increment_float < 0:
                    return Response({"detail": "watch_time_increment cannot be negative."}, status=status.HTTP_400_BAD_REQUEST)
                if watch_time_increment_float > 0:
                    is_watch_time_update = True
            except ValueError:
                return Response({"detail": "Invalid watch_time_increment format."}, status=status.HTTP_400_BAD_REQUEST)

        # Update Post object
        if is_watch_time_update:
            post_obj.watch_time = F('watch_time') + watch_time_increment_float
            post_obj.save(update_fields=['watch_time'])
            logger.info(f"Updated watch_time for Post {post_obj.id} by {watch_time_increment_float} seconds.")
        else:
            # This is a "new view" registration call
            post_obj.view_count = F('view_count') + 1
            post_obj.save(update_fields=['view_count'])
            logger.info(f"Incremented view_count for Post {post_obj.id}.")
            # Log keywords for this 'view' interaction
            log_keywords_for_post_interaction(current_user, post_obj, 'view', score=0.5)

        post_obj.refresh_from_db()

        # Update UserVideoInteraction
        if current_user.is_authenticated:
            try:
                # Assuming Video model is imported from recommender.models
                from recommender.models import Video, UserVideoInteraction
                from django.utils import timezone

                video = Video.objects.filter(source_post=post_obj).first()
                if video:
                    interaction, created = UserVideoInteraction.objects.get_or_create(
                        user=current_user,
                        video=video,
                        defaults={'interaction_timestamp': timezone.now()} # Default for creation
                    )

                    interaction_updated_fields = []
                    if is_watch_time_update: # Only update UVI watch_time if it's a watch time call
                        interaction.watch_time_seconds = F('watch_time_seconds') + watch_time_increment_float
                        interaction_updated_fields.append('watch_time_seconds')

                    # Always update interaction_timestamp for any engagement
                    interaction.interaction_timestamp = timezone.now()
                    interaction_updated_fields.append('interaction_timestamp')

                    interaction.save(update_fields=interaction_updated_fields)

                    log_message_action = "Created" if created else "Updated"
                    if is_watch_time_update:
                        logger.info(f"{log_message_action} UserVideoInteraction for User {current_user.id}, Video {video.id}. Watch time incremented by {watch_time_increment_float}. Timestamp updated.")
                    else: # New view registration
                        logger.info(f"{log_message_action} UserVideoInteraction for User {current_user.id}, Video {video.id}. Timestamp updated due to new view.")
                else:
                    logger.info(f"RecordEngagementView: Post {post_obj.id} has no corresponding recommender.Video. Skipping UserVideoInteraction update.")

            except ImportError: # Catch if recommender models are not found
                logger.error("Recommender models (Video, UserVideoInteraction) could not be imported. Skipping UserVideoInteraction update.")
            except Exception as e:
                logger.error(f"Error in RecordEngagementView updating UserVideoInteraction: {e}", exc_info=True)

        return Response(
            {"detail": "Engagement recorded.", "view_count": post_obj.view_count, "watch_time": post_obj.watch_time},
            status=status.HTTP_200_OK
        )
