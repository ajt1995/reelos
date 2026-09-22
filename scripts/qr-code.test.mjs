import test from "node:test";
import assert from "node:assert/strict";
import { qrcodegen } from "../src/lib/qrcodegen.ts";

test("qrcodegen generates valid QR matrix for FlickMatch URLs", () => {
  const url = "http://192.168.1.234:8080/flickmatch?room=TR8K";
  const qr = qrcodegen.QrCode.encodeText(url, qrcodegen.QrCode.Ecc.MEDIUM);

  assert.ok(qr, "QR code object must be returned");
  assert.ok(qr.size >= 21 && qr.size <= 177, `QR size ${qr.size} must be valid`);
  assert.equal(qr.size % 4, 1, "QR size must equal version * 4 + 17");

  // Top-left finder pattern verification (7x7)
  // Outer perimeter must be dark
  for (let i = 0; i < 7; i++) {
    assert.equal(qr.getModule(i, 0), true, `Top-left row 0 col ${i} must be dark`);
    assert.equal(qr.getModule(i, 6), true, `Top-left row 6 col ${i} must be dark`);
    assert.equal(qr.getModule(0, i), true, `Top-left col 0 row ${i} must be dark`);
    assert.equal(qr.getModule(6, i), true, `Top-left col 6 row ${i} must be dark`);
  }

  // Inner ring must be light
  for (let i = 1; i < 6; i++) {
    assert.equal(qr.getModule(i, 1), false, `Inner ring row 1 col ${i} must be light`);
    assert.equal(qr.getModule(i, 5), false, `Inner ring row 5 col ${i} must be light`);
    assert.equal(qr.getModule(1, i), false, `Inner ring col 1 row ${i} must be light`);
    assert.equal(qr.getModule(5, i), false, `Inner ring col 5 row ${i} must be light`);
  }

  // Center 3x3 of top-left finder must be dark
  for (let y = 2; y <= 4; y++) {
    for (let x = 2; x <= 4; x++) {
      assert.equal(qr.getModule(x, y), true, `Center module (${x},${y}) must be dark`);
    }
  }

  // Top-right finder pattern (center must be dark)
  assert.equal(qr.getModule(qr.size - 4, 3), true, "Top-right finder center must be dark");

  // Bottom-left finder pattern (center must be dark)
  assert.equal(qr.getModule(3, qr.size - 4), true, "Bottom-left finder center must be dark");
});

test("qrcodegen handles room codes and various lengths", () => {
  const shortUrl = "http://reelos.local/flickmatch";
  const qrShort = qrcodegen.QrCode.encodeText(shortUrl, qrcodegen.QrCode.Ecc.LOW);
  assert.ok(qrShort.size >= 21);

  const longUrl = "http://192.168.1.234:8080/flickmatch?room=WXYZ&resident=Resident&ref=couch";
  const qrLong = qrcodegen.QrCode.encodeText(longUrl, qrcodegen.QrCode.Ecc.HIGH);
  assert.ok(qrLong.size >= qrShort.size);
});
