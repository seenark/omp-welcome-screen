<h1 align="center">pi-welcome-screen</h1>

<p align="center">
  Customizable animated ASCII art welcome overlay for <a href="https://github.com/oh-my-pi/oh-my-pi">Oh-My-Pi</a>.<br/>
  Shows on session start with animated banner, stacked info panel, countdown, and auto-dismiss.
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

- 🎨 **6 animation styles** — wave, rainbow, glitch, matrix, typewriter, static
- 📦 **Styled overlay box** — box-drawing borders with background fill
- 📊 **Info panel** — model, keyboard tips, loaded resources, recent sessions stacked below the banner
- 🖼️ **Custom banner** — bring your own ASCII art via `banner.txt`
- ⏱️ **Auto-dismiss** — countdown, keypress, or agent activity
- 🖥️ **Optional terminal-animation banner** — run a local CLI to render a second same-size banner below the built-in/custom banner
- 🎨 **Catppuccin Mocha** — full palette, all colors by name

## 📦 Install

```bash
# From npm (recommended)
omp install npm:@codesook/pi-welcome-screen

# Try without installing
omp -e npm:@codesook/pi-welcome-screen

# From git
omp install git:github.com/seenark/pi-welcome-screen

# Local development
git clone https://github.com/seenark/pi-welcome-screen.git
omp -e /path/to/pi-welcome-screen
```

After installing, just start `omp` — the welcome screen appears automatically on every session.

## 🖼️ Custom Banner

Replace the built-in ASCII banner with your own art. Create a plain text file:

**`~/.pi/agent/pi-welcome-screen/banner.txt`**

```
 ██████╗ ██████╗ ██████╗ ███████╗    ███████╗ ██████╗  ██████╗ ██╗  ██╗
██╔════╝██╔═══██╗██╔══██╗██╔════╝    ██╔════╝██╔═══██╗██╔═══██╗██║ ██╔╝
██║     ██║   ██║██║  ██║█████╗      ███████╗██║   ██║██║   ██║█████╔╝
██║     ██║   ██║██║  ██║██╔══╝      ╚════██║██║   ██║██║   ██║██╔═██╗
╚██████╗╚██████╔╝██████╔╝███████╗    ███████║╚██████╔╝╚██████╔╝██║  ██╗
 ╚═════╝ ╚═════╝ ╚═════╝ ╚══════╝    ╚══════╝ ╚═════╝  ╚═════╝ ╚═╝  ╚═╝
```

Or point to any file via config:

```json
{
    "bannerFile": "/path/to/my-banner.txt"
}
```

**Search order** (first found wins):

1. Explicit `bannerFile` path from config
2. `PI_CODING_AGENT_DIR/pi-welcome-screen/banner.txt` when `PI_CODING_AGENT_DIR` is set
3. `~/.pi/agent/pi-welcome-screen/banner.txt`
4. `~/${PI_CONFIG_DIR:-.omp}/agent/pi-welcome-screen/banner.txt`
5. `./welcome-screen.banner.txt` (project root)
> **Tip:** Keep your banner under ~80 characters wide for best results on all terminals.

## ⚙️ Configuration

Create a config file — only the fields you want to override are needed:

**`~/.pi/agent/pi-welcome-screen/settings.json`**

```json
{
    "mainText": "Your Name",
    "url": "https://yourwebsite.dev",
    "animationStyle": "rainbow",
    "animationColor": "pink",
    "borderStyle": "rounded",
    "countdown": -1,
    "showInfoPanel": true
}
```

**Config file search order** (first found wins):

1. `PI_CODING_AGENT_DIR/pi-welcome-screen/settings.json` when `PI_CODING_AGENT_DIR` is set
2. `~/.pi/agent/pi-welcome-screen/settings.json`
3. `~/${PI_CONFIG_DIR:-.omp}/agent/pi-welcome-screen/settings.json`
4. `~/.pi/welcome-screen.config.json` (legacy)
5. `./welcome-screen.config.json` (project root)

### All Options

#### Text & Content

| Option           | Type   | Default                  | Description                                    |
| ---------------- | ------ | ------------------------ | ---------------------------------------------- |
| `mainText`       | string | `"CodeSook"`             | Text shown below the banner                    |
| `url`            | string | `"https://codesook.dev"` | URL shown below main text                      |
| `animationStyle` | string | `"rainbow"`              | Animation style (see below)                    |
| `animationText`  | string | `"Welcome"`              | Text used for some animations                  |
| `frameDelayMs`   | number | `80`                     | Milliseconds between animation frames (0–1000) |
| `bannerFile`     | string | `""`                     | Path to custom banner `.txt` file              |
| `terminalBannerCommand` | string | `""` | Shell command for optional second terminal-animation banner; empty disables it |
| `terminalBannerRows` | number | `6` | Visible rows for optional terminal-animation banner |
| `terminalBannerColumns` | number | `0` | Visible columns for optional terminal-animation banner; `0` matches the current banner width |
| `terminalBannerFrameDelayMs` | number | `33` | Minimum milliseconds between terminal-animation banner renders |
#### Layout

| Option             | Type   | Default     | Description                                             |
| ------------------ | ------ | ----------- | ------------------------------------------------------- |
| `paddingTop`       | number | `2`         | Empty lines above content                               |
| `paddingBottom`    | number | `2`         | Empty lines below content                               |
| `borderStyle`      | string | `"rounded"` | Border style: `rounded`, `square`, `double`, `minimal`  |
| `bgFillChar`       | string | `""`        | Background fill character (e.g. `"░"`). Empty = no fill |
| `minTerminalWidth` | number | `80`        | Hide overlay if terminal is narrower than this          |
| `overlayWidth`     | number | `120`       | Width of the overlay box                                |

#### Behavior

| Option            | Type    | Default | Description                                                   |
| ----------------- | ------- | ------- | ------------------------------------------------------------- |
| `countdown`       | number  | `-1`    | `-1` = wait for keypress, `0` = never dismiss, `>0` = seconds |
| `debug`           | boolean | `false` | Overlay stays visible forever (never auto-dismisses)          |
| `enableScrolling` | boolean | `true`  | Allow arrow-key scrolling when content overflows              |

#### Colors (Catppuccin Mocha names)

| Option           | Type   | Default      | Description                            |
| ---------------- | ------ | ------------ | -------------------------------------- |
| `fgColor`        | string | `"lavender"` | Main text color                        |
| `bgColor`        | string | `"base"`     | Background color                       |
| `accentColor`    | string | `"blue"`     | Border / accent color                  |
| `urlColor`       | string | `"sapphire"` | URL text color                         |
| `animationColor` | string | `"pink"`     | Animation / highlighted elements color |

#### Visibility Toggles

| Option          | Type    | Default | Description                           |
| --------------- | ------- | ------- | ------------------------------------- |
| `showBanner`    | boolean | `true`  | Show the ASCII art banner             |
| `showMainText`  | boolean | `true`  | Show the main text line               |
| `showUrl`       | boolean | `true`  | Show the URL line                     |
| `showCountdown` | boolean | `true`  | Show countdown / "press any key" hint |
| `showPadding`   | boolean | `true`  | Show top/bottom padding               |
| `showBorder`    | boolean | `true`  | Show the border box                   |

#### Info Panel

The info panel appears below the banner on all terminal widths.

| Option              | Type     | Default                                                      | Description                                     |
| ------------------- | -------- | ------------------------------------------------------------ | ----------------------------------------------- |
| `showInfoPanel`     | boolean  | `true`                                                       | Show the info panel                             |
| `showVersion`       | boolean  | `true`                                                       | Show OMP/Pi CLI version                         |
| `showModel`         | boolean  | `true`                                                       | Show model name & provider                      |
| `showTips`          | boolean  | `true`                                                       | Show keyboard tips                              |
| `showLoaded`        | boolean  | `true`                                                       | Show loaded counts (context files, extensions, prompts, themes) |
| `showResources`     | boolean  | `true`                                                       | Show detailed resource listings (context files, extensions, prompts, themes) |
| `showSessions`      | boolean  | `true`                                                       | Show recent sessions                            |
| `infoPanelSections` | string[] | `["version","model","tips","loaded","resources","sessions"]` | Section order                                   |
| `modelName`         | string   | `""`                                                         | Override model name (auto-detected if empty)    |
| `providerName`      | string   | `""`                                                         | Override provider name (auto-detected if empty) |
| `logoChar`          | string   | `"π"`                                                        | Character used for the logo                     |


`terminalBannerCommand` is executed by the local shell. Keep it in user-controlled config only; do not feed untrusted input into it. Terminal banner output is captured through Bun.Terminal when available, with a Python stdlib PTY bridge fallback for Node/Pi runtimes. The parser preserves SGR foreground/background colors and publishes frames at the configured cadence so clear/redraw animations do not expose partial frames.
### Animation Styles

| Style        | Description                                        |
| ------------ | -------------------------------------------------- |
| `wave`       | Letters shift with a sinusoidal wave effect        |
| `rainbow`    | Each line cycles through the Catppuccin spectrum   |
| `glitch`     | Random glitch artifacts appear on lines            |
| `matrix`     | Text is revealed from left to right (Matrix-style) |
| `typewriter` | Characters appear one-by-one                       |
| `static`     | No animation — banner shown in full color          |

### Border Styles

| Style     | Corners         | Sides   |
| --------- | --------------- | ------- |
| `rounded` | `╭` `╮` `╰` `╯` | `│` `─` |
| `square`  | `┌` `┐` `└` `┘` | `│` `─` |
| `double`  | `╔` `╗` `╚` `╝` | `║` `═` |
| `minimal` | `+` `+` `+` `+` | `│` `─` |

### Color Palette (Catppuccin Mocha)

All color options accept these names:

| Name       | Hex       | Preview | Name        | Hex       | Preview |
| ---------- | --------- | ------- | ----------- | --------- | ------- |
| `base`     | `#1e1e2e` | 🟣      | `lavender`  | `#b4befe` | 💜      |
| `mantle`   | `#181825` | ⬛      | `blue`      | `#89b4fa` | 💙      |
| `crust`    | `#11111b` | ⬛      | `sapphire`  | `#74c7ec` | 🩵      |
| `surface0` | `#313244` | 🔘      | `sky`       | `#89dceb` | 🩵      |
| `surface1` | `#45475a` | 🔘      | `teal`      | `#94e2d5` | 🩵      |
| `surface2` | `#585b70` | 🔘      | `green`     | `#a6e3a1` | 💚      |
| `overlay0` | `#6c7086` | 🔘      | `yellow`    | `#f9e2af` | 💛      |
| `overlay1` | `#7f849c` | 🔘      | `peach`     | `#fab387` | 🧡      |
| `overlay2` | `#9399b2` | 🔘      | `maroon`    | `#eba0ac` | 🩷      |
| `subtext0` | `#a6adc8` | 🔘      | `red`       | `#f38ba8` | ❤️      |
| `subtext1` | `#bac2de` | 🔘      | `mauve`     | `#cba6f7` | 💜      |
| `text`     | `#cdd6f4` | ⬜      | `pink`      | `#f5c2e7` | 🩷      |
|            |           |         | `flamingo`  | `#f2cdcd` | 🩷      |
|            |           |         | `rosewater` | `#f5e0dc` | 🩷      |

## 🎮 Commands

| Command            | Description                          |
| ------------------ | ------------------------------------ |
| `/welcome-dismiss` | Manually dismiss the welcome overlay |
| `/welcome-reload`  | Reload config and reshow the overlay |

## 🧩 Example Configs

### Minimal — just change the name

```json
{
    "mainText": "acme-corp"
}
```

### Dark cyberpunk theme

```json
{
    "mainText": "NEON::CORP",
    "url": "https://neon.corp",
    "animationStyle": "glitch",
    "animationColor": "red",
    "fgColor": "red",
    "urlColor": "mauve",
    "borderStyle": "double",
    "bgFillChar": "░"
}
```

### Clean & minimal — no animation, no border

```json
{
    "mainText": "my-project",
    "url": "https://github.com/me/my-project",
    "animationStyle": "static",
    "animationColor": "blue",
    "showBorder": false,
    "showInfoPanel": false,
    "paddingTop": 1,
    "paddingBottom": 0,
    "countdown": 3
}
```

### Custom banner with your brand

```json
{
    "mainText": "My Brand",
    "url": "https://mybrand.io",
    "bannerFile": "~/.omp/agent/pi-welcome-screen/banner.txt",
    "animationStyle": "rainbow",
    "animationColor": "green"
}
```

### Terminal animation CLI banner

```json
{
    "terminalBannerCommand": "ascii-animation run",
    "terminalBannerRows": 8,
    "terminalBannerColumns": 100,
    "terminalBannerFrameDelayMs": 33
}
```

## 🛠️ Development

No build step — Oh-My-Pi loads TypeScript directly via [jiti](https://github.com/unjs/jiti).

```bash
# Test locally
omp -e .

# Install from local path
omp install /path/to/pi-welcome-screen
```

## 📁 Project Structure

```
src/
├── index.ts           # Entry point — Oh-My-Pi extension factory
├── WelcomeOverlay.ts  # Overlay component with stacked layout
├── config.ts          # Defaults, Catppuccin palette, config loading
├── animations.ts      # ASCII banner data + frame builders per style
├── renderer.ts        # ANSI escape codes, color mapping, centering
├── info-panel.ts      # Loaded counts, recent sessions discovery
└── types.ts           # Config interface, animation & border types
```

## 📄 License

MIT © [Code Sook](https://github.com/seenark)
