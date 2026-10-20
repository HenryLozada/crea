#!/usr/bin/env node
// crea narrate — optional plain-language explanation of a cREA result,
// written by a LOCAL model (Ollama on 127.0.0.1). The JSON stays the source
// of truth: a narration that mentions any number or ID absent from the JSON
// is rejected and the JSON is shown instead.
//
//   node crea/narrate.mjs result.json [--model qwen2.5:3b]
//   OLLAMA_HOST=http://127.0.0.1:11434 (default)
//
// Exit codes: 0 narration accepted · 1 rejected or model unavailable (JSON shown) · 3 usage
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const DEFAULT_MODEL = "qwen2.5:3b";

export function prompt(result) {
  return [
    "Eres la voz de cREA. Explica en español, en 4 a 6 frases claras, qué dice este resultado.",
    "Reglas: usa solo datos que aparecen en el JSON. No inventes números, IDs, nombres ni causas.",
    "Si algo no está en el JSON, di que no se sabe. No des consejos de inversión ni de apuestas.",
    "",
    "JSON:",
    JSON.stringify(result),
  ].join("\n");
}

// Tokens that must be grounded in the source: numbers and REA-style IDs.
export function claims(text) {
  const ids = text.match(/\b(?:ev|rol)_[0-9a-f]{8,}\b/g) ?? [];
  const nums = (text.replace(/\b(?:ev|rol)_[0-9a-f]+\b/g, " ").match(/(?<![\w.])\d+(?:[.,]\d+)?(?![\w])/g) ?? [])
    .map((n) => n.replace(",", "."));
  return { ids, nums };
}

function sourceNumbers(value, out = new Set()) {
  if (typeof value === "number") {
    out.add(String(value));
    out.add(String(Math.round(value)));
    out.add(value.toFixed(1));
    out.add(value.toFixed(2));
  } else if (typeof value === "string") {
    // Whole numbers only: digits inside hex IDs (rol_7a0c…) do not count.
    for (const n of value.match(/(?<![\w.])\d+(?:\.\d+)?(?![\w])/g) ?? []) out.add(n);
  } else if (Array.isArray(value)) {
    out.add(String(value.length));
    for (const v of value) sourceNumbers(v, out);
  } else if (value && typeof value === "object") {
    for (const v of Object.values(value)) sourceNumbers(v, out);
  }
  return out;
}

export function check(narration, result) {
  const src = JSON.stringify(result);
  const allowed = sourceNumbers(result);
  const { ids, nums } = claims(narration);
  const badIds = ids.filter((id) => !src.includes(id));
  const badNums = nums.filter((n) => !allowed.has(n) && !allowed.has(String(Number(n))));
  return { ok: badIds.length === 0 && badNums.length === 0, badIds, badNums };
}

export async function narrate(result, { model = DEFAULT_MODEL, host = process.env.OLLAMA_HOST ?? "http://127.0.0.1:11434", fetchImpl = fetch } = {}) {
  const url = new URL("/api/generate", host);
  if (!["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)) {
    throw new Error(`OLLAMA_HOST must be local, got ${url.hostname}`);
  }
  const res = await fetchImpl(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ model, prompt: prompt(result), stream: false, options: { temperature: 0.2, num_ctx: 2048 } }),
  });
  if (!res.ok) throw new Error(`Ollama respondió ${res.status}`);
  const data = await res.json();
  const text = String(data.response ?? "").trim();
  return { text, ...check(text, result) };
}

async function main(argv) {
  const file = argv.find((a) => !a.startsWith("--"));
  const mi = argv.indexOf("--model");
  if (!file) {
    process.stderr.write("usage: node crea/narrate.mjs result.json [--model NAME]\n");
    return 3;
  }
  const result = JSON.parse(readFileSync(file, "utf8"));
  try {
    const n = await narrate(result, { model: mi > -1 ? argv[mi + 1] : DEFAULT_MODEL });
    if (n.ok) {
      process.stdout.write(`${n.text}\n`);
      return 0;
    }
    process.stderr.write(`crea narrate: narración rechazada; menciona datos que no están en el resultado (${[...n.badIds, ...n.badNums].join(", ")}).\n`);
  } catch (e) {
    process.stderr.write(`crea narrate: sin narración (${e.message}).\n`);
  }
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  return 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).then((code) => process.exit(code));
}
