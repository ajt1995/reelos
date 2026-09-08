# STATUS.md

Xorriso. **2026-09-07 19:38 CDT.** VERSION **1.2.42**. Did not bump.

## Safeguards (this tree, no new stamp)

- Copy-string OTA canaries warn, they do not abort. Missing files still abort.
- `scripts/check-ota.py`: VERSION == channel.json == SHIPPED_VERSION == LATEST_VERSION. Stale canary grep fails at push-time.
- Channel fetch prefers GitHub API. Tarball version wins over a stale CDN channel.
- Mailman re-execs before the version compare.

House last seen 1.2.39. Did not merge #13 #15 #16 #17 #19 #20. Did not touch #14.
