console.log("SCRIPT WORKING");
/* ---------------- USERNAME ---------------- */

const AUTH_SESSION_KEY =
  "notepilot:auth:active-user:v1";

const LEGACY_USERNAME_KEY =
  "username";

function getActiveUser() {

  return localStorage.getItem(AUTH_SESSION_KEY);

}

function requireAuthSession() {

  const activeUser =
    getActiveUser();

  if(!activeUser) {

    window.location.href =
      "login.html";

    return null;

  }

  localStorage.setItem(
    LEGACY_USERNAME_KEY,
    activeUser
  );

  return activeUser;

}

const savedUsername =
  requireAuthSession();

const ACTIVE_USER_SLUG =
  (savedUsername || "guest")
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "_");

function getUserScopedKey(baseKey) {

  return `notepilot:user:${ACTIVE_USER_SLUG}:${baseKey}`;

}

function safeParseStoredArray(value) {

  try {
    const parsed =
      JSON.parse(value || "[]");

    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }

}

const welcomeText =
  document.getElementById("welcomeText");

if(savedUsername && welcomeText) {

  welcomeText.textContent =
    `Welcome, ${savedUsername}`;

}

/* ---------------- TODO SYSTEM ---------------- */

const addTaskBtn =
  document.getElementById("addTaskBtn");

const taskInput =
  document.getElementById("taskInput");

const taskList =
  document.getElementById("taskList");

const TASKS_STORAGE_KEY =
  getUserScopedKey("tasks");

const LEGACY_TASKS_STORAGE_KEY =
  "tasks";

const storedTasksRaw =
  localStorage.getItem(TASKS_STORAGE_KEY) ??
  localStorage.getItem(LEGACY_TASKS_STORAGE_KEY);

let tasks =
  safeParseStoredArray(storedTasksRaw);

if(
  localStorage.getItem(TASKS_STORAGE_KEY) === null &&
  localStorage.getItem(LEGACY_TASKS_STORAGE_KEY) !== null
) {
  localStorage.setItem(
    TASKS_STORAGE_KEY,
    JSON.stringify(tasks)
  );
}

/* LOAD TASKS */

function loadTasks() {

  if(!taskList) return;

  taskList.innerHTML = "";

  tasks.forEach((taskObj, index) => {

    const li =
      document.createElement("li");

    li.classList.add("task-item");

    if(taskObj.completed) {

      li.classList.add("completed");

    }

    li.innerHTML = `

      <div class="task-left">

        <input
          type="checkbox"
          ${taskObj.completed ? "checked" : ""}
          onchange="toggleTask(${index})">

        <span>${taskObj.text}</span>

      </div>

      <button onclick="deleteTask(${index})">
        Delete
      </button>
    `;

    taskList.appendChild(li);

  });

}

/* ADD TASK */

if(addTaskBtn) {

  addTaskBtn.addEventListener("click", () => {

    const taskText =
      taskInput.value;

    if(taskText === "") return;

    tasks.push({
      text: taskText,
      completed: false
    });

    localStorage.setItem(
      TASKS_STORAGE_KEY,
      JSON.stringify(tasks)
    );

    loadTasks();

    taskInput.value = "";

  });

}

/* TOGGLE TASK */

function toggleTask(index) {

  tasks[index].completed =
    !tasks[index].completed;

  localStorage.setItem(
    TASKS_STORAGE_KEY,
    JSON.stringify(tasks)
  );

  loadTasks();

}

/* DELETE TASK */

function deleteTask(index) {

  tasks.splice(index, 1);

  localStorage.setItem(
    TASKS_STORAGE_KEY,
    JSON.stringify(tasks)
  );

  loadTasks();

}

/* INITIAL TASK LOAD */

loadTasks();

/* ---------------- NOTES ---------------- */

const notesArea =
  document.getElementById("notesArea");

const prevPageBtn =
  document.getElementById("prevPageBtn");

const nextPageBtn =
  document.getElementById("nextPageBtn");

const newPageBtn =
  document.getElementById("newPageBtn");

const deletePageBtn =
  document.getElementById("deletePageBtn");

const notesPageIndicator =
  document.getElementById("notesPageIndicator");

const NOTEBOOK_PAGES_KEY =
  getUserScopedKey("notebook:pages");

const NOTEBOOK_CURRENT_PAGE_KEY =
  getUserScopedKey("notebook:current-page");

const LEGACY_NOTEBOOK_PAGES_KEY =
  "notepilot:notebook:pages";

const LEGACY_NOTEBOOK_CURRENT_PAGE_KEY =
  "notepilot:notebook:current-page";

const notebookState = {
  pages: [""],
  currentPage: 0
};

function loadNotebookState() {

  const savedPagesRaw =
    localStorage.getItem(NOTEBOOK_PAGES_KEY) ??
    localStorage.getItem(LEGACY_NOTEBOOK_PAGES_KEY);

  const savedPageIndexRaw =
    localStorage.getItem(NOTEBOOK_CURRENT_PAGE_KEY) ??
    localStorage.getItem(LEGACY_NOTEBOOK_CURRENT_PAGE_KEY);

  try {
    const parsedPages =
      JSON.parse(savedPagesRaw || "[]");

    if(Array.isArray(parsedPages) && parsedPages.length) {
      notebookState.pages =
        parsedPages.map((page) => String(page));
    }
  } catch {
    notebookState.pages = [""];
  }

  if(
    (!savedPagesRaw || notebookState.pages.length === 1 && notebookState.pages[0] === "") &&
    localStorage.getItem("notes")
  ) {
    notebookState.pages[0] =
      localStorage.getItem("notes") || "";
  }

  const parsedIndex =
    Number(savedPageIndexRaw);

  if(Number.isInteger(parsedIndex) && parsedIndex >= 0) {
    notebookState.currentPage =
      Math.min(parsedIndex, notebookState.pages.length - 1);
  }

  if(
    localStorage.getItem(NOTEBOOK_PAGES_KEY) === null &&
    savedPagesRaw
  ) {
    localStorage.setItem(
      NOTEBOOK_PAGES_KEY,
      JSON.stringify(notebookState.pages)
    );
  }

  if(
    localStorage.getItem(NOTEBOOK_CURRENT_PAGE_KEY) === null &&
    savedPageIndexRaw !== null
  ) {
    localStorage.setItem(
      NOTEBOOK_CURRENT_PAGE_KEY,
      String(notebookState.currentPage)
    );
  }

}

function saveNotebookState() {

  localStorage.setItem(
    NOTEBOOK_PAGES_KEY,
    JSON.stringify(notebookState.pages)
  );

  localStorage.setItem(
    NOTEBOOK_CURRENT_PAGE_KEY,
    String(notebookState.currentPage)
  );

}

function updateNotebookControls() {

  if(!notesPageIndicator) return;

  notesPageIndicator.textContent =
    `Page ${notebookState.currentPage + 1} / ${notebookState.pages.length}`;

  if(prevPageBtn) {
    prevPageBtn.disabled =
      notebookState.currentPage === 0;
  }

  if(nextPageBtn) {
    nextPageBtn.disabled =
      notebookState.currentPage >= notebookState.pages.length - 1;
  }

  if(deletePageBtn) {
    deletePageBtn.disabled =
      notebookState.pages.length <= 1;
  }

}

function renderCurrentNotebookPage(animate = false) {

  if(!notesArea) return;

  if(animate) {
    notesArea.classList.remove("page-switch");
    requestAnimationFrame(() => {
      notesArea.classList.add("page-switch");
    });
  }

  notesArea.value =
    notebookState.pages[notebookState.currentPage] || "";

  updateNotebookControls();

}

function changeNotebookPage(nextIndex) {

  if(nextIndex < 0 || nextIndex >= notebookState.pages.length) return;

  notebookState.currentPage = nextIndex;

  saveNotebookState();

  renderCurrentNotebookPage(true);

}

function createNotebookPage() {

  notebookState.pages.push("");

  notebookState.currentPage =
    notebookState.pages.length - 1;

  saveNotebookState();

  renderCurrentNotebookPage(true);

  if(notesArea) {
    notesArea.focus();
  }

}

function deleteCurrentNotebookPage() {

  if(notebookState.pages.length <= 1) {
    return;
  }

  const shouldDelete =
    confirm(`Delete Page ${notebookState.currentPage + 1}?`);

  if(!shouldDelete) return;

  notebookState.pages.splice(
    notebookState.currentPage,
    1
  );

  if(notebookState.currentPage >= notebookState.pages.length) {
    notebookState.currentPage =
      notebookState.pages.length - 1;
  }

  saveNotebookState();

  if(notesArea) {
    notesArea.classList.remove("page-delete-switch");
    requestAnimationFrame(() => {
      notesArea.classList.add("page-delete-switch");
    });
  }

  renderCurrentNotebookPage(true);

  if(notesArea) {
    notesArea.focus();
  }

}

if(notesArea) {

  loadNotebookState();

  renderCurrentNotebookPage();

  notesArea.addEventListener("input", () => {

    notebookState.pages[notebookState.currentPage] =
      notesArea.value;

    saveNotebookState();

  });

  if(prevPageBtn) {
    prevPageBtn.addEventListener("click", () => {
      changeNotebookPage(notebookState.currentPage - 1);
    });
  }

  if(nextPageBtn) {
    nextPageBtn.addEventListener("click", () => {
      changeNotebookPage(notebookState.currentPage + 1);
    });
  }

  if(newPageBtn) {
    newPageBtn.addEventListener("click", createNotebookPage);
  }

  if(deletePageBtn) {
    deletePageBtn.addEventListener("click", deleteCurrentNotebookPage);
  }

}

/* ---------------- LOGOUT ---------------- */

const logoutBtn =
  document.getElementById("logoutBtn");

if(logoutBtn) {

  logoutBtn.addEventListener("click", (event) => {

    event.preventDefault();

    localStorage.removeItem(
      AUTH_SESSION_KEY
    );

    window.location.href =
      "login.html";

  });

}

/* ---------------- FOLDER VIEW ---------------- */

const FolderSystem = (() => {

  const elements = {
    dashboardView: document.getElementById("dashboardView"),
    folderView: document.getElementById("folderView"),
    folderGrid: document.querySelector(".folders-grid"),
    folderTitle: document.getElementById("folderTitle"),
    backBtn: document.getElementById("backBtn"),
    addNoteBtn: document.getElementById("addNoteBtn"),
    notesList: document.getElementById("notesList"),
    addFileBtn: document.getElementById("addFileBtn"),
    fileInput: document.getElementById("fileInput"),
    filesList: document.getElementById("filesList")
  };

  const state = {
    activeFolderId: ""
  };

  const STORAGE_PREFIX =
    `notepilot:folder:v3:${ACTIVE_USER_SLUG}`;

  function init() {

    if(!elements.dashboardView || !elements.folderView || !elements.folderGrid) {
      return;
    }

    bindEvents();

  }

  function bindEvents() {

    elements.folderGrid.addEventListener("click", (event) => {

      const card =
        event.target.closest(".folder-card");

      if(!card) return;

      const folderId =
        normalizeFolderId(card.dataset.folder);

      openFolder(folderId);

    });

    if(elements.backBtn) {
      elements.backBtn.addEventListener("click", closeFolder);
    }

    if(elements.addNoteBtn) {
      elements.addNoteBtn.addEventListener("click", handleAddNote);
    }

    if(elements.addFileBtn) {
      elements.addFileBtn.addEventListener("click", () => {
        if(elements.fileInput) {
          elements.fileInput.click();
        }
      });
    }

    if(elements.fileInput) {
      elements.fileInput.addEventListener("change", handleFileInputChange);
    }

    if(elements.notesList) {
      elements.notesList.addEventListener("click", (event) => {

        const actionButton =
          event.target.closest("[data-note-action]");

        if(!actionButton) return;

        const index =
          Number(actionButton.dataset.index);

        if(Number.isNaN(index)) return;

        const action =
          actionButton.dataset.noteAction;

        if(action === "edit") {
          editNote(index);
          return;
        }

        if(action === "delete") {
          deleteNote(index, actionButton.closest(".note-item"));
        }

      });
    }

    if(elements.filesList) {
      elements.filesList.addEventListener("click", (event) => {

        const deleteBtn =
          event.target.closest(".file-delete-btn");

        if(!deleteBtn) return;

        const index =
          Number(deleteBtn.dataset.index);

        if(Number.isNaN(index)) return;

        deleteFile(index);

      });
    }

  }

  function normalizeFolderId(folderName) {

    return (folderName || "")
      .toString()
      .trim()
      .toLowerCase();

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

    const key =
      getStorageKey(folderId, resourceType);

    const namespacedValue =
      localStorage.getItem(key);

    if(namespacedValue !== null) {
      return safeParseArray(namespacedValue);
    }

    const legacyKeys =
      getLegacyStorageKeys(folderId, resourceType);

    for(const legacyKey of legacyKeys) {

      const legacyValue =
        localStorage.getItem(legacyKey);

      if(legacyValue === null) continue;

      const parsedLegacy =
        safeParseArray(legacyValue);

      localStorage.setItem(
        key,
        JSON.stringify(parsedLegacy)
      );

      return parsedLegacy;

    }

    return [];

  }

  function writeFolderResource(folderId, resourceType, data) {

    localStorage.setItem(
      getStorageKey(folderId, resourceType),
      JSON.stringify(data)
    );

  }

  function getNotesForFolder(folderId) {

    return readFolderResource(folderId, "notes")
      .map((entry) => String(entry).trim())
      .filter(Boolean);

  }

  function saveNotesForFolder(folderId, notes) {

    writeFolderResource(
      folderId,
      "notes",
      notes
    );

  }

  function getFilesForFolder(folderId) {

    return readFolderResource(folderId, "files")
      .map((entry) => normalizeFileEntry(entry));

  }

  function saveFilesForFolder(folderId, files) {

    writeFolderResource(
      folderId,
      "files",
      files
    );

  }

  function openFolder(folderId) {

    if(!folderId) return;

    state.activeFolderId = folderId;

    if(elements.folderTitle) {
      elements.folderTitle.textContent = formatFolderTitle(folderId);
    }

    transitionViews({
      showDashboard: false,
      showFolder: true
    });

    document.dispatchEvent(
      new CustomEvent("notepilot:folder-open", {
        detail: { folderId }
      })
    );

    renderFolderData();

  }

  function closeFolder() {

    state.activeFolderId = "";

    transitionViews({
      showDashboard: true,
      showFolder: false
    });

    document.dispatchEvent(
      new CustomEvent("notepilot:folder-close")
    );

  }

  function isFolderOpen() {

    return !elements.folderView?.classList.contains("hidden");

  }

  function transitionViews({ showDashboard, showFolder }) {

    if(showDashboard) {
      elements.dashboardView.classList.remove("hidden");
      animateViewIn(elements.dashboardView);
    } else {
      elements.dashboardView.classList.add("hidden");
    }

    if(showFolder) {
      elements.folderView.classList.remove("hidden");
      animateViewIn(elements.folderView);
    } else {
      elements.folderView.classList.add("hidden");
    }

  }

  function animateViewIn(element) {

    if(!element) return;

    element.classList.remove("view-enter");

    requestAnimationFrame(() => {
      element.classList.add("view-enter");
    });

  }

  function formatFolderTitle(folderId) {

    return folderId
      .split("-")
      .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
      .join(" ");

  }

  function handleAddNote() {

    if(!state.activeFolderId) return;

    const note =
      prompt("Write your note");

    if(note === null) return;

    const trimmed =
      note.trim();

    if(!trimmed) return;

    const notes =
      getNotesForFolder(state.activeFolderId);

    notes.push(trimmed);

    saveNotesForFolder(state.activeFolderId, notes);

    renderNotes(notes);

  }

  function editNote(index) {

    if(!state.activeFolderId) return;

    const notes =
      getNotesForFolder(state.activeFolderId);

    if(!notes[index]) return;

    const updated =
      prompt("Edit note", notes[index]);

    if(updated === null) return;

    const trimmed =
      updated.trim();

    if(!trimmed) {
      const shouldDelete = confirm("Note is empty. Delete it?");
      if(shouldDelete) {
        deleteNote(index);
      }
      return;
    }

    notes[index] = trimmed;

    saveNotesForFolder(state.activeFolderId, notes);

    renderNotes(notes);

  }

  function deleteNote(index, noteElement) {

    if(!state.activeFolderId || index < 0) return;

    const notes =
      getNotesForFolder(state.activeFolderId);

    if(!notes[index]) return;

    const shouldDelete =
      confirm("Delete this note?");

    if(!shouldDelete) return;

    notes.splice(index, 1);

    saveNotesForFolder(state.activeFolderId, notes);

    if(noteElement) {
      noteElement.classList.add("removing");
      setTimeout(() => {
        renderNotes(notes);
      }, 220);
      return;
    }

    renderNotes(notes);

  }

  async function handleFileInputChange() {

    if(!state.activeFolderId || !elements.fileInput) return;

    const file =
      elements.fileInput.files[0];

    if(!file) return;

    const files =
      getFilesForFolder(state.activeFolderId);

    const previewDataUrl =
      await getFilePreviewDataUrl(file);

    files.push({
      name: file.name,
      type: file.type || "",
      size: file.size || 0,
      extension: getFileExtension(file.name),
      uploadedAt: Date.now(),
      previewDataUrl: previewDataUrl || ""
    });

    saveFilesForFolder(state.activeFolderId, files);

    elements.fileInput.value = "";

    renderFiles(files);

  }

  function deleteFile(index) {

    if(!state.activeFolderId || index < 0) return;

    const files =
      getFilesForFolder(state.activeFolderId);

    if(!files[index]) return;

    const shouldDelete =
      confirm(`Delete "${files[index].name}" from ${formatFolderTitle(state.activeFolderId)}?`);

    if(!shouldDelete) return;

    files.splice(index, 1);

    saveFilesForFolder(state.activeFolderId, files);

    renderFiles(files);

  }

  function renderFolderData() {

    if(!state.activeFolderId) return;

    const notes =
      getNotesForFolder(state.activeFolderId);

    const files =
      getFilesForFolder(state.activeFolderId);

    renderNotes(notes);
    renderFiles(files);

  }

  function renderNotes(notes) {

    if(!elements.notesList) return;

    elements.notesList.innerHTML = "";

    if(!notes.length) {
      elements.notesList.innerHTML = '<div class="note-item empty-state">No notes in this folder yet.</div>';
      return;
    }

    notes.forEach((note, index) => {

      const item =
        document.createElement("div");

      item.className = "note-item";

      item.innerHTML = `
        <p class="note-text">${escapeText(note)}</p>
        <div class="note-actions">
          <button class="note-edit-btn" type="button" data-note-action="edit" data-index="${index}">Edit</button>
          <button class="note-delete-btn" type="button" data-note-action="delete" data-index="${index}">Delete</button>
        </div>
      `;

      elements.notesList.appendChild(item);

    });

  }

  function renderFiles(files) {

    if(!elements.filesList) return;

    elements.filesList.innerHTML = "";

    if(!files.length) {
      elements.filesList.innerHTML = '<div class="file-item empty-state">No files in this folder yet.</div>';
      return;
    }

    files.forEach((file, index) => {

      const item =
        document.createElement("div");

      item.className = "file-item";

      item.innerHTML = `
        <div class="file-card">
          <div class="file-preview ${file.previewDataUrl ? "has-preview" : ""}">
            ${
              file.previewDataUrl
                ? `<img src="${file.previewDataUrl}" alt="${escapeText(file.name)}" class="file-preview-image">`
                : `<div class="file-icon" aria-hidden="true">${getFileIconSvg(file.extension)}</div>`
            }
            <button class="file-delete-btn" type="button" data-index="${index}" aria-label="Delete ${escapeText(file.name)}">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M6 7h12M9 7V5h6v2m-7 3v7m4-7v7m4-7v7M8 20h8a1 1 0 0 0 1-1V7H7v12a1 1 0 0 0 1 1z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
          </div>
          <div class="file-meta">
            <p class="file-name" title="${escapeText(file.name)}">${escapeText(file.name)}</p>
            <p class="file-subtext">${formatFileLabel(file)}</p>
          </div>
        </div>
      `;

      elements.filesList.appendChild(item);

    });

  }

  function normalizeFileEntry(entry) {

    if(typeof entry === "string") {
      return {
        name: entry,
        type: "",
        size: 0,
        extension: getFileExtension(entry),
        uploadedAt: Date.now(),
        previewDataUrl: ""
      };
    }

    return {
      name: entry.name || "Untitled file",
      type: entry.type || "",
      size: Number(entry.size) || 0,
      extension: entry.extension || getFileExtension(entry.name || ""),
      uploadedAt: entry.uploadedAt || Date.now(),
      previewDataUrl: entry.previewDataUrl || ""
    };

  }

  function getFilePreviewDataUrl(file) {

    if(!file || !file.type || !file.type.startsWith("image/")) {
      return Promise.resolve("");
    }

    if(file.size > 2 * 1024 * 1024) {
      return Promise.resolve("");
    }

    return new Promise((resolve) => {

      const reader =
        new FileReader();

      reader.onload = () =>
        resolve(typeof reader.result === "string" ? reader.result : "");

      reader.onerror = () =>
        resolve("");

      reader.readAsDataURL(file);

    });

  }

  function getFileExtension(fileName) {

    const parts =
      fileName.split(".");

    if(parts.length < 2) return "";

    return parts.pop().toLowerCase();

  }

  function formatFileLabel(file) {

    const extension =
      file.extension ? file.extension.toUpperCase() : "FILE";

    if(!file.size) {
      return extension;
    }

    return `${extension} - ${formatBytes(file.size)}`;

  }

  function formatBytes(bytes) {

    if(bytes < 1024) return `${bytes} B`;
    if(bytes < 1024 * 1024) return `${Math.round(bytes / 102.4) / 10} KB`;

    return `${Math.round(bytes / (1024 * 102.4)) / 10} MB`;

  }

  function getFileIconSvg(extension) {

    if(["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(extension)) {
      return `
        <svg viewBox="0 0 24 24">
          <path d="M4 5a2 2 0 0 1 2-2h8l6 6v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5zm12-2v6h6M8 16l2.5-2.5L13 16l2-2 2 2.5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      `;
    }

    if(["pdf"].includes(extension)) {
      return `
        <svg viewBox="0 0 24 24">
          <path d="M4 5a2 2 0 0 1 2-2h8l6 6v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5zm12-2v6h6M8 17h8M8 13h6" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      `;
    }

    if(["doc", "docx", "txt", "rtf"].includes(extension)) {
      return `
        <svg viewBox="0 0 24 24">
          <path d="M4 5a2 2 0 0 1 2-2h8l6 6v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5zm12-2v6h6M8 12h8M8 16h8" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      `;
    }

    if(["zip", "rar", "7z"].includes(extension)) {
      return `
        <svg viewBox="0 0 24 24">
          <path d="M4 5a2 2 0 0 1 2-2h8l6 6v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5zm12-2v6h6M11 10h2v2h-2zm0 3h2v2h-2zm0 3h2v2h-2z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      `;
    }

    return `
      <svg viewBox="0 0 24 24">
        <path d="M4 5a2 2 0 0 1 2-2h8l6 6v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5zm12-2v6h6" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `;

  }

  function escapeText(text) {

    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  }

  return {
    init,
    closeFolder,
    isFolderOpen
  };

})();

FolderSystem.init();
/* ---------------- APP NAVIGATION SYSTEM ---------------- */

const NavigationSystem = (() => {

  const elements = {
    sidebar: document.getElementById("sidebar"),
    sidebarToggle: document.getElementById("sidebarToggle"),
    sidebarNav: document.getElementById("sidebarNav"),
    mainContent: document.querySelector(".main-content"),
    dashboardHeader: document.querySelector(".dashboard-header"),
    dashboardView: document.getElementById("dashboardView"),
    folderView: document.getElementById("folderView"),
    filesSection: document.getElementById("filesSection"),
    sections: {
      dashboard: document.getElementById("dashboardView"),
      files: document.getElementById("filesSection"),
      tasks: document.getElementById("tasksSection"),
      notes: document.getElementById("notesSection"),
      ai: document.getElementById("aiSection")
    }
  };

  let activeTarget = "dashboard";

  function init() {

    if(!elements.sidebar || !elements.sidebarNav || !elements.mainContent) {
      return;
    }

    bindEvents();
    updateActiveItem(activeTarget);

  }

  function bindEvents() {

    elements.sidebarNav.addEventListener("click", handleSidebarClick);

    if(elements.sidebarToggle) {
      elements.sidebarToggle.addEventListener("click", handleSidebarToggle);
    }

    document.addEventListener("click", handleOutsideSidebarClick);
    window.addEventListener("resize", handleResize);
    elements.mainContent.addEventListener("scroll", handleMainScroll, { passive: true });

    document.addEventListener("notepilot:folder-open", () => {
      activeTarget = "files";
      updateActiveItem(activeTarget);
    });

    document.addEventListener("notepilot:folder-close", () => {
      activeTarget = "dashboard";
      updateActiveItem(activeTarget);
    });

  }

  function handleSidebarClick(event) {

    const navItem =
      event.target.closest(".nav-item");

    if(!navItem || !elements.sidebarNav.contains(navItem)) return;

    const target =
      navItem.dataset.navTarget;

    if(!target || target === "logout") {
      return;
    }

    event.preventDefault();

    if(FolderSystem.isFolderOpen() && target !== "files") {
      FolderSystem.closeFolder();
    }

    activeTarget = target;
    updateActiveItem(target);
    scrollToSection(target);
    closeMobileSidebar();

  }

  function handleSidebarToggle(event) {

    event.stopPropagation();

    if(window.innerWidth <= 980) {
      elements.sidebar.classList.toggle("open");
      return;
    }

    elements.sidebar.classList.toggle("collapsed");

  }

  function handleOutsideSidebarClick(event) {

    if(window.innerWidth > 980) return;

    if(
      !elements.sidebar.contains(event.target) &&
      !elements.sidebarToggle?.contains(event.target)
    ) {
      elements.sidebar.classList.remove("open");
    }

  }

  function handleResize() {

    if(window.innerWidth > 980) {
      elements.sidebar.classList.remove("open");
      return;
    }

    elements.sidebar.classList.remove("collapsed");

  }

  function handleMainScroll() {

    if(FolderSystem.isFolderOpen()) return;

    const headerHeight =
      (elements.dashboardHeader?.offsetHeight || 0) + 32;

    const sectionOrder = [
      "dashboard",
      "files",
      "tasks",
      "notes",
      "ai"
    ];

    let resolved =
      "dashboard";

    sectionOrder.forEach((key) => {
      const section = elements.sections[key];
      if(!section) return;

      const sectionTop =
        section.getBoundingClientRect().top - elements.mainContent.getBoundingClientRect().top;

      if(sectionTop <= headerHeight) {
        resolved = key;
      }
    });

    if(resolved !== activeTarget) {
      activeTarget = resolved;
      updateActiveItem(activeTarget);
    }

  }

  function scrollToSection(target) {

    if(target === "files") {
      // Special handling for Files section - show it instead of scrolling
      if(elements.dashboardView && elements.filesSection) {
        elements.dashboardView.classList.add("hidden");
        elements.folderView.classList.add("hidden");
        elements.filesSection.classList.remove("hidden");
        animateViewIn(elements.filesSection);
      }
      return;
    }

    if(target === "files" && FolderSystem.isFolderOpen()) {
      return;
    }

    if(elements.dashboardView && elements.filesSection) {
      elements.dashboardView.classList.remove("hidden");
      elements.filesSection.classList.add("hidden");
      animateViewIn(elements.dashboardView);
    }

    if(elements.folderView?.classList.contains("hidden")) {
      elements.folderView.classList.add("hidden");
    }

    const section =
      elements.sections[target] || elements.sections.dashboard;

    if(!section) return;

    const headerOffset =
      (elements.dashboardHeader?.offsetHeight || 0) + 14;

    const mainRect =
      elements.mainContent.getBoundingClientRect();

    const sectionRect =
      section.getBoundingClientRect();

    const top =
      elements.mainContent.scrollTop + sectionRect.top - mainRect.top - headerOffset;

    elements.mainContent.scrollTo({
      top: Math.max(top, 0),
      behavior: "smooth"
    });

  }

  function closeMobileSidebar() {

    if(window.innerWidth <= 980) {
      elements.sidebar.classList.remove("open");
    }

  }

  function animateViewIn(element) {

    if(!element) return;

    element.classList.remove("view-enter");

    requestAnimationFrame(() => {
      element.classList.add("view-enter");
    });

  }

  function updateActiveItem(target) {

    const navItems =
      elements.sidebarNav.querySelectorAll(".nav-item");

    navItems.forEach((item) => {
      const isActive =
        item.dataset.navTarget === target;

      item.classList.toggle("active", isActive);
    });

  }

  return {
    init
  };

})();

NavigationSystem.init();

/* ---------------- NOTEPILOT AI SUMMARIZER ---------------- */

const chatMessages =
  document.getElementById("chatMessages");

const aiFileInput =
  document.getElementById("aiFileInput");

const attachFileBtn =
  document.getElementById("attachFileBtn");

const summarizeBtn =
  document.getElementById("summarizeBtn");

const uploadedFilePreview =
  document.getElementById("uploadedFilePreview");

const pastedNotesInput =
  document.getElementById("pastedNotesInput");

const summarizerState = {
  file: null,
  extractedText: "",
  pendingSource: ""
};

const extractorMap = {
  txt: extractTextFromTxt,
  pdf: extractTextFromPdfFuture,
  docx: extractTextFromDocxFuture
};

function appendAssistantBubble(text) {

  if(!chatMessages) return;

  const row =
    document.createElement("div");

  row.className = "chat-row bot";

  const bubble =
    document.createElement("div");

  bubble.className = "message-bubble";

  bubble.innerHTML = text;

  row.appendChild(bubble);

  chatMessages.appendChild(row);

  chatMessages.scrollTop =
    chatMessages.scrollHeight;

}

function showTypingIndicator() {

  if(!chatMessages) return null;

  const row =
    document.createElement("div");

  row.className = "chat-row bot";

  const bubble =
    document.createElement("div");

  bubble.className = "message-bubble";

  bubble.innerHTML = `
    <div class="processing-state">
      <span class="processing-label">Analyzing content</span>
      <div class="typing-bubble">
        <span></span><span></span><span></span>
      </div>
    </div>
  `;

  row.appendChild(bubble);

  chatMessages.appendChild(row);

  chatMessages.scrollTop =
    chatMessages.scrollHeight;

  return row;

}

function getExtension(name) {

  if(!name || !name.includes(".")) return "";

  return name.split(".").pop().toLowerCase();

}

function formatFileSize(bytes) {

  if(!bytes) return "0 B";
  if(bytes < 1024) return `${bytes} B`;
  if(bytes < 1024 * 1024) return `${Math.round(bytes / 102.4) / 10} KB`;

  return `${Math.round(bytes / (1024 * 102.4)) / 10} MB`;

}

function renderUploadedFileCard(file) {

  if(!uploadedFilePreview) return;

  uploadedFilePreview.classList.remove("hidden");

  const ext =
    getExtension(file.name).toUpperCase() || "FILE";

  uploadedFilePreview.innerHTML = `
    <span class="file-chip-icon" aria-hidden="true">
      <svg viewBox="0 0 24 24">
        <path d="M4 5a2 2 0 0 1 2-2h8l6 6v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5zm12-2v6h6" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </span>
    <div class="file-chip-meta">
      <p class="file-chip-name">${file.name}</p>
      <p class="file-chip-type">${ext} - ${formatFileSize(file.size || 0)}</p>
    </div>
  `;

}

function extractTextFromTxt(file) {

  return file.text();

}

function extractTextFromPdfFuture() {

  return Promise.resolve("[PDF extractor placeholder] Integrate parser in next version.");

}

function extractTextFromDocxFuture() {

  return Promise.resolve("[DOCX extractor placeholder] Integrate parser in next version.");

}

function cleanText(text) {

  return text
    .replace(/\r/g, " ")
    .replace(/\n+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

}

function summarizeText(text) {

  const cleaned =
    cleanText(text);

  if(!cleaned) {
    return {
      html: "<p>I could not find enough text to summarize.</p>",
      sourceWords: 0,
      summaryWords: 0,
      sentenceCount: 0,
      keywords: []
    };
  }

  const sentences =
    splitIntoSentences(cleaned);

  const sourceWords =
    countWords(cleaned);

  if(sentences.length <= 2 || sourceWords < 30) {
    const compact =
      sentences.slice(0, 1).join(" ");

    return {
      html: formatSummaryHtml({
        summaryText: compact || cleaned
      }),
      sourceWords,
      summaryWords: countWords(compact || cleaned),
      sentenceCount: sentences.length,
      keywords: getTopKeywords(cleaned, 5)
    };
  }

  const frequencyMap =
    buildFrequencyMap(cleaned);

  const ranked =
    scoreSentences(sentences, frequencyMap);

  const targetCount =
    getTargetSummarySentenceCount(sentences.length);

  const selected =
    selectBestSentences(ranked, targetCount);

  const conciseSummary =
    buildFinalSummary(selected);

  const keywords =
    getTopKeywords(cleaned, 6);

  const summaryWords =
    countWords(conciseSummary);

  return {
    html: formatSummaryHtml({
      summaryText: conciseSummary
    }),
    sourceWords,
    summaryWords,
    sentenceCount: sentences.length,
    keywords
  };

}

function splitIntoSentences(text) {

  const normalized =
    text
      .replace(/([.!?])(?=[A-Z0-9])/g, "$1 ")
      .replace(/\s+/g, " ")
      .trim();

  return normalized
    .match(/[^.!?]+[.!?]+|[^.!?]+$/g)
    ?.map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0) || [];

}

function countWords(text) {

  return text
    .split(/\s+/)
    .filter(Boolean).length;

}

function getStopwords() {

  return new Set([
    "the","and","for","that","with","this","from","your","have","are","was","were","but","not","you","about","into","their","they","them","will","can","has","had","our","its","also","use","using","been","more","than","then","very","just","such","over","some","much","many","only","even","when","what","where","while","because","could","would","should","there","here","those","these","after","before","between","through","under","again","each","both","same","any","all","out","too","may","might","must","shall","able","like","well","make","made","does","did","doing","done","get","gets","got"
  ]);

}

function tokenizeMeaningfulWords(text) {

  const stopwords =
    getStopwords();

  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2 && !stopwords.has(word));

}

function buildFrequencyMap(text) {

  const words =
    tokenizeMeaningfulWords(text);

  const map = {};

  words.forEach((word) => {
    map[word] = (map[word] || 0) + 1;
  });

  const maxFrequency =
    Math.max(...Object.values(map), 1);

  Object.keys(map).forEach((word) => {
    map[word] = map[word] / maxFrequency;
  });

  return map;

}

function scoreSentences(sentences, frequencyMap) {

  return sentences.map((sentence, index) => {

    const tokens =
      tokenizeMeaningfulWords(sentence);

    const tokenCount =
      tokens.length || 1;

    let score = 0;

    tokens.forEach((token) => {
      score += frequencyMap[token] || 0;
    });

    const densityScore =
      score / tokenCount;

    const lengthPenalty =
      tokenCount > 32 ? 0.86 : 1;

    const positionBoost =
      index === 0 || index === sentences.length - 1 ? 1.08 : 1;

    return {
      index,
      sentence,
      tokens,
      score: densityScore * lengthPenalty * positionBoost
    };

  });

}

function getTargetSummarySentenceCount(totalSentences) {

  if(totalSentences <= 4) return 1;
  if(totalSentences <= 10) return 2;
  if(totalSentences <= 18) return 3;

  return 4;

}

function sentenceSimilarity(tokensA, tokensB) {

  if(!tokensA.length || !tokensB.length) return 0;

  const setA =
    new Set(tokensA);

  const setB =
    new Set(tokensB);

  let overlap = 0;

  setA.forEach((token) => {
    if(setB.has(token)) overlap += 1;
  });

  return overlap / Math.min(setA.size, setB.size);

}

function selectBestSentences(ranked, targetCount) {

  const byScore =
    [...ranked].sort((a, b) => b.score - a.score);

  const selected = [];

  byScore.forEach((candidate) => {

    if(selected.length >= targetCount) return;

    const tooSimilar =
      selected.some((picked) => sentenceSimilarity(candidate.tokens, picked.tokens) > 0.72);

    if(!tooSimilar) {
      selected.push(candidate);
    }

  });

  if(selected.length < targetCount) {
    byScore.forEach((candidate) => {
      if(selected.length >= targetCount) return;
      if(!selected.find((item) => item.index === candidate.index)) {
        selected.push(candidate);
      }
    });
  }

  return selected
    .sort((a, b) => a.index - b.index)
    .map((item) => trimSentence(item.sentence));

}

function trimSentence(sentence) {

  return sentence
    .replace(/^\s*(and|but|so|because)\s+/i, "")
    .replace(/\s+/g, " ")
    .trim();

}

function buildFinalSummary(sentences) {

  if(!sentences.length) return "";

  return sentences.join(" ");

}

function getTopKeywords(text, limit = 5) {

  const counts = {};

  tokenizeMeaningfulWords(text).forEach((word) => {
    counts[word] = (counts[word] || 0) + 1;
  });

  return Object.keys(counts)
    .sort((a, b) => counts[b] - counts[a])
    .slice(0, limit);

}

function escapeHtml(text) {

  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

}

function formatSummaryHtml({
  summaryText
}) {

  return `
    <div class="summary-panel">
      <div class="summary-header">
        <svg class="summary-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 3l2.6 2.6L18 6l-1.4 3.4L19 12l-2.4 2.6L18 18l-3.4.4L12 21l-2.6-2.6L6 18l1.4-3.4L5 12l2.4-2.6L6 6l3.4-.4L12 3zm0 5.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
        </svg>
        <h3 class="summary-title">Summary</h3>
      </div>
      <div class="summary-divider"></div>
      <p class="summary-text">${escapeHtml(summaryText)}</p>
    </div>
  `;

}

async function readSelectedFile(file) {

  const extension =
    getExtension(file.name);

  const extractor =
    extractorMap[extension];

  if(!extractor) {
    return "";
  }

  return extractor(file);

}

async function runSummarization() {

  const pastedText =
    pastedNotesInput ? pastedNotesInput.value.trim() : "";

  const sourceText =
    pastedText || summarizerState.extractedText;

  if(!sourceText) {
    appendAssistantBubble("Please upload a .txt file or paste notes first.");
    return;
  }

  const typingRow =
    showTypingIndicator();

  await new Promise((resolve) => setTimeout(resolve, 1050));

  if(typingRow) typingRow.remove();

  const summaryResult =
    summarizeText(sourceText);

  appendAssistantBubble(summaryResult.html);

}

if(attachFileBtn && aiFileInput) {

  attachFileBtn.addEventListener("click", () => {
    aiFileInput.click();
  });

}

if(aiFileInput) {

  aiFileInput.addEventListener("change", async () => {

    const file =
      aiFileInput.files[0];

    if(!file) return;

    summarizerState.file = file;

    renderUploadedFileCard(file);

    const extension =
      getExtension(file.name);

    if(extension !== "txt") {
      summarizerState.extractedText = "";
      appendAssistantBubble("Version 1 currently summarizes .txt files and pasted notes. PDF/DOCX support is prepared for next versions.");
      return;
    }

    const extracted =
      await readSelectedFile(file);

    summarizerState.extractedText =
      cleanText(extracted);

    appendAssistantBubble(`Loaded <strong>${file.name}</strong>. Click <strong>Summarize File</strong> when ready.`);

  });

}

if(summarizeBtn) {

  summarizeBtn.addEventListener("click", () => {
    runSummarization();
  });

}

/* ===== FILE MANAGER INITIALIZATION ===== */

// Initialize IndexedDB and File System managers after page loads
(async () => {
  try {
    // Initialize IndexedDB
    fsManager = new FileSystemAccessManager(idbManager);
    await idbManager.init();
    console.log('IndexedDB initialized');

    // Try to restore root directory on page load
    const restoredHandle = await fsManager.restoreRootDirectory();
    if (restoredHandle) {
      console.log('Root directory restored from IndexedDB');
      // Load folder structure if root was restored
      const tempFileManager = new FileManager(idbManager, fsManager);
      await tempFileManager.loadFolderStructure();
      fileManager = tempFileManager;
    } else {
      console.log('No root directory found. User will need to select one.');
      fileManager = new FileManager(idbManager, fsManager);
    }

    // Setup modal close button
    const deleteFileBtn = document.getElementById('deleteFileBtn');
    const openFileBtn = document.getElementById('openFileBtn');
    const modal = document.getElementById('filePreviewModal');

    if (deleteFileBtn) {
      deleteFileBtn.addEventListener('click', async () => {
        if (!modal || !modal.dataset.currentFile) return;
        try {
          const fileData = JSON.parse(modal.dataset.currentFile);
          const folderInfo = fileManager.folderHandles.get(fileManager.currentFolderId);
          if (folderInfo) {
            await fileManager.deleteFile(fileData, folderInfo.handle);
          }
        } catch (error) {
          console.error('Error deleting file:', error);
        }
      });
    }

    if (openFileBtn) {
      openFileBtn.addEventListener('click', async () => {
        if (!modal || !modal.dataset.currentFile) return;
        try {
          const fileData = JSON.parse(modal.dataset.currentFile);
          await fileManager.openFile(fileData);
        } catch (error) {
          console.error('Error opening file:', error);
          fileManager.showNotification('Error opening file', 'error');
        }
      });
    }

    console.log('File manager initialized successfully');
  } catch (error) {
    console.error('Failed to initialize file manager:', error);
  }
})();
/* =========================
   NOTEPILOT AI FILE SYSTEM
========================= */

const aiFileInput = document.getElementById("aiFileInput");
const aiPrompt = document.getElementById("aiPrompt");
const chatArea = document.getElementById("chatArea");
const sendAiBtn = document.getElementById("sendAiBtn");

let uploadedFileText = "";

/* READ FILE */
aiFileInput.addEventListener("change", async (e) => {

    const file = e.target.files[0];

    if (!file) return;

    const fileType = file.type;

    /* TEXT FILES */
    if (
        fileType.includes("text") ||
        file.name.endsWith(".txt")
    ) {

        const text = await file.text();

        uploadedFileText = text;

        addAiMessage(
            "📄 File uploaded successfully: " + file.name
        );
    }

    /* IMAGE FILES */
    else if (fileType.includes("image")) {

        uploadedFileText =
            "This is an image file named " + file.name;

        addAiMessage(
            "🖼 Image uploaded: " + file.name
        );
    }

    /* PDF FILES */
    else if (fileType.includes("pdf")) {

        uploadedFileText =
            "PDF uploaded: " + file.name;

        addAiMessage(
            "📘 PDF uploaded successfully: " + file.name
        );
    }

    else {

        addAiMessage(
            "❌ Unsupported file type."
        );
    }
});

/* SEND BUTTON */
sendAiBtn.addEventListener("click", () => {

    const userText = aiPrompt.value.trim();

    if (!userText && !uploadedFileText) return;

    addUserMessage(userText);

    /* SIMPLE SUMMARY SYSTEM */

    let summary = "";

    if (uploadedFileText.length > 0) {

        summary =
            generateSummary(uploadedFileText);
    }

    else {

        summary =
            "Please upload a file first.";
    }

    setTimeout(() => {

        addAiMessage(summary);

    }, 800);

    aiPrompt.value = "";
});

/* AI MESSAGE */
function addAiMessage(text) {

    const div = document.createElement("div");

    div.className = "ai-message";

    div.innerHTML = text;

    chatArea.appendChild(div);

    chatArea.scrollTop = chatArea.scrollHeight;
}

/* USER MESSAGE */
function addUserMessage(text) {

    const div = document.createElement("div");

    div.className = "user-message";

    div.innerHTML = text;

    chatArea.appendChild(div);

    chatArea.scrollTop = chatArea.scrollHeight;
}

/* SIMPLE SUMMARY FUNCTION */
function generateSummary(text) {

    if (!text || text.length < 20) {

        return "⚠ Not enough content to summarize.";
    }

    /* SPLIT INTO SENTENCES */
    const sentences = text.split(".");

    /* TAKE IMPORTANT PARTS */
    let shortSummary =
        sentences.slice(0, 5).join(". ");

    return `
        <strong>📌 Summary:</strong><br><br>
        ${shortSummary}.
    `;
}
/* =========================
   FIX FOLDER OPENING
========================= */

document.addEventListener("DOMContentLoaded", () => {

    const folders = document.querySelectorAll(".folder-card");

    folders.forEach(folder => {

        folder.addEventListener("click", () => {

            /* REMOVE ACTIVE CLASS */
            folders.forEach(f => {
                f.classList.remove("active-folder");
            });

            /* ACTIVATE CLICKED FOLDER */
            folder.classList.add("active-folder");

            /* GET FOLDER NAME */
            const folderName =
                folder.querySelector("h3")?.innerText
                || "Folder";

            /* FIND FILE AREA */
            const fileArea =
                document.getElementById("folderFiles");

            if (fileArea) {

                fileArea.innerHTML = `
                    <div class="opened-folder">
                        <h2>📂 ${folderName}</h2>
                        <p>Folder opened successfully.</p>
                    </div>
                `;
            }

        });

    });

});
/* FIX FOLDER OPENING */

document.addEventListener("DOMContentLoaded", () => {

    const folders = document.querySelectorAll(".folder-card-content");

    folders.forEach(folder => {

        folder.addEventListener("click", () => {

            /* REMOVE ACTIVE STATE */
            folders.forEach(f => {
                f.classList.remove("active-folder");
            });

            /* ACTIVATE CLICKED */
            folder.classList.add("active-folder");

            /* GET FOLDER NAME */
            const folderName =
                folder.innerText.split("\n")[0];

            /* FIND FILE DISPLAY AREA */
            const folderFiles =
                document.getElementById("folderFiles");

            if(folderFiles){

                folderFiles.innerHTML = `
                    <div class="opened-folder">
                        <h2>📂 ${folderName}</h2>
                        <p>Folder opened successfully.</p>
                    </div>
                `;
            }

        });

    });

});