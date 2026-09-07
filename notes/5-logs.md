# #5 House logs

Parked on `feature/5-logs`. Do **not** merge. VERSION stays 1.2.23.

Settings → Logs:
- **Copy last hour** → clipboard (`GET /api/logs`)
- **Download** → `reelos-house.txt`

Blob: VERSION, applied-sha, doctor JSON, releases-error, last 80 ota.log, last 80 wire.log, systemd is-active, docker ps, last 40 journalctl reelos (1h).

Redacts ApiKey / apiKey / adminPassword / Authorization / Bearer.

Not this ticket: ship to GitHub, auto-mail Hal, full journal.
