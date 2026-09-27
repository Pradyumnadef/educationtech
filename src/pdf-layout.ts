// Bound canvas allocations on high-DPI phones and large fullscreen displays.
// CSS dimensions remain unchanged, so zoom and page navigation still work.
export function pdfCanvasScale(
  width: number,
  height: number,
  deviceRatio: number,
) {
  const pixels = Math.max(1, width * height);
  return Math.min(
    Math.max(1, deviceRatio || 1),
    2,
    Math.sqrt(4_000_000 / pixels),
  );
}
