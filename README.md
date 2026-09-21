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
1. Copy the raw script: [tma-downloader.user.js](https://github.com/Thijs5/toutemonannee-improvements/blob/main/tma-downloader.user.js)
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

## License

MIT License - See [LICENSE](LICENSE) file

## Contributing

Found a bug? Have a feature request?
- Open an [issue](https://github.com/Thijs5/toutemonannee-improvements/issues)
- Submit a [pull request](https://github.com/Thijs5/toutemonannee-improvements/pulls)
