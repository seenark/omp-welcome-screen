import { spawn } from "node:child_process";
import { EventEmitter } from "node:events";

export interface TerminalBannerFrameOptions {
	rows: number;
	columns: number;
}

interface TerminalStyle {
	fg: string;
	bg: string;
	intensity: "" | "1" | "2";
}

interface TerminalCell {
	char: string;
	style: TerminalStyle;
}

type TerminalBannerDataHandler = (chunk: Buffer | string) => void;
type TerminalBannerErrorHandler = (error: Error) => void;
type TerminalBannerExitHandler = () => void;
type TerminalBannerCloseHandler = () => void;

interface TerminalBannerReadable {
	on(event: "data", handler: TerminalBannerDataHandler): void;
	off(event: "data", handler: TerminalBannerDataHandler): void;
}

interface TerminalBannerChild {
	stdout?: TerminalBannerReadable;
	stderr?: TerminalBannerReadable;
	on(event: "error", handler: TerminalBannerErrorHandler): void;
	on(event: "exit", handler: TerminalBannerExitHandler): void;
	on(event: "close", handler: TerminalBannerCloseHandler): void;
	off(event: "error", handler: TerminalBannerErrorHandler): void;
	off(event: "exit", handler: TerminalBannerExitHandler): void;
	off(event: "close", handler: TerminalBannerCloseHandler): void;
	kill(): void;
}

interface BunTerminalInstance {
	close(): void;
}

interface BunSpawnedProcess {
	exited: Promise<unknown>;
	kill(): void;
}

type BunTerminalConstructor = new (options: {
	cols: number;
	rows: number;
	data: (terminal: BunTerminalInstance, data: BufferSource) => void;
}) => BunTerminalInstance;

type BunSpawnFunction = (
	command: string[],
	options: { terminal: BunTerminalInstance; env: Record<string, string> },
) => BunSpawnedProcess;

const DEFAULT_STYLE: TerminalStyle = {
	fg: "",
	bg: "",
	intensity: "",
};

export class TerminalBannerFrameBuffer {
	private readonly rows: number;
	private readonly captureRows: number;
	private readonly captureColumns: number;
	private readonly columns: number;
	private screen: TerminalCell[][];
	private lines: string[];
	private pendingLines: string[];
	private pendingContent = false;
	private content = false;
	private cursorRow = 0;
	private cursorColumn = 0;
	private currentStyle: TerminalStyle = cloneStyle(DEFAULT_STYLE);
	private state: "text" | "escape" | "csi" | "osc" = "text";
	private sequence = "";
	private oscEscapePending = false;

	constructor(options: TerminalBannerFrameOptions) {
		this.rows = options.rows;
		this.captureRows = getCaptureRows(options.rows);
		this.captureColumns = getCaptureColumns(options.columns);
		this.columns = options.columns;
		this.screen = createBlankScreen(this.captureRows, this.captureColumns);
		this.lines = selectViewport(this.screen, this.rows, this.columns);
		this.pendingLines = [...this.lines];
	}

	ingest(chunk: string): boolean {
		for (const char of normalizeChunk(chunk)) {
			this.consumeCharacter(char);
		}

		this.pendingLines = selectViewport(this.screen, this.rows, this.columns);
		this.pendingContent = this.screen.some((row) => row.some((cell) => cell.char !== " "));
		return !sameLines(this.pendingLines, this.lines);
	}

	publish(): boolean {
		if (sameLines(this.pendingLines, this.lines) && this.pendingContent === this.content) {
			return false;
		}
		this.lines = [...this.pendingLines];
		this.content = this.pendingContent;
		return true;
	}

	getLines(): string[] {
		return [...this.lines];
	}

	hasContent(): boolean {
		return this.content;
	}

	private consumeCharacter(char: string): void {
		if (this.state === "text") {
			if (char === "\x1b") {
				this.state = "escape";
				this.sequence = "";
				return;
			}
			if (char === "\n") {
				this.cursorRow = Math.min(this.captureRows - 1, this.cursorRow + 1);
				this.cursorColumn = 0;
				return;
			}
			if (char === "\r") {
				this.cursorColumn = 0;
				return;
			}
			if (char === "\b") {
				this.cursorColumn = Math.max(0, this.cursorColumn - 1);
				return;
			}
			if (char === "\t") {
				const tabWidth = 4;
				const nextStop = Math.min(
					this.captureColumns,
					this.cursorColumn + (tabWidth - (this.cursorColumn % tabWidth)),
				);
				if (nextStop === this.cursorColumn) {
					this.writeCharacter(" ");
					return;
				}
				while (this.cursorColumn < nextStop) {
					this.writeCharacter(" ");
				}
				return;
			}
			if (char >= " " && char !== "\x7f") {
				this.writeCharacter(char);
			}
			return;
		}

		if (this.state === "escape") {
			if (char === "[") {
				this.state = "csi";
				this.sequence = "";
				return;
			}
			if (char === "]") {
				this.state = "osc";
				this.sequence = "";
				this.oscEscapePending = false;
				return;
			}
			if (char === "c") {
				this.resetScreen();
			}
			this.state = "text";
			this.sequence = "";
			return;
		}

		if (this.state === "osc") {
			if (this.oscEscapePending) {
				this.oscEscapePending = false;
				if (char === "\\") {
					this.state = "text";
					this.sequence = "";
					return;
				}
			}
			if (char === "\x07") {
				this.state = "text";
				this.sequence = "";
				return;
			}
			if (char === "\x1b") {
				this.oscEscapePending = true;
			}
			return;
		}

		this.sequence += char;
		if (char >= "@" && char <= "~") {
			this.applyCsi(this.sequence);
			this.state = "text";
			this.sequence = "";
		}
	}

	private applyCsi(sequence: string): void {
		const final = sequence.at(-1) ?? "";
		const rawParams = sequence.slice(0, -1);
		const params = rawParams.replace(/^\?/, "").split(";");

		if (final === "H" || final === "f") {
			const row = Number(params[0] || "1");
			const column = Number(params[1] || "1");
			this.cursorRow = Number.isFinite(row) ? Math.min(this.captureRows - 1, Math.max(0, row - 1)) : 0;
			this.cursorColumn = Number.isFinite(column)
				? Math.min(this.captureColumns - 1, Math.max(0, column - 1))
				: 0;
			return;
		}

		if (final === "J") {
			const mode = params[0] || "0";
			if (mode === "2" || mode === "3") {
				this.clearScreen();
			}
			return;
		}
		if (final === "m") {
			this.currentStyle = applySgrParams(this.currentStyle, rawParams);
			return;
		}

		if (final === "K") {
			const row = this.screen[this.cursorRow];
			if (!row) {
				return;
			}
			const mode = params[0] || "0";
			const start = mode === "1" || mode === "2" ? 0 : this.cursorColumn;
			const end = mode === "0" ? this.captureColumns - 1 : mode === "1" ? this.cursorColumn : this.captureColumns - 1;
			for (let index = start; index <= end; index++) {
				row[index] = { char: " ", style: cloneStyle(DEFAULT_STYLE) };
			}
			return;
		}

		if (final === "A") {
			const amount = Number(params[0] || "1");
			this.cursorRow = Math.max(0, this.cursorRow - (Number.isFinite(amount) ? amount : 1));
			return;
		}

		if (final === "B") {
			const amount = Number(params[0] || "1");
			this.cursorRow = Math.min(this.captureRows - 1, this.cursorRow + (Number.isFinite(amount) ? amount : 1));
			return;
		}

		if (final === "C") {
			const amount = Number(params[0] || "1");
			this.cursorColumn = Math.min(
				this.captureColumns - 1,
				this.cursorColumn + (Number.isFinite(amount) ? amount : 1),
			);
			return;
		}

		if (final === "D") {
			const amount = Number(params[0] || "1");
			this.cursorColumn = Math.max(0, this.cursorColumn - (Number.isFinite(amount) ? amount : 1));
			return;
		}

		if (final === "G") {
			const column = Number(params[0] || "1");
			this.cursorColumn = Number.isFinite(column)
				? Math.min(this.captureColumns - 1, Math.max(0, column - 1))
				: 0;
		}
	}

	private writeCharacter(char: string): void {
		if (this.cursorRow < 0 || this.cursorRow >= this.captureRows) {
			return;
		}
		if (this.cursorColumn >= this.captureColumns) {
			this.cursorColumn = 0;
			this.cursorRow = Math.min(this.captureRows - 1, this.cursorRow + 1);
		}
		if (this.cursorRow < 0 || this.cursorRow >= this.captureRows) {
			return;
		}
		this.screen[this.cursorRow]![this.cursorColumn] = {
			char,
			style: cloneStyle(this.currentStyle),
		};
		this.cursorColumn += 1;
	}

	private clearScreen(): void {
		this.screen = createBlankScreen(this.captureRows, this.captureColumns);
	}

	private resetScreen(): void {
		this.clearScreen();
		this.cursorRow = 0;
		this.cursorColumn = 0;
		this.currentStyle = cloneStyle(DEFAULT_STYLE);
	}
}

export interface TerminalBannerProcessOptions extends TerminalBannerFrameOptions {
	command: string;
	onFrame: () => void;
	frameDelayMs: number;
	debug: boolean;
}

type RenderTimer = NodeJS.Timeout;

export class TerminalBannerProcess {
	private readonly command: string;
	private readonly rows: number;
	private readonly columns: number;
	private readonly captureColumns: number;
	private readonly onFrame: () => void;
	private readonly debug: boolean;
	private readonly buffer: TerminalBannerFrameBuffer;
	private readonly frameDelayMs: number;
	private child: TerminalBannerChild | null = null;
	private failed = false;
	private exited = false;
	private renderTimer: RenderTimer | null = null;
	private lastRenderTime = 0;
	private lastChangeTime = 0;
	private pendingFrame = false;
	private readonly handleStdout = (chunk: Buffer | string) => {
		if (this.buffer.ingest(chunk.toString())) {
			this.lastChangeTime = Date.now();
			this.scheduleRender();
		}
	};
	private readonly handleStderr = (chunk: Buffer | string) => {
		if (!this.debug) {
			return;
		}
		console.error(
			"[pi-welcome-screen] terminal banner stderr:",
			chunk.toString(),
		);
	};
	private readonly handleError = (error: Error) => {
		this.failed = true;
		this.child = null;
		if (this.debug) {
			console.error("[pi-welcome-screen] terminal banner failed:", error);
		}
	};
	private readonly handleExit = () => {
		this.exited = true;
		if (this.renderTimer) {
			clearTimeout(this.renderTimer);
			this.renderTimer = null;
		}
		this.pendingFrame = false;
		if (this.buffer.publish()) {
			this.onFrame();
		}
	};
	private readonly handleClose = () => {
		if (this.renderTimer) {
			clearTimeout(this.renderTimer);
			this.renderTimer = null;
		}
		this.pendingFrame = false;
		this.exited = true;
		if (this.buffer.publish()) {
			this.onFrame();
		}
		this.child = null;
	};

	constructor(options: TerminalBannerProcessOptions) {
		this.command = options.command;
		this.rows = options.rows;
		this.columns = options.columns;
		this.captureColumns = getCaptureColumns(options.columns);
		this.onFrame = options.onFrame;
		this.debug = options.debug;
		this.frameDelayMs = Math.max(0, Math.min(1000, Math.trunc(options.frameDelayMs)));
		this.buffer = new TerminalBannerFrameBuffer(options);
	}

	start(): void {
		if (this.child || this.command === "") {
			return;
		}

		this.failed = false;
		this.exited = false;
		if (this.frameDelayMs > 0) {
			this.lastRenderTime = Date.now();
		}
		const child = spawnTerminalBannerChild(
			this.command,
			getCaptureRows(this.rows),
			this.captureColumns,
			this.debug,
		);
		this.child = child;
		child.stdout?.on("data", this.handleStdout);
		child.stderr?.on("data", this.handleStderr);
		child.on("error", this.handleError);
		child.on("exit", this.handleExit);
		child.on("close", this.handleClose);
	}

	stop(): void {
		if (this.renderTimer) {
			clearTimeout(this.renderTimer);
			this.renderTimer = null;
		}
		this.pendingFrame = false;

		const child = this.child;
		if (!child) {
			return;
		}

		child.stdout?.off("data", this.handleStdout);
		child.stderr?.off("data", this.handleStderr);
		child.off("error", this.handleError);
		child.off("exit", this.handleExit);
		child.off("close", this.handleClose);
		child.kill();
		this.child = null;
	}

	getLines(): string[] {
		return this.buffer.getLines();
	}

	private scheduleRender(): void {
		this.pendingFrame = true;
		if (this.frameDelayMs === 0) {
			this.pendingFrame = false;
			if (this.buffer.publish()) {
				this.lastRenderTime = Date.now();
				this.onFrame();
			}
			return;
		}
		if (this.renderTimer) {
			return;
		}
		const renderPendingFrame = () => {
			const dueAt = Math.max(
				this.lastRenderTime + this.frameDelayMs,
				this.lastChangeTime + this.frameDelayMs,
			);
			const delay = dueAt - Date.now();
			if (delay > 0) {
				this.renderTimer = setTimeout(renderPendingFrame, delay);
				return;
			}
			this.renderTimer = null;
			if (!this.pendingFrame) {
				return;
			}
			this.pendingFrame = false;
			if (!this.buffer.publish()) {
				return;
			}
			this.lastRenderTime = Date.now();
			this.onFrame();
		};
		renderPendingFrame();
	}

	shouldRender(): boolean {
		if (this.buffer.hasContent()) {
			return true;
		}
		return this.child !== null && !this.failed && !this.exited;
	}
}

export function getTerminalBannerCommand(value: unknown): string {
	return typeof value === "string" ? value.trim() : "";
}

function spawnTerminalBannerChild(
	command: string,
	rows: number,
	columns: number,
	debug: boolean,
): TerminalBannerChild {
	const bunRuntime = getBunRuntime();
	if (bunRuntime) {
		try {
			return new BunTerminalBannerChild(bunRuntime, command, rows, columns);
		} catch (error) {
			if (debug) {
				console.error("[pi-welcome-screen] terminal banner Bun PTY unavailable:", error);
			}
		}
	}

	return spawn("python3", [
		"-u",
		"-c",
		PYTHON_PTY_BRIDGE,
		command,
		String(rows),
		String(columns),
	], {
		stdio: ["ignore", "pipe", "pipe"],
		env: buildTerminalBannerEnv(),
	});
}

const PYTHON_PTY_BRIDGE = String.raw`import fcntl, os, pty, select, struct, subprocess, sys, termios
command = sys.argv[1]
rows = int(sys.argv[2])
columns = int(sys.argv[3])
master, slave = pty.openpty()
fcntl.ioctl(slave, termios.TIOCSWINSZ, struct.pack("HHHH", rows, columns, 0, 0))
env = os.environ.copy()
env.pop("NO_COLOR", None)
env["TERM"] = env.get("TERM", "xterm-256color")
env["COLORTERM"] = env.get("COLORTERM", "truecolor")
env["FORCE_COLOR"] = env.get("FORCE_COLOR", "1")
env["CLICOLOR"] = env.get("CLICOLOR", "1")
env["CLICOLOR_FORCE"] = env.get("CLICOLOR_FORCE", "1")
env["LINES"] = str(rows)
env["COLUMNS"] = str(columns)
proc = subprocess.Popen(["/bin/sh", "-lc", command], stdin=slave, stdout=slave, stderr=slave, env=env, close_fds=True)
os.close(slave)
try:
    while True:
        ready, _, _ = select.select([master], [], [], 0.05)
        if master in ready:
            try:
                data = os.read(master, 65536)
            except OSError:
                break
            if not data:
                break
            os.write(sys.stdout.fileno(), data)
        if proc.poll() is not None:
            while True:
                ready, _, _ = select.select([master], [], [], 0.05)
                if master not in ready:
                    continue
                try:
                    data = os.read(master, 65536)
                except OSError:
                    break
                if not data:
                    break
                os.write(sys.stdout.fileno(), data)
            break
finally:
    if proc.poll() is None:
        proc.kill()
        proc.wait()
    os.close(master)
sys.exit(proc.returncode or 0)`;

function normalizeChunk(value: string): string {
	return value
		.replace(/\r\n/g, "\n")
		.replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g, "");
}

function getCaptureRows(rows: number): number {
	return Math.max(rows, 24);
}

function getCaptureColumns(columns: number): number {
	return Math.max(columns, 200);
}

function selectViewport(screen: TerminalCell[][], rows: number, columns: number): string[] {
	const bounds = findContentBounds(screen);
	if (!bounds) {
		return renderScreen(cropScreen(screen, 0, 0, rows, columns));
	}

	const contentCenterRow = Math.floor((bounds.top + bounds.bottom) / 2);
	const contentCenterColumn = Math.floor((bounds.left + bounds.right) / 2);
	const maxStartRow = Math.max(0, screen.length - rows);
	const screenColumns = screen[0]?.length ?? columns;
	const maxStartColumn = Math.max(0, screenColumns - columns);
	const startRow = clamp(contentCenterRow - Math.floor(rows / 2), 0, maxStartRow);
	const startColumn = screenColumns <= columns
		? 0
		: clamp(contentCenterColumn - Math.floor(columns / 2), 0, maxStartColumn);

	return renderScreen(cropScreen(screen, startRow, startColumn, rows, columns));
}

function createBlankScreen(rows: number, columns: number): TerminalCell[][] {
	return Array.from({ length: rows }, () =>
		Array.from({ length: columns }, () => ({ char: " ", style: cloneStyle(DEFAULT_STYLE) })),
	);
}

function renderScreen(screen: TerminalCell[][]): string[] {
	return screen.map((row) => renderStyledLine(row));
}

function cloneStyle(style: TerminalStyle): TerminalStyle {
	return {
		fg: style.fg,
		bg: style.bg,
		intensity: style.intensity,
	};
}

function sameStyle(left: TerminalStyle, right: TerminalStyle): boolean {
	return left.fg === right.fg && left.bg === right.bg && left.intensity === right.intensity;
}

function styleToAnsi(style: TerminalStyle): string {
	const params: string[] = [];
	if (style.intensity !== "") {
		params.push(style.intensity);
	}
	if (style.fg !== "") {
		params.push(style.fg);
	}
	if (style.bg !== "") {
		params.push(style.bg);
	}
	return params.length === 0 ? "" : `\x1b[${params.join(";")}m`;
}

function applySgrParams(style: TerminalStyle, rawParams: string): TerminalStyle {
	if (rawParams === "") {
		return cloneStyle(DEFAULT_STYLE);
	}

	const next = cloneStyle(style);
	const params = rawParams.split(";");
	for (let index = 0; index < params.length; index++) {
		const param = params[index] || "0";
		if (param === "0") {
			next.fg = DEFAULT_STYLE.fg;
			next.bg = DEFAULT_STYLE.bg;
			next.intensity = DEFAULT_STYLE.intensity;
			continue;
		}
		if (param === "1" || param === "2") {
			next.intensity = param;
			continue;
		}
		if (param === "22") {
			next.intensity = "";
			continue;
		}
		const code = Number(param);
		if (!Number.isFinite(code)) {
			continue;
		}
		if ((code >= 30 && code <= 37) || (code >= 90 && code <= 97)) {
			next.fg = String(code);
			continue;
		}
		if (code === 39) {
			next.fg = "";
			continue;
		}
		if ((code >= 40 && code <= 47) || (code >= 100 && code <= 107)) {
			next.bg = String(code);
			continue;
		}
		if (code === 49) {
			next.bg = "";
			continue;
		}
		if (code === 38 || code === 48) {
			const channel = code === 38 ? "fg" : "bg";
			const mode = params[index + 1];
			if (mode === "2") {
				const red = parseSgrByte(params[index + 2]);
				const green = parseSgrByte(params[index + 3]);
				const blue = parseSgrByte(params[index + 4]);
				if (red !== null && green !== null && blue !== null) {
					next[channel] = `${code};2;${red};${green};${blue}`;
				}
				index += 4;
				continue;
			}
			if (mode === "5") {
				const color = parseSgrByte(params[index + 2]);
				if (color !== null) {
					next[channel] = `${code};5;${color}`;
				}
				index += 2;
			}
		}
	}
	return next;
}

function renderStyledLine(row: TerminalCell[]): string {
	let rendered = "";
	let activeStyle = cloneStyle(DEFAULT_STYLE);
	for (const cell of row) {
		if (cell.char === " ") {
			if (!sameStyle(activeStyle, DEFAULT_STYLE)) {
				rendered += "\x1b[0m";
				activeStyle = cloneStyle(DEFAULT_STYLE);
			}
			rendered += " ";
			continue;
		}
		if (!sameStyle(cell.style, activeStyle)) {
			const ansi = styleToAnsi(cell.style);
			rendered += ansi === "" ? "\x1b[0m" : ansi;
			activeStyle = cloneStyle(cell.style);
		}
		rendered += cell.char;
	}
	if (!sameStyle(activeStyle, DEFAULT_STYLE)) {
		rendered += "\x1b[0m";
	}
	return rendered;
}

function findContentBounds(screen: TerminalCell[][]): {
	top: number;
	bottom: number;
	left: number;
	right: number;
} | null {
	let top = Number.POSITIVE_INFINITY;
	let bottom = -1;
	let left = Number.POSITIVE_INFINITY;
	let right = -1;
	for (let rowIndex = 0; rowIndex < screen.length; rowIndex++) {
		const row = screen[rowIndex];
		if (!row) {
			continue;
		}
		for (let columnIndex = 0; columnIndex < row.length; columnIndex++) {
			if (row[columnIndex]?.char === " ") {
				continue;
			}
			top = Math.min(top, rowIndex);
			bottom = Math.max(bottom, rowIndex);
			left = Math.min(left, columnIndex);
			right = Math.max(right, columnIndex);
		}
	}
	if (bottom === -1) {
		return null;
	}
	return { top, bottom, left, right };
}

function cropScreen(
	screen: TerminalCell[][],
	startRow: number,
	startColumn: number,
	rows: number,
	columns: number,
): TerminalCell[][] {
	return Array.from({ length: rows }, (_, rowOffset) => {
		const sourceRow = screen[startRow + rowOffset] ?? [];
		return Array.from({ length: columns }, (_, columnOffset) =>
			sourceRow[startColumn + columnOffset] ?? { char: " ", style: cloneStyle(DEFAULT_STYLE) },
		);
	});
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

function sameLines(left: string[], right: string[]): boolean {
	if (left.length !== right.length) {
		return false;
	}
	for (let index = 0; index < left.length; index++) {
		if (left[index] !== right[index]) {
			return false;
		}
	}
	return true;
}

function parseSgrByte(value: string | undefined): number | null {
	if (value === undefined || value === "") {
		return null;
	}
	const numeric = Number(value);
	if (!Number.isInteger(numeric) || numeric < 0 || numeric > 255) {
		return null;
	}
	return numeric;
}

function buildTerminalBannerEnv(): Record<string, string> {
	const env: Record<string, string> = {};
	for (const [key, value] of Object.entries(process.env)) {
		if (typeof value === "string") {
			env[key] = value;
		}
	}
	delete env.NO_COLOR;
	env.TERM = env.TERM || "xterm-256color";
	env.COLORTERM = env.COLORTERM || "truecolor";
	env.FORCE_COLOR = env.FORCE_COLOR || "1";
	env.CLICOLOR = env.CLICOLOR || "1";
	env.CLICOLOR_FORCE = env.CLICOLOR_FORCE || "1";
	return env;
}

function getBunRuntime(): { Terminal: BunTerminalConstructor; spawn: BunSpawnFunction } | null {
	const candidate = globalThis as { Bun?: unknown };
	if (!candidate.Bun || typeof candidate.Bun !== "object") {
		return null;
	}
	const runtime = candidate.Bun as { Terminal?: unknown; spawn?: unknown };
	if (typeof runtime.Terminal !== "function" || typeof runtime.spawn !== "function") {
		return null;
	}
	return {
		Terminal: runtime.Terminal as BunTerminalConstructor,
		spawn: runtime.spawn as BunSpawnFunction,
	};
}

class BunTerminalBannerChild implements TerminalBannerChild {
	private readonly stdoutEmitter = new EventEmitter();
	private readonly stderrEmitter = new EventEmitter();
	private readonly lifecycleEmitter = new EventEmitter();
	private readonly terminal: BunTerminalInstance;
	private readonly process: BunSpawnedProcess;
	private closed = false;
	readonly stdout: TerminalBannerReadable = createReadableEmitter(this.stdoutEmitter);
	readonly stderr: TerminalBannerReadable = createReadableEmitter(this.stderrEmitter);

	constructor(
		runtime: { Terminal: BunTerminalConstructor; spawn: BunSpawnFunction },
		command: string,
		rows: number,
		columns: number,
	) {
		let terminal: BunTerminalInstance | null = null;
		try {
			terminal = new runtime.Terminal({
				cols: columns,
				rows,
				data: (_terminal, data) => {
					this.stdoutEmitter.emit("data", bufferFromSource(data));
				},
			});
			this.terminal = terminal;
			this.process = runtime.spawn(["/bin/sh", "-lc", command], {
				terminal,
				env: buildTerminalBannerEnv(),
			});
			void this.process.exited.then(() => {
				this.lifecycleEmitter.emit("exit");
			}).catch((error: unknown) => {
				this.lifecycleEmitter.emit(
					"error",
					error instanceof Error ? error : new Error(String(error)),
				);
				this.lifecycleEmitter.emit("exit");
			});
		} catch (error) {
			terminal?.close();
			throw error;
		}
	}

	on(
		event: "error" | "exit" | "close",
		handler: TerminalBannerErrorHandler | TerminalBannerExitHandler | TerminalBannerCloseHandler,
	): void {
		this.lifecycleEmitter.on(event, handler);
	}

	off(
		event: "error" | "exit" | "close",
		handler: TerminalBannerErrorHandler | TerminalBannerExitHandler | TerminalBannerCloseHandler,
	): void {
		this.lifecycleEmitter.off(event, handler);
	}

	kill(): void {
		this.closed = true;
		this.process.kill();
		this.terminal.close();
	}

	private closeTerminal(): void {
		if (this.closed) {
			return;
		}
		this.closed = true;
		this.terminal.close();
	}
}

function createReadableEmitter(emitter: EventEmitter): TerminalBannerReadable {
	return {
		on(event, handler) {
			emitter.on(event, handler);
		},
		off(event, handler) {
			emitter.off(event, handler);
		},
	};
}

function bufferFromSource(data: BufferSource): Buffer {
	if (data instanceof ArrayBuffer) {
		return Buffer.from(data);
	}
	return Buffer.from(data.buffer, data.byteOffset, data.byteLength);
}
