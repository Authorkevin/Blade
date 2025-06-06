from django.urls import path
from .views import (
    AdListCreateAPIView,
    AdRetrieveUpdateDestroyAPIView,
    CreateAdCheckoutSessionView,
    StripeWebhookView,
    VerifyAdPaymentView,
    AdBudgetEstimateAPIView, # Added import for the new view
    TrackAdImpressionAPIView, # Added import
    TrackAdClickAPIView # Added import
)

urlpatterns = [
    path('', AdListCreateAPIView.as_view(), name='ad-list-create'),
    path('estimate-budget/', AdBudgetEstimateAPIView.as_view(), name='ad-budget-estimate'), # Added new path
    path('<int:pk>/', AdRetrieveUpdateDestroyAPIView.as_view(), name='ad-detail'),
    path('<int:ad_id>/create-checkout-session/', CreateAdCheckoutSessionView.as_view(), name='ad-create-checkout-session'),
    path('<int:ad_id>/track-impression/', TrackAdImpressionAPIView.as_view(), name='ad-track-impression'), # New path
    path('<int:ad_id>/track-click/', TrackAdClickAPIView.as_view(), name='ad-track-click'), # New path
    path('stripe-webhook/', StripeWebhookView.as_view(), name='stripe-webhook'),
    path('verify-ad-payment/', VerifyAdPaymentView.as_view(), name='verify-ad-payment'),
]
