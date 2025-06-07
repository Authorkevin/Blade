"""
API Views for the Recommender app.

Provides endpoints for:
- Fetching personalized video recommendations for authenticated users.
- Creating, updating, and retrieving user interactions with videos.
"""
from rest_framework.views import APIView
from rest_framework import generics, viewsets, status # status is needed
from rest_framework.response import Response # Response is needed
from rest_framework.permissions import IsAuthenticated, AllowAny # For original RecommendationView
from rest_framework.exceptions import PermissionDenied
from django.contrib.auth import get_user_model
from rest_framework.pagination import PageNumberPagination # Added for pagination
from .utils import get_recommendations_for_user # This is now the original complex utils
# prime_recommender_cache_on_startup is called in apps.py
from .models import Video, UserVideoInteraction, UserActivityKeyword # Added UserActivityKeyword
from .serializers import VideoSerializer, UserVideoInteractionSerializer # VideoSerializer is needed
from api.serializers import PostSerializer # PostSerializer is needed
from ads.serializers import AdSerializer # Add this import
import logging
# No io or traceback needed for original view

User = get_user_model()
logger = logging.getLogger(__name__)


# Helper function to log keyword interactions from video tags
def log_keywords_for_video_interaction(user, video, interaction_type, score=1.0):
    """
    Logs keywords (from video tags) for a given user interaction with a video.
    """
    if not user or not video or not hasattr(video, 'tags') or not video.tags:
        return

    try:
        tags_str = video.tags
        # Tags are comma-separated, similar to Post keywords
        keywords_list = [tag.strip().lower() for tag in tags_str.split(',') if tag.strip()]

        for keyword in keywords_list:
            if keyword: # Ensure keyword is not empty
                UserActivityKeyword.objects.create(
                    user=user,
                    keyword=keyword,
                    source_video=video,
                    interaction_type=interaction_type,
                    interaction_score=score
                )
        # logger.info(f"Logged video tag keywords for user {user.id}, video {video.id}, type {interaction_type}, keywords: {keywords_list}")
    except Exception as e:
        logger.error(f"Error logging video tag keyword interaction for user {user.id}, video {video.id}: {e}", exc_info=True)


class RecommendationView(APIView):
    permission_classes = [AllowAny]
    pagination_class = PageNumberPagination

    def get(self, request):
        user = request.user
        # num_recommendations logic is removed, pagination handles page size

        logger.info(f"Fetching recommendations for user {user.id} ({user.username}).")

        try:
            # get_recommendations_for_user now returns all items, no num_recommendations argument
            all_recommended_items = get_recommendations_for_user(user.id)
        except Exception as e:
            logger.error(f"Error generating recommendations for user {user.id}: {e}", exc_info=True)
            return Response({"error": "Could not generate recommendations at this time."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        if not all_recommended_items:
            logger.info(f"No recommendations found for user {user.id}.")
            # If pagination is active, paginator.get_paginated_response will handle empty list.
            # Otherwise, return a standard response.
            paginator_instance = self.pagination_class()
            page = paginator_instance.paginate_queryset([], request, view=self)
            if page is not None: # Should be an empty list page
                 return paginator_instance.get_paginated_response([]) # Pass empty list for serialization
            return Response({"message": "No recommendations available for you right now. Explore more content!", "items": []}, status=status.HTTP_200_OK)

        paginator = self.pagination_class()
        page = paginator.paginate_queryset(all_recommended_items, request, view=self)

        # Serialize the items (either on the page or all items if not paginated)
        items_to_serialize = page if page is not None else all_recommended_items

        serialized_page_items = []
        for item in items_to_serialize: # item is a dict like {'type': 'post'/'video'/'ad', 'id': ..., 'object': ...}
            item_object = item.get('object')
            item_type = item.get('type')

            if not item_object:
                logger.warning(f"Recommended item missing 'object' field: {item}")
                continue

            if item_type == 'video':
                serializer = VideoSerializer(item_object, context={'request': request})
                item_data = serializer.data
                item_data['type'] = 'video'
                serialized_page_items.append(item_data)
            elif item_type == 'post':
                serializer = PostSerializer(item_object, context={'request': request})
                item_data = serializer.data
                item_data['type'] = 'post'
                serialized_page_items.append(item_data)
            elif item_type == 'ad':
                ad_serializer = AdSerializer(item_object, context={'request': request})
                item_data = ad_serializer.data
                item_data['is_ad'] = True
                item_data['type'] = 'ad'
                serialized_page_items.append(item_data)
            else:
                logger.warning(f"Unknown item type ('{item_type}') encountered in recommendations for user {request.user.id if request.user.is_authenticated else 'Anonymous'}")

        if page is not None:
            return paginator.get_paginated_response(serialized_page_items)

        # Fallback for when pagination is not triggered or page is None (e.g. not a ListAPIView, or paginator returned None)
        # For APIView, paginate_queryset might return None if an error occurs or if it's not correctly set up.
        # Standard DRF paginators usually raise an exception or return an empty list for empty pages if configured.
        # This path ensures we still return data if pagination somehow yields None for the page object itself.
        return Response({"items": serialized_page_items}, status=status.HTTP_200_OK)


# UserVideoInteractionViewSet remains unchanged
class UserVideoInteractionViewSet(viewsets.ModelViewSet):
    """
    API endpoint for users to record and manage their interactions with videos.
    Interactions are unique per user-video pair. Sending a POST request for an
    existing user-video pair will effectively update the existing interaction record.

    - POST /api/recommender/interactions/ : Create or update an interaction.
        Requires `video` (ID) and interaction fields like `liked`, `watch_time_seconds`.
    - GET /api/recommender/interactions/ : List user's own interactions.
    - GET /api/recommender/interactions/{id}/ : Retrieve a specific interaction.
    - PUT/PATCH /api/recommender/interactions/{id}/ : Update a specific interaction.
    - DELETE /api/recommender/interactions/{id}/ : Delete an interaction (not typically used).
    """
    queryset = UserVideoInteraction.objects.all().select_related('user', 'video')
    serializer_class = UserVideoInteractionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """
        Users can only see their own interactions. Admins can see all.
        """
        if self.request.user.is_staff:
            return UserVideoInteraction.objects.all().select_related('user', 'video')
        return UserVideoInteraction.objects.filter(user=self.request.user).select_related('user', 'video')

    def perform_create(self, serializer):
        """
        Creates or updates an interaction. If an interaction for the user and video
        already exists, it updates it. Otherwise, a new one is created.
        """
        video = serializer.validated_data.get('video')
        # User is automatically set to request.user

        # Using update_or_create to handle both creation of new interactions
        # and updating existing ones with a single POST request.
        interaction, created = UserVideoInteraction.objects.update_or_create(
            user=self.request.user,
            video=video,
            defaults=serializer.validated_data # Pass all validated data for update/create
        )

        # The serializer instance passed to perform_create is not used for saving here
        # because update_or_create handles the save. We might need to re-serialize
        # the resulting 'interaction' instance if the response needs to be the saved object.
        # However, DRF handles response serialization based on the view action.
        # For a 'create' action that results in an update, DRF might still return 201.
        # If precise 200 for update vs 201 for create is needed, this logic needs adjustment.
        # For now, this simplifies client logic (always POST).
        # We need to ensure the serializer used for response reflects the `interaction` object.
        # This is typically handled by serializer.save() returning the instance.
        # To align with this, we can do:
        # serializer.instance = interaction
        # Or, more directly, ensure the serializer is saved with the correct user.
        # serializer.save(user=self.request.user) # This would use the serializer's .create() or .update()
        # The above update_or_create is more direct for this specific "POST as upsert" behavior.
        # Let's stick to the standard DRF way by letting serializer.save() handle it,
        # and the serializer's create/update methods can be customized if needed.

        # Reverting to a simpler model where POST only creates.
        # Client should use PUT/PATCH to update if they know the interaction ID.
        # If client doesn't know interaction ID, they can query first or server can handle upsert.
        # For this exercise, allowing POST to upsert based on (user, video) is user-friendly.
        # So, the update_or_create approach is fine. The serializer needs to be aware.
        # The serializer passed in is for the *request data*.
        # We need to make sure the response uses the *saved* data.
        # The default perform_create calls serializer.save().
        # Let's let the serializer handle the unique_together constraint or custom create.

        # Re-simplifying to standard DRF: POST creates. Client must use PUT/PATCH for updates.
        # The UserVideoInteractionSerializer's `create` method should handle `unique_together`.
        # If a duplicate is POSTed, a ValidationError will be raised by default due to unique_together.
        instance = serializer.save(user=self.request.user)
        self._log_video_keyword_interactions(instance)


    def perform_update(self, serializer):
        """
        Handles updating an existing UserVideoInteraction.
        Ensures the user updating is the one who owns the interaction.
        """
        if serializer.instance.user != self.request.user and not self.request.user.is_staff:
            raise PermissionDenied("You do not have permission to edit this interaction.")
        instance = serializer.save()
        self._log_video_keyword_interactions(instance)

    def _log_video_keyword_interactions(self, instance):
        """
        Helper method to log keyword interactions based on the state of UserVideoInteraction instance.
        """
        if not instance or not instance.user or not instance.video:
            return

        user = instance.user
        video = instance.video

        # Log for like
        if instance.liked is True:
            log_keywords_for_video_interaction(user, video, 'like', score=1.5)

        # Log for comment - check if this interaction implies a comment
        # This relies on UserVideoInteraction.commented being set appropriately by other parts of the system
        # (e.g., when a Comment model related to a Post that sources this Video is created)
        # or if the interaction itself can be directly marked as 'commented'.
        if instance.commented is True:
            log_keywords_for_video_interaction(user, video, 'comment', score=2.0)

        # Log for completed watch
        if instance.completed_watch is True:
            log_keywords_for_video_interaction(user, video, 'watch_complete', score=2.5)
        # Log for significant watch time, if not already logged as 'watch_complete'
        # to avoid double-counting the same core signal if completed_watch implies significant watch time.
        elif instance.watch_time_seconds > 60: # Example threshold: 60 seconds
            # Check if video duration is available to make a more relative assessment
            # For now, using a fixed threshold.
            log_keywords_for_video_interaction(user, video, 'watch_significant', score=1.0)
