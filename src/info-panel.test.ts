import { afterEach, beforeEach, expect, spyOn, test } from "bun:test";
import {
	mkdtempSync,
	mkdirSync,
	rmSync,
	symlinkSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { discoverLoadedCounts, discoverLoadedResources } from "./info-panel.js";

const originalHome = process.env.HOME;
const originalUserProfile = process.env.USERPROFILE;
const originalAgentDir = process.env.PI_CODING_AGENT_DIR;
const originalCwd = process.cwd();

let tempRoot = "";

beforeEach(() => {
	tempRoot = mkdtempSync(join(tmpdir(), "pi-welcome-screen-"));
	const homeDir = join(tempRoot, "home");
	const cwd = join(tempRoot, "project");

	mkdirSync(homeDir, { recursive: true });
	mkdirSync(cwd, { recursive: true });

	process.env.HOME = homeDir;
	delete process.env.USERPROFILE;
	process.env.PI_CODING_AGENT_DIR = join(homeDir, ".omp", "agent");
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

	rmSync(tempRoot, { recursive: true, force: true });
});

test("discoverLoadedCounts is not tied to skill directories", () => {
	const homeDir = process.env.HOME;
	if (homeDir === undefined) throw new Error("HOME must be set by test setup");

	const debugSpy = spyOn(console, "debug").mockImplementation(() => {});
	try {
		const skillsDir = join(homeDir, ".pi", "agent", "skills");
		mkdirSync(skillsDir, { recursive: true });
		symlinkSync(
			join(tempRoot, "missing-skill-target"),
			join(skillsDir, "broken-skill"),
			"dir",
		);

		const extensionDir = join(
			homeDir,
			".pi",
			"agent",
			"extensions",
			"demo-extension",
		);
		mkdirSync(extensionDir, { recursive: true });
		writeFileSync(join(extensionDir, "package.json"), "{}\n");

		writeFileSync(join(process.cwd(), "AGENTS.md"), "# Project\n");

		const commandDir = join(process.cwd(), ".claude", "commands");
		mkdirSync(commandDir, { recursive: true });
		writeFileSync(join(commandDir, "plan.md"), "# Command\n");

		expect(discoverLoadedCounts()).toEqual({
			contextFiles: 1,
			extensions: 1,
			promptTemplates: 1,
			themes: 0,
		});
		expect(debugSpy).not.toHaveBeenCalled();
	} finally {
		debugSpy.mockRestore();
	}
});

test("discoverLoadedResources is not tied to skill directories", () => {
	const homeDir = process.env.HOME;
	if (homeDir === undefined) throw new Error("HOME must be set by test setup");

	const debugSpy = spyOn(console, "debug").mockImplementation(() => {});
	try {
		const skillsDir = join(homeDir, ".pi", "agent", "skills");
		mkdirSync(skillsDir, { recursive: true });
		symlinkSync(
			join(tempRoot, "missing-skill-target"),
			join(skillsDir, "broken-skill"),
			"dir",
		);

		const extensionDir = join(
			homeDir,
			".pi",
			"agent",
			"extensions",
			"demo-extension",
		);
		mkdirSync(extensionDir, { recursive: true });
		writeFileSync(join(extensionDir, "package.json"), "{}\n");

		writeFileSync(join(process.cwd(), "AGENTS.md"), "# Project\n");

		const commandDir = join(process.cwd(), ".claude", "commands");
		mkdirSync(commandDir, { recursive: true });
		writeFileSync(join(commandDir, "plan.md"), "# Command\n");

		expect(discoverLoadedResources()).toEqual({
			counts: {
				contextFiles: 1,
				extensions: 1,
				promptTemplates: 1,
				themes: 0,
			},
			names: {
				contextFiles: ["AGENTS.md"],
				extensions: ["demo-extension"],
				prompts: ["/plan"],
				themes: [],
			},
		});
		expect(debugSpy).not.toHaveBeenCalled();
	} finally {
		debugSpy.mockRestore();
	}
});

test("discoverLoadedResources includes Oh-My-Pi agent directories", () => {
	const homeDir = process.env.HOME;
	if (homeDir === undefined) throw new Error("HOME must be set by test setup");

	const extensionDir = join(
		homeDir,
		".omp",
		"agent",
		"extensions",
		"demo-omp-extension",
	);
	mkdirSync(extensionDir, { recursive: true });
	writeFileSync(join(extensionDir, "package.json"), "{}\n");

	const commandDir = join(homeDir, ".omp", "agent", "commands");
	mkdirSync(commandDir, { recursive: true });
	writeFileSync(join(commandDir, "omp-plan.md"), "# OMP Command\n");

	const themeDir = join(homeDir, ".omp", "agent", "themes");
	mkdirSync(themeDir, { recursive: true });
	writeFileSync(join(themeDir, "mocha.json"), "{}\n");

	expect(discoverLoadedResources()).toEqual({
		counts: {
			contextFiles: 0,
			extensions: 1,
			promptTemplates: 1,
			themes: 1,
		},
		names: {
			contextFiles: [],
			extensions: ["demo-omp-extension"],
			prompts: ["/omp-plan"],
			themes: ["mocha"],
		},
	});
});
