import crypto from "node:crypto";
import EventEmitter from "node:events";

export const MAX_FRAME_SIZE = 64 * 1024; // 64KB max payload size per frame (Memory protection)
export const MAX_BUFFER_SIZE = 128 * 1024; // 128KB max accumulated buffer per connection

/**
 * ReelOS True WebSocket Synchronized WatchParty Service
 *
 * Implements:
 * - Room code management (unique 6-character room codes)
 * - NTP-style clock synchronization (within ±250ms reference window)
 * - Playback state broadcast (play, pause, seek, rate changes)
 * - Floating ambient reactions (emoji broadcasts)
 * - Zero-dependency RFC 6455 WebSocket protocol handling on Node http.Server upgrade
 * - REST HTTP fallback endpoints
 */

export class WatchPartyService extends EventEmitter {
  constructor() {
    super();
    /** @type {Map<string, any>} */
    this.rooms = new Map();
    /** @type {Map<import("node:net").Socket, { roomCode: string, participantId: string }>} */
    this.socketMap = new Map();
  }

  /**
   * Generates a readable 6-character uppercase room code.
   * @returns {string}
   */
  generateRoomCode() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < 6; i++) {
      code += chars[crypto.randomInt(chars.length)];
    }
    return this.rooms.has(code) ? this.generateRoomCode() : code;
  }

  /**
   * Creates a new WatchParty room.
   * @param {Object} [options]
   * @param {string} [options.hostName]
   * @param {string} [options.titleId]
   * @param {string} [options.title]
   * @param {string} [options.mediaUrl]
   * @param {string} [options.customCode]
   * @returns {Object} Room state
   */
  createRoom({ hostName = "Host", titleId = "sample", title = "ReelOS Showcase", mediaUrl = "", customCode = null } = {}) {
    const code = (customCode ? customCode.toUpperCase() : this.generateRoomCode()).trim();
    const hostId = "user_" + crypto.randomBytes(4).toString("hex");

    const room = {
      code,
      titleId,
      title,
      mediaUrl,
      createdAt: Date.now(),
      hostId,
      playback: {
        isPlaying: false,
        currentTime: 0,
        playbackRate: 1.0,
        serverTime: Date.now(),
        lastUpdatedBy: hostId,
      },
      participants: new Map([
        [
          hostId,
          {
            id: hostId,
            name: hostName,
            isHost: true,
            joinedAt: Date.now(),
            rtt: 0,
            clockOffset: 0,
            lastPing: Date.now(),
            socket: null,
          },
        ],
      ]),
      reactions: [],
      maxReactions: 50,
    };

    this.rooms.set(code, room);
    this.emit("room_created", { code, hostId, titleId });
    return this.getRoomSummary(code);
  }

  /**
   * Retrieves summary representation of a room.
   * @param {string} code
   */
  getRoomSummary(code) {
    const room = this.rooms.get(code?.toUpperCase());
    if (!room) return null;

    return {
      code: room.code,
      titleId: room.titleId,
      title: room.title,
      mediaUrl: room.mediaUrl,
      createdAt: room.createdAt,
      hostId: room.hostId,
      playback: {
        ...room.playback,
        currentSyncedTime: this.calculateCurrentPlaybackTime(room),
      },
      participants: Array.from(room.participants.values()).map((p) => ({
        id: p.id,
        name: p.name,
        isHost: p.isHost,
        connected: Boolean(p.socket && !p.socket.destroyed),
        joinedAt: p.joinedAt,
        rtt: p.rtt,
        clockOffset: p.clockOffset,
      })),
      recentReactions: room.reactions.slice(-10),
    };
  }

  /**
   * Calculates dynamic playback time accounting for elapsed time if playing.
   * @param {Object} room
   * @returns {number}
   */
  calculateCurrentPlaybackTime(room) {
    if (!room.playback.isPlaying) {
      return room.playback.currentTime;
    }
    const elapsedSeconds = (Date.now() - room.playback.serverTime) / 1000;
    return Math.max(0, room.playback.currentTime + elapsedSeconds * (room.playback.playbackRate || 1.0));
  }

  /**
   * Joins a room.
   * @param {string} code
   * @param {Object} [participant]
   */
  joinRoom(code, { name = "Guest", participantId = null, socket = null } = {}) {
    const cleanCode = (code || "").toUpperCase();
    const room = this.rooms.get(cleanCode);
    if (!room) {
      return { ok: false, error: "Room not found" };
    }

    const id = participantId || "user_" + crypto.randomBytes(4).toString("hex");
    const existing = room.participants.get(id);
    const isHost = (id === room.hostId) || (existing?.isHost ?? (room.participants.size === 0));

    const participant = {
      id,
      name: name || existing?.name || "Guest",
      isHost,
      joinedAt: existing?.joinedAt || Date.now(),
      rtt: existing?.rtt || 0,
      clockOffset: existing?.clockOffset || 0,
      lastPing: Date.now(),
      socket: socket || existing?.socket || null,
    };

    room.participants.set(id, participant);
    if (socket) {
      this.socketMap.set(socket, { roomCode: cleanCode, participantId: id });
    }

    this.broadcast(cleanCode, {
      type: "participant_joined",
      participant: { id: participant.id, name: participant.name, isHost: participant.isHost },
      room: this.getRoomSummary(cleanCode),
    });

    return {
      ok: true,
      participantId: id,
      room: this.getRoomSummary(cleanCode),
    };
  }

  /**
   * Leaves a room.
   * @param {string} code
   * @param {string} participantId
   */
  leaveRoom(code, participantId) {
    const cleanCode = (code || "").toUpperCase();
    const room = this.rooms.get(cleanCode);
    if (!room) return { ok: false, error: "Room not found" };

    const participant = room.participants.get(participantId);
    if (!participant) return { ok: false, error: "Participant not found" };

    room.participants.delete(participantId);

    // If room is empty, clean it up
    if (room.participants.size === 0) {
      this.rooms.delete(cleanCode);
      this.emit("room_destroyed", { code: cleanCode });
      return { ok: true, roomClosed: true };
    }

    // Migrate host if host leaves
    if (participant.isHost) {
      const nextHost = room.participants.values().next().value;
      if (nextHost) {
        nextHost.isHost = true;
        room.hostId = nextHost.id;
      }
    }

    this.broadcast(cleanCode, {
      type: "participant_left",
      participantId,
      newHostId: room.hostId,
      room: this.getRoomSummary(cleanCode),
    });

    return { ok: true, roomClosed: false };
  }

  /**
   * Marks a participant offline without erasing their identity. A transient
   * network loss must not turn a reconnect into a new person or silently hand
   * the room to somebody else.
   */
  disconnectParticipant(code, participantId) {
    const cleanCode = (code || "").toUpperCase();
    const room = this.rooms.get(cleanCode);
    const participant = room?.participants.get(participantId);
    if (!room || !participant) return { ok: false, error: "Participant not found" };
    participant.socket = null;
    participant.lastSeen = Date.now();
    this.broadcast(cleanCode, {
      type: "participant_disconnected",
      participantId,
      room: this.getRoomSummary(cleanCode),
    });
    return { ok: true, room: this.getRoomSummary(cleanCode) };
  }

  /**
   * Sweeps stale or abandoned rooms to prevent memory leaks during multi-day operation.
   * @param {number} [maxAgeMs=7200000] - Max room inactivity before eviction (2 hours)
   * @returns {number} Count of swept rooms
   */
  sweepStaleRooms(maxAgeMs = 2 * 3600 * 1000) {
    const now = Date.now();
    let swept = 0;
    for (const [code, room] of this.rooms.entries()) {
      const activeSockets = Array.from(room.participants.values()).filter(
        (p) => p.socket && !p.socket.destroyed
      );
      if (room.participants.size === 0 || (activeSockets.length === 0 && now - room.createdAt > maxAgeMs)) {
        for (const p of room.participants.values()) {
          if (p.socket) {
            this.socketMap.delete(p.socket);
            try { p.socket.destroy(); } catch {}
          }
        }
        this.rooms.delete(code);
        this.emit("room_destroyed", { code });
        swept++;
      }
    }
    return swept;
  }

  /**
   * Computes NTP-style clock synchronization.
   * @param {string} code
   * @param {string} participantId
   * @param {number} clientSendTime
   */
  handleNtpSync(code, participantId, clientSendTime) {
    const cleanCode = (code || "").toUpperCase();
    const room = this.rooms.get(cleanCode);
    const serverReceiveTime = Date.now();
    const serverSendTime = Date.now();
    const safeClientSendTime = Number(clientSendTime) || serverReceiveTime;

    if (room && room.participants.has(participantId)) {
      const p = room.participants.get(participantId);
      p.lastPing = serverReceiveTime;
    }

    return {
      type: "pong",
      clientSendTime: safeClientSendTime,
      serverReceiveTime,
      serverSendTime,
      precisionWindowMs: 250, // Guaranteed ±250ms target sync boundary
    };
  }

  /**
   * Updates playback state and broadcasts to all participants.
   * @param {string} code
   * @param {string} participantId
   * @param {Object} [actionData]
   */
  updatePlayback(code, participantId, { action = "sync", currentTime = 0, playbackRate = 1.0, titleId = null } = {}) {
    const cleanCode = (code || "").toUpperCase();
    const room = this.rooms.get(cleanCode);
    if (!room) return { ok: false, error: "Room not found" };

    const now = Date.now();
    const isPlaying = action === "play" ? true : action === "pause" ? false : room.playback.isPlaying;

    room.playback = {
      isPlaying,
      currentTime: Math.max(0, Number(currentTime) || 0),
      playbackRate: Number(playbackRate) || 1.0,
      serverTime: now,
      lastUpdatedBy: participantId,
    };

    if (titleId) {
      room.titleId = titleId;
    }

    const payload = {
      type: "playback_sync",
      action,
      playback: {
        ...room.playback,
        currentSyncedTime: room.playback.currentTime,
      },
      updatedBy: participantId,
      timestamp: now,
    };

    this.broadcast(cleanCode, payload);
    return { ok: true, playback: room.playback };
  }

  /**
   * Broadcasts a floating reaction (emoji) to all participants in the room.
   * @param {string} code
   * @param {string} participantId
   * @param {Object} [reactionData]
   */
  sendReaction(code, participantId, { emoji = "❤️", senderName = "Viewer" } = {}) {
    const cleanCode = (code || "").toUpperCase();
    const room = this.rooms.get(cleanCode);
    if (!room) return { ok: false, error: "Room not found" };

    const reaction = {
      id: "rx_" + crypto.randomBytes(4).toString("hex"),
      emoji,
      senderName,
      participantId,
      timestamp: Date.now(),
    };

    room.reactions.push(reaction);
    if (room.reactions.length > room.maxReactions) {
      room.reactions.shift();
    }

    this.broadcast(cleanCode, {
      type: "reaction",
      reaction,
    });

    return { ok: true, reaction };
  }

  /**
   * Broadcasts a message to all connected WebSocket clients in a room.
   * @param {string} code
   * @param {Object} message
   */
  broadcast(code, message) {
    const cleanCode = (code || "").toUpperCase();
    const room = this.rooms.get(cleanCode);
    if (!room) return;

    const json = JSON.stringify(message);
    const frame = this.buildWebSocketFrame(json);

    for (const participant of room.participants.values()) {
      if (participant.socket && !participant.socket.destroyed && participant.socket.writable) {
        try {
          participant.socket.write(frame);
        } catch {
          // Socket write failed
        }
      }
    }
  }

  /**
   * Encodes a UTF-8 string into an unmasked RFC 6455 text frame.
   * @param {string} text
   * @returns {Buffer}
   */
  buildWebSocketFrame(text) {
    const payload = Buffer.from(text, "utf8");
    const len = payload.length;

    let header;
    if (len < 126) {
      header = Buffer.alloc(2);
      header[0] = 0x81; // FIN + Opcode 1 (Text)
      header[1] = len;  // Unmasked
    } else if (len <= 65535) {
      header = Buffer.alloc(4);
      header[0] = 0x81;
      header[1] = 126;
      header.writeUInt16BE(len, 2);
    } else {
      header = Buffer.alloc(10);
      header[0] = 0x81;
      header[1] = 127;
      header.writeBigUInt64BE(BigInt(len), 2);
    }

    return Buffer.concat([header, payload]);
  }

  /**
   * Encodes a Close frame per RFC 6455 §5.5.1.
   * @param {number} code
   * @param {string} reason
   * @returns {Buffer}
   */
  buildCloseFrame(code = 1000, reason = "") {
    const reasonBuf = Buffer.from(reason || "", "utf8");
    const truncatedReason = reasonBuf.subarray(0, 123);
    const payload = Buffer.alloc(2 + truncatedReason.length);
    payload.writeUInt16BE(code, 0);
    truncatedReason.copy(payload, 2);
    const header = Buffer.alloc(2);
    header[0] = 0x88; // FIN + Opcode 8 (Close)
    header[1] = payload.length; // Unmasked (server to client)
    return Buffer.concat([header, payload]);
  }

  /**
   * Parses an RFC 6455 frame from an incoming Buffer.
   * Enforces RFC 6455 invariants:
   * - Client Masking (§5.1)
   * - RSV bits must be 0 (§5.2)
   * - Opcode validation (§5.2)
   * - Control frame constraints: FIN=1 and payload <= 125 bytes (§5.5)
   * - Max frame size bounding (§5.2 / Memory Protection)
   *
   * @param {Buffer} buffer
   * @param {Object} [options]
   * @param {boolean} [options.requireMask=false]
   * @param {number} [options.maxPayloadSize=MAX_FRAME_SIZE]
   * @returns {{ opcode: number, payload: Buffer, rest: Buffer, isMasked: boolean, fin: boolean, rsv: number, error?: string, closeCode?: number } | null}
   */
  parseWebSocketFrame(buffer, options = {}) {
    if (!buffer || buffer.length < 2) return null;

    const requireMask = options.requireMask ?? false;
    const maxPayloadSize = options.maxPayloadSize ?? MAX_FRAME_SIZE;

    const firstByte = buffer[0];
    const secondByte = buffer[1];
    const fin = Boolean(firstByte & 0x80);
    const rsv = (firstByte & 0x70) >> 4;
    const opcode = firstByte & 0x0f;
    const isMasked = Boolean(secondByte & 0x80);
    let payloadLength = secondByte & 0x7f;
    let offset = 2;

    // 1. RSV bits must be 0 unless extension negotiated (RFC 6455 §5.2)
    if (rsv !== 0) {
      return {
        error: "rsv_non_zero",
        closeCode: 1002,
        opcode,
        isMasked,
        fin,
        rsv,
        payload: Buffer.alloc(0),
        rest: buffer.subarray(buffer.length),
      };
    }

    // 2. Opcode Validation (RFC 6455 §5.2)
    const isStandardOpcode =
      opcode === 0x0 ||
      opcode === 0x1 ||
      opcode === 0x2 ||
      opcode === 0x8 ||
      opcode === 0x9 ||
      opcode === 0xa;
    if (!isStandardOpcode) {
      return {
        error: "invalid_opcode",
        closeCode: 1002,
        opcode,
        isMasked,
        fin,
        rsv,
        payload: Buffer.alloc(0),
        rest: buffer.subarray(buffer.length),
      };
    }

    // 3. Control Frame Constraints (RFC 6455 §5.5)
    // Control frames (0x8, 0x9, 0xA) must NOT be fragmented (fin === true)
    if (opcode >= 0x8 && !fin) {
      return {
        error: "fragmented_control_frame",
        closeCode: 1002,
        opcode,
        isMasked,
        fin,
        rsv,
        payload: Buffer.alloc(0),
        rest: buffer.subarray(buffer.length),
      };
    }

    // Control frame payload length must be <= 125 bytes
    if (opcode >= 0x8 && payloadLength > 125) {
      return {
        error: "control_frame_length",
        closeCode: 1002,
        opcode,
        isMasked,
        fin,
        rsv,
        payload: Buffer.alloc(0),
        rest: buffer.subarray(buffer.length),
      };
    }

    // 4. Extended payload length parsing
    if (payloadLength === 126) {
      if (buffer.length < 4) return null;
      payloadLength = buffer.readUInt16BE(2);
      offset = 4;
    } else if (payloadLength === 127) {
      if (buffer.length < 10) return null;
      const bigLen = buffer.readBigUInt64BE(2);
      if (bigLen > BigInt(maxPayloadSize)) {
        return {
          error: "oversized_frame",
          closeCode: 1009,
          opcode,
          isMasked,
          fin,
          rsv,
          payload: Buffer.alloc(0),
          rest: buffer.subarray(buffer.length),
        };
      }
      payloadLength = Number(bigLen);
      offset = 10;
    }

    // 5. Memory Protection: Enforce maximum frame size
    if (payloadLength > maxPayloadSize) {
      return {
        error: "oversized_frame",
        closeCode: 1009,
        opcode,
        isMasked,
        fin,
        rsv,
        payload: Buffer.alloc(0),
        rest: buffer.subarray(buffer.length),
      };
    }

    // 6. Client Masking Check (RFC 6455 §5.1)
    if (requireMask && !isMasked) {
      return {
        error: "masking_required",
        closeCode: 1002,
        opcode,
        isMasked,
        fin,
        rsv,
        payload: Buffer.alloc(0),
        rest: buffer.subarray(buffer.length),
      };
    }

    let maskingKey = null;
    if (isMasked) {
      if (buffer.length < offset + 4) return null;
      maskingKey = buffer.subarray(offset, offset + 4);
      offset += 4;
    }

    if (buffer.length < offset + payloadLength) {
      return null; // Incomplete frame
    }

    const payload = Buffer.from(buffer.subarray(offset, offset + payloadLength));
    const rest = buffer.subarray(offset + payloadLength);

    if (isMasked && maskingKey) {
      for (let i = 0; i < payload.length; i++) {
        payload[i] ^= maskingKey[i % 4];
      }
    }

    return {
      opcode,
      payload,
      rest,
      isMasked,
      fin,
      rsv,
      error: null,
      closeCode: null,
    };
  }

  /**
   * Handles HTTP Upgrade to WebSocket for WatchParty.
   * Path: /ws/watchparty or /api/watchparty/ws
   * @param {import("node:http").IncomingMessage} req
   * @param {import("node:net").Socket} socket
   * @param {Buffer} head
   */
  handleUpgrade(req, socket, head) {
    const url = new URL(req.url, "http://127.0.0.1");
    if (!url.pathname.startsWith("/ws/watchparty") && !url.pathname.startsWith("/api/watchparty")) {
      return false;
    }

    // Safe TCP upgrade error listener attached synchronously BEFORE any await or socket.write
    if (socket && typeof socket.on === "function" && !socket._hasUpgradeErrorHandler) {
      socket._hasUpgradeErrorHandler = true;
      socket.on("error", () => {
        try { socket.destroy?.(); } catch {}
      });
    }

    const secKey = req.headers["sec-websocket-key"];
    if (!secKey) {
      try { socket.destroy(); } catch {}
      return true;
    }

    // Complete RFC 6455 handshake
    const acceptKey = crypto
      .createHash("sha1")
      .update(secKey + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11")
      .digest("base64");

    const responseHeaders = [
      "HTTP/1.1 101 Switching Protocols",
      "Upgrade: websocket",
      "Connection: Upgrade",
      `Sec-WebSocket-Accept: ${acceptKey}`,
      "Sec-WebSocket-Protocol: reelos-watchparty-v1",
      "\r\n",
    ];

    try {
      socket.write(responseHeaders.join("\r\n"));
    } catch {
      try { socket.destroy(); } catch {}
      return true;
    }

    const roomCode = url.searchParams.get("room") || url.searchParams.get("code");
    const name = url.searchParams.get("name") || "Guest";
    const participantId = url.searchParams.get("id") || null;

    let currentRoomCode = roomCode ? roomCode.toUpperCase() : null;
    let currentParticipantId = participantId;

    if (currentRoomCode) {
      const joinRes = this.joinRoom(currentRoomCode, {
        name,
        participantId: currentParticipantId,
        socket,
      });
      if (joinRes.ok) {
        currentParticipantId = joinRes.participantId;
        try {
          socket.write(
            this.buildWebSocketFrame(
              JSON.stringify({
                type: "init",
                participantId: currentParticipantId,
                room: joinRes.room,
              })
            )
          );
        } catch {}
      } else {
        try {
          socket.write(
            this.buildWebSocketFrame(
              JSON.stringify({
                type: "error",
                error: joinRes.error || "Room not found",
              })
            )
          );
        } catch {}
      }
    }

    let buffer = head && head.length > 0 ? Buffer.from(head) : Buffer.alloc(0);

    // Rate Limiting: token bucket (capacity: 100, refill: 100 tokens/sec)
    let tokens = 100;
    let lastRefill = Date.now();
    const MAX_TOKENS = 100;
    const REFILL_RATE_PER_MS = 100 / 1000;

    const checkRateLimit = () => {
      const now = Date.now();
      const elapsed = now - lastRefill;
      tokens = Math.min(MAX_TOKENS, tokens + elapsed * REFILL_RATE_PER_MS);
      lastRefill = now;
      if (tokens < 1) {
        return false;
      }
      tokens -= 1;
      return true;
    };

    const processBuffer = () => {
      while (buffer.length > 0) {
        const frame = this.parseWebSocketFrame(buffer, { requireMask: true });
        if (!frame) break;
        buffer = frame.rest;

        // Protocol Error / Oversized frame rejection per RFC 6455
        if (frame.error) {
          try {
            socket.write(this.buildCloseFrame(frame.closeCode || 1002, frame.error));
          } catch {}
          try { socket.destroy(); } catch {}
          break;
        }

        // Rate limiting flood protection: terminate with Close 1008 (Policy Violation)
        if (!checkRateLimit()) {
          try {
            socket.write(this.buildCloseFrame(1008, "Policy Violation: Rate limit exceeded"));
          } catch {}
          try { socket.destroy(); } catch {}
          break;
        }

        // Opcode 8: Connection Close Frame -> echo close code before closing
        if (frame.opcode === 0x8) {
          let closeCode = 1000;
          if (frame.payload && frame.payload.length >= 2) {
            closeCode = frame.payload.readUInt16BE(0);
          }
          try {
            socket.write(this.buildCloseFrame(closeCode));
          } catch {}
          socket.end();
          break;
        }

        // Opcode 9: Ping Frame -> Respond with Pong containing identical application data
        if (frame.opcode === 0x9) {
          const payload = frame.payload || Buffer.alloc(0);
          const pongHeader = Buffer.alloc(2);
          pongHeader[0] = 0x8a; // FIN + Opcode 10 (Pong)
          pongHeader[1] = payload.length; // Unmasked (server to client)
          const pong = Buffer.concat([pongHeader, payload]);
          try {
            socket.write(pong);
          } catch {}
          continue;
        }

        // Opcode 10: Pong Frame from client -> ignore per RFC 6455 §5.5.3
        if (frame.opcode === 0xa) {
          continue;
        }

        // Opcode 2: Binary Frame
        if (frame.opcode === 0x2) {
          continue;
        }

        // Opcode 1: Text Frame
        if (frame.opcode === 0x1) {
          try {
            const message = JSON.parse(frame.payload.toString("utf8"));
            this.handleSocketMessage(socket, message, {
              get roomCode() { return currentRoomCode; },
              set roomCode(val) { currentRoomCode = val; },
              get participantId() { return currentParticipantId; },
              set participantId(val) { currentParticipantId = val; },
            });
          } catch {
            // Malformed JSON payload
          }
        }
      }
    };

    if (buffer.length > 0) {
      processBuffer();
    }

    socket.on("data", (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);
      if (buffer.length > MAX_BUFFER_SIZE) {
        try {
          socket.write(this.buildCloseFrame(1009, "Message Too Big: Buffer exceeded"));
        } catch {}
        try { socket.destroy(); } catch {}
        return;
      }
      processBuffer();
    });

    socket.on("close", () => {
      if (currentRoomCode && currentParticipantId) {
        this.disconnectParticipant(currentRoomCode, currentParticipantId);
      }
      this.socketMap.delete(socket);
    });

    return true;
  }

  /**
   * Dispatches incoming WebSocket messages.
   * @param {import("node:net").Socket} socket
   * @param {Object} message
   * @param {Object} context
   */
  handleSocketMessage(socket, message, context) {
    const { type } = message;

    if (type === "join") {
      const { code, name, participantId } = message;
      const res = this.joinRoom(code, { name, participantId, socket });
      if (res.ok) {
        context.roomCode = (code || "").toUpperCase();
        context.participantId = res.participantId;
        socket.write(
          this.buildWebSocketFrame(
            JSON.stringify({
              type: "init",
              participantId: res.participantId,
              room: res.room,
            })
          )
        );
      } else {
        socket.write(this.buildWebSocketFrame(JSON.stringify({ type: "error", error: res.error })));
      }
      return;
    }

    if (type === "ping") {
      // NTP clock synchronization ping
      const { clientSendTime } = message;
      const pong = this.handleNtpSync(context.roomCode, context.participantId, clientSendTime);
      socket.write(this.buildWebSocketFrame(JSON.stringify(pong)));
      return;
    }

    if (type === "playback") {
      const { action, currentTime, playbackRate, titleId } = message;
      this.updatePlayback(context.roomCode, context.participantId, {
        action,
        currentTime,
        playbackRate,
        titleId,
      });
      return;
    }

    if (type === "reaction") {
      const { emoji, senderName } = message;
      this.sendReaction(context.roomCode, context.participantId, { emoji, senderName });
      return;
    }
  }

  /**
   * Dispatches REST API routes for WatchParty.
   * @param {import("node:http").IncomingMessage} req
   * @param {import("node:http").ServerResponse} res
   * @returns {Promise<boolean>}
   */
  async handleHttp(req, res) {
    const url = new URL(req.url, "http://127.0.0.1");
    if (!url.pathname.startsWith("/api/watchparty")) return false;

    res.setHeader("Content-Type", "application/json");

    // GET /api/watchparty/rooms
    if (url.pathname === "/api/watchparty/rooms" && req.method === "GET") {
      const list = Array.from(this.rooms.values()).map((r) => this.getRoomSummary(r.code));
      res.statusCode = 200;
      res.end(JSON.stringify({ ok: true, rooms: list }));
      return true;
    }

    // POST /api/watchparty/room or /api/watchparty/create (create room)
    if ((url.pathname === "/api/watchparty/room" || url.pathname === "/api/watchparty/create") && req.method === "POST") {
      let body = "";
      for await (const chunk of req) body += chunk;
      let data = {};
      try { data = JSON.parse(body || "{}"); } catch {}
      const room = this.createRoom(data);
      res.statusCode = 200;
      res.end(JSON.stringify({ ok: true, room }));
      return true;
    }

    // POST /api/watchparty/join validates an invite and establishes a stable
    // reconnect identity before the browser opens the live socket.
    if (url.pathname === "/api/watchparty/join" && req.method === "POST") {
      let body = "";
      for await (const chunk of req) body += chunk;
      let data = {};
      try { data = JSON.parse(body || "{}"); } catch {}
      const code = String(data.code || "").trim().toUpperCase();
      const name = String(data.name || "Guest").trim().slice(0, 80) || "Guest";
      const participantId = data.participantId ? String(data.participantId).slice(0, 128) : null;
      const joined = this.joinRoom(code, { name, participantId });
      res.statusCode = joined.ok ? 200 : 404;
      res.end(JSON.stringify(joined));
      return true;
    }

    // GET /api/watchparty/room/:code
    if (url.pathname.startsWith("/api/watchparty/room/") && req.method === "GET") {
      const code = url.pathname.replace("/api/watchparty/room/", "").trim();
      const room = this.getRoomSummary(code);
      if (!room) {
        res.statusCode = 404;
        res.end(JSON.stringify({ ok: false, error: "Room not found" }));
        return true;
      }
      res.statusCode = 200;
      res.end(JSON.stringify({ ok: true, room }));
      return true;
    }

    // POST /api/watchparty/sync
    if (url.pathname === "/api/watchparty/sync" && req.method === "POST") {
      let body = "";
      for await (const chunk of req) body += chunk;
      let data = {};
      try { data = JSON.parse(body || "{}"); } catch {}
      const { code, participantId, clientSendTime, action, currentTime, playbackRate, titleId } = data;

      let ntp = null;
      if (clientSendTime) {
        ntp = this.handleNtpSync(code, participantId, clientSendTime);
      }

      if (action) {
        this.updatePlayback(code, participantId, { action, currentTime, playbackRate, titleId });
      }

      const summary = this.getRoomSummary(code);
      res.statusCode = 200;
      res.end(JSON.stringify({ ok: true, ntp, room: summary }));
      return true;
    }

    // POST /api/watchparty/reaction
    if (url.pathname === "/api/watchparty/reaction" && req.method === "POST") {
      let body = "";
      for await (const chunk of req) body += chunk;
      let data = {};
      try { data = JSON.parse(body || "{}"); } catch {}
      const { code, participantId, emoji, senderName } = data;
      const rx = this.sendReaction(code, participantId, { emoji, senderName });
      res.statusCode = rx.ok ? 200 : 400;
      res.end(JSON.stringify(rx));
      return true;
    }

    return false;
  }
}

export const watchPartyService = new WatchPartyService();
