import { expect, test } from "bun:test";

import { centerPadLine, fitLine, stripAnsi } from "./renderer.js";

test("fitLine preserves ansi color when truncating", () => {
	const line = "\x1b[38;2;1;2;3mCOLORFUL\x1b[0m";

	const fitted = fitLine(line, 5);

	expect(fitted).toContain("\x1b[38;2;1;2;3m");
	expect(stripAnsi(fitted)).toBe("COLO…");
});

test("centerPadLine preserves ansi color when clipping", () => {
	const line = "\x1b[38;2;1;2;3mCOLORFUL\x1b[0m";

	const centered = centerPadLine(line, 4);

	expect(centered).toContain("\x1b[38;2;1;2;3m");
	expect(stripAnsi(centered)).toBe("COLO");
});
