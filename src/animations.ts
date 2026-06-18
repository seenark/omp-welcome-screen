export const BANNER_LINES = [
  " ██████╗ ██████╗ ██████╗ ███████╗    ███████╗ ██████╗  ██████╗ ██╗  ██╗",
  "██╔════╝██╔═══██╗██╔══██╗██╔════╝    ██╔════╝██╔═══██╗██╔═══██╗██║ ██╔╝",
  "██║     ██║   ██║██║  ██║█████╗      ███████╗██║   ██║██║   ██║█████╔╝ ",
  "██║     ██║   ██║██║  ██║██╔══╝      ╚════██║██║   ██║██║   ██║██╔═██╗ ",
  "╚██████╗╚██████╔╝██████╔╝███████╗    ███████║╚██████╔╝╚██████╔╝██║  ██╗",
  " ╚═════╝ ╚═════╝ ╚═════╝ ╚══════╝    ╚══════╝ ╚═════╝  ╚═════╝ ╚═╝  ╚═╝"
];
export const BANNER_COMPACT = [
  "  ▄▀▄ █▀▄ █▀█ █▀█ ▄▀█   █▀▀ █▀█ █▀█ █▀▀ █▀",
  "  █▀█ █▄▀ █▄█ █▀▄ █▀█   █▄█ █▄█ █▀▄ ██▄ ▄█"
];
export const BANNER_ONE_LINER = "═══ CodeSook ═══  https://codesook.dev  ══════════════";
export function buildAnimationFrames(style, bannerLines, totalFrames) {
  switch (style) {
    case "wave":
      return buildWaveFrames(bannerLines, totalFrames);
    case "rainbow":
      return buildRainbowFrames(bannerLines, totalFrames);
    case "glitch":
      return buildGlitchFrames(bannerLines, totalFrames);
    case "matrix":
      return buildMatrixFrames(bannerLines, totalFrames);
    case "typewriter":
      return buildTypewriterFrames(bannerLines, totalFrames);
    case "static":
    default:
      return buildStaticFrames(bannerLines);
  }
}
function buildStaticFrames(bannerLines) {
  return [bannerLines];
}
function buildWaveFrames(bannerLines, totalFrames) {
  const frames = [];
  for (let f = 0;f < totalFrames; f++) {
    frames.push(bannerLines.map((line) => {
      const offset = Math.round(Math.sin(f / totalFrames * Math.PI * 2) * 2);
      return shiftChars(line, offset);
    }));
  }
  return frames;
}
function buildRainbowFrames(bannerLines, totalFrames) {
  const colors = [
    "red",
    "peach",
    "yellow",
    "green",
    "teal",
    "sapphire",
    "blue",
    "lavender",
    "pink",
    "mauve"
  ];
  const frames = [];
  for (let f = 0;f < totalFrames; f++) {
    frames.push(bannerLines.map((line, lineIdx) => {
      const colorIdx = (lineIdx + f) % colors.length;
      return colorMarker(colors[colorIdx]) + line + colorMarker("reset");
    }));
  }
  return frames;
}
function buildGlitchFrames(bannerLines, totalFrames) {
  const frames = [];
  for (let f = 0;f < totalFrames; f++) {
    frames.push(bannerLines.map((line, lineIdx) => {
      if ((f + lineIdx) % 5 === 0) {
        return glitchLine(line, f);
      }
      return line;
    }));
  }
  return frames;
}
function buildMatrixFrames(bannerLines, totalFrames) {
  const frames = [];
  for (let f = 0;f < totalFrames; f++) {
    frames.push(bannerLines.map((line, lineIdx) => {
      const revealProgress = Math.min(1, Math.max(0, (f - lineIdx * 2) / (totalFrames / 2)));
      if (revealProgress >= 1)
        return line;
      const revealChars = Math.floor(line.length * revealProgress);
      const revealed = line.slice(0, revealChars);
      const hidden = line.slice(revealChars).replace(/█/g, "░").replace(/╗/g, " ").replace(/║/g, " ");
      return revealed + hidden;
    }));
  }
  return frames;
}
function buildTypewriterFrames(bannerLines, totalFrames) {
  const frames = [];
  const maxLen = Math.max(...bannerLines.map((l) => l.length));
  const charsPerFrame = Math.ceil(maxLen / totalFrames);
  for (let f = 0;f < totalFrames; f++) {
    frames.push(bannerLines.map((line) => {
      const charsToShow = Math.min(line.length, f * charsPerFrame);
      return line.slice(0, charsToShow);
    }));
  }
  return frames;
}
export function colorMarker(color) {
  return `\x00COLOR:${color}\x00`;
}
function shiftChars(str, offset) {
  if (offset === 0)
    return str;
  const arr = [...str];
  const shifted = new Array(arr.length);
  for (let i = 0;i < arr.length; i++) {
    shifted[i] = arr[(i - offset + arr.length) % arr.length];
  }
  return shifted.join("");
}
function glitchLine(line, seed) {
  const glitchChars = ["▓", "▒", "░", "█", "▄", "▀", "■", "□", "▪", "▫"];
  let out = "";
  for (let i = 0;i < line.length; i++) {
    const char = line[i];
    if ((seed + i * 7) % 11 === 0) {
      out += glitchChars[(seed + i) % glitchChars.length];
    } else {
      out += char;
    }
  }
  return out;
}
export function getFrameCount(style) {
  switch (style) {
    case "wave":
      return 30;
    case "rainbow":
      return 20;
    case "glitch":
      return 25;
    case "matrix":
      return 40;
    case "typewriter":
      return 30;
    case "static":
      return 1;
    default:
      return 30;
  }
}
