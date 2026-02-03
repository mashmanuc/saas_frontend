"""
Solo Workspace URL configuration.
"""
from django.urls import path
from apps.solo.api.views import (
    SoloSessionListView,
    SoloSessionDetailView,
    SoloSessionExportView,
    SoloSessionDuplicateView,
    SoloSessionDiffSaveView,
    # v0.27
    SessionShareView,
    PublicSessionView,
    ThumbnailRegenerateView,
    # v0.28
    ExportDetailView,
    SessionExportsListView,
    # v0.29
    SoloSessionStreamSaveView,
    SoloSessionBeaconSaveView,
    # v0.30 (stretch)
    SoloSessionSnapshotCreateView,
    SoloSessionSnapshotLatestView,
)

app_name = 'solo-api'

urlpatterns = [
    # Sessions (v0.26)
    path('solo/sessions/', SoloSessionListView.as_view(), name='session-list'),
    path('solo/sessions/<uuid:pk>/', SoloSessionDetailView.as_view(), name='session-detail'),
    path('solo/sessions/<uuid:pk>/export/', SoloSessionExportView.as_view(), name='session-export'),
    path('solo/sessions/<uuid:pk>/exports/', SessionExportsListView.as_view(), name='session-exports-list'),
    path('solo/sessions/<uuid:pk>/duplicate/', SoloSessionDuplicateView.as_view(), name='session-duplicate'),
    path('solo/sessions/<uuid:pk>/diff/', SoloSessionDiffSaveView.as_view(), name='session-diff'),
    path('solo/sessions/<uuid:pk>/save-stream/', SoloSessionStreamSaveView.as_view(), name='session-stream-save'),
    path('solo/sessions/<uuid:pk>/beacon/', SoloSessionBeaconSaveView.as_view(), name='session-beacon'),
    path('solo/sessions/<uuid:pk>/snapshot/', SoloSessionSnapshotCreateView.as_view(), name='session-snapshot-create'),
    path('solo/sessions/<uuid:pk>/snapshot/latest/', SoloSessionSnapshotLatestView.as_view(), name='session-snapshot-latest'),
    
    # Sharing (v0.27)
    path('solo/sessions/<uuid:pk>/share/', SessionShareView.as_view(), name='session-share'),
    path('solo/sessions/<uuid:pk>/thumbnail/', ThumbnailRegenerateView.as_view(), name='session-thumbnail'),
    
    # Public access (v0.27)
    path('solo/public/<str:token>/', PublicSessionView.as_view(), name='public-session'),
    
    # Export status polling (v0.28)
    path('exports/<uuid:pk>/', ExportDetailView.as_view(), name='export-detail'),
]
