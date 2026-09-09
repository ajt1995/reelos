#!/usr/bin/env python3
"""Public Prowlarr indexers ReelOS may add. No private tracker credentials.

YTS is movies-only — it will not grab Brooklyn Nine-Nine. EZTV / ShowRSS are
the TV public defs. 1337x and TPB are mixed. TorBox torznab is separate.
"""
from __future__ import annotations

# (name, schema hints, role) — role is movie | tv | both
PUBLIC_INDEXERS = (
    ("ReelOS-1337x", ("1337x",), "both"),
    ("ReelOS-tpb", ("thepiratebay", "the pirate bay"), "both"),
    ("ReelOS-yts", ("yts", "yify"), "movie"),
    ("ReelOS-eztv", ("eztv",), "tv"),
    ("ReelOS-showrss", ("showrss", "show rss"), "tv"),
)


def plan_missing_public_indexers(have_names) -> list[tuple[str, tuple, str]]:
    have = {str(n) for n in (have_names or [])}
    return [(n, hints, role) for n, hints, role in PUBLIC_INDEXERS if n not in have]


def tv_public_indexer_names() -> list[str]:
    return [n for n, _hints, role in PUBLIC_INDEXERS if role in ("tv", "both")]


def movie_only_public_indexer_names() -> list[str]:
    return [n for n, _hints, role in PUBLIC_INDEXERS if role == "movie"]


def ota_should_add_missing_public_indexers() -> bool:
    """OTA used to return before POST. Adds must still run; live tests may skip."""
    return True


def ota_should_skip_live_indexer_tests() -> bool:
    return True


def prowlarr_app_sync_level() -> str:
    return "fullSync"


def prowlarr_app_needs_update(app: dict | None) -> bool:
    if not app:
        return False
    return str(app.get("syncLevel") or "") != prowlarr_app_sync_level()


def _self_test() -> int:
    import unittest

    class Public(unittest.TestCase):
        def test_yts_is_movies_only_not_b99(self):
            self.assertIn("ReelOS-yts", movie_only_public_indexer_names())
            self.assertNotIn("ReelOS-yts", tv_public_indexer_names())

        def test_eztv_and_showrss_cover_tv(self):
            tv = tv_public_indexer_names()
            self.assertIn("ReelOS-eztv", tv)
            self.assertIn("ReelOS-showrss", tv)
            self.assertIn("ReelOS-1337x", tv)
            self.assertIn("ReelOS-tpb", tv)

        def test_house_with_only_yts_still_needs_tv_publics(self):
            missing = plan_missing_public_indexers(["ReelOS-yts", "ReelOS-torbox"])
            names = [n for n, _h, _r in missing]
            self.assertIn("ReelOS-eztv", names)
            self.assertIn("ReelOS-showrss", names)
            self.assertNotIn("ReelOS-yts", names)

        def test_ota_adds_even_when_tests_skip(self):
            self.assertTrue(ota_should_add_missing_public_indexers())
            self.assertTrue(ota_should_skip_live_indexer_tests())

        def test_prowlarr_sonarr_sync_is_full(self):
            self.assertEqual(prowlarr_app_sync_level(), "fullSync")
            self.assertTrue(prowlarr_app_needs_update({"name": "Sonarr", "syncLevel": "addOnly"}))
            self.assertFalse(prowlarr_app_needs_update({"name": "Sonarr", "syncLevel": "fullSync"}))

    suite = unittest.defaultTestLoader.loadTestsFromTestCase(Public)
    result = unittest.TextTestRunner(verbosity=2).run(suite)
    return 0 if result.wasSuccessful() else 1


if __name__ == "__main__":
    import sys

    if "--self-test" in sys.argv:
        raise SystemExit(_self_test())
    raise SystemExit("public_indexers.py is imported by wire-engines")
