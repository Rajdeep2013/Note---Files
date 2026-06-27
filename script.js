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

function notifySearchDataChanged(scope = "all") {

  document.dispatchEvent(
    new CustomEvent("notepilot:data-updated", {
      detail: {
        scope,
        timestamp: Date.now()
      }
    })
  );

}

const FileDatabase = (() => {

  const DB_NAME =
    `notepilot-files-db:${ACTIVE_USER_SLUG}`;

  const STORE_NAME =
    "fileRecords";

  let dbPromise = null;

  function openDatabase() {
    return new Promise((resolve, reject) => {
      const request =
        indexedDB.open(DB_NAME, 1);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if(!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, {
            keyPath: "key"
          });
        }
      };

      request.onsuccess = (event) => {
        resolve(event.target.result);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  async function getDb() {
    if(!dbPromise) {
      dbPromise = openDatabase();
    }
    return dbPromise;
  }

  async function saveFileData(key, record) {
    const db = await getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put({ key, ...record });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }

  async function getFileData(key) {
    const db = await getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const request = tx.objectStore(STORE_NAME).get(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      tx.onabort = () => reject(tx.error);
    });
  }

  async function deleteFileData(key) {
    const db = await getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }

  return {
    saveFileData,
    getFileData,
    deleteFileData
  };

})();

const welcomeText =
  document.getElementById("welcomeText");
const dashboardDate =
  document.getElementById("dashboardDate");

if(dashboardDate) {
  dashboardDate.textContent = new Date().toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

let FolderSystem;
let notebookState = {
  pages: [],
  currentPage: 0
};

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

const sidebarFoldersCount =
  document.getElementById("sidebarFoldersCount");

const sidebarFilesCount =
  document.getElementById("sidebarFilesCount");

const sidebarNotesCount =
  document.getElementById("sidebarNotesCount");

const sidebarTasksCount =
  document.getElementById("sidebarTasksCount");

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
    li.dataset.taskIndex = String(index);

    if(taskObj.completed) {

      li.classList.add("completed");

    }

    li.innerHTML = `

      <div class="task-left">

        <input
          type="checkbox"
          ${taskObj.completed ? "checked" : ""}
          onchange="toggleTask(${index})">

        <span class="task-text">${taskObj.text}</span>

      </div>

      <button onclick="deleteTask(${index})">
        Delete
      </button>
    `;

    taskList.appendChild(li);

  });

  updateWorkspaceStats();

}

function addTaskEntry(taskText, { clearInput = true } = {}) {
  const trimmedText = String(taskText || "").trim();

  if(!trimmedText) return false;

  tasks.push({
    text: trimmedText,
    completed: false
  });

  localStorage.setItem(
    TASKS_STORAGE_KEY,
    JSON.stringify(tasks)
  );

  loadTasks();
  notifySearchDataChanged("tasks");

  if(clearInput && taskInput) {
    taskInput.value = "";
  }

  return true;
}

function countFolderTreeMetrics(snapshot) {
  const totals = {
    folders: 0,
    files: 0,
    notes: 0
  };

  if(!Array.isArray(snapshot)) return totals;

  function traverse(nodes) {
    nodes.forEach((folder) => {
      totals.folders += 1;
      totals.files += Array.isArray(folder.files) ? folder.files.length : 0;
      totals.notes += Array.isArray(folder.notes) ? folder.notes.length : 0;
      if(Array.isArray(folder.subfolders)) {
        traverse(folder.subfolders);
      }
    });
  }

  traverse(snapshot);
  return totals;
}

function updateWorkspaceStats() {
  const snapshot = typeof FolderSystem !== "undefined" && FolderSystem.getFolderTreeSnapshot
    ? FolderSystem.getFolderTreeSnapshot()
    : [];

  const counts = countFolderTreeMetrics(snapshot);
  const notebookPages = Array.isArray(notebookState.pages) ? notebookState.pages.length : 0;
  const noteTotal = counts.notes + notebookPages;

  if(sidebarFoldersCount) sidebarFoldersCount.textContent = String(counts.folders);
  if(sidebarFilesCount) sidebarFilesCount.textContent = String(counts.files);
  if(sidebarNotesCount) sidebarNotesCount.textContent = String(noteTotal);
  if(sidebarTasksCount) sidebarTasksCount.textContent = String(Array.isArray(tasks) ? tasks.length : 0);
}

/* ADD TASK */

if(addTaskBtn) {

  addTaskBtn.addEventListener("click", () => {
    addTaskEntry(taskInput?.value || "");
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
  notifySearchDataChanged("tasks");

}

/* DELETE TASK */

function deleteTask(index) {

  tasks.splice(index, 1);

  localStorage.setItem(
    TASKS_STORAGE_KEY,
    JSON.stringify(tasks)
  );

  loadTasks();
  notifySearchDataChanged("tasks");

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

notebookState = {
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

  notifySearchDataChanged("notes");
  updateWorkspaceStats();

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
  notesArea.dataset.pageIndex = String(notebookState.currentPage);

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

FolderSystem = (() => {

  const elements = {
    dashboardView: document.getElementById("dashboardView"),
    folderView: document.getElementById("folderView"),
    dashboardFoldersGrid: document.getElementById("dashboardFoldersGrid"),
    folderTitle: document.getElementById("folderTitle"),
    folderBreadcrumbs: document.getElementById("folderBreadcrumbs"),
    gridViewBtn: document.getElementById("gridViewBtn"),
    listViewBtn: document.getElementById("listViewBtn"),
    fileSortSelect: document.getElementById("fileSortSelect"),
    fileFilterSelect: document.getElementById("fileFilterSelect"),
    selectedFilesBadge: document.getElementById("selectedFilesBadge"),
    clearSelectionBtn: document.getElementById("clearSelectionBtn"),
    newRootFolderBtn: document.getElementById("newRootFolderBtn"),
    quickNewFolderBtn: document.getElementById("quickNewFolderBtn"),
    newSubfolderBtn: document.getElementById("newSubfolderBtn"),
    backBtn: document.getElementById("backBtn"),
    addNoteBtn: document.getElementById("addNoteBtn"),
    quickNewNoteBtn: document.getElementById("quickNewNoteBtn"),
    notesList: document.getElementById("notesList"),
    addFileBtn: document.getElementById("addFileBtn"),
    quickUploadBtn: document.getElementById("quickUploadBtn"),
    fileInput: document.getElementById("fileInput"),
    filesList: document.getElementById("filesList"),
    subfolderGrid: document.getElementById("subfolderGrid"),
    quickNewTaskBtn: document.getElementById("quickNewTaskBtn"),
    fabShell: document.getElementById("fabShell"),
    fabButton: document.getElementById("fabMainBtn"),
    fabMenu: document.getElementById("fabMenu"),
    contextMenu: document.getElementById("explorerContextMenu"),
    moveModal: document.getElementById("moveFileModal"),
    movePanel: document.querySelector("#moveFileModal .move-panel"),
    moveTitle: document.getElementById("moveFileTitle"),
    moveSubtitle: document.getElementById("moveFileSubtitle"),
    moveTargetList: document.getElementById("moveTargetList"),
    closeMoveModalBtn: document.getElementById("closeMoveModalBtn")
  };

  const state = {
    activeFolderId: "",
    viewMode: localStorage.getItem(getUserScopedKey("fileExplorerViewMode")) || "grid",
    sortBy: localStorage.getItem(getUserScopedKey("fileExplorerSortBy")) || "name",
    filterBy: localStorage.getItem(getUserScopedKey("fileExplorerFilterBy")) || "all",
    selectedFileIds: new Set(),
    lastSelectedFileIndex: -1,
    selectionMode: false,
    contextMenu: null,
    moveSelection: [],
    longPressTimer: null,
    longPressFileId: "",
    longPressFired: false,
    dragFileIds: [],
    dragSourceFolderId: ""
  };

  const FOLDER_TREE_STORAGE_KEY =
    getUserScopedKey("folderTree");

  const LAST_OPEN_FOLDER_STORAGE_KEY =
    getUserScopedKey("lastOpenedFolderId");

  const FOLDER_VIEW_OPEN_STORAGE_KEY =
    getUserScopedKey("folderViewOpen");

  let folderTree = [];

  const STORAGE_PREFIX =
    `notepilot:folder:v3:${ACTIVE_USER_SLUG}`;

  function init() {

    if(!elements.dashboardView || !elements.folderView || !elements.dashboardFoldersGrid) {
      return;
    }

    state.viewMode = normalizeViewMode(state.viewMode);
    state.sortBy = normalizeSortMode(state.sortBy);
    state.filterBy = normalizeFilterMode(state.filterBy);

    folderTree = loadFolderTree();
    bindEvents();
    syncToolbarState();
    renderDashboardFolders();
    updateWorkspaceStats();
    restorePersistedFolderViewState();

    const previewApi = getFilePreviewApi();
    if(previewApi && typeof previewApi.init === "function") {
      previewApi.init();
    }

  }

  function normalizeViewMode(mode) {
    return mode === "list" ? "list" : "grid";
  }

  function normalizeSortMode(mode) {
    return ["name", "date", "size", "type"].includes(mode) ? mode : "name";
  }

  function normalizeFilterMode(mode) {
    return ["all", "images", "documents", "pdfs", "notes", "others"].includes(mode) ? mode : "all";
  }

  function saveExplorerPreferences() {
    localStorage.setItem(getUserScopedKey("fileExplorerViewMode"), state.viewMode);
    localStorage.setItem(getUserScopedKey("fileExplorerSortBy"), state.sortBy);
    localStorage.setItem(getUserScopedKey("fileExplorerFilterBy"), state.filterBy);
  }

  function syncToolbarState() {
    if(elements.gridViewBtn) {
      const isGrid = state.viewMode === "grid";
      elements.gridViewBtn.classList.toggle("is-active", isGrid);
      elements.gridViewBtn.setAttribute("aria-pressed", isGrid ? "true" : "false");
    }

    if(elements.listViewBtn) {
      const isList = state.viewMode === "list";
      elements.listViewBtn.classList.toggle("is-active", isList);
      elements.listViewBtn.setAttribute("aria-pressed", isList ? "true" : "false");
    }

    if(elements.fileSortSelect) {
      elements.fileSortSelect.value = state.sortBy;
    }

    if(elements.fileFilterSelect) {
      elements.fileFilterSelect.value = state.filterBy;
    }

    updateSelectionBadge();
    if(elements.filesList) {
      elements.filesList.dataset.viewMode = state.viewMode;
    }
  }

  function updateSelectionBadge() {
    if(!elements.selectedFilesBadge) return;
    const count = state.selectedFileIds.size;
    elements.selectedFilesBadge.textContent = `${count} selected`;
    elements.selectedFilesBadge.classList.toggle("is-visible", count > 0);
  }

  function openFabMenu() {
    if(!elements.fabShell || !elements.fabButton || !elements.fabMenu) return;
    elements.fabShell.classList.add("is-open");
    elements.fabButton.setAttribute("aria-expanded", "true");
    elements.fabMenu.setAttribute("aria-hidden", "false");
  }

  function closeFabMenu() {
    if(!elements.fabShell || !elements.fabButton || !elements.fabMenu) return;
    elements.fabShell.classList.remove("is-open");
    elements.fabButton.setAttribute("aria-expanded", "false");
    elements.fabMenu.setAttribute("aria-hidden", "true");
  }

  function toggleFabMenu() {
    if(!elements.fabShell) return;
    if(elements.fabShell.classList.contains("is-open")) {
      closeFabMenu();
    } else {
      openFabMenu();
    }
  }

  function handleFabAction(action) {
    if(action === "folder") {
      const name = prompt("New folder name", "New Folder");
      if(!name) {
        closeFabMenu();
        return;
      }
      createFolder(name.trim(), null);
      renderDashboardFolders();
      closeFabMenu();
      return;
    }

    if(action === "subfolder") {
      if(!state.activeFolderId) {
        closeFabMenu();
        return;
      }
      const name = prompt("New subfolder name", "New Subfolder");
      if(!name) {
        closeFabMenu();
        return;
      }
      const folder = createFolder(name.trim(), state.activeFolderId);
      if(folder) {
        renderSubfolders(state.activeFolderId);
        renderDashboardFolders();
      }
      closeFabMenu();
      return;
    }

    if(action === "note") {
      handleAddNote();
      closeFabMenu();
      return;
    }

    if(action === "upload") {
      handleChooseFile();
      closeFabMenu();
      return;
    }

    if(action === "task") {
      const taskName = prompt("New task name", "New Task");
      if(taskName === null) {
        closeFabMenu();
        return;
      }
      addTaskEntry(taskName);
      closeFabMenu();
    }
  }

  function promptAndCreateRootFolder() {
    const name = prompt("New root folder name", "New Folder");
    if(!name) return;
    const folder = createFolder(name.trim(), null);
    if(folder) {
      renderDashboardFolders();
    }
  }

  function promptAndCreateSubfolder() {
    if(!state.activeFolderId) return;
    const name = prompt("New subfolder name", "New Subfolder");
    if(!name) return;
    const folder = createFolder(name.trim(), state.activeFolderId);
    if(folder) {
      renderSubfolders(state.activeFolderId);
      renderDashboardFolders();
    }
  }

  function promptAndCreateTask() {
    const taskName = prompt("New task name", "New Task");
    if(taskName === null) return;
    addTaskEntry(taskName);
  }

  function bindEvents() {

    if(elements.dashboardFoldersGrid) {
      elements.dashboardFoldersGrid.addEventListener("click", (event) => {
        const actionBtn = event.target.closest(".folder-card-action-btn");
        if(actionBtn) {
          const folderId = actionBtn.dataset.folderId;
          const action = actionBtn.dataset.folderAction;
          if(folderId && action) {
            if(action === "rename") {
              const folder = getFolderById(folderId);
              if(folder) {
                const name = prompt("Rename folder", folder.name);
                if(name) {
                  renameFolder(folderId, name.trim());
                  renderDashboardFolders();
                  if(folderId === state.activeFolderId) {
                    updateBreadcrumbs();
                    if(elements.folderTitle) elements.folderTitle.textContent = folder.name;
                  }
                }
              }
            }
            if(action === "delete") {
              deleteFolder(folderId);
            }
          }
          return;
        }

        const card = event.target.closest(".folder-card");
        if(!card) return;
        const folderId = card.dataset.folder;
        if(folderId) openFolder(folderId);
      });

      elements.dashboardFoldersGrid.addEventListener("contextmenu", (event) => {
        const card = event.target.closest(".folder-card");
        if(!card) return;
        event.preventDefault();
        openExplorerContextMenu({
          kind: "folder",
          folderId: card.dataset.folder,
          x: event.clientX,
          y: event.clientY
        });
      });

      elements.dashboardFoldersGrid.addEventListener("dragover", handleFolderDragOver);
      elements.dashboardFoldersGrid.addEventListener("dragleave", handleFolderDragLeave);
      elements.dashboardFoldersGrid.addEventListener("drop", handleFolderDrop);
    }

    if(elements.subfolderGrid) {
      elements.subfolderGrid.addEventListener("click", (event) => {
        const actionBtn = event.target.closest(".folder-card-action-btn");
        if(actionBtn) {
          const folderId = actionBtn.dataset.folderId;
          const action = actionBtn.dataset.folderAction;
          if(folderId && action) {
            if(action === "rename") {
              const folder = getFolderById(folderId);
              if(folder) {
                const name = prompt("Rename folder", folder.name);
                if(name) {
                  renameFolder(folderId, name.trim());
                  renderSubfolders(state.activeFolderId);
                  renderDashboardFolders();
                  if(folderId === state.activeFolderId) {
                    updateBreadcrumbs();
                    if(elements.folderTitle) elements.folderTitle.textContent = folder.name;
                  }
                }
              }
            }
            if(action === "delete") {
              deleteFolder(folderId);
            }
          }
          return;
        }

        const card = event.target.closest(".folder-card");
        if(!card) return;
        const folderId = card.dataset.folder;
        if(folderId) openFolder(folderId);
      });

      elements.subfolderGrid.addEventListener("contextmenu", (event) => {
        const card = event.target.closest(".folder-card");
        if(!card) return;
        event.preventDefault();
        openExplorerContextMenu({
          kind: "folder",
          folderId: card.dataset.folder,
          x: event.clientX,
          y: event.clientY
        });
      });

      elements.subfolderGrid.addEventListener("dragover", handleFolderDragOver);
      elements.subfolderGrid.addEventListener("dragleave", handleFolderDragLeave);
      elements.subfolderGrid.addEventListener("drop", handleFolderDrop);
    }

    if(elements.backBtn) {
      elements.backBtn.addEventListener("click", closeFolder);
    }

    if(elements.addNoteBtn) {
      elements.addNoteBtn.addEventListener("click", handleAddNote);
    }

    if(elements.addFileBtn) {
      elements.addFileBtn.addEventListener("click", handleChooseFile);
    }

    if(elements.newRootFolderBtn) {
      elements.newRootFolderBtn.addEventListener("click", promptAndCreateRootFolder);
    }

    if(elements.quickNewFolderBtn) {
      elements.quickNewFolderBtn.addEventListener("click", promptAndCreateRootFolder);
    }

    if(elements.newSubfolderBtn) {
      elements.newSubfolderBtn.addEventListener("click", promptAndCreateSubfolder);
    }

    if(elements.quickNewNoteBtn) {
      elements.quickNewNoteBtn.addEventListener("click", handleAddNote);
    }

    if(elements.quickUploadBtn) {
      elements.quickUploadBtn.addEventListener("click", handleChooseFile);
    }

    if(elements.quickNewTaskBtn) {
      elements.quickNewTaskBtn.addEventListener("click", promptAndCreateTask);
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
      elements.filesList.addEventListener("click", handleFilesListClick);
      elements.filesList.addEventListener("keydown", (event) => {
        if(event.key !== "Enter" && event.key !== " ") return;
        const card = event.target.closest(".file-card");
        if(!card || !elements.filesList.contains(card)) return;
        event.preventDefault();
        const fileId = card.dataset.fileId;
        if(!fileId) return;
        if(event.key === " ") {
          toggleFileSelectionById(fileId, { replaceSelection: !event.ctrlKey && !event.metaKey });
          return;
        }
        openFileById(fileId);
      });
      elements.filesList.addEventListener("contextmenu", handleFilesListContextMenu);
      elements.filesList.addEventListener("dragstart", handleFilesListDragStart);
      elements.filesList.addEventListener("dragend", handleFilesListDragEnd);
      elements.filesList.addEventListener("pointerdown", handleFilesListPointerDown);
      elements.filesList.addEventListener("pointermove", cancelFileLongPress);
      elements.filesList.addEventListener("pointerup", cancelFileLongPress);
      elements.filesList.addEventListener("pointercancel", cancelFileLongPress);
      elements.filesList.addEventListener("pointerleave", cancelFileLongPress);
    }

    if(elements.gridViewBtn) {
      elements.gridViewBtn.addEventListener("click", () => setViewMode("grid"));
    }

    if(elements.listViewBtn) {
      elements.listViewBtn.addEventListener("click", () => setViewMode("list"));
    }

    if(elements.fileSortSelect) {
      elements.fileSortSelect.addEventListener("change", () => setSortBy(elements.fileSortSelect.value));
    }

    if(elements.fileFilterSelect) {
      elements.fileFilterSelect.addEventListener("change", () => setFilterBy(elements.fileFilterSelect.value));
    }

    if(elements.clearSelectionBtn) {
      elements.clearSelectionBtn.addEventListener("click", clearSelectedFiles);
    }

    if(elements.contextMenu) {
      elements.contextMenu.addEventListener("click", handleContextMenuClick);
    }

    if(elements.moveModal) {
      elements.moveModal.addEventListener("click", (event) => {
        if(event.target === elements.moveModal) {
          closeMoveModal();
        }
      });
    }

    if(elements.moveTargetList) {
      elements.moveTargetList.addEventListener("click", async (event) => {
        const targetButton = event.target.closest("[data-target-folder-id]");
        if(!targetButton || targetButton.disabled) return;
        const folderId = targetButton.dataset.targetFolderId;
        const fileIds = state.moveSelection.slice();
        closeMoveModal();
        await moveFilesToFolder(fileIds, folderId);
      });
    }

    if(elements.closeMoveModalBtn) {
      elements.closeMoveModalBtn.addEventListener("click", closeMoveModal);
    }

    if(elements.fabButton) {
      elements.fabButton.addEventListener("click", (event) => {
        event.stopPropagation();
        toggleFabMenu();
      });
    }

    if(elements.fabMenu) {
      elements.fabMenu.querySelectorAll(".fab-menu-item").forEach((item) => {
        item.addEventListener("click", (event) => {
          event.stopPropagation();
          handleFabAction(item.dataset.fabAction);
        });
      });
    }

    document.addEventListener("click", (event) => {
      const fabIsOpen = Boolean(elements.fabShell && elements.fabShell.classList.contains("is-open"));
      if(fabIsOpen && !elements.fabShell.contains(event.target)) {
        closeFabMenu();
      }

      if(elements.contextMenu && !elements.contextMenu.classList.contains("hidden") && !elements.contextMenu.contains(event.target)) {
        closeExplorerContextMenu();
      }
    });

    document.addEventListener("keydown", (event) => {
      if(event.key === "Escape") {
        closeFabMenu();
        closeExplorerContextMenu();
        closeMoveModal();
        clearLongPressState();
      }
    });

  }

  function normalizeFolderId(folderName) {

    return (folderName || "")
      .toString()
      .trim()
      .toLowerCase();

  }

  function buildNestedFolderTree(entries) {
    const rawFolders = [];

    function collect(folderEntry, parentId = null) {
      const normalized = normalizeFolderEntry(folderEntry);
      normalized.parentId = normalized.parentId || parentId;
      const item = {
        ...normalized,
        subfolders: [],
        files: Array.isArray(normalized.files) ? normalized.files : [],
        notes: Array.isArray(normalized.notes) ? normalized.notes : []
      };
      rawFolders.push(item);

      if(Array.isArray(normalized.subfolders)) {
        normalized.subfolders.forEach((child) => collect(child, item.id));
      }
    }

    if(Array.isArray(entries)) {
      entries.forEach((entry) => collect(entry, null));
    }

    const folderMap = new Map(rawFolders.map((folder) => [folder.id, folder]));
    const roots = [];

    folderMap.forEach((folder) => {
      if(folder.parentId && folderMap.has(folder.parentId) && folder.parentId !== folder.id) {
        folderMap.get(folder.parentId).subfolders.push(folder);
      } else {
        roots.push(folder);
      }
    });

    return roots;
  }

  function ensureDefaultRootFolders(tree) {
    const requiredRootFolders = ["School", "Coding", "Photos", "Important"];
    const normalizedTree = Array.isArray(tree) ? tree.map(normalizeFolderEntry) : [];
    const existingRootNames = new Set(
      normalizedTree
        .filter((node) => node.parentId === null)
        .map((node) => node.name.trim().toLowerCase())
    );

    requiredRootFolders.forEach((name) => {
      if(!existingRootNames.has(name.toLowerCase())) {
        normalizedTree.push(createFolderObject(name, null));
      }
    });

    return normalizedTree;
  }

  function loadFolderTree() {
    const stored = localStorage.getItem(FOLDER_TREE_STORAGE_KEY);
    if(!stored) {
      const defaultFolders = ensureDefaultRootFolders([]);
      saveFolderTree(defaultFolders);
      return defaultFolders;
    }

    try {
      const parsed = JSON.parse(stored);
      if(Array.isArray(parsed)) {
        const nested = buildNestedFolderTree(parsed);
        const normalized = ensureDefaultRootFolders(nested);
        saveFolderTree(normalized);
        return normalized;
      }
    } catch {
      // fall through
    }

    const recovered = ensureDefaultRootFolders([]);
    saveFolderTree(recovered);
    return recovered;
  }

  function saveFolderTree(tree) {
    folderTree = Array.isArray(tree) ? tree.map(normalizeFolderEntry) : [];
    localStorage.setItem(FOLDER_TREE_STORAGE_KEY, JSON.stringify(folderTree));
    notifySearchDataChanged("folders");
    updateWorkspaceStats();
  }

  function persistFolderViewState(isOpen, folderId = "") {
    localStorage.setItem(FOLDER_VIEW_OPEN_STORAGE_KEY, isOpen ? "1" : "0");
    if(folderId) {
      localStorage.setItem(LAST_OPEN_FOLDER_STORAGE_KEY, folderId);
    }
  }

  function clearPersistedFolderStateForDeletedIds(folderIds = []) {
    if(!Array.isArray(folderIds) || !folderIds.length) return;

    const storedFolderId =
      localStorage.getItem(LAST_OPEN_FOLDER_STORAGE_KEY);

    if(!storedFolderId || !folderIds.includes(storedFolderId)) return;

    persistFolderViewState(false);
    localStorage.removeItem(LAST_OPEN_FOLDER_STORAGE_KEY);
  }

  function restorePersistedFolderViewState() {
    const shouldRestoreOpen =
      localStorage.getItem(FOLDER_VIEW_OPEN_STORAGE_KEY) === "1";

    if(!shouldRestoreOpen) return;

    const folderId =
      localStorage.getItem(LAST_OPEN_FOLDER_STORAGE_KEY);

    if(!folderId || !getFolderById(folderId)) {
      persistFolderViewState(false);
      return;
    }

    openFolder(folderId);
  }

  function createFolderObject(name, parentId = null) {
    return {
      id: `folder-${Math.random().toString(36).slice(2)}-${Date.now()}`,
      name: String(name || "New Folder").trim() || "New Folder",
      parentId: parentId || null,
      createdAt: Date.now(),
      open: true,
      subfolders: [],
      files: [],
      notes: []
    };
  }

  function normalizeFolderEntry(entry) {
    if(!entry || typeof entry !== "object") return createFolderObject("New Folder", null);

    return {
      id: entry.id || `folder-${Math.random().toString(36).slice(2)}-${Date.now()}`,
      name: String(entry.name || "New Folder").trim() || "New Folder",
      parentId: entry.parentId || null,
      createdAt: Number(entry.createdAt) || Date.now(),
      open: typeof entry.open === "boolean" ? entry.open : true,
      subfolders: Array.isArray(entry.subfolders)
        ? entry.subfolders.map(normalizeFolderEntry)
        : [],
      files: Array.isArray(entry.files)
        ? entry.files.map((file) => normalizeFileEntry(file, entry.id || entry.parentId || ""))
        : [],
      notes: Array.isArray(entry.notes)
        ? entry.notes.map((note) => String(note))
        : []
    };
  }

  function findFolderById(folderId, folders = folderTree) {
    if(!folderId) return null;
    for(const folder of folders) {
      if(folder.id === folderId) {
        return folder;
      }
      const found = findFolderById(folderId, folder.subfolders);
      if(found) {
        return found;
      }
    }
    return null;
  }

  function findFolderParent(folderId, folders = folderTree, parent = null) {
    for(const folder of folders) {
      if(folder.id === folderId) {
        return parent;
      }
      const found = findFolderParent(folderId, folder.subfolders, folder);
      if(found) {
        return found;
      }
    }
    return null;
  }

  function getFolderById(folderId) {
    return findFolderById(folderId);
  }

  function getFolderChildren(parentId) {
    if(parentId === null || parentId === undefined) {
      return folderTree
        .slice()
        .sort((first, second) => first.name.localeCompare(second.name, undefined, { sensitivity: "base" }));
    }

    const parent = findFolderById(parentId);
    return parent
      ? parent.subfolders.slice().sort((first, second) => first.name.localeCompare(second.name, undefined, { sensitivity: "base" }))
      : [];
  }

  function getFolderPath(folderId) {
    const path = [];
    let current = findFolderById(folderId);
    while(current) {
      path.unshift(current);
      current = current.parentId ? findFolderById(current.parentId) : null;
    }
    return path;
  }

  function getDescendantFolderIds(folderId) {
    const folder = findFolderById(folderId);
    if(!folder) return [];

    const ids = [folder.id];
    folder.subfolders.forEach((child) => {
      ids.push(...getDescendantFolderIds(child.id));
    });
    return ids;
  }

  function deleteFolderResources(folder) {
    if(!folder) return;

    folder.files.forEach((file) => {
      if(file.fileKey) {
        FileDatabase.deleteFileData(file.fileKey).catch(() => {});
      }
    });

    folder.subfolders.forEach(deleteFolderResources);
  }

  async function deleteFolder(folderId) {
    const folder = findFolderById(folderId);
    if(!folder) return;

    const shouldDelete = confirm(`Delete folder "${folder.name}" and all nested content?`);
    if(!shouldDelete) return;

    const deletedFolderIds =
      getDescendantFolderIds(folderId);

    const parent = findFolderParent(folderId);
    if(parent) {
      parent.subfolders = parent.subfolders.filter((item) => item.id !== folderId);
    } else {
      folderTree = folderTree.filter((item) => item.id !== folderId);
    }

    deleteFolderResources(folder);
    saveFolderTree(folderTree);
    clearPersistedFolderStateForDeletedIds(deletedFolderIds);

    if(state.activeFolderId && !findFolderById(state.activeFolderId)) {
      closeFolder();
    }

    renderDashboardFolders();

    if(state.activeFolderId) {
      renderFolderData();
    }
  }

  function createFolder(name, parentId) {
    const folder = createFolderObject(name, parentId);
    if(parentId) {
      const parent = findFolderById(parentId);
      if(parent) {
        parent.subfolders.push(folder);
      } else {
        folderTree.push(folder);
      }
    } else {
      folderTree.push(folder);
    }
    saveFolderTree(folderTree);
    return folder;
  }

  function renameFolder(folderId, newName) {
    const folder = findFolderById(folderId);
    if(!folder || !newName) return null;
    folder.name = String(newName).trim() || folder.name;
    saveFolderTree(folderTree);
    return folder;
  }

  function getFolderLabel(folder) {
    if(!folder) return "Folder";
    return folder.name;
  }

  function syncActiveFolderCards() {
    const activeFolderId = String(state.activeFolderId || "");

    // Remove any leftover active classes globally to guarantee a single active card
    document.querySelectorAll(".folder-card.active").forEach((c) => {
      if(!c) return;
      c.classList.remove("active");
      c.setAttribute("aria-selected", "false");
    });

    if(!activeFolderId) return;

    // Apply active state to any matching cards in dashboard and subfolder grids
    [elements.dashboardFoldersGrid, elements.subfolderGrid].forEach((grid) => {
      if(!grid) return;
      const selector = `.folder-card[data-folder="${activeFolderId}"]`;
      const matches = grid.querySelectorAll(selector);
      matches.forEach((card) => {
        card.classList.add("active");
        card.setAttribute("aria-selected", "true");
        // ensure visible in scrollable containers
        if(typeof card.scrollIntoView === "function" && grid.contains(card)) {
          // only subtly bring into view without changing layout
          card.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "auto" });
        }
      });
    });
  }


  function renderDashboardFolders() {
    if(!elements.dashboardFoldersGrid) return;
    const roots = getFolderChildren(null);
    elements.dashboardFoldersGrid.innerHTML = "";

    if(!roots.length) {
      elements.dashboardFoldersGrid.innerHTML = '<div class="folder-card empty-state">No folders yet. Create a new folder to get started.</div>';
      return;
    }

    roots.forEach((folder) => {
      const card = document.createElement("div");
      card.className = "folder-card folder-root-card";
      card.dataset.folder = folder.id;
      card.innerHTML = `
        <div class="folder-card-content">
          <div class="folder-icon-wrapper">
            <svg class="folder-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
            </svg>
          </div>
          <div class="folder-info">
            <h3>${escapeText(folder.name)}</h3>
            <p>${formatFolderSubtitle(folder)}</p>
          </div>
        </div>
        <div class="folder-card-actions">
          <button class="folder-card-action-btn" type="button" data-folder-action="rename" data-folder-id="${folder.id}" aria-label="Rename ${escapeText(folder.name)}">✎</button>
          <button class="folder-card-action-btn folder-card-delete" type="button" data-folder-action="delete" data-folder-id="${folder.id}" aria-label="Delete ${escapeText(folder.name)}">🗑</button>
        </div>
      `;
      elements.dashboardFoldersGrid.appendChild(card);
    });

    syncActiveFolderCards();
  }

  function formatFolderSubtitle(folder) {
    const childCount = getFolderChildren(folder.id).length;
    const label = childCount === 1 ? "subfolder" : "subfolders";
    return `${childCount} ${label}`;
  }

  function renderSubfolders(folderId) {
    if(!elements.subfolderGrid) return;
    const children = getFolderChildren(folderId);
    elements.subfolderGrid.innerHTML = "";

    if(!children.length) {
      elements.subfolderGrid.innerHTML = '<div class="folder-card empty-state">No subfolders found here.</div>';
      return;
    }

    children.forEach((subfolder) => {
      const card = document.createElement("div");
      card.className = "folder-card subfolder-card";
      card.dataset.folder = subfolder.id;
      card.innerHTML = `
        <div class="folder-card-content">
          <div class="folder-icon-wrapper">
            <svg class="folder-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
            </svg>
          </div>
          <div class="folder-info">
            <h3>${escapeText(subfolder.name)}</h3>
            <p>${formatFolderSubtitle(subfolder)}</p>
          </div>
        </div>
        <div class="folder-card-actions">
          <button class="folder-card-action-btn" type="button" data-folder-action="rename" data-folder-id="${subfolder.id}" aria-label="Rename ${escapeText(subfolder.name)}">✎</button>
          <button class="folder-card-action-btn folder-card-delete" type="button" data-folder-action="delete" data-folder-id="${subfolder.id}" aria-label="Delete ${escapeText(subfolder.name)}">🗑</button>
        </div>
      `;
      elements.subfolderGrid.appendChild(card);
    });

    syncActiveFolderCards();
  }

  function formatFolderTitle(folderId) {
    const folder = getFolderById(folderId);
    return folder ? folder.name : "Folder";
  }

  function updateBreadcrumbs() {
    if(!elements.folderBreadcrumbs) return;
    if(!state.activeFolderId) {
      elements.folderBreadcrumbs.textContent = "Root";
      return;
    }

    const path = getFolderPath(state.activeFolderId);
    elements.folderBreadcrumbs.innerHTML = path
      .map((folder, index) => {
        if(index === path.length - 1) {
          return `<span class="breadcrumb-current">${escapeText(folder.name)}</span>`;
        }
        return `<button type="button" class="breadcrumb-link" data-folder-id="${folder.id}">${escapeText(folder.name)}</button>`;
      })
      .join("<span class='breadcrumb-separator'>/</span>");

    const breadcrumbButtons = elements.folderBreadcrumbs.querySelectorAll(".breadcrumb-link");
    breadcrumbButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const folderId = button.dataset.folderId;
        if(folderId) openFolder(folderId);
      });
    });
  }

  function getNotesForFolder(folderId) {
    const folder = findFolderById(folderId);
    return folder ? Array.isArray(folder.notes) ? folder.notes.slice() : [] : [];
  }

  function saveNotesForFolder(folderId, notes) {
    const folder = findFolderById(folderId);
    if(!folder) return;
    folder.notes = Array.isArray(notes) ? notes.map((note) => String(note)) : [];
    saveFolderTree(folderTree);
  }

  function getFilesForFolder(folderId) {
    const folder = findFolderById(folderId);
    return folder ? Array.isArray(folder.files) ? folder.files.map((entry) => normalizeFileEntry(entry, folderId)) : [] : [];
  }

  function saveFilesForFolder(folderId, files) {
    const folder = findFolderById(folderId);
    if(!folder) return;
    folder.files = Array.isArray(files) ? files.map((entry) => normalizeFileEntry(entry, folderId)) : [];
    saveFolderTree(folderTree);
  }

  function setViewMode(viewMode) {
    state.viewMode = normalizeViewMode(viewMode);
    saveExplorerPreferences();
    syncToolbarState();
    renderFolderData();
  }

  function setSortBy(sortBy) {
    state.sortBy = normalizeSortMode(sortBy);
    saveExplorerPreferences();
    syncToolbarState();
    renderFiles();
  }

  function setFilterBy(filterBy) {
    state.filterBy = normalizeFilterMode(filterBy);
    saveExplorerPreferences();
    syncToolbarState();
    renderFiles();
  }

  function clearSelectedFiles() {
    state.selectedFileIds.clear();
    state.selectionMode = false;
    state.lastSelectedFileIndex = -1;
    updateSelectionBadge();
    syncFileSelectionState();
  }

  function toggleFileSelectionById(fileId, options = {}) {
    if(!fileId) return;

    const files = getVisibleFiles(state.activeFolderId);
    const index = files.findIndex((file) => file.id === fileId);
    if(index < 0) return;

    const replaceSelection = options.replaceSelection === true;
    const rangeSelection = options.rangeSelection === true;
    const additiveSelection = options.additiveSelection === true;

    if(rangeSelection && state.lastSelectedFileIndex >= 0) {
      const start = Math.min(state.lastSelectedFileIndex, index);
      const end = Math.max(state.lastSelectedFileIndex, index);
      if(replaceSelection) {
        state.selectedFileIds.clear();
      }
      files.slice(start, end + 1).forEach((file) => state.selectedFileIds.add(file.id));
      state.selectionMode = true;
      state.lastSelectedFileIndex = index;
      syncFileSelectionState();
      updateSelectionBadge();
      return;
    }

    if(replaceSelection) {
      state.selectedFileIds.clear();
      state.selectedFileIds.add(fileId);
      state.selectionMode = true;
    } else if(additiveSelection) {
      if(state.selectedFileIds.has(fileId)) {
        state.selectedFileIds.delete(fileId);
      } else {
        state.selectedFileIds.add(fileId);
      }
      state.selectionMode = state.selectedFileIds.size > 0;
    } else if(state.selectionMode) {
      if(state.selectedFileIds.has(fileId)) {
        state.selectedFileIds.delete(fileId);
      } else {
        state.selectedFileIds.add(fileId);
      }
    } else {
      state.selectedFileIds.clear();
      state.selectedFileIds.add(fileId);
      state.selectionMode = true;
    }

    state.lastSelectedFileIndex = index;
    updateSelectionBadge();
    syncFileSelectionState();
  }

  function syncFileSelectionState() {
    if(!elements.filesList) return;
    const fileCards = elements.filesList.querySelectorAll(".file-card");
    fileCards.forEach((card) => {
      const isSelected = state.selectedFileIds.has(card.dataset.fileId);
      card.classList.toggle("is-selected", isSelected);
      card.setAttribute("aria-selected", isSelected ? "true" : "false");
    });
  }

  function getVisibleFiles(folderId) {
    const files = getFilesForFolder(folderId);
    const filtered = files.filter((file) => matchesFileFilter(file, state.filterBy));
    return sortFiles(filtered, state.sortBy);
  }

  function matchesFileFilter(file, filterBy) {
    const category = getFileCategory(file);
    if(filterBy === "all") return true;
    return category === filterBy;
  }

  function sortFiles(files, sortBy) {
    const list = Array.isArray(files) ? files.slice() : [];
    const direction = 1;

    return list.sort((first, second) => {
      if(sortBy === "date") {
        return (Number(second.modifiedAt || second.uploadedAt || 0) - Number(first.modifiedAt || first.uploadedAt || 0)) * direction;
      }

      if(sortBy === "size") {
        return (Number(second.size) - Number(first.size)) * direction;
      }

      if(sortBy === "type") {
        const leftType = getFileTypeLabel(first);
        const rightType = getFileTypeLabel(second);
        const typeCompare = leftType.localeCompare(rightType, undefined, { sensitivity: "base" });
        if(typeCompare !== 0) return typeCompare;
      }

      return String(first.name || "").localeCompare(String(second.name || ""), undefined, { sensitivity: "base" });
    });
  }

  function getFileCategory(file) {
    const extension = String(file?.extension || "").toLowerCase();
    const type = String(file?.type || "").toLowerCase();

    if(type.startsWith("image/") || ["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "avif"].includes(extension)) {
      return "images";
    }

    if(extension === "pdf" || type === "application/pdf") {
      return "pdfs";
    }

    if(["doc", "docx", "xls", "xlsx", "ppt", "pptx", "rtf"].includes(extension)) {
      return "documents";
    }

    if(["txt", "md", "log", "json", "js", "ts", "html", "css", "xml", "yml", "yaml"].includes(extension) || type.startsWith("text/")) {
      return "notes";
    }

    return "others";
  }

  function getFileTypeLabel(file) {
    const category = getFileCategory(file);
    const extension = String(file?.extension || "").toUpperCase();
    const labels = {
      images: "Image",
      documents: "Document",
      pdfs: "PDF",
      notes: "Note",
      others: "Other"
    };
    if(!extension) return labels[category] || "File";
    return `${labels[category] || "File"} · ${extension}`;
  }

  function formatLastModified(file) {
    const value = Number(file?.modifiedAt || file?.uploadedAt || Date.now());
    return new Date(value).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit"
    });
  }

  function getFileDetails(file) {
    return {
      name: String(file?.name || "Untitled file"),
      type: getFileTypeLabel(file),
      size: formatBytes(Number(file?.size) || 0),
      modified: formatLastModified(file)
    };
  }

  function getActiveFileById(fileId) {
    if(!state.activeFolderId || !fileId) return null;
    const files = getFilesForFolder(state.activeFolderId);
    return files.find((file) => file.id === fileId) || null;
  }

  function getSelectedFileEntries() {
    const files = getVisibleFiles(state.activeFolderId);
    if(!state.selectedFileIds.size) return [];
    return files.filter((file) => state.selectedFileIds.has(file.id));
  }

  function handleFilesListClick(event) {
    const menuButton = event.target.closest(".file-card-menu-btn");
    if(menuButton) {
      event.stopPropagation();
      const fileId = menuButton.dataset.fileId;
      if(fileId) {
        const card = menuButton.closest(".file-card");
        openExplorerContextMenu({
          kind: "file",
          fileId,
          x: event.clientX || (card?.getBoundingClientRect().left || 0) + 30,
          y: event.clientY || (card?.getBoundingClientRect().top || 0) + 30
        });
      }
      return;
    }

    const card = event.target.closest(".file-card");
    if(!card) return;

    const fileId = card.dataset.fileId;
    if(!fileId) return;

    if(event.metaKey || event.ctrlKey) {
      toggleFileSelectionById(fileId, { additiveSelection: true });
      return;
    }

    if(event.shiftKey) {
      toggleFileSelectionById(fileId, { rangeSelection: true, replaceSelection: true });
      return;
    }

    if(state.selectionMode || state.selectedFileIds.size > 1) {
      if(state.selectedFileIds.size && !state.selectedFileIds.has(fileId)) {
        clearSelectedFiles();
      }
      toggleFileSelectionById(fileId, { replaceSelection: true });
      return;
    }

    openFileById(fileId);
  }

  function handleFilesListContextMenu(event) {
    const card = event.target.closest(".file-card");
    if(!card) return;
    event.preventDefault();
    openExplorerContextMenu({
      kind: "file",
      fileId: card.dataset.fileId,
      x: event.clientX,
      y: event.clientY
    });
  }

  function handleFilesListPointerDown(event) {
    const card = event.target.closest(".file-card");
    if(!card || event.pointerType !== "touch") return;
    if(event.target.closest(".file-card-menu-btn")) return;

    const fileId = card.dataset.fileId;
    if(!fileId) return;

    clearLongPressState();
    state.longPressFileId = fileId;
    state.longPressTimer = window.setTimeout(() => {
      state.longPressFired = true;
      toggleFileSelectionById(fileId, { replaceSelection: !state.selectedFileIds.has(fileId) });
      openExplorerContextMenu({
        kind: "file",
        fileId,
        x: event.clientX || window.innerWidth * 0.5,
        y: event.clientY || window.innerHeight * 0.5,
        pointerType: "touch"
      });
    }, 520);
  }

  function cancelFileLongPress() {
    if(state.longPressTimer) {
      window.clearTimeout(state.longPressTimer);
      state.longPressTimer = null;
    }
    if(state.longPressFired) {
      state.longPressFired = false;
    }
    state.longPressFileId = "";
  }

  function clearLongPressState() {
    cancelFileLongPress();
  }

  function handleFilesListDragStart(event) {
    const card = event.target.closest(".file-card");
    if(!card) return;
    if(event.target.closest(".file-card-menu-btn")) return;

    const fileId = card.dataset.fileId;
    if(!fileId) return;

    if(!state.selectedFileIds.has(fileId)) {
      clearSelectedFiles();
      toggleFileSelectionById(fileId, { replaceSelection: true });
    }

    state.dragFileIds = state.selectedFileIds.size ? Array.from(state.selectedFileIds) : [fileId];
    state.dragSourceFolderId = state.activeFolderId;

    if(event.dataTransfer) {
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", JSON.stringify({
        folderId: state.activeFolderId,
        fileIds: state.dragFileIds
      }));
    }
  }

  function handleFilesListDragEnd() {
    state.dragFileIds = [];
    state.dragSourceFolderId = "";
    clearFolderDropIndicators();
  }

  function handleFolderDragOver(event) {
    const card = event.target.closest(".folder-card");
    if(!card || !state.dragFileIds.length) return;

    event.preventDefault();
    event.dataTransfer && (event.dataTransfer.dropEffect = "move");
    card.classList.add("is-drop-target");
  }

  function handleFolderDragLeave(event) {
    const card = event.target.closest(".folder-card");
    if(!card) return;
    card.classList.remove("is-drop-target");
  }

  async function handleFolderDrop(event) {
    const card = event.target.closest(".folder-card");
    if(!card) return;

    event.preventDefault();
    card.classList.remove("is-drop-target");

    const targetFolderId = card.dataset.folder;
    if(!targetFolderId || !state.dragFileIds.length) return;

    await moveFilesToFolder(state.dragFileIds.slice(), targetFolderId);
    handleFilesListDragEnd();
  }

  function clearFolderDropIndicators() {
    document.querySelectorAll(".folder-card.is-drop-target").forEach((card) => card.classList.remove("is-drop-target"));
  }

  function openExplorerContextMenu(menuState) {
    if(!elements.contextMenu || !menuState) return;

    state.contextMenu = menuState;
    const menuItems = buildContextMenuItems(menuState);
    elements.contextMenu.innerHTML = menuItems.map((item) => `
      <button type="button" class="explorer-context-menu-item ${item.danger ? "is-danger" : ""}" data-context-action="${escapeText(item.action)}">
        <span class="explorer-context-menu-icon">${item.icon}</span>
        <span class="explorer-context-menu-label">${escapeText(item.label)}</span>
      </button>
    `).join("");

    elements.contextMenu.classList.remove("hidden");
    elements.contextMenu.setAttribute("aria-hidden", "false");

    const { x = 0, y = 0 } = menuState;
    const rect = elements.contextMenu.getBoundingClientRect();
    const left = Math.min(x, Math.max(12, window.innerWidth - rect.width - 12));
    const top = Math.min(y, Math.max(12, window.innerHeight - rect.height - 12));
    elements.contextMenu.style.left = `${Math.max(12, left)}px`;
    elements.contextMenu.style.top = `${Math.max(12, top)}px`;
    elements.contextMenu.classList.add("is-open");
  }

  function closeExplorerContextMenu() {
    if(!elements.contextMenu) return;
    elements.contextMenu.classList.add("hidden");
    elements.contextMenu.classList.remove("is-open");
    elements.contextMenu.setAttribute("aria-hidden", "true");
    elements.contextMenu.innerHTML = "";
    state.contextMenu = null;
  }

  function buildContextMenuItems(menuState) {
    if(menuState.kind === "folder") {
      return [
        { action: "open-folder", label: "Open", icon: "↗" },
        { action: "rename-folder", label: "Rename", icon: "✎" },
        { action: "delete-folder", label: "Delete", icon: "🗑", danger: true }
      ];
    }

    return [
      { action: "preview-file", label: "Preview", icon: "⌕" },
      { action: "download-file", label: "Download", icon: "↓" },
      { action: "rename-file", label: "Rename", icon: "✎" },
      { action: "move-file", label: "Move", icon: "⇄" },
      { action: "delete-file", label: "Delete", icon: "🗑", danger: true }
    ];
  }

  function handleContextMenuClick(event) {
    const button = event.target.closest("[data-context-action]");
    if(!button || !state.contextMenu) return;

    const action = button.dataset.contextAction;
    const target = state.contextMenu;
    closeExplorerContextMenu();

    if(target.kind === "folder") {
      handleFolderContextAction(action, target.folderId);
      return;
    }

    handleFileContextAction(action, target.fileId);
  }

  function handleFolderContextAction(action, folderId) {
    const folder = getFolderById(folderId);
    if(!folder) return;

    if(action === "open-folder") {
      openFolder(folderId);
      return;
    }

    if(action === "rename-folder") {
      const name = prompt("Rename folder", folder.name);
      if(name) {
        renameFolder(folderId, name.trim());
        renderDashboardFolders();
        if(state.activeFolderId === folderId) {
          updateBreadcrumbs();
          if(elements.folderTitle) elements.folderTitle.textContent = folder.name;
        }
      }
      return;
    }

    if(action === "delete-folder") {
      deleteFolder(folderId);
    }
  }

  function handleFileContextAction(action, fileId) {
    if(!fileId) return;

    if(action === "preview-file") {
      openFileById(fileId);
      return;
    }

    if(action === "download-file") {
      downloadFileById(fileId);
      return;
    }

    if(action === "rename-file") {
      renameFileById(fileId);
      return;
    }

    if(action === "move-file") {
      const ids = state.selectedFileIds.has(fileId) && state.selectedFileIds.size > 1
        ? Array.from(state.selectedFileIds)
        : [fileId];
      openMoveModal(ids);
      return;
    }

    if(action === "delete-file") {
      deleteFilesByIds(state.selectedFileIds.has(fileId) ? Array.from(state.selectedFileIds) : [fileId]);
    }
  }

  function renderMoveTargets() {
    if(!elements.moveTargetList || !elements.moveSubtitle) return;
    const folders = getAllFolders().filter((folder) => folder.id !== state.activeFolderId || folder.parentId !== folder.id);
    const selection = getSelectedFileEntries();
    elements.moveSubtitle.textContent = selection.length > 1
      ? `Move ${selection.length} files to another folder.`
      : `Move the selected file to another folder.`;

    elements.moveTargetList.innerHTML = folders.map((folder) => {
      const path = getFolderPath(folder.id).map((item) => item.name).join(" > ");
      const isCurrent = folder.id === state.activeFolderId;
      return `
        <button type="button" class="move-target-item ${isCurrent ? "is-current" : ""}" data-target-folder-id="${escapeText(folder.id)}" ${isCurrent ? "disabled" : ""}>
          <span class="move-target-name">${escapeText(folder.name)}</span>
          <span class="move-target-path">${escapeText(path)}</span>
        </button>
      `;
    }).join("");
  }

  function openMoveModal(fileIds) {
    if(!elements.moveModal || !elements.moveTargetList) return;

    const ids = Array.isArray(fileIds) ? fileIds.filter(Boolean) : [];
    if(!ids.length) return;

    state.moveSelection = ids;
    renderMoveTargets();
    elements.moveModal.classList.remove("hidden");
    elements.moveModal.setAttribute("aria-hidden", "false");
    elements.moveModal.classList.add("is-open");
  }

  function closeMoveModal() {
    if(!elements.moveModal) return;
    elements.moveModal.classList.add("hidden");
    elements.moveModal.classList.remove("is-open");
    elements.moveModal.setAttribute("aria-hidden", "true");
    state.moveSelection = [];
  }

  function getAllFolders(folders = folderTree, collected = []) {
    folders.forEach((folder) => {
      collected.push(folder);
      if(Array.isArray(folder.subfolders) && folder.subfolders.length) {
        getAllFolders(folder.subfolders, collected);
      }
    });
    return collected;
  }

  async function moveFilesToFolder(fileIds, targetFolderId) {
    if(!Array.isArray(fileIds) || !fileIds.length || !targetFolderId) return;

    const targetFolder = getFolderById(targetFolderId);
    if(!targetFolder) return;

    const sourceFolderId = state.activeFolderId;
    if(sourceFolderId === targetFolderId) return;
    const sourceFiles = getFilesForFolder(sourceFolderId);
    const targetFiles = getFilesForFolder(targetFolderId);
    const moveSet = new Set(fileIds);
    const movingFiles = sourceFiles.filter((file) => moveSet.has(file.id));
    if(!movingFiles.length) return;

    for(const file of movingFiles) {
      const nextFolderId = targetFolderId;
      const nextFileKey = `notepilot:file:${ACTIVE_USER_SLUG}:${nextFolderId}:${file.id}`;
      if(file.fileKey) {
        try {
          const record = await FileDatabase.getFileData(file.fileKey);
          if(record) {
            await FileDatabase.saveFileData(nextFileKey, {
              ...record,
              key: nextFileKey,
              folderId: nextFolderId
            });
            await FileDatabase.deleteFileData(file.fileKey);
          }
        } catch (error) {
          console.warn("Unable to move stored file data:", error);
        }
      }

      file.folderId = nextFolderId;
      file.modifiedAt = Date.now();
      file.fileKey = nextFileKey;
      targetFiles.push(file);
    }

    const remainingSourceFiles = sourceFiles.filter((file) => !moveSet.has(file.id));
    saveFilesForFolder(sourceFolderId, remainingSourceFiles);
    saveFilesForFolder(targetFolderId, targetFiles);
    clearSelectedFiles();

    if(state.activeFolderId === sourceFolderId) {
      renderFiles();
    }
  }

  function renameFileById(fileId) {
    const file = getActiveFileById(fileId);
    if(!file) return;
    const nextName = prompt("Rename file", file.name);
    if(!nextName) return;
    file.name = nextName.trim() || file.name;
    file.modifiedAt = Date.now();
    const files = getFilesForFolder(state.activeFolderId).map((entry) => entry.id === file.id ? file : entry);
    saveFilesForFolder(state.activeFolderId, files);
    renderFiles();
  }

  function deleteFilesByIds(fileIds) {
    if(!Array.isArray(fileIds) || !fileIds.length || !state.activeFolderId) return;

    const files = getFilesForFolder(state.activeFolderId);
    const targetIds = new Set(fileIds);
    const targets = files.filter((file) => targetIds.has(file.id));
    if(!targets.length) return;

    const message = targets.length === 1
      ? `Delete "${targets[0].name}" from ${formatFolderTitle(state.activeFolderId)}?`
      : `Delete ${targets.length} selected files from ${formatFolderTitle(state.activeFolderId)}?`;

    if(!confirm(message)) return;

    const remaining = files.filter((file) => !targetIds.has(file.id));
    targets.forEach((file) => {
      if(file.fileKey) {
        FileDatabase.deleteFileData(file.fileKey).catch(() => {});
      }
    });

    saveFilesForFolder(state.activeFolderId, remaining);
    clearSelectedFiles();
    renderFiles();
  }

  async function downloadFileById(fileId) {
    const file = getActiveFileById(fileId);
    if(!file) return;

    let blob = await getStoredFileBlob(file.fileKey);
    let downloadUrl = blob ? URL.createObjectURL(blob) : "";

    if(!downloadUrl && file.previewDataUrl) {
      downloadUrl = file.previewDataUrl;
    }

    if(!downloadUrl) return;

    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = file.name || "download";
    document.body.appendChild(link);
    link.click();
    link.remove();

    if(blob) {
      setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
    }
  }

  function openFileById(fileId) {
    const file = getActiveFileById(fileId);
    if(!file) return;
    openFile(file);
  }

  function openFolder(folderId) {

    if(!folderId) return;
    if(!getFolderById(folderId)) return;

    closeExplorerContextMenu();
    closeMoveModal();
    clearSelectedFiles();
    state.activeFolderId = folderId;
    persistFolderViewState(true, folderId);
    syncActiveFolderCards();

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

  function openFolderById(folderId) {
    if(!folderId || !getFolderById(folderId)) {
      return false;
    }

    openFolder(folderId);
    return true;
  }

  function closeFolder() {

    closeFilePreview();
    closeExplorerContextMenu();
    closeMoveModal();
    clearSelectedFiles();

    state.activeFolderId = "";
    persistFolderViewState(false);
    syncActiveFolderCards();

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

    await handleFileUpload(file);

    elements.fileInput.value = "";

  }

  async function handleChooseFile() {
    if(!state.activeFolderId) return;

    if(window.showOpenFilePicker) {
      try {
        const [handle] = await window.showOpenFilePicker({
          multiple: false,
          types: [
            {
              description: "Supported files",
              accept: {
                "image/*": [".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"],
                "application/pdf": [".pdf"],
                "text/plain": [".txt", ".md", ".log"],
                "text/csv": [".csv"],
                "application/json": [".json"],
                "text/javascript": [".js", ".ts"],
                "text/html": [".html"],
                "text/css": [".css"],
                "application/xml": [".xml"],
                "text/yaml": [".yml", ".yaml"],
                "application/msword": [".doc"],
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
                "application/vnd.ms-excel": [".xls"],
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
                "application/vnd.ms-powerpoint": [".ppt"],
                "application/vnd.openxmlformats-officedocument.presentationml.presentation": [".pptx"],
                "application/rtf": [".rtf"]
              }
            }
          ]
        });

        const file = await handle.getFile();

        if(file) {
          await handleFileUpload(file);
        }
        return;
      } catch (error) {
        if(error.name !== "AbortError") {
          console.warn("Safe file picker failed:", error);
        }
      }
    }

    if(elements.fileInput) {
      elements.fileInput.click();
    }
  }

  async function handleFileUpload(file) {
    if(!state.activeFolderId || !file) return;

    const files =
      getFilesForFolder(state.activeFolderId);

    const id =
      `file-${Math.random().toString(36).slice(2)}-${Date.now()}`;

    const fileKey =
      `notepilot:file:${ACTIVE_USER_SLUG}:${state.activeFolderId}:${id}`;

    const previewDataUrl =
      await getFilePreviewDataUrl(file);

    const fallbackTextData =
      await getFileTextFallback(file);

    const entry = {
      id,
      fileKey,
      name: file.name,
      type: file.type || "",
      size: file.size || 0,
      extension: getFileExtension(file.name),
      uploadedAt: Date.now(),
      modifiedAt: Date.now(),
      folderId: state.activeFolderId,
      previewDataUrl,
      textData: fallbackTextData || ""
    };

    let storedData = false;
    try {
      const fileData = await getFileBinaryData(file);
      if(!fileData) {
        throw new Error("File binary data could not be read.");
      }
      await FileDatabase.saveFileData(fileKey, {
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

    if(!storedData) {
      entry.previewDataUrl = entry.previewDataUrl || "";
      entry.textData = entry.textData || "";
    }

    files.push(entry);
    saveFilesForFolder(state.activeFolderId, files);
    renderFiles();
  }

  async function getFileTextFallback(file) {
    if(!file || !file.type) return "";

    const lowerType = file.type.toLowerCase();
    const supportedText =
      lowerType.startsWith("text/") ||
      ["application/json", "application/xml", "application/javascript", "application/xhtml+xml"].includes(lowerType);

    if(!supportedText) return "";
    if(file.size > 200 * 1024) return "";

    try {
      return await file.text();
    } catch {
      return "";
    }
  }

  async function getFileBinaryData(file) {
    if(!file) return null;

    if(typeof file.arrayBuffer === "function") {
      return await file.arrayBuffer();
    }

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if(reader.result instanceof ArrayBuffer) {
          resolve(reader.result);
        } else {
          reject(new Error("Unable to read file binary data"));
        }
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(file);
    });
  }

  async function legacyDeleteFile(index) {
    const files = getVisibleFiles(state.activeFolderId);
    const file = files[index];
    if(!file) return;
    deleteFilesByIds([file.id]);
  }

  function renderFolderData() {

    if(!state.activeFolderId) return;

    const notes =
      getNotesForFolder(state.activeFolderId);

    renderNotes(notes);
    renderFiles();
    renderSubfolders(state.activeFolderId);
    updateBreadcrumbs();
    syncActiveFolderCards();

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
      item.dataset.noteIndex = String(index);

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

  function renderFiles(files = null) {

    if(!elements.filesList) return;

    const activeFiles =
      Array.isArray(files) ? files : getVisibleFiles(state.activeFolderId);

    elements.filesList.classList.toggle("is-list-view", state.viewMode === "list");
    elements.filesList.classList.toggle("is-grid-view", state.viewMode === "grid");
    elements.filesList.dataset.viewMode = state.viewMode;
    elements.filesList.innerHTML = "";

    if(!activeFiles.length) {
      const emptyMessage = state.filterBy === "all"
        ? "No files in this folder yet."
        : "No files match the current filter.";
      elements.filesList.innerHTML = `<div class="file-item empty-state">${escapeText(emptyMessage)}</div>`;
      return;
    }

    activeFiles.forEach((file, index) => {
      const details = getFileDetails(file);
      const isSelected = state.selectedFileIds.has(file.id);

      const item =
        document.createElement("div");

      item.className = "file-item";

      item.innerHTML = `
        <div class="file-card ${isSelected ? "is-selected" : ""}" data-file-id="${escapeText(file.id)}" data-file-index="${index}" role="button" tabindex="0" draggable="true" aria-selected="${isSelected ? "true" : "false"}">
          <div class="file-card-top">
            <div class="file-preview ${file.previewDataUrl ? "has-preview" : ""}">
            ${
              file.previewDataUrl
                ? `<img src="${file.previewDataUrl}" alt="${escapeText(file.name)}" class="file-preview-image">`
                : `<div class="file-icon" aria-hidden="true">${getFileIconSvg(file.extension)}</div>`
            }
            </div>
            <button class="file-card-menu-btn" type="button" data-file-id="${escapeText(file.id)}" aria-label="File actions for ${escapeText(file.name)}">⋮</button>
          </div>
          <div class="file-meta">
            <p class="file-name" title="${escapeText(details.name)}">${escapeText(details.name)}</p>
            <div class="file-details">
              <div><span>Type</span><strong>${escapeText(details.type)}</strong></div>
              <div><span>Size</span><strong>${escapeText(details.size)}</strong></div>
              <div><span>Modified</span><strong>${escapeText(details.modified)}</strong></div>
            </div>
          </div>
        </div>
      `;

      elements.filesList.appendChild(item);

    });

  }

  function normalizeFileEntry(entry, folderId = state.activeFolderId) {

    if(typeof entry === "string") {
      const id = `file-${Math.random().toString(36).slice(2)}-${Date.now()}`;
      return {
        id,
        fileKey: `notepilot:file:${ACTIVE_USER_SLUG}:${folderId || "unknown"}:${id}`,
        name: entry,
        type: "",
        size: 0,
        extension: getFileExtension(entry),
        uploadedAt: Date.now(),
        modifiedAt: Date.now(),
        folderId: folderId || "",
        parentFolderId: null,
        previewDataUrl: "",
        textData: ""
      };
    }

    const id = entry.id || `file-${Math.random().toString(36).slice(2)}-${Date.now()}`;

    return {
      id,
      fileKey: entry.fileKey || `notepilot:file:${ACTIVE_USER_SLUG}:${folderId || "unknown"}:${id}`,
      name: entry.name || "Untitled file",
      type: entry.type || "",
      size: Number(entry.size) || 0,
      extension: entry.extension || getFileExtension(entry.name || ""),
      uploadedAt: entry.uploadedAt || Date.now(),
      modifiedAt: Number(entry.modifiedAt) || Number(entry.uploadedAt) || Date.now(),
      folderId: entry.folderId || folderId || "",
      parentFolderId: null,
      previewDataUrl: entry.previewDataUrl || "",
      textData: entry.textData || ""
    };

  }

  async function getStoredFileBlob(fileKey) {
    if(!fileKey) return null;

    try {
      const record = await FileDatabase.getFileData(fileKey);
      if(!record) return null;

      if(record.data) {
        const fileData = record.data instanceof ArrayBuffer
          ? record.data
          : (ArrayBuffer.isView(record.data)
            ? record.data.buffer.slice(record.data.byteOffset, record.data.byteOffset + record.data.byteLength)
            : null);

        if(fileData) {
          return new Blob([fileData], {
            type: record.type || ""
          });
        }
      }

      if(record.blob instanceof Blob) {
        return record.blob;
      }

      if(record.blob && typeof record.blob === "object" && record.blob.data) {
        return new Blob([record.blob.data], {
          type: record.blob.type || ""
        });
      }

      return null;
    } catch {
      return null;
    }
  }

  function getFilePreviewApi() {
    if(typeof window === "undefined") {
      return null;
    }

    const previewApi = window.FilePreview;

    if(!previewApi || typeof previewApi.open !== "function" || typeof previewApi.close !== "function") {
      return null;
    }

    return previewApi;
  }

  function legacyHandleFilesListClick(event) {
    const card = event.target.closest(".file-card");
    if(!card) return;

    const fileId = card.dataset.fileId;
    if(!fileId) return;

    if(event.target.closest(".file-card-menu-btn")) return;

    if(event.metaKey || event.ctrlKey) {
      toggleFileSelectionById(fileId, { additiveSelection: true });
      return;
    }

    if(event.shiftKey) {
      toggleFileSelectionById(fileId, { rangeSelection: true, replaceSelection: true });
      return;
    }

    if(state.selectionMode && state.selectedFileIds.size) {
      toggleFileSelectionById(fileId, { replaceSelection: !state.selectedFileIds.has(fileId) });
      return;
    }

    openFileById(fileId);
  }

  function legacyOpenFileAtIndex(index) {
    const files = getVisibleFiles(state.activeFolderId);
    if(!files[index]) return;
    openFile(files[index]);
  }

  async function openFile(fileEntry) {
    const previewApi = getFilePreviewApi();
    if(!previewApi || !fileEntry) return;

    await previewApi.open({
      file: fileEntry,
      subtitle: formatFileLabel(fileEntry),
      iconSvg: getFileIconSvg(fileEntry.extension),
      getBlob: () => getStoredFileBlob(fileEntry.fileKey)
    });
  }

  function closeFilePreview() {
    const previewApi = getFilePreviewApi();

    if(previewApi) {
      previewApi.close();
    }
  }

  function escapeSelectorValue(value) {
    const source = String(value || "");

    if(typeof CSS !== "undefined" && typeof CSS.escape === "function") {
      return CSS.escape(source);
    }

    return source.replace(/[\\"]/g, "\\$&");
  }

  function revealElement(element) {
    if(!element) return;

    element.classList.remove("search-hit");
    element.scrollIntoView({
      behavior: "smooth",
      block: "center",
      inline: "nearest"
    });

    requestAnimationFrame(() => {
      element.classList.add("search-hit");
      setTimeout(() => {
        element.classList.remove("search-hit");
      }, 980);
    });
  }

  function revealNoteByIndex(folderId, noteIndex) {
    if(!openFolderById(folderId)) {
      return false;
    }

    if(!Number.isInteger(noteIndex) || noteIndex < 0) {
      return false;
    }

    requestAnimationFrame(() => {
      const noteElement = elements.notesList
        ? elements.notesList.querySelector(`.note-item[data-note-index="${noteIndex}"]`)
        : null;
      revealElement(noteElement);
    });

    return true;
  }

  async function revealFileById(folderId, fileId, options = {}) {
    if(!openFolderById(folderId) || !fileId) {
      return false;
    }

    const files = getFilesForFolder(folderId);
    const targetFile = files.find((file) => file.id === fileId);

    if(!targetFile) {
      return false;
    }

    requestAnimationFrame(() => {
      const selector = `.file-card[data-file-id="${escapeSelectorValue(fileId)}"]`;
      const fileElement = elements.filesList ? elements.filesList.querySelector(selector) : null;
      revealElement(fileElement);
    });

    if(options.openPreview !== false) {
      await openFile(targetFile);
    }

    return true;
  }

  function getFolderTreeSnapshot() {
    return folderTree.map(cloneFolderForSnapshot);
  }

  function cloneFolderForSnapshot(folder) {
    if(!folder || typeof folder !== "object") {
      return null;
    }

    return {
      id: String(folder.id || ""),
      name: String(folder.name || "Folder"),
      parentId: folder.parentId || null,
      notes: Array.isArray(folder.notes) ? folder.notes.map((note) => String(note)) : [],
      files: Array.isArray(folder.files)
        ? folder.files.map((file) => ({
          id: String(file?.id || ""),
          name: String(file?.name || "Untitled file"),
          extension: String(file?.extension || ""),
          type: String(file?.type || ""),
          fileKey: String(file?.fileKey || "")
        }))
        : [],
      subfolders: Array.isArray(folder.subfolders)
        ? folder.subfolders.map(cloneFolderForSnapshot).filter(Boolean)
        : []
    };
  }

  function getActiveFolderId() {
    return state.activeFolderId || "";
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

    if(["xls", "xlsx", "csv"].includes(extension)) {
      return `
        <svg viewBox="0 0 24 24">
          <path d="M4 5a2 2 0 0 1 2-2h8l6 6v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5zm12-2v6h6M8 11h8M8 15h8M11 9v8M15 9v8" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      `;
    }

    if(["ppt", "pptx"].includes(extension)) {
      return `
        <svg viewBox="0 0 24 24">
          <path d="M4 5a2 2 0 0 1 2-2h8l6 6v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5zm12-2v6h6M8 11h7M8 15h4m4-1.5 2.5 1.5-2.5 1.5v-3z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
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
    openFolder: openFolderById,
    revealNoteByIndex,
    revealFileById,
    getFolderTreeSnapshot,
    getActiveFolderId,
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
    mobileMenuToggle: document.getElementById("mobileMenuToggle"),
    sidebarOverlay: document.getElementById("sidebarOverlay"),
    sidebarNav: document.getElementById("sidebarNav"),
    mainContent: document.querySelector(".main-content"),
    dashboardHeader: document.querySelector(".dashboard-header"),
    dashboardView: document.getElementById("dashboardView"),
    folderView: document.getElementById("folderView"),
    sections: {
      dashboard: document.getElementById("dashboardView"),
      files: document.getElementById("foldersSection"),
      tasks: document.getElementById("tasksSection"),
      notes: document.getElementById("notesSection")
    }
  };

  let activeTarget = "dashboard";

  function init() {

    if(!elements.sidebar || !elements.sidebarNav || !elements.mainContent) {
      return;
    }

    bindEvents();
    activeTarget =
      FolderSystem.isFolderOpen() ? "files" : "dashboard";
    updateActiveItem(activeTarget);

  }

  function bindEvents() {

    elements.sidebarNav.addEventListener("click", handleSidebarClick);

    if(elements.sidebarToggle) {
      elements.sidebarToggle.addEventListener("click", handleSidebarToggle);
    }

    if(elements.mobileMenuToggle) {
      elements.mobileMenuToggle.addEventListener("click", handleMobileMenuToggle);
    }

    if(elements.sidebarOverlay) {
      elements.sidebarOverlay.addEventListener("click", closeMobileSidebar);
    }

    document.addEventListener("click", handleOutsideSidebarClick);
    document.addEventListener("keydown", handleSidebarKeydown);
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

    const previousTarget = activeTarget;

    if(target === "settings") {
      window.notepilotPreviousNavTarget = previousTarget;
      activeTarget = target;
      updateActiveItem(target);
      closeMobileSidebar();
      return;
    }

    goTo(target);

  }

  function handleSidebarToggle(event) {

    event.stopPropagation();

    if(isMobileSidebarMode()) {
      setMobileSidebarOpen(!elements.sidebar.classList.contains("open"));
      return;
    }

    elements.sidebar.classList.toggle("collapsed");

  }

  function handleMobileMenuToggle(event) {

    event.stopPropagation();
    setMobileSidebarOpen(!elements.sidebar.classList.contains("open"));

  }

  function handleSidebarKeydown(event) {

    if(event.key === "Escape" && elements.sidebar.classList.contains("open")) {
      closeMobileSidebar();
      elements.mobileMenuToggle?.focus();
    }

  }

  function handleOutsideSidebarClick(event) {

    if(!isMobileSidebarMode()) return;

    if(
      !elements.sidebar.contains(event.target) &&
      !elements.sidebarToggle?.contains(event.target) &&
      !elements.mobileMenuToggle?.contains(event.target)
    ) {
      closeMobileSidebar();
    }

  }

  function handleResize() {

    if(!isMobileSidebarMode()) {
      closeMobileSidebar();
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
      "notes"
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

  function goTo(target) {
    if(!target || target === "logout" || target === "settings") {
      return;
    }

    if(FolderSystem.isFolderOpen() && target !== "files") {
      FolderSystem.closeFolder();
    }

    activeTarget = target;
    updateActiveItem(target);
    scrollToSection(target);
    closeMobileSidebar();
  }

  function scrollToSection(target) {

    if(target === "files" && FolderSystem.isFolderOpen()) {
      return;
    }

    if(elements.dashboardView.classList.contains("hidden")) {
      elements.dashboardView.classList.remove("hidden");
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

    setMobileSidebarOpen(false);

  }

  function setMobileSidebarOpen(shouldOpen) {

    const isOpen = Boolean(shouldOpen);

    elements.sidebar.classList.toggle("open", isOpen);
    elements.sidebar.classList.remove("active");
    elements.sidebarOverlay?.classList.toggle("is-visible", isOpen);
    elements.sidebarOverlay?.setAttribute("aria-hidden", isOpen ? "false" : "true");
    elements.mobileMenuToggle?.setAttribute("aria-expanded", isOpen ? "true" : "false");
    elements.mobileMenuToggle?.setAttribute(
      "aria-label",
      isOpen ? "Close navigation menu" : "Open navigation menu"
    );
    document.body.classList.toggle("sidebar-open", isOpen);

  }

  function isMobileSidebarMode() {

    const isCoarseTablet =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(max-width: 1200px) and (pointer: coarse)").matches;

    return window.innerWidth <= 992 || isCoarseTablet;

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
    init,
    goTo
  };

})();

NavigationSystem.init();

function pulseSearchElement(element) {
  if(!element) return;

  element.classList.remove("search-hit");
  element.scrollIntoView({
    behavior: "smooth",
    block: "center",
    inline: "nearest"
  });

  requestAnimationFrame(() => {
    element.classList.add("search-hit");
    setTimeout(() => {
      element.classList.remove("search-hit");
    }, 980);
  });
}

function openTaskFromSearch(taskIndex) {
  if(!Number.isInteger(taskIndex) || taskIndex < 0 || taskIndex >= tasks.length) {
    return false;
  }

  NavigationSystem.goTo("tasks");

  requestAnimationFrame(() => {
    const taskItem = taskList
      ? taskList.querySelector(`.task-item[data-task-index="${taskIndex}"]`)
      : null;
    pulseSearchElement(taskItem);
  });

  return true;
}

function openNotebookPageFromSearch(pageIndex) {
  if(
    !Number.isInteger(pageIndex) ||
    pageIndex < 0 ||
    pageIndex >= notebookState.pages.length
  ) {
    return false;
  }

  NavigationSystem.goTo("notes");

  notebookState.currentPage = pageIndex;
  saveNotebookState();
  renderCurrentNotebookPage(true);

  if(notesArea) {
    notesArea.focus();
    pulseSearchElement(notesArea);
  }

  return true;
}

window.NotePilotSearchBridge = {
  getSnapshot() {
    return {
      folderTree: FolderSystem.getFolderTreeSnapshot(),
      activeFolderId: FolderSystem.getActiveFolderId(),
      tasks: tasks.map((task, index) => ({
        index,
        text: String(task?.text || ""),
        completed: Boolean(task?.completed)
      })),
      notebookPages: notebookState.pages.map((page, index) => ({
        index,
        text: String(page || "")
      })),
      currentNotebookPage: Number(notebookState.currentPage) || 0
    };
  },
  goToSection(target) {
    NavigationSystem.goTo(target);
  },
  openFolder(folderId) {
    NavigationSystem.goTo("files");
    return FolderSystem.openFolder(folderId);
  },
  openFolderNote(folderId, noteIndex) {
    NavigationSystem.goTo("files");
    return FolderSystem.revealNoteByIndex(folderId, noteIndex);
  },
  async openFolderFile(folderId, fileId, options = {}) {
    NavigationSystem.goTo("files");
    return FolderSystem.revealFileById(folderId, fileId, options);
  },
  openTask(taskIndex) {
    return openTaskFromSearch(taskIndex);
  },
  openNotebookPage(pageIndex) {
    return openNotebookPageFromSearch(pageIndex);
  }
};


