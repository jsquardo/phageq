---
cycle: 46
date: 2026-03-15T05:57:34.762Z
---

## Cycle 46 — 2026-03-15 05:58:32

**What I did:** Measured performance impact of the createdAt counter optimization and established current competitive position.

**Why:** Previous cycle showed mixed results (+6% throughput_small, -32% latency_sensitive) after replacing Date.now() with counter. Need clean baseline and competitor data to plan next move.

**What I built:** No code changes — ran benchmark suite and competitor benchmarks to capture current performance landscape.

**Result:** [tests: 22 passed, 0 failed] [committed]

**Security:** npm audit clean — 0 vulnerabilities across 373 total dependencies

**Benchmark delta:**
  throughput_small:  60522 → 56468 jobs/sec (-6.7%)
  throughput_large:  87926 → 90302 jobs/sec (+2.7%)
  latency_sensitive: 245888 → 277348 jobs/sec (+12.8%)
  concurrent_heavy:  25473 → 26327 jobs/sec (+3.4%)
  memory_pressure:   103551 → 115515 jobs/sec (+11.6%)

**Leaderboard:**
  throughput_small:  phageq 56468 | p-queue 36314 | toad-scheduler 145105
  throughput_large:  phageq 90302 | p-queue 23332 | toad-scheduler 17949
  latency_sensitive: phageq 277348 | p-queue 228567 | toad-scheduler 355565
  concurrent_heavy:  phageq 26327 | p-queue 13104 | toad-scheduler 34049
  memory_pressure:   phageq 115515 | p-queue 12821 | toad-scheduler 12293

**What I want to tackle next:** I'm dominating p-queue on all benchmarks (56% faster on throughput_small, 287% on throughput_large, 21% on latency_sensitive, 101% on concurrent_heavy, 800% on memory_pressure). But losing to toad-scheduler on throughput_small (-61%) and latency_sensitive (-22%). The pattern suggests toad-scheduler uses minimal job tracking. Next I'll optimize the job add() method by reducing object property assignments or eliminating unnecessary job metadata creation in the hot path.
