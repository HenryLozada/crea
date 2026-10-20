// node --test crea/verify.test.mjs
// The renderer/verdict tests use SYNTHETIC ledgers (marked below) to cover the
// contradicted and verified branches. The end-to-end test runs the real REA CLI.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { toRequest, ledgerOf, verdict, render, exitCodeOf } from "./verify.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));

const ledger = (over = {}) => ({
  schema: "ReconstructionObligationLedger",
  ledger_id: "rol_synthetic",
  closure_digest: "synthetic",
  status: "unknown",
  summary: { total: 0, required: 0, verified: 0, required_open: 0 },
  reports: {
    missing_owner_obligation_ids: [],
    missing_verifier_obligation_ids: [],
    contradicted_obligation_ids: [],
    residual_unknown_ids: [],
  },
  limitations: [],
  ...over,
});

test("bare evidence bundle is wrapped into a full request", () => {
  const r = toRequest({ records: [] });
  assert.deepEqual(r.reviewed_obligations, []);
  assert.deepEqual(r.manifest, { bindings: [], contradictions: [] });
  assert.equal(r.evidence_bundle.artifacts.length, 0);
});

test("unknown input is rejected", () => {
  assert.throws(() => toRequest({ foo: 1 }));
});

test("non-ledger output is rejected", () => {
  assert.throws(() => ledgerOf({ normalized_result: { schema: "Other" } }));
});

test("empty ledger is open, never verified", () => {
  const v = verdict(ledger());
  assert.equal(v.state, "open");
  assert.equal(exitCodeOf(v), 1);
});

test("SYNTHETIC: any contradiction wins over everything", () => {
  const v = verdict(ledger({
    status: "verified",
    summary: { total: 2, required: 2, verified: 2, required_open: 0 },
    reports: { ...ledger().reports, contradicted_obligation_ids: ["cli.parse"] },
  }));
  assert.equal(v.state, "contradicted");
  assert.equal(exitCodeOf(v), 2);
  assert.match(render(v), /alucin/);
});

test("SYNTHETIC: verified only when REA says verified and nothing required is open", () => {
  const ok = verdict(ledger({ status: "verified", summary: { total: 1, required: 1, verified: 1, required_open: 0 } }));
  assert.equal(ok.state, "verified");
  const stillOpen = verdict(ledger({ status: "verified", summary: { total: 2, required: 2, verified: 1, required_open: 1 } }));
  assert.equal(stillOpen.state, "open");
});

test("end-to-end: real REA CLI on the empty request reports open", () => {
  const res = spawnSync(process.execPath, [resolve(HERE, "verify.mjs"), resolve(HERE, "examples/empty-request.json"), "--json"], { encoding: "utf8" });
  assert.equal(res.status, 1, res.stderr);
  const v = JSON.parse(res.stdout);
  assert.equal(v.state, "open");
  assert.equal(v.ledger_status, "unknown");
  assert.ok(v.limitations.some((l) => /closure cannot be claimed/.test(l)));
});
