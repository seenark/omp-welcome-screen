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

	// ─── Info Panel Options ─────────────────────────────────────────────────────
	showInfoPanel: true,
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
};

// ─── Config Loading ────────────────────────────────────────────────────────────

/**
 * Load user config from file, merged on top of built-in defaults.
 * Priority order:
 * 1. Built-in defaults (lowest priority)
 * 2. JSON config file: ~/.pi/welcome-screen.config.json
 *    or ~/.pi/config/welcome-screen.json
 *    or ./welcome-screen.config.json
 */
export function loadConfig(): WelcomeConfig {
	const userConfig = loadConfigFile();
	return { ...DEFAULT_CONFIG, ...userConfig };
}

function loadConfigFile(): PartialConfig {
	const homeDir = process.env.HOME ?? process.env.USERPROFILE ?? "";
	const configPaths = [
		join(homeDir, ".pi", "welcome-screen.config.json"),
		join(homeDir, ".pi", "config", "welcome-screen.json"),
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
