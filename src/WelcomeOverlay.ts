/**
 * WelcomeOverlay — Animated overlay component for pi-welcome-screen.
 *
 * Displays an animated ASCII art banner inside a styled box with:
 * - Optional two-column layout (left: banner, right: info panel)
 * - Countdown timer
 * - Keyboard dismissal (any key)
 * - Auto-dismiss when agent starts responding
 * - Catppuccin-styled background with borders
 */

import type { Component } from "@earendil-works/pi-tui";
import type { WelcomeConfig, InfoPanelData } from "./types.js";
import {
	type BorderStyleName,
	BORDERS,
	colorToAnsi,
	centerPadLine,
	fitLine,
	visibleWidth,
	ansi,
	resolveColorMarkers,
	buildAnimationColorMap,
	normalizeBannerWidth,
} from "./renderer.js";
import {
	BANNER_LINES,
	buildAnimationFrames,
	getFrameCount,
} from "./animations.js";

// ─── Overlay Component ─────────────────────────────────────────────────────────

export class WelcomeOverlay implements Component {
	private config: WelcomeConfig;
	private frameIndex: number = 0;
	private lastFrameTime: number = 0;
	private frames: string[][] = [];
	private countdown: number;
	private dismissed: boolean = false;
	private animInterval: ReturnType<typeof setInterval> | null = null;
	private countdownInterval: ReturnType<typeof setInterval> | null = null;
	private done: () => void;
	private tui: { requestRender(): void } | null = null;
	private infoData: InfoPanelData;
	private bannerLines: string[];
	private scrollOffset: number = 0;
	private cachedContentLines: string[] = [];

	constructor(
		config: WelcomeConfig,
		done: () => void,
		infoData?: InfoPanelData,
		bannerLines?: string[],
	) {
		this.config = config;
		this.countdown = config.countdown;
		this.done = done;
		this.bannerLines = normalizeBannerWidth(bannerLines ?? BANNER_LINES);
		this.infoData = infoData ?? {
			modelName: config.modelName || "pi agent",
			providerName: config.providerName || "pi",
			piVersion: "pi",
			recentSessions: [],
			loadedCounts: {
				contextFiles: 0,
				extensions: 0,
				promptTemplates: 0,
				themes: 0,
			},
			resourceNames: {
				extensions: [],
				prompts: [],
				themes: [],
				contextFiles: [],
			},
		};
		this.initFrames();
		this.startCountdown();
	}

	/**
	 * Start the animation timer and countdown.
	 * Call after the component is returned from the overlay factory.
	 */
	startAnimation(tui: { requestRender(): void }): void {
		this.tui = tui;
		if (this.frames.length > 1) {
			this.lastFrameTime = Date.now();
			this.animInterval = setInterval(() => {
				this.tui?.requestRender();
			}, this.config.frameDelayMs);
		}
	}

	private initFrames(): void {
		const totalFrames = getFrameCount(this.config.animationStyle);
		this.frames = buildAnimationFrames(
			this.config.animationStyle,
			this.bannerLines,
			totalFrames,
		);
	}

	/** Mark the overlay for invalidation (reset animation) */
	invalidate(): void {
		this.frameIndex = 0;
		this.lastFrameTime = 0;
		this.initFrames();
	}

	/** Handle keyboard input — Escape dismisses, arrows scroll */
	handleInput(data: string): void {
		if (this.config.debug) return;

		// Escape key sequences
		if (data === "\x1b" || data === "\x1b[" || data === "\x1b[27") {
			this.dismiss();
			return;
		}

		// Enter key (CR or LF)
		if (data === "\r" || data === "\n") {
			this.dismiss();
			return;
		}

		// Arrow keys for scrolling
		if (this.config.enableScrolling) {
			if (data === "\x1b[A" || data === "\x1bOA") {
				// Up arrow
				if (this.scrollOffset > 0) {
					this.scrollOffset--;
					this.tui?.requestRender();
				}
				return;
			}
			if (data === "\x1b[B" || data === "\x1bOB") {
				// Down arrow
				const maxOffset = Math.max(
					0,
					this.cachedContentLines.length - this.getVisibleLineCount(),
				);
				if (this.scrollOffset < maxOffset) {
					this.scrollOffset++;
					this.tui?.requestRender();
				}
				return;
			}
		}

		// All other keys: do nothing (no longer captures)
	}

	/** Dismiss the overlay and clean up timers */
	private dismiss(): void {
		if (this.dismissed) return;
		this.dismissed = true;
		this.stopTimers();
		this.done();
	}

	/** Stop animation and countdown timers */
	private stopTimers(): void {
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

	/** Clean up resources */
	dispose(): void {
		this.stopTimers();
	}

	/** Get current countdown value */
	getCountdown(): number {
		return this.countdown;
	}

	/** Check if overlay has been dismissed */
	isDismissed(): boolean {
		return this.dismissed;
	}

	/** Calculate the max content lines that fit in the terminal.
	 * Reserves 2 lines for top/bottom borders + 1 for hint = 3 overhead.
	 * Uses ~80% of terminal height to leave room for the TUI behind.
	 */
	private getVisibleLineCount(): number {
		const termRows =
			typeof process !== "undefined" && process.stdout?.rows
				? process.stdout.rows
				: 24;
		// Reserve 3 lines for border top + hint + border bottom
		const overhead = 3;
		// Use 80% of terminal height so user can see the TUI behind
		const maxRows = Math.floor(termRows * 0.8) - overhead;
		return Math.max(maxRows, 5); // at least 5 lines
	}

	/**
	 * Render the overlay box.
	 * Returns an array of ANSI-colored strings, one per line.
	 */
	render(termWidth: number): string[] {
		// Skip rendering if dismissed or terminal too narrow
		if (this.dismissed) {
			return [];
		}

		if (termWidth < this.config.minTerminalWidth) {
			return [];
		}

		// Advance animation frame based on elapsed time
		const now = Date.now();
		if (
			this.frames.length > 1 &&
			now - this.lastFrameTime >= this.config.frameDelayMs
		) {
			this.frameIndex = (this.frameIndex + 1) % this.frames.length;
			this.lastFrameTime = now;
		}

		return this.buildOverlayLines(termWidth);
	}

	private buildOverlayLines(termWidth: number): string[] {
		// Calculate box width (use most of terminal width)
		const boxWidth = Math.min(
			termWidth - 2, // Leave 1 char margin on each side
			Math.max(this.config.overlayWidth, 40),
		);

		// Get colors
		const dimColor = colorToAnsi("overlay0");
		const borderName = this.config.borderStyle as BorderStyleName;
		const b = BORDERS[borderName];

		// innerWidth is the space between left and right borders
		const innerWidth = boxWidth - 2;

		// Check if we should use two-column layout
		const useTwoColumn = this.config.showInfoPanel && termWidth >= 100;
		const minLayoutWidth = useTwoColumn ? 100 : 50;

		if (innerWidth < minLayoutWidth) {
			return [];
		}

		let contentLines: string[];
		if (useTwoColumn) {
			contentLines = this.buildTwoColumnContent(innerWidth);
		} else {
			contentLines = this.buildSingleColumnContent(innerWidth);
		}

		// Cache for scroll calculations
		this.cachedContentLines = contentLines;

		// Build the hint text
		let hintText = "";
		if (this.config.showCountdown) {
			if (this.config.enableScrolling) {
				const totalLines = contentLines.length;
				const visibleLines = this.getVisibleLineCount();
				if (totalLines > visibleLines) {
					const scrolled =
						this.scrollOffset > 0 ||
						this.scrollOffset + visibleLines < totalLines;
					hintText = scrolled
						? `Esc/Enter dismiss · ↑↓ scroll (${this.scrollOffset + 1}-${Math.min(this.scrollOffset + visibleLines, totalLines)}/${totalLines})`
						: `Esc/Enter dismiss · ↑↓ scroll`;
				} else {
					hintText = "Esc/Enter dismiss";
				}
			} else if (this.config.countdown > 0) {
				hintText = `Press any key to continue (${this.countdown}s)`;
			} else if (this.config.countdown === -1) {
				hintText = "Press any key to continue";
			}
		}

		// Apply scroll offset — show only visible portion of content
		const maxVisible = this.getVisibleLineCount();
		const scrollableContent = this.config.enableScrolling
			? contentLines.slice(this.scrollOffset, this.scrollOffset + maxVisible)
			: contentLines;

		const lines: string[] = [];

		if (this.config.showBorder) {
			// Top border: ╭ + ─ + ╮
			lines.push(
				`${dimColor}${b.tl}${b.h.repeat(innerWidth)}${b.tr}${ansi.reset}`,
			);
		}

		// Content lines — pad each to innerWidth so the right border
		// always appears at the correct position (handles short text,
		// empty lines, and ANSI-colored content correctly via fitLine).
		for (const line of scrollableContent) {
			if (this.config.showBorder) {
				const padded = fitLine(line, innerWidth);
				lines.push(
					`${dimColor}${b.v}${ansi.reset}${padded}${dimColor}${b.v}${ansi.reset}`,
				);
			} else {
				lines.push(line);
			}
		}

		// Hint line (above bottom border, centered to innerWidth)
		if (hintText) {
			const hintVisLen = visibleWidth(hintText);
			const hintLeftPad = Math.floor((innerWidth - hintVisLen) / 2);
			const hintRightPad = innerWidth - hintVisLen - hintLeftPad;
			if (this.config.showBorder) {
				lines.push(
					`${dimColor}${b.v}${ansi.reset}` +
						" ".repeat(hintLeftPad) +
						`${dimColor}${hintText}${ansi.reset}` +
						" ".repeat(hintRightPad) +
						`${dimColor}${b.v}${ansi.reset}`,
				);
			} else {
				lines.push(
					" ".repeat(hintLeftPad) + `${dimColor}${hintText}${ansi.reset}`,
				);
			}
		}

		if (this.config.showBorder) {
			// Full bottom border: ╰ + ─ + ╯
			lines.push(
				`${dimColor}${b.bl}${b.h.repeat(innerWidth)}${b.br}${ansi.reset}`,
			);
		}

		return lines;
	}

	/**
	 * Build content lines using two-column layout:
	 * Left column: Animated banner + main text
	 * Right column: Info panel (model, tips, loaded counts, recent sessions)
	 */
	private buildTwoColumnContent(innerWidth: number): string[] {
		const leftColWidth = Math.floor(innerWidth * 0.55);
		const rightColWidth = innerWidth - leftColWidth - 3; // 3 for separators

		// Build left column content
		const leftContent = this.buildLeftColumnContent(leftColWidth);

		// Build right column content
		const rightContent = this.buildInfoPanelContent(rightColWidth);

		// Combine columns
		const lines: string[] = [];
		const maxRows = Math.max(leftContent.length, rightContent.length);

		for (let i = 0; i < maxRows; i++) {
			const left = fitLine(leftContent[i] ?? "", leftColWidth);
			const right = fitLine(rightContent[i] ?? "", rightColWidth);
			lines.push(left + " " + dimText("│") + " " + right);
		}

		return lines;
	}

	private buildLeftColumnContent(colWidth: number): string[] {
		const lines: string[] = [];
		const colorMap = buildAnimationColorMap(this.config.animationColor);

		// Padding top
		if (this.config.showPadding) {
			for (let i = 0; i < this.config.paddingTop; i++) {
				lines.push("");
			}
		}

		// Animated banner - center each line to colWidth and pad to full width
		if (this.config.showBanner) {
			const frame = this.frames[this.frameIndex] ?? this.frames[0] ?? [];
			for (const rawLine of frame) {
				const resolved = resolveColorMarkers(rawLine, colorMap);
				const colorized = this.applyAnimationColor(resolved);
				const centered = centerPadLine(colorized, colWidth);
				lines.push(centered);
			}
		}

		// Padding between banner and main text
		if (
			this.config.showBanner &&
			(this.config.showMainText || this.config.showUrl)
		) {
			lines.push("");
		}

		// Main text - centered and padded to full width
		if (this.config.showMainText) {
			const mainTextColor = colorToAnsi(this.config.fgColor);
			const mainTextStyled = mainTextColor + this.config.mainText + ansi.reset;
			lines.push(centerPadLine(mainTextStyled, colWidth));
		}

		// URL - centered and padded to full width
		if (this.config.showUrl) {
			const urlColor = colorToAnsi(this.config.urlColor);
			const urlStyled = urlColor + this.config.url + ansi.reset;
			lines.push(centerPadLine(urlStyled, colWidth));
		}

		// Padding bottom
		if (this.config.showPadding) {
			for (let i = 0; i < this.config.paddingBottom; i++) {
				lines.push("");
			}
		}

		return lines;
	}

	private buildInfoPanelContent(colWidth: number): string[] {
		const lines: string[] = [];
		const dimColor = colorToAnsi("overlay1");
		const accentColor = colorToAnsi(this.config.accentColor);
		const greenColor = colorToAnsi("green");
		const textColor = colorToAnsi("text");

		const indent = " ";
		const separator =
			indent + dimColor + "─".repeat(Math.max(1, colWidth - 2)) + ansi.reset;

		// Version section
		if (this.config.showVersion) {
			if (lines.length > 0) lines.push(separator);
			const versionStr = this.infoData.piVersion;
			lines.push(
				indent +
					bold(accentColor, "Pi") +
					dimColor +
					` ${versionStr}` +
					ansi.reset,
			);
			lines.push(
				indent +
					dimColor +
					"esc" +
					ansi.reset +
					" interrupt" +
					dimColor +
					"  ctrl+c/d" +
					ansi.reset +
					" clear/exit" +
					dimColor +
					"  ctrl+o" +
					ansi.reset +
					" more",
			);
		}

		// Model section
		if (this.config.showModel && this.infoData.modelName) {
			if (lines.length > 0) lines.push(separator);
			lines.push(indent + bold(accentColor, "Model"));
			lines.push(indent + textColor + this.infoData.modelName + ansi.reset);
			lines.push(indent + dimColor + this.infoData.providerName + ansi.reset);
		}

		// Tips section
		if (this.config.showTips) {
			if (lines.length > 0) lines.push(separator);
			lines.push(indent + bold(accentColor, "Tips"));
			lines.push(
				indent +
					dimColor +
					"/" +
					ansi.reset +
					" commands" +
					dimColor +
					"  !" +
					ansi.reset +
					" bash" +
					dimColor +
					"  Shift+Tab" +
					ansi.reset +
					" thinking",
			);
		}

		// Loaded counts section
		if (this.config.showLoaded) {
			const counts = this.infoData.loadedCounts;
			const total =
				counts.contextFiles +
				counts.extensions +
				counts.promptTemplates +
				counts.themes;
			if (total > 0) {
				if (lines.length > 0) lines.push(separator);
				lines.push(indent + bold(accentColor, "Loaded"));

				const parts: string[] = [];
				if (counts.contextFiles > 0)
					parts.push(
						greenColor +
							`${counts.contextFiles}` +
							ansi.reset +
							textColor +
							" ctx" +
							ansi.reset,
					);
				if (counts.extensions > 0)
					parts.push(
						greenColor +
							`${counts.extensions}` +
							ansi.reset +
							textColor +
							" ext" +
							ansi.reset,
					);
				if (counts.promptTemplates > 0)
					parts.push(
						greenColor +
							`${counts.promptTemplates}` +
							ansi.reset +
							textColor +
							" tmpl" +
							ansi.reset,
					);
				if (counts.themes > 0)
					parts.push(
						greenColor +
							`${counts.themes}` +
							ansi.reset +
							textColor +
							" theme" +
							(counts.themes !== 1 ? "s" : "") +
							ansi.reset,
					);
				lines.push(indent + parts.join(dimColor + " · " + ansi.reset));
			}
		}

		// Resources section (detailed listings)
		if (this.config.showResources) {
			const names = this.infoData.resourceNames;
			const hasAny =
				names.extensions.length > 0 ||
				names.prompts.length > 0 ||
				names.themes.length > 0 ||
				names.contextFiles.length > 0;
			if (hasAny) {
				if (lines.length > 0) lines.push(separator);
				lines.push(indent + bold(accentColor, "Resources"));

				const maxItemsPerCategory = 6;
				const maxNameLen = colWidth - 6;

				const formatName = (name: string): string => {
					if (name.length > maxNameLen)
						return name.slice(0, maxNameLen - 1) + "…";
					return name;
				};

				if (names.contextFiles.length > 0) {
					const items = names.contextFiles
						.slice(0, maxItemsPerCategory)
						.map(formatName)
						.join(dimColor + ", " + ansi.reset);
					lines.push(
						indent +
							dimColor +
							"ctx: " +
							ansi.reset +
							textColor +
							items +
							ansi.reset,
					);
				}
				if (names.extensions.length > 0) {
					const items = names.extensions
						.slice(0, maxItemsPerCategory)
						.map(formatName)
						.join(dimColor + ", " + ansi.reset);
					lines.push(
						indent +
							dimColor +
							"ext: " +
							ansi.reset +
							textColor +
							items +
							ansi.reset,
					);
				}
				if (names.prompts.length > 0) {
					const items = names.prompts
						.slice(0, maxItemsPerCategory)
						.map(formatName)
						.join(dimColor + ", " + ansi.reset);
					lines.push(
						indent +
							dimColor +
							"prompt: " +
							ansi.reset +
							textColor +
							items +
							ansi.reset,
					);
				}
				if (names.themes.length > 0) {
					const items = names.themes
						.slice(0, maxItemsPerCategory)
						.map(formatName)
						.join(dimColor + ", " + ansi.reset);
					lines.push(
						indent +
							dimColor +
							"theme: " +
							ansi.reset +
							textColor +
							items +
							ansi.reset,
					);
				}
			}
		}

		// Recent sessions section
		if (this.config.showSessions && this.infoData.recentSessions.length > 0) {
			if (lines.length > 0) lines.push(separator);
			lines.push(indent + bold(accentColor, "Recent"));
			for (const session of this.infoData.recentSessions.slice(0, 3)) {
				lines.push(
					indent +
						dimColor +
						"• " +
						ansi.reset +
						textColor +
						session.name +
						ansi.reset +
						dimColor +
						` (${session.timeAgo})` +
						ansi.reset,
				);
			}
		}

		return lines;
	}

	/**
	 * Single-column layout: banner on top, compact info panel below.
	 * Used when terminal is < 100px wide.
	 */
	private buildSingleColumnContent(innerWidth: number): string[] {
		const lines: string[] = [];
		const colorMap = buildAnimationColorMap(this.config.animationColor);
		const dimColor = colorToAnsi("overlay0");

		// Padding top
		if (this.config.showPadding) {
			for (let i = 0; i < this.config.paddingTop; i++) {
				lines.push(" ".repeat(innerWidth));
			}
		}

		// Animated banner
		if (this.config.showBanner) {
			const frame = this.frames[this.frameIndex] ?? this.frames[0] ?? [];
			for (const rawLine of frame) {
				const resolved = resolveColorMarkers(rawLine, colorMap);
				const colorized = this.applyAnimationColor(resolved);
				lines.push(centerPadLine(colorized, innerWidth));
			}
		}

		// Spacer between banner and text
		if (
			this.config.showBanner &&
			(this.config.showMainText || this.config.showUrl)
		) {
			lines.push(" ".repeat(innerWidth));
		}

		// Main text
		if (this.config.showMainText) {
			const mainTextColor = colorToAnsi(this.config.fgColor);
			lines.push(
				centerPadLine(
					mainTextColor + this.config.mainText + ansi.reset,
					innerWidth,
				),
			);
		}

		// URL
		if (this.config.showUrl) {
			const urlColor = colorToAnsi(this.config.urlColor);
			lines.push(
				centerPadLine(urlColor + this.config.url + ansi.reset, innerWidth),
			);
		}

		// Separator + Info panel (only if info panel has content to show)
		if (this.config.showInfoPanel) {
			lines.push("");
			lines.push(dimColor + "─".repeat(innerWidth) + ansi.reset);
			lines.push("");

			// Info panel (compact)
			const infoLines = this.buildInfoPanelContent(innerWidth);
			lines.push(...infoLines);
		}

		// Padding bottom
		if (this.config.showPadding) {
			for (let i = 0; i < this.config.paddingBottom; i++) {
				lines.push(" ".repeat(innerWidth));
			}
		}

		return lines;
	}

	private applyAnimationColor(line: string): string {
		const animColor = colorToAnsi(this.config.animationColor);
		return line.replace(/\x00COLOR:(\w+)\x00/g, (_, name) => {
			if (name === "reset") return ansi.reset;
			return animColor;
		});
	}

	/**
	 * Start the countdown timer.
	 * countdown: -1 = wait for keypress only, 0 = never auto-dismiss, >0 = seconds until auto-dismiss
	 * Auto-dismisses when countdown reaches 0.
	 */
	private startCountdown(): void {
		// countdown <= 0 means no auto-dismiss (either -1 = wait for keypress, or 0 = never)
		if (this.config.countdown <= 0) return;

		this.countdownInterval = setInterval(() => {
			this.countdown--;
			if (this.countdown <= 0) {
				this.dismiss();
			}
		}, 1000);
	}
}

// ─── Helper Functions ───────────────────────────────────────────────────────────

function bold(color: string, text: string): string {
	return `\x1b[1m${color}${text}${ansi.reset}`;
}

function dimText(text: string): string {
	return `\x1b[2m${text}${ansi.reset}`;
}

// Re-export for convenience
export type {
	WelcomeConfig,
	InfoPanelData,
	InfoPanelSection,
} from "./types.js";
export type { BorderStyleName } from "./renderer.js";
