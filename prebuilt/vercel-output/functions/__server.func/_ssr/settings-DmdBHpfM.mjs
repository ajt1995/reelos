import { i as __toESM } from "../_runtime.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { S as require_jsx_runtime, v as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { i as adapterProfile, n as HOSTNAME } from "./appliance-Dk74LcNF.mjs";
import { A as ChevronRight, C as HardDrive, E as Cpu, I as Bell, N as Check, S as House, _ as LoaderCircle, a as TriangleAlert, c as SlidersHorizontal, f as ScrollText, l as Shield, n as Wrench, o as ThumbsDown, p as RefreshCw, r as Users, x as KeyRound } from "../_libs/lucide-react.mjs";
import { R as catchupShowsBanner, _ as useReelStore, d as UPDATE_NOTES, f as accessLabel, g as storageLabel, h as sourceLabel, l as CHANNEL, m as qualityLabel, p as frontendLabel, u as SHIPPED_VERSION } from "./router-BPo84ujE.mjs";
import { i as cn, o as formatWhen } from "./title-card-D_EBASBo.mjs";
import { i as Gate, n as Button } from "./gate-C9D7tlj1.mjs";
import { a as persistUi, i as Toggle, n as Section, r as TerminalRow, t as Row } from "./settings-terminal-KZwq92gC.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/settings-DmdBHpfM.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function HouseCard() {
	const answers = useReelStore((s) => s.answers);
	const [reveal, setReveal] = (0, import_react.useState)(false);
	const [box, setBox] = (0, import_react.useState)({});
	(0, import_react.useEffect)(() => {
		fetch("/api/box", { cache: "no-store" }).then((r) => r.json()).then((b) => setBox(b)).catch(() => {});
	}, []);
	const user = box.adminName || answers.adminName || "reelos";
	const pin = box.adminPassword || answers.adminPassword || "";
	const lan = box.ipv4 || "";
	const jf = box.watch || (lan ? `http://${lan}:8096` : "");
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "mt-6 rounded-2xl bg-card px-5 py-4 shadow-[var(--shadow-border)]",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex items-start gap-3",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(House, { className: "mt-0.5 size-5 text-muted" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "min-w-0 flex-1",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "font-display font-medium",
						children: "House"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1 text-sm text-muted",
						children: "Who you are and how you reach this box."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("dl", {
						className: "mt-3 grid gap-1.5 text-sm",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex justify-between gap-3",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
									className: "text-muted",
									children: "User"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
									className: "font-mono",
									children: user
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center justify-between gap-3",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
									className: "text-muted",
									children: "Password"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("dd", {
									className: "flex items-center gap-2 font-mono",
									children: [reveal ? pin || "—" : "••••", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										type: "button",
										className: "text-xs text-gold",
										onClick: () => setReveal((v) => !v),
										children: reveal ? "Hide" : "Reveal"
									})]
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex justify-between gap-3",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
									className: "text-muted",
									children: "LAN"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
									className: "font-mono text-xs",
									children: lan || "—"
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex justify-between gap-3",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
									className: "text-muted",
									children: HOSTNAME
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("dd", {
									className: "font-mono text-xs",
									children: ["http://", HOSTNAME]
								})]
							}),
							box.tailscaleUp && box.tailscaleIp ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex justify-between gap-3",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
									className: "text-muted",
									children: "Tailscale"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
									className: "font-mono text-xs",
									children: box.tailscaleIp
								})]
							}) : null,
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex justify-between gap-3",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
									className: "text-muted",
									children: "Jellyfin"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
									className: "truncate font-mono text-xs",
									children: jf || ":8096"
								})]
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "mt-2.5 text-xs text-faint",
						children: [
							"Play uses Jellyfin. On this LAN the official app is ",
							jf || "http://<lan>:8096",
							" — Tailscale is not required. Source, quality, and library live under This house."
						]
					})
				]
			})]
		})
	});
}
function DisksPanel() {
	const [disks, setDisks] = (0, import_react.useState)([]);
	const [msg, setMsg] = (0, import_react.useState)("");
	(0, import_react.useEffect)(() => {
		fetch("/api/disks", { cache: "no-store" }).then((r) => r.json()).then((j) => setDisks(j.disks || []));
	}, []);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "mt-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-sm text-muted",
				children: "Extra disks. Will not mount over /srv/media."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
				className: "mt-2 space-y-2",
				children: disks.map((d) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
					className: "flex items-center justify-between gap-3 text-sm",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
						"/dev/",
						d.name,
						" · ",
						d.size,
						" ",
						d.os ? "(OS)" : "",
						d.mount ? ` · ${d.mount}` : ""
					] }), !d.os ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						size: "sm",
						variant: "ghost",
						onClick: () => {
							fetch("/api/storage", {
								method: "POST",
								headers: { "Content-Type": "application/json" },
								body: JSON.stringify({ disk: d.name })
							}).then((r) => r.json()).then((j) => {
								setMsg(j.ok ? `Mounted at ${j.dest}` : j.error || "Mount failed");
							});
						},
						children: "Use this disk"
					}) : null]
				}, d.name))
			}),
			msg ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-2 text-xs text-muted",
				children: msg
			}) : null
		]
	});
}
function PwaRow() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "rounded-2xl bg-card px-5 py-3 shadow-[var(--shadow-border)]",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "font-display text-sm font-medium",
			children: "Add to Home Screen"
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "mt-0.5 text-xs text-muted",
			children: "Browser menu → Add to Home Screen. Already a PWA — not an APK."
		})]
	});
}
function HardwareDetectedCard() {
	const [summary, setSummary] = (0, import_react.useState)("");
	const [probed, setProbed] = (0, import_react.useState)(false);
	const [rows, setRows] = (0, import_react.useState)([]);
	(0, import_react.useEffect)(() => {
		fetch("/api/hardware", { cache: "no-store" }).then((r) => r.json()).then((j) => {
			const didProbe = Boolean(j.probed);
			setProbed(didProbe);
			setSummary(j.summary || "");
			if (!didProbe) {
				setRows([]);
				return;
			}
			const type = j.diskTypeLabel || (j.diskKind === "rotational" ? "spinning disk" : j.diskKind === "ssd" ? "SSD" : "disk");
			setRows([
				j.product || "",
				j.ramGb ? `RAM · ${j.ramGb} Gi visible` : "",
				type ? `Disk type · ${type}` : "",
				j.diskSizeGb ? `Disk size · ${Math.round(j.diskSizeGb)} GB` : "",
				j.diskFreeGb ? `Free space · ${j.diskFreeGb} Gi` : "",
				j.cpus || j.cpuModel ? `CPU · ${[j.cpus ? `${j.cpus} cores` : "", j.cpuModel].filter(Boolean).join(" · ")}` : "",
				j.rootOnUsb ? "Root · USB" : "Root · internal disk"
			].filter(Boolean));
		}).catch(() => {});
	}, []);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "rounded-2xl bg-card px-5 py-4 shadow-[var(--shadow-border)]",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex items-start gap-3",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Cpu, { className: "mt-0.5 size-5 text-muted" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "font-display font-medium",
					children: "This is what I detected"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-1 text-sm text-foreground",
					children: probed ? summary || "Measured on this box." : "Not measured yet — ReelOS will probe on the next update or door start."
				}),
				probed && rows.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
					className: "mt-2 space-y-0.5 text-sm text-muted",
					children: rows.map((row) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: row }, row))
				}) : null,
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-1 text-sm text-muted",
					children: probed ? "Cheap read of RAM, CPU, disk type, disk size, USB-root, and kdump — not a speed test. 4GB is RAM, not the HDD. Drive knobs follow this profile. Re-probes on install, OTA, or disk change; skips if unchanged." : "A 4.5Gi RAM guess is used until the probe runs. This is not a speed test."
				})
			] })]
		})
	});
}
function PerformanceRow() {
	const [low, setLow] = (0, import_react.useState)(true);
	const [busy, setBusy] = (0, import_react.useState)(false);
	(0, import_react.useEffect)(() => {
		fetch("/api/performance", { cache: "no-store" }).then((r) => r.json()).then((j) => setLow(j.low !== false)).catch(() => {});
	}, []);
	const toggle = async () => {
		setBusy(true);
		const next = !low;
		try {
			const j = await (await fetch("/api/performance", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ low: next })
			})).json();
			setLow(j.low !== false);
		} catch {}
		setBusy(false);
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex items-center justify-between gap-4 rounded-2xl bg-card px-5 py-4 shadow-[var(--shadow-border)]",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex items-start gap-3",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Cpu, { className: "mt-0.5 size-5 text-muted" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "font-display font-medium",
				children: "Low performance mode"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-1 text-sm text-muted",
				children: "Caps transcode to one thread when a GPU (/dev/dri) is present. No GPU: Jellyfin DirectPlay/DirectStream only — no CPU ffmpeg transcode. Scene previews and subtitle extraction stay off so Jellyfin does not read TorBox dumps. A box with ≤4.5Gi RAM stays in this mode even if the toggle is off."
			})] })]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
			variant: low ? "gold" : "ghost",
			onClick: () => void toggle(),
			disabled: busy,
			children: [busy ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "size-4 animate-spin" }) : null, low ? "On" : "Off"]
		})]
	});
}
function PasswordRow({ open, onClick }) {
	const [current, setCurrent] = (0, import_react.useState)("");
	const [next, setNext] = (0, import_react.useState)("");
	const [msg, setMsg] = (0, import_react.useState)("");
	const change = async () => {
		setMsg("");
		const j = await (await fetch("/api/password", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				current,
				next
			})
		})).json();
		setMsg(j.ok ? "PIN updated." : j.error || "Could not change PIN");
		if (j.ok) {
			setCurrent("");
			setNext("");
		}
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Row, {
		icon: KeyRound,
		title: "Box PIN",
		hint: "Not reelos/reelos",
		open,
		onClick,
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-sm text-muted",
				children: "Changes the wizard PIN and the Jellyfin user when that engine is up."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
				className: "mt-3 h-11 w-full rounded-xl bg-raised px-3 text-sm",
				type: "password",
				placeholder: "Current PIN",
				value: current,
				onChange: (e) => setCurrent(e.target.value)
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
				className: "mt-2 h-11 w-full rounded-xl bg-raised px-3 text-sm",
				type: "password",
				placeholder: "New PIN",
				value: next,
				onChange: (e) => setNext(e.target.value)
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
				className: "mt-3",
				onClick: () => void change(),
				children: "Change PIN"
			}),
			msg ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-2 text-sm text-muted",
				children: msg
			}) : null
		]
	});
}
function LibraryPanel() {
	const answers = useReelStore((s) => s.answers);
	const patchIntent = useReelStore((s) => s.patchIntent);
	const booksOn = useReelStore((s) => s.settings.betaChannel);
	const [booksKey, setBooksKey] = (0, import_react.useState)("");
	const [booksKeySaved, setBooksKeySaved] = (0, import_react.useState)("");
	(0, import_react.useEffect)(() => {
		if (!booksOn) return;
		fetch("/api/settings", { cache: "no-store" }).then((r) => r.json()).then((j) => setBooksKey(j.googleBooksApiKey || "")).catch(() => {});
	}, [booksOn]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "text-sm text-muted",
			children: "Collections installed from your wizard answers."
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "mt-3 flex flex-wrap gap-2",
			children: [
				["movies", "Movies"],
				["tv", "TV"],
				["anime", "Anime"],
				["kids", "Kids"],
				["music", "Music"]
			].map(([k, label]) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				onClick: () => {
					const next = { [k]: !answers.intent[k] };
					patchIntent(next);
					fetch("/api/intent", {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({ intent: {
							...answers.intent,
							...next
						} })
					});
				},
				className: cn("h-9 rounded-full px-4 text-sm", answers.intent[k] ? "bg-gold text-gold-fg" : "bg-card-2 text-muted"),
				children: label
			}, k))
		}),
		booksOn ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mt-4",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-sm font-medium",
					children: "Google Books API key"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-1 text-xs text-muted",
					children: "Optional. Metadata, previews, and buy links — not a novel fetcher. A key cannot download Hunger Games onto this box. Licensed titles are buy / borrow / sideload."
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
					className: "mt-2 flex gap-2",
					onSubmit: (e) => {
						e.preventDefault();
						persistUi({ googleBooksApiKey: booksKey.trim() });
						setBooksKeySaved(booksKey.trim() ? "saved" : "cleared");
					},
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						type: "password",
						autoComplete: "off",
						value: booksKey,
						onChange: (e) => setBooksKey(e.target.value),
						placeholder: "AIza… (optional)",
						className: "h-10 min-w-0 flex-1 rounded-xl bg-card-2 px-3 font-mono text-sm"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						size: "sm",
						type: "submit",
						children: "Save"
					})]
				}),
				booksKeySaved ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "mt-1 text-xs text-muted",
					children: [
						"Key ",
						booksKeySaved,
						"."
					]
				}) : null
			]
		}) : null,
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DisksPanel, {})
	] });
}
function QualityPanel() {
	const answers = useReelStore((s) => s.answers);
	const patchAnswers = useReelStore((s) => s.patchAnswers);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
		className: "text-sm text-muted",
		children: "New requests use this floor. Hybrid grabs 1080 and 4K and keeps both — it does not replace the 1080."
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "mt-3 flex flex-wrap gap-2",
		children: [
			"1080p",
			"hybrid",
			"4k"
		].map((q) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
			type: "button",
			onClick: () => {
				patchAnswers({ quality: q });
				fetch("/api/quality", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ quality: q })
				});
			},
			className: cn("h-9 rounded-full px-4 text-sm", answers.quality === q ? "bg-gold text-gold-fg" : "bg-card-2 text-muted"),
			children: qualityLabel[q]
		}, q))
	})] });
}
function UsersPanel() {
	const users = useReelStore((s) => s.users);
	const settings = useReelStore((s) => s.settings);
	const patchSettings = useReelStore((s) => s.patchSettings);
	const addUser = useReelStore((s) => s.addUser);
	const removeUser = useReelStore((s) => s.removeUser);
	const [name, setName] = (0, import_react.useState)("");
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
			className: "space-y-2",
			children: users.map((u) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
				className: "flex items-center justify-between text-sm",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
					u.name,
					" ",
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-faint",
						children: u.role === "admin" ? "admin" : "member"
					})
				] }), u.role !== "admin" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					className: "text-xs text-danger",
					onClick: () => removeUser(u.id),
					children: "Remove"
				}) : null]
			}, u.id))
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
			className: "mt-3 flex gap-2",
			onSubmit: (e) => {
				e.preventDefault();
				addUser(name);
				setName("");
			},
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
				value: name,
				onChange: (e) => setName(e.target.value),
				placeholder: "Invite name",
				className: "h-10 flex-1 rounded-xl bg-card-2 px-3 text-sm"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
				size: "sm",
				type: "submit",
				children: "Add"
			})]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
			className: "mt-4 flex items-center justify-between text-sm",
			children: ["Auto-approve requests", /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Toggle, {
				on: settings.autoApprove,
				onChange: (v) => {
					patchSettings({ autoApprove: v });
					persistUi({ autoApprove: v });
				}
			})]
		})
	] });
}
function AccessPanel({ lan }) {
	const answers = useReelStore((s) => s.answers);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
		className: "font-mono text-sm",
		children: [HOSTNAME, /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "ml-3 text-muted",
			children: lan || "no LAN yet"
		})]
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
		className: "mt-2 text-sm text-muted",
		children: ["Watching: ", frontendLabel[answers.frontend]]
	})] });
}
function NotesPanel() {
	const settings = useReelStore((s) => s.settings);
	const patchSettings = useReelStore((s) => s.patchSettings);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
		className: "flex items-center justify-between text-sm",
		children: ["When a title becomes available", /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Toggle, {
			on: settings.notifyAvailable,
			onChange: (v) => {
				patchSettings({ notifyAvailable: v });
				persistUi({ notifyAvailable: v });
				if (v && typeof Notification !== "undefined") Notification.requestPermission();
			}
		})]
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
		className: "mt-3 flex items-center justify-between text-sm",
		children: ["When a request fails", /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Toggle, {
			on: settings.notifyFailed,
			onChange: (v) => {
				patchSettings({ notifyFailed: v });
				persistUi({ notifyFailed: v });
				if (v && typeof Notification !== "undefined") Notification.requestPermission();
			}
		})]
	})] });
}
function SourcePanel() {
	const answers = useReelStore((s) => s.answers);
	const adapter = useReelStore((s) => s.adapter);
	const pingAdapter = useReelStore((s) => s.pingAdapter);
	const profile = adapterProfile(answers.source, answers.frontend);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
			className: "font-mono text-sm",
			children: [profile.name, /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "ml-3 text-muted",
				children: profile.api
			})]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "mt-2 text-sm text-muted",
			children: profile.blurb
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("dl", {
			className: "mt-4 grid gap-2 text-sm",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex justify-between gap-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
						className: "text-muted",
						children: "Provider"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", { children: sourceLabel[answers.source] })]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex justify-between gap-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
						className: "text-muted",
						children: "Account"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("dd", { children: [adapter.account, adapter.daysLeft ? ` · ${adapter.daysLeft}d` : ""] })]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex justify-between gap-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
						className: "text-muted",
						children: "Mount"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
						className: "font-mono text-xs",
						children: adapter.mount
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex justify-between gap-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
						className: "text-muted",
						children: "Key"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
						className: "font-mono text-xs",
						children: answers.source === "local-vpn" ? "None" : answers.apiKey ? `••••${answers.apiKey.slice(-4)}` : "Missing"
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex justify-between gap-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
						className: "text-muted",
						children: "Cache / transfer"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("dd", { children: [
						adapter.cacheHits,
						" / ",
						adapter.transfers
					] })]
				})
			]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mt-4 flex items-center gap-2",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					size: "sm",
					variant: "ghost",
					onClick: pingAdapter,
					children: "Ping"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
					to: "/engine/$id",
					params: { id: "downloads" },
					className: "text-sm text-gold",
					children: "Open adapter"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "text-xs text-faint",
					children: adapter.status === "healthy" ? `${adapter.pingMs}ms · ${adapter.lastPing ? formatWhen(adapter.lastPing) : "never"}` : "Offline"
				})
			]
		})
	] });
}
/**
* @param {string} line
* @returns {string}
*/
function noteVersion(line) {
	const m = String(line || "").match(/^(\d+(?:\.\d+)*(?:-beta\.\d+)?)\s*:/);
	return m ? m[1] : "";
}
/**
* @param {string} line
* @returns {string}
*/
function stripVersionPrefix(line) {
	return String(line || "").replace(/^\d+(?:\.\d+)*(?:-beta\.\d+)?:\s*/, "").trim();
}
/**
* Drop PR asides and parked-stamp lines so the phone stays plain English.
* @param {string} line
* @returns {string}
*/
function ownerEnglish(line) {
	let s = String(line || "").trim();
	s = s.replace(/\s*Complements\s+#\d+(?:\s*\/\s*#\d+)*\.?/gi, "");
	s = s.replace(/\s*Not 1\.2\.51[^.]*\.?/gi, "");
	s = s.replace(/\s*1\.2\.51 parked[^.]*\.?/gi, "");
	s = s.replace(/\s{2,}/g, " ").replace(/\s+\./g, ".").trim();
	return s;
}
/**
* @param {string[]} notes
* @returns {string[]}
*/
function cleaned(notes) {
	return (notes || []).map(ownerEnglish).filter((n) => stripVersionPrefix(n).length > 0);
}
/**
* @param {string[]} notes
* @param {string} version
* @returns {string[]}
*/
function notesForVersion(notes, version) {
	const want = String(version || "").trim();
	if (!want) return [];
	return cleaned((notes || []).filter((n) => noteVersion(n) === want));
}
/**
* @param {string} current
* @param {string} shipped
* @returns {string}
*/
function displayVersion(current, shipped) {
	const v = String(current || "").trim();
	if (/\d+\.\d+/.test(v)) return v;
	return String(shipped || "").trim();
}
function Changelog({ title, version, lines }) {
	if (!lines.length) return null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "mt-4",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
			className: "text-sm font-medium",
			children: [title, version ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "ml-2 font-mono text-muted",
				children: version
			}) : null]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
			className: "mt-2 space-y-1.5 text-sm text-muted",
			children: lines.map((n) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: ["· ", stripVersionPrefix(n)] }, n))
		})]
	});
}
function UpdatesRow({ open, onClick }) {
	const update = useReelStore((s) => s.update);
	const libraryCatchup = useReelStore((s) => s.libraryCatchup);
	const autoUpdate = useReelStore((s) => s.settings.autoUpdate);
	const stackImages = useReelStore((s) => s.settings.stackImages);
	const betaChannel = useReelStore((s) => s.settings.betaChannel);
	const patchSettings = useReelStore((s) => s.patchSettings);
	const checkForUpdate = useReelStore((s) => s.checkForUpdate);
	const startUpdate = useReelStore((s) => s.startUpdate);
	const installed = displayVersion(update.current, SHIPPED_VERSION);
	const thisNotes = notesForVersion(UPDATE_NOTES, installed);
	const pending = update.status === "available" ? update.notes : [];
	const hint = update.status === "applying" ? `Applying ${update.target ?? ""}` : catchupShowsBanner(libraryCatchup) ? libraryCatchup.message || "Library catching up" : update.status === "available" ? `${update.target} is ready` : update.status === "checking" ? betaChannel ? "Checking the beta channel" : "Checking the stable channel" : update.status === "current" ? `${installed} · up to date` : `${installed} · ${betaChannel ? "beta" : CHANNEL}`;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Row, {
		icon: RefreshCw,
		title: "Updates",
		hint,
		open,
		onClick,
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "font-mono text-sm",
				children: [
					"Installed ",
					installed,
					update.status === "available" && update.target ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "ml-3 text-muted",
						children: ["available ", update.target]
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "ml-3 text-muted",
						children: betaChannel ? "beta" : CHANNEL
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-2 text-sm text-muted",
				children: update.status === "applying" ? "An Apply is running — phone, CLI, or both. Full-screen splash stays until browse and request work. Do not tap Apply again." : catchupShowsBanner(libraryCatchup) ? "The update is on this box. Library catch-up is still importing dumps — folder skips and timeouts are here, not a stuck Apply. Request still works." : "Host patches from Ubuntu, ReelOS from GitHub. Stack images stay frozen unless you flip the toggle. Libraries stay put."
			}),
			catchupShowsBanner(libraryCatchup) ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "mt-2 text-sm",
				children: [libraryCatchup.message || "Library catching up", libraryCatchup.folder && libraryCatchup.total ? ` · folder ${libraryCatchup.folder} of ${libraryCatchup.total}` : null]
			}) : null,
			update.status === "error" && update.notes[0] ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-2 text-sm text-danger",
				children: update.notes[0].slice(0, 180)
			}) : null,
			update.status === "applying" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ol", {
				className: "mt-4 space-y-2",
				children: update.steps.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
					className: "flex items-start gap-2 text-sm",
					children: [s.status === "done" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, {
						className: "mt-0.5 size-3.5 text-gold",
						strokeWidth: 3
					}) : s.status === "running" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "mt-0.5 size-3.5 animate-spin text-gold" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "mt-1.5 size-1.5 rounded-full bg-faint/40" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: s.status === "pending" ? "text-faint" : "",
						children: s.label
					}), s.log ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "mt-0.5 block font-mono text-[11px] text-faint",
						children: s.log
					}) : null] })]
				}, s.id))
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Changelog, {
				title: "This install",
				version: installed,
				lines: thisNotes
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Changelog, {
				title: "This update",
				version: update.target,
				lines: pending
			})] }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-4 flex flex-wrap gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
					variant: "ghost",
					size: "sm",
					onClick: checkForUpdate,
					disabled: update.status === "checking" || update.status === "applying",
					children: [update.status === "checking" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "size-4 animate-spin" }) : null, "Check"]
				}), update.status === "available" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					size: "sm",
					onClick: startUpdate,
					children: update.rollback ? `Roll back to ${update.target}` : `Apply ${update.target}`
				}) : null]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
				className: "mt-4 flex items-center justify-between text-sm",
				children: ["Check the stable channel daily", /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Toggle, {
					on: autoUpdate,
					onChange: (v) => {
						patchSettings({ autoUpdate: v });
						persistUi({ autoUpdate: v });
					}
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
				className: "mt-3 flex items-center justify-between text-sm",
				children: ["Also pull Jellyfin / engine images", /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Toggle, {
					on: stackImages,
					onChange: (v) => {
						patchSettings({ stackImages: v });
						persistUi({ stackImages: v });
					}
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
				className: "mt-3 flex items-center justify-between text-sm",
				children: ["Beta channel", /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Toggle, {
					on: betaChannel,
					onChange: (v) => {
						patchSettings({ betaChannel: v });
						persistUi({ betaChannel: v });
					}
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-2 text-xs text-muted",
				children: "Off by default. On this sidecar tarball, Beta turns on Arena chrome and Books in place — no second Apply. Off rolls those back (Kavita stops, Books routes 404) without wiping movies/TV. Check still reads channel-beta when on. Do not house Apply this PR. Stable Check stays 1.2.50.x on main.tar.gz."
			}),
			update.rollback && update.status === "available" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "mt-2 text-xs text-muted",
				children: [
					"Roll back returns this box to ",
					update.target,
					". Libraries stay. Arena chrome and Books leave when Beta is off."
				]
			}) : null
		]
	});
}
function LogsRow({ open, onClick }) {
	const [busy, setBusy] = (0, import_react.useState)(false);
	const [msg, setMsg] = (0, import_react.useState)("");
	const [text, setText] = (0, import_react.useState)("");
	const [token, setToken] = (0, import_react.useState)("");
	const [ghSet, setGhSet] = (0, import_react.useState)(false);
	const loaded = (0, import_react.useRef)(false);
	const grab = async () => {
		const j = await (await fetch("/api/logs", {
			cache: "no-store",
			signal: AbortSignal.timeout(45e3)
		})).json();
		if (!j.text) throw new Error(j.error || "No logs");
		return j.text;
	};
	const load = async () => {
		setBusy(true);
		setMsg("Collecting…");
		try {
			const t = await grab();
			setText(t);
			loaded.current = true;
			setMsg(`${t.split("\n").length} lines`);
			const g = await fetch("/api/bugs/github", { cache: "no-store" }).then((r) => r.json());
			setGhSet(Boolean(g.set));
		} catch (e) {
			setMsg(e instanceof Error ? e.message : "Collect failed");
		}
		setBusy(false);
	};
	(0, import_react.useEffect)(() => {
		if (open && !loaded.current && !busy) load();
	}, [open]);
	const copy = async () => {
		setBusy(true);
		try {
			const t = text || await grab();
			if (!text) setText(t);
			await navigator.clipboard.writeText(t);
			setMsg("Copied. Paste that here.");
		} catch (e) {
			setMsg(e instanceof Error ? e.message : "Copy failed");
		}
		setBusy(false);
	};
	const download = async () => {
		setBusy(true);
		try {
			const t = text || await grab();
			if (!text) setText(t);
			const a = document.createElement("a");
			a.href = URL.createObjectURL(new Blob([t], { type: "text/plain" }));
			a.download = "reelos-house.txt";
			a.click();
			setMsg("Downloaded reelos-house.txt");
		} catch (e) {
			setMsg(e instanceof Error ? e.message : "Download failed");
		}
		setBusy(false);
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Row, {
		icon: ScrollText,
		title: "Logs",
		hint: msg || "Last hour on this box",
		open,
		onClick,
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-sm text-muted",
				children: "On-screen dump from this machine. Keys stripped. Copy and paste here — not a screenshot."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-3 flex flex-wrap gap-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
						size: "sm",
						onClick: () => void load(),
						disabled: busy,
						children: [busy ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "size-4 animate-spin" }) : null, "Refresh"]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						size: "sm",
						variant: "ghost",
						onClick: () => void copy(),
						disabled: busy,
						children: "Copy"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						size: "sm",
						variant: "ghost",
						onClick: () => void download(),
						disabled: busy,
						children: "Download"
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-4 text-sm text-muted",
				children: "GitHub token so failed Applies open an issue on ajt1995/reelos. Stays on this box. Not in the ISO."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-2 flex flex-wrap gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
					type: "password",
					autoComplete: "off",
					placeholder: ghSet ? "Token saved — paste to replace" : "ghp_… issues write",
					value: token,
					onChange: (e) => setToken(e.target.value),
					className: "min-w-[12rem] flex-1 rounded-xl bg-raised px-3 py-2 text-sm"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					size: "sm",
					onClick: () => {
						fetch("/api/bugs/github", {
							method: "POST",
							headers: { "Content-Type": "application/json" },
							body: JSON.stringify({ token })
						}).then((r) => r.json()).then((j) => {
							setGhSet(Boolean(j.set));
							setToken("");
							setMsg(j.set ? "GitHub reports on" : "GitHub reports off");
						});
					},
					children: "Save"
				})]
			}),
			text ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("pre", {
				className: "mt-3 max-h-80 overflow-auto whitespace-pre-wrap break-all rounded-xl bg-raised p-3 font-mono text-[11px] leading-4 text-muted",
				children: text
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-3 text-sm text-faint",
				children: busy ? "Collecting from the box…" : "Open this row to load."
			})
		]
	});
}
/** Phone Settings Fix cards. Ids must match scripts/reelos-repair.mjs. */
var REPAIR_GROUPS = [
	{
		id: "library",
		title: "When the library looks wrong"
	},
	{
		id: "requests",
		title: "When a request sits"
	},
	{
		id: "fuse",
		title: "When files vanished"
	}
];
var REPAIRS = [
	{
		id: "posters",
		group: "library",
		title: "One poster per movie",
		blurb: "Park extra 4K copies, keep 1080 next to 4K, merge Jellyfin Movies so Interstellar is not two posters."
	},
	{
		id: "hybrid1080",
		group: "library",
		title: "Grab a 1080 next to 4K",
		blurb: "If a movie only has 4K, search for a 1080 and keep both. Does nothing when you already have both."
	},
	{
		id: "import",
		group: "library",
		title: "Import what’s already downloaded",
		blurb: "Scan TorBox dumps into Radarr/Sonarr, collapse leftover folders, then heal Jellyfin. Never writes to /media."
	},
	{
		id: "downloads",
		group: "requests",
		title: "Unstick grabs",
		blurb: "Clear stuck 0% queue rows, remount FUSE if it is disconnected, search movies that never got a file."
	},
	{
		id: "indexers",
		group: "requests",
		title: "Fix search indexers",
		blurb: "Add public movie/TV indexers and push them to Radarr/Sonarr so a request can actually search."
	},
	{
		id: "wire",
		group: "requests",
		title: "Rewire engines",
		blurb: "Lock Decypharr as the download client, widen 1080+4K, restore recycled 1080s, fix Jellyfin libraries."
	},
	{
		id: "fuse",
		group: "fuse",
		title: "Remount debrid files",
		blurb: "When the library path says Socket not connected after Decypharr remounted."
	}
];
function FixSection() {
	const [busy, setBusy] = (0, import_react.useState)(null);
	const [msg, setMsg] = (0, import_react.useState)({});
	const run = async (id) => {
		setBusy(id);
		setMsg((m) => ({
			...m,
			[id]: ""
		}));
		try {
			const r = await fetch("/api/repair", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ action: id }),
				signal: AbortSignal.timeout(15e3)
			});
			const j = await r.json();
			setMsg((m) => ({
				...m,
				[id]: r.status === 409 ? j.error || "Wait — a repair or update is already running." : j.ok ? j.finished ? "Finished. Check Movies / Requests." : "Started. Give it a minute, then check Movies / Requests." : j.error || "Repair failed"
			}));
		} catch (e) {
			setMsg((m) => ({
				...m,
				[id]: e instanceof Error ? e.message : "Repair failed"
			}));
		}
		setBusy(null);
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "mt-8",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
				className: "font-display text-lg font-medium",
				children: "Fix"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-1 max-w-xl text-sm text-muted",
				children: "Named scripts for when Movies doubles up, a request sits, or files vanish. Each one says what it does. Never writes to /media."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-3 grid gap-2.5",
				children: [REPAIR_GROUPS.map((g) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "rounded-2xl bg-card px-5 py-4 shadow-[var(--shadow-border)]",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-xs font-medium uppercase tracking-wide text-faint",
						children: g.title
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
						className: "mt-3 divide-y divide-border",
						children: REPAIRS.filter((r) => r.group === g.id).map((r) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
							className: "flex items-start gap-3 py-3 first:pt-0 last:pb-0",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Wrench, { className: "mt-0.5 size-4 shrink-0 text-gold" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "min-w-0 flex-1",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-start gap-3",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
											className: "min-w-0 flex-1 font-display font-medium",
											children: r.title
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
											size: "sm",
											disabled: busy !== null,
											"aria-label": `Run ${r.title}`,
											onClick: () => void run(r.id),
											children: [busy === r.id ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "size-4 animate-spin" }) : null, busy === r.id ? "Starting…" : "Run"]
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "mt-1 text-sm text-muted",
										children: r.blurb
									}),
									msg[r.id] ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "mt-1.5 text-sm text-gold",
										children: msg[r.id]
									}) : null
								]
							})]
						}, r.id))
					})]
				}, g.id)), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CheckHops, {})]
			})
		]
	});
}
function CheckHops() {
	const [live, setLive] = (0, import_react.useState)(null);
	const [busy, setBusy] = (0, import_react.useState)(false);
	const [err, setErr] = (0, import_react.useState)("");
	const load = () => {
		setBusy(true);
		setErr("");
		fetch("/api/doctor", {
			cache: "no-store",
			signal: AbortSignal.timeout(45e3)
		}).then((r) => r.json()).then((r) => {
			if (r.live && r.checks?.length) setLive(r.checks);
			else setErr(r.error || "Doctor returned no checks");
		}).catch((e) => setErr(String(e).slice(0, 120))).finally(() => setBusy(false));
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "rounded-2xl bg-card px-5 py-4 shadow-[var(--shadow-border)]",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "font-display font-medium",
				children: "Check hops"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-1 text-sm text-muted",
				children: "Read-only. Does not guess green. Run doctor for FUSE, Jellyfin, Radarr, indexers. Changes nothing."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-3",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
						variant: "ghost",
						size: "sm",
						onClick: () => load(),
						disabled: busy,
						children: [busy ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "size-4 animate-spin" }) : null, busy ? "Running…" : live ? "Run again" : "Run doctor"]
					}),
					err ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-2 text-sm text-gold",
						children: err
					}) : null,
					!live && !err && !busy ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-2 text-sm text-muted",
						children: "Not checked yet."
					}) : null
				]
			}),
			live?.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
				className: "mt-4 space-y-3",
				children: live.map((c) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
					className: "flex items-start gap-3 text-sm",
					children: [c.ok ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "mt-1 size-2 rounded-full bg-success" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, { className: "mt-0.5 size-4 text-gold" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "block",
						children: c.label
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-muted",
						children: c.detail
					})] })]
				}, c.label))
			}) : null
		]
	});
}
function CuratorResetRow() {
	const [count, setCount] = (0, import_react.useState)(0);
	const [busy, setBusy] = (0, import_react.useState)(false);
	const [msg, setMsg] = (0, import_react.useState)("");
	(0, import_react.useEffect)(() => {
		fetch("/api/curator", { cache: "no-store" }).then((r) => r.json()).then((j) => setCount(Number(j.count) || 0)).catch(() => {});
	}, []);
	const run = async () => {
		setBusy(true);
		setMsg("");
		try {
			const j = await (await fetch("/api/curator/reset", { method: "POST" })).json();
			if (!j.ok && j.ok !== void 0) {
				setMsg(j.error || "Reset refused");
				setBusy(false);
				return;
			}
			setCount(Number(j.count) || 0);
			setMsg("Discover Not interested list cleared. Library on this box is unchanged.");
		} catch (e) {
			setMsg(String(e));
		}
		setBusy(false);
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "rounded-2xl bg-card px-5 py-4 shadow-[var(--shadow-border)]",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex items-start gap-3",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ThumbsDown, { className: "mt-0.5 size-4 text-faint" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "min-w-0 flex-1",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "font-display font-medium",
						children: "Reset curator preferences"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "mt-1 text-sm text-muted",
						children: ["Clears Not interested titles on Discover. Titles on this box stay on Home. No Google account.", count ? ` ${count} hidden.` : ""]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						className: "mt-3",
						variant: "ghost",
						size: "sm",
						disabled: busy,
						onClick: () => void run(),
						children: busy ? "Resetting…" : "Reset curator preferences"
					}),
					msg ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-2 text-sm text-muted",
						children: msg
					}) : null
				]
			})]
		})
	});
}
function FactoryResetRow() {
	const [open, setOpen] = (0, import_react.useState)(false);
	const [busy, setBusy] = (0, import_react.useState)(false);
	const [msg, setMsg] = (0, import_react.useState)("");
	const run = async () => {
		setBusy(true);
		setMsg("");
		try {
			const j = await (await fetch("/api/reset", { method: "POST" })).json();
			if (!j.ok) {
				setMsg(j.error || "Reset refused");
				setBusy(false);
				return;
			}
			useReelStore.getState().factoryReset();
			setMsg("Resetting. Wizard, then Connect.");
			window.setTimeout(() => window.location.reload(), 4e3);
		} catch (e) {
			setMsg(String(e));
			setBusy(false);
		}
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "rounded-2xl bg-card px-5 py-4 shadow-[var(--shadow-border)]",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "font-display font-medium",
				children: "Factory reset"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-1 text-sm text-muted",
				children: "First-run again. Keeps media on disk. Wipes wizard answers and engine configs. Will not run during an update."
			}),
			!open ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
				className: "mt-3",
				variant: "danger",
				size: "sm",
				onClick: () => setOpen(true),
				children: "Factory reset"
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-3 flex flex-wrap gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					variant: "danger",
					size: "sm",
					disabled: busy,
					onClick: () => void run(),
					children: busy ? "Resetting…" : "Yes, reset"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					variant: "ghost",
					size: "sm",
					disabled: busy,
					onClick: () => setOpen(false),
					children: "Cancel"
				})]
			}),
			msg ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-2 text-sm text-muted",
				children: msg
			}) : null
		]
	});
}
function SettingsView() {
	const [lan, setLan] = (0, import_react.useState)("");
	const [advanced, setAdvanced] = (0, import_react.useState)(false);
	(0, import_react.useEffect)(() => {
		fetch("/api/box", { cache: "no-store" }).then((r) => r.json()).then((b) => setLan(b.ipv4 || "")).catch(() => {});
	}, []);
	const answers = useReelStore((s) => s.answers);
	const users = useReelStore((s) => s.users);
	const settings = useReelStore((s) => s.settings);
	const adapter = useReelStore((s) => s.adapter);
	const hideAdvanced = settings.hideAdvanced;
	const [panel, setPanel] = (0, import_react.useState)(null);
	const profile = adapterProfile(answers.source, answers.frontend);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "px-5 py-6 md:px-10 md:py-8",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "font-display text-3xl font-semibold tracking-tight",
				children: "Settings"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-1.5 max-w-xl text-sm text-muted",
				children: "House identity, daily knobs, and updates. The box heals itself — you should not need Heal."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(HouseCard, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Section, {
				title: "This house",
				hint: "Library, quality, who can request, how you reach the box.",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
						to: "/connect",
						className: "flex items-center justify-between rounded-2xl bg-card px-5 py-4 shadow-[var(--shadow-border)]",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "font-display font-medium",
							children: "Connect"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-1 text-sm text-muted",
							children: "TV, phone, away from home, indexers."
						})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronRight, { className: "size-4 text-faint" })]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Row, {
						icon: HardDrive,
						title: "Library",
						hint: `${storageLabel[answers.storageMode]} · ${answers.selectedDisks.join(", ") || "no extra disks"}`,
						open: panel === "library",
						onClick: () => setPanel(panel === "library" ? null : "library"),
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LibraryPanel, {})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Row, {
						icon: KeyRound,
						title: "Source",
						hint: `${sourceLabel[answers.source]} · ${adapter.status === "healthy" ? profile.name : "offline"}`,
						open: panel === "source",
						onClick: () => setPanel(panel === "source" ? null : "source"),
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SourcePanel, {})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Row, {
						icon: SlidersHorizontal,
						title: "Quality",
						hint: qualityLabel[answers.quality],
						open: panel === "quality",
						onClick: () => setPanel(panel === "quality" ? null : "quality"),
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(QualityPanel, {})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Row, {
						icon: Users,
						title: "Users",
						hint: `${users.length} in this house`,
						open: panel === "users",
						onClick: () => setPanel(panel === "users" ? null : "users"),
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(UsersPanel, {})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Row, {
						icon: Shield,
						title: "Access",
						hint: accessLabel[answers.access],
						open: panel === "access",
						onClick: () => setPanel(panel === "access" ? null : "access"),
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AccessPanel, { lan })
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PasswordRow, {
						open: panel === "pin",
						onClick: () => setPanel(panel === "pin" ? null : "pin")
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Row, {
						icon: Bell,
						title: "Notifications",
						hint: settings.notifyAvailable ? "Available + failed" : "Off",
						open: panel === "notes",
						onClick: () => setPanel(panel === "notes" ? null : "notes"),
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(NotesPanel, {})
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Section, {
				title: "Box",
				hint: "Updates, changelog, performance, logs. Apply still lives here.",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(HardwareDetectedCard, {}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(UpdatesRow, {
						open: panel === "updates",
						onClick: () => setPanel(panel === "updates" ? null : "updates")
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PerformanceRow, {}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PwaRow, {}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CuratorResetRow, {}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LogsRow, {
						open: panel === "logs",
						onClick: () => setPanel(panel === "logs" ? null : "logs")
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Section, {
				title: "Advanced",
				hint: "Heal, hops, doctor, and nerd tools. Daily use does not need these.",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					type: "button",
					className: "flex items-center justify-between rounded-2xl bg-card px-5 py-4 text-left shadow-[var(--shadow-border)]",
					onClick: () => setAdvanced((v) => !v),
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "font-display font-medium",
						children: advanced ? "Hide Advanced" : "Show Advanced"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1 text-sm text-muted",
						children: "Named Fix scripts, hops, a shell, engines, factory reset. The box already self-heals in the background."
					})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronRight, { className: `size-4 text-faint transition-transform ${advanced ? "rotate-90" : ""}` })]
				}), advanced ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FixSection, {}),
					hideAdvanced ? null : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
						to: "/settings/advanced",
						className: "flex items-center justify-between rounded-2xl bg-card px-5 py-4 shadow-[var(--shadow-border)]",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "font-display font-medium",
							children: "Advanced apps"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-1 text-sm text-muted",
							children: "Radarr, Sonarr, Jellyfin by their house names. Daily use does not need these."
						})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronRight, { className: "size-4 text-faint" })]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TerminalRow, {
						open: panel === "term",
						onClick: () => setPanel(panel === "term" ? null : "term")
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "rounded-2xl bg-card px-5 py-4 shadow-[var(--shadow-border)]",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "font-display font-medium",
								children: "Repair wizard"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-1 text-sm text-muted",
								children: "Walk the setup questions again (source, disks, quality). Does not Apply an update and does not delete /media."
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								className: "mt-3",
								variant: "ghost",
								size: "sm",
								onClick: () => useReelStore.getState().startRepair(),
								children: "Start wizard"
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FactoryResetRow, {})
				] }) : null]
			})
		]
	});
}
function Page() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Gate, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SettingsView, {}) });
}
//#endregion
export { Page as component };
