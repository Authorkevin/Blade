from django.conf import settings
from django.db.models.signals import post_save
from django.dispatch import receiver
# Import UserInterestProfile locally to avoid potential circular import issues if User model itself imports something from recommender.models
# However, for this specific case, User is settings.AUTH_USER_MODEL, so direct import of UserInterestProfile should be fine.
from .models import UserInterestProfile, UserActivityKeyword
from .utils import generate_simple_interest_embedding # Import the new utility function

# Get the User model
User = settings.AUTH_USER_MODEL

@receiver(post_save, sender=User)
def create_user_interest_profile(sender, instance, created, **kwargs):
    """
    Signal handler to automatically create a UserInterestProfile when a new User is created.
    """
    if created:
        UserInterestProfile.objects.create(user=instance)
        # Optionally, log that the profile was created:
        # logger = logging.getLogger(__name__)
        # logger.info(f"UserInterestProfile created for user {instance.username}")

# No separate save_user_interest_profile needed if only creation is handled by signal.
# The UserInterestProfile.last_updated will auto-update on save.
# If other User model updates should trigger UserInterestProfile saves, that logic would go here.
# For now, this matches the common pattern for creating related profile objects.


@receiver(post_save, sender=UserActivityKeyword)
def update_interest_profile_on_keyword_activity(sender, instance, created, **kwargs):
    """
    Signal handler to update UserInterestProfile when a new UserActivityKeyword is created.
    Aggregates keyword scores and updates last interaction timestamp.
    """
    if created: # Process only when a new UserActivityKeyword record is created
        user = instance.user
        keyword = instance.keyword # Assuming this is already stored in lowercase
        interaction_score = instance.interaction_score
        interaction_timestamp = instance.created_at # This is a datetime object

        # Get or create the user's interest profile. Should exist due to the other signal.
        profile, _ = UserInterestProfile.objects.get_or_create(user=user)

        # Ensure keywords_summary is a dictionary
        if not isinstance(profile.keywords_summary, dict):
            profile.keywords_summary = {}

        keyword_data = profile.keywords_summary.get(keyword, {})

        current_score = keyword_data.get('score', 0)
        new_score = current_score + interaction_score

        profile.keywords_summary[keyword] = {
            'score': new_score,
            'last_interacted': interaction_timestamp.isoformat() # Store timestamp as ISO string
        }

        # Update the interest embedding
        generate_simple_interest_embedding(profile)

        profile.save()
        # Optionally, log the update
        # logger = logging.getLogger(__name__)
        # logger.info(f"Updated interest profile for user {user.username} with keyword '{keyword}'. New score: {new_score}")
