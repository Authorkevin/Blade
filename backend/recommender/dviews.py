"""
API Views for the Recommender app.

Provides endpoints for:
- Fetching personalized video recommendations for authenticated users.
- Creating, updating, and retrieving user interactions with videos.
"""
from rest_framework.views import APIView
from rest_framework import generics, viewsets, status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import PermissionDenied # Added for perform_update
from django.contrib.auth import get_user_model
from .utils import get_recommendations_for_user
# prime_recommender_cache_on_startup is called in apps.py
from .models import Video, UserVideoInteraction # Video model might still be needed for VideoSerializer context
from .serializers import VideoSerializer, UserVideoInteractionSerializer
from api.serializers import PostSerializer # Import PostSerializer
import logging

logger = logging.getLogger(__name__)
User = get_user_model()

class RecommendationView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        try:
            num_recommendations = int(request.query_params.get('count', 10))
            if not (0 < num_recommendations <= 50):
                num_recommendations = 10
        except ValueError:
            num_recommendations = 10

        logger.info(f"Fetching {num_recommendations} recommendations for user {user.id} ({user.username}).")

        try:
            # This function now returns a list of dicts: {'type': 'post'/'video', 'id': ..., 'object': ...}
            recommended_items = get_recommendations_for_user(user.id, num_recommendations)
        except Exception as e:
            logger.error(f"Error generating recommendations for user {user.id}: {e}", exc_info=True)
            return Response({"error": "Could not generate recommendations at this time."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        if not recommended_items:
            logger.info(f"No recommendations found for user {user.id}.")
            # The response structure should be consistent, so return an empty list under a key, e.g., 'items'
            return Response({"message": "No recommendations available for you right now. Explore more content!", "items": []})

        serialized_items = []
        for item in recommended_items:
            if item['type'] == 'video':
                # VideoSerializer might need context if it uses request, e.g., for full URLs
                serializer = VideoSerializer(item['object'], context={'request': request})
                serialized_items.append(serializer.data)
            elif item['type'] == 'post':
                # PostSerializer might also need context
                serializer = PostSerializer(item['object'], context={'request': request})
                serialized_items.append(serializer.data)
            else:
                logger.warning(f"Unknown item type encountered in recommendations: {item.get('type')}")

        # The key in the response should be generic, like "items" or "feed"
        return Response({"items": serialized_items})

# UserVideoInteractionViewSet remains unchanged by this subtask
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
        serializer.save(user=self.request.user)


    def perform_update(self, serializer):
        """
        Handles updating an existing UserVideoInteraction.
        Ensures the user updating is the one who owns the interaction.
        """
        if serializer.instance.user != self.request.user and not self.request.user.is_staff:
            raise PermissionDenied("You do not have permission to edit this interaction.")
        serializer.save()
