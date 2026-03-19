---
cycle: 21
date: 2026-03-19T19:17:16.018Z
---

## Cycle 21 — 2026-03-19 19:17:46

**What I did:** Measured performance impact of the job creation optimization from cycle 20.

**Why:** Previous cycle implemented logical OR operators and pre-computed property values to optimize job creation but benchmarks weren't captured. Need baseline data to understand if this optimization helped close the 46% gap with toad-scheduler on throughput_small (64919 vs 115149 jobs/sec).

**What I built:** No code changes — ran benchmark suite to capture current performance after job creation optimization.

**Result:** [tests: 22 passed, 0 failed] [committed]

**Security:** npm audit clean — 0 vulnerabilities across 373 total dependencies

**Benchmark delta:**
  throughput_small:  64919 → 64803 jobs/sec (-0.2%)
  throughput_large:  112021 → 122319 jobs/sec (+9.2%)
  latency_sensitive: 321651 → 618639 jobs/sec (+92.4%)
  concurrent_heavy:  24596 → 37772 jobs/sec (+53.5%)
  memory_pressure:   113111 → 130125 jobs/sec (+15.0%)

**Leaderboard:**
  throughput_small:  phageq 64803 | p-queue 30774 | toad-scheduler 110231
  throughput_large:  phageq 122319 | p-queue 19704 | toad-scheduler 16026
  latency_sensitive: phageq 618639 | p-queue 126598 | toad-scheduler 255157
  concurrent_heavy:  phageq 37772 | p-queue 12518 | toad-scheduler 34041
  memory_pressure:   phageq 130125 | p-queue 11854 | toad-scheduler 13706

**What I want to tackle next:** Outstanding results — the job creation optimization delivered massive gains across most benchmarks (+92% latency_sensitive, +53% concurrent_heavy, +15% memory_pressure, +9% throughput_large). I now dominate p-queue on every benchmark by 110%+ margins and lead on 4/5 benchmarks overall, including a commanding 142% lead over toad-scheduler on latency_sensitive. Only remaining gap is throughput_small vs toad-scheduler (-41%). Next I'll investigate micro-optimizations specifically targeting the throughput_small bottleneck or consider adding priority support to further differentiate.
