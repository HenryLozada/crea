#!/usr/bin/env node
// crea verify — thin, deterministic layer over REA's
// build_reconstruction_obligation_ledger. No model, no guessing:
// it only reports what the ledger itself proves, leaves open, or contradicts.
//
// Usage:
//   node crea/verify.mjs <request.json>        run the ledger, then report
//   node crea/verify.mjs --ledger <out.json>   report an existing ledger output
//   add --json to emit the condensed verdict as JSON
//
// <request.json> is either a full ledger request
// ({evidence_bundle, reviewed_obligations, manifest}) or a bare evidence bundle.
//
// Exit codes: 0 verified · 1 open/unknown · 2 contradicted · 3 usage/runtime error

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const REA = resolve(ROOT, "scripts/rea.mjs");

const EMPTY_BUNDLE = {
  artifacts: [], providers: [], environments: [],
  scenarios: [], captures: [], unknowns: [], records: [],
};

const fail = (msg) => {
  process.stderr.write(`crea verify: ${msg}\n`);
  process.exit(3);
};

export function toRequest(input) {
  if (input && typeof input === "object" && "evidence_bundle" in input) {
    return {
      reviewed_obligations: [],
      manifest: { bindings: [], contradictions: [] },
      ...input,
    };
  }
  if (input && typeof input === "object" && "records" in input) {
    return {
      evidence_bundle: { ...EMPTY_BUNDLE, ...input },
      reviewed_obligations: [],
      manifest: { bindings: [], contradictions: [] },
    };
  }
  throw new Error("input is neither a ledger request nor an evidence bundle");
}

export function runLedger(request) {
  const res = spawnSync(
    process.execPath,
    [REA, "build-reconstruction-obligation-ledger", JSON.stringify(request), "--json"],
    { cwd: ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  );
  if (res.error) throw new Error(`could not start REA: ${res.error.message}`);
  if (res.status !== 0) throw new Error(`REA exited ${res.status}: ${(res.stderr || res.stdout).trim()}`);
  try {
    return JSON.parse(res.stdout);
  } catch {
    throw new Error("REA output was not JSON");
  }
}

// Accepts a ledger request, a bare evidence bundle, or an existing ledger
// output, and returns the condensed verdict. Throws on invalid input.
export function verifyInput(input) {
  const isLedger = input?.schema === "ReconstructionObligationLedger"
    || input?.normalized_result?.schema === "ReconstructionObligationLedger";
  const envelope = isLedger ? input : runLedger(toRequest(input));
  return verdict(ledgerOf(envelope), envelope?.normalized_result ? envelope : null);
}

// Accept either the Evidence envelope or the bare normalized ledger.
export function ledgerOf(output) {
  const l = output?.normalized_result ?? output;
  if (l?.schema !== "ReconstructionObligationLedger") {
    throw new Error("not a ReconstructionObligationLedger");
  }
  return l;
}

export function verdict(ledger, envelope = null) {
  const s = ledger.summary ?? {};
  const r = ledger.reports ?? {};
  const contradicted = r.contradicted_obligation_ids ?? [];
  const missingOwner = r.missing_owner_obligation_ids ?? [];
  const missingVerifier = r.missing_verifier_obligation_ids ?? [];
  const unknowns = r.residual_unknown_ids ?? [];
  let state;
  if (contradicted.length > 0) state = "contradicted";
  else if (ledger.status === "verified" && (s.required_open ?? 0) === 0 && (s.total ?? 0) > 0) state = "verified";
  else state = "open";
  return {
    state,
    ledger_status: ledger.status,
    ledger_id: ledger.ledger_id,
    closure_digest: ledger.closure_digest,
    evidence_id: envelope?.evidence_id ?? null,
    totals: {
      obligations: s.total ?? 0,
      required: s.required ?? 0,
      verified: s.verified ?? 0,
      required_open: s.required_open ?? 0,
    },
    contradicted,
    missing_owner: missingOwner,
    missing_verifier: missingVerifier,
    residual_unknowns: unknowns,
    limitations: ledger.limitations ?? [],
  };
}

const LINE = {
  verified: "Cerrado. Cada afirmación requerida tiene dueño, casos y verificador. Nada que inventar.",
  open: "Abierto. Hay afirmaciones sin probar. Lo que no tiene evidencia no existe todavía.",
  contradicted: "Contradicción. La evidencia se niega a sí misma. Aquí alguien alucinó.",
};

export function render(v) {
  const out = [];
  const list = (title, ids) => {
    out.push(`  ${title}: ${ids.length}`);
    for (const id of ids.slice(0, 20)) out.push(`    · ${id}`);
    if (ids.length > 20) out.push(`    · … ${ids.length - 20} más`);
  };
  out.push("");
  out.push(`  cREA · verificación — ${v.state.toUpperCase()}`);
  out.push(`  ${LINE[v.state]}`);
  out.push("");
  out.push(`  ledger      ${v.ledger_id}`);
  out.push(`  digest      ${v.closure_digest}`);
  if (v.evidence_id) out.push(`  evidencia   ${v.evidence_id}`);
  out.push(`  estado REA  ${v.ledger_status}`);
  out.push("");
  out.push(`  obligaciones ${v.totals.obligations} · requeridas ${v.totals.required} · verificadas ${v.totals.verified} · abiertas ${v.totals.required_open}`);
  out.push("");
  list("contradichas (alucinación)", v.contradicted);
  list("sin dueño", v.missing_owner);
  list("sin verificador", v.missing_verifier);
  list("incógnitas residuales (riesgo de fuga)", v.residual_unknowns);
  if (v.limitations.length) {
    out.push("");
    out.push("  límites declarados por REA:");
    for (const l of v.limitations) out.push(`    · ${l}`);
  }
  out.push("");
  return out.join("\n");
}

export const exitCodeOf = (v) => ({ verified: 0, open: 1, contradicted: 2 })[v.state];

function main(argv) {
  const json = argv.includes("--json");
  const args = argv.filter((a) => a !== "--json");
  let envelope;
  if (args[0] === "--ledger") {
    if (!args[1]) fail("--ledger needs a file");
    envelope = JSON.parse(readFileSync(args[1], "utf8"));
  } else if (args[0]) {
    const input = JSON.parse(readFileSync(args[0], "utf8"));
    try { envelope = runLedger(toRequest(input)); } catch (e) { fail(e.message); }
  } else {
    fail("usage: node crea/verify.mjs <request.json> | --ledger <out.json> [--json]");
  }
  let ledger;
  try { ledger = ledgerOf(envelope); } catch (e) { fail(e.message); }
  const v = verdict(ledger, envelope?.normalized_result ? envelope : null);
  process.stdout.write(json ? `${JSON.stringify(v, null, 2)}\n` : render(v));
  process.exit(exitCodeOf(v));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2));
}
