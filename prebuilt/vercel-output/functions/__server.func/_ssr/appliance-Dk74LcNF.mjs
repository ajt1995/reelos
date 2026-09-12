import { n as TSS_SERVER_FUNCTION, t as createServerFn } from "./ssr.mjs";
import { createRequire } from "node:module";
//#region node_modules/.nitro/vite/services/ssr/assets/adapter-C1KdVmeb.js
var SOURCES = [
	{
		id: "torbox",
		name: "TorBox",
		blurb: "Working path. Paste a key and Validate it.",
		mark: "TB"
	},
	{
		id: "real-debrid",
		name: "Real-Debrid",
		blurb: "Untested on this house. Validate refuses.",
		mark: "RD"
	},
	{
		id: "alldebrid",
		name: "AllDebrid",
		blurb: "Untested on this house. Validate refuses.",
		mark: "AD"
	},
	{
		id: "premiumize",
		name: "Premiumize",
		blurb: "Untested on this house. Validate refuses.",
		mark: "PM"
	},
	{
		id: "local-vpn",
		name: "Local + VPN",
		blurb: "Untested. No fake OK — credentials are not collected.",
		mark: "LN"
	}
];
var TITLE_BY_ID = Object.fromEntries([
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
].map((t) => [t.id, t]));
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
function kindLabel(kind) {
	switch (kind) {
		case "movie": return "Movie";
		case "tv": return "TV";
		case "anime": return "Anime";
		case "kids": return "Kids";
		case "music": return "Music";
	}
}
var HOSTNAME = "reelos.local";
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
function cacheHint(title, source) {
	if (source === "local-vpn") return "local";
	return titleInCache(title) ? "cache" : "uncached";
}
function cacheCopy(title, source) {
	const via = cacheHint(title, source);
	if (via === "local") return "Will download through the VPN client.";
	const name = source === "torbox" ? "TorBox" : source === "alldebrid" ? "AllDebrid" : source === "premiumize" ? "Premiumize" : "Real-Debrid";
	if (via === "cache") return `Cached on ${name}. Request imports it.`;
	return `Not in the ${name} cache. ${source === "torbox" ? "TorBox" : "Decypharr"} will transfer.`;
}
function viaLabel(via, status) {
	if (status === "waiting") {
		if (via === "uncached") return "No cache · looking for a transfer";
		if (via === "cache") return "Cache hit · waiting to import";
		return "Waiting for a release";
	}
	if (status === "available") {
		if (via === "cache") return "Cached · in library";
		if (via === "local") return "Downloaded · in library";
		if (via === "uncached") return "Transferred · in library";
		return "Available now";
	}
	if (status === "downloading") {
		if (via === "cache") return "Cache hit · importing";
		if (via === "local") return null;
		if (via === "uncached") return "Uncached · transferring";
	}
	return null;
}
//#endregion
//#region node_modules/.nitro/vite/services/ssr/assets/appliance-Dk74LcNF.js
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
var __require = /* #__PURE__ */ (() => createRequire(import.meta.url))();
var createServerRpc = (serverFnMeta, splitImportFn) => {
	const url = "/_serverFn/" + serverFnMeta.id;
	return Object.assign(splitImportFn, {
		url,
		serverFnMeta,
		[TSS_SERVER_FUNCTION]: true
	});
};
var APPLIANCE = process.env.REELOS_APPLIANCE === "1";
var CHANNEL_URL = process.env.REELOS_CHANNEL_URL || "https://raw.githubusercontent.com/ajt1995/reelos/main/channel.json";
function xmlKey(file) {
	const fs = __require("node:fs");
	if (!fs.existsSync(file)) return null;
	return /<ApiKey>([^<]+)<\/ApiKey>/.exec(fs.readFileSync(file, "utf8"))?.[1] ?? null;
}
async function api(url, key, method, body, form) {
	const headers = { "X-Api-Key": key };
	let payload;
	if (form) {
		payload = new URLSearchParams(form).toString();
		headers["Content-Type"] = "application/x-www-form-urlencoded";
	} else if (body !== void 0) {
		headers["Content-Type"] = "application/json";
		payload = JSON.stringify(body);
	}
	const res = await fetch(url, {
		method,
		headers,
		body: payload
	});
	if (!res.ok) throw new Error(`${method} ${url} ${res.status}`);
	const text = await res.text();
	return text ? JSON.parse(text) : null;
}
function radarrKey() {
	return xmlKey("/opt/reelos/compose/configs/radarr/config.xml");
}
function sonarrKey() {
	return xmlKey("/opt/reelos/compose/configs/sonarr/config.xml");
}
function prowlarrKey() {
	return xmlKey("/opt/reelos/compose/configs/prowlarr/config.xml");
}
var checkChannel_createServerFn_handler = createServerRpc({
	id: "41d2c07472a4f1e5dcb4aab96fabd1ba92e389d7e8e8e8645f602cca3019fa35",
	name: "checkChannel",
	filename: "src/lib/appliance.ts"
}, (opts) => checkChannel.__executeServer(opts));
var checkChannel = createServerFn({ method: "GET" }).handler(checkChannel_createServerFn_handler, async () => {
	const fs = await import("node:fs");
	const local = fs.existsSync("/opt/reelos/VERSION") ? fs.readFileSync("/opt/reelos/VERSION", "utf8").trim() : fs.existsSync("/workspace/VERSION") ? fs.readFileSync("/workspace/VERSION", "utf8").trim() : "1.2.0";
	try {
		const urls = [
			"https://raw.githubusercontent.com/ajt1995/reelos/main/channel.json",
			"https://raw.githubusercontent.com/ajt1995/reelos/v1.2.3/channel.json",
			CHANNEL_URL,
			"https://github.com/ajt1995/reelos/raw/main/channel.json",
			"https://cdn.jsdelivr.net/gh/ajt1995/reelos@main/channel.json"
		];
		let best = null;
		let bestKey = [];
		const keyOf = (v) => v.split(".").map((n) => parseInt(n, 10) || 0);
		const cmp = (a, b) => {
			const n = Math.max(a.length, b.length);
			for (let i = 0; i < n; i++) {
				const d = (a[i] || 0) - (b[i] || 0);
				if (d) return d;
			}
			return 0;
		};
		for (const url of urls) try {
			const res = await fetch(url, { cache: "no-store" });
			if (!res.ok) continue;
			const ch = await res.json();
			const k = keyOf(ch.version || "0");
			if (!best || cmp(k, bestKey) > 0) {
				best = ch;
				bestKey = k;
			}
		} catch {}
		if (!best) throw new Error("channel unreachable");
		const ch = best;
		return {
			ok: true,
			local,
			remote: ch.version,
			notes: ch.notes ?? [],
			available: ch.version !== local
		};
	} catch (e) {
		return {
			ok: false,
			local,
			remote: local,
			notes: [],
			available: false,
			error: String(e)
		};
	}
});
var applyChannel_createServerFn_handler = createServerRpc({
	id: "95fc432c40828f34b0a9df54f531530faf3cf2c3132f82e6f301329ef0df2d0d",
	name: "applyChannel",
	filename: "src/lib/appliance.ts"
}, (opts) => applyChannel.__executeServer(opts));
var applyChannel = createServerFn({ method: "POST" }).handler(applyChannel_createServerFn_handler, async () => {
	if (!APPLIANCE) return {
		ok: false,
		error: "not an appliance"
	};
	const fs = await import("node:fs");
	const { spawn } = await import("node:child_process");
	const script = "/tmp/reelos-update.sh";
	const urls = ["https://raw.githubusercontent.com/ajt1995/reelos/main/daemon/reelos-update.sh", "https://github.com/ajt1995/reelos/raw/refs/heads/main/daemon/reelos-update.sh"];
	let got = false;
	for (const url of urls) try {
		const res = await fetch(url, { cache: "no-store" });
		if (!res.ok) continue;
		fs.writeFileSync(script, Buffer.from(await res.arrayBuffer()));
		fs.chmodSync(script, 493);
		got = true;
		break;
	} catch {}
	const run = got ? script : "/opt/reelos/bin/reelos-update.sh";
	const log = fs.openSync("/var/lib/reelos/ota.log", "a");
	const code = await new Promise((resolve) => {
		const child = spawn("bash", [run, "apply"], { stdio: [
			"ignore",
			log,
			log
		] });
		child.on("exit", (c) => resolve(c ?? 1));
		child.on("error", () => resolve(1));
	});
	try {
		fs.closeSync(log);
	} catch {}
	return { ok: code === 0 };
});
var pullStackImages_createServerFn_handler = createServerRpc({
	id: "258f0c1890e4544d82619f31600079d1a054c2e11b8af15418d099f7d01f07e0",
	name: "pullStackImages",
	filename: "src/lib/appliance.ts"
}, (opts) => pullStackImages.__executeServer(opts));
var pullStackImages = createServerFn({ method: "POST" }).handler(pullStackImages_createServerFn_handler, async () => {
	if (!APPLIANCE) return {
		ok: false,
		error: "not an appliance"
	};
	const { spawn } = await import("node:child_process");
	return { ok: await new Promise((resolve) => {
		const child = spawn("docker", ["compose", "pull"], {
			cwd: "/opt/reelos/compose",
			stdio: "ignore"
		});
		child.on("exit", (c) => resolve(c ?? 1));
		child.on("error", () => resolve(1));
	}) === 0 };
});
var pushRequest_createServerFn_handler = createServerRpc({
	id: "8e2c75e67287fd6b481a987be04b658a98350cf13e5ff73b0a11f19adf3d801f",
	name: "pushRequest",
	filename: "src/lib/appliance.ts"
}, (opts) => pushRequest.__executeServer(opts));
var pushRequest = createServerFn({ method: "POST" }).validator((data) => data).handler(pushRequest_createServerFn_handler, async ({ data }) => {
	if (!APPLIANCE) return {
		ok: true,
		simulated: true
	};
	if (data.titleId.startsWith("tmdb-")) {
		const rk = radarrKey();
		const tmdb = data.titleId.slice(5);
		if (rk) try {
			const movie = (await api(`http://127.0.0.1:7878/api/v3/movie/lookup?term=${encodeURIComponent(`tmdb:${tmdb}`)}`, rk, "GET"))?.[0];
			if (movie) await api("http://127.0.0.1:7878/api/v3/movie", rk, "POST", {
				...movie,
				addOptions: { searchForMovie: true },
				rootFolderPath: "/mnt/symlinks",
				monitored: true
			});
		} catch {}
		return {
			ok: true,
			simulated: false
		};
	}
	if (data.titleId.startsWith("tvdb-")) {
		const sk = sonarrKey();
		const tvdb = data.titleId.slice(5);
		if (sk) try {
			const series = (await api(`http://127.0.0.1:8989/api/v3/series/lookup?term=${encodeURIComponent(`tvdb:${tvdb}`)}`, sk, "GET"))?.[0];
			if (series) await api("http://127.0.0.1:8989/api/v3/series", sk, "POST", {
				...series,
				addOptions: { searchForMissingEpisodes: true },
				rootFolderPath: "/mnt/symlinks",
				monitored: true,
				seasonFolder: true
			});
		} catch {}
		return {
			ok: true,
			simulated: false
		};
	}
	const title = getTitle(data.titleId);
	if (!title) return {
		ok: false,
		error: "unknown title"
	};
	const hash = data.hash || syntheticRelease(title, "hybrid").replace(/[^a-f0-9]/gi, "").slice(0, 40);
	const magnet = hash.length >= 32 ? `magnet:?xt=urn:btih:${hash}` : "";
	try {
		await fetch("http://127.0.0.1:8282/api/v2/torrents/add", {
			method: "POST",
			headers: { "Content-Type": "application/x-www-form-urlencoded" },
			body: new URLSearchParams({
				urls: magnet,
				category: title.kind === "tv" || title.kind === "anime" ? "sonarr" : "radarr"
			}).toString()
		});
	} catch {}
	const key = title.kind === "tv" || title.kind === "anime" ? sonarrKey() : radarrKey();
	const port = title.kind === "tv" || title.kind === "anime" ? 8989 : 7878;
	if (key && magnet) try {
		await api(`http://127.0.0.1:${port}/api/v3/release/push`, key, "POST", {
			title: `${title.title} ${title.year}`,
			downloadUrl: magnet,
			protocol: "torrent",
			publishDate: (/* @__PURE__ */ new Date()).toISOString()
		});
	} catch {}
	return {
		ok: true,
		simulated: false
	};
});
var pushIndexer_createServerFn_handler = createServerRpc({
	id: "9b1162b45ecf77c4e9f949cb833621bae5038735658ddada1011101c1b77d7a5",
	name: "pushIndexer",
	filename: "src/lib/appliance.ts"
}, (opts) => pushIndexer.__executeServer(opts));
var pushIndexer = createServerFn({ method: "POST" }).validator((data) => data).handler(pushIndexer_createServerFn_handler, async ({ data }) => {
	if (!APPLIANCE) return {
		ok: true,
		simulated: true
	};
	const key = prowlarrKey();
	if (!key) return {
		ok: false,
		error: "prowlarr not ready"
	};
	try {
		await api("http://127.0.0.1:9696/api/v1/indexer", key, "POST", {
			name: data.name,
			enable: true,
			appProfileId: 1,
			protocol: "torrent",
			implementation: "Torznab",
			implementationName: "Torznab",
			configContract: "TorznabSettings",
			fields: [
				{
					name: "baseUrl",
					value: data.url
				},
				{
					name: "apiPath",
					value: "/api"
				},
				{
					name: "apiKey",
					value: data.key
				}
			]
		});
		return {
			ok: true,
			simulated: false
		};
	} catch (e) {
		return {
			ok: false,
			error: String(e)
		};
	}
});
var lookupMedia_createServerFn_handler = createServerRpc({
	id: "da29a55faba4a3535cedb4ac09bfa8bbf09aefb1c5ca11099c758b2b1ff3f6c3",
	name: "lookupMedia",
	filename: "src/lib/appliance.ts"
}, (opts) => lookupMedia.__executeServer(opts));
var lookupMedia = createServerFn({ method: "POST" }).validator((data) => data).handler(lookupMedia_createServerFn_handler, async ({ data }) => {
	const q = String(data?.q ?? "").trim();
	const titles = [];
	const note = (msg) => {
		try {
			__require("node:fs").appendFileSync("/var/lib/reelos/lookup.log", `${(/* @__PURE__ */ new Date()).toISOString()} ${msg}\n`);
		} catch {}
	};
	if (q.length < 2) return {
		titles,
		error: null
	};
	let error = null;
	const rk = radarrKey();
	note(`q=${q} radarrKey=${rk ? "yes" : "NO"}`);
	if (rk) try {
		const hits = await api(`http://127.0.0.1:7878/api/v3/movie/lookup?term=${encodeURIComponent(q)}`, rk, "GET");
		for (const h of (hits || []).slice(0, 8)) {
			const tmdb = h.tmdbId ?? h.ids?.tmdb;
			if (!tmdb) continue;
			const genres = Array.isArray(h.genres) ? h.genres.map((g) => typeof g === "string" ? g : g.name || "").filter(Boolean) : [];
			titles.push({
				id: `tmdb-${tmdb}`,
				kind: "movie",
				title: String(h.title || "Untitled"),
				year: Number(h.year) || 0,
				overview: String(h.overview || ""),
				poster: String(h.remotePoster || ""),
				rating: Number(h.ratings?.tmdb?.value || 0),
				genres,
				maxQuality: "4k",
				popularity: 50
			});
		}
		note(`radarr hits=${(hits || []).length} mapped=${titles.length}`);
	} catch (e) {
		error = `radarr ${String(e)}`;
		note(error);
	}
	else error = "radarr has no API key yet";
	const sk = sonarrKey();
	if (sk) try {
		const hits = await api(`http://127.0.0.1:8989/api/v3/series/lookup?term=${encodeURIComponent(q)}`, sk, "GET");
		for (const h of (hits || []).slice(0, 6)) {
			const tvdb = h.tvdbId;
			if (!tvdb) continue;
			titles.push({
				id: `tvdb-${tvdb}`,
				kind: "tv",
				title: String(h.title || "Untitled"),
				year: Number(h.year) || 0,
				overview: String(h.overview || ""),
				poster: String(h.remotePoster || ""),
				rating: Number(h.ratings?.tmdb?.value || 0),
				genres: [],
				maxQuality: "4k",
				popularity: 50,
				seasons: Array.isArray(h.seasons) ? h.seasons.length : void 0
			});
		}
	} catch (e) {
		error = error || `sonarr ${String(e)}`;
		note(`sonarr ${String(e)}`);
	}
	rememberCatalogTitles(titles);
	return {
		titles,
		error
	};
});
var runDoctor_createServerFn_handler = createServerRpc({
	id: "9dfc77b31da6c0fd514d28a91d4dbd04a3b1978d535211e18a7589379263907e",
	name: "runDoctor",
	filename: "src/lib/appliance.ts"
}, (opts) => runDoctor.__executeServer(opts));
var runDoctor = createServerFn({ method: "GET" }).handler(runDoctor_createServerFn_handler, async () => {
	const { spawn } = await import("node:child_process");
	const fs = await import("node:fs");
	const script = "/opt/reelos/bin/reelos-doctor.py";
	if (!APPLIANCE || !fs.existsSync(script)) return {
		ok: true,
		live: false,
		version: "1.2.1.1",
		checks: []
	};
	const raw = await new Promise((resolve) => {
		const chunks = [];
		const child = spawn("python3", [script]);
		child.stdout.on("data", (c) => chunks.push(c));
		child.on("exit", () => resolve(Buffer.concat(chunks).toString("utf8")));
		child.on("error", () => resolve(""));
	});
	try {
		return {
			ok: true,
			live: true,
			...JSON.parse(raw)
		};
	} catch {
		return {
			ok: false,
			live: true,
			version: "1.2.1.1",
			checks: []
		};
	}
});
var TERM_DIR = APPLIANCE ? "/var/lib/reelos" : "/tmp/reelos-term";
var TERM_LOG = `${TERM_DIR}/term.log`;
var TERM_PID = `${TERM_DIR}/term.pid`;
var TERM_CWD = APPLIANCE ? "/home/reelos" : "/workspace";
function termAlive(pid) {
	try {
		process.kill(pid, 0);
		return true;
	} catch {
		return false;
	}
}
var runTerminal_createServerFn_handler = createServerRpc({
	id: "e527b35fb0741ee0fe03221620fa9230845510147ace7804948043c6fad06cb2",
	name: "runTerminal",
	filename: "src/lib/appliance.ts"
}, (opts) => runTerminal.__executeServer(opts));
var runTerminal = createServerFn({ method: "POST" }).validator((data) => data).handler(runTerminal_createServerFn_handler, async ({ data }) => {
	const fs = await import("node:fs");
	const { spawn } = await import("node:child_process");
	fs.mkdirSync(TERM_DIR, { recursive: true });
	const pidRaw = fs.existsSync(TERM_PID) ? fs.readFileSync(TERM_PID, "utf8").trim() : "";
	const pid = Number(pidRaw) || 0;
	let running = pid > 0 && termAlive(pid);
	if (data.kill && running) {
		try {
			process.kill(-pid, "SIGTERM");
		} catch {
			try {
				process.kill(pid, "SIGTERM");
			} catch {}
		}
		running = false;
		fs.appendFileSync(TERM_LOG, "\n^C\n");
	}
	if (data.command && data.command.trim()) {
		if (running) return {
			ok: false,
			running: true,
			output: fs.existsSync(TERM_LOG) ? fs.readFileSync(TERM_LOG, "utf8") : "",
			cwd: TERM_CWD,
			error: "already running"
		};
		const command = data.command.replace(/\r\n/g, "\n").slice(0, 32e3);
		const stamp = (/* @__PURE__ */ new Date()).toISOString().slice(11, 19);
		fs.writeFileSync(TERM_LOG, `reelos# ${command.split("\n").join("\n> ")}\n`);
		const out = fs.openSync(TERM_LOG, "a");
		const child = spawn("bash", ["-lc", command], {
			cwd: fs.existsSync(TERM_CWD) ? TERM_CWD : "/",
			env: {
				...process.env,
				HOME: APPLIANCE ? "/home/reelos" : process.env.HOME,
				TERM: "xterm-256color"
			},
			detached: true,
			stdio: [
				"ignore",
				out,
				out
			]
		});
		fs.closeSync(out);
		if (child.pid) {
			fs.writeFileSync(TERM_PID, String(child.pid));
			child.on("exit", (code, signal) => {
				try {
					fs.appendFileSync(TERM_LOG, `\n[${stamp} exit ${code ?? signal ?? "?"}] \n`);
					if (fs.existsSync(TERM_PID) && fs.readFileSync(TERM_PID, "utf8").trim() === String(child.pid)) fs.unlinkSync(TERM_PID);
				} catch {}
			});
			child.unref();
			running = true;
		} else {
			fs.appendFileSync(TERM_LOG, "failed to spawn\n");
			running = false;
		}
	}
	const livePid = Number(fs.existsSync(TERM_PID) ? fs.readFileSync(TERM_PID, "utf8").trim() : "") || 0;
	running = livePid > 0 && termAlive(livePid);
	let output = fs.existsSync(TERM_LOG) ? fs.readFileSync(TERM_LOG, "utf8") : "";
	if (output.length > 2e5) output = output.slice(-2e5);
	return {
		ok: true,
		running,
		output,
		cwd: TERM_CWD
	};
});
//#endregion
export { cacheCopy as a, applyChannel_createServerFn_handler, rememberCatalogTitles as c, checkChannel_createServerFn_handler, viaLabel as d, adapterProfile as i, syntheticRelease as l, lookupMedia_createServerFn_handler, HOSTNAME as n, getTitle as o, pullStackImages_createServerFn_handler, pushIndexer_createServerFn_handler, pushRequest_createServerFn_handler, SOURCES as r, runDoctor_createServerFn_handler, runTerminal_createServerFn_handler, kindLabel as s, __exportAll as t, titleInCache as u };
