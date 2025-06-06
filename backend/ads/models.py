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
        ('pending_review', 'Pending Review'), # Initial state before payment
        ('pending_approval', 'Pending Approval'), # After payment, awaiting admin/mod action
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
    target_time_of_day_start = models.DateTimeField(null=True, blank=True, help_text="Targeting start date and time")
    target_time_of_day_end = models.DateTimeField(null=True, blank=True, help_text="Targeting end date and time")
    target_region = models.CharField(max_length=255, blank=True, null=True, help_text="e.g., city, state, country")

    # Budget and Status
    budget = models.DecimalField(max_digits=10, decimal_places=2, help_text="Minimum $10.00")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending_review')
    stripe_payment_id = models.CharField(max_length=255, blank=True, null=True)
    impressions = models.IntegerField(default=0, help_text="Total times the ad has been viewed.")
    clicks = models.IntegerField(default=0, help_text="Total times the ad has been clicked.")

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    keyword_processed_data = models.JSONField(null=True, blank=True, help_text="Processed keyword data, e.g., list of tokens or placeholder for embeddings.")

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

    def save(self, *args, **kwargs):
        if self.keywords: # Check if keywords exist
            # Simple placeholder: split keywords by comma, strip whitespace, store as a list
            processed_keywords = [keyword.strip() for keyword in self.keywords.split(',') if keyword.strip()]
            self.keyword_processed_data = {'tokens': processed_keywords}
        else:
            self.keyword_processed_data = None # Or {'tokens': []}
        super().save(*args, **kwargs) # Call the original save method

class AdImpression(models.Model):
    ad = models.ForeignKey(Ad, on_delete=models.CASCADE, related_name='ad_impressions')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='ad_impressions_by_user')
    impression_time = models.DateTimeField(auto_now_add=True)
    impression_date = models.DateField(auto_now_add=True) # For daily frequency capping

    class Meta:
        unique_together = ('ad', 'user', 'impression_date') # Ensure one impression per user per day for capping
        ordering = ['-impression_time']

    def __str__(self):
        return f"Ad '{self.ad.ad_title}' impression by {self.user.username} on {self.impression_date}"

class AdClick(models.Model):
    ad = models.ForeignKey(Ad, on_delete=models.CASCADE, related_name='ad_clicks')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='ad_clicks_by_user')
    click_time = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-click_time']

    def __str__(self):
        return f"Ad '{self.ad.ad_title}' click by {self.user.username} at {self.click_time}"
