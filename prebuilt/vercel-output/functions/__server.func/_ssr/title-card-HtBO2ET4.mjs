import { i as __toESM } from "../_runtime.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { S as require_jsx_runtime, v as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { u as titleInCache } from "./appliance-Dk74LcNF.mjs";
import { o as ThumbsUp, s as ThumbsDown } from "../_libs/lucide-react.mjs";
import { A as requestProgressLabel, I as titleHasRemotePoster, L as titleMatchesId, _ as useReelStore } from "./router-D4zanu1c.mjs";
import { n as clsx } from "../_libs/class-variance-authority+clsx.mjs";
import { t as twMerge } from "../_libs/tailwind-merge.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/title-card-HtBO2ET4.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function cn(...inputs) {
	return twMerge(clsx(inputs));
}
function formatRuntime(minutes) {
	if (!minutes) return "";
	const h = Math.floor(minutes / 60);
	const m = minutes % 60;
	return h ? `${h}h ${m}m` : `${m}m`;
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
function posterInitial(title) {
	return String(title.title || "").replace(/^[^A-Za-z0-9]+/, "").charAt(0).toUpperCase() || "•";
}
function Poster({ title, className, sizes = "poster", placeholder = "letter" }) {
	const src = String(title.poster || "").trim();
	const [ok, setOk] = (0, import_react.useState)(Boolean(src));
	(0, import_react.useEffect)(() => {
		setOk(Boolean(src));
	}, [src]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: cn("relative w-full min-h-0 min-w-0 max-w-full overflow-hidden bg-card-2", sizes === "poster" ? "aspect-[2/3]" : "aspect-[16/9]", className),
		children: src && ok ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
			src,
			alt: "",
			loading: "lazy",
			decoding: "async",
			className: "poster absolute inset-0 size-full object-cover",
			onError: () => setOk(false)
		}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "absolute inset-0 flex items-center justify-center bg-linear-to-br from-card-2 via-card to-background",
			"aria-hidden": true,
			children: placeholder === "letter" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "font-display text-3xl font-medium text-muted/70",
				children: posterInitial(title)
			}) : null
		})
	});
}
function posterArt(title, extras = []) {
	const tmdb = extras.find((x) => {
		const p = String(x.poster || "").trim();
		if (!p || p.includes("/api/jf/")) return false;
		return titleMatchesId(title, x.id) || x.id === title.id;
	});
	if (tmdb?.poster) return String(tmdb.poster);
	return String(title.poster || "");
}
function CuratorVoteBar({ liked, hidden, onVote, placement = "overlay" }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: cn("z-20 flex gap-1", placement === "overlay" ? "absolute inset-x-0 bottom-1 justify-between px-1" : "relative"),
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
			type: "button",
			"aria-label": "Like",
			title: "Like",
			"aria-pressed": liked ? true : void 0,
			className: cn("flex size-11 shrink-0 items-center justify-center rounded-full shadow-[var(--shadow-border)]", liked ? "bg-gold text-gold-fg" : "bg-background/90 text-muted hover:text-foreground"),
			onClick: (e) => {
				e.preventDefault();
				e.stopPropagation();
				onVote(liked ? "none" : "like");
			},
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ThumbsUp, { className: "size-4" })
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
			type: "button",
			"aria-label": "Not interested",
			title: "Not interested",
			"aria-pressed": hidden ? true : void 0,
			className: cn("flex size-11 shrink-0 items-center justify-center rounded-full shadow-[var(--shadow-border)]", hidden ? "bg-card-2 text-foreground" : "bg-background/90 text-muted hover:text-foreground"),
			onClick: (e) => {
				e.preventDefault();
				e.stopPropagation();
				onVote(hidden ? "none" : "dislike");
			},
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ThumbsDown, { className: "size-4" })
		})]
	});
}
function TitleCard({ title, request, progress, className, onHide, onVote, liked, hidden }) {
	const status = request?.status;
	const source = useReelStore((s) => s.answers.source);
	const inLibrary = useReelStore((s) => s.library.includes(title.id));
	const remoteTitles = useReelStore((s) => s.remoteTitles);
	const showCache = !request && !inLibrary && source !== "local-vpn" && titleInCache(title);
	const painted = {
		...title,
		poster: posterArt(title, remoteTitles)
	};
	const pct = Number(request?.progress) || 0;
	const downloadingLabel = requestProgressLabel(request);
	const showVotes = Boolean(onVote || onHide);
	const vote = (next) => {
		if (onVote) onVote(title, next);
		else if (onHide && next === "dislike") onHide(title);
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
		to: "/title/$id",
		params: { id: title.id },
		className: cn("group block w-[148px] min-w-0 max-w-full shrink-0 overflow-hidden sm:w-[168px]", className),
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "relative overflow-hidden rounded-xl transition-transform duration-200 ease-out group-hover:-translate-y-0.5",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Poster, {
						title: painted,
						className: "rounded-xl",
						placeholder: request && !titleHasRemotePoster(painted) ? "empty" : "letter"
					}),
					showCache ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "absolute left-2 top-2 rounded-full bg-gold px-2 py-0.5 text-[10px] font-medium tracking-wide text-gold-fg",
						children: "Cached"
					}) : null,
					status === "downloading" && pct > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "absolute inset-x-0 bottom-0 h-1 bg-background/40",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "h-full bg-gold",
							style: { width: `${pct}%` }
						})
					}) : null,
					typeof progress === "number" && progress > .03 && progress < .97 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "absolute inset-x-0 bottom-0 h-0.5 bg-background/40",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "h-full bg-live",
							style: { width: `${progress * 100}%` }
						})
					}) : null,
					showVotes ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CuratorVoteBar, {
						liked,
						hidden,
						onVote: vote
					}) : null
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-2 line-clamp-2 break-words text-sm font-medium leading-snug",
				children: title.title
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "text-xs text-muted",
				children: [
					Number(title.year) > 0 ? title.year : null,
					status === "available" ? request?.via === "cache" ? " · Cached" : " · Available now" : null,
					status === "downloading" && downloadingLabel ? ` · ${downloadingLabel}` : null,
					status === "waiting" ? " · Waiting" : null,
					status === "failed" ? " · Failed" : null
				]
			})
		]
	});
}
function Row({ label, children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "mt-8",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
			className: "mb-4 font-display text-lg font-medium tracking-tight",
			children: label
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "no-scrollbar flex gap-4 overflow-x-auto pb-2",
			children
		})]
	});
}
//#endregion
export { cn as a, TitleCard as i, Poster as n, formatRuntime as o, Row as r, formatWhen as s, CuratorVoteBar as t };
