import { expect, test } from "bun:test";

import registerWelcomeScreen from "./index.js";

test("registers assistant dismissal and agent-start fallback", () => {
	const handlers = new Map<string, Function[]>();
	const pi = {
		on(event: string, handler: Function) {
			const existing = handlers.get(event) ?? [];
			existing.push(handler);
			handlers.set(event, existing);
		},
		registerCommand() {
			return undefined;
		},
	} as any;

	registerWelcomeScreen(pi);

	expect(handlers.has("message_start")).toBe(true);
	expect(handlers.has("agent_start")).toBe(true);
	expect(handlers.has("tool_call")).toBe(false);
});
