"""
Rate limiting for Solo API.
"""
from rest_framework.throttling import UserRateThrottle, AnonRateThrottle


class SoloUserRateThrottle(UserRateThrottle):
    """Rate limit for authenticated users."""
    scope = 'solo_user'


class SoloAnonRateThrottle(AnonRateThrottle):
    """Rate limit for anonymous users (public shares)."""
    scope = 'solo_anon'


class SoloExportRateThrottle(UserRateThrottle):
    """Rate limit for export operations (expensive)."""
    scope = 'solo_export'


class SoloSaveStreamThrottle(UserRateThrottle):
    """Rate limit for stream save operations."""
    scope = 'solo_stream'
    # Default: 60/min per user


class SoloBeaconThrottle(UserRateThrottle):
    """Rate limit for beacon save operations."""
    scope = 'solo_beacon'
    # Default: 120/min per user (keepalive)


class SoloDiffThrottle(UserRateThrottle):
    """Rate limit for diff-save operations."""
    scope = 'solo_diff'
    # Default: 120/min per user
