import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

test("scheduling fields round-trip local time across time zones and seasons", () => {
  const helper = new URL("../src/local-date-time.ts", import.meta.url).href;
  for (const [zone, winter, summer] of [
    ["Asia/Kolkata", "2026-01-15T05:30", "2026-07-15T05:30"],
    ["America/New_York", "2026-01-14T19:00", "2026-07-14T20:00"],
    ["UTC", "2026-01-15T00:00", "2026-07-15T00:00"],
  ]) {
    const result = JSON.parse(execFileSync(process.execPath, ["--input-type=module", "-e", `
      import { localDateTime } from ${JSON.stringify(helper)};
      const timestamps = [Date.parse('2026-01-15T00:00:00Z'), Date.parse('2026-07-15T00:00:00Z')];
      console.log(JSON.stringify({values: timestamps.map(localDateTime),
        restored: timestamps.map(t => new Date(localDateTime(t)).getTime()),
        invalid: localDateTime(NaN)}));
    `], { env: { ...process.env, TZ: zone }, encoding: "utf8" }));
    assert.deepEqual(result.values, [winter, summer], zone);
    assert.deepEqual(result.restored, [Date.parse("2026-01-15T00:00:00Z"), Date.parse("2026-07-15T00:00:00Z")], zone);
    assert.equal(result.invalid, "");
  }
});
