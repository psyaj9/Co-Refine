"""
Domain exceptions for Co-Refine.

These exceptions represent error conditions in the application's core logic and are meant to be raised by services when they encounter a problem.
The separation keeps business logic clean, meaning services don't import HTTPExceptions, and routers don't need to know about DB internals.
"""

class DomainError(Exception):
    """Base class for all domain exceptions.

    Catch this in routers when you want to handle any domain failure with a single
    except block. Subclass it when you need to distinguish error types at the call site.
    """

    def __init__(self, message: str = ""):
        self.message = message
        super().__init__(self.message)


class NotFoundError(DomainError):
    """Raised when a requested resource does not exist in database.

    Routers typically map this to HTTP 404.
    """
    pass


class ValidationError(DomainError):
    """Raised when input fails validation.

    For example, trying to create a code with a label that is already taken in the project.
    Routers typically map this to HTTP 422 or 400.
    """
    pass


class ConflictError(DomainError):
    """Raised when an operation cannot proceed due to a state conflict.

    For example, trying to delete a resource that has dependents preventing deletion.
    Routers typically map this to HTTP 409.
    """
    pass


class ExternalServiceError(DomainError):
    """Raised when a call to an external service fails.

    Routers typically map this to HTTP 502 or 503. Callers that can recover should catch this explicitly.
    """
    pass
