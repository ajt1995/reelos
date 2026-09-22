export class FleetStore {
  constructor(dbPath = ':memory:') {
    this.boxes = new Map();
  }

  recordHeartbeat(data, ip) {
    const boxId = data.box_id;
    if (!boxId) return { ok: false, error: 'missing box_id' };
    const existing = this.boxes.get(boxId) || {};
    const box = {
      ...existing,
      boxId,
      version: data.version,
      sha: data.sha,
      channel: data.channel,
      ramMb: data.ram_mb,
      diskKind: data.disk_kind,
      arch: data.arch,
      uptimeSeconds: data.uptime_seconds,
      services: data.services,
      ip: ip || existing.ip,
      isOnline: true,
      lastHeartbeat: Date.now(),
    };
    this.boxes.set(boxId, box);
    return { ok: true };
  }

  listBoxes() {
    return Array.from(this.boxes.values());
  }

  getSummary() {
    const boxes = this.listBoxes();
    const versionCounts = {};
    let rotationalCount = 0;
    let ssdCount = 0;
    let onlineCount = 0;

    for (const b of boxes) {
      if (b.isOnline) onlineCount++;
      if (b.diskKind === 'rotational') rotationalCount++;
      if (b.diskKind === 'ssd') ssdCount++;
      if (b.version) {
        versionCounts[b.version] = (versionCounts[b.version] || 0) + 1;
      }
    }

    return {
      totalBoxes: boxes.length,
      onlineCount,
      rotationalCount,
      ssdCount,
      versionCounts,
    };
  }
}
