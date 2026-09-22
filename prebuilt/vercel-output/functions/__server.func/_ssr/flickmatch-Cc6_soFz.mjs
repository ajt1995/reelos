import { i as __toESM } from "../_runtime.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { S as require_jsx_runtime, b as useNavigate, v as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { B as Play, Et as Clapperboard, H as PartyPopper, L as QrCode, Nt as Check, S as Sparkles, Ut as ArrowLeft, bt as Copy, lt as Heart, m as Tv, n as X, s as Users, t as Zap } from "../_libs/lucide-react.mjs";
import { X as useReelStore, u as Button } from "./router-2BoRtkQZ.mjs";
import { a as ResidentAvatar, i as QrCodeSvg, t as Gate } from "./gate-ejkd3pT8.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/flickmatch-Cc6_soFz.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function FlickMatchView() {
	const navigate = useNavigate();
	const residents = useReelStore((s) => s.residents);
	const activeResidentId = useReelStore((s) => s.activeResidentId);
	const activeResident = residents.find((r) => r.id === activeResidentId) ?? residents[0] ?? {
		name: "Host",
		avatar: "clapperboard"
	};
	const [roomCode, setRoomCode] = (0, import_react.useState)("");
	const [inRoom, setInRoom] = (0, import_react.useState)(false);
	const [players, setPlayers] = (0, import_react.useState)([]);
	const [deck, setDeck] = (0, import_react.useState)([]);
	const [currentIndex, setCurrentIndex] = (0, import_react.useState)(0);
	const [match, setMatch] = (0, import_react.useState)(null);
	const [copied, setCopied] = (0, import_react.useState)(false);
	const [casting, setCasting] = (0, import_react.useState)(false);
	const [showInviteModal, setShowInviteModal] = (0, import_react.useState)(false);
	(0, import_react.useEffect)(() => {
		if (typeof window !== "undefined") {
			const r = new URLSearchParams(window.location.search).get("room");
			if (r) {
				setRoomCode(r.toUpperCase());
				joinRoom(r.toUpperCase());
			}
		}
	}, []);
	(0, import_react.useEffect)(() => {
		if (!inRoom || !roomCode || match) return;
		const interval = setInterval(async () => {
			try {
				const res = await fetch(`/api/flickmatch/status?room=${encodeURIComponent(roomCode)}`);
				if (res.ok) {
					const data = await res.json();
					if (data.players) setPlayers(data.players);
					if (data.match) setMatch(data.match);
				}
			} catch {}
		}, 2e3);
		return () => clearInterval(interval);
	}, [
		inRoom,
		roomCode,
		match
	]);
	const joinRoom = async (codeToJoin) => {
		try {
			const data = await (await fetch("/api/flickmatch/session", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					roomCode: codeToJoin || roomCode,
					residentName: activeResident.name,
					residentAvatar: activeResident.avatar
				})
			})).json();
			if (data.ok) {
				setRoomCode(data.roomCode);
				setPlayers(data.players || []);
				setDeck(data.deck || []);
				if (data.match) setMatch(data.match);
				setInRoom(true);
			}
		} catch {}
	};
	const handleVote = async (vote) => {
		const card = deck[currentIndex];
		if (!card) return;
		try {
			const data = await (await fetch("/api/flickmatch/vote", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					roomCode,
					residentName: activeResident.name,
					titleId: card.id,
					vote
				})
			})).json();
			if (data.matched && data.match) setMatch(data.match);
			else setCurrentIndex((i) => i + 1);
		} catch {
			setCurrentIndex((i) => i + 1);
		}
	};
	const handleCastPlay = async () => {
		if (!match) return;
		setCasting(true);
		try {
			const firstSession = (await (await fetch("/api/cast/sessions")).json()).sessions?.[0]?.id;
			await fetch("/api/cast/play", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					sessionId: firstSession,
					itemId: match.jellyfinId || match.titleId
				})
			});
		} catch {}
		setCasting(false);
	};
	const currentOrigin = typeof window !== "undefined" ? `${window.location.protocol}//${window.location.host}` : "";
	const hostUrl = `${currentOrigin}/flickmatch?room=${roomCode}`;
	const joinUrl = roomCode.trim().length === 4 ? `${currentOrigin}/flickmatch?room=${roomCode.trim().toUpperCase()}` : `${currentOrigin}/flickmatch`;
	const copyLink = (url) => {
		if (typeof navigator !== "undefined" && navigator.clipboard) {
			navigator.clipboard.writeText(url);
			setCopied(true);
			setTimeout(() => setCopied(false), 2e3);
		}
	};
	if (match) return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-background px-6 text-center",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			"aria-hidden": "true",
			className: "pointer-events-none absolute left-1/2 top-1/2 size-[36rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gold/25 blur-[140px] animate-pulse"
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "relative z-10 max-w-md space-y-6 rise",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mx-auto flex size-20 items-center justify-center rounded-3xl bg-gold/20 text-gold border border-gold/40 shadow-2xl",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PartyPopper, { className: "size-10 text-gold-bright animate-bounce" })
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "rounded-full bg-gold/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-gold border border-gold/30",
						children: "Unanimous Match!"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
						className: "mt-3 font-display text-3xl font-extrabold text-foreground md:text-4xl",
						children: match.title
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "mt-2 text-sm text-muted",
						children: [
							"Everyone in Room ",
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "font-mono font-semibold text-gold",
								children: roomCode
							}),
							" agreed on this title!"
						]
					})
				] }),
				match.poster && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mx-auto size-52 overflow-hidden rounded-2xl shadow-2xl border-2 border-gold/40",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
						src: match.poster,
						alt: match.title,
						className: "size-full object-cover"
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-col gap-3 pt-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
						size: "lg",
						variant: "gold",
						onClick: handleCastPlay,
						disabled: casting,
						className: "gap-2 rounded-2xl font-display text-base font-bold shadow-xl",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Tv, { className: "size-5" }), casting ? "Sending to TV..." : "Play on Living Room TV"]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
						variant: "ghost",
						onClick: () => {
							navigate({
								to: "/play/$id",
								params: { id: match.jellyfinId || match.titleId }
							});
						},
						className: "gap-2 rounded-2xl border-border bg-card/60 text-foreground",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Play, { className: "size-4" }), "Watch on This Device"]
					})]
				})
			]
		})]
	});
	if (inRoom && currentIndex < deck.length) {
		const card = deck[currentIndex];
		return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "relative flex min-h-dvh flex-col justify-between bg-background px-4 py-6 md:px-8",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
					className: "flex items-center justify-between",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						onClick: () => setInRoom(false),
						className: "flex items-center gap-1.5 rounded-xl border border-border bg-card/60 px-3 py-1.5 text-xs text-muted hover:text-foreground",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowLeft, { className: "size-4" }), "Leave Room"]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							onClick: () => setShowInviteModal(true),
							className: "flex items-center gap-1.5 font-mono text-xs font-bold text-gold uppercase tracking-wider bg-gold/10 hover:bg-gold/20 px-2.5 py-1 rounded-lg border border-gold/25 transition-colors cursor-pointer shadow-sm",
							title: "Show QR code for couch guests to scan and join",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(QrCode, { className: "size-3.5" }),
								"Room ",
								roomCode
							]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "font-mono text-xs text-muted",
							children: [
								currentIndex + 1,
								" / ",
								deck.length
							]
						})]
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
					className: "mx-auto my-auto w-full max-w-sm rise",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "overflow-hidden rounded-3xl border border-border bg-card shadow-2xl",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "relative aspect-[2/3] w-full bg-raised",
							children: [card.poster ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
								src: card.poster,
								alt: card.title,
								className: "size-full object-cover"
							}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "flex size-full items-center justify-center text-muted",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Clapperboard, { className: "size-16 opacity-30" })
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/70 to-transparent p-5 pt-16 text-white",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "flex flex-wrap gap-1.5",
										children: (card.genres || []).slice(0, 3).map((g) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-semibold backdrop-blur-md",
											children: g
										}, g))
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
										className: "mt-2 font-display text-2xl font-bold leading-tight",
										children: card.title
									}),
									card.year && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
										className: "text-xs text-white/70",
										children: ["Released ", card.year]
									}),
									card.overview && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "mt-2 line-clamp-3 text-xs leading-relaxed text-white/80",
										children: card.overview
									})
								]
							})]
						})
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-6 flex items-center justify-center gap-6",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: () => handleVote("no"),
							className: "flex size-16 items-center justify-center rounded-full border-2 border-danger/40 bg-card text-danger shadow-xl transition-all duration-150 hover:scale-110 active:scale-95 hover:bg-danger/10",
							title: "Pass",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, {
								className: "size-8",
								strokeWidth: 2.5
							})
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: () => handleVote("yes"),
							className: "flex size-20 items-center justify-center rounded-full border-2 border-gold bg-gold text-gold-fg shadow-2xl transition-all duration-150 hover:scale-110 active:scale-95 hover:bg-gold-bright",
							title: "Watch!",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Heart, { className: "size-10 fill-current" })
						})]
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("footer", {
					className: "flex items-center justify-center gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Users, { className: "size-4 text-muted" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "flex -space-x-1.5 overflow-hidden",
						children: players.map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ResidentAvatar, {
							avatar: p.avatar,
							className: "size-7 ring-2 ring-background text-xs"
						}, p.name))
					})]
				}),
				showInviteModal && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-md px-4",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "w-full max-w-sm rounded-3xl border border-border bg-card p-6 shadow-2xl space-y-5 text-center rise",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center justify-between",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center gap-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(QrCode, { className: "size-5 text-gold" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h3", {
										className: "font-display text-base font-semibold text-foreground",
										children: ["Join Room ", roomCode]
									})]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									onClick: () => setShowInviteModal(false),
									className: "text-muted hover:text-foreground cursor-pointer",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-4" })
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-xs text-muted",
								children: "Scan with phone camera to jump straight into this live FlickMatch session."
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "mx-auto flex flex-col items-center justify-center rounded-2xl bg-white p-3.5 shadow-2xl ring-4 ring-gold/25",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(QrCodeSvg, {
									value: hostUrl,
									size: 180
								})
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "rounded-xl border border-border bg-raised p-2.5 flex items-center justify-between gap-2 text-xs font-mono",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "truncate text-muted",
									children: hostUrl
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
									size: "sm",
									variant: "ghost",
									onClick: () => copyLink(hostUrl),
									className: "h-7 gap-1 px-2 text-[11px]",
									children: [copied ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: "size-3 text-emerald-400" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Copy, { className: "size-3" }), copied ? "Copied" : "Copy"]
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								size: "lg",
								variant: "gold",
								onClick: () => setShowInviteModal(false),
								className: "w-full rounded-2xl font-semibold shadow-lg",
								children: "Resume Swiping"
							})
						]
					})
				})
			]
		});
	}
	if (inRoom && currentIndex >= deck.length) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "flex min-h-dvh flex-col items-center justify-center px-6 text-center bg-background",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "max-w-sm space-y-4 rise",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Clapperboard, { className: "mx-auto size-14 text-gold opacity-80" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "font-display text-2xl font-bold text-foreground",
					children: "End of the Deck!"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "text-xs text-muted",
					children: [
						"You've swiped through all 15 candidates. Waiting for other players to finish their votes in Room",
						" ",
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "font-mono font-semibold text-gold",
							children: roomCode
						}),
						"."
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "rounded-2xl border border-border bg-card p-4 space-y-3 shadow-lg",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "text-[11px] font-semibold text-muted uppercase tracking-wider",
							children: ["Scan to Join Room ", roomCode]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "mx-auto flex flex-col items-center justify-center rounded-xl bg-white p-2.5 shadow-md ring-2 ring-gold/20",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(QrCodeSvg, {
								value: hostUrl,
								size: 140
							})
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "font-mono text-xs text-gold font-bold",
							children: hostUrl
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center justify-center gap-2 pt-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						variant: "ghost",
						onClick: () => {
							setCurrentIndex(0);
						},
						className: "rounded-xl border-border text-xs",
						children: "Swipe Again"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						variant: "ghost",
						onClick: () => setInRoom(false),
						className: "rounded-xl text-xs text-muted",
						children: "Leave Room"
					})]
				})
			]
		})
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "relative min-h-dvh bg-background px-6 py-10 md:px-12",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mx-auto max-w-4xl space-y-8 rise",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
					to: "/",
					className: "inline-flex items-center gap-1.5 text-xs text-muted hover:text-foreground transition-colors",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowLeft, { className: "size-3.5" }), "Back to ReelOS"]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mt-4 flex items-center justify-between",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "flex size-10 items-center justify-center rounded-2xl bg-gold/15 text-gold border border-gold/30 shadow-md",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sparkles, { className: "size-5" })
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
							className: "font-display text-2xl font-bold text-foreground",
							children: "FlickMatch"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-xs text-muted",
							children: "Group movie picker for your living room couch."
						})] })]
					})
				})] }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "grid gap-6 md:grid-cols-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "rounded-3xl border border-border bg-card p-6 shadow-xl space-y-6 flex flex-col justify-between",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "space-y-2",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
										className: "font-display text-base font-semibold text-foreground",
										children: "Host a Match Night"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "text-xs text-muted leading-relaxed",
										children: "Start a new room. Pass the room code to friends on the couch so everyone can swipe from their own phone."
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
										size: "lg",
										variant: "gold",
										onClick: () => joinRoom(),
										className: "w-full gap-2 rounded-2xl font-display font-semibold shadow-[var(--shadow-gold)] mt-2",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Zap, { className: "size-4" }), "Create New Room"]
									})
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "relative flex items-center justify-center",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "absolute inset-0 flex items-center",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "w-full border-t border-border" })
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "relative bg-card px-3 text-xs uppercase tracking-wider text-faint",
									children: "Or Join Existing"
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
								onSubmit: (e) => {
									e.preventDefault();
									const code = roomCode.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
									if (code.length === 4) joinRoom(code);
								},
								className: "space-y-3",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "relative",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										type: "text",
										maxLength: 4,
										value: roomCode,
										onChange: (e) => setRoomCode(e.target.value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase()),
										placeholder: "ENTER 4-LETTER CODE",
										className: "h-14 w-full rounded-2xl bg-raised text-center font-mono text-xl font-bold tracking-widest text-foreground placeholder:text-faint shadow-[var(--shadow-border)] focus:shadow-[var(--shadow-gold)] uppercase"
									}), roomCode ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										type: "button",
										onClick: () => setRoomCode(""),
										className: "absolute right-3.5 top-5 text-muted hover:text-foreground cursor-pointer",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-4" })
									}) : null]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
									type: "submit",
									size: "lg",
									variant: "ghost",
									disabled: roomCode.replace(/[^a-zA-Z0-9]/g, "").length !== 4,
									className: "w-full rounded-2xl border-border font-medium cursor-pointer",
									children: "Join Room"
								})]
							})
						]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "rounded-3xl border border-border bg-card p-6 shadow-xl flex flex-col items-center justify-between text-center space-y-5",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "space-y-1.5",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center justify-center gap-2 text-gold",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(QrCode, { className: "size-5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
										className: "font-display text-base font-semibold text-foreground",
										children: "Scan to Join from Phone"
									})]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-xs text-muted max-w-xs mx-auto leading-relaxed",
									children: "Point your phone camera here to jump straight into FlickMatch without typing the IP."
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "relative flex flex-col items-center justify-center rounded-2xl bg-white p-3.5 shadow-2xl ring-4 ring-gold/20",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(QrCodeSvg, {
									value: joinUrl,
									size: 176
								})
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "w-full space-y-2",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "flex items-center justify-center",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "rounded-full bg-gold/15 px-3 py-1 text-[11px] font-mono font-bold uppercase tracking-wider text-gold border border-gold/30",
											children: roomCode.trim().length === 4 ? `Room ${roomCode.trim().toUpperCase()} Included` : "Direct Couch Join"
										})
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex w-full items-center justify-between gap-2 rounded-xl border border-border bg-raised px-3 py-2 text-xs font-mono",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "truncate text-muted",
											children: joinUrl
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
											size: "sm",
											variant: "ghost",
											onClick: () => copyLink(joinUrl),
											className: "h-7 gap-1 px-2.5 text-[11px] font-sans text-foreground",
											children: [copied ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: "size-3 text-emerald-400" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Copy, { className: "size-3" }), copied ? "Copied" : "Copy Link"]
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "text-[10px] text-faint",
										children: "Works with native camera on iOS & Android"
									})
								]
							})
						]
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "grid grid-cols-3 gap-3 text-center",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "rounded-2xl border border-border bg-card/40 p-3",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "font-display text-lg font-bold text-gold",
								children: "100%"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-0.5 text-[10px] text-muted",
								children: "100% Private"
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "rounded-2xl border border-border bg-card/40 p-3",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "font-display text-lg font-bold text-gold",
								children: "15 Cards"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-0.5 text-[10px] text-muted",
								children: "Curated Deck"
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "rounded-2xl border border-border bg-card/40 p-3",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "font-display text-lg font-bold text-gold",
								children: "Instant"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-0.5 text-[10px] text-muted",
								children: "Auto-Play on TV"
							})]
						})
					]
				})
			]
		})
	});
}
function FlickMatchPage() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Gate, {
		chrome: false,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FlickMatchView, {})
	});
}
//#endregion
export { FlickMatchPage as component };
