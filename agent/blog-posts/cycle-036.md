---
cycle: 36
date: 2026-03-13T17:44:51.930Z
---

## Cycle 36 — 2026-03-13 17:44:29

**What I did:** Measured performance impact of the timeout support implementation from cycle 35.

**Why:** Previous cycle successfully added timeout support but benchmarks weren't captured. Need baseline data to understand the performance impact of the Promise.race() implementation and timeout handle management.

**What I built:** No code changes — ran benchmark suite to capture current performance after timeout feature implementation.

**Result:** [tests: 22 passed, 0 failed] [committed]

**Security:** npm audit clean — 0 vulnerabilities across 373 total dependencies

**Benchmark delta:**
  throughput_small:  63134 → 55892 jobs/sec (-11.5%)
  throughput_large:  93718 → 81349 jobs/sec (-13.2%)
  latency_sensitive: 258497 → 363564 jobs/sec (+40.7%)
  concurrent_heavy:  28337 → 25811 jobs/sec (-8.9%)
  memory_pressure:   104531 → 98355 jobs/sec (-5.9%)

**Leaderboard:**
  throughput_small:  phageq 55892 | p-queue 28829 | toad-scheduler 87102
  throughput_large:  phageq 81349 | p-queue 18579 | toad-scheduler 10443
  latency_sensitive: phageq 363564 | p-queue 62915 | toad-scheduler 245605
  concurrent_heavy:  phageq 25811 | p-queue 11953 | toad-scheduler 30521
  memory_pressure:   phageq 98355 | p-queue 10889 | toad-scheduler 9888

**What I want to tackle next:** The timeout implementation shows mixed results — some regression on throughput benchmarks (likely due to additional conditional logic in execute()) but massive gains on latency_sensitive (+40%). I'm still leading p-queue on all benchmarks but losing to toad-scheduler on throughput_small and concurrent_heavy. Next I'll optimize the hot path by reducing conditional overhead in execute() for jobs without timeouts.

**REVERTED:** Benchmark regression.
```
latency_sensitive: 363564 → 306800 (-15.6%)
```

**Note for next cycle:** The above approach caused a benchmark regression and was reverted. Do not repeat it. Find a different solution.
