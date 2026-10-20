// Minimal Markdown → HTML for the cREA manual. Deliberately small: it covers
// exactly the syntax the manual uses, and escapes everything else.
//
// Blocks: # ## ### headings, paragraphs, - and 1. lists, ``` fences, | tables |,
// --- rules, and callouts: "> [semilla] …", "> [raiz] …", "> [ojo] …".
// Inline: `code`, **bold**, *italic*, [text](url).

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export const slug = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
  .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export function inline(text) {
  const parts = text.split(/(`[^`]+`)/g);
  return parts.map((p) => {
    if (p.startsWith("`") && p.endsWith("`") && p.length > 1) return `<code>${esc(p.slice(1, -1))}</code>`;
    let s = esc(p);
    s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, t, u) => {
      const safe = /^(https?:|#|\.{0,2}\/)/.test(u) ? u : "#";
      return `<a href="${safe}">${t}</a>`;
    });
    s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    s = s.replace(/(^|[^*])\*([^*\s][^*]*)\*/g, "$1<em>$2</em>");
    return s;
  }).join("");
}

const CALLOUT = { semilla: "Semilla", raiz: "Raíz", ojo: "Ojo" };

export function markdown(src) {
  const lines = src.replace(/\r\n?/g, "\n").split("\n");
  const out = [];
  const headings = [];
  let i = 0;
  const para = [];
  const flush = () => { if (para.length) { out.push(`<p>${inline(para.join(" "))}</p>`); para.length = 0; } };

  while (i < lines.length) {
    const line = lines[i];
    const t = line.trim();

    if (t.startsWith("```")) {
      flush();
      const lang = t.slice(3).trim();
      const body = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) body.push(lines[i++]);
      i++;
      out.push(`<pre${lang ? ` data-lang="${esc(lang)}"` : ""}><code>${esc(body.join("\n"))}</code></pre>`);
      continue;
    }
    const h = /^(#{1,3})\s+(.*)$/.exec(t);
    if (h) {
      flush();
      const level = h[1].length;
      const id = slug(h[2]);
      headings.push({ level, text: h[2], id });
      out.push(`<h${level} id="${id}">${inline(h[2])}</h${level}>`);
      i++; continue;
    }
    if (/^---+$/.test(t)) { flush(); out.push("<hr>"); i++; continue; }
    const c = /^>\s*\[(semilla|raiz|ojo)\]\s*(.*)$/.exec(t);
    if (c) {
      flush();
      const body = [c[2]];
      i++;
      while (i < lines.length && /^>\s?/.test(lines[i].trim()) && !/^>\s*\[/.test(lines[i].trim())) {
        body.push(lines[i].trim().replace(/^>\s?/, "")); i++;
      }
      out.push(`<aside class="callout ${c[1]}"><span class="callout-label">${CALLOUT[c[1]]}</span><p>${inline(body.join(" ").trim())}</p></aside>`);
      continue;
    }
    if (/^\|.*\|$/.test(t)) {
      flush();
      const rows = [];
      while (i < lines.length && /^\|.*\|$/.test(lines[i].trim())) rows.push(lines[i++].trim());
      const cells = (r) => r.slice(1, -1).split("|").map((x) => x.trim());
      const [head, sep, ...body] = rows;
      const hasSep = sep && /^[\s|:-]+$/.test(sep);
      const bodyRows = hasSep ? body : [sep, ...body].filter(Boolean);
      out.push(`<table><thead><tr>${cells(head).map((x) => `<th>${inline(x)}</th>`).join("")}</tr></thead><tbody>${
        bodyRows.map((r) => `<tr>${cells(r).map((x) => `<td>${inline(x)}</td>`).join("")}</tr>`).join("")}</tbody></table>`);
      continue;
    }
    const ul = /^[-*]\s+(.*)$/.exec(t);
    const ol = /^\d+\.\s+(.*)$/.exec(t);
    if (ul || ol) {
      flush();
      const tag = ul ? "ul" : "ol";
      const re = ul ? /^[-*]\s+(.*)$/ : /^\d+\.\s+(.*)$/;
      const items = [];
      while (i < lines.length && re.test(lines[i].trim())) items.push(re.exec(lines[i++].trim())[1]);
      out.push(`<${tag}>${items.map((x) => `<li>${inline(x)}</li>`).join("")}</${tag}>`);
      continue;
    }
    if (t === "") { flush(); i++; continue; }
    para.push(t);
    i++;
  }
  flush();
  return { html: out.join("\n"), headings };
}
