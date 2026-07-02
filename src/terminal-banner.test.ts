import { expect, test } from "bun:test";

import { stripAnsi } from "./renderer.js";
import { TerminalBannerFrameBuffer, TerminalBannerProcess } from "./terminal-banner.js";

test("terminal banner frame buffer returns current frame at fixed banner size", () => {
	const buffer = new TerminalBannerFrameBuffer({ rows: 3, columns: 8 });

	buffer.ingest("\x1b[2J\x1b[HHELLO\nWORLD");
	expect(buffer.publish()).toBe(true);

	const lines = buffer.getLines();
	expect(lines).toHaveLength(3);
	for (const line of lines) {
		expect(line).toHaveLength(8);
	}
	expect(lines.join("\n")).toContain("HELLO");
	expect(lines.join("\n")).toContain("WORLD");
	expect(lines.join("\n")).not.toContain("\x1b");
});

test("terminal banner frame buffer preserves color after sgr reset prefix", () => {
	const buffer = new TerminalBannerFrameBuffer({ rows: 1, columns: 4 });

	buffer.ingest("\x1b[0;38;2;1;2;3mA\x1b[0mB");
	expect(buffer.publish()).toBe(true);
	const [line] = buffer.getLines();

	expect(line).toContain("\x1b[38;2;1;2;3m");
	expect(stripAnsi(line ?? "")).toBe("AB  ");
});

test("terminal banner frame buffer keeps latest clear-screen frame", () => {
	const buffer = new TerminalBannerFrameBuffer({ rows: 3, columns: 8 });

	buffer.ingest("OLD\nFRAME\x1b[2J\x1b[HNEW");
	expect(buffer.publish()).toBe(true);

	expect(buffer.getLines().join("\n")).toContain("NEW");
	expect(buffer.getLines().join("\n")).not.toContain("OLD");
});

test("terminal banner frame buffer does not publish partial clear redraws", () => {
	const buffer = new TerminalBannerFrameBuffer({ rows: 2, columns: 8 });

	buffer.ingest("\x1b[2J\x1b[1;1HOLD\nFRAME");
	expect(buffer.publish()).toBe(true);
	expect(stripAnsi(buffer.getLines().join("\n"))).toContain("OLD");

	expect(buffer.ingest("\x1b[2J\x1b[1;1HNEW")).toBe(true);
	expect(stripAnsi(buffer.getLines().join("\n"))).toContain("OLD");
	expect(stripAnsi(buffer.getLines().join("\n"))).not.toContain("NEW");

	buffer.ingest("\nFRAME");
	expect(buffer.publish()).toBe(true);
	const rendered = stripAnsi(buffer.getLines().join("\n"));
	expect(rendered).toContain("NEW");
	expect(rendered).toContain("FRAME");
	expect(rendered).not.toContain("OLD");
});

test("terminal banner frame buffer places text by cursor position", () => {
	const buffer = new TerminalBannerFrameBuffer({ rows: 3, columns: 8 });

	buffer.ingest("\x1b[2J\x1b[1;1H\x1b[2;3HHELLO\x1b[3;2HOK");
	expect(buffer.publish()).toBe(true);

	expect(buffer.getLines()).toEqual([
		"        ",
		"  HELLO ",
		" OK     ",
	]);
});

test("terminal banner frame buffer restores cursor position", () => {
	const buffer = new TerminalBannerFrameBuffer({ rows: 3, columns: 8 });

	buffer.ingest("\x1b[2J\x1b[HAB\x1b7\x1b[2;5HXY\x1b8Z");
	expect(buffer.publish()).toBe(true);

	expect(buffer.getLines()).toEqual([
		"ABZ     ",
		"    XY  ",
		"        ",
	]);
});

test("terminal banner frame buffer preserves sgr color for visible cells", () => {
	const buffer = new TerminalBannerFrameBuffer({ rows: 1, columns: 4 });

	buffer.ingest("\x1b[38;2;1;2;3mA\x1b[0mB");
	expect(buffer.publish()).toBe(true);
	const [line] = buffer.getLines();

	expect(line).toContain("\x1b[38;2;1;2;3m");
	expect(line).toContain("\x1b[0m");
	expect(stripAnsi(line ?? "")).toBe("AB  ");
});

test("terminal banner frame buffer resets style before trailing blanks", () => {
	const buffer = new TerminalBannerFrameBuffer({ rows: 1, columns: 4 });

	buffer.ingest("\x1b[38;2;1;2;3mA");
	expect(buffer.publish()).toBe(true);

	expect(buffer.getLines()).toEqual(["\x1b[38;2;1;2;3mA\x1b[0m   "]);
});

test("terminal banner frame buffer centers a wide cursor-drawn scene", () => {
	const buffer = new TerminalBannerFrameBuffer({ rows: 3, columns: 8 });

	buffer.ingest("\x1b[10;30HLEFT\x1b[11;40HCENTER\x1b[12;55HRIGHT");
	expect(buffer.publish()).toBe(true);

	const joined = stripAnsi(buffer.getLines().join("\n"));
	expect(joined).toContain("CENTER");
	expect(joined).not.toContain("LEFT");
	expect(joined).not.toContain("RIGHT");
});

test("terminal banner frame buffer selects the densest viewport from a taller screen", () => {
	const buffer = new TerminalBannerFrameBuffer({ rows: 3, columns: 8 });

	buffer.ingest("\x1b[10;2HAA\x1b[11;2HBB");
	expect(buffer.publish()).toBe(true);

	expect(buffer.getLines()).toEqual([
		"        ",
		" AA     ",
		" BB     ",
	]);
});

test("terminal banner frame buffer honors erase line modes", () => {
	const buffer = new TerminalBannerFrameBuffer({ rows: 2, columns: 8 });

	buffer.ingest("\x1b[2J\x1b[1;1HABCDE\x1b[1;3H\x1b[1K\x1b[2;1HFGHIJ\x1b[2;3H\x1b[2K");
	expect(buffer.publish()).toBe(true);

	expect(buffer.getLines()).toEqual([
		"   DE   ",
		"        ",
	]);
});

test("terminal banner process runs commands with a tty for cursor-driven output", async () => {
	const command = `${JSON.stringify(process.execPath)} -e ${JSON.stringify(
		"if (!process.stdout.isTTY) process.exit(9); process.stdout.write('\\u001b[2J\\u001b[2;3HPTY')",
	)}`;
	const processBanner = new TerminalBannerProcess({
		command,
		rows: 3,
		columns: 8,
		frameDelayMs: 0,
		onFrame() {
			return undefined;
		},
		debug: false,
	});

	try {
		processBanner.start();
		await Bun.sleep(250);
		const rendered = processBanner.getLines().join("\n");

		expect(rendered).toContain("PTY");
	} finally {
		processBanner.stop();
	}
});

test("terminal banner process coalesces frame notifications by frame delay", async () => {
	let renders = 0;
	const command = `${JSON.stringify(process.execPath)} -e ${JSON.stringify(
		"process.stdout.write('\\u001b[2J\\u001b[1;1HA'); process.stdout.write('\\u001b[2J\\u001b[1;1HB')",
	)}`;
	const processBanner = new TerminalBannerProcess({
		command,
		rows: 1,
		columns: 4,
		frameDelayMs: 50,
		onFrame() {
			renders += 1;
		},
		debug: false,
	});

	try {
		processBanner.start();
		await Bun.sleep(150);
		expect(renders).toBeLessThanOrEqual(2);
		expect(processBanner.getLines().join("\n")).toContain("B");
	} finally {
		processBanner.stop();
	}
});

test("terminal banner process coalesces repeated updates within a frame window", async () => {
	let renders = 0;
	const command = `${JSON.stringify(process.execPath)} -e ${JSON.stringify(
		"let i = 0; const tick = () => { if (i >= 5) return; process.stdout.write('\\u001b[2J\\u001b[1;1H' + String.fromCharCode(65 + i)); i += 1; setTimeout(tick, 5); }; tick(); setTimeout(() => {}, 80);",
	)}`;
	const processBanner = new TerminalBannerProcess({
		command,
		rows: 1,
		columns: 4,
		frameDelayMs: 50,
		onFrame() {
			renders += 1;
		},
		debug: false,
	});

	try {
		processBanner.start();
		await Bun.sleep(200);
		expect(renders).toBeLessThanOrEqual(2);
		expect(processBanner.getLines().join("\n")).toContain("E");
	} finally {
		processBanner.stop();
	}
});

test("terminal banner process keeps previous frame across slow clear redraw", async () => {
	const snapshots: string[] = [];
	const command = `${JSON.stringify(process.execPath)} -e ${JSON.stringify(
		"process.stdout.write('\\u001b[2J\\u001b[1;1HOLD\\nFRAME'); setTimeout(() => process.stdout.write('\\u001b[2J\\u001b[1;1HNEW'), 80); setTimeout(() => process.stdout.write('\\nFRAME'), 220); setTimeout(() => {}, 340);",
	)}`;
	const processBanner = new TerminalBannerProcess({
		command,
		rows: 2,
		columns: 8,
		frameDelayMs: 50,
		onFrame() {
			snapshots.push(stripAnsi(processBanner.getLines().join("\n")));
		},
		debug: false,
	});

	try {
		processBanner.start();
		await Bun.sleep(430);

		expect(snapshots.some((snapshot) => snapshot.includes("OLD") && snapshot.includes("FRAME"))).toBe(true);
		expect(snapshots.some((snapshot) => snapshot.includes("NEW") && !snapshot.includes("FRAME"))).toBe(false);
		const finalRendered = stripAnsi(processBanner.getLines().join("\n"));
		expect(finalRendered).toContain("NEW");
		expect(finalRendered).toContain("FRAME");
	} finally {
		processBanner.stop();
	}
});


test("terminal banner process passes force color environment", async () => {
	const command = `${JSON.stringify(process.execPath)} -e ${JSON.stringify(
		"process.stdout.write(process.env.FORCE_COLOR + ':' + process.env.COLORTERM + ':' + process.env.CLICOLOR_FORCE)",
	)}`;
	const processBanner = new TerminalBannerProcess({
		command,
		rows: 1,
		columns: 32,
		frameDelayMs: 0,
		onFrame() {
			return undefined;
		},
		debug: false,
	});

	try {
		processBanner.start();
		await Bun.sleep(150);
		expect(processBanner.getLines().join("\n")).toContain("1:truecolor:1");
	} finally {
		processBanner.stop();
	}
});

test("terminal banner process preserves compound cli color through pty", async () => {
	const command = `${JSON.stringify(process.execPath)} -e ${JSON.stringify(
		"process.stdout.write('\\u001b[0;38;2;1;2;3mCOLOR\\u001b[0m')",
	)}`;
	const processBanner = new TerminalBannerProcess({
		command,
		rows: 1,
		columns: 16,
		frameDelayMs: 0,
		onFrame() {
			return undefined;
		},
		debug: false,
	});

	try {
		processBanner.start();
		await Bun.sleep(150);
		const rendered = processBanner.getLines().join("\n");

		expect(rendered).toContain("\x1b[38;2;1;2;3m");
		expect(stripAnsi(rendered)).toContain("COLOR");
	} finally {
		processBanner.stop();
	}
});

test("terminal banner process decodes split utf8 glyphs without replacement characters", async () => {
	const command = `${JSON.stringify(process.execPath)} -e ${JSON.stringify(
		"process.stdout.write(Buffer.from([0xe2])); setTimeout(() => process.stdout.write(Buffer.from([0x94, 0x97])), 20); setTimeout(() => {}, 80);",
	)}`;
	const processBanner = new TerminalBannerProcess({
		command,
		rows: 1,
		columns: 4,
		frameDelayMs: 0,
		onFrame() {
			return undefined;
		},
		debug: false,
	});

	try {
		processBanner.start();
		await Bun.sleep(180);
		const rendered = stripAnsi(processBanner.getLines().join("\n"));

		expect(rendered).toContain("┗");
		expect(rendered).not.toContain("�");
	} finally {
		processBanner.stop();
	}
});


test("terminal banner process preserves final frame on python pty exit", async () => {
	const bunRuntime = globalThis.Bun as typeof Bun & { Terminal: typeof Bun.Terminal };
	const originalTerminal = bunRuntime.Terminal;
	const command = `${JSON.stringify(process.execPath)} -e ${JSON.stringify(
		"process.stdout.write('X'.repeat(70000) + '\\u001b[2J\\u001b[1;1HLAST'); process.exit(0);",
	)}`;
	const processBanner = new TerminalBannerProcess({
		command,
		rows: 1,
		columns: 8,
		frameDelayMs: 0,
		onFrame() {
			return undefined;
		},
		debug: false,
	});

	try {
		bunRuntime.Terminal = undefined as never;
		processBanner.start();
		await Bun.sleep(200);
		expect(stripAnsi(processBanner.getLines().join("\n"))).toContain("LAST");
	} finally {
		processBanner.stop();
		bunRuntime.Terminal = originalTerminal;
	}
});

test("terminal banner process preserves final frame on delayed python pty close", async () => {
	const bunRuntime = globalThis.Bun as typeof Bun & { Terminal: typeof Bun.Terminal };
	const originalTerminal = bunRuntime.Terminal;
	const command = `${JSON.stringify(process.execPath)} -e ${JSON.stringify(
		"process.stdout.write('X'.repeat(70000) + '\\u001b[2J\\u001b[1;1HLATE'); process.exit(0);",
	)}`;
	const processBanner = new TerminalBannerProcess({
		command,
		rows: 1,
		columns: 8,
		frameDelayMs: 50,
		onFrame() {
			return undefined;
		},
		debug: false,
	});

	try {
		bunRuntime.Terminal = undefined as never;
		processBanner.start();
		await Bun.sleep(250);
		expect(stripAnsi(processBanner.getLines().join("\n"))).toContain("LATE");
	} finally {
		processBanner.stop();
		bunRuntime.Terminal = originalTerminal;
	}
});

test("terminal banner process preserves final frame on Bun pty close", async () => {
	const command = `${JSON.stringify(process.execPath)} -e ${JSON.stringify(
		"process.stdout.write('X'.repeat(70000) + '\\u001b[2J\\u001b[1;1HBUN'); process.exit(0);",
	)}`;
	const processBanner = new TerminalBannerProcess({
		command,
		rows: 1,
		columns: 8,
		frameDelayMs: 50,
		onFrame() {
			return undefined;
		},
		debug: false,
	});

	try {
		processBanner.start();
		await Bun.sleep(250);
		expect(stripAnsi(processBanner.getLines().join("\n"))).toContain("BUN");
	} finally {
		processBanner.stop();
	}
});
