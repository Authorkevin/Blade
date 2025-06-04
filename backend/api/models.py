from django.db import models
from django.contrib.auth.models import User

class Product(models.Model):
    PRODUCT_TYPE_CHOICES = [
        ('digital', 'Digital'),
        ('physical', 'Physical'),
    ]

    owner = models.ForeignKey(User, related_name='products', on_delete=models.CASCADE, default=1)
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    product_type = models.CharField(
        max_length=10,
        choices=PRODUCT_TYPE_CHOICES,
        default='physical',
        null=False,
        blank=False
    )
    image = models.ImageField(upload_to='product_images/', null=True, blank=True)
    video = models.FileField(upload_to='product_videos/', null=True, blank=True)
    digital_file = models.FileField(upload_to='product_digital_files/', null=True, blank=True)

    def __str__(self):
        return self.name


class Post(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='posts')
    caption = models.TextField(blank=True)
    image = models.ImageField(upload_to='post_images/', null=True, blank=True)
    video = models.FileField(upload_to='post_videos/', null=True, blank=True)
    keywords = models.TextField(blank=True) # Storing as TextField for flexibility
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Post by {self.user.username} at {self.created_at.strftime('%Y-%m-%d %H:%M')}"


class UserProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='api_profile') # Changed related_name
    profile_picture = models.ImageField(upload_to='profile_pics/', null=True, blank=True)
    bio = models.TextField(blank=True, null=True)
    # Add other profile-specific fields here if needed in the future

    def __str__(self):
        return f"{self.user.username}'s Profile"

# Signals to auto-create/update UserProfile when User is created/saved
from django.db.models.signals import post_save
from django.dispatch import receiver

@receiver(post_save, sender=User)
def create_or_update_user_profile(sender, instance, created, **kwargs):
    if created:
        UserProfile.objects.create(user=instance)
    else:
        # Ensure profile exists, perhaps it was deleted manually or creation failed before
        # This will create if it doesn't exist, or do nothing if it does.
        UserProfile.objects.get_or_create(user=instance) # This will use the new related_name implicitly if needed for access
        # If you want to force save the profile every time user is saved (e.g. to trigger some side effect on profile save)
        # instance.api_profile.save() # Access through the new related_name
                                # For get_or_create, it's fine.


class Follow(models.Model):
    user = models.ForeignKey(User, related_name='following', on_delete=models.CASCADE)
    followed_user = models.ForeignKey(User, related_name='followers', on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['user', 'followed_user'], name='unique_follow')
        ]
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.user.username} follows {self.followed_user.username}"
