from django.contrib.auth.models import User
from rest_framework import serializers
from .models import Product # Import the Product model

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'password',]
        extra_kwargs = {'password': {'write_only': True}}
        
    def create(self, validated_data):
        user = User.objects.create_user(**validated_data)
        return user

class ProductSerializer(serializers.ModelSerializer):
    # Optionally, explicitly define owner to control its representation, e.g., by username
    # owner = serializers.ReadOnlyField(source='owner.username')
    # If just the ID is fine, no need to explicitly define it here, just add to fields and read_only_fields

    class Meta:
        model = Product
        fields = ['id', 'name', 'description', 'price', 'product_type', 'owner', 'image', 'video'] # Added new fields
        read_only_fields = ['owner'] # Make owner read-only
