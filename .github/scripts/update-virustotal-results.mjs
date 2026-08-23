import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';

const RELEASE_API = 'https://api.github.com/repos/selfsecuredlab/lyrics-status/releases/latest';
const RESULT_PATH = new URL('../../virustotal-results.json', import.meta.url);
const VIRUSTOTAL_API_KEY = process.env.VT_API_KEY;
const FILES = {
  setup: /setup.*\.exe$/i,
  portable: /portable.*\.exe$/i
};
const STAT_KEYS = [
  'malicious',
  'suspicious',
  'harmless',
  'undetected',
  'timeout',
  'confirmed-timeout',
  'failure',
  'type-unsupported'
];

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function getLatestRelease() {
  const response = await fetch(RELEASE_API, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'LyricsStatus-VirusTotal-Updater'
    }
  });

  if (!response.ok) throw new Error(`GitHub release request failed with ${response.status}`);
  return response.json();
}

async function getSha256(asset) {
  const digest = String(asset.digest || '').replace(/^sha256:/i, '');
  if (/^[a-f0-9]{64}$/i.test(digest)) return digest.toLowerCase();

  const response = await fetch(asset.browser_download_url, {
    headers: { 'User-Agent': 'LyricsStatus-VirusTotal-Updater' }
  });
  if (!response.ok) throw new Error(`Could not download ${asset.name} to calculate its SHA-256`);
  const bytes = Buffer.from(await response.arrayBuffer());
  return createHash('sha256').update(bytes).digest('hex');
}

async function downloadAsset(asset, expectedSha256) {
  const response = await fetch(asset.browser_download_url, {
    headers: { 'User-Agent': 'LyricsStatus-VirusTotal-Updater' }
  });
  if (!response.ok) throw new Error(`Could not download ${asset.name} for VirusTotal submission`);
  const bytes = Buffer.from(await response.arrayBuffer());
  const actualSha256 = createHash('sha256').update(bytes).digest('hex');
  if (actualSha256 !== expectedSha256) {
    throw new Error(`SHA-256 mismatch while preparing ${asset.name} for submission`);
  }
  return bytes;
}

function normalizeStats(stats = {}) {
  return Object.fromEntries(STAT_KEYS.map((key) => [key, Number(stats[key] || 0)]));
}

async function getVirusTotalResult(asset, sha256) {
  const reportUrl = `https://www.virustotal.com/gui/file/${sha256}/detection`;
  const response = await fetch(`https://www.virustotal.com/api/v3/files/${sha256}`, {
    headers: {
      Accept: 'application/json',
      'x-apikey': VIRUSTOTAL_API_KEY
    }
  });

  if (response.status === 404) {
    return {
      name: asset.name,
      downloadUrl: asset.browser_download_url,
      sha256,
      reportUrl,
      status: 'not_found',
      lastAnalysisDate: null,
      stats: null
    };
  }

  if (!response.ok) throw new Error(`VirusTotal returned ${response.status} for ${asset.name}`);
  const body = await response.json();
  const attributes = body?.data?.attributes || {};

  return {
    name: asset.name,
    downloadUrl: asset.browser_download_url,
    sha256,
    reportUrl,
    status: 'available',
    lastAnalysisDate: attributes.last_analysis_date
      ? new Date(attributes.last_analysis_date * 1000).toISOString()
      : null,
    stats: normalizeStats(attributes.last_analysis_stats)
  };
}

async function submitMissingFile(asset, sha256) {
  console.log(`${asset.name} has no VirusTotal report; submitting the public release file.`);
  const bytes = await downloadAsset(asset, sha256);
  const uploadUrlResponse = await fetch('https://www.virustotal.com/api/v3/files/upload_url', {
    headers: { 'x-apikey': VIRUSTOTAL_API_KEY }
  });
  if (!uploadUrlResponse.ok) {
    throw new Error(`Could not obtain a VirusTotal upload URL (${uploadUrlResponse.status})`);
  }

  const uploadUrl = (await uploadUrlResponse.json())?.data;
  if (!uploadUrl) throw new Error('VirusTotal did not return an upload URL');

  const form = new FormData();
  form.append('file', new Blob([bytes], { type: 'application/octet-stream' }), asset.name);
  const uploadResponse = await fetch(uploadUrl, {
    method: 'POST',
    headers: { 'x-apikey': VIRUSTOTAL_API_KEY },
    body: form
  });
  if (!uploadResponse.ok) {
    throw new Error(`VirusTotal upload failed with ${uploadResponse.status}`);
  }

  const analysisId = (await uploadResponse.json())?.data?.id;
  if (!analysisId) throw new Error('VirusTotal did not return an analysis ID');

  for (let attempt = 0; attempt < 10; attempt += 1) {
    await wait(30_000);
    const analysisResponse = await fetch(`https://www.virustotal.com/api/v3/analyses/${analysisId}`, {
      headers: {
        Accept: 'application/json',
        'x-apikey': VIRUSTOTAL_API_KEY
      }
    });
    if (analysisResponse.status === 429) continue;
    if (!analysisResponse.ok) {
      throw new Error(`VirusTotal analysis check failed with ${analysisResponse.status}`);
    }

    const status = (await analysisResponse.json())?.data?.attributes?.status;
    if (status === 'completed') {
      await wait(30_000);
      const result = await getVirusTotalResult(asset, sha256);
      if (result.status === 'available') return result;
    }
  }

  throw new Error(`VirusTotal did not finish analyzing ${asset.name} in time`);
}

async function readPreviousResults() {
  try {
    return JSON.parse(await readFile(RESULT_PATH, 'utf8'));
  } catch {
    return { schemaVersion: 1, release: null, updatedAt: null, files: {} };
  }
}

function withoutUpdateTime(results) {
  return JSON.stringify({
    schemaVersion: results.schemaVersion,
    release: results.release,
    files: results.files
  });
}

async function main() {
  if (!VIRUSTOTAL_API_KEY) {
    console.log('VT_API_KEY is not configured; keeping the existing cached results.');
    return;
  }

  const previous = await readPreviousResults();
  const release = await getLatestRelease();
  const assets = Array.isArray(release.assets) ? release.assets : [];
  const entries = Object.entries(FILES);
  const files = {};

  for (const [index, [key, pattern]] of entries.entries()) {
    const asset = assets.find((candidate) => pattern.test(candidate.name));
    if (!asset) throw new Error(`Could not find the ${key} executable in ${release.tag_name}`);
    if (index > 0) await wait(30_000);

    const sha256 = await getSha256(asset);
    try {
      const result = await getVirusTotalResult(asset, sha256);
      files[key] = result.status === 'not_found'
        ? await submitMissingFile(asset, sha256)
        : result;
    } catch (error) {
      const cached = previous.files?.[key];
      if (cached?.sha256 === sha256 && cached?.status === 'available') {
        console.warn(`${error.message}; retaining the last successful ${key} result.`);
        files[key] = cached;
      } else {
        throw error;
      }
    }
  }

  const next = {
    schemaVersion: 1,
    release: release.tag_name,
    updatedAt: previous.updatedAt,
    files
  };

  if (withoutUpdateTime(next) === withoutUpdateTime(previous)) {
    console.log('VirusTotal results have not changed.');
    return;
  }

  next.updatedAt = new Date().toISOString();
  await writeFile(RESULT_PATH, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
  console.log(`Updated cached VirusTotal results for ${release.tag_name}.`);
}

await main();
