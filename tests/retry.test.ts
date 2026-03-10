import { Queue, JobDefinition, RetryPolicy } from '../src/index.js';

describe('Retry Logic', () => {
  let queue: Queue;
  
  beforeEach(() => {
    queue = new Queue({ concurrency: 1 });
  });

  test('job succeeds without retry when no error occurs', async () => {
    const job = queue.add({
      run: async () => 'success',
      retry: { attempts: 3 }
    });

    await queue.onIdle();
    expect(job.status).toBe('completed');
    expect(job.attempts).toBe(1);
    expect(job.result).toBe('success');
  });

  test('job fails immediately when retry attempts is 0', async () => {
    let callCount = 0;
    const job = queue.add({
      run: async () => {
        callCount++;
        throw new Error('always fails');
      },
      retry: { attempts: 0 }
    });

    await queue.onIdle();
    expect(job.status).toBe('failed');
    expect(job.attempts).toBe(1);
    expect(callCount).toBe(1);
    expect(job.error?.message).toBe('always fails');
  });

  test('job retries up to max attempts then fails', async () => {
    let callCount = 0;
    const job = queue.add({
      run: async () => {
        callCount++;
        throw new Error('always fails');
      },
      retry: { attempts: 2, delay: 10 }
    });

    await queue.onIdle();
    expect(job.status).toBe('failed');
    expect(job.attempts).toBe(3); // 1 initial + 2 retries
    expect(callCount).toBe(3);
    expect(job.maxAttempts).toBe(2);
  });

  test('job succeeds after retries', async () => {
    let callCount = 0;
    const job = queue.add({
      run: async () => {
        callCount++;
        if (callCount < 3) {
          throw new Error('fails first two times');
        }
        return 'success on third try';
      },
      retry: { attempts: 3, delay: 10 }
    });

    await queue.onIdle();
    expect(job.status).toBe('completed');
    expect(job.attempts).toBe(3);
    expect(callCount).toBe(3);
    expect(job.result).toBe('success on third try');
  });

  test('exponential backoff calculates correct delays', async () => {
    const delays: number[] = [];
    const originalSetTimeout = global.setTimeout;
    
    global.setTimeout = jest.fn((callback, delay) => {
      delays.push(delay as number);
      return originalSetTimeout(callback, 1); // Execute immediately for test
    }) as any;

    let callCount = 0;
    queue.add({
      run: async () => {
        callCount++;
        throw new Error('always fails');
      },
      retry: { 
        attempts: 3, 
        delay: 100, 
        backoffMultiplier: 2 
      }
    });

    await queue.onIdle();
    
    global.setTimeout = originalSetTimeout;
    
    expect(delays).toEqual([100, 200, 400]); // 100 * 2^0, 100 * 2^1, 100 * 2^2
    expect(callCount).toBe(4); // 1 initial + 3 retries
  });

  test('max delay caps exponential backoff', async () => {
    const delays: number[] = [];
    const originalSetTimeout = global.setTimeout;
    
    global.setTimeout = jest.fn((callback, delay) => {
      delays.push(delay as number);
      return originalSetTimeout(callback, 1);
    }) as any;

    queue.add({
      run: async () => { throw new Error('fails'); },
      retry: { 
        attempts: 3, 
        delay: 1000, 
        backoffMultiplier: 10,
        maxDelay: 2000
      }
    });

    await queue.onIdle();
    global.setTimeout = originalSetTimeout;
    
    expect(delays).toEqual([1000, 2000, 2000]); // Third delay capped at maxDelay
  });

  test('custom shouldRetry function controls retry behavior', async () => {
    let callCount = 0;
    const job = queue.add({
      run: async () => {
        callCount++;
        if (callCount === 1) throw new Error('RETRY_ME');
        if (callCount === 2) throw new Error('DONT_RETRY');
        return 'should not reach here';
      },
      retry: {
        attempts: 5,
        delay: 10,
        shouldRetry: (error: Error) => error.message === 'RETRY_ME'
      }
    });

    await queue.onIdle();
    expect(job.status).toBe('failed');
    expect(job.attempts).toBe(2); // First attempt + one retry
    expect(callCount).toBe(2);
    expect(job.error?.message).toBe('DONT_RETRY');
  });

  test('retry event is emitted with job and delay', async () => {
    const retryEvents: Array<{ job: any, delay: number }> = [];
    queue.on('retry', (job, delay) => {
      retryEvents.push({ job, delay });
    });

    const job = queue.add({
      run: async () => { throw new Error('fails'); },
      retry: { attempts: 2, delay: 50 }
    });

    await queue.onIdle();
    
    expect(retryEvents).toHaveLength(2);
    expect(retryEvents[0].job.id).toBe(job.id);
    expect(retryEvents[0].delay).toBe(50);
    expect(retryEvents[1].delay).toBe(100); // 50 * 2^1
  });

  test('default retry policy from queue options', async () => {
    const queueWithDefaults = new Queue({
      concurrency: 1,
      defaultRetry: { attempts: 2, delay: 25 }
    });

    let callCount = 0;
    const job = queueWithDefaults.add({
      run: async () => {
        callCount++;
        throw new Error('always fails');
      }
      // No retry specified - should use defaults
    });

    await queueWithDefaults.onIdle();
    expect(job.attempts).toBe(3); // 1 initial + 2 retries from default
    expect(callCount).toBe(3);
    expect(job.maxAttempts).toBe(2);
  });

  test('job-level retry policy overrides queue defaults', async () => {
    const queueWithDefaults = new Queue({
      concurrency: 1,
      defaultRetry: { attempts: 5, delay: 100 }
    });

    let callCount = 0;
    const job = queueWithDefaults.add({
      run: async () => {
        callCount++;
        throw new Error('always fails');
      },
      retry: { attempts: 1, delay: 10 } // Override defaults
    });

    await queueWithDefaults.onIdle();
    expect(job.attempts).toBe(2); // 1 initial + 1 retry (not 5)
    expect(callCount).toBe(2);
    expect(job.maxAttempts).toBe(1);
  });

  test('retry works with high concurrency', async () => {
    const highConcurrencyQueue = new Queue({ concurrency: 10 });
    const jobs = [];
    
    for (let i = 0; i < 20; i++) {
      let callCount = 0;
      const job = highConcurrencyQueue.add({
        id: `job-${i}`,
        run: async () => {
          callCount++;
          if (callCount < 2) throw new Error('fail once');
          return `success-${i}`;
        },
        retry: { attempts: 2, delay: 5 }
      });
      jobs.push(job);
    }

    await highConcurrencyQueue.onIdle();
    
    jobs.forEach((job, i) => {
      expect(job.status).toBe('completed');
      expect(job.attempts).toBe(2);
      expect(job.result).toBe(`success-${i}`);
    });
  });
});