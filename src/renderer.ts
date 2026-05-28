// ANSI color rendering utilities for pi-welcome-screen
// Converts Catppuccin Mocha color names to 24-bit RGB ANSI escape codes.

import { CATPPUCCIN_MOCHA } from "./config.js";

// ─── ANSI Escape Code Helpers ─────────────────────────────────────────────────

export const ansi = {
	reset: "\x1b[0m",
	bold: "\x1b[1m",
	dim: "\x1b[2m",

	fg(r: number, g: number, b: number): string {
		return `\x1b[38;2;${r};${g};${b}m`;
	},
	bg(r: number, g: number, b: number): string {
		return `\x1b[48;2;${r};${g};${b}m`;
	},
};

// ─── Hex → RGB ────────────────────────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] {
	const h = hex.replace("#", "");
	return [
		parseInt(h.slice(0, 2), 16),
		parseInt(h.slice(2, 4), 16),
		parseInt(h.slice(4, 6), 16),
	];
}

// ─── Color Name → ANSI Code ───────────────────────────────────────────────────

/**
 * Resolve a Catppuccin Mocha color name to a foreground ANSI escape code.
 */
export function colorToAnsi(colorName: string): string {
	const hex = CATPPUCCIN_MOCHA[colorName];
	if (!hex) return ansi.reset;
	const [r, g, b] = hexToRgb(hex);
	return ansi.fg(r, g, b);
}

/**
 * Resolve a Catppuccin Mocha color name to a background ANSI escape code.
 */
export function bgColorToAnsi(colorName: string): string {
	const hex = CATPPUCCIN_MOCHA[colorName];
	if (!hex) return "";
	const [r, g, b] = hexToRgb(hex);
	return ansi.bg(r, g, b);
}

// ─── Banner Normalization ───────────────────────────────────────────────────────

/**
 * Normalize banner lines to equal visible width by right-padding shorter lines
 * with spaces. This ensures `centerPadLine()` produces consistent left-padding
 * for every line, preventing visual misalignment when custom banner files
 * have lines of different widths.
 *
 * Handles ANSI escape codes correctly — only visible characters are measured.
 */
export function normalizeBannerWidth(lines: string[]): string[] {
	if (lines.length === 0) return lines;

	const maxLen = Math.max(...lines.map((l) => stripAnsi(l).length));

	return lines.map((line) => {
		const visibleLen = stripAnsi(line).length;
		if (visibleLen >= maxLen) return line;
		return line + " ".repeat(maxLen - visibleLen);
	});
}

// ─── Line Rendering ───────────────────────────────────────────────────────────

/**
 * Apply a color to a line of text, returning the ANSI-escaped string.
 */
export function colorize(text: string, colorName: string): string {
	return colorToAnsi(colorName) + text + ansi.reset;
}

/**
 * Center a line within a given terminal width.
 * Uses visible width estimation (handles ANSI codes correctly).
 */
export function centerLine(line: string, width: number): string {
	// Strip ANSI codes for length calculation
	const visibleLen = visibleWidth(line);
	if (visibleLen >= width) return stripAnsi(line).slice(0, width);
	const pad = Math.floor((width - visibleLen) / 2);
	return " ".repeat(pad) + line;
}

/**
 * Center a line within a given width AND pad to fill full width.
 * Handles ANSI codes correctly by measuring visible length only.
 */
export function centerPadLine(line: string, width: number): string {
	const stripped = stripAnsi(line);
	if (stripped.length >= width) {
		return stripAnsi(line).slice(0, width);
	}
	const leftPad = Math.floor((width - stripped.length) / 2);
	const rightPad = width - stripped.length - leftPad;
	return " ".repeat(leftPad) + line + " ".repeat(rightPad);
}

/**
 * Pad a line to a given width, truncating if necessary.
 */
export function fitLine(line: string, width: number): string {
	const stripped = stripAnsi(line);
	if (stripped.length > width) {
		return stripAnsi(line).slice(0, width - 1) + "…";
	}
	return line + " ".repeat(width - stripped.length);
}

/**
 * Strip ANSI escape codes from a string.
 */
export function stripAnsi(str: string): string {
	return str.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, "");
}

/**
 * Calculate visible width of a string (excluding ANSI codes).
 */
export function visibleWidth(str: string): number {
	return stripAnsi(str).length;
}

// ─── Color Marker Replacement ─────────────────────────────────────────────────

/**
 * Replace color markers like \x00COLOR:lavender\x00 with actual ANSI codes.
 */
export function resolveColorMarkers(
	line: string,
	colorMap: Record<string, string>,
): string {
	return line.replace(/\x00COLOR:(\w+)\x00/g, (_, colorName) => {
		return colorMap[colorName] ?? colorName;
	});
}

// ─── Animation Color Map ───────────────────────────────────────────────────────

/**
 * Build a color map for resolving color markers in animation frames.
 * The map includes all Catppuccin Mocha colors plus special markers.
 */
export function buildAnimationColorMap(
	baseColorName: string,
): Record<string, string> {
	const map: Record<string, string> = {};
	for (const [name, hex] of Object.entries(CATPPUCCIN_MOCHA)) {
		const [r, g, b] = hexToRgb(hex);
		map[name] = ansi.fg(r, g, b);
	}
	// Reset marker
	map["reset"] = ansi.reset;
	// Store the requested animation color under a dedicated key
	// (do NOT overwrite "base" — that should remain the real base color)
	map["animation"] = colorToAnsi(baseColorName);
	return map;
}

// ─── Rainbow Color Sequence ───────────────────────────────────────────────────

const RAINBOW_COLORS = [
	"red",
	"peach",
	"yellow",
	"green",
	"teal",
	"sapphire",
	"blue",
	"lavender",
	"pink",
	"mauve",
];

/**
 * Apply rainbow coloring to a line of text, cycling per character.
 */
export function rainbowLine(line: string): string {
	let out = "";
	let colorIdx = 0;
	for (const char of line) {
		const colorName = RAINBOW_COLORS[colorIdx % RAINBOW_COLORS.length];
		out += colorToAnsi(colorName) + char;
		colorIdx++;
	}
	return out + ansi.reset;
}

/**
 * Apply rainbow coloring cycling per line.
 */
export function rainbowLines(lines: string[], frameOffset = 0): string[] {
	return lines.map((line, i) => {
		const colorName = RAINBOW_COLORS[(i + frameOffset) % RAINBOW_COLORS.length];
		return colorToAnsi(colorName) + line + ansi.reset;
	});
}

// ─── Box-Drawing Border Styles ─────────────────────────────────────────────────

/** Border character sets for different styles */
export const BORDERS = {
	rounded: { tl: "╭", tr: "╮", bl: "╰", br: "╯", v: "│", h: "─" },
	square: { tl: "┌", tr: "┐", bl: "└", br: "┘", v: "│", h: "─" },
	double: { tl: "╔", tr: "╗", bl: "╚", br: "╝", v: "║", h: "═" },
	minimal: { tl: "+", tr: "+", bl: "+", br: "+", v: "|", h: "-" },
} as const;

export type BorderStyleName = keyof typeof BORDERS;

/**
 * Build a complete overlay box with borders and optional background fill.
 *
 * @param contentLines - The main content to display inside the box
 * @param boxWidth - Total width of the box including borders
 * @param borderName - Border style ('rounded' | 'square' | 'double' | 'minimal')
 * @param bgFillChar - Character for background fill (empty string = no fill, just spaces)
 * @param footerText - Text to show in the bottom footer line
 * @param dimColor - ANSI color code for dimmed elements (borders)
 * @param accentColor - ANSI color code for accent elements (background fill)
 * @returns Array of lines forming the complete box
 */
export function buildOverlayBox(
	contentLines: string[],
	boxWidth: number,
	borderName: BorderStyleName,
	bgFillChar: string,
	footerText: string,
	dimColor: string,
	accentColor: string,
): string[] {
	const b = BORDERS[borderName];
	const innerWidth = boxWidth - 2; // Subtract 2 for left+right borders
	const lines: string[] = [];

	// Top border
	lines.push(`${dimColor}${b.tl}${b.h.repeat(innerWidth)}${b.tr}${ansi.reset}`);

	// Content lines with optional background fill
	for (const line of contentLines) {
		const visibleLen = visibleWidth(line);
		// Calculate padding needed
		const fillWidth = Math.max(0, innerWidth - visibleLen);
		const leftFill = Math.floor(fillWidth / 2);
		const rightFill = fillWidth - leftFill;

		if (bgFillChar) {
			// With background fill character
			lines.push(
				`${dimColor}${b.v}${ansi.reset}` +
					`${accentColor}${bgFillChar.repeat(leftFill)}${ansi.reset}` +
					line +
					`${accentColor}${bgFillChar.repeat(rightFill)}${ansi.reset}` +
					`${dimColor}${b.v}${ansi.reset}`,
			);
		} else {
			// No background fill — just spaces for padding
			lines.push(
				`${dimColor}${b.v}${ansi.reset}` +
					" ".repeat(leftFill) +
					line +
					" ".repeat(rightFill) +
					`${dimColor}${b.v}${ansi.reset}`,
			);
		}
	}

	// Footer line with text centered
	if (footerText) {
		const footerVisLen = visibleWidth(footerText);
		const footerAvailable = innerWidth - footerVisLen;
		const footerLeftPad = Math.floor(footerAvailable / 2);
		const footerRightPad = footerAvailable - footerLeftPad;

		lines.push(
			`${dimColor}${b.bl}${ansi.reset}` +
				`${dimColor}${" ".repeat(footerLeftPad)}${ansi.reset}` +
				footerText +
				`${dimColor}${" ".repeat(footerRightPad)}${ansi.reset}` +
				`${dimColor}${b.br}${ansi.reset}`,
		);
	} else {
		lines.push(
			`${dimColor}${b.bl}${b.h.repeat(innerWidth)}${b.br}${ansi.reset}`,
		);
	}

	return lines;
}

/**
 * Build an empty box (just borders, no content).
 * Useful for testing or placeholder boxes.
 */
export function buildEmptyBox(
	boxWidth: number,
	boxHeight: number,
	borderName: BorderStyleName,
	dimColor: string,
): string[] {
	const b = BORDERS[borderName];
	const innerWidth = boxWidth - 2;
	const innerHeight = boxHeight - 2; // Subtract top and bottom borders
	const lines: string[] = [];

	// Top border
	lines.push(`${dimColor}${b.tl}${b.h.repeat(innerWidth)}${b.tr}${ansi.reset}`);

	// Middle rows (just vertical borders)
	for (let i = 0; i < innerHeight; i++) {
		lines.push(`${dimColor}${b.v}${" ".repeat(innerWidth)}${b.v}${ansi.reset}`);
	}

	// Bottom border
	lines.push(`${dimColor}${b.bl}${b.h.repeat(innerWidth)}${b.br}${ansi.reset}`);

	return lines;
}
