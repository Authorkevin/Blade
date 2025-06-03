from django.contrib import admin
from .models import Message, CallSession, UserProfile # Added UserProfile

@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display = ('sender', 'recipient', 'timestamp', 'is_read', 'content_preview')
    list_filter = ('is_read', 'timestamp', 'sender', 'recipient')
    search_fields = ('content', 'sender__username', 'recipient__username')

    def content_preview(self, obj):
        return obj.content[:50] + '...' if len(obj.content) > 50 else obj.content
    content_preview.short_description = 'Content Preview'

@admin.register(CallSession)
class CallSessionAdmin(admin.ModelAdmin):
    list_display = ('caller', 'callee', 'start_time', 'end_time', 'status', 'room_id', 'is_paid_call', 'price_amount', 'stripe_payment_intent_id') # Added Stripe fields
    list_filter = ('status', 'is_paid_call', 'start_time', 'caller', 'callee')
    search_fields = ('room_id', 'caller__username', 'callee__username', 'stripe_payment_intent_id')
    readonly_fields = ('room_id', 'start_time', 'stripe_payment_intent_id')


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'stripe_account_id', 'stripe_onboarding_complete', 'call_rate')
    search_fields = ('user__username', 'stripe_account_id')
    list_filter = ('stripe_onboarding_complete',)
    raw_id_fields = ('user',) # For better performance with many users
