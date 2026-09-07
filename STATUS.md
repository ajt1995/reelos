# STATUS.md

Xorriso. Dated **2026-09-07 12:54 +08**.

# 1.2.30

House: FUSE is up, Guardians file is ready, Watch tries and fails. Jellyfin was started before `/mnt/debrid` mounted, so the container cannot read the mkv.

Fix: after Decypharr mounts, restart Jellyfin/Radarr/Sonarr. OTA skips the TorBox indexer 2-minute wait.

Play now without waiting for this stamp:
`sudo docker restart reelos-jellyfin-1 reelos-radarr-1`
then Watch again in ~20s.
