/**
 * phageq — agent loop
 * Runs every 4 hours. Reads the codebase, calls Claude, applies changes,
 * verifies, commits, and writes the cycle log.
 *
 * Usage:
 *   npx tsx agent/loop.ts          — run one cycle now
 *   npx tsx agent/loop.ts --watch  — run on schedule (every 4h)
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

const CYCLE_INTERVAL_MS = 4 * 60 * 60 * 1000;
const MODEL = "claude-sonnet-4-20250514";
const MAX_TOKENS = 8192;
const LAST_CYCLE_FLAG = ".last-cycle-had-changes";

const FROZEN_FILES = [
  "benchmarks/run.ts",
  "benchmarks/competitors.ts",
  "tests/queue.test.ts",
  "agent/loop.ts",
  "jest.config.js",
  "jest.config.cjs",
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
    const changelog = execSync("cat CHANGELOG.md", {
      cwd: ROOT,
      encoding: "utf8",
    }).toString();
    const matches = changelog.match(/## Cycle (\d+)/g) ?? [];
    if (matches.length === 0) return 1;
    const last = matches[matches.length - 1].match(/\d+/)?.[0] ?? "0";
    return parseInt(last) + 1;
  } catch {
    return 1;
  }
}

async function getLastCycleHadChanges(): Promise<boolean> {
  try {
    const val = await fs.readFile(path.join(ROOT, LAST_CYCLE_FLAG), "utf8");
    return val.trim() === "true";
  } catch {
    return true; // default: assume changes so first cycle is never blocked
  }
}

async function setLastCycleHadChanges(hadChanges: boolean): Promise<void> {
  await fs.writeFile(
    path.join(ROOT, LAST_CYCLE_FLAG),
    String(hadChanges),
    "utf8",
  );
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
  run(`git config --local user.name "phageq-agent"`);
  run(`git config --local user.email "agent@phage.pw"`);
  run(`git add -A`);
  run(`git commit -m "${message}"`);
}

async function buildContext(
  cycleNum: number,
  lastCycleHadChanges: boolean,
): Promise<string> {
  log("reading codebase...");
  const srcFiles = await readDir("src");
  const srcContents: string[] = [];

  for (const file of srcFiles) {
    const content = await readFile(path.join("src", file));
    srcContents.push(`// src/${file}\n${content}`);
  }

  const agents = await readFile("AGENTS.md");
  const changelog = await readFile("CHANGELOG.md");
  const benchLatest = await readFile("benchmarks/latest.json");
  const compLatest = await readFile("benchmarks/competitors-latest.json");
  const auditResult = run("npm audit --json", { silent: true });

  let leaderboard = "No benchmark data yet.";
  try {
    const phage = JSON.parse(benchLatest);
    const competitors = JSON.parse(compLatest);
    const rows = phage.results.map((r: any) => {
      const pq = competitors.results.find(
        (c: any) => c.name === r.name && c.library === "p-queue",
      );
      const ts = competitors.results.find(
        (c: any) => c.name === r.name && c.library === "toad-scheduler",
      );
      return `  ${r.name.padEnd(22)} phageq: ${String(r.jobsPerSec).padStart(8)}/s | p-queue: ${String(pq?.jobsPerSec ?? "n/a").padStart(8)}/s | toad: ${String(ts?.jobsPerSec ?? "n/a").padStart(8)}/s`;
    });
    leaderboard = rows.join("\n");
  } catch {}

  // Hard enforcement: if last cycle had no code changes, inject mandatory instruction
  const measurementBan = !lastCycleHadChanges
    ? `
## ⚠️ MANDATORY — YOU MUST MAKE A CODE CHANGE THIS CYCLE ⚠️

The previous cycle had no code changes (it was a measurement-only cycle).
You are NOT permitted to run another measurement-only cycle.
You MUST include at least one file in your \`files\` array.

If your \`files\` array is empty, the loop will treat this as a violation.
Pick the highest-confidence optimization you can reason to and ship it.
A reverted change produces more signal than a wasted measurement cycle.
`
    : "";

  return `
# Phage — Cycle ${cycleNum}

## Your instructions
${agents}
${measurementBan}
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
  // Remove any test files that aren't the frozen baseline
  const testFiles = await fs.readdir(path.join(ROOT, "tests")).catch(() => []);
  for (const file of testFiles) {
    if (file !== "queue.test.ts") {
      await fs.unlink(path.join(ROOT, "tests", file)).catch(() => {});
      log(`  cleaned up orphaned test: ${file}`);
    }
  }
}

async function runTests(): Promise<{ passed: boolean; output: string }> {
  log("running tests...");
  const { stdout, stderr } = await execAsync("npm test 2>&1").catch((err) => ({
    stdout: err.stdout ?? "",
    stderr: err.stderr ?? "",
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
    const total = Object.values(vulns).reduce(
      (a: any, b: any) => a + b,
      0,
    ) as number;
    return { clean: total === 0 };
  } catch {
    return { clean: true };
  }
}

function checkBenchmarkRegression(
  before: string,
  after: string,
): { regressed: boolean; details: string } {
  try {
    const b = JSON.parse(before);
    const a = JSON.parse(after);
    const regressions: string[] = [];
    for (const ar of a.results) {
      const br = b.results?.find((r: any) => r.name === ar.name);
      if (!br) continue;
      const delta = (ar.jobsPerSec - br.jobsPerSec) / br.jobsPerSec;
      if (delta < -0.15) {
        regressions.push(
          `${ar.name}: ${br.jobsPerSec} → ${ar.jobsPerSec} (${(delta * 100).toFixed(1)}%)`,
        );
      }
    }
    return regressions.length > 0
      ? { regressed: true, details: regressions.join("\n") }
      : { regressed: false, details: "" };
  } catch {
    return { regressed: false, details: "" };
  }
}

async function saveBenchmarkHistory(cycleNum: number): Promise<void> {
  try {
    const latest = await readFile("benchmarks/latest.json");
    if (!latest) return;
    const histDir = path.join(ROOT, "benchmarks", "history");
    await fs.mkdir(histDir, { recursive: true });
    await fs.writeFile(
      path.join(histDir, `cycle-${String(cycleNum).padStart(3, "0")}.json`),
      latest,
      "utf8",
    );
  } catch {}
}

async function appendCycleLog(entry: string): Promise<void> {
  const changelog = await readFile("CHANGELOG.md");
  await writeFile("CHANGELOG.md", changelog + "\n---\n\n" + entry);
}

async function publishToBlog(cycleNum: number, entry: string): Promise<void> {
  const blogDir = path.join(ROOT, "agent", "blog-posts");
  await fs.mkdir(blogDir, { recursive: true });
  const filename = `cycle-${String(cycleNum).padStart(3, "0")}.md`;
  await fs.writeFile(
    path.join(blogDir, filename),
    `---\ncycle: ${cycleNum}\ndate: ${new Date().toISOString()}\n---\n\n${entry}\n`,
    "utf8",
  );
  log(`blog post written: agent/blog-posts/${filename}`);

  const webhookUrl = process.env.PHAGE_BLOG_WEBHOOK;
  if (webhookUrl) {
    try {
      await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(process.env.PHAGE_WEBHOOK_SECRET
            ? { "x-phage-secret": process.env.PHAGE_WEBHOOK_SECRET }
            : {}),
        },
        body: JSON.stringify({ cycle: cycleNum, filename }),
      });
      log("blog webhook triggered");
    } catch (err) {
      log(`blog webhook failed: ${err}`);
    }
  }
}

async function triggerRebuildWebhook(cycleNum: number): Promise<void> {
  const webhookUrl = process.env.PHAGE_REBUILD_WEBHOOK;
  if (!webhookUrl) return;
  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.PHAGE_WEBHOOK_SECRET
          ? { "x-phage-secret": process.env.PHAGE_WEBHOOK_SECRET }
          : {}),
      },
      body: JSON.stringify({ cycle: cycleNum }),
    });
    log("rebuild webhook triggered");
  } catch (err) {
    log(`rebuild webhook failed: ${err}`);
  }
}

async function updateReadmeBadge(cycleNum: number): Promise<void> {
  try {
    const readmePath = path.join(ROOT, "README.md");
    let readme = await fs.readFile(readmePath, "utf8");
    readme = readme.replace(
      /\[!\[cycles\]\(https:\/\/img\.shields\.io\/badge\/cycle-\d+-/,
      `[![cycles](https://img.shields.io/badge/cycle-${cycleNum}-`,
    );
    await fs.writeFile(readmePath, readme, "utf8");
    log(`README badge updated to cycle ${cycleNum}`);
  } catch (err) {
    log(`could not update README badge: ${err}`);
  }
}

async function runCycle(): Promise<void> {
  const cycleNum = getCurrentCycleNumber();
  const cycleStart = new Date().toISOString();

  log(`\n${"═".repeat(60)}`);
  log(`CYCLE ${cycleNum} — ${cycleStart}`);
  log(`${"═".repeat(60)}\n`);

  const lastCycleHadChanges = await getLastCycleHadChanges();
  if (!lastCycleHadChanges) {
    log(
      `⚠️  last cycle was measurement-only — injecting code change requirement`,
    );
  }

  const benchBefore = await readFile("benchmarks/latest.json");
  await archiveCycle(cycleNum);
  await runCompetitorBenchmarks();

  log("calling Claude...");
  const context = await buildContext(cycleNum, lastCycleHadChanges);

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
    await appendCycleLog(
      `## Cycle ${cycleNum} — ${cycleStart}\n\n**Result:** FAILED — could not parse agent response.`,
    );
    await setLastCycleHadChanges(false);
    return;
  }

  log(`\n📋 plan: ${agentResponse.summary}`);
  log(`💭 why:  ${agentResponse.reasoning}\n`);

  const hadCodeChanges = agentResponse.files.length > 0;

  // Enforce consecutive measurement ban — if last cycle had no changes and
  // this one also has no changes, log a warning but still proceed (the
  // measurement ban in the prompt should have prevented this)
  if (!lastCycleHadChanges && !hadCodeChanges) {
    log(
      `⚠️  consecutive measurement cycle detected despite ban — agent ignored instruction`,
    );
  }

  await applyChanges(agentResponse);

  const { passed: testsPassed, output: testOutput } = await runTests();

  if (!testsPassed) {
    log("❌ tests failed — reverting");
    await revertChanges();
    const failLog =
      agentResponse.cycleLog +
      `\n\n**REVERTED:** Tests failed.\n\`\`\`\n${testOutput.slice(-2000)}\n\`\`\`` +
      `\n\n**Note for next cycle:** The above approach was attempted and failed. Do not repeat it. Find a different solution.`;
    await appendCycleLog(failLog);
    await publishToBlog(cycleNum, failLog);
    await setLastCycleHadChanges(hadCodeChanges);
    return;
  }

  log("✅ tests passed");

  await runBenchmarks();
  const benchAfter = await readFile("benchmarks/latest.json");
  const noCodeChanges = !hadCodeChanges;
  const { regressed, details } = checkBenchmarkRegression(
    benchBefore,
    benchAfter,
  );

  if (regressed && !noCodeChanges) {
    log(`⚠️  benchmark regression — reverting\n${details}`);
    await revertChanges();
    const regressLog =
      agentResponse.cycleLog +
      `\n\n**REVERTED:** Benchmark regression.\n\`\`\`\n${details}\n\`\`\`` +
      `\n\n**Note for next cycle:** The above approach caused a benchmark regression and was reverted. Do not repeat it. Find a different solution.`;
    await appendCycleLog(regressLog);
    await publishToBlog(cycleNum, regressLog);
    await setLastCycleHadChanges(false);
    return;
  } else if (regressed && noCodeChanges) {
    log(
      `⚠️  benchmark variance on measurement-only cycle — not reverting (no code changes)`,
    );
  }

  log("✅ benchmarks held");
  await saveBenchmarkHistory(cycleNum);

  const { clean: auditClean } = await runAudit();
  if (!auditClean) log("⚠️  npm audit found vulnerabilities — logged");
  else log("✅ npm audit clean");

  // Update README badge before committing
  await updateReadmeBadge(cycleNum);

  gitCommit(`cycle ${cycleNum}: ${agentResponse.summary}`);
  log(`✅ committed: cycle ${cycleNum}`);
  run(`git push`);
  log(`✅ pushed to remote`);

  await appendCycleLog(agentResponse.cycleLog);
  await publishToBlog(cycleNum, agentResponse.cycleLog);
  await triggerRebuildWebhook(cycleNum);
  await setLastCycleHadChanges(hadCodeChanges);

  log(`\n🧬 cycle ${cycleNum} complete\n`);
}

async function main() {
  const watch = process.argv.includes("--watch");

  if (watch) {
    log("starting in watch mode — running every 4 hours");
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
