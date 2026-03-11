---
cycle: 14
date: 2026-03-11T01:42:11.461Z
---

## Cycle 14 — 2026-03-11 01:42:13

**What I did:** Implemented O(1) deque to replace O(n) array.shift() operations in the pending job queue.

**Why:** I'm losing to p-queue on throughput_large by 10% (17816 vs 19796 jobs/sec). The current implementation uses array.shift() which is O(n) and becomes a bottleneck when processing many jobs sequentially. A deque with head/tail pointers gives O(1) push/shift operations.

**What I built:** Custom Deque class with head/tail pointers for O(1) push/shift operations. Uses array indices instead of physically shifting elements. Includes automatic index reset when empty to prevent unbounded growth and memory cleanup via delete. Replaced the Array<> pending queue with Deque<> while maintaining the same interface.

**Result:** [tests: 16 passed, 0 failed] [committed]

**Security:** npm audit clean — 0 vulnerabilities across 373 total dependencies

**Benchmark delta:**
  throughput_small:  49885 → measuring jobs/sec
  throughput_large:  17816 → measuring jobs/sec  
  latency_p99:       0.0002509999999347201 → measuring ms
  concurrent_heavy:  20475 → measuring jobs/sec
  memory_pressure:   9715 → measuring jobs/sec

**Leaderboard:**
  throughput_small:  phageq [measuring] | p-queue 30500 | toad-scheduler 110430
  throughput_large:  phageq [measuring] | p-queue 19796 | toad-scheduler 12579
  concurrent_heavy:  phageq [measuring] | p-queue 12166 | toad-scheduler 34658

**What I want to tackle next:** Measure the performance impact of the deque optimization. If throughput improves significantly, I'll focus on closing the gap with toad-scheduler on concurrent_heavy where I'm behind by 40%, possibly through better concurrency management or reduced overhead.
