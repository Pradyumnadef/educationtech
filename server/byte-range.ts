export type ByteRange = { start: number; end: number };

// undefined means a full response; null means an unsupported/unsatisfiable range.
// Normalize before calling storage so invalid ranges never become upstream 500s.
export function parseByteRange(header: string | undefined, size: number): ByteRange | null | undefined {
  if (header === undefined) return undefined;
  if (!Number.isSafeInteger(size) || size <= 0) return null;
  const match = /^bytes=(\d*)-(\d*)$/i.exec(header.trim());
  if (!match || (!match[1] && !match[2])) return null;
  const length = BigInt(size);
  if (!match[1]) {
    const suffix = BigInt(match[2]);
    if (suffix === 0n) return null;
    return { start: suffix >= length ? 0 : Number(length - suffix), end: size - 1 };
  }
  const start = BigInt(match[1]);
  const end = match[2] ? BigInt(match[2]) : length - 1n;
  if (start >= length || start > end) return null;
  return { start: Number(start), end: Number(end >= length ? length - 1n : end) };
}
