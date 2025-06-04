import logging
from django.db.models.signals import post_save, post_delete # Ensure post_delete is imported
from django.dispatch import receiver
from .models import Post, PostLike # Assuming Post is already imported for the other signal
from recommender.models import Video, UserVideoInteraction # Import UserVideoInteraction

logger = logging.getLogger(__name__)

@receiver(post_save, sender=Post)
def handle_post_save_for_recommender(sender, instance, created, **kwargs):
    """
    Signal handler to create, update, or delete a recommender.models.Video entry
    when an api.models.Post with a video is saved or deleted.
    """
    if instance.video and instance.video.name:
        # Post has a video file. Ensure a recommender.Video entry exists.
        video_defaults = {
            'title': instance.caption[:100] if instance.caption else f"Video by {instance.user.username}",
            'description': instance.caption if instance.caption else "",
            'uploader': instance.user, # The user who created the Post
            'tags': instance.keywords if instance.keywords else "",
            'upload_timestamp': instance.created_at,
            # 'duration_seconds': remains None, needs separate processing
            # 'video_file': Not setting this directly, as the video is on the Post.
            # The recommender.Video entry is linked via source_post.
        }

        try:
            recommender_video, video_created = Video.objects.update_or_create(
                source_post=instance,
                defaults=video_defaults
            )

            if video_created:
                logger.info(f"Created recommender.Video entry for Post {instance.id} (Video ID: {recommender_video.id})")
            else:
                logger.info(f"Updated recommender.Video entry for Post {instance.id} (Video ID: {recommender_video.id})")

        except Exception as e:
            logger.error(f"Error creating/updating recommender.Video for Post {instance.id}: {e}")

    else:
        # Post does not have a video, or video was removed.
        # Delete any existing recommender.Video entry linked to this post.
        try:
            deleted_count, _ = Video.objects.filter(source_post=instance).delete()
            if deleted_count > 0:
                logger.info(f"Deleted {deleted_count} recommender.Video entry/entries for Post {instance.id} as video was removed/absent.")
        except Exception as e:
            logger.error(f"Error deleting recommender.Video for Post {instance.id}: {e}")

# Optional: Handle pre_delete signal for Post if needed
# from django.db.models.signals import pre_delete
# @receiver(pre_delete, sender=Post)
# def handle_post_delete_for_recommender(sender, instance, **kwargs):
#     """
#     If a Post is deleted, its related recommender.Video entry should also be deleted.
#     This is handled by on_delete=models.CASCADE on the source_post field in Video model.
#     So, this explicit signal handler for deletion might be redundant if CASCADE works as expected.
#     However, it can be useful for logging or more complex cleanup.
#     """
#     logger.info(f"Post {instance.id} is being deleted. Associated recommender.Video (if any) will be handled by CASCADE delete.")
#     # Video.objects.filter(source_post=instance).delete() # This would be redundant with on_delete=CASCADE
#     pass


@receiver(post_save, sender=PostLike)
def handle_post_like_save(sender, instance, created, **kwargs):
    if created: # Only act when a new like is created
        post_like = instance
        user = post_like.user
        post = post_like.post

        # Check if the liked post has an associated recommender.Video entry
        try:
            # The recommender.Video is linked to the api.Post via 'source_post'
            recommender_video_entry = Video.objects.get(source_post=post)
        except Video.DoesNotExist:
            logger.info(f"Post {post.id} is liked, but no corresponding recommender.Video entry found. Skipping UserVideoInteraction update.")
            return

        # Create or update UserVideoInteraction
        interaction, uvi_created = UserVideoInteraction.objects.update_or_create(
            user=user,
            video=recommender_video_entry,
            defaults={'liked': True} # Set liked to True
        )

        if uvi_created:
            logger.info(f"Created UserVideoInteraction (liked=True) for User {user.id} and Video {recommender_video_entry.id} due to PostLike.")
        else:
            logger.info(f"Updated UserVideoInteraction (liked=True) for User {user.id} and Video {recommender_video_entry.id} due to PostLike.")


@receiver(post_delete, sender=PostLike)
def handle_post_like_delete(sender, instance, **kwargs):
    post_like = instance
    user = post_like.user
    post = post_like.post

    try:
        recommender_video_entry = Video.objects.get(source_post=post)
    except Video.DoesNotExist:
        logger.info(f"PostLike on Post {post.id} deleted, but no corresponding recommender.Video entry found. Skipping UserVideoInteraction update.")
        return

    # Update UserVideoInteraction, setting liked to None (or False, if that's preferred for an explicit unlike)
    # Setting to None indicates "no opinion" or "neutral", which fits the model's BooleanField(null=True).
    # Check if an interaction record exists before trying to update.
    # If it doesn't exist, no action is needed, or you might log it.
    updated_count = UserVideoInteraction.objects.filter(user=user, video=recommender_video_entry).update(
        liked=None
    )
    if updated_count > 0:
        logger.info(f"Updated UserVideoInteraction (liked=None) for User {user.id} and Video {recommender_video_entry.id} due to PostLike deletion.")
    else:
        logger.info(f"PostLike deleted for User {user.id} and Video {recommender_video_entry.id}, but no existing UserVideoInteraction found to update liked status for.")
