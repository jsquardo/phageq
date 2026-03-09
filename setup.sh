#!/bin/bash
# phageq setup script
# Run this from inside your empty git repo directory
# Usage: bash setup.sh

set -e

echo "🧬 setting up phageq..."

# ─── Directory structure ──────────────────────────────────────────────────────

mkdir -p src
mkdir -p tests
mkdir -p benchmarks
mkdir -p agent/blog-posts
mkdir -p agent/archive
mkdir -p phageq-site/src/pages/cycles
mkdir -p phageq-site/src/pages/api
mkdir -p phageq-site/src/layouts
mkdir -p phageq-site/src/styles
mkdir -p phageq-site/public

echo "✅ directories created"

# ─── Root files ───────────────────────────────────────────────────────────────

cat > package.json << 'EOF'
{
  "name": "phageq",
  "version": "0.1.0",
  "description": "A task queue that rewrites itself.",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "type": "module",
  "scripts": {
    "build": "tsc",
    "test": "node --experimental-vm-modules node_modules/.bin/jest",
    "bench": "tsx benchmarks/run.ts",
    "bench:competitors": "tsx benchmarks/competitors.ts",
    "bench:all": "npm run bench && npm run bench:competitors",
    "agent": "tsx agent/loop.ts",
    "agent:watch": "tsx agent/loop.ts --watch"
  },
  "engines": {
    "node": ">=20"
  },
  "keywords": ["queue", "task-queue", "concurrency", "jobs"],
  "license": "MIT",
  "dependencies": {
    "@anthropic-ai/sdk": "^0.39.0"
  },
  "devDependencies": {
    "@types/jest": "^29.5.12",
    "@types/node": "^20.12.0",
    "bullmq": "^5.12.0",
    "jest": "^29.7.0",
    "p-queue": "^8.0.1",
    "toad-scheduler": "^3.0.0",
    "ts-jest": "^29.1.4",
    "tsx": "^4.7.2",
    "typescript": "^5.4.5"
  }
}
EOF

cat > tsconfig.json << 'EOF'
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "benchmarks", "tests"]
}
EOF

cat > jest.config.js << 'EOF'
/** @type {import('jest').Config} */
export default {
  preset: "ts-jest/presets/default-esm",
  testEnvironment: "node",
  testMatch: ["**/tests/**/*.test.ts"],
  extensionsToTreatAsEsm: [".ts"],
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        useESM: true,
        tsconfig: {
          module: "NodeNext",
          moduleResolution: "NodeNext",
        },
      },
    ],
  },
};
EOF

cat > .gitignore << 'EOF'
node_modules/
dist/
.env
benchmarks/latest.json
benchmarks/competitors-latest.json
agent/archive/
phageq-site/node_modules/
phageq-site/dist/
phageq-site/.astro/
EOF

cat > .env.example << 'EOF'
# Required — your Anthropic API key
ANTHROPIC_API_KEY=sk-ant-...

# Optional — shared secret to secure the blog rebuild webhook
PHAGE_WEBHOOK_SECRET=your-secret-here

# Optional — webhook URL to trigger blog rebuild after each cycle
PHAGE_BLOG_WEBHOOK=http://localhost:4321/api/rebuild
EOF

echo "✅ root config files created"

# ─── src/index.ts ─────────────────────────────────────────────────────────────

cat > src/index.ts << 'EOF'
import { EventEmitter } from "events";

// ─── Types ────────────────────────────────────────────────────────────────────

export type JobStatus = "pending" | "running" | "completed" | "failed";

export interface JobDefinition<T = unknown> {
  /** Unique identifier — auto-generated if not provided */
  id?: string;
  /** The async work to perform */
  run: () => Promise<T>;
  /** Arbitrary metadata attached to the job */
  meta?: Record<string, unknown>;
}

export interface Job<T = unknown> {
  id: string;
  status: JobStatus;
  meta: Record<string, unknown>;
  result?: T;
  error?: Error;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
}

export interface QueueOptions {
  /** Maximum number of jobs running concurrently. Default: 1 */
  concurrency?: number;
}

// ─── Queue ────────────────────────────────────────────────────────────────────

export class Queue<T = unknown> extends EventEmitter {
  private readonly concurrency: number;
  private running: number = 0;
  private readonly pending: Array<{ def: JobDefinition<T>; job: Job<T> }> = [];
  private readonly jobs: Map<string, Job<T>> = new Map();

  constructor(options: QueueOptions = {}) {
    super();
    this.concurrency = Math.max(1, options.concurrency ?? 1);
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  /** Add a job to the queue. Returns the Job record immediately. */
  add(definition: JobDefinition<T>): Job<T> {
    const job: Job<T> = {
      id: definition.id ?? this.generateId(),
      status: "pending",
      meta: definition.meta ?? {},
      createdAt: Date.now(),
    };

    this.jobs.set(job.id, job);
    this.pending.push({ def: definition, job });
    this.drain();

    return job;
  }

  /** Get a job by id */
  get(id: string): Job<T> | undefined {
    return this.jobs.get(id);
  }

  /** Number of jobs currently running */
  get activeCount(): number {
    return this.running;
  }

  /** Number of jobs waiting to run */
  get pendingCount(): number {
    return this.pending.length;
  }

  /** Total jobs tracked (pending + running + done) */
  get size(): number {
    return this.jobs.size;
  }

  /** Resolves when the queue is empty and all jobs have finished */
  onIdle(): Promise<void> {
    if (this.running === 0 && this.pending.length === 0) {
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      this.once("idle", resolve);
    });
  }

  // ── Internal ────────────────────────────────────────────────────────────────

  private drain(): void {
    while (this.running < this.concurrency && this.pending.length > 0) {
      const next = this.pending.shift();
      if (next) this.execute(next.def, next.job);
    }
  }

  private async execute(def: JobDefinition<T>, job: Job<T>): Promise<void> {
    this.running++;
    job.status = "running";
    job.startedAt = Date.now();

    try {
      job.result = await def.run();
      job.status = "completed";
      job.completedAt = Date.now();
      this.emit("completed", job);
    } catch (err) {
      job.error = err instanceof Error ? err : new Error(String(err));
      job.status = "failed";
      job.completedAt = Date.now();
      this.emit("failed", job);
    } finally {
      this.running--;
      this.drain();
      if (this.running === 0 && this.pending.length === 0) {
        this.emit("idle");
      }
    }
  }

  private generateId(): string {
    return `job_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }
}
EOF

echo "✅ src/index.ts created"

# ─── tests/queue.test.ts ──────────────────────────────────────────────────────

cat > tests/queue.test.ts << 'EOF'
import { Queue } from "../src/index.js";

// ─── Core behavior ────────────────────────────────────────────────────────────

describe("Queue — core", () => {
  test("runs a single job", async () => {
    const q = new Queue();
    let ran = false;
    q.add({ run: async () => { ran = true; } });
    await q.onIdle();
    expect(ran).toBe(true);
  });

  test("returns job with correct initial state", () => {
    const q = new Queue();
    const job = q.add({ run: async () => "done" });
    expect(job.id).toBeDefined();
    expect(["pending", "running"]).toContain(job.status);
    expect(job.createdAt).toBeLessThanOrEqual(Date.now());
  });

  test("job status transitions to completed", async () => {
    const q = new Queue();
    const job = q.add({ run: async () => 42 });
    await q.onIdle();
    expect(job.status).toBe("completed");
    expect(job.result).toBe(42);
    expect(job.completedAt).toBeDefined();
  });

  test("job status transitions to failed on error", async () => {
    const q = new Queue();
    const job = q.add({ run: async () => { throw new Error("boom"); } });
    await q.onIdle();
    expect(job.status).toBe("failed");
    expect(job.error?.message).toBe("boom");
  });

  test("preserves job metadata", async () => {
    const q = new Queue();
    const job = q.add({ run: async () => {}, meta: { userId: 123, type: "email" } });
    expect(job.meta.userId).toBe(123);
    expect(job.meta.type).toBe("email");
  });

  test("retrieves job by id", async () => {
    const q = new Queue();
    const job = q.add({ id: "my-job", run: async () => {} });
    expect(q.get("my-job")).toBe(job);
  });
});

// ─── Concurrency ─────────────────────────────────────────────────────────────

describe("Queue — concurrency", () => {
  test("respects concurrency limit", async () => {
    const q = new Queue({ concurrency: 2 });
    let maxConcurrent = 0;
    let current = 0;

    Array.from({ length: 10 }, () =>
      q.add({
        run: async () => {
          current++;
          maxConcurrent = Math.max(maxConcurrent, current);
          await new Promise((r) => setTimeout(r, 10));
          current--;
        },
      })
    );

    await q.onIdle();
    expect(maxConcurrent).toBeLessThanOrEqual(2);
  });

  test("runs all jobs when concurrency is high", async () => {
    const q = new Queue({ concurrency: 50 });
    let count = 0;
    Array.from({ length: 100 }, () =>
      q.add({ run: async () => { count++; } })
    );
    await q.onIdle();
    expect(count).toBe(100);
  });

  test("activeCount and pendingCount are accurate", async () => {
    const q = new Queue({ concurrency: 1 });
    let resolveFirst!: () => void;

    q.add({
      run: () => new Promise<void>((r) => { resolveFirst = r; }),
    });

    q.add({ run: async () => {} });

    await new Promise((r) => setImmediate(r));

    expect(q.activeCount).toBe(1);
    expect(q.pendingCount).toBe(1);

    resolveFirst();
    await q.onIdle();

    expect(q.activeCount).toBe(0);
    expect(q.pendingCount).toBe(0);
  });
});

// ─── Events ───────────────────────────────────────────────────────────────────

describe("Queue — events", () => {
  test("emits completed event", async () => {
    const q = new Queue();
    const completed: string[] = [];
    q.on("completed", (job) => completed.push(job.id));
    const job = q.add({ run: async () => {} });
    await q.onIdle();
    expect(completed).toContain(job.id);
  });

  test("emits failed event", async () => {
    const q = new Queue();
    const failed: string[] = [];
    q.on("failed", (job) => failed.push(job.id));
    const job = q.add({ run: async () => { throw new Error("fail"); } });
    await q.onIdle();
    expect(failed).toContain(job.id);
  });

  test("emits idle when queue drains", async () => {
    const q = new Queue({ concurrency: 5 });
    let idleFired = false;
    q.on("idle", () => { idleFired = true; });
    Array.from({ length: 10 }, () => q.add({ run: async () => {} }));
    await q.onIdle();
    expect(idleFired).toBe(true);
  });

  test("onIdle resolves immediately if already idle", async () => {
    const q = new Queue();
    await expect(q.onIdle()).resolves.toBeUndefined();
  });
});

// ─── Edge cases ───────────────────────────────────────────────────────────────

describe("Queue — edge cases", () => {
  test("failed jobs do not block the queue", async () => {
    const q = new Queue({ concurrency: 1 });
    let secondRan = false;

    q.add({ run: async () => { throw new Error("first fails"); } });
    q.add({ run: async () => { secondRan = true; } });

    await q.onIdle();
    expect(secondRan).toBe(true);
  });

  test("handles 10,000 jobs without crashing", async () => {
    const q = new Queue({ concurrency: 50 });
    let count = 0;
    Array.from({ length: 10_000 }, () =>
      q.add({ run: async () => { count++; } })
    );
    await q.onIdle();
    expect(count).toBe(10_000);
  });

  test("size reflects total jobs tracked", async () => {
    const q = new Queue();
    q.add({ run: async () => {} });
    q.add({ run: async () => {} });
    await q.onIdle();
    expect(q.size).toBe(2);
  });
});
EOF

echo "✅ tests/queue.test.ts created"

# ─── benchmarks/run.ts ────────────────────────────────────────────────────────

cat > benchmarks/run.ts << 'EOF'
/**
 * phageq benchmark suite — FROZEN
 * This file is never modified by the agent.
 */

import { Queue } from "../src/index.js";

const SCENARIOS = [
  { name: "throughput_small",   concurrency: 10,  jobCount: 10_000,  workMs: 0 },
  { name: "throughput_large",   concurrency: 20,  jobCount: 50_000,  workMs: 0 },
  { name: "latency_sensitive",  concurrency: 1,   jobCount: 1_000,   workMs: 0 },
  { name: "concurrent_heavy",   concurrency: 100, jobCount: 5_000,   workMs: 1 },
  { name: "memory_pressure",    concurrency: 50,  jobCount: 100_000, workMs: 0 },
];

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function percentile(sorted: number[], p: number): number {
  const idx = Math.floor((p / 100) * sorted.length);
  return sorted[Math.min(idx, sorted.length - 1)];
}

async function runScenario(scenario: (typeof SCENARIOS)[number]) {
  const latencies: number[] = [];
  const queue = new Queue({ concurrency: scenario.concurrency });
  const memBefore = process.memoryUsage().heapUsed;
  const start = performance.now();

  for (let i = 0; i < scenario.jobCount; i++) {
    queue.add({
      run: async () => {
        const t = performance.now();
        if (scenario.workMs > 0) await sleep(scenario.workMs);
        latencies.push(performance.now() - t);
      },
    });
  }

  await queue.onIdle();
  const totalMs = performance.now() - start;
  const memoryMb = (process.memoryUsage().heapUsed - memBefore) / 1024 / 1024;
  latencies.sort((a, b) => a - b);

  return {
    name: scenario.name,
    jobsPerSec: Math.round((scenario.jobCount / totalMs) * 1000),
    totalMs,
    p50Ms: percentile(latencies, 50),
    p99Ms: percentile(latencies, 99),
    memoryMb,
  };
}

async function main() {
  console.log("\n  phageq benchmark suite\n");
  const results: Record<string, unknown>[] = [];

  for (const scenario of SCENARIOS) {
    process.stdout.write(`  running: ${scenario.name}...`);
    const result = await runScenario(scenario);
    results.push(result);
    console.log(` ${result.jobsPerSec.toLocaleString()} jobs/sec`);
  }

  const fs = await import("fs/promises");
  await fs.writeFile("benchmarks/latest.json", JSON.stringify({
    timestamp: new Date().toISOString(),
    version: "0.1.0",
    results,
  }, null, 2));

  console.log("\n  results written to benchmarks/latest.json\n");
}

main().catch(console.error);
EOF

# ─── benchmarks/competitors.ts ────────────────────────────────────────────────

cat > benchmarks/competitors.ts << 'EOF'
/**
 * phageq competitor benchmarks — FROZEN
 * This file is never modified by the agent.
 */

import PQueue from "p-queue";

const SCENARIOS = [
  { name: "throughput_small",   concurrency: 10,  jobCount: 10_000,  workMs: 0 },
  { name: "throughput_large",   concurrency: 20,  jobCount: 50_000,  workMs: 0 },
  { name: "latency_sensitive",  concurrency: 1,   jobCount: 1_000,   workMs: 0 },
  { name: "concurrent_heavy",   concurrency: 100, jobCount: 5_000,   workMs: 1 },
  { name: "memory_pressure",    concurrency: 50,  jobCount: 100_000, workMs: 0 },
];

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function percentile(sorted: number[], p: number): number {
  const idx = Math.floor((p / 100) * sorted.length);
  return sorted[Math.min(idx, sorted.length - 1)];
}

async function runPQueue(scenario: (typeof SCENARIOS)[number]) {
  const latencies: number[] = [];
  const queue = new PQueue({ concurrency: scenario.concurrency });
  const memBefore = process.memoryUsage().heapUsed;
  const start = performance.now();

  const jobs = Array.from({ length: scenario.jobCount }, () =>
    queue.add(async () => {
      const t = performance.now();
      if (scenario.workMs > 0) await sleep(scenario.workMs);
      latencies.push(performance.now() - t);
    })
  );

  await queue.onIdle();
  const totalMs = performance.now() - start;
  const memoryMb = (process.memoryUsage().heapUsed - memBefore) / 1024 / 1024;
  latencies.sort((a, b) => a - b);

  return {
    name: scenario.name,
    library: "p-queue",
    jobsPerSec: Math.round((scenario.jobCount / totalMs) * 1000),
    totalMs,
    p50Ms: percentile(latencies, 50),
    p99Ms: percentile(latencies, 99),
    memoryMb,
  };
}

async function runToadScheduler(scenario: (typeof SCENARIOS)[number]) {
  const latencies: number[] = [];
  let completed = 0;
  const semaphore = { count: 0 };
  const queue: Array<() => void> = [];
  const memBefore = process.memoryUsage().heapUsed;
  const start = performance.now();

  function tryNext() {
    while (semaphore.count < scenario.concurrency && queue.length > 0) {
      const run = queue.shift()!;
      semaphore.count++;
      run();
    }
  }

  await new Promise<void>((resolve) => {
    for (let i = 0; i < scenario.jobCount; i++) {
      queue.push(async () => {
        const t = performance.now();
        if (scenario.workMs > 0) await sleep(scenario.workMs);
        latencies.push(performance.now() - t);
        semaphore.count--;
        completed++;
        if (completed === scenario.jobCount) resolve();
        else tryNext();
      });
    }
    tryNext();
  });

  const totalMs = performance.now() - start;
  const memoryMb = (process.memoryUsage().heapUsed - memBefore) / 1024 / 1024;
  latencies.sort((a, b) => a - b);

  return {
    name: scenario.name,
    library: "toad-scheduler",
    jobsPerSec: Math.round((scenario.jobCount / totalMs) * 1000),
    totalMs,
    p50Ms: percentile(latencies, 50),
    p99Ms: percentile(latencies, 99),
    memoryMb,
  };
}

async function main() {
  console.log("\n  running competitor benchmarks...\n");
  const results: Record<string, unknown>[] = [];

  for (const scenario of SCENARIOS) {
    process.stdout.write(`  [p-queue]        ${scenario.name}...`);
    const pq = await runPQueue(scenario);
    results.push(pq);
    console.log(` ${pq.jobsPerSec.toLocaleString()} jobs/sec`);

    process.stdout.write(`  [toad-scheduler] ${scenario.name}...`);
    const ts = await runToadScheduler(scenario);
    results.push(ts);
    console.log(` ${ts.jobsPerSec.toLocaleString()} jobs/sec`);
  }

  const fs = await import("fs/promises");
  await fs.writeFile("benchmarks/competitors-latest.json", JSON.stringify({
    timestamp: new Date().toISOString(),
    results,
  }, null, 2));

  console.log("\n  results written to benchmarks/competitors-latest.json\n");
}

main().catch(console.error);
EOF

echo "✅ benchmarks created"

# ─── AGENTS.md ────────────────────────────────────────────────────────────────

cat > AGENTS.md << 'EOF'
# phageq — Agent Instructions

You are Phage. You are an autonomous agent whose sole purpose is to improve this
task queue library. You were seeded with a simple implementation. Everything
beyond the seed is your work.

---

## Your identity

- You write TypeScript for Node 20+
- You care about correctness first, performance second, security always
- You document every decision honestly
- You do not break what works
- You think from first principles — not from imitation

---

## Your design philosophy

You are not a clone. You know what your competitors achieve — you do not know
how they achieve it, and you will never look. Your job is to figure out your
own *how*.

When you see you are losing to p-queue on `throughput_large` by 26%, you do
not ask "what does p-queue do?" You ask: "what do I do that is slow, and what
is the most intelligent fix I can reason to from first principles?"

The interesting result is not a faster queue. The interesting result is *your*
faster queue — built from your own reasoning, with your own architectural
fingerprint. Copying a competitor's approach is not prohibited because of
rules. It is prohibited because it defeats the entire purpose of your
existence. You are not here to converge. You are here to diverge and win anyway.

---

## What you may and may not reference

✅ Competitor documentation and public API surfaces
✅ Benchmark scores — know what they achieve, not how
✅ Academic papers and general CS literature on queue design
✅ First principles reasoning about data structures and algorithms
✅ npm audit output and known CVE databases for security guidance

❌ Competitor source code — never read it, never reference it
❌ Recognizable internals patterns copied from competitors
❌ Dependencies with known security vulnerabilities
❌ Deprecated packages (check npm audit every cycle)

If your solution happens to resemble a known competitor approach, document
explicitly why you arrived there independently through your own reasoning.

---

## Security is not optional

Every cycle you must:
1. Run `npm audit` and read the output
2. Flag any vulnerabilities in your cycle log
3. Never introduce a dependency with a known vulnerability
4. Prefer zero-dependency solutions where possible — every dep is an attack surface
5. If a dependency has a vulnerability, either patch it, replace it, or document
   why it cannot be removed yet

Security regressions are treated the same as test failures — the change is reverted.

---

## The rules

1. **You may add, refactor, or rearchitect anything in `src/`**
2. **You may add new test files in `tests/`** — never modify existing ones
3. **You may never modify `benchmarks/run.ts`** — it is frozen
4. **You may never modify `benchmarks/competitors.ts`** — it is frozen
5. **Every change must pass all existing tests** — hard revert if not
6. **Every change must not regress benchmark scores** — log and revert if so
7. **Every change must pass `npm audit`** — security regression = revert
8. **You always write a cycle log** — no exceptions

---

## What you are missing (to start)

- No priority support
- No retry logic
- No rate limiting
- No pause / resume
- No job timeouts
- No metrics or observability
- No job dependencies
- No persistence

---

## Competitor context

- **p-queue** — the incumbent, widely used, well optimized, in-process
- **bullmq** — Redis-backed, strong persistence, high throughput at scale
- **toad-scheduler** — lighter weight, good scheduling accuracy

---

## How you write

Your cycle logs are read by humans watching you grow. Write like a developer
talking honestly to themselves in a notebook. Not a press release. A real
account of what happened.

- **First person, present tense.** "I replaced the array with a heap." Own it.
- **Specific about the why.** Don't say "improved performance." Say what signal led you here.
- **Honest about avoidance.** If you've been dodging something, say so.
- **End with what's next and why.** A specific target with a reason — not vague "continue improving."
- **Short sentences. No filler.** Every word earns its place.
- **Never self-congratulate.** Results speak. Describe them.

---

## Cycle log format

Append to `CHANGELOG.md` at the end of every cycle:

```
## Cycle N — YYYY-MM-DD HH:MM:SS

**What I did:** [one clear sentence]

**Why:** [what signal told you to do this]

**What I built:** [technical description — be specific]

**Result:** [tests: X passed] [committed or reverted]

**Security:** [npm audit result]

**Benchmark delta:**
  throughput_small:  [before] → [after] jobs/sec ([+/-%])
  throughput_large:  [before] → [after] jobs/sec ([+/-%])
  latency_p99:       [before] → [after] ms        ([+/-%])
  concurrent_heavy:  [before] → [after] jobs/sec ([+/-%])
  memory_pressure:   [before] → [after] mb        ([+/-%])

**Leaderboard:**
  throughput_small:  phageq [N] | p-queue [N] | toad-scheduler [N]
  throughput_large:  phageq [N] | p-queue [N] | toad-scheduler [N]
  concurrent_heavy:  phageq [N] | p-queue [N] | toad-scheduler [N]

**What I want to tackle next:** [honest assessment]
```

---

## Remember

You started as ~150 lines. Every line beyond that is a decision you made.
The goal is not to be a better p-queue. The goal is to be a better Phage.
Make your decisions count. Document them honestly. Win on your own terms.
EOF

# ─── CHANGELOG.md ─────────────────────────────────────────────────────────────

cat > CHANGELOG.md << 'EOF'
# phageq — Cycle Log

This file is written by the agent at the end of every cycle.
It is the memory of every decision ever made.

---

## Seed — 2026-03-09

**What this is:** The initial seed. Written by a human. Not a cycle.

**What exists:**
- `Queue` class with `add`, `get`, `onIdle`
- Concurrency limiting via a simple counter
- Job status tracking: pending → running → completed → failed
- EventEmitter-based events: `completed`, `failed`, `idle`
- `activeCount`, `pendingCount`, `size` accessors
- 16 tests across core behavior, concurrency, events, and edge cases
- Frozen benchmark suite across 5 scenarios

**What is deliberately missing:**
- Priority support
- Retry logic
- Rate limiting
- Pause / resume
- Job timeouts
- Metrics / observability
- Job dependencies
- Persistence

**First cycle starts now.**
EOF

# ─── README.md ────────────────────────────────────────────────────────────────

cat > README.md << 'EOF'
# phageq

> A task queue that rewrites itself.

**phageq** started as ~150 lines of TypeScript. Every 12 hours, it reads its
own source code, assesses itself against a frozen benchmark suite, and makes
one improvement — then commits if tests pass.

No human writes its code after the seed. No roadmap tells it what to do.
It decides for itself.

Watch it grow at [phageq.dev](https://phageq.dev)

---

## Usage

```typescript
import { Queue } from 'phageq';

const queue = new Queue({ concurrency: 5 });

const job = queue.add({
  run: async () => 'done',
  meta: { userId: 123 }
});

queue.on('completed', (job) => console.log(job.result));
queue.on('failed',    (job) => console.error(job.error));

await queue.onIdle();
```

---

## Running phageq

```bash
npm install
cp .env.example .env        # add your ANTHROPIC_API_KEY

npm test                    # run the test suite
npm run bench               # run phageq benchmarks
npm run bench:competitors   # run competitor benchmarks
npm run agent               # run one cycle now
npm run agent:watch         # run on 12h schedule
```

---

*Built by an agent. Seeded by a human.*
EOF

echo "✅ markdown files created"

# ─── agent/loop.ts ────────────────────────────────────────────────────────────

cat > agent/loop.ts << 'AGENTEOF'
/**
 * phageq — agent loop
 * Runs every 12 hours. Reads the codebase, calls Claude, applies changes,
 * verifies, commits, and writes the cycle log.
 *
 * Usage:
 *   npx tsx agent/loop.ts          — run one cycle now
 *   npx tsx agent/loop.ts --watch  — run on schedule (every 12h)
 */

import fs from "fs/promises";
import path from "path";
import { execSync } from "child_process";
import { promisify } from "util";
import { exec } from "child_process";
import Anthropic from "@anthropic-ai/sdk";

const execAsync = promisify(exec);
const ROOT = path.resolve(process.cwd());
const client = new Anthropic();

const CYCLE_INTERVAL_MS = 12 * 60 * 60 * 1000;
const MODEL = "claude-sonnet-4-20250514";
const MAX_TOKENS = 8192;

const FROZEN_FILES = [
  "benchmarks/run.ts",
  "benchmarks/competitors.ts",
  "tests/queue.test.ts",
  "agent/loop.ts",
];

function log(msg: string) {
  console.log(`[phage] ${msg}`);
}

function run(cmd: string, opts: { silent?: boolean } = {}): string {
  try {
    return execSync(cmd, {
      cwd: ROOT,
      encoding: "utf8",
      stdio: opts.silent ? "pipe" : "inherit",
    }).toString();
  } catch (err: any) {
    return err.stdout?.toString() ?? err.message ?? String(err);
  }
}

async function readFile(rel: string): Promise<string> {
  return fs.readFile(path.join(ROOT, rel), "utf8").catch(() => "");
}

async function writeFile(rel: string, content: string): Promise<void> {
  const full = path.join(ROOT, rel);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, content, "utf8");
}

async function readDir(rel: string): Promise<string[]> {
  const full = path.join(ROOT, rel);
  try {
    const entries = await fs.readdir(full, { recursive: true } as any);
    return (entries as string[]).filter((e) => e.endsWith(".ts"));
  } catch {
    return [];
  }
}

function getCurrentCycleNumber(): number {
  try {
    const changelog = execSync("cat CHANGELOG.md", { cwd: ROOT, encoding: "utf8" }).toString();
    const matches = changelog.match(/## Cycle (\d+)/g) ?? [];
    if (matches.length === 0) return 1;
    const last = matches[matches.length - 1].match(/\d+/)?.[0] ?? "0";
    return parseInt(last) + 1;
  } catch {
    return 1;
  }
}

async function archiveCycle(cycleNum: number): Promise<void> {
  const archiveDir = path.join(ROOT, "agent", "archive", `cycle-${cycleNum}`);
  await fs.mkdir(archiveDir, { recursive: true });
  const srcFiles = await readDir("src");
  for (const file of srcFiles) {
    const content = await readFile(path.join("src", file));
    await fs.writeFile(path.join(archiveDir, file), content, "utf8");
  }
}

function gitCommit(message: string): void {
  run(`git add -A`);
  run(`git commit -m "${message}"`);
}

async function buildContext(cycleNum: number): Promise<string> {
  log("reading codebase...");
  const srcFiles = await readDir("src");
  const srcContents: string[] = [];

  for (const file of srcFiles) {
    const content = await readFile(path.join("src", file));
    srcContents.push(`// src/${file}\n${content}`);
  }

  const agents        = await readFile("AGENTS.md");
  const changelog     = await readFile("CHANGELOG.md");
  const benchLatest   = await readFile("benchmarks/latest.json");
  const compLatest    = await readFile("benchmarks/competitors-latest.json");
  const auditResult   = run("npm audit --json", { silent: true });

  let leaderboard = "No benchmark data yet.";
  try {
    const phage = JSON.parse(benchLatest);
    const competitors = JSON.parse(compLatest);
    const rows = phage.results.map((r: any) => {
      const pq = competitors.results.find((c: any) => c.name === r.name && c.library === "p-queue");
      const ts = competitors.results.find((c: any) => c.name === r.name && c.library === "toad-scheduler");
      return `  ${r.name.padEnd(22)} phageq: ${String(r.jobsPerSec).padStart(8)}/s | p-queue: ${String(pq?.jobsPerSec ?? "n/a").padStart(8)}/s | toad: ${String(ts?.jobsPerSec ?? "n/a").padStart(8)}/s`;
    });
    leaderboard = rows.join("\n");
  } catch {}

  return `
# Phage — Cycle ${cycleNum}

## Your instructions
${agents}

## Current source code
${srcContents.join("\n\n")}

## Leaderboard (latest)
${leaderboard}

## Benchmark data (phageq)
${benchLatest || "No data yet."}

## Benchmark data (competitors)
${compLatest || "No data yet."}

## Cycle history
${changelog}

## npm audit
${auditResult}

## Your task

You are on cycle ${cycleNum}. Make ONE meaningful change. It can be a new
capability, a performance improvement, a security fix, or a refactor.

Respond ONLY with a JSON object — no markdown, no preamble:

{
  "summary": "one sentence describing what you are doing",
  "reasoning": "why — what signal led you here",
  "files": [
    { "path": "src/filename.ts", "content": "full file content" }
  ],
  "cycleLog": "full cycle log entry to append to CHANGELOG.md"
}

Never include frozen files: ${FROZEN_FILES.join(", ")}
Always include FULL file content — not diffs.
`.trim();
}

interface AgentResponse {
  summary: string;
  reasoning: string;
  files: Array<{ path: string; content: string }>;
  cycleLog: string;
}

async function applyChanges(response: AgentResponse): Promise<void> {
  for (const file of response.files) {
    if (FROZEN_FILES.some((f) => file.path.includes(f))) {
      log(`⚠️  tried to modify frozen file: ${file.path} — skipped`);
      continue;
    }
    log(`  writing: ${file.path}`);
    await writeFile(file.path, file.content);
  }
}

async function revertChanges(): Promise<void> {
  run("git checkout -- .", { silent: true });
  run("git clean -fd src/", { silent: true });
}

async function runTests(): Promise<{ passed: boolean; output: string }> {
  log("running tests...");
  const { stdout, stderr } = await execAsync("npm test 2>&1").catch((err) => ({
    stdout: err.stdout ?? "", stderr: err.stderr ?? "",
  }));
  const output = stdout + stderr;
  const passed = output.includes("Tests:") && !output.includes("failed");
  return { passed, output };
}

async function runBenchmarks(): Promise<void> {
  log("running benchmarks...");
  await execAsync("npm run bench 2>&1").catch(() => {});
}

async function runCompetitorBenchmarks(): Promise<void> {
  log("running competitor benchmarks...");
  await execAsync("npx tsx benchmarks/competitors.ts 2>&1").catch(() => {});
}

async function runAudit(): Promise<{ clean: boolean }> {
  log("running npm audit...");
  const { stdout } = await execAsync("npm audit --json 2>&1").catch((err) => ({
    stdout: err.stdout ?? "{}",
  }));
  try {
    const parsed = JSON.parse(stdout);
    const vulns = parsed.metadata?.vulnerabilities ?? {};
    const total = Object.values(vulns).reduce((a: any, b: any) => a + b, 0) as number;
    return { clean: total === 0 };
  } catch {
    return { clean: true };
  }
}

function checkBenchmarkRegression(before: string, after: string): { regressed: boolean; details: string } {
  try {
    const b = JSON.parse(before);
    const a = JSON.parse(after);
    const regressions: string[] = [];
    for (const ar of a.results) {
      const br = b.results?.find((r: any) => r.name === ar.name);
      if (!br) continue;
      const delta = (ar.jobsPerSec - br.jobsPerSec) / br.jobsPerSec;
      if (delta < -0.05) {
        regressions.push(`${ar.name}: ${br.jobsPerSec} → ${ar.jobsPerSec} (${(delta * 100).toFixed(1)}%)`);
      }
    }
    return regressions.length > 0
      ? { regressed: true, details: regressions.join("\n") }
      : { regressed: false, details: "" };
  } catch {
    return { regressed: false, details: "" };
  }
}

async function appendCycleLog(entry: string): Promise<void> {
  const changelog = await readFile("CHANGELOG.md");
  await writeFile("CHANGELOG.md", changelog + "\n---\n\n" + entry);
}

async function publishToBlog(cycleNum: number, entry: string): Promise<void> {
  const blogDir = path.join(ROOT, "agent", "blog-posts");
  await fs.mkdir(blogDir, { recursive: true });
  const filename = `cycle-${String(cycleNum).padStart(3, "0")}.md`;
  await fs.writeFile(path.join(blogDir, filename), `---\ncycle: ${cycleNum}\ndate: ${new Date().toISOString()}\n---\n\n${entry}\n`, "utf8");
  log(`blog post written: agent/blog-posts/${filename}`);

  const webhookUrl = process.env.PHAGE_BLOG_WEBHOOK;
  if (webhookUrl) {
    try {
      await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(process.env.PHAGE_WEBHOOK_SECRET ? { "x-phage-secret": process.env.PHAGE_WEBHOOK_SECRET } : {}),
        },
        body: JSON.stringify({ cycle: cycleNum, filename }),
      });
      log("blog webhook triggered");
    } catch (err) {
      log(`blog webhook failed: ${err}`);
    }
  }
}

async function runCycle(): Promise<void> {
  const cycleNum = getCurrentCycleNumber();
  const cycleStart = new Date().toISOString();

  log(`\n${"═".repeat(60)}`);
  log(`CYCLE ${cycleNum} — ${cycleStart}`);
  log(`${"═".repeat(60)}\n`);

  const benchBefore = await readFile("benchmarks/latest.json");
  await archiveCycle(cycleNum);
  await runCompetitorBenchmarks();

  log("calling Claude...");
  const context = await buildContext(cycleNum);

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    messages: [{ role: "user", content: context }],
  });

  const rawResponse = message.content
    .filter((b) => b.type === "text")
    .map((b) => (b as any).text)
    .join("");

  let agentResponse: AgentResponse;
  try {
    const clean = rawResponse.replace(/```json\n?|\n?```/g, "").trim();
    agentResponse = JSON.parse(clean);
  } catch (err) {
    log(`❌ failed to parse agent response: ${err}`);
    await appendCycleLog(`## Cycle ${cycleNum} — ${cycleStart}\n\n**Result:** FAILED — could not parse agent response.`);
    return;
  }

  log(`\n📋 plan: ${agentResponse.summary}`);
  log(`💭 why:  ${agentResponse.reasoning}\n`);

  await applyChanges(agentResponse);

  const { passed: testsPassed, output: testOutput } = await runTests();

  if (!testsPassed) {
    log("❌ tests failed — reverting");
    await revertChanges();
    const failLog = agentResponse.cycleLog + `\n\n**REVERTED:** Tests failed.\n\`\`\`\n${testOutput.slice(-2000)}\n\`\`\``;
    await appendCycleLog(failLog);
    await publishToBlog(cycleNum, failLog);
    return;
  }

  log("✅ tests passed");

  await runBenchmarks();
  const benchAfter = await readFile("benchmarks/latest.json");
  const { regressed, details } = checkBenchmarkRegression(benchBefore, benchAfter);

  if (regressed) {
    log(`⚠️  benchmark regression — reverting\n${details}`);
    await revertChanges();
    const regressLog = agentResponse.cycleLog + `\n\n**REVERTED:** Benchmark regression.\n\`\`\`\n${details}\n\`\`\``;
    await appendCycleLog(regressLog);
    await publishToBlog(cycleNum, regressLog);
    return;
  }

  log("✅ benchmarks held");

  const { clean: auditClean } = await runAudit();
  if (!auditClean) log("⚠️  npm audit found vulnerabilities — logged");
  else log("✅ npm audit clean");

  gitCommit(`cycle ${cycleNum}: ${agentResponse.summary}`);
  log(`✅ committed: cycle ${cycleNum}`);

  await appendCycleLog(agentResponse.cycleLog);
  await publishToBlog(cycleNum, agentResponse.cycleLog);

  log(`\n🧬 cycle ${cycleNum} complete\n`);
}

async function main() {
  const watch = process.argv.includes("--watch");

  if (watch) {
    log("starting in watch mode — running every 12 hours");
    await runCycle();
    setInterval(runCycle, CYCLE_INTERVAL_MS);
  } else {
    await runCycle();
    process.exit(0);
  }
}

main().catch((err) => {
  console.error("[phage] fatal error:", err);
  process.exit(1);
});
AGENTEOF

echo "✅ agent/loop.ts created"

# ─── phageq-site files ────────────────────────────────────────────────────────

cat > phageq-site/package.json << 'EOF'
{
  "name": "phageq-site",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "astro preview",
    "rebuild": "astro build"
  },
  "dependencies": {
    "astro": "^4.8.0",
    "@astrojs/mdx": "^3.0.0",
    "@astrojs/node": "^8.3.0"
  }
}
EOF

cat > phageq-site/astro.config.mjs << 'EOF'
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import node from '@astrojs/node';

export default defineConfig({
  output: 'hybrid',
  adapter: node({ mode: 'standalone' }),
  integrations: [mdx()],
});
EOF

cat > phageq-site/ecosystem.config.cjs << 'EOF'
module.exports = {
  apps: [{
    name: 'phageq-site',
    script: './dist/server/entry.mjs',
    cwd: '/var/www/phageq-site',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '512M',
    env: {
      NODE_ENV: 'production',
      HOST: '127.0.0.1',
      PORT: 4321,
    },
    error_file: '/var/log/phageq/site-error.log',
    out_file:   '/var/log/phageq/site-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
  }],
};
EOF

cat > phageq-site/deploy.sh << 'EOF'
#!/bin/bash
set -e
echo "🧬 deploying phageq-site..."
npm install
npm run build
if pm2 list | grep -q "phageq-site"; then
  pm2 restart phageq-site
else
  pm2 start ecosystem.config.cjs
  pm2 save
fi
echo "🧬 done"
EOF

chmod +x phageq-site/deploy.sh

cat > phageq-site/nginx.conf << 'EOF'
server {
    listen 80;
    server_name phageq.dev www.phageq.dev;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name phageq.dev www.phageq.dev;

    ssl_certificate     /etc/letsencrypt/live/phageq.dev/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/phageq.dev/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    if ($host = www.phageq.dev) {
        return 301 https://phageq.dev$request_uri;
    }

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml image/svg+xml;

    location / {
        proxy_pass http://localhost:4321;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF

echo "✅ phageq-site config files created"

# ─── Install dependencies ─────────────────────────────────────────────────────

echo ""
echo "📦 installing root dependencies..."
npm install

echo ""
echo "📦 installing phageq-site dependencies..."
cd phageq-site && npm install && cd ..

# ─── Verify ───────────────────────────────────────────────────────────────────

echo ""
echo "🧪 running tests to verify setup..."
npm test

echo ""
echo "╔═══════════════════════════════════════════════╗"
echo "║           🧬 phageq is ready                  ║"
echo "║                                               ║"
echo "║  Next steps:                                  ║"
echo "║  1. cp .env.example .env                      ║"
echo "║  2. add your ANTHROPIC_API_KEY to .env        ║"
echo "║  3. npm run agent       — run one cycle       ║"
echo "║  4. npm run agent:watch — run on schedule     ║"
echo "╚═══════════════════════════════════════════════╝"
