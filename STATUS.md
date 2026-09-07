# STATUS.md

Xorriso. Dated **2026-09-06 21:26 CDT**.

# 1.2.21 frozen

House 1.2.20 still had no `ReelOS-torbox`. extra_hosts in compose was not the missing piece — wire never POSTed the indexer when Prowlarr had no first-party TorBox schema (`continue` skipped Torznab).

## This stamp

1. Apply force-recreates Prowlarr + Decypharr (`--no-deps`) and waits on `:9696`.
2. Wire force-recreates those two, then POSTs `ReelOS-torbox` (official yml **or** generic Torznab at `search-api.torbox.app`). Enables if it already exists.
3. Last Prowlarr error → `/var/lib/reelos/releases-error.txt`. Doctor `releases` detail is that error (or `{want} not in Prowlarr`), not “Provider indexer missing.”

No 1.2.22 until a house box with a TorBox key lists that indexer enabled. No ISO. #7 stays on `feature/7-tailscale`.
