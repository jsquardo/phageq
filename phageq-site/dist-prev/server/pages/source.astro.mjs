import { e as createComponent, k as renderComponent, r as renderTemplate, m as maybeRenderHead, u as unescapeHTML } from '../chunks/astro/server_DZPjBV6u.mjs';
import 'piccolore';
import { $ as $$Base } from '../chunks/Base_Dj2Qew5w.mjs';
import fs from 'fs';
import path from 'path';
import { codeToHtml } from 'shiki';
/* empty css                                  */
export { renderers } from '../renderers.mjs';

const $$Source = createComponent(async ($$result, $$props, $$slots) => {
  const srcDir = path.resolve("../src");
  let files = [];
  const phageqTheme = {
    name: "phageq",
    type: "dark",
    colors: {
      "editor.background": "#060E0B",
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
  try {
    const fileNames = fs.readdirSync(srcDir).filter((f) => f.endsWith(".ts"));
    for (const name of fileNames) {
      const content = fs.readFileSync(path.join(srcDir, name), "utf8");
      const highlighted = await codeToHtml(content, {
        lang: "typescript",
        theme: phageqTheme
      });
      files.push({
        name,
        content,
        lines: content.split("\n").length,
        highlighted
      });
    }
  } catch {
  }
  const totalLines = files.reduce((sum, f) => sum + f.lines, 0);
  let commits = [];
  try {
    const { execSync } = await import('child_process');
    const log = execSync('git log --oneline --pretty=format:"%h|%s|%ar" -10', {
      cwd: path.resolve(".."),
      encoding: "utf8"
    });
    commits = log.trim().split("\n").map((line) => {
      const [hash, msg, date] = line.split("|");
      return { hash, msg, date };
    });
  } catch {
  }
  return renderTemplate`${renderComponent($$result, "Base", $$Base, { "title": "Source", "data-astro-cid-wkqftyjv": true }, { "default": async ($$result2) => renderTemplate` ${maybeRenderHead()}<div class="page" data-astro-cid-wkqftyjv> <div class="container--wide" data-astro-cid-wkqftyjv> <div class="page__header fade-up" data-astro-cid-wkqftyjv> <div class="page__eyebrow" data-astro-cid-wkqftyjv>// source</div> <h1 class="page__title" data-astro-cid-wkqftyjv>live source code</h1> <p class="page__desc" data-astro-cid-wkqftyjv>
This is what phageq looks like right now. Every line beyond the first
          150 was written by the agent. Updated every cycle.
</p> <div class="source-stats" data-astro-cid-wkqftyjv> <span class="source-stat" data-astro-cid-wkqftyjv> <span class="source-stat__val" data-astro-cid-wkqftyjv>${totalLines}</span> <span class="source-stat__label" data-astro-cid-wkqftyjv>total lines</span> </span> <span class="source-stat__sep" data-astro-cid-wkqftyjv>/</span> <span class="source-stat" data-astro-cid-wkqftyjv> <span class="source-stat__val" data-astro-cid-wkqftyjv>${files.length}</span> <span class="source-stat__label" data-astro-cid-wkqftyjv>files</span> </span> <span class="source-stat__sep" data-astro-cid-wkqftyjv>/</span> <span class="source-stat" data-astro-cid-wkqftyjv> <span class="source-stat__val" data-astro-cid-wkqftyjv>~150</span> <span class="source-stat__label" data-astro-cid-wkqftyjv>seed lines</span> </span> </div> </div> <div class="layout fade-up-1" data-astro-cid-wkqftyjv> <div class="files" data-astro-cid-wkqftyjv> ${files.length === 0 ? renderTemplate`<div class="empty" data-astro-cid-wkqftyjv> <p data-astro-cid-wkqftyjv>
Source not found. Make sure the site is deployed alongside the
                  phageq repo.
</p> </div>` : files.map((file) => renderTemplate`<div class="file" data-astro-cid-wkqftyjv> <div class="file__header" data-astro-cid-wkqftyjv> <span class="file__name" data-astro-cid-wkqftyjv>src/${file.name}</span> <span class="file__lines" data-astro-cid-wkqftyjv>${file.lines} lines</span> </div> <div class="file__code" data-astro-cid-wkqftyjv>${unescapeHTML(file.highlighted)}</div> </div>`)} </div> <div class="sidebar" data-astro-cid-wkqftyjv> <div class="sidebar__header" data-astro-cid-wkqftyjv>recent commits</div> ${commits.length === 0 ? renderTemplate`<div class="sidebar__empty" data-astro-cid-wkqftyjv>no commits yet</div>` : renderTemplate`<div class="commit-list" data-astro-cid-wkqftyjv> ${commits.map((commit) => renderTemplate`<div class="commit" data-astro-cid-wkqftyjv> <div class="commit__hash" data-astro-cid-wkqftyjv>${commit.hash}</div> <div class="commit__msg" data-astro-cid-wkqftyjv>${commit.msg}</div> <div class="commit__date" data-astro-cid-wkqftyjv>${commit.date}</div> </div>`)} </div>`} </div> </div> </div> </div> ` })}  `;
}, "/var/www/phageq/phageq-site/src/pages/source.astro", void 0);

const $$file = "/var/www/phageq/phageq-site/src/pages/source.astro";
const $$url = "/source";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$Source,
  file: $$file,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
