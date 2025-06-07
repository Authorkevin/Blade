from django.conf import settings
from django.http import HttpResponse
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
import stripe
from django.shortcuts import get_object_or_404 # Add this
from django.db import IntegrityError # For handling unique_together constraint violations
from django.utils import timezone # For AdImpression date


from .models import Ad, AdImpression, AdClick # Added AdImpression, AdClick
from .serializers import AdSerializer
from .permissions import IsCreatorOrReadOnly # Import the new permission class
from rest_framework import serializers # For serializers.ValidationError

# The old IsCreatorOrAdmin might be removed if no longer used by other views after this change.
# For now, it's left in case other views depend on it, but the new Ad views will use IsCreatorOrReadOnly.

class AdListCreateView(generics.ListCreateAPIView):
    serializer_class = AdSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        # Users should only see their own ads in the list view
        return Ad.objects.filter(creator=self.request.user).order_by('-created_at')

    def perform_create(self, serializer):
        # Creator is set to the current user, status defaults to 'pending_review' (or as per model default)
        serializer.save(creator=self.request.user, status='pending_review')

class AdRetrieveUpdateDestroyView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = AdSerializer
    permission_classes = [permissions.IsAuthenticated, IsCreatorOrReadOnly]

    def get_queryset(self):
        # Users should only be able to retrieve/update/delete their own ads
        return Ad.objects.filter(creator=self.request.user)

    def perform_update(self, serializer):
        original_ad = self.get_object()
        current_status = original_ad.status
        requested_status = serializer.validated_data.get('status', current_status)

        # Simplified status transition logic for user
        allowed_user_transitions = {
            'live': ['paused'],
            'paused': ['live'],
            # User can effectively keep current status if they don't provide one,
            # or if they provide the same one (e.g. 'paused' to 'paused')
        }

        # System-controlled statuses that users generally cannot revert from or to directly
        system_controlled_statuses = ['pending_review', 'pending_approval', 'rejected', 'completed']

        if current_status in system_controlled_statuses and requested_status != current_status:
            # If current status is system-controlled, user cannot change it unless it's an allowed transition
            # (which is not the case here, as user can't move it out of these states)
            raise serializers.ValidationError(
                f"Cannot change status from '{current_status}'. This status is managed by the system."
            )

        if requested_status != current_status: # If a status change is actually requested
            if current_status in allowed_user_transitions:
                if requested_status not in allowed_user_transitions[current_status]:
                    raise serializers.ValidationError(
                        f"Invalid status transition from '{current_status}' to '{requested_status}'. "
                        f"Allowed transitions: {allowed_user_transitions[current_status]}."
                    )
                # If transition is allowed (e.g. live to paused, paused to live)
                # and current_status was not a final/system one, it's fine.
            else:
                # If current_status is not in allowed_user_transitions (e.g. 'draft', 'archived' if they existed)
                # and it's not a system_controlled_status (already checked)
                # this means it's likely a status from which user shouldn't arbitrarily change to anything.
                # For this simplified logic, we only allow explicit live/paused toggles by user.
                # Any other change from a non-system state to another non-system state that isn't live/paused toggle
                # is disallowed for now.
                 raise serializers.ValidationError(
                    f"Cannot change status from '{current_status}' to '{requested_status}'. Only 'live' <-> 'paused' transitions are allowed by user."
                )

        # If validation passes or no status change requested for 'status' field specifically
        serializer.save()

    # perform_destroy is inherited and works fine.

class CreateAdCheckoutSessionView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.stripe_api_key = getattr(settings, 'STRIPE_SECRET_KEY', None)
        if self.stripe_api_key:
            stripe.api_key = self.stripe_api_key
        else:
            print("WARNING: Stripe Secret Key not configured in settings for CreateAdCheckoutSessionView.")

    def post(self, request, ad_id, *args, **kwargs):
        if not self.stripe_api_key:
            return Response({"error": "Stripe is not configured."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        try:
            ad = Ad.objects.get(id=ad_id, creator=request.user)
        except Ad.DoesNotExist:
            return Response({"error": "Ad not found or access denied."}, status=status.HTTP_404_NOT_FOUND)

        if ad.status != 'pending_review':
            return Response({"error": f"Ad status is '{ad.status}', not 'pending_review'."}, status=status.HTTP_400_BAD_REQUEST)
        if ad.budget < 0.50: # Stripe's minimum for many currencies
            return Response({"error": "Budget too low for payment. Minimum $0.50."}, status=status.HTTP_400_BAD_REQUEST)

        budget_in_cents = int(ad.budget * 100)
        YOUR_DOMAIN = getattr(settings, 'FRONTEND_URL', 'http://localhost:5173')

        try:
            checkout_session = stripe.checkout.Session.create(
                payment_method_types=['card'],
                line_items=[{
                    'price_data': {
                        'currency': 'usd',
                        'product_data': {'name': f'Ad Campaign: {ad.ad_title}', 'description': f'Payment for Ad ID: {ad.id}'},
                        'unit_amount': budget_in_cents,
                    },
                    'quantity': 1,
                }],
                mode='payment',
                success_url=f'{YOUR_DOMAIN}/ad-payment-success?session_id={{CHECKOUT_SESSION_ID}}&ad_id={ad.id}',
                cancel_url=f'{YOUR_DOMAIN}/ad-payment-cancel?ad_id={ad.id}',
                client_reference_id=str(ad.id),
                metadata={'ad_id': str(ad.id), 'user_id': str(request.user.id)}
            )
            return Response({'sessionId': checkout_session.id, 'publishableKey': getattr(settings, 'STRIPE_PUBLISHABLE_KEY', None)}, status=status.HTTP_200_OK)
        except stripe.error.StripeError as e:
            return Response({"error": f"Stripe error: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        except Exception as e:
            return Response({"error": "An unexpected error occurred creating payment session."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class VerifyAdPaymentView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.stripe_api_key = getattr(settings, 'STRIPE_SECRET_KEY', None)
        if self.stripe_api_key:
            stripe.api_key = self.stripe_api_key
        else:
            print("WARNING: Stripe Secret Key not configured for VerifyAdPaymentView.")

    def get(self, request, *args, **kwargs):
        if not self.stripe_api_key:
            return Response({"error": "Stripe is not configured."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        session_id = request.query_params.get('session_id')
        if not session_id:
            return Response({"error": "session_id parameter is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            checkout_session = stripe.checkout.Session.retrieve(session_id)
        except stripe.error.StripeError as e:
            return Response({"error": f"Failed to retrieve payment session: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        except Exception as e: # Catching broader exceptions during Stripe call
            print(f"Unexpected error retrieving session {session_id}: {e}")
            return Response({"error": "An unexpected error occurred verifying payment session."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


        if checkout_session.payment_status != 'paid':
            return Response({"error": "Payment not successful or still processing.", "payment_status": checkout_session.payment_status}, status=status.HTTP_400_BAD_REQUEST)

        ad_id_str = checkout_session.client_reference_id or checkout_session.metadata.get('ad_id')
        if not ad_id_str:
            return Response({"error": "Ad ID not found in Stripe session."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            ad = Ad.objects.get(id=int(ad_id_str), creator=request.user)
        except Ad.DoesNotExist:
            return Response({"error": "Ad not found or access denied."}, status=status.HTTP_404_NOT_FOUND)
        except ValueError: # int conversion failed
            return Response({"error": "Invalid Ad ID format in Stripe session."}, status=status.HTTP_400_BAD_REQUEST)

        serializer = AdSerializer(ad)
        return Response({
            "message": "Payment successfully verified.",
            "ad_id": ad.id,
            "ad_status": ad.status,
            "stripe_payment_id": ad.stripe_payment_id,
            "payment_status_stripe": checkout_session.payment_status,
            "ad_details": serializer.data
        }, status=status.HTTP_200_OK)

class StripeWebhookView(APIView):
    permission_classes = []

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        if not stripe.api_key and hasattr(settings, 'STRIPE_SECRET_KEY'):
            stripe.api_key = settings.STRIPE_SECRET_KEY
        elif not stripe.api_key:
             print("CRITICAL WARNING: Stripe Secret Key not configured at webhook initialization.")

    def post(self, request, *args, **kwargs):
        if not stripe.api_key:
             return HttpResponse("Stripe API key not configured on server.", status=500)

        payload = request.body
        sig_header = request.META.get('HTTP_STRIPE_SIGNATURE')
        endpoint_secret = getattr(settings, 'STRIPE_WEBHOOK_SECRET', None)

        if not endpoint_secret:
            return HttpResponse("Webhook secret not configured.", status=500)

        event = None
        try:
            event = stripe.Webhook.construct_event(payload, sig_header, endpoint_secret)
        except ValueError as e: # Invalid payload
            print(f"Webhook ValueError: {e}")
            return HttpResponse(status=400)
        except stripe.error.SignatureVerificationError as e: # Invalid signature
            print(f"Webhook SignatureVerificationError: {e}")
            return HttpResponse(status=400)
        except Exception as e: # Other construction error
            print(f"Webhook generic construction error: {e}")
            return HttpResponse(status=400)

        if event['type'] == 'checkout.session.completed':
            session = event['data']['object']
            ad_id_str = session.client_reference_id or session.metadata.get('ad_id')

            if not ad_id_str:
                print(f"Webhook error: Ad ID missing in session {session.id}")
                return HttpResponse("Ad ID missing in session.", status=400) # Or 200 if no retry needed
            try:
                ad = Ad.objects.get(id=int(ad_id_str))
            except Ad.DoesNotExist:
                print(f"Webhook error: Ad with ID {ad_id_str} not found for session {session.id}")
                return HttpResponse("Ad not found.", status=200) # 200 so Stripe doesn't retry for this
            except ValueError:
                print(f"Webhook error: Invalid Ad ID format '{ad_id_str}' from session {session.id}")
                return HttpResponse("Invalid Ad ID format.", status=400)


            if session.payment_status == 'paid':
                if ad.status == 'pending_review':
                    ad.stripe_payment_id = session.payment_intent
                    ad.status = 'pending_approval'
                    try:
                        ad.save()
                        print(f"Ad ID {ad.id} payment confirmed. Status updated to {ad.status}.")
                    except Exception as e:
                        print(f"Webhook error: Failed to save Ad ID {ad.id}. Error: {e}")
                        return HttpResponse("Error saving ad.", status=500)
                elif ad.status in ['pending_approval', 'live']:
                    print(f"Webhook info: Ad ID {ad.id} already processed (status: {ad.status}). Session ID: {session.id}")
                else: # Other statuses
                    print(f"Webhook warning: Ad ID {ad.id} in status '{ad.status}' received completed payment. Session ID: {session.id}")
            else: # Payment not 'paid'
                 print(f"Webhook info: Checkout session {session.id} for Ad ID {ad.id} completed but payment_status is '{session.payment_status}'. Not updating ad.")

        elif event['type'] == 'payment_intent.succeeded':
            payment_intent = event['data']['object']
            print(f"Webhook info: PaymentIntent {payment_intent.id} succeeded.")
            # Add logic here if you need to handle payment_intent.succeeded separately
            # e.g. if you create payment intents directly or have other flows.

        else:
            print(f"Webhook info: Unhandled event type {event['type']}")

        return HttpResponse(status=200)


class AdBudgetEstimateAPIView(APIView):
    permission_classes = [permissions.IsAuthenticated] # or IsAuthenticated if imported directly

    def post(self, request, *args, **kwargs):
        budget_str = request.data.get('budget')
        # Add other targeting parameters if needed in the future for more complex estimates
        # keywords = request.data.get('keywords')
        # target_age_min = request.data.get('target_age_min')
        # ... etc.

        if budget_str is None:
            return Response({"error": "Budget parameter is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            budget = float(budget_str)
        except ValueError:
            return Response({"error": "Invalid budget format. Must be a number."}, status=status.HTTP_400_BAD_REQUEST)

        if budget < 0.01: # A very small minimum to avoid division by zero or nonsensical estimates
            return Response({"error": "Budget must be a positive value."}, status=status.HTTP_400_BAD_REQUEST)

        # Simple estimation logic (placeholders)
        cost_per_impression = 0.0025  # $0.03 per impression
        impressions_estimate = int(budget / cost_per_impression)

        # Assume a CTR benchmark (e.g., 1% to 2%)
        # For simplicity, let's use a fixed CTR for now.
        # This could be made more dynamic later based on targeting, ad type etc.
        ctr_benchmark_percentage = 1.5  # 1.5%
        ctr_benchmark_decimal = ctr_benchmark_percentage / 100.0

        estimated_clicks = int(impressions_estimate * ctr_benchmark_decimal)

        # Cost Per Action (CPA) - assuming action is a click for now
        if estimated_clicks > 0:
            cost_per_action_avg = budget / estimated_clicks
        else:
            # Avoid division by zero if estimated clicks are 0
            # This could happen with very small budgets or low CTR assumptions
            # Return a high CPA or indicate that CPA cannot be estimated.
            cost_per_action_avg = float('inf') # Or None, or a string message

        estimates = {
            'impressions_estimate': impressions_estimate,
            'ctr_benchmark_percentage': ctr_benchmark_percentage, # e.g., 1.5
            'estimated_clicks': estimated_clicks,
            'cost_per_action_avg': cost_per_action_avg if cost_per_action_avg != float('inf') else "N/A (too few estimated clicks)"
        }

        return Response(estimates, status=status.HTTP_200_OK)


class TrackAdImpressionAPIView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, ad_id, *args, **kwargs):
        ad = get_object_or_404(Ad, pk=ad_id)
        user = request.user

        impression_today, created = AdImpression.objects.get_or_create(
            ad=ad,
            user=user,
            impression_date=timezone.now().date(),
            defaults={'impression_time': timezone.now()} # impression_time will be set on create
        )

        if created:
            ad.impressions += 1
            ad.save(update_fields=['impressions'])
            return Response({"message": "Ad impression recorded."}, status=status.HTTP_201_CREATED)
        else:
            return Response({"message": "Ad impression for today already recorded."}, status=status.HTTP_200_OK)


class TrackAdClickAPIView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, ad_id, *args, **kwargs):
        ad = get_object_or_404(Ad, pk=ad_id)
        user = request.user

        # Create AdClick record
        AdClick.objects.create(ad=ad, user=user)

        # Increment clicks count on Ad model
        ad.clicks += 1
        ad.save(update_fields=['clicks'])

        return Response({
            "message": "Ad click recorded.",
            "target_url": ad.target_url
        }, status=status.HTTP_200_OK)
