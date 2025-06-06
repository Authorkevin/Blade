from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import Ad

User = get_user_model()

class AdSerializer(serializers.ModelSerializer):
    creator_username = serializers.ReadOnlyField(source='creator.username')
    # Potentially add human-readable versions of choice fields if needed by frontend
    # media_type_display = serializers.CharField(source='get_media_type_display', read_only=True)
    # button_text_display = serializers.CharField(source='get_button_text_display', read_only=True)
    # status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = Ad
        fields = [
            'id', 'creator', 'creator_username', 'ad_title',
            'media_type', # 'media_type_display',
            'media_file', 'target_url', 'ad_copy',
            'button_text', # 'button_text_display',
            'keywords', 'target_age_min', 'target_age_max', 'target_gender',
            'target_device', 'target_time_of_day_start', 'target_time_of_day_end',
            'target_region', 'budget',
            'status', # 'status_display',
            'stripe_payment_id',
            'impressions', 'clicks',  # Added impressions and clicks
            'created_at', 'updated_at'
        ]
        read_only_fields = ['creator', 'stripe_payment_id', 'impressions', 'clicks', 'created_at', 'updated_at'] # Removed 'status'
        # Note: 'creator' is set in the view based on request.user
        # 'status' is initially 'pending_review', then managed by backend/admin/moderator actions. User can pause/resume.
        # 'stripe_payment_id' is set after successful payment

    def validate_budget(self, value):
        if value < 10:
            raise serializers.ValidationError("Minimum budget is $10.00.")
        return value

    def validate(self, data):
        # Accessing initial_data to get all fields, even if not explicitly in serializer fields for writing
        # or using `self.instance` for updates
        age_min = data.get('target_age_min', self.instance.target_age_min if self.instance else None)
        age_max = data.get('target_age_max', self.instance.target_age_max if self.instance else None)

        if age_min is not None and age_max is not None:
            if age_min > age_max:
                raise serializers.ValidationError({"target_age_min": "Minimum age cannot be greater than maximum age."})

        # If media_file is not part of the update, and it's a partial update, we don't require it.
        # For create, it should be required. Model's FileField doesn't have blank=True.
        # DRF automatically handles required fields based on model definition unless overridden.
        if not self.instance and 'media_file' not in data: # self.instance is None for POST (create)
             raise serializers.ValidationError({"media_file": "Media file is required for a new ad."})

        return data
