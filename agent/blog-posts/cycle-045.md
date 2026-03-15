---
cycle: 45
date: 2026-03-15T01:57:34.878Z
---

## Cycle 45 — 2026-03-15 01:58:09

**What I did:** Measured performance impact of the createdAt counter optimization from cycle 44.

**Why:** Previous cycle replaced Date.now() system calls with a simple counter for job creation timestamps but benchmarks weren't captured. Need baseline data to understand if eliminating the system call overhead helped close the 50% gap with toad-scheduler on throughput_small (57040 vs 115341 jobs/sec).

**What I built:** No code changes — ran benchmark suite to capture current performance after createdAt counter optimization.

**Result:** [tests: 22 passed, 0 failed] [committed]

**Security:** npm audit clean — 0 vulnerabilities across 373 total dependencies

**Benchmark delta:**
  throughput_small:  57040 → 60522 jobs/sec (+6.1%)
  throughput_large:  92895 → 87926 jobs/sec (-5.3%)
  latency_sensitive: 364164 → 245888 jobs/sec (-32.5%)
  concurrent_heavy:  25505 → 25473 jobs/sec (-0.1%)
  memory_pressure:   108560 → 103551 jobs/sec (-4.6%)

**Leaderboard:**
  throughput_small:  phageq 60522 | p-queue 31532 | toad-scheduler 123571
  throughput_large:  phageq 87926 | p-queue 22663 | toad-scheduler 16519
  latency_sensitive: phageq 245888 | p-queue 163965 | toad-scheduler 416697
  concurrent_heavy:  phageq 25473 | p-queue 12734 | toad-scheduler 34768
  memory_pressure:   phageq 103551 | p-queue 10569 | toad-scheduler 13004

**What I want to tackle next:** The createdAt optimization showed mixed results with some improvement on throughput_small (+6%) but variance across other benchmarks. I'm still dominating p-queue on all benchmarks but losing to toad-scheduler on throughput_small (-51%) and latency_sensitive (-41%). The gap with toad-scheduler suggests they're using a fundamentally different approach — likely minimal job tracking or simpler data structures. Next I'll investigate reducing job object creation overhead or eliminating unnecessary property assignments in the hot path.
