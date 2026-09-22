import fs from "node:fs";
import path from "node:path";
import { randomBytes, randomUUID } from "node:crypto";
import { assertCanonicalId, canonicalJson, profileTombstoneHash, sha256, validateEvent } from "./intelligence-contracts.mjs";

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS intelligence_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS intelligence_events (
    event_id TEXT PRIMARY KEY, partition_key TEXT NOT NULL, partition_sequence BIGINT NOT NULL,
    schema_version INTEGER NOT NULL, event_type TEXT NOT NULL, occurred_at BIGINT NOT NULL, recorded_at BIGINT NOT NULL,
    privacy_class TEXT NOT NULL, source TEXT NOT NULL, profile_id TEXT, device_id TEXT, session_id TEXT,
    work_id TEXT, edition_id TEXT, asset_id TEXT, rendition_id TEXT, timeline_id TEXT, source_id TEXT,
    causation_id TEXT, correlation_id TEXT, policy_snapshot_id TEXT, payload_json TEXT NOT NULL, payload_hash TEXT NOT NULL,
    UNIQUE(partition_key, partition_sequence))`,
  `CREATE TABLE IF NOT EXISTS intelligence_outbox (
    event_id TEXT PRIMARY KEY, topic TEXT NOT NULL, payload_json TEXT NOT NULL,
    created_at BIGINT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, delivered_at BIGINT,
    last_error TEXT, FOREIGN KEY(event_id) REFERENCES intelligence_events(event_id) ON DELETE CASCADE)`,
  `CREATE TABLE IF NOT EXISTS intelligence_features (
    feature_id TEXT PRIMARY KEY, scope TEXT NOT NULL, entity_id TEXT NOT NULL, feature_set TEXT NOT NULL,
    feature_schema_version INTEGER NOT NULL, extractor_version TEXT NOT NULL, source_watermark BIGINT NOT NULL,
    profile_id TEXT, work_id TEXT, edition_id TEXT, asset_id TEXT, timeline_id TEXT, source_id TEXT,
    blob_hash TEXT NOT NULL, blob_bytes BIGINT NOT NULL, confidence REAL, lineage_json TEXT NOT NULL,
    created_at BIGINT NOT NULL, expires_at BIGINT, invalidated_at BIGINT, invalidation_reason TEXT,
    UNIQUE(scope, entity_id, feature_set, feature_schema_version, extractor_version, source_watermark))`,
  `CREATE TABLE IF NOT EXISTS intelligence_deletion_tombstones (
    subject_type TEXT NOT NULL, subject_hash TEXT NOT NULL, deleted_at BIGINT NOT NULL, reason TEXT NOT NULL,
    PRIMARY KEY(subject_type, subject_hash))`,
  `CREATE INDEX IF NOT EXISTS intelligence_events_profile_idx ON intelligence_events(profile_id, partition_sequence)`,
  `CREATE INDEX IF NOT EXISTS intelligence_events_media_idx ON intelligence_events(asset_id, edition_id)`,
  `CREATE INDEX IF NOT EXISTS intelligence_features_profile_idx ON intelligence_features(profile_id, invalidated_at)`,
  `CREATE INDEX IF NOT EXISTS intelligence_features_media_idx ON intelligence_features(asset_id, edition_id, source_id, invalidated_at)`,
];
const FEATURE_SCOPES = new Set(["profile", "media", "household", "machine", "device"]);

function resultRows(result) {
  return Array.isArray(result) ? result : (result?.rows || []);
}

async function query(db, sql, params = []) {
  return resultRows(await db.query(sql, params));
}

async function transaction(db, callback) {
  if (typeof db.transaction !== "function") throw new TypeError("database adapter must provide transaction(callback)");
  return db.transaction(callback);
}

function json(value) { return canonicalJson(value ?? {}); }

function partitionFor(event) {
  if (event.profileId) return `profile:${event.profileId}`;
  if (event.assetId) return `asset:${event.assetId}`;
  if (event.workId) return `work:${event.workId}`;
  return "system";
}

function outboxEnvelope(event) {
  const { payloadJson: _payloadJson, ...serializable } = event;
  return canonicalJson(serializable);
}

function safeSegment(value, name) {
  assertCanonicalId(value, name);
  return value;
}

export class LocalIntelligenceStore {
  constructor({ db, stateDir }) {
    if (!db?.query || !stateDir) throw new TypeError("db and stateDir are required");
    this.db = db;
    this.stateDir = path.resolve(stateDir);
    this.blobDir = path.join(this.stateDir, "intelligence-blobs", "sha256");
    this.storeSalt = null;
  }

  async initialize() {
    fs.mkdirSync(this.blobDir, { recursive: true, mode: 0o700 });
    for (const statement of SCHEMA) await this.db.query(statement);
    const found = await query(this.db, `SELECT value FROM intelligence_meta WHERE key = $1`, ["store_salt"]);
    if (found[0]?.value) this.storeSalt = found[0].value;
    else {
      this.storeSalt = randomBytes(32).toString("hex");
      await this.db.query(`INSERT INTO intelligence_meta (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING`, ["store_salt", this.storeSalt]);
      const saved = await query(this.db, `SELECT value FROM intelligence_meta WHERE key = $1`, ["store_salt"]);
      this.storeSalt = saved[0].value;
    }
    return this;
  }

  async appendEvent(input, { topic = "intelligence.events" } = {}) {
    const event = validateEvent(input);
    return transaction(this.db, (tx) => this.appendEventInTransaction(tx, event, topic));
  }

  async appendEventInTransaction(tx, event, topic = "intelligence.events") {
      if (event.profileId) {
        const subjectHash = profileTombstoneHash(event.profileId, this.storeSalt);
        const tombstone = await query(tx, `SELECT subject_hash FROM intelligence_deletion_tombstones WHERE subject_type = $1 AND subject_hash = $2`, ["profile", subjectHash]);
        if (tombstone.length) throw Object.assign(new Error("Profile data has been deleted"), { code: "profile_deleted" });
      }
      const partitionKey = partitionFor(event);
      const duplicate = await query(tx, `SELECT partition_sequence, payload_hash, event_type FROM intelligence_events WHERE event_id = $1`, [event.eventId]);
      if (duplicate.length) {
        if (duplicate[0].payload_hash !== event.payloadHash || duplicate[0].event_type !== event.type) {
          throw Object.assign(new Error("Event ID is already bound to different content"), { code: "event_id_conflict" });
        }
        return { event, partitionKey, sequence: Number(duplicate[0].partition_sequence), duplicate: true };
      }
      const seqRows = await query(tx, `SELECT COALESCE(MAX(partition_sequence), 0) AS value FROM intelligence_events WHERE partition_key = $1`, [partitionKey]);
      const sequence = Number(seqRows[0]?.value || 0) + 1;
      await tx.query(`INSERT INTO intelligence_events (
        event_id, partition_key, partition_sequence, schema_version, event_type, occurred_at, recorded_at,
        privacy_class, source, profile_id, device_id, session_id, work_id, edition_id, asset_id, rendition_id,
        timeline_id, source_id, causation_id, correlation_id, policy_snapshot_id, payload_json, payload_hash
      ) VALUES (${Array.from({ length: 23 }, (_, index) => `$${index + 1}`).join(",")})`, [
        event.eventId, partitionKey, sequence, event.schemaVersion, event.type, event.occurredAt, event.recordedAt,
        event.privacyClass, event.source, event.profileId, event.deviceId, event.sessionId, event.workId,
        event.editionId, event.assetId, event.renditionId, event.timelineId, event.sourceId, event.causationId,
        event.correlationId, event.policySnapshotId, event.payloadJson, event.payloadHash,
      ]);
      await tx.query(`INSERT INTO intelligence_outbox (event_id, topic, payload_json, created_at, attempts)
        VALUES ($1, $2, $3, $4, 0)`, [event.eventId, topic, outboxEnvelope(event), event.recordedAt]);
      return { event, partitionKey, sequence, duplicate: false };
  }

  async pendingOutbox({ limit = 100 } = {}) {
    if (!Number.isInteger(limit) || limit < 1 || limit > 1000) throw new TypeError("limit must be between 1 and 1000");
    return query(this.db, `SELECT event_id, topic, payload_json, created_at, attempts, last_error
      FROM intelligence_outbox WHERE delivered_at IS NULL ORDER BY created_at, event_id LIMIT $1`, [limit]);
  }

  async readEvents({ partitionKey = null, afterSequence = 0, limit = 100 } = {}) {
    if (!Number.isSafeInteger(afterSequence) || afterSequence < 0) throw new TypeError("afterSequence is invalid");
    if (!Number.isInteger(limit) || limit < 1 || limit > 1000) throw new TypeError("limit must be between 1 and 1000");
    if (partitionKey !== null && (typeof partitionKey !== "string" || partitionKey.length > 300)) throw new TypeError("partitionKey is invalid");
    const rows = partitionKey === null
      ? await query(this.db, `SELECT * FROM intelligence_events WHERE partition_sequence > $1 ORDER BY recorded_at, event_id LIMIT $2`, [afterSequence, limit])
      : await query(this.db, `SELECT * FROM intelligence_events WHERE partition_key = $1 AND partition_sequence > $2 ORDER BY partition_sequence LIMIT $3`, [partitionKey, afterSequence, limit]);
    return rows.map((row) => ({ ...row, payload: JSON.parse(row.payload_json) }));
  }

  async recordOutboxAttempt(eventId, { delivered = false, error = null, now = Date.now() } = {}) {
    assertCanonicalId(eventId, "eventId");
    await this.db.query(`UPDATE intelligence_outbox SET attempts = attempts + 1, delivered_at = $2, last_error = $3 WHERE event_id = $1`,
      [eventId, delivered ? now : null, delivered ? null : String(error || "delivery_failed").slice(0, 1000)]);
  }

  blobPath(hash) {
    if (typeof hash !== "string" || !/^[a-f0-9]{64}$/.test(hash)) throw new TypeError("blob hash is invalid");
    return path.join(this.blobDir, hash.slice(0, 2), hash);
  }

  writeBlob(bytes) {
    const body = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
    const hash = sha256(body);
    const target = this.blobPath(hash);
    if (!fs.existsSync(target)) {
      fs.mkdirSync(path.dirname(target), { recursive: true, mode: 0o700 });
      const temporary = `${target}.${process.pid}.${randomUUID()}.tmp`;
      try {
        const fd = fs.openSync(temporary, "wx", 0o600);
        try { fs.writeFileSync(fd, body); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
        try { fs.renameSync(temporary, target); }
        catch (error) { if (error.code !== "EEXIST") throw error; }
      } finally { try { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); } catch {} }
    }
    return { hash, bytes: body.length, path: target };
  }

  readBlob(hash) {
    const body = fs.readFileSync(this.blobPath(hash));
    if (sha256(body) !== hash) throw Object.assign(new Error("Feature blob failed its content hash"), { code: "feature_blob_corrupt" });
    return body;
  }

  async putFeature(input, bytes) {
    for (const field of ["scope", "entityId", "featureSet", "extractorVersion"]) safeSegment(input[field], field);
    if (!FEATURE_SCOPES.has(input.scope)) throw new TypeError("feature scope is invalid");
    for (const field of ["profileId", "workId", "editionId", "assetId", "timelineId", "sourceId"]) {
      if (input[field] != null) safeSegment(input[field], field);
    }
    if (input.scope === "profile" && !input.profileId) throw new TypeError("profile-scoped features require profileId");
    if (input.scope !== "profile" && input.profileId) throw new TypeError("personalized features must use profile scope");
    if (!Number.isSafeInteger(input.featureSchemaVersion) || input.featureSchemaVersion < 1) throw new TypeError("featureSchemaVersion is invalid");
    if (!Number.isSafeInteger(input.sourceWatermark) || input.sourceWatermark < 0) throw new TypeError("sourceWatermark is invalid");
    if (input.confidence != null && (!Number.isFinite(input.confidence) || input.confidence < 0 || input.confidence > 1)) throw new TypeError("confidence is invalid");
    const blob = this.writeBlob(bytes);
    const featureId = input.featureId || randomUUID(); safeSegment(featureId, "featureId");
    const now = input.createdAt || Date.now();
    try {
      await transaction(this.db, async (tx) => {
        if (input.profileId) {
          const subjectHash = profileTombstoneHash(input.profileId, this.storeSalt);
          const tombstone = await query(tx, `SELECT subject_hash FROM intelligence_deletion_tombstones WHERE subject_type = $1 AND subject_hash = $2`, ["profile", subjectHash]);
          if (tombstone.length) throw Object.assign(new Error("Profile data has been deleted"), { code: "profile_deleted" });
        }
        await tx.query(`INSERT INTO intelligence_features (
      feature_id, scope, entity_id, feature_set, feature_schema_version, extractor_version, source_watermark,
      profile_id, work_id, edition_id, asset_id, timeline_id, source_id, blob_hash, blob_bytes, confidence,
      lineage_json, created_at, expires_at, invalidated_at, invalidation_reason
    ) VALUES (${Array.from({ length: 21 }, (_, index) => `$${index + 1}`).join(",")})`, [
      featureId, input.scope, input.entityId, input.featureSet, input.featureSchemaVersion, input.extractorVersion,
      input.sourceWatermark, input.profileId || null, input.workId || null, input.editionId || null,
      input.assetId || null, input.timelineId || null, input.sourceId || null, blob.hash, blob.bytes,
      input.confidence ?? null, json(input.lineage || {}), now, input.expiresAt || null, null, null,
        ]);
      });
    } catch (error) {
      await this.removeUnreferencedBlobs([blob.hash]);
      throw error;
    }
    return { featureId, blobHash: blob.hash, blobBytes: blob.bytes };
  }

  async listFeatures({ profileId = null, assetId = null, includeInvalidated = false } = {}) {
    const clauses = [], params = [];
    if (profileId) { safeSegment(profileId, "profileId"); params.push(profileId); clauses.push(`profile_id = $${params.length}`); }
    if (assetId) { safeSegment(assetId, "assetId"); params.push(assetId); clauses.push(`asset_id = $${params.length}`); }
    if (!includeInvalidated) clauses.push("invalidated_at IS NULL");
    return query(this.db, `SELECT * FROM intelligence_features${clauses.length ? ` WHERE ${clauses.join(" AND ")}` : ""} ORDER BY created_at, feature_id`, params);
  }

  async createFeatureSnapshot({ featureIds, profileId = null } = {}) {
    if (!Array.isArray(featureIds) || featureIds.length === 0 || featureIds.length > 256) {
      throw new TypeError("featureIds must contain between 1 and 256 feature IDs");
    }
    const uniqueIds = [...new Set(featureIds)];
    uniqueIds.forEach((featureId) => safeSegment(featureId, "featureId"));
    if (profileId !== null) safeSegment(profileId, "profileId");
    const placeholders = uniqueIds.map((_, index) => `$${index + 1}`).join(",");
    const rows = await query(this.db, `SELECT * FROM intelligence_features
      WHERE feature_id IN (${placeholders}) AND invalidated_at IS NULL ORDER BY feature_id`, uniqueIds);
    if (rows.length !== uniqueIds.length) throw Object.assign(new Error("One or more feature references are unavailable."), { code: "feature_unavailable" });
    for (const row of rows) {
      if (row.scope === "profile" && (!profileId || row.profile_id !== profileId)) {
        throw Object.assign(new Error("A profile feature cannot cross its privacy boundary."), { code: "profile_feature_boundary" });
      }
      if (row.scope !== "profile" && row.profile_id) {
        throw Object.assign(new Error("The feature store contains an invalid personalized scope."), { code: "feature_scope_corrupt" });
      }
    }
    const features = rows.map((row) => {
      let value;
      try { value = JSON.parse(this.readBlob(row.blob_hash).toString("utf8")); }
      catch (error) {
        throw Object.assign(new Error("A structured feature payload could not be decoded."), {
          code: error?.code === "feature_blob_corrupt" ? error.code : "feature_payload_invalid", cause: error,
        });
      }
      return Object.freeze({
        featureId: row.feature_id, scope: row.scope, entityId: row.entity_id,
        featureSet: row.feature_set, featureSchemaVersion: Number(row.feature_schema_version),
        extractorVersion: row.extractor_version, sourceWatermark: Number(row.source_watermark),
        confidence: row.confidence == null ? null : Number(row.confidence),
        lineage: JSON.parse(row.lineage_json), blobHash: row.blob_hash, value,
      });
    });
    const snapshotBody = features.map(({ value: _value, ...reference }) => reference);
    return Object.freeze({
      snapshotId: `snapshot:${sha256(canonicalJson({ profileId, features: snapshotBody }))}`,
      profileId, features: Object.freeze(features),
    });
  }

  async isProfileDeleted(profileId) {
    if (!this.storeSalt) throw new Error("store is not initialized");
    const subjectHash = profileTombstoneHash(profileId, this.storeSalt);
    const rows = await query(this.db, `SELECT subject_hash FROM intelligence_deletion_tombstones WHERE subject_type = $1 AND subject_hash = $2`, ["profile", subjectHash]);
    return rows.length > 0;
  }

  async deleteProfile(profileId, { reason = "profile_deleted", now = Date.now() } = {}) {
    safeSegment(profileId, "profileId");
    const subjectHash = profileTombstoneHash(profileId, this.storeSalt);
    const hashes = await transaction(this.db, async (tx) => {
      const rows = await query(tx, `SELECT blob_hash FROM intelligence_features WHERE profile_id = $1`, [profileId]);
      await tx.query(`DELETE FROM intelligence_outbox WHERE event_id IN (SELECT event_id FROM intelligence_events WHERE profile_id = $1)`, [profileId]);
      await tx.query(`DELETE FROM intelligence_events WHERE profile_id = $1`, [profileId]);
      await tx.query(`DELETE FROM intelligence_features WHERE profile_id = $1`, [profileId]);
      await tx.query(`INSERT INTO intelligence_deletion_tombstones (subject_type, subject_hash, deleted_at, reason)
        VALUES ($1, $2, $3, $4) ON CONFLICT (subject_type, subject_hash) DO UPDATE SET deleted_at = $3, reason = $4`,
      ["profile", subjectHash, now, String(reason).slice(0, 256)]);
      const deletionEvent = validateEvent({ type: "profile.deleted", source: "local-intelligence-store",
        occurredAt: now, recordedAt: now, privacyClass: "local-sensitive", payload: { subjectHash, reason } });
      await this.appendEventInTransaction(tx, deletionEvent);
      return rows.map((row) => row.blob_hash);
    });
    await this.removeUnreferencedBlobs(hashes);
    return { deleted: true, subjectHash };
  }

  async invalidateMedia({ assetId = null, editionId = null, reason = "media_deleted", now = Date.now() } = {}) {
    if (!assetId && !editionId) throw new TypeError("assetId or editionId is required");
    const clauses = [], params = [];
    if (assetId) { safeSegment(assetId, "assetId"); params.push(assetId); clauses.push(`asset_id = $${params.length}`); }
    if (editionId) { safeSegment(editionId, "editionId"); params.push(editionId); clauses.push(`edition_id = $${params.length}`); }
    params.push(now, reason);
    const event = validateEvent({ type: "media.deleted", source: "local-intelligence-store", assetId, editionId,
      occurredAt: now, recordedAt: now, privacyClass: "local-private", payload: { reason } });
    return transaction(this.db, async (tx) => {
      await tx.query(`UPDATE intelligence_features SET invalidated_at = $${params.length - 1}, invalidation_reason = $${params.length}
        WHERE invalidated_at IS NULL AND (${clauses.join(" OR ")})`, params);
      return this.appendEventInTransaction(tx, event);
    });
  }

  async revokeSource(sourceId, { reason = "source_revoked", now = Date.now() } = {}) {
    safeSegment(sourceId, "sourceId");
    const event = validateEvent({ type: "source.revoked", source: "local-intelligence-store", sourceId,
      occurredAt: now, recordedAt: now, privacyClass: "local-private", payload: { reason } });
    return transaction(this.db, async (tx) => {
      await tx.query(`UPDATE intelligence_features SET invalidated_at = $2, invalidation_reason = $3
        WHERE source_id = $1 AND invalidated_at IS NULL`, [sourceId, now, reason]);
      return this.appendEventInTransaction(tx, event);
    });
  }

  async removeUnreferencedBlobs(hashes) {
    for (const hash of new Set(hashes)) {
      const rows = await query(this.db, `SELECT feature_id FROM intelligence_features WHERE blob_hash = $1 LIMIT 1`, [hash]);
      if (!rows.length) { try { fs.unlinkSync(this.blobPath(hash)); } catch (error) { if (error.code !== "ENOENT") throw error; } }
    }
  }
}
