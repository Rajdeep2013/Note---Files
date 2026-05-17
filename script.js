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
    folderTreeSection: document.getElementById("folderTreeSection"),
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

  const FOLDER_TREE_STORAGE_KEY =
    getUserScopedKey("folderTree");

  let folderTree = [];

  const STORAGE_PREFIX =
    `notepilot:folder:v3:${ACTIVE_USER_SLUG}`;

  function init() {

    if(!elements.dashboardView || !elements.folderView || !elements.folderTree || !elements.dashboardFoldersGrid) {
      return;
    }

    folderTree = loadFolderTree();
    bindEvents();
    renderFolderTree();
    renderDashboardFolders();

  }

  function bindEvents() {

    if(elements.folderTree) {
      elements.folderTree.addEventListener("click", handleFolderTreeClick);
    }

    if(elements.dashboardFoldersGrid) {
      elements.dashboardFoldersGrid.addEventListener("click", (event) => {
        const card = event.target.closest(".folder-card");
        if(!card) return;
        const folderId = card.dataset.folder;
        if(folderId) openFolder(folderId);
      });
    }

    if(elements.subfolderGrid) {
      elements.subfolderGrid.addEventListener("click", (event) => {
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
          renderFolderTree();
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
          renderFolderTree();
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

    if(elements.previewCloseBtn) {
      elements.previewCloseBtn.addEventListener("click", closeFilePreview);
    }

    if(elements.previewModal) {
      elements.previewModal.addEventListener("click", (event) => {
        if(event.target === elements.previewModal) {
          closeFilePreview();
        }
      });
    }

    document.addEventListener("keydown", (event) => {
      if(event.key === "Escape" && elements.previewModal && !elements.previewModal.classList.contains("hidden")) {
        closeFilePreview();
      }
    });

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
        const normalized = ensureDefaultRootFolders(parsed);
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
    if(!entry || typeof entry !== "object") return createFolderObject("New Folder", null);

    return {
      id: entry.id || `folder-${Math.random().toString(36).slice(2)}-${Date.now()}`,
      name: String(entry.name || "New Folder").trim() || "New Folder",
      parentId: entry.parentId || null,
      createdAt: Number(entry.createdAt) || Date.now(),
      open: typeof entry.open === "boolean" ? entry.open : true
    };
  }

  function getFolderById(folderId) {
    if(!folderId) return null;
    return folderTree.find((node) => node.id === folderId) || null;
  }

  function getFolderChildren(parentId) {
    return folderTree
      .filter((node) => node.parentId === (parentId || null))
      .sort((first, second) => first.name.localeCompare(second.name, undefined, { sensitivity: "base" }));
  }

  function getFolderPath(folderId) {
    const path = [];
    let current = getFolderById(folderId);
    while(current) {
      path.unshift(current);
      current = current.parentId ? getFolderById(current.parentId) : null;
    }
    return path;
  }

  function createFolder(name, parentId) {
    const folder = createFolderObject(name, parentId);
    folderTree.push(folder);
    saveFolderTree(folderTree);
    return folder;
  }

  function renameFolder(folderId, newName) {
    const folder = getFolderById(folderId);
    if(!folder || !newName) return null;
    folder.name = String(newName).trim() || folder.name;
    saveFolderTree(folderTree);
    return folder;
  }

  function toggleFolderOpen(folderId) {
    const folder = getFolderById(folderId);
    if(!folder) return;
    folder.open = !folder.open;
    saveFolderTree(folderTree);
  }

  function handleFolderTreeClick(event) {
    const treeItem = event.target.closest(".folder-tree-item");
    if(!treeItem) return;

    const folderId = treeItem.dataset.folderId;
    const action = event.target.dataset.folderAction;

    if(action === "toggle") {
      toggleFolderOpen(folderId);
      renderFolderTree();
      return;
    }

    if(action === "rename") {
      const folder = getFolderById(folderId);
      if(!folder) return;
      const name = prompt("Rename folder", folder.name);
      if(!name) return;
      renameFolder(folderId, name.trim());
      renderFolderTree();
      renderDashboardFolders();
      if(folderId === state.activeFolderId) {
        updateBreadcrumbs();
        elements.folderTitle.textContent = folder.name;
      }
      return;
    }

    if(event.target.closest(".folder-tree-action") || event.target.dataset.folderAction) {
      return;
    }

    openFolder(folderId);
  }

  function getFolderLabel(folder) {
    if(!folder) return "Folder";
    return folder.name;
  }

  function renderFolderTree() {
    if(!elements.folderTree) return;

    const buildTree = (parentId, level = 0) => {
      const children = getFolderChildren(parentId);
      if(!children.length) return "";

      return `
        <ul class="folder-tree-list ${level === 0 ? "root-level" : "nested-level"}">
          ${children.map((folder) => {
            const nested = buildTree(folder.id, level + 1);
            return `
              <li class="folder-tree-item" data-folder-id="${folder.id}">
                <button type="button" class="folder-tree-toggle" data-folder-action="toggle" aria-label="Toggle ${escapeText(folder.name)}">
                  ${nested ? (folder.open ? "▾" : "▸") : ""}
                </button>
                <span class="folder-tree-label">${escapeText(folder.name)}</span>
                <button type="button" class="folder-tree-action" data-folder-action="rename" aria-label="Rename ${escapeText(folder.name)}">✎</button>
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
    if(!elements.dashboardFoldersGrid) return;
    const roots = getFolderChildren(null);
    elements.dashboardFoldersGrid.innerHTML = "";

    if(!roots.length) {
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
            <h3>${escapeText(folder.name)}</h3>
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
    if(!elements.subfolderGrid) return;
    const children = getFolderChildren(folderId);
    elements.subfolderGrid.innerHTML = "";

    if(!children.length) {
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
            <h3>${escapeText(subfolder.name)}</h3>
            <p>${formatFolderSubtitle(subfolder)}</p>
          </div>
        </div>
      `;
      elements.subfolderGrid.appendChild(card);
    });
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
          return `<span>${escapeText(folder.name)}</span>`;
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
    if(!getFolderById(folderId)) return;

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

    closeFilePreview();

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
                "text/plain": [".txt"],
                "application/msword": [".doc"],
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
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
        <div class="file-card" data-index="${index}" role="button" tabindex="0">
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
      const id = `file-${Math.random().toString(36).slice(2)}-${Date.now()}`;
      return {
        id,
        fileKey: `notepilot:file:${ACTIVE_USER_SLUG}:${state.activeFolderId || "unknown"}:${id}`,
        name: entry,
        type: "",
        size: 0,
        extension: getFileExtension(entry),
        uploadedAt: Date.now(),
        folderId: state.activeFolderId || "",
        previewDataUrl: "",
        textData: ""
      };
    }

    const id = entry.id || `file-${Math.random().toString(36).slice(2)}-${Date.now()}`;

    return {
      id,
      fileKey: entry.fileKey || `notepilot:file:${ACTIVE_USER_SLUG}:${state.activeFolderId || "unknown"}:${id}`,
      name: entry.name || "Untitled file",
      type: entry.type || "",
      size: Number(entry.size) || 0,
      extension: entry.extension || getFileExtension(entry.name || ""),
      uploadedAt: entry.uploadedAt || Date.now(),
      folderId: entry.folderId || state.activeFolderId || "",
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
          : (ArrayBuffer.isView(record.data) ? record.data.buffer : null);

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
    if(!elements.previewModal || !elements.previewContent) return;

    showPreviewModal(true);
    setPreviewLoading(true);

    if(elements.previewTitle) {
      elements.previewTitle.textContent = fileEntry.name || "Preview";
    }

    if(elements.previewSubtitle) {
      elements.previewSubtitle.textContent = formatFileLabel(fileEntry);
    }

    if(elements.previewError) {
      elements.previewError.classList.add("hidden");
      elements.previewError.textContent = "";
    }

    elements.previewContent.innerHTML = "";

    const blob = await getStoredFileBlob(fileEntry.fileKey);

    const isImage =
      fileEntry.type.startsWith("image/") ||
      ["png","jpg","jpeg","gif","webp","svg"].includes(fileEntry.extension);
    const isPdf =
      fileEntry.type === "application/pdf" ||
      fileEntry.extension === "pdf";
    const isText =
      fileEntry.type.startsWith("text/") ||
      ["txt","md","json","csv","html","css","js"].includes(fileEntry.extension);

    if(blob) {
      const url = URL.createObjectURL(blob);
      if(isImage) {
        elements.previewContent.innerHTML =
          `<img src="${url}" alt="${escapeText(fileEntry.name)}">`;
      } else if(isPdf) {
        elements.previewContent.innerHTML = `
          <div class="preview-file-actions">
            <p>PDF preview is available in a new browser tab.</p>
            <a href="${url}" target="_blank" rel="noopener" class="preview-open-link">Open PDF in new tab</a>
            <a href="${url}" download="${escapeText(fileEntry.name)}" class="preview-download-link">Download PDF</a>
          </div>
        `;
      } else if(isText) {
        const text = await blob.text();
        elements.previewContent.innerHTML =
          `<pre>${escapeText(text)}</pre>`;
        URL.revokeObjectURL(url);
        setPreviewLoading(false);
        return;
      } else {
        elements.previewContent.innerHTML = `
          <div class="preview-fallback">
            <p>Preview unavailable for this file type.</p>
            <a href="${url}" download="${escapeText(fileEntry.name)}" class="preview-download-link">Download file</a>
          </div>
        `;
      }
      setPreviewLoading(false);
      return;
    }

    if(isImage && fileEntry.previewDataUrl) {
      elements.previewContent.innerHTML =
        `<img src="${fileEntry.previewDataUrl}" alt="${escapeText(fileEntry.name)}">`;
      setPreviewLoading(false);
      return;
    }

    if(isText && fileEntry.textData) {
      elements.previewContent.innerHTML =
        `<pre>${escapeText(fileEntry.textData)}</pre>`;
      setPreviewLoading(false);
      return;
    }

    setPreviewLoading(false);
    if(elements.previewError) {
      elements.previewError.textContent =
        "Unable to open this file safely. The file content is not available.";
      elements.previewError.classList.remove("hidden");
    }
  }

  function setPreviewLoading(isLoading) {
    if(!elements.previewLoader) return;
    elements.previewLoader.classList.toggle("hidden", !isLoading);
  }

  function showPreviewModal(show) {
    if(!elements.previewModal) return;
    elements.previewModal.classList.toggle("hidden", !show);
    elements.previewModal.setAttribute("aria-hidden", String(!show));
    if(show && elements.previewContent) {
      elements.previewContent.scrollTop = 0;
    }
  }

  function closeFilePreview() {
    if(!elements.previewModal) return;
    if(elements.previewContent) {
      const image = elements.previewContent.querySelector("img");
      const iframe = elements.previewContent.querySelector("iframe");
      const links = elements.previewContent.querySelectorAll("a");
      [image, iframe, ...links].forEach((media) => {
        if(!media) return;
        const url = media.src || media.href;
        if(url && url.startsWith("blob:")) {
          URL.revokeObjectURL(url);
        }
      });
      elements.previewContent.innerHTML = "";
    }
    showPreviewModal(false);
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
    sections: {
      dashboard: document.getElementById("dashboardView"),
      files: document.getElementById("foldersSection"),
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

    if(window.innerWidth <= 980) {
      elements.sidebar.classList.remove("open");
    }

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

