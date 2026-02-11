"""
Solo Workspace serializers.
"""
from rest_framework import serializers
from apps.solo.models import SoloSession, SoloExport


class SoloSessionListSerializer(serializers.ModelSerializer):
    """List view serializer (lightweight)."""
    
    class Meta:
        model = SoloSession
        fields = [
            'id',
            'name',
            'page_count',
            'thumbnail_url',
            'updated_at',
        ]


class SoloSessionDetailSerializer(serializers.ModelSerializer):
    """Detail view serializer (full state)."""
    
    class Meta:
        model = SoloSession
        fields = [
            'id',
            'name',
            'state',
            'page_count',
            'thumbnail_url',
            'rev',
            'state_digest',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'rev', 'state_digest', 'created_at', 'updated_at']


class SoloSessionCreateSerializer(serializers.ModelSerializer):
    """Create/update serializer."""
    
    class Meta:
        model = SoloSession
        fields = ['name', 'state', 'page_count', 'thumbnail_url']
    
    def create(self, validated_data):
        validated_data['user'] = self.context['request'].user
        return super().create(validated_data)


class SoloExportSerializer(serializers.ModelSerializer):
    """Export serializer with status for polling."""
    session_id = serializers.UUIDField(source='session.id', read_only=True)
    signed_url = serializers.SerializerMethodField()
    is_expired = serializers.BooleanField(read_only=True)
    
    class Meta:
        model = SoloExport
        fields = [
            'id',
            'session_id',
            'format',
            'status',
            'file_url',
            'signed_url',
            'file_size',
            'error',
            'page_count',
            'is_expired',
            'expires_at',
            'created_at',
            'updated_at',
        ]
        read_only_fields = fields
    
    def get_signed_url(self, obj):
        """Get signed CDN URL for completed exports."""
        if obj.status != 'completed' or not obj.file_url:
            return None
        
        try:
            from apps.solo.services.cdn import CdnService
            return CdnService.get_export_url(
                user_id=str(obj.user_id),
                session_id=str(obj.session_id),
                export_id=str(obj.id),
                ext=obj.format,
                expires_in=3600,
            )
        except Exception:
            return obj.file_url


class DiffOperationSerializer(serializers.Serializer):
    """Single diff operation."""

    op = serializers.ChoiceField(choices=['add', 'update', 'remove'])
    kind = serializers.ChoiceField(choices=['stroke', 'asset', 'meta'])
    id = serializers.CharField(required=False, allow_blank=False)
    page_id = serializers.CharField(required=False, allow_blank=True)
    value = serializers.JSONField(required=False)
    patch = serializers.JSONField(required=False)

    def validate(self, attrs):
        op = attrs['op']
        kind = attrs['kind']
        if op == 'add' and 'value' not in attrs:
            raise serializers.ValidationError('add operation requires value')
        if op in {'update', 'remove'} and 'id' not in attrs:
            raise serializers.ValidationError('update/remove operation require id')
        if op == 'update' and 'patch' not in attrs and 'value' not in attrs:
            raise serializers.ValidationError('update operation requires patch or value')
        if kind == 'meta' and op in {'add', 'update'}:
            payload = attrs.get('patch') or attrs.get('value')
            if not isinstance(payload, dict):
                raise serializers.ValidationError('meta operations require dict payload')
        return attrs


class SoloDiffSaveSerializer(serializers.Serializer):
    """Serializer for diff-save payload."""

    rev = serializers.IntegerField(min_value=0)
    ops = DiffOperationSerializer(many=True)
    client_ts = serializers.DateTimeField(required=False)
