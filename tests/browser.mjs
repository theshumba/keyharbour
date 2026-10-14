import { firefox } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';

const base = (process.argv[2] || 'http://127.0.0.1:8874/').replace(/\/?$/, '/');
const data = JSON.parse(await readFile(new URL('../public/data/phishing.json', import.meta.url), 'utf8'));
const artifacts = new URL('../artifacts/', import.meta.url); await mkdir(artifacts, { recursive: true });
const browser = await firefox.launch({ headless: true });
let count = 0;
async function expect(name, check) { await check(); count++; console.log(`PASS ${name}`); }
async function fit(page) {
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Page must fit its viewport');
}
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
  const page = await context.newPage(); const errors = [], requests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('request', request => requests.push(request.url()));
  await page.goto(base);
  await expect('homepage, navigation and desktop layout', async () => {
    await page.getByRole('heading', { name: /Your crypto/ }).waitFor(); await fit(page);
    await page.screenshot({ path: new URL('home-desktop.png', artifacts).pathname, fullPage: true });
    await page.getByRole('link', { name: 'Check my wallet habits' }).click();
    await page.getByRole('button', { name: 'Start my safety check' }).waitFor();
  });
  await page.getByRole('button', { name: 'Start my safety check' }).click();
  for (const answer of ['no', 'no', 'yes', 'no', 'unsure', 'na', 'no', 'no']) await page.locator(`[data-answer="${answer}"]`).click();
  await expect('full assessment prioritises exposed-phrase risk and handles non-applicable approvals', async () => {
    await page.getByRole('heading', { name: 'Your next steps are ready.' }).waitFor();
    assert.ok((await page.locator('.score-panel').innerText()).includes('1 of 7'));
    assert.ok((await page.locator('.action-item').first().innerText()).includes('recovery phrase'));
    assert.equal(await page.evaluate(() => localStorage.getItem('keyharbour-check-v1')), null);
    await page.screenshot({ path: new URL('plan-desktop.png', artifacts).pathname, fullPage: true });
  });
  await expect('downloaded plan contains actual actions and no secrets', async () => {
    const download = page.waitForEvent('download'); await page.getByRole('button', { name: 'Download my plan' }).click();
    const result = await download; const text = await readFile(await result.path(), 'utf8');
    assert.ok(text.includes('1 of 7')); assert.ok(text.includes('Deal with a possibly exposed phrase'));
    assert.ok(text.includes('not a wallet scan')); assert.equal(result.suggestedFilename(), 'keyharbour-safety-plan.txt');
  });
  await expect('calendar file contains a real future monthly event', async () => {
    const download = page.waitForEvent('download'); await page.getByRole('button', { name: 'Add review reminder' }).click();
    const result = await download; const text = await readFile(await result.path(), 'utf8');
    assert.ok(text.includes('RRULE:FREQ=MONTHLY')); assert.match(text, /DTSTART;VALUE=DATE:\d{8}/); assert.ok(text.includes('END:VCALENDAR'));
  });
  await expect('saving is opt-in, survives reload and can be removed', async () => {
    await page.locator('#save-answers').check(); await page.reload();
    await page.getByRole('heading', { name: 'Your next steps are ready.' }).waitFor();
    assert.equal(await page.locator('#save-answers').isChecked(), true);
    await page.locator('#save-answers').uncheck(); assert.equal(await page.evaluate(() => localStorage.getItem('keyharbour-check-v1')), null);
    await page.getByRole('button', { name: 'Clear my checklist' }).click();
    await page.getByRole('button', { name: 'Start my safety check' }).waitFor();
  });
  await page.getByRole('button', { name: 'Emergency help' }).click();
  await expect('all four emergency routes render correct guidance', async () => {
    for (const id of ['phrase', 'approval', 'device', 'message']) {
      await page.goto(`${base}app.html#emergency/${id}`);
      assert.equal(await page.locator('.emergency-steps li').count(), 4);
      if (id === 'phrase') assert.ok((await page.locator('#emergency-workspace').innerText()).includes('sweeper'));
      if (id === 'approval') assert.ok((await page.locator('#emergency-workspace').innerText()).includes('Disconnecting'));
    }
  });
  await page.goto(`${base}app.html#links`);
  async function check(value) { await page.locator('#website').fill(value); await page.getByRole('button', { name: 'Check link', exact: true }).click(); await page.locator('#link-result:not([hidden])').waitFor(); }
  await expect('real bundled list catches a reported domain and a subdomain without visiting it', async () => {
    const reported = data.domains.find(d => d.includes('metamask') && !d.includes('xn--'));
    await check(`https://login.${reported}/private?token=do-not-transmit`);
    assert.ok((await page.locator('#link-result').innerText()).includes('Reported phishing domain'));
    assert.ok(!requests.some(url => url.includes(reported) || url.includes('do-not-transmit')));
    await page.screenshot({ path: new URL('link-desktop.png', artifacts).pathname, fullPage: true });
  });
  await expect('reported shared-host paths are checked without blocking unrelated pages', async () => {
    await check(data.paths[0]); assert.ok((await page.locator('#link-result').innerText()).includes('Reported phishing domain'));
    await check('example.org/keyharbour-unlisted'); assert.ok((await page.locator('#link-result').innerText()).includes('No list match found'));
  });
  await expect('official domains and misleading credentials remain unresolved rather than safe', async () => {
    await check('https://name:password@ledger.com/private?secret=do-not-transmit');
    const text = await page.locator('#link-result').innerText(); assert.ok(text.includes('Pause before')); assert.ok(!text.includes('password')); assert.ok(!text.includes('do-not-transmit'));
    await check('ledger.com'); assert.ok((await page.locator('#link-result').innerText()).includes('Recognised website name'));
    assert.ok(!(await page.locator('#link-result').innerText()).includes('This link is safe'));
  });
  await expect('secret phrases and injected markup are rejected without rendering them', async () => {
    for (const value of ['one two three four five six seven eight nine ten eleven twelve', '<img src=x onerror=alert(1)>', 'javascript:alert(1)']) {
      await page.locator('#website').fill(value); await page.getByRole('button', { name: 'Check link', exact: true }).click();
      assert.equal(await page.locator('#link-error').isVisible(), true); assert.equal(await page.locator('#link-result').isVisible(), false);
    }
  });
  await expect('refresh retrieves and validates the published live threat list', async () => {
    await page.getByRole('button', { name: 'Refresh threat list' }).click();
    await page.waitForFunction(() => !document.querySelector('#refresh-list').disabled, { timeout: 45000 });
    assert.ok((await page.locator('#list-status').innerText()).startsWith('Refreshed.'));
    await check('ledger.com'); assert.ok((await page.locator('#link-result').innerText()).includes('Recognised website name'));
  });
  await expect('privacy, licence and metadata links serve real files', async () => {
    for (const file of ['privacy.html', 'data/metadata.json', 'data/METAMASK-LICENSE.txt']) {
      const response = await context.request.get(`${base}${file}`); assert.equal(response.status(), 200, file);
    }
  });
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto(base);
  await expect('phone homepage and all app screens fit without clipping', async () => {
    await fit(page); await page.screenshot({ path: new URL('home-phone.png', artifacts).pathname, fullPage: true });
    for (const route of ['check', 'links', 'emergency', 'emergency/phrase']) {
      await page.goto(`${base}app.html#${route}`); await page.locator('#main').waitFor(); await fit(page);
    }
    await page.screenshot({ path: new URL('emergency-phone.png', artifacts).pathname, fullPage: true });
    await page.goto(`${base}app.html`); await page.getByRole('button', { name: 'Start my safety check' }).click();
    await fit(page); await page.screenshot({ path: new URL('question-phone.png', artifacts).pathname, fullPage: true });
    for (let i = 0; i < 8; i++) await page.locator('[data-answer="yes"]').click();
    assert.ok((await page.locator('.score-panel').innerText()).includes('8 of 8'));
    await fit(page); assert.ok((await page.locator('#assessment-workspace').innerText()).includes('does not prove your wallet is secure'));
  });
  await expect('back, update and keyboard interaction remain usable', async () => {
    await page.getByRole('button', { name: 'Update my answers' }).click();
    await page.getByRole('button', { name: 'No', exact: true }).click();
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    assert.equal(await page.locator('[data-answer="no"]').getAttribute('class'), 'answer selected');
    await page.locator('[data-answer="yes"]').focus(); await page.keyboard.press('Enter');
    assert.ok((await page.locator('.progress-label').innerText()).includes('Question 2'));
  });
  assert.deepEqual(errors, [], 'No JavaScript or CSP errors'); await context.close();

  const fallback = await browser.newContext(); const off = await fallback.newPage();
  await off.route('**/data/phishing.json', route => route.abort());
  await off.route('https://api.github.com/**', route => route.abort());
  await off.goto(`${base}app.html#links`);
  await off.locator('#website').fill('example.org'); await off.getByRole('button', { name: 'Check link', exact: true }).click();
  await expect('missing list and failed refresh are explicit, not reassuring', async () => {
    await off.locator('#link-result:not([hidden])').waitFor(); assert.ok((await off.locator('#link-result').innerText()).includes('Phishing list unavailable'));
    await off.getByRole('button', { name: 'Refresh threat list' }).click(); await off.getByRole('button', { name: 'Refresh threat list' }).waitFor({ state: 'visible' });
    await off.waitForFunction(() => !document.querySelector('#refresh-list').disabled);
    assert.ok((await off.locator('#list-status').innerText()).includes('Refresh failed'));
  }); await fallback.close();

  const old = await browser.newContext(); const stale = await old.newPage();
  await stale.route('**/data/phishing.json', route => route.fulfill({ json: { ...data, fetchedAt: '2020-01-01T00:00:00Z' } }));
  await stale.goto(`${base}app.html#links`); await stale.locator('#website').fill('example.org'); await stale.getByRole('button', { name: 'Check link', exact: true }).click();
  await expect('outdated lists show a visible warning', async () => {
    await stale.locator('#link-result:not([hidden])').waitFor(); assert.ok((await stale.locator('#link-result').innerText()).includes('out of date'));
  }); await old.close();

  const blockedStorage = await browser.newContext(); await blockedStorage.addInitScript(() => {
    Storage.prototype.setItem = () => { throw new Error('Storage denied'); };
  });
  const denied = await blockedStorage.newPage(); await denied.goto(`${base}app.html`); await denied.locator('#intro-save').check(); await denied.getByRole('button', { name: 'Start my safety check' }).click();
  await expect('denied storage preserves the active flow without claiming a save', async () => {
    assert.ok((await denied.locator('#storage-status').innerText()).includes('could not save'));
    assert.equal(await denied.locator('#save-answers').isChecked(), false); await denied.locator('[data-answer="yes"]').click();
  }); await blockedStorage.close();
  console.log(`Firefox: ${count} journey checks passed against ${base}`);
} finally { await browser.close(); }
