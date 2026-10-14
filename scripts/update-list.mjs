import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const root = new URL('../public/data/', import.meta.url);
const repository = 'MetaMask/eth-phishing-detect';
async function get(url, json = false) {
  const response = await fetch(url, { headers: { 'User-Agent': 'KeyHarbour-data-refresh' }, signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`Dataset request failed: HTTP ${response.status}`);
  return json ? response.json() : response.text();
}
const commits = await get(`https://api.github.com/repos/${repository}/commits?path=src/config.json&per_page=1`, true);
const revision = commits[0]?.sha;
if (!/^[a-f0-9]{40}$/.test(revision || '')) throw new Error('Missing upstream revision');
const raw = await get(`https://raw.githubusercontent.com/${repository}/${revision}/src/config.json`);
const data = JSON.parse(raw);
const domains = data.blacklist ?? data.blocklist;
if (!Array.isArray(domains) || domains.length < 1000 || !domains.every(x => typeof x === 'string' && x.length < 2048 && !/\s/.test(x))) {
  throw new Error('Upstream domain list failed validation');
}
const licence = await get(`https://raw.githubusercontent.com/${repository}/${revision}/LICENSE`);
const fetchedAt = new Date().toISOString();
const snapshot = {
  source: `https://github.com/${repository}`, revision, fetchedAt,
  upstreamUpdatedAt: commits[0].commit.committer.date,
  sha256: createHash('sha256').update(raw).digest('hex'),
  domains: [...new Set(domains.filter(x => !x.includes('/')).map(x => new URL(`https://${x}`).hostname.toLowerCase().replace(/\.$/, '')))].sort(),
  paths: domains.filter(x => x.includes('/')).map(x => { const u = new URL(`https://${x}`); return `${u.hostname}${u.pathname}`; }).sort()
};
await mkdir(root, { recursive: true });
await writeFile(new URL('phishing.json', root), JSON.stringify(snapshot));
await writeFile(new URL('metadata.json', root), JSON.stringify({ ...snapshot, domains: undefined, paths: undefined, count: snapshot.domains.length, pathCount: snapshot.paths.length }, null, 2) + '\n');
await writeFile(new URL('METAMASK-LICENSE.txt', root), licence);
console.log(`Saved ${snapshot.domains.length} domains from ${revision}, fetched ${fetchedAt}`);
