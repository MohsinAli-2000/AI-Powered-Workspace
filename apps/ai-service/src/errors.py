class ServiceError(Exception):
    """
    Base class for failures whose message is safe to show to API callers.
    Handlers in main.py turn these into clean JSON responses instead of opaque 500s.
    """
    status_code = 500
    code = "internal_error"

    def __init__(self, message: str) -> None:
        super().__init__(message)
        self.message = message


class ProviderUnavailableError(ServiceError):
    """Upstream model provider is overloaded, rate limited, or unreachable (transient)."""
    status_code = 503
    code = "provider_unavailable"


class ProviderRequestError(ServiceError):
    """Upstream model provider rejected the request (bad key, bad model, blocked content...)."""
    status_code = 502
    code = "provider_error"


class InvalidInputError(ServiceError):
    """The caller sent input that cannot be processed."""
    status_code = 422
    code = "invalid_input"
