# Browser interfaces

`web/browser-service.js` exports `BrowserHub`, the shared `hub`, `mediaUrl(kind, id)`, and timezone/countdown helpers. `web/app.js` calls `hub.request(path, method, body)` asynchronously; these action names are in-process calls, not HTTP endpoints.

Supported actions cover state snapshots, settings, records, scene controls, simulated scans, encounters, logs, city search, and audio import/delete. The included catalog in `web/audio-manifest.js` uses relative static URLs; personal imports use Blob URLs from `mediaUrl`. Included items are combined with personal imports in snapshots and never copied into IndexedDB. The `hidden_audio` data key persists local removals; the audio restore action clears only that key. Importing an identical included file restores/reuses its entry by SHA-256 instead of storing a duplicate. CSV logs download locally. State snapshots retain the shape used by the canvas and UI renderers. Media pairings are explicit in `web/media-manifest.js`.

The version-1 `halloween-hub-web` IndexedDB database stores settings, records, detections, weather, and candy as separate keys in `data`, and content-addressed audio Blobs in `audio`. Transaction completion precedes updating the corresponding in-memory data. A rejected save never replaces the prior saved value. If database opening is denied, the app reports temporary storage and leaves existing disk data untouched. A version change in another tab requires reload before persistent editing can continue. Different tabs do not synchronize live; use one editing tab per device.

Running scenes, adventures, scan state, audio playback, and Blob URLs are ephemeral. They are rebuilt/stopped on a page reload. The previous intro selection is remembered locally where browser storage permits it.

Forecast and geocoding requests go directly to Open-Meteo over HTTPS with a six-second timeout. Forecast data is cached for 15 minutes; failed refreshes back off for a minute. Missing or stale weather never substitutes decorative weather effects for measured data.

The service worker handles only same-origin, scope-relative shell/art/sound resources. It precaches the included MP3s and serves audio byte ranges from the cached full files for offline playback. Video and non-audio byte-range requests pass through to the host. No personal data or external API responses enter Cache Storage. A content-derived cache name avoids mixing old and new shell resources across deployments.
