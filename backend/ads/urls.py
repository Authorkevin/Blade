from django.urls import path
from .views import (
    AdListCreateAPIView,
    AdRetrieveUpdateDestroyAPIView,
    CreateAdCheckoutSessionView,
    StripeWebhookView,
    VerifyAdPaymentView
)

urlpatterns = [
    path('', AdListCreateAPIView.as_view(), name='ad-list-create'),
    path('<int:pk>/', AdRetrieveUpdateDestroyAPIView.as_view(), name='ad-detail'),
    path('<int:ad_id>/create-checkout-session/', CreateAdCheckoutSessionView.as_view(), name='ad-create-checkout-session'),
    path('stripe-webhook/', StripeWebhookView.as_view(), name='stripe-webhook'),
    path('verify-ad-payment/', VerifyAdPaymentView.as_view(), name='verify-ad-payment'),
]
