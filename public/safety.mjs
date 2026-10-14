export const sources = {
  ledger: 'https://www.ledger.com/academy/hardwarewallet/best-practices-when-using-a-hardware-wallet',
  phishing: 'https://www.ledger.com/phishing-campaigns-status',
  revoke: 'https://revoke.cash/',
  list: 'https://github.com/MetaMask/eth-phishing-detect'
};

export const questions = [
  { id: 'phrase', group: 'Recovery phrase', title: 'Is your recovery phrase kept offline?', detail: 'Think paper or an offline physical backup, rather than a photo, email or cloud note. Do not enter the phrase here.', action: 'Keep your recovery phrase offline', guidance: 'If you have already uploaded or shared the phrase, treat it as exposed. Use the exposed-phrase emergency guide before making changes.', urgent: true, source: sources.ledger },
  { id: 'private', group: 'Recovery phrase', title: 'Has your phrase stayed completely private?', detail: 'Nobody, including support staff, should ask to see it. Answer “No” if you have shared it, typed it into a website or suspect somebody has it.', action: 'Deal with a possibly exposed phrase', guidance: 'An exposed phrase can give someone control of the wallet. Stop using it and follow the emergency route. Revoking approvals cannot make that phrase private again.', urgent: true, source: sources.phishing },
  { id: 'device', group: 'Wallet setup', title: 'Do you use a hardware wallet for long-term holdings?', detail: 'A hardware wallet keeps signing keys on a separate device. This check supports Ledger, Trezor and other devices; it does not inspect them.', action: 'Review how you store long-term holdings', guidance: 'Read the hardware-wallet security guidance and decide whether a hardware wallet fits your needs. It still cannot protect you from every approval or scam.', source: sources.ledger },
  { id: 'display', group: 'Before you approve', title: 'Do you check the destination on the device screen?', detail: 'Compare the full destination and the transaction details before approving. If you do not use a hardware wallet, choose “No” or “Not sure”.', action: 'Verify the full destination before approving', guidance: 'For a hardware wallet, compare the full address on its own display with your intended destination. Do not rely on a recent-transaction list or just the first and last characters.', source: sources.ledger },
  { id: 'signing', group: 'Before you approve', title: 'Do you decline requests you cannot understand?', detail: 'A signature or token approval can grant powerful permissions. A hardware wallet does not make an unclear request safe.', action: 'Pause before an unclear signature', guidance: 'Only sign requests you initiated and understand. If the wallet cannot explain the effect, stop rather than enabling blind signing to get past the warning.', source: sources.ledger },
  { id: 'approvals', group: 'Wallet permissions', title: 'Do you review old token approvals?', detail: 'An approval can remain active after you disconnect from a website. Choose “Not applicable” if you have never used apps that request token permissions.', action: 'Review permissions you no longer need', guidance: 'Use the official Revoke.cash site to inspect supported-chain approvals. Revocation needs an on-chain transaction and may cost gas. It does not recover stolen funds or fix an exposed phrase.', allowNA: true, source: sources.revoke },
  { id: 'links', group: 'Suspicious messages', title: 'Do you reach wallet support through official sites?', detail: 'Avoid unsolicited messages, search adverts and requests to “validate” your wallet. Open a known official site yourself.', action: 'Use official support routes', guidance: 'Bookmark your wallet maker’s official website. A support message asking for your recovery phrase or a transfer to a “safe wallet” is a reason to stop.', source: sources.phishing },
  { id: 'recovery', group: 'Recovery preparation', title: 'Do you have a recovery plan for a lost device?', detail: 'Know how to find your offline backup and the manufacturer’s official recovery instructions. Do not write backup locations or secret words in this app.', action: 'Prepare for a lost device', guidance: 'Review your wallet maker’s official recovery process before you need it. Keep recovery material private and physically secure. If you suspect the backup was exposed, use the exposed-phrase route instead.', source: sources.ledger }
];

export function sanitiseAnswers(input) {
  const output = {};
  if (!input || typeof input !== 'object' || Array.isArray(input)) return output;
  for (const q of questions) {
    const valid = q.allowNA ? ['yes', 'no', 'unsure', 'na'] : ['yes', 'no', 'unsure'];
    if (valid.includes(input[q.id])) output[q.id] = input[q.id];
  }
  return output;
}

export function assessment(input) {
  const answers = sanitiseAnswers(input);
  const answered = questions.filter(q => answers[q.id]);
  const applicable = questions.filter(q => answers[q.id] !== 'na');
  const gaps = questions.filter(q => answers[q.id] && !['yes', 'na'].includes(answers[q.id]))
    .sort((a, b) => Number(Boolean(b.urgent)) - Number(Boolean(a.urgent)));
  return { answered: answered.length, total: questions.length, applicable: applicable.length,
    inPlace: applicable.filter(q => answers[q.id] === 'yes').length,
    complete: answered.length === questions.length,
    urgent: ['phrase', 'private'].some(id => answers[id] === 'no' || answers[id] === 'unsure'), gaps };
}

export function parseWebsite(input) {
  if (typeof input !== 'string') throw new Error('Enter a website address.');
  const value = input.trim();
  if (!value || value.length > 2048 || /[\s\u0000-\u001f\u007f\\]/.test(value)) {
    throw new Error('Enter one website address, never a recovery phrase or private key.');
  }
  if (/^[a-z][a-z\d+.-]*:/i.test(value) && !/^https?:\/\//i.test(value)) {
    throw new Error('Use an https:// or http:// website address.');
  }
  let url;
  try { url = new URL(value.includes('://') ? value : `https://${value}`); }
  catch { throw new Error('That website address could not be read. Check its spelling.'); }
  if (!['https:', 'http:'].includes(url.protocol)) throw new Error('Use an https:// or http:// website address.');
  const hostname = url.hostname.toLowerCase().replace(/\.$/, '');
  if (!hostname.includes('.') || hostname.length > 253 || !hostname.split('.').every(label => /^[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?$/i.test(label))) {
    throw new Error('Enter a complete website name, such as ledger.com.');
  }
  return { hostname, pathname: url.pathname, insecure: url.protocol !== 'https:', credentials: Boolean(url.username || url.password),
    international: hostname.includes('xn--'), ip: /^\d+(\.\d+){3}$/.test(hostname), unusualPort: Boolean(url.port) };
}

export function validateSnapshot(value) {
  if (!value || !Array.isArray(value.domains) || value.domains.length < 1000 || !value.domains.every(d => typeof d === 'string' && d.length < 254 && !/[\s/]/.test(d)) ||
      !Array.isArray(value.paths) || !value.paths.every(p => typeof p === 'string' && p.includes('/') && p.length < 2048 && !/\s/.test(p)) ||
      !Number.isFinite(Date.parse(value.fetchedAt)) || !/^[a-f0-9]{40}$/.test(value.revision || '')) {
    throw new Error('The phishing list could not be verified. Try again.');
  }
  return value;
}

export function makeDomainIndex(domains) { return new Set(domains.map(d => d.toLowerCase().replace(/\.$/, ''))); }
export function makePathIndex(paths) {
  const index = new Map();
  for (const entry of paths) {
    const slash = entry.indexOf('/');
    const host = entry.slice(0, slash).toLowerCase();
    const path = entry.slice(slash).replace(/\/$/, '');
    if (!index.has(host)) index.set(host, []);
    index.get(host).push(path);
  }
  return index;
}
function listedPath(host, pathname, index) {
  if (!(index instanceof Map)) return null;
  const paths = index.get(host) || [];
  let decoded = pathname;
  try { decoded = decodeURIComponent(pathname); } catch { /* Match the literal path if decoding fails. */ }
  return paths.find(p => [pathname, decoded].some(actual => actual === p || actual.startsWith(`${p}/`))) || null;
}
export function listedDomain(hostname, index) {
  const parts = hostname.split('.');
  for (let i = 0; i < parts.length - 1; i++) {
    const domain = parts.slice(i).join('.');
    if (index.has(domain)) return domain;
  }
  return null;
}

const officialDomains = ['ledger.com', 'trezor.io', 'metamask.io', 'revoke.cash'];
function belongsTo(host, domain) { return host === domain || host.endsWith(`.${domain}`); }

export function checkWebsite(input, snapshot, now = Date.now()) {
  const { pathname, ...parsed } = parseWebsite(input);
  const age = now - Date.parse(snapshot?.fetchedAt);
  const available = Boolean(snapshot?.index instanceof Set) && Number.isFinite(age) && age >= -300000;
  const stale = !available || age > 48 * 60 * 60 * 1000;
  const blockedPath = available ? listedPath(parsed.hostname, pathname, snapshot.pathIndex) : null;
  const blocked = available ? listedDomain(parsed.hostname, snapshot.index) || (blockedPath ? `${parsed.hostname}${blockedPath}` : null) : null;
  const warnings = [];
  if (parsed.credentials) warnings.push('This address contains a misleading login section before the real website name.');
  if (parsed.insecure) warnings.push('This address uses HTTP rather than HTTPS.');
  if (parsed.international) warnings.push('This is an internationalised domain. Its characters can resemble another website.');
  if (parsed.ip) warnings.push('This is an IP address rather than a named official website.');
  if (parsed.unusualPort) warnings.push('This address uses a non-standard port.');
  const official = officialDomains.find(d => belongsTo(parsed.hostname, d));
  if (!official && /ledger|trezor|metamask|revoke/i.test(parsed.hostname)) warnings.push('This name mentions a wallet brand but is not one of the official domains recognised by this tool.');
  if (blocked) return { ...parsed, state: 'danger', title: 'Reported phishing domain', blocked, warnings, stale, available,
    detail: 'Do not open this link, connect a wallet or sign anything. MetaMask’s phishing list includes this domain, a parent domain or this page path.' };
  if (warnings.length) return { ...parsed, state: 'caution', title: 'Pause before using this link', warnings, stale, available, official,
    detail: 'The address has warning signs. Open the service’s official site yourself rather than following this link.' };
  if (!available) return { ...parsed, state: 'unknown', title: 'Phishing list unavailable', warnings, stale, available,
    detail: 'The domain was not checked against the threat list. Retry the list or open a known official website yourself.' };
  return { ...parsed, state: 'unknown', title: official ? 'Recognised website name' : 'No list match found', warnings, stale, available, official,
    detail: official ? 'The domain matches a recognised official website. This does not verify a page, request or transaction. Never share your recovery phrase.' : 'This domain is not in the loaded phishing list. That does not mean it is safe. New scams, redirects and unsafe requests may not be detected.' };
}

export function planText(answers, now = new Date()) {
  const result = assessment(answers);
  const lines = ['KeyHarbour personal safety plan', `Created: ${now.toISOString().slice(0, 10)}`,
    `Self-reported habits in place: ${result.inPlace} of ${result.applicable}`, `Questions answered: ${result.answered} of ${result.total}`,
    'This is a checklist, not a wallet scan or a guarantee of safety.', '', 'Your next actions'];
  for (const q of result.gaps) lines.push(`\n${q.action}\n${q.guidance}\nSource: ${q.source}`);
  if (!result.complete) lines.push('\nComplete the remaining questions to finish this plan.');
  if (!result.gaps.length && result.complete) lines.push('\nKeep reviewing your habits before signing and revisit this check in 30 days.');
  lines.push('\nNever add recovery words, PINs, private keys or backup locations to this file.', 'KeyHarbour does not hold funds, remove approvals or recover stolen crypto.');
  return lines.join('\n');
}
