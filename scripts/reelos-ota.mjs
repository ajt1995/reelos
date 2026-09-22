// Compatibility entry point. All update authority lives in the signed contract.
export { applySignedUpdate as deployRelease, createServiceController, extractArchive, probeReleaseHealth, verifyArtifact } from "./signed-update.mjs";
export { bootstrapReleaseTrust, verifyReleaseManifest } from "./release-trust.mjs";
