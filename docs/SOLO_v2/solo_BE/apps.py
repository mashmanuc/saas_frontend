"""Solo Workspace app configuration."""
from django.apps import AppConfig


class SoloConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.solo'
    verbose_name = 'Solo Workspace'
    
    def ready(self):
        # Import signals to register them
        import apps.solo.signals  # noqa
