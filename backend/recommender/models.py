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
# from ..api.models import Post # Avoid direct import if Post might import from recommender
# Use string reference 'api.Post' for ForeignKey/OneToOneField
from backend.nlp_utils import extract_keywords # Import the keyword extraction utility

class Video(models.Model):
    """
    Represents a video in the platform.
    Can be sourced from an api.models.Post or be an independent video.
    """
    # Fields for all videos
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

    # Link to api.Post if this video originates from a Post
    # Using string 'api.Post' to avoid circular import issues.
    source_post = models.OneToOneField(
        'api.Post',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='recommender_video_entry',
        help_text="Link to the Post object if this video was uploaded as part of a post."
    )

    # Optional field for videos not linked to a Post, if the recommender ingests videos directly.
    video_file = models.FileField(
        upload_to='recommender_internal_videos/',
        null=True,
        blank=True,
        help_text="Video file, primarily for videos not sourced from a Post. If source_post is set, this may be redundant."
    )

    def __str__(self):
        if self.source_post:
            return f"{self.title} (from Post by {self.source_post.user.username})"
        elif self.uploader:
            return f"{self.title} (by {self.uploader.username})"
        return f"{self.title} (Uploader not specified)"

    def save(self, *args, **kwargs):
        text_to_extract = ""
        if self.title and self.title.strip():
            text_to_extract += self.title
        if self.description and self.description.strip():
            if text_to_extract: # Add a space if title was also present
                text_to_extract += " " + self.description
            else:
                text_to_extract += self.description

        if text_to_extract:
            extracted = extract_keywords(text_to_extract)
            if extracted:
                # Truncate if necessary for CharField max_length
                max_len = Video._meta.get_field('tags').max_length
                if len(extracted) > max_len:
                    # Find the last comma within max_len - some buffer for "..." or just cut
                    # For simplicity, just truncate
                    self.tags = extracted[:max_len]
                    # A better truncation would be to cut at the last comma before max_len
                    # e.g., self.tags = extracted[:max_len].rsplit(',', 1)[0]
                    # but this could also lead to issues if a single keyword is very long.
                    # For now, direct truncation is used.
                else:
                    self.tags = extracted
        super().save(*args, **kwargs)

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
    commented = models.BooleanField(
        default=False,
        help_text="Did the user comment on this video?"
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
            score += 3  # Keep liked score
        if self.liked is False: # Explicit dislike can be a strong negative signal
            score -= 2 # Keep dislike penalty
        if self.shared:
            score += 2  # Keep shared score
        if self.commented:
            score += 3  # Add score for commenting

        # Avoid zero scores if possible for matrix, unless it truly means neutral/no interaction
        # If this interaction record exists, it means there was *some* interaction.
        # For now, it can be 0 if only minor watch time and no other signals.
        # A base score for any interaction existing could be added if desired e.g. score = max(score, 0.5)
        return score

class UserActivityKeyword(models.Model):
    """
    Tracks user interactions related to specific keywords, derived from posts or videos.
    This helps in understanding user interest in topics/keywords.
    """
    INTERACTION_CHOICES = [
        ('like', 'Like'),
        ('comment', 'Comment'),
        ('view', 'View'),    # e.g., viewed a post/video with this keyword
        ('watch', 'Watch'),  # e.g., significant watch time for a video with this keyword
        ('search', 'Search'), # If keyword search functionality exists
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='keyword_activities'
    )
    keyword = models.CharField(max_length=100, db_index=True)

    # Source of the keyword interaction
    source_post = models.ForeignKey(
        'api.Post',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='keyword_interactions'
    )
    source_video = models.ForeignKey(
        'Video',  # Refers to recommender.Video model in this app
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='keyword_interactions'
    )

    interaction_type = models.CharField(
        max_length=20,
        choices=INTERACTION_CHOICES
    )
    interaction_score = models.FloatField(default=1.0)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        source_info = ""
        if self.source_post:
            source_info = f" (Post ID: {self.source_post.id})"
        elif self.source_video:
            source_info = f" (Video ID: {self.source_video.id})"
        return f"{self.user.username} - '{self.keyword}' ({self.interaction_type}){source_info}"

    class Meta:
        ordering = ['-created_at']
        verbose_name = "User Keyword Activity"
        verbose_name_plural = "User Keyword Activities"

class UserInterestProfile(models.Model):
    """
    Stores a summarized interest profile for a user, typically based on keywords.
    """
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='interest_profile'
    )
    # Example: {'python': {'score': 10.5, 'last_interacted': '2023-01-15T10:00:00Z'}, ...}
    keywords_summary = models.JSONField(
        default=dict,
        blank=True,
        help_text="Summary of user's keyword interests, e.g., scores, timestamps."
    )
    interest_embedding = models.JSONField(
        null=True,
        blank=True,
        help_text="Placeholder for user interest embedding vector."
    )
    last_updated = models.DateTimeField(
        auto_now=True,
        help_text="Timestamp when this profile was last updated."
    )

    def __str__(self):
        return f"{self.user.username}'s Interest Profile"

    class Meta:
        ordering = ['-last_updated']
        verbose_name = "User Interest Profile"
        verbose_name_plural = "User Interest Profiles"
