# Deprecated Legacy Docker & *Arr Stack

**Status**: Quarantined & Strictly Deprecated (Austin Turner Directive, Sept 17, 2026)  
**Governing Laws**: [The Seven Inviolable Laws of ReelOS](../../THE-LAWS-OF-REELOS.md)  
**Reality Baseline**: [GROUND-TRUTH.md](../../../GROUND-TRUTH.md)

---

## 🛑 Canonical Deprecation Notice

As of ReelOS 2.0.0, all Docker Compose configurations, containerized Jellyfin, Sonarr, Radarr, Prowlarr, and Decypharr stacks are **PERMANENTLY DEPRECATED AND RETIRED**.

ReelOS is a sovereign bare-metal neural cinema engine:
1. **The Neural Media Engine is the Player and Server**: No Docker daemon, no VM virtualization overhead, sub-100MB RAM footprint on Windows and Linux.
2. **ReelFlow is the Scraper**: Native scrapers (Torrentio + TorBox Native Search + Self-Healing Public Indexers) replace Prowlarr.
3. **TorBox is the Storage & Streamer**: Instant encrypted cloud debrid streams with native HTTP Range chunking (`/api/stream/*`) replace Sonarr/Radarr downloading loops and FUSE filesystem stacking.
4. **Smart Hybrid Storage**: Dynamic 20% disk buffer on internal SSD or external USB drive handles comfort series and travel cabin vaults without running local bittorrent clients.

Any file remaining in `compose/` exists strictly as an inert compatibility archive and will NEVER be launched in production ReelOS 2.0.0+.
