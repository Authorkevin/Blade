from rest_framework import permissions

class IsCreatorOrReadOnly(permissions.BasePermission):
    """
    Custom permission to only allow creators of an object to edit it.
    Assumes the model instance has a `creator` attribute.
    """
    def has_object_permission(self, request, view, obj):
        # Read permissions are allowed to any request,
        # so we'll always allow GET, HEAD or OPTIONS requests.
        if request.method in permissions.SAFE_METHODS:
            return True

        # Write permissions are only allowed to the creator of the ad.
        # Ensure obj has 'creator' attribute. For Ad model, it's 'creator'.
        if hasattr(obj, 'creator'):
            return obj.creator == request.user

        # Fallback if object doesn't have a 'creator' (should not happen for Ad model)
        return False
