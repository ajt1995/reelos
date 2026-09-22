import path from "node:path";

const governors = new Map();
let playbackActive = false;

function scopeKey(scope) {
  if (typeof scope !== "string" || !scope.trim()) throw new TypeError("A resource-governor scope is required.");
  return path.resolve(scope);
}
function verifyGovernor(governor) {
  if (!governor || typeof governor.admit !== "function"
    || typeof governor.updateForegroundState !== "function") {
    throw new TypeError("A compatible resource governor is required.");
  }
}

/**
 * Registers the process-local governor for one ReelOS state directory. The
 * directory key prevents tests and multiple household roots from sharing
 * budgets accidentally.
 */
export function registerResourceGovernor(scope, governor) {
  const key = scopeKey(scope);
  verifyGovernor(governor);
  const previous = governors.get(key);
  if (previous && previous !== governor) {
    throw new Error(`A different resource governor already owns ${key}.`);
  }
  governors.set(key, governor);
  governor.updateForegroundState({ playbackActive });
  let active = true;
  return () => {
    if (!active) return false;
    active = false;
    if (governors.get(key) === governor) governors.delete(key);
    return true;
  };
}

export function coordinatedGovernor(scope, explicitGovernor = null) {
  if (explicitGovernor) {
    verifyGovernor(explicitGovernor);
    return explicitGovernor;
  }
  return governors.get(scopeKey(scope)) || null;
}

/** Playback presence is process-wide because every stream must protect every
 * optional worker, including workers belonging to another mounted state root. */
export function signalResourcePlaybackPressure(active) {
  if (typeof active !== "boolean") throw new TypeError("Playback pressure must be boolean.");
  if (active === playbackActive) return;
  playbackActive = active;
  for (const governor of new Set(governors.values())) {
    governor.updateForegroundState({ playbackActive: active });
  }
}

export function admitCoordinatedWorkload(scope, request, explicitGovernor = null) {
  const governor = coordinatedGovernor(scope, explicitGovernor);
  if (!governor) return { ok: true, coordinated: false, lease: null };
  const result = governor.admit(request);
  return result.ok ? { ...result, coordinated: true } : { ...result, coordinated: true };
}

export function resourceCoordinationStatus() {
  return Object.freeze({ playbackActive, registeredScopes: governors.size });
}
