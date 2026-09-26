import test from "node:test";
import assert from "node:assert/strict";
import { InFlightReads } from "../server/in-flight-reads.ts";

test("200 concurrent readers share one pending query and receive isolated snapshots", async () => {
  const reads = new InFlightReads();
  let calls = 0;
  const load = async () => { calls++; return [{name:"Original"}]; };
  const results = await Promise.all(Array.from({length:200}, () => reads.read("catalog",load)));
  assert.equal(calls,1);
  results[0][0].name = "Changed";
  assert.equal(results[1][0].name,"Original");
  await reads.read("catalog",load);
  assert.equal(calls,2,"Completed results must not be cached");
});

test("failed queries retry and invalidation cannot discard a newer pending query", async () => {
  const reads = new InFlightReads();
  await assert.rejects(reads.read("catalog",async () => {throw new Error("offline");}));
  assert.equal(await reads.read("catalog",async () => "recovered"),"recovered");
  let finishOld!: (value:string) => void, finishNew!: (value:string) => void;
  const old = reads.read("catalog",() => new Promise<string>(resolve => {finishOld=resolve;}));
  await Promise.resolve();
  reads.clear();
  const fresh = reads.read("catalog",() => new Promise<string>(resolve => {finishNew=resolve;}));
  await Promise.resolve();
  finishOld("old");
  await old;
  const joined = reads.read("catalog",async () => "incorrect second query");
  finishNew("new");
  assert.deepEqual(await Promise.all([fresh,joined]),["new","new"]);
});
