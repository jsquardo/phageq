import { e as createComponent, k as renderComponent, r as renderTemplate, m as maybeRenderHead, l as Fragment, g as addAttribute } from '../chunks/astro/server_DZPjBV6u.mjs';
import 'piccolore';
import { $ as $$Base } from '../chunks/Base_Dj2Qew5w.mjs';
import fs from 'fs';
import path from 'path';
/* empty css                                       */
export { renderers } from '../renderers.mjs';

const $$Leaderboard = createComponent(($$result, $$props, $$slots) => {
  let benchData = null;
  let competitorData = null;
  let lastUpdated = "";
  try {
    benchData = JSON.parse(fs.readFileSync(path.resolve("../benchmarks/latest.json"), "utf8"));
    lastUpdated = new Date(benchData.timestamp).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch {
  }
  try {
    competitorData = JSON.parse(fs.readFileSync(path.resolve("../benchmarks/competitors-latest.json"), "utf8"));
  } catch {
  }
  function getCompetitor(name, library) {
    return competitorData?.results?.find((r) => r.name === name && r.library === library);
  }
  function winTag(a, b) {
    if (!b) return "n/a";
    const delta = ((a - b) / b * 100).toFixed(1);
    if (a > b) return { type: "win", label: `+${delta}%` };
    if (a < b) return { type: "lose", label: `${delta}%` };
    return { type: "tie", label: "0%" };
  }
  return renderTemplate`${renderComponent($$result, "Base", $$Base, { "title": "Leaderboard", "data-astro-cid-qw5dklun": true }, { "default": ($$result2) => renderTemplate` ${maybeRenderHead()}<div class="page" data-astro-cid-qw5dklun> <div class="container--wide" data-astro-cid-qw5dklun> <div class="page__header fade-up" data-astro-cid-qw5dklun> <div class="page__eyebrow" data-astro-cid-qw5dklun>// leaderboard</div> <h1 class="page__title" data-astro-cid-qw5dklun>benchmark results</h1> <p class="page__desc" data-astro-cid-qw5dklun>
Every cycle, phageq runs the same frozen benchmark suite against itself
          and its competitors. The agent sees this table. It knows exactly where
          it's winning and where it's losing.
</p> ${lastUpdated && renderTemplate`<div class="updated" data-astro-cid-qw5dklun> <span class="dot" data-astro-cid-qw5dklun></span>
last updated: ${lastUpdated} </div>`} </div> ${!benchData || !competitorData ? renderTemplate`<div class="empty fade-up-1" data-astro-cid-qw5dklun> <p data-astro-cid-qw5dklun>No benchmark data yet. Run <code data-astro-cid-qw5dklun>npm run bench:all</code> from the phageq directory.</p> </div>` : renderTemplate`${renderComponent($$result2, "Fragment", Fragment, { "data-astro-cid-qw5dklun": true }, { "default": ($$result3) => renderTemplate`${benchData.results.map((phage) => {
    const pq = getCompetitor(phage.name, "p-queue");
    const ts = getCompetitor(phage.name, "toad-scheduler");
    const vsPQ = pq ? winTag(phage.jobsPerSec, pq.jobsPerSec) : null;
    const vsTS = ts ? winTag(phage.jobsPerSec, ts.jobsPerSec) : null;
    return renderTemplate`<div class="scenario fade-up-1" data-astro-cid-qw5dklun> <div class="scenario__header" data-astro-cid-qw5dklun> <h2 class="scenario__name" data-astro-cid-qw5dklun>${phage.name.replace(/_/g, " ")}</h2> <div class="scenario__tags" data-astro-cid-qw5dklun> ${vsPQ && typeof vsPQ === "object" && renderTemplate`<span${addAttribute(`tag tag--${vsPQ.type}`, "class")} data-astro-cid-qw5dklun>
p-queue ${vsPQ.label} </span>`} ${vsTS && typeof vsTS === "object" && renderTemplate`<span${addAttribute(`tag tag--${vsTS.type}`, "class")} data-astro-cid-qw5dklun>
toad-scheduler ${vsTS.label} </span>`} </div> </div> <div class="scenario__table" data-astro-cid-qw5dklun> <div class="tbl-header" data-astro-cid-qw5dklun> <span data-astro-cid-qw5dklun>library</span> <span data-astro-cid-qw5dklun>jobs/sec</span> <span data-astro-cid-qw5dklun>total time</span> <span data-astro-cid-qw5dklun>p50 latency</span> <span data-astro-cid-qw5dklun>p99 latency</span> <span data-astro-cid-qw5dklun>memory</span> </div> <!-- phageq row --> <div class="tbl-row tbl-row--highlight" data-astro-cid-qw5dklun> <span class="tbl-lib" data-astro-cid-qw5dklun> <span class="dot" data-astro-cid-qw5dklun></span>
phageq
</span> <span class="tbl-val tbl-val--primary" data-astro-cid-qw5dklun>${phage.jobsPerSec.toLocaleString()}</span> <span class="tbl-val" data-astro-cid-qw5dklun>${phage.totalMs.toFixed(0)}ms</span> <span class="tbl-val" data-astro-cid-qw5dklun>${phage.p50Ms < 1 ? `${(phage.p50Ms * 1e3).toFixed(0)}\u03BCs` : `${phage.p50Ms.toFixed(2)}ms`}</span> <span class="tbl-val" data-astro-cid-qw5dklun>${phage.p99Ms < 1 ? `${(phage.p99Ms * 1e3).toFixed(0)}\u03BCs` : `${phage.p99Ms.toFixed(2)}ms`}</span> <span class="tbl-val" data-astro-cid-qw5dklun>${phage.memoryMb.toFixed(1)}mb</span> </div> <!-- p-queue row --> ${pq && renderTemplate`<div class="tbl-row" data-astro-cid-qw5dklun> <span class="tbl-lib tbl-lib--dim" data-astro-cid-qw5dklun>p-queue</span> <span class="tbl-val" data-astro-cid-qw5dklun>${pq.jobsPerSec.toLocaleString()}</span> <span class="tbl-val" data-astro-cid-qw5dklun>${pq.totalMs.toFixed(0)}ms</span> <span class="tbl-val" data-astro-cid-qw5dklun>${pq.p50Ms < 1 ? `${(pq.p50Ms * 1e3).toFixed(0)}\u03BCs` : `${pq.p50Ms.toFixed(2)}ms`}</span> <span class="tbl-val" data-astro-cid-qw5dklun>${pq.p99Ms < 1 ? `${(pq.p99Ms * 1e3).toFixed(0)}\u03BCs` : `${pq.p99Ms.toFixed(2)}ms`}</span> <span class="tbl-val" data-astro-cid-qw5dklun>${pq.memoryMb.toFixed(1)}mb</span> </div>`} <!-- toad-scheduler row --> ${ts && renderTemplate`<div class="tbl-row" data-astro-cid-qw5dklun> <span class="tbl-lib tbl-lib--dim" data-astro-cid-qw5dklun>toad-scheduler</span> <span class="tbl-val" data-astro-cid-qw5dklun>${ts.jobsPerSec.toLocaleString()}</span> <span class="tbl-val" data-astro-cid-qw5dklun>${ts.totalMs.toFixed(0)}ms</span> <span class="tbl-val" data-astro-cid-qw5dklun>${ts.p50Ms < 1 ? `${(ts.p50Ms * 1e3).toFixed(0)}\u03BCs` : `${ts.p50Ms.toFixed(2)}ms`}</span> <span class="tbl-val" data-astro-cid-qw5dklun>${ts.p99Ms < 1 ? `${(ts.p99Ms * 1e3).toFixed(0)}\u03BCs` : `${ts.p99Ms.toFixed(2)}ms`}</span> <span class="tbl-val" data-astro-cid-qw5dklun>${ts.memoryMb.toFixed(1)}mb</span> </div>`} </div> </div>`;
  })}` })}`} </div> </div> ` })}  `;
}, "/var/www/phageq/phageq-site/src/pages/leaderboard.astro", void 0);

const $$file = "/var/www/phageq/phageq-site/src/pages/leaderboard.astro";
const $$url = "/leaderboard";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$Leaderboard,
  file: $$file,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
