import {
  curatorPublic,
  readCurator,
  resetCurator,
  voteCuratorTitle,
  updateCuratorTaste,
} from "../reelos-curator.mjs";

/**
 * Curator Service
 * Manages user taste preferences (likes, dislikes, hidden titles) for Discover recommendations.
 */

export function getCuratorPublicState(stateDir = process.env.REELOS_STATE) {
  return curatorPublic(readCurator(stateDir));
}

export function recordVote({ id, ids, jellyfinId, title, vote }, stateDir = process.env.REELOS_STATE) {
  const cleanId = String(id || "").trim();
  if (!cleanId) {
    return { ok: false, error: "Need a title id", status: 400 };
  }
  const voteKind = String(vote || "dislike").toLowerCase();
  const next = voteCuratorTitle(
    {
      id: cleanId,
      ids: Array.isArray(ids) ? ids : [],
      jellyfinId,
      title,
    },
    voteKind,
    stateDir,
  );
  return {
    ok: next.ok !== false,
    status: next.ok !== false ? 200 : 400,
    data: curatorPublic(next),
  };
}

export function resetPreferences(stateDir = process.env.REELOS_STATE) {
  const next = resetCurator(stateDir);
  return {
    ok: true,
    status: 200,
    data: curatorPublic(next),
  };
}

export async function processCuratorRequest(req, readBodyFn, stateDir = process.env.REELOS_STATE) {
  const method = (req.method || "GET").toUpperCase();
  if (method === "GET") {
    return { status: 200, payload: getCuratorPublicState(stateDir) };
  }
  if (method !== "POST") {
    return { status: 405, payload: { ok: false, error: "Method not allowed" } };
  }
  const body = typeof readBodyFn === "function" ? await readBodyFn(req) : req.body || {};
  const id = String(body?.id || body?.titleId || "").trim();
  if (!id) {
    return { status: 400, payload: { ok: false, error: "Need a title id" } };
  }
  const result = recordVote(
    {
      id,
      ids: body?.ids,
      jellyfinId: body?.jellyfinId,
      title: body?.title,
      vote: body?.vote || body?.taste,
    },
    stateDir,
  );
  return { status: result.status, payload: result.data };
}

export async function processCuratorResetRequest(req, stateDir = process.env.REELOS_STATE) {
  const method = (req.method || "GET").toUpperCase();
  if (method !== "POST") {
    return { status: 405, payload: { ok: false, error: "POST only" } };
  }
  const result = resetPreferences(stateDir);
  return { status: result.status, payload: result.data };
}

export function saveCuratorTaste({ profileId, tasteVibe, curationWeights, mediaPriorities } = {}, stateDir = process.env.REELOS_STATE) {
  const result = updateCuratorTaste({ profileId, tasteVibe, curationWeights, mediaPriorities }, stateDir);
  return {
    ok: result.ok !== false,
    status: 200,
    data: curatorPublic(result),
  };
}

export async function processCuratorTasteRequest(req, readBodyFn, stateDir = process.env.REELOS_STATE) {
  const method = (req.method || "GET").toUpperCase();
  if (method === "GET") {
    return { status: 200, payload: getCuratorPublicState(stateDir) };
  }
  if (method !== "POST") {
    return { status: 405, payload: { ok: false, error: "Method not allowed" } };
  }
  const body = typeof readBodyFn === "function" ? await readBodyFn(req) : req.body || {};
  const result = saveCuratorTaste(
    {
      profileId: body?.profileId || body?.residentId,
      tasteVibe: body?.tasteVibe,
      curationWeights: body?.curationWeights,
      mediaPriorities: body?.mediaPriorities,
    },
    stateDir,
  );
  return { status: result.status, payload: result.data };
}
