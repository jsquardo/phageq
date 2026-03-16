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
import { execSync, execFileSync } from "child_process";
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

// ─── Logging ──────────────────────────────────────────────────────────────────

function log(msg: string) {
  console.log(`[phage] ${msg}`);
}

// ─── Shell helpers ────────────────────────────────────────────────────────────

/**
 * Run a shell command synchronously. Returns stdout as a string.
 * Never throws — errors are logged and an empty string is returned.
 */
function run(cmd: string, opts: { silent?: boolean } = {}): string {
  try {
    return execSync(cmd, {
      cwd: ROOT,
      encoding: "utf8",
      stdio: opts.silent ? "pipe" : "inherit",
    }).toString();
  } catch (err: any) {
    if (!opts.silent) {
      log(`[run] command failed: ${cmd}\n${err.message ?? String(err)}`);
    }
    return err.stdout?.toString() ?? "";
  }
}

/**
 * Run a shell command asynchronously. Always resolves — never rejects.
 * Returns { stdout, stderr, exitCode }.
 * @param timeoutMs optional timeout — defaults to 10 minutes
 */
async function runAsync(
  cmd: string,
  timeoutMs = 10 * 60 * 1000,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  try {
    const { stdout, stderr } = await execAsync(cmd, {
      cwd: ROOT,
      timeout: timeoutMs,
    });
    return { stdout: stdout ?? "", stderr: stderr ?? "", exitCode: 0 };
  } catch (err: any) {
    if (err.killed || err.signal === "SIGTERM") {
      log(`⚠️  command timed out after ${timeoutMs / 1000}s: ${cmd}`);
    }
    return {
      stdout: err.stdout ?? "",
      stderr: err.stderr ?? "",
      exitCode: err.code ?? 1,
    };
  }
}

// ─── File helpers ─────────────────────────────────────────────────────────────

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

// ─── Git helpers ──────────────────────────────────────────────────────────────

/**
 * Returns the list of filenames tracked by git in the given directory.
 * Used to distinguish committed test files from orphaned untracked ones.
 */
function getTrackedFiles(dir: string): string[] {
  const output = run(`git ls-files ${dir}`, { silent: true });
  return output
    .split("\n")
    .map((f) => f.trim())
    .filter(Boolean)
    .map((f) => path.basename(f));
}

function gitCommit(message: string): boolean {
  run(`git config --local user.name "phageq-agent"`);
  run(`git config --local user.email "agent@phage.pw"`);
  run(`git add -A`);

  // Use execFileSync with an args array — bypasses the shell entirely so no
  // shell metacharacters ($(), backticks, quotes) in agentResponse.summary
  // can be interpreted. Fully prevents shell injection.
  const safeMessage = message.replace(/[\r\n]/g, " ").slice(0, 500);
  try {
    execFileSync("git", ["commit", "-m", safeMessage], {
      cwd: ROOT,
      encoding: "utf8",
      stdio: "pipe",
    });
    log(`✅ committed: ${safeMessage}`);
    return true;
  } catch (err: any) {
    const output = err.stdout?.toString() ?? "";
    if (output.includes("nothing to commit")) {
      log(`⚠️  nothing to commit`);
    } else {
      log(`❌ git commit failed: ${err.message ?? String(err)}`);
    }
    return false;
  }
}

function gitPush(): boolean {
  const result = run(`git push 2>&1`, { silent: true });
  if (result.includes("error") || result.includes("fatal")) {
    log(`❌ git push failed:\n${result}`);
    return false;
  }
  log(`✅ pushed to remote`);
  return true;
}

// ─── Cycle state ──────────────────────────────────────────────────────────────

async function getLastCycleHadChanges(): Promise<boolean> {
  try {
    const val = await fs.readFile(path.join(ROOT, LAST_CYCLE_FLAG), "utf8");
    return val.trim() === "true";
  } catch {
    // Default true so the first cycle after deployment is never blocked
    return true;
  }
}

async function setLastCycleHadChanges(hadChanges: boolean): Promise<void> {
  await fs
    .writeFile(path.join(ROOT, LAST_CYCLE_FLAG), String(hadChanges), "utf8")
    .catch((err) => log(`⚠️  could not write cycle flag: ${err}`));
}

// ─── Cycle number ─────────────────────────────────────────────────────────────

function getCurrentCycleNumber(): number {
  try {
    const changelog = execSync("cat CHANGELOG.md", {
      cwd: ROOT,
      encoding: "utf8",
    }).toString();
    // Use matchAll to find all occurrences robustly, take the last one
    const matches = [...changelog.matchAll(/^## Cycle (\d+)/gm)];
    if (matches.length === 0) return 1;
    const last = parseInt(matches[matches.length - 1][1], 10);
    return isNaN(last) ? 1 : last + 1;
  } catch {
    return 1;
  }
}

// ─── Archive ──────────────────────────────────────────────────────────────────

async function archiveCycle(cycleNum: number): Promise<void> {
  try {
    const archiveDir = path.join(ROOT, "agent", "archive", `cycle-${cycleNum}`);
    await fs.mkdir(archiveDir, { recursive: true });
    const srcFiles = await readDir("src");
    for (const file of srcFiles) {
      const content = await readFile(path.join("src", file));
      await fs.writeFile(path.join(archiveDir, file), content, "utf8");
    }
  } catch (err) {
    log(`⚠️  archive failed (non-fatal): ${err}`);
  }
}

// ─── Apply / revert ───────────────────────────────────────────────────────────

async function applyChanges(response: AgentResponse): Promise<void> {
  for (const file of response.files) {
    // Use exact path match to avoid false positives where e.g.
    // "src/benchmarks/run-helper.ts" would match "benchmarks/run.ts"
    const normalizedPath = file.path.replace(/^\.\//, "");
    const isFrozen = FROZEN_FILES.some((f) => normalizedPath === f);
    if (isFrozen) {
      log(`⚠️  tried to modify frozen file: ${file.path} — skipped`);
      continue;
    }
    log(`  writing: ${file.path}`);
    await writeFile(file.path, file.content);
  }
}

async function revertChanges(): Promise<void> {
  // Restore all tracked files to their committed state
  run("git checkout -- .", { silent: true });
  // Remove any untracked files the agent created in src/
  run("git clean -fd src/", { silent: true });

  // Clean up orphaned test files — ONLY delete files not tracked by git.
  // This preserves committed test files (e.g. timeout.test.ts) while still
  // cleaning up test files the agent created for features it never shipped.
  const trackedTestFiles = getTrackedFiles("tests");
  const allTestFiles = await fs
    .readdir(path.join(ROOT, "tests"))
    .catch(() => [] as string[]);

  for (const file of allTestFiles) {
    if (!trackedTestFiles.includes(file)) {
      await fs.unlink(path.join(ROOT, "tests", file)).catch(() => {});
      log(`  cleaned up untracked test file: tests/${file}`);
    }
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

interface TestResult {
  passed: boolean;
  output: string;
  failureReason?: string;
  testCount?: number;
  suiteCount?: number;
}

async function runTests(): Promise<TestResult> {
  log("running tests...");

  // Always use runAsync so we get full output regardless of Jest exit code.
  // Jest exits non-zero on test failures AND on certain warnings (e.g.
  // --experimental-vm-modules), so we cannot rely on exit code alone.
  const { stdout, stderr } = await runAsync("npm test");
  const output = stdout + "\n" + stderr;

  // Parse the Jest summary lines — these are the ground truth.
  // "Tests: 1 failed, 15 passed, 16 total" or "Tests: 16 passed, 16 total"
  const testsLine = output.match(/^Tests:\s+(.+)$/m);
  // "Test Suites: 1 failed, 1 total" or "Test Suites: 2 passed, 2 total"
  const suitesLine = output.match(/^Test Suites:\s+(.+)$/m);

  if (!testsLine) {
    // Jest never produced a summary — hard failure (compile error, crash, etc.)
    const hasTypeError = output.includes("error TS");
    return {
      passed: false,
      output,
      failureReason: hasTypeError
        ? "TypeScript compile error prevented tests from running"
        : "Jest did not produce a test summary — check for config or runtime errors",
    };
  }

  const hasFailedTests = /\d+\s+failed/.test(testsLine[1]);
  const hasFailedSuites = suitesLine
    ? /\d+\s+failed/.test(suitesLine[1])
    : false;

  const totalMatch = testsLine[1].match(/(\d+)\s+total/);
  const suiteMatch = suitesLine?.[1].match(/(\d+)\s+total/);
  const testCount = totalMatch ? parseInt(totalMatch[1], 10) : undefined;
  const suiteCount = suiteMatch ? parseInt(suiteMatch[1], 10) : undefined;

  if (hasFailedTests || hasFailedSuites) {
    return {
      passed: false,
      output,
      failureReason: `Test failures: ${testsLine[1]}${suitesLine ? ` | Suites: ${suitesLine[1]}` : ""}`,
      testCount,
      suiteCount,
    };
  }

  return { passed: true, output, testCount, suiteCount };
}

// ─── Benchmarks ───────────────────────────────────────────────────────────────

async function runBenchmarks(): Promise<void> {
  log("running benchmarks...");
  await runAsync("npm run bench");
}

async function runCompetitorBenchmarks(): Promise<void> {
  log("running competitor benchmarks...");
  await runAsync("npx tsx benchmarks/competitors.ts");
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
  } catch (err) {
    log(`⚠️  could not save benchmark history: ${err}`);
  }
}

function checkBenchmarkRegression(
  before: string,
  after: string,
): { regressed: boolean; details: string } {
  try {
    const b = JSON.parse(before);
    const a = JSON.parse(after);

    if (!b.results || !a.results) {
      return { regressed: false, details: "" };
    }

    const regressions: string[] = [];
    for (const ar of a.results) {
      const br = b.results.find((r: any) => r.name === ar.name);
      if (!br || br.jobsPerSec === 0) continue;
      const delta = (ar.jobsPerSec - br.jobsPerSec) / br.jobsPerSec;
      if (delta < -0.15) {
        regressions.push(
          `${ar.name}: ${br.jobsPerSec.toLocaleString()} → ${ar.jobsPerSec.toLocaleString()} (${(delta * 100).toFixed(1)}%)`,
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

// ─── Audit ────────────────────────────────────────────────────────────────────

async function runAudit(): Promise<{ clean: boolean }> {
  log("running npm audit...");
  const { stdout } = await runAsync("npm audit --json");
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

// ─── Changelog / blog ─────────────────────────────────────────────────────────

async function appendCycleLog(entry: string): Promise<void> {
  const changelog = await readFile("CHANGELOG.md");
  await writeFile("CHANGELOG.md", changelog + "\n---\n\n" + entry);
}

async function publishToBlog(cycleNum: number, entry: string): Promise<void> {
  try {
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
      await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(process.env.PHAGE_WEBHOOK_SECRET
            ? { "x-phage-secret": process.env.PHAGE_WEBHOOK_SECRET }
            : {}),
        },
        body: JSON.stringify({ cycle: cycleNum, filename }),
      }).catch((err) => log(`blog webhook failed: ${err}`));
    }
  } catch (err) {
    log(`⚠️  publishToBlog failed: ${err}`);
  }
}

async function triggerRebuildWebhook(cycleNum: number): Promise<void> {
  const webhookUrl = process.env.PHAGE_REBUILD_WEBHOOK;
  if (!webhookUrl) return;
  await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(process.env.PHAGE_WEBHOOK_SECRET
        ? { "x-phage-secret": process.env.PHAGE_WEBHOOK_SECRET }
        : {}),
    },
    body: JSON.stringify({ cycle: cycleNum }),
  }).catch((err) => log(`rebuild webhook failed: ${err}`));
  log("rebuild webhook triggered");
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
    log(`⚠️  could not update README badge: ${err}`);
  }
}

// ─── Context builder ──────────────────────────────────────────────────────────

interface AgentResponse {
  summary: string;
  reasoning: string;
  files: Array<{ path: string; content: string }>;
  cycleLog: string;
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
  const changelogFull = await readFile("CHANGELOG.md");
  // Truncate changelog to last 15 cycle entries to avoid exhausting context window
  const changelogEntries = changelogFull.split(/\n---\n/);
  const changelog = changelogEntries.slice(-15).join("\n---\n");
  if (changelogEntries.length > 15) {
    log(
      `  changelog truncated: showing last 15 of ${changelogEntries.length} entries`,
    );
  }
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

  const measurementBan = !lastCycleHadChanges
    ? `
## ⚠️ MANDATORY — YOU MUST MAKE A CODE CHANGE THIS CYCLE ⚠️

The previous cycle had no code changes (it was a measurement-only cycle).
You are NOT permitted to run another measurement-only cycle.
You MUST include at least one file in your \`files\` array.

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

## Test files currently tracked by git
${getTrackedFiles("tests").join(", ")}

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

// ─── Main cycle ───────────────────────────────────────────────────────────────

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
    log(`raw response preview:\n${rawResponse.slice(0, 500)}`);
    await appendCycleLog(
      `## Cycle ${cycleNum} — ${cycleStart}\n\n**Result:** FAILED — could not parse agent response.`,
    );
    await setLastCycleHadChanges(false);
    return;
  }

  log(`\n📋 plan: ${agentResponse.summary}`);
  log(`💭 why:  ${agentResponse.reasoning}\n`);

  const hadCodeChanges = agentResponse.files.length > 0;

  if (!lastCycleHadChanges && !hadCodeChanges) {
    log(
      `⚠️  consecutive measurement cycle despite mandatory ban — agent ignored instruction`,
    );
  }

  await applyChanges(agentResponse);

  const {
    passed: testsPassed,
    output: testOutput,
    failureReason,
    testCount,
    suiteCount,
  } = await runTests();

  log(`   tests: ${testCount ?? "?"} tests across ${suiteCount ?? "?"} suites`);

  if (!testsPassed) {
    log(`❌ tests failed — reverting (${failureReason ?? "unknown reason"})`);
    await revertChanges();

    const isCompileError =
      failureReason?.includes("compile error") ||
      failureReason?.includes("TypeScript") ||
      testOutput.includes("error TS");

    const nextCycleNote = isCompileError
      ? `**Note for next cycle:** This failed due to a TypeScript compile error, not a logic problem. The approach may still be valid — fix the type error rather than abandoning the approach.`
      : `**Note for next cycle:** This failed due to test assertion failures. Read the failing test carefully — if the logic is fixable, fix it. Only abandon the approach if it is fundamentally incompatible with the test suite.`;

    const failLog =
      agentResponse.cycleLog +
      `\n\n**REVERTED:** Tests failed.\n\`\`\`\n${testOutput.slice(-2000)}\n\`\`\`` +
      `\n\n${nextCycleNote}`;
    await appendCycleLog(failLog);
    await publishToBlog(cycleNum, failLog);
    await setLastCycleHadChanges(hadCodeChanges);
    return;
  }

  log(`✅ tests passed (${testCount} tests, ${suiteCount} suites)`);

  await runBenchmarks();
  const benchAfter = await readFile("benchmarks/latest.json");
  const { regressed, details } = checkBenchmarkRegression(
    benchBefore,
    benchAfter,
  );

  if (regressed && hadCodeChanges) {
    log(`⚠️  benchmark regression — reverting\n${details}`);
    await revertChanges();
    const regressLog =
      agentResponse.cycleLog +
      `\n\n**REVERTED:** Benchmark regression.\n\`\`\`\n${details}\n\`\`\`` +
      `\n\n**Note for next cycle:** This caused a benchmark regression. Regressions usually mean overhead was added to the hot path. Consider whether the cost can be made conditional — only paid when the feature is actually used.`;
    await appendCycleLog(regressLog);
    await publishToBlog(cycleNum, regressLog);
    await setLastCycleHadChanges(false);
    return;
  } else if (regressed && !hadCodeChanges) {
    log(
      `⚠️  benchmark variance on measurement-only cycle — not reverting (no code changes)`,
    );
  }

  log("✅ benchmarks held");
  await saveBenchmarkHistory(cycleNum);

  const { clean: auditClean } = await runAudit();
  if (!auditClean) log("⚠️  npm audit found vulnerabilities — logged");
  else log("✅ npm audit clean");

  await updateReadmeBadge(cycleNum);

  const committed = gitCommit(`cycle ${cycleNum}: ${agentResponse.summary}`);
  if (committed) {
    gitPush();
  }

  await appendCycleLog(agentResponse.cycleLog);
  await publishToBlog(cycleNum, agentResponse.cycleLog);
  await triggerRebuildWebhook(cycleNum);
  await setLastCycleHadChanges(hadCodeChanges);

  log(`\n🧬 cycle ${cycleNum} complete\n`);
}

// ─── Entry point ──────────────────────────────────────────────────────────────

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
