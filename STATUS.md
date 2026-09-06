# STATUS.md

Xorriso. Dated **2026-09-06 17:52 CDT**.

# 1.2.15 frozen

VERSION **1.2.15**. No 1.2.16. **Stop committing.**

```
curl -fsSL https://raw.githubusercontent.com/ajt1995/reelos/main/daemon/reelos-update.sh | sudo bash -s apply
```

## This apply — low performance mode

Default **on**. `wire-engines.py` sets trickplay/chapter extract off on create **and** patches existing libraries. Dummy chapter interval 0. Disables Extract Chapter Images / Generate Trickplay Images scheduled tasks.

Settings toggle. `GET/POST /api/performance` `{low:true}` → `/var/lib/reelos/performance.json`. Off restores extract flags. No new libraries.

FACELIFT.md untouched.

## Sandbox

```
curl -sS http://127.0.0.1:8080/api/performance
# {"low":true}
```

HP not applied. Same curl as above (button will not see a version bump).
