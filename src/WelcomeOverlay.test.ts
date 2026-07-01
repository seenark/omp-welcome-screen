import { expect, test } from "bun:test";
import { setImmediate as waitForIo } from "node:timers/promises";

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

test("render appends terminal command banner below built-in banner", async () => {
	const command = `${JSON.stringify(process.execPath)} -e ${JSON.stringify(
		"console.log('CLI ONE\\nCLI TWO')",
	)}`;
	const config = {
		...DEFAULT_CONFIG,
		terminalBannerCommand: command,
		terminalBannerFrameDelayMs: 0,
		animationStyle: "static",
		showInfoPanel: false,
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

	try {
		overlay.startAnimation({ requestRender() {
			return undefined;
		} });
		let stripped = "";
		for (let attempt = 0; attempt < 40; attempt++) {
			stripped = stripAnsi(overlay.render(120).join("\n"));
			if (stripped.includes("CLI ONE")) {
				break;
			}
			await waitForIo();
			await Bun.sleep(10);
		}

		expect(stripped).toContain("██████");
		expect(stripped).toContain("CLI ONE");
		expect(stripped.indexOf("CLI ONE")).toBeGreaterThan(stripped.indexOf("██████"));
	} finally {
		overlay.dispose();
	}
});

test("render appends cursor-positioned terminal banner below built-in banner", async () => {
	const command = `${JSON.stringify(process.execPath)} -e ${JSON.stringify(
		"process.stdout.write('\\u001b[2J\\u001b[1;1H\\u001b[2;3HCLI\\u001b[3;2HTWO')",
	)}`;
	const config = {
		...DEFAULT_CONFIG,
		terminalBannerCommand: command,
		terminalBannerFrameDelayMs: 0,
		animationStyle: "static",
		showInfoPanel: false,
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

	try {
		overlay.startAnimation({ requestRender() {
			return undefined;
		} });
		let stripped = "";
		for (let attempt = 0; attempt < 40; attempt++) {
			stripped = stripAnsi(overlay.render(120).join("\n"));
			if (stripped.includes("CLI") && stripped.includes("TWO")) {
				break;
			}
			await waitForIo();
			await Bun.sleep(10);
		}

		expect(stripped).toContain("██████");
		expect(stripped).toContain("CLI");
		expect(stripped).toContain("TWO");
		expect(stripped.indexOf("CLI")).toBeGreaterThan(stripped.indexOf("██████"));
	} finally {
		overlay.dispose();
	}
});

test("render preserves terminal command color and configured size", async () => {
	const command = `${JSON.stringify(process.execPath)} -e ${JSON.stringify(
		"process.stdout.write('\\u001b[2J\\u001b[38;2;1;2;3m\\u001b[2;4HCOLOR')",
	)}`;
	const config = {
		...DEFAULT_CONFIG,
		terminalBannerCommand: command,
		terminalBannerRows: 4,
		terminalBannerColumns: 20,
		terminalBannerFrameDelayMs: 0,
		animationStyle: "static",
		showInfoPanel: false,
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

	try {
		overlay.startAnimation({ requestRender() {
			return undefined;
		} });
		let rendered = "";
		for (let attempt = 0; attempt < 40; attempt++) {
			rendered = overlay.render(120).join("\n");
			if (stripAnsi(rendered).includes("COLOR")) {
				break;
			}
			await waitForIo();
			await Bun.sleep(10);
		}

		expect(rendered).toContain("\x1b[38;2;1;2;3m");
		const stripped = stripAnsi(rendered);
		expect(stripped).toContain("██████");
		expect(stripped).toContain("COLOR");
		expect(stripped.indexOf("COLOR")).toBeGreaterThan(stripped.indexOf("██████"));
		const contentLines = stripped.split("\n").slice(6, 10);
		expect(contentLines).toHaveLength(4);
		expect(contentLines.some((line) => line.includes("COLOR"))).toBe(true);
	} finally {
		overlay.dispose();
	}
});

test("render preserves terminal command color when bordered overlay clips width", async () => {
	const command = `${JSON.stringify(process.execPath)} -e ${JSON.stringify(
		"process.stdout.write('\\u001b[2J\\u001b[38;2;1;2;3mABCDEFGHIJKLMNOPQRSTUVWXYZ')",
	)}`;
	const config = {
		...DEFAULT_CONFIG,
		terminalBannerCommand: command,
		terminalBannerRows: 1,
		terminalBannerColumns: 26,
		terminalBannerFrameDelayMs: 0,
		animationStyle: "static",
		showBanner: false,
		showInfoPanel: false,
		showMainText: false,
		showUrl: false,
		showCountdown: false,
		showBorder: true,
		paddingTop: 0,
		paddingBottom: 0,
		minTerminalWidth: 1,
		overlayWidth: 20,
	};
	const overlay = new WelcomeOverlay(
		config,
		() => undefined,
		undefined,
		codesookBanner,
	);

	try {
		overlay.startAnimation({ requestRender() {
			return undefined;
		} });
		let rendered = "";
		for (let attempt = 0; attempt < 40; attempt++) {
			rendered = overlay.render(40).join("\n");
			if (stripAnsi(rendered).includes("ABCDE")) {
				break;
			}
			await waitForIo();
			await Bun.sleep(10);
		}

		expect(rendered).toContain("\x1b[38;2;1;2;3m");
		expect(stripAnsi(rendered)).toContain("ABCDE");
		expect(rendered).not.toContain("[38;2;1;2;3m");
	} finally {
		overlay.dispose();
	}
});

test("render keeps previous terminal frame while command redraws", async () => {
	const command = `${JSON.stringify(process.execPath)} -e ${JSON.stringify(
		"process.stdout.write('\\u001b[2J\\u001b[1;1HOLD\\nFRAME'); setTimeout(() => process.stdout.write('\\u001b[2J\\u001b[1;1HNEW'), 80); setTimeout(() => process.stdout.write('\\nFRAME'), 95); setTimeout(() => {}, 180);",
	)}`;
	const config = {
		...DEFAULT_CONFIG,
		terminalBannerCommand: command,
		terminalBannerFrameDelayMs: 50,
		animationStyle: "static",
		showInfoPanel: false,
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

	try {
		overlay.startAnimation({ requestRender() {
			return undefined;
		} });

		let sawOldFrame = false;
		for (let attempt = 0; attempt < 24; attempt++) {
			const stripped = stripAnsi(overlay.render(120).join("\n"));
			if (stripped.includes("OLD") && stripped.includes("FRAME")) {
				sawOldFrame = true;
			}
			expect(stripped.includes("NEW") && !stripped.includes("FRAME")).toBe(false);
			await Bun.sleep(5);
		}

		let rendered = "";
		for (let attempt = 0; attempt < 20; attempt++) {
			rendered = stripAnsi(overlay.render(120).join("\n"));
			if (rendered.includes("NEW") && rendered.includes("FRAME")) {
				break;
			}
			await Bun.sleep(5);
		}
		expect(sawOldFrame).toBe(true);
		expect(rendered).toContain("NEW");
		expect(rendered).toContain("FRAME");
	} finally {
		overlay.dispose();
	}
});
