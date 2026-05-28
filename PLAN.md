# Plan: Configurable Fields with Show/Hide + External Banner Files

## Context

The pi-welcome-screen currently has hardcoded banner art and no per-field visibility toggles. The user wants:
1. **Every visual field** to be hideable via config (default: shown)
2. **Banner art** loadable from external `.txt` files (fallback to built-in default)
3. Banners always centered after loading
4. The current "CodeSook" banner remains the default

## Approach

### A. Add `show*` visibility toggles to `WelcomeConfig` for ALL visual fields

Every piece of visible content gets its own boolean toggle. All default `true`.

**Banner area (left column / single-column top):**

| Field | Controls | Default |
|-------|----------|---------|
| `showBanner` | ASCII art banner | `true` |
| `showMainText` | Main text line ("CodeSook") | `true` |
| `showUrl` | URL line ("https://codesook.dev") | `true` |
| `showCountdown` | "Press any key (Ns)" hint | `true` |
| `showPadding` | Top/bottom empty lines | `true` |
| `showBorder` | Border box around overlay | `true` |

**Info panel sections (right column / single-column bottom):**

| Field | Controls | Default |
|-------|----------|---------|
| `showInfoPanel` | Entire info panel | `true` (already exists) |
| `showVersion` | Pi version + keybindings | `true` |
| `showModel` | Model name + provider | `true` |
| `showTips` | Keyboard tips | `true` |
| `showLoaded` | Loaded counts (ctx, ext, skills…) | `true` |
| `showResources` | Detailed resource listings | `true` |
| `showSessions` | Recent sessions | `true` |

This replaces the old `infoPanelSections` array — individual booleans are simpler and consistent. Keep `infoPanelSections` for backward compat (deprecated): if present in config, it maps to the corresponding `show*` booleans.

### B. External banner file loading (`.txt` only)

**File format — plain text:**
```
 ██████╗ ██████╗ ██████╗ ███████╗    ███████╗ ██████╗  ██████╗ ██╗  ██╗
██╔════╝██╔═══██╗██╔══██╗██╔════╝    ██╔════╝██╔═══██╗██╔═══██╗██║ ██╔╝
```
Each line = one line of banner art. Split by `\n`, strip leading/trailing blank lines. Render each line centered via `centerPadLine()`.

**Search paths** (first found wins):
1. `bannerFile` from config JSON (explicit path, if set)
2. `~/.pi/welcome-screen.banner.txt`
3. `~/.pi/config/welcome-screen.banner.txt`
4. `./welcome-screen.banner.txt`

If no banner file found → use built-in `BANNER_LINES` (current default).

### C. Config file additions

New fields in the JSON config:

```jsonc
{
  // Visibility toggles (all default true)
  "showBanner": true,
  "showMainText": true,
  "showUrl": true,
  "showCountdown": true,
  "showPadding": true,
  "showBorder": true,
  "showInfoPanel": true,
  "showVersion": true,
  "showModel": true,
  "showTips": true,
  "showLoaded": true,
  "showResources": true,
  "showSessions": true,

  // Banner file (optional — omit to use built-in)
  "bannerFile": "/path/to/my-banner.txt"
}
```

## Files to Modify

### `src/types.ts`
- Add new boolean fields to `WelcomeConfig`: `showBanner`, `showMainText`, `showUrl`, `showCountdown`, `showPadding`, `showBorder`, `showVersion`, `showModel`, `showTips`, `showLoaded`, `showResources`, `showSessions`
- Add `bannerFile: string` field
- Deprecate `infoPanelSections` (keep type for backward compat)

### `src/config.ts`
- Add defaults for all new fields to `DEFAULT_CONFIG` (all `true` except `bannerFile: ""`)
- Add `loadBannerFile(config)` function — reads `.txt` from search paths, returns `string[]` of banner lines or `null` if not found
- Add backward-compat mapping: if old `infoPanelSections` is present in user config, set the corresponding `show*` booleans

### `src/animations.ts`
- `buildAnimationFrames()` already accepts `bannerLines: string[]` — no signature change needed
- `getFrameCount()` unchanged

### `src/WelcomeOverlay.ts`
- `buildLeftColumnContent()`: guard banner with `showBanner`, main text with `showMainText`, URL with `showUrl`, padding with `showPadding`
- `buildSingleColumnContent()`: same guards
- `buildOverlayLines()`: guard border rendering with `showBorder`, countdown hint with `showCountdown`
- `buildInfoPanelContent()`: replace `sections.includes("version")` checks with `this.config.showVersion` etc.
- Constructor: accept optional `bannerLines: string[]` override, use in `initFrames()`
- `initFrames()`: use the provided banner lines instead of hardcoded `BANNER_LINES`

### `src/index.ts`
- Call `loadBannerFile(config)` to get custom banner lines
- Pass resolved lines into `WelcomeOverlay` constructor

## Reuse

- `centerPadLine()` in `src/renderer.ts` — already centers + pads lines correctly
- `loadConfig()` / `loadConfigFile()` in `src/config.ts` — extend with banner file loading
- `BANNER_LINES` in `src/animations.ts` — stays as default fallback
- `WelcomeConfig` in `src/types.ts` — extend with new fields
- `existsSync`, `readFileSync` from `node:fs` — already used in info-panel.ts

## Steps

- [ ] Add all new config fields to `src/types.ts` (`WelcomeConfig`)
- [ ] Add defaults in `src/config.ts` (`DEFAULT_CONFIG`)
- [ ] Implement `loadBannerFile()` in `src/config.ts` — parse `.txt`, search paths, return `string[] | null`
- [ ] Add backward-compat mapping for deprecated `infoPanelSections` in `loadConfig()`
- [ ] Update `src/WelcomeOverlay.ts` — accept optional banner lines in constructor
- [ ] Add `show*` guards in `buildLeftColumnContent()`, `buildSingleColumnContent()`, `buildOverlayLines()`, `buildInfoPanelContent()`
- [ ] Update `src/index.ts` — call `loadBannerFile()`, pass result to overlay
- [ ] Verify all defaults match current behavior (no breaking change)

## Verification

1. **No config file present** → behavior identical to current (built-in banner, all fields shown)
2. **Config with `"showBanner": false`** → banner hidden, rest still visible
3. **Config with `"showMainText": false, "showUrl": false`** → banner visible, text lines hidden
4. **Config with `"showBorder": false`** → no border box rendered, content flows freely
5. **Config with `"showPadding": false`** → no top/bottom empty lines
6. **Config with `"showVersion": false`** → version section hidden in info panel
7. **Individual section hide** → each of `showModel`, `showTips`, `showLoaded`, `showResources`, `showSessions` hides its section
8. **Banner `.txt` file** at `~/.pi/welcome-screen.banner.txt` → custom banner loaded, centered
9. **Invalid/missing banner file** → falls back to built-in `BANNER_LINES`
10. **Old `infoPanelSections` config** → correctly maps to new `show*` booleans
11. **Narrow terminal (< 100px)** → single-column layout respects all show/hide flags
