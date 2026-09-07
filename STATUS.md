# STATUS.md

Xorriso. Dated **2026-09-06 21:14 CDT**.

# 1.2.20 frozen

1.2.19 SSH apply failed: `curl | bash` has `$0=bash`, copied the bash binary into `reelos-ota.service`.

SSH is not in the `reelos.service` cgroup. Detach only when we *are*. `--no-block` on the phone path.

House: `sudo REELOS_OTA_UNIT=1 bash -s apply` still works on the 1.2.19 mailman.
