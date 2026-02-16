import fs from 'node:fs';
import path from 'node:path';

function normUrl(u) {
  if (!u) return '';
  // remove trailing slash
  return u.endsWith('/') ? u.slice(0, -1) : u;
}

const candidates = [
  process.env.NEXT_PUBLIC_APP_URL,
  process.env.PUBLIC_WEBAPP_URL,
  process.env.CF_PAGES_URL,
  process.env.CLOUDFLARE_PAGES_URL,
];

const appUrl = normUrl(candidates.find(Boolean) || 'http://localhost:3000');
const name = process.env.NEXT_PUBLIC_APP_NAME || 'Casino Rooms';
const iconUrl = `${appUrl}/icon.svg`;

const manifest = { url: appUrl, name, iconUrl };

const out = path.join(process.cwd(), 'public', 'tonconnect-manifest.json');
fs.writeFileSync(out, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
console.log('[prepare-manifest] wrote', out, manifest);
