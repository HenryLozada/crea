// node --test crea/manual/manual.test.mjs
// The PDF test runs only when CREA_CHROMIUM points to a Chromium/Chrome binary.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, stat, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { markdown, inline, slug } from "./md.mjs";
import { renderHtml, chapters, toc, buildPdf, ACCENTS } from "./build.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));

test("inline escapes HTML and keeps code literal", () => {
  assert.equal(inline("<b>x</b>"), "&lt;b&gt;x&lt;/b&gt;");
  assert.equal(
    inline("`<i>**no**</i>`"),
    "<code>&lt;i&gt;**no**&lt;/i&gt;</code>",
  );
  assert.equal(inline("**a** y *b*"), "<strong>a</strong> y <em>b</em>");
});

test("links only allow http(s), anchors and relative paths", () => {
  assert.match(inline("[ok](https://x.dev)"), /href="https:\/\/x.dev"/);
  assert.match(inline("[bad](javascript:alert(1))"), /href="#"/);
});

test("slug strips accents", () => {
  assert.equal(slug("Qué es cREA"), "que-es-crea");
});

test("blocks: headings, lists, fences, tables, callouts", () => {
  const { html, headings } = markdown(
    [
      "# T",
      "## Uno",
      "texto",
      "",
      "- a",
      "- b",
      "",
      "1. x",
      "",
      "```bash",
      "echo <hi>",
      "```",
      "",
      "| A | B |",
      "|---|---|",
      "| 1 | 2 |",
      "",
      "> [semilla] fácil",
      "> sigue",
      "",
      "> [ojo] cuidado",
    ].join("\n"),
  );
  assert.deepEqual(
    headings.map((h) => [h.level, h.id]),
    [
      [1, "t"],
      [2, "uno"],
    ],
  );
  assert.match(html, /<ul><li>a<\/li><li>b<\/li><\/ul>/);
  assert.match(html, /<ol><li>x<\/li><\/ol>/);
  assert.match(
    html,
    /<pre data-lang="bash"><code>echo &lt;hi&gt;<\/code><\/pre>/,
  );
  assert.match(html, /<th>A<\/th>.*<td>2<\/td>/s);
  assert.match(html, /callout semilla.*fácil sigue/s);
  assert.match(html, /callout ojo.*cuidado/s);
});

test("chapters get cycling accents and numbers", () => {
  const out = chapters('<p>lead</p><h2 id="a">A</h2><p>1</p><h2 id="b">B</h2>');
  assert.match(out, /^<p>lead<\/p>/);
  assert.match(
    out,
    new RegExp(`--accent:${ACCENTS[0]}.*01.*--accent:${ACCENTS[1]}.*02`, "s"),
  );
});

test("toc lists h2 numbered and h3 nested", () => {
  const t = toc([
    { level: 1, text: "T", id: "t" },
    { level: 2, text: "A", id: "a" },
    { level: 3, text: "a1", id: "a1" },
  ]);
  assert.match(t, /toc-2.*01.*A/s);
  assert.match(t, /toc-3.*a1/s);
  assert.doesNotMatch(t, />T</);
});

test("the real manual renders with cover, toc and every chapter", async () => {
  const src = await readFile(join(HERE, "manual.md"), "utf8");
  const html = await renderHtml(src, { date: new Date("2026-10-20") });
  assert.match(html, /class="cover"/);
  assert.match(html, /<title>Manual de inicio<\/title>/);
  const h2 = (src.match(/^## /gm) ?? []).length;
  assert.equal((html.match(/class="chapter"/g) ?? []).length, h2);
  assert.ok(h2 >= 5);
});

test(
  "PDF build",
  { skip: !process.env.CREA_CHROMIUM && "set CREA_CHROMIUM to run" },
  async () => {
    const out = join(tmpdir(), `crea-manual-${process.pid}.pdf`);
    try {
      const html = await renderHtml("# M\n\n## A\n\nhola", {});
      await buildPdf(html, out);
      const head = (await readFile(out)).subarray(0, 5).toString();
      assert.equal(head, "%PDF-");
      assert.ok((await stat(out)).size > 1000);
    } finally {
      await rm(out, { force: true });
    }
  },
);
