from django.urls import path
from . import views
from .views import PostLikeToggleView # Add this

urlpatterns = [
    path('user/register/', views.CreateUserView.as_view(), name='user-register'), # Assuming a route for existing user view
    path('add-products/', views.ProductListCreateView.as_view(), name='product-list-create'),
    path('products/<int:pk>/', views.ProductRetrieveUpdateDestroyView.as_view(), name='product-detail'),
    # Post URLs
    path('posts/', views.PostListCreateView.as_view(), name='post-list-create'),
    path('posts/<int:pk>/', views.PostRetrieveUpdateDestroyView.as_view(), name='post-detail'),
    # User Profile URL
    path('profile/', views.UserProfileRetrieveUpdateView.as_view(), name='user-profile'),
    # Follow URLs
    path('users/<int:user_id>/follow/', views.FollowToggleView.as_view(), name='follow-toggle'),
    path('users/<int:user_id>/followers/', views.UserFollowersListView.as_view(), name='user-followers'),
    path('users/<int:user_id>/following/', views.UserFollowingListView.as_view(), name='user-following'),
    path('users/<int:pk>/', views.UserDetailView.as_view(), name='user-detail'), # New UserDetailView path
    # Post Like URL
    path('posts/<int:post_id>/like/', PostLikeToggleView.as_view(), name='post-like-toggle'),
]
