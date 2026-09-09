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


def apply_public_indexers(have_rows, schemas, post, log=None) -> list[str]:
    """Run the Apply POST loop. Schema miss / empty schema still POSTs TV RSS.

    post(name, body, via) -> bool. House 1.2.50.6 logged `no schema` and skipped.
    """
    log = log or (lambda *_a, **_k: None)
    names: set[str] = set()
    for ix in have_rows if isinstance(have_rows, list) else []:
        if isinstance(ix, dict) and ix.get("name"):
            names.add(str(ix.get("name")))
    schema_list = schemas if isinstance(schemas, list) else []
    posted: list[str] = []

    def try_post(name: str, body: dict | None, via: str) -> bool:
        if not body:
            return False
        clean = {k: v for k, v in body.items() if not str(k).startswith("_")}
        if not post(name, clean, via):
            return False
        posted.append(name)
        names.add(name)
        return True

    for name, hints, _role in PUBLIC_INDEXERS:
        if name in names:
            log(f"public indexer exists {name}")
            continue
        plan = pick_add_plan(name, hints, schema_list)
        body = plan_to_post_body(name, plan)
        via = str(plan.get("method") or "schema")
        if try_post(name, body, via):
            continue
        feeds = rss_feeds_for(name)
        if feeds and try_post(
            name,
            torrent_rss_body(name, feeds[0], match_schema(schema_list, RSS_SCHEMA_HINTS)),
            "rss fallback",
        ):
            continue
        log(f"public indexer no schema {name}")

    for req in required_tv_public_names():
        if req in names:
            continue
        feeds = rss_feeds_for(req)
        if not feeds:
            continue
        try_post(
            req,
            torrent_rss_body(req, feeds[0], match_schema(schema_list, RSS_SCHEMA_HINTS)),
            "rss fallback",
        )
    return posted


def _sandbox_house_prowlarr():
    """HTTP mock of the house: ReelOS-tpb present, no Cardigann eztv/showrss."""
    import json
    from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
    from threading import Thread
    from urllib.request import Request, urlopen

    store = {
        "indexers": [
            {
                "id": 1,
                "name": "ReelOS-tpb",
                "enable": True,
                "implementation": "ThePirateBay",
            }
        ],
        "posts": [],
        "schema_ok": True,
    }

    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *_a):
            return

        def _json(self, code, obj):
            raw = json.dumps(obj).encode()
            self.send_response(code)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(raw)))
            self.end_headers()
            self.wfile.write(raw)

        def do_GET(self):
            path = self.path.split("?")[0]
            if path.endswith("/indexer/schema"):
                if not store["schema_ok"]:
                    self._json(500, {"message": "schema down"})
                    return
                self._json(200, list(HOUSE_TPB_YTS_SCHEMAS))
                return
            if path.endswith("/indexer"):
                self._json(200, store["indexers"])
                return
            self._json(404, {"error": "no"})

        def do_POST(self):
            n = int(self.headers.get("Content-Length") or 0)
            body = json.loads(self.rfile.read(n) or b"{}")
            store["posts"].append(body)
            row = dict(body)
            row["id"] = len(store["indexers"]) + 10
            row.setdefault("enable", True)
            store["indexers"].append(row)
            self._json(201, row)

    httpd = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    thread = Thread(target=httpd.serve_forever, daemon=True)
    thread.start()
    try:
        port = httpd.server_address[1]
        base = f"http://127.0.0.1:{port}/api/v1"

        def fetch(path):
            with urlopen(f"{base}{path}", timeout=5) as resp:
                return json.loads(resp.read().decode() or "[]")

        def post(name, body, via):
            req = Request(
                f"{base}/indexer",
                data=json.dumps(body).encode(),
                method="POST",
                headers={"Content-Type": "application/json", "X-Api-Key": "test"},
            )
            with urlopen(req, timeout=5) as resp:
                return 200 <= getattr(resp, "status", 201) < 300

        have = fetch("/indexer")
        try:
            schemas = fetch("/indexer/schema")
        except Exception:
            schemas = []
        posted = apply_public_indexers(have, schemas, post=post)
        return posted, [p.get("name") for p in store["posts"]], store["indexers"]
    finally:
        httpd.shutdown()
        httpd.server_close()


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


def profile_allows_hd(profile: dict | None) -> bool:
    """True if 720p or 1080p is allowed. 2160p-only Ultra-HD still rejects EZTV."""
    if not isinstance(profile, dict):
        return False
    return _profile_items_allow_web_hd(profile.get("items") or [])


def _profile_items_allow_web_hd(items) -> bool:
    if not isinstance(items, list):
        return False
    for item in items:
        if not isinstance(item, dict):
            continue
        kids = item.get("items")
        if isinstance(kids, list) and kids and _profile_items_allow_web_hd(kids):
            return True
        q = item.get("quality") if isinstance(item.get("quality"), dict) else {}
        qname = str(q.get("name") or item.get("name") or "").lower().replace(" ", "").replace("-", "")
        if item.get("allowed") is True and ("720p" in qname or "1080p" in qname):
            return True
    return False


def pick_fallback_profile(profiles, current_id) -> dict:
    """SeasonSearch uses the series profile. Ultra-HD 2160p-only → 0 grabs for EZTV 720p."""
    rows = [p for p in (profiles or []) if isinstance(p, dict)]
    current = next((p for p in rows if p.get("id") == current_id), None)
    if profile_allows_hd(current):
        return {"id": current_id, "reason": "ok", "name": current.get("name") if current else None}
    for name in ("Any", "HD-1080p", "HD-720p"):
        hit = next((p for p in rows if p.get("name") == name), None)
        if hit and hit.get("id") is not None:
            return {"id": hit.get("id"), "reason": name.lower().replace("-", ""), "name": name}
    for p in rows:
        if profile_allows_hd(p) and p.get("id") is not None:
            return {"id": p.get("id"), "reason": "hd-profile", "name": p.get("name")}
    return {"id": current_id, "reason": "none", "name": current.get("name") if current else None}


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

        def test_empty_schema_still_posts_eztv_showrss(self):
            posted = []

            def post(name, body, via):
                posted.append((name, body.get("implementation"), via, body))
                return True

            names = apply_public_indexers(
                [{"name": "ReelOS-tpb", "enable": True}],
                [],
                post=post,
            )
            self.assertIn("ReelOS-eztv", names)
            self.assertIn("ReelOS-showrss", names)
            eztv = next(p for p in posted if p[0] == "ReelOS-eztv")
            self.assertEqual(eztv[1], "TorrentRssIndexer")
            self.assertEqual(eztv[2], "rss")
            vals = [f.get("value") for f in eztv[3]["fields"]]
            self.assertTrue(any(str(v).endswith("ezrss.xml") for v in vals), vals)

        def test_sandbox_house_tpb_only_http_posts_eztv_showrss(self):
            posted, names, rows = _sandbox_house_prowlarr()
            self.assertIn("ReelOS-eztv", posted)
            self.assertIn("ReelOS-showrss", posted)
            self.assertIn("ReelOS-eztv", names)
            self.assertIn("ReelOS-showrss", names)
            enabled = [r["name"] for r in rows if r.get("enable")]
            detail, ok = doctor_releases_detail(enabled)
            self.assertTrue(ok, detail)
            self.assertIn("ReelOS-eztv", detail)
            self.assertIn("ReelOS-showrss", detail)
            eztv = next(r for r in rows if r.get("name") == "ReelOS-eztv")
            self.assertEqual(eztv.get("implementation"), "TorrentRssIndexer")
            self.assertTrue(
                any(str(f.get("value") or "").endswith("ezrss.xml") for f in eztv.get("fields") or [])
            )

        def test_ultra_hd_only_falls_back_to_any_for_eztv_720p(self):
            ultra = {
                "id": 6,
                "name": "Ultra-HD",
                "items": [
                    {"quality": {"id": 5, "name": "WEBDL-720p"}, "allowed": False},
                    {"quality": {"id": 18, "name": "WEBDL-2160p"}, "allowed": True},
                ],
            }
            anyp = {
                "id": 1,
                "name": "Any",
                "items": [{"quality": {"id": 5, "name": "WEBDL-720p"}, "allowed": True}],
            }
            fb = pick_fallback_profile([ultra, anyp], 6)
            self.assertEqual(fb["reason"], "any")
            self.assertEqual(fb["id"], 1)
            self.assertEqual(pick_fallback_profile([ultra, anyp], 1)["reason"], "ok")

    suite = unittest.defaultTestLoader.loadTestsFromTestCase(Public)
    result = unittest.TextTestRunner(verbosity=2).run(suite)
    return 0 if result.wasSuccessful() else 1


if __name__ == "__main__":
    import sys

    if "--self-test" in sys.argv:
        raise SystemExit(_self_test())
    raise SystemExit("public_indexers.py is imported by wire-engines")
