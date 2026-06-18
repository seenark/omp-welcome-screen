import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  expandHomePath,
  getHomeDir,
  getWelcomeConfigDirs
} from "./paths.js";
export const DEFAULT_CONFIG = {
  mainText: "CodeSook",
  url: "https://codesook.dev",
  animationStyle: "rainbow",
  animationText: "Welcome",
  frameDelayMs: 80,
  fgColor: "lavender",
  bgColor: "base",
  accentColor: "blue",
  urlColor: "sapphire",
  animationColor: "pink",
  paddingTop: 2,
  paddingBottom: 2,
  borderStyle: "rounded",
  bgFillChar: "",
  minTerminalWidth: 80,
  overlayWidth: 120,
  countdown: -1,
  debug: false,
  enableScrolling: true,
  showBanner: true,
  showMainText: true,
  showUrl: true,
  showCountdown: true,
  showPadding: true,
  showBorder: true,
  showInfoPanel: true,
  showVersion: true,
  showModel: true,
  showTips: true,
  showLoaded: true,
  showResources: true,
  showSessions: true,
  infoPanelSections: [
    "version",
    "model",
    "tips",
    "loaded",
    "resources",
    "sessions"
  ],
  modelName: "",
  providerName: "",
  logoChar: "π",
  bannerFile: ""
};
export function loadConfig() {
  const userConfig = loadConfigFile();
  const merged = { ...DEFAULT_CONFIG, ...userConfig };
  if (Array.isArray(userConfig.infoPanelSections)) {
    const sections = new Set(userConfig.infoPanelSections);
    if (userConfig.showVersion === undefined)
      merged.showVersion = sections.has("version");
    if (userConfig.showModel === undefined)
      merged.showModel = sections.has("model");
    if (userConfig.showTips === undefined)
      merged.showTips = sections.has("tips");
    if (userConfig.showLoaded === undefined)
      merged.showLoaded = sections.has("loaded");
    if (userConfig.showResources === undefined)
      merged.showResources = sections.has("resources");
    if (userConfig.showSessions === undefined)
      merged.showSessions = sections.has("sessions");
  }
  return merged;
}
function loadConfigFile() {
  const configPaths = [
    ...getWelcomeConfigDirs().map((dir) => join(dir, "settings.json")),
    join(getHomeDir(), ".pi", "welcome-screen.config.json"),
    join(process.cwd(), "welcome-screen.config.json")
  ];
  for (const configPath of configPaths) {
    if (existsSync(configPath)) {
      try {
        const raw = readFileSync(configPath, "utf-8");
        return JSON.parse(raw);
      } catch {}
    }
  }
  return {};
}
export function loadBannerFile(config) {
  const searchPaths = config.bannerFile ? [expandHomePath(config.bannerFile)] : [
    ...getWelcomeConfigDirs().map((dir) => join(dir, "banner.txt")),
    join(process.cwd(), "welcome-screen.banner.txt")
  ];
  for (const filePath of searchPaths) {
    if (!filePath)
      continue;
    if (!existsSync(filePath))
      continue;
    try {
      const raw = readFileSync(filePath, "utf-8");
      let lines = raw.split(`
`).map((line) => line.replace(/\r$/, ""));
      while (lines.length > 0 && lines[0].trim() === "") {
        lines = lines.slice(1);
      }
      while (lines.length > 0 && lines[lines.length - 1].trim() === "") {
        lines = lines.slice(0, -1);
      }
      if (lines.length === 0)
        return null;
      return lines;
    } catch {}
  }
  return null;
}
export function validateConfig(cfg) {
  const errors = [];
  const validStyles = [
    "wave",
    "rainbow",
    "glitch",
    "matrix",
    "typewriter",
    "static"
  ];
  const validColors = Object.keys(CATPPUCCIN_MOCHA);
  if (cfg.animationStyle && !validStyles.includes(cfg.animationStyle)) {
    errors.push(`Invalid animationStyle '${cfg.animationStyle}'. Must be one of: ${validStyles.join(", ")}`);
  }
  const colorFields = [
    "fgColor",
    "bgColor",
    "accentColor",
    "urlColor",
    "animationColor"
  ];
  for (const field of colorFields) {
    const val = cfg[field];
    if (typeof val === "string" && val !== "" && !validColors.includes(val)) {
      errors.push(`Invalid color '${val}' for ${field}. Must be a Catppuccin Mocha color name.`);
    }
  }
  if (cfg.frameDelayMs !== undefined && (cfg.frameDelayMs < 0 || cfg.frameDelayMs > 1000)) {
    errors.push("frameDelayMs must be between 0 and 1000");
  }
  return errors;
}
export const CATPPUCCIN_MOCHA = {
  base: "#1e1e2e",
  mantle: "#181825",
  crust: "#11111b",
  surface0: "#313244",
  surface1: "#45475a",
  surface2: "#585b70",
  overlay0: "#6c7086",
  overlay1: "#7f849c",
  overlay2: "#9399b2",
  subtext0: "#a6adc8",
  subtext1: "#bac2de",
  text: "#cdd6f4",
  lavender: "#b4befe",
  blue: "#89b4fa",
  sapphire: "#74c7ec",
  sky: "#89dceb",
  teal: "#94e2d5",
  green: "#a6e3a1",
  yellow: "#f9e2af",
  peach: "#fab387",
  maroon: "#eba0ac",
  red: "#f38ba8",
  mauve: "#cba6f7",
  pink: "#f5c2e7",
  flamingo: "#f2cdcd",
  rosewater: "#f5e0dc"
};
