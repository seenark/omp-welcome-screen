import { readdirSync, existsSync, statSync, readFileSync } from "node:fs";
import { join, basename } from "node:path";
import { execSync } from "node:child_process";
import { getAgentDirCandidates, getHomeDir } from "./paths.js";
const loggedErrors = new Set;
function logError(scope, error) {
  const message = error instanceof Error ? error.message : String(error);
  const key = `${scope}:${message}`;
  if (loggedErrors.has(key))
    return;
  loggedErrors.add(key);
  if (loggedErrors.size > 500)
    loggedErrors.clear();
  console.debug(`[pi-welcome-screen] ${scope}:`, error);
}
export function discoverLoadedResources() {
  const homeDir = getHomeDir();
  const cwd = process.cwd();
  const agentDirs = getAgentDirCandidates();
  let contextFiles = 0;
  let extensions = 0;
  let promptTemplates = 0;
  let themes = 0;
  const contextFileNames = [];
  const extensionNames = [];
  const promptNames = [];
  const themeNames = [];
  const agentsMdPaths = [
    ...agentDirs.map((dir) => join(dir, "AGENTS.md")),
    join(homeDir, ".claude", "AGENTS.md"),
    join(cwd, "AGENTS.md"),
    join(cwd, ".pi", "AGENTS.md"),
    join(cwd, ".omp", "AGENTS.md"),
    join(cwd, ".claude", "AGENTS.md")
  ];
  for (const path of agentsMdPaths) {
    if (existsSync(path)) {
      contextFiles++;
      contextFileNames.push(basename(path));
    }
  }
  const extensionDirs = [
    ...agentDirs.map((dir) => join(dir, "extensions")),
    join(cwd, "extensions"),
    join(cwd, ".omp", "extensions"),
    join(cwd, ".pi", "extensions")
  ];
  const countedExtensions = new Set;
  const settingsPaths = [
    ...agentDirs.map((dir) => join(dir, "settings.json")),
    join(cwd, ".omp", "settings.json"),
    join(cwd, ".pi", "settings.json")
  ];
  for (const settingsPath of settingsPaths) {
    if (!existsSync(settingsPath))
      continue;
    try {
      const settings = JSON.parse(readFileSync(settingsPath, "utf-8"));
      let packages = null;
      if (typeof settings === "object" && settings !== null && !Array.isArray(settings)) {
        packages = settings.packages;
      }
      if (Array.isArray(packages)) {
        for (const pkg of packages) {
          let source = null;
          let extensionsFilter = null;
          if (typeof pkg === "string") {
            source = pkg;
          } else if (typeof pkg === "object" && pkg !== null) {
            source = pkg.source;
            extensionsFilter = pkg.extensions;
          }
          if (typeof source !== "string")
            continue;
          const normalizedSource = source.trim();
          if (!normalizedSource.startsWith("npm:"))
            continue;
          if (Array.isArray(extensionsFilter) && extensionsFilter.length === 0)
            continue;
          const body = normalizedSource.slice(4);
          const versionIndex = body.lastIndexOf("@");
          const name = versionIndex > 0 ? body.slice(0, versionIndex) : body;
          if (!name || countedExtensions.has(name))
            continue;
          countedExtensions.add(name);
          extensions++;
          extensionNames.push(name);
        }
      }
      const extArr = settings.extensions;
      if (Array.isArray(extArr)) {
        for (const ext of extArr) {
          if (typeof ext === "string") {
            const name = basename(ext).replace(/\.(ts|js)$/, "");
            if (!countedExtensions.has(name)) {
              countedExtensions.add(name);
              extensions++;
              extensionNames.push(name);
            }
          }
        }
      }
    } catch (error) {
      logError(`Failed to read settings at ${settingsPath}`, error);
    }
  }
  for (const dir of extensionDirs) {
    if (!existsSync(dir))
      continue;
    try {
      const entries = readdirSync(dir);
      for (const entry of entries) {
        const entryPath = join(dir, entry);
        try {
          const stats = statSync(entryPath);
          if (stats.isDirectory()) {
            if (existsSync(join(entryPath, "index.ts")) || existsSync(join(entryPath, "index.js")) || existsSync(join(entryPath, "package.json"))) {
              if (!countedExtensions.has(entry)) {
                countedExtensions.add(entry);
                extensions++;
                extensionNames.push(entry);
              }
            }
          } else if ((entry.endsWith(".ts") || entry.endsWith(".js")) && !entry.startsWith(".")) {
            const ext = entry.endsWith(".ts") ? ".ts" : ".js";
            const name = basename(entry, ext);
            if (!countedExtensions.has(name)) {
              countedExtensions.add(name);
              extensions++;
              extensionNames.push(name);
            }
          }
        } catch (error) {
          logError(`Failed to inspect extension entry ${entryPath}`, error);
        }
      }
    } catch (error) {
      logError(`Failed to scan extensions dir ${dir}`, error);
    }
  }
  const templateDirs = [
    ...agentDirs.map((dir) => join(dir, "commands")),
    join(homeDir, ".claude", "commands"),
    join(cwd, ".omp", "commands"),
    join(cwd, ".pi", "commands"),
    join(cwd, ".claude", "commands")
  ];
  const countedTemplates = new Set;
  function countTemplatesInDir(dir) {
    if (!existsSync(dir))
      return;
    try {
      const entries = readdirSync(dir);
      for (const entry of entries) {
        const entryPath = join(dir, entry);
        try {
          const stats = statSync(entryPath);
          if (stats.isDirectory()) {
            countTemplatesInDir(entryPath);
          } else if (entry.endsWith(".md")) {
            const name = basename(entry, ".md");
            if (!countedTemplates.has(name)) {
              countedTemplates.add(name);
              promptTemplates++;
              promptNames.push("/" + name);
            }
          }
        } catch (error) {
          logError(`Failed to inspect template entry ${entryPath}`, error);
        }
      }
    } catch (error) {
      logError(`Failed to scan template dir ${dir}`, error);
    }
  }
  for (const dir of templateDirs) {
    countTemplatesInDir(dir);
  }
  const themeDirs = [
    ...agentDirs.map((dir) => join(dir, "themes")),
    join(cwd, ".omp", "themes"),
    join(cwd, ".pi", "themes")
  ];
  const countedThemes = new Set;
  for (const dir of themeDirs) {
    if (!existsSync(dir))
      continue;
    try {
      const entries = readdirSync(dir);
      for (const entry of entries) {
        const entryPath = join(dir, entry);
        try {
          if (entry.endsWith(".json") || entry.endsWith(".yml") || entry.endsWith(".yaml")) {
            const name = entry.replace(/\.(json|yml|yaml)$/, "");
            if (!countedThemes.has(name)) {
              countedThemes.add(name);
              themes++;
              themeNames.push(name);
            }
          }
        } catch (error) {
          logError(`Failed to inspect theme entry ${entryPath}`, error);
        }
      }
    } catch (error) {
      logError(`Failed to scan themes dir ${dir}`, error);
    }
  }
  return {
    counts: { contextFiles, extensions, promptTemplates, themes },
    names: {
      extensions: extensionNames,
      prompts: promptNames,
      themes: themeNames,
      contextFiles: contextFileNames
    }
  };
}
export function discoverLoadedCounts() {
  return discoverLoadedResources().counts;
}
export function getRecentSessions(maxCount = 3) {
  const homeDir = getHomeDir();
  const agentDirs = getAgentDirCandidates();
  const sessionsDirs = [
    ...agentDirs.map((dir) => join(dir, "sessions")),
    join(homeDir, ".pi", "sessions")
  ];
  const sessions = [];
  function scanDir(dir) {
    if (!existsSync(dir))
      return;
    try {
      const entries = readdirSync(dir);
      for (const entry of entries) {
        const entryPath = join(dir, entry);
        try {
          const stats = statSync(entryPath);
          if (stats.isDirectory()) {
            scanDir(entryPath);
          } else if (entry.endsWith(".jsonl")) {
            const parentName = basename(dir);
            let projectName = parentName;
            if (parentName.startsWith("--")) {
              const parts = parentName.split("-").filter((p) => p);
              projectName = parts[parts.length - 1] || parentName;
            }
            sessions.push({ name: projectName, mtime: stats.mtimeMs });
          }
        } catch (error) {
          logError(`Failed to inspect session entry ${entryPath}`, error);
        }
      }
    } catch (error) {
      logError(`Failed to scan sessions dir ${dir}`, error);
    }
  }
  for (const sessionsDir of sessionsDirs) {
    scanDir(sessionsDir);
  }
  if (sessions.length === 0)
    return [];
  sessions.sort((a, b) => b.mtime - a.mtime);
  const seen = new Set;
  const uniqueSessions = [];
  for (const s of sessions) {
    if (!seen.has(s.name)) {
      seen.add(s.name);
      uniqueSessions.push(s);
    }
  }
  const now = Date.now();
  return uniqueSessions.slice(0, maxCount).map((s) => ({
    name: s.name.length > 20 ? s.name.slice(0, 17) + "…" : s.name,
    timeAgo: formatTimeAgo(now - s.mtime)
  }));
}
function formatTimeAgo(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days > 0)
    return `${days}d ago`;
  if (hours > 0)
    return `${hours}h ago`;
  if (minutes > 0)
    return `${minutes}m ago`;
  return "just now";
}
export function discoverPiVersion() {
  for (const command of ["omp --version", "pi --version"]) {
    try {
      const output = execSync(command, {
        encoding: "utf-8",
        timeout: 3000
      }).trim();
      if (output)
        return output.split(`
`)[0]?.trim() ?? "omp";
    } catch {}
  }
  return "omp";
}
const defaultInfoPanelData = {
  modelName: "omp agent",
  providerName: "omp",
  piVersion: "omp",
  recentSessions: [],
  loadedCounts: {
    contextFiles: 0,
    extensions: 0,
    promptTemplates: 0,
    themes: 0
  },
  resourceNames: {
    extensions: [],
    prompts: [],
    themes: [],
    contextFiles: []
  }
};
export function getInfoPanelData(modelName, providerName) {
  const { counts, names } = discoverLoadedResources();
  return {
    modelName: modelName || defaultInfoPanelData.modelName,
    providerName: providerName || defaultInfoPanelData.providerName,
    piVersion: discoverPiVersion(),
    recentSessions: getRecentSessions(3),
    loadedCounts: counts,
    resourceNames: names
  };
}
