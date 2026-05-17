window.Notepilot.FolderSystem = (() => {
  const elements = {
    dashboardView: document.getElementById("dashboardView"),
    folderView: document.getElementById("folderView"),
    folderTree: document.getElementById("folderTree"),
    dashboardFoldersGrid: document.getElementById("dashboardFoldersGrid"),
    folderTitle: document.getElementById("folderTitle"),
    folderBreadcrumbs: document.getElementById("folderBreadcrumbs"),
    newRootFolderBtn: document.getElementById("newRootFolderBtn"),
    newSubfolderBtn: document.getElementById("newSubfolderBtn"),
    backBtn: document.getElementById("backBtn"),
    addNoteBtn: document.getElementById("addNoteBtn"),
    notesList: document.getElementById("notesList"),
    addFileBtn: document.getElementById("addFileBtn"),
    fileInput: document.getElementById("fileInput"),
    filesList: document.getElementById("filesList"),
    subfolderGrid: document.getElementById("subfolderGrid"),
    previewModal: document.getElementById("filePreviewModal"),
    previewTitle: document.getElementById("previewTitle"),
    previewSubtitle: document.getElementById("previewSubtitle"),
    previewCloseBtn: document.getElementById("previewCloseBtn"),
    previewLoader: document.getElementById("previewLoader"),
    previewError: document.getElementById("previewError"),
    previewContent: document.getElementById("previewContent")
  };

  const state = {
    activeFolderId: ""
  };

  const FOLDER_TREE_STORAGE_KEY = window.Notepilot.Auth.getUserScopedKey("folderTree");
  const STORAGE_PREFIX = `notepilot:folder:v3:${window.Notepilot.Auth.ACTIVE_USER_SLUG}`;
  let folderTree = [];

  function init() {
    if (!elements.dashboardView || !elements.folderView || !elements.folderTree || !elements.dashboardFoldersGrid) {
      return;
    }
    folderTree = loadFolderTree();
    bindEvents();
    renderFolderTree();
    renderDashboardFolders();
  }

  function bindEvents() {
    if (elements.folderTree) {
      elements.folderTree.addEventListener("click", handleFolderTreeClick);
    }
    if (elements.dashboardFoldersGrid) {
      elements.dashboardFoldersGrid.addEventListener("click", (event) => {
        const card = event.target.closest(".folder-card");
        if (!card) return;
        const folderId = card.dataset.folder;
        if (folderId) openFolder(folderId);
      });
    }
    if (elements.subfolderGrid) {
      elements.subfolderGrid.addEventListener("click", (event) => {
        const card = event.target.closest(".folder-card");
        if (!card) return;
        const folderId = card.dataset.folder;
        if (folderId) openFolder(folderId);
      });
    }
    if (elements.backBtn) {
      elements.backBtn.addEventListener("click", closeFolder);
    }
    if (elements.addNoteBtn) {
      elements.addNoteBtn.addEventListener("click", handleAddNote);
    }
    if (elements.addFileBtn) {
      elements.addFileBtn.addEventListener("click", handleChooseFile);
    }
    if (elements.newRootFolderBtn) {
      elements.newRootFolderBtn.addEventListener("click", () => {
        const name = prompt("New root folder name", "New Folder");
        if (!name) return;
        const folder = createFolder(name.trim(), null);
        if (folder) {
          renderFolderTree();
          renderDashboardFolders();
        }
      });
    }
    if (elements.newSubfolderBtn) {
      elements.newSubfolderBtn.addEventListener("click", () => {
        if (!state.activeFolderId) return;
        const name = prompt("New subfolder name", "New Subfolder");
        if (!name) return;
        const folder = createFolder(name.trim(), state.activeFolderId);
        if (folder) {
          renderSubfolders(state.activeFolderId);
          renderFolderTree();
          renderDashboardFolders();
        }
      });
    }
    if (elements.fileInput) {
      elements.fileInput.addEventListener("change", handleFileInputChange);
    }
    if (elements.notesList) {
      elements.notesList.addEventListener("click", (event) => {
        const actionButton = event.target.closest("[data-note-action]");
        if (!actionButton) return;
        const index = Number(actionButton.dataset.index);
        if (Number.isNaN(index)) return;
        const action = actionButton.dataset.noteAction;
        if (action === "edit") {
          editNote(index);
          return;
        }
        if (action === "delete") {
          deleteNote(index, actionButton.closest(".note-item"));
        }
      });
    }
    if (elements.filesList) {
      elements.filesList.addEventListener("click", handleFilesListClick);
      elements.filesList.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        const card = event.target.closest(".file-card");
        if (!card || !elements.filesList.contains(card)) return;
        event.preventDefault();
        const index = Number(card.dataset.index);
        if (!Number.isNaN(index)) {
          openFileAtIndex(index);
        }
      });
    }
    if (elements.previewCloseBtn) {
      elements.previewCloseBtn.addEventListener("click", closeFilePreview);
    }
    if (elements.previewModal) {
      elements.previewModal.addEventListener("click", (event) => {
        if (event.target === elements.previewModal) {
          closeFilePreview();
        }
      });
    }
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && elements.previewModal && !elements.previewModal.classList.contains("hidden")) {
        closeFilePreview();
      }
    });
  }

  function getStorageKey(folderId, resourceType) {
    return `${STORAGE_PREFIX}:${folderId}:${resourceType}`;
  }

  function getLegacyStorageKeys(folderId, resourceType) {
    return [
      `${resourceType}_${folderId}`,
      `notepilot:folder:${folderId}:${resourceType}`,
      `notepilot:folder:v2:${folderId}:${resourceType}`
    ];
  }

  function safeParseArray(value) {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function readFolderResource(folderId, resourceType) {
    const key = getStorageKey(folderId, resourceType);
    const namespacedValue = localStorage.getItem(key);
    if (namespacedValue !== null) {
      return safeParseArray(namespacedValue);
    }
    const legacyKeys = getLegacyStorageKeys(folderId, resourceType);
    for (const legacyKey of legacyKeys) {
      const legacyValue = localStorage.getItem(legacyKey);
      if (legacyValue === null) continue;
      const parsedLegacy = safeParseArray(legacyValue);
      localStorage.setItem(key, JSON.stringify(parsedLegacy));
      return parsedLegacy;
    }
    return [];
  }

  function writeFolderResource(folderId, resourceType, data) {
    localStorage.setItem(getStorageKey(folderId, resourceType), JSON.stringify(data));
  }

  function loadFolderTree() {
    const stored = localStorage.getItem(FOLDER_TREE_STORAGE_KEY);
    if (!stored) {
      const defaultFolders = [
        createFolderObject("School", null),
        createFolderObject("Coding", null)
      ];
      saveFolderTree(defaultFolders);
      return defaultFolders;
    }
    try {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        return parsed.map(normalizeFolderEntry);
      }
    } catch {
      // fall through
    }
    return [];
  }

  function saveFolderTree(tree) {
    folderTree = Array.isArray(tree) ? tree.map(normalizeFolderEntry) : [];
    localStorage.setItem(FOLDER_TREE_STORAGE_KEY, JSON.stringify(folderTree));
  }

  function createFolderObject(name, parentId) {
    return {
      id: `folder-${Math.random().toString(36).slice(2)}-${Date.now()}`,
      name: String(name || "New Folder").trim() || "New Folder",
      parentId: parentId || null,
      createdAt: Date.now(),
      open: true
    };
  }

  function normalizeFolderEntry(entry) {
    if (!entry || typeof entry !== "object") {
      return createFolderObject("New Folder", null);
    }
    return {
      id: entry.id || `folder-${Math.random().toString(36).slice(2)}-${Date.now()}`,
      name: String(entry.name || "New Folder").trim() || "New Folder",
      parentId: entry.parentId || null,
      createdAt: Number(entry.createdAt) || Date.now(),
      open: typeof entry.open === "boolean" ? entry.open : true
    };
  }

  function getFolderById(folderId) {
    if (!folderId) return null;
    return folderTree.find((node) => node.id === folderId) || null;
  }

  function getFolderChildren(parentId) {
    return folderTree
      .filter((node) => node.parentId === (parentId || null))
      .sort((first, second) => first.name.localeCompare(second.name, undefined, { sensitivity: "base" }));
  }

  function createFolder(name, parentId) {
    const folder = createFolderObject(name, parentId);
    folderTree.push(folder);
    saveFolderTree(folderTree);
    return folder;
  }

  function renameFolder(folderId, newName) {
    const folder = getFolderById(folderId);
    if (!folder || !newName) return null;
    folder.name = String(newName).trim() || folder.name;
    saveFolderTree(folderTree);
    return folder;
  }

  function toggleFolderOpen(folderId) {
    const folder = getFolderById(folderId);
    if (!folder) return;
    folder.open = !folder.open;
    saveFolderTree(folderTree);
  }

  function handleFolderTreeClick(event) {
    const treeItem = event.target.closest(".folder-tree-item");
    if (!treeItem) return;
    const folderId = treeItem.dataset.folderId;
    const action = event.target.dataset.folderAction;
    if (action === "toggle") {
      toggleFolderOpen(folderId);
      renderFolderTree();
      return;
    }
    if (action === "rename") {
      const folder = getFolderById(folderId);
      if (!folder) return;
      const name = prompt("Rename folder", folder.name);
      if (!name) return;
      renameFolder(folderId, name.trim());
      renderFolderTree();
      renderDashboardFolders();
      if (folderId === state.activeFolderId) {
        updateBreadcrumbs();
        if (elements.folderTitle) {
          elements.folderTitle.textContent = folder.name;
        }
      }
      return;
    }
    if (event.target.closest(".folder-tree-action") || event.target.dataset.folderAction) {
      return;
    }
    openFolder(folderId);
  }

  function renderFolderTree() {
    if (!elements.folderTree) return;
    const buildTree = (parentId, level = 0) => {
      const children = getFolderChildren(parentId);
      if (!children.length) return "";
      return `
        <ul class="folder-tree-list ${level === 0 ? "root-level" : "nested-level"}">
          ${children.map((folder) => {
            const nested = buildTree(folder.id, level + 1);
            return `
              <li class="folder-tree-item" data-folder-id="${folder.id}">
                <button type="button" class="folder-tree-toggle" data-folder-action="toggle" aria-label="Toggle ${window.Notepilot.utils.escapeText(folder.name)}">
                  ${nested ? (folder.open ? "▾" : "▸") : ""}
                </button>
                <span class="folder-tree-label">${window.Notepilot.utils.escapeText(folder.name)}</span>
                <button type="button" class="folder-tree-action" data-folder-action="rename" aria-label="Rename ${window.Notepilot.utils.escapeText(folder.name)}">✎</button>
                ${folder.open ? nested : ""}
              </li>
            `;
          }).join("")}
        </ul>
      `;
    };
    elements.folderTree.innerHTML = buildTree(null);
  }

  function renderDashboardFolders() {
    if (!elements.dashboardFoldersGrid) return;
    const roots = getFolderChildren(null);
    elements.dashboardFoldersGrid.innerHTML = "";
    if (!roots.length) {
      elements.dashboardFoldersGrid.innerHTML = '<div class="folder-card empty-state">No folders yet. Create a new folder to get started.</div>';
      return;
    }
    roots.forEach((folder) => {
      const card = document.createElement("div");
      card.className = "folder-card";
      card.dataset.folder = folder.id;
      card.innerHTML = `
        <div class="folder-card-content">
          <div class="folder-icon-wrapper">
            <svg class="folder-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
            </svg>
          </div>
          <div class="folder-info">
            <h3>${window.Notepilot.utils.escapeText(folder.name)}</h3>
            <p>${formatFolderSubtitle(folder)}</p>
          </div>
        </div>
      `;
      elements.dashboardFoldersGrid.appendChild(card);
    });
  }

  function formatFolderSubtitle(folder) {
    const childCount = getFolderChildren(folder.id).length;
    const label = childCount === 1 ? "subfolder" : "subfolders";
    return `${childCount} ${label}`;
  }

  function renderSubfolders(folderId) {
    if (!elements.subfolderGrid) return;
    const children = getFolderChildren(folderId);
    elements.subfolderGrid.innerHTML = "";
    if (!children.length) {
      elements.subfolderGrid.innerHTML = '<div class="folder-card empty-state">No subfolders found here.</div>';
      return;
    }
    children.forEach((subfolder) => {
      const card = document.createElement("div");
      card.className = "folder-card";
      card.dataset.folder = subfolder.id;
      card.innerHTML = `
        <div class="folder-card-content">
          <div class="folder-icon-wrapper">
            <svg class="folder-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
            </svg>
          </div>
          <div class="folder-info">
            <h3>${window.Notepilot.utils.escapeText(subfolder.name)}</h3>
            <p>${formatFolderSubtitle(subfolder)}</p>
          </div>
        </div>
      `;
      elements.subfolderGrid.appendChild(card);
    });
  }

  function getFolderPath(folderId) {
    const path = [];
    let current = getFolderById(folderId);
    while (current) {
      path.unshift(current);
      current = current.parentId ? getFolderById(current.parentId) : null;
    }
    return path;
  }

  function updateBreadcrumbs() {
    if (!elements.folderBreadcrumbs) return;
    if (!state.activeFolderId) {
      elements.folderBreadcrumbs.textContent = "Root";
      return;
    }
    const path = getFolderPath(state.activeFolderId);
    elements.folderBreadcrumbs.innerHTML = path
      .map((folder, index) => {
        if (index === path.length - 1) {
          return `<span>${window.Notepilot.utils.escapeText(folder.name)}</span>`;
        }
        return `<button type="button" class="breadcrumb-link" data-folder-id="${folder.id}">${window.Notepilot.utils.escapeText(folder.name)}</button>`;
      })
      .join("<span class='breadcrumb-separator'>/</span>");
    elements.folderBreadcrumbs.querySelectorAll(".breadcrumb-link").forEach((button) => {
      button.addEventListener("click", () => {
        const folderId = button.dataset.folderId;
        if (folderId) openFolder(folderId);
      });
    });
  }

  function getNotesForFolder(folderId) {
    return readFolderResource(folderId, "notes");
  }

  function saveNotesForFolder(folderId, notes) {
    writeFolderResource(folderId, "notes", notes);
  }

  function getFilesForFolder(folderId) {
    return readFolderResource(folderId, "files")
      .map((entry) => window.Notepilot.FileTools.normalizeFileEntry(entry));
  }

  function saveFilesForFolder(folderId, files) {
    writeFolderResource(folderId, "files", files);
  }

  function openFolder(folderId) {
    if (!folderId) return;
    state.activeFolderId = folderId;
    if (elements.folderTitle) {
      elements.folderTitle.textContent = formatFolderTitle(folderId);
    }
    transitionViews({ showDashboard: false, showFolder: true });
    document.dispatchEvent(new CustomEvent("notepilot:folder-open", { detail: { folderId } }));
    renderFolderData();
  }

  function closeFolder() {
    closeFilePreview();
    state.activeFolderId = "";
    transitionViews({ showDashboard: true, showFolder: false });
    document.dispatchEvent(new CustomEvent("notepilot:folder-close"));
  }

  function isFolderOpen() {
    return !elements.folderView?.classList.contains("hidden");
  }

  function transitionViews({ showDashboard, showFolder }) {
    if (showDashboard) {
      elements.dashboardView.classList.remove("hidden");
      animateViewIn(elements.dashboardView);
    } else {
      elements.dashboardView.classList.add("hidden");
    }
    if (showFolder) {
      elements.folderView.classList.remove("hidden");
      animateViewIn(elements.folderView);
    } else {
      elements.folderView.classList.add("hidden");
    }
  }

  function animateViewIn(element) {
    if (!element) return;
    element.classList.remove("view-enter");
    requestAnimationFrame(() => {
      element.classList.add("view-enter");
    });
  }

  function handleAddNote() {
    if (!state.activeFolderId) return;
    const note = prompt("Write your note");
    if (note === null) return;
    const trimmed = note.trim();
    if (!trimmed) return;
    const notes = getNotesForFolder(state.activeFolderId);
    notes.push(trimmed);
    saveNotesForFolder(state.activeFolderId, notes);
    renderNotes(notes);
  }

  function editNote(index) {
    if (!state.activeFolderId) return;
    const notes = getNotesForFolder(state.activeFolderId);
    if (!notes[index]) return;
    const updated = prompt("Edit note", notes[index]);
    if (updated === null) return;
    const trimmed = updated.trim();
    if (!trimmed) {
      const shouldDelete = confirm("Note is empty. Delete it?");
      if (shouldDelete) {
        deleteNote(index);
      }
      return;
    }
    notes[index] = trimmed;
    saveNotesForFolder(state.activeFolderId, notes);
    renderNotes(notes);
  }

  function deleteNote(index, noteElement) {
    if (!state.activeFolderId || index < 0) return;
    const notes = getNotesForFolder(state.activeFolderId);
    if (!notes[index]) return;
    const shouldDelete = confirm("Delete this note?");
    if (!shouldDelete) return;
    notes.splice(index, 1);
    saveNotesForFolder(state.activeFolderId, notes);
    if (noteElement) {
      noteElement.classList.add("removing");
      setTimeout(() => {
        renderNotes(notes);
      }, 220);
      return;
    }
    renderNotes(notes);
  }

  async function handleFileInputChange() {
    if (!state.activeFolderId || !elements.fileInput) return;
    const file = elements.fileInput.files[0];
    if (!file) return;
    await handleFileUpload(file);
    elements.fileInput.value = "";
  }

  async function handleChooseFile() {
    if (!state.activeFolderId) return;
    if (window.showOpenFilePicker) {
      try {
        const [handle] = await window.showOpenFilePicker({
          multiple: false,
          types: [
            {
              description: "Supported files",
              accept: {
                "image/*": [".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"],
                "application/pdf": [".pdf"],
                "text/plain": [".txt"],
                "application/msword": [".doc"],
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
                "application/rtf": [".rtf"]
              }
            }
          ]
        });
        const file = await handle.getFile();
        if (file) {
          await handleFileUpload(file);
        }
        return;
      } catch (error) {
        if (error.name !== "AbortError") {
          console.warn("Safe file picker failed:", error);
        }
      }
    }
    if (elements.fileInput) {
      elements.fileInput.click();
    }
  }

  async function handleFileUpload(file) {
    if (!state.activeFolderId || !file) return;
    const files = getFilesForFolder(state.activeFolderId);
    const id = `file-${Math.random().toString(36).slice(2)}-${Date.now()}`;
    const fileKey = `notepilot:file:${window.Notepilot.Auth.ACTIVE_USER_SLUG}:${state.activeFolderId}:${id}`;
    const previewDataUrl = await window.Notepilot.FileTools.getFilePreviewDataUrl(file);
    const fallbackTextData = await window.Notepilot.FileTools.getFileTextFallback(file);
    const entry = {
      id,
      fileKey,
      name: file.name,
      type: file.type || "",
      size: file.size || 0,
      extension: window.Notepilot.FileTools.getFileExtension(file.name),
      uploadedAt: Date.now(),
      folderId: state.activeFolderId,
      previewDataUrl,
      textData: fallbackTextData || ""
    };
    let storedData = false;
    try {
      const fileData = await window.Notepilot.FileTools.getFileBinaryData(file);
      if (!fileData) {
        throw new Error("File binary data could not be read.");
      }
      await window.Notepilot.FileDatabase.saveFileData(fileKey, {
        name: file.name,
        type: file.type || "",
        size: file.size || 0,
        uploadedAt: entry.uploadedAt,
        folderId: state.activeFolderId,
        data: fileData
      });
      storedData = true;
    } catch (error) {
      console.warn("Unable to persist file data:", error);
    }
    if (!storedData) {
      entry.previewDataUrl = entry.previewDataUrl || "";
      entry.textData = entry.textData || "";
    }
    files.push(entry);
    saveFilesForFolder(state.activeFolderId, files);
    renderFiles(files);
  }

  async function deleteFile(index) {
    if (!state.activeFolderId || index < 0) return;
    const files = getFilesForFolder(state.activeFolderId);
    const file = files[index];
    if (!file) return;
    const shouldDelete = confirm(`Delete "${file.name}" from ${formatFolderTitle(state.activeFolderId)}?`);
    if (!shouldDelete) return;
    files.splice(index, 1);
    saveFilesForFolder(state.activeFolderId, files);
    if (file.fileKey) {
      window.Notepilot.FileDatabase.deleteFileData(file.fileKey).catch(() => {});
    }
    renderFiles(files);
  }

  function renderFolderData() {
    if (!state.activeFolderId) return;
    const notes = getNotesForFolder(state.activeFolderId);
    const files = getFilesForFolder(state.activeFolderId);
    renderNotes(notes);
    renderFiles(files);
    renderSubfolders(state.activeFolderId);
    updateBreadcrumbs();
  }

  function renderNotes(notes) {
    if (!elements.notesList) return;
    elements.notesList.innerHTML = "";
    if (!notes || !notes.length) {
      elements.notesList.innerHTML = '<div class="note-item empty-state">No notes in this folder yet.</div>';
      return;
    }
    notes.forEach((note, index) => {
      const item = document.createElement("div");
      item.className = "note-item";
      item.innerHTML = `
        <p class="note-text">${window.Notepilot.utils.escapeText(note)}</p>
        <div class="note-actions">
          <button class="note-edit-btn" type="button" data-note-action="edit" data-index="${index}">Edit</button>
          <button class="note-delete-btn" type="button" data-note-action="delete" data-index="${index}">Delete</button>
        </div>
      `;
      elements.notesList.appendChild(item);
    });
  }

  function renderFiles(files) {
    if (!elements.filesList) return;
    elements.filesList.innerHTML = "";
    if (!files || !files.length) {
      elements.filesList.innerHTML = '<div class="file-item empty-state">No files in this folder yet.</div>';
      return;
    }
    files.forEach((file, index) => {
      const item = document.createElement("div");
      item.className = "file-item";
      item.innerHTML = `
        <div class="file-card" data-index="${index}" role="button" tabindex="0">
          <div class="file-preview ${file.previewDataUrl ? "has-preview" : ""}">
            ${
              file.previewDataUrl
                ? `<img src="${file.previewDataUrl}" alt="${window.Notepilot.utils.escapeText(file.name)}" class="file-preview-image">`
                : `<div class="file-icon" aria-hidden="true">${window.Notepilot.utils.getFileIconSvg(file.extension)}</div>`
            }
            <button class="file-delete-btn" type="button" data-index="${index}" aria-label="Delete ${window.Notepilot.utils.escapeText(file.name)}">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M6 7h12M9 7V5h6v2m-7 3v7m4-7v7m4-7v7M8 20h8a1 1 0 0 0 1-1V7H7v12a1 1 0 0 0 1 1z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
          </div>
          <div class="file-meta">
            <p class="file-name" title="${window.Notepilot.utils.escapeText(file.name)}">${window.Notepilot.utils.escapeText(file.name)}</p>
            <p class="file-subtext">${window.Notepilot.FileTools.formatFileLabel(file)}</p>
          </div>
        </div>
      `;
      elements.filesList.appendChild(item);
    });
  }

  function formatFolderTitle(folderId) {
    const folder = getFolderById(folderId);
    return folder ? folder.name : "Folder";
  }

  function handleFilesListClick(event) {
    const deleteBtn = event.target.closest(".file-delete-btn");
    if (deleteBtn) {
      const index = Number(deleteBtn.dataset.index);
      if (!Number.isNaN(index)) {
        deleteFile(index);
      }
      return;
    }
    const card = event.target.closest(".file-card");
    if (!card) return;
    const index = Number(card.dataset.index);
    if (Number.isNaN(index)) return;
    openFileAtIndex(index);
  }

  function openFileAtIndex(index) {
    const files = getFilesForFolder(state.activeFolderId);
    if (!files[index]) return;
    openFile(files[index]);
  }

  async function openFile(fileEntry) {
    if (!elements.previewModal || !elements.previewContent) return;
    showPreviewModal(true);
    setPreviewLoading(true);
    if (elements.previewTitle) {
      elements.previewTitle.textContent = fileEntry.name || "Preview";
    }
    if (elements.previewSubtitle) {
      elements.previewSubtitle.textContent = window.Notepilot.FileTools.formatFileLabel(fileEntry);
    }
    if (elements.previewError) {
      elements.previewError.classList.add("hidden");
      elements.previewError.textContent = "";
    }
    elements.previewContent.innerHTML = "";
    const blob = await window.Notepilot.FileTools.getStoredFileBlob(fileEntry.fileKey);
    const isImage = fileEntry.type.startsWith("image/") || ["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(fileEntry.extension);
    const isPdf = fileEntry.type === "application/pdf" || fileEntry.extension === "pdf";
    const isText = fileEntry.type.startsWith("text/") || ["txt", "md", "json", "csv", "html", "css", "js"].includes(fileEntry.extension);
    if (blob) {
      const url = URL.createObjectURL(blob);
      if (isImage) {
        elements.previewContent.innerHTML = `<img src="${url}" alt="${window.Notepilot.utils.escapeText(fileEntry.name)}">`;
      } else if (isPdf) {
        elements.previewContent.innerHTML = `
          <div class="preview-file-actions">
            <p>PDF preview is available in a new browser tab.</p>
            <a href="${url}" target="_blank" rel="noopener" class="preview-open-link">Open PDF in new tab</a>
            <a href="${url}" download="${window.Notepilot.utils.escapeText(fileEntry.name)}" class="preview-download-link">Download PDF</a>
          </div>
        `;
      } else if (isText) {
        const text = await blob.text();
        elements.previewContent.innerHTML = `<pre>${window.Notepilot.utils.escapeText(text)}</pre>`;
        URL.revokeObjectURL(url);
        setPreviewLoading(false);
        return;
      } else {
        elements.previewContent.innerHTML = `
          <div class="preview-fallback">
            <p>Preview unavailable for this file type.</p>
            <a href="${url}" download="${window.Notepilot.utils.escapeText(fileEntry.name)}" class="preview-download-link">Download file</a>
          </div>
        `;
      }
      setPreviewLoading(false);
      return;
    }
    if (isImage && fileEntry.previewDataUrl) {
      elements.previewContent.innerHTML = `<img src="${fileEntry.previewDataUrl}" alt="${window.Notepilot.utils.escapeText(fileEntry.name)}">`;
      setPreviewLoading(false);
      return;
    }
    if (isText && fileEntry.textData) {
      elements.previewContent.innerHTML = `<pre>${window.Notepilot.utils.escapeText(fileEntry.textData)}</pre>`;
      setPreviewLoading(false);
      return;
    }
    setPreviewLoading(false);
    if (elements.previewError) {
      elements.previewError.textContent = "Unable to open this file safely. The file content is not available.";
      elements.previewError.classList.remove("hidden");
    }
  }

  function setPreviewLoading(isLoading) {
    if (!elements.previewLoader) return;
    elements.previewLoader.classList.toggle("hidden", !isLoading);
  }

  function showPreviewModal(show) {
    if (!elements.previewModal) return;
    elements.previewModal.classList.toggle("hidden", !show);
    elements.previewModal.setAttribute("aria-hidden", String(!show));
    if (show && elements.previewContent) {
      elements.previewContent.scrollTop = 0;
    }
  }

  function closeFilePreview() {
    if (!elements.previewModal) return;
    if (elements.previewContent) {
      const image = elements.previewContent.querySelector("img");
      const iframe = elements.previewContent.querySelector("iframe");
      const links = elements.previewContent.querySelectorAll("a");
      [image, iframe, ...links].forEach((media) => {
        if (!media) return;
        const url = media.src || media.href;
        if (url && url.startsWith("blob:")) {
          URL.revokeObjectURL(url);
        }
      });
      elements.previewContent.innerHTML = "";
    }
    showPreviewModal(false);
  }

  return {
    init,
    closeFolder,
    isFolderOpen
  };
})();

window.Notepilot.registerModule(window.Notepilot.FolderSystem.init);
