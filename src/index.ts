import { loadConfig, loadBannerFile } from "./config.js";
import { WelcomeOverlay } from "./WelcomeOverlay.js";
import { getInfoPanelData } from "./info-panel.js";
export default function input_default(pi) {
  let activeOverlay;
  let sessionGeneration = 0;
  let debugMode = false;
  let hasShownForSession = false;
  function showWelcomeOverlay(ctx) {
    const config = loadConfig();
    debugMode = config.debug;
    const thisSessionGeneration = sessionGeneration;
    setTimeout(() => {
      if (thisSessionGeneration !== sessionGeneration) {
        return;
      }
      let modelName = config.modelName;
      let providerName = config.providerName;
      if (!modelName && ctx.model) {
        modelName = ctx.model.name || ctx.model.id || "omp agent";
      }
      if (!providerName && ctx.model?.provider) {
        providerName = ctx.model.provider;
      }
      const infoData = getInfoPanelData(modelName, providerName);
      ctx.ui.custom((tui, _theme, _keybindings, done) => {
        const bannerLines = loadBannerFile(config);
        activeOverlay = new WelcomeOverlay(config, done, infoData, bannerLines ?? undefined);
        activeOverlay.startAnimation(tui);
        return activeOverlay;
      }, {
        overlay: true
      }).catch((error) => {
        console.debug("[pi-welcome-screen] Welcome overlay failed:", error);
      });
    }, 100);
  }
  function dismissWelcomeOverlay() {
    if (debugMode)
      return;
    activeOverlay?.dispose();
    activeOverlay = undefined;
  }
  pi.on("session_start", async (_event, ctx) => {
    if (!ctx.hasUI)
      return;
    hasShownForSession = true;
    sessionGeneration++;
    activeOverlay?.dispose();
    activeOverlay = undefined;
    showWelcomeOverlay(ctx);
  });
  pi.on("agent_start", async (_event, ctx) => {
    if (hasShownForSession || !ctx.hasUI)
      return;
    hasShownForSession = true;
    sessionGeneration++;
    activeOverlay?.dispose();
    activeOverlay = undefined;
    showWelcomeOverlay(ctx);
  });
  pi.on("session_shutdown", async () => {
    hasShownForSession = false;
    sessionGeneration++;
    dismissWelcomeOverlay();
  });
  pi.on("message_start", async (event) => {
    if (event.message.role === "assistant") {
      dismissWelcomeOverlay();
    }
  });
  pi.registerCommand("welcome-dismiss", {
    description: "Dismiss the welcome overlay",
    handler: async (_args, ctx) => {
      dismissWelcomeOverlay();
      if (ctx.hasUI) {
        ctx.ui.notify("Welcome overlay dismissed", "info");
      }
    }
  });
  pi.registerCommand("welcome-reload", {
    description: "Reload welcome screen config from disk and reshow overlay",
    handler: async (_args, ctx) => {
      if (!ctx.hasUI)
        return;
      dismissWelcomeOverlay();
      setTimeout(() => {
        showWelcomeOverlay(ctx);
      }, 50);
      ctx.ui.notify("Welcome screen reloaded", "info");
    }
  });
}
export { loadConfig, DEFAULT_CONFIG, CATPPUCCIN_MOCHA } from "./config.js";
