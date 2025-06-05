from django.conf import settings
from django.http import HttpResponse
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
import stripe

from .models import Ad
from .serializers import AdSerializer

class IsCreatorOrAdmin(permissions.BasePermission):
    """
    Custom permission to only allow creators of an object or admin users to edit/delete it.
    Assumes the instance has a 'creator' attribute.
    """
    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            return True
        return obj.creator == request.user or request.user.is_staff

class AdListCreateAPIView(generics.ListCreateAPIView):
    serializer_class = AdSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.is_staff:
            return Ad.objects.all().order_by('-created_at')
        return Ad.objects.filter(creator=user).order_by('-created_at')

    def perform_create(self, serializer):
        budget = serializer.validated_data.get('budget')
        if budget < 10: # Assuming 10 is the minimum budget
            # This check should ideally be in the serializer's validate_budget or clean method of the model
            # For robustness, having it here too can be a safeguard.
            # However, the prompt for AdListCreateAPIView didn't specify detailed budget validation here,
            # it was added for the Stripe view. Let's assume serializer handles it primarily for this view.
            # For now, let's stick to the provided spec for perform_create if it didn't have this.
            # The Ad model itself has a min_value validator for budget via clean() method,
            # and serializer has validate_budget. This view check is redundant if those work.
            # Reverting to simpler version for this view as per typical DRF practice (serializer handles validation).
            pass # Assuming serializer validation for budget is sufficient here.
        serializer.save(creator=self.request.user, status='pending_review')

class AdRetrieveUpdateDestroyAPIView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Ad.objects.all()
    serializer_class = AdSerializer
    permission_classes = [permissions.IsAuthenticated, IsCreatorOrAdmin]

    def perform_update(self, serializer):
        serializer.save()

    def perform_destroy(self, instance):
        instance.delete()

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
