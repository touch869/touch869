// Regenerate static stat cards (card-stats.svg / card-langs.svg) for the profile README.
// Data comes live from the GitHub API so the committed SVGs are always accurate.
// Usage: GITHUB_TOKEN=xxx node scripts/update-cards.mjs
import { writeFileSync } from "node:fs";

const USER = "touch869";
const TOKEN = process.env.GITHUB_TOKEN;
const API = "https://api.github.com";

if (!TOKEN) throw new Error("GITHUB_TOKEN is required");
const headers = {
  Authorization: `Bearer ${TOKEN}`,
  Accept: "application/vnd.github+json",
  "User-Agent": "profile-card-updater",
};

async function j(path) {
  const r = await fetch(API + path, { headers });
  if (!r.ok) throw new Error(`${path} -> ${r.status}`);
  return r.json();
}

async function allRepos() {
  const out = [];
  for (let p = 1; p <= 3; p++) {
    const page = await j(`/users/${USER}/repos?per_page=100&page=${p}`);
    out.push(...page);
    if (page.length < 100) break;
  }
  return out;
}

const LANG_COLORS = {
  Java: "#b07219", Python: "#3572A5", JavaScript: "#f1e05a", TypeScript: "#3178c6",
  Go: "#00ADD8", Vue: "#41b883", HTML: "#e34c26", CSS: "#563d7c", "C++": "#f34b7d",
  C: "#555555", Shell: "#89e051", TeX: "#3D6117", Dockerfile: "#384d54",
  Jupyter: "#DA5B0B", Kotlin: "#A97BFF", Rust: "#dea584", "Objective-C": "#438eff",
};
const FALLBACK = ["#8957e5", "#1f6feb", "#238636", "#bf8700", "#da3633"];
const colorOf = (name, i) => LANG_COLORS[name] || FALLBACK[i % FALLBACK.length];

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function svgOpen(w, h, title) {
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(title)}">
  <style>
    .title { font: 600 16px 'Segoe UI', Ubuntu, Sans-Serif; fill: #e6edf3 }
    .label { font: 12px 'Segoe UI', Ubuntu, Sans-Serif; fill: #9198a1 }
    .value { font: 600 13px 'Segoe UI', Ubuntu, Sans-Serif; fill: #e6edf3 }
    .legend { font: 12px 'Segoe UI', Ubuntu, Sans-Serif; fill: #c9d1d9 }
  </style>
  <rect x="0.5" y="0.5" width="${w - 1}" height="${h - 1}" rx="6" fill="#0d1117" stroke="#30363d"/>`;
}

function renderStats(user, repos, stars) {
  const since = new Date(user.created_at).getUTCFullYear();
  const w = 460, h = 190;
  const items = [
    ["Public Repos", user.public_repos],
    ["Total Stars", stars],
    ["Followers", user.followers],
    [`Member Since`, since],
  ];
  let body = "";
  items.forEach(([label, value], i) => {
    const x = 45 + (i % 2) * 210, y = 85 + Math.floor(i / 2) * 55;
    body += `<circle cx="${x - 22}" cy="${y - 5}" r="4" fill="#1f6feb"/>
      <text x="${x}" y="${y}" class="label">${esc(label)}</text>
      <text x="${x}" y="${y + 22}" class="value" style="font-size:19px">${esc(value)}</text>`;
  });
  return svgOpen(w, h, "GitHub Stats") + `<text x="30" y="42" class="title">GitHub Stats</text>` + body + `</svg>\n`;
}

function renderLangs(langs) {
  const w = 460, h = 190;
  const total = Object.values(langs).reduce((a, b) => a + b, 0);
  const top = Object.entries(langs).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const segs = [];
  let x = 1;
  for (let i = 0; i < top.length; i++) {
    const [name, bytes] = top[i];
    const segW = (bytes / total) * (w - 2);
    segs.push(`<rect x="${x.toFixed(1)}" y="56" width="${segW.toFixed(1)}" height="8" rx="2" fill="${colorOf(name, i)}"/>`);
    x += segW;
  }
  let legend = "";
  top.forEach(([name, bytes], i) => {
    const cx = 34 + (i % 2) * 210, cy = 100 + Math.floor(i / 2) * 26;
    const pct = ((bytes / total) * 100).toFixed(1);
    legend += `<rect x="${cx - 16}" y="${cy - 10}" width="10" height="10" rx="2" fill="${colorOf(name, i)}"/>
      <text x="${cx}" y="${cy}" class="legend">${esc(name)}</text>
      <text x="${cx + 88}" y="${cy}" class="legend" style="fill:#9198a1">${pct}%</text>`;
  });
  return svgOpen(w, h, "Top Languages") + `<text x="30" y="42" class="title">Top Languages</text>` + segs.join("") + legend + `</svg>\n`;
}

// ---- main ----
const [user, repos] = await Promise.all([j(`/users/${USER}`), allRepos()]);
const stars = repos.reduce((a, r) => a + r.stargazers_count, 0);

const langBytes = {};
const results = await Promise.allSettled(repos.map((r) => j(`/repos/${r.full_name}/languages`)));
for (const res of results) {
  if (res.status === "fulfilled") {
    for (const [lang, bytes] of Object.entries(res.value)) langBytes[lang] = (langBytes[lang] || 0) + bytes;
  }
}
if (!Object.keys(langBytes).length) throw new Error("no language data collected");

writeFileSync("card-stats.svg", renderStats(user, repos, stars));
writeFileSync("card-langs.svg", renderLangs(langBytes));
console.log(`cards updated: ${user.public_repos} repos, ${stars} stars, ${Object.keys(langBytes).length} languages`);
