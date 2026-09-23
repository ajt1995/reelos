import { i as __toESM } from "../_runtime.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { n as clsx, t as cva } from "../_libs/class-variance-authority+clsx.mjs";
import { t as twMerge } from "../_libs/tailwind-merge.mjs";
import { n as persist, r as create, t as createJSONStorage } from "../_libs/zustand.mjs";
import { S as require_jsx_runtime, _ as createRootRoute, d as useRouterState, g as createFileRoute, h as lazyRouteComponent, l as Scripts, m as Outlet, p as createRouter, u as HeadContent, x as useRouter, z as redirect } from "../_libs/@tanstack/react-router+[...].mjs";
import { L as RefreshCw, Pt as ChevronDown, h as TriangleAlert, jt as ChevronUp, ut as House } from "../_libs/lucide-react.mjs";
import { t as Slot } from "../_libs/radix-ui__react-slot.mjs";
import { a as union, i as string, n as number, r as object, t as literal } from "../_libs/zod.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/store-pSkcsYO9.js
var import_react = /* @__PURE__ */ __toESM(require_react());
function cn(...inputs) {
	return twMerge(clsx(inputs));
}
function formatWhen(ts) {
	const delta = Date.now() - ts;
	const min = Math.round(delta / 6e4);
	if (min < 1) return "Just now";
	if (min < 60) return `${min}m ago`;
	const hr = Math.round(min / 60);
	if (hr < 24) return `${hr}h ago`;
	return `${Math.round(hr / 24)}d ago`;
}
/** Titles the lab provider does not have cached — they transfer. */
var UNCACHED = /* @__PURE__ */ new Set([
	"copper-tide",
	"chamber-12",
	"after-floodlights",
	"station-line",
	"second-shift",
	"quiet-atlas",
	"salt-velvet",
	"hollow-broadcast"
]);
/** Live Seerr/Jellyfin ids are not lab catalog — no fake Cached glow. */
function isLiveEngineTitleId(id) {
	return /^(tmdb-|tvdb-|jf-)/.test(String(id || ""));
}
function titleInCache(title) {
	if (!title?.id || isLiveEngineTitleId(title.id)) return false;
	return !UNCACHED.has(title.id);
}
function adapterProfile(source, frontend) {
	if (source === "local-vpn") return {
		kind: "qbittorrent",
		name: "qBittorrent",
		fandom: "qBittorrent",
		port: "8085",
		mount: "/srv/media/downloads",
		account: "Gluetun killswitch on",
		api: "Native",
		blurb: "Local client on the VPN network. Engines send work here."
	};
	if (source === "torbox") return {
		kind: "torbox",
		name: "TorBox",
		fandom: "TorBox",
		port: "8085",
		mount: frontend === "plex" ? "/mnt/torbox (FUSE)" : "/mnt/torbox (STRM)",
		account: "Premium",
		api: "qBittorrent-compatible shim",
		blurb: "Official mount plus a shim so the engines can send work."
	};
	return {
		kind: "decypharr",
		name: "Decypharr",
		fandom: "Decypharr",
		port: "8085",
		mount: "/mnt/debrid",
		account: `Premium · ${source === "alldebrid" ? "AllDebrid" : source === "premiumize" ? "Premiumize" : "Real-Debrid"}`,
		api: "qBittorrent-compatible",
		blurb: "Maintained download-client API. Engines talk to this, not the provider."
	};
}
function syntheticRelease(title, floor) {
	const res = title.maxQuality === "4k" && floor !== "1080p" ? "2160p" : "1080p";
	return `${title.title.replace(/[^A-Za-z0-9]+/g, ".")}.${title.year}.${res}.WEB-DL.DDP5.1`;
}
var TITLES = [
	{
		id: "tmdb-movie-693134",
		kind: "movie",
		title: "Dune: Part Two",
		year: 2024,
		runtime: 166,
		rating: 8.6,
		genres: ["Sci-Fi", "Adventure"],
		overview: "Paul Atreides unites with Chani and the Fremen while seeking revenge against the conspirators who destroyed his family. Facing a choice between the love of his life and the fate of the universe, he endeavors to prevent a terrible future.",
		director: "Denis Villeneuve",
		poster: "https://image.tmdb.org/t/p/w500/1pdfLvkbY9ohJlCjQH2CZjjYVvJ.jpg",
		backdrop: "https://image.tmdb.org/t/p/original/xOMo8BRK7PfcJv9JCnx7s5200SV.jpg",
		maxQuality: "4k",
		popularity: 99
	},
	{
		id: "tmdb-movie-335984",
		kind: "movie",
		title: "Blade Runner 2049",
		year: 2017,
		runtime: 164,
		rating: 8,
		genres: ["Sci-Fi", "Mystery"],
		overview: "Thirty years after the events of the first film, a new blade runner, LAPD Officer K, unearths a long-buried secret that has the potential to plunge what's left of society into chaos.",
		director: "Denis Villeneuve",
		poster: "https://image.tmdb.org/t/p/w500/gajva2L0rPYkEWjzgFlBXCAVBE5.jpg",
		backdrop: "https://image.tmdb.org/t/p/original/ilRyASDvt7v6oR1c7O5zXdpB524.jpg",
		maxQuality: "4k",
		popularity: 94
	},
	{
		id: "tmdb-movie-872585",
		kind: "movie",
		title: "Oppenheimer",
		year: 2023,
		runtime: 180,
		rating: 8.1,
		genres: ["Drama", "History"],
		overview: "The story of J. Robert Oppenheimer's role in the development of the atomic bomb during World War II.",
		director: "Christopher Nolan",
		poster: "https://image.tmdb.org/t/p/w500/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg",
		backdrop: "https://image.tmdb.org/t/p/original/rLb2cwF3Pazuxaj0sRXQ037tGI1.jpg",
		maxQuality: "4k",
		popularity: 96
	},
	{
		id: "tmdb-movie-157336",
		kind: "movie",
		title: "Interstellar",
		year: 2014,
		runtime: 169,
		rating: 8.4,
		genres: [
			"Adventure",
			"Drama",
			"Sci-Fi"
		],
		overview: "The adventures of a group of explorers who make use of a newly discovered wormhole to surpass the limitations on human space travel and conquer the vast distances involved in an interstellar voyage.",
		director: "Christopher Nolan",
		poster: "https://image.tmdb.org/t/p/w500/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg",
		backdrop: "https://image.tmdb.org/t/p/original/rAiYTsqJiOEZg05z5U4jD8rU07E.jpg",
		maxQuality: "4k",
		popularity: 97
	},
	{
		id: "tmdb-movie-129",
		kind: "movie",
		title: "Spirited Away",
		year: 2001,
		runtime: 125,
		rating: 8.5,
		genres: [
			"Animation",
			"Family",
			"Fantasy"
		],
		overview: "A young girl, Chihiro, becomes trapped in a strange new world of spirits. When her parents undergo a mysterious transformation, she must call upon the courage she never knew she had to free her family.",
		director: "Hayao Miyazaki",
		poster: "https://image.tmdb.org/t/p/w500/39wmItIWsg5sZMyRUHLkWBcuVCM.jpg",
		backdrop: "https://image.tmdb.org/t/p/original/Ab8mkHmkYADjU7wQiOkia99GQI.jpg",
		maxQuality: "4k",
		popularity: 95
	},
	{
		id: "night-harbor",
		kind: "movie",
		title: "Night Harbor",
		year: 2024,
		runtime: 118,
		rating: 8.1,
		genres: ["Noir", "Thriller"],
		overview: "A harbor master in a closed industrial port finds a transponder that should not exist. The tide keeps returning the same crate. Someone on the water is keeping a schedule older than the town.",
		director: "A. Voss",
		poster: "/posters/night-harbor.jpg",
		maxQuality: "4k",
		popularity: 98
	},
	{
		id: "last-signal",
		kind: "movie",
		title: "The Last Signal",
		year: 2023,
		runtime: 132,
		rating: 7.9,
		genres: ["Sci-Fi", "Mystery"],
		overview: "An observatory tech decodes a burst that matches a message her late mentor filed and never sent. The dish keeps tracking a point in the sky that official charts leave blank.",
		director: "N. Okada",
		poster: "/posters/last-signal.jpg",
		maxQuality: "4k",
		popularity: 91
	},
	{
		id: "ember-season",
		kind: "movie",
		title: "Ember Season",
		year: 2025,
		runtime: 126,
		rating: 8.4,
		genres: ["Drama"],
		overview: "Two estranged siblings inherit a fire lookout for one autumn. The ridge burns on a schedule. What they owe each other is older than the forest.",
		director: "M. Ellison",
		poster: "/posters/ember-season.jpg",
		maxQuality: "4k",
		popularity: 95
	},
	{
		id: "glass-orchard",
		kind: "movie",
		title: "Glass Orchard",
		year: 2024,
		runtime: 109,
		rating: 7.6,
		genres: ["Mystery"],
		overview: "A botanist is hired to winterize a sealed greenhouse whose trees still fruit in the dark. Every morning a new pane is frosted from the inside.",
		director: "I. Pram",
		poster: "/posters/glass-orchard.jpg",
		maxQuality: "4k",
		popularity: 84
	},
	{
		id: "copper-tide",
		kind: "movie",
		title: "Copper Tide",
		year: 2022,
		runtime: 141,
		rating: 7.4,
		genres: ["Adventure"],
		overview: "A cartographer is paid to prove a coastal path does not exist. The cliffs keep offering one anyway, always at low tide, always one hour shorter.",
		director: "R. Dalca",
		poster: "/posters/copper-tide.jpg",
		maxQuality: "4k",
		popularity: 73
	},
	{
		id: "winter-circuit",
		kind: "movie",
		title: "Winter Circuit",
		year: 2025,
		runtime: 114,
		rating: 8,
		genres: ["Thriller"],
		overview: "A grid engineer traces a blackout to a substation that has been drawing power in a pattern only she recognizes. The snow is writing the same circuit twice.",
		director: "S. Kade",
		poster: "/posters/winter-circuit.jpg",
		maxQuality: "4k",
		popularity: 88
	},
	{
		id: "hollow-broadcast",
		kind: "movie",
		title: "Hollow Broadcast",
		year: 2023,
		runtime: 97,
		rating: 7.2,
		genres: ["Horror"],
		overview: "Overnight staff at a shuttered TV plant keep finding last night's show already in the archive — with one extra extra in the frame. The transmitters were unplugged in 1998.",
		director: "K. Mirov",
		poster: "/posters/hollow-broadcast.jpg",
		maxQuality: "1080p",
		popularity: 70
	},
	{
		id: "iron-parish",
		kind: "movie",
		title: "Iron Parish",
		year: 2021,
		runtime: 128,
		rating: 7.8,
		genres: ["Western"],
		overview: "A circuit preacher rides into a prairie town that has already buried him. The church is iron. The congregation is not entirely the living.",
		director: "J. Harrow",
		poster: "/posters/iron-parish.jpg",
		maxQuality: "4k",
		popularity: 76
	},
	{
		id: "paper-moons",
		kind: "movie",
		title: "Paper Moons",
		year: 2024,
		runtime: 104,
		rating: 7.5,
		genres: ["Romance"],
		overview: "Two restorers of festival lanterns share a workshop for one winter. Neither intends to stay. The canal freezes in a shape that looks like a map home.",
		director: "L. Chen",
		poster: "/posters/paper-moons.jpg",
		maxQuality: "4k",
		popularity: 80
	},
	{
		id: "drift-protocol",
		kind: "movie",
		title: "Drift Protocol",
		year: 2025,
		runtime: 148,
		rating: 8.3,
		genres: ["Sci-Fi"],
		overview: "A stationkeeper is ordered to abandon a corridor that still reports occupancy. The protocol says drift. The logs say someone is keeping the lights on.",
		director: "P. Rane",
		poster: "/posters/drift-protocol.jpg",
		maxQuality: "4k",
		popularity: 93
	},
	{
		id: "salt-velvet",
		kind: "movie",
		title: "Salt and Velvet",
		year: 2022,
		runtime: 121,
		rating: 7.7,
		genres: ["Period", "Drama"],
		overview: "A salon in 1924 begins serving a salt that cannot be sourced. Guests leave with other people's memories. The hostess keeps a ledger in a language she does not speak.",
		director: "C. Moreau",
		poster: "/posters/salt-velvet.jpg",
		maxQuality: "4k",
		popularity: 74
	},
	{
		id: "after-floodlights",
		kind: "movie",
		title: "After the Floodlights",
		year: 2024,
		runtime: 119,
		rating: 7.3,
		genres: ["Drama", "Sport"],
		overview: "A groundskeeper stays after the last home game of a club that will not exist in the morning. The grass keeps the shape of a play that never made the record.",
		director: "T. Brann",
		poster: "/posters/after-floodlights.jpg",
		maxQuality: "1080p",
		popularity: 68
	},
	{
		id: "red-line-harvest",
		kind: "movie",
		title: "Red Line Harvest",
		year: 2023,
		runtime: 135,
		rating: 8.2,
		genres: ["Crime"],
		overview: "A grain buyer notices the same freight car returning full after every empty run. The harvest is a cover. The red line is a schedule for men who are not farmers.",
		director: "D. Pell",
		poster: "/posters/red-line-harvest.jpg",
		maxQuality: "4k",
		popularity: 86
	},
	{
		id: "chamber-12",
		kind: "movie",
		title: "Chamber 12",
		year: 2025,
		runtime: 96,
		rating: 7.1,
		genres: ["Psychological"],
		overview: "An auditor is locked in for a standard overnight review. The file on the table is her own. Chamber 12 does not appear on the building plan.",
		director: "E. Sol",
		poster: "/posters/chamber-12.jpg",
		maxQuality: "1080p",
		popularity: 64
	},
	{
		id: "quiet-atlas",
		kind: "movie",
		title: "The Quiet Atlas",
		year: 2021,
		runtime: 111,
		rating: 8,
		genres: ["Drama"],
		overview: "A map conservator is asked to restore a coastline that has not existed since 1842. Each night the ink redraws a city she almost remembers.",
		director: "H. Ibarra",
		poster: "/posters/quiet-atlas.jpg",
		maxQuality: "4k",
		popularity: 72
	},
	{
		id: "static-kingdom",
		kind: "movie",
		title: "Static Kingdom",
		year: 2024,
		runtime: 139,
		rating: 7.9,
		genres: ["Dystopia"],
		overview: "In a palace that broadcasts weather instead of ruling, a junior clerk finds a frequency that still names the old streets. The snow is not weather.",
		director: "V. Kren",
		poster: "/posters/static-kingdom.jpg",
		maxQuality: "4k",
		popularity: 82
	},
	{
		id: "station-line",
		kind: "tv",
		title: "Station Line",
		year: 2024,
		seasons: 3,
		runtime: 48,
		rating: 8.2,
		genres: ["Procedural"],
		overview: "Night-shift transit police work a single subway line that keeps delivering the same missing person to different decades. The last train is never listed.",
		director: "G. Marlowe",
		poster: "/posters/station-line.jpg",
		maxQuality: "4k",
		popularity: 94
	},
	{
		id: "harbor-watch",
		kind: "tv",
		title: "Harbor Watch",
		year: 2023,
		seasons: 2,
		runtime: 52,
		rating: 7.8,
		genres: ["Mystery"],
		overview: "A lighthouse keeper and a marine insurer investigate wrecks that happen on nights with no weather. The lantern room has a second log.",
		director: "F. Quinn",
		poster: "/posters/harbor-watch.jpg",
		maxQuality: "4k",
		popularity: 81
	},
	{
		id: "second-shift",
		kind: "tv",
		title: "Second Shift",
		year: 2025,
		seasons: 1,
		runtime: 42,
		rating: 7.6,
		genres: ["Drama"],
		overview: "The 2 a.m. crew at a 24-hour diner serves a town that officially sleeps. Regulars pay in favors. The pie case is a filing system.",
		director: "A. Ruiz",
		poster: "/posters/second-shift.jpg",
		maxQuality: "1080p",
		popularity: 77
	},
	{
		id: "millwrights",
		kind: "tv",
		title: "The Millwrights",
		year: 2022,
		seasons: 4,
		runtime: 56,
		rating: 8.4,
		genres: ["Family", "Drama"],
		overview: "Three generations keep a brick mill running after the river company leaves. The machines remember a wage the books no longer show.",
		director: "B. Cole",
		poster: "/posters/millwrights.jpg",
		maxQuality: "4k",
		popularity: 85
	},
	{
		id: "deep-current",
		kind: "tv",
		title: "Deep Current",
		year: 2024,
		seasons: 2,
		runtime: 44,
		rating: 8,
		genres: ["Science"],
		overview: "A small submersible team maps a current that should not hold a shape. Each dive returns with a sample from a year they have not dived yet.",
		director: "N. Hale",
		poster: "/posters/deep-current.jpg",
		maxQuality: "4k",
		popularity: 79
	},
	{
		id: "orbital-kitchen",
		kind: "tv",
		title: "Orbital Kitchen",
		year: 2025,
		seasons: 1,
		runtime: 28,
		rating: 7.7,
		genres: ["Comedy", "Sci-Fi"],
		overview: "The galley of a tired waystation feeds crews who were never scheduled to dock. Recipes are classified. The citrus is contraband.",
		director: "Y. Park",
		poster: "/posters/orbital-kitchen.jpg",
		maxQuality: "4k",
		popularity: 75
	},
	{
		id: "circuit-sakura",
		kind: "anime",
		title: "Circuit Sakura",
		year: 2024,
		seasons: 2,
		runtime: 24,
		rating: 8.5,
		genres: ["Anime", "Sci-Fi"],
		overview: "A city that blooms in code every spring hires a student to prune one street. The petals are packets. Cutting the wrong branch unhooks a life.",
		director: "Studio Northline",
		poster: "/posters/circuit-sakura.jpg",
		maxQuality: "4k",
		popularity: 90
	},
	{
		id: "tidebound",
		kind: "anime",
		title: "Tidebound Academy",
		year: 2025,
		seasons: 1,
		runtime: 24,
		rating: 8.1,
		genres: ["Anime"],
		overview: "A seaside school teaches navigation by asking the tide to sit still. First-years who fail the exam wake up further out than they remember walking.",
		director: "Studio Northline",
		poster: "/posters/tidebound.jpg",
		maxQuality: "4k",
		popularity: 83
	},
	{
		id: "maple-pilot",
		kind: "kids",
		title: "Maple Pilot",
		year: 2023,
		runtime: 86,
		rating: 7.9,
		genres: ["Family", "Adventure"],
		overview: "A small yellow plane that only flies in autumn takes a shy navigator over a forest that rearranges itself each year. Home is a runway of leaves.",
		director: "R. Whit",
		poster: "/posters/maple-pilot.jpg",
		maxQuality: "4k",
		popularity: 71
	},
	{
		id: "cloud-workshop",
		kind: "kids",
		title: "Cloud Workshop",
		year: 2024,
		runtime: 78,
		rating: 7.8,
		genres: ["Family"],
		overview: "In a timber loft above the weather, two apprentices learn to patch holes in the sky. Saturday's cloud is always due back by Monday.",
		director: "S. Linden",
		poster: "/posters/cloud-workshop.jpg",
		maxQuality: "1080p",
		popularity: 66
	},
	{
		id: "north-room",
		kind: "music",
		title: "North Room",
		year: 2024,
		tracks: 11,
		runtime: 47,
		rating: 8,
		genres: ["Ambient"],
		overview: "A quiet record made in a north-facing room. Tape hiss, a window, and eleven pieces that sound like furniture remembering weather.",
		director: "Ada North",
		poster: "/posters/north-room.jpg",
		maxQuality: "4k",
		popularity: 60
	},
	{
		id: "lowland-radio",
		kind: "music",
		title: "Lowland Radio",
		year: 2023,
		tracks: 9,
		runtime: 41,
		rating: 7.6,
		genres: ["Folk"],
		overview: "Songs written between AM stations on a floodplain. The chorus is always a weather report for a county that dropped off the map.",
		director: "The Lowlands",
		poster: "/posters/lowland-radio.jpg",
		maxQuality: "1080p",
		popularity: 55
	}
];
var TITLE_BY_ID = Object.fromEntries(TITLES.map((t) => [t.id, t]));
var extra = {};
/** Engine lookup (TMDB via Seerr) lives here so title pages resolve after search. */
function rememberCatalogTitles(list) {
	if (!list || !list.length) return;
	for (const t of list) {
		extra[t.id] = t;
		for (const alias of t.ids || []) extra[String(alias)] = t;
	}
}
function getTitle(id) {
	if (TITLE_BY_ID[id]) return TITLE_BY_ID[id];
	if (extra[id]) return extra[id];
	return Object.values(extra).find((t) => (t.ids || []).includes(id));
}
function looksLikeHashTitle(name) {
	return /^[0-9a-f]{32,64}$/i.test(String(name || "").trim());
}
var INDEXER_HOST = /(?:uindex|torrenting|torrentcouch|eztvx?|1337x|bitsearch|rarbg|yts|tpb|limetorrents|nyaa)/i;
var TLD = "org|com|net|to|tv|cc|me|info|xyz";
function stripIndexerPrefix(raw) {
	let s = String(raw || "").trim();
	while (true) {
		const stripped = s.replace(/^\[+[^\]]+\]+\s*/, "").trim();
		if (stripped === s) break;
		s = stripped;
	}
	s = s.replace(/\s*\[+\s*[^\]]+\]+\s*$/g, "").trim();
	if (INDEXER_HOST.test(s)) s = s.replace(new RegExp(`^(?:www\\.)?[a-z0-9.-]+\\.(?:${TLD})\\s*[-–—:.]+\\s*`, "i"), "").trim();
	s = s.replace(/^www\.[a-z0-9.-]+\s*[-–—:]+\s*/i, "").trim();
	s = s.replace(new RegExp(`^www[\\s._-]+[a-z0-9]+[\\s._-]+(?:${TLD})\\b[\\s._:-]*`, "i"), "").trim();
	s = s.replace(new RegExp(`^(?:${TLD})\\s*[-–—:]+\\s+`, "i"), "").trim();
	s = s.replace(new RegExp(`^(?:${TLD})[-–—:]+(?=[A-Za-z0-9])`, "i"), "").trim();
	s = s.replace(/^[-_\s]+/, "").trim();
	return s || String(raw || "").trim();
}
function looksLikeIndexerDump(name) {
	const s = String(name || "").trim();
	if (!s) return false;
	if (/^www[\s._-]/i.test(s) || /^www\./i.test(s)) return true;
	if (new RegExp(`^(?:${TLD})\\s*[-–—:]+\\s*\\S`, "i").test(s)) return true;
	if (INDEXER_HOST.test(s) && (/[-.]/.test(s) || /^\[[^\]]+\]/.test(s) || /\[[^\]]+\]\s*$/.test(s))) return true;
	const stripped = stripIndexerPrefix(s);
	return Boolean(stripped) && stripped !== s;
}
function isHashDumpCard(t) {
	if (!t) return false;
	if (looksLikeHashTitle(t.title) || looksLikeHashTitle(t.id)) return true;
	if (t.fromHashDump && !(Number(t.year) > 0 && t.poster)) return true;
	return false;
}
function titleAliasIds(t) {
	return [
		t.id,
		...t.ids || [],
		t.jellyfinId,
		t.jellyfinId ? `jf-${t.jellyfinId}` : ""
	].filter(Boolean).map(String);
}
function normName(title) {
	return String(title || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}
function titleProviderId(t) {
	return [t.id, ...t.ids || []].map(String).find((i) => /^(tmdb-|tvdb-)/.test(i)) || "";
}
function titleWords(name) {
	return String(name || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().split(/\s+/).filter(Boolean);
}
function cleanDumpTitle(title) {
	let s = stripIndexerPrefix(title);
	s = s.replace(/[._]+/g, " ").replace(/\s+/g, " ").trim();
	s = stripIndexerPrefix(s);
	s = s.replace(/^(?:[Ss]\d{1,2}\s*[Ee]\d{1,3})\s+/, "").trim();
	s = s.replace(/[\s._:-]+(?:(?:season|series)[\s._:-]*\d{1,2}|s\d{1,2}(?!\d)(?![eE]\d)).*$/i, "").trim() || s;
	s = s.replace(/[\s._:-]+complete(?:[\s._:-]+(?:series|collection|pack|set))?(?:[\s._:-]+\(?\d{4}\)?)?$/i, "").trim() || s;
	s = s.replace(/\s+(?:II|III|IV|VI|VII|VIII|IX)\s+[A-Za-z][A-Za-z0-9]{1,14}$/i, "").trim() || s;
	return s;
}
function isDumpTwinCard(t) {
	if (!t) return false;
	if (Boolean(titleProviderId(t)) && Boolean(t.title) && !looksLikeHashTitle(t.title) && !looksLikeIndexerDump(t.title)) return false;
	if (t.fromDump) return true;
	if (isHashDumpCard(t)) return true;
	if (looksLikeIndexerDump(t.title) || looksLikeIndexerDump(t.path)) return true;
	if (titleProviderId(t)) return false;
	if (!(Number(t.year) > 0) || !t.poster) return true;
	if (/\b[Ss]\d{1,2}\s*[Ee]\d{1,3}\b/.test(String(t.title || ""))) return true;
	return true;
}
function dumpMatchesNamed(dump, named) {
	const dumpClean = cleanDumpTitle(dump?.title);
	const namedClean = cleanDumpTitle(named?.title);
	const dn = normName(dumpClean);
	const nn = normName(namedClean);
	if (!dn || !nn || dn === "unknownonthisbox") return false;
	if (dn === nn) return true;
	const dumpWords = titleWords(dumpClean);
	const namedWords = titleWords(namedClean);
	if (!namedWords.length || dumpWords.length < namedWords.length) return false;
	const namedCore = nn.replace(/^(the|a|an)/, "");
	const namedSig = namedWords.filter((w) => w !== "the" && w !== "a" && w !== "an");
	if (namedCore.length < 4 && namedSig.length < 2) return false;
	for (let i = 0; i <= dumpWords.length - namedWords.length; i++) if (namedWords.every((w, j) => dumpWords[i + j] === w)) return true;
	return false;
}
/** Drop hash-named / UIndex / year-0 empty posters when the same files are a named show. */
function homeShelfRows(titles) {
	const list = (titles || []).filter(Boolean);
	const named = list.filter((t) => !isDumpTwinCard(t) && t.title && t.title !== "Unknown on this box" && !looksLikeHashTitle(t.title));
	const namedIds = new Set(named.flatMap(titleAliasIds));
	const namedNames = new Set(named.map((t) => normName(t.title)).filter(Boolean));
	return list.filter((t) => {
		if (looksLikeHashTitle(t.title) || looksLikeHashTitle(t.id)) return false;
		if (isDumpTwinCard(t)) {
			if (titleAliasIds(t).some((id) => namedIds.has(id))) return false;
			const name = normName(cleanDumpTitle(t.title));
			if (name && namedNames.has(name)) return false;
			if (named.some((n) => dumpMatchesNamed(t, n))) return false;
			if ((t.fromDump || isHashDumpCard(t) || looksLikeIndexerDump(t.title) || looksLikeIndexerDump(t.path)) && (!(Number(t.year) > 0) || !String(t.poster || "").trim())) return false;
		}
		return true;
	}).map((t) => {
		if (!isDumpTwinCard(t) && !looksLikeIndexerDump(t.title)) return t;
		const cleaned = cleanDumpTitle(t.title);
		if (!cleaned || cleaned === t.title) return t;
		return {
			...t,
			title: cleaned
		};
	});
}
/** Limited Home fetches must not shrink a larger Library shelf — or resurrect a hash leftover. */
function mergeShelf(prev, next, limited) {
	const incoming = homeShelfRows(next);
	if (!limited) return incoming;
	if (!prev.length) return incoming;
	const have = new Set(incoming.flatMap(titleAliasIds));
	const extra = homeShelfRows(prev).filter((t) => !titleAliasIds(t).some((k) => have.has(k)));
	return homeShelfRows([...incoming, ...extra]);
}
var SETTLED = /* @__PURE__ */ new Set([
	"done",
	"idle",
	"stopped",
	"stop",
	"backoff"
]);
/** Splash-lock Home only while catch-up is actually running and dumps still need import. */
function catchupLocksHome(c) {
	if (!c) return false;
	const status = String(c.status || "idle").toLowerCase();
	if (SETTLED.has(status)) return false;
	if (status !== "running") return false;
	return Boolean(c.needsImport);
}
/** Banner + Home chip as soon as Home is usable — not a splash lock. */
function catchupShowsBanner(c) {
	if (!c) return false;
	if (String(c.status || "idle").toLowerCase() === "backoff") return true;
	return catchupLocksHome(c);
}
/** Full-screen Updating ReelOS splash until the door is actually accepting browse/request. */
function updateLocksUi(status) {
	return String(status || "").toLowerCase() === "applying";
}
function honestCatchupMessage(c, splashLock) {
	const status = String(c.status || "idle").toLowerCase();
	const raw = String(c.message || "");
	const catching = /^library catching up/i.test(raw) || /backing off/i.test(raw);
	if (splashLock) return raw || "Library catching up";
	const skipped = Number(c.skipped || 0) || 0;
	const timeouts = Number(c.timeouts || 0) || 0;
	if (catching || !raw) {
		if (status === "done" || status === "stopped" || status === "running" && !c.needsImport && skipped) {
			if (skipped || timeouts) return `Library catch-up done — ${skipped} skipped, ${timeouts} timeouts`;
			return status === "done" || status === "stopped" ? "Library catch-up done" : "";
		}
		if (status === "idle" || status === "backoff") return "";
		return catching ? "" : raw;
	}
	return raw;
}
function normalizeLibraryCatchup(lib) {
	const src = lib && typeof lib === "object" ? lib : {};
	const status = String(src.status || "idle");
	const needsImport = Boolean(src.needsImport);
	const skipped = Number(src.skipped || 0) || 0;
	const timeouts = Number(src.timeouts || 0) || 0;
	const folder = Number(src.folder || 0) || 0;
	const total = Number(src.total || 0) || 0;
	const splashLock = catchupLocksHome({
		status,
		needsImport
	});
	return {
		status,
		message: honestCatchupMessage({
			status,
			message: String(src.message || ""),
			skipped,
			timeouts,
			needsImport
		}, splashLock),
		folder,
		total,
		skipped,
		timeouts,
		needsImport,
		splashLock
	};
}
var IN_FLIGHT = /* @__PURE__ */ new Set(["downloading", "waiting"]);
/** Fresh local POST that Seerr has not echoed yet. Older unmatched inflight is stale persist. */
var OPTIMISTIC_LOCAL_MS = 9e4;
/** Raw TMDB ids are not a title — National Treasure must not paint as tmdb-2059. */
function isGhostRequestLabel(title, titleId) {
	const name = String(title || "").trim();
	const id = String(titleId || "").trim();
	if (!name) return true;
	if (name.toLowerCase() === "untitled") return true;
	if (id && name === id) return true;
	if (/^[0-9a-f]{32,64}$/i.test(name)) return true;
	return /^tmdb(-tv)?-\d+$/i.test(name);
}
function isOptimisticLocal(row, now = Date.now()) {
	return now - Math.max(row.updatedAt || 0, row.createdAt || 0) < OPTIMISTIC_LOCAL_MS;
}
/** Searching / grabbing / linked waiting for import. Available, failed, announced, and engine-downloaded are not. */
function isInFlightRequest(r) {
	if (r.engine === "downloaded") return false;
	if (/announced|not released/i.test(r.reason || "")) return false;
	return IN_FLIGHT.has(r.status);
}
/** JF Watch exists for this request — Requests can drop it. Seerr-available is not enough. Ground truth is playable media in Jellyfin. */
function requestIsWatchableOnShelf(row, opts = {}) {
	const keys = new Set(titlePresenceKeys(row.titleId));
	for (const t of opts.titles || []) {
		if (!t.jellyfinId) continue;
		if (titlePresenceKeys(t.id, t.ids || []).some((k) => keys.has(k))) return true;
	}
	return false;
}
/** Overlay JF hits, keep grabbing/waiting, and keep finished titles until Watch. */
function requestNeedsLibraryHandoff(row, opts = {}) {
	if (row.status !== "available" && row.engine !== "downloaded") return false;
	return !requestIsWatchableOnShelf(row, opts);
}
/** Home/Requests: overlay JF hits, keep grabbing/waiting, keep finished titles until Watch, and exclude dismissed completed titles. */
function inFlightRequests(requests, opts = {}) {
	const dismissed = new Set(opts.dismissedIds || []);
	return overlayLibraryPresence(requests, opts).filter((r) => {
		if (dismissed.has(r.id)) return false;
		return isInFlightRequest(r) || requestNeedsLibraryHandoff(r, opts);
	});
}
function extractUpcomingMonitoredSeasons(requests, catalog = []) {
	const results = [];
	const seen = /* @__PURE__ */ new Set();
	for (const r of requests) {
		if (!r.titleId) continue;
		if (!isTvRequestRow(r)) continue;
		const reason = String(r.reason || "").toLowerCase();
		if (/announced|not released|upcoming|tba/i.test(reason) || r.status === "waiting" && !isInFlightRequest(r)) {
			const seasonNum = Number(r.season) || 1;
			const key = `${r.titleId}-s${seasonNum}`;
			if (seen.has(key)) continue;
			seen.add(key);
			const titleObj = catalog.find((t) => t.id === r.titleId);
			results.push({
				showId: r.titleId,
				showTitle: titleObj?.title || r.title || "TV Series",
				poster: titleObj?.poster,
				seasonNumber: seasonNum,
				status: "coming_soon",
				airDate: titleObj?.year ? String(titleObj.year) : void 0,
				reason: r.reason || "Upcoming season monitored on Sonarr"
			});
		}
	}
	for (const t of catalog) {
		if (t.kind !== "tv" && t.kind !== "anime") continue;
		const unreleased = t.unreleasedSeasons || [];
		for (const sn of unreleased) {
			const sNum = Number(sn);
			if (!Number.isFinite(sNum) || sNum <= 0) continue;
			const key = `${t.id}-s${sNum}`;
			if (seen.has(key)) continue;
			seen.add(key);
			const fact = (t.seasonFacts || []).find((f) => f.season === sNum);
			results.push({
				showId: t.id,
				showTitle: t.title,
				poster: t.poster,
				seasonNumber: sNum,
				status: "monitored",
				airDate: fact?.airDate || (t.year ? String(t.year) : void 0),
				reason: "Monitored season · Waiting for air date / release"
			});
		}
	}
	return results;
}
/** Linked dumps waiting on Sonarr — not a silent 0%, not Watch. */
function isLinkedImportingRequest(r) {
	return /on disk, importing|files linked|waiting for.*import/i.test(String(r?.reason || ""));
}
function isTvRequestRow(row) {
	const id = String(row.titleId || "");
	return id.startsWith("tmdb-tv-") || id.startsWith("tvdb-") || row.season != null;
}
/** Dump files waiting for Sonarr import — never paint as 0%. TBA is Coming, not Waiting. Available without playable media paints Importing/Searching. */
function requestProgressLabel(r) {
	if (!r) return null;
	if (r.status !== "downloading" && r.status !== "waiting" && r.status !== "available") return null;
	if (r.via === "cache" && r.status !== "available") return "Cached";
	const reason = String(r.reason || "");
	if (/announced|not released/i.test(reason)) return "Coming";
	if (/on disk, importing|files linked|waiting for.*import|importing/i.test(reason)) return "Importing";
	if (/searching/i.test(reason)) return "Searching";
	if (r.status === "available") return "Importing";
	if (r.status === "waiting") return "Waiting";
	const pct = Math.round(Number(r.progress) || 0);
	if (pct <= 0) return "Grabbing";
	return `${pct}%`;
}
function getMediaLifecycleState(title, request, opts = {}) {
	if (title.jellyfinId || opts.inLibrary) return "on_shelf";
	if (opts.titles) {
		for (const t of opts.titles) if (t.jellyfinId && titleMatchesId(t, title.id)) return "on_shelf";
	}
	if (!request) return "unowned";
	if (request.status === "failed" || requestShowsRetry(request)) return "failed";
	if (request.status === "available") {
		if (opts.titles && requestIsWatchableOnShelf({ titleId: title.id }, opts)) return "on_shelf";
		return "importing";
	}
	const reason = String(request.reason || "");
	if (/announced|not released/i.test(reason)) return "coming_soon";
	if (/on disk, importing|files linked|waiting for.*import|importing/i.test(reason)) return "importing";
	if (/searching/i.test(reason)) return "searching";
	if (request.status === "waiting") return "searching";
	if (request.status === "downloading") {
		if (request.via === "cache") return "importing";
		return "downloading";
	}
	return "unowned";
}
/** Per-season Watch vs Importing vs Request vs Coming from files on disk — series AVAILABLE is not S05 Watch. */
function tvSeasonChips(titleId, requests, titles = []) {
	const keys = new Set(titlePresenceKeys(titleId));
	const bySeason = /* @__PURE__ */ new Map();
	for (const t of titles) {
		if (!titleMatchesId(t, titleId)) continue;
		const importing = new Set((t.importingSeasons || []).map(Number).filter((n) => Number.isFinite(n) && n > 0));
		for (const n of t.onDiskSeasons || []) {
			const season = Number(n);
			if (!Number.isFinite(season) || season <= 0) continue;
			if (importing.has(season)) continue;
			bySeason.set(season, "Watch");
		}
		for (const n of t.unreleasedSeasons || []) {
			const season = Number(n);
			if (Number.isFinite(season) && season > 0 && bySeason.get(season) !== "Watch") bySeason.set(season, "Coming");
		}
		for (const n of t.importingSeasons || []) {
			const season = Number(n);
			if (Number.isFinite(season) && season > 0 && bySeason.get(season) !== "Watch" && bySeason.get(season) !== "Coming") bySeason.set(season, "Importing");
		}
	}
	for (const row of requests) {
		if (!titlePresenceKeys(row.titleId).some((k) => keys.has(k))) continue;
		if (row.season == null) continue;
		const n = Number(row.season);
		if (!Number.isFinite(n) || n <= 0) continue;
		if (bySeason.get(n) === "Watch" || bySeason.get(n) === "Coming") continue;
		if (/on disk, importing|files linked|waiting for.*import/i.test(row.reason || "") && bySeason.get(n) !== "Watch") {
			bySeason.set(n, "Importing");
			continue;
		}
		if (bySeason.get(n) === "Importing") continue;
		bySeason.set(n, "Request");
	}
	return [...bySeason.entries()].sort((a, b) => a[0] - b[0]).map(([season, label]) => ({
		season,
		label
	}));
}
/** Locks that will never progress without a write — Retry must stay visible (Cancel is not enough). */
function requestShowsRetry(r) {
	if (r.status === "failed") return true;
	if (r.status === "available") return false;
	return /will not run|has no movie yet|has no series yet|cannot land/i.test(r.reason || "");
}
function requestMatchKey(r) {
	return r.season == null ? r.titleId : `${r.titleId}#${r.season}`;
}
function seasonsCompatible(a, b) {
	return a == null || b == null || a === b;
}
function preferServerRow(local, server) {
	const progress = server.status === "available" ? 100 : typeof server.progress === "number" && server.progress > 0 ? Math.max(0, Math.min(100, Math.round(server.progress))) : server.status === local.status ? local.progress : typeof server.progress === "number" ? server.progress : 0;
	return {
		...local,
		...server,
		id: server.id || local.id,
		status: server.status,
		progress,
		createdAt: local.createdAt || server.createdAt,
		updatedAt: Math.max(local.updatedAt || 0, server.updatedAt || 0),
		requester: server.requester || local.requester,
		season: server.season ?? local.season,
		via: server.via ?? local.via,
		release: server.release ?? local.release,
		reason: server.status === "failed" ? server.reason ?? local.reason : server.reason
	};
}
/** Merge GET /api/request list into persisted local rows. Server status/progress wins. */
function mergeServerRequests(local, server) {
	if (!server.length) return local;
	const serverById = /* @__PURE__ */ new Map();
	const serverByKey = /* @__PURE__ */ new Map();
	for (const row of server) {
		if (row.id) serverById.set(row.id, row);
		if (row.titleId) serverByKey.set(requestMatchKey(row), row);
	}
	const used = /* @__PURE__ */ new Set();
	const out = [];
	for (const loc of local) {
		const match = (loc.id ? serverById.get(loc.id) : void 0) || serverByKey.get(requestMatchKey(loc));
		if (match) {
			if (used.has(match.id)) continue;
			used.add(match.id);
			out.push(preferServerRow(loc, match));
			continue;
		}
		if (loc.status === "downloading" || loc.status === "waiting" || loc.status === "available" || loc.engine === "downloaded") {
			const available = server.find((s) => s.titleId === loc.titleId && s.status === "available" && seasonsCompatible(s.season, loc.season));
			if (available) {
				if (used.has(available.id)) continue;
				used.add(available.id);
				out.push(preferServerRow(loc, available));
				continue;
			}
			if (server.some((s) => s.titleId === loc.titleId)) {
				out.push(loc);
				continue;
			}
			if (isOptimisticLocal(loc) || /has no movie yet|has no series yet|search cannot land/i.test(loc.reason || "")) {
				out.push(loc);
				continue;
			}
			continue;
		}
		out.push(loc);
	}
	for (const row of server) {
		if (used.has(row.id)) continue;
		const key = requestMatchKey(row);
		if (out.find((r) => requestMatchKey(r) === key && r.status !== "failed") && row.status !== "available") continue;
		out.push({
			...row,
			progress: row.status === "available" ? 100 : row.progress ?? 0
		});
	}
	return collapseDuplicateRequests(out);
}
var STATUS_RANK = {
	available: 4,
	downloading: 3,
	waiting: 2,
	failed: 1
};
/** Home Your requests: one card per title, not every season row (two Expanse Waitings). */
function collapseHomeRequestCards(rows) {
	const groups = /* @__PURE__ */ new Map();
	for (const row of rows) {
		if (!row?.titleId) continue;
		const list = groups.get(row.titleId) || [];
		list.push(row);
		groups.set(row.titleId, list);
	}
	const out = [];
	for (const list of groups.values()) out.push(list.reduce((best, row) => {
		const br = STATUS_RANK[best.status] || 0;
		const rr = STATUS_RANK[row.status] || 0;
		if (rr !== br) return rr > br ? row : best;
		if ((row.progress || 0) !== (best.progress || 0)) return (row.progress || 0) > (best.progress || 0) ? row : best;
		return (row.updatedAt || 0) >= (best.updatedAt || 0) ? row : best;
	}));
	return out;
}
/** Transferring chip matches grabbing/waiting Home cards, not Seerr-available waiting for Watch. */
function transferringChipCount(rows) {
	return collapseHomeRequestCards(rows.filter((r) => isInFlightRequest(r) && !isGhostRequestLabel(r.title, r.titleId))).length;
}
function markAvailable(row) {
	return {
		...row,
		status: "available",
		progress: 100,
		reason: void 0
	};
}
function isMovieRequest(row) {
	return !String(row.titleId).startsWith("tmdb-tv-") && row.season == null;
}
function titlePresenceKeys(id, extra = []) {
	const keys = /* @__PURE__ */ new Set();
	const add = (raw) => {
		const s = String(raw || "").trim();
		if (!s) return;
		keys.add(s);
	};
	add(id);
	extra.forEach(add);
	if (id.startsWith("tmdb-tv-")) add(`tmdb-${id.slice(8)}`);
	return [...keys];
}
function titleMatchesId(t, id) {
	const pageId = String(id || "");
	const pageMovie = /^tmdb-\d/.test(pageId) && !pageId.startsWith("tmdb-tv-");
	const pageTv = pageId.startsWith("tmdb-tv-") || pageId.startsWith("tvdb-");
	const kind = t.kind === "tv" || t.kind === "anime" ? "tv" : t.kind === "movie" ? "movie" : null;
	if (pageMovie && kind === "tv") return false;
	if (pageTv && kind === "movie") return false;
	const keys = new Set(titlePresenceKeys(t.id, t.ids || []));
	if (t.jellyfinId) {
		keys.add(String(t.jellyfinId));
		keys.add(`jf-${t.jellyfinId}`);
	}
	return titlePresenceKeys(id).some((k) => keys.has(k));
}
/** TMDB/Seerr art — Jellyfin 404s must not count as a poster on first paint. */
function titleHasRemotePoster(t) {
	const p = String(t?.poster || "").trim();
	return Boolean(p && !p.includes("/api/jf/"));
}
/** Home cards: shelf / remembered titles / the request's own name. Always a Title so chip and cards match. */
function titleForRequest(r, titles = []) {
	const hits = titles.filter((t) => titleMatchesId(t, r.titleId));
	const hit = hits.find((t) => titleHasRemotePoster(t)) || hits[0];
	if (hit) return hit;
	return {
		id: r.titleId,
		kind: String(r.titleId).startsWith("tmdb-tv-") ? "tv" : "movie",
		title: r.title || r.titleId,
		year: 0,
		rating: 0,
		genres: [],
		overview: "",
		poster: "",
		maxQuality: "1080p",
		popularity: 0
	};
}
/** Persist/catalog must take TMDB art even when a ghost row already occupies that id. */
function mergeRemoteTitles(current = [], incoming = [], cap = 120) {
	const byId = /* @__PURE__ */ new Map();
	for (const t of current) if (t?.id) byId.set(t.id, t);
	for (const t of incoming) {
		if (!t?.id) continue;
		const cur = byId.get(t.id);
		if (!cur) {
			byId.set(t.id, t);
			continue;
		}
		const poster = titleHasRemotePoster(t) ? t.poster : cur.poster;
		const title = t.title && t.title !== t.id ? t.title : cur.title;
		byId.set(t.id, {
			...cur,
			...t,
			title,
			poster
		});
	}
	const merged = [...byId.values()];
	if (merged.length <= cap) return merged;
	const keep = merged.filter((t) => titleHasRemotePoster(t));
	const rest = merged.filter((t) => !titleHasRemotePoster(t));
	return [...keep, ...rest].slice(0, cap);
}
function isHashDumpId(id) {
	const s = String(id || "");
	return /^[0-9a-f]{32,64}$/i.test(s) || /^jf-[0-9a-f]{32,64}$/i.test(s);
}
function titleInDropSet(t, keys) {
	const ids = titlePresenceKeys(t.id, t.ids || []);
	if (t.jellyfinId) ids.push(String(t.jellyfinId), `jf-${t.jellyfinId}`);
	return ids.some((k) => keys.has(k));
}
/** Drop a title from shelf, library ids, and request overlay. TV drops every season row. */
function dropLibraryOverlay(state, titleId, extraIds = []) {
	const keys = new Set(titlePresenceKeys(titleId, extraIds));
	const hashOnly = [...keys].some(isHashDumpId) && ![...keys].some((k) => /^(tmdb-|tvdb-)/.test(k));
	for (const t of state.shelf || []) {
		if (!titleInDropSet(t, keys)) continue;
		for (const k of titlePresenceKeys(t.id, t.ids || [])) {
			if (hashOnly && /^(tmdb-|tvdb-)/.test(k)) continue;
			if (hashOnly && !isHashDumpId(k) && !k.startsWith("jf-")) continue;
			keys.add(k);
		}
		if (t.jellyfinId && !hashOnly) {
			keys.add(String(t.jellyfinId));
			keys.add(`jf-${t.jellyfinId}`);
		} else if (t.jellyfinId && hashOnly) {
			const jf = String(t.jellyfinId);
			if ([titleId, ...extraIds].some((id) => String(id) === jf || String(id) === `jf-${jf}`)) {
				keys.add(jf);
				keys.add(`jf-${jf}`);
			}
		}
	}
	const gone = (id) => keys.has(id) || titlePresenceKeys(id).some((k) => keys.has(k));
	const keepNamed = (t) => hashOnly && [t.id, ...t.ids || []].some((id) => /^(tmdb-|tvdb-)/.test(String(id)));
	return {
		shelf: (state.shelf || []).filter((t) => keepNamed(t) || !titleInDropSet(t, keys)),
		library: (state.library || []).filter((id) => hashOnly && /^(tmdb-|tvdb-)/.test(String(id)) || !gone(String(id))),
		requests: (state.requests || []).filter((r) => {
			if (!r?.titleId) return true;
			if (hashOnly && /^(tmdb-|tvdb-)/.test(String(r.titleId))) return true;
			return !gone(r.titleId);
		}),
		keys: [...keys]
	};
}
/** Collapse same titleId+season. A done sibling upgrades the rest. */
function collapseDuplicateRequests(rows) {
	const groups = /* @__PURE__ */ new Map();
	for (const row of rows) {
		if (!row?.titleId) continue;
		const key = requestMatchKey(row);
		const list = groups.get(key) || [];
		list.push(row);
		groups.set(key, list);
	}
	const out = [];
	for (const list of groups.values()) {
		const anyAvailable = list.some((r) => r.status === "available" || r.engine === "downloaded");
		const picked = list.reduce((best, row) => {
			const br = STATUS_RANK[best.status] || 0;
			const rr = STATUS_RANK[row.status] || 0;
			if (rr !== br) return rr > br ? row : best;
			return (row.updatedAt || 0) >= (best.updatedAt || 0) ? row : best;
		});
		out.push(anyAvailable ? markAvailable(picked) : picked);
	}
	return out;
}
/** Movies on the JF shelf are AVAILABLE even if Seerr still says grabbing. TV stays season-by-season. */
function overlayLibraryPresence(requests, opts) {
	const movieKeys = /* @__PURE__ */ new Set();
	const tvDisk = /* @__PURE__ */ new Map();
	for (const id of opts.libraryIds || []) {
		if (id.startsWith("tmdb-tv-") || id.startsWith("tvdb-") || id.startsWith("jf-")) continue;
		for (const k of titlePresenceKeys(id)) movieKeys.add(k);
	}
	for (const t of opts.titles || []) {
		if (!t.jellyfinId) continue;
		if (t.kind === "tv" || t.kind === "anime") {
			const importing = new Set((t.importingSeasons || []).map(Number).filter((n) => Number.isFinite(n) && n > 0));
			const disk = (t.onDiskSeasons || []).map(Number).filter((n) => Number.isFinite(n) && n > 0 && !importing.has(n));
			if (!disk.length) continue;
			for (const k of titlePresenceKeys(t.id, t.ids || [])) {
				const set = tvDisk.get(k) || /* @__PURE__ */ new Set();
				disk.forEach((n) => set.add(n));
				tvDisk.set(k, set);
			}
			continue;
		}
		for (const k of titlePresenceKeys(t.id, t.ids || [])) {
			if (k.startsWith("jf-")) continue;
			movieKeys.add(k);
		}
	}
	return collapseDuplicateRequests(requests.map((row) => {
		if (row.status === "available" || row.engine === "downloaded") return row.status === "available" ? row : markAvailable(row);
		if (isMovieRequest(row)) {
			if (titlePresenceKeys(row.titleId).some((k) => movieKeys.has(k))) return markAvailable(row);
			return row;
		}
		if (row.season == null) return row;
		if (isLinkedImportingRequest(row)) return row;
		return titlePresenceKeys(row.titleId).some((k) => tvDisk.get(k)?.has(Number(row.season))) ? markAvailable(row) : row;
	}));
}
var toasts = [];
var listeners = /* @__PURE__ */ new Set();
function notify() {
	for (const fn of listeners) fn([...toasts]);
}
function showToast(message, type = "info") {
	const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
	const item = {
		id,
		message,
		type
	};
	toasts = [...toasts, item];
	notify();
	setTimeout(() => {
		toasts = toasts.filter((t) => t.id !== id);
		notify();
	}, 3200);
}
function dismissToast(id) {
	toasts = toasts.filter((t) => t.id !== id);
	notify();
}
function useToasts() {
	const [items, setItems] = (0, import_react.useState)(toasts);
	(0, import_react.useEffect)(() => {
		listeners.add(setItems);
		return () => {
			listeners.delete(setItems);
		};
	}, []);
	return items;
}
function watchProgressFromResume(rows) {
	if (!Array.isArray(rows)) return null;
	const out = {};
	for (const t of rows) {
		const id = String(t?.id || "").trim();
		const p = Number(t?.progress);
		if (!id || !Number.isFinite(p) || p <= .03 || p >= .96) continue;
		out[id] = p;
	}
	return out;
}
var defaultAnswers = {
	storageMode: "both",
	selectedDisks: ["sda", "sdb"],
	formatDisks: [],
	source: "torbox",
	apiKey: "",
	vpnProvider: "mullvad",
	intent: {
		movies: true,
		tv: true,
		anime: false,
		uhd: false,
		kids: false,
		music: false
	},
	quality: "hybrid",
	frontend: "jellyfin",
	plexClaim: "",
	adminName: "",
	adminPassword: "",
	access: "lan",
	tunnelToken: ""
};
var SHIPPED_VERSION = "1.5.19";
function idleBootSteps() {
	return {
		local: "pending",
		house: "pending",
		library: "pending",
		requests: "pending"
	};
}
function makeAdapter(answers) {
	const p = adapterProfile(answers.source, answers.frontend);
	const healthy = answers.source === "local-vpn" || answers.apiKey.trim().length >= 10;
	return {
		kind: p.kind,
		provider: answers.source,
		status: healthy ? "healthy" : "offline",
		account: p.account,
		mount: p.mount,
		pingMs: healthy ? 41 : 0,
		cacheHits: 0,
		transfers: 0,
		lastPing: healthy ? Date.now() : null,
		daysLeft: 0
	};
}
function idleLibraryCatchup() {
	return {
		status: "idle",
		message: "",
		folder: 0,
		total: 0,
		skipped: 0,
		timeouts: 0,
		needsImport: false,
		splashLock: false
	};
}
function idleUpdate(current = SHIPPED_VERSION) {
	return {
		status: "idle",
		current,
		target: null,
		checkedAt: null,
		steps: [],
		notes: [],
		rollback: false
	};
}
function updatePlan() {
	return [
		{
			id: "channel",
			label: "Read the stable channel",
			status: "pending",
			log: ""
		},
		{
			id: "host",
			label: "Host patches",
			status: "pending",
			log: ""
		},
		{
			id: "images",
			label: "Pull stack images",
			status: "pending",
			log: ""
		},
		{
			id: "recreate",
			label: "Recreate changed services",
			status: "pending",
			log: ""
		},
		{
			id: "health",
			label: "Health check",
			status: "pending",
			log: ""
		}
	];
}
var shelfFetches = /* @__PURE__ */ new Map();
function uid(prefix) {
	return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}
function normalizeRelease(raw) {
	const t = raw.trim();
	if (!t) return null;
	const magnet = /urn:btih:([a-fA-F0-9]{40}|[a-zA-Z2-7]{32})/i.exec(t);
	if (magnet?.[1]) return magnet[1].toLowerCase();
	if (/^[a-fA-F0-9]{40}$/.test(t)) return t.toLowerCase();
	return null;
}
function logFor(id, label) {
	return {
		docker: "containerd is up. Compose project reelos.",
		indexers: "Prowlarr reachable. Syncing apps.",
		radarr: "Root folder /srv/media/movies. Quality profile applied.",
		sonarr: "Root folder /srv/media/tv. Quality profile applied.",
		anime: "Anime-sane profile attached to Sonarr.",
		lidarr: "Root folder /srv/media/music.",
		seerr: "Request UI linked. No setup screen left.",
		jellyfin: "Libraries published. Hardware transcode noted.",
		plex: "Claim accepted. Libraries published.",
		bazarr: "Subtitle clients wired to engines.",
		gluetun: "Killswitch on. qBittorrent on the VPN network.",
		debrid: "Decypharr registered as the download client. Engines send work here.",
		caddy: "reelos.local → shell. Engines on /advanced.",
		transcode: "No /dev/dri. DirectPlay/DirectStream only — no CPU ffmpeg.",
		link: "Engines, request UI, and media server agree on paths.",
		tailscale: "tailscaled running. Auth URL copied to finish screen.",
		cf: "Tunnel service installed from token.",
		channel: "stable · ReelOS 1.1.0 is published.",
		host: "unattended-upgrades applied. Kernel stays on this boot.",
		images: "Pulled 4 images. 1 already current.",
		recreate: "Request UI and debrid adapter recreated. Libraries untouched.",
		health: "Caddy, media server, and engines answered."
	}[id] ?? `${label} ready.`;
}
function buildPlan(answers) {
	const steps = [{
		id: "docker",
		label: "Docker engine"
	}, {
		id: "indexers",
		label: "Indexer manager"
	}];
	if (answers.intent.movies) steps.push({
		id: "radarr",
		label: "Movie engine"
	});
	if (answers.intent.tv) steps.push({
		id: "sonarr",
		label: "TV engine"
	});
	if (answers.intent.anime) steps.push({
		id: "anime",
		label: "Anime profile"
	});
	if (answers.intent.music) steps.push({
		id: "lidarr",
		label: "Music engine"
	});
	steps.push({
		id: "seerr",
		label: "Request UI"
	});
	if (answers.frontend !== "plex") steps.push({
		id: "jellyfin",
		label: "Jellyfin"
	});
	if (answers.frontend !== "jellyfin") steps.push({
		id: "plex",
		label: "Plex"
	});
	steps.push({
		id: "bazarr",
		label: "Subtitles"
	});
	if (answers.source === "local-vpn") steps.push({
		id: "gluetun",
		label: "VPN + download client"
	});
	else {
		const p = adapterProfile(answers.source, answers.frontend);
		steps.push({
			id: "debrid",
			label: p.name
		});
	}
	steps.push({
		id: "caddy",
		label: "Ingress"
	});
	steps.push({
		id: "transcode",
		label: "Hardware transcode probe"
	});
	steps.push({
		id: "link",
		label: "Link engines and libraries"
	});
	if (answers.access === "tailscale") steps.push({
		id: "tailscale",
		label: "Tailscale"
	});
	if (answers.access === "cloudflare") steps.push({
		id: "cf",
		label: "Cloudflare Tunnel"
	});
	return steps.map((s) => ({
		...s,
		status: "pending",
		log: ""
	}));
}
function event(kind, message, titleId) {
	return {
		id: uid("ev"),
		at: Date.now(),
		kind,
		message,
		titleId
	};
}
var demoAnswers = {
	...defaultAnswers,
	source: "local-vpn",
	apiKey: "",
	adminName: "Ada",
	adminPassword: "",
	intent: {
		movies: true,
		tv: true,
		anime: true,
		uhd: true,
		kids: true,
		music: true
	},
	quality: "hybrid",
	frontend: "jellyfin"
};
function labState() {
	const now = Date.now();
	const req = (titleId, status, extra = {}) => ({
		id: uid("req"),
		titleId,
		status,
		progress: status === "available" ? 100 : status === "downloading" ? 62 : 0,
		createdAt: now - 864e5,
		updatedAt: now,
		requester: "Ada",
		...extra
	});
	return {
		phase: "running",
		wizardStep: 7,
		answers: demoAnswers,
		build: buildPlan(demoAnswers).map((s) => ({
			...s,
			status: "done",
			log: logFor(s.id, s.label)
		})),
		provisioned: true,
		requests: [
			req("night-harbor", "available", {
				via: "cache",
				release: "Night.Harbor.2024.2160p.WEB-DL.DDP5.1",
				createdAt: now - 1728e5
			}),
			req("ember-season", "available", {
				via: "cache",
				release: "Ember.Season.2025.2160p.WEB-DL.DDP5.1",
				createdAt: now - 864e5
			}),
			req("glass-orchard", "available", {
				via: "cache",
				release: "Glass.Orchard.2024.2160p.WEB-DL.DDP5.1",
				createdAt: now - 5e7
			}),
			req("station-line", "downloading", {
				via: "uncached",
				progress: 62,
				season: 2,
				release: "Station.Line.S02E01.2160p.WEB-DL.DDP5.1",
				createdAt: now - 36e5
			}),
			req("drift-protocol", "waiting", { createdAt: now - 18e5 }),
			req("hollow-broadcast", "failed", {
				reason: "Real-Debrid has no matching hash",
				createdAt: now - 72e5
			})
		],
		library: [
			"night-harbor",
			"ember-season",
			"glass-orchard",
			"iron-parish",
			"paper-moons",
			"maple-pilot"
		],
		shelf: [],
		shelfError: null,
		shelfReady: true,
		watchProgress: {
			"night-harbor": .42,
			"ember-season": .18,
			"iron-parish": .71
		},
		activity: [
			event("import", "Cache hit — Night Harbor on Real-Debrid", "night-harbor"),
			event("import", "Cache hit — Ember Season on Real-Debrid", "ember-season"),
			event("grab", "Uncached. Decypharr sent Station Line S02 to Real-Debrid.", "station-line"),
			event("request", "Ada requested Drift Protocol", "drift-protocol"),
			event("fail", "Hollow Broadcast — Real-Debrid has no matching hash", "hollow-broadcast"),
			event("scan", "Library scan finished. 6 items."),
			event("index", "Indexer manager empty. Add your own under Advanced."),
			event("system", "Decypharr healthy. Engines registered it as the download client.")
		],
		users: [
			{
				id: "u-ada",
				name: "Ada",
				role: "admin"
			},
			{
				id: "u-jon",
				name: "Jon",
				role: "member"
			},
			{
				id: "u-nes",
				name: "Nessa",
				role: "member"
			}
		],
		settings: {
			hideAdvanced: false,
			autoApprove: true,
			notifyAvailable: true,
			notifyFailed: true,
			autoUpdate: true,
			stackImages: false,
			connectDone: true,
			betaChannel: false
		},
		update: idleUpdate(),
		adapter: {
			...makeAdapter(demoAnswers),
			cacheHits: 3,
			transfers: 1,
			pingMs: 41,
			lastPing: now
		},
		indexers: [],
		remoteTitles: []
	};
}
var initial = {
	hydrated: false,
	phase: "splash",
	wizardStep: 1,
	answers: defaultAnswers,
	theme: "gold-hashed",
	animationsEnabled: true,
	houseName: "Living Room",
	residents: [
		{
			id: "res-primary",
			name: "Primary",
			avatar: "clapperboard",
			isGuest: false,
			watchlist: [
				"tmdb-335984",
				"tmdb-tv-106379",
				"tmdb-872585"
			],
			watchProgress: {
				"tmdb-693134": .42,
				"tmdb-tv-95396": .68,
				"tvdb-371980": .68
			},
			assignedTitleIds: [],
			mediaPriorities: {
				movies: 50,
				tv: 50,
				books: 25
			},
			tasteVibe: "balanced",
			themeDesign: "oled_cinema",
			motionStyle: "cinematic"
		},
		{
			id: "res-sarah",
			name: "Sarah",
			avatar: "sparkles",
			isGuest: false,
			watchlist: [
				"tmdb-329865",
				"tmdb-tv-97546",
				"tmdb-tv-125927"
			],
			watchProgress: {
				"tmdb-tv-136283": .54,
				"tvdb-403294": .54,
				"tmdb-346698": .28
			},
			assignedTitleIds: [],
			mediaPriorities: {
				movies: 70,
				tv: 30,
				books: 60
			},
			tasteVibe: "comfort",
			themeDesign: "warm_velvet",
			motionStyle: "cinematic"
		},
		{
			id: "res-kids",
			name: "Kids",
			avatar: "sparkles",
			isGuest: false,
			isKids: true,
			watchlist: [],
			watchProgress: {},
			mediaPriorities: {
				movies: 80,
				tv: 80,
				books: 10
			},
			tasteVibe: "comfort",
			themeDesign: "futuristic_hud",
			motionStyle: "flashy"
		},
		{
			id: "res-guest",
			name: "Guest",
			avatar: "popcorn",
			isGuest: true,
			watchlist: [],
			watchProgress: {},
			mediaPriorities: {
				movies: 50,
				tv: 50,
				books: 0
			},
			tasteVibe: "balanced",
			themeDesign: "oled_cinema",
			motionStyle: "cinematic"
		}
	],
	activeResidentId: "res-primary",
	dismissedRequestIds: [],
	kidsTitleIds: [],
	kidsGiftedTitles: {},
	activeRemote: {
		open: false,
		playing: false,
		progress: 0,
		duration: 0
	},
	build: [],
	buildLogOpen: false,
	provisioned: false,
	hasEverCompletedStep1: false,
	requests: [],
	library: [],
	shelf: [],
	shelfError: null,
	shelfReady: false,
	jellyfinHop: {
		state: "amber",
		detail: "Still starting"
	},
	ipv4: "",
	watch: "",
	tailscaleIp: "",
	watchProgress: {},
	activity: [],
	users: [],
	settings: {
		hideAdvanced: false,
		autoApprove: true,
		notifyAvailable: true,
		notifyFailed: true,
		autoUpdate: true,
		stackImages: false,
		connectDone: false,
		betaChannel: false
	},
	update: idleUpdate(),
	libraryCatchup: idleLibraryCatchup(),
	adapter: makeAdapter(defaultAnswers),
	fuseOffline: false,
	indexers: [],
	remoteTitles: [],
	bootSteps: idleBootSteps(),
	requestsSeeded: false,
	remoteChallenged: false
};
var useReelStore = create()(persist((set, get) => ({
	...initial,
	setHydrated: () => set({ hydrated: true }),
	setRemoteChallenged: (challenged) => set({ remoteChallenged: challenged }),
	setBootStep: (id, status) => set({ bootSteps: {
		...get().bootSteps,
		[id]: status
	} }),
	applyReadyPayload: (ready) => {
		const provisioned = Boolean(ready?.provisioned);
		const incoming = ready?.answers && typeof ready.answers === "object" ? ready.answers : null;
		const titles = Array.isArray(ready?.titles) ? ready.titles : [];
		const resume = Array.isArray(ready?.continueWatching) ? ready.continueWatching : [];
		const live = Array.isArray(ready?.requests) ? ready.requests : [];
		if (titles.length) rememberCatalogTitles(titles);
		if (resume.length) rememberCatalogTitles(resume);
		set((s) => {
			const { adminPassword: _omitPassword, ...safeIncoming } = incoming || {};
			const answers = incoming ? {
				...s.answers,
				...safeIncoming,
				adminPassword: s.answers.adminPassword
			} : s.answers;
			const shelf = titles.length ? mergeShelf(s.shelf, titles, true) : s.shelf;
			const dismissed = new Set(s.dismissedRequestIds || []);
			const requests = overlayLibraryPresence(mergeServerRequests(s.requests, live), { titles: shelf }).filter((r) => !dismissed.has(r.id));
			const library = [...new Set(shelf.map((t) => t.id))];
			const libraryOk = Array.isArray(ready?.titles);
			const requestsOk = Array.isArray(ready?.requests);
			const syncedWatch = watchProgressFromResume(ready?.continueWatching);
			const incomingBoxName = incoming?.boxName || safeIncoming.adminName;
			return {
				answers,
				houseName: incomingBoxName && (!s.houseName || s.houseName === "Living Room" || s.houseName === "reelos") ? incomingBoxName : s.houseName,
				shelf,
				shelfError: libraryOk ? null : s.shelfError,
				shelfReady: libraryOk || s.shelfReady || Boolean(shelf.length),
				library,
				requests,
				requestsSeeded: requestsOk || s.requestsSeeded,
				...syncedWatch ? { watchProgress: syncedWatch } : {},
				bootSteps: {
					...s.bootSteps,
					local: "ok",
					house: provisioned ? "ok" : "fail",
					library: libraryOk ? "ok" : "fail",
					requests: requestsOk ? "ok" : "fail"
				},
				jellyfinHop: ready?.jellyfin?.state ? {
					state: String(ready.jellyfin.state),
					detail: ready.jellyfin.detail
				} : s.jellyfinHop,
				ipv4: ready?.ipv4 != null ? String(ready.ipv4) : s.ipv4,
				watch: ready?.watch != null ? String(ready.watch) : s.watch,
				tailscaleIp: ready?.tailscaleIp != null ? String(ready.tailscaleIp) : s.tailscaleIp,
				fuseOffline: Boolean(ready?.fuseOffline),
				settings: typeof ready?.betaChannel === "boolean" ? {
					...s.settings,
					betaChannel: ready.betaChannel
				} : s.settings
			};
		});
		const s = get();
		if (provisioned) {
			if (!s.provisioned || s.phase === "wizard" || s.phase === "splash") s.openReelOS();
		} else if (s.provisioned || s.phase !== "wizard") s.factoryReset();
		const st = ready?.update;
		const lib = ready?.libraryCatchup || ready?.update?.library;
		if (lib && typeof lib === "object") set({ libraryCatchup: normalizeLibraryCatchup(lib) });
		if (st) {
			const cur = get();
			const last = (st.log || "").trim().split("\n").pop() || "";
			if (st.running) {
				const steps = (cur.update.steps?.length ? cur.update.steps : updatePlan()).map((x) => ({ ...x }));
				if (steps[0]) {
					steps[0].status = "running";
					steps[0].label = "Configuring this house";
					steps[0].log = last.slice(0, 160);
				}
				set({ update: {
					...cur.update,
					status: "applying",
					current: st.local || cur.update.current,
					target: st.target || cur.update.target,
					steps,
					notes: []
				} });
			}
		}
	},
	setProvisioned: (provisioned) => set({ provisioned }),
	setPhase: (phase) => set({ phase }),
	setWizardStep: (wizardStep) => set({ wizardStep }),
	setHasEverCompletedStep1: (hasEverCompletedStep1) => set({ hasEverCompletedStep1 }),
	patchAnswers: (p) => set({ answers: {
		...get().answers,
		...p
	} }),
	patchIntent: (p) => set({ answers: {
		...get().answers,
		intent: {
			...get().answers.intent,
			...p
		}
	} }),
	setTheme: (theme) => {
		if (typeof document !== "undefined") {
			document.documentElement.setAttribute("data-theme", theme);
			document.body.setAttribute("data-theme", theme);
		}
		set({ theme });
	},
	setAnimationsEnabled: (animationsEnabled) => {
		if (typeof document !== "undefined") {
			document.documentElement.dataset.animations = String(animationsEnabled);
			document.body.dataset.animations = String(animationsEnabled);
		}
		set({ animationsEnabled });
	},
	setHouseName: (houseName) => set({ houseName }),
	setActiveResident: (id) => {
		const res = get().residents.find((r) => r.id === id);
		if (res && typeof document !== "undefined") {
			if (res.themeDesign) {
				document.documentElement.setAttribute("data-theme-design", res.themeDesign);
				document.body.setAttribute("data-theme-design", res.themeDesign);
			}
			if (res.motionStyle) {
				document.documentElement.setAttribute("data-motion", res.motionStyle);
				document.body.setAttribute("data-motion", res.motionStyle);
			}
			if (res.accentColor) {
				document.documentElement.setAttribute("data-theme", res.accentColor);
				document.body.setAttribute("data-theme", res.accentColor);
			}
		}
		set({
			activeResidentId: id,
			...res?.watchProgress && Object.keys(res.watchProgress).length > 0 ? { watchProgress: res.watchProgress } : {}
		});
	},
	dismissRequest: (id) => {
		const s = get();
		const current = s.dismissedRequestIds || [];
		set({
			dismissedRequestIds: current.includes(id) ? current : [...current, id],
			requests: (s.requests || []).filter((r) => r.id !== id)
		});
	},
	dismissAllCompletedRequests: () => {
		const s = get();
		const completedIds = new Set((s.requests || []).filter((r) => r.status === "available" || r.engine === "downloaded" || r.status === "failed").map((r) => r.id).filter(Boolean));
		const current = s.dismissedRequestIds || [];
		set({
			dismissedRequestIds: [.../* @__PURE__ */ new Set([...current, ...completedIds])],
			requests: (s.requests || []).filter((r) => !completedIds.has(r.id))
		});
	},
	addResident: (name, avatar, pin, isKids) => {
		const id = uid("res");
		const newRes = {
			id,
			name: name.trim() || "Resident",
			avatar: avatar || "clapperboard",
			pin: pin?.trim() || void 0,
			isGuest: false,
			isKids: Boolean(isKids),
			hideKidsContent: isKids ? false : true,
			watchlist: [],
			watchProgress: {}
		};
		set({
			residents: [...get().residents, newRes],
			activeResidentId: id
		});
	},
	patchResident: (id, patch) => {
		set({ residents: get().residents.map((r) => r.id === id ? {
			...r,
			...patch
		} : r) });
	},
	removeResident: (id) => {
		const remaining = get().residents.filter((r) => r.id !== id);
		const fallbackId = remaining[0]?.id ?? "res-guest";
		set({
			residents: remaining,
			activeResidentId: get().activeResidentId === id ? fallbackId : get().activeResidentId
		});
	},
	toggleWatchlist: (titleId, residentId) => {
		const s = get();
		const rid = residentId ?? s.activeResidentId;
		set({ residents: s.residents.map((r) => {
			if (r.id !== rid) return r;
			const has = r.watchlist.includes(titleId);
			return {
				...r,
				watchlist: has ? r.watchlist.filter((id) => id !== titleId) : [...r.watchlist, titleId]
			};
		}) });
	},
	toggleKidsTitle: (titleId) => {
		const cur = get().kidsTitleIds;
		const has = cur.includes(titleId);
		set({ kidsTitleIds: has ? cur.filter((id) => id !== titleId) : [...cur, titleId] });
		if (typeof fetch !== "undefined") fetch("/api/kids/toggle", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				titleId,
				approved: !has
			})
		}).catch(() => {});
	},
	giftKidsTitle: (titleId, giftedBy = "Mom & Dad") => {
		const curGifted = { ...get().kidsGiftedTitles };
		curGifted[titleId] = {
			giftedBy,
			timestamp: Date.now()
		};
		const curKids = get().kidsTitleIds;
		set({
			kidsGiftedTitles: curGifted,
			kidsTitleIds: curKids.includes(titleId) ? curKids : [...curKids, titleId]
		});
		if (typeof fetch !== "undefined") fetch("/api/kids/gift", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				titleId,
				giftedBy,
				action: "gift"
			})
		}).catch(() => {});
	},
	ungiftKidsTitle: (titleId) => {
		const curGifted = { ...get().kidsGiftedTitles };
		delete curGifted[titleId];
		set({ kidsGiftedTitles: curGifted });
		if (typeof fetch !== "undefined") fetch("/api/kids/gift", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				titleId,
				action: "ungift"
			})
		}).catch(() => {});
	},
	syncKidsGifts: async () => {
		try {
			if (typeof fetch !== "undefined") {
				const res = await fetch("/api/kids/gifts");
				if (res.ok) {
					const data = await res.json();
					if (data.ok && data.gifted) set({ kidsGiftedTitles: data.gifted });
				}
			}
		} catch {}
	},
	setActiveRemote: (patch) => {
		set({ activeRemote: {
			...get().activeRemote,
			...patch
		} });
	},
	startBuild: () => {
		const answers = get().answers;
		const build = buildPlan(answers);
		if (build[0]) build[0].status = "running";
		set({
			phase: "building",
			build,
			buildLogOpen: false,
			users: [{
				id: "u-admin",
				name: answers.adminName.trim() || "Admin",
				role: "admin"
			}],
			adapter: makeAdapter(answers)
		});
	},
	tick: () => {},
	openReelOS: () => set({
		phase: "running",
		provisioned: true,
		adapter: get().adapter.status === "offline" ? makeAdapter(get().answers) : get().adapter
	}),
	requestTitle: (titleId, season) => {
		const s = get();
		if (s.requests.find((r) => r.titleId === titleId && (season == null || r.season === season) && r.status !== "failed")) return;
		const title = getTitle(titleId) ?? get().remoteTitles.find((t) => t.id === titleId);
		if (!title) return;
		showToast("Requested");
		const fail = s.answers.quality === "4k" && title.maxQuality !== "4k";
		const requester = s.users.find((u) => u.role === "admin")?.name ?? "Ada";
		const local = s.answers.source === "local-vpn";
		const cached = !local && titleInCache(title);
		const via = fail ? void 0 : local ? "local" : cached ? "cache" : "uncached";
		const rec = {
			id: uid("req"),
			titleId,
			status: fail ? "failed" : "waiting",
			progress: 0,
			reason: fail ? "No release matches your quality floor" : void 0,
			season,
			createdAt: Date.now(),
			updatedAt: Date.now(),
			requester,
			via,
			release: fail ? void 0 : syntheticRelease(title, s.answers.quality)
		};
		const activity = fail ? [event("fail", `${title.title} — no release matches your quality floor`, titleId), ...s.activity] : cached ? [
			event("grab", `Cache hit — ${title.title} on ${sourceLabel[s.answers.source]}`, titleId),
			event("request", `${requester} requested ${title.title}`, titleId),
			...s.activity
		] : [event("request", `${requester} requested ${title.title}`, titleId), ...s.activity];
		set({
			requests: [rec, ...s.requests],
			activity: activity.slice(0, 40)
		});
	},
	cancelRequest: (id) => {
		const cur = get().requests;
		const target = cur.find((r) => r.id === id);
		set({ requests: cur.filter((r) => r.id !== id) });
		showToast("Request cancelled");
		fetch("/api/request", {
			method: "DELETE",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				id,
				titleId: target?.titleId,
				tmdb: target?.tmdb,
				mediaType: target?.mediaType,
				season: target?.season
			})
		}).catch(() => {});
	},
	retryRequest: (id) => {
		const s = get();
		const row = s.requests.find((r) => r.id === id);
		set({ requests: s.requests.map((r) => r.id === id ? {
			...r,
			status: "waiting",
			progress: 0,
			reason: void 0,
			updatedAt: Date.now()
		} : r) });
		const titleId = String(row?.titleId || "");
		if (!titleId.startsWith("tmdb-")) return;
		const tv = titleId.startsWith("tmdb-tv-");
		const tmdb = Number(tv ? titleId.slice(8) : titleId.slice(5));
		if (!Number.isFinite(tmdb) || tmdb <= 0) return;
		fetch("/api/request", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				titleId,
				mediaType: tv ? "tv" : "movie",
				tmdb,
				season: row?.season
			})
		}).catch(() => {});
	},
	setWatchProgress: (titleId, v) => {
		const s = get();
		const active = s.residents.find((r) => r.id === s.activeResidentId);
		set({
			watchProgress: {
				...s.watchProgress,
				[titleId]: v
			},
			residents: active && !active.isGuest ? s.residents.map((r) => r.id === active.id ? {
				...r,
				watchProgress: {
					...r.watchProgress,
					[titleId]: v
				}
			} : r) : s.residents
		});
	},
	clearWatchProgress: (titleId) => {
		const s = get();
		const nextWatch = { ...s.watchProgress };
		delete nextWatch[titleId];
		const active = s.residents.find((r) => r.id === s.activeResidentId);
		set({
			watchProgress: nextWatch,
			residents: active && !active.isGuest ? s.residents.map((r) => {
				if (r.id !== active.id) return r;
				const resWatch = { ...r.watchProgress };
				delete resWatch[titleId];
				return {
					...r,
					watchProgress: resWatch
				};
			}) : s.residents
		});
	},
	patchSettings: (p) => set({ settings: {
		...get().settings,
		...p
	} }),
	addUser: (name) => {
		const n = name.trim();
		if (!n) return;
		set({ users: [...get().users, {
			id: uid("u"),
			name: n,
			role: "member"
		}] });
	},
	removeUser: (id) => set({ users: get().users.filter((u) => u.id !== id) }),
	loadLab: () => set({ ...labState() }),
	startRepair: () => set({
		phase: "wizard",
		wizardStep: 1
	}),
	factoryReset: () => set({
		...initial,
		hydrated: true,
		shelfReady: true
	}),
	syncUpdateFromBox: () => {
		fetch("/api/update/status", { cache: "no-store" }).then((r) => r.json()).then((st) => {
			const cur = get();
			const last = (st.log || "").trim().split("\n").pop() || "";
			if (st.library && typeof st.library === "object") set({ libraryCatchup: normalizeLibraryCatchup(st.library) });
			if (st.running) {
				const steps = (cur.update.steps?.length ? cur.update.steps : updatePlan()).map((x) => ({ ...x }));
				if (steps[0]) {
					steps[0].status = "running";
					steps[0].label = "Configuring this house";
					steps[0].log = last.slice(0, 160);
				}
				set({ update: {
					...cur.update,
					status: "applying",
					current: st.local || cur.update.current,
					target: st.target || cur.update.target,
					steps,
					notes: []
				} });
				return;
			}
			if (cur.update.status === "applying") {
				set({ update: {
					...cur.update,
					status: "current",
					current: st.local || cur.update.current,
					target: null,
					steps: (cur.update.steps || []).map((x) => ({
						...x,
						status: "done"
					})),
					notes: []
				} });
				return;
			}
			if (st.local && st.local !== cur.update.current && cur.update.status !== "checking") set({ update: {
				...cur.update,
				current: st.local
			} });
		}).catch(() => {});
	},
	checkForUpdate: () => {
		const s = get();
		if (s.update.status === "checking" || s.update.status === "applying") return;
		set({ update: {
			...s.update,
			status: "checking",
			checkedAt: Date.now()
		} });
		fetch("/api/update/check", { cache: "no-store" }).then((r) => r.json()).then((r) => {
			const cur = get();
			const pending = Array.isArray(r.pendingNotes) ? r.pendingNotes : Array.isArray(r.notes) ? r.notes : [];
			if (r.ok && r.available) set({ update: {
				...cur.update,
				status: "available",
				current: r.local || cur.update.current,
				target: r.remote || null,
				notes: pending,
				rollback: r.rollback === true,
				checkedAt: Date.now()
			} });
			else set({ update: {
				...cur.update,
				status: r.ok ? "current" : "error",
				current: r.local || cur.update.current,
				target: null,
				notes: r.ok ? [] : [r.error ?? "Channel unreachable"],
				rollback: false,
				checkedAt: Date.now()
			} });
		}).catch((e) => {
			set({ update: {
				...get().update,
				status: "error",
				notes: [String(e)],
				checkedAt: Date.now()
			} });
		});
	},
	startUpdate: () => {
		const s = get();
		if (s.update.status !== "available") return;
		const steps = updatePlan();
		if (steps[0]) steps[0].status = "running";
		const target = s.update.target;
		set({ update: {
			...s.update,
			status: "applying",
			steps
		} });
		fetch("/api/update/apply", { method: "POST" }).then((r) => r.json()).then((j) => {
			if (!j.ok) {
				set({ update: {
					...get().update,
					status: "error",
					notes: [j.error || "apply did not start"]
				} });
				return;
			}
			let misses = 0;
			const tick = () => {
				fetch("/api/update/status", { cache: "no-store" }).then((r) => r.json()).then((st) => {
					const cur = get();
					const steps2 = (cur.update.steps || []).map((x) => ({ ...x }));
					const last = (st.log || "").trim().split("\n").pop() || "";
					if (st.library && typeof st.library === "object") set({ libraryCatchup: normalizeLibraryCatchup(st.library) });
					if (steps2[0]) {
						steps2[0].status = "running";
						steps2[0].log = last.slice(0, 160);
					}
					if (st.local && target && st.local === target && !st.running) {
						set({ update: {
							...cur.update,
							status: "current",
							current: st.local,
							target: null,
							steps: steps2.map((x) => ({
								...x,
								status: "done"
							})),
							notes: []
						} });
						return;
					}
					if (st.running) misses = 0;
					else misses += 1;
					if (st.running || misses < 24) {
						set({ update: {
							...cur.update,
							status: "applying",
							steps: steps2,
							notes: []
						} });
						window.setTimeout(tick, 2500);
						return;
					}
					set({ update: {
						...cur.update,
						status: "error",
						current: st.local || cur.update.current,
						notes: [last.slice(0, 160) || "Apply ended. Version did not change."],
						steps: steps2
					} });
				}).catch(() => window.setTimeout(tick, 4e3));
			};
			window.setTimeout(tick, 2e3);
		}).catch((e) => {
			set({ update: {
				...get().update,
				status: "error",
				notes: [String(e)]
			} });
		});
	},
	pingAdapter: () => {
		fetch("/api/ping", { cache: "no-store" }).then((r) => r.json()).then((j) => {
			const s = get();
			set({
				adapter: {
					...s.adapter,
					pingMs: j.pingMs || 0,
					lastPing: Date.now(),
					status: j.ok ? "healthy" : "offline"
				},
				activity: [event("system", j.ok ? `Decypharr ${j.pingMs}ms` : "Decypharr offline"), ...s.activity].slice(0, 40)
			});
		}).catch(() => {
			const s = get();
			set({
				adapter: {
					...s.adapter,
					status: "offline",
					lastPing: Date.now()
				},
				activity: [event("system", "Decypharr unreachable"), ...s.activity].slice(0, 40)
			});
		});
	},
	addIndexer: (name, url, key) => {
		const n = name.trim();
		const u = url.trim();
		if (!n || !u) return;
		set({
			indexers: [...get().indexers, {
				id: uid("idx"),
				name: n,
				url: u,
				key: key.trim()
			}],
			activity: [event("index", `Indexer added: ${n}`), ...get().activity].slice(0, 40)
		});
	},
	removeIndexer: (id) => set({ indexers: get().indexers.filter((i) => i.id !== id) }),
	pasteRelease: (titleId, raw) => {
		const hash = normalizeRelease(raw);
		if (!hash) return false;
		const s = get();
		const title = getTitle(titleId) ?? s.remoteTitles.find((t) => t.id === titleId);
		if (!title) return false;
		const requester = s.users.find((u) => u.role === "admin")?.name ?? "Ada";
		set({
			requests: [{
				id: uid("req"),
				titleId,
				status: "waiting",
				progress: 0,
				createdAt: Date.now(),
				updatedAt: Date.now(),
				requester,
				via: s.answers.source === "local-vpn" ? "local" : "uncached",
				release: hash
			}, ...s.requests.filter((r) => !(r.titleId === titleId && r.status !== "available"))],
			activity: [event("request", `${requester} handed a hash for ${title.title} to the adapter`, titleId), ...s.activity].slice(0, 40)
		});
		return true;
	},
	rememberTitles: (titles) => {
		rememberCatalogTitles(titles);
		set({ remoteTitles: mergeRemoteTitles(get().remoteTitles, titles) });
	},
	dropLibraryTitle: (titleId, extraIds = []) => {
		const s = get();
		const overlay = dropLibraryOverlay({
			shelf: s.shelf,
			library: s.library,
			requests: s.requests
		}, titleId, extraIds);
		showToast("Removed");
		set({
			shelf: overlay.shelf,
			library: overlay.library,
			requests: overlay.requests
		});
	},
	hydrateShelf: (opts) => {
		const limit = opts?.limit;
		const force = Boolean(opts?.force);
		const fresh = Boolean(opts?.fresh) || force;
		if (!force && get().shelfReady) return;
		const key = `${force ? "f" : ""}${limit ? `n${limit}` : "all"}`;
		if (shelfFetches.has(key)) return;
		const q = new URLSearchParams();
		if (limit) q.set("limit", String(limit));
		if (fresh) q.set("fresh", "1");
		const qs = q.toString() ? `?${q.toString()}` : "";
		const p = fetch(`/api/library${qs}`, { cache: "no-store" }).then((r) => r.json()).then((j) => {
			const titles = Array.isArray(j.titles) ? j.titles : [];
			const resume = Array.isArray(j.continueWatching) ? j.continueWatching : [];
			rememberCatalogTitles([...titles, ...resume]);
			const cur = get();
			const shelf = mergeShelf(cur.shelf, titles, Boolean(limit));
			const library = [...new Set(shelf.map((t) => t.id))];
			const requests = overlayLibraryPresence(cur.requests, { titles: shelf });
			const syncedWatch = watchProgressFromResume(j.continueWatching);
			set({
				shelf,
				shelfError: j.error || null,
				shelfReady: true,
				library,
				requests,
				...syncedWatch ? { watchProgress: syncedWatch } : {}
			});
		}).catch((e) => set({
			shelfError: String(e),
			shelfReady: true
		})).finally(() => {
			shelfFetches.delete(key);
		});
		shelfFetches.set(key, p);
		fetch("/api/profiles", { cache: "no-store" }).then((r) => r.json()).then((data) => {
			if (Array.isArray(data?.residents) && data.residents.length > 0) set({
				residents: data.residents,
				...data.activeResidentId ? { activeResidentId: data.activeResidentId } : {}
			});
		}).catch(() => {});
	}
}), {
	name: "reelos-v4",
	storage: createJSONStorage(() => localStorage),
	skipHydration: true,
	partialize: (s) => ({
		phase: s.phase,
		wizardStep: s.wizardStep,
		answers: s.answers,
		theme: s.theme,
		animationsEnabled: s.animationsEnabled,
		houseName: s.houseName,
		residents: s.residents,
		activeResidentId: s.activeResidentId,
		dismissedRequestIds: s.dismissedRequestIds,
		kidsTitleIds: s.kidsTitleIds,
		kidsGiftedTitles: s.kidsGiftedTitles,
		build: s.build,
		buildLogOpen: s.buildLogOpen,
		provisioned: s.provisioned,
		requests: s.requests,
		library: s.library,
		shelf: s.shelf,
		ipv4: s.ipv4,
		watch: s.watch,
		tailscaleIp: s.tailscaleIp,
		watchProgress: s.watchProgress,
		activity: s.activity,
		users: s.users,
		settings: s.settings,
		adapter: s.adapter,
		indexers: s.indexers,
		remoteTitles: s.remoteTitles
	}),
	onRehydrateStorage: () => (state) => {
		if (!state) return;
		state.hydrated = true;
		if (state.provisioned) state.phase = "running";
		state.update = idleUpdate();
		state.libraryCatchup = idleLibraryCatchup();
		if (state.shelf?.length) state.shelfReady = true;
		if (state.residents && !state.residents.some((r) => r.isKids || r.id === "res-kids")) state.residents.push({
			id: "res-kids",
			name: "Kids",
			avatar: "sparkles",
			isGuest: false,
			isKids: true,
			watchlist: [],
			watchProgress: {}
		});
		if (state.residents) for (const r of state.residents) {
			if (r.id === "res-primary" || Array.isArray(r.assignedTitleIds) && r.assignedTitleIds.some((id) => id.startsWith("tmdb-693134"))) r.assignedTitleIds = [];
			if (r.id === "res-sarah" && Array.isArray(r.assignedTitleIds) && r.assignedTitleIds.some((id) => id.startsWith("tmdb-346698"))) r.assignedTitleIds = [];
		}
		if (!Array.isArray(state.kidsTitleIds)) state.kidsTitleIds = [];
		if (typeof state.kidsGiftedTitles !== "object" || state.kidsGiftedTitles === null) state.kidsGiftedTitles = {};
		const dismissed = new Set(state.dismissedRequestIds || []);
		if (state.requests?.length && dismissed.size) state.requests = state.requests.filter((r) => !dismissed.has(r.id));
		if (typeof document !== "undefined") {
			document.documentElement.dataset.animations = String(state.animationsEnabled !== false);
			document.body.dataset.animations = String(state.animationsEnabled !== false);
			document.documentElement.setAttribute("data-theme", state.theme || "gold-hashed");
			document.body.setAttribute("data-theme", state.theme || "gold-hashed");
		}
	}
}));
if (typeof window !== "undefined") window.useReelStore = useReelStore;
var sourceLabel = {
	torbox: "TorBox",
	"real-debrid": "Real-Debrid",
	alldebrid: "AllDebrid",
	premiumize: "Premiumize",
	"local-vpn": "Local + VPN"
};
if (typeof window !== "undefined") window.useReelStore = useReelStore;
//#endregion
//#region node_modules/.nitro/vite/services/ssr/assets/source-access-db-SXrMj.js
var PUBLIC_DOMAIN_SOURCES = {
	"night-of-the-living-dead-1968": {
		kind: "public_domain",
		uri: "https://archive.org/download/night_of_the_living_dead_dvd/Night.mp4",
		verified: true
	},
	"charade-1963": {
		kind: "public_domain",
		uri: "https://archive.org/download/Charade1963/Charade1963.mp4",
		verified: true
	},
	"his-girl-friday-1940": {
		kind: "public_domain",
		uri: "https://archive.org/download/HisGirlFriday1940/HisGirlFriday1940.mp4",
		verified: true
	},
	"a-star-is-born-1937": {
		kind: "public_domain",
		uri: "https://archive.org/download/AStarIsBorn1937/AStarIsBorn1937.mp4",
		verified: true
	}
};
var DEFAULT_DEBRID_CONNECTION = {
	enabled: false,
	provider: "torbox",
	status: "disabled"
};
function publicPlaybackPath(titleId) {
	return Object.hasOwn(PUBLIC_DOMAIN_SOURCES, titleId) ? `/api/stream/public/${encodeURIComponent(titleId)}` : null;
}
function sourcesForExperienceTitle(titleId) {
	const publicSource = PUBLIC_DOMAIN_SOURCES[titleId];
	if (publicSource) return [publicSource];
	return [{
		kind: "debrid",
		verified: false
	}];
}
function sourceForLookupTitle(raw) {
	const kind = String(raw.sourceKind || "");
	if (kind !== "public_domain" && kind !== "public_catalog") return null;
	return {
		kind,
		uri: String(raw.sourceUri || raw.catalogUrl || "") || void 0,
		verified: raw.sourceVerified === true
	};
}
function isDebridConnected(connection) {
	return connection.enabled && connection.status === "connected";
}
function sourceIsAccessible(source, connection) {
	if (!source.verified) return false;
	if (source.kind === "debrid") return isDebridConnected(connection) && (!source.provider || source.provider === connection.provider);
	if (source.kind === "public_catalog") return false;
	return true;
}
function titleIsAccessible(titleId, connection) {
	return sourcesForExperienceTitle(titleId).some((source) => sourceIsAccessible(source, connection));
}
function titleCanUseProvider(titleId, connection) {
	return isDebridConnected(connection) && connection.provider === "torbox" && sourcesForExperienceTitle(titleId).some((source) => source.kind === "debrid" && (!source.provider || source.provider === connection.provider));
}
function accessibleTitleIds(titleIds, connection) {
	return titleIds.filter((titleId) => titleIsAccessible(titleId, connection));
}
function providerDisabledConnection(connection) {
	return {
		...connection,
		enabled: false,
		status: "disabled"
	};
}
//#endregion
//#region node_modules/.nitro/vite/services/ssr/assets/companion-deep-link-D0VoHylB.js
var SAFE_MEDIA_ID = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,159}$/;
function positiveInteger(value, maximum) {
	if (value === void 0 || value === null || value === "") return void 0;
	const parsed = typeof value === "number" ? value : Number(value);
	return Number.isSafeInteger(parsed) && parsed > 0 && parsed <= maximum ? parsed : void 0;
}
/**
* Keeps legacy companion query links usable without allowing arbitrary values
* to become a media lookup or service path.
*/
function parseCompanionDeepLink(search) {
	const id = typeof search.id === "string" ? search.id.trim() : "";
	if (!SAFE_MEDIA_ID.test(id)) return void 0;
	return {
		id,
		season: positiveInteger(search.season, 999),
		episode: positiveInteger(search.episode, 9999)
	};
}
/**
* Resolves a link only against titles already projected through the active
* profile's authenticated library/catalog view. This is presentation context;
* server-side playback and companion actions still perform their own checks.
*/
function resolveCompanionSeed(link, titles, connection, isChild) {
	if (!link) return void 0;
	const title = titles.find((candidate) => candidate.id === link.id || candidate.playbackId === link.id);
	if (!title) return void 0;
	if (!title.sources.some((source) => sourceIsAccessible(source, connection))) return;
	if (isChild && title.family !== true) return void 0;
	const episodic = title.kind === "series";
	return {
		title,
		season: episodic ? link.season : void 0,
		episode: episodic ? link.episode : void 0
	};
}
//#endregion
//#region node_modules/.nitro/vite/services/ssr/assets/router-M-yvs45k.js
var import_jsx_runtime = require_jsx_runtime();
var __defProp = Object.defineProperty;
var __exportAll = (all, no_symbols) => {
	let target = {};
	for (var name in all) __defProp(target, name, {
		get: all[name],
		enumerable: true
	});
	if (!no_symbols) __defProp(target, Symbol.toStringTag, { value: "Module" });
	return target;
};
function AppErrorComponent({ error }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
		className: "flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "text-red-500",
				"aria-hidden": "true",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, {
					className: "size-10",
					strokeWidth: 2
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "text-lg font-semibold",
				children: "Something went wrong"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "max-w-md text-sm break-words text-zinc-500 dark:text-zinc-400",
				children: error.message || "An unexpected error occurred. Try reloading the page."
			})
		]
	});
}
/**
* App-wide client provider mounted once near the root (in `src/routes/__root.tsx`):
*
*   <AuthProvider><Outlet /></AuthProvider>
*
* Better Auth's React client (`@/lib/auth/client`) needs NO context provider —
* its `useSession()` works standalone — so this is a passthrough today. It's
* kept as the single, stable mount point for any future client-side providers
* (e.g. a toast or theme provider) without churning the root shell.
*/
function AuthProvider({ children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_jsx_runtime.Fragment, { children });
}
var buttonVariants = cva("inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-[background-color,box-shadow,color,transform,opacity] duration-150 ease-out disabled:pointer-events-none disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:shrink-0 focus-visible:outline-none focus-visible:shadow-[0_0_0_2px_var(--color-background),0_0_0_4px_var(--color-gold)] active:not-disabled:scale-[0.98]", {
	variants: {
		variant: {
			gold: "bg-gold text-gold-fg hover:bg-gold-bright",
			ghost: "bg-transparent text-foreground hover:bg-foreground/6 shadow-[var(--shadow-border)] hover:shadow-[var(--shadow-border-hover)]",
			quiet: "bg-transparent text-muted hover:text-foreground hover:bg-foreground/5",
			live: "bg-live text-background hover:brightness-110",
			danger: "bg-danger/15 text-danger hover:bg-danger/25"
		},
		size: {
			sm: "h-9 rounded-lg px-3.5 text-sm",
			md: "h-11 rounded-xl px-5 text-sm",
			lg: "h-12 rounded-2xl px-6 text-[15px]",
			icon: "size-11 rounded-xl"
		}
	},
	defaultVariants: {
		variant: "gold",
		size: "md"
	}
});
function Button({ className, variant, size, asChild = false, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(asChild ? Slot : "button", {
		className: cn(buttonVariants({
			variant,
			size
		}), className),
		...props
	});
}
var ErrorBoundary = class extends import_react.Component {
	state = {
		hasError: false,
		error: null,
		errorInfo: null,
		showDetails: false
	};
	static getDerivedStateFromError(error) {
		return {
			hasError: true,
			error
		};
	}
	componentDidCatch(error, errorInfo) {
		console.error("ReelOS ErrorBoundary caught an unhandled error:", error, errorInfo);
		this.setState({ errorInfo });
	}
	handleReset = () => {
		this.setState({
			hasError: false,
			error: null,
			errorInfo: null
		});
		window.location.reload();
	};
	handleGoHome = () => {
		this.setState({
			hasError: false,
			error: null,
			errorInfo: null
		});
		window.location.href = "/";
	};
	render() {
		if (this.state.hasError) {
			if (this.props.fallback) return this.props.fallback;
			return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ErrorFallbackView, {
				error: this.state.error,
				errorInfo: this.state.errorInfo,
				showDetails: this.state.showDetails,
				onToggleDetails: () => this.setState((s) => ({ showDetails: !s.showDetails })),
				onReset: this.handleReset,
				onGoHome: this.handleGoHome
			});
		}
		return this.props.children;
	}
};
function ErrorFallbackView({ error, errorInfo, showDetails, onToggleDetails, onReset, onGoHome }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex min-h-[80vh] flex-col items-center justify-center p-6 text-center animate-in fade-in duration-300",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "relative mb-6 flex size-20 items-center justify-center rounded-3xl border border-gold/30 bg-gold/10 shadow-2xl shadow-gold/10",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, { className: "size-10 text-gold" })
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl",
				children: "Momentary Interface Hiccup"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-2.5 max-w-md text-sm text-muted",
				children: "ReelOS isolated this visual hiccup. Your media library, storage, and background streams remain safe and running smoothly."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-8 flex flex-wrap items-center justify-center gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
					variant: "gold",
					size: "md",
					onClick: onReset || (() => window.location.reload()),
					className: "h-11 px-6 rounded-xl font-semibold shadow-lg shadow-gold/20",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RefreshCw, { className: "mr-2 size-4" }), "Reload Screen"]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
					variant: "quiet",
					size: "md",
					onClick: onGoHome || (() => window.location.href = "/"),
					className: "h-11 px-6 rounded-xl font-medium border border-border",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(House, { className: "mr-2 size-4" }), "Return Home"]
				})]
			}),
			error ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-10 w-full max-w-lg text-left",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					type: "button",
					onClick: onToggleDetails,
					className: "flex items-center gap-1.5 text-xs text-muted hover:text-foreground transition-colors mx-auto",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: showDetails ? "Hide technical diagnostic" : "Show technical diagnostic" }), showDetails ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronUp, { className: "size-3.5" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronDown, { className: "size-3.5" })]
				}), showDetails ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-3 overflow-hidden rounded-2xl border border-border/80 bg-raised/80 p-4 shadow-inner text-xs font-mono backdrop-blur-md",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-red-400 font-semibold break-all",
						children: error.toString()
					}), errorInfo?.componentStack ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("pre", {
						className: "mt-2 max-h-48 overflow-y-auto text-[11px] text-faint whitespace-pre-wrap",
						children: errorInfo.componentStack
					}) : null]
				}) : null]
			}) : null
		]
	});
}
/** TanStack Router Root errorComponent adapter */
function RootRouteErrorFallback({ error }) {
	const err = error instanceof Error ? error : new Error(String(error || "Unknown router error"));
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ErrorFallbackView, {
		error: err,
		onReset: () => window.location.reload(),
		onGoHome: () => window.location.href = "/"
	});
}
function isGrokEmbedderOrigin(origin) {
	try {
		const url = new URL(origin);
		if (url.protocol !== "https:" && url.protocol !== "http:") return false;
		const host = url.hostname.toLowerCase();
		if (host === "grok.com" || host.endsWith(".grok.com")) return true;
		if (host === "localhost" || host === "127.0.0.1" || host === "[::1]") return true;
		return false;
	} catch {
		return false;
	}
}
function isSandboxPreviewGuestHost(hostname) {
	const host = hostname.toLowerCase();
	return host === "grok-sandbox.com" || host.endsWith(".grok-sandbox.com");
}
function isRemintPreviewPair(guestHost, parentHost) {
	const guest = guestHost.toLowerCase();
	const parent = parentHost.toLowerCase();
	const i = guest.indexOf(".preview.");
	if (i <= 0) return false;
	const label = guest.slice(0, i);
	const rest = guest.slice(i + 9);
	if (label.includes(".") || !rest.includes(".")) return false;
	return parent === rest || parent === `grok.${rest}`;
}
function resolveParentEmbedderOrigin(parentIsSelf, referrer, ancestorOrigin, guestHostname = "") {
	if (parentIsSelf) return null;
	for (const candidate of [referrer, ancestorOrigin ?? ""].filter(Boolean)) try {
		const url = new URL(candidate.includes("://") ? candidate : `https://${candidate}`);
		if (url.protocol !== "https:" && url.protocol !== "http:") continue;
		if (isGrokEmbedderOrigin(url.origin)) return url.origin;
		if (isSandboxPreviewGuestHost(guestHostname) || isRemintPreviewPair(guestHostname, url.hostname)) return url.origin;
	} catch {}
	return null;
}
/**
* Guest side of the grok-web ↔ sandbox preview postMessage bridge.
*
* Activates only when this page is framed by an allowlisted Grok embedder.
* Top-level runs (download/export, local `npm run dev`, deployed sites) noop.
*/
var PREVIEW_BRIDGE_CHANNEL = "grok-preview-bridge";
var EnvelopeSchema = object({
	channel: literal(PREVIEW_BRIDGE_CHANNEL),
	version: number().int().positive(),
	type: string().min(1)
});
var HelloSchema = EnvelopeSchema.extend({ type: literal("hello") });
var NavigateSchema = EnvelopeSchema.extend({
	type: literal("navigate"),
	path: string().min(1)
});
var HistorySchema = EnvelopeSchema.extend({
	type: literal("history"),
	delta: union([literal(-1), literal(1)])
});
function isSafeBridgePath(path) {
	if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) return false;
	try {
		return new URL(path, "https://preview.invalid").origin === "https://preview.invalid";
	} catch {
		return false;
	}
}
/**
* Install host↔guest messaging. Returns a dispose function.
* Noops (returns a no-op dispose) when not embedded under a Grok parent.
*/
function installPreviewHostBridge(options = {}) {
	if (typeof window === "undefined") return () => {};
	const ancestorOrigin = typeof location.ancestorOrigins !== "undefined" && location.ancestorOrigins.length > 0 ? location.ancestorOrigins[0] : null;
	const parentOrigin = resolveParentEmbedderOrigin(window.parent === window, document.referrer, ancestorOrigin, window.location.hostname);
	if (parentOrigin === null) return () => {};
	const ROOT_STATE_KEY = "__grokPreviewBridgeRoot";
	const originalPushState = window.history.pushState.bind(window.history);
	const originalReplaceState = window.history.replaceState.bind(window.history);
	const isAtHistoryRoot = () => {
		const state = window.history.state;
		return Boolean(state && typeof state === "object" && state[ROOT_STATE_KEY] === true);
	};
	try {
		const current = window.history.state;
		if (!(current !== null && typeof current === "object" && Object.prototype.hasOwnProperty.call(current, ROOT_STATE_KEY))) {
			const isRoot = window.history.length <= 1;
			originalReplaceState(current && typeof current === "object" ? {
				...current,
				[ROOT_STATE_KEY]: isRoot
			} : { [ROOT_STATE_KEY]: isRoot }, "", window.location.href);
		}
	} catch {}
	const post = (message) => {
		window.parent.postMessage(message, parentOrigin);
	};
	const reportLocation = () => {
		post({
			channel: PREVIEW_BRIDGE_CHANNEL,
			version: 1,
			type: "location",
			path: window.location.pathname || "/",
			search: window.location.search,
			hash: window.location.hash
		});
	};
	const reportRoutes = () => {
		const paths = options.getRoutePaths?.() ?? [];
		post({
			channel: PREVIEW_BRIDGE_CHANNEL,
			version: 1,
			type: "routes",
			paths
		});
	};
	const defaultNavigate = (path) => {
		if (!isSafeBridgePath(path)) return;
		try {
			const url = new URL(path, window.location.origin);
			if (url.origin !== window.location.origin) return;
			const next = `${url.pathname}${url.search}${url.hash}`;
			window.history.pushState(window.history.state, "", next);
			window.dispatchEvent(new PopStateEvent("popstate", { state: window.history.state }));
		} catch {}
	};
	const navigate = (path) => {
		if (!isSafeBridgePath(path)) return;
		if (options.navigate) {
			options.navigate(path);
			return;
		}
		defaultNavigate(path);
	};
	const announce = () => {
		reportLocation();
		reportRoutes();
		post({
			channel: PREVIEW_BRIDGE_CHANNEL,
			version: 1,
			type: "ready"
		});
	};
	const onMessage = (event) => {
		if (event.source !== window.parent) return;
		if (event.origin !== parentOrigin) return;
		const envelope = EnvelopeSchema.safeParse(event.data);
		if (!envelope.success || envelope.data.version !== 1) return;
		if (envelope.data.type === "hello") {
			if (!HelloSchema.safeParse(event.data).success) return;
			announce();
			return;
		}
		if (envelope.data.type === "navigate") {
			const parsed = NavigateSchema.safeParse(event.data);
			if (!parsed.success) return;
			navigate(parsed.data.path);
			queueMicrotask(reportLocation);
			return;
		}
		if (envelope.data.type === "history") {
			const parsed = HistorySchema.safeParse(event.data);
			if (!parsed.success) return;
			if (parsed.data.delta === -1 && isAtHistoryRoot()) return;
			window.history.go(parsed.data.delta);
		}
	};
	const onPopState = () => {
		reportLocation();
	};
	const onHashChange = () => {
		reportLocation();
	};
	window.history.pushState = (data, unused, url) => {
		const next = data && typeof data === "object" ? {
			...data,
			[ROOT_STATE_KEY]: false
		} : data;
		originalPushState(next, unused, url);
		reportLocation();
	};
	window.history.replaceState = (data, unused, url) => {
		const next = isAtHistoryRoot() ? {
			...data && typeof data === "object" ? data : {},
			[ROOT_STATE_KEY]: true
		} : data;
		originalReplaceState(next, unused, url);
		reportLocation();
	};
	window.addEventListener("message", onMessage);
	window.addEventListener("popstate", onPopState);
	window.addEventListener("hashchange", onHashChange);
	announce();
	return () => {
		window.removeEventListener("message", onMessage);
		window.removeEventListener("popstate", onPopState);
		window.removeEventListener("hashchange", onHashChange);
		window.history.pushState = originalPushState;
		window.history.replaceState = originalReplaceState;
	};
}
/** Collect static path patterns from a TanStack route tree (best-effort). */
function collectRoutePathsFromTree(routeTree) {
	const paths = /* @__PURE__ */ new Set();
	const walk = (node) => {
		if (!node || typeof node !== "object") return;
		const record = node;
		const full = typeof record.fullPath === "string" ? record.fullPath : typeof record.path === "string" ? record.path : null;
		if (full !== null && full !== "") paths.add(full.startsWith("/") ? full : `/${full}`);
		else if (full === "") paths.add("/");
		const children = record.children;
		if (Array.isArray(children)) for (const child of children) walk(child);
		else if (children && typeof children === "object") for (const child of Object.values(children)) walk(child);
	};
	walk(routeTree);
	return [...paths];
}
/**
* Mount once in `__root.tsx` so the Grok preview chrome can drive navigation
* (and later receive registered routes). Noops when the app is not embedded.
*/
function PreviewHostBridge() {
	const router = useRouter();
	(0, import_react.useEffect)(() => {
		return installPreviewHostBridge({
			navigate: (path) => {
				router.history.push(path);
			},
			getRoutePaths: () => collectRoutePathsFromTree(router.routeTree)
		});
	}, [router]);
	return null;
}
var styles_default = "/assets/styles-BLVkQJ-8.css";
var APP_NAME = "ReelOS";
var Route$28 = createRootRoute({
	errorComponent: RootRouteErrorFallback,
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1, viewport-fit=cover"
			},
			{
				name: "apple-mobile-web-app-capable",
				content: "yes"
			},
			{
				name: "apple-mobile-web-app-status-bar-style",
				content: "black-translucent"
			},
			{
				name: "apple-mobile-web-app-title",
				content: "ReelOS"
			},
			{
				name: "mobile-web-app-capable",
				content: "yes"
			},
			{
				name: "format-detection",
				content: "telephone=no"
			},
			{ title: APP_NAME },
			{
				name: "description",
				content: "Install. Point. Stream. A personal media appliance."
			},
			{
				name: "theme-color",
				content: "#0B0D10"
			}
		],
		links: [
			{
				rel: "icon",
				type: "image/svg+xml",
				href: "/favicon.svg"
			},
			{
				rel: "stylesheet",
				href: styles_default
			},
			{
				rel: "manifest",
				href: "/manifest.webmanifest"
			},
			{
				rel: "apple-touch-icon",
				href: "/apple-touch-icon.png"
			},
			{
				rel: "preconnect",
				href: "https://fonts.googleapis.com"
			},
			{
				rel: "preconnect",
				href: "https://fonts.gstatic.com",
				crossOrigin: "anonymous"
			},
			{
				rel: "stylesheet",
				href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Outfit:wght@400;500;600;700&display=swap"
			}
		]
	}),
	component: RootDocument
});
function RootDocument() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("html", {
		lang: "en",
		className: "antialiased",
		suppressHydrationWarning: true,
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("head", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(HeadContent, {}) }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("body", {
			className: "film-grain bg-background text-foreground",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PreviewHostBridge, {}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AuthProvider, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Runtime, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChildRouteBoundary, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ErrorBoundary, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Outlet, {}) }) }) }) }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Scripts, {})
			]
		})]
	});
}
function ChildRouteBoundary({ children }) {
	const pathname = useRouterState({ select: (state) => state.location.pathname });
	const [authorizedPath, setAuthorizedPath] = (0, import_react.useState)("");
	(0, import_react.useEffect)(() => {
		if (pathname === "/") {
			setAuthorizedPath(pathname);
			return;
		}
		setAuthorizedPath("");
		const controller = new AbortController();
		const timeout = window.setTimeout(() => controller.abort(), 2500);
		fetch("/api/profiles", {
			cache: "no-store",
			signal: controller.signal
		}).then(async (response) => {
			if (!response.ok) throw new Error("Profile state unavailable");
			return response.json();
		}).then((payload) => {
			if ((payload.profiles?.find((profile) => profile.id === payload.activeId))?.isKids) {
				window.location.replace("/");
				return;
			}
			setAuthorizedPath(pathname);
		}).catch(() => window.location.replace("/")).finally(() => window.clearTimeout(timeout));
		return () => {
			window.clearTimeout(timeout);
			controller.abort();
		};
	}, [pathname]);
	if (pathname !== "/" && authorizedPath !== pathname) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("main", { className: "min-h-dvh bg-[#080809]" });
	return children;
}
function Runtime({ children }) {
	const arena = useReelStore((s) => s.settings.betaChannel);
	const theme = useReelStore((s) => s.theme);
	const animationsEnabled = useReelStore((s) => s.animationsEnabled !== false);
	const activeResidentId = useReelStore((s) => s.activeResidentId);
	const currentVibe = useReelStore((s) => s.residents).find((r) => r.id === activeResidentId)?.tasteVibe || "balanced";
	(0, import_react.useEffect)(() => {
		document.documentElement.classList.toggle("arena-on", arena);
		document.body.classList.toggle("arena-on", arena);
	}, [arena]);
	(0, import_react.useEffect)(() => {
		const t = theme || "gold-hashed";
		document.documentElement.setAttribute("data-theme", t);
		document.body.setAttribute("data-theme", t);
	}, [theme]);
	(0, import_react.useEffect)(() => {
		document.documentElement.dataset.animations = String(animationsEnabled);
		document.body.dataset.animations = String(animationsEnabled);
	}, [animationsEnabled]);
	(0, import_react.useEffect)(() => {
		document.documentElement.setAttribute("data-vibe", currentVibe);
		document.body.setAttribute("data-vibe", currentVibe);
	}, [currentVibe]);
	(0, import_react.useEffect)(() => {
		if (typeof window !== "undefined") {
			if (new URLSearchParams(window.location.search).has("reset")) {
				try {
					localStorage.clear();
					sessionStorage.clear();
				} catch {}
				useReelStore.getState().factoryReset();
				window.history.replaceState({}, document.title, window.location.pathname);
			}
		}
		Promise.resolve(useReelStore.persist.rehydrate()).catch(() => {}).then(async () => {
			const s = useReelStore.getState();
			s.setHydrated();
			s.setBootStep("local", "ok");
			s.setBootStep("house", "running");
			s.setBootStep("library", "running");
			s.setBootStep("requests", "running");
			s.syncUpdateFromBox();
			try {
				const ui = await fetch("/api/settings", {
					cache: "no-store",
					signal: AbortSignal.timeout(2500)
				}).then((r) => r.json());
				if (typeof ui?.betaChannel === "boolean") useReelStore.getState().patchSettings({ betaChannel: ui.betaChannel });
			} catch {}
			try {
				const gateStatus = await fetch("/api/gate/status", {
					cache: "no-store",
					signal: AbortSignal.timeout(2500)
				}).then((r) => r.json());
				if (gateStatus?.ok && !gateStatus.isLan && !gateStatus.isPaired) useReelStore.getState().setRemoteChallenged(true);
				else useReelStore.getState().setRemoteChallenged(false);
			} catch {}
			return fetch("/api/ready?limit=24", {
				cache: "no-store",
				signal: AbortSignal.timeout(4e3)
			}).then(async (r) => {
				if (r.status === 401) {
					if ((await r.json().catch(() => ({})))?.challenged) {
						useReelStore.getState().setRemoteChallenged(true);
						return;
					}
				}
				const ready = await r.json();
				useReelStore.getState().applyReadyPayload(ready);
			}).catch(() => {
				const cur = useReelStore.getState();
				cur.setBootStep("house", cur.provisioned ? "ok" : "fail");
				cur.setBootStep("library", cur.shelfReady ? "ok" : "fail");
				cur.setBootStep("requests", cur.requestsSeeded ? "ok" : "fail");
				if (cur.provisioned) cur.openReelOS();
			}).finally(() => {
				useReelStore.getState().setHydrated();
			});
		});
	}, []);
	(0, import_react.useEffect)(() => {
		const id = window.setInterval(() => {
			useReelStore.getState().tick();
		}, 480);
		return () => window.clearInterval(id);
	}, []);
	(0, import_react.useEffect)(() => {
		const id = window.setInterval(() => {
			useReelStore.getState().syncUpdateFromBox();
		}, 2500);
		return () => window.clearInterval(id);
	}, []);
	return children;
}
var $$splitComponentImporter$24 = () => import("./routes-DoEGn4NY.mjs");
var Route$27 = createFileRoute("/")({ component: lazyRouteComponent($$splitComponentImporter$24, "component") });
var $$splitComponentImporter$23 = () => import("./activity-CEk76eni.mjs");
var Route$26 = createFileRoute("/activity")({ component: lazyRouteComponent($$splitComponentImporter$23, "component") });
var $$splitComponentImporter$22 = () => import("./ambiance-D0XtyfXT.mjs");
var Route$25 = createFileRoute("/ambiance")({ component: lazyRouteComponent($$splitComponentImporter$22, "component") });
var $$splitComponentImporter$21 = () => import("./books-Bo8TbDaJ.mjs");
var Route$24 = createFileRoute("/books")({ component: lazyRouteComponent($$splitComponentImporter$21, "component") });
var $$splitComponentImporter$20 = () => import("./calibrate-COdqw-v8.mjs");
var Route$23 = createFileRoute("/calibrate")({ component: lazyRouteComponent($$splitComponentImporter$20, "component") });
var $$splitComponentImporter$19 = () => import("./companion-B1VLEIJJ.mjs");
var Route$22 = createFileRoute("/companion")({
	validateSearch: (search) => parseCompanionDeepLink(search) || {},
	component: lazyRouteComponent($$splitComponentImporter$19, "component")
});
var $$splitComponentImporter$18 = () => import("./connect-C6Wj8KDj.mjs");
var Route$21 = createFileRoute("/connect")({ component: lazyRouteComponent($$splitComponentImporter$18, "component") });
var Route$20 = createFileRoute("/dev")({ beforeLoad: () => {
	throw redirect({
		to: "/settings/advanced",
		replace: true
	});
} });
var $$splitComponentImporter$17 = () => import("./discover-WL-F_Yq_.mjs");
var Route$19 = createFileRoute("/discover")({ component: lazyRouteComponent($$splitComponentImporter$17, "component") });
var $$splitComponentImporter$16 = () => import("./family-BWyVvRab.mjs");
var Route$18 = createFileRoute("/family")({ component: lazyRouteComponent($$splitComponentImporter$16, "component") });
var $$splitComponentImporter$15 = () => import("./flickmatch-4EwKeg-Z.mjs");
var Route$17 = createFileRoute("/flickmatch")({ component: lazyRouteComponent($$splitComponentImporter$15, "component") });
var Route$16 = createFileRoute("/guide")({ beforeLoad: () => {
	throw redirect({
		to: "/settings",
		replace: true
	});
} });
var $$splitComponentImporter$14 = () => import("./join-DoglpD9i.mjs");
var Route$15 = createFileRoute("/join")({
	validateSearch: (search) => ({ token: typeof search.token === "string" ? search.token : void 0 }),
	component: lazyRouteComponent($$splitComponentImporter$14, "component")
});
var $$splitComponentImporter$13 = () => import("./library-BnIJ4T4r.mjs");
var Route$14 = createFileRoute("/library")({ component: lazyRouteComponent($$splitComponentImporter$13, "component") });
var $$splitComponentImporter$12 = () => import("./party-vcGfasjl.mjs");
var Route$13 = createFileRoute("/party")({ component: lazyRouteComponent($$splitComponentImporter$12, "component") });
var $$splitComponentImporter$11 = () => import("./profile-Bdtrb2ck.mjs");
var Route$12 = createFileRoute("/profile")({ component: lazyRouteComponent($$splitComponentImporter$11, "component") });
var $$splitComponentImporter$10 = () => import("./requests-CECWy7KK.mjs");
var Route$11 = createFileRoute("/requests")({ component: lazyRouteComponent($$splitComponentImporter$10, "component") });
var $$splitComponentImporter$9 = () => import("./settings-BdbLMLHy.mjs");
var Route$10 = createFileRoute("/settings")({ component: lazyRouteComponent($$splitComponentImporter$9, "component") });
var $$splitComponentImporter$8 = () => import("./tv-M8bjlo3u.mjs");
var Route$9 = createFileRoute("/tv")({ component: lazyRouteComponent($$splitComponentImporter$8, "component") });
var $$splitComponentImporter$7 = () => import("./collection._id-BPtMHygA.mjs");
var Route$8 = createFileRoute("/collection/$id")({
	validateSearch: (search) => ({
		name: typeof search.name === "string" ? search.name.slice(0, 160) : void 0,
		titles: typeof search.titles === "string" ? search.titles.slice(0, 1800) : void 0
	}),
	component: lazyRouteComponent($$splitComponentImporter$7, "component")
});
var $$splitComponentImporter$6 = () => import("./discover.index-D3XqymmB.mjs");
var Route$7 = createFileRoute("/discover/")({ component: lazyRouteComponent($$splitComponentImporter$6, "component") });
var $$splitComponentImporter$5 = () => import("./discover.movies-C-JnIdZl.mjs");
var Route$6 = createFileRoute("/discover/movies")({
	validateSearch: (search) => ({
		genre: typeof search.genre === "string" ? search.genre : "",
		category: typeof search.category === "string" ? search.category : "popular"
	}),
	component: lazyRouteComponent($$splitComponentImporter$5, "component")
});
var $$splitComponentImporter$4 = () => import("./discover.shows-DSXJu1h6.mjs");
var Route$5 = createFileRoute("/discover/shows")({
	validateSearch: (search) => ({
		genre: typeof search.genre === "string" ? search.genre : "",
		category: typeof search.category === "string" ? search.category : "popular"
	}),
	component: lazyRouteComponent($$splitComponentImporter$4, "component")
});
var Route$4 = createFileRoute("/engine/$id")({ beforeLoad: () => {
	throw redirect({
		to: "/settings/advanced",
		replace: true
	});
} });
var $$splitComponentImporter$3 = () => import("./person._id-CMAp5_UU.mjs");
var Route$3 = createFileRoute("/person/$id")({
	validateSearch: (search) => ({ name: typeof search.name === "string" ? search.name.slice(0, 160) : void 0 }),
	component: lazyRouteComponent($$splitComponentImporter$3, "component")
});
var $$splitComponentImporter$2 = () => import("./play._id-ClgSruVS.mjs");
var Route$2 = createFileRoute("/play/$id")({
	validateSearch: (search) => ({
		season: search.season ? Number(search.season) : void 0,
		episode: search.episode ? Number(search.episode) : void 0,
		mediaId: typeof search.mediaId === "string" && search.mediaId ? search.mediaId : void 0
	}),
	component: lazyRouteComponent($$splitComponentImporter$2, "component")
});
var $$splitComponentImporter$1 = () => import("./settings.advanced-CpjZiUcd.mjs");
var Route$1 = createFileRoute("/settings/advanced")({ component: lazyRouteComponent($$splitComponentImporter$1, "component") });
var $$splitComponentImporter = () => import("./title._id-B28Y2rjt.mjs");
var Route = createFileRoute("/title/$id")({ component: lazyRouteComponent($$splitComponentImporter, "component") });
var IndexRoute = Route$27.update({
	id: "/",
	path: "/",
	getParentRoute: () => Route$28
});
var ActivityRoute = Route$26.update({
	id: "/activity",
	path: "/activity",
	getParentRoute: () => Route$28
});
var AmbianceRoute = Route$25.update({
	id: "/ambiance",
	path: "/ambiance",
	getParentRoute: () => Route$28
});
var BooksRoute = Route$24.update({
	id: "/books",
	path: "/books",
	getParentRoute: () => Route$28
});
var CalibrateRoute = Route$23.update({
	id: "/calibrate",
	path: "/calibrate",
	getParentRoute: () => Route$28
});
var CompanionRoute = Route$22.update({
	id: "/companion",
	path: "/companion",
	getParentRoute: () => Route$28
});
var ConnectRoute = Route$21.update({
	id: "/connect",
	path: "/connect",
	getParentRoute: () => Route$28
});
var DevRoute = Route$20.update({
	id: "/dev",
	path: "/dev",
	getParentRoute: () => Route$28
});
var DiscoverRoute = Route$19.update({
	id: "/discover",
	path: "/discover",
	getParentRoute: () => Route$28
});
var FamilyRoute = Route$18.update({
	id: "/family",
	path: "/family",
	getParentRoute: () => Route$28
});
var FlickmatchRoute = Route$17.update({
	id: "/flickmatch",
	path: "/flickmatch",
	getParentRoute: () => Route$28
});
var GuideRoute = Route$16.update({
	id: "/guide",
	path: "/guide",
	getParentRoute: () => Route$28
});
var JoinRoute = Route$15.update({
	id: "/join",
	path: "/join",
	getParentRoute: () => Route$28
});
var LibraryRoute = Route$14.update({
	id: "/library",
	path: "/library",
	getParentRoute: () => Route$28
});
var PartyRoute = Route$13.update({
	id: "/party",
	path: "/party",
	getParentRoute: () => Route$28
});
var ProfileRoute = Route$12.update({
	id: "/profile",
	path: "/profile",
	getParentRoute: () => Route$28
});
var RequestsRoute = Route$11.update({
	id: "/requests",
	path: "/requests",
	getParentRoute: () => Route$28
});
var SettingsRoute = Route$10.update({
	id: "/settings",
	path: "/settings",
	getParentRoute: () => Route$28
});
var TvRoute = Route$9.update({
	id: "/tv",
	path: "/tv",
	getParentRoute: () => Route$28
});
var CollectionIdRoute = Route$8.update({
	id: "/collection/$id",
	path: "/collection/$id",
	getParentRoute: () => Route$28
});
var DiscoverIndexRoute = Route$7.update({
	id: "/",
	path: "/",
	getParentRoute: () => DiscoverRoute
});
var DiscoverMoviesRoute = Route$6.update({
	id: "/movies",
	path: "/movies",
	getParentRoute: () => DiscoverRoute
});
var DiscoverShowsRoute = Route$5.update({
	id: "/shows",
	path: "/shows",
	getParentRoute: () => DiscoverRoute
});
var EngineIdRoute = Route$4.update({
	id: "/engine/$id",
	path: "/engine/$id",
	getParentRoute: () => Route$28
});
var PersonIdRoute = Route$3.update({
	id: "/person/$id",
	path: "/person/$id",
	getParentRoute: () => Route$28
});
var PlayIdRoute = Route$2.update({
	id: "/play/$id",
	path: "/play/$id",
	getParentRoute: () => Route$28
});
var SettingsAdvancedRoute = Route$1.update({
	id: "/advanced",
	path: "/advanced",
	getParentRoute: () => SettingsRoute
});
var TitleIdRoute = Route.update({
	id: "/title/$id",
	path: "/title/$id",
	getParentRoute: () => Route$28
});
var DiscoverRouteChildren = {
	DiscoverMoviesRoute,
	DiscoverShowsRoute,
	DiscoverIndexRoute
};
var DiscoverRouteWithChildren = DiscoverRoute._addFileChildren(DiscoverRouteChildren);
var SettingsRouteChildren = { SettingsAdvancedRoute };
var rootRouteChildren = {
	IndexRoute,
	ActivityRoute,
	AmbianceRoute,
	BooksRoute,
	CalibrateRoute,
	CompanionRoute,
	ConnectRoute,
	DevRoute,
	DiscoverRoute: DiscoverRouteWithChildren,
	FamilyRoute,
	FlickmatchRoute,
	GuideRoute,
	JoinRoute,
	LibraryRoute,
	PartyRoute,
	ProfileRoute,
	RequestsRoute,
	SettingsRoute: SettingsRoute._addFileChildren(SettingsRouteChildren),
	TvRoute,
	CollectionIdRoute,
	EngineIdRoute,
	PersonIdRoute,
	PlayIdRoute,
	TitleIdRoute
};
var routeTree = Route$28._addFileChildren(rootRouteChildren)._addFileTypes();
var router_exports = /* @__PURE__ */ __exportAll({ getRouter: () => getRouter });
function getRouter() {
	return createRouter({
		routeTree,
		defaultErrorComponent: AppErrorComponent
	});
}
//#endregion
export { getMediaLifecycleState as A, requestNeedsLibraryHandoff as B, TITLES as C, dismissToast as D, cn as E, isTvRequestRow as F, titleHasRemotePoster as G, requestShowsRetry as H, mergeServerRequests as I, tvSeasonChips as J, titleMatchesId as K, overlayLibraryPresence as L, homeShelfRows as M, inFlightRequests as N, extractUpcomingMonitoredSeasons as O, isGhostRequestLabel as P, rememberCatalogTitles as R, titleIsAccessible as S, catchupShowsBanner as T, showToast as U, requestProgressLabel as V, titleForRequest as W, useReelStore as X, updateLocksUi as Y, useToasts as Z, publicPlaybackPath as _, Route$5 as a, sourcesForExperienceTitle as b, Route$15 as c, parseCompanionDeepLink as d, resolveCompanionSeed as f, providerDisabledConnection as g, isDebridConnected as h, Route$3 as i, getTitle as j, formatWhen as k, Route$22 as l, accessibleTitleIds as m, Route as n, Route$6 as o, DEFAULT_DEBRID_CONNECTION as p, transferringChipCount as q, Route$2 as r, Route$8 as s, router_exports as t, Button as u, sourceForLookupTitle as v, catchupLocksHome as w, titleCanUseProvider as x, sourceIsAccessible as y, requestIsWatchableOnShelf as z };
