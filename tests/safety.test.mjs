import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseWebsite, checkWebsite, makeDomainIndex, makePathIndex, assessment, sanitiseAnswers, questions, planText, validateSnapshot } from '../public/safety.mjs';

const now = Date.parse('2026-10-14T12:00:00Z');
const snapshot = { fetchedAt: new Date(now).toISOString(), index: makeDomainIndex(['bad-wallet.test', 'bad-ledger.test']) };
test('reported domains and their subdomains match, suffix impostors do not', () => {
  assert.equal(checkWebsite('https://login.bad-wallet.test/a?secret=value', snapshot, now).state, 'danger');
  assert.equal(checkWebsite('bad-wallet.test.evil.test', snapshot, now).state, 'unknown');
  assert.equal(checkWebsite('notbad-wallet.test', snapshot, now).state, 'unknown');
  assert.equal(checkWebsite('BAD-WALLET.TEST.', snapshot, now).state, 'danger');
});
test('official and unlisted domains never receive a safe verdict', () => {
  assert.equal(checkWebsite('support.ledger.com', snapshot, now).state, 'unknown');
  assert.equal(checkWebsite('example.org', snapshot, now).title, 'No list match found');
  assert.equal(checkWebsite('ledger.com.evil.test', snapshot, now).state, 'caution');
  assert.equal(checkWebsite('ledger-support.test', snapshot, now).state, 'caution');
});
test('reported paths on shared hosts do not block the whole host', () => {
  const data = { ...snapshot, pathIndex: makePathIndex(['sites.google.com/view/scam']) };
  assert.equal(checkWebsite('sites.google.com/view/scam', data, now).state, 'danger');
  assert.equal(checkWebsite('sites.google.com/view/scam/next', data, now).state, 'danger');
  assert.equal(checkWebsite('sites.google.com/view/scammer', data, now).state, 'unknown');
  assert.equal(checkWebsite('sites.google.com/view/another', data, now).state, 'unknown');
});
test('credentials, unicode lookalikes, IPs, HTTP and alternate ports cause caution', () => {
  for (const input of ['https://ledger.com@evil.test', 'https://lédger.com', 'http://example.org', 'https://127.0.0.1', 'https://example.org:8443']) {
    assert.equal(checkWebsite(input, snapshot, now).state, 'caution', input);
  }
});
test('invalid input, secret phrases and active protocols are rejected', () => {
  for (const input of ['', 'one two three four five six seven eight nine ten eleven twelve', 'javascript:alert(1)', 'data:text/html,hello', 'file:///etc/passwd', 'https:ledger.com', 'https://a..com', 'https://example.org\\@evil.test', '<img src=x onerror=alert(1)>']) {
    assert.throws(() => parseWebsite(input), undefined, input);
  }
});
test('only hostname is returned, never credentials, path, query or fragment', () => {
  const result = checkWebsite('https://name:password@example.org/private?token=secret#phrase', snapshot, now);
  assert.equal(result.hostname, 'example.org');
  assert.ok(!JSON.stringify(result).includes('password'));
  assert.ok(!JSON.stringify(result).includes('token=secret'));
});
test('missing, old and future snapshots cannot imply a current check', () => {
  assert.equal(checkWebsite('example.org', null, now).available, false);
  assert.equal(checkWebsite('example.org', { ...snapshot, fetchedAt: 'invalid' }, now).available, false);
  assert.equal(checkWebsite('example.org', { ...snapshot, fetchedAt: '2026-10-11T00:00:00Z' }, now).stale, true);
  assert.equal(checkWebsite('example.org', { ...snapshot, fetchedAt: '2030-01-01T00:00:00Z' }, now).available, false);
});
test('critical gaps stay first and not-applicable only applies to approvals', () => {
  const answers = Object.fromEntries(questions.map(q => [q.id, 'yes']));
  answers.private = 'no'; answers.approvals = 'na'; answers.display = 'no';
  const result = assessment(answers);
  assert.equal(result.complete, true); assert.equal(result.applicable, 7); assert.equal(result.inPlace, 5);
  assert.equal(result.gaps[0].id, 'private'); assert.equal(result.urgent, true);
  assert.deepEqual(sanitiseAnswers({ phrase: 'na', private: 'yes', token: 'secret' }), { private: 'yes' });
});
test('unfinished and all-yes plans describe actual scope', () => {
  assert.equal(assessment({}).complete, false);
  assert.ok(planText({}).includes('Complete the remaining questions'));
  const answers = Object.fromEntries(questions.map(q => [q.id, 'yes']));
  assert.equal(assessment(answers).inPlace, 8);
  assert.ok(planText(answers).includes('not a wallet scan'));
});
test('corrupt or unexpectedly small upstream lists are rejected', () => {
  assert.throws(() => validateSnapshot({ domains: ['bad.test'], fetchedAt: new Date(now).toISOString(), revision: 'a'.repeat(40) }));
  assert.throws(() => validateSnapshot({ domains: Array(1000).fill('bad domain'), fetchedAt: new Date(now).toISOString(), revision: 'a'.repeat(40) }));
});
