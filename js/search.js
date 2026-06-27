(() => {
  "use strict";

  const FILTER_TYPES = new Set(["all", "folders", "files", "notes", "tasks"]);
  const RESULT_LIMIT = 80;
  const INPUT_DEBOUNCE_MS = 120;
  const TYPE_PRIORITY = {
    folders: 1,
    files: 2,
    notes: 3,
    tasks: 4
  };

  const state = {
    initialized: false,
    query: "",
    filter: "all",
    index: [],
    results: [],
    activeResultIndex: -1,
    debounceId: 0,
    dirty: true
  };

  const elements = {
    shell: null,
    input: null,
    panel: null,
    results: null,
    empty: null,
    filters: []
  };

  function cacheElements() {
    elements.shell = document.getElementById("globalSearchBox");
    elements.input = document.getElementById("globalSearchInput");
    elements.panel = document.getElementById("globalSearchPanel");
    elements.results = document.getElementById("globalSearchResults");
    elements.empty = document.getElementById("globalSearchEmpty");
    elements.filters = Array.from(document.querySelectorAll("[data-search-filter]"));
  }

  function init() {
    if(state.initialized) {
      return true;
    }

    cacheElements();

    if(
      !elements.shell ||
      !elements.input ||
      !elements.panel ||
      !elements.results ||
      !elements.empty ||
      !window.NotePilotSearchBridge
    ) {
      return false;
    }

    bindEvents();
    syncFilterButtons();
    rebuildIndex();
    renderResults(selectTopResults("", state.filter));
    state.initialized = true;
    return true;
  }

  function bindEvents() {
    elements.input.addEventListener("input", handleInput);
    elements.input.addEventListener("focus", () => {
      openPanel();
      scheduleSearch();
    });
    elements.input.addEventListener("keydown", handleInputKeydown);

    elements.panel.addEventListener("click", handlePanelClick);

    document.addEventListener("click", (event) => {
      if(!elements.shell.contains(event.target)) {
        closePanel();
      }
    });

    document.addEventListener("keydown", (event) => {
      const isShortcut = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k";
      if(isShortcut) {
        event.preventDefault();
        elements.input.focus();
        elements.input.select();
        openPanel();
        scheduleSearch();
        return;
      }

      if(event.key === "Escape" && isPanelOpen()) {
        closePanel();
      }
    });

    document.addEventListener("notepilot:data-updated", () => {
      state.dirty = true;
      if(isPanelOpen()) {
        scheduleSearch();
      }
    });
  }

  function handleInput() {
    state.query = elements.input.value || "";
    openPanel();
    scheduleSearch();
  }

  function handleInputKeydown(event) {
    if(!isPanelOpen()) {
      return;
    }

    if(event.key === "ArrowDown") {
      event.preventDefault();
      moveActiveResult(1);
      return;
    }

    if(event.key === "ArrowUp") {
      event.preventDefault();
      moveActiveResult(-1);
      return;
    }

    if(event.key === "Enter") {
      event.preventDefault();
      const index = state.activeResultIndex >= 0 ? state.activeResultIndex : 0;
      const result = state.results[index];
      if(result) {
        openResult(result);
      }
      return;
    }

    if(event.key === "Escape") {
      event.preventDefault();
      closePanel();
    }
  }

  function handlePanelClick(event) {
    const filterButton = event.target.closest("[data-search-filter]");
    if(filterButton) {
      const filter = String(filterButton.dataset.searchFilter || "all").toLowerCase();
      if(FILTER_TYPES.has(filter) && filter !== state.filter) {
        state.filter = filter;
        state.activeResultIndex = -1;
        syncFilterButtons();
        scheduleSearch();
      }
      return;
    }

    const resultButton = event.target.closest(".global-search-result");
    if(!resultButton) {
      return;
    }

    const index = Number(resultButton.dataset.resultIndex);
    if(Number.isNaN(index)) {
      return;
    }

    const result = state.results[index];
    if(result) {
      openResult(result);
    }
  }

  function scheduleSearch() {
    clearTimeout(state.debounceId);
    state.debounceId = setTimeout(() => {
      runSearch();
    }, INPUT_DEBOUNCE_MS);
  }

  function runSearch() {
    if(!window.NotePilotSearchBridge) {
      return;
    }

    if(state.dirty) {
      rebuildIndex();
    }

    state.query = elements.input.value || "";
    const query = normalizeText(state.query);
    const results = query
      ? searchIndex(query, state.filter)
      : selectTopResults(query, state.filter);

    renderResults(results);
  }

  function rebuildIndex() {
    if(!window.NotePilotSearchBridge || typeof window.NotePilotSearchBridge.getSnapshot !== "function") {
      return;
    }

    const snapshot = window.NotePilotSearchBridge.getSnapshot() || {};
    const index = [];

    const folderTree = Array.isArray(snapshot.folderTree) ? snapshot.folderTree : [];
    folderTree.forEach((folder) => {
      walkFolderNode(folder, [], index);
    });

    const tasks = Array.isArray(snapshot.tasks) ? snapshot.tasks : [];
    tasks.forEach((task) => {
      const text = String(task?.text || "").trim();
      if(!text) return;

      index.push({
        type: "tasks",
        icon: "✅",
        name: text,
        path: task.completed ? "Task • Completed" : "Task • Pending",
        matchText: normalizeText(`${text} task todo ${task.completed ? "completed" : "pending"}`),
        action: {
          kind: "task",
          taskIndex: Number(task.index)
        }
      });
    });

    const notebookPages = Array.isArray(snapshot.notebookPages) ? snapshot.notebookPages : [];
    notebookPages.forEach((page) => {
      const text = String(page?.text || "").trim();
      if(!text) return;

      const pageIndex = Number(page.index);
      const title = buildTextTitle(text, `Notebook Page ${pageIndex + 1}`);

      index.push({
        type: "notes",
        icon: "📓",
        name: title,
        path: `Quick Notes • Page ${pageIndex + 1}`,
        matchText: normalizeText(`${title} ${text} quick notes notebook page ${pageIndex + 1}`),
        action: {
          kind: "notebook-page",
          pageIndex
        }
      });
    });

    state.index = index;
    state.dirty = false;
  }

  function walkFolderNode(folder, ancestry, index) {
    if(!folder || typeof folder !== "object") {
      return;
    }

    const folderId = String(folder.id || "");
    const folderName = String(folder.name || "Folder").trim() || "Folder";
    const lineage = [...ancestry, folderName];
    const parentPath = ancestry.join(" / ");
    const fullPath = lineage.join(" / ");

    index.push({
      type: "folders",
      icon: "📁",
      name: folderName,
      path: parentPath ? `Folder • ${parentPath}` : "Folder • Root",
      matchText: normalizeText(`${folderName} ${parentPath} folder subfolder`),
      action: {
        kind: "folder",
        folderId
      }
    });

    const files = Array.isArray(folder.files) ? folder.files : [];
    files.forEach((file) => {
      const fileName = String(file?.name || "Untitled file").trim() || "Untitled file";
      const extension = String(file?.extension || "").toLowerCase();
      const fileId = String(file?.id || "");

      index.push({
        type: "files",
        icon: getFileIcon(extension),
        name: fileName,
        path: `File • ${fullPath}`,
        matchText: normalizeText(`${fileName} ${extension} ${fullPath} file`),
        action: {
          kind: "file",
          folderId,
          fileId
        }
      });
    });

    const notes = Array.isArray(folder.notes) ? folder.notes : [];
    notes.forEach((note, noteIndex) => {
      const text = String(note || "").trim();
      if(!text) return;

      const title = buildTextTitle(text, `Folder Note ${noteIndex + 1}`);

      index.push({
        type: "notes",
        icon: "📝",
        name: title,
        path: `Note • ${fullPath}`,
        matchText: normalizeText(`${title} ${text} ${fullPath} folder note`),
        action: {
          kind: "folder-note",
          folderId,
          noteIndex
        }
      });
    });

    const subfolders = Array.isArray(folder.subfolders) ? folder.subfolders : [];
    subfolders.forEach((subfolder) => {
      walkFolderNode(subfolder, lineage, index);
    });
  }

  function buildTextTitle(text, fallback) {
    const singleLine = String(text || "")
      .replace(/\s+/g, " ")
      .trim();

    if(!singleLine) {
      return fallback;
    }

    return singleLine.length > 78 ? `${singleLine.slice(0, 78)}...` : singleLine;
  }

  function searchIndex(query, filter) {
    const tokens = query.split(/\s+/).filter(Boolean);

    if(!tokens.length) {
      return selectTopResults(query, filter);
    }

    const ranked = [];
    state.index.forEach((item) => {
      if(filter !== "all" && item.type !== filter) {
        return;
      }

      const haystack = item.matchText;
      if(!tokens.every((token) => haystack.includes(token))) {
        return;
      }

      let score = 0;
      if(item.name.toLowerCase().startsWith(query)) score += 90;
      if(haystack.startsWith(query)) score += 75;
      if(item.name.toLowerCase().includes(query)) score += 40;
      if(haystack.includes(query)) score += 22;
      score += Math.max(0, 18 - Math.abs(item.name.length - query.length));

      ranked.push({ item, score });
    });

    return ranked
      .sort((first, second) => {
        if(second.score !== first.score) {
          return second.score - first.score;
        }

        const typeDiff = (TYPE_PRIORITY[first.item.type] || 99) - (TYPE_PRIORITY[second.item.type] || 99);
        if(typeDiff !== 0) {
          return typeDiff;
        }

        return first.item.name.localeCompare(second.item.name, undefined, {
          sensitivity: "base"
        });
      })
      .slice(0, RESULT_LIMIT)
      .map((entry) => entry.item);
  }

  function selectTopResults(_query, filter) {
    return state.index
      .filter((item) => filter === "all" || item.type === filter)
      .sort((first, second) => {
        const typeDiff = (TYPE_PRIORITY[first.type] || 99) - (TYPE_PRIORITY[second.type] || 99);
        if(typeDiff !== 0) {
          return typeDiff;
        }

        return first.name.localeCompare(second.name, undefined, {
          sensitivity: "base"
        });
      })
      .slice(0, RESULT_LIMIT);
  }

  function renderResults(results) {
    state.results = results;
    state.activeResultIndex = results.length ? 0 : -1;

    if(!results.length) {
      elements.results.innerHTML = "";
      elements.empty.classList.remove("hidden");
      return;
    }

    elements.empty.classList.add("hidden");
    elements.results.innerHTML = results
      .map((result, index) => {
        return `
          <button
            type="button"
            class="global-search-result${index === state.activeResultIndex ? " is-active" : ""}"
            data-result-index="${index}"
            role="option"
            aria-selected="${index === state.activeResultIndex ? "true" : "false"}">
            <span class="global-search-result-icon" aria-hidden="true">${result.icon}</span>
            <span class="global-search-result-main">
              <span class="global-search-result-type">${escapeHtml(result.type.slice(0, -1) || result.type)}</span>
              <span class="global-search-result-name">${escapeHtml(result.name)}</span>
              <span class="global-search-result-path">${escapeHtml(result.path)}</span>
            </span>
          </button>
        `;
      })
      .join("");
  }

  function moveActiveResult(direction) {
    if(!state.results.length) {
      return;
    }

    const nextIndex = normalizeIndex(state.activeResultIndex + direction, state.results.length);
    state.activeResultIndex = nextIndex;

    const buttons = elements.results.querySelectorAll(".global-search-result");
    buttons.forEach((button, index) => {
      const active = index === nextIndex;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-selected", active ? "true" : "false");
      if(active) {
        button.scrollIntoView({
          behavior: "smooth",
          block: "nearest"
        });
      }
    });
  }

  async function openResult(result) {
    if(!result || !result.action || !window.NotePilotSearchBridge) {
      return;
    }

    closePanel();

    const action = result.action;

    try {
      if(action.kind === "folder") {
        window.NotePilotSearchBridge.openFolder(action.folderId);
        return;
      }

      if(action.kind === "file") {
        await window.NotePilotSearchBridge.openFolderFile(action.folderId, action.fileId, {
          openPreview: true
        });
        return;
      }

      if(action.kind === "folder-note") {
        window.NotePilotSearchBridge.openFolderNote(action.folderId, action.noteIndex);
        return;
      }

      if(action.kind === "task") {
        window.NotePilotSearchBridge.openTask(action.taskIndex);
        return;
      }

      if(action.kind === "notebook-page") {
        window.NotePilotSearchBridge.openNotebookPage(action.pageIndex);
      }
    } catch {
      // best effort
    }
  }

  function syncFilterButtons() {
    elements.filters.forEach((button) => {
      const active = button.dataset.searchFilter === state.filter;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    });
  }

  function openPanel() {
    if(!elements.shell || !elements.panel || !elements.input) {
      return;
    }

    elements.shell.classList.add("is-open");
    elements.panel.classList.remove("hidden");
    elements.panel.setAttribute("aria-hidden", "false");
    elements.input.setAttribute("aria-expanded", "true");
  }

  function closePanel() {
    if(!elements.shell || !elements.panel || !elements.input) {
      return;
    }

    elements.shell.classList.remove("is-open");
    elements.panel.classList.add("hidden");
    elements.panel.setAttribute("aria-hidden", "true");
    elements.input.setAttribute("aria-expanded", "false");
  }

  function isPanelOpen() {
    return Boolean(elements.shell?.classList.contains("is-open"));
  }

  function normalizeIndex(value, length) {
    if(length <= 0) {
      return -1;
    }

    if(value < 0) {
      return length - 1;
    }

    if(value >= length) {
      return 0;
    }

    return value;
  }

  function getFileIcon(extension) {
    const ext = String(extension || "").toLowerCase();
    if(["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp"].includes(ext)) {
      return "🖼";
    }

    if(ext === "pdf") {
      return "📕";
    }

    if(["txt", "md", "json", "js", "html", "css", "xml", "ts", "py", "java", "c", "cpp"].includes(ext)) {
      return "💻";
    }

    return "📄";
  }

  function normalizeText(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function boot(attempt = 0) {
    if(init()) {
      return;
    }

    if(attempt >= 20) {
      return;
    }

    setTimeout(() => {
      boot(attempt + 1);
    }, 80);
  }

  if(document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => boot(), { once: true });
  } else {
    boot();
  }
})();
