import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { loadBannerFile, loadConfig } from "./config.js";

const originalHome = process.env.HOME;
const originalUserProfile = process.env.USERPROFILE;
const originalAgentDir = process.env.PI_CODING_AGENT_DIR;
const originalConfigDir = process.env.PI_CONFIG_DIR;
const originalCwd = process.cwd();

let tempRoot = "";
let homeDir = "";
let cwd = "";

beforeEach(() => {
	tempRoot = mkdtempSync(join(tmpdir(), "pi-welcome-screen-config-"));
	homeDir = join(tempRoot, "home");
	cwd = join(tempRoot, "project");

	mkdirSync(homeDir, { recursive: true });
	mkdirSync(cwd, { recursive: true });

	process.env.HOME = homeDir;
	delete process.env.USERPROFILE;
	delete process.env.PI_CODING_AGENT_DIR;
	delete process.env.PI_CONFIG_DIR;
	process.chdir(cwd);
});

afterEach(() => {
	process.chdir(originalCwd);

	if (originalHome === undefined) {
		delete process.env.HOME;
	} else {
		process.env.HOME = originalHome;
	}

	if (originalUserProfile === undefined) {
		delete process.env.USERPROFILE;
	} else {
		process.env.USERPROFILE = originalUserProfile;
	}

	if (originalAgentDir === undefined) {
		delete process.env.PI_CODING_AGENT_DIR;
	} else {
		process.env.PI_CODING_AGENT_DIR = originalAgentDir;
	}

	if (originalConfigDir === undefined) {
		delete process.env.PI_CONFIG_DIR;
	} else {
		process.env.PI_CONFIG_DIR = originalConfigDir;
	}

	rmSync(tempRoot, { recursive: true, force: true });
});

test("loadConfig reads ~/.pi/agent/pi-welcome-screen/settings.json", () => {
	const configDir = join(homeDir, ".pi", "agent", "pi-welcome-screen");
	mkdirSync(configDir, { recursive: true });
	writeFileSync(
		join(configDir, "settings.json"),
		JSON.stringify({ mainText: "from-pi-agent", animationStyle: "static" }),
	);

	expect(loadConfig().mainText).toBe("from-pi-agent");
});

test("loadConfig prefers ~/.pi over ~/.omp", () => {
	const piConfigDir = join(homeDir, ".pi", "agent", "pi-welcome-screen");
	const ompConfigDir = join(homeDir, ".omp", "agent", "pi-welcome-screen");
	mkdirSync(piConfigDir, { recursive: true });
	mkdirSync(ompConfigDir, { recursive: true });
	writeFileSync(join(piConfigDir, "settings.json"), JSON.stringify({ mainText: "pi" }));
	writeFileSync(join(ompConfigDir, "settings.json"), JSON.stringify({ mainText: "omp" }));

	expect(loadConfig().mainText).toBe("pi");
});

test("loadConfig falls back to ~/.omp agent settings", () => {
	const configDir = join(homeDir, ".omp", "agent", "pi-welcome-screen");
	mkdirSync(configDir, { recursive: true });
	writeFileSync(join(configDir, "settings.json"), JSON.stringify({ mainText: "from-omp-agent" }));

	expect(loadConfig().mainText).toBe("from-omp-agent");
});

test("loadConfig prefers PI_CODING_AGENT_DIR override", () => {
	const piConfigDir = join(homeDir, ".pi", "agent", "pi-welcome-screen");
	const ompConfigDir = join(homeDir, ".omp", "agent", "pi-welcome-screen");
	const customAgentDir = join(tempRoot, "custom-agent");
	mkdirSync(piConfigDir, { recursive: true });
	mkdirSync(ompConfigDir, { recursive: true });
	mkdirSync(join(customAgentDir, "pi-welcome-screen"), { recursive: true });
	writeFileSync(join(piConfigDir, "settings.json"), JSON.stringify({ mainText: "pi" }));
	writeFileSync(join(ompConfigDir, "settings.json"), JSON.stringify({ mainText: "omp" }));
	writeFileSync(
		join(customAgentDir, "pi-welcome-screen", "settings.json"),
		JSON.stringify({ mainText: "custom" }),
	);
	process.env.PI_CODING_AGENT_DIR = customAgentDir;

	expect(loadConfig().mainText).toBe("custom");
});

test("loadConfig includes terminal banner command default and override", () => {
	expect(loadConfig().terminalBannerCommand).toBe("");

	const configDir = join(homeDir, ".pi", "agent", "pi-welcome-screen");
	mkdirSync(configDir, { recursive: true });
	writeFileSync(
		join(configDir, "settings.json"),
		JSON.stringify({ terminalBannerCommand: "ascii-aniation run" }),
	);

	expect(loadConfig().terminalBannerCommand).toBe("ascii-aniation run");
});

test("loadConfig includes terminal banner sizing defaults and overrides", () => {
	expect(loadConfig().terminalBannerRows).toBe(6);
	expect(loadConfig().terminalBannerColumns).toBe(0);
	expect(loadConfig().terminalBannerFrameDelayMs).toBe(33);

	const configDir = join(homeDir, ".pi", "agent", "pi-welcome-screen");
	mkdirSync(configDir, { recursive: true });
	writeFileSync(
		join(configDir, "settings.json"),
		JSON.stringify({
			terminalBannerRows: 10,
			terminalBannerColumns: 100,
			terminalBannerFrameDelayMs: 50,
		}),
	);

	const config = loadConfig();
	expect(config.terminalBannerRows).toBe(10);
	expect(config.terminalBannerColumns).toBe(100);
	expect(config.terminalBannerFrameDelayMs).toBe(50);
});

test("loadBannerFile reads ~/.pi/agent/pi-welcome-screen/banner.txt", () => {
	const configDir = join(homeDir, ".pi", "agent", "pi-welcome-screen");
	mkdirSync(configDir, { recursive: true });
	writeFileSync(join(configDir, "settings.json"), JSON.stringify({ animationStyle: "static" }));
	writeFileSync(join(configDir, "banner.txt"), "Line 1\nLine 2\n");

	expect(loadBannerFile(loadConfig())).toEqual(["Line 1", "Line 2"]);
});

test("loadBannerFile expands ~/ in explicit bannerFile", () => {
	const configDir = join(homeDir, ".pi", "agent", "pi-welcome-screen");
	mkdirSync(configDir, { recursive: true });
	writeFileSync(
		join(configDir, "settings.json"),
		JSON.stringify({ bannerFile: "~/custom-banner.txt", animationStyle: "static" }),
	);
	writeFileSync(join(homeDir, "custom-banner.txt"), "Custom\nBanner\n");

	expect(loadBannerFile(loadConfig())).toEqual(["Custom", "Banner"]);
});
