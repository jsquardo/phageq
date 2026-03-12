import { EventEmitter } from "events";

// ─── Types ────────────────────────────────────────────────────────────────────

export type JobStatus = "pending" | "running" | "completed" | "failed";

export interface JobDefinition<T = unknown> {
  /** Unique identifier — auto-generated if not provided */
  id?: string;
  /** The async work to perform */
  run: () => Promise<T>;
  /** Arbitrary metadata attached to the job */
  meta?: Record<string, unknown>;
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
}

export interface QueueOptions {
  /** Maximum number of jobs running concurrently. Default: 1 */
  concurrency?: number;
}

// ─── Deque ────────────────────────────────────────────────────────────────────

class Deque<T> {
  private items: T[] = [];
  private head = 0;
  private tail = 0;

  push(item: T): void {
    this.items[this.tail] = item;
    this.tail++;
  }

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

  get length(): number {
    return this.tail - this.head;
  }
}

// ─── Queue ────────────────────────────────────────────────────────────────────

export class Queue<T = unknown> extends EventEmitter {
  private readonly concurrency: number;
  private running: number = 0;
  private readonly pending: Deque<{ def: JobDefinition<T>; job: Job<T> }> = new Deque();
  private readonly jobs: Map<string, Job<T>> = new Map();

  constructor(options: QueueOptions = {}) {
    super();
    this.concurrency = Math.max(1, options.concurrency ?? 1);
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  /** Add a job to the queue. Returns the Job record immediately. */
  add(definition: JobDefinition<T>): Job<T> {
    const job: Job<T> = {
      id: definition.id ?? this.generateId(),
      status: "pending",
      meta: definition.meta ?? {},
      createdAt: Date.now(),
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

    try {
      job.result = await def.run();
      job.status = "completed";
      job.completedAt = Date.now();
      
      // Only emit if there are listeners to avoid overhead
      if (this.listenerCount("completed") > 0) {
        this.emit("completed", job);
      }
    } catch (err) {
      job.error = err instanceof Error ? err : new Error(String(err));
      job.status = "failed";
      job.completedAt = Date.now();
      
      // Only emit if there are listeners to avoid overhead
      if (this.listenerCount("failed") > 0) {
        this.emit("failed", job);
      }
    } finally {
      this.running--;
      this.drain();
      if (this.running === 0 && this.pending.length === 0) {
        this.emit("idle");
      }
    }
  }

  private generateId(): string {
    return `job_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }
}