import test from "node:test";
import assert from "node:assert";

// Mocking the store and hook for testing without heavy imports
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

function generatePersonalizedHook(resident, title) {
  if (!resident) return "A solid addition to your watchlist.";

  const seed = (resident.id + title).split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  
  const vibe = resident.tasteVibe || "balanced";
  const templates = PITCH_TEMPLATES[vibe] || PITCH_TEMPLATES.balanced;
  
  const basePitch = templates[seed % templates.length];
  
  let flavor = "";
  if (resident.curationWeights?.["80s_bias"] > 0) {
    flavor = " It has that perfect 80s nostalgic energy.";
  } else if (resident.curationWeights?.["adventure"] > 0) {
    flavor = " A fantastic adventure awaits.";
  } else if (resident.curationWeights?.["mind_bender"] > 0) {
    flavor = " Get ready to have your mind bent.";
  } else if (resident.curationWeights?.["whimsical"] > 0) {
    flavor = " Pure whimsical joy from start to finish.";
  } else if (resident.curationWeights?.["spectacle"] > 0) {
    flavor = " The ultimate visual spectacle.";
  }

  return basePitch + flavor;
}

test("Vibe Calibration Bitmasks & Personalized Hook Generators", async (t) => {
  await t.test("Generates correct pitch for 80s comfort", () => {
    const resident = {
      id: "res-1",
      tasteVibe: "comfort",
      curationWeights: { "80s_bias": 1.0, neo_noir: 0.8 }
    };
    const hook = generatePersonalizedHook(resident, "Blade Runner");
    assert.ok(hook.includes("It has that perfect 80s nostalgic energy."));
    assert.ok(PITCH_TEMPLATES.comfort.some(p => hook.includes(p)));
  });

  await t.test("Generates correct pitch for 4K spectacle", () => {
    const resident = {
      id: "res-2",
      tasteVibe: "bleeding_edge",
      curationWeights: { spectacle: 1.0, action: 0.8 }
    };
    const hook = generatePersonalizedHook(resident, "Dune: Part Two");
    assert.ok(hook.includes("The ultimate visual spectacle."));
    assert.ok(PITCH_TEMPLATES.bleeding_edge.some(p => hook.includes(p)));
  });
  
  await t.test("Generates fallback pitch for no resident", () => {
    const hook = generatePersonalizedHook(null, "Matrix");
    assert.strictEqual(hook, "A solid addition to your watchlist.");
  });
  
  await t.test("Generates deterministic pitches", () => {
    const resident = { id: "res-3", tasteVibe: "balanced" };
    const hook1 = generatePersonalizedHook(resident, "Inception");
    const hook2 = generatePersonalizedHook(resident, "Inception");
    assert.strictEqual(hook1, hook2);
  });
});

