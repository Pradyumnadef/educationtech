import test from "node:test";
import assert from "node:assert/strict";
import { contentFolderSize, sortDriveEntries } from "../src/drive-utils.ts";

test("drive sorting computes metadata once per entry and preserves the input", () => {
  const entries = [{ name: "B", date: 2, size: 10 }, { name: "A", date: 1, size: 20 }];
  for (const [sort, expected] of Object.entries({ "date-desc": ["B", "A"],
    "date-asc": ["A", "B"], "size-desc": ["A", "B"], "size-asc": ["B", "A"],
    "name-asc": ["A", "B"] })) {
    let calls = 0;
    const result = sortDriveEntries(entries, sort as any, entry => { calls++; return entry; });
    assert.deepEqual(result.map(entry => entry.name), expected);
    assert.equal(calls, entries.length);
    assert.deepEqual(entries.map(entry => entry.name), ["B", "A"]);
  }
});

test("folder sizes handle deeply nested reverse-ordered folders and cycles", () => {
  const entries = Array.from({ length: 10000 }, (_, index) => ({
    id: String(index), parent_id: index ? String(index - 1) : null,
    assets: [{ size: 2 }],
  })).reverse();
  assert.equal(contentFolderSize(entries, "0"), 20000);
  assert.equal(contentFolderSize(entries, "9999"), 2);
  assert.equal(contentFolderSize(entries, "missing"), 0);
  assert.equal(contentFolderSize([
    { id: "a", parent_id: "b", assets: [{ size: 3 }] },
    { id: "b", parent_id: "a", assets: [{ size: 7 }] },
    { id: "c", parent_id: null, assets: [{ size: 100 }] },
  ], "a"), 10);
});
