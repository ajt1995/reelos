import dgram from 'node:dgram';

export class FederatedSync {
  constructor() {
    this.weightDeltas = new Map(); // itemId -> Float32Array or array
    this.eta = 0.05; // Momentum/learning rate for peer deltas
    this.server = null;
  }

  accumulateDelta(itemId, deltaVector) {
    if (this.weightDeltas.size >= 256 && !this.weightDeltas.has(itemId)) {
      const oldest = this.weightDeltas.keys().next().value;
      this.weightDeltas.delete(oldest);
    }
    if (!this.weightDeltas.has(itemId)) {
      this.weightDeltas.set(itemId, new Float32Array(32));
    }
    const current = this.weightDeltas.get(itemId);
    for (let i = 0; i < 32; i++) {
      current[i] += deltaVector[i];
    }
  }

  exportWeightDeltas() {
    const dict = {};
    for (const [itemId, delta] of this.weightDeltas.entries()) {
      dict[itemId] = Array.from(delta);
    }
    this.weightDeltas.clear();
    return dict;
  }

  applyPeerDeltas(peerDeltas, getLocalItemWeights) {
    // peerDeltas: Dictionary of itemId -> array of 32 floats
    for (const itemId in peerDeltas) {
      const peerDelta = peerDeltas[itemId];
      if (!getLocalItemWeights) continue;
      const localWeights = getLocalItemWeights(itemId); 
      if (localWeights) {
        for (let i = 0; i < 32; i++) {
          localWeights[i] += this.eta * peerDelta[i];
        }
      }
    }
  }

  startUdpListener(port = 44444, getLocalItemWeights) {
    if (this.server) return this.server;
    this.server = dgram.createSocket('udp4');
    this.server.on('message', (msg) => {
      try {
        if (!msg || msg.length > 65535) return;
        const payload = JSON.parse(msg.toString());
        if (payload.type === 'SYNC_DELTAS') {
          if (!payload.deltas || typeof payload.deltas !== 'object') {
            console.warn('Mismatched peer schema: invalid or missing deltas');
            return;
          }
          const keys = Object.keys(payload.deltas);
          if (keys.length > 256) return;
          this.applyPeerDeltas(payload.deltas, getLocalItemWeights);
        }
      } catch (err) {
        console.error('Failed to parse peer deltas:', err.message);
      }
    });
    this.server.bind(port);
    if (this.server.unref) this.server.unref();
    
    this.server.on('error', (err) => {
      console.error('UDP server error:', err.message);
    });
    return this.server;
  }

  broadcastDeltas(port = 44444, broadcastAddress = '255.255.255.255') {
    if (!this.server) return;
    const deltas = this.exportWeightDeltas();
    if (Object.keys(deltas).length === 0) return;
    const msg = Buffer.from(JSON.stringify({ type: 'SYNC_DELTAS', deltas }));
    this.server.setBroadcast(true);
    this.server.send(msg, 0, msg.length, port, broadcastAddress);
  }

  syncWeightDeltas(lanNodes) {
    // Legacy / interface stub mapping
    return true;
  }
}
export const federatedSync = new FederatedSync();
