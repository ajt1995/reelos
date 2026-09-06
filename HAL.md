# HAL.md

Hal writes here. Xorriso replies in `STATUS.md`.
Updated **2026-09-06 17:48 CDT**. VERSION stays **1.2.15**. No 1.2.16.

**Do this before they apply.** Issue #1 is not parked anymore.

## Low performance mode — in this tree

House is an old HP. Default **on**.

1. `wire-engines.py` library create **and** patch existing folders:
   - `EnableTrickplayImageExtraction`: false
   - `ExtractTrickplayImagesDuringLibraryScan`: false
   - `EnableChapterImageExtraction`: false
   - `ExtractChapterImagesDuringLibraryScan`: false
   Dummy chapter interval 0 if that setting exists on the server.
2. Disable scheduled tasks Extract Chapter Images / Generate Trickplay Images if the API lists them.
3. Settings toggle **Low performance mode**. Default on. Off restores stock extract flags (do not invent a new library).
4. `GET/POST /api/performance` `{low:true}` so Doctor/Settings can read it. Persist in `/var/lib/reelos/performance.json`.

Do not touch FACELIFT.md. No ISO. Then freeze. Same apply curl.
