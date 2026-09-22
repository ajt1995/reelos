import { i as __toESM } from "../_runtime.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { S as require_jsx_runtime, b as useNavigate, v as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { At as ChevronRight, B as Play, Et as Clapperboard, F as RefreshCw, Ft as Captions, Nt as Check, Pt as Cast, T as SlidersVertical, Ut as ArrowLeft, _t as ExternalLink, et as LoaderCircle, jt as ChevronLeft, m as Tv, n as X, o as Volume2, w as Smartphone, wt as Clock } from "../_libs/lucide-react.mjs";
import { E as cn, K as titleMatchesId, U as showToast, X as useReelStore, j as getTitle, r as Route$2, u as Button } from "./router-2BoRtkQZ.mjs";
import { n as useExperienceStore } from "./experience-state-BipBJc8l.mjs";
import { i as QrCodeSvg, t as Gate } from "./gate-ejkd3pT8.mjs";
import { t as attachAudioBooster } from "./audio-booster-CEgXQ0KE.mjs";
import { n as jellyfinWatchHref, r as jellyfinWatchOrigin, t as jellyfinStreamUrl } from "./jellyfin-watch-DyhgK2S6.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/play._id-EioKNMXm.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function WatchLauncherModal({ open, onClose, title }) {
	const ipv4 = useReelStore((s) => s.ipv4);
	const tailscaleIp = useReelStore((s) => s.tailscaleIp);
	const watchDoor = useReelStore((s) => s.watch);
	const hostname = typeof window !== "undefined" ? window.location.hostname : "";
	const [castSessions, setCastSessions] = (0, import_react.useState)([]);
	const [castLoading, setCastLoading] = (0, import_react.useState)(false);
	const [activeCastSession, setActiveCastSession] = (0, import_react.useState)(null);
	const [quickConnectCode, setQuickConnectCode] = (0, import_react.useState)(null);
	const [showPairing, setShowPairing] = (0, import_react.useState)(false);
	const [resolvedEpisode, setResolvedEpisode] = (0, import_react.useState)(null);
	const [sourcesData, setSourcesData] = (0, import_react.useState)(null);
	const [rememberAndroidPref, setRememberAndroidPref] = (0, import_react.useState)(false);
	const [androidPref, setAndroidPref] = (0, import_react.useState)(null);
	(0, import_react.useEffect)(() => {
		if (typeof window !== "undefined") setAndroidPref(localStorage.getItem("reelos_android_player_pref"));
	}, []);
	const isSeries = title.kind === "tv" || title.kind === "series" || title.id.startsWith("tvdb-") || title.id.startsWith("tmdb-tv-");
	(0, import_react.useEffect)(() => {
		if (!open || !isSeries || title.episode) return;
		let active = true;
		const sNum = title.season || 1;
		fetch(`/api/episodes?id=${encodeURIComponent(title.id)}&season=${sNum}`).then((r) => r.ok ? r.json() : null).then((data) => {
			if (!active || !Array.isArray(data?.episodes) || !data.episodes.length) return;
			const playable = data.episodes.find((e) => e.status === "in-library" && e.jellyfinId) || data.episodes[0];
			if (playable) setResolvedEpisode({
				jellyfinId: playable.jellyfinId,
				season: sNum,
				episode: playable.episodeNumber,
				title: playable.title
			});
		}).catch(() => {});
		return () => {
			active = false;
		};
	}, [
		open,
		isSeries,
		title.id,
		title.season,
		title.episode
	]);
	const activeSeason = title.season ?? resolvedEpisode?.season;
	const activeEpisode = title.episode ?? resolvedEpisode?.episode;
	const activeEpTitle = title.episodeTitle ?? resolvedEpisode?.title;
	const activeJfId = title.episode && title.jellyfinId ? title.jellyfinId : resolvedEpisode?.jellyfinId || title.jellyfinId;
	const jfItemId = activeJfId || title.id;
	(0, import_react.useEffect)(() => {
		if (!open || !jfItemId) return;
		let active = true;
		fetch(`/api/media/${encodeURIComponent(jfItemId)}/sources`).then((r) => r.ok ? r.json() : null).then((data) => {
			if (active && data?.ok) setSourcesData(data);
		}).catch(() => {});
		return () => {
			active = false;
		};
	}, [open, jfItemId]);
	const streamUrl = jellyfinStreamUrl({
		ipv4,
		tailscaleIp,
		watch: watchDoor,
		hostname,
		jellyfinId: activeJfId
	});
	const jfWebHref = jellyfinWatchHref({
		ipv4,
		tailscaleIp,
		watch: watchDoor,
		hostname,
		jellyfinId: activeJfId
	});
	const vlcSourceId = sourcesData?.recommendedForTv?.id;
	const vlcStreamUrl = jellyfinStreamUrl({
		ipv4,
		tailscaleIp,
		watch: watchDoor,
		hostname,
		jellyfinId: activeJfId,
		mediaSourceId: vlcSourceId
	});
	const browserSourceId = sourcesData?.recommendedForBrowser?.id || activeJfId;
	const isAndroid = typeof navigator !== "undefined" && /android/i.test(navigator.userAgent);
	typeof navigator !== "undefined" && /iphone|ipad|ipod/i.test(navigator.userAgent);
	const targetVlcStream = vlcStreamUrl || streamUrl;
	const vlcUrl = targetVlcStream ? `vlc://${targetVlcStream}` : "";
	const androidVlcIntent = targetVlcStream ? `intent:${targetVlcStream}#Intent;package=org.videolan.vlc;type=video/*;action=android.intent.action.VIEW;end` : "";
	const refreshSessions = async () => {
		setCastLoading(true);
		try {
			const data = await (await fetch("/api/cast/sessions", { cache: "no-store" })).json();
			if (data.ok && Array.isArray(data.sessions)) setCastSessions(data.sessions);
		} catch {} finally {
			setCastLoading(false);
		}
	};
	(0, import_react.useEffect)(() => {
		if (open) refreshSessions();
	}, [open]);
	if (!open) return null;
	const handleCastPlay = async (session) => {
		const targetPlayId = vlcSourceId || jfItemId;
		if (!targetPlayId) return;
		try {
			showToast(`Casting to ${session.name}…`);
			const data = await (await fetch("/api/cast/play", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					sessionId: session.id,
					itemId: targetPlayId,
					playCommand: "PlayNow"
				})
			})).json();
			if (data.ok) {
				setActiveCastSession({
					id: session.id,
					name: session.name
				});
				showToast(`Playing on ${session.name}`, "success");
				onClose();
			} else showToast(data.error || "Failed to start playback on TV", "error");
		} catch (err) {
			showToast("Cast error: " + String(err), "error");
		}
	};
	const launchVlc = () => {
		if (!targetVlcStream) return;
		if (rememberAndroidPref && typeof window !== "undefined") {
			localStorage.setItem("reelos_android_player_pref", "vlc");
			setAndroidPref("vlc");
		}
		showToast("Launching in VLC…", "success");
		if (isAndroid && androidVlcIntent) window.location.href = androidVlcIntent;
		else if (vlcUrl) window.location.href = vlcUrl;
	};
	const handleSelectBrowser = () => {
		if (rememberAndroidPref && typeof window !== "undefined") {
			localStorage.setItem("reelos_android_player_pref", "browser");
			setAndroidPref("browser");
		}
		onClose();
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200",
		onClick: onClose,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "w-full max-w-lg rounded-3xl border border-white/10 bg-card/95 p-6 shadow-2xl backdrop-blur-2xl max-h-[90vh] overflow-y-auto",
			onClick: (e) => e.stopPropagation(),
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-start justify-between border-b border-border/50 pb-4",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "flex size-10 items-center justify-center rounded-2xl bg-gold/15 text-gold border border-gold/30",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Tv, { className: "size-5" })
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							className: "font-display text-lg font-bold text-foreground",
							children: "Where do you want to watch?"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "text-xs text-muted truncate max-w-[280px]",
							children: [
								title.title,
								activeSeason && activeEpisode ? ` · S${activeSeason}E${activeEpisode}` : "",
								activeEpTitle ? ` (${activeEpTitle})` : title.year ? ` (${title.year})` : ""
							]
						})] })]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: onClose,
						className: "flex size-8 items-center justify-center rounded-full text-muted hover:bg-white/10 hover:text-foreground transition-colors",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-4" })
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-5 space-y-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center justify-between",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "text-xs font-bold uppercase tracking-wider text-gold font-mono flex items-center gap-1.5",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Cast, { className: "size-3.5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Cast to TV" })]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							disabled: castLoading,
							onClick: () => void refreshSessions(),
							className: "text-xs text-muted hover:text-gold flex items-center gap-1 transition-colors",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RefreshCw, { className: cn("size-3", castLoading && "animate-spin") }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Refresh" })]
						})]
					}), castSessions.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "space-y-2",
						children: castSessions.map((session) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							onClick: () => handleCastPlay(session),
							className: "w-full flex items-center justify-between rounded-2xl border border-gold/30 bg-gold/10 p-4 text-left hover:bg-gold/20 hover:border-gold/50 transition-all group cursor-pointer",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center gap-3.5",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "flex size-10 items-center justify-center rounded-xl bg-gold/20 text-gold shrink-0",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Tv, { className: "size-5" })
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
									className: "font-display text-sm font-bold text-foreground group-hover:text-gold transition-colors",
									children: ["Play on ", session.name]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
									className: "text-xs text-muted",
									children: [
										session.client,
										" ",
										session.user ? `· ${session.user}` : "",
										" · Instant 1-tap beam"
									]
								})] })]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Play, { className: "size-4 text-gold group-hover:scale-110 transition-transform fill-current" })]
						}, session.id))
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "rounded-2xl border border-white/5 bg-white/[0.03] p-4 text-left space-y-2.5",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-start gap-3",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "flex size-9 items-center justify-center rounded-xl bg-muted/20 text-muted shrink-0 mt-0.5",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Tv, { className: "size-4" })
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "min-w-0 flex-1",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "font-display text-sm font-semibold text-foreground",
										children: "No active TV detected"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
										className: "text-xs text-muted mt-0.5 leading-relaxed",
										children: [
											"Open the ",
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", {
												className: "text-foreground",
												children: "Jellyfin"
											}),
											" or ",
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", {
												className: "text-foreground",
												children: "Swiftfin"
											}),
											" app on your Apple TV, Roku, Fire TV, or Smart TV, then tap Refresh above."
										]
									})]
								})]
							}),
							!showPairing ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "pt-2 border-t border-white/5 flex items-center justify-between",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-[11px] text-muted",
									children: "Have a 6-digit QuickConnect TV code?"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
									variant: "ghost",
									size: "sm",
									className: "text-xs text-gold hover:bg-gold/10",
									onClick: () => setShowPairing(true),
									children: "Enter TV Code"
								})]
							}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "pt-2 border-t border-white/5 space-y-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-xs text-muted",
									children: "Enter the QuickConnect code shown on your TV screen to pair instantly:"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
									onSubmit: async (e) => {
										e.preventDefault();
										const clean = (quickConnectCode || "").replace(/[\s-]+/g, "");
										if (clean.length < 4) return;
										try {
											const j = await (await fetch("/api/quickconnect/authorize", {
												method: "POST",
												headers: { "Content-Type": "application/json" },
												body: JSON.stringify({ code: clean })
											})).json();
											if (j.ok) {
												showToast("TV Paired Successfully!", "success");
												setShowPairing(false);
												refreshSessions();
											} else showToast(j.error || "Invalid code", "error");
										} catch (err) {
											showToast(String(err), "error");
										}
									},
									className: "flex items-center gap-2",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "relative",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
												type: "text",
												maxLength: 8,
												placeholder: "000-000",
												value: quickConnectCode || "",
												onChange: (e) => setQuickConnectCode(e.target.value.toUpperCase()),
												className: "h-9 w-32 rounded-xl border border-white/10 bg-black/40 px-3 text-center font-mono text-sm font-bold tracking-widest text-gold uppercase focus:outline-none focus:border-gold"
											}), quickConnectCode ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
												type: "button",
												onClick: () => setQuickConnectCode(""),
												className: "absolute right-1.5 top-2 text-muted hover:text-foreground cursor-pointer",
												children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-3.5" })
											}) : null]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
											type: "submit",
											size: "sm",
											disabled: !quickConnectCode || quickConnectCode.replace(/[\s-]+/g, "").length < 4,
											children: "Authorize TV"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
											type: "button",
											variant: "ghost",
											size: "sm",
											onClick: () => setShowPairing(false),
											children: "Cancel"
										})
									]
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "pt-2.5 border-t border-white/5 space-y-2 text-xs",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "font-semibold text-foreground flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-gold",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "📺 Older or Budget TV? (Chromecast & AirPlay)" })
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "grid grid-cols-1 sm:grid-cols-2 gap-2 text-muted text-[11px]",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "rounded-xl border border-white/10 bg-white/5 p-2.5 space-y-1",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
											className: "font-bold text-foreground",
											children: "Google Cast / Chromecast"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
											className: "leading-relaxed",
											children: [
												"In Chrome, Edge, or Android, use the browser menu → ",
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("em", { children: "Cast…" }),
												" to beam directly to any HDMI Chromecast dongle or Google TV."
											]
										})]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "rounded-xl border border-white/10 bg-white/5 p-2.5 space-y-1",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
											className: "font-bold text-foreground",
											children: "Apple AirPlay"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
											className: "leading-relaxed",
											children: [
												"In Safari on iPhone, iPad, or Mac, tap the ",
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "AirPlay icon" }),
												" in the player to beam directly to Apple TV, Roku, or AirPlay 2 TVs."
											]
										})]
									})]
								})]
							})
						]
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-6 space-y-3",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center justify-between",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "text-xs font-bold uppercase tracking-wider text-muted font-mono flex items-center gap-1.5",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Smartphone, { className: "size-3.5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Play on this Device" })]
							}), isAndroid && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "rounded-full bg-gold/10 px-2 py-0.5 text-[10px] font-mono text-gold border border-gold/20",
								children: "Android Detected"
							})]
						}),
						isAndroid && androidPref ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center justify-between rounded-xl border border-gold/30 bg-gold/5 px-3 py-1.5 text-xs text-muted",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: ["Default: ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", {
								className: "text-gold capitalize",
								children: androidPref === "vlc" ? "VLC Player" : "Web Browser"
							})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: () => {
									localStorage.removeItem("reelos_android_player_pref");
									setAndroidPref(null);
								},
								className: "text-[11px] text-gold underline hover:opacity-80 cursor-pointer",
								children: "Reset choice"
							})]
						}) : isAndroid ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-2 rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2 text-xs",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								type: "checkbox",
								id: "rememberAndroid",
								checked: rememberAndroidPref,
								onChange: (e) => setRememberAndroidPref(e.target.checked),
								className: "size-4 rounded accent-gold"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
								htmlFor: "rememberAndroid",
								className: "text-muted cursor-pointer select-none",
								children: "Don't ask again on this device (always use this player)"
							})]
						}) : null,
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
							to: "/play/$id",
							params: { id: title.id },
							search: {
								season: activeSeason,
								episode: activeEpisode,
								mediaId: browserSourceId
							},
							onClick: handleSelectBrowser,
							className: "w-full flex items-center justify-between rounded-2xl border border-gold/40 bg-gold/15 p-4 text-left hover:bg-gold/25 transition-all group cursor-pointer",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center gap-3.5",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "flex size-10 items-center justify-center rounded-xl bg-gold text-black font-bold shrink-0 shadow-sm",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Play, { className: "size-5 fill-current" })
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "font-display text-sm font-bold text-gold flex items-center gap-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Watch in Browser" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "rounded-full bg-gold/20 px-2 py-0.5 text-[10px] font-mono text-gold border border-gold/30",
										children: "Instant Start · No App Needed"
									})]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-xs text-muted mt-0.5",
									children: "Plays smoothly right now in your web browser with zero buffering"
								})] })]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Play, { className: "size-4 text-gold group-hover:scale-110 transition-transform fill-current shrink-0" })]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							onClick: launchVlc,
							className: "w-full flex items-center justify-between rounded-2xl border border-border/80 bg-card/80 p-3.5 text-left hover:bg-card-2 hover:border-white/20 transition-all group cursor-pointer",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center gap-3",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "flex size-9 items-center justify-center rounded-xl bg-white/5 text-foreground shrink-0 border border-white/5",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Play, { className: "size-4 fill-current" })
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "font-display text-xs font-semibold text-foreground group-hover:text-gold transition-colors flex items-center gap-1.5",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Play in VLC App" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "rounded bg-white/10 px-1.5 py-0.2 text-[9px] font-mono text-muted",
										children: "Optional · 4K HDR"
									})]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-[11px] text-muted",
									children: "External hardware decode for maximum bitrates"
								})] })]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Play, { className: "size-3.5 text-muted group-hover:text-gold transition-colors fill-current" })]
						}),
						jfWebHref ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("a", {
							href: jfWebHref,
							target: "_blank",
							rel: "noreferrer",
							onClick: onClose,
							className: "w-full flex items-center justify-between rounded-2xl border border-border/80 bg-card/80 p-3.5 text-left hover:bg-card-2 hover:border-white/20 transition-all group",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center gap-3",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "flex size-9 items-center justify-center rounded-xl bg-white/5 text-foreground shrink-0 border border-white/5",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Clapperboard, { className: "size-4" })
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "font-display text-xs font-semibold text-foreground group-hover:text-gold transition-colors",
									children: "Open in Jellyfin App"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-[11px] text-muted",
									children: "Native mobile app for Android / iOS"
								})] })]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ExternalLink, { className: "size-3.5 text-muted group-hover:text-foreground transition-colors" })]
						}) : null
					]
				})
			]
		})
	});
}
var originalCueTimes = /* @__PURE__ */ new WeakMap();
function clampSubtitleOffset(offsetMs) {
	return Number.isFinite(offsetMs) ? Math.max(-2e3, Math.min(2e3, offsetMs)) : 0;
}
function restoreCues(track) {
	if (!track.cues) return;
	for (const cue of Array.from(track.cues)) {
		const original = originalCueTimes.get(cue);
		if (original) {
			cue.startTime = original.start;
			cue.endTime = original.end;
		}
	}
}
/**
* Match the actual <track data-subtitle-index="…">, never a language or label.
* Call again on track load so newly available cues receive the current offset.
*/
function synchronizePlaybackSubtitles(video, selectedMetadataIndex, requestedOffsetMs = 0) {
	const offsetMs = clampSubtitleOffset(requestedOffsetMs);
	const tracks = Array.from(video.textTracks);
	const selectedElement = selectedMetadataIndex !== null && String(selectedMetadataIndex).length > 0 ? Array.from(video.querySelectorAll("track[data-subtitle-index]")).find((element) => element.getAttribute("data-subtitle-index") === String(selectedMetadataIndex)) : void 0;
	const selectedTrack = selectedElement && tracks.includes(selectedElement.track) ? selectedElement.track : null;
	for (const track of tracks) {
		if (track !== selectedTrack) restoreCues(track);
		track.mode = track === selectedTrack ? "showing" : "disabled";
	}
	let appliedCueCount = 0;
	if (selectedTrack?.cues) for (const cue of Array.from(selectedTrack.cues)) {
		let original = originalCueTimes.get(cue);
		if (!original) {
			original = {
				start: cue.startTime,
				end: cue.endTime
			};
			originalCueTimes.set(cue, original);
		}
		const start = Math.max(0, original.start + offsetMs / 1e3);
		cue.startTime = start;
		cue.endTime = Math.max(start, original.end + offsetMs / 1e3);
		appliedCueCount += 1;
	}
	return {
		available: selectedTrack !== null,
		appliedCueCount,
		offsetMs
	};
}
var MediaRetentionError = class extends Error {
	status;
	code;
	invalidatesSnapshot;
	constructor(message, status, code, invalidatesSnapshot) {
		super(message);
		this.name = "MediaRetentionError";
		this.status = status;
		this.code = code;
		this.invalidatesSnapshot = invalidatesSnapshot;
	}
};
var isFileVersion = (value) => typeof value === "string" && /^[a-f0-9]{64}$/i.test(value);
async function readRetention(response, identity, keep, expectedFileVersion) {
	const payload = await response.json().catch(() => null);
	if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new MediaRetentionError("Retention returned an invalid acknowledgement", response.status, "malformed_retention_ack", true);
	const result = payload;
	if (!response.ok || result.ok === false) {
		const code = typeof result.code === "string" ? result.code : "retention_request_failed";
		const invalidatesSnapshot = [
			401,
			403,
			404,
			409
		].includes(response.status) || code === "retention_identity_changed" || code === "identity_changed" || code === "retention_unavailable";
		throw new MediaRetentionError(typeof result.error === "string" ? result.error : "Retention unavailable", response.status, code, invalidatesSnapshot);
	}
	if (result.ok !== true || result.profileId !== identity.expectedProfileId || result.id !== identity.id || result.storage !== "local-original" || typeof result.kept !== "boolean" || !isFileVersion(result.fileVersion) || keep !== void 0 && (result.persisted !== true || result.kept !== keep || result.fileVersion !== expectedFileVersion)) throw new MediaRetentionError("Retention was not acknowledged for this file version and profile", response.status, "malformed_retention_ack", true);
	return {
		profileId: identity.expectedProfileId,
		id: identity.id,
		kept: result.kept,
		storage: "local-original",
		fileVersion: result.fileVersion
	};
}
function assertIdentity(identity) {
	if (!identity.id?.trim() || !identity.expectedProfileId?.trim()) throw new Error("A verified file and profile are required");
}
async function loadMediaRetention(identity, signal, fetcher = fetch) {
	assertIdentity(identity);
	return readRetention(await fetcher(`/api/library/keep?${new URLSearchParams({
		id: identity.id,
		expectedProfileId: identity.expectedProfileId
	})}`, {
		cache: "no-store",
		signal
	}), identity);
}
async function saveMediaRetention(identity, keep, signal, fetcher = fetch) {
	assertIdentity(identity);
	if (!isFileVersion(identity.expectedFileVersion)) throw new MediaRetentionError("Check the current file version before keeping it", 0, "retention_version_required", true);
	if (typeof keep !== "boolean") throw new Error("Choose whether to keep this local original");
	return readRetention(await fetcher("/api/library/keep", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			id: identity.id,
			expectedProfileId: identity.expectedProfileId,
			expectedFileVersion: identity.expectedFileVersion,
			keep
		}),
		signal
	}), identity, keep, identity.expectedFileVersion);
}
var emptyState = () => ({
	snapshot: null,
	loading: false,
	saving: false,
	error: null
});
/** A mounted file/profile scope; only its acknowledged GET may authorize a later POST. */
function createMediaRetentionController({ id, expectedProfileId, onChange, isCurrent = () => true, fetcher = fetch }) {
	let state = emptyState();
	let generation = 0;
	let disposed = false;
	let pending = null;
	const current = (request) => !disposed && request === generation && isCurrent();
	const publish = (next) => {
		state = next;
		onChange?.(next);
	};
	function begin() {
		pending?.abort();
		pending = new AbortController();
		generation += 1;
		return {
			request: generation,
			signal: pending.signal
		};
	}
	return {
		getState: () => state,
		async load() {
			if (disposed || !isCurrent()) return false;
			const { request, signal } = begin();
			publish({
				...emptyState(),
				loading: true
			});
			try {
				const snapshot = await loadMediaRetention({
					id,
					expectedProfileId
				}, signal, fetcher);
				if (!current(request)) return false;
				publish({
					snapshot,
					loading: false,
					saving: false,
					error: null
				});
				return true;
			} catch (error) {
				if (current(request)) publish({
					...emptyState(),
					error: "This home could not verify a local original. Nothing was marked as kept by this attempt. Retry to check this file.",
					failure: error instanceof MediaRetentionError ? {
						status: error.status,
						code: error.code
					} : void 0
				});
				return false;
			}
		},
		async save(keep) {
			if (disposed || !isCurrent() || state.loading || state.saving) return false;
			const acknowledged = state.snapshot;
			if (!acknowledged) {
				publish({
					...state,
					error: "Check this file's library status before keeping it."
				});
				return false;
			}
			const { request, signal } = begin();
			publish({
				...state,
				saving: true,
				error: null,
				failure: void 0
			});
			try {
				const snapshot = await saveMediaRetention({
					id: acknowledged.id,
					expectedProfileId: acknowledged.profileId,
					expectedFileVersion: acknowledged.fileVersion
				}, keep, signal, fetcher);
				if (!current(request)) return false;
				publish({
					snapshot,
					loading: false,
					saving: false,
					error: null
				});
				return true;
			} catch (error) {
				if (current(request)) publish({
					...state,
					snapshot: error instanceof MediaRetentionError && error.invalidatesSnapshot ? null : state.snapshot,
					saving: false,
					error: "Your library choice could not be confirmed. Retry checking this file, then choose again if needed.",
					failure: error instanceof MediaRetentionError ? {
						status: error.status,
						code: error.code
					} : void 0
				});
				return false;
			}
		},
		dispose() {
			disposed = true;
			generation += 1;
			pending?.abort();
		}
	};
}
/** Changing the file, profile, or playback scope clears all previous retention UI. */
function useMediaRetention(id, expectedProfileId, scope, isCurrent) {
	const key = JSON.stringify([
		id,
		expectedProfileId,
		scope
	]);
	const currentKey = (0, import_react.useRef)(key);
	currentKey.current = key;
	const currentGuard = (0, import_react.useRef)(isCurrent);
	currentGuard.current = isCurrent;
	const controllerRef = (0, import_react.useRef)(null);
	const [stored, setStored] = (0, import_react.useState)({
		key: "",
		state: emptyState()
	});
	(0, import_react.useEffect)(() => {
		if (!id || !expectedProfileId) {
			setStored({
				key,
				state: {
					...emptyState(),
					error: "Library keeping is unavailable until this file and your profile are verified."
				}
			});
			return;
		}
		const controller = createMediaRetentionController({
			id,
			expectedProfileId,
			isCurrent: () => currentKey.current === key && (currentGuard.current?.() ?? true),
			onChange: (state) => setStored({
				key,
				state
			})
		});
		controllerRef.current = {
			key,
			controller
		};
		controller.load();
		return () => {
			controller.dispose();
			if (controllerRef.current?.controller === controller) controllerRef.current = null;
		};
	}, [
		id,
		expectedProfileId,
		key
	]);
	const retry = (0, import_react.useCallback)(() => {
		if (controllerRef.current?.key === key) controllerRef.current.controller.load();
	}, [key]);
	const save = (0, import_react.useCallback)((keep) => controllerRef.current?.key === key ? controllerRef.current.controller.save(keep) : Promise.resolve(false), [key]);
	return {
		...stored.key === key ? stored.state : {
			...emptyState(),
			loading: Boolean(id && expectedProfileId)
		},
		retry,
		save,
		canCheck: Boolean(id && expectedProfileId)
	};
}
var record = (value) => Boolean(value && typeof value === "object" && !Array.isArray(value));
function parseFamilyTreatmentManifest(value) {
	if (!record(value) || value.schema !== "reelos.family-treatment/v1" || !record(value.media) || !record(value.timebase) || !record(value.verification) || !record(value.intervals) || value.verification.status !== "verified" || value.timebase.ticksPerSecond !== 1e7 || !Number.isSafeInteger(value.timebase.durationTicks) || Number(value.timebase.durationTicks) <= 0 || !Number.isSafeInteger(value.verification.verifiedAt) || Number(value.verification.verifiedAt) <= 0 || typeof value.verification.evidenceId !== "string" || !value.verification.evidenceId.trim()) return null;
	const media = value.media;
	const timebase = value.timebase;
	const intervals = value.intervals;
	if (![
		media.itemId,
		media.mediaSourceId,
		media.editionFingerprint
	].every((field) => typeof field === "string" && field.length > 0)) return null;
	const parseIntervals = (kind, actions) => {
		const raw = intervals[kind];
		if (!Array.isArray(raw)) return null;
		let priorEnd = 0;
		const parsed = [];
		for (const entry of raw) {
			if (!record(entry) || !actions.includes(String(entry.action)) || !Number.isSafeInteger(entry.startTicks) || !Number.isSafeInteger(entry.endTicks) || Number(entry.startTicks) < priorEnd || Number(entry.endTicks) <= Number(entry.startTicks) || Number(entry.endTicks) > Number(timebase.durationTicks)) return null;
			if (kind === "subtitle" && entry.action === "replace" && (typeof entry.replacement !== "string" || !entry.replacement.trim())) return null;
			parsed.push({
				startTicks: Number(entry.startTicks),
				endTicks: Number(entry.endTicks),
				action: String(entry.action),
				...typeof entry.replacement === "string" ? { replacement: entry.replacement } : {}
			});
			priorEnd = Number(entry.endTicks);
		}
		return parsed;
	};
	const visual = parseIntervals("visual", ["skip", "hide"]);
	const audio = parseIntervals("audio", ["mute", "soften"]);
	const subtitle = parseIntervals("subtitle", ["hide", "replace"]);
	if (!visual || !audio || !subtitle) return null;
	return value;
}
function active(intervals, ticks) {
	return intervals.find((interval) => ticks >= interval.startTicks && ticks < interval.endTicks) ?? null;
}
function familyTreatmentFrame(manifest, currentSeconds) {
	const empty = {
		skipToSeconds: null,
		hideVisual: false,
		muteAudio: false,
		hideSubtitles: false,
		subtitleReplacement: null
	};
	if (!manifest || !Number.isFinite(currentSeconds) || currentSeconds < 0) return empty;
	const ticks = Math.floor(currentSeconds * manifest.timebase.ticksPerSecond);
	const visual = active(manifest.intervals.visual, ticks);
	const audio = active(manifest.intervals.audio, ticks);
	const subtitle = active(manifest.intervals.subtitle, ticks);
	return {
		skipToSeconds: visual?.action === "skip" ? visual.endTicks / manifest.timebase.ticksPerSecond : null,
		hideVisual: visual?.action === "hide",
		muteAudio: Boolean(audio),
		hideSubtitles: Boolean(subtitle),
		subtitleReplacement: subtitle?.action === "replace" ? subtitle.replacement?.trim() || null : null
	};
}
async function postPlaybackSession(action, body, signal, fetcher = fetch) {
	const response = await fetcher(`/api/playback/${action}`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
		signal,
		keepalive: action === "stop"
	});
	let payload = {};
	try {
		const parsed = await response.json();
		if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) payload = parsed;
	} catch {}
	const familyTreatment = parseFamilyTreatmentManifest(payload.familyTreatment);
	return {
		ok: response.ok && payload.ok === true,
		status: response.status,
		code: typeof payload.code === "string" ? payload.code : void 0,
		error: typeof payload.error === "string" ? payload.error : void 0,
		presenceKey: typeof payload.presenceKey === "string" ? payload.presenceKey : void 0,
		...familyTreatment ? { familyTreatment } : {}
	};
}
function playbackPosition(video) {
	return {
		positionTicks: Math.floor(Math.max(0, Number.isFinite(video.currentTime) ? video.currentTime : 0) * 1e7),
		durationTicks: Number.isFinite(video.duration) && video.duration > 0 ? Math.floor(video.duration * 1e7) : void 0,
		isPaused: video.paused
	};
}
async function savePrivatePlaybackProgress(body, fetcher = fetch) {
	const response = await fetcher("/api/profiles/progress", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
		keepalive: true
	});
	const result = await response.json().catch(() => ({}));
	if (!response.ok || result.ok !== true || result.persisted !== true) throw new Error("Your playback position could not be saved. Keep this page open and try again.");
}
function playbackSessionNeedsRestart(result) {
	return result.status === 409 && result.code === "playback_session_not_started";
}
async function savePrivateTitleReaction(body, fetcher = fetch) {
	const response = await fetcher("/api/profiles/reaction", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body)
	});
	const result = await response.json().catch(() => ({}));
	if (!response.ok || result.ok !== true || result.persisted !== true || result.profileId !== body.expectedProfileId || result.titleId !== body.titleId || result.reaction !== body.reaction) throw new Error("Your reaction was not saved. Please try again.");
}
function playbackSessionFailureMessage(result) {
	if (result.status === 401 || result.status === 403) return result.error || "Playback controls need an authorized profile. Open your profile and try again.";
	return result.error || "Playback controls could not connect to this home. Please try again.";
}
var TICKS = 1e7;
async function jsonRequest(url, init, fetcher) {
	const response = await fetcher(url, init);
	const payload = await response.json().catch(() => ({}));
	if (!response.ok || payload.ok === false) throw new Error(typeof payload.error === "string" ? payload.error : "Companion is unavailable.");
	return payload;
}
function publishPlayerCompanionSession(session, fetcher = fetch) {
	return jsonRequest("/api/companion/session", {
		method: "POST",
		credentials: "same-origin",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(session)
	}, fetcher);
}
function stopPlayerCompanionSession(sessionId, fetcher = fetch) {
	return jsonRequest("/api/companion/stop", {
		method: "POST",
		credentials: "same-origin",
		keepalive: true,
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ sessionId })
	}, fetcher);
}
async function pollPlayerCompanionCommands(sessionId, signal, fetcher = fetch) {
	const payload = await jsonRequest(`/api/companion/remote/poll?sessionId=${encodeURIComponent(sessionId)}`, {
		cache: "no-store",
		credentials: "same-origin",
		signal
	}, fetcher);
	if (!Array.isArray(payload.commands)) return [];
	return payload.commands.flatMap((raw) => {
		if (!raw || typeof raw !== "object") return [];
		const value = raw;
		if (typeof value.id !== "string" || ![
			"play",
			"pause",
			"seek"
		].includes(String(value.action))) return [];
		const source = value.payload && typeof value.payload === "object" ? value.payload : {};
		const cleanNumber = (candidate) => Number.isSafeInteger(candidate) ? Number(candidate) : void 0;
		return [{
			id: value.id,
			action: value.action,
			payload: {
				deltaTicks: cleanNumber(source.deltaTicks),
				positionTicks: cleanNumber(source.positionTicks)
			}
		}];
	});
}
async function consumePlayerCompanionCommand(video, command) {
	if (command.action === "play") {
		await video.play();
		return;
	}
	if (command.action === "pause") {
		video.pause();
		return;
	}
	const target = command.payload.positionTicks !== void 0 ? command.payload.positionTicks / TICKS : video.currentTime + (command.payload.deltaTicks ?? 0) / TICKS;
	if (!Number.isFinite(target)) return;
	video.currentTime = Math.max(0, Math.min(Number.isFinite(video.duration) ? video.duration : target, target));
}
function playerCompanionTiming(video) {
	return {
		positionTicks: Math.floor(Math.max(0, Number.isFinite(video.currentTime) ? video.currentTime : 0) * TICKS),
		durationTicks: Math.floor(Math.max(0, Number.isFinite(video.duration) ? video.duration : 0) * TICKS),
		isPaused: video.paused
	};
}
function PlayerView({ id, season: propSeason, episode: propEpisode, mediaId: propMediaId }) {
	const navigate = useNavigate();
	const activeProfileId = useExperienceStore((state) => state.activeProfileId);
	const catalog = getTitle(id);
	const shelf = useReelStore((s) => s.shelf.find((t) => titleMatchesId(t, id)));
	const remote = useReelStore((s) => s.remoteTitles.find((t) => titleMatchesId(t, id) || t.id === id));
	const [fetchedTitle, setFetchedTitle] = (0, import_react.useState)(null);
	const verifiedTitleLoaded = (0, import_react.useRef)(false);
	const title = (0, import_react.useMemo)(() => {
		const record = fetchedTitle ?? shelf ?? catalog ?? remote;
		return record ? {
			...record,
			id: record.id || id,
			title: record.title || "Personal media"
		} : null;
	}, [
		catalog,
		shelf,
		remote,
		fetchedTitle,
		id
	]);
	(0, import_react.useEffect)(() => {
		if (catalog || shelf || remote || !id) return;
		let active = true;
		fetch(`/api/lookup?id=${encodeURIComponent(id)}`).then((r) => r.ok ? r.json() : null).then((d) => {
			if (!active || verifiedTitleLoaded.current) return;
			const hit = d?.titles?.[0];
			if (hit && typeof hit.id === "string" && titleMatchesId(hit, id)) setFetchedTitle(hit);
			else setFetchedTitle({
				id,
				title: id.replace(/^(tmdb-|tvdb-|jf-)/, "Feature "),
				year: (/* @__PURE__ */ new Date()).getFullYear()
			});
		}).catch(() => {
			if (!active || verifiedTitleLoaded.current) return;
			setFetchedTitle({
				id,
				title: "Feature Presentation",
				year: (/* @__PURE__ */ new Date()).getFullYear()
			});
		});
		return () => {
			active = false;
		};
	}, [
		id,
		catalog,
		shelf,
		remote
	]);
	const [showRetentionCard, setShowRetentionCard] = (0, import_react.useState)(false);
	const [retentionDecisionMade, setRetentionDecisionMade] = (0, import_react.useState)(false);
	const [showLibraryKeeping, setShowLibraryKeeping] = (0, import_react.useState)(false);
	const isSeries = title?.kind === "tv" || title?.kind === "series" || id.startsWith("tvdb-") || id.startsWith("tmdb-tv-");
	const [resolvedEpisode, setResolvedEpisode] = (0, import_react.useState)(null);
	const [seasonEpisodes, setSeasonEpisodes] = (0, import_react.useState)([]);
	const [resolvedMediaId, setResolvedMediaId] = (0, import_react.useState)(null);
	const [sourcesLoading, setSourcesLoading] = (0, import_react.useState)(true);
	const [sourceError, setSourceError] = (0, import_react.useState)(null);
	const [sourceAttempt, setSourceAttempt] = (0, import_react.useState)(0);
	const [showCompanionQr, setShowCompanionQr] = (0, import_react.useState)(false);
	(0, import_react.useEffect)(() => {
		if (!isSeries) return;
		let active = true;
		const sNum = propSeason || 1;
		fetch(`/api/episodes?id=${encodeURIComponent(id)}&season=${sNum}`).then((r) => r.ok ? r.json() : null).then((data) => {
			if (!active) return;
			const eps = Array.isArray(data?.episodes) ? data.episodes : [];
			setSeasonEpisodes(eps);
			if (propMediaId) return;
			const target = propEpisode ? eps.find((e) => e.episodeNumber === propEpisode && e.jellyfinId) || eps.find((e) => e.episodeNumber === propEpisode) : eps.find((e) => e.status === "in-library" && e.jellyfinId) || eps[0];
			if (target) setResolvedEpisode({
				jellyfinId: target.jellyfinId,
				season: sNum,
				episode: target.episodeNumber,
				title: target.title
			});
		}).catch(() => {});
		return () => {
			active = false;
		};
	}, [
		id,
		isSeries,
		propSeason,
		propEpisode,
		propMediaId
	]);
	const activeSeason = propSeason ?? resolvedEpisode?.season;
	const activeEpisode = propEpisode ?? resolvedEpisode?.episode;
	const activeEpisodeTitle = resolvedEpisode?.title;
	const jfId = propMediaId || resolvedEpisode?.jellyfinId || shelf?.jellyfinId || resolvedMediaId || (id.startsWith("jf-") ? id.replace(/^jf-/, "") : id);
	const ipv4 = useReelStore((s) => s.ipv4);
	const tailscaleIp = useReelStore((s) => s.tailscaleIp);
	const watch = useReelStore((s) => s.watch);
	const hostname = typeof window !== "undefined" ? window.location.hostname : "";
	const [mediaSourcesData, setMediaSourcesData] = (0, import_react.useState)(null);
	const [activeSourceId, setActiveSourceId] = (0, import_react.useState)(null);
	const retentionSourceVerified = !sourcesLoading && !sourceError && mediaSourcesData?.retentionSourceId === jfId && mediaSourcesData?.activeProfileId === activeProfileId;
	const retentionTitleId = retentionSourceVerified ? mediaSourcesData?.retentionTitleId || (isSeries ? jfId : mediaSourcesData?.progressTitleId || jfId) : null;
	const retentionProfileId = retentionSourceVerified ? mediaSourcesData?.activeProfileId || null : null;
	const retentionScope = JSON.stringify([
		id,
		jfId,
		activeSeason,
		activeEpisode,
		activeProfileId
	]);
	const retention = useMediaRetention(retentionTitleId, retentionProfileId, retentionScope, () => useExperienceStore.getState().activeProfileId === retentionProfileId);
	const savedToLibrary = retention.snapshot?.kept === true;
	const savingToLibrary = retention.saving;
	(0, import_react.useEffect)(() => {
		setShowRetentionCard(false);
		setRetentionDecisionMade(false);
		setShowLibraryKeeping(false);
	}, [retentionScope]);
	const currentSource = mediaSourcesData?.sources?.find((s) => s.id === activeSourceId) || mediaSourcesData?.recommendedForBrowser;
	const streamUrl = jellyfinStreamUrl({
		ipv4,
		tailscaleIp,
		watch,
		hostname,
		jellyfinId: jfId
	});
	const playSessionId = (0, import_react.useMemo)(() => typeof crypto !== "undefined" && typeof crypto.randomUUID === "function" ? crypto.randomUUID().replace(/-/g, "") : `sess${Date.now()}${Math.random().toString(36).slice(2)}`, [streamUrl]);
	const [audioPreset, setAudioPreset] = (0, import_react.useState)("off");
	const [audioError, setAudioError] = (0, import_react.useState)(null);
	const [showSound, setShowSound] = (0, import_react.useState)(false);
	const [playbackError, setPlaybackError] = (0, import_react.useState)(null);
	const [playbackSessionError, setPlaybackSessionError] = (0, import_react.useState)(null);
	const [progressError, setProgressError] = (0, import_react.useState)(null);
	const restoredSource = (0, import_react.useRef)(null);
	const lastPrivateSave = (0, import_react.useRef)(0);
	const privateSaveQueue = (0, import_react.useRef)(Promise.resolve());
	const videoRef = (0, import_react.useRef)(null);
	const playbackScopeRef = (0, import_react.useRef)(null);
	const boosterRef = (0, import_react.useRef)(null);
	const unsubscribeAudio = (0, import_react.useRef)(null);
	const audioRevision = (0, import_react.useRef)(0);
	const bufferTimerRef = (0, import_react.useRef)(null);
	const [showStallPrompt, setShowStallPrompt] = (0, import_react.useState)(false);
	const [familyFrame, setFamilyFrame] = (0, import_react.useState)(() => familyTreatmentFrame(null, 0));
	const familyMuteRestore = (0, import_react.useRef)(null);
	const savePrivatePosition = (force = false) => {
		const video = videoRef.current;
		if (!video || video.seeking || !Number.isFinite(video.duration) || video.duration <= 0 || !mediaSourcesData?.activeProfileId || !mediaSourcesData.progressTitleId || restoredSource.current !== streamUrl) return;
		if (!force && Date.now() - lastPrivateSave.current < 5e3) return;
		lastPrivateSave.current = Date.now();
		const body = {
			expectedProfileId: mediaSourcesData.activeProfileId,
			titleId: mediaSourcesData.progressTitleId,
			progress: Math.max(0, Math.min(1, video.currentTime / video.duration))
		};
		privateSaveQueue.current = privateSaveQueue.current.catch(() => {}).then(() => savePrivatePlaybackProgress(body)).then(() => setProgressError(null)).catch(() => setProgressError("Your playback position has not been saved. Pause to retry."));
	};
	const restorePrivatePosition = () => {
		const video = videoRef.current;
		if (!video || !mediaSourcesData || !Number.isFinite(video.duration) || video.duration <= 0 || restoredSource.current === streamUrl) return;
		restoredSource.current = streamUrl;
		const fraction = mediaSourcesData.resumeProgress ?? 0;
		if (fraction > 0 && fraction < .99) video.currentTime = fraction * video.duration;
	};
	(0, import_react.useEffect)(() => {
		restorePrivatePosition();
	}, [mediaSourcesData, streamUrl]);
	const jfOrigin = jellyfinWatchOrigin({
		ipv4,
		tailscaleIp,
		watch,
		hostname
	});
	const [selectedSubIndex, setSelectedSubIndex] = (0, import_react.useState)(-1);
	const [subSyncOffsetMs, setSubSyncOffsetMs] = (0, import_react.useState)(0);
	const availableSubtitles = Array.isArray(currentSource?.subtitles) ? currentSource.subtitles : [];
	const cycleSubtitles = () => {
		if (!availableSubtitles.length) return;
		if (selectedSubIndex === -1) {
			const first = availableSubtitles[0];
			setSelectedSubIndex(first?.index ?? 0);
			showToast(`Subtitles: ${first?.label || "On"}`, "info");
		} else {
			const currentIdx = availableSubtitles.findIndex((s) => s.index === selectedSubIndex);
			if (currentIdx >= availableSubtitles.length - 1) {
				setSelectedSubIndex(-1);
				showToast("Subtitles: Off", "info");
			} else {
				const next = availableSubtitles[currentIdx + 1];
				setSelectedSubIndex(next?.index ?? -1);
				showToast(`Subtitles: ${next?.label || "On"}`, "info");
			}
		}
	};
	const activeSubLabel = selectedSubIndex === -1 ? "Subs Off" : availableSubtitles.find((s) => s.index === selectedSubIndex)?.label || "Subs On";
	(0, import_react.useEffect)(() => {
		if (!videoRef.current) return;
		synchronizePlaybackSubtitles(videoRef.current, familyFrame.hideSubtitles || selectedSubIndex < 0 ? null : selectedSubIndex, subSyncOffsetMs);
	}, [
		selectedSubIndex,
		availableSubtitles,
		subSyncOffsetMs,
		familyFrame.hideSubtitles
	]);
	const handleKeepInLibrary = async (keep = true) => {
		if (!await retention.save(keep)) return;
		setRetentionDecisionMade(true);
		setShowRetentionCard(false);
		showToast(keep ? "Kept in your library." : "Library pin removed. The file was not deleted.", "success");
	};
	const handleJustBrowsing = () => {
		setRetentionDecisionMade(true);
		setShowRetentionCard(false);
		showToast("Keep watching. No files were deleted.", "info");
	};
	const [introData, setIntroData] = (0, import_react.useState)(null);
	const [showSkipIntro, setShowSkipIntro] = (0, import_react.useState)(false);
	const introFadeTimerRef = (0, import_react.useRef)(null);
	const introShownRef = (0, import_react.useRef)(false);
	const [showRatingPill, setShowRatingPill] = (0, import_react.useState)(false);
	const [ratingDismissed, setRatingDismissed] = (0, import_react.useState)(false);
	const prewarmedRef = (0, import_react.useRef)(false);
	const [ratingSaving, setRatingSaving] = (0, import_react.useState)(false);
	const [ratingError, setRatingError] = (0, import_react.useState)(null);
	const [savedReaction, setSavedReaction] = (0, import_react.useState)(null);
	const handleRate = async (rating) => {
		if (ratingSaving) return;
		setRatingSaving(true);
		try {
			if (!mediaSourcesData?.activeProfileId || !mediaSourcesData.progressTitleId) throw new Error("Profile unavailable");
			await savePrivateTitleReaction({
				expectedProfileId: mediaSourcesData.activeProfileId,
				titleId: mediaSourcesData.progressTitleId,
				reaction: rating
			});
			setSavedReaction(rating);
			setRatingError(null);
			showToast(rating ? "Saved to your taste." : "Reaction cleared.", "success");
		} catch {
			setRatingError("Your reaction was not saved. Please try again.");
		} finally {
			setRatingSaving(false);
		}
	};
	const [showSubSyncPanel, setShowSubSyncPanel] = (0, import_react.useState)(false);
	const [showRecapModal, setShowRecapModal] = (0, import_react.useState)(false);
	const [recapData, setRecapData] = (0, import_react.useState)(null);
	const applySubtitleOffset = (offsetMs) => {
		setSubSyncOffsetMs(Number.isFinite(offsetMs) ? Math.max(-2e3, Math.min(2e3, offsetMs)) : 0);
	};
	const handleAutoSyncSubtitles = async () => {
		showToast("Automatic timing needs a measured dialogue track for this edition. You can adjust timing manually.", "info");
	};
	const markPriorEpisodesWatched = async (targetEpisodeNumber) => {
		const priorEpisodes = seasonEpisodes.filter((e) => (e.episodeNumber || 0) < targetEpisodeNumber);
		if (!priorEpisodes.length) {
			showToast("No prior episodes in this season", "info");
			return;
		}
		try {
			for (const ep of priorEpisodes) if (ep.jellyfinId) fetch(`/api/library/progress`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					id: ep.jellyfinId,
					played: true,
					playedPercentage: 100
				})
			}).catch(() => {});
			showToast(`Marked ${priorEpisodes.length} prior episodes watched`, "success");
		} catch {
			showToast("Failed to update progress", "error");
		}
	};
	const openRecap = async () => {
		setRecapData({
			storySoFar: [],
			whyAreTheyHere: "A recap limited to your current position is not available for this edition yet. No later plot details are shown."
		});
		setShowRecapModal(true);
	};
	const [upNextPrompt, setUpNextPrompt] = (0, import_react.useState)(false);
	const [upNextCount, setUpNextCount] = (0, import_react.useState)(5);
	const upNextTimerRef = (0, import_react.useRef)(null);
	const [showLauncher, setShowLauncher] = (0, import_react.useState)(false);
	const currentEpIndex = activeEpisode ? seasonEpisodes.findIndex((e) => e.episodeNumber === activeEpisode) : -1;
	const prevEpisode = currentEpIndex > 0 ? seasonEpisodes[currentEpIndex - 1] : null;
	const nextEpisode = currentEpIndex >= 0 && currentEpIndex < seasonEpisodes.length - 1 ? seasonEpisodes[currentEpIndex + 1] : null;
	const goToEpisode = (ep) => {
		if (!ep) return;
		prewarmedRef.current = false;
		setUpNextPrompt(false);
		if (upNextTimerRef.current) clearInterval(upNextTimerRef.current);
		setPlaybackError(null);
		setSourcesLoading(true);
		setMediaSourcesData(null);
		setActiveSourceId(null);
		navigate({
			to: "/play/$id",
			params: { id },
			search: {
				season: activeSeason,
				episode: ep.episodeNumber,
				mediaId: ep.jellyfinId
			}
		});
	};
	const handleWaiting = () => {
		if (!bufferTimerRef.current) bufferTimerRef.current = setTimeout(() => {
			setShowStallPrompt(true);
		}, 3500);
	};
	const handlePlaying = (event) => {
		setShowStallPrompt(false);
		if (bufferTimerRef.current) {
			clearTimeout(bufferTimerRef.current);
			bufferTimerRef.current = null;
		}
		const scope = playbackScopeRef.current;
		if (scope && !scope.cancelled && event.currentTarget === videoRef.current) startPlaybackSession(scope);
	};
	function handleVideoEnded() {
		if (!shelf && !retentionDecisionMade) setShowRetentionCard(true);
		if (!ratingDismissed) setShowRatingPill(true);
		if (nextEpisode) {
			setUpNextPrompt(true);
			setUpNextCount(5);
			if (upNextTimerRef.current) clearInterval(upNextTimerRef.current);
			upNextTimerRef.current = setInterval(() => {
				setUpNextCount((prev) => {
					if (prev <= 1) {
						if (upNextTimerRef.current) clearInterval(upNextTimerRef.current);
						goToEpisode(nextEpisode);
						return 0;
					}
					return prev - 1;
				});
			}, 1e3);
		}
	}
	const [idle, setIdle] = (0, import_react.useState)(false);
	const idleTimerRef = (0, import_react.useRef)(null);
	(0, import_react.useEffect)(() => {
		const handleActivity = () => {
			setIdle(false);
			if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
			idleTimerRef.current = setTimeout(() => setIdle(true), 3500);
		};
		const handleKeyDown = (e) => {
			handleActivity();
			if (e.key === "Escape") {
				setShowSound(false);
				setShowRatingPill(false);
				setShowSubSyncPanel(false);
				setShowRecapModal(false);
				return;
			}
			const target = e.target;
			if (target && (target.closest("button, a, input, textarea, select, video, [role=dialog]") || target.isContentEditable)) return;
			if (e.code === "Space") {
				e.preventDefault();
				if (videoRef.current) {
					if (videoRef.current.paused) videoRef.current.play().catch((error) => {
						if (!(error instanceof DOMException && error.name === "AbortError")) setPlaybackError("unsupported");
					});
					else {
						videoRef.current.pause();
						showToast("Paused", "info");
					}
				}
			} else if (e.code === "ArrowLeft") {
				e.preventDefault();
				if (videoRef.current) {
					videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 10);
					showToast("-10s", "info");
				}
			} else if (e.code === "ArrowRight") {
				e.preventDefault();
				if (videoRef.current) {
					videoRef.current.currentTime = Math.min(videoRef.current.duration || Infinity, videoRef.current.currentTime + 10);
					showToast("+10s", "info");
				}
			} else if (e.key === "f" || e.key === "F") {
				e.preventDefault();
				if (!document.fullscreenElement) {
					if (videoRef.current?.requestFullscreen) videoRef.current.requestFullscreen();
					else if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen();
				} else document.exitFullscreen?.();
			} else if (e.key === "m" || e.key === "M") {
				e.preventDefault();
				if (videoRef.current) {
					videoRef.current.muted = !videoRef.current.muted;
					showToast(videoRef.current.muted ? "Muted" : "Unmuted", "info");
				}
			}
		};
		window.addEventListener("mousemove", handleActivity);
		window.addEventListener("touchstart", handleActivity);
		window.addEventListener("keydown", handleKeyDown);
		idleTimerRef.current = setTimeout(() => setIdle(true), 3500);
		return () => {
			window.removeEventListener("mousemove", handleActivity);
			window.removeEventListener("touchstart", handleActivity);
			window.removeEventListener("keydown", handleKeyDown);
			if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
		};
	}, []);
	const targetMediaId = jfId || title?.id || id;
	(0, import_react.useEffect)(() => {
		if (!targetMediaId) {
			setSourcesLoading(false);
			return;
		}
		let active = true;
		const controller = new AbortController();
		setSourcesLoading(true);
		setMediaSourcesData(null);
		setSourceError(null);
		const timeoutTimer = setTimeout(() => controller.abort(), 1e4);
		fetch(`/api/media/${encodeURIComponent(targetMediaId)}/intro-timestamps`).then((res) => res.ok ? res.json() : null).then((data) => {
			if (active && data?.hasIntro && data.introEnd > data.introStart) setIntroData({
				hasIntro: true,
				introStart: data.introStart,
				introEnd: data.introEnd
			});
		}).catch(() => {});
		fetch(`/api/media/${encodeURIComponent(targetMediaId)}/sources`, { signal: controller.signal }).then(async (res) => {
			if (!res.ok) throw new Error("Source details unavailable");
			return res.json();
		}).then((data) => {
			if (!active) return;
			setSourcesLoading(false);
			if (!data?.ok || !data.activeProfileId || data.activeProfileId !== activeProfileId || !data.progressTitleId) {
				setSourceError("This home could not verify your source and playback position. Please try again.");
				return;
			}
			setMediaSourcesData({
				...data,
				retentionSourceId: targetMediaId
			});
			setSavedReaction([
				"like",
				"love",
				"cozy",
				"less"
			].includes(data.reaction) ? data.reaction : null);
			if (data.title && typeof data.title.id === "string" && typeof data.title.title === "string") {
				verifiedTitleLoaded.current = true;
				setFetchedTitle(data.title);
			}
			if (data.jellyfinId) setResolvedMediaId(data.jellyfinId);
			if (data.recommendedForBrowser) setActiveSourceId(data.recommendedForBrowser.id);
		}).catch(() => {
			if (active) {
				setSourcesLoading(false);
				setSourceError("This home could not verify your source and playback position. Please try again.");
			}
		}).finally(() => clearTimeout(timeoutTimer));
		return () => {
			active = false;
			controller.abort();
			clearTimeout(timeoutTimer);
		};
	}, [
		targetMediaId,
		sourceAttempt,
		activeProfileId
	]);
	(0, import_react.useEffect)(() => {
		if (!targetMediaId) return;
		const currentJfId = jfId || targetMediaId;
		const scope = {
			body: {
				itemId: currentJfId,
				mediaSourceId: currentJfId,
				playSessionId
			},
			controller: new AbortController(),
			cancelled: false,
			registered: false
		};
		playbackScopeRef.current = scope;
		setPlaybackSessionError(null);
		const sendHeartbeat = () => {
			sendPlaybackProgress(scope);
		};
		const interval = window.setInterval(sendHeartbeat, 1e4);
		const handleVisibilityChange = () => {
			if (typeof document !== "undefined" && document.visibilityState === "visible") sendHeartbeat();
		};
		if (typeof document !== "undefined") document.addEventListener("visibilitychange", handleVisibilityChange);
		return () => {
			scope.cancelled = true;
			if (scope.starting) scope.starting.finally(() => scope.controller.abort());
			else scope.controller.abort();
			clearInterval(interval);
			if (typeof document !== "undefined") document.removeEventListener("visibilitychange", handleVisibilityChange);
			if (playbackScopeRef.current === scope) playbackScopeRef.current = null;
			if (scope.registered) postPlaybackSession("stop", {
				...scope.body,
				...scope.lastPosition
			}).catch(() => void 0);
		};
	}, [
		targetMediaId,
		jfId,
		playSessionId
	]);
	function scopeIsCurrent(scope) {
		return playbackScopeRef.current === scope && !scope.cancelled;
	}
	async function startPlaybackSession(scope) {
		if (!scopeIsCurrent(scope)) return false;
		if (scope.registered) return true;
		if (scope.starting) return scope.starting;
		const starting = (async () => {
			try {
				const result = await postPlaybackSession("start", scope.body, scope.controller.signal);
				if (!scopeIsCurrent(scope)) {
					if (result.ok) postPlaybackSession("stop", {
						...scope.body,
						...scope.lastPosition
					}).catch(() => void 0);
					return false;
				}
				if (!result.ok) {
					setPlaybackSessionError(playbackSessionFailureMessage(result));
					return false;
				}
				scope.registered = true;
				scope.presenceKey = result.presenceKey;
				scope.familyTreatment = result.familyTreatment;
				setPlaybackSessionError(null);
				const video = videoRef.current;
				if (video) publishPlayerCompanionSession({
					sessionId: playSessionId,
					titleId: id,
					titleName: title?.title || "Personal media",
					seriesName: isSeries ? title?.title || null : null,
					seasonNumber: activeSeason,
					episodeNumber: activeEpisode,
					...playerCompanionTiming(video)
				}).catch(() => void 0);
				return true;
			} catch (error) {
				if (scopeIsCurrent(scope) && !(error instanceof DOMException && error.name === "AbortError")) setPlaybackSessionError("Playback controls could not connect to this home. Please try again.");
				return false;
			} finally {
				if (scopeIsCurrent(scope)) scope.starting = void 0;
			}
		})();
		scope.starting = starting;
		return starting;
	}
	async function sendPlaybackProgress(scope, retried = false) {
		if (!scopeIsCurrent(scope) || !scope.registered || !videoRef.current) return;
		const video = videoRef.current;
		const body = {
			...scope.body,
			...playbackPosition(video)
		};
		try {
			const result = await postPlaybackSession("progress", body, scope.controller.signal);
			if (!scopeIsCurrent(scope)) return;
			if (result.ok) return;
			if (!retried && playbackSessionNeedsRestart(result)) {
				scope.registered = false;
				if (await startPlaybackSession(scope)) await sendPlaybackProgress(scope, true);
				return;
			}
			setPlaybackSessionError(playbackSessionFailureMessage(result));
		} catch (error) {
			if (scopeIsCurrent(scope) && !(error instanceof DOMException && error.name === "AbortError")) setPlaybackSessionError("Playback controls could not connect to this home. Please try again.");
		}
	}
	(0, import_react.useEffect)(() => {
		setAudioPreset("off");
		setAudioError(null);
		return () => {
			audioRevision.current += 1;
			unsubscribeAudio.current?.();
			unsubscribeAudio.current = null;
			boosterRef.current?.destroy();
			boosterRef.current = null;
		};
	}, [streamUrl, sourcesLoading]);
	(0, import_react.useEffect)(() => {
		return () => {
			if (introFadeTimerRef.current) clearTimeout(introFadeTimerRef.current);
		};
	}, []);
	async function changeAudioPreset(next) {
		const video = videoRef.current;
		if (!video) return;
		if (!boosterRef.current) {
			const controller = attachAudioBooster(video);
			boosterRef.current = controller;
			unsubscribeAudio.current = controller.subscribe((status) => {
				setAudioPreset(status.preset);
				setAudioError(status.error);
			});
		}
		const controller = boosterRef.current;
		const revision = ++audioRevision.current;
		const applied = await controller.setPreset(next);
		if (revision !== audioRevision.current) return;
		if (!applied) setAudioError(controller.getStatus().error || "Audio processing is unavailable in this browser. Original audio remains selected.");
	}
	function handleTimeUpdate() {
		if (!videoRef.current) return;
		if (playbackScopeRef.current) playbackScopeRef.current.lastPosition = playbackPosition(videoRef.current);
		savePrivatePosition();
		const current = videoRef.current.currentTime;
		const duration = videoRef.current.duration;
		const treatment = familyTreatmentFrame(playbackScopeRef.current?.familyTreatment ?? null, current);
		if (treatment.skipToSeconds !== null && treatment.skipToSeconds > current) videoRef.current.currentTime = treatment.skipToSeconds;
		if (treatment.muteAudio && familyMuteRestore.current === null) {
			familyMuteRestore.current = videoRef.current.muted;
			videoRef.current.muted = true;
		} else if (treatment.muteAudio && !videoRef.current.muted) videoRef.current.muted = true;
		else if (!treatment.muteAudio && familyMuteRestore.current !== null) {
			videoRef.current.muted = familyMuteRestore.current;
			familyMuteRestore.current = null;
		}
		setFamilyFrame(treatment);
		if (duration > 0 && current / duration >= .8 && !shelf && !retentionDecisionMade && !showRetentionCard) setShowRetentionCard(true);
		if (duration > 0 && current / duration > .9 && !ratingDismissed && !showRatingPill) setShowRatingPill(true);
		if (nextEpisode && !prewarmedRef.current && duration > 0) {
			const remainingSec = duration - current;
			if (current / duration > .85 || remainingSec < 120) {
				prewarmedRef.current = true;
				fetch("/api/playback/prewarm", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						showId: id,
						nextEpisodeNumber: nextEpisode.episodeNumber,
						nextMediaId: nextEpisode.jellyfinId,
						currentMediaId: targetMediaId
					})
				}).catch(() => {});
			}
		}
		if (!introData?.hasIntro) return;
		if (current >= introData.introStart && current < introData.introEnd) {
			if (!introShownRef.current) {
				introShownRef.current = true;
				setShowSkipIntro(true);
				if (introFadeTimerRef.current) clearTimeout(introFadeTimerRef.current);
				introFadeTimerRef.current = setTimeout(() => {
					setShowSkipIntro(false);
				}, 1e4);
			}
		} else {
			if (current < introData.introStart) introShownRef.current = false;
			if (showSkipIntro) {
				setShowSkipIntro(false);
				if (introFadeTimerRef.current) clearTimeout(introFadeTimerRef.current);
			}
		}
	}
	(0, import_react.useEffect)(() => {
		const controller = new AbortController();
		const publish = async () => {
			const video = videoRef.current;
			const scope = playbackScopeRef.current;
			if (!video || !scope?.registered) return;
			await publishPlayerCompanionSession({
				sessionId: playSessionId,
				titleId: id,
				titleName: title?.title || "Personal media",
				seriesName: isSeries ? title?.title || null : null,
				seasonNumber: activeSeason,
				episodeNumber: activeEpisode,
				...playerCompanionTiming(video)
			});
		};
		const poll = async () => {
			const video = videoRef.current;
			const scope = playbackScopeRef.current;
			if (!video || !scope?.registered) return;
			try {
				const commands = await pollPlayerCompanionCommands(playSessionId, controller.signal);
				for (const command of commands) await consumePlayerCompanionCommand(video, command);
			} catch (error) {
				if (!(error instanceof DOMException && error.name === "AbortError")) {}
			}
		};
		const publishTimer = window.setInterval(() => void publish().catch(() => void 0), 5e3);
		const pollTimer = window.setInterval(() => void poll(), 1500);
		return () => {
			controller.abort();
			clearInterval(publishTimer);
			clearInterval(pollTimer);
			if (playbackScopeRef.current?.registered) stopPlayerCompanionSession(playSessionId).catch(() => void 0);
			const video = videoRef.current;
			if (video && familyMuteRestore.current !== null) video.muted = familyMuteRestore.current;
			familyMuteRestore.current = null;
		};
	}, [
		playSessionId,
		id,
		title?.title,
		isSeries,
		activeSeason,
		activeEpisode
	]);
	function handleSkipIntro() {
		if (videoRef.current && introData) {
			videoRef.current.currentTime = introData.introEnd;
			setShowSkipIntro(false);
			if (introFadeTimerRef.current) clearTimeout(introFadeTimerRef.current);
		}
	}
	if (!title) return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex min-h-dvh flex-col items-center justify-center px-6",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "text-muted",
			children: "Not in the library."
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
			to: "/",
			className: "mt-4 text-gold",
			children: "Home"
		})]
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: cn("relative flex h-dvh max-h-dvh w-full flex-col bg-black text-foreground overflow-hidden select-none", idle && !showSound && !showRatingPill && !showLibraryKeeping && "cursor-none"),
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
				className: cn("absolute top-0 inset-x-0 z-40 flex h-14 shrink-0 items-center justify-between border-b border-white/10 bg-black/70 px-3 sm:px-4 backdrop-blur-md transition-all duration-300", idle && !showSound && !showRatingPill && !showLibraryKeeping ? "opacity-0 pointer-events-none" : "opacity-100"),
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex min-w-0 flex-1 items-center gap-2 sm:gap-3 mr-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
						to: "/title/$id",
						params: { id: title.id },
						onClick: () => savePrivatePosition(true),
						className: "inline-flex min-h-[38px] items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs text-muted hover:bg-white/10 hover:text-foreground shrink-0",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowLeft, { className: "size-4" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "hidden sm:inline",
							children: "Details"
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "min-w-0 flex-1 truncate",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h1", {
							className: "truncate text-xs sm:text-sm font-semibold text-foreground",
							children: [
								title.title,
								activeSeason && activeEpisode ? ` · S${activeSeason}E${activeEpisode}` : "",
								activeEpisodeTitle ? ` — ${activeEpisodeTitle}` : ""
							]
						}), title.year ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-[10px] sm:text-xs text-muted",
							children: title.year
						}) : null]
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-1 sm:gap-2 shrink-0",
					children: [
						prevEpisode ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
							size: "sm",
							variant: "ghost",
							className: "h-8 sm:h-9 px-2 text-xs text-muted hover:text-gold transition-colors",
							onClick: () => goToEpisode(prevEpisode),
							title: `Previous: E${prevEpisode.episodeNumber} ${prevEpisode.title}`,
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronLeft, { className: "size-3.5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "hidden md:inline ml-0.5",
								children: "Prev"
							})]
						}) : null,
						nextEpisode ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
							size: "sm",
							variant: "ghost",
							className: "h-8 sm:h-9 px-2 text-xs text-muted hover:text-gold transition-colors",
							onClick: () => goToEpisode(nextEpisode),
							title: `Next: E${nextEpisode.episodeNumber} ${nextEpisode.title}`,
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "hidden md:inline mr-0.5",
								children: "Next"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronRight, { className: "size-3.5" })]
						}) : null,
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
							size: "sm",
							variant: "quiet",
							className: cn("min-h-12 min-w-12 gap-1 text-xs border transition-colors px-2 sm:px-3", audioPreset !== "off" ? "border-amber-400/80 bg-amber-400/15 text-amber-300 font-medium" : "border-border/60 text-muted hover:text-foreground"),
							onClick: () => setShowSound((open) => !open),
							"aria-label": "Sound",
							"aria-expanded": showSound,
							disabled: sourcesLoading || !!sourceError,
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Volume2, { className: cn("size-3.5", audioPreset === "nightMode" ? "text-amber-300" : "text-muted") }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "hidden sm:inline",
								children: "Sound"
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							variant: "quiet",
							className: "min-h-12 px-3 text-xs",
							"aria-label": "Rate this title",
							onClick: () => setShowRatingPill((open) => !open),
							disabled: sourcesLoading || !!sourceError,
							children: "Your taste"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							variant: "quiet",
							className: "min-h-12 min-w-12 px-3 text-xs",
							"aria-label": "Library keeping",
							"aria-expanded": showLibraryKeeping,
							onClick: () => setShowLibraryKeeping((open) => !open),
							children: "Library"
						}),
						availableSubtitles.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
							size: "sm",
							variant: "quiet",
							className: cn("h-8 sm:h-9 gap-1 text-xs border transition-colors px-2 sm:px-3", subSyncOffsetMs !== 0 || showSubSyncPanel ? "border-gold bg-gold/15 text-gold font-medium" : "border-border/60 text-muted hover:text-foreground"),
							onClick: () => setShowSubSyncPanel((prev) => !prev),
							title: "Subtitle Sync Tuning",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SlidersVertical, { className: "size-3.5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "hidden sm:inline",
								children: ["Sync ", subSyncOffsetMs !== 0 ? `(${subSyncOffsetMs > 0 ? "+" : ""}${subSyncOffsetMs}ms)` : ""]
							})]
						}) : null,
						availableSubtitles.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
							size: "sm",
							variant: "quiet",
							className: cn("h-8 sm:h-9 gap-1 text-xs border transition-colors px-2 sm:px-3", selectedSubIndex !== -1 ? "border-gold bg-gold/15 text-gold font-medium" : "border-border/60 text-muted hover:text-foreground"),
							onClick: cycleSubtitles,
							title: `Subtitles: ${activeSubLabel} (Click to cycle)`,
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Captions, { className: cn("size-3.5", selectedSubIndex !== -1 ? "text-gold" : "text-muted") }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "hidden sm:inline",
								children: activeSubLabel
							})]
						}) : null,
						isSeries && activeEpisode && activeEpisode > 1 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
							size: "sm",
							variant: "quiet",
							className: "h-8 sm:h-9 gap-1 text-xs border border-white/10 text-muted hover:text-foreground transition-colors px-2 sm:px-3",
							onClick: () => markPriorEpisodesWatched(activeEpisode),
							title: "Mark prior episodes watched",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: "size-3 text-gold" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "hidden sm:inline",
								children: "Mark Prior Watched"
							})]
						}) : null,
						isSeries ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
							size: "sm",
							variant: "quiet",
							className: "h-8 sm:h-9 gap-1 text-xs border border-white/10 text-muted hover:text-gold transition-colors px-2 sm:px-3",
							onClick: openRecap,
							title: "The Story So Far (Catch-up recap)",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Clock, { className: "size-3.5 text-gold" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "hidden sm:inline",
								children: "Recap"
							})]
						}) : null,
						mediaSourcesData?.hasMultipleVersions ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "hidden sm:inline-flex h-8 items-center rounded-lg border border-white/10 bg-white/5 px-2 text-[11px] font-mono text-muted",
							title: "Your home selects the verified playable version.",
							children: "Verified source"
						}) : currentSource?.quality === "4k" || currentSource?.quality === "1080p" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "hidden sm:inline-flex items-center rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[11px] font-mono text-muted",
							children: currentSource.quality === "4k" ? "4K source" : "1080p source"
						}) : null,
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
							size: "sm",
							variant: "ghost",
							className: "h-8 sm:h-9 gap-1 text-xs text-gold border border-gold/30 bg-gold/10 hover:bg-gold/20 transition-colors px-2 sm:px-3",
							onClick: () => setShowLauncher(true),
							title: "Cast to Living Room TV or switch player",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Tv, { className: "size-3.5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "hidden sm:inline",
								children: "Cast"
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
							size: "sm",
							variant: "ghost",
							className: "h-8 sm:h-9 gap-1 text-xs text-foreground border border-white/15 bg-white/5 hover:bg-white/10 transition-colors px-2 sm:px-3",
							onClick: () => setShowCompanionQr(true),
							title: "Living Room Companion Screen (Phone Second Screen)",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Smartphone, { className: "size-3.5 text-gold" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "hidden sm:inline",
								children: "Companion"
							})]
						})
					]
				})]
			}),
			showLibraryKeeping ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				"aria-label": "Library keeping",
				className: "absolute top-16 right-3 left-3 sm:left-auto sm:w-80 z-50 space-y-3 rounded-2xl border border-white/20 bg-zinc-950/95 p-4 text-sm shadow-2xl",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center justify-between gap-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							className: "font-semibold",
							children: "Keep this local file"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							"aria-label": "Close library keeping",
							className: "min-h-12 min-w-12 rounded-xl hover:bg-white/10 focus-visible:outline focus-visible:outline-2",
							onClick: () => setShowLibraryKeeping(false),
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "mx-auto size-4" })
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-xs text-muted",
						children: "Only a verified local original can be kept. Removing your pin does not delete the file."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						role: "status",
						children: retention.loading ? "Checking your library…" : retention.saving ? "Saving your library choice…" : savedToLibrary ? "Kept in your library" : retention.snapshot ? "Not kept in your library" : "Local file not verified"
					}),
					retention.error ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						role: "alert",
						className: "text-amber-200",
						children: retention.error
					}) : null,
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						className: "min-h-12 w-full",
						disabled: !retention.snapshot || retention.loading || retention.saving,
						onClick: () => void handleKeepInLibrary(!savedToLibrary),
						children: savedToLibrary ? "Stop keeping in your library" : "Keep in your library"
					}),
					retention.error ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						variant: "quiet",
						className: "min-h-12 w-full",
						disabled: !retention.canCheck || retention.loading || retention.saving,
						onClick: retention.retry,
						children: "Retry library status"
					}) : null
				]
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("main", {
				tabIndex: -1,
				"aria-label": "Playback",
				className: "relative flex-1 w-full h-full min-h-0 flex items-center justify-center bg-black overflow-hidden",
				children: sourceError ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					role: "alert",
					className: "max-w-md space-y-4 px-6 text-center",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: sourceError }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							className: "min-h-12",
							onClick: () => setSourceAttempt((attempt) => attempt + 1),
							children: "Retry source"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
							to: "/",
							className: "block min-h-12 py-3",
							children: "Back to Home"
						})
					]
				}) : sourcesLoading && !mediaSourcesData ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex size-full min-h-[50vh] flex-col items-center justify-center gap-3 text-muted",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "size-8 animate-spin rounded-full border-2 border-gold/20 border-t-gold" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-xs font-mono tracking-wide text-foreground/80",
						children: "Selecting stream..."
					})]
				}) : streamUrl ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("video", {
						ref: videoRef,
						src: streamUrl,
						controls: true,
						autoPlay: true,
						playsInline: true,
						"x-webkit-airplay": "allow",
						crossOrigin: "anonymous",
						onWaiting: handleWaiting,
						onPlay: (event) => {
							const scope = playbackScopeRef.current;
							if (!scope || scope.registered || scope.starting) return;
							event.currentTarget.pause();
							startPlaybackSession(scope).then((ready) => {
								if (ready && videoRef.current === event.currentTarget) event.currentTarget.play().catch(() => setPlaybackError("unsupported"));
							});
						},
						onPlaying: handlePlaying,
						onLoadedMetadata: restorePrivatePosition,
						onPause: () => {
							savePrivatePosition(true);
							const scope = playbackScopeRef.current;
							if (scope) sendPlaybackProgress(scope);
						},
						onSeeked: () => savePrivatePosition(true),
						onTimeUpdate: handleTimeUpdate,
						onEnded: handleVideoEnded,
						onError: (e) => {
							console.warn("Direct stream playback error:", e);
							setPlaybackError("unsupported");
						},
						className: "max-h-full max-w-full w-full h-full object-contain mx-auto my-auto",
						children: availableSubtitles.map((sub) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("track", {
							kind: "subtitles",
							src: `${jfOrigin}${sub.vttUrl}`,
							srcLang: sub.language || "en",
							label: sub.label || "English",
							"data-subtitle-index": sub.index,
							onLoad: () => {
								if (videoRef.current) synchronizePlaybackSubtitles(videoRef.current, selectedSubIndex < 0 ? null : selectedSubIndex, subSyncOffsetMs);
							},
							default: sub.isDefault && selectedSubIndex === sub.index
						}, `${sub.index}-${sub.vttUrl}`))
					}, streamUrl),
					familyFrame.hideVisual ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						"aria-label": "Family visual treatment",
						className: "absolute inset-0 z-20 bg-black"
					}) : null,
					familyFrame.subtitleReplacement ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						"aria-live": "polite",
						className: "pointer-events-none absolute bottom-20 left-1/2 z-30 max-w-[80%] -translate-x-1/2 rounded-lg bg-black/85 px-4 py-2 text-center text-lg text-white",
						children: familyFrame.subtitleReplacement
					}) : null,
					playbackSessionError || progressError || audioError ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						role: "alert",
						className: "absolute top-16 left-1/2 z-40 max-w-[calc(100%-2rem)] -translate-x-1/2 rounded-2xl border border-rose-400/40 bg-black/90 px-4 py-2 text-center text-xs text-rose-100 shadow-2xl backdrop-blur-md",
						children: progressError || playbackSessionError || audioError
					}) : null,
					showStallPrompt ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "absolute top-16 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 rounded-2xl bg-black/85 border border-gold/40 px-4 py-2 text-xs text-gold shadow-2xl backdrop-blur-md animate-in fade-in duration-200 pointer-events-none",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "size-3.5 animate-spin text-gold" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Stream buffering... Your home is keeping this playback on its verified source." })]
					}) : null,
					playbackError ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/90 p-6 text-center backdrop-blur-md animate-in fade-in duration-200",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "max-w-md space-y-4 rounded-3xl border border-white/10 bg-card/95 p-6 shadow-2xl",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "mx-auto flex size-12 items-center justify-center rounded-2xl bg-gold/15 text-gold border border-gold/30",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Play, { className: "size-6 fill-current" })
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
									className: "font-display text-base font-bold text-foreground",
									children: "This browser could not play this source"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-xs text-muted leading-relaxed",
									children: "The file may be unavailable or use an unsupported format. Retry this source or return to browsing."
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex flex-col gap-2 pt-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
										variant: "ghost",
										className: "w-full border border-gold/30 bg-gold/10 text-xs text-gold hover:bg-gold/20",
										onClick: () => {
											setPlaybackError(null);
											restoredSource.current = null;
											videoRef.current?.load();
										},
										children: "Retry playback"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
										to: "/",
										className: "min-h-12 py-3",
										children: "Back to Home"
									})]
								})
							]
						})
					}) : null,
					showRetentionCard ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "absolute bottom-28 left-1/2 z-50 -translate-x-1/2 animate-in fade-in slide-in-from-bottom-6 duration-300",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex flex-col sm:flex-row items-center gap-4 rounded-3xl border border-gold/40 bg-zinc-950/95 p-5 shadow-2xl backdrop-blur-xl",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "text-center sm:text-left",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "text-sm font-semibold text-white",
										children: "Enjoyed this stream?"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "text-xs text-muted",
										children: "Keep this local file in your library?"
									}),
									retention.error ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										role: "alert",
										className: "mt-2 text-xs text-amber-200",
										children: retention.error
									}) : null
								]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center gap-2",
								children: [savedToLibrary ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "inline-flex h-9 items-center gap-1.5 rounded-2xl bg-emerald-500/20 px-4 text-xs font-bold text-emerald-400 border border-emerald-500/30",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: "size-3.5" }), "Kept in your library"]
								}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
									size: "sm",
									disabled: savingToLibrary || retention.loading || !retention.snapshot,
									onClick: () => void handleKeepInLibrary(true),
									className: "min-h-12 rounded-2xl bg-gold text-black hover:bg-gold/90 font-bold px-4 cursor-pointer",
									children: [savingToLibrary ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "size-3.5 animate-spin mr-1" }) : null, "Keep in your library"]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
									variant: "ghost",
									size: "sm",
									onClick: handleJustBrowsing,
									className: "min-h-12 rounded-2xl text-xs text-white/70 hover:bg-white/10 hover:text-white cursor-pointer",
									children: "Just Browsing"
								})]
							})]
						})
					}) : null,
					showRatingPill ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "absolute top-20 right-6 sm:top-24 sm:right-8 z-50 flex flex-col gap-3 rounded-2xl border border-white/20 bg-black/75 p-4 shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-top-3 duration-300",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center justify-between gap-4",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
									className: "text-sm font-semibold text-white",
									children: [
										"How was ",
										title?.title,
										"?"
									]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									onClick: () => {
										setRatingDismissed(true);
										setShowRatingPill(false);
									},
									className: "text-white/60 hover:text-white transition-colors text-xs px-1.5 py-0.5 rounded-lg hover:bg-white/10",
									"aria-label": "Close taste controls",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-4" })
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex max-w-[min(28rem,80vw)] flex-wrap items-center gap-2",
								children: [[
									["like", "Like"],
									["love", "Love"],
									["cozy", "Cozy"],
									["less", "Less like this"]
								].map(([reaction, label]) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
									variant: "ghost",
									className: "min-h-12 rounded-xl bg-white/10 px-3 text-xs",
									disabled: ratingSaving,
									"aria-pressed": savedReaction === reaction,
									onClick: () => void handleRate(savedReaction === reaction ? null : reaction),
									children: label
								}, reaction)), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
									variant: "ghost",
									className: "min-h-12 px-3 text-xs",
									disabled: ratingSaving,
									onClick: () => void handleRate(null),
									children: "Clear reaction"
								})]
							}),
							ratingError ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								role: "alert",
								className: "text-xs text-rose-200",
								children: ratingError
							}) : null
						]
					}) : null,
					showSound ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
						"aria-label": "Sound settings",
						className: "absolute right-4 top-16 z-50 w-80 max-w-[calc(100%-2rem)] space-y-3 rounded-2xl border border-white/10 bg-black/95 p-4 shadow-2xl",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center justify-between",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-sm",
									children: "Sound"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									"aria-label": "Close sound settings",
									className: "flex min-h-12 min-w-12 items-center justify-center",
									onClick: () => setShowSound(false),
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-4" })
								})]
							}),
							[
								["off", "Original"],
								["volumeLeveling", "Volume leveling"],
								["dialogueBoost", "Dialogue focus"],
								["nightMode", "Night listening"]
							].map(([preset, label]) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								"aria-pressed": audioPreset === preset,
								onClick: () => void changeAudioPreset(preset),
								className: cn("min-h-12 w-full rounded-xl px-4 text-left text-sm", audioPreset === preset ? "bg-white/15" : "hover:bg-white/10"),
								children: label
							}, preset)),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "text-xs leading-relaxed text-white/55",
								children: ["These modes process this browser's current audio only. If processing cannot start, ReelOS keeps the original audio and says so.", !availableSubtitles.length ? " No subtitle tracks are available for this source." : " Subtitles and timing controls are available above."]
							})
						]
					}) : null,
					showSkipIntro ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						onClick: handleSkipIntro,
						className: "absolute bottom-20 right-6 sm:bottom-16 sm:right-8 z-30 flex min-h-[44px] items-center gap-2.5 rounded-full border border-gold/50 bg-card/95 px-5 py-2.5 text-xs sm:text-sm font-bold text-foreground shadow-[var(--shadow-gold)] backdrop-blur-xl transition-all hover:scale-105 hover:bg-card hover:text-gold active:scale-95 focus:outline-none focus:ring-2 focus:ring-gold cursor-pointer",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Skip Intro" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							"aria-hidden": "true",
							className: "text-gold font-bold",
							children: "→"
						})]
					}) : null,
					upNextPrompt && nextEpisode ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "absolute bottom-20 right-6 sm:bottom-16 sm:right-8 z-30 flex flex-col gap-2 rounded-2xl border border-gold/40 bg-card/95 p-4 shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-bottom-3 duration-300",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "text-[11px] font-bold uppercase tracking-wider text-gold font-mono",
								children: [
									"Up Next in ",
									upNextCount,
									"s"
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "text-xs font-semibold text-foreground truncate max-w-[240px]",
								children: [
									"S",
									activeSeason,
									"E",
									nextEpisode.episodeNumber,
									" · ",
									nextEpisode.title
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center gap-2 pt-1",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
									size: "sm",
									className: "h-8 text-xs font-bold gap-1 px-3",
									onClick: () => goToEpisode(nextEpisode),
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Play, { className: "size-3 fill-current" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Play Now" })]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
									size: "sm",
									variant: "ghost",
									className: "h-8 text-xs text-muted",
									onClick: () => {
										if (upNextTimerRef.current) clearInterval(upNextTimerRef.current);
										setUpNextPrompt(false);
									},
									children: "Cancel"
								})]
							})
						]
					}) : null,
					showSubSyncPanel ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "absolute bottom-20 left-6 sm:bottom-16 sm:left-8 z-40 w-72 rounded-2xl border border-gold/40 bg-black/90 p-4 shadow-2xl backdrop-blur-xl animate-in fade-in duration-200",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center justify-between pb-2 border-b border-white/10",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-xs font-mono font-bold text-gold uppercase",
									children: "Subtitle Timing Sync"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									onClick: () => setShowSubSyncPanel(false),
									className: "text-white/60 hover:text-white text-xs",
									children: "✕"
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "py-3 space-y-2",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center justify-between text-xs",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-muted",
											children: "Offset Shift:"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
											className: "font-mono font-bold text-white",
											children: [subSyncOffsetMs > 0 ? `+${subSyncOffsetMs}` : subSyncOffsetMs, " ms"]
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										type: "range",
										min: "-2000",
										max: "2000",
										step: "50",
										value: subSyncOffsetMs,
										onChange: (e) => applySubtitleOffset(parseInt(e.target.value, 10)),
										className: "w-full accent-gold cursor-pointer"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center justify-between pt-1",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
												size: "sm",
												variant: "quiet",
												className: "h-7 text-[10px] px-2 border border-white/10 text-muted",
												onClick: () => applySubtitleOffset(subSyncOffsetMs - 100),
												children: "-100ms"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
												size: "sm",
												variant: "quiet",
												className: "h-7 text-[10px] px-2 border border-gold/40 text-gold",
												onClick: () => applySubtitleOffset(0),
												children: "Reset (0ms)"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
												size: "sm",
												variant: "quiet",
												className: "h-7 text-[10px] px-2 border border-white/10 text-muted",
												onClick: () => applySubtitleOffset(subSyncOffsetMs + 100),
												children: "+100ms"
											})
										]
									})
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
								size: "sm",
								variant: "quiet",
								className: "w-full h-8 gap-1.5 text-xs border border-gold/40 bg-gold/10 text-gold hover:bg-gold/20",
								onClick: handleAutoSyncSubtitles,
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Captions, { className: "size-3.5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Auto-Align with Dialogue" })]
							})
						]
					}) : null
				] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "flex size-full flex-col items-center justify-center p-6 text-center",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-sm text-muted",
						children: "Connecting to media server…"
					})
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(WatchLauncherModal, {
				open: showLauncher,
				onClose: () => setShowLauncher(false),
				title: {
					id: title.id,
					title: title.title,
					year: title.year,
					poster: title.poster,
					kind: title.kind,
					jellyfinId: jfId,
					season: activeSeason,
					episode: activeEpisode,
					episodeTitle: activeEpisodeTitle
				}
			}),
			showRecapModal && recapData ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200",
				onClick: () => setShowRecapModal(false),
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "w-full max-w-md rounded-3xl border border-gold/40 bg-card/95 p-6 shadow-2xl backdrop-blur-2xl space-y-4",
					onClick: (e) => e.stopPropagation(),
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center justify-between border-b border-border/50 pb-3 text-left",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center gap-2.5",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "flex size-9 items-center justify-center rounded-xl bg-gold/15 text-gold border border-gold/30",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Clock, { className: "size-4" })
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
									className: "font-display text-sm font-bold text-foreground",
									children: "The Story So Far"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
									className: "text-[11px] text-muted font-mono",
									children: [
										title.title,
										" ",
										activeSeason ? `· Season ${activeSeason}` : "",
										" ",
										activeEpisode ? `· Episode ${activeEpisode}` : ""
									]
								})] })]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: () => setShowRecapModal(false),
								className: "flex size-7 items-center justify-center rounded-full text-muted hover:bg-white/10 hover:text-foreground transition-colors",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-4" })
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "space-y-2.5",
							children: [recapData.storySoFar.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-xs text-muted",
								children: "Catch-up"
							}) : null, /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
								className: "space-y-2 text-xs text-muted leading-relaxed list-disc list-inside",
								children: recapData.storySoFar.map((bullet, idx) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
									className: "pl-1",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-foreground/90",
										children: bullet
									})
								}, idx))
							})]
						}),
						recapData.whyAreTheyHere ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "rounded-2xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-200/90 leading-relaxed",
							children: recapData.whyAreTheyHere
						}) : null,
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							className: "w-full h-10 rounded-2xl bg-gold text-black font-bold hover:brightness-110",
							onClick: () => setShowRecapModal(false),
							children: "Resume Cinema"
						})
					]
				})
			}) : null,
			showCompanionQr ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200",
				onClick: () => setShowCompanionQr(false),
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "w-full max-w-sm rounded-3xl border border-white/10 bg-card/95 p-6 shadow-2xl backdrop-blur-2xl text-center space-y-4",
					onClick: (e) => e.stopPropagation(),
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center justify-between border-b border-border/50 pb-3 text-left",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center gap-2.5",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "flex size-9 items-center justify-center rounded-xl bg-gold/15 text-gold border border-gold/30",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Smartphone, { className: "size-4" })
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
									className: "font-display text-sm font-bold text-foreground",
									children: "Companion Screen"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-[11px] text-muted",
									children: "Living room second screen"
								})] })]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: () => setShowCompanionQr(false),
								className: "flex size-7 items-center justify-center rounded-full text-muted hover:bg-white/10 hover:text-foreground transition-colors",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-4" })
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-xs text-muted leading-relaxed text-left",
							children: "Keep your phone on your coffee table. Scan this QR code to view spoiler-free character recaps, “Who’s Who?”, and scene context while watching on TV."
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "flex justify-center py-2",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "rounded-2xl border border-white/10 bg-white p-3 shadow-lg",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(QrCodeSvg, {
									value: `${typeof window !== "undefined" ? window.location.origin : ""}/companion?id=${encodeURIComponent(id)}${activeSeason ? `&season=${activeSeason}` : ""}${activeEpisode ? `&episode=${activeEpisode}` : ""}`,
									size: 160,
									darkColor: "#0b0d10",
									lightColor: "#ffffff"
								})
							})
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "flex flex-col gap-2 pt-2",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
								to: "/companion",
								search: {
									id,
									season: activeSeason,
									episode: activeEpisode
								},
								target: "_blank",
								className: "w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gold px-4 py-2.5 text-xs font-bold text-black hover:brightness-110 transition-all",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Open Companion Screen" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ExternalLink, { className: "size-3.5" })]
							})
						})
					]
				})
			}) : null
		]
	});
}
function Page() {
	const { id } = Route$2.useParams();
	const search = Route$2.useSearch();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Gate, {
		chrome: false,
		personalSetup: true,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PlayerView, {
			id,
			season: search.season,
			episode: search.episode,
			mediaId: search.mediaId
		}, `${id}:${search.season ?? ""}:${search.episode ?? ""}:${search.mediaId ?? ""}`)
	});
}
//#endregion
export { Page as component };
