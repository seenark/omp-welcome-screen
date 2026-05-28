/**
 * pi-welcome-screen — customizable animated ASCII art welcome overlay for Pi.
 *
 * This is the extension entry point. Pi loads it via jiti (TypeScript works
 * without compilation) and calls the default export factory function with
 * the ExtensionAPI.
 *
 * The extension uses `ctx.ui.custom({ overlay: true })` to show an animated
 * welcome overlay on session start. The overlay:
 * - Displays an animated ASCII art banner inside a styled box
 * - Optional two-column layout with info panel (model, tips, loaded counts, sessions)
 * - Has a countdown timer with auto-dismiss
 * - Dismisses on any keypress
 * - Auto-dismisses when agent starts responding
 *
 * Config is loaded from:
 *   1. Built-in defaults
 *   2. ~/.pi/welcome-screen.config.json (or ~/.pi/config/welcome-screen.json)
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { loadConfig, loadBannerFile } from "./config.js";
import { WelcomeOverlay } from "./WelcomeOverlay.js";
import { getInfoPanelData } from "./info-panel.js";

// ─── Extension Factory ─────────────────────────────────────────────────────────

export default function (pi: ExtensionAPI) {
	let activeOverlay: WelcomeOverlay | undefined;
	let sessionGeneration = 0;
	let debugMode = false;

	/**
	 * Show the welcome overlay.
	 * Called on session_start with a small delay to let Pi initialize.
	 */
	function showWelcomeOverlay(ctx: any): void {
		const config = loadConfig();
		debugMode = config.debug;
		const thisSessionGeneration = sessionGeneration;

		// Small delay to let pi-mono finish initialization
		setTimeout(() => {
			// Skip if session changed or extension disabled
			if (thisSessionGeneration !== sessionGeneration) {
				return;
			}

			// Skip if agent already started (streaming)
			if (ctx.ui.isOverlayActive?.()) {
				return;
			}

			// Get model info from pi context if available
			let modelName = config.modelName;
			let providerName = config.providerName;
			if (!modelName && ctx.model) {
				modelName = ctx.model.name || ctx.model.id || "pi agent";
			}
			if (!providerName && ctx.model?.provider) {
				providerName = ctx.model.provider;
			}

			// Gather info panel data (discovered from filesystem)
			const infoData = getInfoPanelData(modelName, providerName);

			ctx.ui
				.custom(
					(tui: any, _theme: any, _keybindings: any, done: () => void) => {
						// Create the overlay component with info data
						const bannerLines = loadBannerFile(config);
						activeOverlay = new WelcomeOverlay(
							config,
							done,
							infoData,
							bannerLines ?? undefined,
						);
						activeOverlay.startAnimation(tui);
						return activeOverlay;
					},
					{
						overlay: true,
						overlayOptions: () => ({
							verticalAlign: "center",
							horizontalAlign: "center",
						}),
					},
				)
				.catch((error: unknown) => {
					console.debug("[pi-welcome-screen] Welcome overlay failed:", error);
				});
		}, 100);
	}

	/**
	 * Dismiss the welcome overlay.
	 * In debug mode, dismissal is suppressed (overlay stays forever).
	 */
	function dismissWelcomeOverlay(): void {
		if (debugMode) return;
		activeOverlay?.dispose();
		activeOverlay = undefined;
	}

	// ─── Event Listeners ────────────────────────────────────────────────────────

	pi.on("session_start", async (_event, ctx) => {
		if (!ctx.hasUI) return;

		sessionGeneration++;
		activeOverlay?.dispose();
		activeOverlay = undefined;

		// Show the welcome overlay
		showWelcomeOverlay(ctx);
	});

	pi.on("session_shutdown", async () => {
		sessionGeneration++;
		dismissWelcomeOverlay();
	});

	// Auto-dismiss when agent starts responding
	pi.on("agent_start", async () => {
		dismissWelcomeOverlay();
	});

	// Auto-dismiss on tool call (agent is working)
	pi.on("tool_call", async () => {
		dismissWelcomeOverlay();
	});

	// ─── Commands ──────────────────────────────────────────────────────────────

	// Command to manually dismiss the welcome overlay
	pi.registerCommand("welcome-dismiss", {
		description: "Dismiss the welcome overlay",
		handler: async (_args, ctx) => {
			dismissWelcomeOverlay();
			if (ctx.hasUI) {
				ctx.ui.notify("Welcome overlay dismissed", "info");
			}
		},
	});

	// Command to reload welcome screen config and reshow
	pi.registerCommand("welcome-reload", {
		description: "Reload welcome screen config from disk and reshow overlay",
		handler: async (_args, ctx) => {
			if (!ctx.hasUI) return;

			dismissWelcomeOverlay();
			// Small delay to ensure cleanup
			setTimeout(() => {
				showWelcomeOverlay(ctx);
			}, 50);
			ctx.ui.notify("Welcome screen reloaded", "info");
		},
	});
}

// Re-export types and utilities for programmatic use
export type { WelcomeConfig, AnimationStyle, BorderStyle } from "./types.js";
export { loadConfig, DEFAULT_CONFIG, CATPPUCCIN_MOCHA } from "./config.js";
