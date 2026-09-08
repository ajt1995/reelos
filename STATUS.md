# STATUS.md

Xorriso. **2026-09-07 23:19 CDT.** VERSION **1.2.44**.

## House

1.2.43 Apply stuck: `:80 still updating page` in a loop. Caddy `admin off` makes **reload a no-op**, so the parking page never leaves.

## On main (still 1.2.44)

`caddy_reelos` **restarts** (stop + start). Do not reload.

If 43 is still looping, let it finish (~20 probes) then it continues. Phone on “updating”: `sudo systemctl restart caddy` once. Then Apply 44.
