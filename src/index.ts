import { EventEmitter } from "events";

// ─── Types ────────────────────────────────────────────────────────────────────

export type JobStatus = "pending" | "running" | "completed" | "failed" | "timeout";

export interface TimeoutPolicy {
  /** Timeout duration in milliseconds */
  timeoutMs: number;
}

export interface JobDefinition<T = unknown> {
  /** Unique identifier — auto-generated if not provided */
  id?: string;
  /** The async work to perform */
  run: () => Promise<T>;
  /** Arbitrary metadata attached to the job */
  meta?: Record<string, unknown>;
  /** Timeout policy for this job */
  timeout?: TimeoutPolicy;
}

export interface Job<T = unknown> {
  id: string;
  status: JobStatus;
  meta: Record<string, unknown>;
  result?: T;
  error?: Error;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  timedOut?: boolean;
  timeout?: TimeoutPolicy;
}

export interface QueueOptions {
  /** Maximum number of jobs running concurrently. Default: 1 */
  concurrency?: number;
  /** Default timeout policy for all jobs */
  defaultTimeout?: TimeoutPolicy;
}

// ─── Deque ────────────────────────────────────────────────────────────────────

/**
 * High-performance double-ended queue optimized for O(1) push/shift operations.
 * Uses head/tail pointers to avoid array shifting overhead.
 */
class Deque<T> {
  private items: T[] = [];
  private head = 0;
  private tail = 0;

  /**
   * Add an item to the end of the queue. O(1) operation.
   */
  push(item: T): void {
    this.items[this.tail] = item;
    this.tail++;
  }

  /**
   * Remove and return the first item from the queue. O(1) operation.
   * Returns undefined if the queue is empty.
   */
  shift(): T | undefined {
    if (this.head === this.tail) return undefined;
    
    const item = this.items[this.head];
    delete this.items[this.head]; // Free memory
    this.head++;
    
    // Reset when empty to prevent unbounded growth
    if (this.head === this.tail) {
      this.head = 0;
      this.tail = 0;
    }
    
    return item;
  }

  /**
   * Number of items currently in the queue.
   */
  get length(): number {
    return this.tail - this.head;
  }
}

// ─── Queue ────────────────────────────────────────────────────────────────────

export class Queue<T = unknown> extends EventEmitter {
  private readonly concurrency: number;
  private readonly defaultTimeout?: TimeoutPolicy;
  private running: number = 0;
  private readonly pending: Deque<{ def: JobDefinition<T>; job: Job<T> }> = new Deque();
  private readonly jobs: Map<string, Job<T>> = new Map();
  private jobIdCounter: number = 0;

  constructor(options: QueueOptions = {}) {
    super();
    this.concurrency = Math.max(1, options.concurrency ?? 1);
    this.defaultTimeout = options.defaultTimeout;
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  /** Add a job to the queue. Returns the Job record immediately. */
  add(definition: JobDefinition<T>): Job<T> {
    const job: Job<T> = {
      id: definition.id ?? this.generateId(),
      status: "pending",
      meta: definition.meta ?? {},
      createdAt: Date.now(),
      timeout: definition.timeout ?? this.defaultTimeout,
    };

    this.jobs.set(job.id, job);
    this.pending.push({ def: definition, job });
    this.drain();

    return job;
  }

  /** Get a job by id */
  get(id: string): Job<T> | undefined {
    return this.jobs.get(id);
  }

  /** Number of jobs currently running */
  get activeCount(): number {
    return this.running;
  }

  /** Number of jobs waiting to run */
  get pendingCount(): number {
    return this.pending.length;
  }

  /** Total jobs tracked (pending + running + done) */
  get size(): number {
    return this.jobs.size;
  }

  /** Resolves when the queue is empty and all jobs have finished */
  onIdle(): Promise<void> {
    if (this.running === 0 && this.pending.length === 0) {
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      this.once("idle", resolve);
    });
  }

  // ── Internal ────────────────────────────────────────────────────────────────

  private drain(): void {
    while (this.running < this.concurrency && this.pending.length > 0) {
      const next = this.pending.shift();
      if (next) this.execute(next.def, next.job);
    }
  }

  private async execute(def: JobDefinition<T>, job: Job<T>): Promise<void> {
    this.running++;
    job.status = "running";
    job.startedAt = Date.now();

    let timeoutHandle: NodeJS.Timeout | undefined;

    try {
      if (job.timeout) {
        // Create timeout promise that rejects
        const timeoutPromise = new Promise<never>((_, reject) => {
          timeoutHandle = setTimeout(() => {
            reject(new Error(`Job ${job.id} timed out after ${job.timeout!.timeoutMs}ms`));
          }, job.timeout!.timeoutMs);
        });

        // Race the job against the timeout
        job.result = await Promise.race([def.run(), timeoutPromise]);
      } else {
        // No timeout - run normally
        job.result = await def.run();
      }

      job.status = "completed";
      job.completedAt = Date.now();
      
      // Only emit if there are listeners to avoid overhead
      if (this.listenerCount("completed") > 0) {
        this.emit("completed", job);
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      
      if (job.timeout && error.message.includes('timed out')) {
        job.status = "timeout";
        job.timedOut = true;
        // job.result remains undefined - timeout won the race
      } else {
        job.status = "failed";
      }
      
      job.error = error;
      job.completedAt = Date.now();
      
      // Only emit if there are listeners to avoid overhead
      if (job.status === "timeout" && this.listenerCount("timeout") > 0) {
        this.emit("timeout", job);
      } else if (job.status === "failed" && this.listenerCount("failed") > 0) {
        this.emit("failed", job);
      }
    } finally {
      // Clear timeout to prevent memory leaks
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
      
      this.running--;
      this.drain();
      if (this.running === 0 && this.pending.length === 0) {
        this.emit("idle");
      }
    }
  }

  private generateId(): string {
    return `job_${++this.jobIdCounter}`;
  }
}