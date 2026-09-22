import crypto from "node:crypto";

/**
 * Criterion-Grade Editorial Knowledge Base:
 * Genuine, authentic filmographic, thematic, aesthetic, and sound design DNA.
 * Eliminates canned static repetitions and randomized Mad-Libs strings.
 */
export const CRITERION_EDITORIAL_KB = {
  auteur: {
    "Christopher Nolan":
      "Practical 70mm IMAX scale, non-linear temporality, in-camera stunt work, and Ludwig Göransson/Hans Zimmer wall-of-sound orchestration.",
    "Denis Villeneuve":
      "Brutalist architectural scale, meditative tension, existential dread, and Roger Deakins/Greig Fraser visual geometry.",
    "David Fincher":
      "Clinical procedural precision, low-key low-contrast shadows, obsessive digital perfectionism, and Trent Reznor soundscapes.",
    "Hayao Miyazaki":
      'Hand-drawn pastoral wonder, quiet contemplative "ma" space, ecological animism, and Joe Hisaishi melodic grandeur.',
    "Wes Anderson":
      "Rigorous visual symmetry, pastel color palettes, meticulous diorama framing, and dry deadpan melancholia.",
    "Quentin Tarantino":
      "Hyper-kinetic dialogue, pop-culture pastiche, nonlinear chapter structures, and razor-sharp tension-and-release crescendos.",
    "Bong Joon-ho":
      "Sharp genre-bending social satire, architectural class division, sudden tonal pivots, and meticulous blocking.",
    "Greta Gerwig":
      "Vibrant emotional cadence, literary modernism, kinetic ensemble intimacy, and warm visual lyricism.",
    "Stanley Kubrick":
      "Chilling philosophical detachment, one-point perspective, cold geometric elegance, and existential cosmic dread.",
    "Ridley Scott":
      "Atmospheric worldbuilding, lived-in futuristic grime, layered practical smoke, and sweeping historical grandeur.",
    "Guillermo del Toro":
      "Dark fairy-tale gothic romanticism, grotesque tactile creature effects, and clockwork clockmaker intimacy.",
    "Martin Scorsese":
      "Kinetic tracking shots, Catholic guilt, moral compromise, rapid-fire editing rhythms, and classic rock vitality.",
    "David Lynch":
      "Subconscious surrealist dread, industrial hum atmospheres, 1950s Americana subversion, and dream logic.",
    "Paul Thomas Anderson":
      "Rich panoramic character tapestries, long bravura tracking shots, volatile emotional eruptions, and Jonny Greenwood orchestral tension.",
    "Wong Kar-wai":
      "Step-printed neon melancholia, unrequited romantic longing, hypnotic slow-motion, and lush Christopher Doyle cinematography.",
    "Jonathan Glazer":
      "Austere formalist dread, detached forensic observation, terrifying sonic design, and chilling moral alienation.",
    "Park Chan-wook":
      "Baroque visual elegance, black comedic irony, operatic violence, and intricate puzzle-box narrative architecture.",
    "Céline Sciamma":
      "Intimate female gaze, silent unspoken desire, luminous natural lighting, and profound emotional restraint.",
    "Akira Kurosawa":
      "Weather-driven kineticism (rain, wind, mud), dynamic axial cuts, multi-camera staging, and towering moral humanism.",
    "Coen Brothers":
      "Fatalistic Midwestern dark comedy, razor-sharp eccentric dialogue, Carter Burwell melancholic scores, and Roger Deakins visual clarity.",
  },
  performer: {
    "Viola Davis":
      "Commanding emotional precision, formidable presence, and performances that make private conflict feel physically immediate.",
    "Oscar Isaac":
      "Restless intelligence, bruised charisma, and an ability to move between intimate character study and immense genre worlds.",
    "Michelle Yeoh":
      "Elegant physical storytelling, dry wit, and deeply grounded feeling across action, comedy, and family drama.",
    "Mahershala Ali":
      "Quiet authority, careful interiority, and a magnetic restraint that rewards close attention.",
    "Florence Pugh":
      "Volatile honesty, sharp comic timing, and emotionally fearless performances that can turn on a breath.",
    "Steven Yeun":
      "Warmth edged with unpredictability, subtle social observation, and unusually expressive stillness.",
    "Tilda Swinton":
      "Transformative physicality, otherworldly calm, and a fearless appetite for strange cinematic worlds.",
    "Lakeith Stanfield":
      "Dreamlike presence, sly humor, and a gift for making surreal situations feel emotionally credible.",
  },
  landmark: {
    Dune: "Frank Herbert’s brutalist desert opera translated into colossal scale, geopolitical spice intrigue, and microtonal vocal chants.",
    "The Bear":
      "High-velocity culinary kineticism, panic-attack pacing, claustrophobic kitchen heat, and raw familial trauma.",
    Succession:
      "Acidic corporate dynasty warfare, handheld documentary zoom framing, and Nicholas Britell’s tragicomic piano ostinatos.",
    "Blade Runner":
      "The definitive neo-noir cyberpunk aesthetic, neon haze through Venetian blinds, and Vangelis synth melancholy.",
    Severance:
      "Luminescent corporate absurdity, clinical fluorescent claustrophobia, and recursive psychological mystery.",
    Interstellar:
      "Relativistic gravitational heartbreak, pipe organ crescendos, and Kip Thorne black hole physics rendered in 70mm.",
    "Spirited Away":
      "Mythic bathhouse surrealism, spiritual displacement, and breathtaking hand-drawn watercolor stillness.",
    Chernobyl:
      "Suffocating procedural realism, acoustic dosimeter dread, institutional decay, and Hildur Guðnadóttir industrial resonance.",
    "Everything Everywhere All at Once":
      "Absurdist multiverse maximalism, kinetic Hong Kong martial arts choreography, and profound existential tenderness.",
    Zodiac:
      "Obsessive procedural dead ends, faded 1970s yellow legal pad atmosphere, and David Shire’s haunting solo trumpet.",
    Oppenheimer:
      "Feverish theoretical physics, claustrophobic boardroom trials, blinding atomic flash, and mounting psychological dread.",
    Parasite:
      "Meticulous vertical architecture, ascending and descending class motifs, and an explosive tragicomic climax.",
  },
  vibe: {
    "Sci-Fi Worldbuilding":
      "Deep orbital solitude, massive practical planetary scale, speculative technology, and existential cosmic stakes.",
    "A24 Midnight":
      "Slow-burn psychological dread, unvarnished 16mm grain, folkloric occult tension, and uncompromised arthouse vision.",
    "35mm Warmth":
      "Golden hour photochemical emulsion, natural lens flare, tactile acoustic intimacy, and nostalgic human romance.",
    "Slow-Burn Noir":
      "Rain-slicked asphalt reflections, moral ambiguity, cigarette smoke silhouettes, and cynical jazz trumpet motifs.",
    "Cozy Whimsy":
      "Warm pastoral tea-room comfort, storybook diorama charm, gentle eccentricities, and soothing acoustic cadence.",
    "Boardroom Betrayals":
      "High-stakes institutional warfare, razor-sharp venomous dialogue, power dynamics, and corporate maneuvering.",
    "High-Stakes Tension":
      "Visceral ticking-clock velocity, breathless pacing, claustrophobic sensory assault, and uncompromising suspense.",
    "Neon Cyberpunk":
      "High-tech low-life urban sprawl, holographic rain reflections, synthwave basslines, and transhuman existentialism.",
    "Existential Drift":
      "Quiet atmospheric contemplation, lingering landscapes, melancholic ambient drones, and philosophical yearning.",
    "Dinner Watch Comfort":
      "Effortless episodic charm, engaging dialogue, low cognitive load, and warm reliable character dynamics.",
  },
  cinematography: {
    "Roger Deakins":
      "Masterful practical source lighting, clean geometric frames, subtle digital color grading, and visual lucidity.",
    "Greig Fraser":
      "Rich shadow gradients, brutalist tactile scale, muted earth tones, and cutting-edge volume stage / anamorphic blending.",
    "Hoyte van Hoytema":
      "Monolithic 70mm IMAX intimacy, tactile photochemical texture, natural sky rendering, and immersive focal lengths.",
    "Emmanuel Lubezki":
      "Bravura fluid continuous tracking shots, golden-hour natural illumination, wide-angle distortion, and visceral immediacy.",
    "Robert Richardson":
      "Blinding overhead practical top-lighting, intense halogen highlights, rich grain saturation, and dynamic camera swoops.",
    "Bradford Young":
      "Sublime underexposed shadows, rich skin tones in low light, soulful amber halation, and quiet visual poetry.",
  },
  soundscape: {
    "Ludwig Göransson":
      "Massive walls of distorted orchestral brass, microtonal modular synths, aggressive low-end resonance, and ticking tension.",
    "Trent Reznor & Atticus Ross":
      "Distorted industrial tape loops, icy melancholic acoustic piano, atmospheric sub-bass rumbles, and haunting isolation.",
    "Hans Zimmer":
      "Towering pipe organ crescendos, relentless shepherd tone accelerations, massive percussive ostinatos, and cosmic grandeur.",
    "Jonny Greenwood":
      "Atonal string glissandos, nervous avant-garde chamber textures, unpredictable rhythmic spikes, and psychological friction.",
    "Ennio Morricone":
      "Iconic whistle and jaw harp motifs, sweeping operatic string crescendos, tragic trumpet solos, and mythic grandeur.",
  },
};

function seededRandom(seedStr) {
  let h = 0x811c9dc5;
  for (let i = 0; i < seedStr.length; i++) {
    h ^= seedStr.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  return () => {
    h = (h * 1664525 + 1013904223) >>> 0;
    return h / 4294967296;
  };
}

function shuffled(values, rnd) {
  const copy = [...values];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function stableBubbleId(category, title) {
  return crypto
    .createHash("sha256")
    .update(`${category}:${title}`)
    .digest("hex")
    .slice(0, 16);
}

/**
 * Small, deterministic local feature projection used while the signed taste
 * model is validating. It is deliberately described as a feature vector, not
 * as a trained embedding. The shared intelligence runtime may replace it only
 * after the taste-ranking capability is promoted by a signed update.
 */
export function projectTasteFeatures(text, dimensions = 512) {
  const vector = new Float32Array(dimensions);
  const tokens = String(text || "").toLowerCase().match(/[a-z0-9]+/g) || [];
  for (const token of tokens) {
    const digest = crypto.createHash("sha256").update(token).digest();
    for (let offset = 0; offset < digest.length; offset += 4) {
      const index = digest.readUInt16BE(offset) % dimensions;
      vector[index] += (digest[offset + 2] & 1 ? 1 : -1) * (0.5 + digest[offset + 3] / 510);
    }
  }
  let norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1;
  return Array.from(vector, (value) => value / norm);
}

/**
 * Returns genuine Criterion-grade editorial blurb for an item.
 */
export function getEditorialBlurb(category, title) {
  if (
    CRITERION_EDITORIAL_KB[category] &&
    CRITERION_EDITORIAL_KB[category][title]
  ) {
    return CRITERION_EDITORIAL_KB[category][title];
  }
  // Generic fallback if unknown title
  return `Curated ${category} cinema experience exploring distinctive aesthetic and narrative motifs.`;
}

/**
 * Generates dynamic taste bubbles for resident onboarding and recalibration.
 */
export function generateTasteBubbles(residentTaste = []) {
  const rnd = seededRandom(residentTaste.join(",") || "default-seed");
  const candidates = [];

  const titles = shuffled(Object.keys(CRITERION_EDITORIAL_KB.landmark), rnd);
  const performers = shuffled(
    Object.keys(CRITERION_EDITORIAL_KB.performer),
    rnd,
  );
  const moods = shuffled(Object.keys(CRITERION_EDITORIAL_KB.vibe), rnd);

  const bubbleCount = 12;
  for (let i = 0; i < bubbleCount; i++) {
    let category, title;
    const catRoll = i % 3;
    if (catRoll === 0) {
      category = "title";
      title = titles[Math.floor(i / 3) % titles.length];
    } else if (catRoll === 1) {
      category = "person";
      title = performers[Math.floor(i / 3) % performers.length];
    } else {
      category = "mood";
      title = moods[Math.floor(i / 3) % moods.length];
    }

    const knowledgeCategory =
      category === "title"
        ? "landmark"
        : category === "person"
          ? "performer"
          : "vibe";
    const blurb = getEditorialBlurb(knowledgeCategory, title);

    const latentVector = projectTasteFeatures(`${title} ${blurb} ${category}`, 512);

    const categoryLabel =
      category === "title" ? "Title" : category === "person" ? "Actor" : "Mood";
    candidates.push({
      id: stableBubbleId(category, title),
      category,
      categoryLabel,
      title,
      tagline: blurb,
      blurb,
      latentVector,
    });
  }

  return candidates;
}

/**
 * Updates resident 512D taste vector centroid based on 4-way reaction.
 * Reactions:
 * - 'Loved' (+2.0x gravity)
 * - 'Liked' (+1.0x gravity)
 * - 'Comfy' (+0.5x gravity)
 * - 'Dismissed' (neutral; the person chose not to answer)
 * - 'LessLike' (-1.0x reversible repulsive force)
 */
export function reactToTasteBubble(
  bubble,
  reaction,
  residentTasteVector = new Array(512).fill(0),
) {
  const normalizedReaction = String(reaction || "").toLowerCase();
  if (normalizedReaction === "dismissed" || normalizedReaction === "dismiss") {
    return [...residentTasteVector];
  }

  let weight = 0;
  switch (normalizedReaction) {
    case "loved":
    case "love":
      weight = 2.0;
      break;
    case "liked":
    case "like":
      weight = 1.0;
      break;
    case "comfy":
    case "cozy":
      weight = 0.5;
      break;
    case "lesslike":
    case "less_like":
    case "less-like":
      weight = -1.0;
      break;
    default:
      return [...residentTasteVector];
  }

  const updatedVector = [...residentTasteVector];
  const bVec = bubble.latentVector || new Array(512).fill(0);

  for (let i = 0; i < 512; i++) {
    updatedVector[i] += (bVec[i] || 0) * weight;
  }

  // L2 Normalization
  let norm = 0;
  for (let i = 0; i < 512; i++) norm += updatedVector[i] * updatedVector[i];
  norm = Math.sqrt(norm) || 1.0;
  for (let i = 0; i < 512; i++) updatedVector[i] /= norm;

  return updatedVector;
}

/**
 * Handles HTTP dispatch for /api/cinema/taste-bubbles and /api/cinema/taste-bubbles/react
 */
export async function handleTasteBubblesRoute(req, res) {
  const url = new URL(req.url, "http://127.0.0.1");

  if (url.pathname === "/api/cinema/taste-bubbles" && req.method === "GET") {
    const tasteParam = url.searchParams.get("residentTaste");
    const residentTaste = tasteParam ? tasteParam.split(",") : [];
    const bubbles = generateTasteBubbles(residentTaste);

    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        ok: true,
        bubbles,
        intelligence: { mode: "local", stage: "fallback" },
      }),
    );
    return true;
  }

  if (
    url.pathname === "/api/cinema/taste-bubbles/react" &&
    req.method === "POST"
  ) {
    let body = "";
    for await (const chunk of req) body += chunk;
    let data = {};
    try {
      data = JSON.parse(body || "{}");
    } catch {}

    const bubble = data.bubble;
    const reaction = data.reaction;
    const residentTasteVector =
      data.residentTasteVector || new Array(512).fill(0);

    const updatedVector = reactToTasteBubble(
      bubble,
      reaction,
      residentTasteVector,
    );

    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ ok: true, updatedVector }));
    return true;
  }

  return false;
}
