import { questions, sources, assessment, sanitiseAnswers, checkWebsite, parseWebsite, validateSnapshot, makeDomainIndex, makePathIndex, planText } from './safety.mjs';

const $ = selector => document.querySelector(selector);
const storageKey = 'keyharbour-check-v1';
let answers = {}, step = -1, save = false, snapshot = null, loading = null;
const workspace = $('#assessment-workspace');

function node(tag, text, className) {
  const n = document.createElement(tag);
  if (text !== undefined) n.textContent = text;
  if (className) n.className = className;
  return n;
}
function button(text, action, className = 'button') {
  const n = node('button', text, className); n.type = 'button'; n.addEventListener('click', action); return n;
}
function link(text, href) {
  const n = node('a', text); n.href = href;
  if (href.startsWith('https://')) { n.target = '_blank'; n.rel = 'noopener noreferrer'; }
  return n;
}
function focusHeading(n) { n.tabIndex = -1; n.focus({ preventScroll: true }); }
function status(text) { $('#storage-status').textContent = text; }
function persist() {
  if (!save) return;
  try {
    localStorage.setItem(storageKey, JSON.stringify({ version: 1, answers: sanitiseAnswers(answers), step, savedAt: new Date().toISOString() }));
    status('Checklist saved in this browser only.');
  } catch {
    save = false; $('#save-answers').checked = false;
    status('This browser could not save the checklist. Your answers remain available in this tab.');
  }
}
function readSaved() {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return;
    const saved = JSON.parse(raw);
    if (saved.version !== 1) return;
    answers = sanitiseAnswers(saved.answers);
    if (!Object.keys(answers).length) return;
    save = true;
    step = assessment(answers).complete ? questions.length : questions.findIndex(q => !answers[q.id]);
    status('Your saved checklist is open. Update it whenever your setup changes.');
  } catch { status('Saved checklist could not be read. Start a new check below.'); }
}
function setSaving(value) {
  save = value; $('#save-answers').checked = save;
  if (save) persist();
  else {
    try { localStorage.removeItem(storageKey); status('Local saving is off. Your answers stay in this tab until you close or reload it.'); }
    catch { status('This browser could not remove saved answers. Use the browser’s site-data settings to clear them.'); }
  }
}
function renderIntro() {
  workspace.replaceChildren();
  const mark = node('div', undefined, 'intro-mark');
  mark.innerHTML = '<svg viewBox="0 0 48 56" fill="none" aria-hidden="true"><path d="M24 3 44 11v16c0 12-8 20-20 26C12 47 4 39 4 27V11Z" stroke="currentColor" stroke-width="2"/><path d="m14 28 7 7 14-16" stroke="currentColor" stroke-width="2"/></svg>';
  workspace.append(mark, node('h2', 'A clearer picture of your setup.'), node('p', 'Answer a few questions about how you use your wallet. We’ll turn the gaps into a practical plan.', 'lead'));
  const list = node('ul', undefined, 'intro-list');
  for (const [a, b] of [['Recovery phrase', 'Private and offline'], ['Wallet habits', 'Check before you sign'], ['Recovery preparation', 'Know your next step']]) {
    const item = node('li', a); item.append(node('span', b)); list.append(item);
  }
  const consent = node('label', undefined, 'consent');
  const input = node('input'); input.type = 'checkbox'; input.id = 'intro-save'; input.checked = save;
  consent.append(input, node('span', 'Keep my checklist in this browser. Optional, and best left off on a shared device.'));
  workspace.append(list, consent, button('Start my safety check', () => {
    step = 0; setSaving(input.checked); renderAssessment(true);
  }), node('p', 'Eight questions. No secrets, wallet connection or signatures. This checks your reported habits, not your wallet itself.', 'inline-note'));
  $('#storage-settings').hidden = true;
}
function renderAssessment(moveFocus = false) {
  if (step < 0) { renderIntro(); return; }
  if (step >= questions.length) { renderResult(moveFocus); return; }
  workspace.replaceChildren(); $('#storage-settings').hidden = false; $('#save-answers').checked = save;
  const q = questions[step];
  const label = node('div', undefined, 'progress-label'); label.append(node('span', q.group), node('span', `Question ${step + 1} of ${questions.length}`));
  const progress = node('div', undefined, 'progress-track');
  progress.setAttribute('role', 'progressbar'); progress.setAttribute('aria-label', 'Questions answered');
  progress.setAttribute('aria-valuemin', '0'); progress.setAttribute('aria-valuemax', String(questions.length)); progress.setAttribute('aria-valuenow', String(assessment(answers).answered));
  const fill = node('i'); fill.style.width = `${(step / questions.length) * 100}%`; progress.append(fill);
  const heading = node('h2', q.title, 'question-title');
  const choices = node('div', undefined, 'answers');
  const options = [['yes', 'Yes'], ['no', 'No'], ['unsure', 'Not sure']]; if (q.allowNA) options.push(['na', 'Not applicable']);
  for (const [value, text] of options) {
    const answer = button(text, () => { answers[q.id] = value; step++; persist(); renderAssessment(true); }, 'answer');
    answer.dataset.answer = value; answer.classList.toggle('selected', answers[q.id] === value);
    choices.append(answer);
  }
  const bottom = node('div', undefined, 'question-bottom');
  bottom.append(button('Back', () => { step--; renderAssessment(true); }, 'button quiet'), link('Why this matters', q.source));
  workspace.append(label, progress, heading, node('p', q.detail, 'question-detail'), choices, bottom);
  if (moveFocus) focusHeading(heading);
}
function renderResult(moveFocus = false) {
  const result = assessment(answers);
  if (!result.complete) { step = questions.findIndex(q => !answers[q.id]); renderAssessment(moveFocus); return; }
  workspace.replaceChildren(); $('#storage-settings').hidden = false; $('#save-answers').checked = save;
  const heading = node('h2', 'Your next steps are ready.'); workspace.append(heading);
  const score = node('div', undefined, 'score-panel');
  const count = node('div'); count.append(node('strong', `${result.inPlace} of ${result.applicable}`), node('p', 'habits reported in place'));
  score.append(count, node('p', 'This is your checklist, not a wallet scan or a guarantee of safety.', 'score-label')); workspace.append(score);
  if (result.urgent) {
    const warning = node('div', undefined, 'notice danger');
    warning.append(node('strong', 'Review your recovery phrase first.'), node('p', 'Your answers suggest your phrase may not be private or offline. If it was shared or uploaded, treat it as exposed.'), link('Open the exposed-phrase guide', '#emergency/phrase')); workspace.append(warning);
  }
  const actionList = node('div', undefined, 'action-list');
  if (!result.gaps.length) {
    const note = node('div', undefined, 'notice'); note.append(node('strong', 'Keep the routine going.'), node('p', 'Your reported habits are in place. Keep checking each request and review your setup again in 30 days. This does not prove your wallet is secure.')); actionList.append(note);
  }
  result.gaps.forEach((q, i) => {
    const item = node('article', undefined, 'action-item');
    item.append(node('h3', `${i + 1}. ${q.action}`), node('p', q.guidance), link(q.urgent ? 'Review emergency steps' : 'Read original guidance', q.urgent ? '#emergency/phrase' : q.source));
    actionList.append(item);
  });
  const actions = node('div', undefined, 'result-actions');
  actions.append(button('Download my plan', () => download('keyharbour-safety-plan.txt', planText(answers), 'text/plain;charset=utf-8')),
    button('Add review reminder', downloadReminder, 'button secondary'),
    button('Update my answers', () => { step = 0; renderAssessment(true); }, 'button quiet'));
  workspace.append(actionList, actions);
  if (moveFocus) focusHeading(heading);
}
function download(filename, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a'); a.href = url; a.download = filename; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000); status(`${filename} downloaded. Keep the file private.`);
}
function downloadReminder() {
  const start = new Date(); start.setDate(start.getDate() + 30); const end = new Date(start); end.setDate(end.getDate() + 1);
  const day = d => `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const data = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//KeyHarbour//Safety Review//EN', 'BEGIN:VEVENT',
    `UID:${crypto.randomUUID()}@keyharbour`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${day(start)}`, `DTEND;VALUE=DATE:${day(end)}`,
    'RRULE:FREQ=MONTHLY', 'SUMMARY:Review my wallet safety habits',
    'DESCRIPTION:Revisit your recovery and signing habits. Never share keys.', 'END:VEVENT', 'END:VCALENDAR', ''].join('\r\n');
  download('keyharbour-review.ics', data, 'text/calendar;charset=utf-8');
  status('Review reminder downloaded. Open the file in your calendar to add it.');
}

function prepareSnapshot(data) {
  validateSnapshot(data);
  return { ...data, index: makeDomainIndex(data.domains), pathIndex: makePathIndex(data.paths) };
}
function describeList(prefix = '') {
  if (!snapshot) { $('#list-status').textContent = `${prefix} No phishing list is available.`.trim(); return; }
  const age = Date.now() - Date.parse(snapshot.fetchedAt);
  const date = new Date(snapshot.fetchedAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
  $('#list-status').textContent = `${prefix}${snapshot.domains.length.toLocaleString('en-GB')} domains and ${snapshot.paths.length.toLocaleString('en-GB')} page paths. Retrieved ${date}. ${age > 172800000 ? 'Out of date: refresh before relying on the list.' : 'A list match is only one check, not a safety guarantee.'}`;
}
async function fetchJson(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(15000), cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer' });
  if (!response.ok) throw new Error('Threat-list request failed.');
  return response.json();
}
async function ensureList(refresh = false) {
  if (loading) return loading;
  if (snapshot && !refresh) return snapshot;
  $('#refresh-list').disabled = true; $('#list-status').textContent = refresh ? 'Refreshing from the published MetaMask list…' : 'Loading the bundled phishing list…';
  loading = (async () => {
    try {
      let data;
      if (refresh) {
        const commits = await fetchJson('https://api.github.com/repos/MetaMask/eth-phishing-detect/commits?path=src/config.json&per_page=1');
        const revision = commits[0]?.sha;
        if (!/^[a-f0-9]{40}$/.test(revision || '')) throw new Error('Invalid revision.');
        const raw = await fetchJson(`https://raw.githubusercontent.com/MetaMask/eth-phishing-detect/${revision}/src/config.json`);
        const entries = raw.blacklist ?? raw.blocklist;
        if (!Array.isArray(entries) || entries.length < 1000 || !entries.every(x => typeof x === 'string' && x.length < 2048 && !/\s/.test(x))) throw new Error('Invalid threat list.');
        data = { revision, fetchedAt: new Date().toISOString(),
          domains: [...new Set(entries.filter(x => !x.includes('/')).map(x => new URL(`https://${x}`).hostname.toLowerCase().replace(/\.$/, '')))],
          paths: entries.filter(x => x.includes('/')).map(x => { const u = new URL(`https://${x}`); return `${u.hostname}${u.pathname}`; }) };
      } else data = await fetchJson(new URL('data/phishing.json', import.meta.url));
      snapshot = prepareSnapshot(data); describeList(refresh ? 'Refreshed. ' : '');
    } catch {
      if (refresh && !snapshot) {
        try { snapshot = prepareSnapshot(await fetchJson(new URL('data/phishing.json', import.meta.url))); } catch { /* Remain explicitly unavailable. */ }
      }
      describeList(refresh ? 'Refresh failed. Using the bundled or previously loaded list if available. ' : 'The bundled list could not load. Select Refresh threat list to retry. ');
    } finally { $('#refresh-list').disabled = false; loading = null; }
    return snapshot;
  })();
  return loading;
}
function renderLinkResult(result) {
  const target = $('#link-result'); target.replaceChildren(); target.hidden = false;
  const pill = node('span', result.state === 'danger' ? 'Reported threat' : result.state === 'caution' ? 'Address warning' : 'Check incomplete', 'pill');
  if (result.state === 'danger') { pill.classList.add('danger'); }
  else if (result.state === 'caution') pill.classList.add('warn');
  target.append(pill, node('h2', result.title), node('div', result.hostname, 'domain-display'), node('p', result.detail));
  if (result.blocked) target.append(node('p', `Listed match: ${result.blocked}`));
  if (result.warnings.length) { const list = node('ul'); result.warnings.forEach(w => list.append(node('li', w))); target.append(list); }
  if (result.stale) {
    const warning = node('div', undefined, 'notice warn');
    warning.append(node('strong', result.available ? 'This list is out of date.' : 'The threat list is unavailable.'), node('p', 'New reports may be missing. Refresh the list and use the official website yourself.')); target.append(warning);
  }
  target.append(link('A message asked for my phrase or a signature', '#emergency/message'));
}
$('#link-form').addEventListener('submit', async event => {
  event.preventDefault(); $('#link-error').hidden = true; $('#link-result').hidden = true;
  const value = $('#website').value;
  try { parseWebsite(value); }
  catch (error) { $('#link-error').textContent = error.message; $('#link-error').hidden = false; return; }
  $('#check-link').disabled = true; $('#check-link').textContent = 'Checking…';
  try { await ensureList(); renderLinkResult(checkWebsite(value, snapshot)); }
  finally { $('#check-link').disabled = false; $('#check-link').textContent = 'Check link'; }
});
$('#website').addEventListener('input', () => { $('#link-result').hidden = true; $('#link-error').hidden = true; });
$('#refresh-list').addEventListener('click', async () => {
  await ensureList(true);
  // Old verdicts must not survive a refreshed dataset without being checked again.
  $('#link-result').hidden = true;
});

const incidents = {
  phrase: { title: 'My recovery phrase may be exposed.', subtitle: 'Shared words, a photo, a cloud copy or a suspicious restore page.',
    warning: 'Treat a shared or uploaded phrase as compromised. Removing the copy or revoking approvals does not restore its secrecy.',
    steps: [
      ['Stop using the affected wallet.', 'Do not follow messages telling you to “validate”, “synchronise” or transfer to a support-controlled safe wallet.'],
      ['Use a trusted device and official guidance.', 'Create a new wallet with a completely new recovery phrase through your wallet maker’s official setup process. Restoring the exposed phrase on another device creates the same compromised wallet. Never type the words here.'],
      ['Do not blindly add funds for gas.', 'A compromised account may have a sweeper that takes funds as soon as they arrive. Avoid repeated top-ups. Seek help through independently verified official support before attempting a transfer if this is happening.'],
      ['Preserve evidence and review related access.', 'Keep transaction hashes and relevant messages privately. Secure affected email or exchange accounts through their official sites. This guide cannot recover stolen funds.']
    ], source: sources.phishing, extra: sources.revoke },
  approval: { title: 'I approved something I did not intend.', subtitle: 'A signature, token permission or unexpected transaction.',
    warning: 'If you also shared your recovery phrase, use the exposed-phrase route first. Approval revocation cannot fix an exposed phrase.',
    steps: [
      ['Stop signing new requests.', 'Do not respond to recovery offers or approve a second request to “undo” the first.'],
      ['Inspect what was approved.', 'Use the official wallet or a recognised explorer for the correct chain. Some signatures, permits and account changes are not ordinary token approvals. This app does not inspect them.'],
      ['Review token approvals through a known official tool.', 'Revoke.cash can inspect and revoke supported approvals. Revocation requires an on-chain transaction and gas. Disconnecting the website does not remove existing approvals.'],
      ['Keep evidence and use official support.', 'Save transaction hashes privately and get help from your wallet maker’s verified support. Transactions may be irreversible; no recovery is promised. If gas top-ups are immediately stolen, stop and use the exposed-phrase route.']
    ], source: sources.revoke },
  device: { title: 'My hardware wallet is missing.', subtitle: 'A lost, damaged or stolen device.',
    warning: 'A missing device and an exposed recovery phrase are different problems. If someone may have your backup, use the exposed-phrase route.',
    steps: [
      ['Keep your recovery backup private.', 'Do not upload it, send it to support or enter it into a website offering recovery.'],
      ['Open the manufacturer’s official recovery instructions.', 'Use your known official website or bookmark. A replacement device may restore access with your recovery material; follow the instructions for your specific wallet.'],
      ['Consider whether anything else was exposed.', 'If the device, PIN, backup or passphrase may be accessible to someone else, ask the manufacturer’s official support about the situation. Do not assume that a PIN alone resolves every risk.'],
      ['If the backup is missing too, avoid recovery promises.', 'Recovery may not be possible. Do not pay people who claim they can recreate a recovery phrase or unlock funds without it.']
    ], source: sources.ledger },
  message: { title: 'Someone sent me a suspicious request.', subtitle: 'Unexpected support, an airdrop or a demand to secure the wallet.',
    warning: 'No legitimate safety check needs you to disclose your recovery phrase to a website or support agent.',
    steps: [
      ['Do not reply, open attachments or sign.', 'Pressure, urgency and threats about a frozen wallet are reasons to pause.'],
      ['Reach support independently.', 'Open your wallet maker’s official website yourself. Do not use the sender’s link, number or “safe wallet” address.'],
      ['Screen the address without visiting it.', 'Use the link checker as one check. A missing list match does not make the request trustworthy.'],
      ['Choose the relevant route if you already acted.', 'If you shared words, follow the exposed-phrase guide. If you signed or granted access, follow the unwanted-approval guide. Preserve evidence privately.']
    ], source: sources.phishing }
};
function renderEmergency(id, moveFocus = false) {
  const area = $('#emergency-workspace'); area.replaceChildren();
  const incident = incidents[id];
  if (!incident) {
    const note = node('div', undefined, 'notice warn'); note.append(node('strong', 'Never give anyone your recovery phrase.'), node('p', 'We do not offer recovery, a safe-wallet transfer or staffed incident response.')); area.append(note);
    const heading = node('h2', 'What happened?'); const choices = node('div', undefined, 'emergency-choices');
    for (const [key, item] of Object.entries(incidents)) {
      const choice = button('', () => { location.hash = `emergency/${key}`; }, 'emergency-choice');
      choice.append(node('strong', item.title), node('span', item.subtitle)); choices.append(choice);
    }
    area.append(heading, choices); if (moveFocus) focusHeading(heading); return;
  }
  area.append(button('All emergency guides', () => { location.hash = 'emergency'; }, 'button quiet'));
  const heading = node('h2', incident.title); const notice = node('div', incident.warning, 'notice danger');
  const list = node('ol', undefined, 'emergency-steps');
  incident.steps.forEach(([title, detail]) => { const item = node('li'); item.append(node('strong', title), node('span', detail)); list.append(item); });
  area.append(heading, notice, list, link('Read the original guidance', incident.source));
  if (incident.extra) {
    const extra = node('p', undefined, 'inline-note');
    extra.append(link('Read about exposed phrases and sweeper bots', incident.extra)); area.append(extra);
  }
  const routes = node('div', undefined, 'official-sites');
  routes.append(link('Exposed phrase', '#emergency/phrase'), document.createTextNode(' · '), link('Unwanted approval', '#emergency/approval'), document.createTextNode(' · '), link('Check a link', '#links')); area.append(routes);
  if (moveFocus) focusHeading(heading);
}
function showView(moveFocus = false) {
  const [requested, incident] = location.hash.slice(1).split('/');
  const view = ['links', 'emergency'].includes(requested) ? requested : 'check';
  document.querySelectorAll('[data-view]').forEach(tab => {
    const active = tab.dataset.view === view; tab.classList.toggle('active', active);
    if (active) tab.setAttribute('aria-current', 'page'); else tab.removeAttribute('aria-current');
  });
  for (const name of ['check', 'links', 'emergency']) $(`#${name}-view`).hidden = name !== view;
  if (view === 'emergency') renderEmergency(incident, moveFocus);
  else if (moveFocus) focusHeading($(`#${view}-heading`));
}
document.querySelectorAll('[data-view]').forEach(tab => tab.addEventListener('click', () => {
  const next = tab.dataset.view; if (location.hash === `#${next}`) showView(true); else location.hash = next;
}));
$('#save-answers').addEventListener('change', event => setSaving(event.target.checked));
$('#reset-check').addEventListener('click', () => {
  try { localStorage.removeItem(storageKey); }
  catch { status('Could not remove the saved checklist. Clear this site’s data in browser settings.'); return; }
  answers = {}; step = -1; save = false; renderAssessment(); status('Checklist cleared. Any files you downloaded are separate.');
});
window.addEventListener('hashchange', () => showView(true));
readSaved(); renderAssessment(); showView();
