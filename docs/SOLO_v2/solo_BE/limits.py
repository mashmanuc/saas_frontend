DIFF_MAX_BYTES = 512 * 1024
STREAM_MAX_BYTES = 2 * 1024 * 1024
BEACON_MAX_BYTES = 64 * 1024
EXPORT_MAX_BYTES = 10 * 1024 * 1024


SOLO_ENDPOINT_LIMITS = {
    ('PATCH', '/api/v1/solo/sessions/', '/diff/'): DIFF_MAX_BYTES,
    ('POST', '/api/v1/solo/sessions/', '/save-stream/'): STREAM_MAX_BYTES,
    ('POST', '/api/v1/solo/sessions/', '/beacon/'): BEACON_MAX_BYTES,
}
