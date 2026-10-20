# TMA Gallery Downloader

Download photos from TouteMonAnnée galleries with one click.

<img width="922" height="1029" alt="image" src="https://github.com/user-attachments/assets/8dd9ff0a-619b-47c1-9af7-174227a349e7" />

## Features

- 📥 Download single photos with one click (or press `D`)
- 📦 Batch download entire galleries
- 🏷️ Auto-numbered filenames with timestamps

## Installation

### With Greasy Fork (Recommended)
1. Install a userscript manager:
   - [Tampermonkey](https://www.tampermonkey.net/) (Chrome, Firefox, Edge)
   - [Greasemonkey](https://www.greasespot.net/) (Firefox)
   - [Violentmonkey](https://violentmonkey.github.io/) (Chrome, Firefox, Edge)

2. Click here to install: **[TMA Gallery Downloader on Greasy Fork](https://greasyfork.org/en/scripts/596836-tma-gallery-downloader)**

### Manual Installation
1. Download `tma-downloader.user.js` from the [latest GitHub release](https://github.com/Thijs5/toutemonannee-improvements/releases/latest). The file on `main` is a development copy with a placeholder version.
2. Open Tampermonkey/Greasemonkey dashboard
3. Click "Create new script"
4. Paste the code
5. Save (Ctrl+S)

## Usage

### Download Single Photo
- Click the **⬇ Download** button in the lightbox toolbar
- Or press `D` while viewing a photo

### Download All Photos
- Click the **⬇ All** button in the lightbox toolbar
- Confirm when prompted
- Photos download with delays between requests

## Filename Format

Photos are named: `YYYYMMDDTHHMMSS_###_hash.jpg`

Example: `20260921T211500_001_abc123def.jpg`

- `YYYYMMDDTHHMMSS` = Upload timestamp
- `###` = Sequence number (batch downloads only)
- `hash` = Original filename hash

## Compatibility

Version 1.4 restores the buttons after the October 2026 viewer update. The script
locates the viewer and selected photo through accessibility attributes and the
Close icon, instead of generated CSS class names. Button styling is copied from
an existing viewer control.

## Troubleshooting

### No buttons showing up?
- Open browser console (F12)
- Open a photo in the gallery
- Check console for error messages
- Report issues on [GitHub Issues](https://github.com/Thijs5/toutemonannee-improvements/issues)

### Download failed?
- Console will show exact error reason
- Check your internet connection
- Try downloading again

## Releasing

The source uses `@version 0.0.0` as a development placeholder. Do not update it
manually. Pushing a stable version tag runs
[the release workflow](.github/workflows/release.yml), which sets the version in
the release copy, validates its JavaScript, uploads `tma-downloader.user.js` to a
draft GitHub Release, and then publishes it. The repository source stays unchanged.

Tags can be `v1.4`, `1.4`, or `v1.4.1`; prerelease tags are rejected. Use a version
higher than the one currently published on Greasy Fork. For example, after the
workflow has been pushed to `main`:

```sh
git switch main
git pull --ff-only
git tag v1.4
git push origin v1.4
```

Check the [Actions tab](https://github.com/Thijs5/toutemonannee-improvements/actions)
for the result. A failed upload leaves the release as a draft; rerunning the job
can finish it. Already-published releases are left unchanged on reruns.

### One-time Greasy Fork setup

1. Sign in as the owner of [TMA Gallery Downloader](https://greasyfork.org/en/scripts/596836-tma-gallery-downloader).
2. Open its code synchronization settings and set the sync URL to:
   `https://github.com/Thijs5/toutemonannee-improvements/releases/latest/download/tma-downloader.user.js`.
   Use webhook synchronization rather than automatic polling of `main`.
3. Open Greasy Fork's webhook instructions from your account and copy the payload
   URL and webhook secret it provides.
4. In the [repository webhook settings](https://github.com/Thijs5/toutemonannee-improvements/settings/hooks),
   add a webhook with that payload URL and secret, content type `application/json`,
   and only the **Releases** event enabled. Leave it active.
5. Push your first release tag. Once the release is published, check the webhook
   delivery and the script version on Greasy Fork. If Greasy Fork needs an existing
   asset to accept the sync URL, finish saving its sync settings after this first
   release, then trigger an initial sync manually.

No additional GitHub Actions secrets are needed; the workflow uses the built-in
`GITHUB_TOKEN` with `contents: write`. GitHub Actions must be enabled for the repo.
See [Greasy Fork's official webhook instructions](https://github.com/greasyfork-org/greasyfork/blob/main/app/views/users/webhook_info.html.erb).

To check release preparation locally without publishing:

```sh
node --test .github/scripts/prepare-release.test.mjs
node .github/scripts/prepare-release.mjs v1.4 tma-downloader.user.js /tmp/tma-release/tma-downloader.user.js
node --check /tmp/tma-release/tma-downloader.user.js
```

## License

MIT License - See [LICENSE](LICENSE) file

## Contributing

Found a bug? Have a feature request?
- Open an [issue](https://github.com/Thijs5/toutemonannee-improvements/issues)
- Submit a [pull request](https://github.com/Thijs5/toutemonannee-improvements/pulls)
