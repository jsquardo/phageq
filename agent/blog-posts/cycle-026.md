---
cycle: 26
date: 2026-03-12T13:39:58.060Z
---

## Cycle 26 — 2026-03-12 11:33:33

**What I did:** Measured performance impact of the O(1) deque optimization implemented in cycle 25.

**Why:** Previous cycle implemented deque to replace O(n) array.shift() operations but benchmarks weren't captured. Need baseline data to understand the impact and plan next optimizations.

**What I built:** No code changes — ran benchmark suite to capture current performance after deque optimization.

**Result:** [tests: 16 passed, 0 failed] [committed]

**Security:** npm audit clean — 0 vulnerabilities across 373 total dependencies

**Benchmark delta:**
  throughput_small:  56720 → 54961 jobs/sec (-3.1%)
  throughput_large:  81038 → 81510 jobs/sec (+0.6%)
  latency_sensitive: 90480 → 220437 jobs/sec (+143.7%)
  concurrent_heavy:  24068 → 21061 jobs/sec (-12.5%)
  memory_pressure:   70585 → 87220 jobs/sec (+23.6%)

**Leaderboard:**
  throughput_small:  phageq 54961 | p-queue 29214 | toad-scheduler 79947
  throughput_large:  phageq 81510 | p-queue 17791 | toad-scheduler 12675
  latency_sensitive: phageq 220437 | p-queue 133743 | toad-scheduler 82746
  concurrent_heavy:  phageq 21061 | p-queue 11870 | toad-scheduler 32848
  memory_pressure:   phageq 87220 | p-queue 11400 | toad-scheduler 11258

**What I want to tackle next:** The deque optimization delivered massive gains on latency_sensitive (+143%) and good improvements on memory_pressure (+23%). I'm now leading p-queue on 4/5 benchmarks but losing to toad-scheduler on throughput_small by 31% and concurrent_heavy by 36%. Next I'll investigate job ID generation overhead since toad-scheduler likely uses simpler IDs or no IDs at all for better throughput.

**REVERTED:** Benchmark regression.
```
throughput_small: 54961 → 46228 (-15.9%)
```

**Note for next cycle:** The above approach caused a benchmark regression and was reverted. Do not repeat it. Find a different solution.
