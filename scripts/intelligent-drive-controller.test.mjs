import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { pythonBin } from "./test-python.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function read(rel) {
  return readFileSync(join(root, rel), "utf8");
}

test("intelligent drive controller logic in daemon/wiring/hardware.py", () => {
  const code = read("daemon/wiring/hardware.py");
  assert.match(code, /def is_debrid_mode/);
  assert.match(code, /def has_active_disk_writes/);
  assert.match(code, /def query_drive_power_state/);
  assert.match(code, /def optimize_rotational_storage/);
  assert.match(code, /-B["\s,]+127/);
  assert.match(code, /-B["\s,]+254/);
  assert.match(code, /PRAGMA temp_store = MEMORY/);
  assert.match(code, /PRAGMA synchronous = NORMAL/);
  assert.match(code, /PRAGMA journal_mode = WAL/);
});

test("intelligent drive controller contracts (pure Debrid vs Local active writes)", () => {
  const pyCode = `
import sys, json, tempfile
from pathlib import Path
from unittest.mock import patch, MagicMock

sys.path.insert(0, "${root.replace(/\\/g, "/")}")
import daemon.wiring.hardware as hw
import daemon.wiring.common as common

# Test 1: is_debrid_mode detection
with patch.object(hw, "answers", return_value={"storageMode": "debrid", "source": "torbox"}):
    assert hw.is_debrid_mode() is True, "Pure debrid should return True"

with patch.object(hw, "answers", return_value={"storageMode": "local", "source": "torbox"}):
    assert hw.is_debrid_mode() is False, "Local mode should return False"

with patch.object(hw, "answers", return_value={"storageMode": "both", "source": "torbox"}):
    assert hw.is_debrid_mode() is False, "Both mode should return False"

with patch.object(hw, "answers", return_value={"storageMode": "debrid", "source": "local-vpn"}):
    assert hw.is_debrid_mode() is False, "Local-vpn source should return False"

# Test 2: Active write detection via marker
with tempfile.TemporaryDirectory() as td:
    state = Path(td)
    with patch.object(hw, "STATE", state):
        assert hw.has_active_disk_writes("sda") is False
        (state / "downloads-active.json").write_text(json.dumps({"active": True}))
        assert hw.has_active_disk_writes("sda") is True
        (state / "downloads-active.json").write_text(json.dumps({"active": False}))
        assert hw.has_active_disk_writes("sda") is False

# Test 3: Spindown enforcement in Debrid mode vs write-suspension in Local mode
executed_cmds = []
def mock_run(cmd, *args, **kwargs):
    executed_cmds.append(cmd)
    m = MagicMock()
    m.stdout = "drive state is:  standby\\n"
    m.returncode = 0
    return m

# Mock /sys/block/sda rotational
with tempfile.TemporaryDirectory() as td:
    sys_block = Path(td) / "sys_block"
    sda = sys_block / "sda"
    sda.mkdir(parents=True)
    (sda / "queue").mkdir()
    (sda / "queue" / "rotational").write_text("1\\n")

    with patch.object(hw, "hardware_profile", return_value={"disk_kind": "rotational"}), \\
         patch("pathlib.Path.glob", return_value=[sda]), \\
         patch("subprocess.run", side_effect=mock_run):

        # Scenario A: Pure Debrid mode -> APM 127, 5-min spindown
        executed_cmds.clear()
        with patch.object(hw, "is_debrid_mode", return_value=True), \\
             patch.object(hw, "has_active_disk_writes", return_value=False):
            res = hw.optimize_rotational_storage()
            assert res["status"] == "ok"
            assert res["debrid_mode"] is True
            assert res["drives"][0]["apm"] == 127
            assert res["drives"][0]["timeout_sec"] == 300
            assert ["hdparm", "-B", "127", "-S", "60", "/dev/sda"] in executed_cmds

        # Scenario B: Local download mode with active writes -> APM 254, suspended (timeout 0)
        executed_cmds.clear()
        with patch.object(hw, "is_debrid_mode", return_value=False), \\
             patch.object(hw, "has_active_disk_writes", return_value=True):
            res = hw.optimize_rotational_storage()
            assert res["status"] == "ok"
            assert res["drives"][0]["apm"] == 254
            assert res["drives"][0]["timeout_sec"] == 0
            assert ["hdparm", "-B", "254", "-S", "0", "/dev/sda"] in executed_cmds

print("intelligent drive controller contracts ok")
`;

  const r = spawnSync(pythonBin(), ["-c", pyCode], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr || r.stdout);
  assert.match(r.stdout, /intelligent drive controller contracts ok/);
});
