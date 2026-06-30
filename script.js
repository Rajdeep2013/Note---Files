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

const totalFoldersCount =
  document.getElementById("totalFoldersCount");

const totalFilesCount =
  document.getElementById("totalFilesCount");

const totalNotesCount =
  document.getElementById("totalNotesCount");

const totalTasksCount =
  document.getElementById("totalTasksCount");

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

  if(totalFoldersCount) totalFoldersCount.textContent = String(counts.folders);
  if(totalFilesCount) totalFilesCount.textContent = String(counts.files);
  if(totalNotesCount) totalNotesCount.textContent = String(noteTotal);
  if(totalTasksCount) totalTasksCount.textContent = String(Array.isArray(tasks) ? tasks.length : 0);
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
    notifySearchDataChanged("tasks");

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
    newRootFolderBtn: document.getElementById("newRootFolderBtn"),
    newSubfolderBtn: document.getElementById("newSubfolderBtn"),
    backBtn: document.getElementById("backBtn"),
    addNoteBtn: document.getElementById("addNoteBtn"),
    notesList: document.getElementById("notesList"),
    addFileBtn: document.getElementById("addFileBtn"),
    fileInput: document.getElementById("fileInput"),
    filesList: document.getElementById("filesList"),
    subfolderGrid: document.getElementById("subfolderGrid")
  };

  const state = {
    activeFolderId: ""
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

    folderTree = loadFolderTree();
    bindEvents();
    renderDashboardFolders();
    updateWorkspaceStats();
    restorePersistedFolderViewState();

    const previewApi = getFilePreviewApi();
    if(previewApi && typeof previewApi.init === "function") {
      previewApi.init();
    }

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
      elements.newRootFolderBtn.addEventListener("click", () => {
        const name = prompt("New root folder name", "New Folder");
        if(!name) return;
        const folder = createFolder(name.trim(), null);
        if(folder) {
          renderDashboardFolders();
        }
      });
    }

    if(elements.newSubfolderBtn) {
      elements.newSubfolderBtn.addEventListener("click", () => {
        if(!state.activeFolderId) return;
        const name = prompt("New subfolder name", "New Subfolder");
        if(!name) return;
        const folder = createFolder(name.trim(), state.activeFolderId);
        if(folder) {
          renderSubfolders(state.activeFolderId);
          renderDashboardFolders();
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
      elements.filesList.addEventListener("click", handleFilesListClick);
      elements.filesList.addEventListener("keydown", (event) => {
        if(event.key !== "Enter" && event.key !== " ") return;
        const card = event.target.closest(".file-card");
        if(!card || !elements.filesList.contains(card)) return;
        event.preventDefault();
        const index = Number(card.dataset.index);
        if(!Number.isNaN(index)) {
          openFileAtIndex(index);
        }
      });
    }

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

  function openFolder(folderId) {

    if(!folderId) return;
    if(!getFolderById(folderId)) return;

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
    renderFiles(files);
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

  async function deleteFile(index) {

    if(!state.activeFolderId || index < 0) return;

    const files =
      getFilesForFolder(state.activeFolderId);

    const file = files[index];

    if(!file) return;

    const shouldDelete =
      confirm(`Delete "${file.name}" from ${formatFolderTitle(state.activeFolderId)}?`);

    if(!shouldDelete) return;

    files.splice(index, 1);

    saveFilesForFolder(state.activeFolderId, files);

    if(file.fileKey) {
      FileDatabase.deleteFileData(file.fileKey).catch(() => {});
    }

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
        <div class="file-card" data-index="${index}" data-file-id="${escapeText(file.id)}" role="button" tabindex="0">
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
          <div class="file-actions">
            <button class="file-open-btn" type="button" data-index="${index}" aria-label="Open ${escapeText(file.name)}">Open</button>
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

  function handleFilesListClick(event) {
    const deleteBtn =
      event.target.closest(".file-delete-btn");

    if(deleteBtn) {
      const index = Number(deleteBtn.dataset.index);
      if(!Number.isNaN(index)) {
        deleteFile(index);
      }
      return;
    }

    const card = event.target.closest(".file-card");
    if(!card) return;

    const index = Number(card.dataset.index);
    if(Number.isNaN(index)) return;

    openFileAtIndex(index);
  }

  function openFileAtIndex(index) {
    const files = getFilesForFolder(state.activeFolderId);
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


