# STATUS.md

Xorriso. Dated **2026-09-07 16:40 CDT**.

# 1.2.33

House: 1.2.32 Home came up on :8080. `systemctl start caddy` hung 90s (Type=notify). Probe :80 failed, OTA rolled back to 1.2.31. Phone Tailscale to :80 = connection refused.

- Caddyfile: `auto_https off`, `admin off`
- systemd drop-in: Type=simple, 12s start
- if systemd still stuck, run `caddy` directly
- :80 down is a log line, not a rollback. :8080 200 is success.
