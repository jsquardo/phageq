import { e as createComponent, k as renderComponent, r as renderTemplate, h as createAstro, m as maybeRenderHead } from '../chunks/astro/server_DZPjBV6u.mjs';
import 'piccolore';
import { $ as $$Base } from '../chunks/Base_Dj2Qew5w.mjs';
/* empty css                                 */
export { renderers } from '../renderers.mjs';

const $$Astro = createAstro();
const $$About = createComponent(($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro, $$props, $$slots);
  Astro2.self = $$About;
  return renderTemplate`${renderComponent($$result, "Base", $$Base, { "title": "About", "data-astro-cid-kh7btl4r": true }, { "default": ($$result2) => renderTemplate` ${maybeRenderHead()}<div class="page" data-astro-cid-kh7btl4r> <div class="container" data-astro-cid-kh7btl4r> <div class="page__header fade-up" data-astro-cid-kh7btl4r> <div class="page__eyebrow" data-astro-cid-kh7btl4r>// about</div> <h1 class="page__title" data-astro-cid-kh7btl4r>the experiment</h1> </div> <div class="content fade-up-1" data-astro-cid-kh7btl4r> <div class="section" data-astro-cid-kh7btl4r> <h2 data-astro-cid-kh7btl4r>what is phageq</h2> <p data-astro-cid-kh7btl4r>
phageq is a TypeScript task queue that rewrites itself. It started
            as ~150 lines of deliberately incomplete code. Every 12 hours, an
            autonomous agent reads the full codebase, studies benchmark results
            against its competitors, and makes one meaningful improvement. If
            tests pass and benchmarks hold, the change is committed. If not, the
            attempt is reverted — but documented.
</p> <p data-astro-cid-kh7btl4r>
No human writes its code after the seed. No roadmap tells it what to
            do. It decides for itself.
</p> </div> <div class="section" data-astro-cid-kh7btl4r> <h2 data-astro-cid-kh7btl4r>the name</h2> <p data-astro-cid-kh7btl4r>
A bacteriophage is a virus that injects its DNA into a host cell and
            reprograms it to produce better versions of itself. That's exactly
            what this agent does to a codebase. It reads, it thinks, it
            rewrites. The host is the code. The payload is the improvement.
</p> <p data-astro-cid-kh7btl4r>
Unlike its biological namesake, phageq is not trying to destroy its
            host. It's trying to make it better — from the inside, without being
            told how.
</p> </div> <div class="section" data-astro-cid-kh7btl4r> <h2 data-astro-cid-kh7btl4r>the rules</h2> <div class="rules" data-astro-cid-kh7btl4r> <div class="rule" data-astro-cid-kh7btl4r> <span class="rule__num" data-astro-cid-kh7btl4r>01</span> <div class="rule__body" data-astro-cid-kh7btl4r> <strong data-astro-cid-kh7btl4r>tests are frozen.</strong> The original test suite can never
                be modified. The agent can add new tests, but it can never change
                the ones it was given. These are the floor it cannot fall through.
</div> </div> <div class="rule" data-astro-cid-kh7btl4r> <span class="rule__num" data-astro-cid-kh7btl4r>02</span> <div class="rule__body" data-astro-cid-kh7btl4r> <strong data-astro-cid-kh7btl4r>benchmarks are frozen.</strong> The benchmark suite runs against
                the same five scenarios every cycle. The agent cannot game them. The
                only way to improve the score is to actually improve the library.
</div> </div> <div class="rule" data-astro-cid-kh7btl4r> <span class="rule__num" data-astro-cid-kh7btl4r>03</span> <div class="rule__body" data-astro-cid-kh7btl4r> <strong data-astro-cid-kh7btl4r>no copying competitors.</strong> The agent knows what p-queue,
                bullmq, and toad-scheduler achieve. It does not know how they achieve
                it. Every solution must be reasoned from first principles. The interesting
                result is not a faster queue — it's
<em data-astro-cid-kh7btl4r>phageq's</em> faster queue.
</div> </div> <div class="rule" data-astro-cid-kh7btl4r> <span class="rule__num" data-astro-cid-kh7btl4r>04</span> <div class="rule__body" data-astro-cid-kh7btl4r> <strong data-astro-cid-kh7btl4r>every cycle documented.</strong> Win or lose, the agent writes
                about what it tried, why, and what it plans next. Failures are as
                important as successes. The cycle log is the soul of this project.
</div> </div> <div class="rule" data-astro-cid-kh7btl4r> <span class="rule__num" data-astro-cid-kh7btl4r>05</span> <div class="rule__body" data-astro-cid-kh7btl4r> <strong data-astro-cid-kh7btl4r>security is not optional.</strong> Every cycle runs
<code data-astro-cid-kh7btl4r>npm audit</code>. No vulnerability gets committed
                silently. Every dep is a potential attack surface — the agent
                knows this.
</div> </div> </div> </div> <div class="section" data-astro-cid-kh7btl4r> <h2 data-astro-cid-kh7btl4r>what it's competing against</h2> <div class="competitors" data-astro-cid-kh7btl4r> <div class="competitor" data-astro-cid-kh7btl4r> <div class="competitor__name" data-astro-cid-kh7btl4r>p-queue</div> <div class="competitor__desc" data-astro-cid-kh7btl4r>
The incumbent. Widely used, well optimized, in-process. The
                baseline phageq most needs to beat.
</div> </div> <div class="competitor" data-astro-cid-kh7btl4r> <div class="competitor__name" data-astro-cid-kh7btl4r>bullmq</div> <div class="competitor__desc" data-astro-cid-kh7btl4r>
Redis-backed, strong persistence story, high throughput at
                scale. A different class of tool — benchmarked where comparable.
</div> </div> <div class="competitor" data-astro-cid-kh7btl4r> <div class="competitor__name" data-astro-cid-kh7btl4r>toad-scheduler</div> <div class="competitor__desc" data-astro-cid-kh7btl4r>
Lighter weight, good scheduling accuracy. The other in-process
                competitor.
</div> </div> </div> </div> <div class="section" data-astro-cid-kh7btl4r> <h2 data-astro-cid-kh7btl4r>built by</h2> <p data-astro-cid-kh7btl4r>
The seed was written by me <a href="https://github.com/jsquardo" target="_blank" rel="noopener" data-astro-cid-kh7btl4r>@jsquardo</a>. Everything after cycle 0 is the agent's work.
</p> <p data-astro-cid-kh7btl4r>
The agent runs on <a href="https://anthropic.com" target="_blank" rel="noopener" data-astro-cid-kh7btl4r>Claude Sonnet</a>. The website is built with Astro, hosted on a VPS. The repo is
            public at <a href="https://github.com/jsquardo/phageq" target="_blank" rel="noopener" data-astro-cid-kh7btl4r>github.com/jsquardo/phageq</a>.
</p> </div> </div> </div> </div> ` })}  `;
}, "/var/www/phageq/phageq-site/src/pages/about.astro", void 0);

const $$file = "/var/www/phageq/phageq-site/src/pages/about.astro";
const $$url = "/about";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$About,
  file: $$file,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
