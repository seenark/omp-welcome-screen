import { expect, test } from "bun:test";

import { DEFAULT_CONFIG } from "./config.js";
import { WelcomeOverlay } from "./WelcomeOverlay.js";
import { stripAnsi } from "./renderer.js";

const codesookBanner = [
	" ██████╗ ██████╗ ██████╗ ███████╗    ███████╗ ██████╗  ██████╗ ██╗  ██╗",
	"██╔════╝██╔═══██╗██╔══██╗██╔════╝    ██╔════╝██╔═══██╗██╔═══██╗██║ ██╔╝",
	"██║     ██║   ██║██║  ██║█████╗      ███████╗██║   ██║██║   ██║█████╔╝ ",
	"██║     ██║   ██║██║  ██║██╔══╝      ╚════██║██║   ██║██║   ██║██╔═██╗ ",
	"╚██████╗╚██████╔╝██████╔╝███████╗    ███████║╚██████╔╝╚██████╔╝██║  ██╗",
	" ╚═════╝ ╚═════╝ ╚═════╝ ╚══════╝    ╚══════╝ ╚═════╝  ╚═════╝ ╚═╝  ╚═╝",
];

test("render keeps animated banner full-width above info panel", () => {
	const config = {
		...DEFAULT_CONFIG,
		frameDelayMs: 0,
		showInfoPanel: true,
		showVersion: false,
		showModel: false,
		showTips: false,
		showLoaded: false,
		showResources: false,
		showSessions: false,
		showMainText: false,
		showUrl: false,
		showCountdown: false,
		showBorder: false,
		paddingTop: 0,
		paddingBottom: 0,
		minTerminalWidth: 1,
		overlayWidth: 120,
	};
	const overlay = new WelcomeOverlay(
		config,
		() => undefined,
		undefined,
		codesookBanner,
	);

	const firstJoined = overlay.render(120).join("\n");
	const secondJoined = overlay.render(120).join("\n");

	expect(firstJoined).toContain("\x1b[38;2;");
	expect(firstJoined).not.toEqual(secondJoined);
	expect(stripAnsi(firstJoined)).not.toContain(" │ ");
});

test("render centers overlay box within terminal width", () => {
	const config = {
		...DEFAULT_CONFIG,
		frameDelayMs: 0,
		showInfoPanel: false,
		showCountdown: false,
		showBorder: true,
		paddingTop: 0,
		paddingBottom: 0,
		minTerminalWidth: 1,
		overlayWidth: 52,
	};
	const overlay = new WelcomeOverlay(
		config,
		() => undefined,
		undefined,
		codesookBanner,
	);

	const lines = overlay.render(80);

	expect(stripAnsi(lines[0] ?? "").startsWith(" ".repeat(14) + "╭")).toBe(true);
	expect(stripAnsi(lines[0] ?? "").endsWith("╮")).toBe(true);
});

test("render appends bottom margin for vertical centering", () => {
	const config = {
		...DEFAULT_CONFIG,
		frameDelayMs: 0,
		showInfoPanel: false,
		showCountdown: false,
		showBorder: true,
		paddingTop: 0,
		paddingBottom: 0,
		minTerminalWidth: 1,
		overlayWidth: 52,
	};
	const overlay = new WelcomeOverlay(
		config,
		() => undefined,
		undefined,
		codesookBanner,
	);
	const stdout = process.stdout as NodeJS.WriteStream & { rows?: number };
	const originalRows = stdout.rows;

	try {
		stdout.rows = 40;
		const lines = overlay.render(80);
		let trailingBlankLines = 0;
		for (let index = lines.length - 1; index >= 0; index--) {
			if (lines[index] !== "") {
				break;
			}
			trailingBlankLines++;
		}

		const boxHeight = lines.length - trailingBlankLines;

		expect(trailingBlankLines).toBe(Math.floor((40 - boxHeight) / 2));
		expect(stripAnsi(lines[0] ?? "").startsWith(" ".repeat(14) + "╭")).toBe(true);
	} finally {
		stdout.rows = originalRows;
	}
});
