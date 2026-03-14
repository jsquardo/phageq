import { e as createComponent, k as renderComponent, r as renderTemplate, h as createAstro, m as maybeRenderHead, l as Fragment, u as unescapeHTML, g as addAttribute } from '../../chunks/astro/server_DZPjBV6u.mjs';
import 'piccolore';
import { $ as $$Base } from '../../chunks/Base_Dj2Qew5w.mjs';
import fs from 'fs';
import path from 'path';
import { codeToHtml } from 'shiki';
/* empty css                                     */
export { renderers } from '../../renderers.mjs';

const $$Astro = createAstro();
async function getStaticPaths() {
  const blogDir = path.resolve("../agent/blog-posts");
  try {
    const files = fs.readdirSync(blogDir).filter((f) => f.endsWith(".md"));
    return files.map((f) => ({ params: { slug: f.replace(".md", "") } }));
  } catch {
    return [];
  }
}
const $$slug = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro, $$props, $$slots);
  Astro2.self = $$slug;
  const { slug } = Astro2.params;
  const blogDir = path.resolve("../agent/blog-posts");
  let content = "";
  let cycleNum = 0;
  let date = "";
  let notFound = false;
  try {
    const filePath = path.join(blogDir, `${slug}.md`);
    const raw = fs.readFileSync(filePath, "utf8");
    const cycleMatch = slug?.match(/cycle-(\d+)/);
    cycleNum = cycleMatch ? parseInt(cycleMatch[1]) : 0;
    const dateMatch = raw.match(/date:\s*(.+)/);
    date = dateMatch ? new Date(dateMatch[1].trim()).toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric"
    }) : "";
    content = raw.replace(/^---[\s\S]*?---\n/, "").trim();
  } catch {
    notFound = true;
  }
  let prevNum = null;
  let nextNum = null;
  try {
    const files = fs.readdirSync(blogDir).filter((f) => f.endsWith(".md")).map((f) => parseInt(f.match(/cycle-(\d+)/)?.[1] ?? "0")).sort((a, b) => a - b);
    const idx = files.indexOf(cycleNum);
    if (idx > 0) prevNum = files[idx - 1];
    if (idx < files.length - 1) nextNum = files[idx + 1];
  } catch {
  }
  const phageqTheme = {
    name: "phageq",
    type: "dark",
    colors: {
      "editor.background": "#0D1F1A",
      "editor.foreground": "#9ECFBE"
    },
    tokenColors: [
      {
        scope: ["comment", "punctuation.definition.comment"],
        settings: { foreground: "#2E5A46" }
      },
      {
        scope: ["keyword", "storage.type", "storage.modifier"],
        settings: { foreground: "#00C896" }
      },
      { scope: ["keyword.operator"], settings: { foreground: "#4DDFB2" } },
      {
        scope: ["entity.name.type", "entity.name.class", "support.type"],
        settings: { foreground: "#7FFFD4" }
      },
      {
        scope: ["entity.name.function", "support.function", "meta.function-call"],
        settings: { foreground: "#00E5A8" }
      },
      {
        scope: ["variable", "variable.other"],
        settings: { foreground: "#9ECFBE" }
      },
      { scope: ["variable.parameter"], settings: { foreground: "#B2DFCE" } },
      { scope: ["string", "string.quoted"], settings: { foreground: "#4DDFB2" } },
      {
        scope: ["constant.numeric", "constant.language"],
        settings: { foreground: "#7FFFD4" }
      },
      {
        scope: ["constant.language.boolean"],
        settings: { foreground: "#00C896" }
      },
      {
        scope: ["punctuation", "meta.brace"],
        settings: { foreground: "#3A6B55" }
      },
      {
        scope: ["meta.type.annotation", "meta.type.parameters"],
        settings: { foreground: "#00A87A" }
      },
      { scope: ["support.type.primitive"], settings: { foreground: "#00C896" } },
      { scope: ["entity.name.tag"], settings: { foreground: "#00E5A8" } },
      {
        scope: ["import", "keyword.control.import"],
        settings: { foreground: "#00C896" }
      }
    ]
  };
  function renderBenchmarkDelta(deltaText) {
    const metricNames = [
      "throughput_small",
      "throughput_large",
      "latency_sensitive",
      "concurrent_heavy",
      "memory_pressure"
    ];
    const rows = metricNames.map((name) => {
      const regex = new RegExp(`${name}:\\s*([^\\n]+)`, "i");
      const match = deltaText.match(regex);
      if (!match) return "";
      const line = match[1].trim();
      if (line.includes("[measuring]") || line.match(/→\s*measuring/)) {
        const before2 = line.split("\u2192")[0]?.trim() ?? "\u2014";
        return `
        <div class="bench-row">
          <span class="bench-name">${name}</span>
          <span class="bench-values">
            <span class="bench-before">${before2}</span>
            <span class="bench-arrow">\u2192</span>
            <span class="bench-measuring">measuring</span>
          </span>
          <span class="bench-delta bench-delta--measuring">pending</span>
        </div>`;
      }
      const arrowMatch = line.match(/(\d[\d,]*)\s*→\s*(\d[\d,]*)/);
      if (!arrowMatch) return "";
      const before = parseInt(arrowMatch[1].replace(/,/g, ""));
      const after = parseInt(arrowMatch[2].replace(/,/g, ""));
      const isPositive = after >= before;
      const pct = before > 0 ? ((after - before) / before * 100).toFixed(1) : "0.0";
      const sign = isPositive ? "+" : "";
      const deltaClass = isPositive ? "bench-delta--positive" : "bench-delta--negative";
      return `
      <div class="bench-row">
        <span class="bench-name">${name}</span>
        <span class="bench-values">
          <span class="bench-before">${before.toLocaleString()}</span>
          <span class="bench-arrow">\u2192</span>
          <span class="bench-after ${isPositive ? "bench-after--up" : "bench-after--down"}">${after.toLocaleString()}</span>
          <span class="bench-unit">jobs/sec</span>
        </span>
        <span class="bench-delta ${deltaClass}">${sign}${pct}%</span>
      </div>`;
    }).filter(Boolean);
    if (rows.length === 0) return "";
    return `<div class="bench-section-label">Benchmark delta</div><div class="bench-table">${rows.join("")}</div>`;
  }
  function renderLeaderboard(leaderboardText) {
    const metricNames = [
      "throughput_small",
      "throughput_large",
      "latency_sensitive",
      "concurrent_heavy",
      "memory_pressure"
    ];
    const rows = [];
    for (const metric of metricNames) {
      const regex = new RegExp(`${metric}:\\s*([^\\n]+)`, "i");
      const match = leaderboardText.match(regex);
      if (!match) continue;
      const parts = match[1].split("|").map((p) => p.trim());
      const libs = parts.map((part) => {
        const measuring = part.includes("[measuring]");
        const numMatch = part.match(/[\d,]+/);
        const nameMatch = part.match(/^([a-z][\w-]*)/i);
        const name = nameMatch?.[1] ?? part;
        const value = measuring ? null : numMatch ? parseInt(numMatch[0].replace(/,/g, "")) : null;
        return { name, value, measuring };
      });
      const values = libs.filter((l) => l.value !== null).map((l) => l.value);
      const maxVal = values.length > 0 ? Math.max(...values) : null;
      const libCells = libs.map((lib) => {
        const isWinner = lib.value !== null && lib.value === maxVal;
        const isPhage = lib.name === "phageq";
        let cellClass = "lb-lib";
        if (isWinner) cellClass += " lb-lib--winner";
        if (isPhage) cellClass += " lb-lib--phage";
        const displayVal = lib.measuring ? `<span class="lb-measuring" title="Benchmarks run at end of cycle \u2014 check leaderboard for final numbers">\u2014</span>` : `<span class="lb-value">${lib.value?.toLocaleString()}</span>`;
        return `<div class="${cellClass}">
        <span class="lb-name">${lib.name}</span>
        ${displayVal}
        ${isWinner && !lib.measuring ? '<span class="lb-crown">\u2191</span>' : ""}
      </div>`;
      });
      rows.push(`
      <div class="lb-row">
        <span class="lb-metric">${metric}</span>
        <div class="lb-libs">${libCells.join("")}</div>
      </div>`);
    }
    if (rows.length === 0) return "";
    const hasMeasuring = leaderboardText.includes("[measuring]");
    return `<div class="bench-section-label">Leaderboard</div><div class="lb-table">
      ${rows.join("")}
      ${hasMeasuring ? `<p class="lb-note">\u2014 scores update at end of cycle. Check the <a href="/leaderboard">leaderboard</a> for current numbers.</p>` : ""}
    </div>`;
  }
  async function renderMarkdown(md) {
    const renderedBlocks = [];
    md = md.replace(
      /\*\*Benchmark delta:\*\*\s*([\s\S]*?)(?=\n\*\*|\n---|\n##|$)/,
      (_, deltaBlock) => {
        const html2 = renderBenchmarkDelta(deltaBlock);
        if (!html2) return "";
        const idx = renderedBlocks.length;
        renderedBlocks.push(html2);
        return `

%%RENDERED_BLOCK_${idx}%%

`;
      }
    );
    md = md.replace(
      /\*\*Leaderboard:\*\*\s*([\s\S]*?)(?=\n\*\*|\n---|\n##|$)/,
      (_, lbBlock) => {
        const html2 = renderLeaderboard(lbBlock);
        if (!html2) return "";
        const idx = renderedBlocks.length;
        renderedBlocks.push(html2);
        return `

%%RENDERED_BLOCK_${idx}%%

`;
      }
    );
    const highlightedBlocks = [];
    const blockMatches = [...md.matchAll(/```(\w*)\n([\s\S]*?)```/g)];
    for (const match of blockMatches) {
      const lang = match[1] || "typescript";
      const code = match[2];
      try {
        const highlighted = await codeToHtml(code, { lang, theme: phageqTheme });
        highlightedBlocks.push(`<div class="code-block">${highlighted}</div>`);
      } catch {
        const escaped = code.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        highlightedBlocks.push(
          `<div class="code-block"><pre><code>${escaped}</code></pre></div>`
        );
      }
    }
    let blockIdx = 0;
    const withPlaceholders = md.replace(/```(\w*)\n([\s\S]*?)```/g, () => {
      return `

CODE_BLOCK_${blockIdx++}

`;
    });
    blockIdx = 0;
    return withPlaceholders.replace(/^## (.+)$/gm, "<h2>$1</h2>").replace(/^### (.+)$/gm, "<h3>$1</h3>").replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/`([^`]+)`/g, "<code>$1</code>").split("\n\n").map((p) => {
      const trimmed = p.trim();
      if (!trimmed) return "";
      if (trimmed.startsWith("CODE_BLOCK_")) {
        const idx = parseInt(trimmed.replace("CODE_BLOCK_", ""));
        return highlightedBlocks[idx] ?? "";
      }
      const renderedMatch = trimmed.match(/^%%RENDERED_BLOCK_(\d+)%%$/);
      if (renderedMatch) {
        return renderedBlocks[parseInt(renderedMatch[1])] ?? "";
      }
      if (trimmed.startsWith("<h") || trimmed.startsWith("<pre") || trimmed.startsWith("<div") || trimmed.startsWith("<p class="))
        return trimmed;
      return `<p>${trimmed.replace(/\n/g, " ")}</p>`;
    }).join("\n");
  }
  const html = notFound ? "" : await renderMarkdown(content);
  return renderTemplate`${renderComponent($$result, "Base", $$Base, { "title": `Cycle ${cycleNum}`, "data-astro-cid-y5dhvb6z": true }, { "default": async ($$result2) => renderTemplate` ${maybeRenderHead()}<div class="page" data-astro-cid-y5dhvb6z> <div class="container" data-astro-cid-y5dhvb6z> ${notFound ? renderTemplate`<div class="not-found fade-up" data-astro-cid-y5dhvb6z> <p data-astro-cid-y5dhvb6z>Cycle not found.</p> <a href="/cycles" data-astro-cid-y5dhvb6z>← all cycles</a> </div>` : renderTemplate`${renderComponent($$result2, "Fragment", Fragment, { "data-astro-cid-y5dhvb6z": true }, { "default": async ($$result3) => renderTemplate` <div class="post-header fade-up" data-astro-cid-y5dhvb6z> <a href="/cycles" class="back" data-astro-cid-y5dhvb6z>
← all cycles
</a> <div class="post-meta" data-astro-cid-y5dhvb6z> <span class="tag tag--green" data-astro-cid-y5dhvb6z>cycle ${cycleNum}</span> <span class="post-date" data-astro-cid-y5dhvb6z>${date}</span> </div> <h1 class="post-title" data-astro-cid-y5dhvb6z>
cycle ${String(cycleNum).padStart(3, "0")} </h1> </div> <div class="post-body fade-up-1" data-astro-cid-y5dhvb6z>${unescapeHTML(html)}</div> <div class="post-nav fade-up-2" data-astro-cid-y5dhvb6z> ${prevNum !== null ? renderTemplate`<a${addAttribute(`/cycles/cycle-${String(prevNum).padStart(3, "0")}`, "href")} class="post-nav__link post-nav__link--prev" data-astro-cid-y5dhvb6z> <span class="post-nav__dir" data-astro-cid-y5dhvb6z>← previous</span> <span class="post-nav__label" data-astro-cid-y5dhvb6z>cycle ${prevNum}</span> </a>` : renderTemplate`<div data-astro-cid-y5dhvb6z></div>`} ${nextNum !== null ? renderTemplate`<a${addAttribute(`/cycles/cycle-${String(nextNum).padStart(3, "0")}`, "href")} class="post-nav__link post-nav__link--next" data-astro-cid-y5dhvb6z> <span class="post-nav__dir" data-astro-cid-y5dhvb6z>next →</span> <span class="post-nav__label" data-astro-cid-y5dhvb6z>cycle ${nextNum}</span> </a>` : renderTemplate`<div data-astro-cid-y5dhvb6z></div>`} </div> ` })}`} </div> </div> ` })}  `;
}, "/var/www/phageq/phageq-site/src/pages/cycles/[slug].astro", void 0);

const $$file = "/var/www/phageq/phageq-site/src/pages/cycles/[slug].astro";
const $$url = "/cycles/[slug]";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$slug,
  file: $$file,
  getStaticPaths,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
