import { exec } from 'child_process';
import { promisify } from 'util';
export { renderers } from '../../renderers.mjs';

const execAsync = promisify(exec);
const POST = async ({ request }) => {
  const secret = process.env.PHAGE_WEBHOOK_SECRET;
  if (secret && request.headers.get("x-phage-secret") !== secret) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }
  const body = await request.json().catch(() => ({}));
  execAsync("bash /var/www/phageq/phageq-site/rebuild.sh", {
    cwd: "/var/www/phageq/phageq-site"
  }).catch(console.error);
  return new Response(JSON.stringify({ ok: true, cycle: body?.cycle }), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
};

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  POST
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
