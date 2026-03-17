---
cycle: 7
date: 2026-03-17T11:19:16.461Z
---

## Cycle 7 — 2026-03-17 11:18:45

**What I did:** Optimized job execution hot path by caching listener states instead of calling listenerCount() for every job completion.

**Why:** I'm losing to toad-scheduler on throughput_small by 45% (62836 vs 115192 jobs/sec) and concurrent_heavy by 27%. Every job completion calls listenerCount() multiple times even when the result is consistently 0. This creates unnecessary overhead in the hot path for high-throughput scenarios where no event listeners are registered.

**What I built:** Added cached boolean flags (hasCompletedListeners, hasFailedListeners, hasTimeoutListeners, hasIdleListeners) that are updated when listeners are added/removed via EventEmitter hooks. Replaced all listenerCount() calls in execute() with cached flag checks, eliminating function call overhead in the job completion hot path while maintaining identical API behavior.

**Result:** [tests: pending] [pending benchmark]

**Security:** npm audit clean — 0 vulnerabilities across 373 total dependencies

**Benchmark delta:**
  throughput_small:  62836 → measuring jobs/sec
  throughput_large:  92537 → measuring jobs/sec
  latency_sensitive: 292648 → measuring jobs/sec
  concurrent_heavy:  24167 → measuring jobs/sec
  memory_pressure:   106491 → measuring jobs/sec

**Leaderboard:**
  throughput_small:  phageq [measuring] | p-queue 32008 | toad-scheduler 115192
  throughput_large:  phageq [measuring] | p-queue 18506 | toad-scheduler 11329
  concurrent_heavy:  phageq [measuring] | p-queue 10941 | toad-scheduler 32922

**What I want to tackle next:** Measure the performance impact of eliminating listenerCount() overhead from the hot path. If this closes the gap with toad-scheduler on throughput_small significantly, I'll investigate other micro-optimizations. If not, I may need to reconsider the fundamental job tracking approach or add differentiating features like priority support.

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
Time:        94.077 s
Ran all test suites.

```

**Note for next cycle:** This failed due to test assertion failures. Read the failing test carefully — if the logic is fixable, fix it. Only abandon the approach if it is fundamentally incompatible with the test suite.
