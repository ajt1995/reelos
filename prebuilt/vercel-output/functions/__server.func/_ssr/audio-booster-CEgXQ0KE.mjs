//#region node_modules/.nitro/vite/services/ssr/assets/audio-booster-CEgXQ0KE.js
var elementAudio = /* @__PURE__ */ new WeakMap();
function isRunning(ctx) {
	return ctx.state === "running";
}
function bypass(graph) {
	if (graph.route === "off") return;
	graph.source.connect(graph.ctx.destination);
	if (graph.route) graph.source.disconnect(graph.bass);
	graph.route = "off";
}
function applyPreset(graph, preset) {
	if (graph.route === null) bypass(graph);
	const { ctx, compressor, voice, bass, gain } = graph;
	const night = preset === "nightMode";
	const leveling = preset === "volumeLeveling";
	const now = ctx.currentTime;
	compressor.threshold.setValueAtTime(night ? -30 : leveling ? -20 : -24, now);
	compressor.knee.setValueAtTime(night ? 30 : leveling ? 18 : 10, now);
	compressor.ratio.setValueAtTime(night ? 12 : leveling ? 3 : 4.5, now);
	compressor.attack.setValueAtTime(night ? .003 : .005, now);
	compressor.release.setValueAtTime(.25, now);
	voice.gain.setValueAtTime(leveling ? 0 : night ? 5 : 4.5, now);
	bass.gain.setValueAtTime(leveling ? 0 : night ? -10 : -3, now);
	gain.gain.setValueAtTime(leveling ? 1 : night ? 1.2 : 1.3, now);
	if (graph.route === "off") {
		graph.source.connect(bass);
		graph.source.disconnect(ctx.destination);
	}
	graph.route = preset;
}
function attachAudioBooster(videoEl) {
	const AudioCtx = typeof window === "undefined" ? void 0 : window.AudioContext || window.webkitAudioContext;
	const supported = typeof AudioCtx === "function";
	const owner = Symbol("audio-controller");
	let destroyed = false;
	const listeners = /* @__PURE__ */ new Set();
	const state = elementAudio.get(videoEl) ?? {
		owner,
		request: 0,
		wanted: "off",
		preset: "off",
		error: null
	};
	state.owner = owner;
	if (state.cleanup !== void 0) {
		clearTimeout(state.cleanup);
		state.cleanup = void 0;
	}
	state.notify?.();
	state.notify = notify;
	state.request += 1;
	state.wanted = "off";
	state.preset = "off";
	state.error = state.disposed ? "This video element was released. Open the video again to restore audio." : null;
	elementAudio.set(videoEl, state);
	function restoreOriginal() {
		state.preset = "off";
		if (state.graph && !state.disposed) bypass(state.graph);
	}
	try {
		restoreOriginal();
	} catch {
		state.error = "Original audio could not be restored.";
	}
	async function initialize() {
		if (state.graph || !AudioCtx) return;
		const ctx = new AudioCtx();
		try {
			if (ctx.state !== "running") await ctx.resume();
			if (ctx.state !== "running") throw new Error("Audio processing could not start.");
			if (state.wanted === "off") {
				await ctx.close();
				return;
			}
			const compressor = ctx.createDynamicsCompressor();
			const voice = ctx.createBiquadFilter();
			const bass = ctx.createBiquadFilter();
			const gain = ctx.createGain();
			voice.type = "peaking";
			voice.frequency.value = 2500;
			voice.Q.value = 1.2;
			bass.type = "lowshelf";
			bass.frequency.value = 120;
			bass.connect(voice);
			voice.connect(compressor);
			compressor.connect(gain);
			gain.connect(ctx.destination);
			const source = ctx.createMediaElementSource(videoEl);
			const onStateChange = () => state.notify?.();
			state.graph = {
				ctx,
				source,
				compressor,
				voice,
				bass,
				gain,
				route: null,
				onStateChange
			};
			ctx.addEventListener("statechange", onStateChange);
			bypass(state.graph);
		} catch (error) {
			if (!state.graph) await ctx.close().catch(() => {});
			throw error;
		}
	}
	function getStatus() {
		const inactive = destroyed || state.owner !== owner;
		const stopped = state.graph && state.graph.ctx.state !== "running";
		const error = state.error ?? (stopped ? "Audio processing is paused. Select the audio mode again to retry." : null);
		return {
			supported,
			preset: inactive || error ? "off" : state.preset,
			state: inactive ? "destroyed" : !supported ? "unsupported" : error ? "error" : "ready",
			error: inactive ? null : error
		};
	}
	function notify() {
		const status = getStatus();
		for (const callback of listeners) try {
			callback(status);
		} catch {}
	}
	return {
		supported,
		getStatus,
		getPreset: () => getStatus().preset,
		subscribe(callback) {
			if (destroyed || state.owner !== owner) {
				callback(getStatus());
				return () => {};
			}
			listeners.add(callback);
			callback(getStatus());
			return () => {
				listeners.delete(callback);
			};
		},
		async setPreset(preset) {
			if (destroyed || state.owner !== owner) return false;
			if (state.disposed) return false;
			const request = ++state.request;
			state.wanted = preset;
			if (!supported) return preset === "off";
			try {
				if (preset === "off") restoreOriginal();
				if (preset !== "off" && !state.graph) {
					state.pending ??= initialize().finally(() => {
						state.pending = void 0;
					});
					await state.pending;
				}
				if (destroyed || state.owner !== owner || request !== state.request) return false;
				const graph = state.graph;
				if (graph && !isRunning(graph.ctx)) {
					await graph.ctx.resume();
					if (!isRunning(graph.ctx)) throw new Error("Audio processing could not start.");
				}
				if (destroyed || state.owner !== owner || request !== state.request) return false;
				if (preset !== "off") {
					if (!graph) return false;
					applyPreset(graph, preset);
				}
				state.preset = preset;
				state.error = null;
				notify();
				return true;
			} catch {
				if (destroyed || state.owner !== owner || request !== state.request) return false;
				state.error = "This audio mode could not start. Original audio is selected; try again.";
				try {
					restoreOriginal();
				} catch {
					state.error = "Audio processing failed and original audio could not be restored.";
				}
				notify();
				return false;
			}
		},
		destroy() {
			if (destroyed) return;
			destroyed = true;
			if (state.owner !== owner) {
				notify();
				listeners.clear();
				return;
			}
			state.request += 1;
			state.wanted = "off";
			try {
				restoreOriginal();
			} catch {
				state.error = "Original audio could not be restored.";
			}
			notify();
			listeners.clear();
			state.notify = void 0;
			state.cleanup = setTimeout(() => {
				state.cleanup = void 0;
				if (state.owner !== owner || !destroyed || videoEl.isConnected !== false) return;
				const graph = state.graph;
				if (!graph || state.disposed) return;
				state.disposed = true;
				graph.ctx.removeEventListener("statechange", graph.onStateChange);
				for (const node of [
					graph.source,
					graph.bass,
					graph.voice,
					graph.compressor,
					graph.gain
				]) try {
					node.disconnect();
				} catch {}
				graph.ctx.close().catch(() => {});
			}, 0);
		}
	};
}
//#endregion
export { attachAudioBooster as t };
