import assert from "node:assert/strict";
import test from "node:test";
import { createXlsxWorkbook } from "../src/xlsx.ts";

test("attendance workbook is a genuine XLSX package with date sheets", () => {
  const workbook = createXlsxWorkbook([
    { name: "Summary", headerRows: 1, rows: [["Attendance analysis"]] },
    {
      name: "2026-09-23",
      headerRows: 1,
      rows: [
        ["Group / Section", "Student name", "Attendance"],
        ["Section-A", "Test Student", "Present"],
      ],
    },
  ]);
  assert.deepEqual([...workbook.slice(0, 4)], [0x50, 0x4b, 0x03, 0x04]);
  assert.deepEqual([...workbook.slice(-22, -18)], [0x50, 0x4b, 0x05, 0x06]);
  const packageText = Buffer.from(workbook).toString("utf8");
  assert.match(
    packageText,
    /application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet\.main\+xml/,
  );
  assert.match(packageText, /sheet name="2026-09-23"/);
  assert.match(packageText, /Section-A/);
});
