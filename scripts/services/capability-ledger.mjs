import fs from "node:fs";
import path from "node:path";

export const CAPABILITY_STATES = Object.freeze([
  "installed", "validating", "learning_locally", "ready", "active", "paused", "unsupported",
  "needs_attention", "disabled", "quarantined", "rolled_back",
]);

const TRANSITIONS = Object.freeze({
  installed: ["validating", "unsupported", "disabled", "quarantined"],
  validating: ["learning_locally", "ready", "needs_attention", "unsupported", "disabled", "quarantined"],
  learning_locally: ["ready", "needs_attention", "paused", "disabled", "quarantined"],
  ready: ["active", "validating", "disabled", "quarantined"],
  active: ["paused", "needs_attention", "disabled", "quarantined", "rolled_back"],
  paused: ["active", "validating", "disabled", "needs_attention", "quarantined"],
  unsupported: ["validating", "disabled"],
  needs_attention: ["validating", "paused", "disabled", "quarantined", "rolled_back"],
  disabled: ["validating"],
  quarantined: ["validating", "rolled_back", "disabled"],
  rolled_back: ["validating", "active", "disabled"],
});

const ID = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/;
const object = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const fail = (code, message) => { throw Object.assign(new Error(message), { code }); };

function atomicWrite(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = `${file}.tmp.${process.pid}.${Date.now()}`;
  try {
    fs.writeFileSync(temp, JSON.stringify(value, null, 2), { encoding: "utf8", mode: 0o600, flag: "wx" });
    fs.renameSync(temp, file);
  } catch (error) {
    try { fs.unlinkSync(temp); } catch {}
    throw Object.assign(new Error("Capability state could not be saved."), { code: "capability_save_failed", cause: error });
  }
}
export class CapabilityLedger {
  constructor({ stateDir, clock = () => Date.now() } = {}) {
    if (typeof stateDir !== "string" || !path.isAbsolute(stateDir)) fail("invalid_state_dir", "Capability state requires an absolute local directory.");
    this.file = path.join(stateDir, "intelligence", "capabilities.json");
    this.clock = clock;
    this.records = new Map();
    this.load();
  }

  load() {
    if (!fs.existsSync(this.file)) return;
    const stat = fs.lstatSync(this.file);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 1024 * 1024) fail("capability_state_invalid", "Capability state needs recovery.");
    let parsed;
    try { parsed = JSON.parse(fs.readFileSync(this.file, "utf8")); } catch { fail("capability_state_invalid", "Capability state needs recovery."); }
    if (parsed?.schemaVersion !== 1 || !Array.isArray(parsed.capabilities)) fail("capability_state_invalid", "Capability state needs recovery.");
    for (const record of parsed.capabilities) {
      if (!object(record) || !ID.test(record.id) || !CAPABILITY_STATES.includes(record.state)) fail("capability_state_invalid", "Capability state needs recovery.");
      this.records.set(record.id, Object.freeze({ ...record }));
    }
  }

  persist() {
    atomicWrite(this.file, { schemaVersion: 1, capabilities: [...this.records.values()] });
  }

  install(id, details = {}) {
    if (typeof id !== "string" || !ID.test(id)) fail("invalid_capability", "Capability ID is invalid.");
    if (this.records.has(id)) return this.records.get(id);
    const now = this.clock();
    const record = Object.freeze({ id, state: "installed", reason: String(details.reason || "Installed and awaiting validation."),
      scope: details.scope || "household", installedAt: now, updatedAt: now, modelSetId: details.modelSetId || null,
      lastValidationAt: null, evidenceSummary: null });
    this.records.set(id, record);
    this.persist();
    return record;
  }

  transition(id, nextState, { authority = "runtime", reason, modelSetId, evidenceSummary } = {}) {
    const current = this.records.get(id);
    if (!current) fail("capability_not_installed", "Capability is not installed.");
    if (!CAPABILITY_STATES.includes(nextState) || !TRANSITIONS[current.state].includes(nextState)) {
      fail("invalid_capability_transition", `Cannot move ${id} from ${current.state} to ${nextState}.`);
    }
    if (["ready", "active"].includes(nextState) && authority !== "evaluator") {
      fail("capability_gate_required", "Only validated evaluation evidence can ready or activate a capability.");
    }
    if (nextState === "disabled" && !["user", "runtime"].includes(authority)) fail("capability_authority", "Capability disable authority is invalid.");
    const now = this.clock();
    const record = Object.freeze({ ...current, state: nextState, reason: String(reason || nextState), updatedAt: now,
      ...(modelSetId !== undefined ? { modelSetId } : {}),
      ...(["ready", "active"].includes(nextState) ? { lastValidationAt: now } : {}),
      ...(evidenceSummary !== undefined ? { evidenceSummary } : {}) });
    this.records.set(id, record);
    this.persist();
    return record;
  }

  get(id) { return this.records.get(id) || null; }
  list() { return [...this.records.values()].map((record) => ({ ...record })); }
}
