from django.db import models
from django.conf import settings
from django.utils import timezone
from django.core.exceptions import ValidationError # Import ValidationError

class Ad(models.Model):
    MEDIA_TYPE_CHOICES = [
        ('image', 'Image'),
        ('video', 'Video'),
    ]

    BUTTON_TEXT_CHOICES = [
        ('visit', 'Visit'),
        ('shop', 'Shop'),
        ('contact_us', 'Contact Us'),
        ('learn_more', 'Learn More'),
        ('sign_up', 'Sign Up'),
    ]

    STATUS_CHOICES = [
        ('pending_review', 'Pending Review'),
        ('live', 'Live'),
        ('paused', 'Paused'),
        ('completed', 'Completed'), # e.g., budget exhausted or time ended
        ('rejected', 'Rejected'),
    ]

    GENDER_CHOICES = [
        ('any', 'Any'),
        ('male', 'Male'),
        ('female', 'Female'),
        ('non_binary', 'Non-binary'),
    ]

    DEVICE_CHOICES = [
        ('any', 'Any'),
        ('mobile', 'Mobile'),
        ('desktop', 'Desktop'),
    ]

    creator = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='ads'
    )
    ad_title = models.CharField(max_length=255)
    media_type = models.CharField(max_length=10, choices=MEDIA_TYPE_CHOICES)
    media_file = models.FileField(upload_to='ads_media/')
    target_url = models.URLField(max_length=2000)
    ad_copy = models.TextField()
    button_text = models.CharField(max_length=20, choices=BUTTON_TEXT_CHOICES)

    # Targeting fields
    keywords = models.TextField(blank=True, help_text="Comma-separated keywords for targeting")
    target_age_min = models.PositiveIntegerField(null=True, blank=True)
    target_age_max = models.PositiveIntegerField(null=True, blank=True)
    target_gender = models.CharField(max_length=10, choices=GENDER_CHOICES, default='any', null=True, blank=True)
    target_device = models.CharField(max_length=10, choices=DEVICE_CHOICES, default='any', null=True, blank=True)
    target_time_of_day_start = models.TimeField(null=True, blank=True)
    target_time_of_day_end = models.TimeField(null=True, blank=True)
    target_region = models.CharField(max_length=255, blank=True, null=True, help_text="e.g., city, state, country")

    # Budget and Status
    budget = models.DecimalField(max_digits=10, decimal_places=2, help_text="Minimum $10.00")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending_review')
    stripe_payment_id = models.CharField(max_length=255, blank=True, null=True)

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.ad_title} by {self.creator.username if self.creator else 'Unknown User'}"

    class Meta:
        ordering = ['-created_at']
        verbose_name = "Ad"
        verbose_name_plural = "Ads"

    def clean(self):
        if self.target_age_min is not None and self.target_age_max is not None:
            if self.target_age_min > self.target_age_max:
                raise ValidationError({'target_age_min': 'Minimum age cannot be greater than maximum age.'})
        if self.budget is not None and self.budget < 10:
             raise ValidationError({'budget': 'Minimum budget is $10.00.'})

    # It's good practice to ensure the creator field is populated,
    # but this is typically handled by the view/serializer layer during creation.
    # If it were possible for an Ad to be created without a creator through other means,
    # then a check here might be relevant.
    # def clean(self):
    #     super().clean() # Call parent's clean method
    #     if not self.creator:
    #         raise ValidationError("Ad must have a creator.")
