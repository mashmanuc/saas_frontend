"""
Permissions for Solo Workspace.
"""
from rest_framework.permissions import BasePermission


class IsSessionOwner(BasePermission):
    """Only session owner can access."""
    
    message = "You do not have permission to access this session."
    
    def has_object_permission(self, request, view, obj):
        return obj.user == request.user


class CanAccessSharedSession(BasePermission):
    """Check if user can access shared session."""
    
    message = "This shared session is not accessible."
    
    def has_permission(self, request, view):
        # Public views don't require auth
        return True
    
    def has_object_permission(self, request, view, obj):
        # Check if share token is valid
        if hasattr(obj, 'share_token'):
            return obj.share_token.is_valid()
        return False
