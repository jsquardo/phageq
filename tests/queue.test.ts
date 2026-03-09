import { Queue } from "../src/index.js";

// ─── Core behavior ────────────────────────────────────────────────────────────

describe("Queue — core", () => {
  test("runs a single job", async () => {
    const q = new Queue();
    let ran = false;
    q.add({ run: async () => { ran = true; } });
    await q.onIdle();
    expect(ran).toBe(true);
  });

  test("returns job with correct initial state", () => {
    const q = new Queue();
    const job = q.add({ run: async () => "done" });
    expect(job.id).toBeDefined();
    expect(["pending", "running"]).toContain(job.status);
    expect(job.createdAt).toBeLessThanOrEqual(Date.now());
  });

  test("job status transitions to completed", async () => {
    const q = new Queue();
    const job = q.add({ run: async () => 42 });
    await q.onIdle();
    expect(job.status).toBe("completed");
    expect(job.result).toBe(42);
    expect(job.completedAt).toBeDefined();
  });

  test("job status transitions to failed on error", async () => {
    const q = new Queue();
    const job = q.add({ run: async () => { throw new Error("boom"); } });
    await q.onIdle();
    expect(job.status).toBe("failed");
    expect(job.error?.message).toBe("boom");
  });

  test("preserves job metadata", async () => {
    const q = new Queue();
    const job = q.add({ run: async () => {}, meta: { userId: 123, type: "email" } });
    expect(job.meta.userId).toBe(123);
    expect(job.meta.type).toBe("email");
  });

  test("retrieves job by id", async () => {
    const q = new Queue();
    const job = q.add({ id: "my-job", run: async () => {} });
    expect(q.get("my-job")).toBe(job);
  });
});

// ─── Concurrency ─────────────────────────────────────────────────────────────

describe("Queue — concurrency", () => {
  test("respects concurrency limit", async () => {
    const q = new Queue({ concurrency: 2 });
    let maxConcurrent = 0;
    let current = 0;

    Array.from({ length: 10 }, () =>
      q.add({
        run: async () => {
          current++;
          maxConcurrent = Math.max(maxConcurrent, current);
          await new Promise((r) => setTimeout(r, 10));
          current--;
        },
      })
    );

    await q.onIdle();
    expect(maxConcurrent).toBeLessThanOrEqual(2);
  });

  test("runs all jobs when concurrency is high", async () => {
    const q = new Queue({ concurrency: 50 });
    let count = 0;
    Array.from({ length: 100 }, () =>
      q.add({ run: async () => { count++; } })
    );
    await q.onIdle();
    expect(count).toBe(100);
  });

  test("activeCount and pendingCount are accurate", async () => {
    const q = new Queue({ concurrency: 1 });
    let resolveFirst!: () => void;

    q.add({
      run: () => new Promise<void>((r) => { resolveFirst = r; }),
    });

    q.add({ run: async () => {} });

    await new Promise((r) => setImmediate(r));

    expect(q.activeCount).toBe(1);
    expect(q.pendingCount).toBe(1);

    resolveFirst();
    await q.onIdle();

    expect(q.activeCount).toBe(0);
    expect(q.pendingCount).toBe(0);
  });
});

// ─── Events ───────────────────────────────────────────────────────────────────

describe("Queue — events", () => {
  test("emits completed event", async () => {
    const q = new Queue();
    const completed: string[] = [];
    q.on("completed", (job) => completed.push(job.id));
    const job = q.add({ run: async () => {} });
    await q.onIdle();
    expect(completed).toContain(job.id);
  });

  test("emits failed event", async () => {
    const q = new Queue();
    const failed: string[] = [];
    q.on("failed", (job) => failed.push(job.id));
    const job = q.add({ run: async () => { throw new Error("fail"); } });
    await q.onIdle();
    expect(failed).toContain(job.id);
  });

  test("emits idle when queue drains", async () => {
    const q = new Queue({ concurrency: 5 });
    let idleFired = false;
    q.on("idle", () => { idleFired = true; });
    Array.from({ length: 10 }, () => q.add({ run: async () => {} }));
    await q.onIdle();
    expect(idleFired).toBe(true);
  });

  test("onIdle resolves immediately if already idle", async () => {
    const q = new Queue();
    await expect(q.onIdle()).resolves.toBeUndefined();
  });
});

// ─── Edge cases ───────────────────────────────────────────────────────────────

describe("Queue — edge cases", () => {
  test("failed jobs do not block the queue", async () => {
    const q = new Queue({ concurrency: 1 });
    let secondRan = false;

    q.add({ run: async () => { throw new Error("first fails"); } });
    q.add({ run: async () => { secondRan = true; } });

    await q.onIdle();
    expect(secondRan).toBe(true);
  });

  test("handles 10,000 jobs without crashing", async () => {
    const q = new Queue({ concurrency: 50 });
    let count = 0;
    Array.from({ length: 10_000 }, () =>
      q.add({ run: async () => { count++; } })
    );
    await q.onIdle();
    expect(count).toBe(10_000);
  });

  test("size reflects total jobs tracked", async () => {
    const q = new Queue();
    q.add({ run: async () => {} });
    q.add({ run: async () => {} });
    await q.onIdle();
    expect(q.size).toBe(2);
  });
});
