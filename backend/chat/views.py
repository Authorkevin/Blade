from django.contrib.auth import get_user_model
from django.db.models import Q
from django.utils import timezone # For end_time
from rest_framework import viewsets, status, generics, serializers # Added serializers for validation error
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.decorators import action, api_view, permission_classes as permission_classes_decorator
from rest_framework.permissions import AllowAny
from django.conf import settings
import stripe
import uuid
from decimal import Decimal # Ensure Decimal is imported
from .models import Message, CallSession, UserProfile
from .serializers import MessageSerializer, UserChatSerializer, CallSessionSerializer

User = get_user_model()
stripe.api_key = settings.STRIPE_SECRET_KEY

class MessageViewSet(viewsets.ModelViewSet):
    """
    ViewSet for listing messages between users and creating new messages.
    """
    serializer_class = MessageSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        other_user_id = self.request.query_params.get('user_id')
        if not other_user_id:
            return Message.objects.filter(Q(sender=user) | Q(recipient=user)).order_by('timestamp')
        try:
            other_user = User.objects.get(id=other_user_id)
        except User.DoesNotExist:
            return Message.objects.none()
        return Message.objects.filter(
            (Q(sender=user) & Q(recipient=other_user)) |
            (Q(sender=other_user) & Q(recipient=user))
        ).order_by('timestamp')

    def perform_create(self, serializer):
        # Sender is automatically set by the serializer's context
        serializer.save()


class UserListViewSet(generics.ListAPIView):
    """
    ViewSet for listing users.
    """
    queryset = User.objects.all()
    serializer_class = UserChatSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        # Exclude the current user from the list
        return User.objects.exclude(id=self.request.user.id)


class CallSessionViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing Call Sessions.
    """
    queryset = CallSession.objects.all().order_by('-start_time') # Default ordering
    serializer_class = CallSessionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        # Users should only see call sessions they are part of
        user = self.request.user
        return CallSession.objects.filter(Q(caller=user) | Q(callee=user)).distinct().order_by('-start_time')

    def perform_create(self, serializer):
        callee_id = self.request.data.get('callee')
        if not callee_id:
            # This should ideally be caught by serializer validation if 'callee' is required in serializer.
            # However, 'callee' in serializer is an object, data provides ID.
            raise serializers.ValidationError({"callee_id": "Callee user ID must be provided."})
        try:
            callee = User.objects.get(id=callee_id)
        except User.DoesNotExist:
            raise serializers.ValidationError({"callee_id": "Specified callee (user ID) does not exist."})

        if self.request.user == callee:
             raise serializers.ValidationError({"callee": "Cannot initiate a call with oneself."})

        # Prevent creating new call if there's already an active/pending one with the same users
        existing_call = CallSession.objects.filter(
            (Q(caller=self.request.user, callee=callee) | Q(caller=callee, callee=self.request.user)),
            status__in=['pending', 'active']
        ).first()

        if existing_call:
            raise serializers.ValidationError({
                "detail": "An active or pending call session already exists with this user.",
                "existing_call_id": existing_call.id,
                "room_id": existing_call.room_id,
                "status": existing_call.status
            })
        # Check if this is a paid call
        try:
            callee_profile = callee.profile
        except UserProfile.DoesNotExist:
            callee_profile = None # Assume free call if profile somehow doesn't exist

        is_potentially_paid = callee_profile and \
                              callee_profile.stripe_onboarding_complete and \
                              callee_profile.call_rate is not None and \
                              callee_profile.call_rate > 0

        if is_potentially_paid and self.request.data.get('is_paid_call', False): # Caller indicates intent for paid call
            call_price = callee_profile.call_rate
            amount_in_cents = int(call_price * 100)
            # Example: Platform fee 20% (ensure this is configured securely)
            application_fee_amount = int(amount_in_cents * Decimal(settings.PLATFORM_FEE_PERCENTAGE_STRIPE_PAID_CALLS))

            if not callee_profile.stripe_account_id:
                 raise serializers.ValidationError({"detail": "Callee has a call rate set but Stripe account is not configured correctly for payouts."})

            try:
                # Create PaymentIntent
                payment_intent_params = {
                    'amount': amount_in_cents,
                    'currency': settings.DEFAULT_CURRENCY_STRIPE_PAID_CALLS, # e.g., 'usd'
                    'application_fee_amount': application_fee_amount,
                    'transfer_data': {
                        'destination': callee_profile.stripe_account_id,
                    },
                    'metadata': {
                        'caller_id': request.user.id,
                        'callee_id': callee.id,
                        # call_session_id will be added after session is created if possible,
                        # or use PI id to find session later.
                    },
                    'description': f"Call from {request.user.username} to {callee.username}",
                    # 'capture_method': 'manual', # If you want to authorize then capture
                }
                payment_intent = stripe.PaymentIntent.create(**payment_intent_params)

                call_session_instance = serializer.save(
                    callee=callee,
                    is_paid_call=True,
                    price_amount=call_price,
                    stripe_payment_intent_id=payment_intent.id,
                    status='pending_payment' # New status indicating waiting for payment
                )
                # Now update PI with call_session_id if your Stripe plan allows modification
                # stripe.PaymentIntent.modify(payment_intent.id, metadata={'call_session_id': call_session_instance.id})

                return Response({
                    **CallSessionSerializer(call_session_instance).data,
                    'payment_client_secret': payment_intent.client_secret
                }, status=status.HTTP_201_CREATED)

            except stripe.error.StripeError as e:
                return Response({"stripe_error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
            except Exception as e:
                return Response({"error": f"Could not process paid call setup: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        else:
            # Standard free call or caller chose not to make it a paid call
            saved_instance = serializer.save(callee=callee, status='pending_acceptance', is_paid_call=False)
            # TODO: Notify callee for free call initiation
            return Response(CallSessionSerializer(saved_instance).data, status=status.HTTP_201_CREATED)


    @action(detail=True, methods=['post'], url_path='confirm-payment')
    def confirm_payment(self, request, pk=None):
        call_session = self.get_object()

        if call_session.caller != request.user:
            return Response({'detail': 'Only the caller can confirm payment.'}, status=status.HTTP_403_FORBIDDEN)

        if not call_session.is_paid_call or not call_session.stripe_payment_intent_id:
            return Response({'detail': 'This is not a paid call or no payment intent associated.'}, status=status.HTTP_400_BAD_REQUEST)

        if call_session.status != 'pending_payment':
            return Response({'detail': f'Call is not awaiting payment. Current status: {call_session.status}'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            # It's good practice to retrieve the PaymentIntent from Stripe to verify its status
            payment_intent = stripe.PaymentIntent.retrieve(call_session.stripe_payment_intent_id)
            if payment_intent.status == 'succeeded':
                call_session.status = 'pending_acceptance'
                call_session.save()
                # TODO: Notify callee that call is paid and pending their acceptance
                return Response(CallSessionSerializer(call_session).data)
            elif payment_intent.status == 'requires_payment_method' or payment_intent.status == 'requires_confirmation' or payment_intent.status == 'requires_action':
                 return Response({
                    'detail': 'Payment not yet complete on Stripe. Further action may be required by the client.',
                    'stripe_status': payment_intent.status,
                    'client_secret': payment_intent.client_secret # Send back client_secret if further action needed
                }, status=status.HTTP_402_PAYMENT_REQUIRED) # 402 Payment Required
            else: # e.g. processing, canceled
                call_session.status = 'payment_failed' # Or a more specific status based on PI
                call_session.save()
                return Response({
                    'detail': 'Stripe PaymentIntent not confirmed as succeeded.',
                    'stripe_status': payment_intent.status
                }, status=status.HTTP_400_BAD_REQUEST)
        except stripe.error.StripeError as e:
            return Response({'detail': f'Stripe API error verifying payment: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['post'], url_path='accept')
    def accept_call(self, request, pk=None):
        call_session = self.get_object()
        if call_session.callee != request.user:
            return Response({'detail': 'You are not authorized to accept this call.'}, status=status.HTTP_403_FORBIDDEN)

        if call_session.status != 'pending_acceptance':
            if call_session.is_paid_call and call_session.status == 'pending_payment':
                 return Response({'detail': 'Payment for this call is still pending.'}, status=status.HTTP_400_BAD_REQUEST)
            return Response({'detail': f'Call cannot be accepted. Current status: {call_session.status}.'}, status=status.HTTP_400_BAD_REQUEST)

        call_session.status = 'active'
        call_session.save()
        # TODO: Notify caller that call was accepted
        return Response(CallSessionSerializer(call_session).data)

    @action(detail=True, methods=['post'], url_path='decline')
    def decline_call(self, request, pk=None):
        call_session = self.get_object()
        allowed_to_action = False
        # Callee can decline a pending_acceptance or pending_payment call.
        if call_session.callee == request.user and call_session.status in ['pending_acceptance', 'pending_payment']:
            allowed_to_action = True
        # Caller can cancel a call they initiated if it's pending_acceptance or pending_payment.
        elif call_session.caller == request.user and call_session.status in ['pending_acceptance', 'pending_payment']:
            allowed_to_action = True

        if not allowed_to_action:
            return Response({'detail': 'Action not allowed or call not in a state to be declined/cancelled.'}, status=status.HTTP_403_FORBIDDEN)

        # If it was a paid call and payment was made/pending, consider refund or cancellation of PI
        if call_session.is_paid_call and call_session.stripe_payment_intent_id:
            try:
                pi = stripe.PaymentIntent.retrieve(call_session.stripe_payment_intent_id)
                if pi.status == 'succeeded' or pi.status == 'requires_capture': # If captured or authorized
                     # Attempt to refund if already succeeded. This is a complex operation.
                     # stripe.Refund.create(payment_intent=pi.id, reason='requested_by_user')
                     # For simulation, we'll just log it.
                     print(f"Simulating refund/cancellation for PI: {pi.id} due to call decline/cancel.")
                elif pi.status != 'canceled': # If not already canceled
                    # Attempt to cancel the PaymentIntent if not yet succeeded
                    # stripe.PaymentIntent.cancel(pi.id)
                    print(f"Simulating cancellation of PaymentIntent: {pi.id}")
            except stripe.error.StripeError as e:
                print(f"Stripe error during decline/cancel for PI {call_session.stripe_payment_intent_id}: {str(e)}")


        call_session.status = 'declined' if call_session.callee == request.user else 'cancelled'
        call_session.end_time = timezone.now()
        call_session.save()
        # TODO: Notify other user
        return Response(CallSessionSerializer(call_session).data)


# Stripe Connect Simulation Endpoints

@api_view(['POST'])
@permission_classes_decorator([IsAuthenticated]) # User must be logged in
def stripe_connect_account_simulation(request):
    """
    Simulates initiating Stripe Connect onboarding for the authenticated user.
    In a real scenario, this would generate a Stripe AccountLink and redirect.
    Here, it just updates the user's profile.
    """
    user = request.user
    try:
        # Ensure profile exists, using the signal or get_or_create
        profile, created = UserProfile.objects.get_or_create(user=user)

        # Simulate that onboarding process happened and Stripe called us back
        # In a real flow, this ID comes from Stripe after successful Connect onboarding.
        profile.stripe_account_id = request.data.get('stripe_account_id', f"acct_sim_{user.username}_{uuid.uuid4().hex[:8]}")
        profile.stripe_onboarding_complete = True # Mark as complete for simulation

        # Allow setting call_rate during this simulated onboarding
        raw_call_rate = request.data.get('call_rate')
        if raw_call_rate is not None:
            try:
                profile.call_rate = Decimal(str(raw_call_rate))
            except Exception as e: # InvalidOperation from Decimal
                return Response({'error': f'Invalid call_rate format: {raw_call_rate}. Error: {str(e)}'}, status=status.HTTP_400_BAD_REQUEST)
        elif not profile.call_rate: # Set a default if not provided and not already set
             profile.call_rate = Decimal('5.00') # Default to 5.00 (e.g. USD)

        profile.save()

        return Response({
            'message': 'Stripe Connect account simulation successful!',
            'stripe_account_id': profile.stripe_account_id,
            'stripe_onboarding_complete': profile.stripe_onboarding_complete,
            'call_rate': str(profile.call_rate) # Return as string for consistency
        })
    except UserProfile.DoesNotExist: # Should be handled by get_or_create
        return Response({'error': 'User profile not found and could not be created.'}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes_decorator([AllowAny]) # Webhooks should be open or use specific Stripe signature verification
def stripe_webhook_simulation(request):
    """
    Simulates receiving a Stripe webhook event.
    In a real app, VERIFY STRIPE SIGNATURE HERE.
    """
    # For testing, simulate an event like account.updated or payment_intent.succeeded
    payload = request.data
    event_type = payload.get('type')
    data_object = payload.get('data', {}).get('object', {})

    print(f"Simulated Stripe Webhook Received: {event_type}")

    # It's good practice to actually use Stripe's library to construct the event from the payload
    # and webhook secret for verification, even in simulation if you want to test that part.
    # For now, just directly accessing payload.

    if event_type == 'account.updated':
        account_id = data_object.get('id')
        # In a real scenario, find UserProfile by stripe_account_id and update based on event.
        print(f"Simulated handling for account.updated for account: {account_id}")
        try:
            profile = UserProfile.objects.get(stripe_account_id=account_id)
            # Example: Toggle onboarding status based on a simulated field or just log
            profile.stripe_onboarding_complete = data_object.get('payouts_enabled', profile.stripe_onboarding_complete)
            # profile.charges_enabled = data_object.get('charges_enabled', profile.charges_enabled) # if you have such field
            profile.save()
            print(f"Profile for {profile.user.username} updated via simulated 'account.updated' webhook.")
        except UserProfile.DoesNotExist:
            print(f"No profile found for simulated Stripe account ID: {account_id}")

    elif event_type == 'payment_intent.succeeded':
        payment_intent_id = data_object.get('id')
        # Typically, metadata would contain your internal CallSession ID or related info
        call_session_id = data_object.get('metadata', {}).get('call_session_id')
        if call_session_id:
            try:
                call_session = CallSession.objects.get(id=call_session_id, stripe_payment_intent_id=payment_intent_id)
                if call_session.status == 'pending_payment':
                    call_session.status = 'pending_acceptance'
                    call_session.save()
                    print(f"CallSession {call_session_id} updated to '{call_session.status}' via simulated 'payment_intent.succeeded' webhook.")
                    # TODO: Notify relevant users (caller/callee that payment is complete)
                else:
                    print(f"CallSession {call_session_id} already processed or not in pending_payment state. Current status: {call_session.status}")
            except CallSession.DoesNotExist:
                print(f"CallSession with ID {call_session_id} and PaymentIntent {payment_intent_id} not found.")
        else:
            print("No call_session_id in PaymentIntent metadata for simulated 'payment_intent.succeeded' webhook.")

    elif event_type == 'payment_intent.payment_failed':
        payment_intent_id = data_object.get('id')
        call_session_id = data_object.get('metadata', {}).get('call_session_id')
        if call_session_id:
            try:
                call_session = CallSession.objects.get(id=call_session_id, stripe_payment_intent_id=payment_intent_id)
                call_session.status = 'payment_failed'
                call_session.save()
                print(f"CallSession {call_session_id} status updated to 'payment_failed'.")
                # TODO: Notify caller about payment failure
            except CallSession.DoesNotExist:
                 print(f"CallSession with ID {call_session_id} for failed PaymentIntent {payment_intent_id} not found.")
        else:
            print("No call_session_id in PaymentIntent metadata for simulated 'payment_intent.payment_failed' webhook.")

    return Response({'status': 'simulated webhook received'}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='end')
    def end_call(self, request, pk=None):
        call_session = self.get_object()
        if request.user not in [call_session.caller, call_session.callee]:
            return Response({'detail': 'You are not part of this call session.'}, status=status.HTTP_403_FORBIDDEN)

        if call_session.status not in ['pending_acceptance', 'pending_payment', 'active', 'pending_refund']: # Allow ending/cancelling from these states
             return Response({'detail': f'Call cannot be ended. Current status: {call_session.status}.'}, status=status.HTTP_400_BAD_REQUEST)

        if call_session.status in ['pending_acceptance', 'pending_payment']:
            call_session.status = 'cancelled'
        else: # 'active' or 'pending_refund'
            call_session.status = 'completed'

        call_session.end_time = timezone.now()
        call_session.save()
        # TODO: Notify other user
        return Response(CallSessionSerializer(call_session).data)
