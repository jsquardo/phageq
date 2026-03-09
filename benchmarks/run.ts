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
