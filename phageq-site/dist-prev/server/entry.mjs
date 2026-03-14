import { renderers } from './renderers.mjs';
import { c as createExports, s as serverEntrypointModule } from './chunks/_@astrojs-ssr-adapter_D59i4n9F.mjs';
import { manifest } from './manifest_Qm4I-12I.mjs';

const serverIslandMap = new Map();;

const _page0 = () => import('./pages/_image.astro.mjs');
const _page1 = () => import('./pages/about.astro.mjs');
const _page2 = () => import('./pages/api/rebuild.astro.mjs');
const _page3 = () => import('./pages/cycles/_slug_.astro.mjs');
const _page4 = () => import('./pages/cycles.astro.mjs');
const _page5 = () => import('./pages/leaderboard.astro.mjs');
const _page6 = () => import('./pages/source.astro.mjs');
const _page7 = () => import('./pages/index.astro.mjs');
const pageMap = new Map([
    ["node_modules/astro/dist/assets/endpoint/node.js", _page0],
    ["src/pages/about.astro", _page1],
    ["src/pages/api/rebuild.ts", _page2],
    ["src/pages/cycles/[slug].astro", _page3],
    ["src/pages/cycles/index.astro", _page4],
    ["src/pages/leaderboard.astro", _page5],
    ["src/pages/source.astro", _page6],
    ["src/pages/index.astro", _page7]
]);

const _manifest = Object.assign(manifest, {
    pageMap,
    serverIslandMap,
    renderers,
    actions: () => import('./noop-entrypoint.mjs'),
    middleware: () => import('./_noop-middleware.mjs')
});
const _args = {
    "mode": "standalone",
    "client": "file:///var/www/phageq/phageq-site/dist-next/client/",
    "server": "file:///var/www/phageq/phageq-site/dist-next/server/",
    "host": false,
    "port": 4321,
    "assets": "_astro",
    "experimentalStaticHeaders": false
};
const _exports = createExports(_manifest, _args);
const handler = _exports['handler'];
const startServer = _exports['startServer'];
const options = _exports['options'];
const _start = 'start';
if (Object.prototype.hasOwnProperty.call(serverEntrypointModule, _start)) {
	serverEntrypointModule[_start](_manifest, _args);
}

export { handler, options, pageMap, startServer };
