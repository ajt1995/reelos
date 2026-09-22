import fs from "node:fs";
import path from "node:path";
import { gatherApplianceDiagnostics } from "./diagnostics-heartbeat-service.mjs";

const DEFAULT_STATE_DIR = process.env.REELOS_STATE || "/var/lib/reelos";

/**
 * Valid feedback categories
 */
export const FEEDBACK_CATEGORIES = ["idea", "feature", "bug", "praise", "other"];

/**
 * Records a user feedback entry.
 */
export function submitFeedback({
  category = "idea",
  message = "",
  contact = "",
  includeDiagnostics = true,
  stateDir = DEFAULT_STATE_DIR,
} = {}) {
  const cleanMsg = String(message || "").trim();
  if (!cleanMsg) {
    return { ok: false, error: "Message cannot be empty" };
  }

  const cleanCategory = FEEDBACK_CATEGORIES.includes(String(category).toLowerCase())
    ? String(category).toLowerCase()
    : "idea";

  const feedbackFile = path.join(stateDir, "feedback.json");
  let existing = [];
  try {
    if (fs.existsSync(feedbackFile)) {
      existing = JSON.parse(fs.readFileSync(feedbackFile, "utf8")) || [];
    }
  } catch {}

  const entry = {
    id: `fb-${Date.now().toString(36)}`,
    category: cleanCategory,
    message: cleanMsg,
    contact: String(contact || "").trim() || null,
    submittedAt: Date.now(),
    diagnostics: includeDiagnostics ? gatherApplianceDiagnostics({ stateDir }) : null,
  };

  existing.unshift(entry);
  // Cap stored feedback at 100 entries
  const capped = existing.slice(0, 100);
  try {
    fs.writeFileSync(feedbackFile, JSON.stringify(capped, null, 2) + "\n", "utf8");
  } catch (err) {
    return { ok: false, error: err.message };
  }

  return { ok: true, id: entry.id, submittedAt: entry.submittedAt };
}

/**
 * Lists feedback entries recorded on this machine.
 */
export function listFeedback(stateDir = DEFAULT_STATE_DIR) {
  const feedbackFile = path.join(stateDir, "feedback.json");
  try {
    if (fs.existsSync(feedbackFile)) {
      return JSON.parse(fs.readFileSync(feedbackFile, "utf8")) || [];
    }
  } catch {}
  return [];
}

/**
 * HTTP handler for /api/feedback/*
 */
export async function handleFeedbackRoute(req, res, parsedUrl, readBodyFn, stateDir = DEFAULT_STATE_DIR) {
  const method = (req.method || "GET").toUpperCase();
  const pathname = parsedUrl.pathname;

  if (pathname === "/api/feedback/submit" && method === "POST") {
    try {
      const body = await readBodyFn(req);
      const data = typeof body === "string" ? JSON.parse(body || "{}") : body || {};
      const result = submitFeedback({
        category: data.category,
        message: data.message,
        contact: data.contact,
        includeDiagnostics: data.includeDiagnostics !== false,
        stateDir,
      });
      res.writeHead(result.ok ? 200 : 400, { "Content-Type": "application/json" });
      return res.end(JSON.stringify(result));
    } catch (err) {
      res.writeHead(400, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ ok: false, error: err.message }));
    }
  }

  if (pathname === "/api/feedback/list" && method === "GET") {
    const list = listFeedback(stateDir);
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ ok: true, feedback: list }));
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ ok: false, error: "Not found" }));
}
