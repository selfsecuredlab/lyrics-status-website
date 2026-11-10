import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildFileResult,
  getVirusTotalUploadUrl,
  normalizeStats,
  sameResultData
} from '../.github/scripts/update-virustotal-results.mjs';

test('normalizes missing VirusTotal engine counts to zero', () => {
  assert.deepEqual(normalizeStats({ malicious: 2, undetected: '65' }), {
    malicious: 2,
    suspicious: 0,
    harmless: 0,
    undetected: 65,
    timeout: 0,
    'confirmed-timeout': 0,
    failure: 0,
    'type-unsupported': 0
  });
});

test('builds a report link and UTC analysis time from a release asset', () => {
  const result = buildFileResult(
    {
      name: 'LyricsStatus-Setup-1.1.0.exe',
      browser_download_url: 'https://example.test/setup.exe'
    },
    'a'.repeat(64),
    { last_analysis_date: 1_791_583_200, last_analysis_stats: { malicious: 1 } }
  );

  assert.equal(result.name, 'LyricsStatus-Setup-1.1.0.exe');
  assert.equal(result.downloadUrl, 'https://example.test/setup.exe');
  assert.equal(result.sha256, 'a'.repeat(64));
  assert.equal(result.reportUrl, `https://www.virustotal.com/gui/file/${'a'.repeat(64)}/detection`);
  assert.equal(result.status, 'available');
  assert.equal(result.stats.malicious, 1);
  assert.equal(result.lastAnalysisDate, new Date(1_791_583_200 * 1000).toISOString());
});

test('detects unchanged results without treating the refresh timestamp as data', () => {
  const previous = {
    schemaVersion: 1,
    release: 'v1.1.0',
    updatedAt: '2026-01-01T00:00:00.000Z',
    files: { setup: { sha256: 'a'.repeat(64) } }
  };
  const same = { ...previous, updatedAt: '2026-02-01T00:00:00.000Z' };

  assert.equal(sameResultData(previous, same), true);
  assert.equal(sameResultData(previous, { ...same, release: 'v1.2.0' }), false);
});

test('upgrades a documented VirusTotal upload URL to HTTPS', () => {
  const uploadUrl = getVirusTotalUploadUrl('http://www.virustotal.com/_ah/upload/one-time-token/');

  assert.equal(uploadUrl.protocol, 'https:');
  assert.equal(uploadUrl.hostname, 'www.virustotal.com');
  assert.equal(uploadUrl.pathname, '/_ah/upload/one-time-token/');
});

test('accepts an official VirusTotal upload subdomain', () => {
  const uploadUrl = getVirusTotalUploadUrl('https://upload.virustotal.com/_ah/upload/one-time-token/');

  assert.equal(uploadUrl.hostname, 'upload.virustotal.com');
});

test('rejects lookalike upload hosts and reports only the hostname', () => {
  assert.throws(
    () => getVirusTotalUploadUrl('https://virustotal.com.attacker.example/_ah/upload/token/'),
    /unexpected upload host: virustotal\.com\.attacker\.example/
  );
});

test('rejects unsupported upload URL protocols', () => {
  assert.throws(
    () => getVirusTotalUploadUrl('ftp://www.virustotal.com/_ah/upload/token/'),
    /unexpected upload protocol/
  );
});
