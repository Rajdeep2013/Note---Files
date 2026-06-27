const SettingsPanel = (() => {
  const SETTINGS_STORAGE_KEY = getUserScopedKey("settings");

  const DEFAULT_SETTINGS = {
    theme: "dark",
    accentColor: "#3b82f6",
    glowIntensity: 0.18,
    compact: false,
    fontSize: 16,
    defaultView: "grid",
    defaultLandingPage: "dashboard",
    showHiddenFiles: false,
    autoExpandFolders: false,
    confirmBeforeDelete: true,
    previewSize: "comfortable",
    openFilesInNewWindow: false,
    autoPreview: true,
    downloadLocation: "browser",
    imageQuality: "balanced",
    enableNotifications: true,
    successToasts: true,
    errorToasts: true,
    soundEffects: false,
    animationLevel: "full",
    hardwareAcceleration: true,
    lazyLoading: true,
    cacheSize: 150,
    highContrast: false,
    keyboardNavigation: true,
    focusIndicators: true,
    reduceMotion: false,
    largerClickTargets: false
  };

  const elements = {
    navItem: document.querySelector('.nav-item[data-nav-target="settings"]'),
    overlay: document.getElementById("settingsOverlay"),
    closeButton: document.getElementById("closeSettingsBtn"),
    searchInput: document.getElementById("settingsSearchInput"),
    sectionNav: document.getElementById("settingsSectionNav"),
    contentScroll: document.querySelector(".settings-content-scroll"),
    saveIndicator: document.getElementById("settingsSaveIndicator"),
    resetButton: document.getElementById("resetSettingsBtn"),
    exportButton: document.getElementById("exportSettingsBtn"),
    importInput: document.getElementById("importSettingsInput"),
    themeToggle: document.getElementById("themeToggle"),
    accentColorPicker: document.getElementById("accentColorPicker"),
    accentSwatches: Array.from(document.querySelectorAll(".settings-swatch")),
    glowSlider: document.getElementById("glowIntensity"),
    glowValue: document.getElementById("glowValue"),
    compactToggle: document.getElementById("compactModeToggle"),
    fontSizeSlider: document.getElementById("fontSizeSlider"),
    fontSizeValue: document.getElementById("fontSizeValue"),
    defaultViewSelect: document.getElementById("defaultViewSelect"),
    landingPageSelect: document.getElementById("landingPageSelect"),
    showHiddenFilesToggle: document.getElementById("showHiddenFilesToggle"),
    autoExpandFoldersToggle: document.getElementById("autoExpandFoldersToggle"),
    confirmBeforeDeleteToggle: document.getElementById("confirmBeforeDeleteToggle"),
    previewSizeSelect: document.getElementById("previewSizeSelect"),
    openFilesNewWindowToggle: document.getElementById("openFilesNewWindowToggle"),
    autoPreviewToggle: document.getElementById("autoPreviewToggle"),
    downloadLocationSelect: document.getElementById("downloadLocationSelect"),
    imageQualitySelect: document.getElementById("imageQualitySelect"),
    enableNotificationsToggle: document.getElementById("enableNotificationsToggle"),
    successToastsToggle: document.getElementById("successToastsToggle"),
    errorToastsToggle: document.getElementById("errorToastsToggle"),
    soundEffectsToggle: document.getElementById("soundEffectsToggle"),
    animationLevelSelect: document.getElementById("animationLevelSelect"),
    hardwareAccelerationToggle: document.getElementById("hardwareAccelerationToggle"),
    lazyLoadingToggle: document.getElementById("lazyLoadingToggle"),
    cacheSizeSlider: document.getElementById("cacheSizeSlider"),
    cacheSizeValue: document.getElementById("cacheSizeValue"),
    clearCacheBtn: document.getElementById("clearCacheBtn"),
    highContrastToggle: document.getElementById("highContrastToggle"),
    keyboardNavigationToggle: document.getElementById("keyboardNavigationToggle"),
    focusIndicatorsToggle: document.getElementById("focusIndicatorsToggle"),
    reduceMotionToggle: document.getElementById("reduceMotionToggle"),
    largerTargetsToggle: document.getElementById("largerTargetsToggle"),
    appVersionValue: document.getElementById("appVersionValue"),
    storageUsedValue: document.getElementById("storageUsedValue"),
    totalFilesValue: document.getElementById("totalFilesValue"),
    totalNotesValue: document.getElementById("totalNotesValue"),
    totalFoldersValue: document.getElementById("totalFoldersValue"),
    totalTasksValue: document.getElementById("totalTasksValue"),
    githubRepoBtn: document.getElementById("githubRepoBtn")
  };

  const state = { ...DEFAULT_SETTINGS };
  let saveIndicatorTimer = null;
  let sectionObserver = null;

  function init() {
    if(!elements.overlay || !elements.navItem) {
      return;
    }

    loadSettings();
    bindEvents();
    applySettings({ persist: false });
    updateAboutMetrics();
    updateSaveIndicator("All changes saved");
  }

  function loadSettings() {
    try {
      const saved = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if(!saved) return;
      const parsed = JSON.parse(saved);
      if(parsed && typeof parsed === "object") {
        Object.assign(state, normalizeSettings(parsed));
      }
    } catch {
      // ignore invalid settings payloads
    }
  }

  function normalizeSettings(source) {
    const output = { ...DEFAULT_SETTINGS };
    const safeBoolean = (value, fallback) => typeof value === "boolean" ? value : fallback;
    const safeString = (value, allowed, fallback) => allowed.includes(value) ? value : fallback;
    const safeNumber = (value, min, max, fallback) => {
      const num = Number(value);
      if(!Number.isFinite(num)) return fallback;
      return Math.min(max, Math.max(min, num));
    };

    output.theme = safeString(source.theme, ["dark", "light"], output.theme);
    output.accentColor = typeof source.accentColor === "string" ? source.accentColor : output.accentColor;
    output.glowIntensity = safeNumber(source.glowIntensity, 0.05, 0.45, output.glowIntensity);
    output.compact = safeBoolean(source.compact, output.compact);
    output.fontSize = safeNumber(source.fontSize, 14, 20, output.fontSize);
    output.defaultView = safeString(source.defaultView, ["grid", "list"], output.defaultView);
    output.defaultLandingPage = safeString(source.defaultLandingPage, ["dashboard", "files", "notes", "tasks"], output.defaultLandingPage);
    output.showHiddenFiles = safeBoolean(source.showHiddenFiles, output.showHiddenFiles);
    output.autoExpandFolders = safeBoolean(source.autoExpandFolders, output.autoExpandFolders);
    output.confirmBeforeDelete = safeBoolean(source.confirmBeforeDelete, output.confirmBeforeDelete);
    output.previewSize = safeString(source.previewSize, ["comfortable", "large", "fullscreen"], output.previewSize);
    output.openFilesInNewWindow = safeBoolean(source.openFilesInNewWindow, output.openFilesInNewWindow);
    output.autoPreview = safeBoolean(source.autoPreview, output.autoPreview);
    output.downloadLocation = safeString(source.downloadLocation, ["browser", "downloads", "ask"], output.downloadLocation);
    output.imageQuality = safeString(source.imageQuality, ["balanced", "high", "ultra"], output.imageQuality);
    output.enableNotifications = safeBoolean(source.enableNotifications, output.enableNotifications);
    output.successToasts = safeBoolean(source.successToasts, output.successToasts);
    output.errorToasts = safeBoolean(source.errorToasts, output.errorToasts);
    output.soundEffects = safeBoolean(source.soundEffects, output.soundEffects);
    output.animationLevel = safeString(source.animationLevel, ["full", "soft", "minimal"], output.animationLevel);
    output.hardwareAcceleration = safeBoolean(source.hardwareAcceleration, output.hardwareAcceleration);
    output.lazyLoading = safeBoolean(source.lazyLoading, output.lazyLoading);
    output.cacheSize = safeNumber(source.cacheSize, 25, 500, output.cacheSize);
    output.highContrast = safeBoolean(source.highContrast, output.highContrast);
    output.keyboardNavigation = safeBoolean(source.keyboardNavigation, output.keyboardNavigation);
    output.focusIndicators = safeBoolean(source.focusIndicators, output.focusIndicators);
    output.reduceMotion = safeBoolean(source.reduceMotion, output.reduceMotion);
    output.largerClickTargets = safeBoolean(source.largerClickTargets, output.largerClickTargets);
    return output;
  }

  function saveSettings() {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(state));
    updateSaveIndicator("All changes saved");
  }

  function scheduleSaveIndicator(message = "Saving changes...") {
    updateSaveIndicator(message);
    if(saveIndicatorTimer) {
      window.clearTimeout(saveIndicatorTimer);
    }
    saveIndicatorTimer = window.setTimeout(() => updateSaveIndicator("All changes saved"), 260);
  }

  function updateSaveIndicator(message) {
    if(elements.saveIndicator) {
      elements.saveIndicator.textContent = message;
      elements.saveIndicator.classList.toggle("is-saving", message !== "All changes saved");
    }
  }

  function applySettings(options = {}) {
    document.body.classList.toggle("light-theme", state.theme === "light");
    document.body.classList.toggle("dark-theme", state.theme === "dark");
    document.body.classList.toggle("compact-mode", state.compact);
    document.body.classList.toggle("high-contrast-mode", state.highContrast);
    document.body.classList.toggle("reduce-motion-mode", state.reduceMotion);
    document.body.classList.toggle("larger-click-targets", state.largerClickTargets);
    document.body.classList.toggle("hardware-acceleration-mode", state.hardwareAcceleration);
    document.body.classList.toggle("lazy-loading-mode", state.lazyLoading);

    const rgb = hexToRgb(state.accentColor);
    const glow = state.glowIntensity.toFixed(2);
    const previewScaleMap = {
      comfortable: "1",
      large: "1.06",
      fullscreen: "1.12"
    };

    document.documentElement.style.setProperty("--accent-color", state.accentColor);
    document.documentElement.style.setProperty("--accent-alt-color", getAltAccent(state.accentColor));
    document.documentElement.style.setProperty("--accent-rgb", rgb);
    document.documentElement.style.setProperty("--glow-intensity", glow);
    document.documentElement.style.setProperty("--accent-glow", `rgba(${rgb}, ${glow})`);
    document.documentElement.style.setProperty("--accent-glow-soft", `rgba(${rgb}, ${Math.max(state.glowIntensity * 0.55, 0.02).toFixed(2)})`);
    document.documentElement.style.setProperty("--font-size", `${state.fontSize}px`);
    document.documentElement.style.setProperty("--preview-scale", previewScaleMap[state.previewSize] || "1");
    document.documentElement.style.setProperty("--animation-level", state.animationLevel);
    document.documentElement.style.setProperty("--cache-size", `${state.cacheSize}mb`);
    document.documentElement.style.setProperty("--click-target-min", state.largerClickTargets ? "48px" : "44px");

    updateControlStates();
    updateAboutMetrics();
    filterSections(elements.searchInput?.value || "");

    if(options.persist !== false) {
      saveSettings();
    }
  }

  function bindEvents() {
    elements.navItem.addEventListener("click", openSettings);

    if(elements.closeButton) {
      elements.closeButton.addEventListener("click", closeSettings);
    }

    if(elements.overlay) {
      elements.overlay.addEventListener("click", (event) => {
        if(event.target === elements.overlay) {
          closeSettings();
        }
      });
    }

    document.addEventListener("keydown", (event) => {
      if(event.key === "Escape" && elements.overlay && !elements.overlay.classList.contains("hidden")) {
        closeSettings();
      }
    });

    if(elements.searchInput) {
      elements.searchInput.addEventListener("input", (event) => {
        filterSections(event.target.value);
      });
    }

    if(elements.sectionNav) {
      elements.sectionNav.addEventListener("click", handleSectionNavClick);
    }

    if(elements.contentScroll) {
      elements.contentScroll.addEventListener("scroll", updateSectionNavState, { passive: true });
      initSectionObserver();
    }

    if(elements.resetButton) {
      elements.resetButton.addEventListener("click", resetSettings);
    }

    if(elements.exportButton) {
      elements.exportButton.addEventListener("click", exportSettings);
    }

    if(elements.importInput) {
      elements.importInput.addEventListener("change", importSettingsFromFile);
    }

    bindControl("themeToggle", () => {
      state.theme = state.theme === "dark" ? "light" : "dark";
      scheduleSaveIndicator();
      applySettings();
    });

    bindControl("accentColorPicker", (event) => {
      state.accentColor = event.target.value;
      syncSwatches();
      scheduleSaveIndicator();
      applySettings();
    }, "input");

    elements.accentSwatches.forEach((swatch) => {
      swatch.addEventListener("click", () => {
        const color = swatch.dataset.color;
        if(!color) return;
        state.accentColor = color;
        if(elements.accentColorPicker) {
          elements.accentColorPicker.value = color;
        }
        syncSwatches();
        scheduleSaveIndicator();
        applySettings();
      });
    });

    bindControl("glowIntensity", (event) => {
      state.glowIntensity = Number(event.target.value);
      if(elements.glowValue) {
        elements.glowValue.textContent = `${Math.round(state.glowIntensity * 100)}%`;
      }
      scheduleSaveIndicator();
      applySettings();
    }, "input");

    bindControl("compactModeToggle", () => {
      state.compact = !state.compact;
      scheduleSaveIndicator();
      applySettings();
    });

    bindControl("fontSizeSlider", (event) => {
      state.fontSize = Number(event.target.value);
      if(elements.fontSizeValue) {
        elements.fontSizeValue.textContent = `${state.fontSize}px`;
      }
      scheduleSaveIndicator();
      applySettings();
    }, "input");

    bindSelect("defaultViewSelect", "defaultView");
    bindSelect("landingPageSelect", "defaultLandingPage");
    bindToggle("showHiddenFilesToggle", "showHiddenFiles");
    bindToggle("autoExpandFoldersToggle", "autoExpandFolders");
    bindToggle("confirmBeforeDeleteToggle", "confirmBeforeDelete");
    bindSelect("previewSizeSelect", "previewSize");
    bindToggle("openFilesNewWindowToggle", "openFilesInNewWindow");
    bindToggle("autoPreviewToggle", "autoPreview");
    bindSelect("downloadLocationSelect", "downloadLocation");
    bindSelect("imageQualitySelect", "imageQuality");
    bindToggle("enableNotificationsToggle", "enableNotifications");
    bindToggle("successToastsToggle", "successToasts");
    bindToggle("errorToastsToggle", "errorToasts");
    bindToggle("soundEffectsToggle", "soundEffects");
    bindSelect("animationLevelSelect", "animationLevel");
    bindToggle("hardwareAccelerationToggle", "hardwareAcceleration");
    bindToggle("lazyLoadingToggle", "lazyLoading");
    bindSlider("cacheSizeSlider", "cacheSize", "MB");
    bindToggle("highContrastToggle", "highContrast");
    bindToggle("keyboardNavigationToggle", "keyboardNavigation");
    bindToggle("focusIndicatorsToggle", "focusIndicators");
    bindToggle("reduceMotionToggle", "reduceMotion");
    bindToggle("largerTargetsToggle", "largerClickTargets");

    if(elements.clearCacheBtn) {
      elements.clearCacheBtn.addEventListener("click", clearCache);
    }

    if(elements.githubRepoBtn) {
      elements.githubRepoBtn.addEventListener("click", (event) => {
        event.preventDefault();
      });
    }
  }

  function bindControl(id, handler, eventName = "click") {
    const element = elements[id];
    if(!element) return;
    element.addEventListener(eventName, handler);
  }

  function bindToggle(id, key) {
    const element = elements[id];
    if(!element) return;
    element.addEventListener("click", () => {
      state[key] = !state[key];
      scheduleSaveIndicator();
      applySettings();
    });
  }

  function bindSelect(id, key) {
    const element = elements[id];
    if(!element) return;
    element.addEventListener("change", (event) => {
      state[key] = event.target.value;
      scheduleSaveIndicator();
      applySettings();
    });
  }

  function bindSlider(id, key, suffix = "") {
    const element = elements[id];
    if(!element) return;
    element.addEventListener("input", (event) => {
      state[key] = Number(event.target.value);
      if(elements.cacheSizeValue && key === "cacheSize") {
        elements.cacheSizeValue.textContent = `${state.cacheSize}${suffix ? ` ${suffix}` : ""}`;
      }
      scheduleSaveIndicator();
      applySettings();
    });
  }

  function filterSections(query) {
    const search = String(query || "").trim().toLowerCase();
    const sections = document.querySelectorAll(".settings-section");
    let firstVisible = null;

    sections.forEach((section) => {
      const summaryText = section.querySelector(".settings-section-summary")?.textContent?.toLowerCase() || "";
      const bodyText = section.textContent.toLowerCase();
      const matches = !search || summaryText.includes(search) || bodyText.includes(search);
      section.classList.toggle("is-search-hidden", !matches);
      if(matches) {
        if(!firstVisible) firstVisible = section;
        if(search) {
          section.open = true;
        }
      }
    });

    if(elements.sectionNav) {
      elements.sectionNav.querySelectorAll(".settings-nav-chip").forEach((chip) => {
        const target = chip.dataset.settingsJump;
        const section = document.querySelector(`.settings-section[data-settings-section="${target}"]`);
        const visible = !section?.classList.contains("is-search-hidden");
        chip.classList.toggle("is-search-hidden", !visible);
      });
    }

    if(search && firstVisible) {
      updateSectionNavState(firstVisible.getAttribute("data-settings-section"));
    } else {
      updateSectionNavState();
    }
  }

  function handleSectionNavClick(event) {
    const chip = event.target.closest("[data-settings-jump]");
    if(!chip) return;
    const target = chip.dataset.settingsJump;
    const section = document.querySelector(`.settings-section[data-settings-section="${target}"]`);
    if(!section) return;
    section.open = true;
    section.scrollIntoView({ behavior: "smooth", block: "start" });
    updateSectionNavActive(target);
  }

  function initSectionObserver() {
    if(!elements.contentScroll || typeof IntersectionObserver === "undefined") {
      return;
    }

    const sections = Array.from(document.querySelectorAll(".settings-section"));
    sectionObserver = new IntersectionObserver((entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((first, second) => second.intersectionRatio - first.intersectionRatio)[0];

      if(visible?.target) {
        updateSectionNavActive(visible.target.getAttribute("data-settings-section"));
      }
    }, {
      root: elements.contentScroll,
      threshold: [0.3, 0.5, 0.75]
    });

    sections.forEach((section) => sectionObserver.observe(section));
  }

  function updateSectionNavState(forcedSection = "") {
    if(!elements.sectionNav) return;

    if(forcedSection) {
      updateSectionNavActive(forcedSection);
      return;
    }

    const sections = Array.from(document.querySelectorAll(".settings-section")).filter((section) => !section.classList.contains("is-search-hidden"));
    const scrollContainer = elements.contentScroll;
    if(!scrollContainer || !sections.length) return;

    const containerRect = scrollContainer.getBoundingClientRect();
    let current = sections[0];
    let bestDistance = Infinity;

    sections.forEach((section) => {
      const rect = section.getBoundingClientRect();
      const distance = Math.abs(rect.top - containerRect.top - 24);
      if(distance < bestDistance) {
        bestDistance = distance;
        current = section;
      }
    });

    updateSectionNavActive(current?.dataset.settingsSection || "appearance");
  }

  function updateSectionNavActive(activeSection) {
    if(!elements.sectionNav) return;
    elements.sectionNav.querySelectorAll(".settings-nav-chip").forEach((chip) => {
      chip.classList.toggle("is-active", chip.dataset.settingsJump === activeSection);
    });
  }

  function resetSettings() {
    if(!confirm("Reset all workspace settings to defaults?")) {
      return;
    }

    Object.assign(state, DEFAULT_SETTINGS);
    scheduleSaveIndicator();
    applySettings();
  }

  function exportSettings() {
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      settings: { ...state }
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "note-files-settings.json";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function importSettingsFromFile(event) {
    const file = event.target.files?.[0];
    if(!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const source = parsed?.settings && typeof parsed.settings === "object" ? parsed.settings : parsed;
      Object.assign(state, normalizeSettings(source));
      scheduleSaveIndicator();
      applySettings();
    } catch (error) {
      alert(`Unable to import settings: ${error?.message || "Invalid file"}`);
    } finally {
      event.target.value = "";
    }
  }

  async function clearCache() {
    const shouldClear = confirm("Clear browser cache for Note - Files?");
    if(!shouldClear) return;

    try {
      if(window.caches && typeof window.caches.keys === "function") {
        const cacheNames = await window.caches.keys();
        await Promise.all(cacheNames.map((name) => window.caches.delete(name)));
      }
      updateSaveIndicator("Cache cleared");
      setTimeout(() => updateSaveIndicator("All changes saved"), 1200);
    } catch (error) {
      alert(`Cache clear failed: ${error?.message || "Unknown error"}`);
    }
  }

  function openSettings(event) {
    if(event) {
      event.preventDefault();
    }

    if(!elements.overlay) return;

    elements.overlay.classList.remove("hidden");
    elements.overlay.classList.add("visible");
    elements.overlay.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    filterSections(elements.searchInput?.value || "");
    updateSectionNavState();
  }

  function closeSettings() {
    if(!elements.overlay) return;

    elements.overlay.classList.add("hidden");
    elements.overlay.classList.remove("visible");
    elements.overlay.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";

    restorePreviousNav();
  }

  function restorePreviousNav() {
    const previous = window.notepilotPreviousNavTarget || "dashboard";
    const navItems = document.querySelectorAll(".sidebar-nav .nav-item");
    navItems.forEach((item) => {
      item.classList.toggle("active", item.dataset.navTarget === previous);
    });
  }

  function updateControlStates() {
    if(elements.themeToggle) {
      elements.themeToggle.dataset.state = state.theme === "light" ? "true" : "false";
      elements.themeToggle.setAttribute("aria-pressed", state.theme === "light" ? "true" : "false");
    }

    if(elements.accentColorPicker) {
      elements.accentColorPicker.value = state.accentColor;
    }

    if(elements.glowSlider) {
      elements.glowSlider.value = state.glowIntensity.toFixed(2);
    }

    if(elements.glowValue) {
      elements.glowValue.textContent = `${Math.round(state.glowIntensity * 100)}%`;
    }

    if(elements.compactToggle) {
      elements.compactToggle.dataset.state = state.compact ? "true" : "false";
      elements.compactToggle.setAttribute("aria-pressed", state.compact ? "true" : "false");
    }

    if(elements.fontSizeSlider) {
      elements.fontSizeSlider.value = state.fontSize;
    }

    if(elements.fontSizeValue) {
      elements.fontSizeValue.textContent = `${state.fontSize}px`;
    }

    if(elements.defaultViewSelect) elements.defaultViewSelect.value = state.defaultView;
    if(elements.landingPageSelect) elements.landingPageSelect.value = state.defaultLandingPage;
    if(elements.showHiddenFilesToggle) syncToggle(elements.showHiddenFilesToggle, state.showHiddenFiles);
    if(elements.autoExpandFoldersToggle) syncToggle(elements.autoExpandFoldersToggle, state.autoExpandFolders);
    if(elements.confirmBeforeDeleteToggle) syncToggle(elements.confirmBeforeDeleteToggle, state.confirmBeforeDelete);
    if(elements.previewSizeSelect) elements.previewSizeSelect.value = state.previewSize;
    if(elements.openFilesNewWindowToggle) syncToggle(elements.openFilesNewWindowToggle, state.openFilesInNewWindow);
    if(elements.autoPreviewToggle) syncToggle(elements.autoPreviewToggle, state.autoPreview);
    if(elements.downloadLocationSelect) elements.downloadLocationSelect.value = state.downloadLocation;
    if(elements.imageQualitySelect) elements.imageQualitySelect.value = state.imageQuality;
    if(elements.enableNotificationsToggle) syncToggle(elements.enableNotificationsToggle, state.enableNotifications);
    if(elements.successToastsToggle) syncToggle(elements.successToastsToggle, state.successToasts);
    if(elements.errorToastsToggle) syncToggle(elements.errorToastsToggle, state.errorToasts);
    if(elements.soundEffectsToggle) syncToggle(elements.soundEffectsToggle, state.soundEffects);
    if(elements.animationLevelSelect) elements.animationLevelSelect.value = state.animationLevel;
    if(elements.hardwareAccelerationToggle) syncToggle(elements.hardwareAccelerationToggle, state.hardwareAcceleration);
    if(elements.lazyLoadingToggle) syncToggle(elements.lazyLoadingToggle, state.lazyLoading);
    if(elements.cacheSizeSlider) elements.cacheSizeSlider.value = state.cacheSize;
    if(elements.cacheSizeValue) elements.cacheSizeValue.textContent = `${state.cacheSize} MB`;
    if(elements.highContrastToggle) syncToggle(elements.highContrastToggle, state.highContrast);
    if(elements.keyboardNavigationToggle) syncToggle(elements.keyboardNavigationToggle, state.keyboardNavigation);
    if(elements.focusIndicatorsToggle) syncToggle(elements.focusIndicatorsToggle, state.focusIndicators);
    if(elements.reduceMotionToggle) syncToggle(elements.reduceMotionToggle, state.reduceMotion);
    if(elements.largerTargetsToggle) syncToggle(elements.largerTargetsToggle, state.largerClickTargets);

    syncSwatches();
  }

  function syncToggle(toggle, value) {
    toggle.dataset.state = value ? "true" : "false";
    toggle.setAttribute("aria-pressed", value ? "true" : "false");
  }

  function syncSwatches() {
    elements.accentSwatches.forEach((swatch) => {
      swatch.classList.toggle("active", swatch.dataset.color === state.accentColor);
    });
  }

  function updateAboutMetrics() {
    const metrics = getWorkspaceMetrics();
    if(elements.appVersionValue) elements.appVersionValue.textContent = "v1.1";
    if(elements.storageUsedValue) elements.storageUsedValue.textContent = `${metrics.storageUsed}`;
    if(elements.totalFilesValue) elements.totalFilesValue.textContent = String(metrics.files);
    if(elements.totalNotesValue) elements.totalNotesValue.textContent = String(metrics.notes);
    if(elements.totalFoldersValue) elements.totalFoldersValue.textContent = String(metrics.folders);
    if(elements.totalTasksValue) elements.totalTasksValue.textContent = String(metrics.tasks);
  }

  function getWorkspaceMetrics() {
    const folderKey = getUserScopedKey("folderTree");
    const folders = safeParse(localStorage.getItem(folderKey));
    const tasks = safeParse(localStorage.getItem(getUserScopedKey("tasks")) || localStorage.getItem("tasks"));
    const visited = { folders: 0, files: 0, notes: 0 };

    const walk = (nodes) => {
      nodes.forEach((node) => {
        visited.folders += 1;
        visited.files += Array.isArray(node.files) ? node.files.length : 0;
        visited.notes += Array.isArray(node.notes) ? node.notes.length : 0;
        if(Array.isArray(node.subfolders) && node.subfolders.length) {
          walk(node.subfolders);
        }
      });
    };

    if(Array.isArray(folders)) {
      walk(folders);
    }

    const storageBytes = Object.keys(localStorage).reduce((total, key) => {
      const value = localStorage.getItem(key) || "";
      return total + key.length + value.length;
    }, 0);

    return {
      folders: visited.folders,
      files: visited.files,
      notes: visited.notes,
      tasks: Array.isArray(tasks) ? tasks.length : 0,
      storageUsed: formatBytes(storageBytes)
    };
  }

  function safeParse(value) {
    try {
      const parsed = JSON.parse(value || "[]");
      return parsed;
    } catch {
      return [];
    }
  }

  function formatBytes(bytes) {
    if(bytes < 1024) return `${bytes} B`;
    if(bytes < 1024 * 1024) return `${Math.round(bytes / 102.4) / 10} KB`;
    return `${Math.round(bytes / (1024 * 102.4)) / 10} MB`;
  }

  function hexToRgb(hex) {
    const cleaned = String(hex).replace("#", "").trim();
    if(cleaned.length !== 6) return "59, 130, 246";
    const bigint = parseInt(cleaned, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return `${r}, ${g}, ${b}`;
  }

  function getAltAccent(color) {
    const cleaned = String(color).replace("#", "").trim();
    if(cleaned.length !== 6) return "#8b5cf6";
    const bigint = parseInt(cleaned, 16);
    const r = Math.min(255, ((bigint >> 16) & 255) + 34);
    const g = Math.min(255, (((bigint >> 8) & 255) + 34));
    const b = Math.min(255, ((bigint & 255) + 34));
    return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
  }

  window.NotePilotSettings = {
    getSettings() {
      return { ...state };
    },
    getPreference(key, fallback = undefined) {
      return Object.prototype.hasOwnProperty.call(state, key) ? state[key] : fallback;
    },
    shouldConfirmBeforeDelete() {
      return Boolean(state.confirmBeforeDelete);
    },
    getLandingPage() {
      return state.defaultLandingPage;
    },
    getDefaultExplorerView() {
      return state.defaultView;
    },
    isAutoPreviewEnabled() {
      return Boolean(state.autoPreview);
    }
  };

  return {
    init
  };
})();

SettingsPanel.init();
