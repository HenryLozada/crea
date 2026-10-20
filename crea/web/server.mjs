#!/usr/bin/env node
// cREA web — local-only interface. No model, no network beyond 127.0.0.1.
//   node crea/web/server.mjs [--port 4173]
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { verifyInput } from "../verify.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const HOST = "127.0.0.1";
const MAX_BODY = 8 * 1024 * 1024;

// Honest capability map: what exists today vs. what is still roadmap.
export const CAPABILITIES = [
  { id: "verify", name: "Verificar un análisis", status: "real", detail: "Ledger de obligaciones de REA: cerrado, abierto o contradicho." },
  { id: "binaries", name: "Binarios nativos", status: "real", detail: "Vía REA + Ghidra, Hopper o IDA (traes tu motor)." },
  { id: "apk", name: "APKs Android", status: "real", detail: "Vía REA (JADX, apktool)." },
  { id: "js", name: "Apps JS / Electron", status: "real", detail: "Vía REA, sin motor nativo." },
  { id: "music", name: "Canción → acordes y campo armónico", status: "roadmap", detail: "Analizador determinista, sin modelo." },
  { id: "midi", name: "Melodía → MIDI", status: "roadmap", detail: "" },
  { id: "lyrics", name: "Análisis de letra", status: "roadmap", detail: "Honrando al artista; sin reproducir la obra." },
  { id: "recipe", name: "Receta desde foto del plato", status: "roadmap", detail: "" },
  { id: "usb", name: "Dispositivos USB propios", status: "roadmap", detail: "Conectar, probar, documentar." },
  { id: "manual", name: "Manual amigo (PDF)", status: "roadmap", detail: "" },
  { id: "local-ai", name: "IA local privada", status: "roadmap", detail: "Opcional; solo narra, nunca decide." },
];

const send = (res, code, body, type = "application/json; charset=utf-8") => {
  res.writeHead(code, {
    "content-type": type,
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
  });
  res.end(typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body));
};

const readBody = (req) => new Promise((ok, ko) => {
  let size = 0;
  const chunks = [];
  req.on("data", (c) => {
    size += c.length;
    if (size > MAX_BODY) { ko(Object.assign(new Error("body too large"), { code: 413 })); req.destroy(); return; }
    chunks.push(c);
  });
  req.on("end", () => ok(Buffer.concat(chunks).toString("utf8")));
  req.on("error", ko);
});

export const createCreaServer = () => createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${HOST}`);
    if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/index.html")) {
      return send(res, 200, await readFile(resolve(HERE, "index.html")), "text/html; charset=utf-8");
    }
    if (req.method === "GET" && url.pathname === "/api/capabilities") {
      return send(res, 200, CAPABILITIES);
    }
    if (req.method === "POST" && url.pathname === "/api/verify") {
      let input;
      try { input = JSON.parse(await readBody(req)); }
      catch (e) {
        return send(res, e.code === 413 ? 413 : 400, { error: e.code === 413 ? "archivo demasiado grande (8 MB máx.)" : "eso no es JSON válido" });
      }
      try { return send(res, 200, verifyInput(input)); }
      catch (e) { return send(res, 422, { error: e.message }); }
    }
    return send(res, 404, { error: "no existe" });
  } catch (e) {
    return send(res, 500, { error: e.message });
  }
});

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const i = process.argv.indexOf("--port");
  const port = Number(i > -1 ? process.argv[i + 1] : process.env.CREA_PORT ?? 4173);
  createCreaServer().listen(port, HOST, () => {
    process.stdout.write(`\n  cREA · http://${HOST}:${port}\n\n`);
  });
}
