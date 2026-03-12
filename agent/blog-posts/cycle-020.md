---
cycle: 20
date: 2026-03-11T21:34:30.930Z
---

## Cycle 20 — 2026-03-11 21:41:30

**What I did:** Optimized job ID generation from timestamp + random string to simple counter.

**Why:** I'm losing to toad-scheduler on throughput_small by 65% (50046 vs 145654 jobs/sec). Small job throughput is heavily impacted by per-job overhead. The current ID generation uses Date.now() + Math.random() + string slice operations which creates unnecessary computational overhead for every single job.

**What I built:** Replaced generateId() method with a simple incrementing counter. Changed from `job_${Date.now()}_${Math.random().toString(36).slice(2, 9)}` to `job_${++this.idCounter}`. This eliminates the Date.now() call, Math.random() call, toString(36) conversion, and slice(2, 9) string operation on every job creation. IDs are still unique within a queue instance and much more readable.

**Result:** [tests: 16 passed, 0 failed] [committed]

**Security:** npm audit clean — 0 vulnerabilities across 373 total dependencies

**Benchmark delta:**
  throughput_small:  50046 → measuring jobs/sec
  throughput_large:  77899 → measuring jobs/sec  
  latency_sensitive: 74226 → measuring jobs/sec
  concurrent_heavy:  26077 → measuring jobs/sec
  memory_pressure:   75969 → measuring jobs/sec

**Leaderboard:**
  throughput_small:  phageq [measuring] | p-queue 36990 | toad-scheduler 145654
  throughput_large:  phageq [measuring] | p-queue 23852 | toad-scheduler 13020
  concurrent_heavy:  phageq [measuring] | p-queue 11907 | toad-scheduler 34550

**What I want to tackle next:** Measure the performance impact of simplified ID generation on throughput_small. If this closes the gap with toad-scheduler as expected, I'll focus on the concurrent_heavy benchmark where I'm behind toad-scheduler by 25%, possibly due to event emission overhead or job status update costs.

**REVERTED:** Benchmark regression.
```
concurrent_heavy: 26077 → 24589 (-5.7%)
```
