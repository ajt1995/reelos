/**
 * One source-of-truth for whether ReelOS may contact a debrid provider.
 *
 * A stored key is deliberately insufficient. The owner must explicitly enable
 * the provider and ReelOS must have recorded a successful validation.
 */

export const DEFAULT_DEBRID_PROVIDER = "torbox";
export const SUPPORTED_DEBRID_PROVIDERS = new Set(["torbox", "real-debrid"]);

export function sourcePolicyFromState({
  answers = {},
  uiSettings = {},
  env = {},
} = {}) {
  const connection = uiSettings?.debridConnection || {};
  const enabled =
    connection.enabled === true || uiSettings?.debridEnabled === true;
  const provider = String(
    connection.provider ||
      uiSettings?.debridProvider ||
      answers?.source ||
      DEFAULT_DEBRID_PROVIDER,
  ).toLowerCase();
  const status = String(
    connection.status || uiSettings?.debridStatus || "disabled",
  ).toLowerCase();
  const envKey =
    provider === "real-debrid"
      ? env?.REAL_DEBRID_API_KEY || env?.RD_API_KEY
      : env?.TORBOX_API_KEY;
  const apiKey = String(envKey || answers?.apiKey || "").trim();
  const supported = SUPPORTED_DEBRID_PROVIDERS.has(provider);
  const connected =
    enabled && supported && status === "connected" && apiKey.length > 0;

  return {
    mode: connected ? "debrid" : "public-personal",
    enabled,
    provider,
    status,
    supported,
    connected,
    apiKey,
  };
}

export function canDispatchProviderRequest(policy) {
  return policy?.connected === true;
}

export function canUseProviderStream(policy) {
  return policy?.connected === true;
}

export function publicSourcePolicy(policy = {}) {
  return {
    mode: policy.mode === "debrid" ? "debrid" : "public-personal",
    enabled: policy.enabled === true,
    provider: policy.provider || DEFAULT_DEBRID_PROVIDER,
    status: policy.status || "disabled",
    connected: policy.connected === true,
  };
}

export function providerUnavailablePayload() {
  return {
    ok: false,
    code: "SOURCE_UNAVAILABLE",
    error:
      "Connect and validate a debrid provider before requesting this title.",
  };
}

export function libraryItemSourceKind(item = {}) {
  const declared = String(
    item.sourceKind || item.source?.kind || "",
  ).toLowerCase();
  if (declared === "provider_stream") return "debrid";
  if (declared === "prepared_rendition") return "retained_local";
  if (
    [
      "public_domain",
      "public_catalog",
      "personal_import",
      "retained_local",
      "debrid",
    ].includes(declared)
  ) {
    return declared;
  }
  const path = String(item.path || item.Path || "")
    .replace(/\\/g, "/")
    .toLowerCase();
  if (!path) return "unknown";
  if (
    path.includes("/mnt/debrid/") ||
    path.includes("/mnt/symlinks/") ||
    path.includes("/symlinks/")
  ) {
    return "debrid";
  }
  if (path.includes("public-domain") || path.includes("sample-library"))
    return "public_domain";
  return "personal_import";
}

export function libraryItemIsAccessible(item, policy) {
  const kind = libraryItemSourceKind(item);
  if (kind === "debrid") return policy?.connected === true;
  return (
    kind === "public_domain" ||
    kind === "personal_import" ||
    kind === "retained_local"
  );
}

export function filterAccessibleLibraryItems(items = [], policy = {}) {
  return (items || []).filter((item) => libraryItemIsAccessible(item, policy));
}
