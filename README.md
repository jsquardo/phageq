# phageq

A high-performance in-memory task queue for Node.js with concurrency control, job timeouts, and event-driven monitoring.

## Install

bash
npm install phageq


## Quick Start

javascript
import { Queue } from 'phageq';

const queue = new Queue({ concurrency: 5 });

const job = queue.add({
  run: async () => {
    const response = await fetch('https://api.example.com/data');
    return response.json();
  }
});

console.log(`Job ${job.id} status: ${job.status}`);
queue.on('completed', (job) => console.log('Job completed:', job.result));


## API Reference

### Queue

#### Constructor

typescript
new Queue<T>(options?: QueueOptions)


#### Methods

**`add(definition: JobDefinition<T>): Job<T>`**

Add a job to the queue. Returns the Job record immediately.

**`get(id: string): Job<T> | undefined`**

Get a job by its ID.

**`onIdle(): Promise<void>`**

Resolves when the queue is empty and all jobs have finished.

#### Properties

**`activeCount: number`** - Number of jobs currently running

**`pendingCount: number`** - Number of jobs waiting to run

**`size: number`** - Total jobs tracked (pending + running + completed)

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `concurrency` | `number` | `1` | Maximum number of jobs running concurrently |
| `defaultTimeout` | `TimeoutPolicy` | `undefined` | Default timeout policy for all jobs |

### JobDefinition

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `run` | `() => Promise<T>` | ✅ | The async work to perform |
| `id` | `string` | ❌ | Unique identifier (auto-generated if not provided) |
| `meta` | `Record<string, unknown>` | ❌ | Arbitrary metadata attached to the job |
| `timeout` | `TimeoutPolicy` | ❌ | Timeout policy for this job |

### TimeoutPolicy

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `timeoutMs` | `number` | ✅ | Timeout duration in milliseconds |

### Job Object

typescript
interface Job<T> {
  id: string;
  status: "pending" | "running" | "completed" | "failed" | "timeout";
  meta: Record<string, unknown>;
  result?: T;
  error?: Error;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  timedOut?: boolean;
  timeout?: TimeoutPolicy;
}


## Events

The queue extends EventEmitter and emits the following events:

**`completed`** - Emitted when a job completes successfully
- Payload: `Job<T>` - The completed job object

**`failed`** - Emitted when a job fails with an error
- Payload: `Job<T>` - The failed job object with error details

**`timeout`** - Emitted when a job exceeds its timeout duration
- Payload: `Job<T>` - The timed out job object

**`idle`** - Emitted when the queue becomes empty and all jobs finish
- Payload: None

## Examples

### Basic Usage

javascript
import { Queue } from 'phageq';

const queue = new Queue({ concurrency: 3 });

const jobs = [
  queue.add({ run: () => processFile('file1.txt') }),
  queue.add({ run: () => processFile('file2.txt') }),
  queue.add({ run: () => processFile('file3.txt') })
];

// Wait for all jobs to complete
await queue.onIdle();
console.log('All files processed');


### Job Timeouts

javascript
const queue = new Queue({
  concurrency: 2,
  defaultTimeout: { timeoutMs: 5000 } // 5 second default
});

// This job will use the default 5 second timeout
queue.add({
  run: async () => {
    const response = await fetch('https://slow-api.com/data');
    return response.json();
  }
});

// This job overrides the default with a 10 second timeout
queue.add({
  run: async () => slowOperation(),
  timeout: { timeoutMs: 10000 }
});

queue.on('timeout', (job) => {
  console.log(`Job ${job.id} timed out after ${job.timeout.timeoutMs}ms`);
});


### Job Metadata and Tracking

javascript
const queue = new Queue({ concurrency: 1 });

const job = queue.add({
  run: async () => downloadFile('https://example.com/large-file.zip'),
  meta: {
    userId: 'user123',
    operation: 'download',
    priority: 'high'
  }
});

console.log('Job created at:', job.createdAt);
console.log('User ID:', job.meta.userId);

queue.on('completed', (job) => {
  const duration = job.completedAt - job.startedAt;
  console.log(`Download completed in ${duration}ms for user ${job.meta.userId}`);
});


### Error Handling

javascript
const queue = new Queue({ concurrency: 1 });

queue.add({
  run: async () => {
    throw new Error('Something went wrong');
  }
});

queue.on('failed', (job) => {
  console.error(`Job ${job.id} failed:`, job.error.message);
});

queue.on('completed', (job) => {
  console.log(`Job ${job.id} completed:`, job.result);
});


### Monitoring Queue State

javascript
const queue = new Queue({ concurrency: 5 });

// Add multiple jobs
for (let i = 0; i < 100; i++) {
  queue.add({ run: () => processTask(i) });
}

// Monitor progress
const monitor = setInterval(() => {
  console.log(`Active: ${queue.activeCount}, Pending: ${queue.pendingCount}, Total: ${queue.size}`);
  
  if (queue.activeCount === 0 && queue.pendingCount === 0) {
    clearInterval(monitor);
    console.log('All jobs completed');
  }
}, 1000);


## Performance

phageq is optimized for high throughput with:

- O(1) job queuing and dequeuing using internal deque structure
- Minimal per-job overhead with optimized ID generation
- Conditional event emission to avoid overhead when no listeners are attached
- Efficient timeout handling with fast/slow path optimization

## License

MIT