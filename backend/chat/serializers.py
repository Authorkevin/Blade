from django.contrib.auth import get_user_model
from rest_framework import serializers
from .models import Message, CallSession # Added CallSession

User = get_user_model()

class MessageSerializer(serializers.ModelSerializer):
    sender_username = serializers.ReadOnlyField(source='sender.username')
    recipient_username = serializers.ReadOnlyField(source='recipient.username')

    class Meta:
        model = Message
        fields = ['id', 'sender', 'sender_username', 'recipient', 'recipient_username', 'content', 'timestamp', 'is_read']
        read_only_fields = ['sender', 'timestamp']

    def create(self, validated_data):
        validated_data['sender'] = self.context['request'].user
        return super().create(validated_data)

class UserChatSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username']


class CallSessionSerializer(serializers.ModelSerializer):
    caller_username = serializers.ReadOnlyField(source='caller.username')
    callee_username = serializers.ReadOnlyField(source='callee.username')

    class Meta:
        model = CallSession
        fields = [
            'id', 'caller', 'caller_username', 'callee', 'callee_username',
            'start_time', 'end_time', 'status', 'room_id'
        ]
        read_only_fields = ['caller', 'start_time', 'room_id'] # Caller set by view, room_id auto-generated

    def create(self, validated_data):
        # Caller is set in the view based on request.user
        validated_data['caller'] = self.context['request'].user
        # Ensure callee is provided
        if 'callee' not in validated_data:
            raise serializers.ValidationError({"callee": "Callee must be specified."})
        # Ensure caller and callee are not the same
        if validated_data['caller'] == validated_data.get('callee'):
            raise serializers.ValidationError({"callee": "Cannot initiate a call with oneself."})
        return super().create(validated_data)
