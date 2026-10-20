// node --test crea/narrate.test.mjs — uses a fake Ollama server, no model needed.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { check, claims, narrate, prompt } from "./narrate.mjs";

const RESULT = {
  state: "open",
  ledger_id:
    "rol_7a0c240d63fae197409ba84cd77e8f4eb3665bfbc30600812ed15580421e6dd5",
  totals: { obligations: 3, required: 2, verified: 1, required_open: 1 },
  contradicted: [],
  residual_unknowns: ["u1"],
};

let reply = "";
let server, host, lastBody;
before(async () => {
  server = createServer((req, res) => {
    let b = "";
    req.on("data", (c) => (b += c));
    req.on("end", () => {
      lastBody = JSON.parse(b);
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ response: reply }));
    });
  });
  await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
  host = `http://127.0.0.1:${server.address().port}`;
});
after(() => new Promise((ok) => server.close(ok)));

test("claims extracts numbers and REA ids", () => {
  const c = claims("Hay 3 obligaciones en rol_7a0c240d63fae197 y 1,5 dudas");
  assert.deepEqual(c.ids, ["rol_7a0c240d63fae197"]);
  assert.deepEqual(c.nums, ["3", "1.5"]);
});

test("grounded narration is accepted", async () => {
  reply =
    "El análisis sigue abierto: de 3 obligaciones, 2 son requeridas y solo 1 está verificada. Queda 1 incógnita.";
  const n = await narrate(RESULT, { host });
  assert.equal(n.ok, true, JSON.stringify(n));
  assert.equal(lastBody.stream, false);
  assert.match(lastBody.prompt, /No inventes/);
});

test("invented number is rejected", async () => {
  reply = "Hay 7 obligaciones verificadas.";
  const n = await narrate(RESULT, { host });
  assert.equal(n.ok, false);
  assert.deepEqual(n.badNums, ["7"]);
});

test("digits inside a hex id are not a license to invent numbers", () => {
  // RESULT.ledger_id contains "7" and "240" as hex fragments.
  assert.equal(check("Se encontraron 240 problemas.", RESULT).ok, false);
});

test("invented id is rejected", () => {
  const r = check("Ver ev_deadbeefdeadbeef para detalles.", RESULT);
  assert.equal(r.ok, false);
  assert.deepEqual(r.badIds, ["ev_deadbeefdeadbeef"]);
});

test("non-local OLLAMA_HOST is refused", async () => {
  await assert.rejects(
    narrate(RESULT, { host: "https://example.com" }),
    /must be local/,
  );
});

test("prompt carries the JSON and the grounding rules", () => {
  const p = prompt(RESULT);
  assert.match(p, /usa solo datos que aparecen en el JSON/);
  assert.ok(p.includes(RESULT.ledger_id));
});
