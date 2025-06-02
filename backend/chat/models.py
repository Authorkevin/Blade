from django.db import models
from django.contrib.auth import get_user_model
from django.db.models.signals import post_save # To create UserProfile automatically
from django.dispatch import receiver # To receive the signal
import uuid
from decimal import Decimal # For price_amount and call_rate

User = get_user_model()

class UserProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    stripe_account_id = models.CharField(max_length=255, blank=True, null=True)
    stripe_onboarding_complete = models.BooleanField(default=False)
    # Store call rate in smallest currency unit (e.g., cents) if using IntegerField,
    # or use DecimalField for precision. For simplicity, using DecimalField here.
    call_rate = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True, help_text="Price per call session. Define your currency unit elsewhere (e.g., USD).")

    def __str__(self):
        return f"{self.user.username}'s Profile"

# Signal to create or update UserProfile whenever a User instance is saved
@receiver(post_save, sender=User)
def create_or_update_user_profile(sender, instance, created, **kwargs):
    if created:
        UserProfile.objects.create(user=instance)
    # For existing users, ensure their profile is saved.
    # This might be redundant if profile is always accessed via user.profile and saved explicitly when changed.
    # However, it ensures profile exists.
    try:
        instance.profile.save()
    except UserProfile.DoesNotExist: # Should not happen if 'created' logic is fine
         UserProfile.objects.create(user=instance)


class Message(models.Model):
    sender = models.ForeignKey(User, related_name='sent_messages', on_delete=models.CASCADE)
    recipient = models.ForeignKey(User, related_name='received_messages', on_delete=models.CASCADE)
    content = models.TextField()
    timestamp = models.DateTimeField(auto_now_add=True)
    is_read = models.BooleanField(default=False)

    def __str__(self):
        return f"From {self.sender.username} to {self.recipient.username} [{self.timestamp.strftime('%Y-%m-%d %H:%M')}]"

    class Meta:
        ordering = ['timestamp']


class CallSession(models.Model):
    CALL_STATUS_CHOICES = [
        ('pending_payment', 'Pending Payment'),
        ('pending_acceptance', 'Pending Acceptance'),
        ('active', 'Active'),
        ('completed', 'Completed'),
        ('declined', 'Declined'),
        ('missed', 'Missed'),
        ('payment_failed', 'Payment Failed'),
        ('cancelled', 'Cancelled'), # If initiator cancels before callee action / payment
    ]

    caller = models.ForeignKey(User, related_name='initiated_calls', on_delete=models.CASCADE)
    callee = models.ForeignKey(User, related_name='received_calls', on_delete=models.CASCADE)
    start_time = models.DateTimeField(auto_now_add=True) # Moment of initiation
    end_time = models.DateTimeField(null=True, blank=True) # When call concluded
    status = models.CharField(max_length=20, choices=CALL_STATUS_CHOICES, default='pending_acceptance')
    room_id = models.CharField(max_length=255, unique=True, default=uuid.uuid4)

    # Stripe related fields
    is_paid_call = models.BooleanField(default=False)
    price_amount = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True, help_text="Total price for the call session.")
    stripe_payment_intent_id = models.CharField(max_length=255, blank=True, null=True)
    # Consider adding currency, e.g., models.CharField(max_length=3, default='usd')

    def __str__(self):
        paid_status = "Paid" if self.is_paid_call else "Free"
        return f"Call from {self.caller.username} to {self.callee.username} ({self.status}, {paid_status}) - Room: {self.room_id}"

    class Meta:
        ordering = ['-start_time']
