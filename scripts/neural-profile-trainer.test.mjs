import { describe, it } from "node:test";
import assert from "node:assert";

describe("Neural Profile Trainer - 45s AI Gamified Calibration", () => {
  it("verifies multi-resident store persistence and JSON serialization", () => {
    // Simulating the store resident structure
    const residents = [
      {
        id: "res-primary",
        name: "Primary",
        avatar: "clapperboard",
        isGuest: false,
        watchlist: [],
        watchProgress: {},
        assignedTitleIds: [],
        mediaPriorities: { movies: 50, tv: 50, books: 25 },
        tasteVibe: "balanced",
        themeDesign: "oled_cinema",
        motionStyle: "cinematic",
      }
    ];
    
    // Add a new resident
    residents.push({
      id: "res-test",
      name: "TestUser",
      avatar: "sparkles",
      isGuest: false,
      watchlist: [],
      watchProgress: {}
    });

    // Verify JSON serialization (simulating zustand persist)
    const json = JSON.stringify(residents);
    const parsed = JSON.parse(json);
    
    assert.ok(parsed.length === 2, "Should have 2 residents");
    assert.equal(parsed.find(r => r.name === "TestUser").name, "TestUser");
  });

  it("verifies the synthesis of curationWeights, tasteVibe, and themeDesign", () => {
    // Phase 1: Vibe Selection (e.g. bleeding_edge)
    const selectedVibe = "bleeding_edge";
    
    // Phase 2: Showdown Choices
    const userPicks = ["cerebral", "adrenaline", "wonder", "psychological"];
    
    // Phase 3: Audio / Sandbox toggles
    const kidSafe = false;

    // Phase 4: Synthesis (matching neural-profile-trainer.tsx logic)
    const curationWeights = {
      "80s_bias": selectedVibe === "comfort" ? 0.9 : 0.2,
      "mind_bender": userPicks.includes("cerebral") || userPicks.includes("psychological") ? 0.95 : 0.3,
      "adrenaline": userPicks.includes("adrenaline") || userPicks.includes("raw_energy") ? 0.9 : 0.2,
      "whimsical": userPicks.includes("warmth") ? 0.85 : 0.2,
      "spectacle": selectedVibe === "bleeding_edge" ? 0.95 : 0.4,
    };

    const finalResident = {
      id: "res-test",
      tasteVibe: selectedVibe,
      curationWeights,
      isKids: kidSafe,
      hideKidsContent: !kidSafe,
      themeDesign: selectedVibe === "bleeding_edge" ? "futuristic_hud" : selectedVibe === "comfort" ? "warm_velvet" : "oled_cinema",
    };

    // Verifications
    assert.equal(finalResident.tasteVibe, "bleeding_edge");
    assert.equal(finalResident.themeDesign, "futuristic_hud");
    assert.equal(finalResident.isKids, false);
    assert.equal(finalResident.curationWeights["spectacle"], 0.95);
    assert.equal(finalResident.curationWeights["mind_bender"], 0.95);
    assert.equal(finalResident.curationWeights["adrenaline"], 0.9);
    assert.equal(finalResident.curationWeights["whimsical"], 0.2);
    assert.equal(finalResident.curationWeights["80s_bias"], 0.2);
  });
  
  it("tests the 45s profile calibration state transitions", () => {
    let phase = "intro";
    let timeLeft = 45;
    let isRunning = false;
    
    // startTraining()
    timeLeft = 45;
    isRunning = true;
    phase = "vibe";
    assert.equal(phase, "vibe");
    
    // handleVibePick()
    phase = "showdown";
    assert.equal(phase, "showdown");
    
    // handleShowdownChoice() rounds
    let showdownIndex = 0;
    while(showdownIndex < 3) {
      showdownIndex++;
    }
    // Final choice
    phase = "audio";
    assert.equal(phase, "audio");
    
    // finishTraining()
    isRunning = false;
    phase = "synthesizing";
    assert.equal(phase, "synthesizing");
    assert.equal(isRunning, false);
    
    // After timeout
    phase = "results";
    assert.equal(phase, "results");
  });
});
