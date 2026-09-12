import type { LibraryCatchupState, LibraryCatchupStatus } from "./types";

const SETTLED = new Set(["done", "idle", "stopped", "stop", "backoff"]);

/** Splash-lock Home only while catch-up is actually running and dumps still need import. */
export function catchupLocksHome(c?: Partial<LibraryCatchupState> | null): boolean {
  if (!c) return false;
  const status = String(c.status || "idle").toLowerCase();
  if (SETTLED.has(status)) return false;
  if (status !== "running") return false;
  return Boolean(c.needsImport);
}

/** Full-screen Updating ReelOS splash until the door is actually accepting browse/request. */
export function updateLocksUi(status?: string | null): boolean {
  return String(status || "").toLowerCase() === "applying";
}

export function honestCatchupMessage(c: Partial<LibraryCatchupState>, splashLock: boolean): string {
  const status = String(c.status || "idle").toLowerCase();
  const raw = String(c.message || "");
  const catching = /^library catching up/i.test(raw) || /backing off/i.test(raw);
  if (splashLock) return raw || "Library catching up";
  const skipped = Number(c.skipped || 0) || 0;
  const timeouts = Number(c.timeouts || 0) || 0;
  if (catching || !raw) {
    if (status === "done" || status === "stopped" || (status === "running" && !c.needsImport && skipped)) {
      if (skipped || timeouts) return `Library catch-up done — ${skipped} skipped, ${timeouts} timeouts`;
      return status === "done" || status === "stopped" ? "Library catch-up done" : "";
    }
    if (status === "idle" || status === "backoff") return "";
    return catching ? "" : raw;
  }
  return raw;
}

export function normalizeLibraryCatchup(lib: Partial<LibraryCatchupState> | Record<string, unknown> | null | undefined): LibraryCatchupState {
  const src = lib && typeof lib === "object" ? lib : {};
  let status = String((src as LibraryCatchupState).status || "idle") as LibraryCatchupStatus;
  if (status === "backoff") status = "idle";
  const needsImport = Boolean((src as LibraryCatchupState).needsImport);
  const skipped = Number((src as LibraryCatchupState).skipped || 0) || 0;
  const timeouts = Number((src as LibraryCatchupState).timeouts || 0) || 0;
  const folder = Number((src as LibraryCatchupState).folder || 0) || 0;
  const total = Number((src as LibraryCatchupState).total || 0) || 0;
  const splashLock = catchupLocksHome({ status, needsImport });
  const message = honestCatchupMessage({ status, message: String((src as LibraryCatchupState).message || ""), skipped, timeouts, needsImport }, splashLock);
  return { status, message, folder, total, skipped, timeouts, needsImport, splashLock };
}
