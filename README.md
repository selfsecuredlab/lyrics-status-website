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

The key stays inside GitHub Actions. The workflow publishes only file hashes, detection totals, and report dates.

## License

Licensed under the MIT License.
