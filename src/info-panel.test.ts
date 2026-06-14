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

import { discoverLoadedCounts } from "./info-panel.js";

const originalHome = process.env.HOME;
const originalUserProfile = process.env.USERPROFILE;
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
