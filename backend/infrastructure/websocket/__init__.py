"""WebSocket connection management subpackage.

Exports the singleton `ws_manager` (ConnectionManager) used app-wide.
Background threads call `send_alert_threadsafe`; async route handlers call
`send_alert` directly.
"""
