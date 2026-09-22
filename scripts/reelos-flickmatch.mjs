/**
 * ReelOS FlickMatch — Local Living Room Party Swiping Engine
 * 100% in-memory room sessions, 15-card curated decks, unanimous match detection.
 */

const ROOM_WORDS = ["CINE", "FLIX", "STAR", "NEON", "REEL", "FILM", "COCK", "PLAY", "BEAM", "WAVE", "VIEW", "ROOF"];

export class FlickMatchEngine {
  constructor() {
    this.rooms = new Map();
  }

  generateRoomCode() {
    for (const w of ROOM_WORDS) {
      if (!this.rooms.has(w)) return w;
    }
    return Math.random().toString(36).substring(2, 6).toUpperCase();
  }

  createOrJoinRoom({ roomCode, residentName, residentAvatar = "clapperboard", libraryTitles = [] }) {
    let code = (roomCode || "").trim().toUpperCase();
    if (!code) {
      code = this.generateRoomCode();
    }

    let room = this.rooms.get(code);
    if (!room) {
      // Pick 15 candidate cards from library / trending
      const candidates = libraryTitles.length > 0 ? [...libraryTitles] : [];
      // Shuffle candidates
      for (let i = candidates.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
      }
      const deck = candidates.slice(0, 15).map((t) => ({
        id: String(t.id || t.jellyfinId || ""),
        jellyfinId: t.jellyfinId || t.id,
        title: String(t.title || "Untitled"),
        year: t.year || null,
        poster: t.poster || null,
        overview: t.overview || "",
        genres: Array.isArray(t.genres) ? t.genres : [],
        duration: t.duration || null,
      }));

      room = {
        code,
        createdAt: Date.now(),
        host: residentName || "Primary",
        players: [],
        deck,
        votes: new Map(), // titleId -> Map(playerName -> 'yes' | 'no')
        match: null,
      };
      this.rooms.set(code, room);
    }

    // Add or update player
    const playerName = (residentName || "Guest").trim();
    let player = room.players.find((p) => p.name.toLowerCase() === playerName.toLowerCase());
    if (!player) {
      player = {
        name: playerName,
        avatar: residentAvatar,
        joinedAt: Date.now(),
        votedCount: 0,
      };
      room.players.push(player);
    } else {
      player.avatar = residentAvatar;
    }

    this.cleanupOldRooms();

    return {
      ok: true,
      roomCode: room.code,
      host: room.host,
      players: room.players,
      deck: room.deck,
      match: room.match,
    };
  }

  recordVote({ roomCode, residentName, titleId, vote }) {
    const code = (roomCode || "").trim().toUpperCase();
    const room = this.rooms.get(code);
    if (!room) {
      return { ok: false, error: "Room not found" };
    }

    const playerName = (residentName || "Guest").trim();
    if (!room.votes.has(titleId)) {
      room.votes.set(titleId, new Map());
    }

    const titleVotes = room.votes.get(titleId);
    titleVotes.set(playerName, vote === "yes" ? "yes" : "no");

    // Update player voted count
    const player = room.players.find((p) => p.name.toLowerCase() === playerName.toLowerCase());
    if (player) {
      let voted = 0;
      for (const vMap of room.votes.values()) {
        if (vMap.has(playerName)) voted++;
      }
      player.votedCount = voted;
    }

    // Check for unanimous 'yes' match if at least 1 player
    if (vote === "yes" && room.players.length > 0) {
      let unanimous = true;
      for (const p of room.players) {
        if (titleVotes.get(p.name) !== "yes") {
          unanimous = false;
          break;
        }
      }

      if (unanimous) {
        const titleObj = room.deck.find((d) => d.id === titleId) || { id: titleId, title: "Matched Title" };
        room.match = {
          titleId,
          jellyfinId: titleObj.jellyfinId || titleId,
          title: titleObj.title,
          poster: titleObj.poster,
          matchedAt: Date.now(),
        };
      }
    }

    return {
      ok: true,
      roomCode: room.code,
      matched: Boolean(room.match),
      match: room.match,
      players: room.players,
    };
  }

  getRoomStatus(roomCode) {
    const code = (roomCode || "").trim().toUpperCase();
    const room = this.rooms.get(code);
    if (!room) {
      return { ok: false, error: "Room not found" };
    }

    return {
      ok: true,
      roomCode: room.code,
      host: room.host,
      players: room.players,
      deck: room.deck,
      match: room.match,
    };
  }

  cleanupOldRooms() {
    const now = Date.now();
    for (const [code, room] of this.rooms.entries()) {
      // 2 hour TTL
      if (now - room.createdAt > 2 * 3600 * 1000) {
        this.rooms.delete(code);
      }
    }
  }
}

export const flickMatch = new FlickMatchEngine();
