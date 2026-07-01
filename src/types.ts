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
	| "loaded" // Loaded counts (extensions, context files, prompt templates, themes)
	| "resources" // Detailed resource listings (context files, extensions, prompts, themes)
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

	// ─── Scrolling ──────────────────────────────────────────────────────────────────

	/** Enable scroll mode: overlay doesn't capture all keys, supports arrow-key scrolling */
	enableScrolling: boolean;

	// ─── Overlay-specific options ───────────────────────────────────────────────

	/** Border style: 'rounded', 'square', 'double', 'minimal' */
	borderStyle: BorderStyle;
	/** Background fill character (e.g., '░', empty = no fill) */
	bgFillChar: string;
	/** Minimum terminal width to show overlay (smaller = hidden) */
	minTerminalWidth: number;
	/** Overlay box width */
	overlayWidth: number;

	// ─── Visibility Toggles ──────────────────────────────────────────────────

	/** Show ASCII art banner */
	showBanner: boolean;
	/** Show main text line */
	showMainText: boolean;
	/** Show URL line */
	showUrl: boolean;
	/** Show countdown / "press any key" hint */
	showCountdown: boolean;
	/** Show top/bottom padding */
	showPadding: boolean;
	/** Show border box around overlay */
	showBorder: boolean;

	// ─── Info Panel Options ────────────────────────────────────────────────────

	/** Show info panel on the right side */
	showInfoPanel: boolean;
	/** Show version + keybindings section in info panel */
	showVersion: boolean;
	/** Show model name + provider section in info panel */
	showModel: boolean;
	/** Show keyboard tips section in info panel */
	showTips: boolean;
	/** Show loaded counts section in info panel */
	showLoaded: boolean;
	/** Show detailed resource listings in info panel */
	showResources: boolean;
	/** Show recent sessions section in info panel */
	showSessions: boolean;
	/** Which sections to show in the info panel (deprecated — use individual show* booleans) */
	infoPanelSections: InfoPanelSection[];
	/** Model name override (empty = auto-detect from pi context) */
	modelName: string;
	/** Provider name override (empty = auto-detect from pi context) */
	providerName: string;
	/** Pi logo character (use empty string to disable) */
	logoChar: string;

	// ─── Banner File ─────────────────────────────────────────────────────────

	/** Path to a custom banner text file (empty = use built-in banner) */
	bannerFile: string;
	/** Shell command that renders an optional second terminal-animation banner (empty = disabled) */
	terminalBannerCommand: string;
	/** Visible rows for the optional terminal-animation banner */
	terminalBannerRows: number;
	/** Visible columns for the optional terminal-animation banner (0 = match current banner width) */
	terminalBannerColumns: number;
	/** Minimum milliseconds between terminal-animation banner renders */
	terminalBannerFrameDelayMs: number;
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
	promptTemplates: number;
	themes: number;
}

export interface ResourceNames {
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
