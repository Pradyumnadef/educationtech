import test from "node:test";
import assert from "node:assert/strict";
import { parseByteRange } from "../server/byte-range.ts";

test("media ranges support suffixes, open ends and oversized end positions", () => {
  assert.equal(parseByteRange(undefined, 100), undefined);
  assert.deepEqual(parseByteRange("bytes=0-0", 100), { start: 0, end: 0 });
  assert.deepEqual(parseByteRange("bytes=90-", 100), { start: 90, end: 99 });
  assert.deepEqual(parseByteRange("bytes=-10", 100), { start: 90, end: 99 });
  assert.deepEqual(parseByteRange("bytes=-99999999999999999999", 100), { start: 0, end: 99 });
  assert.deepEqual(parseByteRange("bytes=90-99999999999999999999", 100), { start: 90, end: 99 });
});

test("invalid media ranges are rejected without reaching storage", () => {
  for (const range of ["bytes=-0", "bytes=100-", "bytes=50-40", "bytes=-", "bytes=0-1,5-6", "bytes=1.5-2", "bytes=99999999999999999999-", "items=0-5"])
    assert.equal(parseByteRange(range, 100), null, range);
  assert.equal(parseByteRange("bytes=0-", 0), null);
});
