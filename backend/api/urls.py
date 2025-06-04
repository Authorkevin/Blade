from django.urls import path
from . import views

urlpatterns = [
    path('user/register/', views.CreateUserView.as_view(), name='user-register'), # Assuming a route for existing user view
    path('add-products/', views.ProductListCreateView.as_view(), name='product-list-create'),
    path('products/<int:pk>/', views.ProductRetrieveUpdateDestroyView.as_view(), name='product-detail'),
]
