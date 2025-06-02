from django.urls import path, include
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    MessageViewSet,
    UserListViewSet,
    CallSessionViewSet,
    stripe_connect_account_simulation, # Added
    stripe_webhook_simulation # Added
)

router = DefaultRouter()
router.register(r'messages', MessageViewSet, basename='message')
router.register(r'call-sessions', CallSessionViewSet, basename='callsession')

urlpatterns = [
    path('', include(router.urls)),
    path('users/', UserListViewSet.as_view(), name='chat-users-list'),
    # Stripe simulation URLs
    path('stripe/connect-account-simulation/', stripe_connect_account_simulation, name='stripe-connect-simulation'),
    path('stripe/webhook-simulation/', stripe_webhook_simulation, name='stripe-webhook-simulation'),
]
