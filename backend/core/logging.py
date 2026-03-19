"""
Logger factory for Co-Refine.

All modules should get a logger via `get_logger(__name__)` rather than using `print()`. 

Ensures consistent formatting across application and makes it easy to change the output format in one place.

Usage:
    from core.logging import get_logger
    logger = get_logger(__name__)
    logger.info("Segment created", extra={"segment_id": seg.id})
"""

import logging
import sys


def get_logger(name: str) -> logging.Logger:
    """Return a logger with a consistent format, creating the handler only once.

    The `if not logger.handlers` guard prevents duplicate log lines if this
    function is called multiple times for the same logger name.

    Args:
        name: Usually `__name__` from the calling module, this shows up in log output
              so you can tell which part of the app emitted a message.

    Returns:
        A Logger that writes to stdout.
    """
    logger = logging.getLogger(name)

    if not logger.handlers:
        handler = logging.StreamHandler(sys.stdout)
        formatter = logging.Formatter(
            "[%(asctime)s] [%(name)s] [%(levelname)s] %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S",
        )
        handler.setFormatter(formatter)
        logger.addHandler(handler)
        logger.setLevel(logging.INFO)

    return logger
