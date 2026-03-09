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
