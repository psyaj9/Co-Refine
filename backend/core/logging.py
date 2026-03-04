"""Structured logging setup for Co-Refine backend.

Usage:
    from core.logging import get_logger
    logger = get_logger(__name__)
    logger.info("Something happened", extra={"segment_id": sid})
"""

import logging
import sys


def get_logger(name: str) -> logging.Logger:
    """Create a logger with consistent formatting.

    Safe to call multiple times — idempotent thanks to handler check.
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
