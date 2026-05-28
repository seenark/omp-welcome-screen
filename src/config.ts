// Config schema + defaults + config loading for pi-welcome-screen

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { WelcomeConfig, PartialConfig } from "./types.js";

// ─── Default Configuration ────────────────────────────────────────────────────

export const DEFAULT_CONFIG: WelcomeConfig = {
	mainText: "CodeSook",
	url: "https://codesook.dev",
	animationStyle: "rainbow",
	animationText: "Welcome",
	frameDelayMs: 80,
	fgColor: "lavender",
	bgColor: "base",
	accentColor: "blue",
	urlColor: "sapphire",
	animationColor: "pink",
	paddingTop: 2,
	paddingBottom: 2,

	// ─── Overlay-specific defaults ──────────────────────────────────────────────
	borderStyle: "rounded",
	bgFillChar: "",
	minTerminalWidth: 80,
	overlayWidth: 120, // Much wider overlay
	countdown: -1, // -1 = wait for user keypress, 0 = never, >0 = seconds until auto-dismiss

	// ─── Debug Mode ──────────────────────────────────────────────────────────────────
	debug: false, // When true, overlay stays visible forever (never auto-dismisses)

	// ─── Visibility Toggles (all default true) ─────────────────────────────────
	showBanner: true,
	showMainText: true,
	showUrl: true,
	showCountdown: true,
	showPadding: true,
	showBorder: true,

	// ─── Info Panel Options ─────────────────────────────────────────────────────
	showInfoPanel: true,
	showVersion: true,
	showModel: true,
	showTips: true,
	showLoaded: true,
	showResources: true,
	showSessions: true,
	infoPanelSections: [
		"version",
		"model",
		"tips",
		"loaded",
		"resources",
		"sessions",
	],
	modelName: "",
	providerName: "",
	logoChar: "π",

	// ─── Banner File ──────────────────────────────────────────────────────────
	bannerFile: "",
};

// ─── Config Loading ────────────────────────────────────────────────────────────

/**
 * Load user config from file, merged on top of built-in defaults.
 * Priority order:
 * 1. Built-in defaults (lowest priority)
 * 2. JSON config file: ~/.pi/agent/pi-welcome-screen/settings.json
 *    or ~/.pi/welcome-screen.config.json (legacy)
 *    or ./welcome-screen.config.json (project root)
 */
export function loadConfig(): WelcomeConfig {
	const userConfig = loadConfigFile();
	const merged = { ...DEFAULT_CONFIG, ...userConfig };

	// Backward-compat: map deprecated infoPanelSections array to individual show* booleans.
	// Only applies when the user explicitly set infoPanelSections (i.e. it differs from default)
	// AND the individual show* booleans were NOT explicitly set.
	if (Array.isArray(userConfig.infoPanelSections)) {
		const sections = new Set(userConfig.infoPanelSections);
		if (userConfig.showVersion === undefined)
			merged.showVersion = sections.has("version");
		if (userConfig.showModel === undefined)
			merged.showModel = sections.has("model");
		if (userConfig.showTips === undefined)
			merged.showTips = sections.has("tips");
		if (userConfig.showLoaded === undefined)
			merged.showLoaded = sections.has("loaded");
		if (userConfig.showResources === undefined)
			merged.showResources = sections.has("resources");
		if (userConfig.showSessions === undefined)
			merged.showSessions = sections.has("sessions");
	}

	return merged;
}

function loadConfigFile(): PartialConfig {
	const homeDir = process.env.HOME ?? process.env.USERPROFILE ?? "";
	const configPaths = [
		join(homeDir, ".pi", "agent", "pi-welcome-screen", "settings.json"),
		join(homeDir, ".pi", "welcome-screen.config.json"), // legacy
		join(process.cwd(), "welcome-screen.config.json"),
	];

	for (const configPath of configPaths) {
		if (existsSync(configPath)) {
			try {
				const raw = readFileSync(configPath, "utf-8");
				return JSON.parse(raw) as PartialConfig;
			} catch {
				// Silently skip malformed config files
			}
		}
	}

	return {};
}

// ─── Banner File Loading ────────────────────────────────────────────────────────

/**
 * Load custom banner lines from a `.txt` file.
 *
 * Search order (first found wins):
 * 1. Explicit path from `config.bannerFile`
 * 2. ~/.pi/agent/pi-welcome-screen/banner.txt
 * 3. ./welcome-screen.banner.txt (project root)
 *
 * Returns `null` if no file found (caller should fall back to built-in BANNER_LINES).
 */
export function loadBannerFile(config: WelcomeConfig): string[] | null {
	const homeDir = process.env.HOME ?? process.env.USERPROFILE ?? "";

	const searchPaths = config.bannerFile
		? [config.bannerFile]
		: [
				join(homeDir, ".pi", "agent", "pi-welcome-screen", "banner.txt"),
				join(process.cwd(), "welcome-screen.banner.txt"),
			];

	for (const filePath of searchPaths) {
		if (!filePath) continue;
		if (!existsSync(filePath)) continue;

		try {
			const raw = readFileSync(filePath, "utf-8");
			let lines = raw.split("\n").map((line) => line.replace(/\r$/, "")); // strip trailing CR

			// Strip leading/trailing blank lines
			while (lines.length > 0 && lines[0].trim() === "") {
				lines = lines.slice(1);
			}
			while (lines.length > 0 && lines[lines.length - 1].trim() === "") {
				lines = lines.slice(0, -1);
			}

			if (lines.length === 0) return null;
			return lines;
		} catch {
			// Silently skip unreadable files
		}
	}

	return null;
}

// ─── Config Validation ─────────────────────────────────────────────────────────

export function validateConfig(cfg: PartialConfig): string[] {
	const errors: string[] = [];
	const validStyles = [
		"wave",
		"rainbow",
		"glitch",
		"matrix",
		"typewriter",
		"static",
	];
	const validColors = Object.keys(CATPPUCCIN_MOCHA);

	if (cfg.animationStyle && !validStyles.includes(cfg.animationStyle)) {
		errors.push(
			`Invalid animationStyle '${cfg.animationStyle}'. Must be one of: ${validStyles.join(", ")}`,
		);
	}

	const colorFields: (keyof PartialConfig)[] = [
		"fgColor",
		"bgColor",
		"accentColor",
		"urlColor",
		"animationColor",
	];
	for (const field of colorFields) {
		const val = cfg[field];
		if (typeof val === "string" && val !== "" && !validColors.includes(val)) {
			errors.push(
				`Invalid color '${val}' for ${field}. Must be a Catppuccin Mocha color name.`,
			);
		}
	}

	if (
		cfg.frameDelayMs !== undefined &&
		(cfg.frameDelayMs < 0 || cfg.frameDelayMs > 1000)
	) {
		errors.push("frameDelayMs must be between 0 and 1000");
	}

	return errors;
}

// ─── Catppuccin Mocha Palette ─────────────────────────────────────────────────

export const CATPPUCCIN_MOCHA: Record<string, string> = {
	// Core backgrounds
	base: "#1e1e2e",
	mantle: "#181825",
	crust: "#11111b",
	surface0: "#313244",
	surface1: "#45475a",
	surface2: "#585b70",

	// Overlays
	overlay0: "#6c7086",
	overlay1: "#7f849c",
	overlay2: "#9399b2",

	// Subtext
	subtext0: "#a6adc8",
	subtext1: "#bac2de",

	// Main text
	text: "#cdd6f4",

	// Colors A–Z
	lavender: "#b4befe",
	blue: "#89b4fa",
	sapphire: "#74c7ec",
	sky: "#89dceb",
	teal: "#94e2d5",
	green: "#a6e3a1",
	yellow: "#f9e2af",
	peach: "#fab387",
	maroon: "#eba0ac",
	red: "#f38ba8",
	mauve: "#cba6f7",
	pink: "#f5c2e7",
	flamingo: "#f2cdcd",
	rosewater: "#f5e0dc",
};
