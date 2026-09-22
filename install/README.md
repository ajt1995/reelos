# ReelOS native appliance

The Linux bundle installs one native ReelOS service on port 8080 and its
Jellyfin-compatible household client shim on port 8096. It does not install
Docker, Jellyfin Server, Sonarr, Radarr, Prowlarr, Decypharr, or a torrent
client.

Run `sudo bash install.sh` from an extracted `reelos-native.zip`. The installer
keeps ReelOS state under `/var/lib/reelos`, the app under `/opt/reelos`, and
announces `http://reelos.local` on the LAN. Finish household setup in the
browser.

The package contains no credentials or private source presets. Personal media
and public-domain sources work without a provider. Optional providers and
owner-added sources are configured after installation and remain private to
the household.

A bootable USB image is not advertised until installation and recovery have
passed on a real supported target.

## Day-0 update trust

The manual Day-0 install does not invent a signing identity. Obtain the
owner-approved Ed25519 public key and its 64-character fingerprint through
separate trusted channels, compare them, then pin the key once:

```sh
sudo node /opt/reelos/app/scripts/reelos-release-tool.mjs trust-bootstrap \
  --key /path/to/reelos-release.pub \
  --fingerprint FULL_SHA256_FINGERPRINT \
  --confirm I-TRUST-THIS-KEY
```

Until that succeeds, updates are unavailable. Applying an update requires a
local signed manifest and its exact artifact:

```sh
sudo /opt/reelos/bin/reelos-update.sh /path/to/manifest.json /path/to/artifact.tar
```

The manifest schema is `reelos-update-manifest/v1`. Its signed payload names a
non-repeating release sequence, version, publication time, target platform and
architecture, plus the artifact byte count and SHA-256 digest. The detached
Ed25519 signature and pinned-key fingerprint are carried in the manifest's
`signature` object. ReelOS stages the artifact, switches the active pointer,
requires `/api/ready` to return the exact new version in its update status and
a valid provisioned-state boolean, and otherwise restores and health-checks the
previous pointer.

ReelOS never generates or stores the release private key. Signing stays in the
owner's external release process.

## Recovery export and import

Export creates a checksummed JSON recovery bundle from an explicit allowlist
of profiles, taste, library and Books state. Provider settings, API keys,
tokens, PIN hashes, private keys and `answers.json` are excluded.

```sh
sudo node /opt/reelos/app/scripts/reelos-release-tool.mjs recovery-export \
  --output /path/to/private-backup-directory
```

Import requires an explicit confirmation and preserves every overwritten file
in a timestamped directory under the ReelOS state directory:

```sh
sudo node /opt/reelos/app/scripts/reelos-release-tool.mjs recovery-import \
  --bundle /path/to/reelos-recovery-YYYYMMDD-HHMMSSZ.json \
  --confirm RESTORE
```

Windows uses the same contracts, but remains unavailable as an installed
product until the external signing identity, service installer and real-device
update/rollback/recovery acceptance run exist.
