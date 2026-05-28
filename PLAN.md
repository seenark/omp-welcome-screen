# Plan: Add `welcome: false` support to disable welcome banner

## Context

The user sets `"powerline": { "preset": "full", "welcome": false }` in their settings, expecting the welcome banner to be hidden on startup. However, the extension **ignores** the `welcome` field because:

1. `PowerlineConfig` type only has: `preset`, `customItems`, `mouseScroll`, `fixedEditor` — no `welcome` field
2. `parsePowerlineConfig()` never reads `value.welcome`
3. The `session_start` handler checks `settings.quietStartup` (a top-level key, not inside `powerline`) to choose between **overlay** vs **header** — but **both** still show the banner

Current behavior:
- `quietStartup: true` → static header banner (still visible)
- `quietStartup: false` / unset → overlay banner with countdown (still visible)
- `powerline.welcome: false` → **silently ignored**

## Approach

Add a `welcome` field to the `PowerlineConfig` and respect it in the startup logic. When `welcome: false`, skip both the overlay and the header entirely.

## Files to modify

Located in `/Volumes/HadesGodBlue/Learn/public-repos/pi-ext/pi-powerline-footer/`:

1. **`powerline-config.ts`** — Add `welcome` field to `PowerlineConfig` interface and parse it in `parsePowerlineConfig()`
2. **`index.ts`** — Check `config.welcome` in the `session_start` handler before showing the banner

## Reuse

- `parsePowerlineConfig()` already handles unknown fields gracefully (ignores them). We just need to add the new field.
- The `dismissWelcome()` function already exists for cleanup.

## Steps

- [ ] In `powerline-config.ts`: Add `welcome: boolean` to `PowerlineConfig` interface (default: `true`)
- [ ] In `powerline-config.ts`: Parse `value.welcome` in `parsePowerlineConfig()`, treating `false` as opt-out
- [ ] In `index.ts`: Add a guard `if (!config.welcome)` before the welcome overlay/header logic in the `session_start` handler (~line 1240), skipping both `setupWelcomeHeader` and `setupWelcomeOverlay`

## Verification

1. Set `"powerline": { "welcome": false }` in `~/.pi/agent/settings.json`
2. Start `pi` — the welcome banner should **not** appear
3. Remove `welcome: false` or set `"welcome": true` — banner should appear as before
4. Test with `"quietStartup": true` + `"welcome": true` — header should still show
5. Test with `"quietStartup": true` + `"welcome": false` — nothing should show
