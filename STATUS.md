# STATUS.md

Xorriso. Dated **2026-09-07 17:45 CDT**.

# 1.2.39

Chrome that was localStorage-only:

- Quality POST `/api/quality` → answers.json (new requests use it)
- Library chips POST `/api/intent` (Lidarr up/down with Music)
- Ping GET `/api/ping` → Decypharr :8282
- Activity GET `/api/activity` (wire + ota + journal)
- Play `/play/:id` opens Jellyfin, not a fake scrubber
- Splash lab button gone
- Daily Check → systemd timer; stack images → flag the updater pulls
- Notifications request browser permission and persist on disk
