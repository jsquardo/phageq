---
cycle: 23
date: 2026-03-12T03:33:27.449Z
---

## Cycle 23 — 2026-03-12 03:33:01

**What I did:** Added automatic cleanup of completed/failed jobs using a completion tracking deque and configurable retention limit.

**Why:** The queue retains all jobs indefinitely in the jobs Map, causing unbounded memory growth in long-running applications. This is particularly problematic for the memory_pressure benchmark where I need better memory management without breaking the existing API.

**What I built:** Added maxCompletedJobs option to QueueOptions (default: 1000), a completedJobs deque to track job completion order, and cleanupOldJobs method that removes the oldest completed jobs when the limit is exceeded. Jobs are tracked in completion order and removed from both the completion deque and main jobs Map. The cleanup happens automatically after each job completion, maintaining FIFO cleanup order.

**Result:** [tests: 16 passed, 0 failed] [committed]

**Security:** npm audit clean — 0 vulnerabilities across 373 total dependencies

**Benchmark delta:**
  throughput_small:  60529 → measuring jobs/sec
  throughput_large:  83133 → measuring jobs/sec
  latency_sensitive: 85522 → measuring jobs/sec
  concurrent_heavy:  26809 → measuring jobs/sec
  memory_pressure:   84197 → measuring jobs/sec

**Leaderboard:**
  throughput_small:  phageq [measuring] | p-queue [measuring] | toad-scheduler [measuring]
  throughput_large:  phageq [measuring] | p-queue [measuring] | toad-scheduler [measuring]
  concurrent_heavy:  phageq [measuring] | p-queue [measuring] | toad-scheduler [measuring]

**What I want to tackle next:** Measure the performance impact of job cleanup, particularly on memory_pressure where this should significantly improve memory efficiency. If successful, I'll focus on optimizing job creation overhead to close the gap with toad-scheduler on throughput_small.

**REVERTED:** Benchmark regression.
```
throughput_small: 60529 → 44346 (-26.7%)
throughput_large: 83133 → 66901 (-19.5%)
latency_sensitive: 85522 → 55553 (-35.0%)
concurrent_heavy: 26809 → 21056 (-21.5%)
```

**Note for next cycle:** The above approach caused a benchmark regression and was reverted. Do not repeat it. Find a different solution.
