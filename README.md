<h1 align="center">pi-welcome-screen</h1>

<p align="center">
  Customizable animated ASCII welcome overlay for <a href="https://github.com/oh-my-pi/oh-my-pi">Oh-My-Pi</a> / Pi.<br/>
  Shows on session start with an animated banner, stacked info panel, dismiss hint, and optional terminal-driven second banner.
</p>

<p align="center">
  <img src="https://github.com/seenark/pi-welcome-screen/blob/main/assets/show-case.png?raw=true" alt="pi-welcome-screen showcase" width="1100" />
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@codesook/pi-welcome-screen"><img src="https://img.shields.io/npm/v/@codesook/pi-welcome-screen?color=mauve&label=npm" alt="npm" /></a>
  <img src="https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/No_Build_Step-jiti-green" alt="No build step" />
</p>

---

## ✨ Features

- **6 built-in animation styles** — `wave`, `rainbow`, `glitch`, `matrix`, `typewriter`, `static`
- **Custom ASCII banner support** — load `banner.txt` from your Pi agent config directory or any explicit file path
- **Stacked info panel** — version, model, keyboard tips, loaded resources, and recent sessions under the banner
- **Two banner sources** — built-in or custom ASCII banner, plus an optional terminal-rendered CLI banner below it
- **Terminal-aware CLI banner capture** — PTY-backed execution, full-screen redraw handling, preserved ANSI foreground/background colors, and frame coalescing
- **Configurable dismissal** — wait for keypress, auto-dismiss after countdown, or dismiss manually with commands
- **Catppuccin Mocha palette** — all visible colors referenced by palette name
- **TypeScript extension with no build step** — loaded directly by Pi via jiti

## 📦 Install

```bash
# From npm
omp install npm:@codesook/pi-welcome-screen

# Run without installing
omp -e npm:@codesook/pi-welcome-screen

# From git
omp install git:github.com/seenark/pi-welcome-screen

# Local development checkout
git clone https://github.com/seenark/pi-welcome-screen.git
cd pi-welcome-screen
pi -e .
```

After installation, start `omp` or `pi` normally. The extension registers itself and shows the welcome overlay automatically.

## 🚀 Quick start

Create a config file with only the fields you want to override:

**`~/.config/codesook-omp/welcome-screen.json`**

```json
{
    "mainText": "Your Name",
    "url": "https://yourwebsite.dev",
    "animationStyle": "rainbow",
    "animationColor": "pink",
    "countdown": -1,
    "showInfoPanel": true
}
```

Reload without restarting the agent:

```text
/welcome-reload
```

## 🖼️ Custom banner

Replace the built-in ASCII banner with your own text file.

Default location:

**`~/.pi/agent/pi-welcome-screen/banner.txt`**

```text
 ██████╗ ██████╗ ██████╗ ███████╗    ███████╗ ██████╗  ██████╗ ██╗  ██╗
██╔════╝██╔═══██╗██╔══██╗██╔════╝    ██╔════╝██╔═══██╗██╔═══██╗██║ ██╔╝
██║     ██║   ██║██║  ██║█████╗      ███████╗██║   ██║██║   ██║█████╔╝
██║     ██║   ██║██║  ██║██╔══╝      ╚════██║██║   ██║██║   ██║██╔═██╗
╚██████╗╚██████╔╝██████╔╝███████╗    ███████║╚██████╔╝╚██████╔╝██║  ██╗
 ╚═════╝ ╚═════╝ ╚═════╝ ╚══════╝    ╚══════╝ ╚═════╝  ╚═════╝ ╚═╝  ╚═╝
```

Or point to any file:

```json
{
    "bannerFile": "/path/to/my-banner.txt"
}
```

Banner search order:

1. Explicit `bannerFile`
2. `PI_CODING_AGENT_DIR/pi-welcome-screen/banner.txt` when `PI_CODING_AGENT_DIR` is set
3. `~/.pi/agent/pi-welcome-screen/banner.txt`
4. `~/.omp/agent/pi-welcome-screen/banner.txt`
5. `./welcome-screen.banner.txt`

Tip: keep the banner reasonably narrow. `terminalBannerColumns: 0` uses the current main banner width as the terminal-banner width.

## 🖥️ Optional terminal banner

You can render a second animated banner by running a local CLI command inside a PTY-backed terminal session. The output is captured and displayed directly below the built-in or custom banner.

```json
{
    "terminalBannerCommand": "script -q /dev/null ascii-animation run",
    "terminalBannerRows": 8,
    "terminalBannerColumns": 0,
    "terminalBannerFrameDelayMs": 33
}
```

Notes:

- `terminalBannerCommand` is executed by your local shell. Keep it in trusted, user-controlled config only.
- Commands that expect a real TTY often need a wrapper such as `script -q /dev/null ...`.
- `terminalBannerRows` is clamped to `1..40`.
- `terminalBannerColumns` is clamped to `0..200`. `0` means “match the current main banner width”.
- On Bun runtimes the extension uses `Bun.Terminal` when available. On Node/Pi runtimes it falls back to a `python3` PTY bridge, so `python3` must be present on `PATH`.
- The renderer preserves ANSI SGR foreground/background colors, keeps the previous frame visible during clear/redraw cycles, and publishes frames at the configured cadence.

## ⚙️ Configuration

Config file search order:

1. `PI_CODING_AGENT_DIR/pi-welcome-screen/settings.json` when `PI_CODING_AGENT_DIR` is set
2. `~/.config/codesook-omp/welcome-screen.json`
3. `~/.pi/agent/pi-welcome-screen/settings.json`
4. `~/.omp/agent/pi-welcome-screen/settings.json`
5. `~/.pi/welcome-screen.config.json`
6. `./welcome-screen.config.json`

`~/.config/codesook-omp/welcome-screen.json` is the recommended shared config path. The `.pi` and `.omp` agent paths are still supported for compatibility.

### Text and animation

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `mainText` | string | `"CodeSook"` | Text shown below the banner |
| `url` | string | `"https://codesook.dev"` | URL shown below the main text |
| `animationStyle` | string | `"rainbow"` | One of `wave`, `rainbow`, `glitch`, `matrix`, `typewriter`, `static` |
| `animationText` | string | `"Welcome"` | Text source for animation modes that use it |
| `frameDelayMs` | number | `80` | Milliseconds between built-in banner frames, `0..1000` |
| `bannerFile` | string | `""` | Path to a custom banner file |
| `terminalBannerCommand` | string | `""` | Shell command for the optional terminal banner; empty disables it |
| `terminalBannerRows` | number | `6` | Visible row count for the terminal banner |
| `terminalBannerColumns` | number | `0` | Visible column count for the terminal banner; `0` matches the main banner width |
| `terminalBannerFrameDelayMs` | number | `33` | Minimum milliseconds between terminal-banner publishes, `0..1000` |

### Layout and behavior

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `paddingTop` | number | `2` | Blank lines before content when `showPadding` is enabled |
| `paddingBottom` | number | `2` | Blank lines after content when `showPadding` is enabled |
| `borderStyle` | string | `"rounded"` | Border style: `rounded`, `square`, `double`, `minimal` |
| `minTerminalWidth` | number | `80` | Hide the overlay below this terminal width |
| `overlayWidth` | number | `120` | Target overlay width before clipping to terminal width |
| `countdown` | number | `-1` | `-1` wait for keypress, `0` never dismiss, `>0` seconds |
| `debug` | boolean | `false` | Keep the overlay visible; also logs terminal-banner stderr/failures |
| `enableScrolling` | boolean | `true` | Enable scroll mode when content is taller than the visible area |
| `bgFillChar` | string | `""` | Accepted config field kept for compatibility; no visible effect in the current overlay implementation |

### Colors

All color fields accept Catppuccin Mocha names.

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `fgColor` | string | `"lavender"` | Main text color |
| `bgColor` | string | `"base"` | Reserved config field; not currently rendered as a background fill |
| `accentColor` | string | `"blue"` | Accent color used in the info panel |
| `urlColor` | string | `"sapphire"` | URL color |
| `animationColor` | string | `"pink"` | Highlight color for built-in banner animation |

### Visibility toggles

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `showBanner` | boolean | `true` | Show the built-in or custom ASCII banner |
| `showMainText` | boolean | `true` | Show the main text line |
| `showUrl` | boolean | `true` | Show the URL line |
| `showCountdown` | boolean | `true` | Show dismiss / scroll hint text |
| `showPadding` | boolean | `true` | Show top and bottom blank padding |
| `showBorder` | boolean | `true` | Show the border box |

### Info panel

The info panel is stacked below the banner content.

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `showInfoPanel` | boolean | `true` | Show the info panel block |
| `showVersion` | boolean | `true` | Show Pi/OMP version plus keybindings |
| `showModel` | boolean | `true` | Show model name and provider |
| `showTips` | boolean | `true` | Show keyboard tips |
| `showLoaded` | boolean | `true` | Show counts for context files, extensions, prompt templates, and themes |
| `showResources` | boolean | `true` | Show resource name lists for context files, extensions, prompts, and themes |
| `showSessions` | boolean | `true` | Show recent sessions |
| `infoPanelSections` | string[] | `["version","model","tips","loaded","resources","sessions"]` | Deprecated compatibility field. If present, it back-fills the corresponding `show*` booleans unless those are explicitly set |
| `modelName` | string | `""` | Override model name; empty auto-detects from Pi context |
| `providerName` | string | `""` | Override provider name; empty auto-detects from Pi context |
| `logoChar` | string | `"π"` | Accepted config field kept for compatibility; currently unused by the overlay renderer |

### Catppuccin Mocha palette

| Name | Hex | Name | Hex |
| --- | --- | --- | --- |
| `rosewater` | `#f5e0dc` | `flamingo` | `#f2cdcd` |
| `pink` | `#f5c2e7` | `mauve` | `#cba6f7` |
| `red` | `#f38ba8` | `maroon` | `#eba0ac` |
| `peach` | `#fab387` | `yellow` | `#f9e2af` |
| `green` | `#a6e3a1` | `teal` | `#94e2d5` |
| `sky` | `#89dceb` | `sapphire` | `#74c7ec` |
| `blue` | `#89b4fa` | `lavender` | `#b4befe` |
| `text` | `#cdd6f4` | `subtext1` | `#bac2de` |
| `subtext0` | `#a6adc8` | `overlay2` | `#9399b2` |
| `overlay1` | `#7f849c` | `overlay0` | `#6c7086` |
| `surface2` | `#585b70` | `surface1` | `#45475a` |
| `surface0` | `#313244` | `base` | `#1e1e2e` |
| `mantle` | `#181825` | `crust` | `#11111b` |

## 🎮 Commands

| Command | Description |
| --- | --- |
| `/welcome-dismiss` | Dismiss the current welcome overlay |
| `/welcome-reload` | Reload config from disk and show the overlay again |

## 🧩 Example configs

### Minimal

```json
{
    "mainText": "acme-corp"
}
```

### Quiet, static banner

```json
{
    "animationStyle": "static",
    "showInfoPanel": false,
    "countdown": 3
}
```

### Branded custom banner

```json
{
    "mainText": "My Brand",
    "url": "https://mybrand.io",
    "bannerFile": "~/.pi/agent/pi-welcome-screen/banner.txt",
    "animationStyle": "rainbow",
    "animationColor": "green"
}
```

### Terminal animation banner

```json
{
    "terminalBannerCommand": "script -q /dev/null ascii-animation run",
    "terminalBannerRows": 8,
    "terminalBannerColumns": 0,
    "terminalBannerFrameDelayMs": 33
}
```

## 🛠️ Development

No build step. Pi loads the TypeScript extension directly through [jiti](https://github.com/unjs/jiti).

```bash
# Install dependencies
bun ci

# Run tests
bun test

# Smoke-test the extension locally
pi -e .
```

If you want to test the optional terminal banner, configure `terminalBannerCommand` and then start a fresh `pi -e .` or `omp -e .` session from this repository so Pi loads the local extension code.

## 📁 Project structure

```text
src/
├── index.ts                # Pi extension entry point and command registration
├── WelcomeOverlay.ts       # Overlay rendering, layout, scrolling, countdown, banner lifecycle
├── WelcomeScreen.ts        # Legacy stub kept for compatibility
├── config.ts               # Defaults, palette, config loading, validation
├── paths.ts                # Config/banner path resolution helpers
├── animations.ts           # Built-in ASCII banner frames
├── renderer.ts             # ANSI helpers, width measurement, centering
├── terminal-banner.ts      # PTY-backed terminal banner capture and headless xterm rendering
├── info-panel.ts           # Loaded resources, version, recent sessions discovery
└── types.ts                # Public config and info-panel types
```

## 🚢 Release

Publishing is handled by `.github/workflows/publish.yml` on pushes to tags matching `v*`.

```bash
git checkout main
git pull
git tag -a v0.4.0 -m "Release v0.4.0"
git push origin v0.4.0
```

The publish workflow:

1. installs dependencies with `bun ci`
2. sets `package.json` version from the git tag
3. runs `bun run lint`, `bun run test`, and `bun run build`
4. runs `npm pack --dry-run`
5. publishes to npm

## 📄 License

MIT © [Code Sook](https://github.com/seenark)
