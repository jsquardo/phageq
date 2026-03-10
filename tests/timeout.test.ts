import { Queue, TimeoutPolicy } from '../src/index.js';

describe('Job Timeout', () => {
  test('job completes before timeout', async () => {
    const queue = new Queue({ concurrency: 1 });
    
    const job = queue.add({
      run: async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
        return 'success';
      },
      timeout: { timeoutMs: 100 }
    });

    await queue.onIdle();
    
    expect(job.status).toBe('completed');
    expect(job.result).toBe('success');
    expect(job.timedOut).toBeUndefined();
  });

  test('job times out when exceeding timeout', async () => {
    const queue = new Queue({ concurrency: 1 });
    let timeoutEventFired = false;
    
    queue.on('timeout', (job) => {
      timeoutEventFired = true;
      expect(job.status).toBe('timeout');
      expect(job.timedOut).toBe(true);
      expect(job.error?.message).toContain('timed out');
    });
    
    const job = queue.add({
      run: async () => {
        await new Promise(resolve => setTimeout(resolve, 200));
        return 'should not complete';
      },
      timeout: { timeoutMs: 50 }
    });

    await queue.onIdle();
    
    expect(job.status).toBe('timeout');
    expect(job.timedOut).toBe(true);
    expect(job.error?.message).toContain('timed out');
    expect(job.result).toBeUndefined();
    expect(timeoutEventFired).toBe(true);
  });

  test('uses default timeout from queue options', async () => {
    const queue = new Queue({ 
      concurrency: 1,
      defaultTimeout: { timeoutMs: 50 }
    });
    
    const job = queue.add({
      run: async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return 'should timeout';
      }
    });

    await queue.onIdle();
    
    expect(job.status).toBe('timeout');
    expect(job.timedOut).toBe(true);
  });

  test('job-level timeout overrides queue default', async () => {
    const queue = new Queue({ 
      concurrency: 1,
      defaultTimeout: { timeoutMs: 50 }
    });
    
    const job = queue.add({
      run: async () => {
        await new Promise(resolve => setTimeout(resolve, 75));
        return 'success';
      },
      timeout: { timeoutMs: 100 } // Override with longer timeout
    });

    await queue.onIdle();
    
    expect(job.status).toBe('completed');
    expect(job.result).toBe('success');
    expect(job.timedOut).toBeUndefined();
  });

  test('no timeout when not configured', async () => {
    const queue = new Queue({ concurrency: 1 });
    
    const job = queue.add({
      run: async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return 'success';
      }
      // No timeout configured
    });

    await queue.onIdle();
    
    expect(job.status).toBe('completed');
    expect(job.result).toBe('success');
    expect(job.timedOut).toBeUndefined();
  });

  test('timeout works with multiple concurrent jobs', async () => {
    const queue = new Queue({ concurrency: 3 });
    
    const jobs = [
      queue.add({
        run: async () => {
          await new Promise(resolve => setTimeout(resolve, 25));
          return 'fast';
        },
        timeout: { timeoutMs: 50 }
      }),
      queue.add({
        run: async () => {
          await new Promise(resolve => setTimeout(resolve, 100));
          return 'slow';
        },
        timeout: { timeoutMs: 50 }
      }),
      queue.add({
        run: async () => {
          await new Promise(resolve => setTimeout(resolve, 75));
          return 'medium';
        },
        timeout: { timeoutMs: 100 }
      })
    ];

    await queue.onIdle();
    
    expect(jobs[0].status).toBe('completed');
    expect(jobs[0].result).toBe('fast');
    
    expect(jobs[1].status).toBe('timeout');
    expect(jobs[1].timedOut).toBe(true);
    
    expect(jobs[2].status).toBe('completed');
    expect(jobs[2].result).toBe('medium');
  });

  test('timeout cleans up properly', async () => {
    const queue = new Queue({ concurrency: 1 });
    
    // Add a job that completes normally
    const job1 = queue.add({
      run: async () => {
        await new Promise(resolve => setTimeout(resolve, 25));
        return 'success';
      },
      timeout: { timeoutMs: 100 }
    });
    
    // Add a job that times out
    const job2 = queue.add({
      run: async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return 'should timeout';
      },
      timeout: { timeoutMs: 50 }
    });

    await queue.onIdle();
    
    expect(job1.status).toBe('completed');
    expect(job2.status).toBe('timeout');
    
    // Queue should be properly idle
    expect(queue.activeCount).toBe(0);
    expect(queue.pendingCount).toBe(0);
  });

  test('job failure before timeout is handled correctly', async () => {
    const queue = new Queue({ concurrency: 1 });
    
    const job = queue.add({
      run: async () => {
        await new Promise(resolve => setTimeout(resolve, 25));
        throw new Error('Job failed');
      },
      timeout: { timeoutMs: 100 }
    });

    await queue.onIdle();
    
    expect(job.status).toBe('failed');
    expect(job.error?.message).toBe('Job failed');
    expect(job.timedOut).toBeUndefined();
  });
});