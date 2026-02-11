"""Solo Workspace admin configuration."""
from django.contrib import admin
from apps.solo.models import SoloSession, SoloExport, ShareToken, ShareAccessLog


@admin.register(SoloSession)
class SoloSessionAdmin(admin.ModelAdmin):
    list_display = ['id', 'name', 'user', 'page_count', 'updated_at']
    list_filter = ['created_at', 'updated_at']
    search_fields = ['name', 'user__email']
    readonly_fields = ['id', 'created_at', 'updated_at']
    raw_id_fields = ['user']


@admin.register(SoloExport)
class SoloExportAdmin(admin.ModelAdmin):
    list_display = ['id', 'session', 'format', 'file_size', 'created_at']
    list_filter = ['format', 'created_at']
    readonly_fields = ['id', 'created_at']
    raw_id_fields = ['session']


@admin.register(ShareToken)
class ShareTokenAdmin(admin.ModelAdmin):
    list_display = ['id', 'session', 'token', 'is_active', 'view_count', 'expires_at', 'created_at']
    list_filter = ['is_active', 'allow_download', 'created_at']
    search_fields = ['token', 'session__name']
    readonly_fields = ['id', 'token', 'view_count', 'created_at', 'last_accessed_at']
    raw_id_fields = ['session']


@admin.register(ShareAccessLog)
class ShareAccessLogAdmin(admin.ModelAdmin):
    list_display = ['id', 'share_token', 'ip_address', 'accessed_at']
    list_filter = ['accessed_at']
    readonly_fields = ['id', 'share_token', 'ip_address', 'user_agent', 'accessed_at']
    raw_id_fields = ['share_token']
