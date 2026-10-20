// node --test crea/web/server.test.mjs
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createCreaServer, CAPABILITIES } from "./server.mjs";

let server, base;
before(async () => {
  server = createCreaServer();
  await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => new Promise((ok) => server.close(ok)));

const EMPTY = {
  evidence_bundle: {
    artifacts: [],
    providers: [],
    environments: [],
    scenarios: [],
    captures: [],
    unknowns: [],
    records: [],
  },
  reviewed_obligations: [],
  manifest: { bindings: [], contradictions: [] },
};

test("serves the page", async () => {
  const r = await fetch(`${base}/`);
  assert.equal(r.status, 200);
  assert.match(r.headers.get("content-type"), /text\/html/);
  assert.match(await r.text(), /cREA/);
});

test("capabilities separate real from roadmap", async () => {
  const caps = await (await fetch(`${base}/api/capabilities`)).json();
  assert.deepEqual(caps, CAPABILITIES);
  assert.ok(caps.every((c) => c.status === "real" || c.status === "roadmap"));
});

test("verify: empty request through the real REA CLI is open", async () => {
  const r = await fetch(`${base}/api/verify`, {
    method: "POST",
    body: JSON.stringify(EMPTY),
  });
  assert.equal(r.status, 200);
  const v = await r.json();
  assert.equal(v.state, "open");
  assert.equal(v.ledger_status, "unknown");
});

test("verify: invalid JSON is 400", async () => {
  const r = await fetch(`${base}/api/verify`, {
    method: "POST",
    body: "{nope",
  });
  assert.equal(r.status, 400);
});

test("verify: wrong shape is 422", async () => {
  const r = await fetch(`${base}/api/verify`, {
    method: "POST",
    body: JSON.stringify({ foo: 1 }),
  });
  assert.equal(r.status, 422);
});

test("unknown route is 404", async () => {
  assert.equal((await fetch(`${base}/nope`)).status, 404);
});
