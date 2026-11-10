# LyricsStatus Website

The official LyricsStatus download site at [selfsecured.me](https://selfsecured.me/).
It is plain HTML, CSS, and JavaScript and is published from the `mai` branch.

## VirusTotal release checks

The site reads public scan summaries from `virustotal-results.json`. The updater
checks the SHA-256 hashes of the latest installer and portable release, then
stores only the release tag, file hashes, report links, engine counts, and
analysis dates here. The API key is used only by GitHub Actions and must never
be added to the site or its source files.

To enable scans, add a newly rotated VirusTotal key as the Actions secret
`VT_API_KEY` in this repository. Then run **Actions → Refresh VirusTotal
results → Run workflow**, optionally entering an exact release tag. The
workflow also checks for updates every six hours. New app releases dispatch it
with their exact tag when `WEBSITE_ACTIONS_TOKEN` is configured in the app
repository.

When VirusTotal has no report for a release file, the updater submits that
public installer or portable executable for analysis. VirusTotal notes that
submitted files are scanned and added to its community dataset, so this is
appropriate only for files already intended to be public.

## Local preview

Serve this directory over HTTP (for example, `python -m http.server 4173`) and
open `http://127.0.0.1:4173/`. The HTTP server lets the page load the JSON scan
cache and the public GitHub release metadata.
