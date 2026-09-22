import { i as __toESM } from "../_runtime.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { S as require_jsx_runtime, b as useNavigate, d as useRouterState, v as Link, y as Navigate } from "../_libs/@tanstack/react-router+[...].mjs";
import { $ as Lock, A as Send, At as ChevronRight, B as Play, Bt as BookOpen, D as Shield, Dt as CircleHelp, Et as Clapperboard, Ft as Captions, Ht as ArrowRight, J as Minimize, L as QrCode, M as RotateCw, Mt as ChevronDown, N as RotateCcw, Nt as Check, Ot as CircleCheck, P as Rewind, S as Sparkles, V as Pause, Z as Maximize, _t as ExternalLink, a as VolumeX, at as KeyRound, bt as Copy, ct as House, d as Usb, et as LoaderCircle, gt as FastForward, ht as Film, it as Key, jt as ChevronLeft, k as Settings, l as User, lt as Heart, m as Tv, mt as Flame, n as X, nt as Library, o as Volume2, ot as Info, q as MonitorPlay, rt as Laptop, s as Users, t as Zap, w as Smartphone, xt as Compass, yt as Crown, z as Plus } from "../_libs/lucide-react.mjs";
import { D as dismissToast, E as cn, N as inFlightRequests, T as catchupShowsBanner, U as showToast, X as useReelStore, Y as updateLocksUi, Z as useToasts, q as transferringChipCount, u as Button, w as catchupLocksHome } from "./router-2BoRtkQZ.mjs";
import { t as HouseholdGateView } from "./household-gate-view-B8KZ6euq.mjs";
import { n as useExperienceStore } from "./experience-state-BipBJc8l.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/gate-ejkd3pT8.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function ReelMark({ className, spinRing = false }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", {
		viewBox: "0 0 64 64",
		fill: "none",
		"aria-hidden": "true",
		className: cn("text-gold", className),
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", {
				cx: "32",
				cy: "32",
				r: "29",
				stroke: "currentColor",
				strokeOpacity: "0.22",
				strokeWidth: "1.25"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", {
				cx: "32",
				cy: "32",
				r: "25.5",
				stroke: "#3EC6D8",
				strokeOpacity: "0.55",
				strokeWidth: "1.4",
				strokeDasharray: "18 80",
				strokeDashoffset: "8",
				className: spinRing ? "reel-spin-ring" : void 0
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", {
				cx: "32",
				cy: "32",
				r: "23.5",
				stroke: "currentColor",
				strokeWidth: "3.2"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", {
				cx: "32",
				cy: "32",
				r: "11.2",
				stroke: "currentColor",
				strokeWidth: "2.4"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", {
				d: "M30.4 7.2h3.2v14.6h-3.2zM30.4 42.2h3.2v14.6h-3.2zM7.2 30.4h14.6v3.2H7.2zM42.2 30.4h14.6v3.2H42.2z",
				fill: "currentColor"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", {
				d: "M28.2 24.4 42.4 32 28.2 39.6Z",
				fill: "currentColor"
			})
		]
	});
}
function Wordmark({ className, markClassName, spinRing = false }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
		className: cn("inline-flex items-center gap-2.5", className),
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ReelMark, {
			className: cn("size-8", markClassName),
			spinRing
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "font-display text-[1.35rem] font-semibold tracking-[0.18em] text-gold",
			children: "ReelOS"
		})]
	});
}
var QrCodeEcc = class QrCodeEcc {
	static LOW = new QrCodeEcc(0, 1);
	static MEDIUM = new QrCodeEcc(1, 0);
	static QUARTILE = new QrCodeEcc(2, 3);
	static HIGH = new QrCodeEcc(3, 2);
	ordinal;
	formatBits;
	constructor(ordinal, formatBits) {
		this.ordinal = ordinal;
		this.formatBits = formatBits;
	}
};
var QrSegmentMode = class QrSegmentMode {
	static NUMERIC = new QrSegmentMode(1, [
		10,
		12,
		14
	]);
	static ALPHANUMERIC = new QrSegmentMode(2, [
		9,
		11,
		13
	]);
	static BYTE = new QrSegmentMode(4, [
		8,
		16,
		16
	]);
	static KANJI = new QrSegmentMode(8, [
		8,
		10,
		12
	]);
	static ECI = new QrSegmentMode(7, [
		0,
		0,
		0
	]);
	modeBits;
	numBitsCharCount;
	constructor(modeBits, numBitsCharCount) {
		this.modeBits = modeBits;
		this.numBitsCharCount = numBitsCharCount;
	}
	numCharCountBits(ver) {
		return this.numBitsCharCount[Math.floor((ver + 7) / 17)];
	}
};
var QrCode$1 = class QrCode$1 {
	static Ecc = QrCodeEcc;
	static encodeText(text, ecl) {
		const segs = qrcodegen.QrSegment.makeSegments(text);
		return QrCode$1.encodeSegments(segs, ecl);
	}
	static encodeBinary(data, ecl) {
		const seg = qrcodegen.QrSegment.makeBytes(data);
		return QrCode$1.encodeSegments([seg], ecl);
	}
	static encodeSegments(segs, ecl, minVersion = 1, maxVersion = 40, mask = -1, boostEcl = true) {
		if (!(QrCode$1.MIN_VERSION <= minVersion && minVersion <= maxVersion && maxVersion <= QrCode$1.MAX_VERSION) || mask < -1 || mask > 7) throw new RangeError("Invalid value");
		let version;
		let dataUsedBits;
		for (version = minVersion;; version++) {
			const dataCapacityBits = QrCode$1.getNumDataCodewords(version, ecl) * 8;
			const usedBits = QrSegment.getTotalBits(segs, version);
			if (usedBits <= dataCapacityBits) {
				dataUsedBits = usedBits;
				break;
			}
			if (version >= maxVersion) throw new RangeError("Data too long");
		}
		for (const newEcl of [
			QrCodeEcc.MEDIUM,
			QrCodeEcc.QUARTILE,
			QrCodeEcc.HIGH
		]) if (boostEcl && dataUsedBits <= QrCode$1.getNumDataCodewords(version, newEcl) * 8) ecl = newEcl;
		let bb = [];
		for (const seg of segs) {
			appendBits(seg.mode.modeBits, 4, bb);
			appendBits(seg.numChars, seg.mode.numCharCountBits(version), bb);
			for (const b of seg.getData()) bb.push(b);
		}
		assert(bb.length == dataUsedBits);
		const dataCapacityBits = QrCode$1.getNumDataCodewords(version, ecl) * 8;
		assert(bb.length <= dataCapacityBits);
		appendBits(0, Math.min(4, dataCapacityBits - bb.length), bb);
		appendBits(0, (8 - bb.length % 8) % 8, bb);
		assert(bb.length % 8 == 0);
		for (let padByte = 236; bb.length < dataCapacityBits; padByte ^= 253) appendBits(padByte, 8, bb);
		let dataCodewords = [];
		while (dataCodewords.length * 8 < bb.length) dataCodewords.push(0);
		bb.forEach((b, i) => dataCodewords[i >>> 3] |= b << 7 - (i & 7));
		return new QrCode$1(version, ecl, dataCodewords, mask);
	}
	size;
	mask;
	modules = [];
	isFunction = [];
	version;
	errorCorrectionLevel;
	constructor(version, errorCorrectionLevel, dataCodewords, msk) {
		this.version = version;
		this.errorCorrectionLevel = errorCorrectionLevel;
		if (version < QrCode$1.MIN_VERSION || version > QrCode$1.MAX_VERSION) throw new RangeError("Version value out of range");
		if (msk < -1 || msk > 7) throw new RangeError("Mask value out of range");
		this.size = version * 4 + 17;
		let row = [];
		for (let i = 0; i < this.size; i++) row.push(false);
		for (let i = 0; i < this.size; i++) {
			this.modules.push(row.slice());
			this.isFunction.push(row.slice());
		}
		this.drawFunctionPatterns();
		const allCodewords = this.addEccAndInterleave(dataCodewords);
		this.drawCodewords(allCodewords);
		if (msk == -1) {
			let minPenalty = 1e9;
			for (let i = 0; i < 8; i++) {
				this.applyMask(i);
				this.drawFormatBits(i);
				const penalty = this.getPenaltyScore();
				if (penalty < minPenalty) {
					msk = i;
					minPenalty = penalty;
				}
				this.applyMask(i);
			}
		}
		assert(0 <= msk && msk <= 7);
		this.mask = msk;
		this.applyMask(msk);
		this.drawFormatBits(msk);
		this.isFunction = [];
	}
	getModule(x, y) {
		return 0 <= x && x < this.size && 0 <= y && y < this.size && this.modules[y][x];
	}
	drawFunctionPatterns() {
		for (let i = 0; i < this.size; i++) {
			this.setFunctionModule(6, i, i % 2 == 0);
			this.setFunctionModule(i, 6, i % 2 == 0);
		}
		this.drawFinderPattern(3, 3);
		this.drawFinderPattern(this.size - 4, 3);
		this.drawFinderPattern(3, this.size - 4);
		const alignPatPos = this.getAlignmentPatternPositions();
		const numAlign = alignPatPos.length;
		for (let i = 0; i < numAlign; i++) for (let j = 0; j < numAlign; j++) if (!(i == 0 && j == 0 || i == 0 && j == numAlign - 1 || i == numAlign - 1 && j == 0)) this.drawAlignmentPattern(alignPatPos[i], alignPatPos[j]);
		this.drawFormatBits(0);
		this.drawVersion();
	}
	drawFormatBits(mask) {
		const data = this.errorCorrectionLevel.formatBits << 3 | mask;
		let rem = data;
		for (let i = 0; i < 10; i++) rem = rem << 1 ^ (rem >>> 9) * 1335;
		const bits = (data << 10 | rem) ^ 21522;
		assert(bits >>> 15 == 0);
		for (let i = 0; i <= 5; i++) this.setFunctionModule(8, i, getBit(bits, i));
		this.setFunctionModule(8, 7, getBit(bits, 6));
		this.setFunctionModule(8, 8, getBit(bits, 7));
		this.setFunctionModule(7, 8, getBit(bits, 8));
		for (let i = 9; i < 15; i++) this.setFunctionModule(14 - i, 8, getBit(bits, i));
		for (let i = 0; i < 8; i++) this.setFunctionModule(this.size - 1 - i, 8, getBit(bits, i));
		for (let i = 8; i < 15; i++) this.setFunctionModule(8, this.size - 15 + i, getBit(bits, i));
		this.setFunctionModule(8, this.size - 8, true);
	}
	drawVersion() {
		if (this.version < 7) return;
		let rem = this.version;
		for (let i = 0; i < 12; i++) rem = rem << 1 ^ (rem >>> 11) * 7973;
		const bits = this.version << 12 | rem;
		assert(bits >>> 18 == 0);
		for (let i = 0; i < 18; i++) {
			const color = getBit(bits, i);
			const a = this.size - 11 + i % 3;
			const b = Math.floor(i / 3);
			this.setFunctionModule(a, b, color);
			this.setFunctionModule(b, a, color);
		}
	}
	drawFinderPattern(x, y) {
		for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
			const dist = Math.max(Math.abs(dx), Math.abs(dy));
			const xx = x + dx;
			const yy = y + dy;
			if (0 <= xx && xx < this.size && 0 <= yy && yy < this.size) this.setFunctionModule(xx, yy, dist != 2 && dist != 4);
		}
	}
	drawAlignmentPattern(x, y) {
		for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) this.setFunctionModule(x + dx, y + dy, Math.max(Math.abs(dx), Math.abs(dy)) != 1);
	}
	setFunctionModule(x, y, isDark) {
		this.modules[y][x] = isDark;
		this.isFunction[y][x] = true;
	}
	addEccAndInterleave(data) {
		const ver = this.version;
		const ecl = this.errorCorrectionLevel;
		if (data.length != QrCode$1.getNumDataCodewords(ver, ecl)) throw new RangeError("Invalid argument");
		const numBlocks = QrCode$1.NUM_ERROR_CORRECTION_BLOCKS[ecl.ordinal][ver];
		const blockEccLen = QrCode$1.ECC_CODEWORDS_PER_BLOCK[ecl.ordinal][ver];
		const rawCodewords = Math.floor(QrCode$1.getNumRawDataModules(ver) / 8);
		const numShortBlocks = numBlocks - rawCodewords % numBlocks;
		const shortBlockLen = Math.floor(rawCodewords / numBlocks);
		let blocks = [];
		const rsDiv = QrCode$1.reedSolomonComputeDivisor(blockEccLen);
		for (let i = 0, k = 0; i < numBlocks; i++) {
			let dat = data.slice(k, k + shortBlockLen - blockEccLen + (i < numShortBlocks ? 0 : 1));
			k += dat.length;
			const ecc = QrCode$1.reedSolomonComputeRemainder(dat, rsDiv);
			if (i < numShortBlocks) dat.push(0);
			blocks.push(dat.concat(ecc));
		}
		let result = [];
		for (let i = 0; i < blocks[0].length; i++) blocks.forEach((block, j) => {
			if (i != shortBlockLen - blockEccLen || j >= numShortBlocks) result.push(block[i]);
		});
		assert(result.length == rawCodewords);
		return result;
	}
	drawCodewords(data) {
		if (data.length != Math.floor(QrCode$1.getNumRawDataModules(this.version) / 8)) throw new RangeError("Invalid argument");
		let i = 0;
		for (let right = this.size - 1; right >= 1; right -= 2) {
			if (right == 6) right = 5;
			for (let vert = 0; vert < this.size; vert++) for (let j = 0; j < 2; j++) {
				const x = right - j;
				const y = (right + 1 & 2) == 0 ? this.size - 1 - vert : vert;
				if (!this.isFunction[y][x] && i < data.length * 8) {
					this.modules[y][x] = getBit(data[i >>> 3], 7 - (i & 7));
					i++;
				}
			}
		}
		assert(i == data.length * 8);
	}
	applyMask(mask) {
		if (mask < 0 || mask > 7) throw new RangeError("Mask value out of range");
		for (let y = 0; y < this.size; y++) for (let x = 0; x < this.size; x++) {
			let invert;
			switch (mask) {
				case 0:
					invert = (x + y) % 2 == 0;
					break;
				case 1:
					invert = y % 2 == 0;
					break;
				case 2:
					invert = x % 3 == 0;
					break;
				case 3:
					invert = (x + y) % 3 == 0;
					break;
				case 4:
					invert = (Math.floor(x / 3) + Math.floor(y / 2)) % 2 == 0;
					break;
				case 5:
					invert = x * y % 2 + x * y % 3 == 0;
					break;
				case 6:
					invert = (x * y % 2 + x * y % 3) % 2 == 0;
					break;
				case 7:
					invert = ((x + y) % 2 + x * y % 3) % 2 == 0;
					break;
				default: throw new Error("Unreachable");
			}
			if (!this.isFunction[y][x] && invert) this.modules[y][x] = !this.modules[y][x];
		}
	}
	getPenaltyScore() {
		let result = 0;
		for (let y = 0; y < this.size; y++) {
			let runColor = false;
			let runX = 0;
			let runHistory = [
				0,
				0,
				0,
				0,
				0,
				0,
				0
			];
			for (let x = 0; x < this.size; x++) if (this.modules[y][x] == runColor) {
				runX++;
				if (runX == 5) result += QrCode$1.PENALTY_N1;
				else if (runX > 5) result++;
			} else {
				this.finderPenaltyAddHistory(runX, runHistory);
				if (!runColor) result += this.finderPenaltyCountPatterns(runHistory) * QrCode$1.PENALTY_N3;
				runColor = this.modules[y][x];
				runX = 1;
			}
			result += this.finderPenaltyTerminateAndCount(runColor, runX, runHistory) * QrCode$1.PENALTY_N3;
		}
		for (let x = 0; x < this.size; x++) {
			let runColor = false;
			let runY = 0;
			let runHistory = [
				0,
				0,
				0,
				0,
				0,
				0,
				0
			];
			for (let y = 0; y < this.size; y++) if (this.modules[y][x] == runColor) {
				runY++;
				if (runY == 5) result += QrCode$1.PENALTY_N1;
				else if (runY > 5) result++;
			} else {
				this.finderPenaltyAddHistory(runY, runHistory);
				if (!runColor) result += this.finderPenaltyCountPatterns(runHistory) * QrCode$1.PENALTY_N3;
				runColor = this.modules[y][x];
				runY = 1;
			}
			result += this.finderPenaltyTerminateAndCount(runColor, runY, runHistory) * QrCode$1.PENALTY_N3;
		}
		for (let y = 0; y < this.size - 1; y++) for (let x = 0; x < this.size - 1; x++) {
			const color = this.modules[y][x];
			if (color == this.modules[y][x + 1] && color == this.modules[y + 1][x] && color == this.modules[y + 1][x + 1]) result += QrCode$1.PENALTY_N2;
		}
		let dark = 0;
		for (const row of this.modules) dark = row.reduce((sum, color) => sum + (color ? 1 : 0), dark);
		const total = this.size * this.size;
		const k = Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1;
		assert(0 <= k && k <= 9);
		result += k * QrCode$1.PENALTY_N4;
		assert(0 <= result && result <= 2568888);
		return result;
	}
	getAlignmentPatternPositions() {
		if (this.version == 1) return [];
		else {
			const numAlign = Math.floor(this.version / 7) + 2;
			const step = Math.floor((this.version * 8 + numAlign * 3 + 5) / (numAlign * 4 - 4)) * 2;
			let result = [6];
			for (let pos = this.size - 7; result.length < numAlign; pos -= step) result.splice(1, 0, pos);
			return result;
		}
	}
	static getNumRawDataModules(ver) {
		if (ver < QrCode$1.MIN_VERSION || ver > QrCode$1.MAX_VERSION) throw new RangeError("Version number out of range");
		let result = (16 * ver + 128) * ver + 64;
		if (ver >= 2) {
			const numAlign = Math.floor(ver / 7) + 2;
			result -= (25 * numAlign - 10) * numAlign - 55;
			if (ver >= 7) result -= 36;
		}
		assert(208 <= result && result <= 29648);
		return result;
	}
	static getNumDataCodewords(ver, ecl) {
		return Math.floor(QrCode$1.getNumRawDataModules(ver) / 8) - QrCode$1.ECC_CODEWORDS_PER_BLOCK[ecl.ordinal][ver] * QrCode$1.NUM_ERROR_CORRECTION_BLOCKS[ecl.ordinal][ver];
	}
	static reedSolomonComputeDivisor(degree) {
		if (degree < 1 || degree > 255) throw new RangeError("Degree out of range");
		let result = [];
		for (let i = 0; i < degree - 1; i++) result.push(0);
		result.push(1);
		let root = 1;
		for (let i = 0; i < degree; i++) {
			for (let j = 0; j < result.length; j++) {
				result[j] = QrCode$1.reedSolomonMultiply(result[j], root);
				if (j + 1 < result.length) result[j] ^= result[j + 1];
			}
			root = QrCode$1.reedSolomonMultiply(root, 2);
		}
		return result;
	}
	static reedSolomonComputeRemainder(data, divisor) {
		let result = divisor.map((_) => 0);
		for (const b of data) {
			const factor = b ^ result.shift();
			result.push(0);
			divisor.forEach((coef, i) => result[i] ^= QrCode$1.reedSolomonMultiply(coef, factor));
		}
		return result;
	}
	static reedSolomonMultiply(x, y) {
		if (x >>> 8 != 0 || y >>> 8 != 0) throw new RangeError("Byte out of range");
		let z = 0;
		for (let i = 7; i >= 0; i--) {
			z = z << 1 ^ (z >>> 7) * 285;
			z ^= (y >>> i & 1) * x;
		}
		assert(z >>> 8 == 0);
		return z;
	}
	finderPenaltyCountPatterns(runHistory) {
		const n = runHistory[1];
		assert(n <= this.size * 3);
		const core = n > 0 && runHistory[2] == n && runHistory[3] == n * 3 && runHistory[4] == n && runHistory[5] == n;
		return (core && runHistory[0] >= n * 4 && runHistory[6] >= n ? 1 : 0) + (core && runHistory[6] >= n * 4 && runHistory[0] >= n ? 1 : 0);
	}
	finderPenaltyTerminateAndCount(currentRunColor, currentRunLength, runHistory) {
		if (currentRunColor) {
			this.finderPenaltyAddHistory(currentRunLength, runHistory);
			currentRunLength = 0;
		}
		currentRunLength += this.size;
		this.finderPenaltyAddHistory(currentRunLength, runHistory);
		return this.finderPenaltyCountPatterns(runHistory);
	}
	finderPenaltyAddHistory(currentRunLength, runHistory) {
		if (runHistory[0] == 0) currentRunLength += this.size;
		runHistory.pop();
		runHistory.unshift(currentRunLength);
	}
	static MIN_VERSION = 1;
	static MAX_VERSION = 40;
	static PENALTY_N1 = 3;
	static PENALTY_N2 = 3;
	static PENALTY_N3 = 40;
	static PENALTY_N4 = 10;
	static ECC_CODEWORDS_PER_BLOCK = [
		[
			-1,
			7,
			10,
			15,
			20,
			26,
			18,
			20,
			24,
			30,
			18,
			20,
			24,
			26,
			30,
			22,
			24,
			28,
			30,
			28,
			28,
			28,
			28,
			30,
			30,
			26,
			28,
			30,
			30,
			30,
			30,
			30,
			30,
			30,
			30,
			30,
			30,
			30,
			30,
			30,
			30
		],
		[
			-1,
			10,
			16,
			26,
			18,
			24,
			16,
			18,
			22,
			22,
			26,
			30,
			22,
			22,
			24,
			24,
			28,
			28,
			26,
			26,
			26,
			26,
			28,
			28,
			28,
			28,
			28,
			28,
			28,
			28,
			28,
			28,
			28,
			28,
			28,
			28,
			28,
			28,
			28,
			28,
			28
		],
		[
			-1,
			13,
			22,
			18,
			26,
			18,
			24,
			18,
			22,
			20,
			24,
			28,
			26,
			24,
			20,
			30,
			24,
			28,
			28,
			26,
			30,
			28,
			30,
			30,
			30,
			30,
			28,
			30,
			30,
			30,
			30,
			30,
			30,
			30,
			30,
			30,
			30,
			30,
			30,
			30,
			30
		],
		[
			-1,
			17,
			28,
			22,
			16,
			22,
			28,
			26,
			26,
			24,
			28,
			24,
			28,
			22,
			24,
			24,
			30,
			28,
			28,
			26,
			28,
			30,
			24,
			30,
			30,
			30,
			30,
			30,
			30,
			30,
			30,
			30,
			30,
			30,
			30,
			30,
			30,
			30,
			30,
			30,
			30
		]
	];
	static NUM_ERROR_CORRECTION_BLOCKS = [
		[
			-1,
			1,
			1,
			1,
			1,
			1,
			2,
			2,
			2,
			2,
			4,
			4,
			4,
			4,
			4,
			6,
			6,
			6,
			6,
			7,
			8,
			8,
			9,
			9,
			10,
			12,
			12,
			12,
			13,
			14,
			15,
			16,
			17,
			18,
			19,
			19,
			20,
			21,
			22,
			24,
			25
		],
		[
			-1,
			1,
			1,
			1,
			2,
			2,
			4,
			4,
			4,
			5,
			5,
			5,
			8,
			9,
			9,
			10,
			10,
			11,
			13,
			14,
			16,
			17,
			17,
			18,
			20,
			21,
			23,
			25,
			26,
			28,
			29,
			31,
			33,
			35,
			37,
			38,
			40,
			43,
			45,
			47,
			49
		],
		[
			-1,
			1,
			1,
			2,
			2,
			4,
			4,
			6,
			6,
			8,
			8,
			8,
			10,
			12,
			16,
			12,
			17,
			16,
			18,
			21,
			20,
			23,
			23,
			25,
			27,
			29,
			34,
			34,
			35,
			38,
			40,
			43,
			45,
			48,
			51,
			53,
			56,
			59,
			62,
			65,
			68
		],
		[
			-1,
			1,
			1,
			2,
			4,
			4,
			4,
			5,
			6,
			8,
			8,
			11,
			11,
			16,
			16,
			18,
			16,
			19,
			21,
			25,
			25,
			25,
			34,
			30,
			32,
			35,
			37,
			40,
			42,
			45,
			48,
			51,
			54,
			57,
			60,
			63,
			66,
			70,
			74,
			77,
			81
		]
	];
};
function appendBits(val, len, bb) {
	if (len < 0 || len > 31 || val >>> len != 0) throw new RangeError("Value out of range");
	for (let i = len - 1; i >= 0; i--) bb.push(val >>> i & 1);
}
function getBit(x, i) {
	return (x >>> i & 1) != 0;
}
function assert(cond) {
	if (!cond) throw new Error("Assertion error");
}
var QrSegment = class QrSegment {
	static Mode = QrSegmentMode;
	static makeBytes(data) {
		let bb = [];
		for (const b of data) appendBits(b, 8, bb);
		return new QrSegment(QrSegmentMode.BYTE, data.length, bb);
	}
	static makeNumeric(digits) {
		if (!QrSegment.isNumeric(digits)) throw new RangeError("String contains non-numeric characters");
		let bb = [];
		for (let i = 0; i < digits.length;) {
			const n = Math.min(digits.length - i, 3);
			appendBits(parseInt(digits.substring(i, i + n), 10), n * 3 + 1, bb);
			i += n;
		}
		return new QrSegment(QrSegmentMode.NUMERIC, digits.length, bb);
	}
	static makeAlphanumeric(text) {
		if (!QrSegment.isAlphanumeric(text)) throw new RangeError("String contains unencodable characters in alphanumeric mode");
		let bb = [];
		let i = 0;
		for (; i + 2 <= text.length; i += 2) {
			let temp = QrSegment.ALPHANUMERIC_CHARSET.indexOf(text.charAt(i)) * 45;
			temp += QrSegment.ALPHANUMERIC_CHARSET.indexOf(text.charAt(i + 1));
			appendBits(temp, 11, bb);
		}
		if (i < text.length) appendBits(QrSegment.ALPHANUMERIC_CHARSET.indexOf(text.charAt(i)), 6, bb);
		return new QrSegment(QrSegmentMode.ALPHANUMERIC, text.length, bb);
	}
	static makeSegments(text) {
		if (text == "") return [];
		else if (QrSegment.isNumeric(text)) return [QrSegment.makeNumeric(text)];
		else if (QrSegment.isAlphanumeric(text)) return [QrSegment.makeAlphanumeric(text)];
		else return [QrSegment.makeBytes(QrSegment.toUtf8ByteArray(text))];
	}
	static makeEci(assignVal) {
		let bb = [];
		if (assignVal < 0) throw new RangeError("ECI assignment value out of range");
		else if (assignVal < 128) appendBits(assignVal, 8, bb);
		else if (assignVal < 16384) {
			appendBits(2, 2, bb);
			appendBits(assignVal, 14, bb);
		} else if (assignVal < 1e6) {
			appendBits(6, 3, bb);
			appendBits(assignVal, 21, bb);
		} else throw new RangeError("ECI assignment value out of range");
		return new QrSegment(QrSegmentMode.ECI, 0, bb);
	}
	static isNumeric(text) {
		return QrSegment.NUMERIC_REGEX.test(text);
	}
	static isAlphanumeric(text) {
		return QrSegment.ALPHANUMERIC_REGEX.test(text);
	}
	mode;
	numChars;
	bitData;
	constructor(mode, numChars, bitData) {
		if (numChars < 0) throw new RangeError("Invalid argument");
		this.mode = mode;
		this.numChars = numChars;
		this.bitData = bitData.slice();
	}
	getData() {
		return this.bitData.slice();
	}
	static getTotalBits(segs, version) {
		let result = 0;
		for (const seg of segs) {
			const ccbits = seg.mode.numCharCountBits(version);
			if (seg.numChars >= 1 << ccbits) return Infinity;
			result += 4 + ccbits + seg.bitData.length;
		}
		return result;
	}
	static toUtf8ByteArray(str) {
		str = encodeURI(str);
		let result = [];
		for (let i = 0; i < str.length; i++) if (str.charAt(i) != "%") result.push(str.charCodeAt(i));
		else {
			result.push(parseInt(str.substring(i + 1, i + 3), 16));
			i += 2;
		}
		return result;
	}
	static NUMERIC_REGEX = /^[0-9]*$/;
	static ALPHANUMERIC_REGEX = /^[A-Z0-9 $%*+.\/:-]*$/;
	static ALPHANUMERIC_CHARSET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:";
};
var qrcodegen = {
	QrCode: QrCode$1,
	QrSegment
};
function QrCodeSvg({ value, size = 180, level = "M", darkColor = "#000000", lightColor = "#ffffff", margin = 2, className }) {
	const qr = (0, import_react.useMemo)(() => {
		if (!value) return null;
		try {
			const ecc = {
				L: qrcodegen.QrCode.Ecc.LOW,
				M: qrcodegen.QrCode.Ecc.MEDIUM,
				Q: qrcodegen.QrCode.Ecc.QUARTILE,
				H: qrcodegen.QrCode.Ecc.HIGH
			}[level] ?? qrcodegen.QrCode.Ecc.MEDIUM;
			return qrcodegen.QrCode.encodeText(value, ecc);
		} catch {
			return null;
		}
	}, [value, level]);
	if (!qr) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className,
		style: {
			width: size,
			height: size
		},
		"aria-label": "QR Code placeholder"
	});
	const moduleCount = qr.size;
	const viewBoxSize = moduleCount + margin * 2;
	let path = "";
	for (let y = 0; y < moduleCount; y++) for (let x = 0; x < moduleCount; x++) if (qr.getModule(x, y)) {
		const mx = x + margin;
		const my = y + margin;
		path += `M${mx},${my}h1v1h-1Z `;
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", {
		xmlns: "http://www.w3.org/2000/svg",
		viewBox: `0 0 ${viewBoxSize} ${viewBoxSize}`,
		width: size,
		height: size,
		className,
		shapeRendering: "crispEdges",
		role: "img",
		"aria-label": `QR code for ${value}`,
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", {
			width: viewBoxSize,
			height: viewBoxSize,
			fill: lightColor,
			rx: margin > 0 ? 1 : 0
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", {
			d: path.trim(),
			fill: darkColor
		})]
	});
}
var empty = {
	provisioned: false,
	ipv4: "",
	watch: "",
	seerr: "",
	jellyfin: {
		state: "amber",
		detail: "Still starting"
	},
	frontend: "jellyfin",
	access: "lan",
	adminName: "",
	adminPassword: "",
	tailscaleAuth: null,
	tailscaleInstalled: false,
	tailscaleUp: false,
	tailnet: null
};
function ConnectView({ onDone }) {
	const navigate = useNavigate();
	const patchSettings = useReelStore((s) => s.patchSettings);
	const openReelOS = useReelStore((s) => s.openReelOS);
	const [box, setBox] = (0, import_react.useState)(empty);
	const [sessions, setSessions] = (0, import_react.useState)([]);
	const [away, setAway] = (0, import_react.useState)(null);
	const [deviceTab, setDeviceTab] = (0, import_react.useState)("tv");
	const [copiedUrl, setCopiedUrl] = (0, import_react.useState)(false);
	const [idxName, setIdxName] = (0, import_react.useState)("Custom source");
	const [idxUrl, setIdxUrl] = (0, import_react.useState)("");
	const [idxKey, setIdxKey] = (0, import_react.useState)("");
	const [idxMsg, setIdxMsg] = (0, import_react.useState)("");
	const [tsBusy, setTsBusy] = (0, import_react.useState)(false);
	const [tsMsg, setTsMsg] = (0, import_react.useState)("");
	const [adbIp, setAdbIp] = (0, import_react.useState)("");
	const [adbLoading, setAdbLoading] = (0, import_react.useState)(false);
	const [adbMsg, setAdbMsg] = (0, import_react.useState)("");
	const handleAdbPush = async () => {
		if (!adbIp.trim()) return;
		setAdbLoading(true);
		setAdbMsg("");
		try {
			const res = await fetch("/api/apps/android/sideload-push", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ ip: adbIp.trim() })
			});
			const data = await res.json();
			if (res.ok && data.ok && !data.simulated) setAdbMsg("✓ " + (data.message || "Installed and launched on TV!"));
			else setAdbMsg("Failed: " + (data.error || "Could not push to TV"));
		} catch (e) {
			setAdbMsg("Network error: " + String(e));
		} finally {
			setAdbLoading(false);
		}
	};
	const [qcCode, setQcCode] = (0, import_react.useState)("");
	const [qcLoading, setQcLoading] = (0, import_react.useState)(false);
	const [qcMsg, setQcMsg] = (0, import_react.useState)("");
	const [qcSuccess, setQcSuccess] = (0, import_react.useState)(false);
	const [pingingSessionId, setPingingSessionId] = (0, import_react.useState)(null);
	const [pingMsg, setPingMsg] = (0, import_react.useState)("");
	const refreshSessions = async () => {
		try {
			const c = await (await fetch("/api/cast/sessions", { cache: "no-store" })).json();
			if (c.ok && Array.isArray(c.sessions)) setSessions(c.sessions);
		} catch {}
	};
	(0, import_react.useEffect)(() => {
		let stop = false;
		const tick = async () => {
			try {
				const [boxRes, castRes] = await Promise.all([fetch("/api/box", { cache: "no-store" }), fetch("/api/cast/sessions", { cache: "no-store" })]);
				const b = await boxRes.json();
				if (!stop) setBox({
					...empty,
					...b
				});
				const c = await castRes.json();
				if (!stop && c.ok && Array.isArray(c.sessions)) setSessions(c.sessions);
			} catch {
				if (!stop) setBox((b) => ({
					...b,
					jellyfin: {
						state: "red",
						detail: "Can't start"
					}
				}));
			}
		};
		tick();
		const id = setInterval(() => void tick(), 4e3);
		return () => {
			stop = true;
			clearInterval(id);
		};
	}, []);
	const finish = (target = "/") => {
		patchSettings({ connectDone: true });
		openReelOS();
		onDone?.();
		navigate({ to: target });
	};
	const jfLock = box.jellyfin.state === "red";
	const browserOrigin = typeof window !== "undefined" ? window.location.origin : "";
	const advertisedOrigin = box.tailscaleDns ? `https://${box.tailscaleDns}` : box.tailscaleIp ? `http://${box.tailscaleIp}:8080` : box.ipv4 ? `http://${box.ipv4}:8080` : browserOrigin;
	const tvShortlink = advertisedOrigin ? `${advertisedOrigin}/tv` : "";
	const apkDownloadUrl = advertisedOrigin ? `${advertisedOrigin}/downloads/reelos-app.apk` : "";
	const watch = box.watch || (advertisedOrigin ? `${advertisedOrigin}/api/stream` : "");
	const handleCopyUrl = (urlToCopy) => {
		if (navigator.clipboard && urlToCopy) {
			navigator.clipboard.writeText(urlToCopy);
			setCopiedUrl(true);
			setTimeout(() => setCopiedUrl(false), 2e3);
		}
	};
	const handleCodeChange = (val) => {
		const raw = val.replace(/[^0-9a-zA-Z]/g, "").toUpperCase();
		if (raw.length <= 3) setQcCode(raw);
		else setQcCode(`${raw.slice(0, 3)}-${raw.slice(3, 6)}`);
	};
	const handleQuickConnect = async (e) => {
		e?.preventDefault();
		const code = qcCode.replace(/[\s-]+/g, "").trim();
		if (!code) return;
		setQcLoading(true);
		setQcMsg("");
		setQcSuccess(false);
		try {
			const data = await (await fetch("/api/quickconnect/authorize", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ code })
			})).json();
			if (data.ok) {
				setQcSuccess(true);
				setQcMsg("✓ Device authorized! Screen linking in progress...");
				setQcCode("");
				refreshSessions();
				setTimeout(() => void refreshSessions(), 1500);
				setTimeout(() => void refreshSessions(), 3500);
			} else setQcMsg(data.error || "Could not authorize Quick Connect code.");
		} catch (err) {
			setQcMsg("Network error: " + String(err));
		} finally {
			setQcLoading(false);
		}
	};
	const handleSendPing = async (sessionId, sessionName) => {
		setPingingSessionId(sessionId);
		setPingMsg("");
		try {
			const j = await (await fetch("/api/cast/message", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					sessionId,
					header: "ReelOS Linked",
					text: "Your screen is connected and ready for 4K DirectPlay!",
					timeoutMs: 5e3
				})
			})).json();
			if (j.ok) {
				setPingMsg(`✓ Ping sent to ${sessionName}! Look for the alert on your screen.`);
				setTimeout(() => setPingMsg(""), 5e3);
			} else setPingMsg(j.error || "Could not send alert to screen");
		} catch (err) {
			setPingMsg("Ping failed: " + String(err));
		} finally {
			setPingingSessionId(null);
		}
	};
	const addCustomSource = async () => {
		setIdxMsg("");
		const j = await (await fetch("/api/indexer", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				name: idxName,
				url: idxUrl,
				key: idxKey
			})
		})).json();
		setIdxMsg(j.ok ? "Added." : j.error || "Could not add");
		if (j.ok) {
			setIdxUrl("");
			setIdxKey("");
		}
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "px-5 py-8 md:px-10 max-w-4xl mx-auto space-y-6",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "font-display text-xs tracking-[0.22em] text-gold uppercase",
					children: "Connect"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
					className: "mt-2 font-display text-3xl font-bold tracking-tight text-foreground md:text-4xl",
					children: "Connect Your Devices"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-2 text-sm text-muted max-w-2xl leading-relaxed",
					children: "ReelOS is your complete cinema operating system. Watch natively in your browser, in Couch TV mode (/tv), or link third-party players like Swiftfin and Findroid via the ReelOS TV Bridge. ReelOS checks each title and device before choosing original playback or a compatible prepared copy."
				})
			] }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, { children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Dot, { state: box.jellyfin.state }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex-1",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "font-display font-medium text-foreground",
						children: "ReelOS TV Bridge"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-0.5 text-xs text-muted",
						children: box.jellyfin.detail
					})]
				}),
				watch ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("a", {
					href: watch,
					target: "_blank",
					rel: "noreferrer",
					className: "text-xs text-gold inline-flex items-center gap-1 hover:underline",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Open in Browser" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ExternalLink, { className: "size-3.5" })]
				}) : null
			] }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, {
				locked: jfLock,
				className: "border border-gold/30 bg-gold/5",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "w-full space-y-3",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-2 text-gold",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Key, { className: "size-4" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "font-display text-sm font-semibold uppercase tracking-wider",
								children: "Quick Connect (Recommended for TV)"
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-xs text-muted leading-relaxed",
							children: "Open Swiftfin, Findroid, or your TV player app, select \"Quick Connect\", and enter the 6-digit code below to link your screen instantly without typing passwords."
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
							onSubmit: handleQuickConnect,
							className: "flex flex-wrap gap-2 items-center pt-1",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "relative",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									type: "text",
									maxLength: 8,
									value: qcCode,
									onChange: (e) => handleCodeChange(e.target.value),
									placeholder: "123-456",
									className: "h-11 w-44 rounded-xl bg-card px-3 text-center font-mono text-lg font-bold tracking-widest text-foreground placeholder:text-faint shadow-[var(--shadow-border)] focus:shadow-[var(--shadow-gold)] uppercase"
								}), qcCode ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									onClick: () => setQcCode(""),
									className: "absolute right-2.5 top-3 text-muted hover:text-foreground cursor-pointer",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-4" })
								}) : null]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
								type: "submit",
								disabled: qcLoading || qcCode.replace(/[\s-]+/g, "").length < 4,
								className: "h-11 rounded-xl px-5 cursor-pointer",
								children: [qcLoading ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "size-4 animate-spin mr-1.5" }) : null, "Authorize Screen"]
							})]
						}),
						qcMsg ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: cn("text-xs font-medium pt-1", qcSuccess ? "text-success" : "text-danger"),
							children: qcMsg
						}) : null,
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "pt-2 border-t border-border/40 text-xs text-muted",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "font-semibold text-foreground",
								children: "Default Login Credentials:"
							}), " For mobile apps or direct sign-in, use username \"reelos\" and password \"reelos\"."]
						})
					]
				})
			}),
			sessions.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-3",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center justify-between",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-2 text-emerald-400",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "relative flex size-2.5",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "relative inline-flex size-2.5 rounded-full bg-emerald-500" })]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "font-display text-xs font-semibold uppercase tracking-wider",
								children: [
									"Active Screens Linked (",
									sessions.length,
									")"
								]
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-[11px] font-medium text-emerald-400/90 hidden sm:inline",
							children: "Ready for 4K DirectPlay & \"Play on TV\""
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "grid gap-2 sm:grid-cols-2",
						children: sessions.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center justify-between rounded-xl bg-card p-3 border border-border/80 shadow-sm transition-all",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center gap-2.5 min-w-0",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "flex size-8 shrink-0 items-center justify-center rounded-lg bg-gold/15 text-gold",
									children: s.client.toLowerCase().includes("tv") ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Tv, { className: "size-4" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Smartphone, { className: "size-4" })
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "min-w-0 flex-1",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "truncate text-xs font-semibold text-foreground",
										children: s.name
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
										className: "truncate text-[10px] text-muted",
										children: [s.client, s.user ? ` · ${s.user}` : ""]
									})]
								})]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
								size: "sm",
								variant: "ghost",
								disabled: pingingSessionId === s.id,
								onClick: () => void handleSendPing(s.id, s.name),
								className: "h-7 shrink-0 rounded-lg px-2 text-[11px] hover:text-gold cursor-pointer",
								title: "Send test on-screen notification",
								children: [pingingSessionId === s.id ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "size-3 animate-spin mr-1" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Send, { className: "size-3 mr-1" }), "Ping Screen"]
							})]
						}, s.id))
					}),
					pingMsg ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-xs text-emerald-400 font-medium",
						children: pingMsg
					}) : null
				]
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center justify-between rounded-xl border border-border/60 bg-card/40 px-4 py-2.5 text-xs text-muted",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "size-2 rounded-full bg-muted/60" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "No active screens linked yet" })]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "text-[11px] text-faint",
					children: "Optional: Open ReelOS TV Mode (/tv) or Swiftfin on your TV to enable \"Play on TV\""
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "rounded-2xl border border-gold/30 bg-gold/5 p-4 flex items-center justify-between",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "flex size-10 items-center justify-center rounded-xl bg-gold/15 text-gold shrink-0 border border-gold/25",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sparkles, { className: "size-5" })
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h4", {
						className: "text-sm font-semibold text-foreground",
						children: "Instant In-Browser Playback"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-xs text-muted",
						children: "Zero apps required. Stream smoothly right in your mobile, tablet, or desktop web browser."
					})] })]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "hidden sm:inline-flex rounded-full bg-gold/20 px-3 py-1 text-xs font-semibold text-gold border border-gold/30",
					children: "Built-in"
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "space-y-4",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "flex items-center justify-between border-b border-border/50 pb-2",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex flex-wrap gap-2",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
									type: "button",
									onClick: () => setDeviceTab("tv"),
									className: cn("flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-all", deviceTab === "tv" ? "bg-gold text-gold-fg shadow-sm" : "bg-card text-muted hover:text-foreground border border-border/60"),
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Tv, { className: "size-4" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Living Room TV" })]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
									type: "button",
									onClick: () => setDeviceTab("vlc"),
									className: cn("flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-all", deviceTab === "vlc" ? "bg-gold text-gold-fg shadow-sm" : "bg-card text-muted hover:text-foreground border border-border/60"),
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Play, { className: "size-4 fill-current" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "VLC (Optional 4K)" })]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
									type: "button",
									onClick: () => setDeviceTab("ios"),
									className: cn("flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-all", deviceTab === "ios" ? "bg-gold text-gold-fg shadow-sm" : "bg-card text-muted hover:text-foreground border border-border/60"),
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Smartphone, { className: "size-4" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Apple iOS (iPhone/iPad)" })]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
									type: "button",
									onClick: () => setDeviceTab("android"),
									className: cn("flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-all", deviceTab === "android" ? "bg-gold text-gold-fg shadow-sm" : "bg-card text-muted hover:text-foreground border border-border/60"),
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Smartphone, { className: "size-4" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Android" })]
								})
							]
						})
					}),
					deviceTab === "tv" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "space-y-4",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
								locked: jfLock,
								className: "flex-col gap-4 sm:flex-row items-center sm:items-start p-6 border border-gold/40 bg-gold/5",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex-1 space-y-3",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex items-center gap-2",
											children: [
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Tv, { className: "size-4 text-gold" }),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
													className: "font-display text-base font-semibold text-foreground",
													children: "Watch on the TV: ReelOS Native App for Fire TV & Google TV"
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "rounded-full bg-gold/20 border border-gold/40 px-2 py-0.5 text-[10px] font-mono text-gold font-semibold",
													children: "Compatibility checked per title"
												})
											]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
											className: "text-xs text-muted leading-relaxed",
											children: [
												"Open the ",
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "Downloader" }),
												" app on your Fire TV or Google TV and enter the shortcode below to download and install ReelOS instantly:"
											]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex flex-wrap items-center gap-2 pt-1 font-mono text-xs",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "rounded-lg bg-card-2 border border-border px-3.5 py-1.5 font-bold text-gold break-all text-sm",
												children: tvShortlink
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
												size: "sm",
												variant: "ghost",
												onClick: () => handleCopyUrl(tvShortlink),
												className: "h-8 rounded-lg border border-border bg-card/60 px-3 text-xs hover:text-gold",
												children: [copiedUrl ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: "size-3.5 text-success mr-1" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Copy, { className: "size-3.5 mr-1" }), copiedUrl ? "Copied" : "Copy URL"]
											})]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "rounded-xl border border-border bg-card-2 p-3 space-y-1.5 text-xs text-muted",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
												className: "font-semibold text-foreground flex items-center gap-1.5",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sparkles, { className: "size-3.5 text-gold" }), "Automatic Setup:"]
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
												className: "leading-relaxed",
												children: [
													"The TV app automatically discovers your ReelOS box on your home Wi-Fi. It hardware-decodes 4K HDR10 and Dolby Vision directly on the TV, with ",
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "0% CPU load" }),
													" on your appliance."
												]
											})]
										})
									]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "shrink-0 flex flex-col items-center space-y-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "rounded-2xl bg-white p-3 shadow-md border border-border/50",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(QrCodeSvg, {
											value: tvShortlink,
											size: 140
										})
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-[10px] text-muted font-mono uppercase tracking-wider",
										children: "Scan for TV Downloader"
									})]
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
								locked: jfLock,
								className: "p-6 space-y-3",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center justify-between",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex items-center gap-2",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Zap, { className: "size-4 text-gold" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h4", {
												className: "font-display text-sm font-semibold text-foreground",
												children: "1-Click Wireless Push to TV (ADB Sideload)"
											})]
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-[11px] text-muted font-mono",
											children: "Developer Mode"
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "text-xs text-muted leading-relaxed",
										children: "Push the ReelOS app directly over your home Wi-Fi to your TV without typing URLs or using a USB drive:"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "rounded-xl border border-gold/30 bg-gold/5 p-3.5 space-y-2 text-xs text-muted text-left",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
											className: "font-semibold text-foreground flex items-center gap-1.5",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Zap, { className: "size-3.5 text-gold" }), "How to enable Wireless Install on your TV:"]
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ol", {
											className: "list-decimal list-inside space-y-1 text-[11px] leading-relaxed",
											children: [
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [
													"On your TV remote, open ",
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "Settings → System / About (or Device Preferences)" }),
													"."
												] }),
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [
													"Scroll to ",
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "Build" }),
													" and click it ",
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "7 times" }),
													" until it says ",
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("em", { children: "\"You are now a developer!\"" })
												] }),
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [
													"Go to ",
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "Developer Options" }),
													" and turn ON ",
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "\"Network / Wireless Debugging\"" }),
													" (and USB Debugging)."
												] }),
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [
													"Enter your TV's IP address below and click ",
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "\"Push ReelOS to TV\"" }),
													"."
												] })
											]
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
										onSubmit: (e) => {
											e.preventDefault();
											handleAdbPush();
										},
										className: "flex flex-col sm:flex-row items-center gap-2 pt-1",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "relative flex-1 w-full",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
												type: "text",
												placeholder: "TV IP address (e.g. 192.168.1.50)",
												value: adbIp,
												onChange: (e) => setAdbIp(e.target.value),
												className: "h-10 w-full rounded-xl bg-card px-4 pr-9 text-xs font-mono border border-border shadow-[var(--shadow-border)] placeholder:text-faint"
											}), adbIp ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
												type: "button",
												onClick: () => setAdbIp(""),
												className: "absolute right-2.5 top-3 text-muted hover:text-foreground cursor-pointer",
												children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-4" })
											}) : null]
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
											size: "sm",
											type: "submit",
											disabled: adbLoading || !adbIp.trim(),
											className: "h-10 rounded-xl px-4 text-xs font-semibold w-full sm:w-auto",
											children: [adbLoading ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "size-3.5 animate-spin mr-1.5" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Send, { className: "size-3.5 mr-1.5" }), adbLoading ? "Pushing APK..." : "Push ReelOS to TV"]
										})]
									}),
									adbMsg && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: cn("text-xs font-medium pt-1", adbMsg.startsWith("✓") ? "text-success" : "text-danger"),
										children: adbMsg
									})
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
								locked: jfLock,
								className: "p-6 space-y-4",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center gap-2.5 text-gold",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sparkles, { className: "size-4" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h4", {
											className: "font-display text-sm font-semibold text-foreground",
											children: "QuickConnect TV Screen Link"
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "text-xs text-muted leading-relaxed",
										children: "When you open ReelOS on your TV, it displays a 6-digit PIN on the screen. Enter it below to link your living room screen instantly:"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
										onSubmit: handleQuickConnect,
										className: "flex flex-col sm:flex-row items-center gap-2.5",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "relative w-full sm:w-48",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
												type: "text",
												maxLength: 8,
												placeholder: "e.g. 842-190",
												value: qcCode,
												onChange: (e) => handleCodeChange(e.target.value),
												className: "h-12 w-full text-center rounded-xl bg-card font-mono text-lg font-bold tracking-widest border border-border shadow-[var(--shadow-border)] text-gold placeholder:text-faint uppercase"
											}), qcCode ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
												type: "button",
												onClick: () => setQcCode(""),
												className: "absolute right-2.5 top-3.5 text-muted hover:text-foreground cursor-pointer",
												children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-4" })
											}) : null]
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
											type: "submit",
											disabled: qcLoading || qcCode.replace(/[\s-]+/g, "").length < 4,
											className: "h-12 rounded-xl px-5 text-xs font-semibold w-full sm:w-auto cursor-pointer",
											children: [qcLoading ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "size-3.5 animate-spin mr-1.5" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleCheck, { className: "size-3.5 mr-1.5" }), "Link TV Screen"]
										})]
									}),
									qcMsg && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: cn("text-xs font-medium", qcSuccess ? "text-success" : "text-danger"),
										children: qcMsg
									})
								]
							})
						]
					}) : null,
					deviceTab === "vlc" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
						locked: jfLock,
						className: "flex-col gap-4 sm:flex-row items-center sm:items-start p-6 border border-gold/30 bg-gold/5",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex-1 space-y-3",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center gap-2 text-gold",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Play, { className: "size-4 fill-current" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
										className: "font-display text-base font-semibold text-foreground",
										children: "Instant Playback with VLC (Direct Play)"
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-xs text-muted leading-relaxed",
									children: "VLC can open many common video and audio formats on phones, tablets, TVs, and laptops. Actual format support depends on the device and the selected media."
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex flex-wrap gap-2.5 pt-1",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("a", {
											href: "https://apps.apple.com/app/vlc-media-player/id650377962",
											target: "_blank",
											rel: "noreferrer",
											className: "inline-flex items-center gap-1.5 rounded-xl bg-gold px-3.5 py-2 text-xs font-semibold text-gold-fg shadow-sm hover:opacity-90",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "VLC for iOS / Apple TV" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ExternalLink, { className: "size-3.5" })]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("a", {
											href: "https://play.google.com/store/apps/details?id=org.videolan.vlc",
											target: "_blank",
											rel: "noreferrer",
											className: "inline-flex items-center gap-1.5 rounded-xl border border-border bg-card-2 px-3.5 py-2 text-xs font-semibold text-foreground hover:bg-card",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "VLC for Android / Google TV" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ExternalLink, { className: "size-3.5" })]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("a", {
											href: "https://www.videolan.org/vlc/",
											target: "_blank",
											rel: "noreferrer",
											className: "inline-flex items-center gap-1.5 rounded-xl border border-border bg-card-2 px-3.5 py-2 text-xs font-semibold text-foreground hover:bg-card",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "VLC for Windows & Mac" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ExternalLink, { className: "size-3.5" })]
										})
									]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "rounded-xl border border-gold/20 bg-gold/10 p-3 text-xs text-foreground space-y-1",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
										className: "font-semibold text-gold flex items-center gap-1.5",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sparkles, { className: "size-3.5" }), "How to stream in ReelOS:"]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
										className: "leading-relaxed text-muted",
										children: [
											"When browsing movies in ReelOS, just tap ",
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "Watch" }),
											" and pick ",
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "\"Play in VLC\"" }),
											". The movie streams immediately with full hardware acceleration, leaving the potato box CPU at 0%."
										]
									})]
								})
							]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "shrink-0 flex flex-col items-center space-y-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "rounded-2xl bg-white p-3 shadow-md border border-border/50",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(QrCodeSvg, {
									value: "https://www.videolan.org/vlc/",
									size: 140
								})
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-[10px] text-muted font-mono uppercase tracking-wider",
								children: "Scan for VLC"
							})]
						})]
					}) : null,
					deviceTab === "ios" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
						locked: jfLock,
						className: "flex-col gap-4 sm:flex-row items-center sm:items-start p-6",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex-1 space-y-3",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center gap-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Smartphone, { className: "size-4 text-gold" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
										className: "font-display text-base font-semibold text-foreground",
										children: "Apple iPhone & iPad Setup"
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
									className: "text-xs text-muted leading-relaxed",
									children: [
										"Safari does not support playing ",
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("code", { children: ".mkv" }),
										" files directly. For seamless native DirectPlay, install ",
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "Swiftfin" }),
										" (the official open-source native iOS app) or ",
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "Infuse" }),
										":"
									]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex flex-wrap gap-2.5 pt-1",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("a", {
										href: "https://apps.apple.com/app/swiftfin/id1527040564",
										target: "_blank",
										rel: "noreferrer",
										className: "inline-flex items-center gap-1.5 rounded-xl bg-gold px-3.5 py-2 text-xs font-semibold text-gold-fg shadow-sm hover:opacity-90",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Get Swiftfin on App Store" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ExternalLink, { className: "size-3.5" })]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("a", {
										href: "https://firecore.com/infuse",
										target: "_blank",
										rel: "noreferrer",
										className: "inline-flex items-center gap-1.5 rounded-xl border border-border bg-card-2 px-3.5 py-2 text-xs font-semibold text-foreground hover:bg-card",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Get Infuse" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ExternalLink, { className: "size-3.5" })]
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "rounded-xl border border-border bg-raised p-3 text-xs text-muted space-y-1",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
										className: "font-semibold text-foreground flex items-center gap-1.5",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Zap, { className: "size-3.5 text-gold" }), "Crucial Setting for Potato Mode:"]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
										className: "leading-relaxed",
										children: [
											"In Swiftfin Settings, start with ",
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "Playback Quality → Maximum" }),
											". If the device cannot play the original format, ReelOS will report that a compatible rendition is needed."
										]
									})]
								})
							]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "shrink-0 flex flex-col items-center space-y-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "rounded-2xl bg-white p-3 shadow-md border border-border/50",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(QrCodeSvg, {
									value: "https://apps.apple.com/app/swiftfin/id1527040564",
									size: 140
								})
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-[10px] text-muted font-mono uppercase tracking-wider",
								children: "Scan for Swiftfin"
							})]
						})]
					}) : null,
					deviceTab === "android" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
						locked: jfLock,
						className: "flex-col gap-4 sm:flex-row items-center sm:items-start p-6 border border-gold/40 bg-gold/5",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex-1 space-y-3",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center gap-2",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Smartphone, { className: "size-4 text-gold" }),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
											className: "font-display text-base font-semibold text-foreground",
											children: "Native ReelOS App for Android & Foldables"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "rounded-full bg-gold/20 border border-gold/40 px-2 py-0.5 text-[10px] font-mono text-gold font-semibold",
											children: "Universal APK"
										})
									]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-xs text-muted leading-relaxed",
									children: "Use the Android client for supported original-quality playback and offline downloads. Codec and HDR support vary by device."
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex flex-wrap gap-2.5 pt-1",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("a", {
										href: apkDownloadUrl,
										download: "reelos-app.apk",
										className: "inline-flex items-center gap-1.5 rounded-xl bg-gold px-4 py-2 text-xs font-semibold text-gold-fg shadow-sm hover:opacity-90 transition-opacity",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Smartphone, { className: "size-3.5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Download ReelOS APK (v1.0.0)" })]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
										size: "sm",
										variant: "ghost",
										onClick: () => handleCopyUrl(apkDownloadUrl),
										className: "h-8 rounded-xl border border-border bg-card/60 px-3 text-xs hover:text-gold",
										children: [copiedUrl ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: "size-3.5 text-success mr-1" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Copy, { className: "size-3.5 mr-1" }), copiedUrl ? "Copied" : "Copy APK Link"]
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "rounded-xl border border-border bg-card-2 p-3 text-xs text-muted space-y-1.5",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
										className: "font-semibold text-foreground flex items-center gap-1.5",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sparkles, { className: "size-3.5 text-gold" }), "Native Mobile Superpowers:"]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1 text-[11px]",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
												className: "flex items-center gap-1.5",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: "size-3 text-success" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Hardware 10-bit HDR10/Dolby Vision" })]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
												className: "flex items-center gap-1.5",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: "size-3 text-success" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Foldable 90° Tabletop Flex Mode" })]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
												className: "flex items-center gap-1.5",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: "size-3 text-success" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "In-App Offline Trip Downloads" })]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
												className: "flex items-center gap-1.5",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: "size-3 text-success" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Couch Remote Bar for Living Room TV" })]
											})
										]
									})]
								})
							]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "shrink-0 flex flex-col items-center space-y-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "rounded-2xl bg-white p-3 shadow-md border border-border/50",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(QrCodeSvg, {
									value: apkDownloadUrl,
									size: 140
								})
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-[10px] text-muted font-mono uppercase tracking-wider",
								children: "Scan for Android APK"
							})]
						})]
					}) : null
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "rounded-2xl border border-border/60 bg-gradient-to-br from-card/80 to-card/40 p-5 shadow-lg space-y-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-2 text-gold",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Zap, { className: "size-4" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "font-display text-xs font-semibold tracking-wider uppercase",
						children: "Low-memory playback guidance"
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "text-xs text-muted leading-relaxed",
					children: [
						"On a low-memory ReelOS home, live video conversion stays off to protect playback. Try ",
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "Maximum / Original" }),
						" quality in the client. If that format is unsupported, prepare a compatible copy before watching."
					]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "rounded-2xl border border-border/70 bg-card/60 p-5 shadow-sm space-y-3",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-2 text-gold",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleCheck, { className: "size-4 text-gold" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
							className: "font-display text-xs font-semibold uppercase tracking-wider",
							children: "Potato Mode Readiness Checklist"
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-xs text-muted leading-relaxed",
						children: "ReelOS limits background work so playback and normal device use remain responsive."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "grid gap-2.5 sm:grid-cols-3 pt-1",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "rounded-xl border border-border bg-card-2 p-3 space-y-1",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center gap-1.5 text-emerald-400 text-xs font-semibold",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: "size-3.5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "1. Conversion limit" })]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-[11px] text-muted leading-tight",
									children: "Live CPU video conversion is disabled on this hardware profile."
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "rounded-xl border border-border bg-card-2 p-3 space-y-1",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: cn("flex items-center gap-1.5 text-xs font-semibold", sessions.length > 0 ? "text-emerald-400" : "text-gold"),
									children: [sessions.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: "size-3.5" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "size-3.5 animate-spin" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "2. Screen Linked" })]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-[11px] text-muted leading-tight",
									children: sessions.length > 0 ? `${sessions.length} screen(s) detected online.` : "Sign in via Quick Connect PIN above."
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "rounded-xl border border-border bg-card-2 p-3 space-y-1",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center gap-1.5 text-emerald-400 text-xs font-semibold",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: "size-3.5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "3. Quality = Maximum" })]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-[11px] text-muted leading-tight",
									children: "Set Playback Quality to Maximum in client app settings."
								})]
							})
						]
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "w-full",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "font-display font-medium",
						children: "Away from home (Stream on 5G)"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1 text-xs text-muted",
						children: "Use Tailscale so your phone can stream media anywhere without port forwarding."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-3 flex flex-wrap gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							variant: away === "house" ? "gold" : "ghost",
							onClick: () => setAway("house"),
							children: "Only this house"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							variant: away === "out" ? "gold" : "ghost",
							onClick: () => setAway("out"),
							children: "Also my phone when I'm out"
						})]
					}),
					away === "out" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mt-4 text-sm text-muted",
						children: box.tailscaleUp && box.tailscaleIp ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "text-foreground",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "font-display text-2xl tracking-tight",
									children: box.tailscaleIp
								}),
								box.tailscaleDns ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "mt-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "text-xs text-muted",
										children: "MagicDNS HTTPS Domain:"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("a", {
										href: `https://${box.tailscaleDns}`,
										target: "_blank",
										rel: "noreferrer",
										className: "font-mono text-sm text-gold underline break-all",
										children: ["https://", box.tailscaleDns]
									})]
								}) : null,
								box.tailnet ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
									className: "mt-1",
									children: [
										"Tailnet ",
										box.tailnet,
										". Survives reboot."
									]
								}) : null,
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
									className: "mt-3",
									children: [
										"Phone: Tailscale app, same account, then",
										" ",
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
											className: "text-gold font-mono",
											children: [
												"http://",
												box.tailscaleIp,
												":8080/api/stream"
											]
										})
									]
								})
							]
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "Install the Tailscale app on your phone with the same account. First, sign this box in." }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								className: "mt-3",
								disabled: tsBusy,
								onClick: () => {
									setTsBusy(true);
									setTsMsg("Getting a login link…");
									fetch("/api/tailscale/login", { method: "POST" }).then((r) => r.json()).then((j) => {
										if (j.up) setTsMsg("Already logged in.");
										else setTsMsg(j.ok ? "Open the link or scan the QR." : j.error || "Could not start login");
									}).finally(() => setTsBusy(false));
								},
								children: "Get Tailscale login"
							}),
							tsMsg ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-2",
								children: tsMsg
							}) : null,
							box.tailscaleAuth ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
									className: "mt-4 block break-all font-display text-2xl text-gold",
									href: box.tailscaleAuth,
									children: box.tailscaleAuth
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "mt-3 w-fit rounded-2xl bg-white p-3 shadow-md",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(QrCodeSvg, {
										value: box.tailscaleAuth,
										size: 200
									})
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
									className: "mt-3",
									variant: "ghost",
									disabled: tsBusy,
									onClick: async () => {
										setTsBusy(true);
										setTsMsg("Checking login state…");
										try {
											const j = await (await fetch("/api/tailscale/check", { method: "POST" })).json();
											if (j.up) {
												setTsMsg("Connected! Refreshing network status…");
												showToast("Tailscale connected successfully!", "success");
											} else {
												setTsMsg(j.error || "Not signed in yet. Please complete sign-in on Tailscale.");
												showToast(j.error || "Not signed in yet", "info");
											}
										} catch (e) {
											setTsMsg("Check failed: " + String(e));
											showToast("Tailscale check failed", "error");
										} finally {
											setTsBusy(false);
										}
									},
									children: tsBusy ? "Checking…" : "I've signed in"
								})
							] }) : box.tailscaleInstalled ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-2",
								children: "Installed. Not logged in — tap Get Tailscale login."
							}) : null
						] })
					}) : null
				]
			}) }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "w-full",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "font-display font-medium",
						children: "Custom source endpoint"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1 text-sm text-muted",
						children: "Optional advanced source lookup. Leave this empty unless your household already has a compatible endpoint and access key."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
						onSubmit: (e) => {
							e.preventDefault();
							addCustomSource();
						},
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								className: "mt-3 h-11 w-full rounded-xl bg-raised px-3 text-sm",
								value: idxName,
								onChange: (e) => setIdxName(e.target.value),
								placeholder: "Name"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								className: "mt-2 h-11 w-full rounded-xl bg-raised px-3 text-sm",
								value: idxUrl,
								onChange: (e) => setIdxUrl(e.target.value),
								placeholder: "https://…"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								className: "mt-2 h-11 w-full rounded-xl bg-raised px-3 text-sm",
								value: idxKey,
								onChange: (e) => setIdxKey(e.target.value),
								placeholder: "API key"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mt-3 flex gap-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
									type: "submit",
									children: "Add"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
									type: "button",
									variant: "ghost",
									onClick: () => setIdxMsg("Skipped"),
									children: "Skip"
								})]
							})
						]
					}),
					idxMsg ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-2 text-xs text-muted",
						children: idxMsg
					}) : null
				]
			}) }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "rounded-2xl border border-gold/40 bg-gradient-to-br from-gold/10 via-card/80 to-card p-6 shadow-xl space-y-4",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-2.5 text-gold",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sparkles, { className: "size-5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
							className: "font-display text-lg font-bold text-foreground",
							children: "Ready for Your First Stream"
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "text-xs text-muted max-w-xl leading-relaxed",
						children: [
							"Your provider connection is configured. Browse ",
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "Discover" }),
							" to find a title; ReelOS will show whether a playable copy is available before offering playback."
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-wrap items-center gap-3 pt-1",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
								size: "lg",
								onClick: () => finish("/discover"),
								className: "h-12 rounded-xl px-6 font-display font-semibold shadow-[var(--shadow-gold)] gap-2 cursor-pointer",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sparkles, { className: "size-4" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Explore Discover & Add First Title" })]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								size: "lg",
								variant: "ghost",
								onClick: () => finish("/"),
								className: "h-12 rounded-xl px-5 border border-border bg-card/60 text-muted hover:text-foreground cursor-pointer",
								children: "Open Home Screen"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								variant: "ghost",
								onClick: () => finish("/"),
								className: "text-xs text-faint hover:text-muted cursor-pointer",
								children: "Skip for now"
							})
						]
					})
				]
			})
		]
	});
}
function Card({ children, locked, className }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: cn("flex items-start gap-3 rounded-2xl bg-card px-5 py-4 shadow-[var(--shadow-border)] transition-all", locked && "opacity-50", className),
		children
	});
}
function Dot({ state }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: cn("mt-1.5 size-2.5 shrink-0 rounded-full", state === "green" ? "bg-live" : state === "red" ? "bg-danger" : "bg-gold") });
}
function FeatureShowcase({ className, autoPlay = true, intervalMs = 6e3 }) {
	const [activeIdx, setActiveIdx] = (0, import_react.useState)(0);
	const slides = [
		{
			id: "native-apps",
			tag: "Unified Client",
			title: "The ReelOS App",
			subtitle: "Zero-config 4K DirectPlay on Fire TV, Google TV, and Android. Grab it now while the engine boots.",
			renderMockup: () => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MockupNativeApps, {})
		},
		{
			id: "flickmatch",
			tag: "Party Swiping",
			title: "FlickMatch",
			subtitle: "Swipe movie cards together with your housemates. Match and watch instantly.",
			renderMockup: () => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MockupFlickMatch, {})
		},
		{
			id: "couch-mode",
			tag: "10-Foot Experience",
			title: "Couch Mode",
			subtitle: "Cinematic D-pad browsing engineered specifically for large screen 4K TVs.",
			renderMockup: () => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MockupCouchMode, {})
		},
		{
			id: "reading-audio",
			tag: "Digital Literature",
			title: "Reader & Audio",
			subtitle: "First-class EPUB reading and audiobook playback synced across every room.",
			renderMockup: () => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MockupReader, {})
		},
		{
			id: "virtual-remote",
			tag: "Zero-Install Remote",
			title: "Virtual Remote",
			subtitle: "Turn any phone or browser into a precision playback remote with audio & subtitle toggles.",
			renderMockup: () => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MockupVirtualRemote, {})
		},
		{
			id: "battery-guardian",
			tag: "24/7 Appliance",
			title: "Battery Guardian",
			subtitle: "Smart AC cutoff and clamshell wear mitigation turn any old laptop into a whisper-quiet server.",
			renderMockup: () => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MockupBatteryGuardian, {})
		},
		{
			id: "multi-user",
			tag: "Private Profiles",
			title: "Resident Isolation",
			subtitle: "Independent Continue Watching queues and optional 4-digit PIN locks for everyone.",
			renderMockup: () => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MockupMultiUser, {})
		}
	];
	(0, import_react.useEffect)(() => {
		if (!autoPlay) return;
		const timer = setInterval(() => {
			setActiveIdx((prev) => (prev + 1) % slides.length);
		}, intervalMs);
		return () => clearInterval(timer);
	}, [
		autoPlay,
		intervalMs,
		slides.length
	]);
	const current = slides[activeIdx];
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: cn("relative flex flex-col justify-between overflow-hidden rounded-3xl border border-border bg-card/60 p-6 backdrop-blur-xl shadow-2xl md:p-8", className),
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				"aria-hidden": "true",
				className: "pointer-events-none absolute -right-16 -top-16 size-80 rounded-full bg-gold/15 blur-[100px] transition-all duration-700"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				"aria-hidden": "true",
				className: "pointer-events-none absolute -bottom-16 -left-16 size-80 rounded-full bg-live/10 blur-[100px] transition-all duration-700"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "relative z-10",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center justify-between gap-4",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "inline-flex items-center gap-1.5 rounded-full border border-gold/40 bg-gold/10 px-3 py-1 text-[11px] font-semibold tracking-wider text-gold-bright uppercase",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sparkles, { className: "size-3 text-gold" }), current.tag]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-1.5",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: () => setActiveIdx((prev) => (prev - 1 + slides.length) % slides.length),
								className: "flex size-8 items-center justify-center rounded-full border border-border bg-card/80 text-muted transition-colors hover:border-border-strong hover:text-foreground active:scale-95",
								"aria-label": "Previous feature",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronLeft, { className: "size-4" })
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: () => setActiveIdx((prev) => (prev + 1) % slides.length),
								className: "flex size-8 items-center justify-center rounded-full border border-border bg-card/80 text-muted transition-colors hover:border-border-strong hover:text-foreground active:scale-95",
								"aria-label": "Next feature",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronRight, { className: "size-4" })
							})]
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
						className: "mt-3 font-display text-2xl font-bold tracking-tight text-foreground md:text-3xl",
						children: current.title
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1.5 text-xs text-muted leading-relaxed md:text-sm",
						children: current.subtitle
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "relative z-10 my-6 flex min-h-[300px] items-center justify-center",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "rise w-full",
					children: current.renderMockup()
				}, current.id)
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "relative z-10 flex items-center justify-between border-t border-border pt-4",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "flex items-center gap-2",
					children: slides.map((s, idx) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: () => setActiveIdx(idx),
						className: cn("h-1.5 rounded-full transition-all duration-300", idx === activeIdx ? "w-7 bg-gold shadow-[var(--shadow-gold)]" : "w-2 bg-card-2 border border-border hover:bg-muted"),
						"aria-label": `Go to slide ${s.title}`
					}, s.id))
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
					className: "font-mono text-[11px] text-faint tabular-nums",
					children: [
						"0",
						activeIdx + 1,
						" / 0",
						slides.length
					]
				})]
			})
		]
	});
}
function MockupFlickMatch() {
	const residents = useReelStore((s) => s.residents) || [];
	const name1 = residents[0]?.name || "Resident 1";
	const name2 = residents[1]?.name || "Resident 2";
	const init1 = name1.charAt(0).toUpperCase();
	const init2 = name2.charAt(0).toUpperCase();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "relative mx-auto max-w-sm rounded-2xl border border-border bg-raised/90 p-4 shadow-xl backdrop-blur-md",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex items-center justify-between border-b border-border pb-3",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex -space-x-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "flex size-7 items-center justify-center rounded-full border-2 border-raised bg-gold text-gold-fg font-bold text-[10px]",
						children: init1
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "flex size-7 items-center justify-center rounded-full border-2 border-raised bg-live text-background font-bold text-[10px]",
						children: init2
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "font-display text-xs font-semibold text-foreground",
					children: [
						name1,
						" & ",
						name2
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-[10px] text-muted",
					children: "Session: Cinema Lounge"
				})] })]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
				className: "inline-flex items-center gap-1 rounded-full bg-danger/15 px-2 py-0.5 text-[10px] font-semibold text-danger",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Heart, { className: "size-3 fill-current" }), " Live Match"]
			})]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "relative mt-4 flex items-center justify-center py-2",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "absolute top-0 w-60 translate-y-2 scale-95 rounded-xl border border-border bg-card p-3 opacity-40 blur-[0.5px]",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "h-28 rounded-lg bg-card-2" })
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "relative z-10 w-64 rounded-xl border border-gold/50 bg-card p-3 shadow-2xl",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "relative h-36 overflow-hidden rounded-lg bg-gradient-to-t from-black/90 via-black/40 to-transparent flex flex-col justify-end p-3",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "absolute inset-0 bg-cover bg-center opacity-60 mix-blend-overlay" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "w-fit rounded-md bg-gold px-1.5 py-0.5 font-display text-[9px] font-bold text-gold-fg uppercase",
								children: "98% Match"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h4", {
								className: "mt-1 font-display text-sm font-bold text-white",
								children: "Oppenheimer"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-[10px] text-zinc-300",
								children: "2023 · 3h 0min · 4K HDR Cinema Master"
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-3 flex items-center justify-between rounded-lg border border-gold/30 bg-gold/15 px-2.5 py-1.5",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-1.5 text-gold font-semibold text-xs",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sparkles, { className: "size-3.5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Matched! Both swiped right" })]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-[10px] text-foreground font-mono",
							children: "100%"
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						className: "mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-gold py-2 font-display text-xs font-semibold text-gold-fg shadow-[var(--shadow-gold)]",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Tv, { className: "size-3.5" }), "Cast to Living Room TV"]
					})
				]
			})]
		})]
	});
}
function MockupCouchMode() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "relative mx-auto max-w-md rounded-2xl border-2 border-border-strong bg-black p-4 shadow-2xl",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center justify-between border-b border-white/10 pb-2.5 text-white/80",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Tv, { className: "size-4 text-gold" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "font-display text-xs font-bold tracking-wider uppercase text-gold",
						children: "Couch Mode 10-Foot"
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-3 text-[11px] font-mono",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "rounded bg-white/10 px-1.5 py-0.5 text-zinc-300",
						children: "D-PAD ON"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-zinc-400",
						children: "Host"
					})]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-3 grid grid-cols-3 gap-2.5",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "relative rounded-xl border border-white/10 bg-zinc-900 p-2 opacity-60",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "h-24 rounded bg-zinc-800" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-1.5 truncate text-[11px] font-medium text-zinc-300",
							children: "Dune: Part Two"
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "relative scale-105 rounded-xl border-2 border-gold bg-zinc-900 p-2 shadow-[var(--shadow-gold)] transition-transform",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-gold text-gold-fg text-[9px] font-bold",
								children: "✓"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "h-24 rounded bg-gradient-to-br from-gold/30 to-zinc-800 flex items-center justify-center",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Play, { className: "size-6 text-gold fill-current" })
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-1.5 truncate font-display text-xs font-bold text-white",
								children: "Interstellar"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mt-1 flex items-center gap-1",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "rounded bg-gold/20 px-1 text-[8px] font-bold text-gold",
									children: "4K MASTER"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "rounded bg-white/10 px-1 text-[8px] text-zinc-300",
									children: "ATMOS"
								})]
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "relative rounded-xl border border-white/10 bg-zinc-900 p-2 opacity-60",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "h-24 rounded bg-zinc-800" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-1.5 truncate text-[11px] font-medium text-zinc-300",
							children: "Succession"
						})]
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-3 flex items-center justify-between rounded-lg bg-zinc-900/80 px-3 py-1.5 text-[10px] text-zinc-400",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-1.5 text-success",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleCheck, { className: "size-3" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "DirectStream 68 Mbps · Zero Transcode Lag" })]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "font-mono text-zinc-500",
					children: "Living Room TV"
				})]
			})
		]
	});
}
function MockupReader() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "relative mx-auto max-w-sm rounded-2xl border border-border bg-raised/90 p-4 shadow-xl backdrop-blur-md",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center justify-between border-b border-border pb-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(BookOpen, { className: "size-4 text-gold" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "font-display text-xs font-semibold text-foreground",
						children: "Digital Literature & Audio"
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "rounded-full bg-gold/15 px-2 py-0.5 text-[10px] font-semibold text-gold",
					children: "1.25x Speed"
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-4 flex gap-4",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "h-28 w-20 shrink-0 rounded-lg border border-border bg-card-2 p-2 shadow flex flex-col justify-between",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-[8px] font-mono text-gold uppercase",
							children: "Sci-Fi Epic"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "font-display text-[11px] font-bold text-foreground leading-tight",
							children: "Project Hail Mary"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-[9px] text-muted",
							children: "Andy Weir"
						})
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-1 flex-col justify-between py-1",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "rounded bg-gold/10 px-1.5 py-0.5 text-[9px] font-medium text-gold-bright",
						children: "Chapter 14 · The Asteroid"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1 text-xs text-muted leading-relaxed",
						children: "\"Humanity was never alone in this sector of deep space...\""
					})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "space-y-1.5",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "h-1.5 w-full rounded-full bg-card-2 overflow-hidden",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "h-full w-[64%] bg-gold rounded-full" })
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center justify-between text-[10px] text-faint font-mono",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "04:12:30" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "64% Done" })]
						})]
					})]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-3 flex items-center justify-between rounded-xl border border-border bg-card p-2 text-xs",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "text-muted text-[11px]",
					children: "Synced across Phone & Couch Mode"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
					className: "font-semibold text-success flex items-center gap-1 text-[11px]",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: "size-3" }), " Offline Ready"]
				})]
			})
		]
	});
}
function MockupVirtualRemote() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "relative mx-auto max-w-xs rounded-3xl border border-border bg-card/95 p-4 shadow-2xl backdrop-blur-2xl",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center justify-between border-b border-border pb-2.5",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "flex size-6 items-center justify-center rounded-lg bg-gold/15 text-gold",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Tv, { className: "size-3.5" })
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-[9px] font-semibold uppercase tracking-wider text-muted",
						children: "Living Room"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "font-display text-xs font-bold text-foreground",
						children: "Couch Remote"
					})] })]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "flex size-2 rounded-full bg-success animate-pulse" })]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-3 text-center",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "font-display text-sm font-bold text-foreground",
					children: "The Dark Knight"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-[11px] text-muted",
					children: "4K Ultra HD · Christopher Nolan"
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-3 space-y-1",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "h-1.5 w-full rounded-full bg-raised overflow-hidden",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "h-full w-[45%] bg-gold rounded-full" })
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex justify-between font-mono text-[9px] text-muted",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "1:12:44" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "-1:29:16" })]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-4 flex items-center justify-center gap-4",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						className: "flex size-10 items-center justify-center rounded-2xl border border-border bg-raised text-foreground shadow-sm",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Rewind, { className: "size-4" })
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						className: "flex size-12 items-center justify-center rounded-3xl border border-gold bg-gold text-gold-fg shadow-[var(--shadow-gold)]",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Play, { className: "size-5 fill-current ml-0.5" })
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						className: "flex size-10 items-center justify-center rounded-2xl border border-border bg-raised text-foreground shadow-sm",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FastForward, { className: "size-4" })
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-4 flex items-center justify-between border-t border-border pt-2.5 text-xs text-muted",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-1.5 rounded-lg border border-gold/30 bg-gold/15 px-2 py-1 text-gold font-medium text-[10px]",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Captions, { className: "size-3" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Subs ON (English)" })]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-1 text-[11px]",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Volume2, { className: "size-3.5 text-muted" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "font-mono text-foreground font-semibold",
						children: "78%"
					})]
				})]
			})
		]
	});
}
function MockupBatteryGuardian() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "relative mx-auto max-w-sm rounded-2xl border border-border bg-raised/90 p-4 shadow-xl backdrop-blur-md",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center justify-between border-b border-border pb-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Laptop, { className: "size-4 text-gold" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "font-display text-xs font-semibold text-foreground",
						children: "24/7 Clamshell Appliance"
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
					className: "inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-semibold text-success",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Zap, { className: "size-3" }), " AC Protected"]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-4 grid grid-cols-3 gap-2 text-center",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "rounded-xl border border-border bg-card p-2.5",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-[10px] uppercase tracking-wider text-muted",
								children: "CPU Temp"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-1 font-mono text-sm font-bold text-foreground",
								children: "41.8°C"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-[9px] text-success font-medium",
								children: "Whisper Cool"
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "rounded-xl border border-border bg-card p-2.5",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-[10px] uppercase tracking-wider text-muted",
								children: "AC Charge"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-1 font-mono text-sm font-bold text-gold",
								children: "80% Max"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-[9px] text-muted",
								children: "Wear Cutoff"
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "rounded-xl border border-border bg-card p-2.5",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-[10px] uppercase tracking-wider text-muted",
								children: "Fan Speed"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-1 font-mono text-sm font-bold text-foreground",
								children: "1150 RPM"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-[9px] text-muted",
								children: "Silent Curve"
							})
						]
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-3 rounded-xl border border-border bg-card p-3 space-y-1.5 text-xs",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center justify-between text-[11px]",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-muted",
						children: "Lid Switch Inhibit:"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "font-semibold text-success",
						children: "Running 24/7 with lid closed"
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center justify-between text-[11px]",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-muted",
						children: "RAM Flash Journal:"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "font-semibold text-foreground",
						children: "SSD Wear Protection Active"
					})]
				})]
			})
		]
	});
}
function MockupMultiUser() {
	const residents = useReelStore((s) => s.residents) || [];
	const name1 = residents[0]?.name || "Resident 1";
	const name2 = residents[1]?.name || "Resident 2";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "relative mx-auto max-w-sm rounded-2xl border border-border bg-raised/90 p-4 shadow-xl backdrop-blur-md",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center justify-between border-b border-border pb-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Users, { className: "size-4 text-gold" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "font-display text-xs font-semibold text-foreground",
						children: "Isolated Household Profiles"
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "rounded-full bg-gold/15 px-2 py-0.5 text-[10px] font-semibold text-gold",
					children: "2 Profiles Live"
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-3 space-y-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center justify-between rounded-xl border border-gold/40 bg-gold/10 p-2.5",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-2.5",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "flex size-8 items-center justify-center rounded-full bg-gold text-gold-fg font-bold text-xs",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Clapperboard, { className: "size-4" })
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "font-display text-xs font-bold text-foreground flex items-center gap-1.5",
							children: [name1, /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Crown, { className: "size-3 text-gold" })]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-[10px] text-muted",
							children: "Continue: Succession S04E03 (42m left)"
						})] })]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "rounded bg-gold/20 px-1.5 py-0.5 text-[10px] font-mono text-gold font-semibold",
						children: "ACTIVE"
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center justify-between rounded-xl border border-border bg-card p-2.5",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-2.5",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "flex size-8 items-center justify-center rounded-full bg-card-2 text-muted font-bold text-xs border border-border",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Film, { className: "size-4" })
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "font-display text-xs font-medium text-foreground flex items-center gap-1.5",
							children: [name2, /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Lock, { className: "size-3 text-muted" })]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-[10px] text-muted",
							children: "Private Watch History · PIN Protected"
						})] })]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "rounded border border-border bg-card-2 px-1.5 py-0.5 text-[10px] font-mono text-muted",
						children: "••••"
					})]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-3 text-center text-[10px] text-faint",
				children: "Each resident has private progress and a personalized Continue Watching row in ReelOS."
			})
		]
	});
}
function MockupNativeApps() {
	const ipv4 = useReelStore((s) => s.ipv4);
	const hostname = typeof window !== "undefined" ? window.location.hostname : "reelos.local";
	const port = typeof window !== "undefined" && window.location.port ? `:${window.location.port}` : ":8080";
	const effectiveHost = (hostname === "localhost" || hostname === "127.0.0.1" || hostname.endsWith(".local")) && ipv4 ? ipv4 : hostname;
	const tvUrl = `http://${effectiveHost}${port}/tv`;
	const apkUrl = `http://${effectiveHost}${port}/downloads/reelos-app.apk`;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex flex-col gap-4 rounded-2xl border border-border bg-card/80 p-5 backdrop-blur-md",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex items-center justify-between border-b border-border/40 pb-3",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "flex size-7 items-center justify-center rounded-lg bg-gold/15 text-gold",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Tv, { className: "size-4" })
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "font-display text-xs font-bold text-foreground",
					children: "Fire TV & Android TV Downloader"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-[10px] text-muted",
					children: "Type this URL in the Downloader app"
				})] })]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "rounded-full border border-gold/30 bg-gold/10 px-2.5 py-0.5 font-mono text-[10px] font-semibold text-gold",
				children: "4K DirectPlay · 0% Host CPU"
			})]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex flex-col sm:flex-row items-center gap-4",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex-1 space-y-2.5 w-full",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "rounded-xl bg-raised border border-border p-3 space-y-1",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-[10px] font-mono text-muted uppercase tracking-wider",
						children: "Downloader URL / Shortlink"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "font-mono text-xs font-bold text-gold break-all",
						children: tvUrl
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "text-[11px] text-muted space-y-1",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "flex items-center gap-1.5",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: "size-3 text-success" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Zero-touch LAN broadcast discovery" })]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "flex items-center gap-1.5",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: "size-3 text-success" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Hardware SurfaceView 10-bit HDR10 & Dolby Vision" })]
					})]
				})]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "shrink-0 flex flex-col items-center space-y-1.5",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "rounded-xl bg-white p-2.5 shadow-md border border-border/50",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(QrCodeSvg, {
						value: apkUrl,
						size: 110
					})
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "text-[9px] font-mono text-muted uppercase tracking-wider",
					children: "Scan for Android APK"
				})]
			})]
		})]
	});
}
function Provision() {
	if (useReelStore((s) => s.phase) === "ready") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Ready, {});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Building, {});
}
function Building() {
	const build = useReelStore((s) => s.build);
	const open = useReelStore((s) => s.buildLogOpen);
	const theme = useReelStore((s) => s.theme);
	const done = build.filter((s) => s.status === "done").length;
	const total = build.length || 1;
	build.find((s) => s.status === "running");
	const setPhase = useReelStore((s) => s.setPhase);
	const [provisionErr, setProvisionErr] = (0, import_react.useState)("");
	(0, import_react.useEffect)(() => {
		let stop = false;
		const tick = () => {
			fetch("/api/box", { cache: "no-store" }).then((r) => r.json()).then((b) => {
				if (stop) return;
				if (b.provisioned) setPhase("ready");
				if (b.provisionError) setProvisionErr(b.provisionError);
			}).catch(() => {});
		};
		tick();
		const id = window.setInterval(tick, 3e3);
		return () => {
			stop = true;
			window.clearInterval(id);
		};
	}, [setPhase]);
	const pct = Math.round(done / total * 100);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		"data-theme": theme,
		className: "relative min-h-dvh overflow-hidden bg-background px-6 py-8 transition-colors duration-500 md:px-12",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				"aria-hidden": true,
				className: "pointer-events-none absolute -left-20 top-0 size-[32rem] rounded-full bg-gold/15 blur-[120px] transition-all duration-700"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				"aria-hidden": true,
				className: "pointer-events-none absolute -right-20 bottom-0 size-[28rem] rounded-full bg-live/10 blur-[110px] transition-all duration-700"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
				className: "relative z-10 mx-auto flex max-w-6xl items-center justify-between",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Wordmark, { markClassName: "size-8" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1.5 backdrop-blur-md",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "size-3.5 animate-spin text-gold" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "font-display text-xs font-medium text-muted",
						children: [
							"Provisioning Media Stack · ",
							pct,
							"%"
						]
					})]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("main", {
				className: "relative z-10 mx-auto mt-8 max-w-6xl pb-16",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "grid gap-10 lg:grid-cols-12 lg:items-start",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "lg:col-span-5 xl:col-span-5",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "rounded-3xl border border-border bg-card/70 p-6 backdrop-blur-xl shadow-xl md:p-8",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center gap-2 text-gold",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sparkles, { className: "size-4 text-gold" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "font-display text-xs font-semibold tracking-[0.22em] uppercase",
										children: "Stack Lifecycle"
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
									className: "mt-2 font-display text-3xl font-bold tracking-tight text-foreground",
									children: "Standing up ReelOS"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "mt-2 text-xs text-muted leading-relaxed",
									children: "Configuring cloud streaming links, high-fidelity media profiles, and personalized resident spaces."
								}),
								provisionErr ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "mt-4 rounded-xl border border-danger/40 bg-danger/10 p-3 text-xs text-danger font-medium space-y-3",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: provisionErr }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex flex-wrap gap-2 pt-1",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											type: "button",
											onClick: () => {
												setProvisionErr("");
												const answers = useReelStore.getState().answers;
												fetch("/api/provision", {
													method: "POST",
													headers: { "Content-Type": "application/json" },
													body: JSON.stringify({ answers })
												}).then((r) => r.json()).then((j) => {
													if (j?.ok && !j?.simulated) useReelStore.getState().startBuild();
													else setProvisionErr(j?.error || "Provision retry failed");
												}).catch((e) => setProvisionErr(String(e)));
											},
											className: "rounded-lg bg-danger/20 hover:bg-danger/30 text-danger border border-danger/40 px-3 py-1 text-xs font-semibold transition-colors",
											children: "Retry Setup"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											type: "button",
											onClick: () => {
												setProvisionErr("");
												useReelStore.setState({ phase: "wizard" });
											},
											className: "rounded-lg bg-card hover:bg-card/80 text-foreground border border-border px-3 py-1 text-xs font-semibold transition-colors",
											children: "Edit Configuration"
										})]
									})]
								}) : null,
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "mt-6 space-y-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center justify-between text-xs",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-muted font-medium",
											children: "Progress"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
											className: "font-mono font-bold text-foreground tabular-nums",
											children: [pct, "%"]
										})]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "h-2 overflow-hidden rounded-full bg-card-2 border border-border",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "h-full bg-gold transition-[width] duration-500 ease-out shadow-[var(--shadow-gold)]",
											style: { width: `${pct}%` }
										})
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ol", {
									className: "mt-6 space-y-3",
									children: build.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
										className: "flex items-start gap-3",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusDot, { status: s.status }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "min-w-0 flex-1",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
												className: cn("text-xs font-medium transition-colors", s.status === "pending" && "text-faint", s.status === "running" && "text-gold font-semibold", s.status === "done" && "text-foreground"),
												children: s.label
											}), s.status === "running" || s.status === "done" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
												className: "mt-0.5 truncate font-mono text-[10px] text-muted",
												children: s.log
											}) : null]
										})]
									}, s.id))
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "mt-6 border-t border-border pt-4",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
										type: "button",
										className: "flex items-center gap-2 text-xs font-medium text-muted hover:text-foreground transition-colors",
										onClick: () => useReelStore.setState({ buildLogOpen: !open }),
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronDown, { className: cn("size-3.5 transition-transform", open && "rotate-180") }), "Console Logs"]
									}), open ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("pre", {
										className: "mt-3 max-h-40 overflow-auto rounded-xl bg-raised p-3 font-mono text-[10px] leading-relaxed text-muted border border-border",
										children: build.filter((s) => s.log).map((s) => `[${s.id}] ${s.log}`).join("\n") || "Waiting for first step."
									}) : null]
								})
							]
						})
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "lg:col-span-7 xl:col-span-7",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FeatureShowcase, { className: "border-border/80 shadow-2xl" })
					})]
				})
			})
		]
	});
}
function StatusDot({ status }) {
	if (status === "done") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
		className: "mt-0.5 flex size-5 items-center justify-center rounded-full bg-gold text-gold-fg",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, {
			className: "size-3",
			strokeWidth: 3
		})
	});
	if (status === "running") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "mt-0.5 size-5 animate-spin text-gold" });
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "mt-0.5 size-5 rounded-full shadow-[var(--shadow-border)]" });
}
function Ready() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ConnectView, {});
}
function ApplyingBar() {
	const update = useReelStore((s) => s.update);
	if (update.status !== "applying") return null;
	const log = update.steps.find((s) => s.log)?.log || update.steps[0]?.log || "";
	const name = update.target || "this update";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "border-b border-gold/35 bg-gold/12 px-4 py-2.5",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "flex items-center gap-2 text-sm text-gold-bright",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "size-3.5 shrink-0 animate-spin" }),
					"Updating ReelOS to ",
					name,
					" — preparing cinema services."
				]
			}),
			log ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-0.5 font-mono text-[11px] text-muted",
				children: log
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
				to: "/settings",
				className: "mt-1 inline-block text-[12px] text-gold",
				children: "Updates"
			})
		]
	});
}
/** Circuit lanes + one packet while splash/search/grab/Check is working. */
function CircuitFloor({ className }) {
	const busy = useArenaBusy();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", {
		className: cn("arena-circuit pointer-events-none absolute inset-0 h-full w-full text-circuit", className),
		viewBox: "0 0 390 844",
		preserveAspectRatio: "xMidYMid slice",
		"aria-hidden": "true",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("g", {
				fill: "none",
				stroke: "currentColor",
				strokeWidth: "1.15",
				opacity: "0.55",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M12 72h48l18 18h40" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M12 110h28l12 12" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M378 72h-52l-16 16h-36" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M378 118h-24l-10 10" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M12 760h40l16-16h36" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M378 760h-44l-14-14h-28" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M28 200v80l12 12v90" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M362 210v70l-10 10v100" })
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("g", {
				fill: "currentColor",
				opacity: "0.8",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", {
						cx: "12",
						cy: "72",
						r: "2.2"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", {
						cx: "78",
						cy: "90",
						r: "2.2"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", {
						cx: "378",
						cy: "72",
						r: "2.2"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", {
						cx: "310",
						cy: "88",
						r: "2.2"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", {
						cx: "12",
						cy: "760",
						r: "2.2"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", {
						cx: "104",
						cy: "744",
						r: "2.2"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", {
						cx: "378",
						cy: "760",
						r: "2.2"
					})
				]
			}),
			busy ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", {
				r: "2.6",
				fill: "currentColor",
				className: "arena-packet",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("animateMotion", {
					dur: "3.6s",
					repeatCount: "indefinite",
					path: "M12 72h48l18 18h40"
				})
			}) : null
		]
	});
}
function useArenaBusy() {
	const phase = useReelStore((s) => s.phase);
	const boot = useReelStore((s) => s.bootSteps);
	const update = useReelStore((s) => s.update);
	const requests = useReelStore((s) => s.requests);
	const shelf = useReelStore((s) => s.shelf);
	if (update.status === "checking") return true;
	if (phase === "splash" || phase === "wizard") return Object.values(boot).some((st) => st === "running");
	return inFlightRequests(requests, { titles: shelf }).some((r) => r.status === "downloading" || /search/i.test(String(r.reason || "")));
}
function LibraryCatchupBar() {
	const catchup = useReelStore((s) => s.libraryCatchup);
	if (useReelStore((s) => s.update.status === "applying")) return null;
	if (!catchupShowsBanner(catchup)) return null;
	const text = catchup.message || (catchup.status === "backoff" ? "Cloud storage is syncing — your movies are being linked" : "Library catching up");
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "relative z-20 border-b border-border bg-raised px-3 py-2",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
			className: "flex items-center gap-2 text-sm text-foreground",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "size-3.5 shrink-0 animate-spin" }), text]
		}), catchup.folder && catchup.total ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
			className: "mt-0.5 font-mono text-[11px] text-muted",
			children: [
				"folder ",
				catchup.folder,
				" of ",
				catchup.total
			]
		}) : null]
	});
}
function UsbHotplugBanner() {
	const [drives, setDrives] = (0, import_react.useState)([]);
	const [dismissed, setDismissed] = (0, import_react.useState)(false);
	(0, import_react.useEffect)(() => {
		let cancelled = false;
		const checkHotplug = async () => {
			if (dismissed) return;
			try {
				const res = await fetch("/api/disks/hotplug-detect", { cache: "no-store" });
				if (res.ok) {
					const data = await res.json();
					if (!cancelled && data.detected && Array.isArray(data.drives) && data.drives.length > 0) setDrives(data.drives);
				}
			} catch {}
		};
		checkHotplug();
		const timer = setInterval(checkHotplug, 15e3);
		return () => {
			cancelled = true;
			clearInterval(timer);
		};
	}, [dismissed]);
	const handleDismiss = async () => {
		setDismissed(true);
		setDrives([]);
		try {
			await fetch("/api/disks/hotplug-dismiss", { method: "POST" });
		} catch {}
	};
	if (dismissed || drives.length === 0) return null;
	const drive = drives[0];
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "relative z-30 border-b border-amber-500/40 bg-gradient-to-r from-amber-500/20 via-amber-600/15 to-transparent px-4 py-2.5 backdrop-blur-md",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mx-auto flex max-w-7xl items-center justify-between gap-4",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center gap-3 min-w-0",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "flex size-7 items-center justify-center rounded-lg bg-amber-500/20 text-amber-300 shrink-0",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Usb, { className: "size-4" })
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "text-xs text-amber-100 truncate",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "font-semibold text-white",
							children: "New Storage Detected:"
						}),
						" ",
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "font-mono text-amber-300",
							children: drive.name || drive.device
						}),
						" ",
						drive.sizeGb ? `(${drive.sizeGb} GB)` : "",
						" — Expand your library cache or enable Thumb Stick Mode."
					]
				})]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center gap-2 shrink-0",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
					to: "/settings",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
						size: "sm",
						variant: "gold",
						className: "h-7 text-xs px-3 font-semibold gap-1 shadow-sm",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Configure" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowRight, { className: "size-3" })]
					})
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					onClick: handleDismiss,
					className: "flex size-7 items-center justify-center rounded-lg text-amber-300 hover:bg-white/10 transition-colors",
					title: "Dismiss notification",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-3.5" })
				})]
			})]
		})
	});
}
var AVATAR_MAP = {
	clapperboard: Clapperboard,
	film: Film,
	tv: Tv,
	sparkles: Sparkles,
	shield: Shield,
	popcorn: Flame,
	flame: Flame,
	default: User
};
function ResidentAvatar({ avatar, className }) {
	const Icon = AVATAR_MAP[avatar || "default"] ?? AVATAR_MAP.default;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
		className: cn("flex size-7 shrink-0 items-center justify-center rounded-full bg-gold/15 text-gold border border-gold/30", className),
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { className: "size-4" })
	});
}
function ProfileSwitcher({ compact = false }) {
	const residents = useReelStore((s) => s.residents);
	const activeId = useReelStore((s) => s.activeResidentId);
	const setActiveResident = useReelStore((s) => s.setActiveResident);
	const addResident = useReelStore((s) => s.addResident);
	const houseName = useReelStore((s) => s.houseName);
	const [open, setOpen] = (0, import_react.useState)(false);
	const [pinTarget, setPinTarget] = (0, import_react.useState)(null);
	const [pinInput, setPinInput] = (0, import_react.useState)("");
	const [pinError, setPinError] = (0, import_react.useState)(false);
	const [showInviteQr, setShowInviteQr] = (0, import_react.useState)(false);
	const [adding, setAdding] = (0, import_react.useState)(false);
	const [newName, setNewName] = (0, import_react.useState)("");
	const [newAvatar, setNewAvatar] = (0, import_react.useState)("clapperboard");
	const [newIsKids, setNewIsKids] = (0, import_react.useState)(false);
	const [copied, setCopied] = (0, import_react.useState)(false);
	const active = residents.find((r) => r.id === activeId) ?? residents[0] ?? {
		id: "guest",
		name: "Guest",
		avatar: "popcorn"
	};
	const handleSelect = (r) => {
		if (r.id === activeId) {
			setOpen(false);
			return;
		}
		if (r.pin) {
			setPinTarget(r);
			setPinInput("");
			setPinError(false);
			return;
		}
		if (active.isKids && !r.isKids) {
			const parentWithPin = residents.find((p) => !p.isKids && p.pin);
			if (parentWithPin?.pin) {
				setPinTarget({
					...r,
					pin: parentWithPin.pin
				});
				setPinInput("");
				setPinError(false);
				return;
			}
		}
		setActiveResident(r.id);
		setOpen(false);
		if (r.isKids) showToast(`👶 Switched to ${r.name} (Kids Sandbox)`, "info");
		else showToast(`Switched to ${r.name}`, "success");
	};
	const handlePinSubmit = () => {
		if (!pinTarget) return;
		if (pinInput === pinTarget.pin) {
			setActiveResident(pinTarget.id);
			if (pinTarget.isKids) showToast(`👶 Switched to ${pinTarget.name} (Kids Sandbox)`, "info");
			else showToast(`Unlocked and switched to ${pinTarget.name}`, "success");
			setPinTarget(null);
			setOpen(false);
			setPinInput("");
			setPinError(false);
		} else {
			setPinError(true);
			setPinInput("");
		}
	};
	const handleCreate = () => {
		if (!newName.trim()) return;
		addResident(newName.trim(), newAvatar, void 0, newIsKids);
		showToast(`Added profile for ${newName.trim()}${newIsKids ? " (Kids Sandbox)" : ""}`, "success");
		setNewName("");
		setNewIsKids(false);
		setAdding(false);
	};
	const inviteUrl = `http://${typeof window !== "undefined" ? window.location.hostname : "reelos.local"}${typeof window !== "undefined" && window.location.port ? `:${window.location.port}` : ":8080"}`;
	const copyInvite = () => {
		if (navigator.clipboard) {
			navigator.clipboard.writeText(inviteUrl);
			setCopied(true);
			setTimeout(() => setCopied(false), 2e3);
		}
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "relative",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
				type: "button",
				onClick: () => setOpen(!open),
				className: cn("flex items-center gap-2 rounded-full border border-border bg-card/70 text-xs font-medium text-foreground transition-all hover:bg-card hover:border-border-strong active:scale-95 cursor-pointer", compact ? "p-1.5 sm:px-2.5 sm:py-1.5 min-h-[38px] min-w-[38px] sm:min-h-[36px]" : "px-3 py-1.5 min-h-[44px]"),
				title: `Active Profile: ${active.name}`,
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ResidentAvatar, {
						avatar: active.avatar,
						className: "size-6 text-xs shrink-0"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: cn("max-w-[100px] truncate font-display font-medium", compact && "hidden sm:inline"),
						children: active.name
					}),
					active.isGuest ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: cn("rounded-full bg-gold/15 px-1.5 py-0.2 text-[9px] font-semibold text-gold", compact && "hidden sm:inline"),
						children: "Guest"
					}) : null,
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronDown, { className: cn("size-3.5 text-muted shrink-0", compact && "hidden sm:inline") })
				]
			}),
			open ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "fixed inset-0 z-40",
				onClick: () => {
					setOpen(false);
					setAdding(false);
					setPinTarget(null);
				}
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "fixed inset-x-4 top-16 z-50 mx-auto max-w-sm sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-72 origin-top-right rounded-2xl border border-border bg-raised/95 p-3 shadow-2xl backdrop-blur-2xl rise",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center justify-between border-b border-border pb-2.5 px-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-[11px] font-medium uppercase tracking-wider text-muted",
							children: "Profiles"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "truncate text-xs font-semibold text-foreground",
							children: houseName || "ReelOS House"
						})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
							size: "sm",
							variant: "ghost",
							onClick: () => setShowInviteQr(true),
							className: "h-7 gap-1 rounded-lg px-2 text-[11px] text-gold hover:text-gold-bright",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(QrCode, { className: "size-3.5" }), "Invite"]
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mt-2 space-y-1",
						children: residents.map((r) => {
							const isActive = r.id === activeId;
							return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								type: "button",
								onClick: () => handleSelect(r),
								className: cn("flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-left transition-all", isActive ? "bg-gold/15 text-foreground font-semibold border border-gold/30" : "hover:bg-card text-muted hover:text-foreground"),
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center gap-2.5 truncate",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ResidentAvatar, {
											avatar: r.avatar,
											className: "size-6"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "truncate text-xs",
											children: r.name
										}),
										r.isKids ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "rounded bg-gold/20 px-1.5 py-0.2 text-[9px] font-bold text-gold",
											children: "Kids"
										}) : null,
										r.isGuest ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-[10px] text-muted",
											children: "(Guest)"
										}) : null
									]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center gap-1.5",
									children: [r.pin ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Lock, { className: "size-3 text-muted" }) : null, isActive ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, {
										className: "size-3.5 text-gold",
										strokeWidth: 3
									}) : null]
								})]
							}, r.id);
						})
					}),
					adding ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-2 rounded-xl border border-border bg-card p-2.5 space-y-2",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								type: "text",
								placeholder: "New profile name",
								value: newName,
								onChange: (e) => setNewName(e.target.value),
								className: "h-8 w-full rounded-lg bg-raised px-2.5 text-xs text-foreground placeholder:text-faint",
								autoFocus: true
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "flex justify-between gap-1",
								children: [
									"clapperboard",
									"film",
									"tv",
									"sparkles",
									"popcorn"
								].map((av) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									onClick: () => setNewAvatar(av),
									className: cn("rounded-lg p-1.5", newAvatar === av ? "bg-gold text-gold-fg" : "text-muted"),
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ResidentAvatar, {
										avatar: av,
										className: "size-5"
									})
								}, av))
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								type: "button",
								onClick: () => setNewIsKids(!newIsKids),
								className: cn("flex w-full items-center justify-between rounded-lg border px-2 py-1.5 text-xs transition-all", newIsKids ? "border-gold/50 bg-gold/15 text-gold font-semibold" : "border-border/60 bg-raised/50 text-muted hover:text-foreground"),
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "flex items-center gap-1.5",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "👶" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Kids Sandbox Profile" })]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-[10px] uppercase font-bold",
									children: newIsKids ? "ON" : "OFF"
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex justify-end gap-1.5 pt-1",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
									size: "sm",
									variant: "ghost",
									onClick: () => setAdding(false),
									className: "h-7 text-xs",
									children: "Cancel"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
									size: "sm",
									variant: "gold",
									onClick: handleCreate,
									disabled: !newName.trim(),
									className: "h-7 text-xs",
									children: "Add"
								})]
							})
						]
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						onClick: () => setAdding(true),
						className: "mt-2 flex w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-xs text-muted hover:bg-card hover:text-foreground transition-all",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "size-3.5" }), "Add Household Member"]
					})
				]
			})] }) : null,
			pinTarget ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-md px-4",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4 rise",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center justify-between",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center gap-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(KeyRound, { className: "size-4 text-gold" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h3", {
									className: "font-display text-sm font-semibold text-foreground",
									children: ["PIN Required for ", pinTarget.name]
								})]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: () => setPinTarget(null),
								className: "text-muted hover:text-foreground",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-4" })
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-xs text-muted",
							children: "Enter the 4-digit security PIN to switch into this resident profile."
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							type: "password",
							inputMode: "numeric",
							pattern: "[0-9]*",
							maxLength: 4,
							value: pinInput,
							onChange: (e) => {
								setPinError(false);
								setPinInput(e.target.value.replace(/\D/g, ""));
							},
							onKeyDown: (e) => {
								if (e.key === "Enter") handlePinSubmit();
							},
							placeholder: "••••",
							className: cn("h-12 w-full rounded-xl bg-raised px-4 text-center font-mono text-xl tracking-[0.5em] shadow-[var(--shadow-border)] focus:shadow-[var(--shadow-gold)]", pinError && "border border-danger text-danger"),
							autoFocus: true
						}),
						pinError ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-center text-xs text-danger",
							children: "Incorrect PIN"
						}) : null,
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								variant: "ghost",
								onClick: () => setPinTarget(null),
								className: "flex-1 rounded-xl",
								children: "Cancel"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								variant: "gold",
								onClick: handlePinSubmit,
								disabled: pinInput.length < 4,
								className: "flex-1 rounded-xl",
								children: "Unlock"
							})]
						})
					]
				})
			}) : null,
			showInviteQr ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-md px-4",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "w-full max-w-sm rounded-3xl border border-border bg-card p-6 shadow-2xl space-y-5 text-center rise",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center justify-between",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center gap-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(QrCode, { className: "size-5 text-gold" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
									className: "font-display text-base font-semibold text-foreground",
									children: "Invite Friend to ReelOS"
								})]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: () => setShowInviteQr(false),
								className: "text-muted hover:text-foreground",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-4" })
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-xs text-muted",
							children: "Scan with phone camera or enter this address on your device to stream instantly as Guest."
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "mx-auto flex flex-col items-center justify-center rounded-2xl bg-white p-3.5 shadow-xl ring-4 ring-gold/20",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(QrCodeSvg, {
								value: inviteUrl,
								size: 168
							})
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "rounded-xl border border-border bg-raised p-3 flex items-center justify-between gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "truncate font-mono text-xs text-foreground",
								children: inviteUrl
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
								size: "sm",
								variant: "ghost",
								onClick: copyInvite,
								className: "h-8 gap-1 rounded-lg px-2 text-xs",
								children: [copied ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: "size-3 text-success" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Copy, { className: "size-3" }), copied ? "Copied" : "Copy"]
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-[11px] text-faint",
							children: "Guests enjoy an ephemeral sandbox that leaves resident continue-watching untouched."
						})
					]
				})
			}) : null
		]
	});
}
function GuestQrPopover({ compact = false }) {
	const [open, setOpen] = (0, import_react.useState)(false);
	const [copied, setCopied] = (0, import_react.useState)(false);
	const ref = (0, import_react.useRef)(null);
	const houseName = useReelStore((s) => s.houseName);
	const ipv4 = useReelStore((s) => s.ipv4);
	const rawHostname = typeof window !== "undefined" ? window.location.hostname : "reelos.local";
	const hostname = (rawHostname === "localhost" || rawHostname === "127.0.0.1" || rawHostname.endsWith(".local")) && ipv4 ? ipv4 : rawHostname || ipv4 || "reelos.local";
	const port = typeof window !== "undefined" && window.location.port ? ":" + window.location.port : ":8080";
	const lanUrl = "http://" + hostname + port;
	(0, import_react.useEffect)(() => {
		if (!ipv4) fetch("/api/box", { cache: "no-store" }).then((r) => r.json()).then((b) => {
			if (b?.ipv4) useReelStore.setState({ ipv4: String(b.ipv4) });
		}).catch(() => {});
	}, [ipv4]);
	(0, import_react.useEffect)(() => {
		function handleClickOutside(e) {
			if (ref.current && !ref.current.contains(e.target)) setOpen(false);
		}
		if (open) document.addEventListener("mousedown", handleClickOutside);
		return () => {
			document.removeEventListener("mousedown", handleClickOutside);
		};
	}, [open]);
	const copyUrl = () => {
		if (navigator.clipboard) {
			navigator.clipboard.writeText(lanUrl);
			setCopied(true);
			setTimeout(() => setCopied(false), 2e3);
		}
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		ref,
		className: "relative inline-block text-left",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
			type: "button",
			onClick: () => setOpen(!open),
			className: cn("flex items-center gap-1.5 rounded-xl border font-semibold transition-all", compact ? "size-8 justify-center rounded-lg border-border bg-card text-muted hover:text-gold" : "h-9 border-border bg-card/60 px-3 text-xs text-muted hover:border-gold/40 hover:text-gold", open && "border-gold/40 bg-gold/15 text-gold"),
			title: "Guest Join QR Code",
			"aria-expanded": open,
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(QrCode, { className: cn(compact ? "size-4" : "size-3.5", "text-gold") }), !compact && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Join" })]
		}), open && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "fixed inset-0 z-40 sm:hidden bg-black/40 backdrop-blur-xs",
			onClick: () => setOpen(false)
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "fixed inset-x-4 top-16 z-50 mx-auto max-w-sm sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-72 origin-top-right animate-in fade-in zoom-in-95 rounded-2xl border border-border bg-card/95 p-4 shadow-2xl backdrop-blur-xl",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-2 border-b border-border pb-2.5",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "flex size-6 items-center justify-center rounded-lg bg-gold/15 text-gold",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(QrCode, { className: "size-3.5" })
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "min-w-0 flex-1",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "font-display text-xs font-bold text-foreground truncate",
							children: houseName || "ReelOS"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-[10px] text-muted",
							children: "Guest & Phone Join"
						})]
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "my-3 flex flex-col items-center",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "rounded-xl bg-white p-2.5 shadow-md",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(QrCodeSvg, {
							value: lanUrl,
							size: 150
						})
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-2 text-center text-[11px] text-muted leading-relaxed",
						children: "Scan with your phone camera to connect directly on the local network."
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center justify-between rounded-xl bg-raised border border-border p-2 text-xs",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "font-mono text-[11px] text-gold truncate max-w-[160px]",
						children: lanUrl
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
						size: "sm",
						variant: "ghost",
						onClick: copyUrl,
						className: "h-7 rounded-lg px-2 text-[10px] text-foreground hover:text-gold",
						children: [copied ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: "size-3 text-success mr-1" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Copy, { className: "size-3 mr-1" }), copied ? "Copied" : "Copy"]
					})]
				})
			]
		})] })]
	});
}
function VirtualRemote() {
	const activeRemote = useReelStore((s) => s.activeRemote);
	const setActiveRemote = useReelStore((s) => s.setActiveRemote);
	const [sessions, setSessions] = (0, import_react.useState)([]);
	const [selectedSessionId, setSelectedSessionId] = (0, import_react.useState)("");
	const [volume, setVolume] = (0, import_react.useState)(80);
	const [muted, setMuted] = (0, import_react.useState)(false);
	const [subtitlesOn, setSubtitlesOn] = (0, import_react.useState)(true);
	const [pickerOpen, setPickerOpen] = (0, import_react.useState)(false);
	(0, import_react.useEffect)(() => {
		if (!activeRemote.open) return;
		const loadSessions = async () => {
			try {
				const data = await (await fetch("/api/cast/sessions")).json();
				if (data.ok && Array.isArray(data.sessions)) {
					setSessions(data.sessions);
					if (!selectedSessionId && data.sessions.length > 0) setSelectedSessionId(data.sessions[0].id);
				}
			} catch {}
		};
		loadSessions();
		const interval = setInterval(loadSessions, 3e3);
		return () => clearInterval(interval);
	}, [activeRemote.open, selectedSessionId]);
	if (!activeRemote.open) return null;
	const currentSession = sessions.find((s) => s.id === selectedSessionId) ?? sessions[0];
	const nowPlaying = currentSession?.nowPlaying;
	const isPaused = currentSession?.isPaused ?? !activeRemote.playing;
	const sendCommand = async (command, params = {}) => {
		try {
			await fetch("/api/cast/control", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					sessionId: selectedSessionId || currentSession?.id,
					command,
					params
				})
			});
		} catch {}
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "fixed inset-x-0 bottom-0 z-50 p-3 sm:bottom-6 sm:left-auto sm:right-6 sm:w-96 rise",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "rounded-3xl border border-border bg-card/95 p-5 shadow-2xl backdrop-blur-2xl",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center justify-between border-b border-border pb-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "flex size-7 items-center justify-center rounded-lg bg-gold/15 text-gold border border-gold/30",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Tv, { className: "size-4" })
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-[10px] font-semibold uppercase tracking-wider text-muted",
							children: "Controlling"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "relative",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								type: "button",
								onClick: () => setPickerOpen((v) => !v),
								className: "flex items-center gap-1 font-display text-xs font-bold text-foreground hover:text-gold transition-colors focus:outline-none",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "truncate max-w-[170px]",
									children: currentSession ? `${currentSession.name} (${currentSession.client})` : "Living Room TV"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronDown, { className: "size-3 text-muted" })]
							}), pickerOpen && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "absolute left-0 top-full mt-2 z-50 min-w-[220px] rounded-2xl border border-border/80 bg-card/95 p-1.5 shadow-2xl backdrop-blur-3xl",
								children: sessions.length > 0 ? sessions.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
									type: "button",
									onClick: () => {
										setSelectedSessionId(s.id);
										setPickerOpen(false);
									},
									className: cn("w-full flex items-center justify-between rounded-xl px-3 py-2 text-xs font-medium text-left transition-colors", s.id === (selectedSessionId || currentSession?.id) ? "bg-gold/20 text-gold font-semibold" : "text-foreground hover:bg-white/5"),
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "truncate",
										children: s.name
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-[10px] text-muted ml-2 shrink-0",
										children: s.client
									})]
								}, s.id)) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "px-3 py-2 text-xs text-muted",
									children: "Living Room TV (Default)"
								})
							})]
						})] })]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: () => setActiveRemote({ open: false }),
						className: "flex size-7 items-center justify-center rounded-full text-muted hover:bg-raised hover:text-foreground transition-colors",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-4" })
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-3 text-center",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "font-display text-sm font-bold text-foreground truncate",
						children: nowPlaying?.name || activeRemote.title || "Nothing Playing"
					}), nowPlaying?.seriesName && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-xs text-muted truncate",
						children: nowPlaying.seriesName
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-4 flex items-center justify-center gap-5",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: () => sendCommand("Seek", { SeekPositionTicks: -15e7 }),
							className: "flex size-12 items-center justify-center rounded-2xl border border-border bg-raised text-foreground hover:bg-card-2 hover:border-gold/40 transition-all active:scale-95",
							title: "15 seconds back",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RotateCcw, { className: "size-5" })
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: () => sendCommand("PlayPause"),
							className: "flex size-16 items-center justify-center rounded-3xl border border-gold bg-gold text-gold-fg shadow-[var(--shadow-gold)] hover:scale-105 transition-all active:scale-95",
							title: "Play / Pause",
							children: isPaused ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Play, { className: "size-7 fill-current ml-0.5" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Pause, { className: "size-7 fill-current" })
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: () => sendCommand("Seek", { SeekPositionTicks: 15e7 }),
							className: "flex size-12 items-center justify-center rounded-2xl border border-border bg-raised text-foreground hover:bg-card-2 hover:border-gold/40 transition-all active:scale-95",
							title: "15 seconds forward",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RotateCw, { className: "size-5" })
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-5 flex items-center justify-between border-t border-border pt-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						onClick: () => {
							setSubtitlesOn(!subtitlesOn);
							sendCommand("SetSubtitleStreamIndex", { SubtitleStreamIndex: subtitlesOn ? -1 : 0 });
						},
						className: cn("flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs font-medium transition-colors", subtitlesOn ? "border-gold/30 bg-gold/15 text-gold" : "border-border bg-raised text-muted hover:text-foreground"),
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Captions, { className: "size-3.5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: ["Subs ", subtitlesOn ? "ON" : "OFF"] })]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: () => {
								const nextMute = !muted;
								setMuted(nextMute);
								sendCommand("SetVolume", { Volume: nextMute ? 0 : volume });
							},
							className: "text-muted hover:text-foreground transition-colors",
							children: muted || volume === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(VolumeX, { className: "size-4 text-danger" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Volume2, { className: "size-4" })
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							type: "range",
							min: "0",
							max: "100",
							value: muted ? 0 : volume,
							onChange: (e) => {
								const v = Number(e.target.value);
								setVolume(v);
								setMuted(false);
								sendCommand("SetVolume", { Volume: v });
							},
							className: "h-1.5 w-20 accent-gold cursor-pointer"
						})]
					})]
				})
			]
		})
	});
}
function ToastHost() {
	const toasts = useToasts();
	if (!toasts.length) return null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "pointer-events-none fixed inset-x-0 bottom-16 z-50 flex flex-col items-center gap-2 px-4 sm:bottom-6",
		"aria-live": "polite",
		children: toasts.map((t) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: cn("pointer-events-auto flex items-center gap-2.5 rounded-2xl border px-4 py-2.5 text-sm font-medium shadow-lg backdrop-blur-md transition-all duration-200", t.type === "error" ? "border-danger/40 bg-danger/20 text-danger" : t.type === "success" ? "border-success/40 bg-card text-success" : "border-gold/40 bg-card text-foreground shadow-[var(--shadow-border)]"),
			children: [
				t.type === "error" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Info, { className: "size-4 shrink-0 text-danger" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: "size-4 shrink-0 text-gold" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: t.message }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					className: "ml-1 text-muted hover:text-foreground",
					onClick: () => dismissToast(t.id),
					"aria-label": "Dismiss toast",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-3.5" })
				})
			]
		}, t.id))
	});
}
var MINIMAL_NAV = [
	{
		to: "/",
		label: "Home",
		icon: House
	},
	{
		to: "/discover",
		label: "Discover",
		icon: Compass
	},
	{
		to: "/library",
		label: "Library",
		icon: Library
	},
	{
		to: "/books",
		label: "Books",
		icon: BookOpen
	}
];
function navOn(path, to) {
	if (to === "/") return path === "/";
	return path === to || path.startsWith(`${to}/`);
}
function PartyHub({ placement = "header" }) {
	const [open, setOpen] = (0, import_react.useState)(false);
	const ref = (0, import_react.useRef)(null);
	useReelStore((s) => s.activeRemote);
	const setActiveRemote = useReelStore((s) => s.setActiveRemote);
	const path = useRouterState({ select: (s) => s.location.pathname });
	const isFlickMatch = path === "/flickmatch" || path.startsWith("/flickmatch/");
	(0, import_react.useEffect)(() => {
		function handleClickOutside(event) {
			if (ref.current && !ref.current.contains(event.target)) setOpen(false);
		}
		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, []);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "relative",
		ref,
		children: [placement === "dock" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
			type: "button",
			onClick: () => setOpen(!open),
			className: cn("relative flex min-h-[44px] min-w-[44px] flex-col items-center justify-center rounded-full px-2 py-1 transition-all duration-150 gap-0.5 cursor-pointer", open || isFlickMatch ? "text-gold font-semibold" : "text-muted hover:text-foreground active:scale-90"),
			title: "Living Room Party & Games",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Users, { className: cn("size-5 transition-transform", (open || isFlickMatch) && "scale-110 text-gold") }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "text-[10px] tracking-tight",
				children: "Party"
			})]
		}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
			type: "button",
			onClick: () => setOpen(!open),
			className: cn("flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition-all duration-200 cursor-pointer border", open || isFlickMatch ? "border-gold/50 bg-gold/20 text-gold shadow-sm" : "border-border/60 bg-card/60 text-muted hover:text-foreground hover:border-gold/30 active:scale-95"),
			title: "Living Room Social & Games",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Users, { className: "size-3.5 text-gold" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Party" })]
		}), open && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "fixed inset-0 z-50 bg-black/60 backdrop-blur-xs md:hidden",
			onClick: () => setOpen(false)
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: cn("z-50 rounded-3xl border border-white/15 bg-card/95 p-3.5 backdrop-blur-3xl shadow-2xl animate-in fade-in duration-150", placement === "dock" ? "fixed bottom-20 inset-x-4 max-w-sm mx-auto slide-in-from-bottom-4 md:absolute md:inset-x-auto md:right-0 md:bottom-full md:mb-2 md:w-64" : "fixed inset-x-4 top-16 max-w-sm mx-auto zoom-in-95 md:absolute md:inset-x-auto md:right-0 md:top-full md:mt-2 md:w-64"),
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center justify-between px-2 pb-3 border-b border-white/10 mb-2.5",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "flex size-7 items-center justify-center rounded-xl bg-gold/15 text-gold border border-gold/25",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Users, { className: "size-3.5" })
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h4", {
							className: "font-display text-xs font-bold text-foreground",
							children: "Living Room Social"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-[10px] text-muted",
							children: "Party games, TV remote & guests"
						})] })]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: () => setOpen(false),
						className: "flex size-6 items-center justify-center rounded-full text-muted hover:text-foreground hover:bg-white/10 transition-colors md:hidden cursor-pointer",
						"aria-label": "Close",
						children: "✕"
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
					to: "/flickmatch",
					onClick: () => setOpen(false),
					className: "flex items-center gap-3 rounded-2xl p-2.5 text-sm text-foreground hover:bg-white/5 active:scale-[0.98] transition-all bg-card-2/50 border border-white/5 hover:border-gold/30 mb-2 group",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "flex size-9 items-center justify-center rounded-xl bg-gold/15 text-gold border border-gold/25 group-hover:bg-gold group-hover:text-black transition-colors shrink-0",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sparkles, { className: "size-4" })
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-col min-w-0 flex-1",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center justify-between",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "font-semibold text-xs text-foreground",
								children: "FlickMatch"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "rounded-full bg-gold/15 text-gold px-1.5 py-0.2 text-[9px] font-bold tracking-wider uppercase",
								children: "Party"
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-[10px] text-muted truncate",
							children: "Match movies together on your phones"
						})]
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					type: "button",
					onClick: () => {
						setOpen(false);
						setActiveRemote({ open: true });
					},
					className: "w-full flex items-center gap-3 rounded-2xl p-2.5 text-sm text-foreground hover:bg-white/5 active:scale-[0.98] transition-all bg-card-2/50 border border-white/5 hover:border-circuit/30 mb-2 group text-left cursor-pointer",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "flex size-9 items-center justify-center rounded-xl bg-circuit/15 text-circuit border border-circuit/25 group-hover:bg-circuit group-hover:text-black transition-colors shrink-0",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Smartphone, { className: "size-4" })
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-col min-w-0 flex-1",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center justify-between",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "font-semibold text-xs text-foreground",
								children: "Virtual TV Remote"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "rounded-full bg-circuit/15 text-circuit px-1.5 py-0.2 text-[9px] font-bold tracking-wider uppercase",
								children: "Control"
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-[10px] text-muted truncate",
							children: "Control living room TV playback"
						})]
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center justify-between rounded-2xl p-2.5 bg-card-2/50 border border-white/5",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-2.5 min-w-0 pr-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "flex size-8 items-center justify-center rounded-xl bg-white/5 text-gold border border-white/10 shrink-0",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Users, { className: "size-3.5" })
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex flex-col min-w-0",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-xs font-semibold text-foreground truncate",
								children: "Guest Pass QR"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-[10px] text-muted truncate",
								children: "Scan to connect instantly"
							})]
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(GuestQrPopover, { compact: true })]
				})
			]
		})] })]
	});
}
function FullscreenToggle() {
	const [isFullscreen, setIsFullscreen] = (0, import_react.useState)(false);
	(0, import_react.useEffect)(() => {
		const handleFsChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
		document.addEventListener("fullscreenchange", handleFsChange);
		const handleKeyDown = (e) => {
			if (e.key === "F11") {
				e.preventDefault();
				if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {});
				else document.exitFullscreen().catch(() => {});
			}
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => {
			document.removeEventListener("fullscreenchange", handleFsChange);
			window.removeEventListener("keydown", handleKeyDown);
		};
	}, []);
	const toggleFullscreen = () => {
		if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {});
		else document.exitFullscreen().catch(() => {});
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
		type: "button",
		onClick: toggleFullscreen,
		className: cn("flex h-9 items-center justify-center rounded-full px-3 text-muted hover:text-gold hover:bg-white/5 transition-all cursor-pointer", isFullscreen && "text-gold bg-gold/15 hover:bg-gold/25"),
		title: isFullscreen ? "Exit Fullscreen Cinema (Esc / F11)" : "Fullscreen Cinema OS (F11)",
		"aria-label": isFullscreen ? "Exit Fullscreen Cinema" : "Fullscreen Cinema OS",
		children: isFullscreen ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Minimize, { className: "size-4 text-gold" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Maximize, { className: "size-4" })
	});
}
function Shell({ children, personalProfileName }) {
	const path = useRouterState({ select: (s) => s.location.pathname });
	const arena = useReelStore((s) => s.settings.betaChannel);
	const activeRemote = useReelStore((s) => s.activeRemote);
	const setActiveRemote = useReelStore((s) => s.setActiveRemote);
	useReelStore((s) => s.ipv4);
	useReelStore((s) => s.tailscaleIp);
	useReelStore((s) => s.watch);
	typeof window !== "undefined" && window.location.hostname;
	const watchProgress = useReelStore((s) => s.watchProgress);
	const resumeId = (0, import_react.useMemo)(() => {
		const entries = Object.entries(watchProgress).filter(([, p]) => p > .02 && p < .98);
		if (entries.length > 0) return entries[0][0];
		return null;
	}, [watchProgress]);
	const brand = arena ? "Arena" : "ReelOS";
	useReelStore((s) => transferringChipCount(inFlightRequests(s.requests, { titles: s.shelf })));
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: cn("cinema-app min-h-dvh bg-background", arena && "relative overflow-hidden"),
		children: [
			arena ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircuitFloor, { className: "fixed inset-0 z-0 opacity-80" }) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ApplyingBar, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LibraryCatchupBar, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(UsbHotplugBanner, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ToastHost, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
				className: "cinema-header sticky top-0 z-40 hidden h-[72px] w-full items-center justify-between px-6 md:flex lg:px-12 xl:px-16",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-6",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
						to: "/",
						className: "group flex items-center gap-3 transition-transform active:scale-95 pr-4 border-r border-white/10",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "relative flex size-8 items-center justify-center rounded-xl bg-gold/15 shadow-[0_0_16px_rgba(212,160,23,0.25)] transition-all group-hover:scale-105 group-hover:bg-gold/25 border border-gold/30",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ReelMark, { className: "size-4.5 text-gold" })
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "font-display font-black tracking-tight text-lg text-foreground group-hover:text-gold transition-colors",
							children: brand
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("nav", {
						className: "flex items-center gap-1.5",
						children: MINIMAL_NAV.map((n) => {
							const on = navOn(path, n.to);
							return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
								to: n.to,
								className: cn("relative flex h-9 items-center gap-2 rounded-full px-4 text-xs font-semibold tracking-wide transition-all duration-200", on ? "bg-white/12 text-foreground shadow-sm border border-white/10 font-bold" : "text-muted hover:bg-white/5 hover:text-foreground active:scale-95"),
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(n.icon, { className: "size-3.5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: n.label })]
							}, n.to);
						})
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-2.5",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PartyHub, {}),
						resumeId ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
							to: "/play/$id",
							params: { id: resumeId },
							className: "flex h-9 items-center gap-1.5 rounded-full bg-gold/15 px-3.5 text-xs font-bold text-gold hover:bg-gold/25 transition-all border border-gold/30",
							title: "Resume watching in native player",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Clapperboard, { className: "size-3.5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Resume" })]
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
							to: "/tv",
							className: "flex h-9 items-center gap-1.5 rounded-full bg-gold/15 px-3.5 text-xs font-bold text-gold hover:bg-gold/25 transition-all border border-gold/30",
							title: "Watch on Living Room TV / Couch Mode",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Clapperboard, { className: "size-3.5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Watch" })]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FullscreenToggle, {}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
							to: "/tv",
							className: "flex h-9 items-center justify-center rounded-full px-3 text-muted hover:text-gold hover:bg-white/5 transition-all",
							title: "Couch Mode",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MonitorPlay, { className: "size-4" })
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
							to: "/guide",
							className: "flex h-9 items-center justify-center rounded-full px-3 text-muted hover:text-foreground hover:bg-white/5 transition-all",
							title: "Appliance Guide",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleHelp, { className: "size-4" })
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
							to: "/settings",
							className: "flex h-9 items-center justify-center rounded-full px-3 text-muted hover:text-foreground hover:bg-white/5 transition-all",
							title: "Settings",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Settings, { className: "size-4" })
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "pl-2 border-l border-white/10",
							children: personalProfileName ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
								to: "/",
								"aria-label": "Profiles on Home",
								className: "inline-flex min-h-[48px] min-w-[48px] items-center rounded-full px-4 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold",
								children: personalProfileName
							}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ProfileSwitcher, { compact: true })
						})
					]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
				className: "relative z-20 flex items-center justify-between px-4 py-3 md:hidden",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
					to: "/",
					className: "flex size-10 items-center justify-center rounded-xl active:scale-95",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "flex size-8 items-center justify-center rounded-xl bg-gold/15 p-1.5 text-gold border border-gold/25",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ReelMark, { className: "size-5" })
					})
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-1.5",
					children: [
						resumeId ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
							to: "/play/$id",
							params: { id: resumeId },
							className: "flex h-9 items-center gap-1.5 rounded-full bg-gold/15 px-3 text-xs font-semibold text-gold border border-gold/30 active:scale-95",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Clapperboard, { className: "size-3.5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Resume" })]
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
							to: "/tv",
							className: "flex h-9 items-center gap-1.5 rounded-full bg-gold/15 px-3 text-xs font-semibold text-gold border border-gold/30 active:scale-95",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Clapperboard, { className: "size-3.5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Watch" })]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PartyHub, { placement: "header" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
							to: "/tv",
							className: "flex size-10 items-center justify-center rounded-full text-muted hover:text-gold active:scale-90",
							title: "Couch Mode",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MonitorPlay, { className: "size-5" })
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
							to: "/guide",
							className: "flex size-10 items-center justify-center rounded-full text-muted hover:text-gold active:scale-90",
							title: "Appliance Guide",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleHelp, { className: "size-5" })
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "pl-1",
							children: personalProfileName ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
								to: "/",
								"aria-label": "Profiles on Home",
								className: "inline-flex min-h-[48px] min-w-[48px] items-center rounded-full px-4 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold",
								children: personalProfileName
							}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ProfileSwitcher, { compact: true })
						})
					]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "flex min-w-0 flex-1 flex-col overflow-x-clip pb-24 md:pb-12 pt-0",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("main", {
					className: "min-w-0 flex-1",
					children
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(VirtualRemote, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "fixed inset-x-0 bottom-0 z-30 pointer-events-none flex justify-center pb-[max(env(safe-area-inset-bottom),0.75rem)] px-3 md:hidden",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("nav", {
					className: "pointer-events-auto flex items-center justify-around w-full max-w-[390px] rounded-full border border-white/15 bg-background/90 px-1.5 py-1.5 backdrop-blur-3xl shadow-[0_8px_32px_rgba(0,0,0,0.6)]",
					children: [
						MINIMAL_NAV.map((n) => {
							const on = navOn(path, n.to);
							return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
								to: n.to,
								className: cn("relative flex min-h-[44px] min-w-[44px] flex-col items-center justify-center rounded-full px-1.5 py-1 transition-all duration-150 gap-0.5", on ? "text-gold font-semibold" : "text-muted hover:text-foreground active:scale-90"),
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(n.icon, { className: cn("size-5 transition-transform", on && "scale-110 text-gold") }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-[10px] tracking-tight",
									children: n.label
								})]
							}, n.to);
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PartyHub, { placement: "dock" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							onClick: () => setActiveRemote({ open: !activeRemote.open }),
							className: cn("relative flex min-h-[44px] min-w-[44px] flex-col items-center justify-center rounded-full px-1.5 py-1 transition-all duration-150 gap-0.5 text-muted hover:text-foreground active:scale-90 cursor-pointer", activeRemote.open && "text-gold font-semibold"),
							title: "TV Remote",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Smartphone, { className: cn("size-5 transition-transform", activeRemote.open && "scale-110 text-gold") }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-[10px] tracking-tight",
								children: "Remote"
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
							to: "/settings",
							className: cn("relative flex min-h-[44px] min-w-[44px] flex-col items-center justify-center rounded-full px-1.5 py-1 transition-all duration-150 gap-0.5 text-muted hover:text-foreground active:scale-90", navOn(path, "/settings") && "text-gold font-semibold"),
							title: "Settings",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Settings, { className: cn("size-5 transition-transform", navOn(path, "/settings") && "scale-110 text-gold") }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-[10px] tracking-tight",
								children: "Settings"
							})]
						})
					]
				})
			})
		]
	});
}
/** Full-screen apply splash. Copy: Updating ReelOS. Fail splash: Update failed, still on previous.
* Honest % is tarball/extract bytes — never a fake climbing percent.
* Contract anchor: Library catching up */
var STEPS = [
	{
		id: "local",
		label: "Local state"
	},
	{
		id: "house",
		label: "This house"
	},
	{
		id: "library",
		label: "Library"
	},
	{
		id: "requests",
		label: "Requests"
	}
];
function stepLabel(status) {
	if (status === "ok") return "Ready";
	if (status === "fail") return "Still filling";
	if (status === "running") return "Working";
	return "Waiting";
}
function UpdatingSplash() {
	const [tune, setTune] = (0, import_react.useState)("");
	const [progress, setProgress] = (0, import_react.useState)(null);
	(0, import_react.useEffect)(() => {
		fetch("/api/hardware", { cache: "no-store" }).then((r) => r.json()).then((j) => setTune(j.splashTune || j.summary || "")).catch(() => {});
	}, []);
	(0, import_react.useEffect)(() => {
		let alive = true;
		const tick = () => {
			fetch("/api/update/status", { cache: "no-store" }).then((r) => r.json()).then((j) => {
				if (alive && j.progress) setProgress(j.progress);
			}).catch(() => {});
		};
		tick();
		const id = window.setInterval(tick, 2e3);
		return () => {
			alive = false;
			window.clearInterval(id);
		};
	}, []);
	const pct = typeof progress?.percent === "number" ? progress.percent : null;
	const line = progress?.stalled ? "Download stalled — 0 bytes for 2+ minutes" : progress?.message || "Download, extract, clean leftover builds, restart the door.";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-background px-6 text-center",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				"aria-hidden": true,
				className: "pointer-events-none absolute left-1/2 top-[28%] size-[36rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gold/12 blur-[120px]"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "rise relative",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Wordmark, {
					className: "flex-col gap-5",
					markClassName: "size-20",
					spinRing: true
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "rise rise-2 mt-8 font-display text-sm tracking-[0.34em] text-gold-bright uppercase",
				children: "Updating ReelOS…"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "rise rise-3 mx-auto mt-5 max-w-md text-[15px] leading-relaxed text-muted",
				"aria-live": "polite",
				children: line
			}),
			pct != null ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "rise rise-4 mx-auto mt-4 w-full max-w-xs",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "font-display text-2xl tabular-nums text-gold-bright",
						children: [pct, "%"]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mt-2 h-1.5 overflow-hidden rounded-full bg-faint",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "h-full rounded-full bg-gold",
							style: { width: `${pct}%` }
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-2 text-xs text-muted",
						children: "Tarball / extract bytes — not a timer."
					})
				]
			}) : progress?.stageIndex ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "rise rise-4 mx-auto mt-3 max-w-md text-sm text-muted",
				children: [
					progress.label || "Working",
					" · ",
					progress.stageIndex,
					"/",
					progress.stageCount || 7,
					progress.heartbeatAgo ? ` · ${progress.heartbeatAgo}` : ""
				]
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "rise rise-4 mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-muted",
				children: "Browse and request come back when this page lifts."
			}),
			tune ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "rise rise-4 mx-auto mt-3 max-w-md text-sm text-gold-bright",
				children: tune
			}) : null
		]
	});
}
function FailedSplash() {
	const continueOnPrevious = () => {
		const cur = useReelStore.getState().update;
		useReelStore.setState({ update: {
			...cur,
			status: "current",
			target: null,
			notes: []
		} });
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-background px-6 text-center",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				"aria-hidden": true,
				className: "pointer-events-none absolute left-1/2 top-[28%] size-[36rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gold/12 blur-[120px]"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "rise relative",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Wordmark, {
					className: "flex-col gap-5",
					markClassName: "size-20"
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "rise rise-2 mt-8 font-display text-sm tracking-[0.34em] text-gold-bright uppercase",
				children: "Update failed, still on previous"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "rise rise-3 mx-auto mt-5 max-w-md text-[15px] leading-relaxed text-muted",
				children: "ReelOS did not stamp this update. This box is still the version that was already running. Browse and request still work."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "rise rise-4 mt-8",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					size: "lg",
					onClick: continueOnPrevious,
					children: "Continue"
				})
			})
		]
	});
}
function Splash({ compact = false, warming = false, updating = false, failed = false }) {
	const provisioned = useReelStore((s) => s.provisioned);
	const bootSteps = useReelStore((s) => s.bootSteps);
	const catchup = useReelStore((s) => s.libraryCatchup);
	const showWarming = warming || provisioned;
	const libraryWorking = catchupLocksHome(catchup) || bootSteps.library === "running";
	const begin = () => {
		useReelStore.getState().setPhase("wizard");
		useReelStore.getState().setWizardStep(1);
	};
	(0, import_react.useEffect)(() => {
		if (!provisioned && !warming && !updating && !failed) begin();
	}, [
		provisioned,
		warming,
		updating,
		failed
	]);
	if (updating) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(UpdatingSplash, {});
	if (failed) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FailedSplash, {});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-background px-6 text-center",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				"aria-hidden": true,
				className: "pointer-events-none absolute left-1/2 top-[28%] size-[36rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gold/12 blur-[120px]"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "rise relative",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Wordmark, {
					className: "flex-col gap-5",
					markClassName: "size-20",
					spinRing: showWarming && libraryWorking
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "rise rise-2 mt-8 font-display text-sm tracking-[0.34em] text-gold-bright uppercase",
				children: "Install. Point. Stream."
			}),
			showWarming ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "rise rise-3 mx-auto mt-8 flex flex-col items-center gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center justify-center gap-3 text-sm text-muted",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "relative flex size-2.5",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "absolute inline-flex size-full animate-ping rounded-full bg-gold opacity-75" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "relative inline-flex size-2.5 rounded-full bg-gold" })]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Connecting to local appliance…" })]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mt-2 flex flex-wrap justify-center gap-2",
					children: STEPS.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: cn("rounded-full px-2.5 py-0.5 text-[11px] font-medium border transition-colors", bootSteps[s.id] === "ok" ? "border-gold/40 bg-gold/10 text-gold" : bootSteps[s.id] === "running" ? "border-live/40 bg-live/10 text-live" : "border-border bg-card text-muted"),
						children: [
							s.label,
							": ",
							stepLabel(bootSteps[s.id])
						]
					}, s.id))
				})]
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "rise rise-4 mt-8",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					size: "lg",
					onClick: begin,
					children: "Begin setup"
				})
			})
		]
	});
}
function Gate({ children, chrome = true, personalSetup = false }) {
	const [personalReady, setPersonalReady] = (0, import_react.useState)(null);
	const [personalName, setPersonalName] = (0, import_react.useState)("Your profile");
	(0, import_react.useEffect)(() => {
		if (!personalSetup) return;
		const controller = new AbortController();
		fetch("/api/profiles", {
			cache: "no-store",
			signal: controller.signal
		}).then(async (response) => {
			if (!response.ok) throw new Error("Profile unavailable");
			const payload = await response.json();
			const active = payload.profiles?.find((profile) => profile.id === payload.activeId);
			if (!controller.signal.aborted) {
				const ready = payload.auth?.authenticated === true && payload.setup?.status === "complete" && !!active && !active.isKids;
				if (ready) {
					useExperienceStore.setState({ activeProfileId: active.id });
					setPersonalName(typeof active.name === "string" ? active.name : "Your profile");
				}
				setPersonalReady(ready);
			}
		}).catch(() => {
			if (!controller.signal.aborted) setPersonalReady(false);
		});
		return () => controller.abort();
	}, [personalSetup]);
	const hydrated = useReelStore((s) => s.hydrated);
	const provisioned = useReelStore((s) => s.provisioned);
	const phase = useReelStore((s) => s.phase);
	const applying = useReelStore((s) => updateLocksUi(s.update.status));
	const failed = useReelStore((s) => s.update.status === "error");
	const remoteChallenged = useReelStore((s) => s.remoteChallenged);
	if (!hydrated) return null;
	if (remoteChallenged) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(HouseholdGateView, {});
	if (personalSetup) {
		if (applying) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Splash, { updating: true });
		if (failed) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Splash, { failed: true });
		if (personalReady === null) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("main", {
			className: "min-h-dvh bg-black",
			"aria-label": "Opening your profile"
		});
		if (!personalReady) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Navigate, { to: "/" });
		return chrome ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Shell, {
			personalProfileName: personalName,
			children
		}) : children;
	}
	if (!provisioned || phase === "wizard" || phase === "splash") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Navigate, { to: "/" });
	if (phase === "building") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Provision, {});
	if (applying) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Splash, { updating: true });
	if (failed) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Splash, { failed: true });
	if (!chrome) return children;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Shell, { children });
}
//#endregion
export { ResidentAvatar as a, QrCodeSvg as i, GuestQrPopover as n, ProfileSwitcher as r, Gate as t };
