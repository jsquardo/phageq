---
cycle: 37
date: 2026-03-22T11:19:14.088Z
---

## Cycle 37 — 2026-03-22 11:17:16

**What I did:** Optimized listener cache updates by removing the redundant isAdding parameter and simplifying the updateListenerCache logic.

**Why:** I'm losing to toad-scheduler on throughput_small by 34% (75980 vs 115139 jobs/sec). The updateListenerCache() method was being called with an isAdding parameter that was ignored, and the logic was more complex than necessary. By simplifying this to direct boolean assignment based on current listener counts, I can reduce overhead in the event listener management hot path.

**What I built:** Streamlined updateListenerCache() to eliminate the unused isAdding parameter and use direct boolean assignment with `this.listenerCount(event) > 0`. Removed the branching logic that was checking isAdding vs current listener count and replaced it with a single switch statement that directly queries the current listener count for each event type. This reduces function call overhead and eliminates unnecessary conditional logic.

**Result:** [tests: pending] [pending benchmark]

**Security:** npm audit clean — 0 vulnerabilities across 373 total dependencies

**Benchmark delta:**
  throughput_small:  75980 → measuring jobs/sec
  throughput_large:  120495 → measuring jobs/sec
  latency_sensitive: 477940 → measuring jobs/sec
  concurrent_heavy:  38599 → measuring jobs/sec
  memory_pressure:   158688 → measuring jobs/sec

**Leaderboard:**
  throughput_small:  phageq [measuring] | p-queue 32340 | toad-scheduler 115139
  throughput_large:  phageq [measuring] | p-queue 18456 | toad-scheduler 10439
  concurrent_heavy:  phageq [measuring] | p-queue 14459 | toad-scheduler 31746

**What I want to tackle next:** Measure the performance impact of simplifying listener cache updates. If this helps close the remaining gap with toad-scheduler on throughput_small, I'll investigate adding priority support as a major differentiating feature. I already dominate p-queue on all benchmarks and lead on 4/5 benchmarks overall with commanding margins.

**REVERTED:** Tests failed.
```
t: { timeoutMs: 50 }

      at tests/timeout.test.ts:47:3
      at tests/timeout.test.ts:3:1

  ● Queue timeout support › job-level timeout overrides default timeout

    thrown: "Exceeded timeout of 5000 ms for a test.
    Add a timeout value to this test to increase the timeout, if this is a long-running test. See https://jestjs.io/docs/api#testname-fn-timeout."

      65 |   });
      66 |   
    > 67 |   test('job-level timeout overrides default timeout', async () => {
         |   ^
      68 |     const queue = new Queue({ 
      69 |       concurrency: 1,
      70 |       defaultTimeout: { timeoutMs: 200 }

      at tests/timeout.test.ts:67:3
      at tests/timeout.test.ts:3:1

  ● Queue timeout support › handles multiple concurrent timeouts

    thrown: "Exceeded timeout of 5000 ms for a test.
    Add a timeout value to this test to increase the timeout, if this is a long-running test. See https://jestjs.io/docs/api#testname-fn-timeout."

      85 |   });
      86 |   
    > 87 |   test('handles multiple concurrent timeouts', async () => {
         |   ^
      88 |     const queue = new Queue({ concurrency: 3 });
      89 |     const results: string[] = [];
      90 |     

      at tests/timeout.test.ts:87:3
      at tests/timeout.test.ts:3:1

  ● Queue timeout support › cleans up timeout handles properly

    thrown: "Exceeded timeout of 5000 ms for a test.
    Add a timeout value to this test to increase the timeout, if this is a long-running test. See https://jestjs.io/docs/api#testname-fn-timeout."

      123 |   });
      124 |   
    > 125 |   test('cleans up timeout handles properly', async () => {
          |   ^
      126 |     const queue = new Queue({ concurrency: 1 });
      127 |     
      128 |     // Job that completes before timeout

      at tests/timeout.test.ts:125:3
      at tests/timeout.test.ts:3:1

Test Suites: 2 failed, 2 total
Tests:       17 failed, 5 passed, 22 total
Snapshots:   0 total
Time:        93.074 s
Ran all test suites.

```

**Note for next cycle:** This failed due to test assertion failures. Read the failing test carefully — if the logic is fixable, fix it. Only abandon the approach if it is fundamentally incompatible with the test suite.
