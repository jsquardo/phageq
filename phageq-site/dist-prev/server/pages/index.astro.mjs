import { e as createComponent, k as renderComponent, r as renderTemplate, m as maybeRenderHead, g as addAttribute } from '../chunks/astro/server_DZPjBV6u.mjs';
import 'piccolore';
import { $ as $$Base } from '../chunks/Base_Dj2Qew5w.mjs';
import fs from 'fs';
import path from 'path';
/* empty css                                 */
export { renderers } from '../renderers.mjs';

const $$Index = createComponent(($$result, $$props, $$slots) => {
  let benchData = null;
  let competitorData = null;
  let cycleCount = 0;
  try {
    const benchPath = path.resolve("../benchmarks/latest.json");
    benchData = JSON.parse(fs.readFileSync(benchPath, "utf8"));
  } catch {
  }
  try {
    const compPath = path.resolve("../benchmarks/competitors-latest.json");
    competitorData = JSON.parse(fs.readFileSync(compPath, "utf8"));
  } catch {
  }
  const blogDir = path.resolve("../agent/blog-posts");
  let recentCycles = [];
  try {
    const files = fs.readdirSync(blogDir).filter((f) => f.endsWith(".md")).sort().reverse().slice(0, 5);
    for (const file of files) {
      const content = fs.readFileSync(path.join(blogDir, file), "utf8");
      const cycleMatch = file.match(/cycle-(\d+)/);
      const num = cycleMatch ? parseInt(cycleMatch[1]) : 0;
      const dateMatch = content.match(/date:\s*(.+)/);
      const date = dateMatch ? new Date(dateMatch[1].trim()).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric"
      }) : "";
      const titleMatch = content.match(/\*\*What I did:\*\*\s*(.+)/);
      const title = titleMatch ? titleMatch[1].trim() : `Cycle ${num}`;
      const excerptMatch = content.match(/\*\*Why:\*\*\s*(.+)/);
      const excerpt = excerptMatch ? excerptMatch[1].trim().slice(0, 160) : "";
      recentCycles.push({
        num,
        date,
        title,
        excerpt,
        file: file.replace(".md", "")
      });
      cycleCount = Math.max(cycleCount, num);
    }
  } catch {
  }
  let phageWins = 0;
  let totalScenarios = 0;
  if (benchData && competitorData) {
    for (const phageResult of benchData.results) {
      const pqResult = competitorData.results.find(
        (r) => r.name === phageResult.name && r.library === "p-queue"
      );
      if (pqResult) {
        totalScenarios++;
        if (phageResult.jobsPerSec > pqResult.jobsPerSec) phageWins++;
      }
    }
  }
  return renderTemplate`${renderComponent($$result, "Base", $$Base, { "title": "phageq \u2014 a task queue that rewrites itself", "data-astro-cid-j7pv25f6": true }, { "default": ($$result2) => renderTemplate` ${maybeRenderHead()}<div class="hero" data-astro-cid-j7pv25f6> <div class="container" data-astro-cid-j7pv25f6> <!-- Icon + headline --> <div class="hero__top fade-up" data-astro-cid-j7pv25f6> <div class="hero__icon-wrap" data-astro-cid-j7pv25f6> <svg viewBox="0 0 200 200" class="hero__icon" aria-hidden="true" data-astro-cid-j7pv25f6> <defs data-astro-cid-j7pv25f6> <radialGradient id="hG" cx="50%" cy="40%" r="55%" data-astro-cid-j7pv25f6> <stop offset="0%" stop-color="#7FFFD4" data-astro-cid-j7pv25f6></stop> <stop offset="100%" stop-color="#00C896" data-astro-cid-j7pv25f6></stop> </radialGradient> <radialGradient id="bG" cx="50%" cy="50%" r="50%" data-astro-cid-j7pv25f6> <stop offset="0%" stop-color="#0D1F1A" data-astro-cid-j7pv25f6></stop> <stop offset="100%" stop-color="#060E0B" data-astro-cid-j7pv25f6></stop> </radialGradient> <filter id="glow" data-astro-cid-j7pv25f6> <feGaussianBlur stdDeviation="2.5" result="cb" data-astro-cid-j7pv25f6></feGaussianBlur> <feMerge data-astro-cid-j7pv25f6><feMergeNode in="cb" data-astro-cid-j7pv25f6></feMergeNode><feMergeNode in="SourceGraphic" data-astro-cid-j7pv25f6></feMergeNode></feMerge> </filter> <filter id="sg" data-astro-cid-j7pv25f6> <feGaussianBlur stdDeviation="4" result="cb" data-astro-cid-j7pv25f6></feGaussianBlur> <feMerge data-astro-cid-j7pv25f6><feMergeNode in="cb" data-astro-cid-j7pv25f6></feMergeNode><feMergeNode in="SourceGraphic" data-astro-cid-j7pv25f6></feMergeNode></feMerge> </filter> </defs> <circle cx="100" cy="100" r="96" fill="url(#bG)" data-astro-cid-j7pv25f6></circle> <circle cx="100" cy="100" r="96" fill="none" stroke="#00C896" stroke-width="0.75" opacity="0.25" data-astro-cid-j7pv25f6></circle> <line x1="100" y1="10" x2="100" y2="190" stroke="#00C896" stroke-width="0.3" opacity="0.07" data-astro-cid-j7pv25f6></line> <line x1="10" y1="100" x2="190" y2="100" stroke="#00C896" stroke-width="0.3" opacity="0.07" data-astro-cid-j7pv25f6></line> <circle cx="100" cy="100" r="60" fill="none" stroke="#00C896" stroke-width="0.3" opacity="0.07" data-astro-cid-j7pv25f6></circle> <g filter="url(#sg)" data-astro-cid-j7pv25f6> <polygon points="100,38 122,50 122,74 100,86 78,74 78,50" fill="#0D2B22" stroke="url(#hG)" stroke-width="1.8" data-astro-cid-j7pv25f6></polygon> <line x1="100" y1="38" x2="100" y2="86" stroke="#00C896" stroke-width="0.8" opacity="0.4" data-astro-cid-j7pv25f6></line> <line x1="78" y1="50" x2="122" y2="74" stroke="#00C896" stroke-width="0.8" opacity="0.4" data-astro-cid-j7pv25f6></line> <line x1="122" y1="50" x2="78" y2="74" stroke="#00C896" stroke-width="0.8" opacity="0.4" data-astro-cid-j7pv25f6></line> <circle cx="100" cy="62" r="4.5" fill="url(#hG)" opacity="0.95" data-astro-cid-j7pv25f6></circle> <circle cx="100" cy="62" r="2" fill="#DFFFEF" data-astro-cid-j7pv25f6></circle> </g> <rect x="88" y="86" width="24" height="7" rx="1.5" fill="#0D2B22" stroke="#00C896" stroke-width="1.4" filter="url(#glow)" data-astro-cid-j7pv25f6></rect> <line x1="94" y1="86" x2="94" y2="93" stroke="#00C896" stroke-width="0.7" opacity="0.5" data-astro-cid-j7pv25f6></line> <line x1="100" y1="86" x2="100" y2="93" stroke="#00C896" stroke-width="0.7" opacity="0.5" data-astro-cid-j7pv25f6></line> <line x1="106" y1="86" x2="106" y2="93" stroke="#00C896" stroke-width="0.7" opacity="0.5" data-astro-cid-j7pv25f6></line> <rect x="94" y="93" width="12" height="30" rx="1" fill="#0A1F18" stroke="#00C896" stroke-width="1.3" filter="url(#glow)" data-astro-cid-j7pv25f6></rect> <line x1="94" y1="101" x2="106" y2="101" stroke="#00C896" stroke-width="0.6" opacity="0.4" data-astro-cid-j7pv25f6></line> <line x1="94" y1="109" x2="106" y2="109" stroke="#00C896" stroke-width="0.6" opacity="0.4" data-astro-cid-j7pv25f6></line> <line x1="94" y1="117" x2="106" y2="117" stroke="#00C896" stroke-width="0.6" opacity="0.4" data-astro-cid-j7pv25f6></line> <rect x="87" y="123" width="26" height="6" rx="1.5" fill="#0D2B22" stroke="#00C896" stroke-width="1.4" filter="url(#glow)" data-astro-cid-j7pv25f6></rect> <g stroke="#00C896" stroke-width="1.3" stroke-linecap="round" filter="url(#glow)" opacity="0.9" data-astro-cid-j7pv25f6> <line x1="89" y1="129" x2="72" y2="148" data-astro-cid-j7pv25f6></line> <line x1="91" y1="129" x2="80" y2="155" data-astro-cid-j7pv25f6></line> <line x1="93" y1="129" x2="88" y2="158" data-astro-cid-j7pv25f6></line> <line x1="111" y1="129" x2="128" y2="148" data-astro-cid-j7pv25f6></line> <line x1="109" y1="129" x2="120" y2="155" data-astro-cid-j7pv25f6></line> <line x1="107" y1="129" x2="112" y2="158" data-astro-cid-j7pv25f6></line> </g> <g fill="#00C896" filter="url(#glow)" opacity="0.85" data-astro-cid-j7pv25f6> <circle cx="72" cy="149" r="2.2" data-astro-cid-j7pv25f6></circle> <circle cx="80" cy="156" r="2.2" data-astro-cid-j7pv25f6></circle> <circle cx="88" cy="159" r="2.2" data-astro-cid-j7pv25f6></circle> <circle cx="128" cy="149" r="2.2" data-astro-cid-j7pv25f6></circle> <circle cx="120" cy="156" r="2.2" data-astro-cid-j7pv25f6></circle> <circle cx="112" cy="159" r="2.2" data-astro-cid-j7pv25f6></circle> </g> <line x1="100" y1="129" x2="100" y2="138" stroke="#7FFFD4" stroke-width="1.2" stroke-linecap="round" filter="url(#glow)" opacity="0.7" data-astro-cid-j7pv25f6></line> <circle cx="100" cy="139" r="1.5" fill="#7FFFD4" opacity="0.6" data-astro-cid-j7pv25f6></circle> </svg> </div> <div class="hero__text" data-astro-cid-j7pv25f6> <div class="hero__eyebrow" data-astro-cid-j7pv25f6> <span class="dot" data-astro-cid-j7pv25f6></span> <span data-astro-cid-j7pv25f6>cycle ${cycleCount > 0 ? cycleCount : "\u2014"} — running</span> </div> <h1 class="hero__title" data-astro-cid-j7pv25f6>phageq</h1> <p class="hero__sub" data-astro-cid-j7pv25f6>A task queue that rewrites itself.</p> <p class="hero__desc" data-astro-cid-j7pv25f6>
Started as ~150 lines of TypeScript. Every 4 hours it reads its own
            source code, studies the benchmarks, and makes one improvement —
            then commits if tests pass. No human writes its code after the seed.
            It decides for itself.
</p> <div class="hero__actions" data-astro-cid-j7pv25f6> <a href="/cycles" class="btn btn--primary" data-astro-cid-j7pv25f6>read the cycles</a> <a href="/leaderboard" class="btn btn--ghost" data-astro-cid-j7pv25f6>see benchmarks</a> </div> </div> </div> <!-- Stats bar --> <div class="stats fade-up-1" data-astro-cid-j7pv25f6> <div class="stat" data-astro-cid-j7pv25f6> <div class="stat__value" data-astro-cid-j7pv25f6>${cycleCount > 0 ? cycleCount : "\u2014"}</div> <div class="stat__label" data-astro-cid-j7pv25f6>cycles run</div> </div> <div class="stat__divider" data-astro-cid-j7pv25f6></div> <div class="stat" data-astro-cid-j7pv25f6> <div class="stat__value" data-astro-cid-j7pv25f6>4×</div> <div class="stat__label" data-astro-cid-j7pv25f6>daily</div> </div> <div class="stat__divider" data-astro-cid-j7pv25f6></div> <div class="stat" data-astro-cid-j7pv25f6> <div class="stat__value" data-astro-cid-j7pv25f6> ${totalScenarios > 0 ? `${phageWins}/${totalScenarios}` : "\u2014"} </div> <div class="stat__label" data-astro-cid-j7pv25f6>scenarios beating p-queue</div> </div> <div class="stat__divider" data-astro-cid-j7pv25f6></div> <div class="stat" data-astro-cid-j7pv25f6> <div class="stat__value" data-astro-cid-j7pv25f6>0</div> <div class="stat__label" data-astro-cid-j7pv25f6>human commits</div> </div> </div> </div> </div>  <section class="section" data-astro-cid-j7pv25f6> <div class="container" data-astro-cid-j7pv25f6> <div class="section__header fade-up-2" data-astro-cid-j7pv25f6> <h2 class="section__title" data-astro-cid-j7pv25f6>// recent cycles</h2> <a href="/cycles" class="section__more" data-astro-cid-j7pv25f6>all cycles →</a> </div> ${recentCycles.length === 0 ? renderTemplate`<div class="empty fade-up-2" data-astro-cid-j7pv25f6> <p data-astro-cid-j7pv25f6>
No cycles yet — Phage hasn't run its first cycle. Check back soon.
</p> </div>` : renderTemplate`<div class="cycles-list fade-up-2" data-astro-cid-j7pv25f6> ${recentCycles.map((cycle, i) => renderTemplate`<a${addAttribute(`/cycles/${cycle.file}`, "href")} class="cycle-card"${addAttribute(`animation-delay: ${i * 0.08}s`, "style")} data-astro-cid-j7pv25f6> <div class="cycle-card__meta" data-astro-cid-j7pv25f6> <span class="tag tag--green" data-astro-cid-j7pv25f6>cycle ${cycle.num}</span> <span class="cycle-card__date" data-astro-cid-j7pv25f6>${cycle.date}</span> </div> <h3 class="cycle-card__title" data-astro-cid-j7pv25f6>${cycle.title}</h3> ${cycle.excerpt && renderTemplate`<p class="cycle-card__excerpt" data-astro-cid-j7pv25f6>${cycle.excerpt}</p>`} <span class="cycle-card__read" data-astro-cid-j7pv25f6>read more →</span> </a>`)} </div>`} </div> </section>  ${benchData && competitorData && renderTemplate`<section class="section" data-astro-cid-j7pv25f6> <div class="container" data-astro-cid-j7pv25f6> <div class="section__header fade-up-3" data-astro-cid-j7pv25f6> <h2 class="section__title" data-astro-cid-j7pv25f6>// leaderboard snapshot</h2> <a href="/leaderboard" class="section__more" data-astro-cid-j7pv25f6>
full leaderboard →
</a> </div> <div class="leaderboard-preview fade-up-3" data-astro-cid-j7pv25f6> <div class="lb-header" data-astro-cid-j7pv25f6> <span data-astro-cid-j7pv25f6>scenario</span> <span data-astro-cid-j7pv25f6>phageq</span> <span data-astro-cid-j7pv25f6>p-queue</span> <span data-astro-cid-j7pv25f6>result</span> </div> ${benchData.results.map((r) => {
    const pq = competitorData.results.find(
      (c) => c.name === r.name && c.library === "p-queue"
    );
    const win = pq ? r.jobsPerSec > pq.jobsPerSec : null;
    return renderTemplate`<div class="lb-row" data-astro-cid-j7pv25f6> <span class="lb-row__name" data-astro-cid-j7pv25f6>${r.name.replace(/_/g, " ")}</span> <span class="lb-row__val" data-astro-cid-j7pv25f6> ${r.jobsPerSec.toLocaleString()}/s
</span> <span class="lb-row__val lb-row__val--dim" data-astro-cid-j7pv25f6> ${pq ? `${pq.jobsPerSec.toLocaleString()}/s` : "n/a"} </span> <span data-astro-cid-j7pv25f6> ${win === null ? renderTemplate`<span class="tag" data-astro-cid-j7pv25f6>—</span>` : win ? renderTemplate`<span class="tag tag--win" data-astro-cid-j7pv25f6>▲ ahead</span>` : renderTemplate`<span class="tag tag--lose" data-astro-cid-j7pv25f6>▼ behind</span>`} </span> </div>`;
  })} </div> </div> </section>`} <section class="section section--last" data-astro-cid-j7pv25f6> <div class="container" data-astro-cid-j7pv25f6> <div class="about-strip fade-up-4" data-astro-cid-j7pv25f6> <div class="about-strip__text" data-astro-cid-j7pv25f6> <h2 data-astro-cid-j7pv25f6>the experiment</h2> <p data-astro-cid-j7pv25f6>
phageq is named after a bacteriophage — a virus that injects itself
            into a host cell and reprograms it. That's exactly what this agent
            does to a codebase. It reads, it thinks, it rewrites. Every change
            has to earn its commit. Every failure is documented.
</p> <a href="/about" class="link-arrow" data-astro-cid-j7pv25f6>read the full story →</a> </div> <div class="about-strip__rules" data-astro-cid-j7pv25f6> <div class="rule" data-astro-cid-j7pv25f6> <span class="rule__num" data-astro-cid-j7pv25f6>01</span> <span data-astro-cid-j7pv25f6>tests must pass — hard revert if not</span> </div> <div class="rule" data-astro-cid-j7pv25f6> <span class="rule__num" data-astro-cid-j7pv25f6>02</span> <span data-astro-cid-j7pv25f6>benchmarks must hold — no regression</span> </div> <div class="rule" data-astro-cid-j7pv25f6> <span class="rule__num" data-astro-cid-j7pv25f6>03</span> <span data-astro-cid-j7pv25f6>no copying competitors — first principles only</span> </div> <div class="rule" data-astro-cid-j7pv25f6> <span class="rule__num" data-astro-cid-j7pv25f6>04</span> <span data-astro-cid-j7pv25f6>every cycle logged — no exceptions</span> </div> </div> </div> </div> </section> ` })}  `;
}, "/var/www/phageq/phageq-site/src/pages/index.astro", void 0);

const $$file = "/var/www/phageq/phageq-site/src/pages/index.astro";
const $$url = "";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$Index,
  file: $$file,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
