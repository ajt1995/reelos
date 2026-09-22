import os from 'node:os';
import EventEmitter from 'node:events';
import { featureCollisionArbiter } from './feature-collision-arbiter.mjs';
import { getForeignProcesses } from './machine-classifier.mjs';

export function detectHardwareTier() {
  const gb = os.totalmem() / (1024 * 1024 * 1024);
  if (gb < 6.5) return 'potato';
  return 'workhorse';
}

export class TranscodeRelayService extends EventEmitter {
  constructor(options = {}) {
    super();
    this.arbiter = options.arbiter || featureCollisionArbiter;
    this.torBoxMesh = options.torBoxMesh || {
      async findCachedAlternative(infohash, targetResolution) {
        return null;
      }
    };
    this.workstationIPs = options.workstationIPs || ['192.168.1.100'];
  }

  isGamingActive() {
    if (this.arbiter && this.arbiter.activeState === 'GAMING_YIELD') {
      return true;
    }
    const procs = getForeignProcesses();
    for (const p of procs) {
      if (p === 'steam.exe' || p.includes('game') || p.includes('cyberpunk')) {
        return true;
      }
    }
    return false;
  }

  getWorkstationIPs() {
    try {
      if (globalThis.__householdGridService) {
        const peers = globalThis.__householdGridService.getPeerNodes();
        const workstations = peers.filter(
          (p) => (p.hardware?.totalMemoryMb || 0) > 6000 || Boolean(p.hardware?.hasGpu)
        );
        if (workstations.length > 0) {
          return workstations.map((w) => w.senderIp).filter(Boolean);
        }
      }
    } catch {}
    return this.workstationIPs;
  }

  async evaluateTranscodeJob(jobRequest) {
    if (jobRequest.targetResolution === '1080p' || jobRequest.targetResolution === '720p') {
      const alternative = await this.torBoxMesh.findCachedAlternative(jobRequest.infohash, jobRequest.targetResolution);
      if (alternative) {
        return {
          action: 'DIRECT_PLAY_ALTERNATIVE',
          reason: 'Stream-Selection Preemption',
          infohash: alternative.infohash,
          resolution: jobRequest.targetResolution
        };
      }
    }

    if (this.isGamingActive()) {
      return {
        action: 'FORCE_DIRECT_PLAY',
        reason: 'Silent Gaming Yield'
      };
    }

    const tier = detectHardwareTier();

    if (tier === 'potato') {
      const availableWorkstations = this.getWorkstationIPs();
      if (availableWorkstations.length > 0) {
        return {
          action: 'RELAY_TO_WORKSTATION',
          reason: 'Potato Protection - Relay',
          targetIP: availableWorkstations[0]
        };
      } else {
        return {
          action: 'FORCE_DIRECT_PLAY',
          reason: 'Potato Protection - DirectPlay'
        };
      }
    }

    return {
      action: 'TRANSCODE_LOCAL',
      reason: 'Idle and capable'
    };
  }

  getCapabilities() {
    const tier = detectHardwareTier();
    const gaming = this.isGamingActive();
    const workstations = this.getWorkstationIPs();

    return {
      tier,
      localTranscodeAllowed: tier !== 'potato' && !gaming,
      gamingYieldActive: gaming,
      relayAvailable: workstations.length > 0,
      workstationIPs: workstations,
    };
  }
}

export const transcodeRelayService = new TranscodeRelayService();
