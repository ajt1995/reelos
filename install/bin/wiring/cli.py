"""CLI entry point and command router for wire-engines."""
from __future__ import annotations

import sys

from .arr import ensure_hybrid_recycle_bin
from .bootstrap import main
from .common import log_wire
from .fuse import ensure_fuse, fuse_unstack_stale
from .hardware import apply_arr_debrid_media_info
from .imports import heal_after_import, kick_imports, ota_clean_bounded_heal
from .indexers import ensure_indexers_and_sync
from .jellyfin import apply_jellyfin_performance, heal_merge_movie_posters


def run_cli() -> int:
    if "ota-clean" in sys.argv:
        ota_clean_bounded_heal()
        return 0
    if "--performance" in sys.argv or "no-ffprobe" in sys.argv:
        apply_jellyfin_performance()
        apply_arr_debrid_media_info()
        fuse_unstack_stale()
        return 0
    if "fuse" in sys.argv:
        ensure_fuse()
        return 0
    if "merge-movies" in sys.argv:
        try:
            ensure_hybrid_recycle_bin()
        except Exception as e:
            log_wire(f"radarr hybrid recycle {e}")
        return 0 if heal_merge_movie_posters() else 1
    if "heal" in sys.argv:
        return 0 if heal_after_import() else 1
    if "import" in sys.argv:
        return 0 if kick_imports(catch_up="--catch-up" in sys.argv) else 1
    if "indexers" in sys.argv:
        return ensure_indexers_and_sync()
    return main()
