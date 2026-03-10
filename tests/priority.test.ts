import { Queue } from '../src/index';

describe('Priority Queue', () => {
  test('executes higher priority jobs first', async () => {
    const queue = new Queue({ concurrency: 1 });
    const results: string[] = [];

    // Add jobs in reverse priority order
    queue.add({ run: async () => results.push('low'), priority: 1 });
    queue.add({ run: async () => results.push('high'), priority: 10 });
    queue.add({ run: async () => results.push('medium'), priority: 5 });

    await queue.onIdle();
    expect(results).toEqual(['high', 'medium', 'low']);
  });

  test('jobs with same priority execute in FIFO order', async () => {
    const queue = new Queue({ concurrency: 1 });
    const results: string[] = [];

    queue.add({ run: async () => results.push('first'), priority: 5 });
    queue.add({ run: async () => results.push('second'), priority: 5 });
    queue.add({ run: async () => results.push('third'), priority: 5 });

    await queue.onIdle();
    expect(results).toEqual(['first', 'second', 'third']);
  });

  test('default priority is 0', async () => {
    const queue = new Queue({ concurrency: 1 });
    const results: string[] = [];

    queue.add({ run: async () => results.push('no-priority') });
    queue.add({ run: async () => results.push('high'), priority: 1 });

    await queue.onIdle();
    expect(results).toEqual(['high', 'no-priority']);
  });

  test('priority field is included in job object', () => {
    const queue = new Queue();
    
    const job1 = queue.add({ run: async () => 'test' });
    const job2 = queue.add({ run: async () => 'test', priority: 5 });
    
    expect(job1.priority).toBe(0);
    expect(job2.priority).toBe(5);
  });

  test('negative priorities work correctly', async () => {
    const queue = new Queue({ concurrency: 1 });
    const results: string[] = [];

    queue.add({ run: async () => results.push('negative'), priority: -1 });
    queue.add({ run: async () => results.push('zero') }); // priority: 0
    queue.add({ run: async () => results.push('positive'), priority: 1 });

    await queue.onIdle();
    expect(results).toEqual(['positive', 'zero', 'negative']);
  });

  test('priority ordering works with high concurrency', async () => {
    const queue = new Queue({ concurrency: 10 });
    const startTimes: Record<string, number> = {};
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    // Add many jobs with different priorities
    // Use delays to ensure they don't all start simultaneously
    for (let i = 1; i <= 5; i++) {
      queue.add({
        run: async () => {
          startTimes[`priority-${i}`] = Date.now();
          await delay(10);
        },
        priority: i
      });
    }

    await queue.onIdle();

    // Higher priority jobs should start before lower priority ones
    expect(startTimes['priority-5']).toBeLessThanOrEqual(startTimes['priority-1']);
    expect(startTimes['priority-4']).toBeLessThanOrEqual(startTimes['priority-1']);
  });
});
