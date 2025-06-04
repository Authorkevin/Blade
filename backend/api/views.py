from django.shortcuts import render
from django.contrib.auth.models import User
from rest_framework import generics, permissions # Added permissions
from .serializers import UserSerializer, ProductSerializer
from .models import Product
from rest_framework.permissions import IsAuthenticated, AllowAny

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
