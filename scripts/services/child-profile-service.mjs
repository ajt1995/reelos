/**
 * ReelOS Child Profile & Dual-Parent Governance Service
 *
 * Section 70: Interactive Child Profile Training & Dual-Parent Governance (v1.0)
 * Section 70.5: Dynamic "Who's in the Room?" Mobile Companion Presence Slider (v1.0)
 *
 * Implements:
 * 1. Two-Stage Training Flow: Maturity Slider + 8-Card Boundary Match Game
 * 2. Zero-Token Local Boundary Learning: Generates 6D boundary hyperplane
 * 3. Parent-Trained Discover Feed: Curates child catalog strictly to parental tastes
 * 4. Mobile Companion Movie Night Presence: records who is participating
 *
 * PIN ownership deliberately lives in profile-service.mjs. This service stores
 * only the learned content boundary. Keeping the secret and its authorization
 * policy in one service prevents a second, weaker escape route from developing.
 */

import { EventEmitter } from "node:events";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { dualBrainService } from "./dual-brain-service.mjs";

const STATE_DIR =
  process.env.REELOS_STATE ||
  (process.platform === "win32"
    ? path.join(process.cwd(), ".reelos-state")
    : fs.existsSync("/var/lib/reelos")
      ? "/var/lib/reelos"
      : path.join(os.homedir(), ".reelos-state"));

// 8-Card Dynamic Micro-Deck for Boundary Training
export const BOUNDARY_DECK = [
  {
    id: "scare_monsters",
    dimension: "scare",
    title: "Scary Monsters & Jump Scares",
    exampleFilm: "Jurassic Park (T-Rex Roar) or Stranger Things",
    description:
      "Creepy creatures, sudden loud jump scares, and dark suspenseful scenes.",
    severityWeight: 0.8,
  },
  {
    id: "comic_slapstick",
    dimension: "violence",
    title: "Comic Slapstick & Physical Danger",
    exampleFilm: "Home Alone (Paint Cans) or Tom & Jerry",
    description:
      "Characters falling, cartoon explosions, and over-the-top physical comedy.",
    severityWeight: 0.3,
  },
  {
    id: "fantasy_combat",
    dimension: "violence",
    title: "Fantasy Action & Sword Battles",
    exampleFilm: "Star Wars / Harry Potter / Marvel Superheroes",
    description:
      "Laser blasters, sword duels, and superhero combat without graphic gore.",
    severityWeight: 0.6,
  },
  {
    id: "romance_kissing",
    dimension: "romance",
    title: "Romance, Crushes & Kissing",
    exampleFilm: "The Princess Bride / Spider-Man Upside-Down Kiss",
    description: "Romantic subplots, passionate kissing, and dating themes.",
    severityWeight: 0.4,
  },
  {
    id: "adult_innuendo",
    dimension: "innuendo",
    title: "Double Entendres & Adult Humor",
    exampleFilm: "Shrek (Lord Farquaad jokes) or Toy Story",
    description:
      "Humor aimed over children's heads that only adults typically notice.",
    severityWeight: 0.5,
  },
  {
    id: "grief_peril",
    dimension: "grief",
    title: "Heavy Grief & Emotional Loss",
    exampleFilm: "The Lion King (Mufasa) or Bridge to Terabithia",
    description:
      "Parent death, character sacrifice, and deeply sad emotional climaxes.",
    severityWeight: 0.7,
  },
  {
    id: "spooky_supernatural",
    dimension: "scare",
    title: "Ghosts, Witchcraft & The Occult",
    exampleFilm: "Ghostbusters / Hocus Pocus / Coraline",
    description:
      "Spooky rituals, haunted houses, skeletons, and eerie supernatural themes.",
    severityWeight: 0.65,
  },
  {
    id: "coarse_language",
    dimension: "language",
    title: "Coarse Language & Cuss Words",
    exampleFilm: "The Goonies / Back to the Future ('Damn', 'Hell')",
    description:
      "Mild to moderate swearing. (Automatically managed by Family Cinema Shield).",
    severityWeight: 0.55,
  },
];

export class ChildProfileService extends EventEmitter {
  constructor({ stateDir = STATE_DIR } = {}) {
    super();
    this.stateDir = stateDir;
    this.profilesFile = path.join(stateDir, "child-profiles.json");
    /** @type {Map<string, object>} */
    this.profiles = new Map();
    /** @type {Map<string, { kidsPresent: boolean, childProfileIds: string[], filterLevel: number, filterBlasphemy: boolean, updatedAt: number }>} */
    this.roomPresence = new Map(); // sessionId -> presence state

    this._loadProfiles();
  }

  _loadProfiles() {
    try {
      if (!fs.existsSync(this.stateDir)) {
        fs.mkdirSync(this.stateDir, { recursive: true });
      }
      if (fs.existsSync(this.profilesFile)) {
        const raw = fs.readFileSync(this.profilesFile, "utf-8");
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          for (const p of parsed) {
            if (!p?.id) continue;
            // Migrate legacy files in memory without retaining plaintext PINs.
            const { pin: _legacyPin, ...boundaryProfile } = p;
            this.profiles.set(boundaryProfile.id, boundaryProfile);
          }
          this._saveProfiles();
        }
      }
    } catch (err) {
      console.error(
        "[child-profile-service] Failed to load profiles:",
        err.message,
      );
    }
  }

  _saveProfiles() {
    try {
      if (!fs.existsSync(this.stateDir)) {
        fs.mkdirSync(this.stateDir, { recursive: true });
      }
      const data = Array.from(this.profiles.values());
      fs.writeFileSync(
        this.profilesFile,
        JSON.stringify(data, null, 2),
        "utf-8",
      );
    } catch (err) {
      console.error(
        "[child-profile-service] Failed to save profiles:",
        err.message,
      );
    }
  }

  /**
   * Returns the 8-card boundary match deck for the parent calibration game.
   */
  getChildDeck() {
    return {
      ok: true,
      deck: BOUNDARY_DECK,
      totalCards: BOUNDARY_DECK.length,
      estimatedMinutes: 0.5,
    };
  }

  /**
   * Calibrates or creates a child profile using Austin's Two-Stage Training Flow:
   * 1. Maturity Slider preset
   * 2. 8-card boundary match responses
   * 3. Contextual whitelist overrides
   * 4. Bedtime curfew
   * The secure profile service owns the required child exit PIN.
   */
  calibrateChildProfile(profileId, config = {}) {
    const existing = this.profiles.get(profileId) || {};
    const name = config.name || existing.name || "Kids Profile";
    const preset =
      config.maturityPreset || existing.maturityPreset || "big_kids";
    const parentAccounts = Array.isArray(config.parentAccounts)
      ? config.parentAccounts
      : existing.parentAccounts || ["parent_1", "parent_2"];
    const curfew = config.curfewTime || existing.curfewTime || "20:30";
    const whitelist = Array.isArray(config.whitelistOverrides)
      ? config.whitelistOverrides
      : existing.whitelistOverrides || [];

    // Stage 1: Preset baseline vectors
    const presetBaselines = {
      little_kids: {
        scare: 0.2,
        violence: 0.2,
        romance: 0.2,
        innuendo: 0.1,
        grief: 0.2,
        language: 0.1,
      },
      big_kids: {
        scare: 0.5,
        violence: 0.6,
        romance: 0.5,
        innuendo: 0.5,
        grief: 0.5,
        language: 0.4,
      },
      teens: {
        scare: 0.8,
        violence: 0.8,
        romance: 0.8,
        innuendo: 0.7,
        grief: 0.8,
        language: 0.7,
      },
      mature_teens: {
        scare: 0.95,
        violence: 0.95,
        romance: 0.95,
        innuendo: 0.95,
        grief: 0.95,
        language: 0.9,
      },
    };

    const vector = { ...(presetBaselines[preset] || presetBaselines.big_kids) };

    // Stage 2: Fine-tune vector using 8-card boundary match reactions
    const responses = Array.isArray(config.matchGameResponses)
      ? config.matchGameResponses
      : existing.matchGameResponses || [];

    for (const resp of responses) {
      const card = BOUNDARY_DECK.find((c) => c.id === resp.cardId);
      if (!card) continue;
      const dim = card.dimension;
      if (resp.reaction === "fine") {
        // Parent is fine: expand tolerance
        vector[dim] = Math.min(1.0, vector[dim] + 0.15);
      } else if (resp.reaction === "block") {
        // Parent blocked: clamp strictly
        vector[dim] = Math.max(0.1, vector[dim] - 0.25);
      } else if (resp.reaction === "ask") {
        // Parent requires shield
        vector[dim] = Math.min(vector[dim], card.severityWeight);
      }
    }

    // Assemble unified profile
    const profile = {
      id: profileId,
      name,
      maturityPreset: preset,
      parentAccounts,
      curfewTime: curfew,
      matchGameResponses: responses,
      whitelistOverrides: whitelist,
      boundaryVector: vector,
      familyCinemaShieldAutoLock: true, // Auto-lock Level 3 + Blasphemy
      createdAt: existing.createdAt || Date.now(),
      updatedAt: Date.now(),
    };

    this.profiles.set(profileId, profile);
    this._saveProfiles();
    this.emit("profileUpdated", profile);

    return {
      ok: true,
      profileId,
      profile,
      summary: `Trained '${name}' profile with ${preset} baseline and ${responses.length} card reactions.`,
    };
  }

  /**
   * Checks if a title is permitted for a child profile based on the trained boundary vector.
   * Runs in <0.05ms without disk reads.
   * @param {string} profileId
   * @param {object} titleMeta
   */
  isTitlePermitted(profileId, titleMeta = {}) {
    const profile = this.profiles.get(profileId);
    if (!profile) return { permitted: true, reason: "No profile restrictions" };

    const titleId = String(titleMeta.id || titleMeta.titleId || "");
    // Check whitelist override first
    if (
      profile.whitelistOverrides &&
      profile.whitelistOverrides.includes(titleId)
    ) {
      return {
        permitted: true,
        whitelisted: true,
        reason: "Parent whitelist override",
      };
    }

    const mpaa = String(
      titleMeta.certification || titleMeta.rating || "",
    ).toUpperCase();
    const vec = profile.boundaryVector;

    // Direct rating guard
    if (profile.maturityPreset === "little_kids") {
      if (["PG-13", "R", "NC-17", "TV-14", "TV-MA"].includes(mpaa)) {
        return {
          permitted: false,
          reason: `Rating ${mpaa} exceeds Little Kids boundary.`,
        };
      }
    } else if (profile.maturityPreset === "big_kids") {
      if (["R", "NC-17", "TV-MA"].includes(mpaa)) {
        return {
          permitted: false,
          reason: `Rating ${mpaa} exceeds Big Kids boundary.`,
        };
      }
    } else if (profile.maturityPreset === "teens") {
      if (["R", "NC-17", "TV-MA"].includes(mpaa)) {
        return {
          permitted: false,
          reason: `Rating ${mpaa} exceeds Teens boundary.`,
        };
      }
    } else if (profile.maturityPreset === "mature_teens") {
      if (["NC-17"].includes(mpaa)) {
        return {
          permitted: false,
          reason: `Rating ${mpaa} exceeds Mature Teens boundary.`,
        };
      }
    }

    // Check content dimensions against trained vector
    const horror = Number(titleMeta.scareScore || 0);
    const violence = Number(titleMeta.violenceScore || 0);
    const mature = Number(titleMeta.matureScore || 0);

    if (horror > vec.scare + 0.2)
      return { permitted: false, reason: "Exceeds scary threshold" };
    if (violence > vec.violence + 0.2)
      return { permitted: false, reason: "Exceeds violence threshold" };
    if (mature > vec.innuendo + 0.2)
      return { permitted: false, reason: "Exceeds adult innuendo threshold" };

    return {
      permitted: true,
      whitelisted: false,
      shieldActive: profile.familyCinemaShieldAutoLock,
      shieldLevel: 3,
    };
  }

  /**
   * Curates the child's Discover screen and library catalog based strictly on the parent's trained settings.
   * (Austin's Mandate: 'Their discover should be based on the parents settings for them')
   * @param {string} profileId
   * @param {Array<object>} catalog
   */
  filterCatalogForChild(profileId, catalog = []) {
    const profile = this.profiles.get(profileId);
    if (!Array.isArray(catalog)) return [];

    const approved = [];
    for (const item of catalog) {
      if (!profile) continue;
      const check = this.isTitlePermitted(profile.id, item);
      if (check.permitted) {
        approved.push({
          ...item,
          childSafe: true,
          whitelisted: Boolean(check.whitelisted),
          familyShieldLocked: true,
        });
      }
    }
    return approved;
  }

  // ==========================================================================
  // SECTION 70.5: MOBILE COMPANION "WHO'S IN THE ROOM?" PRESENCE SLIDER
  // ==========================================================================

  /**
   * Updates dynamic room presence from mobile companion screen.
   * @param {string} [sessionId="living_room_tv"]
   * @param {object} presenceData
   * @param {boolean} presenceData.kidsPresent
   * @param {number} [presenceData.filterLevel=3] 0: Uncensored, 1: Severe, 2: Moderate, 3: Mild/Kids
   * @param {boolean} [presenceData.filterBlasphemy=true]
   */
  setRoomPresence(sessionId = "living_room_tv", presenceData = {}) {
    const kidsPresent = Boolean(presenceData.kidsPresent);
    const level = kidsPresent ? Number(presenceData.filterLevel ?? 3) : 0;
    const blasphemy = kidsPresent
      ? Boolean(presenceData.filterBlasphemy ?? true)
      : false;
    const childProfileIds =
      kidsPresent && Array.isArray(presenceData.childProfileIds)
        ? [
            ...new Set(
              presenceData.childProfileIds
                .filter((id) => typeof id === "string" && id.trim())
                .map((id) => id.trim()),
            ),
          ].slice(0, 20)
        : [];

    const state = {
      sessionId,
      kidsPresent,
      childProfileIds,
      filterLevel: level,
      filterBlasphemy: blasphemy,
      label: kidsPresent ? "Kids are watching" : "Adults only",
      updatedAt: Date.now(),
    };

    this.roomPresence.set(sessionId, state);
    this.emit("presenceChanged", state);

    return {
      ok: true,
      state,
      policyUpdated: true,
      playbackEnforcement: "awaiting-session-adapter",
      message: kidsPresent
        ? "Child-presence policy recorded for this session."
        : "Adult-only presence recorded for this session.",
    };
  }

  /**
   * Gets active room presence for session.
   * @param {string} [sessionId="living_room_tv"]
   */
  getRoomPresence(sessionId = "living_room_tv") {
    const existing = this.roomPresence.get(sessionId);
    if (existing) return { ok: true, state: existing };

    // Default: adults only unless toggled
    const defaultState = {
      sessionId,
      kidsPresent: false,
      childProfileIds: [],
      filterLevel: 0,
      filterBlasphemy: false,
      label: "Adults only",
      updatedAt: Date.now(),
    };
    return { ok: true, state: defaultState };
  }
}

export const childProfileService = new ChildProfileService();
