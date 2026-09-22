import fs from 'node:fs';
import path from 'node:path';

const srcMd = 'C:\\Users\\austi\\.gemini\\antigravity\\brain\\a4ff7db8-8690-4e52-89b3-a3bd2b00aa3d\\whitepaper.md';
const content = fs.readFileSync(srcMd, 'utf8');

const targets = [
  'C:\\Users\\austi\\Desktop\\ReelOS_Technical_Whitepaper.md',
  'C:\\Users\\austi\\Documents\\ReelOS_Technical_Whitepaper.md',
  'c:\\Users\\austi\\reelos\\docs\\WHITE-PAPER.md',
];

for (const t of targets) {
  const dir = path.dirname(t);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(t, content, 'utf8');
  console.log(`Wrote markdown to ${t}`);
}

// Generate self-contained publication HTML
function markdownToHtml(md) {
  // Simple markdown conversion with dark theme
  let html = md
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/gim, '<em>$1</em>')
    .replace(/```([\s\S]*?)```/gim, '<pre><code>$1</code></pre>')
    .replace(/`([^`]+)`/gim, '<code>$1</code>')
    .replace(/---/gim, '<hr/>')
    .replace(/\n\n/gim, '</p><p>');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>The ReelOS Journey: Technical White Paper</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      line-height: 1.68;
      color: #e4e4e7;
      background: #09090b;
      margin: 0;
      padding: 40px 20px;
    }
    .container {
      max-width: 880px;
      margin: 0 auto;
      background: #121215;
      border: 1px solid #27272a;
      border-radius: 20px;
      padding: 48px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);
    }
    h1 {
      color: #f5c518;
      font-size: 2.2rem;
      margin-top: 0;
      line-height: 1.25;
      font-weight: 800;
    }
    h2 {
      color: #fafafa;
      font-size: 1.45rem;
      margin-top: 2rem;
      border-bottom: 1px solid #27272a;
      padding-bottom: 8px;
      font-weight: 700;
    }
    h3 {
      color: #a1a1aa;
      font-size: 1.15rem;
      margin-top: 1.5rem;
      font-weight: 600;
    }
    p {
      margin-bottom: 1.25rem;
      color: #d4d4d8;
    }
    strong {
      color: #fafafa;
    }
    hr {
      border: none;
      border-top: 1px solid #27272a;
      margin: 32px 0;
    }
    code {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 0.9em;
      background: #18181b;
      color: #f5c518;
      padding: 2px 6px;
      border-radius: 6px;
      border: 1px solid #27272a;
    }
    pre {
      background: #09090b;
      border: 1px solid #27272a;
      border-radius: 12px;
      padding: 16px;
      overflow-x: auto;
      margin: 20px 0;
    }
    pre code {
      background: transparent;
      padding: 0;
      border: none;
      color: #38bdf8;
      font-size: 0.88rem;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 24px 0;
      font-size: 0.9rem;
    }
    th, td {
      border: 1px solid #27272a;
      padding: 10px 14px;
      text-align: left;
    }
    th {
      background: #18181b;
      color: #f5c518;
    }
    tr:nth-child(even) {
      background: #141418;
    }
  </style>
</head>
<body>
  <div class="container">
    ${html}
  </div>
</body>
</html>`;
}

const htmlContent = markdownToHtml(content);
const htmlTargets = [
  'C:\\Users\\austi\\Desktop\\ReelOS_Technical_Whitepaper.html',
  'c:\\Users\\austi\\reelos\\docs\\WHITE-PAPER.html',
];

for (const ht of htmlTargets) {
  fs.writeFileSync(ht, htmlContent, 'utf8');
  console.log(`Wrote publication HTML to ${ht}`);
}

console.log('All formats published cleanly!');
