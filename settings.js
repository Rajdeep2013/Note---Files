const SettingsPanel = (() => {
  const SETTINGS_STORAGE_KEY = getUserScopedKey("settings");

  const elements = {
    navItem: document.querySelector('.nav-item[data-nav-target="settings"]'),
    overlay: document.getElementById('settingsOverlay'),
    closeButton: document.getElementById('closeSettingsBtn'),
    themeToggle: document.getElementById('themeToggle'),
    accentColorPicker: document.getElementById('accentColorPicker'),
    accentSwatches: Array.from(document.querySelectorAll('.settings-swatch')),
    glowSlider: document.getElementById('glowIntensity'),
    glowValue: document.getElementById('glowValue'),
    compactToggle: document.getElementById('compactModeToggle'),
    fontSizeSlider: document.getElementById('fontSizeSlider'),
    fontSizeValue: document.getElementById('fontSizeValue')
  };

  const state = {
    theme: 'dark',
    accentColor: '#3b82f6',
    glowIntensity: 0.18,
    compact: false,
    fontSize: 16
  };

  function init() {
    if(!elements.overlay || !elements.navItem) {
      return;
    }

    loadSettings();
    applySettings();
    bindEvents();
  }

  function loadSettings() {
    try {
      const saved = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if(!saved) return;
      const parsed = JSON.parse(saved);
      if(parsed && typeof parsed === 'object') {
        state.theme = parsed.theme === 'light' ? 'light' : 'dark';
        state.accentColor = parsed.accentColor || state.accentColor;
        state.glowIntensity = typeof parsed.glowIntensity === 'number' ? parsed.glowIntensity : state.glowIntensity;
        state.compact = Boolean(parsed.compact);
        state.fontSize = Number.isFinite(parsed.fontSize) ? parsed.fontSize : state.fontSize;
      }
    } catch {
      // ignore invalid settings
    }
  }

  function saveSettings() {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({
      theme: state.theme,
      accentColor: state.accentColor,
      glowIntensity: state.glowIntensity,
      compact: state.compact,
      fontSize: state.fontSize
    }));
  }

  function applySettings() {
    document.body.classList.toggle('light-theme', state.theme === 'light');
    document.body.classList.toggle('dark-theme', state.theme === 'dark');
    document.body.classList.toggle('compact-mode', state.compact);
    const rgb = hexToRgb(state.accentColor);
    document.documentElement.style.setProperty('--accent-color', state.accentColor);
    document.documentElement.style.setProperty('--accent-alt-color', getAltAccent(state.accentColor));
    document.documentElement.style.setProperty('--accent-rgb', rgb);
    document.documentElement.style.setProperty('--glow-intensity', state.glowIntensity.toFixed(2));
    document.documentElement.style.setProperty('--accent-glow', `rgba(${rgb}, ${state.glowIntensity.toFixed(2)})`);
    document.documentElement.style.setProperty('--accent-glow-soft', `rgba(${rgb}, ${Math.max(state.glowIntensity * 0.55, 0.02).toFixed(2)})`);
    document.documentElement.style.setProperty('--font-size', `${state.fontSize}px`);
    updateControlStates();
  }

  function bindEvents() {
    elements.navItem.addEventListener('click', openSettings);

    if(elements.closeButton) {
      elements.closeButton.addEventListener('click', closeSettings);
    }

    if(elements.overlay) {
      elements.overlay.addEventListener('click', (event) => {
        if(event.target === elements.overlay) {
          closeSettings();
        }
      });
    }

    document.addEventListener('keydown', (event) => {
      if(event.key === 'Escape' && elements.overlay && !elements.overlay.classList.contains('hidden')) {
        closeSettings();
      }
    });

    if(elements.themeToggle) {
      elements.themeToggle.addEventListener('click', () => {
        state.theme = state.theme === 'dark' ? 'light' : 'dark';
        saveSettings();
        applySettings();
      });
    }

    if(elements.accentColorPicker) {
      elements.accentColorPicker.addEventListener('input', (event) => {
        state.accentColor = event.target.value;
        syncSwatches();
        saveSettings();
        applySettings();
      });
    }

    elements.accentSwatches.forEach((swatch) => {
      swatch.addEventListener('click', () => {
        const color = swatch.dataset.color;
        if(!color) return;
        state.accentColor = color;
        if(elements.accentColorPicker) {
          elements.accentColorPicker.value = color;
        }
        syncSwatches();
        saveSettings();
        applySettings();
      });
    });

    if(elements.glowSlider) {
      elements.glowSlider.addEventListener('input', (event) => {
        state.glowIntensity = Number(event.target.value);
        saveSettings();
        applySettings();
      });
    }

    if(elements.compactToggle) {
      elements.compactToggle.addEventListener('click', () => {
        state.compact = !state.compact;
        saveSettings();
        applySettings();
      });
    }

    if(elements.fontSizeSlider) {
      elements.fontSizeSlider.addEventListener('input', (event) => {
        state.fontSize = Number(event.target.value);
        saveSettings();
        applySettings();
      });
    }
  }

  function openSettings(event) {
    if(event) {
      event.preventDefault();
    }

    if(!elements.overlay) return;

    elements.overlay.classList.remove('hidden');
    elements.overlay.classList.add('visible');
    elements.overlay.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function closeSettings() {
    if(!elements.overlay) return;

    elements.overlay.classList.add('hidden');
    elements.overlay.classList.remove('visible');
    elements.overlay.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';

    restorePreviousNav();
  }

  function restorePreviousNav() {
    const previous = window.notepilotPreviousNavTarget || 'dashboard';
    const navItems = document.querySelectorAll('.sidebar-nav .nav-item');
    navItems.forEach((item) => {
      item.classList.toggle('active', item.dataset.navTarget === previous);
    });
  }

  function updateControlStates() {
    if(elements.themeToggle) {
      elements.themeToggle.dataset.state = state.theme === 'light' ? 'true' : 'false';
      elements.themeToggle.setAttribute('aria-pressed', state.theme === 'light' ? 'true' : 'false');
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
      elements.compactToggle.dataset.state = state.compact ? 'true' : 'false';
      elements.compactToggle.setAttribute('aria-pressed', state.compact ? 'true' : 'false');
    }

    if(elements.fontSizeSlider) {
      elements.fontSizeSlider.value = state.fontSize;
    }

    if(elements.fontSizeValue) {
      elements.fontSizeValue.textContent = `${state.fontSize}px`;
    }

    syncSwatches();
  }

  function syncSwatches() {
    elements.accentSwatches.forEach((swatch) => {
      swatch.classList.toggle('active', swatch.dataset.color === state.accentColor);
    });
  }

  function hexToRgb(hex) {
    const cleaned = String(hex).replace('#', '').trim();
    if(cleaned.length !== 6) return '59, 130, 246';
    const bigint = parseInt(cleaned, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return `${r}, ${g}, ${b}`;
  }

  function getAltAccent(color) {
    const cleaned = String(color).replace('#', '').trim();
    if(cleaned.length !== 6) return '#8b5cf6';
    const bigint = parseInt(cleaned, 16);
    const r = Math.min(255, ((bigint >> 16) & 255) + 34);
    const g = Math.min(255, (((bigint >> 8) & 255) + 34));
    const b = Math.min(255, ((bigint & 255) + 34));
    return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
  }

  return {
    init
  };
})();

SettingsPanel.init();
