import { i as __toESM } from "../_runtime.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { S as require_jsx_runtime, b as useNavigate } from "../_libs/@tanstack/react-router+[...].mjs";
import { At as CircleCheck, C as Sparkles, L as RefreshCw, T as Smartphone, at as Laptop, k as Shield, m as Tv, nt as LoaderCircle, st as KeyRound } from "../_libs/lucide-react.mjs";
import { U as showToast, X as useReelStore, u as Button } from "./router-M-yvs45k.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/household-gate-view--zXnfObv.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function HouseholdGateView() {
	const navigate = useNavigate();
	const [step, setStep] = (0, import_react.useState)("email");
	const [email, setEmail] = (0, import_react.useState)("");
	const [code, setCode] = (0, import_react.useState)("");
	const [busy, setBusy] = (0, import_react.useState)(false);
	const [error, setError] = (0, import_react.useState)("");
	const [timeLeft, setTimeLeft] = (0, import_react.useState)(600);
	const [debugOtp, setDebugOtp] = (0, import_react.useState)(null);
	const [platformName, setPlatformName] = (0, import_react.useState)("Personal Device");
	(0, import_react.useEffect)(() => {
		if (typeof navigator !== "undefined") {
			const ua = navigator.userAgent.toLowerCase();
			if (ua.includes("iphone")) setPlatformName("Apple iPhone");
			else if (ua.includes("ipad")) setPlatformName("Apple iPad");
			else if (ua.includes("android")) setPlatformName("Android Device");
			else if (ua.includes("macintosh") || ua.includes("mac os")) setPlatformName("Mac Computer");
			else if (ua.includes("windows")) setPlatformName("Windows PC");
			else if (ua.includes("linux")) setPlatformName("Linux Computer");
			else if (ua.includes("cros")) setPlatformName("Chromebook");
			else setPlatformName("Personal Device");
		}
	}, []);
	(0, import_react.useEffect)(() => {
		if (typeof window === "undefined") return;
		const token = new URLSearchParams(window.location.search).get("token");
		if (token) {
			setStep("verifying_token");
			verifyToken(token);
		}
	}, []);
	(0, import_react.useEffect)(() => {
		if (step !== "code" || timeLeft <= 0) return;
		const timer = setInterval(() => {
			setTimeLeft((prev) => prev > 0 ? prev - 1 : 0);
		}, 1e3);
		return () => clearInterval(timer);
	}, [step, timeLeft]);
	const verifyToken = async (tokenString) => {
		setBusy(true);
		setError("");
		try {
			const res = await fetch("/api/gate/verify-otp", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ token: tokenString })
			});
			const data = await res.json();
			if (res.ok && data.ok) {
				setStep("success");
				showToast("Device authorized successfully!", "success");
				setTimeout(() => {
					useReelStore.getState().setRemoteChallenged(false);
					if (typeof window !== "undefined") window.history.replaceState({}, document.title, "/");
					navigate({ to: "/" });
				}, 1200);
			} else {
				setError(data.error || "Magic link has expired or is invalid.");
				setStep("email");
			}
		} catch (err) {
			setError("Failed to verify magic link. Please enter your email below.");
			setStep("email");
		} finally {
			setBusy(false);
		}
	};
	const handleRequestOtp = async (e) => {
		e.preventDefault();
		const cleanEmail = email.trim();
		if (!cleanEmail || !cleanEmail.includes("@")) {
			setError("Please enter a valid email address.");
			return;
		}
		setBusy(true);
		setError("");
		try {
			const res = await fetch("/api/gate/request-otp", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email: cleanEmail })
			});
			const data = await res.json();
			if (res.ok && data.ok) {
				setStep("code");
				setTimeLeft(data.expiresInSec || 600);
				if (data.debugCode) setDebugOtp(data.debugCode);
				showToast(`Pairing code sent to ${cleanEmail}`, "info");
			} else setError(data.error || "Failed to send pairing code. Please try again.");
		} catch (err) {
			setError(String(err instanceof Error ? err.message : "Network error."));
		} finally {
			setBusy(false);
		}
	};
	const handleVerifyOtp = async (e) => {
		e.preventDefault();
		const cleanCode = code.trim();
		if (cleanCode.length !== 6) {
			setError("Please enter the complete 6-digit code.");
			return;
		}
		setBusy(true);
		setError("");
		try {
			const res = await fetch("/api/gate/verify-otp", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					email: email.trim(),
					code: cleanCode
				})
			});
			const data = await res.json();
			if (res.ok && data.ok) {
				setStep("success");
				showToast("Device paired for 1 year!", "success");
				setTimeout(() => {
					useReelStore.getState().setRemoteChallenged(false);
					window.location.href = "/";
				}, 1200);
			} else setError(data.error || "Incorrect verification code. Please check and try again.");
		} catch (err) {
			setError(String(err instanceof Error ? err.message : "Verification error."));
		} finally {
			setBusy(false);
		}
	};
	const formatTimer = (seconds) => {
		const mins = Math.floor(seconds / 60);
		const secs = seconds % 60;
		return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-2xl p-4",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "w-full max-w-md rounded-3xl border border-gold/25 bg-card/90 p-6 md:p-8 shadow-[0_16px_50px_rgba(0,0,0,0.6)] backdrop-blur-xl",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center justify-between mb-6",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-2.5",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "flex size-10 items-center justify-center rounded-2xl bg-gold/15 text-gold border border-gold/30",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Shield, { className: "size-5" })
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "font-display text-xl font-bold tracking-tight text-foreground",
								children: "ReelOS"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "rounded-full bg-gold/15 px-2.5 py-0.5 text-[10px] font-semibold text-gold border border-gold/25",
								children: "Household Gate"
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-xs text-muted",
							children: "Secure Family Access"
						})] })]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-1.5 text-xs text-faint bg-muted/20 px-2.5 py-1 rounded-full border border-border/40",
						children: [platformName.includes("iPhone") || platformName.includes("Android") ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Smartphone, { className: "size-3.5 text-gold" }) : platformName.includes("TV") ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Tv, { className: "size-3.5 text-gold" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Laptop, { className: "size-3.5 text-gold" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: platformName })]
					})]
				}),
				step === "verifying_token" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "py-12 text-center",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "size-10 animate-spin text-gold mx-auto mb-4" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							className: "text-lg font-semibold text-foreground",
							children: "Authorizing Device…"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-sm text-muted mt-1",
							children: "Verifying your secure sign-in link…"
						})
					]
				}),
				step === "success" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "py-8 text-center",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-success/20 text-success border border-success/30",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleCheck, { className: "size-8" })
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							className: "text-xl font-semibold text-foreground",
							children: "Device Authorized!"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-sm text-muted mt-1",
							children: "Welcome home. Opening your library…"
						})
					]
				}),
				step === "email" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mb-5",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							className: "text-lg font-semibold text-foreground",
							children: "Enter Household Email"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-xs text-muted mt-1",
							children: "Enter your family email address to receive a one-time pairing code or magic link."
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
						onSubmit: handleRequestOtp,
						className: "space-y-4",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								type: "email",
								autoFocus: true,
								required: true,
								value: email,
								onChange: (e) => setEmail(e.target.value),
								placeholder: "family@home.local",
								disabled: busy,
								className: "w-full px-4 py-2.5 rounded-xl border border-border bg-card/80 text-foreground placeholder:text-muted/50 focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold text-sm font-medium"
							}) }),
							error && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "rounded-xl border border-danger/30 bg-danger/10 p-3 text-xs text-danger",
								children: error
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								type: "submit",
								disabled: busy || !email.trim(),
								className: "w-full bg-gold text-gold-fg font-semibold py-2.5 rounded-xl hover:bg-gold-bright transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-gold/10",
								children: busy ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "size-4 animate-spin" }), "Sending Code…"] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(KeyRound, { className: "size-4" }), "Send Pairing Code"] })
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mt-6 pt-5 border-t border-border/40 text-center",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-[11px] text-faint",
							children: "Once verified, this device remains connected for 1 year across cellular and Wi-Fi networks."
						})
					})
				] }),
				step === "code" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mb-5",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center justify-between",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
								className: "text-lg font-semibold text-foreground",
								children: "Enter 6-Digit Code"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "font-mono text-xs text-gold bg-gold/10 px-2 py-0.5 rounded-md border border-gold/20",
								children: formatTimer(timeLeft)
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "text-xs text-muted mt-1",
							children: [
								"Sent to ",
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "font-medium text-foreground",
									children: email
								}),
								". Check your inbox or spam folder."
							]
						})]
					}),
					null,
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
						onSubmit: handleVerifyOtp,
						className: "space-y-4",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								type: "text",
								inputMode: "numeric",
								pattern: "[0-9]*",
								autoComplete: "one-time-code",
								maxLength: 6,
								autoFocus: true,
								required: true,
								value: code,
								onChange: (e) => setCode(e.target.value.replace(/\D/g, "")),
								placeholder: "123456",
								disabled: busy,
								className: "w-full text-center tracking-[0.5em] font-mono font-bold text-2xl py-3 rounded-xl border border-border bg-card/80 text-foreground placeholder:text-muted/40 focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold"
							}) }),
							error && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "rounded-xl border border-danger/30 bg-danger/10 p-3 text-xs text-danger",
								children: error
							}),
							timeLeft <= 0 && !error && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "rounded-xl border border-gold/30 bg-gold/10 p-2.5 text-center text-xs text-gold",
								children: "⏱️ This 6-digit code has expired. Tap 'Resend code' below to receive a new one."
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								type: "submit",
								disabled: busy || code.length !== 6 || timeLeft <= 0,
								className: "w-full bg-gold text-gold-fg font-semibold py-2.5 rounded-xl hover:bg-gold-bright transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-gold/10",
								children: busy ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "size-4 animate-spin" }), "Verifying…"] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sparkles, { className: "size-4" }), "Authorize This Device"] })
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-5 flex items-center justify-between text-xs text-muted pt-4 border-t border-border/40",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: () => {
								setStep("email");
								setError("");
							},
							className: "hover:text-gold transition-colors cursor-pointer",
							children: "Use different email"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							disabled: busy || timeLeft > 540,
							onClick: handleRequestOtp,
							className: "flex items-center gap-1 hover:text-gold disabled:opacity-40 transition-colors cursor-pointer",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RefreshCw, { className: "size-3" }), timeLeft > 540 ? `Resend in ${timeLeft - 540}s` : "Resend code"]
						})]
					})
				] })
			]
		})
	});
}
//#endregion
export { HouseholdGateView as t };
