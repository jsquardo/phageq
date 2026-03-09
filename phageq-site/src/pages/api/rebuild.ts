import type { APIRoute } from 'astro';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export const POST: APIRoute = async ({ request }) => {
  const secret = process.env.PHAGE_WEBHOOK_SECRET;
  if (secret && request.headers.get('x-phage-secret') !== secret) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }
  const body = await request.json().catch(() => ({}));
  execAsync('npm run rebuild', { cwd: process.cwd() }).catch(console.error);
  return new Response(JSON.stringify({ ok: true, cycle: body?.cycle }), { status: 200, headers: { 'Content-Type': 'application/json' } });
};
