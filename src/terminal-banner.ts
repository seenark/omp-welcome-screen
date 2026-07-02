import { spawn } from "node:child_process";
import { EventEmitter } from "node:events";
import { StringDecoder } from "node:string_decoder";
import { Terminal, type IBuffer, type IBufferCell } from "@xterm/headless";

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

type HeadlessTerminal = Terminal & {
	_core: {
		_writeBuffer: {
			writeSync(data: string): void;
		};
	};
};

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
	private readonly terminal: HeadlessTerminal;
	private lines: string[];
	private pendingLines: string[];
	private pendingContent = false;
	private content = false;
	private clearRedrawInProgress = false;

	constructor(options: TerminalBannerFrameOptions) {
		this.rows = options.rows;
		this.captureRows = getCaptureRows(options.rows);
		this.captureColumns = getCaptureColumns(options.columns);
		this.columns = options.columns;
		this.terminal = createHeadlessTerminal(this.captureColumns, this.captureRows, () => {
			if (this.content) {
				this.clearRedrawInProgress = true;
			}
		});
		const initialScreen = captureTerminalScreen(
			this.terminal.buffer.active,
			this.captureRows,
			this.captureColumns,
		);
		this.lines = selectViewport(initialScreen, this.rows, this.columns);
		this.pendingLines = [...this.lines];
	}

	ingest(chunk: string): boolean {
		writeTerminalChunk(this.terminal, normalizeChunk(chunk));
		const screen = captureTerminalScreen(
			this.terminal.buffer.active,
			this.captureRows,
			this.captureColumns,
		);
		this.pendingLines = selectViewport(screen, this.rows, this.columns);
		this.pendingContent = screen.some((row) => row.some((cell) => cell.char !== " "));
		return !sameLines(this.pendingLines, this.lines);
	}

	publish(options: { force?: boolean } = {}): boolean {
		if (sameLines(this.pendingLines, this.lines) && this.pendingContent === this.content) {
			return false;
		}
		if (!options.force && this.clearRedrawInProgress && this.isPartialClearRedraw()) {
			return false;
		}
		this.lines = [...this.pendingLines];
		this.content = this.pendingContent;
		this.clearRedrawInProgress = false;
		return true;
	}

	getLines(): string[] {
		return [...this.lines];
	}

	hasContent(): boolean {
		return this.content;
	}

	private isPartialClearRedraw(): boolean {
		const requiredRows = Math.max(1, countNonBlankRows(this.lines));
		return countNonBlankRows(this.pendingLines) < requiredRows;
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
	private readonly stdoutDecoder = new StringDecoder("utf8");
	private child: TerminalBannerChild | null = null;
	private failed = false;
	private exited = false;
	private renderTimer: RenderTimer | null = null;
	private lastRenderTime = 0;
	private lastChangeTime = 0;
	private pendingFrame = false;
	private readonly handleStdout = (chunk: Buffer | string) => {
		const decoded = typeof chunk === "string" ? chunk : this.stdoutDecoder.write(chunk);
		if (decoded === "") {
			return;
		}
		if (this.buffer.ingest(decoded)) {
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
		this.flushStdoutDecoder();
		if (this.buffer.publish({ force: true })) {
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
		this.flushStdoutDecoder();
		if (this.buffer.publish({ force: true })) {
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

	private flushStdoutDecoder(): boolean {
		const decoded = this.stdoutDecoder.end();
		return decoded !== "" && this.buffer.ingest(decoded);
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
		return this.buffer.hasContent();
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
		.replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g, "")
		.replace(/\r?\n/g, "\r\n");
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

function createHeadlessTerminal(columns: number, rows: number, onFullClear: () => void): HeadlessTerminal {
	const terminal = new Terminal({
		allowProposedApi: true,
		cols: columns,
		rows,
		scrollback: 0,
	}) as HeadlessTerminal;
	terminal.parser.registerCsiHandler({ final: "J" }, (params) => {
		const mode = params[0];
		if (mode === 2 || mode === 3) {
			onFullClear();
		}
		return false;
	});
	terminal.parser.registerEscHandler({ final: "c" }, () => {
		onFullClear();
		return false;
	});
	return terminal;
}

function writeTerminalChunk(terminal: HeadlessTerminal, chunk: string): void {
	terminal._core._writeBuffer.writeSync(chunk);
}

function captureTerminalScreen(buffer: IBuffer, rows: number, columns: number): TerminalCell[][] {
	const blankScreen = createBlankScreen(rows, columns);
	const cell = buffer.getNullCell();
	for (let rowIndex = 0; rowIndex < rows; rowIndex++) {
		const line = buffer.getLine(rowIndex);
		if (!line) {
			continue;
		}
		for (let columnIndex = 0; columnIndex < columns; columnIndex++) {
			const terminalCell = line.getCell(columnIndex, cell);
			blankScreen[rowIndex]![columnIndex] = terminalCell
				? convertTerminalCell(terminalCell)
				: { char: " ", style: cloneStyle(DEFAULT_STYLE) };
		}
	}
	return blankScreen;
}

function convertTerminalCell(cell: IBufferCell): TerminalCell {
	if (cell.getWidth() === 0) {
		return { char: " ", style: cloneStyle(DEFAULT_STYLE) };
	}
	const chars = cell.getChars();
	if (chars === "" || chars === " ") {
		return { char: " ", style: cloneStyle(DEFAULT_STYLE) };
	}
	let style = {
		fg: encodeTerminalColor("fg", cell),
		bg: encodeTerminalColor("bg", cell),
		intensity: cell.isBold() ? "1" : cell.isDim() ? "2" : "",
	} satisfies TerminalStyle;
	if (cell.isInverse()) {
		style = {
			fg: style.bg,
			bg: style.fg,
			intensity: style.intensity,
		};
	}
	return { char: chars, style };
}

function encodeTerminalColor(channel: "fg" | "bg", cell: IBufferCell): string {
	const defaultColor = channel === "fg" ? cell.isFgDefault() : cell.isBgDefault();
	if (defaultColor) {
		return "";
	}
	const rgbColor = channel === "fg" ? cell.isFgRGB() : cell.isBgRGB();
	if (rgbColor) {
		const encoded = encodeRgbColor(channel === "fg" ? 38 : 48, channel === "fg" ? cell.getFgColor() : cell.getBgColor());
		return encoded;
	}
	const paletteColor = channel === "fg" ? cell.isFgPalette() : cell.isBgPalette();
	if (paletteColor) {
		const prefix = channel === "fg" ? 38 : 48;
		const value = channel === "fg" ? cell.getFgColor() : cell.getBgColor();
		return `${prefix};5;${value}`;
	}
	return "";
}

function encodeRgbColor(prefix: 38 | 48, color: number): string {
	const red = (color >> 16) & 0xff;
	const green = (color >> 8) & 0xff;
	const blue = color & 0xff;
	return `${prefix};2;${red};${green};${blue}`;
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

function countNonBlankRows(lines: string[]): number {
	let count = 0;
	for (const line of lines) {
		if (line.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, "").trim() !== "") {
			count += 1;
		}
	}
	return count;
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
