import { Queue } from "../src/index";

describe("Job Cleanup", () => {
  it("should retain completed jobs indefinitely by default", async () => {
    const queue = new Queue();
    
    // Add and complete several jobs
    const job1 = queue.add({ run: async () => "result1" });
    const job2 = queue.add({ run: async () => "result2" });
    const job3 = queue.add({ run: async () => "result3" });
    
    await queue.onIdle();
    
    // All jobs should still be accessible
    expect(queue.get(job1.id)).toBeDefined();
    expect(queue.get(job2.id)).toBeDefined();
    expect(queue.get(job3.id)).toBeDefined();
    expect(queue.size).toBe(3);
  });

  it("should limit retained completed jobs when maxCompletedJobs is set", async () => {
    const queue = new Queue({ maxCompletedJobs: 2 });
    
    // Add and complete more jobs than the limit
    const job1 = queue.add({ run: async () => "result1" });
    const job2 = queue.add({ run: async () => "result2" });
    const job3 = queue.add({ run: async () => "result3" });
    const job4 = queue.add({ run: async () => "result4" });
    
    await queue.onIdle();
    
    // Only the last 2 jobs should be retained
    expect(queue.get(job1.id)).toBeUndefined();
    expect(queue.get(job2.id)).toBeUndefined();
    expect(queue.get(job3.id)).toBeDefined();
    expect(queue.get(job4.id)).toBeDefined();
    expect(queue.size).toBe(2);
  });

  it("should clean up both completed and failed jobs", async () => {
    const queue = new Queue({ maxCompletedJobs: 1 });
    
    // Add a successful job
    const job1 = queue.add({ run: async () => "success" });
    await queue.onIdle();
    
    // Add a failing job
    const job2 = queue.add({ run: async () => { throw new Error("fail"); } });
    await queue.onIdle();
    
    // First job should be cleaned up, second should remain
    expect(queue.get(job1.id)).toBeUndefined();
    expect(queue.get(job2.id)).toBeDefined();
    expect(queue.size).toBe(1);
  });

  it("should not clean up running or pending jobs", async () => {
    const queue = new Queue({ concurrency: 1, maxCompletedJobs: 1 });
    let resolveFirst: () => void;
    const firstJobPromise = new Promise<void>((resolve) => {
      resolveFirst = resolve;
    });
    
    // Add a long-running job and a pending job
    const runningJob = queue.add({ run: async () => {
      await firstJobPromise;
      return "running";
    }});
    const pendingJob = queue.add({ run: async () => "pending" });
    
    // Complete one job to trigger cleanup
    const completedJob = queue.add({ run: async () => "completed" });
    
    // Let first job finish to make room for others
    resolveFirst();
    await queue.onIdle();
    
    // All jobs should still be tracked since running/pending aren't cleaned
    expect(queue.size).toBe(2); // Only the last 2 completed jobs
  });

  it("should handle maxCompletedJobs of 0 by cleaning all completed jobs immediately", async () => {
    const queue = new Queue({ maxCompletedJobs: 0 });
    
    const job1 = queue.add({ run: async () => "result1" });
    const job2 = queue.add({ run: async () => "result2" });
    
    await queue.onIdle();
    
    // All completed jobs should be cleaned immediately
    expect(queue.get(job1.id)).toBeUndefined();
    expect(queue.get(job2.id)).toBeUndefined();
    expect(queue.size).toBe(0);
  });

  it("should maintain FIFO order when cleaning completed jobs", async () => {
    const queue = new Queue({ maxCompletedJobs: 2 });
    
    // Add jobs with delays to ensure order
    const job1 = queue.add({ run: async () => { await new Promise(r => setTimeout(r, 10)); return "1"; } });
    await queue.onIdle();
    
    const job2 = queue.add({ run: async () => { await new Promise(r => setTimeout(r, 10)); return "2"; } });
    await queue.onIdle();
    
    const job3 = queue.add({ run: async () => { await new Promise(r => setTimeout(r, 10)); return "3"; } });
    await queue.onIdle();
    
    // First job should be cleaned (oldest), last two should remain
    expect(queue.get(job1.id)).toBeUndefined();
    expect(queue.get(job2.id)).toBeDefined();
    expect(queue.get(job3.id)).toBeDefined();
  });
});