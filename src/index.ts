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
  /** Priority level — lower numbers = higher priority */
  priority?: number;
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
  priority?: number;
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

// ─── Priority Heap ────────────────────────────────────────────────────────────

/**
 * Min-heap for priority queue operations. Lower priority numbers = higher precedence.
 */
class PriorityHeap<T> {
  private items: Array<{ item: T; priority: number; insertOrder: number }> = [];
  private insertCounter = 0;

  /**
   * Add an item with priority. O(log n) operation.
   */
  push(item: T, priority: number): void {
    const entry = { item, priority, insertOrder: this.insertCounter++ };
    this.items.push(entry);
    this.bubbleUp(this.items.length - 1);
  }

  /**
   * Remove and return the highest priority item. O(log n) operation.
   */
  shift(): T | undefined {
    if (this.items.length === 0) return undefined;
    if (this.items.length === 1) return this.items.pop()!.item;

    const root = this.items[0].item;
    this.items[0] = this.items.pop()!;
    this.bubbleDown(0);
    return root;
  }

  /**
   * Number of items in the heap.
   */
  get length(): number {
    return this.items.length;
  }

  private bubbleUp(index: number): void {
    while (index > 0) {
      const parentIndex = Math.floor((index - 1) / 2);
      if (this.compare(index, parentIndex) >= 0) break;
      
      this.swap(index, parentIndex);
      index = parentIndex;
    }
  }

  private bubbleDown(index: number): void {
    while (true) {
      const leftChild = 2 * index + 1;
      const rightChild = 2 * index + 2;
      let smallest = index;

      if (leftChild < this.items.length && this.compare(leftChild, smallest) < 0) {
        smallest = leftChild;
      }
      if (rightChild < this.items.length && this.compare(rightChild, smallest) < 0) {
        smallest = rightChild;
      }
      if (smallest === index) break;

      this.swap(index, smallest);
      index = smallest;
    }
  }

  private compare(i: number, j: number): number {
    const a = this.items[i];
    const b = this.items[j];
    
    // Compare by priority first (lower = higher precedence)
    if (a.priority !== b.priority) {
      return a.priority - b.priority;
    }
    
    // For same priority, maintain FIFO order (lower insertOrder = earlier)
    return a.insertOrder - b.insertOrder;
  }

  private swap(i: number, j: number): void {
    [this.items[i], this.items[j]] = [this.items[j], this.items[i]];
  }
}

// ─── Queue ────────────────────────────────────────────────────────────────────

export class Queue<T = unknown> extends EventEmitter {
  private readonly concurrency: number;
  private readonly defaultTimeout?: TimeoutPolicy;
  private running: number = 0;
  private readonly pending: Deque<{ def: JobDefinition<T>; job: Job<T> }> = new Deque();
  private priorityPending?: PriorityHeap<{ def: JobDefinition<T>; job: Job<T> }>;
  private readonly jobs: Map<string, Job<T>> = new Map();
  private jobIdCounter: number = 0;
  private createdAtCounter: number = 0;
  private hasPriorityJobs: boolean = false;
  
  // Cached listener counts to eliminate listenerCount() calls
  private completedListenerCount: number = 0;
  private failedListenerCount: number = 0;
  private timeoutListenerCount: number = 0;
  private idleListenerCount: number = 0;

  constructor(options: QueueOptions = {}) {
    super();
    this.concurrency = Math.max(1, options.concurrency ?? 1);
    this.defaultTimeout = options.defaultTimeout;
    
    // Update cached counts when listeners are added/removed
    this.on('newListener', (event: string) => {
      this.updateListenerCount(event, 1);
    });
    
    this.on('removeListener', (event: string) => {
      this.updateListenerCount(event, -1);
    });
  }

  private updateListenerCount(event: string, delta: number): void {
    switch (event) {
      case 'completed':
        this.completedListenerCount += delta;
        break;
      case 'failed':
        this.failedListenerCount += delta;
        break;
      case 'timeout':
        this.timeoutListenerCount += delta;
        break;
      case 'idle':
        this.idleListenerCount += delta;
        break;
    }
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  /** Add a job to the queue. Returns the Job record immediately. */
  add(definition: JobDefinition<T>): Job<T> {
    // Pre-increment counters to eliminate inline operations during object construction
    const jobIdCounterValue = ++this.jobIdCounter;
    const createdAtValue = ++this.createdAtCounter;
    
    // Use direct object creation with ternary operators to eliminate property assignments
    const job: Job<T> = {
      id: definition.id ? definition.id : `job_${jobIdCounterValue}`,
      status: "pending" as const,
      meta: definition.meta ? definition.meta : {},
      createdAt: createdAtValue,
      timeout: definition.timeout ? definition.timeout : this.defaultTimeout,
      priority: definition.priority,
    };

    this.jobs.set(job.id, job);
    
    // Check if this job has priority or if we're already using priority scheduling
    if (definition.priority !== undefined || this.hasPriorityJobs) {
      this.addToPriorityQueue({ def: definition, job });
    } else {
      // Fast path: no priorities involved, use deque
      this.pending.push({ def: definition, job });
    }
    
    this.drain();
    return job;
  }

  private addToPriorityQueue(entry: { def: JobDefinition<T>; job: Job<T> }): void {
    // Migrate from deque to heap on first priority job
    if (!this.hasPriorityJobs) {
      this.hasPriorityJobs = true;
      this.priorityPending = new PriorityHeap();
      
      // Migrate existing FIFO jobs to priority queue with default priority
      while (this.pending.length > 0) {
        const existingEntry = this.pending.shift()!;
        this.priorityPending.push(existingEntry, Number.MAX_SAFE_INTEGER);
      }
    }
    
    // Add new job with its priority (or default for FIFO jobs)
    const priority = entry.def.priority ?? Number.MAX_SAFE_INTEGER;
    this.priorityPending!.push(entry, priority);
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
    return this.hasPriorityJobs 
      ? (this.priorityPending?.length ?? 0)
      : this.pending.length;
  }

  /** Total jobs tracked (pending + running + done) */
  get size(): number {
    return this.jobs.size;
  }

  /** Resolves when the queue is empty and all jobs have finished */
  onIdle(): Promise<void> {
    if (this.running === 0 && this.pendingCount === 0) {
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      this.once("idle", resolve);
    });
  }

  // ── Internal ────────────────────────────────────────────────────────────────

  private drain(): void {
    while (this.running < this.concurrency && this.pendingCount > 0) {
      const next = this.getNextJob();
      if (next) this.execute(next.def, next.job);
    }
  }

  private getNextJob(): { def: JobDefinition<T>; job: Job<T> } | undefined {
    if (this.hasPriorityJobs) {
      return this.priorityPending?.shift();
    } else {
      return this.pending.shift();
    }
  }

  private async execute(def: JobDefinition<T>, job: Job<T>): Promise<void> {
    this.running++;
    job.status = "running";

    try {
      // Fast path: no timeout configured
      if (!job.timeout) {
        job.result = await def.run();
      } else {
        // Slow path: timeout configured, use Promise.race()
        let timeoutHandle: NodeJS.Timeout | undefined;
        
        const timeoutPromise = new Promise<never>((_, reject) => {
          timeoutHandle = setTimeout(() => {
            reject(new Error(`Job ${job.id} timed out after ${job.timeout!.timeoutMs}ms`));
          }, job.timeout!.timeoutMs);
        });

        try {
          job.result = await Promise.race([def.run(), timeoutPromise]);
        } finally {
          if (timeoutHandle) {
            clearTimeout(timeoutHandle);
          }
        }
      }

      job.status = "completed";
      
      // Conditionally call Date.now() only when listeners need timing data
      let completedAt: number;
      if (this.completedListenerCount > 0 || this.timeoutListenerCount > 0 || this.failedListenerCount > 0) {
        completedAt = Date.now();
      } else {
        completedAt = 0; // Minimal overhead placeholder
      }
      job.completedAt = completedAt;
      
      // Use cached count instead of listenerCount() call
      if (this.completedListenerCount > 0) {
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
      
      // Conditionally call Date.now() only when listeners need timing data
      let completedAt: number;
      if (this.completedListenerCount > 0 || this.timeoutListenerCount > 0 || this.failedListenerCount > 0) {
        completedAt = Date.now();
      } else {
        completedAt = 0; // Minimal overhead placeholder
      }
      job.completedAt = completedAt;
      
      // Emit timeout event for timeout jobs, failed event for regular failures
      if (job.status === "timeout" && this.timeoutListenerCount > 0) {
        this.emit("timeout", job);
      } else if (job.status === "failed" && this.failedListenerCount > 0) {
        this.emit("failed", job);
      }
    } finally {
      this.running--;
      this.drain();
      if (this.running === 0 && this.pendingCount === 0 && this.idleListenerCount > 0) {
        this.emit("idle");
      }
    }
  }
}