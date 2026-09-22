import fs from "node:fs";
import path from "node:path";

const techMdPath = "C:\\Users\\austi\\.gemini\\antigravity\\brain\\a4ff7db8-8690-4e52-89b3-a3bd2b00aa3d\\technical_whitepaper.md";
const famMdPath = "C:\\Users\\austi\\.gemini\\antigravity\\brain\\a4ff7db8-8690-4e52-89b3-a3bd2b00aa3d\\friends_and_family_whitepage.md";

const techMd = fs.readFileSync(techMdPath, "utf8");
const famMd = fs.readFileSync(famMdPath, "utf8");

// Save to docs/
fs.writeFileSync("docs/REELOS-TECHNICAL-WHITEPAPER.md", techMd, "utf8");
fs.writeFileSync("docs/REELOS-FOR-FRIENDS-AND-FAMILY.md", famMd, "utf8");

function mdToHtml(md, title) {
  const bodyContent = md
    .replace(/^# (.*$)/gim, '<h1 class="text-3xl sm:text-4xl font-extrabold text-amber-400 tracking-tight mb-4">$1</h1>')
    .replace(/^## (.*$)/gim, '<h2 class="text-xl sm:text-2xl font-bold text-white border-b border-white/10 pb-2 mt-8 mb-4">$1</h2>')
    .replace(/^### (.*$)/gim, '<h3 class="text-lg sm:text-xl font-semibold text-amber-300 mt-6 mb-2">$1</h3>')
    .replace(/^> (.*$)/gim, '<blockquote class="border-l-4 border-amber-400/60 pl-4 italic text-zinc-300 my-4 py-1.5 bg-white/5 rounded-r-lg">$1</blockquote>')
    .replace(/\*\*(.*?)\*\*/gim, '<strong class="text-white font-bold">$1</strong>')
    .replace(/\*(.*?)\*/gim, '<em class="text-zinc-200">$1</em>')
    .replace(/```([\s\S]*?)```/gim, '<pre class="bg-zinc-950 p-4 rounded-xl border border-white/10 font-mono text-xs sm:text-sm text-zinc-300 overflow-x-auto my-4"><code>$1</code></pre>')
    .replace(/`([^`]+)`/gim, '<code class="bg-zinc-800 text-amber-400 px-1.5 py-0.5 rounded font-mono text-xs">$1</code>')
    .replace(/^\* (.*$)/gim, '<li class="ml-6 list-disc text-zinc-300 my-1">$1</li>')
    .replace(/^- (.*$)/gim, '<li class="ml-6 list-disc text-zinc-300 my-1">$1</li>')
    .replace(/(\n\s*){2,}/g, '</p><p class="text-zinc-300 leading-relaxed my-3">');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    body { background-color: #0b0a08; color: #d4d4d8; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
  </style>
</head>
<body class="p-4 sm:p-8 md:p-12 lg:p-16 max-w-4xl mx-auto selection:bg-amber-400 selection:text-black">
  <div class="bg-zinc-900/80 border border-white/10 rounded-3xl p-6 sm:p-10 md:p-14 shadow-2xl backdrop-blur-xl">
    ${bodyContent}
  </div>
</body>
</html>`;
}

const techHtml = mdToHtml(techMd, "ReelOS Technical Whitepaper");
const famHtml = mdToHtml(famMd, "The Impossible Cinema - ReelOS Guide for Friends & Family");

const dests = [
  "C:\\Users\\austi\\Desktop",
  "C:\\Users\\austi\\OneDrive\\ReelOS_Installers",
];

for (const folder of dests) {
  if (fs.existsSync(folder)) {
    fs.writeFileSync(path.join(folder, "ReelOS_Technical_Whitepaper.md"), techMd, "utf8");
    fs.writeFileSync(path.join(folder, "ReelOS_Technical_Whitepaper.html"), techHtml, "utf8");
    fs.writeFileSync(path.join(folder, "ReelOS_Friends_And_Family.md"), famMd, "utf8");
    fs.writeFileSync(path.join(folder, "ReelOS_Friends_And_Family.html"), famHtml, "utf8");
    console.log("Successfully exported whitepapers to:", folder);
  }
}
