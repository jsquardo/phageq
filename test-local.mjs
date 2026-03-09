/**
 * test-local.mjs
 * Run with: node test-local.mjs
 * No ts-node needed!
 */

import { codeToHtml } from 'shiki';

// ─── Shared phageq theme ──────────────────────────────────────────────────────

const phageqTheme = {
  name: 'phageq',
  type: 'dark',
  colors: {
    'editor.background': '#0D1F1A',
    'editor.foreground': '#9ECFBE',
  },
  tokenColors: [
    { scope: ['comment', 'punctuation.definition.comment'], settings: { foreground: '#2E5A46' } },
    { scope: ['keyword', 'storage.type', 'storage.modifier'], settings: { foreground: '#00C896' } },
    { scope: ['keyword.operator'], settings: { foreground: '#4DDFB2' } },
    { scope: ['entity.name.type', 'entity.name.class', 'support.type'], settings: { foreground: '#7FFFD4' } },
    { scope: ['entity.name.function', 'support.function', 'meta.function-call'], settings: { foreground: '#00E5A8' } },
    { scope: ['variable', 'variable.other'], settings: { foreground: '#9ECFBE' } },
    { scope: ['string', 'string.quoted'], settings: { foreground: '#4DDFB2' } },
    { scope: ['constant.numeric', 'constant.language'], settings: { foreground: '#7FFFD4' } },
    { scope: ['punctuation', 'meta.brace'], settings: { foreground: '#3A6B55' } },
    { scope: ['support.type.primitive'], settings: { foreground: '#00C896' } },
  ],
};

// ─── renderMarkdown (matches [slug].astro exactly) ────────────────────────────

async function renderMarkdown(md) {
  const highlightedBlocks = [];
  const blockMatches = [...md.matchAll(/```(\w*)\n([\s\S]*?)```/g)];

  for (const match of blockMatches) {
    const lang = match[1] || 'typescript';
    const code = match[2];
    try {
      const highlighted = await codeToHtml(code, { lang, theme: phageqTheme });
      highlightedBlocks.push('<div class="code-block">' + highlighted + '</div>');
    } catch {
      const escaped = code
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      highlightedBlocks.push('<div class="code-block"><pre><code>' + escaped + '</code></pre></div>');
    }
  }

  let blockIdx = 0;
  const withPlaceholders = md.replace(/```(\w*)\n([\s\S]*?)```/g, function() {
    return '\n\nCODE_BLOCK_PLACEHOLDER_' + (blockIdx++) + '\n\n';
  });

  blockIdx = 0;
  return withPlaceholders
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .split('\n\n')
    .map(function(p) {
      const trimmed = p.trim();
      if (!trimmed) return '';
      if (trimmed.startsWith('CODE_BLOCK_PLACEHOLDER_')) {
        const idx = parseInt(trimmed.replace('CODE_BLOCK_PLACEHOLDER_', ''));
        return highlightedBlocks[idx] || '';
      }
      if (trimmed.startsWith('<h') || trimmed.startsWith('<pre') || trimmed.startsWith('<div')) return trimmed;
      return '<p>' + trimmed.replace(/\n/g, ' ') + '</p>';
    })
    .join('\n');
}

// ─── Test fixtures ────────────────────────────────────────────────────────────

// Mirrors the exact problematic structure from cycle-001
const fakeCyclePost = `**What I did:** Added priority queue support using a min-heap.

**Why:** The benchmark showed p-queue beating us on latency_sensitive by 12%.

**What I built:** Replaced the pending array with a binary min-heap keyed on priority.

\`\`\`typescript
export interface JobDefinition<T = unknown> {
  id?: string;
  run: () => Promise<T>;
  priority?: number;
}
\`\`\`

**Result:** tests: 16/16 passing.

REVERTED: Tests failed. \`\`\`
> phageq@0.1.0 test
node:internal/modules/cjs/loader:1210 throw err;
Error: Cannot find module './run'
\`\`\`

**What I want to tackle next:** Retry the heap approach with a fixed import path.`;

const sampleTs = `import { EventEmitter } from "events";

export type JobStatus = "pending" | "running" | "completed" | "failed";

export class Queue extends EventEmitter {
  private running = 0;

  constructor(private concurrency = 1) {
    super();
  }

  // Add a job and return its id
  add(run) {
    const id = "job_" + Date.now();
    this.emit("queued", id);
    return id;
  }
}`;

// ─── Run tests ────────────────────────────────────────────────────────────────

async function runTests() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  TEST 1: renderMarkdown — code block handling');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const html = await renderMarkdown(fakeCyclePost);

  const pass = (label, val) => console.log('  ' + (val ? '✅' : '❌') + ' ' + label + ': ' + (val ? 'PASS' : 'FAIL'));

  pass('No leaked backticks',   !html.includes('```'));
  pass('Code blocks rendered',  html.includes('class="code-block"'));
  pass('Shiki highlighted',     html.includes('class="shiki"'));
  pass('Paragraphs rendered',   html.includes('<p>'));
  pass('Strong tags rendered',  html.includes('<strong>'));

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  TEST 2: Shiki — syntax highlighting');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  try {
    const highlighted = await codeToHtml(sampleTs, {
      lang: 'typescript',
      theme: phageqTheme,
    });

    pass('Shiki output produced', highlighted.includes('class="shiki"'));
    pass('Colors applied',        highlighted.includes('color:'));
    pass('Pre tag present',       highlighted.includes('<pre'));
    pass('Code tag present',      highlighted.includes('<code'));

    console.log('\n  First 200 chars of Shiki output:');
    console.log('  ' + highlighted.slice(0, 200) + '...');
  } catch (err) {
    console.log('  ❌ Shiki threw an error:', err.message);
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  Writing preview to test-output.html ...');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Write a full HTML preview you can open in a browser
  const { writeFileSync } = await import('fs');
  const preview = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>phageq render test</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #060E0B; color: #9ECFBE; font-family: 'DM Mono', monospace; padding: 40px; max-width: 760px; margin: 0 auto; font-size: 14px; line-height: 1.8; }
    h1 { color: #00C896; font-size: 1.4rem; margin-bottom: 32px; letter-spacing: 0.1em; }
    h2 { font-size: 0.72rem; letter-spacing: 0.2em; text-transform: uppercase; color: #3a6b55; margin: 32px 0 12px; font-weight: 400; }
    p { margin-bottom: 16px; color: #7ab89a; }
    strong { color: #e8fff7; font-weight: 500; }
    code { background: #0D1F1A; border: 1px solid #1a3d2e; border-radius: 3px; padding: 1px 6px; font-size: 0.82em; color: #7FFFD4; }
    .code-block { margin: 20px 0; border: 1px solid #1a3d2e; border-radius: 8px; overflow: hidden; }
    .code-block pre { margin: 0 !important; padding: 20px !important; overflow-x: auto; font-size: 0.8rem; line-height: 1.6; }
    .code-block code { background: none !important; border: none !important; padding: 0 !important; color: inherit !important; }
    .divider { border: none; border-top: 1px solid #1a3d2e; margin: 40px 0; }
  </style>
</head>
<body>
  <h1>🧬 phageq render test</h1>
  <h2>Test 1 — renderMarkdown output</h2>
  ${html}
  <hr class="divider" />
  <h2>Test 2 — raw Shiki highlight</h2>
  <div class="code-block">${await codeToHtml(sampleTs, { lang: 'typescript', theme: phageqTheme })}</div>
</body>
</html>`;

  writeFileSync('test-output.html', preview);
  console.log('  ✅ Opened test-output.html in your browser to visually verify!\n');
  console.log('  Run: open test-output.html\n');
}

runTests().catch(console.error);
