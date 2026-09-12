import { i as __toESM } from "../_runtime.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { S as require_jsx_runtime } from "../_libs/@tanstack/react-router+[...].mjs";
import { g as LoaderCircle, k as ChevronRight, o as SquareTerminal } from "../_libs/lucide-react.mjs";
import { l as cn, n as Button } from "./gate-BwjeEJFD.mjs";
//#region ../../workspace/node_modules/.nitro/vite/services/ssr/assets/settings-terminal-w4yNi6q8.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function Section({ title, hint, children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "mt-8",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
				className: "font-display text-lg font-medium",
				children: title
			}),
			hint ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-1 max-w-xl text-sm text-muted",
				children: hint
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-3 grid gap-2.5",
				children
			})
		]
	});
}
function persistUi(p) {
	fetch("/api/settings", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(p)
	});
}
function Row({ icon: Icon, title, hint, open, onClick, children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "rounded-2xl bg-card shadow-[var(--shadow-border)]",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
			type: "button",
			onClick,
			className: "flex w-full items-center gap-4 px-5 py-4 text-left",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { className: "size-5 text-gold" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
					className: "flex-1",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "block font-display font-medium",
						children: title
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "mt-0.5 block text-sm text-muted",
						children: hint
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronRight, { className: cn("size-4 text-faint transition-transform", open && "rotate-90") })
			]
		}), open ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "border-t border-border px-5 py-4",
			children
		}) : null]
	});
}
function Toggle({ on, onChange }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
		type: "button",
		role: "switch",
		"aria-checked": on,
		onClick: () => onChange(!on),
		className: cn("relative h-6 w-11 rounded-full transition-colors", on ? "bg-gold" : "bg-card-2"),
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: cn("absolute top-0.5 size-5 rounded-full bg-foreground transition-transform", on ? "translate-x-5" : "translate-x-0.5") })
	});
}
function TerminalRow({ open, onClick }) {
	const [cmd, setCmd] = (0, import_react.useState)("");
	const [out, setOut] = (0, import_react.useState)("");
	const [running, setRunning] = (0, import_react.useState)(false);
	const [cwd, setCwd] = (0, import_react.useState)("/home/reelos");
	const pre = (0, import_react.useRef)(null);
	(0, import_react.useEffect)(() => {
		if (pre.current) pre.current.scrollTop = pre.current.scrollHeight;
	}, [out]);
	(0, import_react.useEffect)(() => {
		if (!running) return;
		let stop = false;
		const tick = async () => {
			while (!stop) {
				const r = await fetch("/api/terminal", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({})
				}).then((x) => x.json());
				if (stop) return;
				setOut(r.output || "");
				setRunning(Boolean(r.running));
				if (r.cwd) setCwd(r.cwd);
				if (!r.running) return;
				await new Promise((res) => setTimeout(res, 700));
			}
		};
		tick();
		return () => {
			stop = true;
		};
	}, [running]);
	const run = async () => {
		const command = cmd.trim();
		if (!command || running) return;
		setRunning(true);
		const r = await fetch("/api/terminal", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ command })
		}).then((x) => x.json());
		setOut(r.output || "");
		setRunning(Boolean(r.running));
		if (r.cwd) setCwd(r.cwd);
	};
	const kill = async () => {
		const r = await fetch("/api/terminal", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ kill: true })
		}).then((x) => x.json());
		setOut(r.output || "");
		setRunning(Boolean(r.running));
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Row, {
		icon: SquareTerminal,
		title: "Terminal",
		hint: running ? "Running on this box" : "Paste a command · runs here",
		open,
		onClick,
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-sm text-muted",
				children: "This is the box. Paste from your phone. You are already root — skip sudo."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-1 font-mono text-[11px] text-faint",
				children: cwd
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", {
				value: cmd,
				onChange: (e) => setCmd(e.target.value),
				onKeyDown: (e) => {
					if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
						e.preventDefault();
						run();
					}
				},
				spellCheck: false,
				placeholder: "curl -fsSL …\nbash /tmp/reelos-update.sh apply",
				className: "mt-3 min-h-[96px] w-full resize-y rounded-xl bg-[#07080a] px-3 py-2.5 font-mono text-[12px] leading-relaxed text-[#d4e0c8] shadow-[inset_0_0_0_1px_rgb(255_255_255/0.06)]"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-3 flex flex-wrap gap-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
						size: "sm",
						onClick: () => void run(),
						disabled: !cmd.trim() || running,
						children: [running ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "size-4 animate-spin" }) : null, "Run"]
					}),
					running ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						size: "sm",
						variant: "danger",
						onClick: () => void kill(),
						children: "Stop"
					}) : null,
					out ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						size: "sm",
						variant: "ghost",
						onClick: () => setOut(""),
						children: "Clear"
					}) : null
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("pre", {
				ref: pre,
				className: "mt-3 max-h-72 overflow-auto whitespace-pre-wrap break-all rounded-xl bg-[#07080a] px-3 py-2.5 font-mono text-[11px] leading-relaxed text-[#9ccc7c]",
				children: out || "output lands here"
			})
		]
	});
}
//#endregion
export { persistUi as a, Toggle as i, Section as n, TerminalRow as r, Row as t };
