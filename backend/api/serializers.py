from django.contrib.auth.models import User
from rest_framework import serializers
from .models import Product, Post, UserProfile, Follow, PostLike # Import Follow, PostLike

class UserProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserProfile
        fields = ['profile_picture', 'bio']

# Basic User Serializer for embedding in Follower/Following lists
class BasicUserSerializer(serializers.ModelSerializer):
    profile_picture_url = serializers.SerializerMethodField()
    class Meta:
        model = User
        fields = ['id', 'username', 'profile_picture_url']

    def get_profile_picture_url(self, obj):
        request = self.context.get('request')
        if hasattr(obj, 'api_profile') and obj.api_profile.profile_picture and hasattr(obj.api_profile.profile_picture, 'url'):
            return request.build_absolute_uri(obj.api_profile.profile_picture.url) if request else obj.api_profile.profile_picture.url
        return None

class UserSerializer(serializers.ModelSerializer):
    profile_picture_url = serializers.SerializerMethodField()
    followers_count = serializers.SerializerMethodField()
    following_count = serializers.SerializerMethodField()
    is_followed_by_request_user = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id', 'username', 'password', 'profile_picture_url',
            'followers_count', 'following_count', 'is_followed_by_request_user'
        ]
        extra_kwargs = {'password': {'write_only': True}}

    def get_profile_picture_url(self, obj):
        request = self.context.get('request')
        if hasattr(obj, 'api_profile') and obj.api_profile.profile_picture and hasattr(obj.api_profile.profile_picture, 'url'):
            return request.build_absolute_uri(obj.api_profile.profile_picture.url) if request else obj.api_profile.profile_picture.url
        return None

    def get_followers_count(self, obj):
        return obj.followers.count()

    def get_following_count(self, obj):
        return obj.following.count()

    def get_is_followed_by_request_user(self, obj):
        request_user = self.context.get('request').user
        if request_user and request_user.is_authenticated:
            return Follow.objects.filter(user=request_user, followed_user=obj).exists()
        return False
        
    def create(self, validated_data):
        user = User.objects.create_user(**validated_data)
        return user

class ProductSerializer(serializers.ModelSerializer):
    # Optionally, explicitly define owner to control its representation, e.g., by username
    owner = serializers.ReadOnlyField(source='owner.username')
    # If just the ID is fine, no need to explicitly define it here, just add to fields and read_only_fields

    class Meta:
        model = Product
        fields = ['id', 'name', 'description', 'price', 'product_type', 'owner', 'image', 'video', 'digital_file'] # Added new fields
        read_only_fields = ['owner'] # Make owner read-only


class PostSerializer(serializers.ModelSerializer):
    user = serializers.ReadOnlyField(source='user.username')
    user_id = serializers.ReadOnlyField(source='user.id') # Added user_id
    likes_count = serializers.SerializerMethodField()

    class Meta:
        model = Post
        fields = ['id', 'user', 'user_id', 'caption', 'image', 'video', 'keywords', 'created_at', 'updated_at', 'likes_count'] # Added user_id and likes_count to fields
        read_only_fields = ['user', 'user_id'] # Added user_id to read_only_fields

    def get_likes_count(self, obj):
        return obj.likes.count()


class PostLikeSerializer(serializers.ModelSerializer):
    user = serializers.ReadOnlyField(source='user.username') # Show username, not ID

    class Meta:
        model = PostLike
        fields = ['id', 'user', 'post', 'created_at']
        read_only_fields = ['user', 'created_at'] # post is set via URL

    def create(self, validated_data):
        # User is set in the view, post is passed in validated_data (from context or URL)
        # Ensure this doesn't clash with UniqueConstraint if called directly without view logic
        return super().create(validated_data)


class FollowSerializer(serializers.ModelSerializer):
    user = BasicUserSerializer(read_only=True) # Who is following
    followed_user = BasicUserSerializer(read_only=True) # Who is being followed

    class Meta:
        model = Follow
        fields = ['id', 'user', 'followed_user', 'created_at']
        # Add depth if you want to see more than IDs immediately, or customize as above

class FollowerSerializer(serializers.ModelSerializer):
    """ Serializer for listing users who follow a target user (followers) """
    user = BasicUserSerializer(read_only=True) # The user who is following

    class Meta:
        model = Follow
        fields = ['user', 'created_at']


class FollowingSerializer(serializers.ModelSerializer):
    """ Serializer for listing users a target user is following """
    followed_user = BasicUserSerializer(read_only=True) # The user who is being followed

    class Meta:
        model = Follow
        fields = ['followed_user', 'created_at']
