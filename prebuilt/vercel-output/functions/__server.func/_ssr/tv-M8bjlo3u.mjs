import { i as __toESM } from "../_runtime.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { S as require_jsx_runtime, b as useNavigate } from "../_libs/@tanstack/react-router+[...].mjs";
import { C as Sparkles, Et as Clock, Ft as Check, G as Palette, Gt as ArrowLeft, H as Play, Ht as BookOpen, Z as Minimize2, a as VolumeX, et as Maximize2, gt as Flame, lt as Image, mt as Gamepad2, n as X, o as Volume2, r as Wifi, t as Zap } from "../_libs/lucide-react.mjs";
import { E as cn, M as homeShelfRows, U as showToast, X as useReelStore, u as Button } from "./router-M-yvs45k.mjs";
import { n as GuestQrPopover, r as ProfileSwitcher, t as Gate } from "./gate-C-z8U9Xa.mjs";
import { t as Poster } from "./poster-Cd-JU0eF.mjs";
import { n as jellyfinWatchHref } from "./jellyfin-watch-DyhgK2S6.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/tv-M8bjlo3u.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var THEME_OPTIONS = [
	{
		id: "gold-hashed",
		name: "Gold Hashed",
		tagline: "Signature ReelOS",
		accent: "#d4a017",
		bg: "#0b0d10",
		palette: [
			"#d4a017",
			"#12151b",
			"#181c24"
		]
	},
	{
		id: "oled-obsidian",
		name: "OLED Obsidian",
		tagline: "True Black OLED",
		accent: "#38bdf8",
		bg: "#000000",
		palette: [
			"#38bdf8",
			"#000000",
			"#0f1012"
		]
	},
	{
		id: "cinematic-velvet",
		name: "Cinematic Velvet",
		tagline: "Warm Cinema",
		accent: "#e11d48",
		bg: "#0c060a",
		palette: [
			"#e11d48",
			"#140b12",
			"#1c101a"
		]
	},
	{
		id: "midnight-slate",
		name: "Midnight Slate",
		tagline: "Studio Monitor",
		accent: "#3b82f6",
		bg: "#080c14",
		palette: [
			"#3b82f6",
			"#0e1522",
			"#141c2d"
		]
	}
];
var DESIGN_LANGUAGES = [
	{
		id: "oled_cinema",
		name: "Spatial Cinema",
		tagline: "Leica / Apple TV inspired depth & frosted glass",
		icon: Sparkles
	},
	{
		id: "futuristic_hud",
		name: "Tactile Modular",
		tagline: "Teenage Engineering / Dieter Rams mechanical grid",
		icon: Zap
	},
	{
		id: "editorial_slate",
		name: "Editorial Canvas",
		tagline: "Nothing OS inspired dot-matrix & posterless curation",
		icon: BookOpen
	},
	{
		id: "warm_velvet",
		name: "Warm Velvet",
		tagline: "Pill-soft curves & amber candlelight bloom",
		icon: Flame
	}
];
var MOTION_DIALS = [
	{
		id: "flashy",
		name: "Flashy & Bouncy",
		tagline: "Dynamic 3D tilts, pulse rings & micro-animations"
	},
	{
		id: "cinematic",
		name: "Cinematic Ease",
		tagline: "Silky 300ms smooth transitions & backdrop easing"
	},
	{
		id: "minimal_boring",
		name: "Minimal / Boring",
		tagline: "Instant 0ms clicks, zero motion or distraction"
	}
];
function ThemeSwitcher({ compact = false }) {
	const currentTheme = useReelStore((s) => s.theme);
	const setTheme = useReelStore((s) => s.setTheme);
	const residents = useReelStore((s) => s.residents);
	const activeResidentId = useReelStore((s) => s.activeResidentId);
	const patchResident = useReelStore((s) => s.patchResident);
	const activeResident = residents.find((r) => r.id === activeResidentId) ?? residents[0];
	const currentDesign = activeResident?.themeDesign || "oled_cinema";
	const currentMotion = activeResident?.motionStyle || "cinematic";
	const [open, setOpen] = (0, import_react.useState)(false);
	const [activeTab, setActiveTab] = (0, import_react.useState)("design");
	const menuRef = (0, import_react.useRef)(null);
	const activeOption = THEME_OPTIONS.find((t) => t.id === currentTheme) ?? THEME_OPTIONS[0];
	(0, import_react.useEffect)(() => {
		const handleDown = (e) => {
			if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false);
		};
		const handleKey = (e) => {
			if (e.key === "Escape") setOpen(false);
		};
		if (open) {
			document.addEventListener("mousedown", handleDown);
			document.addEventListener("keydown", handleKey);
		}
		return () => {
			document.removeEventListener("mousedown", handleDown);
			document.removeEventListener("keydown", handleKey);
		};
	}, [open]);
	const selectDesign = (design) => {
		if (typeof document !== "undefined") {
			document.documentElement.setAttribute("data-theme-design", design);
			document.body.setAttribute("data-theme-design", design);
		}
		if (activeResident) patchResident(activeResident.id, { themeDesign: design });
	};
	const selectMotion = (motion) => {
		if (typeof document !== "undefined") {
			document.documentElement.setAttribute("data-motion", motion);
			document.body.setAttribute("data-motion", motion);
		}
		if (activeResident) patchResident(activeResident.id, { motionStyle: motion });
	};
	const selectTheme = (id) => {
		setTheme(id);
		if (activeResident) patchResident(activeResident.id, { accentColor: id });
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "relative inline-block",
		ref: menuRef,
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
			type: "button",
			onClick: () => setOpen((prev) => !prev),
			className: cn("flex items-center gap-2 rounded-xl border border-border bg-card/70 px-3 py-1.5 text-xs font-semibold text-muted shadow-sm backdrop-blur-md transition-all hover:border-gold/40 hover:text-foreground", open && "border-gold/50 bg-card text-foreground ring-1 ring-gold/40", compact && "size-9 justify-center p-0"),
			title: `Style Studio: ${activeOption.name} · ${currentDesign} (Click to change)`,
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "size-2.5 rounded-full ring-1 ring-white/20 shadow-sm shrink-0",
				style: { backgroundColor: activeOption.accent }
			}), !compact ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "hidden lg:inline",
				children: activeOption.name
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Palette, { className: "size-3 text-muted/70 lg:hidden" })] }) : null]
		}), open ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "fixed inset-0 z-40 sm:hidden bg-black/40 backdrop-blur-xs",
			onClick: () => setOpen(false)
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "fixed inset-x-4 top-16 z-50 mx-auto max-w-md sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-80 rounded-2xl border border-border/80 bg-raised/95 p-3 shadow-2xl backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-150",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "px-2 pb-2.5 border-b border-border/40",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center justify-between",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-1.5 text-xs font-semibold text-foreground",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Palette, { className: "size-3.5 text-gold" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Personal Style Studio" })]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "rounded bg-gold/15 px-1.5 py-0.5 text-[9px] font-mono text-gold font-semibold uppercase",
							children: activeResident?.name || "Profile"
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-0.5 text-[11px] text-muted",
						children: "Design language, motion feel & atmosphere palette"
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-2 grid grid-cols-3 gap-1 rounded-xl bg-card p-1 border border-border/40",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: () => setActiveTab("design"),
							className: cn("rounded-lg py-1 text-[11px] font-medium transition-all", activeTab === "design" ? "bg-card-2 text-foreground shadow-xs font-semibold" : "text-muted hover:text-foreground"),
							children: "Design"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: () => setActiveTab("motion"),
							className: cn("rounded-lg py-1 text-[11px] font-medium transition-all", activeTab === "motion" ? "bg-card-2 text-foreground shadow-xs font-semibold" : "text-muted hover:text-foreground"),
							children: "Motion"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: () => setActiveTab("palette"),
							className: cn("rounded-lg py-1 text-[11px] font-medium transition-all", activeTab === "palette" ? "bg-card-2 text-foreground shadow-xs font-semibold" : "text-muted hover:text-foreground"),
							children: "Color"
						})
					]
				}),
				activeTab === "design" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mt-2.5 flex flex-col gap-1.5",
					children: DESIGN_LANGUAGES.map((d) => {
						const isSelected = d.id === currentDesign;
						const Icon = d.icon;
						return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							onClick: () => selectDesign(d.id),
							className: cn("group flex items-center justify-between gap-2.5 rounded-xl p-2 text-left text-xs transition-all", isSelected ? "bg-card border border-gold/40 shadow-sm" : "hover:bg-card/60 hover:text-foreground"),
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center gap-2.5 min-w-0",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: cn("flex size-7 items-center justify-center rounded-lg border shrink-0", isSelected ? "border-gold/50 bg-gold/15 text-gold" : "border-white/10 bg-card-2 text-muted group-hover:text-foreground"),
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { className: "size-3.5" })
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "min-w-0",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: cn("font-medium truncate text-xs", isSelected ? "text-foreground font-semibold" : "text-muted group-hover:text-foreground"),
										children: d.name
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "text-[10px] text-faint truncate",
										children: d.tagline
									})]
								})]
							}), isSelected ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "flex size-4 shrink-0 items-center justify-center rounded-full bg-gold text-gold-fg",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: "size-2.5 stroke-[3]" })
							}) : null]
						}, d.id);
					})
				}),
				activeTab === "motion" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mt-2.5 flex flex-col gap-1.5",
					children: MOTION_DIALS.map((m) => {
						const isSelected = m.id === currentMotion;
						return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							onClick: () => selectMotion(m.id),
							className: cn("group flex items-center justify-between gap-2.5 rounded-xl p-2 text-left text-xs transition-all", isSelected ? "bg-card border border-gold/40 shadow-sm" : "hover:bg-card/60 hover:text-foreground"),
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "min-w-0",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: cn("font-medium truncate text-xs", isSelected ? "text-foreground font-semibold" : "text-muted group-hover:text-foreground"),
									children: m.name
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-[10px] text-faint truncate",
									children: m.tagline
								})]
							}), isSelected ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "flex size-4 shrink-0 items-center justify-center rounded-full bg-gold text-gold-fg",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: "size-2.5 stroke-[3]" })
							}) : null]
						}, m.id);
					})
				}),
				activeTab === "palette" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mt-2.5 flex flex-col gap-1.5",
					children: THEME_OPTIONS.map((t) => {
						const isSelected = t.id === currentTheme;
						return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							onClick: () => selectTheme(t.id),
							className: cn("group flex items-center justify-between gap-2.5 rounded-xl p-2 text-left text-xs transition-all", isSelected ? "bg-card border border-gold/40 shadow-sm" : "hover:bg-card/60 hover:text-foreground"),
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center gap-2.5 min-w-0",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "flex size-7 items-center justify-center rounded-lg border border-white/10 shadow-inner shrink-0",
									style: { backgroundColor: t.bg },
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex gap-0.5",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "size-2 rounded-full",
											style: { backgroundColor: t.palette[0] }
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "size-2 rounded-full",
											style: { backgroundColor: t.palette[1] }
										})]
									})
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "min-w-0",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: cn("font-medium truncate text-xs", isSelected ? "text-foreground font-semibold" : "text-muted group-hover:text-foreground"),
										children: t.name
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "text-[10px] text-faint truncate",
										children: t.tagline
									})]
								})]
							}), isSelected ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "flex size-4 shrink-0 items-center justify-center rounded-full bg-gold text-gold-fg",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: "size-2.5 stroke-[3]" })
							}) : null]
						}, t.id);
					})
				})
			]
		})] }) : null]
	});
}
var GALLERY_ARTWORKS = [
	{
		title: "Wanderer above the Sea of Fog",
		artist: "Caspar David Friedrich",
		year: "1818",
		url: "https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?auto=format&fit=crop&w=1920&q=80"
	},
	{
		title: "Starry Night Over the Rhône",
		artist: "Vincent van Gogh",
		year: "1888",
		url: "https://images.unsplash.com/photo-1541701494587-cb58502866ab?auto=format&fit=crop&w=1920&q=80"
	},
	{
		title: "The Great Wave off Kanagawa",
		artist: "Katsushika Hokusai",
		year: "1831",
		url: "https://images.unsplash.com/photo-1579783902614-a3fb3927b675?auto=format&fit=crop&w=1920&q=80"
	}
];
function StandbyAmbiance({ initialMode = "campfire", onDismiss }) {
	const [mode, setMode] = (0, import_react.useState)(initialMode);
	const [artIndex, setArtIndex] = (0, import_react.useState)(0);
	const [photos, setPhotos] = (0, import_react.useState)([]);
	const [photoIndex, setPhotoIndex] = (0, import_react.useState)(0);
	const [soundEnabled, setSoundEnabled] = (0, import_react.useState)(false);
	const audioContextRef = (0, import_react.useRef)(null);
	const noiseNodeRef = (0, import_react.useRef)(null);
	(0, import_react.useEffect)(() => {
		let active = true;
		fetch("/api/standby/photos").then((res) => res.ok ? res.json() : null).then((data) => {
			if (active && Array.isArray(data?.photos) && data.photos.length > 0) setPhotos(data.photos);
		}).catch(() => {});
		return () => {
			active = false;
		};
	}, []);
	(0, import_react.useEffect)(() => {
		if (mode === "gallery") {
			const interval = setInterval(() => {
				setArtIndex((prev) => (prev + 1) % GALLERY_ARTWORKS.length);
			}, 25e3);
			return () => clearInterval(interval);
		}
		if (mode === "photos" && photos.length > 1) {
			const interval = setInterval(() => {
				setPhotoIndex((prev) => (prev + 1) % photos.length);
			}, 15e3);
			return () => clearInterval(interval);
		}
	}, [mode, photos.length]);
	const toggleSound = () => {
		if (soundEnabled) {
			try {
				audioContextRef.current?.close();
			} catch {}
			audioContextRef.current = null;
			setSoundEnabled(false);
			return;
		}
		try {
			const ctx = new (window.AudioContext || window.webkitAudioContext)();
			audioContextRef.current = ctx;
			const bufferSize = ctx.sampleRate * 2;
			const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
			const data = buffer.getChannelData(0);
			let lastOut = 0;
			for (let i = 0; i < bufferSize; i++) {
				const white = Math.random() * 2 - 1;
				data[i] = (lastOut + .02 * white) / 1.02;
				lastOut = data[i];
				data[i] *= 3.5;
			}
			const brownNoise = ctx.createBufferSource();
			brownNoise.buffer = buffer;
			brownNoise.loop = true;
			const filter = ctx.createBiquadFilter();
			filter.type = "lowpass";
			filter.frequency.value = 350;
			const gain = ctx.createGain();
			gain.gain.value = .08;
			brownNoise.connect(filter);
			filter.connect(gain);
			gain.connect(ctx.destination);
			brownNoise.start();
			noiseNodeRef.current = brownNoise;
			setSoundEnabled(true);
		} catch {
			setSoundEnabled(false);
		}
	};
	(0, import_react.useEffect)(() => {
		return () => {
			try {
				audioContextRef.current?.close();
			} catch {}
		};
	}, []);
	const currentArt = GALLERY_ARTWORKS[artIndex];
	const currentPhoto = photos.length > 0 ? photos[photoIndex % photos.length] : null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "fixed inset-0 z-50 bg-black text-foreground select-none overflow-hidden animate-in fade-in duration-1000",
		tabIndex: 0,
		onKeyDown: (e) => {
			if (e.key === "Escape" || e.key === "Enter" || e.key === " " || e.key === "ArrowLeft" || e.key === "ArrowRight") onDismiss?.();
		},
		children: [
			mode === "campfire" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "absolute inset-0 flex items-center justify-center bg-black overflow-hidden",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "absolute inset-0 bg-gradient-radial from-amber-950/40 via-black to-black opacity-80" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "relative w-full max-w-4xl h-96 flex flex-col items-center justify-center text-center",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "relative flex items-center justify-center",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "size-64 rounded-full bg-amber-500/20 blur-3xl animate-pulse duration-1000" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "size-48 rounded-full bg-orange-600/30 blur-2xl animate-pulse duration-700" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "size-24 rounded-full bg-yellow-400/40 blur-xl" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Flame, { className: "size-28 text-amber-500/90 drop-shadow-[0_0_35px_rgba(245,158,11,0.6)] animate-bounce duration-1000" })
						]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-8 space-y-2 z-10",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "font-serif text-2xl font-light tracking-wide text-amber-200/90",
							children: "The Hearth"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "font-mono text-xs text-amber-400/60 uppercase tracking-widest",
							children: "Thoughtful Living Room Ambiance"
						})]
					})]
				})]
			}),
			mode === "gallery" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "absolute inset-0 bg-black flex items-center justify-center",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
						src: currentArt.url,
						alt: currentArt.title,
						className: "size-full object-cover opacity-85 transition-opacity duration-1000"
					}, currentArt.url),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "absolute bottom-12 left-12 space-y-1.5 z-10 max-w-lg",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "font-serif text-2xl font-bold tracking-tight text-white drop-shadow-md",
								children: currentArt.title
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "text-sm text-zinc-300 font-sans",
								children: [
									currentArt.artist,
									", ",
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-zinc-400 font-mono",
										children: currentArt.year
									})
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-[11px] font-mono uppercase tracking-widest text-gold/80 pt-1",
								children: "Living Art Gallery · High-Fidelity"
							})
						]
					})
				]
			}),
			mode === "photos" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "absolute inset-0 bg-black flex items-center justify-center",
				children: currentPhoto ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
					src: currentPhoto.url,
					alt: "Family Memory",
					className: "size-full object-contain p-8 opacity-90 transition-opacity duration-1000"
				}, currentPhoto.url), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "absolute bottom-10 left-10 space-y-1 z-10",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "font-serif text-xl font-medium text-white",
						children: "Sovereign Family Photo Wall"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-xs font-mono text-zinc-400",
						children: "Memories stored on this ReelOS home"
					})]
				})] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "text-center space-y-3 p-6 max-w-sm",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Image, { className: "size-12 text-muted mx-auto opacity-50" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-sm font-medium text-foreground",
							children: "No Local Photos Yet"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-xs text-muted leading-relaxed",
							children: "Send personal photos directly to your TV from the Second Screen Companion app."
						})
					]
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "absolute top-8 right-8 z-30 flex items-center gap-3",
				children: [
					mode === "campfire" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
						size: "sm",
						variant: "quiet",
						onClick: toggleSound,
						className: "rounded-full bg-black/50 backdrop-blur-md border border-white/10 text-white/80 hover:text-white px-3",
						title: soundEnabled ? "Mute Hearth" : "Hear Ambient Hearth",
						children: [soundEnabled ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Volume2, { className: "size-4 text-amber-400" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(VolumeX, { className: "size-4" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-xs font-mono",
							children: soundEnabled ? "Audio On" : "Audio Off"
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center rounded-full bg-black/50 backdrop-blur-md border border-white/10 p-1",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: () => setMode("campfire"),
								className: cn("px-3 py-1.5 rounded-full text-xs font-mono transition-colors", mode === "campfire" ? "bg-gold text-black font-bold" : "text-muted hover:text-foreground"),
								children: "Hearth"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: () => setMode("gallery"),
								className: cn("px-3 py-1.5 rounded-full text-xs font-mono transition-colors", mode === "gallery" ? "bg-gold text-black font-bold" : "text-muted hover:text-foreground"),
								children: "Gallery"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: () => setMode("photos"),
								className: cn("px-3 py-1.5 rounded-full text-xs font-mono transition-colors", mode === "photos" ? "bg-gold text-black font-bold" : "text-muted hover:text-foreground"),
								children: "Family Wall"
							})
						]
					}),
					onDismiss && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: onDismiss,
						className: "flex size-9 items-center justify-center rounded-full bg-black/50 backdrop-blur-md border border-white/10 text-white/70 hover:text-white transition-colors",
						title: "Return to Cinema Home",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-4" })
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "absolute bottom-6 right-8 text-[11px] font-mono text-zinc-500 pointer-events-none",
				children: "Press any key to resume"
			})
		]
	});
}
function TvView() {
	const navigate = useNavigate();
	const shelf = useReelStore((s) => s.shelf);
	const hydrateShelf = useReelStore((s) => s.hydrateShelf);
	const watchProgress = useReelStore((s) => s.watchProgress);
	const houseName = useReelStore((s) => s.houseName);
	const residents = useReelStore((s) => s.residents);
	const activeResidentId = useReelStore((s) => s.activeResidentId);
	const ipv4 = useReelStore((s) => s.ipv4);
	const tailscaleIp = useReelStore((s) => s.tailscaleIp);
	const watchDoor = useReelStore((s) => s.watch);
	useReelStore((s) => s.jellyfinHop?.state === "green");
	const [timeStr, setTimeStr] = (0, import_react.useState)("");
	const [gamepadConnected, setGamepadConnected] = (0, import_react.useState)(false);
	const [isFullscreen, setIsFullscreen] = (0, import_react.useState)(false);
	const [activeTvModal, setActiveTvModal] = (0, import_react.useState)(null);
	const [modalActionIndex, setModalActionIndex] = (0, import_react.useState)(0);
	const [isIdleAmbiance, setIsIdleAmbiance] = (0, import_react.useState)(false);
	const idleTimerRef = (0, import_react.useRef)(null);
	const activeResident = residents.find((r) => r.id === activeResidentId) ?? residents[0] ?? {
		id: "res-primary",
		name: "Living Room",
		avatar: "clapperboard"
	};
	const [focusedRow, setFocusedRow] = (0, import_react.useState)(0);
	const [focusedCol, setFocusedCol] = (0, import_react.useState)(0);
	const itemRefs = (0, import_react.useRef)(/* @__PURE__ */ new Map());
	const isKidsProfile = Boolean(activeResident?.isKids);
	const hideKids = Boolean(activeResident?.hideKidsContent);
	const kidsTitleIds = useReelStore((s) => s.kidsTitleIds);
	const residentWatchlist = activeResident?.watchlist || [];
	const filteredShelf = (0, import_react.useMemo)(() => {
		let list = shelf;
		if (activeResident?.id !== "res-primary" && activeResident?.assignedTitleIds && activeResident.assignedTitleIds.length > 0) {
			const allowed = new Set(activeResident.assignedTitleIds);
			const matches = list.filter((t) => {
				if (allowed.has(t.id)) return true;
				if (t.jellyfinId && allowed.has(t.jellyfinId)) return true;
				if (Array.isArray(t.ids) && t.ids.some((i) => allowed.has(i))) return true;
				return false;
			});
			if (matches.length > 0) list = matches;
		}
		if (isKidsProfile) return list.filter((t) => {
			const id = String(t.id || t.jellyfinId || "");
			if (kidsTitleIds.includes(id)) return true;
			const genres = (t.genres || []).map((g) => g.toLowerCase());
			return genres.includes("animation") || genres.includes("family") || genres.includes("children");
		});
		if (hideKids) {
			const watchlistSet = new Set(residentWatchlist);
			return list.filter((t) => {
				const id = String(t.id || t.jellyfinId || "");
				if (watchlistSet.has(id)) return true;
				if (kidsTitleIds.includes(id)) return false;
				const genres = (t.genres || []).map((g) => g.toLowerCase());
				return !(genres.includes("animation") || genres.includes("family") || genres.includes("children"));
			});
		}
		return list;
	}, [
		shelf,
		isKidsProfile,
		hideKids,
		kidsTitleIds,
		residentWatchlist,
		activeResident?.assignedTitleIds,
		activeResident?.id
	]);
	const boxShelf = (0, import_react.useMemo)(() => homeShelfRows(filteredShelf), [filteredShelf]);
	const continueWatching = (0, import_react.useMemo)(() => {
		return Object.entries(watchProgress).filter(([, p]) => p > .03 && p < .96).map(([id, p]) => {
			const t = shelf.find((x) => x.id === id || x.jellyfinId === id);
			return t ? {
				title: t,
				progress: p
			} : null;
		}).filter((x) => Boolean(x));
	}, [shelf, watchProgress]);
	const recentlyAdded = (0, import_react.useMemo)(() => {
		return [...boxShelf].sort((a, b) => {
			if (a.dateAdded && b.dateAdded) return new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime();
			return 0;
		}).slice(0, 12);
	}, [boxShelf]);
	const pickTonight = (0, import_react.useMemo)(() => {
		return boxShelf.slice(0, 12);
	}, [boxShelf]);
	const featuredTitle = continueWatching[0]?.title ?? recentlyAdded[0] ?? boxShelf[0] ?? {
		id: "demo",
		title: "ReelOS Cinema Lounge",
		overview: "Experience seamless, zero-buffer 4K HDR entertainment right from your sofa.",
		year: "2026",
		maxQuality: "4k"
	};
	(0, import_react.useEffect)(() => {
		const updateTime = () => {
			setTimeStr((/* @__PURE__ */ new Date()).toLocaleTimeString([], {
				hour: "numeric",
				minute: "2-digit"
			}));
		};
		updateTime();
		const id = setInterval(updateTime, 1e3);
		return () => clearInterval(id);
	}, []);
	(0, import_react.useEffect)(() => {
		hydrateShelf({
			limit: 36,
			force: true
		});
	}, [hydrateShelf]);
	(0, import_react.useEffect)(() => {
		const resetIdleTimer = () => {
			if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
			idleTimerRef.current = setTimeout(() => {
				setIsIdleAmbiance(true);
			}, 18e4);
		};
		resetIdleTimer();
		const onActivity = () => {
			resetIdleTimer();
		};
		window.addEventListener("keydown", onActivity);
		window.addEventListener("mousemove", onActivity);
		window.addEventListener("pointerdown", onActivity);
		return () => {
			if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
			window.removeEventListener("keydown", onActivity);
			window.removeEventListener("mousemove", onActivity);
			window.removeEventListener("pointerdown", onActivity);
		};
	}, []);
	const toggleFullscreen = () => {
		if (!document.fullscreenElement) {
			document.documentElement.requestFullscreen();
			setIsFullscreen(true);
		} else {
			document.exitFullscreen();
			setIsFullscreen(false);
		}
	};
	const activeRows = (0, import_react.useMemo)(() => {
		const rows = [0];
		if (continueWatching.length > 0) rows.push(1);
		if (recentlyAdded.length > 0) rows.push(2);
		if (pickTonight.length > 0) rows.push(3);
		return rows;
	}, [
		continueWatching.length,
		recentlyAdded.length,
		pickTonight.length
	]);
	const getRowItemCount = (rowIndex) => {
		if (rowIndex === 0) return 1;
		if (rowIndex === 1) return continueWatching.length;
		if (rowIndex === 2) return recentlyAdded.length;
		if (rowIndex === 3) return pickTonight.length;
		return 1;
	};
	const lastBackPressRef = (0, import_react.useRef)(0);
	const handleBack = () => {
		if (activeTvModal) {
			setActiveTvModal(null);
			return;
		}
		const now = Date.now();
		if (focusedRow > 0) {
			setFocusedRow(0);
			setFocusedCol(0);
		} else if (now - lastBackPressRef.current < 2e3) navigate({ to: "/" });
		else {
			lastBackPressRef.current = now;
			showToast("Press Back again to exit TV Couch Mode", "info");
		}
	};
	const openModalForTitle = (t) => {
		setActiveTvModal(t);
		setModalActionIndex(0);
	};
	const handleSelect = (row, col) => {
		if (activeTvModal) {
			if (modalActionIndex === 0) navigate({
				to: "/play/$id",
				params: { id: activeTvModal.id }
			});
			else if (modalActionIndex === 1) navigate({
				to: "/title/$id",
				params: { id: activeTvModal.id }
			});
			else setActiveTvModal(null);
			return;
		}
		if (row === -1) {
			if (col === 0) navigate({ to: "/" });
			else if (col === 1) toggleFullscreen();
			return;
		}
		if (row === 0) {
			if (featuredTitle.id && featuredTitle.id !== "demo") openModalForTitle(featuredTitle);
			return;
		}
		if (row === 1 && continueWatching[col]) {
			openModalForTitle(continueWatching[col].title);
			return;
		}
		if (row === 2 && recentlyAdded[col]) {
			openModalForTitle(recentlyAdded[col]);
			return;
		}
		if (row === 3 && pickTonight[col]) {
			openModalForTitle(pickTonight[col]);
			return;
		}
	};
	(0, import_react.useEffect)(() => {
		const onKeyDown = (e) => {
			if (activeTvModal) {
				if (e.key === "ArrowLeft") {
					e.preventDefault();
					setModalActionIndex((i) => Math.max(0, i - 1));
				} else if (e.key === "ArrowRight") {
					e.preventDefault();
					setModalActionIndex((i) => Math.min(2, i + 1));
				} else if (e.key === "Enter" || e.key === " ") {
					e.preventDefault();
					handleSelect(focusedRow, focusedCol);
				} else if (e.key === "Escape" || e.key === "Backspace") {
					e.preventDefault();
					handleBack();
				}
				return;
			}
			if (e.key === "ArrowUp") {
				e.preventDefault();
				setFocusedRow((r) => {
					if (r === 0) {
						setFocusedCol(0);
						return -1;
					}
					if (r === -1) return -1;
					const currentIndex = activeRows.indexOf(r);
					if (currentIndex <= 0) {
						setFocusedCol(0);
						return -1;
					}
					const prevRow = activeRows[currentIndex - 1] ?? 0;
					setFocusedCol((c) => Math.min(Math.max(0, getRowItemCount(prevRow) - 1), c));
					return prevRow;
				});
			} else if (e.key === "ArrowDown") {
				e.preventDefault();
				setFocusedRow((r) => {
					if (r === -1) {
						setFocusedCol(0);
						return 0;
					}
					const currentIndex = activeRows.indexOf(r);
					const nextActiveIndex = currentIndex >= 0 && currentIndex < activeRows.length - 1 ? currentIndex + 1 : currentIndex;
					const nextRow = activeRows[nextActiveIndex] ?? r;
					setFocusedCol((c) => Math.min(Math.max(0, getRowItemCount(nextRow) - 1), c));
					return nextRow;
				});
			} else if (e.key === "ArrowLeft") {
				e.preventDefault();
				setFocusedCol((c) => Math.max(0, c - 1));
			} else if (e.key === "ArrowRight") {
				e.preventDefault();
				const max = focusedRow === -1 ? 1 : Math.max(0, getRowItemCount(focusedRow) - 1);
				setFocusedCol((c) => Math.min(max, c + 1));
			} else if (e.key === "Enter") {
				e.preventDefault();
				handleSelect(focusedRow, focusedCol);
			} else if (e.key === "Escape" || e.key === "Backspace") {
				e.preventDefault();
				handleBack();
			} else if (e.key === "f" || e.key === "F") toggleFullscreen();
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [
		focusedRow,
		focusedCol,
		activeRows,
		activeTvModal,
		modalActionIndex,
		navigate
	]);
	(0, import_react.useEffect)(() => {
		let animId;
		let lastButtonTime = 0;
		const pollGamepad = () => {
			const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
			let found = false;
			for (const gp of gamepads) {
				if (!gp) continue;
				found = true;
				const now = performance.now();
				if (now - lastButtonTime > 180) {
					const up = gp.buttons[12]?.pressed || gp.axes[1] && gp.axes[1] < -.5;
					const down = gp.buttons[13]?.pressed || gp.axes[1] && gp.axes[1] > .5;
					const left = gp.buttons[14]?.pressed || gp.axes[0] && gp.axes[0] < -.5;
					const right = gp.buttons[15]?.pressed || gp.axes[0] && gp.axes[0] > .5;
					const btnA = gp.buttons[0]?.pressed;
					const btnB = gp.buttons[1]?.pressed;
					if (activeTvModal) {
						if (left) {
							setModalActionIndex((i) => Math.max(0, i - 1));
							lastButtonTime = now;
						} else if (right) {
							setModalActionIndex((i) => Math.min(2, i + 1));
							lastButtonTime = now;
						} else if (btnA) {
							handleSelect(focusedRow, focusedCol);
							lastButtonTime = now;
						} else if (btnB) {
							handleBack();
							lastButtonTime = now;
						}
						continue;
					}
					if (up) {
						setFocusedRow((r) => {
							if (r === 0) {
								setFocusedCol(0);
								return -1;
							}
							if (r === -1) return -1;
							const currentIndex = activeRows.indexOf(r);
							if (currentIndex <= 0) {
								setFocusedCol(0);
								return -1;
							}
							const prevRow = activeRows[currentIndex - 1] ?? 0;
							setFocusedCol((c) => Math.min(Math.max(0, getRowItemCount(prevRow) - 1), c));
							return prevRow;
						});
						lastButtonTime = now;
					} else if (down) {
						setFocusedRow((r) => {
							if (r === -1) {
								setFocusedCol(0);
								return 0;
							}
							const currentIndex = activeRows.indexOf(r);
							const nextActiveIndex = currentIndex >= 0 && currentIndex < activeRows.length - 1 ? currentIndex + 1 : currentIndex;
							const nextRow = activeRows[nextActiveIndex] ?? r;
							setFocusedCol((c) => Math.min(Math.max(0, getRowItemCount(nextRow) - 1), c));
							return nextRow;
						});
						lastButtonTime = now;
					} else if (left) {
						setFocusedCol((c) => Math.max(0, c - 1));
						lastButtonTime = now;
					} else if (right) {
						const max = focusedRow === -1 ? 1 : Math.max(0, getRowItemCount(focusedRow) - 1);
						setFocusedCol((c) => Math.min(max, c + 1));
						lastButtonTime = now;
					} else if (btnA) {
						handleSelect(focusedRow, focusedCol);
						lastButtonTime = now;
					} else if (btnB) {
						handleBack();
						lastButtonTime = now;
					}
				}
			}
			setGamepadConnected(found);
			animId = requestAnimationFrame(pollGamepad);
		};
		animId = requestAnimationFrame(pollGamepad);
		return () => cancelAnimationFrame(animId);
	}, [
		focusedRow,
		focusedCol,
		activeRows,
		activeTvModal,
		modalActionIndex,
		navigate
	]);
	(0, import_react.useEffect)(() => {
		if (focusedRow === -1) {
			window.scrollTo({
				top: 0,
				behavior: "smooth"
			});
			return;
		}
		const key = `${focusedRow}-${focusedCol}`;
		const el = itemRefs.current.get(key);
		if (el) el.scrollIntoView({
			behavior: "smooth",
			block: "nearest",
			inline: "center"
		});
	}, [focusedRow, focusedCol]);
	const hostname = typeof window !== "undefined" ? window.location.hostname : "";
	jellyfinWatchHref({
		ipv4,
		tailscaleIp,
		watch: watchDoor,
		hostname
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "relative min-h-dvh overflow-x-hidden bg-background select-none text-foreground font-sans",
		children: [
			isIdleAmbiance ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StandbyAmbiance, { onDismiss: () => setIsIdleAmbiance(false) }) : null,
			featuredTitle.backdrop || featuredTitle.poster ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "pointer-events-none fixed inset-0 z-0 overflow-hidden opacity-30",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
					src: featuredTitle.backdrop || featuredTitle.poster,
					alt: "",
					className: "size-full object-cover blur-3xl scale-125 transition-all duration-1000"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "absolute inset-0 bg-gradient-to-b from-background/40 via-background/80 to-background" })]
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
				className: "relative z-30 flex items-center justify-between px-8 py-6 md:px-14",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-4",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
							ref: (el) => {
								if (el) itemRefs.current.set("-1-0", el);
							},
							variant: "ghost",
							onClick: () => void navigate({ to: "/" }),
							className: cn("rounded-2xl border border-border bg-card/60 px-4 py-2 text-xs font-semibold text-muted hover:text-foreground transition-all cursor-pointer", focusedRow === -1 && focusedCol === 0 && "tv-focus-ring ring-4 ring-gold border-gold/80 text-foreground bg-card shadow-lg scale-105"),
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowLeft, { className: "size-4" }), "Exit TV Mode"]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-2 rounded-full border border-border bg-card/60 px-3.5 py-1 text-xs",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "relative flex size-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "absolute inline-flex size-full animate-ping rounded-full bg-live opacity-75" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "relative inline-flex size-2 rounded-full bg-live" })]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "font-display font-medium text-foreground",
								children: houseName || "ReelOS Living Room"
							})]
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-2 rounded-2xl border border-border bg-card/60 px-5 py-1.5 font-display text-lg font-bold tracking-tight text-foreground shadow-sm",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Clock, { className: "size-4 text-gold" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: timeStr })]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-3",
						children: [
							gamepadConnected ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center gap-1.5 rounded-full border border-gold/40 bg-gold/10 px-3 py-1 text-xs font-semibold text-gold",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Gamepad2, { className: "size-3.5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Controller Active" })]
							}) : null,
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs text-muted",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Wifi, { className: "size-3.5 text-success" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "LAN 1Gbps" })]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								type: "button",
								onClick: () => setIsIdleAmbiance(true),
								className: "flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-300 hover:bg-amber-500/20 transition-all cursor-pointer",
								title: "The Hearth & Living Art Gallery Ambiance",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Flame, { className: "size-3.5 text-amber-400" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "hidden sm:inline",
									children: "Hearth"
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(GuestQrPopover, { compact: true }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ThemeSwitcher, { compact: true }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ProfileSwitcher, { compact: true }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								ref: (el) => {
									if (el) itemRefs.current.set("-1-1", el);
								},
								type: "button",
								onClick: toggleFullscreen,
								className: cn("flex size-9 items-center justify-center rounded-xl border border-border bg-card/60 text-muted hover:text-foreground transition-all cursor-pointer", focusedRow === -1 && focusedCol === 1 && "tv-focus-ring ring-4 ring-gold border-gold/80 text-foreground bg-card shadow-lg scale-105"),
								title: "Toggle Fullscreen (F)",
								children: isFullscreen ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Minimize2, { className: "size-4" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Maximize2, { className: "size-4" })
							})
						]
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
				className: "relative z-10 px-8 pb-32 pt-2 md:px-14 space-y-12",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("section", {
						ref: (el) => {
							if (el) itemRefs.current.set("0-0", el);
						},
						onClick: () => handleSelect(0, 0),
						className: cn("relative cursor-pointer overflow-hidden rounded-3xl border border-border transition-all duration-300", focusedRow === 0 ? "tv-focus-ring ring-4 ring-gold border-gold/80 shadow-2xl scale-[1.01]" : "hover:border-border-strong"),
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "relative h-[48vh] min-h-[380px] w-full overflow-hidden bg-card",
							children: [
								featuredTitle.backdrop || featuredTitle.poster ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
									src: featuredTitle.backdrop || featuredTitle.poster,
									alt: "",
									className: "size-full object-cover object-center opacity-70"
								}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "size-full bg-gradient-to-br from-card to-card-2" }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "absolute inset-0 bg-gradient-to-r from-background/90 via-background/40 to-transparent" }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "absolute bottom-10 left-10 max-w-2xl space-y-4",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex flex-wrap items-center gap-2.5",
											children: [
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "rounded-full bg-gold px-3 py-1 font-display text-xs font-bold uppercase tracking-wider text-gold-fg",
													children: "Featured Spotlight"
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "rounded-full border border-white/20 bg-background/60 px-2.5 py-0.5 text-xs font-semibold backdrop-blur-md",
													children: "4K ULTRA HD"
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "rounded-full border border-white/20 bg-background/60 px-2.5 py-0.5 text-xs font-semibold backdrop-blur-md",
													children: "DOLBY VISION"
												}),
												featuredTitle.year ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "text-xs text-muted font-medium",
													children: featuredTitle.year
												}) : null
											]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
											className: "font-display text-4xl font-extrabold tracking-tight text-foreground md:text-5xl drop-shadow-md",
											children: featuredTitle.title
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
											className: "line-clamp-3 text-base text-muted/90 leading-relaxed max-w-xl",
											children: featuredTitle.overview || "Ultra-crisp 4K HDR playback powered by ReelOS. High-fashion cinema experience with instant cloud streaming."
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex items-center gap-4 pt-2",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
												size: "lg",
												variant: "gold",
												className: "rounded-2xl px-6 py-5 font-display text-base font-bold shadow-[var(--shadow-gold)]",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Play, { className: "size-5 fill-current" }), "Watch Now"]
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
												size: "lg",
												variant: "ghost",
												className: "rounded-2xl border border-border bg-card/70 px-5 text-sm font-medium backdrop-blur-md",
												children: "View Details"
											})]
										})
									]
								})
							]
						})
					}),
					continueWatching.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TvCarousel, {
						title: "Continue Watching",
						rowIndex: 1,
						focusedRow,
						focusedCol,
						itemRefs,
						onSelect: handleSelect,
						children: continueWatching.map((item, idx) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TvTitleCard, {
							title: item.title,
							progress: item.progress,
							isFocused: focusedRow === 1 && focusedCol === idx,
							ref: (el) => {
								if (el) itemRefs.current.set(`1-${idx}`, el);
							},
							onClick: () => handleSelect(1, idx)
						}, `cw-${item.title.id}`))
					}) : null,
					recentlyAdded.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TvCarousel, {
						title: "Recently Added to House",
						rowIndex: 2,
						focusedRow,
						focusedCol,
						itemRefs,
						onSelect: handleSelect,
						children: recentlyAdded.map((t, idx) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TvTitleCard, {
							title: t,
							isFocused: focusedRow === 2 && focusedCol === idx,
							ref: (el) => {
								if (el) itemRefs.current.set(`2-${idx}`, el);
							},
							onClick: () => handleSelect(2, idx)
						}, `ra-${t.id}`))
					}) : null,
					pickTonight.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TvCarousel, {
						title: "Pick Tonight",
						rowIndex: 3,
						focusedRow,
						focusedCol,
						itemRefs,
						onSelect: handleSelect,
						children: pickTonight.map((t, idx) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TvTitleCard, {
							title: t,
							isFocused: focusedRow === 3 && focusedCol === idx,
							ref: (el) => {
								if (el) itemRefs.current.set(`3-${idx}`, el);
							},
							onClick: () => handleSelect(3, idx)
						}, `pt-${t.id}`))
					}) : null
				]
			}),
			activeTvModal && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-xl animate-in fade-in duration-200 p-8",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "relative max-w-2xl w-full rounded-3xl border border-gold/40 bg-card/95 p-8 shadow-2xl space-y-6",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex gap-6 items-start",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "w-36 shrink-0 aspect-[2/3] rounded-2xl overflow-hidden border border-border shadow-lg",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Poster, {
								title: activeTvModal,
								className: "size-full object-cover"
							})
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "space-y-2 flex-1",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center gap-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "rounded-full bg-gold/20 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-gold border border-gold/40",
										children: "4K DirectPlay"
									}), activeTvModal.year ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-xs text-muted font-medium",
										children: activeTvModal.year
									}) : null]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
									className: "font-display text-3xl font-extrabold text-foreground",
									children: activeTvModal.title
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "line-clamp-4 text-xs text-muted leading-relaxed",
									children: activeTvModal.overview || "High-bitrate cinema playback with instant streaming and local hardware acceleration."
								})
							]
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center justify-end gap-3 pt-4 border-t border-border/60",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								type: "button",
								onClick: () => {
									navigate({
										to: "/play/$id",
										params: { id: activeTvModal.id }
									});
								},
								className: cn("flex items-center gap-2 rounded-2xl px-6 py-3 font-display text-sm font-bold transition-all cursor-pointer", modalActionIndex === 0 ? "bg-gold text-background ring-4 ring-gold/40 scale-105 shadow-lg shadow-gold/20" : "bg-gold/20 text-gold hover:bg-gold/30"),
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Play, { className: "size-4 fill-current" }), "Play Now"]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: () => {
									navigate({
										to: "/title/$id",
										params: { id: activeTvModal.id }
									});
								},
								className: cn("rounded-2xl border px-5 py-3 text-sm font-medium transition-all cursor-pointer", modalActionIndex === 1 ? "border-gold bg-card ring-4 ring-gold/40 scale-105 text-foreground" : "border-border bg-card/60 text-muted hover:text-foreground"),
								children: "Full Details"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: () => setActiveTvModal(null),
								className: cn("rounded-2xl px-5 py-3 text-sm font-medium transition-all cursor-pointer", modalActionIndex === 2 ? "bg-muted/30 text-foreground ring-4 ring-white/20 scale-105" : "text-muted hover:text-foreground"),
								children: "Back to Couch"
							})
						]
					})]
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("footer", {
				className: "fixed inset-x-0 bottom-0 z-30 flex items-center justify-between border-t border-border bg-background/85 px-10 py-3.5 backdrop-blur-xl text-xs text-muted",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-6",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "flex items-center gap-1.5 font-medium",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("kbd", {
								className: "rounded bg-card-2 px-1.5 py-0.5 font-mono text-[10px] text-foreground border border-border",
								children: "▲▼"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Rows" })]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "flex items-center gap-1.5 font-medium",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("kbd", {
								className: "rounded bg-card-2 px-1.5 py-0.5 font-mono text-[10px] text-foreground border border-border",
								children: "◀▶"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Browse" })]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "flex items-center gap-1.5 font-medium",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("kbd", {
								className: "rounded bg-card-2 px-2 py-0.5 font-mono text-[10px] text-gold border border-gold/40",
								children: "Enter / Ⓐ"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Select" })]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "flex items-center gap-1.5 font-medium",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("kbd", {
								className: "rounded bg-card-2 px-1.5 py-0.5 font-mono text-[10px] text-foreground border border-border",
								children: "Esc / Ⓑ"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Back" })]
						})
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "flex items-center gap-3",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-[11px] text-faint",
						children: "ReelOS 10-Foot Living Room Mode"
					})
				})]
			})
		]
	});
}
function TvCarousel({ title, children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "space-y-4",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
			className: "font-display text-xl font-bold tracking-tight text-foreground",
			children: title
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "no-scrollbar flex gap-5 overflow-x-auto pb-6 pt-2",
			children
		})]
	});
}
var TvTitleCard = (0, import_react.forwardRef)(function TvTitleCard({ title, progress, isFocused, onClick }, ref) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		ref,
		onClick,
		tabIndex: 0,
		"data-focused": isFocused ? "true" : void 0,
		className: cn("tv-focus-ring group relative w-[220px] min-w-[220px] shrink-0 cursor-pointer rounded-2xl overflow-hidden transition-all duration-300", isFocused ? "ring-4 ring-gold scale-[1.08] z-20 shadow-2xl shadow-gold/30" : "hover:scale-[1.02] opacity-85 hover:opacity-100"),
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "relative aspect-[2/3] w-full overflow-hidden rounded-2xl bg-card border border-border",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Poster, {
					title,
					className: "size-full rounded-2xl object-cover"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "absolute right-2.5 top-2.5 rounded-full border border-white/20 bg-background/80 px-2 py-0.5 text-[9px] font-bold tracking-wider text-foreground backdrop-blur-md",
					children: "4K HDR"
				}),
				typeof progress === "number" && progress > .03 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "absolute inset-x-0 bottom-0 h-1.5 bg-background/60",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "h-full bg-gold transition-all",
						style: { width: `${progress * 100}%` }
					})
				}) : null
			]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mt-2.5 space-y-0.5 px-1",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "truncate font-display text-sm font-semibold text-foreground",
				children: title.title
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-xs text-muted",
				children: title.year || "4K DirectPlay"
			})]
		})]
	});
});
function TvPage() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Gate, {
		chrome: false,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TvView, {})
	});
}
//#endregion
export { TvPage as component };
