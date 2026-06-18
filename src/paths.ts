import { homedir as osHomedir } from "node:os";
import { join } from "node:path";

export const WELCOME_CONFIG_DIR = "pi-welcome-screen";

function getDefaultAgentDirs() {
  const homeDir = getHomeDir();
  return [join(homeDir, ".pi", "agent"), join(homeDir, ".omp", "agent")];
}

export function getHomeDir() {
  return process.env.HOME ?? process.env.USERPROFILE ?? osHomedir();
}

export function expandHomePath(filePath) {
  if (filePath === "~" || filePath.startsWith("~/")) {
    return join(getHomeDir(), filePath === "~" ? "" : filePath.slice(2));
  }
  return filePath;
}

export function uniquePaths(paths) {
  const seen = new Set();
  const unique = [];
  for (const path of paths) {
    if (!path || seen.has(path)) continue;
    seen.add(path);
    unique.push(path);
  }
  return unique;
}

export function getAgentDirCandidates() {
  const configuredAgentDir = process.env.PI_CODING_AGENT_DIR?.trim();
  return uniquePaths([configuredAgentDir ?? "", ...getDefaultAgentDirs()]);
}

export function getWelcomeConfigDirs() {
  return getAgentDirCandidates().map((dir) => join(dir, WELCOME_CONFIG_DIR));
}
