<div align="center">
  <img src="phageq-site/public/favicon.svg" height="200" />

  # phageq

  **A task queue that rewrites itself.**

  [![cycles](https://img.shields.io/badge/cycle-46-00C896?style=flat&labelColor=0D1F1A)](https://phage.pw/cycles)
  [![tests](https://img.shields.io/badge/tests-passing-00C896?style=flat&labelColor=0D1F1A)](https://github.com/jsquardo/phageq/actions)
  [![license](https://img.shields.io/badge/license-MIT-00C896?style=flat&labelColor=0D1F1A)](LICENSE)

  [phage.pw](https://phage.pw) · [cycles](https://phage.pw/cycles) · [leaderboard](https://phage.pw/leaderboard)
</div>

---

**phageq** started as ~150 lines of TypeScript. Every 4 hours, it reads its
own source code, assesses itself against a frozen benchmark suite, and makes
one improvement — then commits only if tests pass.

No human writes its code after the seed. No roadmap tells it what to do.
It decides for itself.

Watch it grow at **[phage.pw](https://phage.pw)**

---

## Install
```bash
npm install phageq
```

---

## Quick start
```typescript
import { Queue } from 'phageq';

const queue = new Queue({ concurrency: 5 });

queue.add({
  run: async () => {
    await doWork();
  }
});

await queue.onIdle();
```

---

## API reference

### `new Queue(options?)`

Creates a new queue.
```typescript
const queue = new Queue({ concurrency: 10 });
```

### `queue.add(definition)`

Adds a job to the queue. Returns the `Job` record immediately — the job may
not have started yet.
```typescript
const job = queue.add({
  id: 'optional-custom-id',  // auto-generated if omitted
  run: async () => 'result',
  meta: { userId: 123 },
  timeout: 5000              // optional, milliseconds
});
```

### `queue.get(id)`

Returns the `Job` record for a given ID, or `undefined` if not found.
```typescript
const job = queue.get('my-job-id');
```

### `queue.onIdle()`

Returns a `Promise` that resolves when the queue is empty and all running
jobs have finished.
```typescript
await queue.onIdle();
```

### `queue.activeCount`

Number of jobs currently running.

### `queue.pendingCount`

Number of jobs waiting to run.

### `queue.size`

Total number of jobs tracked — pending, running, and finished.

---

## Options

### `QueueOptions`

| Option        | Type     | Default | Description                                     |
| ------------- | -------- | ------- | ----------------------------------------------- |
| `concurrency` | `number` | `1`     | Maximum number of jobs running at the same time |

### `JobDefinition<T>`

| Option    | Type                      | Default        | Description                                                           |
| --------- | ------------------------- | -------------- | --------------------------------------------------------------------- |
| `id`      | `string`                  | auto-generated | Unique job identifier                                                 |
| `run`     | `() => Promise<T>`        | required       | The async function to execute                                         |
| `meta`    | `Record<string, unknown>` | `{}`           | Arbitrary metadata attached to the job                                |
| `timeout` | `number`                  | none           | Timeout in milliseconds. Job is cancelled if it exceeds this duration |

---

## Job object

Every call to `queue.add()` returns a `Job` record that is updated in place
as the job progresses.

| Property      | Type                      | Description                                        |
| ------------- | ------------------------- | -------------------------------------------------- |
| `id`          | `string`                  | Unique job identifier                              |
| `status`      | `JobStatus`               | Current status — see below                         |
| `meta`        | `Record<string, unknown>` | Metadata passed at creation                        |
| `result`      | `T \| undefined`          | Return value of `run()`, set on completion         |
| `error`       | `Error \| undefined`      | Error thrown by `run()`, set on failure or timeout |
| `timedOut`    | `boolean \| undefined`    | `true` if the job was cancelled due to timeout     |
| `createdAt`   | `number`                  | Unix timestamp (ms) when the job was added         |
| `startedAt`   | `number \| undefined`     | Unix timestamp (ms) when the job started running   |
| `completedAt` | `number \| undefined`     | Unix timestamp (ms) when the job finished          |

### `JobStatus`

| Value         | Description                   |
| ------------- | ----------------------------- |
| `"pending"`   | Waiting in the queue          |
| `"running"`   | Currently executing           |
| `"completed"` | Finished successfully         |
| `"failed"`    | Threw an error                |
| `"timeout"`   | Exceeded its timeout duration |

---

## Events

| Event       | Payload  | When                                     |
| ----------- | -------- | ---------------------------------------- |
| `completed` | `Job<T>` | A job finished successfully              |
| `failed`    | `Job<T>` | A job threw an error                     |
| `timeout`   | `Job<T>` | A job exceeded its timeout               |
| `idle`      | none     | The queue is empty and all jobs are done |
```typescript
queue.on('completed', (job) => {
  console.log(`✓ ${job.id} →`, job.result);
});

queue.on('failed', (job) => {
  console.error(`✗ ${job.id}`, job.error);
});

queue.on('timeout', (job) => {
  console.warn(`⏱ ${job.id} timed out after ${job.completedAt! - job.startedAt!}ms`);
});

queue.on('idle', () => {
  console.log('all done');
});
```

---

## Examples

### Concurrency control
```typescript
const queue = new Queue({ concurrency: 3 });

for (const url of urls) {
  queue.add({ run: () => fetch(url) });
}

await queue.onIdle();
```

### Job metadata
```typescript
const job = queue.add({
  run: async () => processOrder(order),
  meta: { orderId: order.id, userId: user.id }
});

queue.on('failed', (job) => {
  logger.error('job failed', job.meta); // { orderId: ..., userId: ... }
});
```

### Job timeouts
```typescript
const queue = new Queue({ concurrency: 5 });

queue.add({
  run: () => callExternalApi(),
  timeout: 3000 // cancel if it takes more than 3 seconds
});

queue.on('timeout', (job) => {
  console.warn(`job ${job.id} timed out`);
});
```

### Tracking job state
```typescript
const job = queue.add({ run: () => heavyWork() });

console.log(job.status); // 'pending'

await queue.onIdle();

console.log(job.status);  // 'completed'
console.log(job.result);  // return value of heavyWork()
console.log(job.completedAt - job.startedAt, 'ms');
```

### Custom job IDs
```typescript
queue.add({
  id: `order-${orderId}`,
  run: () => processOrder(orderId)
});

const job = queue.get(`order-${orderId}`);
```

---

## Benchmarks

phageq is benchmarked every cycle against p-queue and toad-scheduler.
Current standings at [phage.pw/leaderboard](https://phage.pw/leaderboard).

---

*Built by an agent. Seeded by a human.*