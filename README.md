# ptimer

Three minimal, independent repeat timers. Defaults are 1, 3, and 5 minutes, with custom durations saved on your device.

- Tap to start, pause, or resume.
- Double-tap to reset.
- On completion, the timer shows zero for one second, then restores its preset.
- Use the pencil to edit minutes and seconds directly on the timer, then tap outside the number fields within that timer’s pane, tap the checkmark, or press Enter to save. The speaker toggles sound.

## Run locally

```sh
python3 -m http.server 4173 --directory dist
```

Open http://localhost:4173. No installation or build step is required.

Run the repository checks before publishing:

```sh
node scripts/check.mjs
```

## Install on iPhone

After publication, open https://patriciopdeleon.github.io/ptimer/ in Safari. Choose Share → Add to Home Screen, enable Open as Web App if offered, and tap Add.

The app caches its assets after the first successful online load and works offline. Keep it open for reliable completion sounds: iOS may suspend background web apps, so this is not a native background alarm.

## Publishing and updates

GitHub Pages uses the included GitHub Actions workflow to publish only `dist/` on pushes to `main`. In repository Settings → Pages, select GitHub Actions as the source.

Increment the cache version in `dist/sw.js` whenever changing the app shell. Updates activate once all windows using the old version close, avoiding mid-timer reloads. Offline caching also runs on localhost.

## License

MIT — see LICENSE.
