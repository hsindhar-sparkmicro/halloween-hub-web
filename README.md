# Halloween Hub

A Halloween playground that runs entirely in your browser: a cinematic pumpkin dashboard, eight animated haunted scenes, games and branching stories, a party planner, and a pretend Ghost Detector.

**Live site:** https://hsindhar-sparkmicro.github.io/halloween-hub-web/

Touch the pumpkin for Play, Story, and Surprise. Idle backgrounds come alive silently at half speed with 3.5-second fades. Autumn leaves, wind, and winter flurries decorate the night while the actual weather forecast remains separate. Layouts support 800×480, phones, and large displays.

## Use

Open the live site in a current Chrome, Edge, Firefox, or Safari browser. Audio starts only after you choose to play it. Fullscreen depends on browser support.

Settings, guests, tasks, simulated detections, and imported MP3/WAV/OGG audio stay in **this browser on this device**, using IndexedDB. Nothing is uploaded. Site data is separate across devices, browser profiles, and website origins. Clearing site data removes your saved information. If storage is blocked, the app displays a notice and uses temporary memory; failed saves preserve existing stored data.

Choose your city in Settings for real weather from Open-Meteo. The initial timezone follows your browser; you can change it using an IANA name such as `America/Toronto`. Forecasts refresh at most every 15 minutes and show stale status when offline. This is a non-commercial entertainment site using the free weather service.

Six music tracks and ten effects from the original kiosk are included in Party Hub → Library and Spooky sounds. Shuffle, previews, and scene effects use them immediately after you choose to play. Removing an included item hides it only on this browser; **Restore included soundtrack** brings it back without changing your imports.

After the first successful load and offline-cache installation, the interface, artwork, included music/effects, synthesized sounds, games, and local data work offline. Videos stream on demand and may require connectivity; unavailable videos fall back to artwork/adventures. City search and forecast updates require Internet. Offline caching depends on available browser storage.

All haunted-house controls and Ghost Detector readings are simulations. There is no camera, microphone, physical sensor, account, shared database, or Python runtime behind the website. Scenes and scans stop on reload, and audio starts muted.

## Local preview and checks

Python is used only for development tools, not by the deployed application:

```sh
python3 scripts/build_web.py
python3 -m http.server 8080 --directory dist/site
```

Open `http://localhost:8080/`. Preview over HTTP; opening `index.html` directly does not support browser modules, storage, or service workers reliably.

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements-dev.txt
.venv/bin/python -m playwright install chromium
.venv/bin/python -m unittest discover -s tests/web -v
```

The checks serve the real `/halloween-hub-web/` project path, verify persistence and media playback, and exercise adventures, simulations, weather errors, storage errors, offline reload, and multiple display sizes.

## Publishing

The public repository deploys its `main` branch through GitHub Actions to GitHub Pages. Select **GitHub Actions** as the Pages source. Each build stages only `web/`, with a cache version derived from file content. Push a correction to redeploy; reverting a commit restores the previous application on the next deployment. Existing browser data is kept between application updates.

The original private project's `generic` branch contains the same generic source. Publish updates by copying the explicit public file set (`web/`, `scripts/build_web.py`, `tests/web/`, the Pages workflow, development requirements, README, credits, and `.gitignore`) into the public repository. Keep its history independent of the private project.

See [browser interfaces](BROWSER.md) and [asset credits](ARTWORK.md).
