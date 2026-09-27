import { test } from "node:test";
import assert from "node:assert/strict";
import { pdfCanvasScale } from "../src/pdf-layout.ts";

test("PDF canvases remain within memory budget across mobile, zoom and fullscreen", () => {
  for (const width of [320, 768, 1440, 3840]) {
    for (const zoom of [0.75, 1, 2]) {
      for (const density of [1, 2, 3]) {
        const w = width * zoom;
        const h = w * Math.SQRT2;
        const ratio = pdfCanvasScale(w, h, density);
        assert.ok(Math.floor(w * ratio) * Math.floor(h * ratio) <= 4_000_000);
        assert.ok(ratio > 0 && ratio <= Math.min(density, 2));
      }
    }
  }
  assert.equal(
    pdfCanvasScale(320, 453, 2),
    2,
    "Keep sharp rendering when the memory budget allows it",
  );
});
