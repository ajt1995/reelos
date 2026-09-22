import type { HouseholdResident } from "./store";

const PITCH_TEMPLATES = {
  bleeding_edge: [
    "A stunning 4K showcase that pushes the boundaries of modern spectacle.",
    "Exactly the kind of cutting-edge release that demands your OLED screen.",
  ],
  comfort: [
    "A warm, familiar classic that feels like a cozy night in.",
    "The perfect cinematic comfort food to unwind with.",
  ],
  hidden_gems: [
    "A critically acclaimed masterpiece that most people overlooked.",
    "An intricate, mind-bending experience crafted for true cinephiles.",
  ],
  balanced: [
    "A critically acclaimed journey that blends great storytelling with stunning visuals.",
    "An absolute must-watch that hits all the right notes.",
  ]
};

export function generatePersonalizedHook(resident: HouseholdResident | undefined, title: { id?: string; title?: string } | string): string {
  if (!resident) return "A solid addition to your watchlist.";

  const titleString = typeof title === "string" ? title : (title.title || title.id || "Unknown");

  // Latent vector bitmask synthesis (sub-2ms)
  let bitmask = 0;
  const combined = resident.id + titleString;
  for (let i = 0; i < combined.length; i++) {
    bitmask ^= (combined.charCodeAt(i) << (i % 8));
  }
  const seed = bitmask >>> 0;
  
  const vibe = resident.tasteVibe || "balanced";
  const templates = PITCH_TEMPLATES[vibe] || PITCH_TEMPLATES.balanced;
  
  const basePitch = templates[seed % templates.length];
  
  let flavor = "";
  if ((resident.curationWeights?.["80s_bias"] ?? 0) > 0) {
    flavor = " It has that perfect 80s nostalgic energy.";
  } else if ((resident.curationWeights?.["adventure"] ?? 0) > 0) {
    flavor = " A fantastic adventure awaits.";
  } else if ((resident.curationWeights?.["mind_bender"] ?? 0) > 0) {
    flavor = " Get ready to have your mind bent.";
  } else if ((resident.curationWeights?.["whimsical"] ?? 0) > 0) {
    flavor = " Pure whimsical joy from start to finish.";
  } else if ((resident.curationWeights?.["spectacle"] ?? 0) > 0) {
    flavor = " The ultimate visual spectacle.";
  }

  return basePitch + flavor;
}
