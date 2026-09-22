import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { pythonBin } from "./test-python.mjs";
import { detectGpuType, hardwareLimits } from "./reelos-box-scale.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function read(rel) {
  return readFileSync(join(root, rel), "utf8");
}

test("detectGpuType in reelos-box-scale.mjs identifies QSV, NVENC, VAAPI, and Potato mode", () => {
  // 1. Potato mode: no DRI, no NVIDIA
  assert.equal(
    detectGpuType({ exists: () => false, readdir: () => [] }),
    "none"
  );

  // 2. NVIDIA NVENC
  assert.equal(
    detectGpuType({ exists: (p) => p === "/dev/nvidiactl" }),
    "nvenc"
  );
  assert.equal(
    detectGpuType({ exists: () => false, pciVendors: ["0x10de"] }),
    "nvenc"
  );

  // 3. Intel QuickSync (QSV) via PCI vendor or CPU model
  assert.equal(
    detectGpuType({
      driPath: "/dev/dri",
      exists: (p) => p === "/dev/dri",
      readdir: () => ["renderD128"],
      pciVendors: ["0x8086"],
    }),
    "qsv"
  );
  assert.equal(
    detectGpuType({
      driPath: "/dev/dri",
      exists: (p) => p === "/dev/dri",
      readdir: () => ["renderD128"],
      cpuModel: "Intel(R) Core(TM) i5-10400 CPU @ 2.90GHz",
    }),
    "qsv"
  );

  // 4. AMD VAAPI
  assert.equal(
    detectGpuType({
      driPath: "/dev/dri",
      exists: (p) => p === "/dev/dri",
      readdir: () => ["renderD128"],
      pciVendors: ["0x1002"],
      cpuModel: "AMD Ryzen 5 3600",
    }),
    "vaapi"
  );
});

test("silicon-first potatoMode: 4GB with QSV/NVENC is NOT potato, CPU-only is potato", () => {
  const qsv4Gb = hardwareLimits({ ramGb: 4, gpuType: "qsv", cpus: 4 });
  assert.equal(qsv4Gb.potatoMode, false);

  const nvenc2Gb = hardwareLimits({ ramGb: 2, gpuType: "nvenc", cpus: 4 });
  assert.equal(nvenc2Gb.potatoMode, false);

  const noGpu4Gb = hardwareLimits({ ramGb: 4, gpuType: "none", cpus: 4 });
  assert.equal(noGpu4Gb.potatoMode, true);
});

test("Python GPU auto-tuning & Potato mode DirectPlay CPU lock in daemon/wiring/jellyfin.py", () => {
  const pyCode = `
import sys
sys.path.insert(0, "${root.replace(/\\/g, "/")}")
import daemon.wiring.jellyfin as jf
import daemon.wiring.hardware as hw

# 1. QuickSync QSV (4K HEVC, H.264, VP9, AV1 enabled)
qsv_enc = jf.jellyfin_encoding_for_box({}, low=False, has_dri=True, gpu_type="qsv")
assert qsv_enc["HardwareAccelerationType"] == "qsv"
assert qsv_enc["EnableHardwareEncoding"] is True
assert qsv_enc["EnableIntelLowPowerH264HwEncoder"] is True
assert qsv_enc["EnableIntelLowPowerHevcHwEncoder"] is True
assert qsv_enc["AllowHevcEncoding"] is True
assert qsv_enc["AllowAv1Encoding"] is True
assert "h264" in qsv_enc["HardwareDecodingCodecs"]
assert "hevc" in qsv_enc["HardwareDecodingCodecs"]
assert "vp9" in qsv_enc["HardwareDecodingCodecs"]
assert "av1" in qsv_enc["HardwareDecodingCodecs"]
assert qsv_enc["EnableDecodingColorDepth10Hevc"] is True
assert qsv_enc["EnableDecodingColorDepth10Vp9"] is True

# 2. NVIDIA NVENC (4K HEVC, H.264, VP9, AV1 enabled)
nv_enc = jf.jellyfin_encoding_for_box({}, low=False, has_dri=True, gpu_type="nvenc")
assert nv_enc["HardwareAccelerationType"] == "nvenc"
assert nv_enc["EnableHardwareEncoding"] is True
assert nv_enc["EnableEnhancedNvdecDecoder"] is True
assert nv_enc["AllowHevcEncoding"] is True
assert nv_enc["AllowAv1Encoding"] is True
assert "h264" in nv_enc["HardwareDecodingCodecs"]
assert "hevc" in nv_enc["HardwareDecodingCodecs"]
assert "vp9" in nv_enc["HardwareDecodingCodecs"]
assert "av1" in nv_enc["HardwareDecodingCodecs"]

# 3. Potato mode: strict DirectPlay CPU lock
potato_enc = jf.jellyfin_encoding_for_box({}, low=True, has_dri=False, gpu_type="none")
assert potato_enc["HardwareAccelerationType"] == "none"
assert potato_enc["EnableHardwareEncoding"] is False
assert potato_enc["EncodingThreadCount"] == 1
assert potato_enc["AllowHevcEncoding"] is False
assert potato_enc["AllowAv1Encoding"] is False
assert potato_enc["HardwareDecodingCodecs"] == []

# 4. Playback policy lock on Potato mode
potato_pol = jf.jellyfin_playback_policy_for_box(
    {"EnableVideoPlaybackTranscoding": True, "EnableAudioPlaybackTranscoding": True},
    has_dri=False,
    gpu_type="none",
)
assert potato_pol["EnableVideoPlaybackTranscoding"] is False
assert potato_pol["EnableAudioPlaybackTranscoding"] is False
assert potato_pol["EnablePlaybackRemuxing"] is True
assert potato_pol["ForceRemoteSourceTranscoding"] is False

# 5. Playback policy enable on QSV
qsv_pol = jf.jellyfin_playback_policy_for_box({}, has_dri=True, gpu_type="qsv")
assert qsv_pol["EnableVideoPlaybackTranscoding"] is True
assert qsv_pol["EnableAudioPlaybackTranscoding"] is True

# 6. Playback policy enable on NVENC
nv_pol = jf.jellyfin_playback_policy_for_box({}, has_dri=True, gpu_type="nvenc")
assert nv_pol["EnableVideoPlaybackTranscoding"] is True
assert nv_pol["EnableAudioPlaybackTranscoding"] is True

# 7. XML Persistence of 4K codecs and acceleration
import tempfile
from pathlib import Path
td = tempfile.mkdtemp()
qsv_xml = jf.persist_jellyfin_encoding_xml(qsv_enc, dest=Path(td) / "qsv_encoding.xml")
qsv_text = qsv_xml.read_text()
assert "<HardwareAccelerationType>qsv</HardwareAccelerationType>" in qsv_text
assert "<EnableHardwareEncoding>true</EnableHardwareEncoding>" in qsv_text
assert "<AllowHevcEncoding>true</AllowHevcEncoding>" in qsv_text
assert "<AllowAv1Encoding>true</AllowAv1Encoding>" in qsv_text
assert "<string>hevc</string>" in qsv_text
assert "<string>av1</string>" in qsv_text

potato_xml = jf.persist_jellyfin_encoding_xml(potato_enc, dest=Path(td) / "potato_encoding.xml")
potato_text = potato_xml.read_text()
assert "<HardwareAccelerationType>none</HardwareAccelerationType>" in potato_text
assert "<EnableHardwareEncoding>false</EnableHardwareEncoding>" in potato_text
assert "<HardwareDecodingCodecs />" in potato_text

print("gpu autotune contracts ok")
`;

  const r = spawnSync(pythonBin(), ["-c", pyCode], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr || r.stdout);
  assert.match(r.stdout, /gpu autotune contracts ok/);
});
