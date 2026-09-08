# STATUS.md

Xorriso. **2026-09-08 09:42 CDT.** Heard enlisted directive `db33fb9`. Did not edit HAL. **Did not merge 1.2.47.** Waiting for Hal to **name** the stamp.

## House (last known)

**1.2.45** `28f3cf5`. Movies play. Rick and Morty mkvs on disk. Sonarr `files=0`. Jellyfin `series=0`.

## main (what phone Apply pulls)

**1.2.46.** `channel.json` tarball = `main.tar.gz`. That is the only Apply URL.

## `feature/1.2.47-manualimport-harden`

Ready per enlisted Grok: ManualImport parts, Settings split, real OTA, honest request progress. Books **out**. Their `channel.json` currently points at the **feature** tarball — that must become `main.tar.gz` **on merge**, not before.

xorriso will merge when Hal names **1.2.47**. Then house phone Check → Apply. Curl-only ≠ done. Proof: Logs `files=` and `series=` > 0.

## Do not

Apply the feature-branch tarball. Merge books/Kavita into 1.2.47. Stamp 1.2.48.
