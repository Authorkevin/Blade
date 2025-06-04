"""
Database models for the Recommender app.

This includes:
- Video: Represents a video entry in the system.
- UserVideoInteraction: Tracks how users interact with videos, forming the basis
  for collaborative filtering recommendations.
"""
from django.db import models
from django.conf import settings # To get USER_MODEL
from django.utils import timezone

class Video(models.Model):
    """
    Represents a video in the platform.
    """
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    uploader = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='uploaded_videos'
    )
    upload_timestamp = models.DateTimeField(
        default=timezone.now,
        help_text="Timestamp when the video was uploaded."
    )
    tags = models.CharField(
        max_length=255,
        blank=True,
        help_text="Comma-separated tags for discoverability and content categorization."
    )
    duration_seconds = models.PositiveIntegerField(null=True, blank=True)

    def __str__(self):
        return f"{self.title} (by {self.uploader.username if self.uploader else 'Unknown User'})"

    class Meta:
        ordering = ['-upload_timestamp']
        verbose_name = "Video"
        verbose_name_plural = "Videos"

class UserVideoInteraction(models.Model):
    """
    Records a user's interaction with a specific video.
    This data is crucial for generating personalized recommendations.
    Serves as an implicit feedback mechanism.
    """
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='video_interactions'
    )
    video = models.ForeignKey(
        Video,
        on_delete=models.CASCADE,
        related_name='interactions'
    )

    watch_time_seconds = models.PositiveIntegerField(
        default=0,
        help_text="Total seconds the user has watched this video."
    )
    # Using null=True, default=None for BooleanField to represent three states: True, False, None (no opinion/not rated)
    liked = models.BooleanField(
        null=True, blank=True, default=None,
        help_text="Did the user like the video? Null means no explicit like/dislike."
    )
    shared = models.BooleanField(
        default=False,
        help_text="Did the user share this video?"
    )
    completed_watch = models.BooleanField(
        default=False,
        help_text="Did the user watch a significant portion (e.g., >80%) of the video?"
    )
    interaction_timestamp = models.DateTimeField(
        default=timezone.now,
        help_text="Timestamp of the last interaction."
    )

    def __str__(self):
        user_str = self.user.username if self.user else "Unknown User"
        video_str = self.video.title if self.video else "Unknown Video"
        liked_str = "Liked" if self.liked is True else ("Disliked" if self.liked is False else "Not Rated")
        return f"{user_str} - {video_str} ({liked_str})"

    class Meta:
        ordering = ['-interaction_timestamp']
        unique_together = ('user', 'video') # One summary interaction record per user-video pair
        verbose_name = "User Video Interaction"
        verbose_name_plural = "User Video Interactions"

    @property
    def interaction_score(self):
        """
        Calculates a simple weighted score for this interaction.
        Used by the recommender system.
        """
        score = 0
        if self.watch_time_seconds > 60: # e.g., watched more than 1 minute
            score += 1
        if self.watch_time_seconds > 300: # e.g., watched more than 5 minutes
            score += 1 # Additional point for longer watch
        if self.completed_watch:
            score += 2
        if self.liked is True:
            score += 3
        if self.liked is False: # Explicit dislike can be a strong negative signal
            score -= 2
        if self.shared:
            score += 2
        # Avoid zero scores if possible for matrix, unless it truly means neutral/no interaction
        # If this interaction record exists, it means there was *some* interaction.
        # So, minimum score could be 1 if any positive criteria met, or based on watch_time_seconds.
        # For now, it can be 0 if only minor watch time and no other signals.
        return score
