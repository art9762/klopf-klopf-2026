"""Stuck-vehicle detector: track centroid speed, flag IDs idle >30s.

TODO: maintain rolling window of bbox centroids per track_id; when stddev
of position falls below threshold for the configured duration, mark stuck.
"""

from __future__ import annotations
