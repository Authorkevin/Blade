from rest_framework import serializers
from .models import Video, UserVideoInteraction
from django.contrib.auth import get_user_model

User = get_user_model()

class VideoSerializer(serializers.ModelSerializer):
    uploader_username = serializers.ReadOnlyField(source='uploader.username')
    # You could add more fields here, e.g., derived ones or related counts
    # interactions_count = serializers.SerializerMethodField()
    # def get_interactions_count(self, obj):
    #    return obj.interactions.count()

    class Meta:
        model = Video
        fields = [
            'id', 'title', 'description', 'uploader', 'uploader_username',
            'upload_timestamp', 'tags'
            # 'duration_seconds', # if you added this to model
        ]
        # uploader is set automatically if a view creates a video by an authenticated user
        read_only_fields = ['uploader']


class UserVideoInteractionSerializer(serializers.ModelSerializer):
    user_username = serializers.ReadOnlyField(source='user.username')
    video_title = serializers.ReadOnlyField(source='video.title')
    # Expose the interaction_score property from the model
    interaction_score = serializers.ReadOnlyField()

    class Meta:
        model = UserVideoInteraction
        fields = [
            'id', 'user', 'user_username', 'video', 'video_title',
            'watch_time_seconds', 'liked', 'shared', 'completed_watch',
            'interaction_timestamp', 'interaction_score' # Added interaction_score
        ]
        # User should typically be set from context (request.user) in the view
        # Video should be provided by ID.
        read_only_fields = ['user', 'interaction_timestamp', 'interaction_score']

    def create(self, validated_data):
        # If user is not part of validated_data (e.g., not sent in request body)
        # and context has 'request' with an authenticated user, set it.
        if 'user' not in validated_data and 'request' in self.context and self.context['request'].user.is_authenticated:
            validated_data['user'] = self.context['request'].user

        # Ensure 'video' is provided (usually as an ID that DRF handles)
        if 'video' not in validated_data:
            raise serializers.ValidationError({"video": "Video must be specified for interaction."})

        # update_or_create logic if unique_together ('user', 'video') is active
        # This serializer is for creating new interaction records or updating existing ones.
        # If your model has unique_together=('user', 'video'), DRF handles this by default
        # for POST (create) vs PUT/PATCH (update) if the instance is provided.
        # If you want POST to also update, you'd customize .create() or use a different approach.
        # For now, assuming standard create/update based on unique_together.

        # If you want POST to update_or_create:
        # instance, created = UserVideoInteraction.objects.update_or_create(
        #     user=validated_data.get('user'),
        //     video=validated_data.get('video'),
        //     defaults=validated_data
        // )
        // return instance

        return super().create(validated_data)
