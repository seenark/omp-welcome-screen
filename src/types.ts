// Shared TypeScript interfaces for pi-welcome-screen

export type AnimationStyle =
	| "wave"
	| "rainbow"
	| "glitch"
	| "matrix"
	| "typewriter"
	| "static";

/** Border style for the overlay box */
export type BorderStyle = "rounded" | "square" | "double" | "minimal";

/** Info panel sections that can be displayed */
export type InfoPanelSection =
	| "version" // Pi version and keybindings
	| "model" // Model name and provider
	| "tips" // Keyboard tips
	| "loaded" // Loaded counts (extensions, skills, context files)
	| "resources" // Detailed resource listings (skills, extensions, prompts, themes)
	| "sessions"; // Recent sessions

export interface WelcomeConfig {
	/** Main text displayed below ASCII banner */
	mainText: string;
	/** URL displayed in footer */
	url: string;
	/** Animation style for the ASCII banner */
	animationStyle: AnimationStyle;
	/** Text used for animation */
	animationText: string;
	/** Frame delay in milliseconds (animation speed) */
	frameDelayMs: number;
	/** Catppuccin Mocha color name for main text */
	fgColor: string;
	/** Catppuccin Mocha color name for background */
	bgColor: string;
	/** Catppuccin Mocha color name for accent elements */
	accentColor: string;
	/** Catppuccin Mocha color name for URL */
	urlColor: string;
	/** Catppuccin Mocha color name for animated elements */
	animationColor: string;
	/** Number of empty lines above content */
	paddingTop: number;
	/** Number of empty lines below content */
	paddingBottom: number;
	/** Countdown seconds before auto-dismiss (0 = never) */
	countdown: number;

	// ─── Debug Mode ────────────────────────────────────────────────────────────────

	/** Debug mode: overlay stays visible forever, never auto-dismisses */
	debug: boolean;

	// ─── Overlay-specific options ───────────────────────────────────────────────

	/** Border style: 'rounded', 'square', 'double', 'minimal' */
	borderStyle: BorderStyle;
	/** Background fill character (e.g., '░', empty = no fill) */
	bgFillChar: string;
	/** Minimum terminal width to show overlay (smaller = hidden) */
	minTerminalWidth: number;
	/** Overlay box width */
	overlayWidth: number;

	// ─── Info Panel Options ────────────────────────────────────────────────────

	/** Show info panel on the right side (like pi-powerline-footer) */
	showInfoPanel: boolean;
	/** Which sections to show in the info panel */
	infoPanelSections: InfoPanelSection[];
	/** Model name override (empty = auto-detect from pi context) */
	modelName: string;
	/** Provider name override (empty = auto-detect from pi context) */
	providerName: string;
	/** Pi logo character (use empty string to disable) */
	logoChar: string;
}

// Deep partial for config merging
export type PartialConfig = Partial<WelcomeConfig>;

// ─── Info Panel Data Types ──────────────────────────────────────────────────────

export interface RecentSession {
	name: string;
	timeAgo: string;
}

export interface LoadedCounts {
	contextFiles: number;
	extensions: number;
	skills: number;
	promptTemplates: number;
	themes: number;
}

export interface ResourceNames {
	skills: string[];
	extensions: string[];
	prompts: string[];
	themes: string[];
	contextFiles: string[];
}

export interface InfoPanelData {
	modelName: string;
	providerName: string;
	piVersion: string;
	recentSessions: RecentSession[];
	loadedCounts: LoadedCounts;
	resourceNames: ResourceNames;
}
