import { useEffect, useId, useRef, useState } from "react";
import { activeExperienceProfile, useExperienceStore } from "@/experience/experience-state";
import {
  automaticStorageAllowanceBytes, createStorageSettingsController, maximumFixedStorageGb,
  type StorageSettingsState, type StorageStrategy,
} from "@/lib/storage-settings-client";

const controlClass = "min-h-12 min-w-12 rounded-xl border border-white/15 px-4 text-sm transition-colors hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current disabled:cursor-not-allowed disabled:opacity-40";
const emptyState: StorageSettingsState = { snapshot: null, loading: false, saving: false, saved: false, error: null };
const gib = (bytes: number | null | undefined, available: boolean) => available && typeof bytes === "number" ? `${(bytes / 2 ** 30).toLocaleString(undefined, { maximumFractionDigits: 1 })} GiB` : "Unavailable";

export function StorageSettings() {
  const rangeId = useId();
  const profileId = activeExperienceProfile(useExperienceStore()).id;
  const currentProfile = useRef(profileId);
  currentProfile.current = profileId;
  const controllerRef = useRef<ReturnType<typeof createStorageSettingsController> | null>(null);
  const [stored, setStored] = useState({ profileId: "", state: emptyState });
  const [draft, setDraft] = useState<{ profileId: string; revision: string; strategy: StorageStrategy } | null>(null);

  useEffect(() => {
    setDraft(null);
    if (!profileId) {
      setStored({ profileId, state: { ...emptyState, error: "Choose your profile to view storage settings." } });
      return;
    }
    const controller = createStorageSettingsController({
      expectedProfileId: profileId,
      isCurrent: () => currentProfile.current === profileId && activeExperienceProfile(useExperienceStore.getState()).id === profileId,
      onChange: (state) => setStored({ profileId, state }),
    });
    controllerRef.current = controller;
    void controller.load();
    return () => {
      controller.dispose();
      if (controllerRef.current === controller) controllerRef.current = null;
    };
  }, [profileId]);

  const state = stored.profileId === profileId ? stored.state : { ...emptyState, loading: Boolean(profileId) };
  const snapshot = state.snapshot;
  useEffect(() => {
    setDraft(snapshot ? { profileId: snapshot.profileId, revision: snapshot.revision, strategy: { ...snapshot.strategy } } : null);
  }, [snapshot]);
  const strategy = draft?.profileId === profileId && draft.revision === snapshot?.revision ? draft.strategy : snapshot?.strategy;
  const dirty = Boolean(snapshot && strategy && (
    strategy.mode !== snapshot.strategy.mode || strategy.storageAllocation !== snapshot.strategy.storageAllocation || strategy.allocatedGb !== snapshot.strategy.allocatedGb
  ));
  const busy = state.loading || state.saving;
  const measured = Boolean(snapshot?.storage.ok && snapshot.storage.available && snapshot.budget.available);
  const editable = Boolean(snapshot?.canEdit && measured && !busy);
  const maxGb = snapshot ? maximumFixedStorageGb(snapshot) : 0;
  const automaticAllowance = snapshot ? automaticStorageAllowanceBytes(snapshot) : null;

  function update(patch: Partial<StorageStrategy>) {
    if (!snapshot || !strategy || !editable) return;
    setDraft({ profileId, revision: snapshot.revision, strategy: { ...strategy, ...patch } });
  }

  return (
    <div aria-label="Storage settings" className="space-y-5 text-sm">
      <p className="text-white/60">Choose the space this home may use for prepared media. Your existing local originals are separate from this budget.</p>
      {busy ? <p role="status" className="text-white/65">{state.saving ? "Saving storage settings…" : "Checking this home’s storage…"}</p> : null}
      {state.error ? (
        <div role="alert" className="space-y-3 rounded-xl bg-white/[.04] p-4">
          <p>{state.error}</p>
          <button type="button" className={controlClass} disabled={busy || !profileId} onClick={() => void controllerRef.current?.load()}>Retry storage settings</button>
        </div>
      ) : null}
      {snapshot && strategy ? (
        <>
          <dl className="grid grid-cols-2 gap-x-5 gap-y-4 sm:grid-cols-3">
            {[
              ["Drive capacity", gib(snapshot.storage.totalBytes, snapshot.storage.available)],
              ["Free on drive", gib(snapshot.storage.freeBytes, snapshot.storage.available)],
              ["Protected free space", gib(snapshot.budget.protectedFreeBytes, snapshot.budget.available)],
              ["Prepared media used", gib(snapshot.budget.usedBytes, snapshot.budget.available)],
              ["Reserved for preparation", gib(snapshot.budget.reservedBytes, snapshot.budget.available)],
              ["Budget remaining", gib(snapshot.budget.remainingBytes, snapshot.budget.available)],
            ].map(([label, value]) => <div key={label}><dt className="text-xs text-white/45">{label}</dt><dd className="mt-1 tabular-nums">{value}</dd></div>)}
          </dl>
          <p className="text-xs text-white/55">Current preparation budget: {gib(snapshot.budget.limitBytes, snapshot.budget.available)}.</p>
          {!measured ? (
            <div className="space-y-3">
              <p role="status" className="text-white/60">{snapshot.budget.reason || "Storage measurements are unavailable. Check again before changing the budget."}</p>
              {!state.error ? <button type="button" className={controlClass} disabled={busy} onClick={() => void controllerRef.current?.load()}>Retry storage settings</button> : null}
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2" role="group" aria-label="Storage allocation">
            <button type="button" className={`${controlClass} ${strategy.storageAllocation === "dynamic_20" ? "bg-white/10" : ""}`} aria-pressed={strategy.storageAllocation === "dynamic_20"} disabled={!editable} onClick={() => update({ storageAllocation: "dynamic_20" })}>Automatic 20%</button>
            <button type="button" className={`${controlClass} ${strategy.storageAllocation === "fixed" ? "bg-white/10" : ""}`} aria-pressed={strategy.storageAllocation === "fixed"} disabled={!editable} onClick={() => update({ storageAllocation: "fixed", allocatedGb: Math.min(maxGb, Math.max(0, Math.floor(strategy.allocatedGb))) })}>Fixed limit</button>
          </div>
          {strategy.storageAllocation === "dynamic_20" ? (
            <p className="text-xs text-white/55">Automatic allocation currently allows {gib(automaticAllowance, automaticAllowance !== null)}. Protected free space still applies.</p>
          ) : (
            <div className="space-y-2">
              <label htmlFor={rangeId} className="block">Storage budget: <span className="tabular-nums">{strategy.allocatedGb} GiB</span></label>
              <div className="flex items-center gap-3">
                <button type="button" aria-label="Decrease storage budget" className={controlClass} disabled={!editable || strategy.allocatedGb <= 0} onClick={() => update({ allocatedGb: Math.max(0, Math.floor(strategy.allocatedGb) - 1) })}>−</button>
                <input id={rangeId} type="range" aria-label="Storage budget in GiB" min={0} max={maxGb} step={1} value={Math.min(maxGb, strategy.allocatedGb)} disabled={!editable || maxGb === 0} className="min-h-12 min-w-0 flex-1 accent-current" onChange={(event) => update({ allocatedGb: Math.max(0, Math.min(maxGb, Number(event.target.value))) })} />
                <button type="button" aria-label="Increase storage budget" className={controlClass} disabled={!editable || strategy.allocatedGb >= maxGb} onClick={() => update({ allocatedGb: Math.min(maxGb, Math.floor(strategy.allocatedGb) + 1) })}>+</button>
              </div>
              <p className="text-xs text-white/45">0–{maxGb} GiB, after protected free space. Existing usage and reservations must fit.</p>
            </div>
          )}
          <label className="block space-y-2">
            <span>Playback preference</span>
            <select className={`${controlClass} block w-full bg-zinc-950`} disabled={!editable} value={strategy.mode} onChange={(event) => update({ mode: event.target.value as StorageStrategy["mode"] })}>
              <option value="smart_hybrid">Balanced</option>
              <option value="cloud_stream">Prefer streaming</option>
              <option value="offline_download">Prefer local playback</option>
            </select>
          </label>
          <p className="text-white/55">{snapshot.preparation.reason} Saving these preferences does not prepare or download any media.</p>
          {!snapshot.canEdit ? <p className="text-white/55">Only the home owner can change these settings.</p> : null}
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" className={`${controlClass} bg-white/10`} disabled={!editable || !dirty} onClick={() => void controllerRef.current?.save({ mode: strategy.mode, storageAllocation: strategy.storageAllocation, allocatedGb: strategy.allocatedGb })}>Save storage settings</button>
            <span role="status" className="text-xs text-white/55">{dirty ? "Unsaved changes" : state.saved ? "Storage settings saved" : ""}</span>
          </div>
        </>
      ) : null}
    </div>
  );
}
