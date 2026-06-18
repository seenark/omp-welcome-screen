import {
  BORDERS,
  colorToAnsi,
  centerPadLine,
  fitLine,
  visibleWidth,
  ansi,
  resolveColorMarkers,
  buildAnimationColorMap,
  normalizeBannerWidth
} from "./renderer.js";
import {
  BANNER_LINES,
  buildAnimationFrames,
  getFrameCount
} from "./animations.js";

export class WelcomeOverlay {
  config;
  frameIndex = 0;
  lastFrameTime = 0;
  frames = [];
  countdown;
  dismissed = false;
  animInterval = null;
  countdownInterval = null;
  done;
  tui = null;
  infoData;
  bannerLines;
  scrollOffset = 0;
  cachedContentLines = [];
  constructor(config, done, infoData, bannerLines) {
    this.config = config;
    this.countdown = config.countdown;
    this.done = done;
    this.bannerLines = normalizeBannerWidth(bannerLines ?? BANNER_LINES);
    this.infoData = infoData ?? {
      modelName: config.modelName || "omp agent",
      providerName: config.providerName || "omp",
      piVersion: "omp",
      recentSessions: [],
      loadedCounts: {
        contextFiles: 0,
        extensions: 0,
        promptTemplates: 0,
        themes: 0
      },
      resourceNames: {
        extensions: [],
        prompts: [],
        themes: [],
        contextFiles: []
      }
    };
    this.initFrames();
    this.startCountdown();
  }
  startAnimation(tui) {
    this.tui = tui;
    if (this.frames.length > 1) {
      this.lastFrameTime = Date.now();
      this.animInterval = setInterval(() => {
        this.tui?.requestRender();
      }, this.config.frameDelayMs);
    }
  }
  initFrames() {
    const totalFrames = getFrameCount(this.config.animationStyle);
    this.frames = buildAnimationFrames(this.config.animationStyle, this.bannerLines, totalFrames);
  }
  invalidate() {
    this.frameIndex = 0;
    this.lastFrameTime = 0;
    this.initFrames();
  }
  handleInput(data) {
    if (this.config.debug)
      return;
    if (data === "\x1B" || data === "\x1B[" || data === "\x1B[27") {
      this.dismiss();
      return;
    }
    if (data === "\r" || data === `
`) {
      this.dismiss();
      return;
    }
    if (this.config.enableScrolling) {
      if (data === "\x1B[A" || data === "\x1BOA") {
        if (this.scrollOffset > 0) {
          this.scrollOffset--;
          this.tui?.requestRender();
        }
        return;
      }
      if (data === "\x1B[B" || data === "\x1BOB") {
        const maxOffset = Math.max(0, this.cachedContentLines.length - this.getVisibleLineCount());
        if (this.scrollOffset < maxOffset) {
          this.scrollOffset++;
          this.tui?.requestRender();
        }
        return;
      }
    }
  }
  dismiss() {
    if (this.dismissed)
      return;
    this.dismissed = true;
    this.stopTimers();
    this.done();
  }
  stopTimers() {
    if (this.animInterval !== null) {
      clearInterval(this.animInterval);
      this.animInterval = null;
    }
    if (this.countdownInterval !== null) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }
    this.tui = null;
  }
  dispose() {
    this.stopTimers();
  }
  getCountdown() {
    return this.countdown;
  }
  isDismissed() {
    return this.dismissed;
  }
  getTerminalRows() {
    return typeof process !== "undefined" && process.stdout?.rows ? process.stdout.rows : 24;
  }
  getVisibleLineCount() {
    const termRows = this.getTerminalRows();
    const overhead = 3;
    const maxRows = Math.floor(termRows * 0.8) - overhead;
    return Math.max(maxRows, 5);
  }
  render(termWidth) {
    if (this.dismissed) {
      return [];
    }
    if (termWidth < this.config.minTerminalWidth) {
      return [];
    }
    const now = Date.now();
    if (this.frames.length > 1 && now - this.lastFrameTime >= this.config.frameDelayMs) {
      this.frameIndex = (this.frameIndex + 1) % this.frames.length;
      this.lastFrameTime = now;
    }
    return this.buildOverlayLines(termWidth);
  }
  buildOverlayLines(termWidth) {
    const boxWidth = Math.min(termWidth - 2, Math.max(this.config.overlayWidth, 40));
    const leftMargin = Math.max(0, Math.floor((termWidth - boxWidth) / 2));
    const leftPad = " ".repeat(leftMargin);
    const dimColor = colorToAnsi("overlay0");
    const borderName = this.config.borderStyle;
    const b = BORDERS[borderName];
    const innerWidth = boxWidth - 2;
    const minLayoutWidth = 50;
    if (innerWidth < minLayoutWidth) {
      return [];
    }
    const contentLines = this.buildStackedContent(innerWidth);
    this.cachedContentLines = contentLines;
    let hintText = "";
    if (this.config.showCountdown) {
      if (this.config.enableScrolling) {
        const totalLines = contentLines.length;
        const visibleLines = this.getVisibleLineCount();
        if (totalLines > visibleLines) {
          const scrolled = this.scrollOffset > 0 || this.scrollOffset + visibleLines < totalLines;
          hintText = scrolled ? `Esc/Enter dismiss · ↑↓ scroll (${this.scrollOffset + 1}-${Math.min(this.scrollOffset + visibleLines, totalLines)}/${totalLines})` : `Esc/Enter dismiss · ↑↓ scroll`;
        } else {
          hintText = "Esc/Enter dismiss";
        }
      } else if (this.config.countdown > 0) {
        hintText = `Press any key to continue (${this.countdown}s)`;
      } else if (this.config.countdown === -1) {
        hintText = "Press any key to continue";
      }
    }
    const maxVisible = this.getVisibleLineCount();
    const scrollableContent = this.config.enableScrolling ? contentLines.slice(this.scrollOffset, this.scrollOffset + maxVisible) : contentLines;
    const lines = [];
    if (this.config.showBorder) {
      lines.push(`${dimColor}${b.tl}${b.h.repeat(innerWidth)}${b.tr}${ansi.reset}`);
    }
    for (const line of scrollableContent) {
      if (this.config.showBorder) {
        const padded = fitLine(line, innerWidth);
        lines.push(`${dimColor}${b.v}${ansi.reset}${padded}${dimColor}${b.v}${ansi.reset}`);
      } else {
        lines.push(line);
      }
    }
    if (hintText) {
      const hintVisLen = visibleWidth(hintText);
      const hintLeftPad = Math.floor((innerWidth - hintVisLen) / 2);
      const hintRightPad = innerWidth - hintVisLen - hintLeftPad;
      if (this.config.showBorder) {
        lines.push(`${dimColor}${b.v}${ansi.reset}` + " ".repeat(hintLeftPad) + `${dimColor}${hintText}${ansi.reset}` + " ".repeat(hintRightPad) + `${dimColor}${b.v}${ansi.reset}`);
      } else {
        lines.push(" ".repeat(hintLeftPad) + `${dimColor}${hintText}${ansi.reset}`);
      }
    }
    if (this.config.showBorder) {
      lines.push(`${dimColor}${b.bl}${b.h.repeat(innerWidth)}${b.br}${ansi.reset}`);
    }
    const centeredLines = leftMargin > 0 ? lines.map((line) => leftPad + line) : lines;
    const bottomMargin = Math.max(0, Math.floor((this.getTerminalRows() - centeredLines.length) / 2));
    return bottomMargin > 0 ? centeredLines.concat(Array(bottomMargin).fill("")) : centeredLines;
  }
  buildInfoPanelContent(colWidth) {
    const lines = [];
    const dimColor = colorToAnsi("overlay1");
    const accentColor = colorToAnsi(this.config.accentColor);
    const greenColor = colorToAnsi("green");
    const textColor = colorToAnsi("text");
    const indent = " ";
    const separator = indent + dimColor + "─".repeat(Math.max(1, colWidth - 2)) + ansi.reset;
    if (this.config.showVersion) {
      if (lines.length > 0)
        lines.push(separator);
      const versionStr = this.infoData.piVersion;
      lines.push(indent + bold(accentColor, "OMP") + dimColor + ` ${versionStr}` + ansi.reset);
      lines.push(indent + dimColor + "esc" + ansi.reset + " interrupt" + dimColor + "  ctrl+c/d" + ansi.reset + " clear/exit" + dimColor + "  ctrl+o" + ansi.reset + " more");
    }
    if (this.config.showModel && this.infoData.modelName) {
      if (lines.length > 0)
        lines.push(separator);
      lines.push(indent + bold(accentColor, "Model"));
      lines.push(indent + textColor + this.infoData.modelName + ansi.reset);
      lines.push(indent + dimColor + this.infoData.providerName + ansi.reset);
    }
    if (this.config.showTips) {
      if (lines.length > 0)
        lines.push(separator);
      lines.push(indent + bold(accentColor, "Tips"));
      lines.push(indent + dimColor + "/" + ansi.reset + " commands" + dimColor + "  !" + ansi.reset + " bash" + dimColor + "  Shift+Tab" + ansi.reset + " thinking");
    }
    if (this.config.showLoaded) {
      const counts = this.infoData.loadedCounts;
      const total = counts.contextFiles + counts.extensions + counts.promptTemplates + counts.themes;
      if (total > 0) {
        if (lines.length > 0)
          lines.push(separator);
        lines.push(indent + bold(accentColor, "Loaded"));
        const parts = [];
        if (counts.contextFiles > 0)
          parts.push(greenColor + `${counts.contextFiles}` + ansi.reset + textColor + " ctx" + ansi.reset);
        if (counts.extensions > 0)
          parts.push(greenColor + `${counts.extensions}` + ansi.reset + textColor + " ext" + ansi.reset);
        if (counts.promptTemplates > 0)
          parts.push(greenColor + `${counts.promptTemplates}` + ansi.reset + textColor + " tmpl" + ansi.reset);
        if (counts.themes > 0)
          parts.push(greenColor + `${counts.themes}` + ansi.reset + textColor + " theme" + (counts.themes !== 1 ? "s" : "") + ansi.reset);
        lines.push(indent + parts.join(dimColor + " · " + ansi.reset));
      }
    }
    if (this.config.showResources) {
      const names = this.infoData.resourceNames;
      const hasAny = names.extensions.length > 0 || names.prompts.length > 0 || names.themes.length > 0 || names.contextFiles.length > 0;
      if (hasAny) {
        if (lines.length > 0)
          lines.push(separator);
        lines.push(indent + bold(accentColor, "Resources"));
        const maxItemsPerCategory = 6;
        const maxNameLen = colWidth - 6;
        const formatName = (name) => {
          if (name.length > maxNameLen)
            return name.slice(0, maxNameLen - 1) + "…";
          return name;
        };
        if (names.contextFiles.length > 0) {
          const items = names.contextFiles.slice(0, maxItemsPerCategory).map(formatName).join(dimColor + ", " + ansi.reset);
          lines.push(indent + dimColor + "ctx: " + ansi.reset + textColor + items + ansi.reset);
        }
        if (names.extensions.length > 0) {
          const items = names.extensions.slice(0, maxItemsPerCategory).map(formatName).join(dimColor + ", " + ansi.reset);
          lines.push(indent + dimColor + "ext: " + ansi.reset + textColor + items + ansi.reset);
        }
        if (names.prompts.length > 0) {
          const items = names.prompts.slice(0, maxItemsPerCategory).map(formatName).join(dimColor + ", " + ansi.reset);
          lines.push(indent + dimColor + "prompt: " + ansi.reset + textColor + items + ansi.reset);
        }
        if (names.themes.length > 0) {
          const items = names.themes.slice(0, maxItemsPerCategory).map(formatName).join(dimColor + ", " + ansi.reset);
          lines.push(indent + dimColor + "theme: " + ansi.reset + textColor + items + ansi.reset);
        }
      }
    }
    if (this.config.showSessions && this.infoData.recentSessions.length > 0) {
      if (lines.length > 0)
        lines.push(separator);
      lines.push(indent + bold(accentColor, "Recent"));
      for (const session of this.infoData.recentSessions.slice(0, 3)) {
        lines.push(indent + dimColor + "• " + ansi.reset + textColor + session.name + ansi.reset + dimColor + ` (${session.timeAgo})` + ansi.reset);
      }
    }
    return lines;
  }
  buildStackedContent(innerWidth) {
    const lines = [];
    const colorMap = buildAnimationColorMap(this.config.animationColor);
    const dimColor = colorToAnsi("overlay0");
    if (this.config.showPadding) {
      for (let i = 0;i < this.config.paddingTop; i++) {
        lines.push(" ".repeat(innerWidth));
      }
    }
    if (this.config.showBanner) {
      const frame = this.frames[this.frameIndex] ?? this.frames[0] ?? [];
      for (const rawLine of frame) {
        const resolved = resolveColorMarkers(rawLine, colorMap);
        const colorized = this.applyAnimationColor(resolved);
        lines.push(centerPadLine(colorized, innerWidth));
      }
    }
    if (this.config.showBanner && (this.config.showMainText || this.config.showUrl)) {
      lines.push(" ".repeat(innerWidth));
    }
    if (this.config.showMainText) {
      const mainTextColor = colorToAnsi(this.config.fgColor);
      lines.push(centerPadLine(mainTextColor + this.config.mainText + ansi.reset, innerWidth));
    }
    if (this.config.showUrl) {
      const urlColor = colorToAnsi(this.config.urlColor);
      lines.push(centerPadLine(urlColor + this.config.url + ansi.reset, innerWidth));
    }
    if (this.config.showInfoPanel) {
      lines.push("");
      lines.push(dimColor + "─".repeat(innerWidth) + ansi.reset);
      lines.push("");
      const infoLines = this.buildInfoPanelContent(innerWidth);
      lines.push(...infoLines);
    }
    if (this.config.showPadding) {
      for (let i = 0;i < this.config.paddingBottom; i++) {
        lines.push(" ".repeat(innerWidth));
      }
    }
    return lines;
  }
  applyAnimationColor(line) {
    const animColor = colorToAnsi(this.config.animationColor);
    return line.replace(/\x00COLOR:(\w+)\x00/g, (_, name) => {
      if (name === "reset")
        return ansi.reset;
      return animColor;
    });
  }
  startCountdown() {
    if (this.config.countdown <= 0)
      return;
    this.countdownInterval = setInterval(() => {
      this.countdown--;
      if (this.countdown <= 0) {
        this.dismiss();
      }
    }, 1000);
  }
}
function bold(color, text) {
  return `\x1B[1m${color}${text}${ansi.reset}`;
}
function dimText(text) {
  return `\x1B[2m${text}${ansi.reset}`;
}
