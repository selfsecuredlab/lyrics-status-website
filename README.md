# LyricsStatus Website

The official website for [LyricsStatus](https://github.com/selfsecuredlab/lyrics-status).

## Website

[selfsecured.me](https://selfsecured.me/)

## Local preview

Open `index.html` in a browser. The site is plain HTML, CSS, and JavaScript with no build step.

## Downloads

Windows builds are published on the [LyricsStatus releases page](https://github.com/selfsecuredlab/lyrics-status/releases/latest).

## VirusTotal results

The download page reads its scan summary from `virustotal-results.json`. To enable automatic refreshes:

1. Add a repository Actions secret named `VT_API_KEY` containing your VirusTotal API key.
2. Open **Actions → Refresh VirusTotal results → Run workflow**.

The key stays inside GitHub Actions. If VirusTotal has not seen a public release file yet, the workflow submits it for analysis and waits for the report. The website receives only file hashes, detection totals, and report dates.

New app releases trigger this workflow automatically with their exact tag. The app repository stores a fine-grained `WEBSITE_ACTIONS_TOKEN` that is limited to running Actions in this repository; the VirusTotal key remains here and is never shared with the app workflow.

## License

Licensed under the MIT License.
