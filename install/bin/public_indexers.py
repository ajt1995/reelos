#!/usr/bin/env python3
"""Public Prowlarr indexers ReelOS may add. No private tracker credentials.

YTS is movies-only — it will not grab Brooklyn Nine-Nine. EZTV / ShowRSS are
the TV public defs. 1337x and TPB are mixed. TorBox torznab is separate.

#58 only POSTed when Cardigann schema hints matched (`eztv`, `showrss`).
Prowlarr's always-present native fallback is TorrentRssIndexer ("Torrent RSS
Feed"), which does not contain those strings. House 1.2.24 got native TPB;
EZTV/ShowRSS logged `no schema` and Apply still succeeded. 1.2.50.7 adds a
TorrentRss RSS fallback and a doctor listing that fails closed if TV publics
are missing.
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

# Public RSS (no keys). Used when Cardigann YAML is not in /indexer/schema.
TV_RSS_FEEDS = {
    "ReelOS-eztv": ("https://eztvx.to/ezrss.xml", "https://eztv.wf/ezrss.xml"),
    "ReelOS-showrss": ("https://showrss.info/other/all.rss",),
}

RSS_SCHEMA_HINTS = ("torrentrss", "torrent rss", "torrentrssindexer")


def plan_missing_public_indexers(have_names) -> list[tuple[str, tuple, str]]:
    have = {str(n) for n in (have_names or [])}
    return [(n, hints, role) for n, hints, role in PUBLIC_INDEXERS if n not in have]


def tv_public_indexer_names() -> list[str]:
    return [n for n, _hints, role in PUBLIC_INDEXERS if role in ("tv", "both")]


def movie_only_public_indexer_names() -> list[str]:
    return [n for n, _hints, role in PUBLIC_INDEXERS if role == "movie"]


def required_tv_public_names() -> list[str]:
    """Must be on Prowlarr (and synced to Sonarr) for sitcom SeasonSearch."""
    return [n for n, _hints, role in PUBLIC_INDEXERS if role == "tv"]


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


def schema_blob(schema: dict) -> str:
    parts = [
        str(schema.get("implementation") or ""),
        str(schema.get("implementationName") or ""),
        str(schema.get("name") or ""),
        str(schema.get("infoLink") or ""),
    ]
    for f in schema.get("fields") or []:
        if not isinstance(f, dict):
            continue
        if f.get("name") in ("definitionFile", "definitionName"):
            parts.append(str(f.get("value") or ""))
    return " ".join(parts).lower()


def match_schema(schemas, hints) -> dict | None:
    if not isinstance(schemas, list):
        return None
    for schema in schemas:
        if not isinstance(schema, dict):
            continue
        blob = schema_blob(schema)
        if any(h in blob for h in hints):
            return schema
    return None


def rss_feeds_for(name: str) -> tuple[str, ...]:
    return TV_RSS_FEEDS.get(name) or ()


def pick_add_plan(name: str, hints, schemas) -> dict:
    """How to POST this indexer. Cardigann if present; else TorrentRss RSS."""
    hit = match_schema(schemas, hints)
    if hit:
        impl = str(hit.get("implementation") or "").lower()
        feeds = rss_feeds_for(name)
        if "torrentrss" in impl and feeds:
            return {"method": "rss", "feed_url": feeds[0], "schema": hit}
        return {"method": "schema", "schema": hit}
    feeds = rss_feeds_for(name)
    if feeds:
        rss = match_schema(schemas, RSS_SCHEMA_HINTS)
        return {"method": "rss", "feed_url": feeds[0], "schema": rss}
    return {"method": "skip", "reason": "no schema"}


def _field_name(item: dict) -> str:
    return str(item.get("name") or "").lower().replace("_", "")


def torrent_rss_fields(schema: dict | None, feed_url: str, allow_zero: bool = True) -> list[dict]:
    fields: list[dict] = []
    seen = set()
    for f in (schema or {}).get("fields") or []:
        if not isinstance(f, dict):
            continue
        item = dict(f)
        n = _field_name(item)
        if n in ("baseurl", "url", "feedurl"):
            item["value"] = feed_url
        elif n in ("allowzerosize",):
            item["value"] = allow_zero
        fields.append(item)
        seen.add(n)
    if "baseurl" not in seen and "url" not in seen and "feedurl" not in seen:
        fields.append({"name": "baseUrl", "value": feed_url})
    if "allowzerosize" not in seen:
        fields.append({"name": "allowZeroSize", "value": allow_zero})
    return fields


def indexer_body_from_schema(name: str, schema: dict, api_key: str = "") -> dict:
    fields = []
    for f in schema.get("fields") or []:
        if not isinstance(f, dict):
            continue
        if str(f.get("type") or "") in ("info", "display"):
            continue
        item = dict(f)
        n = _field_name(item)
        if n in ("apikey", "token"):
            item["value"] = api_key
        fields.append(item)
    return {
        "enable": True,
        "appProfileId": schema.get("appProfileId") or 1,
        "priority": schema.get("priority") or 25,
        "name": name,
        "protocol": schema.get("protocol") or "torrent",
        "implementation": schema.get("implementation"),
        "implementationName": schema.get("implementationName"),
        "configContract": schema.get("configContract"),
        "fields": fields,
    }


def torrent_rss_body(name: str, feed_url: str, schema: dict | None = None) -> dict:
    hit = schema or {
        "implementation": "TorrentRssIndexer",
        "implementationName": "Torrent RSS Feed",
        "configContract": "TorrentRssIndexerSettings",
        "protocol": "torrent",
        "appProfileId": 1,
        "priority": 25,
    }
    body = indexer_body_from_schema(name, hit)
    body["implementation"] = hit.get("implementation") or "TorrentRssIndexer"
    body["implementationName"] = hit.get("implementationName") or "Torrent RSS Feed"
    body["configContract"] = hit.get("configContract") or "TorrentRssIndexerSettings"
    body["fields"] = torrent_rss_fields(hit, feed_url, allow_zero=True)
    return body


def plan_to_post_body(name: str, plan: dict) -> dict | None:
    method = plan.get("method")
    if method == "schema":
        return indexer_body_from_schema(name, plan["schema"])
    if method == "rss":
        return torrent_rss_body(name, plan["feed_url"], plan.get("schema"))
    return None


def plan_adds(have_names, schemas) -> list[dict]:
    """Bodies we would POST. A TPB/YTS-only house must still get EZTV+ShowRSS."""
    have = {str(n) for n in (have_names or [])}
    out = []
    for name, hints, _role in PUBLIC_INDEXERS:
        if name in have:
            continue
        plan = pick_add_plan(name, hints, schemas)
        body = plan_to_post_body(name, plan)
        if not body:
            continue
        body["_method"] = plan["method"]
        out.append(body)
        have.add(name)
    return out


def enabled_indexer_names(rows) -> list[str]:
    names = []
    for ix in rows if isinstance(rows, list) else []:
        if not isinstance(ix, dict) or not ix.get("enable"):
            continue
        n = str(ix.get("name") or "").strip()
        if n:
            names.append(n)
    return names


def doctor_releases_detail(enabled_names) -> tuple[str, bool]:
    """Doctor must list every enabled indexer, not the first live-test pass.

    House 1.2.50.6 showed only ReelOS-tpb because releases_hop returned on the
    first indexer/test success. Missing EZTV/ShowRSS is a failed hop.
    """
    names = [str(n) for n in (enabled_names or []) if n]
    have = set(names)
    missing = [n for n in required_tv_public_names() if n not in have]
    listed = ",".join(names) if names else "none"
    if missing:
        return f"{listed} (missing {','.join(missing)})", False
    return listed, True


def hybrid_quality_should_allow(name: str) -> bool:
    """Wizard hybrid = 1080p / 4K when available. EZTV is typically 720p WEB-DL."""
    n = str(name or "").lower().replace(" ", "").replace("-", "").replace("_", "")
    return any(tag in n for tag in ("720p", "1080p", "2160p", "4k"))


def widen_hybrid_profile_items(items) -> bool:
    """Allow 720p/1080p/2160p on a Sonarr quality profile. Returns True if changed."""
    changed = False
    if not isinstance(items, list):
        return False
    for item in items:
        if not isinstance(item, dict):
            continue
        kids = item.get("items")
        if isinstance(kids, list) and kids:
            if widen_hybrid_profile_items(kids):
                if item.get("allowed") is not True:
                    item["allowed"] = True
                    changed = True
            continue
        q = item.get("quality") if isinstance(item.get("quality"), dict) else {}
        qname = str(q.get("name") or item.get("name") or "")
        if hybrid_quality_should_allow(qname) and item.get("allowed") is not True:
            item["allowed"] = True
            changed = True
    return changed


HOUSE_TPB_YTS_SCHEMAS = (
    {"name": "The Pirate Bay", "implementation": "ThePirateBay", "fields": []},
    {"name": "YTS", "implementation": "YTS", "fields": []},
    {
        "name": "Torrent RSS Feed",
        "implementation": "TorrentRssIndexer",
        "implementationName": "Torrent RSS Feed",
        "configContract": "TorrentRssIndexerSettings",
        "protocol": "torrent",
        "fields": [
            {"name": "baseUrl", "value": ""},
            {"name": "allowZeroSize", "value": False},
        ],
    },
)


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

        def test_house_with_only_tpb_yts_still_needs_eztv_showrss(self):
            missing = plan_missing_public_indexers(["ReelOS-tpb", "ReelOS-yts"])
            names = [n for n, _h, _r in missing]
            self.assertIn("ReelOS-eztv", names)
            self.assertIn("ReelOS-showrss", names)
            self.assertIn("ReelOS-1337x", names)

        def test_ota_adds_even_when_tests_skip(self):
            self.assertTrue(ota_should_add_missing_public_indexers())
            self.assertTrue(ota_should_skip_live_indexer_tests())

        def test_prowlarr_sonarr_sync_is_full(self):
            self.assertEqual(prowlarr_app_sync_level(), "fullSync")
            self.assertTrue(prowlarr_app_needs_update({"name": "Sonarr", "syncLevel": "addOnly"}))
            self.assertFalse(prowlarr_app_needs_update({"name": "Sonarr", "syncLevel": "fullSync"}))

        def test_no_cardigann_schema_uses_torrent_rss_fallback(self):
            plan = pick_add_plan("ReelOS-eztv", ("eztv",), list(HOUSE_TPB_YTS_SCHEMAS))
            self.assertEqual(plan["method"], "rss")
            self.assertIn("eztv", plan["feed_url"])
            show = pick_add_plan("ReelOS-showrss", ("showrss", "show rss"), list(HOUSE_TPB_YTS_SCHEMAS))
            self.assertEqual(show["method"], "rss")
            self.assertIn("showrss.info", show["feed_url"])

        def test_tpb_yts_only_house_posts_eztv_and_showrss(self):
            bodies = plan_adds(["ReelOS-tpb", "ReelOS-yts"], list(HOUSE_TPB_YTS_SCHEMAS))
            names = [b["name"] for b in bodies]
            self.assertIn("ReelOS-eztv", names)
            self.assertIn("ReelOS-showrss", names)
            eztv = next(b for b in bodies if b["name"] == "ReelOS-eztv")
            self.assertEqual(eztv["implementation"], "TorrentRssIndexer")
            self.assertEqual(eztv["_method"], "rss")
            vals = [f.get("value") for f in eztv["fields"]]
            self.assertTrue(any(str(v).endswith("ezrss.xml") for v in vals), vals)
            show = next(b for b in bodies if b["name"] == "ReelOS-showrss")
            self.assertEqual(show["implementation"], "TorrentRssIndexer")
            self.assertTrue(any("showrss.info" in str(f.get("value") or "") for f in show["fields"]))

        def test_cardigann_eztv_still_preferred_when_schema_exists(self):
            schemas = list(HOUSE_TPB_YTS_SCHEMAS) + [
                {
                    "name": "EZTV",
                    "implementation": "Cardigann",
                    "fields": [{"name": "definitionFile", "value": "eztv"}],
                }
            ]
            plan = pick_add_plan("ReelOS-eztv", ("eztv",), schemas)
            self.assertEqual(plan["method"], "schema")
            self.assertEqual(plan["schema"]["name"], "EZTV")

        def test_doctor_lists_all_and_fails_when_tv_publics_missing(self):
            detail, ok = doctor_releases_detail(["ReelOS-tpb"])
            self.assertFalse(ok)
            self.assertIn("ReelOS-tpb", detail)
            self.assertIn("missing ReelOS-eztv,ReelOS-showrss", detail)
            good, ok2 = doctor_releases_detail(["ReelOS-tpb", "ReelOS-eztv", "ReelOS-showrss"])
            self.assertTrue(ok2)
            self.assertEqual(good, "ReelOS-tpb,ReelOS-eztv,ReelOS-showrss")
            self.assertNotIn("missing", good)

        def test_hybrid_profile_allows_eztv_720p(self):
            items = [
                {"quality": {"id": 1, "name": "SDTV"}, "allowed": False},
                {"quality": {"id": 4, "name": "HDTV-720p"}, "allowed": False},
                {"quality": {"id": 5, "name": "WEBDL-720p"}, "allowed": False},
                {"quality": {"id": 3, "name": "WEBDL-1080p"}, "allowed": False},
                {"quality": {"id": 18, "name": "WEBDL-2160p"}, "allowed": True},
            ]
            self.assertTrue(widen_hybrid_profile_items(items))
            allowed = {i["quality"]["name"] for i in items if i.get("allowed")}
            self.assertIn("WEBDL-720p", allowed)
            self.assertIn("WEBDL-1080p", allowed)
            self.assertIn("WEBDL-2160p", allowed)
            self.assertNotIn("SDTV", allowed)
            self.assertFalse(widen_hybrid_profile_items(items))

    suite = unittest.defaultTestLoader.loadTestsFromTestCase(Public)
    result = unittest.TextTestRunner(verbosity=2).run(suite)
    return 0 if result.wasSuccessful() else 1


if __name__ == "__main__":
    import sys

    if "--self-test" in sys.argv:
        raise SystemExit(_self_test())
    raise SystemExit("public_indexers.py is imported by wire-engines")
