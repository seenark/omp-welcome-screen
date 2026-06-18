import { expect, test } from "bun:test";

import { Settings } from "../node_modules/@oh-my-pi/pi-coding-agent/src/config/settings.ts";
import { loadSessionExtensions } from "../node_modules/@oh-my-pi/pi-coding-agent/src/sdk.ts";
import { EventBus } from "../node_modules/@oh-my-pi/pi-coding-agent/src/utils/event-bus.ts";

test("local package extension loads through OMP legacy loader", async () => {
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
