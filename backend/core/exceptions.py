"""Domain exception hierarchy for Co-Refine.

Router layers catch these and map to appropriate HTTPException status codes.
"""


class DomainError(Exception):
    """Base class for all domain exceptions."""

    def __init__(self, message: str = ""):
        self.message = message
        super().__init__(self.message)


class NotFoundError(DomainError):
    """Raised when a requested resource does not exist."""
    pass


class ValidationError(DomainError):
    """Raised when input validation fails at the domain level."""
    pass


class ConflictError(DomainError):
    """Raised when an operation conflicts with existing state."""
    pass


class ExternalServiceError(DomainError):
    """Raised when an external service (LLM, ChromaDB, etc.) fails."""
    pass
