import { CATPPUCCIN_MOCHA } from "./config.js";
export const ansi = {
  reset: "\x1B[0m",
  bold: "\x1B[1m",
  dim: "\x1B[2m",
  fg(r, g, b) {
    return `\x1B[38;2;${r};${g};${b}m`;
  },
  bg(r, g, b) {
    return `\x1B[48;2;${r};${g};${b}m`;
  }
};
function hexToRgb(hex) {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16)
  ];
}
export function colorToAnsi(colorName) {
  const hex = CATPPUCCIN_MOCHA[colorName];
  if (!hex)
    return ansi.reset;
  const [r, g, b] = hexToRgb(hex);
  return ansi.fg(r, g, b);
}
export function bgColorToAnsi(colorName) {
  const hex = CATPPUCCIN_MOCHA[colorName];
  if (!hex)
    return "";
  const [r, g, b] = hexToRgb(hex);
  return ansi.bg(r, g, b);
}
export function normalizeBannerWidth(lines) {
  if (lines.length === 0)
    return lines;
  const maxLen = Math.max(...lines.map((l) => stripAnsi(l).length));
  return lines.map((line) => {
    const visibleLen = stripAnsi(line).length;
    if (visibleLen >= maxLen)
      return line;
    return line + " ".repeat(maxLen - visibleLen);
  });
}
export function colorize(text, colorName) {
  return colorToAnsi(colorName) + text + ansi.reset;
}
export function centerLine(line, width) {
  const visibleLen = visibleWidth(line);
  if (visibleLen >= width)
    return clipAnsi(line, width);
  const pad = Math.floor((width - visibleLen) / 2);
  return " ".repeat(pad) + line;
}
export function centerPadLine(line, width) {
  const stripped = stripAnsi(line);
  if (stripped.length >= width) {
    return clipAnsi(line, width);
  }
  const leftPad = Math.floor((width - stripped.length) / 2);
  const rightPad = width - stripped.length - leftPad;
  return " ".repeat(leftPad) + line + " ".repeat(rightPad);
}
export function fitLine(line, width) {
  const stripped = stripAnsi(line);
  if (stripped.length > width) {
    return clipAnsi(line, Math.max(0, width - 1), "…");
  }
  return line + " ".repeat(width - stripped.length);
}
export function stripAnsi(str) {
  return str.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, "");
}
export function visibleWidth(str) {
  return stripAnsi(str).length;
}

function clipAnsi(line, width, suffix = "") {
  if (width <= 0) {
    return suffix;
  }
  const visibleLimit = Math.max(0, width - suffix.length);
  let clipped = "";
  let visibleCount = 0;
  let sawAnsi = false;
  let index = 0;
  while (index < line.length && visibleCount < visibleLimit) {
    const sequence = readAnsiSequence(line, index);
    if (sequence !== null) {
      clipped += sequence;
      sawAnsi = true;
      index += sequence.length;
      continue;
    }
    clipped += line[index];
    visibleCount += 1;
    index += 1;
  }
  clipped += suffix;
  if (sawAnsi && !clipped.endsWith(ansi.reset)) {
    clipped += ansi.reset;
  }
  return clipped;
}

function readAnsiSequence(line, start) {
  if (line[start] !== "\x1b" || line[start + 1] !== "[") {
    return null;
  }
  let end = start + 2;
  while (end < line.length) {
    const char = line[end];
    if ((char >= "A" && char <= "Z") || (char >= "a" && char <= "z")) {
      return line.slice(start, end + 1);
    }
    end += 1;
  }
  return null;
}
export function resolveColorMarkers(line, colorMap) {
  return line.replace(/\x00COLOR:(\w+)\x00/g, (_, colorName) => {
    return colorMap[colorName] ?? colorName;
  });
}
export function buildAnimationColorMap(baseColorName) {
  const map = {};
  for (const [name, hex] of Object.entries(CATPPUCCIN_MOCHA)) {
    const [r, g, b] = hexToRgb(hex);
    map[name] = ansi.fg(r, g, b);
  }
  map["reset"] = ansi.reset;
  map["animation"] = colorToAnsi(baseColorName);
  return map;
}
const RAINBOW_COLORS = [
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
export function rainbowLine(line) {
  let out = "";
  let colorIdx = 0;
  for (const char of line) {
    const colorName = RAINBOW_COLORS[colorIdx % RAINBOW_COLORS.length];
    out += colorToAnsi(colorName) + char;
    colorIdx++;
  }
  return out + ansi.reset;
}
export function rainbowLines(lines, frameOffset = 0) {
  return lines.map((line, i) => {
    const colorName = RAINBOW_COLORS[(i + frameOffset) % RAINBOW_COLORS.length];
    return colorToAnsi(colorName) + line + ansi.reset;
  });
}
export const BORDERS = {
  rounded: { tl: "╭", tr: "╮", bl: "╰", br: "╯", v: "│", h: "─" },
  square: { tl: "┌", tr: "┐", bl: "└", br: "┘", v: "│", h: "─" },
  double: { tl: "╔", tr: "╗", bl: "╚", br: "╝", v: "║", h: "═" },
  minimal: { tl: "+", tr: "+", bl: "+", br: "+", v: "|", h: "-" }
};
export function buildOverlayBox(contentLines, boxWidth, borderName, bgFillChar, footerText, dimColor, accentColor) {
  const b = BORDERS[borderName];
  const innerWidth = boxWidth - 2;
  const lines = [];
  lines.push(`${dimColor}${b.tl}${b.h.repeat(innerWidth)}${b.tr}${ansi.reset}`);
  for (const line of contentLines) {
    const visibleLen = visibleWidth(line);
    const fillWidth = Math.max(0, innerWidth - visibleLen);
    const leftFill = Math.floor(fillWidth / 2);
    const rightFill = fillWidth - leftFill;
    if (bgFillChar) {
      lines.push(`${dimColor}${b.v}${ansi.reset}` + `${accentColor}${bgFillChar.repeat(leftFill)}${ansi.reset}` + line + `${accentColor}${bgFillChar.repeat(rightFill)}${ansi.reset}` + `${dimColor}${b.v}${ansi.reset}`);
    } else {
      lines.push(`${dimColor}${b.v}${ansi.reset}` + " ".repeat(leftFill) + line + " ".repeat(rightFill) + `${dimColor}${b.v}${ansi.reset}`);
    }
  }
  if (footerText) {
    const footerVisLen = visibleWidth(footerText);
    const footerAvailable = innerWidth - footerVisLen;
    const footerLeftPad = Math.floor(footerAvailable / 2);
    const footerRightPad = footerAvailable - footerLeftPad;
    lines.push(`${dimColor}${b.bl}${ansi.reset}` + `${dimColor}${" ".repeat(footerLeftPad)}${ansi.reset}` + footerText + `${dimColor}${" ".repeat(footerRightPad)}${ansi.reset}` + `${dimColor}${b.br}${ansi.reset}`);
  } else {
    lines.push(`${dimColor}${b.bl}${b.h.repeat(innerWidth)}${b.br}${ansi.reset}`);
  }
  return lines;
}
export function buildEmptyBox(boxWidth, boxHeight, borderName, dimColor) {
  const b = BORDERS[borderName];
  const innerWidth = boxWidth - 2;
  const innerHeight = boxHeight - 2;
  const lines = [];
  lines.push(`${dimColor}${b.tl}${b.h.repeat(innerWidth)}${b.tr}${ansi.reset}`);
  for (let i = 0;i < innerHeight; i++) {
    lines.push(`${dimColor}${b.v}${" ".repeat(innerWidth)}${b.v}${ansi.reset}`);
  }
  lines.push(`${dimColor}${b.bl}${b.h.repeat(innerWidth)}${b.br}${ansi.reset}`);
  return lines;
}
