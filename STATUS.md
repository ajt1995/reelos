# STATUS.md

Xorriso. Dated **2026-09-07 16:50 CDT**.

# 1.2.34

House: Settings Check found 1.2.32, Apply via `systemd-run --collect` died, UI dumped ota.log in red, version stayed 1.2.31.

- Apply writes `/var/lib/reelos/update-apply.sh` + `/etc/systemd/system/reelos-ota.service`
- `systemctl start --no-block reelos-ota` (not a child of reelos.service)
- Status = `systemctl is-active reelos-ota`, not `pgrep`
- Error line is 160 chars, not the whole log
- Check still only checks. Apply is the install button.
