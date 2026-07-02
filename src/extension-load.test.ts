import { expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

function resolvePiCodingAgentRoot() {
	const localRoot = join(process.cwd(), "node_modules", "@oh-my-pi", "pi-coding-agent");
	if (existsSync(localRoot)) {
		return localRoot;
	}

	const homeDir = process.env.HOME ?? process.env.USERPROFILE;
	if (!homeDir) {
		return null;
	}

	const bunGlobalRoot = join(homeDir, ".bun", "install", "global", "node_modules", "@oh-my-pi", "pi-coding-agent");
	return existsSync(bunGlobalRoot) ? bunGlobalRoot : null;
}

test("local package extension loads through OMP legacy loader", async () => {
	const packageRoot = resolvePiCodingAgentRoot();
	if (!packageRoot) {
		return;
	}

	// Runtime-selected path: peer dependency may be installed locally or via Bun global packages.
	const [{ loadSessionExtensions }, { Settings }, { EventBus }] = await Promise.all([
		import(pathToFileURL(join(packageRoot, "src", "index.ts")).href),
		import(pathToFileURL(join(packageRoot, "src", "config", "settings.ts")).href),
		import(pathToFileURL(join(packageRoot, "src", "utils", "event-bus.ts")).href),
	]);
	const result = await loadSessionExtensions(
		{ additionalExtensionPaths: ["."] },
		process.cwd(),
		Settings.isolated(),
		new EventBus(),
	);

	const localExtension = result.extensions.find((extension) =>
		extension.resolvedPath.endsWith("/src/index.ts"),
	);
	const localErrors = result.errors.filter((error) =>
		error.path.endsWith("/src/index.ts"),
	);

	expect(localErrors).toEqual([]);
	expect(localExtension).toBeDefined();
	expect(localExtension?.handlers.has("session_start")).toBe(true);
	expect(localExtension?.handlers.has("message_start")).toBe(true);
	expect(localExtension?.handlers.has("agent_start")).toBe(true);
	expect(localExtension?.handlers.has("tool_call")).toBe(false);
	expect(localExtension?.commands.has("welcome-reload")).toBe(true);
});
