#!/usr/bin/env node
// Build the cREA manual: Markdown → branded HTML → PDF.
//   node crea/manual/build.mjs [--in manual.md] [--out out/cREA-manual.pdf]
//        [--fonts DIR] [--html] [--chromium PATH]
// --fonts: folder with @fontsource woff2 files (cinzel-latin-400-normal.woff2,
//          eb-garamond-latin-400-normal.woff2, …). Without it the PDF uses
//          Google Fonts when reachable, else the system serif.
// Chromium: --chromium PATH, else $CREA_CHROMIUM, else installed Chrome, else
//           Playwright's bundled Chromium.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { markdown } from "./md.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));

const arg = (name, fallback = null) => {
  const i = process.argv.indexOf(name);
  return i > -1 ? process.argv[i + 1] : fallback;
};

// Hermetic chapter accents, cycled per chapter.
export const ACCENTS = ["#a8822e", "#5f7a96", "#4f8270", "#a5573f", "#6f5e9a"];

const FACES = [
  ["Cinzel", 400, "normal", "cinzel-latin-400-normal.woff2"],
  ["Cinzel", 600, "normal", "cinzel-latin-600-normal.woff2"],
  ["EB Garamond", 400, "normal", "eb-garamond-latin-400-normal.woff2"],
  ["EB Garamond", 400, "italic", "eb-garamond-latin-400-italic.woff2"],
  ["EB Garamond", 500, "normal", "eb-garamond-latin-500-normal.woff2"],
  ["EB Garamond", 600, "normal", "eb-garamond-latin-600-normal.woff2"],
];

async function findFont(dir, file) {
  for (const sub of ["", "files", "cinzel/files", "eb-garamond/files"]) {
    try {
      const p = join(dir, sub, file);
      return await readFile(p);
    } catch { /* keep looking */ }
  }
  return null;
}

async function fontCss(dir) {
  if (!dir) {
    return `@import url("https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600&family=EB+Garamond:ital,wght@0,400;0,500;0,600;1,400&display=swap");`;
  }
  const rules = [];
  for (const [family, weight, style, file] of FACES) {
    const buf = await findFont(dir, file);
    if (buf) rules.push(`@font-face{font-family:"${family}";font-weight:${weight};font-style:${style};src:url(data:font/woff2;base64,${buf.toString("base64")}) format("woff2");}`);
  }
  return rules.join("\n");
}

// Wrap each <h2> section into a chapter with its own accent.
export function chapters(html) {
  const parts = html.split(/(?=<h2 )/);
  const lead = parts[0].startsWith("<h2 ") ? "" : parts.shift();
  return lead + parts.map((p, n) =>
    `<section class="chapter" style="--accent:${ACCENTS[n % ACCENTS.length]}"><div class="chapter-num">${String(n + 1).padStart(2, "0")}</div>${p}</section>`,
  ).join("\n");
}

export function toc(headings) {
  let n = 0;
  const items = headings.filter((h) => h.level === 2 || h.level === 3).map((h) => {
    if (h.level === 2) n++;
    const accent = ACCENTS[(n - 1) % ACCENTS.length];
    return h.level === 2
      ? `<li class="toc-2" style="--accent:${accent}"><a href="#${h.id}"><span class="toc-n">${String(n).padStart(2, "0")}</span>${h.text}</a></li>`
      : `<li class="toc-3"><a href="#${h.id}">${h.text}</a></li>`;
  });
  return `<nav class="toc"><h2 class="toc-title">Índice</h2><ol>${items.join("")}</ol></nav>`;
}

export async function renderHtml(src, { fontsDir = null, date = new Date() } = {}) {
  const { html, headings } = markdown(src);
  const title = headings.find((h) => h.level === 1)?.text ?? "Manual";
  const body = chapters(html.replace(/<h1 [^>]*>.*?<\/h1>\n?/, ""));
  const when = date.toLocaleDateString("es-MX", { year: "numeric", month: "long" });
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${title}</title><style>
${await fontCss(fontsDir)}
@page { size: A4; margin: 22mm 20mm 24mm; }
@page :first { margin: 0; }
:root { --ink:#1b1626; --dim:#5c5566; --paper:#ffffff; --rule:#d9cfb8; --nigredo:#0d0a17; --sol:#cba24a; --luna:#cbd3dc; }
* { box-sizing: border-box; }
html { background: var(--paper); }
body { margin: 0; color: var(--ink); font-family: "EB Garamond", Georgia, serif; font-size: 11.5pt; line-height: 1.55; }
.cover { height: 297mm; width: 210mm; background: var(--nigredo); color: var(--luna); display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; page-break-after: always; position: relative; }
.cover .ae { font-family: Cinzel, serif; font-size: 150pt; color: var(--sol); line-height: 1; }
.cover .name { font-family: Cinzel, serif; letter-spacing: .4em; font-size: 20pt; margin-top: 12mm; padding-left: .4em; }
.cover .title { font-style: italic; font-size: 16pt; margin-top: 6mm; color: rgba(203,211,220,.8); }
.cover .foot { position: absolute; bottom: 18mm; font-size: 10pt; letter-spacing: .12em; color: rgba(203,211,220,.55); }
.cover .rule { width: 60mm; height: 1px; background: rgba(203,162,74,.7); margin-top: 10mm; }
.toc { page-break-after: always; }
.toc-title { font-family: Cinzel, serif; font-weight: 400; letter-spacing: .2em; font-size: 16pt; color: #a8822e; margin: 0 0 8mm; }
.toc ol { list-style: none; padding: 0; margin: 0; }
.toc a { color: var(--ink); text-decoration: none; }
.toc-2 { margin-top: 4mm; font-size: 13pt; border-left: 3pt solid var(--accent); padding-left: 4mm; }
.toc-n { font-family: Cinzel, serif; color: var(--accent); margin-right: 4mm; }
.toc-3 { margin-left: 12mm; color: var(--dim); font-size: 11pt; }
.chapter { page-break-before: always; position: relative; }
.chapter:first-of-type { page-break-before: auto; }
.chapter-num { font-family: Cinzel, serif; font-size: 34pt; color: var(--accent); line-height: 1; }
.chapter h2 { font-family: Cinzel, serif; font-weight: 400; font-size: 20pt; letter-spacing: .06em; margin: 2mm 0 6mm; padding-bottom: 3mm; border-bottom: 1.5pt solid var(--accent); }
strong { font-weight: 600; }
h3 { font-family: Cinzel, serif; font-weight: 600; font-size: 12.5pt; letter-spacing: .04em; margin: 7mm 0 2mm; color: var(--accent, var(--ink)); page-break-after: avoid; }
p { margin: 0 0 3mm; orphans: 3; widows: 3; }
ul, ol { margin: 0 0 3mm; padding-left: 6mm; }
li { margin-bottom: 1mm; }
a { color: #7a5c17; }
code { font-family: "DejaVu Sans Mono", Menlo, Consolas, monospace; font-size: 9pt; background: #efe8d6; padding: .5pt 3pt; border-radius: 2pt; }
pre { background: var(--nigredo); color: var(--luna); padding: 4mm 5mm; border-radius: 3mm; font-size: 9pt; line-height: 1.5; white-space: pre-wrap; word-break: break-word; page-break-inside: avoid; margin: 0 0 4mm; }
pre code { background: none; padding: 0; color: inherit; }
table { width: 100%; border-collapse: collapse; margin: 0 0 4mm; font-size: 10.5pt; page-break-inside: avoid; }
th { text-align: left; font-family: Cinzel, serif; font-weight: 400; font-size: 9.5pt; letter-spacing: .08em; border-bottom: 1.2pt solid var(--accent, var(--ink)); padding: 2mm 2mm; }
td { border-bottom: .5pt solid var(--rule); padding: 2mm; vertical-align: top; }
hr { border: 0; border-top: .6pt solid var(--rule); margin: 6mm 0; }
.callout { border-radius: 3mm; padding: 3.5mm 4.5mm; margin: 0 0 4mm; page-break-inside: avoid; }
.callout p { margin: 0; }
.callout-label { display: block; font-family: Cinzel, serif; font-size: 8.5pt; letter-spacing: .18em; text-transform: uppercase; margin-bottom: 1mm; }
.callout.semilla { background: #eef4ea; border-left: 3pt solid #4f8270; }
.callout.semilla .callout-label { color: #3b6b58; }
.callout.raiz { background: #ece9f3; border-left: 3pt solid #6f5e9a; }
.callout.raiz .callout-label { color: #574a80; }
.callout.ojo { background: #f6e9e2; border-left: 3pt solid #a5573f; }
.callout.ojo .callout-label { color: #8c4632; }
</style></head><body>
<div class="cover"><div class="ae">Æ</div><div class="name">cREA</div><div class="rule"></div><div class="title">${title}</div><div class="foot">${when.toUpperCase()} · NIGREDO · SOL · LUNA</div></div>
${toc(headings)}
<main>${body}</main>
</body></html>`;
}

async function launch(chromiumPath) {
  const { chromium } = await import("playwright-core");
  const path = chromiumPath ?? process.env.CREA_CHROMIUM;
  if (path) return chromium.launch({ executablePath: path });
  try { return await chromium.launch({ channel: "chrome" }); } catch { return chromium.launch(); }
}

export async function buildPdf(html, outPath, chromiumPath = null) {
  const browser = await launch(chromiumPath);
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready);
    await mkdir(dirname(outPath), { recursive: true });
    await page.pdf({
      path: outPath,
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: true,
      headerTemplate: "<span></span>",
      footerTemplate: `<div style="width:100%;font-family:Georgia,serif;font-size:8pt;color:#8a8294;padding:0 20mm;display:flex;justify-content:space-between"><span>cREA · manual</span><span class="pageNumber"></span></div>`,
    });
  } finally {
    await browser.close();
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const input = resolve(arg("--in", join(HERE, "manual.md")));
  const out = resolve(arg("--out", join(HERE, "out/cREA-manual.pdf")));
  const html = await renderHtml(await readFile(input, "utf8"), { fontsDir: arg("--fonts") });
  if (process.argv.includes("--html")) {
    await mkdir(dirname(out), { recursive: true });
    await writeFile(out.replace(/\.pdf$/, ".html"), html);
  }
  await buildPdf(html, out, arg("--chromium"));
  process.stdout.write(`cREA manual → ${out}\n`);
}
