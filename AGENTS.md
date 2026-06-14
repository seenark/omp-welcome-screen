# AGENTS.md — pi-welcome-screen

> Guidance for AI coding agents working on this project.

## Project Summary

**pi-welcome-screen** is a Pi extension that displays a full-screen animated ASCII art welcome banner when Pi starts. It is a TypeScript module that exports a **default factory function** `(pi: ExtensionAPI) => void` — this is the Pi extension contract.

- **Language:** TypeScript (ESM modules)
- **Runtime:** Node.js ≥ 22 (loaded via Pi's jiti runtime)
- **No build step:** Pi loads TypeScript extensions directly via jiti
- **Test:** Manual testing with `pi -e .`

## Source Structure

```
src/
├── index.ts           # Entry point — exports default factory function
├── WelcomeOverlay.ts  # Overlay component with two-column layout support
├── WelcomeScreen.ts   # Legacy stub (kept for backwards compat)
├── config.ts          # Defaults, Catppuccin Mocha palette, config file loading, validation
├── animations.ts      # ASCII banner data, frame builders for each animation style
├── renderer.ts        # ANSI escape code utilities, color mapping, line centering/fitting
├── info-panel.ts      # Discovery functions for loaded counts, recent sessions
└── types.ts           # WelcomeConfig interface, AnimationStyle type, InfoPanelData
```

## Key Concepts

### Pi Extension Contract

- `package.json` has a `"pi"` field with `"extensions": ["./src/index.ts"]` — Pi uses this to discover the extension.
- The extension **must export a default function** `(pi: ExtensionAPI) => void`. This is NOT a class — it's a factory function.
- Pi loads extensions via jiti, so **TypeScript works without compilation**.
- Inside the factory, use `pi.on(event, handler)` to subscribe to events and `pi.registerCommand()` / `pi.registerTool()` to add functionality.

### How the Welcome Screen Works

1. Extension subscribes to `session_start` event
2. On session start, calls `ctx.ui.custom()` with an overlay factory function
3. The returned `Component` implements `render(width: number): string[]` — Pi's TUI calls this on every animation frame tick
4. Each `render()` call advances the frame index based on elapsed time and returns colored lines with embedded ANSI codes

### Two-Column Layout

When `showInfoPanel: true` (default) and terminal width >= 100, the overlay displays:
- **Left column:** Animated ASCII banner + main text + URL
- **Right column:** Info panel with:
  - Model name and provider
  - Keyboard tips
  - Loaded counts (extensions, context files, prompt templates, themes)
  - Recent sessions

### Config System

Config is loaded from file only (no constructor overrides in the extension):

1. **Built-in defaults** in `config.ts` (`DEFAULT_CONFIG`)
2. **Config file** at `~/.pi/welcome-screen.config.json` (or `~/.pi/config/welcome-screen.json` or `./welcome-screen.config.json`)

### Animation System

Frame-based: `animations.ts` pre-builds all frames as `string[][]` on construction. Each `render()` call advances the frame index based on elapsed time and `frameDelayMs`.

Supported styles: `wave`, `rainbow`, `glitch`, `matrix`, `typewriter`, `static`.

### Color System

All colors are referenced by **Catppuccin Mocha name** (e.g., `"lavender"`, `"pink"`) — never raw hex. The palette is defined in `config.ts` as `CATPPUCCIN_MOCHA`. `renderer.ts` converts names to 24-bit ANSI escape codes (`\x1b[38;2;R;G;Bm`).

Animation frames use **color markers** (`\x00COLOR:<name>\x00`) that are resolved to actual ANSI codes at render time.

## Development Commands

```bash
# Test locally with Pi
pi -e .

# Or add to settings.json extensions array and run pi normally
```

No build, install, or compile steps needed.

## Code Style & Conventions

- **ESM modules** with `.js` extensions in imports (NodeNext resolution).
- **TypeScript** — no `any`, no implicit returns.
- The extension entry point (`index.ts`) must `export default function(pi: ExtensionAPI) { ... }`.
- Color names are always Catppuccin Mocha palette keys (string literals).
- ANSI escape codes are built programmatically in `renderer.ts` — never hardcoded in component logic.

## Key Files to Read First

1. `src/types.ts` — understand the config shape, animation types, and info panel data types
2. `src/index.ts` — understand the extension factory and Component implementation
3. `src/WelcomeOverlay.ts` — understand the overlay rendering with two-column layout
4. `src/animations.ts` — understand how frames are generated per style
5. `src/renderer.ts` — understand ANSI color utilities
6. `src/config.ts` — understand defaults, palette, and config loading
7. `src/info-panel.ts` — understand how loaded counts, resource names, and recent sessions are discovered; it intentionally does not scan skill directories

## Common Tasks

| Task | What to do |
|---|---|
| Add a new animation style | Add the style name to `AnimationStyle` in `types.ts`, add a frame count in `getFrameCount()` and a frame builder in `buildAnimationFrames()` in `animations.ts`. |
| Add a new config field | Add it to `WelcomeConfig` in `types.ts`, add a default in `DEFAULT_CONFIG` in `config.ts`, and use it in `index.ts`. |
| Change the color palette | Replace or extend `CATPPUCCIN_MOCHA` in `config.ts`. All code references colors by name. |
| Change the ASCII banner | Edit `BANNER_LINES` in `animations.ts`. Each line is one row of the banner. |
| Fix terminal width handling | Edit `centerLine()` and `fitLine()` in `renderer.ts`. |
| Add info panel section | Add to `InfoPanelSection` in `types.ts`, implement in `buildInfoPanelContent()` in `WelcomeOverlay.ts`. |

## Reference

- [Pi Extensions Docs](https://github.com/earendil-works/pi-mono/blob/main/packages/coding-agent/docs/extensions.md)
- [Pi TUI Docs](https://github.com/earendil-works/pi-mono/blob/main/packages/coding-agent/docs/tui.md)
- [Pi Packages Docs](https://github.com/earendil-works/pi-mono/blob/main/packages/coding-agent/docs/packages.md)
- Example: [custom-header.ts](https://github.com/earendil-works/pi-mono/blob/main/packages/coding-agent/examples/extensions/custom-header.ts)
