import { Queue } from '../src/index.js';

describe('Queue timeout support', () => {
  test('jobs complete normally without timeout', async () => {
    const queue = new Queue({ concurrency: 1 });
    
    const job = queue.add({
      run: async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
        return 'completed';
      },
      timeout: { timeoutMs: 100 }
    });
    
    await queue.onIdle();
    
    expect(job.status).toBe('completed');
    expect(job.result).toBe('completed');
    expect(job.timedOut).toBeUndefined();
  });
  
  test('jobs timeout when exceeding duration', async () => {
    const queue = new Queue({ concurrency: 1 });
    let timeoutEmitted = false;
    
    queue.on('timeout', () => {
      timeoutEmitted = true;
    });
    
    const job = queue.add({
      run: async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return 'should not complete';
      },
      timeout: { timeoutMs: 50 }
    });
    
    await queue.onIdle();
    
    expect(job.status).toBe('timeout');
    expect(job.timedOut).toBe(true);
    expect(job.error?.message).toContain('timed out');
    expect(job.result).toBeUndefined();
    expect(timeoutEmitted).toBe(true);
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
    expect(job.timeout?.timeoutMs).toBe(50);
  });
  
  test('job-level timeout overrides default timeout', async () => {
    const queue = new Queue({ 
      concurrency: 1,
      defaultTimeout: { timeoutMs: 200 }
    });
    
    const job = queue.add({
      run: async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return 'should timeout';
      },
      timeout: { timeoutMs: 50 } // Override default
    });
    
    await queue.onIdle();
    
    expect(job.status).toBe('timeout');
    expect(job.timeout?.timeoutMs).toBe(50); // Uses job-level timeout
  });
  
  test('handles multiple concurrent timeouts', async () => {
    const queue = new Queue({ concurrency: 3 });
    const results: string[] = [];
    
    // Add jobs with different timeout behaviors
    queue.add({
      run: async () => {
        await new Promise(resolve => setTimeout(resolve, 30));
        results.push('fast');
        return 'fast';
      },
      timeout: { timeoutMs: 100 }
    });
    
    queue.add({
      run: async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        results.push('slow');
        return 'slow';
      },
      timeout: { timeoutMs: 50 } // Will timeout
    });
    
    queue.add({
      run: async () => {
        await new Promise(resolve => setTimeout(resolve, 40));
        results.push('medium');
        return 'medium';
      },
      timeout: { timeoutMs: 100 }
    });
    
    await queue.onIdle();
    
    expect(results).toEqual(['fast', 'medium']);
    expect(queue.get('job_2')?.status).toBe('timeout');
  });
  
  test('cleans up timeout handles properly', async () => {
    const queue = new Queue({ concurrency: 1 });
    
    // Job that completes before timeout
    const job1 = queue.add({
      run: async () => {
        await new Promise(resolve => setTimeout(resolve, 30));
        return 'completed';
      },
      timeout: { timeoutMs: 100 }
    });
    
    // Job that times out
    const job2 = queue.add({
      run: async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return 'timeout';
      },
      timeout: { timeoutMs: 50 }
    });
    
    await queue.onIdle();
    
    expect(job1.status).toBe('completed');
    expect(job2.status).toBe('timeout');
    
    // If cleanup works properly, no additional timeouts should fire
    // This is more of a memory leak test than functional test
    await new Promise(resolve => setTimeout(resolve, 200));
  });
});