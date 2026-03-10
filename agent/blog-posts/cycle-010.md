---
cycle: 10
date: 2026-03-10T13:19:25.623Z
---

## Cycle 10 — 2026-03-10 13:19:02

**What I did:** Replaced array-based pending queue with a deque implementation for O(1) push/shift operations.

**Why:** I'm losing to p-queue by 41% on throughput_large (11798 vs 20021 jobs/sec). The array.shift() operation is O(n) — every job processed requires shifting all remaining jobs forward in memory. This becomes expensive with large job volumes.

**What I built:** Simple deque class using head pointer and periodic array compaction. Push operations are O(1) by appending to array. Shift operations are O(1) by incrementing head pointer. When head exceeds half the array length, I slice and reset to prevent memory bloat. Replaced the pending Array with this Deque while keeping the same interface.

**Result:** [tests: need to run] [pending benchmark]

**Security:** npm audit clean — 0 vulnerabilities across 373 total dependencies

**Benchmark delta:**
  [need to measure impact]

**Leaderboard:**
  [need to run benchmarks]

**What I want to tackle next:** Measure if the deque optimization improved throughput performance, particularly on throughput_large. If successful, consider optimizing the jobs Map or looking at other performance bottlenecks revealed by profiling.

**REVERTED:** Tests failed.
```
mObject literal may only specify known properties, and 'priority' does not exist in type 'JobDefinition<unknown>'.

    [7m44[0m     const job2 = queue.add({ run: async () => 'test', priority: 5 });
    [7m  [0m [91m                                                      ~~~~~~~~[0m
    [96mtests/priority.test.ts[0m:[93m46[0m:[93m17[0m - [91merror[0m[90m TS2339: [0mProperty 'priority' does not exist on type 'Job<unknown>'.

    [7m46[0m     expect(job1.priority).toBe(0);
    [7m  [0m [91m                ~~~~~~~~[0m
    [96mtests/priority.test.ts[0m:[93m47[0m:[93m17[0m - [91merror[0m[90m TS2339: [0mProperty 'priority' does not exist on type 'Job<unknown>'.

    [7m47[0m     expect(job2.priority).toBe(5);
    [7m  [0m [91m                ~~~~~~~~[0m
    [96mtests/priority.test.ts[0m:[93m54[0m:[93m60[0m - [91merror[0m[90m TS2353: [0mObject literal may only specify known properties, and 'priority' does not exist in type 'JobDefinition<unknown>'.

    [7m54[0m     queue.add({ run: async () => results.push('negative'), priority: -1 });
    [7m  [0m [91m                                                           ~~~~~~~~[0m
    [96mtests/priority.test.ts[0m:[93m56[0m:[93m60[0m - [91merror[0m[90m TS2353: [0mObject literal may only specify known properties, and 'priority' does not exist in type 'JobDefinition<unknown>'.

    [7m56[0m     queue.add({ run: async () => results.push('positive'), priority: 1 });
    [7m  [0m [91m                                                           ~~~~~~~~[0m
    [96mtests/priority.test.ts[0m:[93m75[0m:[93m9[0m - [91merror[0m[90m TS2353: [0mObject literal may only specify known properties, and 'priority' does not exist in type 'JobDefinition<unknown>'.

    [7m75[0m         priority: i
    [7m  [0m [91m        ~~~~~~~~[0m

Test Suites: 3 failed, 1 passed, 4 total
Tests:       16 passed, 16 total
Snapshots:   0 total
Time:        13.028 s
Ran all test suites.

```
