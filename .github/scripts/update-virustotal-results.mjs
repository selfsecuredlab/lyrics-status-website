import { createHash } from 'node:crypto';
import { readFile, rename, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';

const GITHUB_RELEASES_API = 'https://api.github.com/repos/selfsecuredlab/lyrics-status/releases';
const VIRUSTOTAL_API = 'https://www.virustotal.com/api/v3';
const RESULTS_PATH = fileURLToPath(new URL('../../virustotal-results.json', import.meta.url));
const TEMP_RESULTS_PATH = `${RESULTS_PATH}.tmp`;
const API_KEY = process.env.VT_API_KEY?.trim();
const GITHUB_TOKEN = process.env.GITHUB_TOKEN?.trim();
const REQUESTED_RELEASE_TAG = String(process.env.RELEASE_TAG || '').trim();
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

export function normalizeStats(stats = {}) {
  return Object.fromEntries(STAT_KEYS.map((key) => {
    const value = Number(stats[key] || 0);
    return [key, Number.isFinite(value) && value > 0 ? Math.floor(value) : 0];
  }));
}

export function buildFileResult(asset, sha256, attributes = {}) {
  return {
    name: asset.name,
    downloadUrl: asset.browser_download_url,
    sha256,
    reportUrl: `https://www.virustotal.com/gui/file/${sha256}/detection`,
    status: 'available',
    lastAnalysisDate: attributes.last_analysis_date
      ? new Date(attributes.last_analysis_date * 1000).toISOString()
      : null,
    stats: normalizeStats(attributes.last_analysis_stats)
  };
}

export function sameResultData(left, right) {
  const data = (value) => JSON.stringify({
    schemaVersion: value.schemaVersion,
    release: value.release,
    files: value.files
  });
  return data(left) === data(right);
}

export function getVirusTotalUploadUrl(value) {
  let uploadUrl;
  try {
    uploadUrl = new URL(value);
  } catch {
    throw new Error('VirusTotal did not return a valid upload URL');
  }

  const hostname = uploadUrl.hostname.toLowerCase().replace(/\.$/, '');
  if (hostname !== 'virustotal.com' && !hostname.endsWith('.virustotal.com')) {
    throw new Error(`VirusTotal returned an unexpected upload host: ${hostname || 'unknown'}`);
  }
  if (uploadUrl.protocol !== 'http:' && uploadUrl.protocol !== 'https:') {
    throw new Error('VirusTotal returned an unexpected upload protocol');
  }
  if (uploadUrl.username || uploadUrl.password || (uploadUrl.port && uploadUrl.port !== '443')) {
    throw new Error('VirusTotal returned an unsafe upload URL');
  }

  uploadUrl.hostname = hostname;
  uploadUrl.protocol = 'https:';
  return uploadUrl;
}

async function getRelease() {
  const url = REQUESTED_RELEASE_TAG
    ? `${GITHUB_RELEASES_API}/tags/${encodeURIComponent(REQUESTED_RELEASE_TAG)}`
    : `${GITHUB_RELEASES_API}/latest`;
  const response = await fetch(url, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'LyricsStatus-VirusTotal-Updater',
      ...(GITHUB_TOKEN ? { Authorization: `Bearer ${GITHUB_TOKEN}` } : {})
    }
  });

  if (!response.ok) throw new Error(`GitHub release request failed with ${response.status}`);
  const release = await response.json();
  if (REQUESTED_RELEASE_TAG && release.tag_name !== REQUESTED_RELEASE_TAG) {
    throw new Error(`GitHub returned ${release.tag_name || 'an unknown tag'} instead of the requested tag`);
  }
  return release;
}

async function getSha256(asset) {
  const digest = String(asset.digest || '').replace(/^sha256:/i, '');
  if (/^[a-f0-9]{64}$/i.test(digest)) return digest.toLowerCase();

  const response = await fetch(asset.browser_download_url, {
    headers: { 'User-Agent': 'LyricsStatus-VirusTotal-Updater' }
  });
  if (!response.ok || !response.body) {
    throw new Error(`Could not download ${asset.name} to calculate its SHA-256`);
  }

  const hash = createHash('sha256');
  const reader = response.body.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      hash.update(value);
    }
  } finally {
    reader.releaseLock();
  }
  return hash.digest('hex');
}

async function virusTotalFetch(pathOrUrl, options = {}) {
  const url = pathOrUrl.startsWith('https://') ? pathOrUrl : `${VIRUSTOTAL_API}${pathOrUrl}`;
  const headers = new Headers(options.headers);
  headers.set('x-apikey', API_KEY);
  if (!headers.has('Accept')) headers.set('Accept', 'application/json');

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const response = await fetch(url, { ...options, headers });
    if (response.status !== 429) return response;

    const retryAfter = Number(response.headers.get('retry-after'));
    await wait(Number.isFinite(retryAfter) && retryAfter > 0
      ? Math.min(retryAfter * 1000, 120_000)
      : Math.min((attempt + 1) * 20_000, 120_000));
  }

  throw new Error('VirusTotal rate limit persisted after retries');
}

async function getVirusTotalResult(asset, sha256) {
  const response = await virusTotalFetch(`/files/${sha256}`);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`VirusTotal returned ${response.status} for ${asset.name}`);

  const attributes = (await response.json())?.data?.attributes || {};
  return buildFileResult(asset, sha256, attributes);
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

async function submitMissingFile(asset, sha256) {
  console.log(`${asset.name} has no VirusTotal report; submitting the public release file.`);
  const bytes = await downloadAsset(asset, sha256);
  const urlResponse = await virusTotalFetch('/files/upload_url');
  if (!urlResponse.ok) throw new Error(`VirusTotal upload URL request failed with ${urlResponse.status}`);

  const uploadUrlValue = (await urlResponse.json())?.data;
  if (typeof uploadUrlValue !== 'string') throw new Error('VirusTotal did not return an upload URL');
  const uploadUrl = getVirusTotalUploadUrl(uploadUrlValue);

  const form = new FormData();
  form.append('file', new Blob([bytes], { type: 'application/octet-stream' }), asset.name);
  const uploadResponse = await virusTotalFetch(uploadUrl.href, { method: 'POST', body: form });
  if (!uploadResponse.ok) throw new Error(`VirusTotal file upload failed with ${uploadResponse.status}`);

  const analysisId = (await uploadResponse.json())?.data?.id;
  if (!analysisId) throw new Error('VirusTotal did not return an analysis ID');

  for (let attempt = 0; attempt < 20; attempt += 1) {
    await wait(30_000);
    const analysisResponse = await virusTotalFetch(`/analyses/${encodeURIComponent(analysisId)}`);
    if (!analysisResponse.ok) {
      throw new Error(`VirusTotal analysis check failed with ${analysisResponse.status}`);
    }

    const status = (await analysisResponse.json())?.data?.attributes?.status;
    if (status !== 'completed') continue;

    const report = await getVirusTotalResult(asset, sha256);
    if (report) return report;
  }

  throw new Error(`VirusTotal did not finish analyzing ${asset.name} in time`);
}

async function readPreviousResults() {
  try {
    return JSON.parse(await readFile(RESULTS_PATH, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return { schemaVersion: 1, release: null, updatedAt: null, files: {} };
    throw error;
  }
}

async function main() {
  if (!API_KEY) {
    console.log('VT_API_KEY is not configured; cached results were left unchanged.');
    return;
  }

  const previous = await readPreviousResults();
  const release = await getRelease();
  const assets = Array.isArray(release.assets) ? release.assets : [];
  const entries = Object.entries(FILES);
  const files = {};

  for (const [index, [key, pattern]] of entries.entries()) {
    const asset = assets.find((candidate) => pattern.test(candidate.name));
    if (!asset) throw new Error(`Could not find the ${key} executable in ${release.tag_name}`);
    if (index > 0) await wait(30_000);

    const sha256 = await getSha256(asset);
    try {
      files[key] = (await getVirusTotalResult(asset, sha256)) || await submitMissingFile(asset, sha256);
    } catch (error) {
      const cached = previous.files?.[key];
      if (cached?.sha256 === sha256 && cached.status === 'available') {
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

  if (sameResultData(next, previous)) {
    console.log(`VirusTotal results for ${release.tag_name} are already current.`);
    return;
  }

  next.updatedAt = new Date().toISOString();
  await writeFile(TEMP_RESULTS_PATH, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
  await rename(TEMP_RESULTS_PATH, RESULTS_PATH);
  console.log(`Updated cached VirusTotal results for ${release.tag_name}.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
