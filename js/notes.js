window.Notepilot.NotesSystem = (() => {
  const taskInput = document.getElementById("taskInput");
  const addTaskBtn = document.getElementById("addTaskBtn");
  const taskList = document.getElementById("taskList");
  const notesArea = document.getElementById("notesArea");
  const prevPageBtn = document.getElementById("prevPageBtn");
  const nextPageBtn = document.getElementById("nextPageBtn");
  const newPageBtn = document.getElementById("newPageBtn");
  const deletePageBtn = document.getElementById("deletePageBtn");
  const notesPageIndicator = document.getElementById("notesPageIndicator");

  const TASKS_STORAGE_KEY = window.Notepilot.Auth.getUserScopedKey("tasks");
  const LEGACY_TASKS_STORAGE_KEY = "tasks";

  let tasks = window.Notepilot.Storage.safeParseStoredArray(
    localStorage.getItem(TASKS_STORAGE_KEY) ?? localStorage.getItem(LEGACY_TASKS_STORAGE_KEY)
  );

  if (
    localStorage.getItem(TASKS_STORAGE_KEY) === null &&
    localStorage.getItem(LEGACY_TASKS_STORAGE_KEY) !== null
  ) {
    localStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(tasks));
  }

  const notebookState = {
    pages: [""],
    currentPage: 0
  };

  function saveTasks() {
    localStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(tasks));
  }

  function loadTasks() {
    if (!taskList) return;
    taskList.innerHTML = "";
    if (!tasks.length) {
      taskList.innerHTML = '<li class="task-item empty-state">No tasks yet. Add one above.</li>';
      return;
    }
    tasks.forEach((task, index) => {
      const li = document.createElement("li");
      li.className = "task-item";
      if (task.completed) {
        li.classList.add("completed");
      }
      li.innerHTML = `
        <div class="task-left">
          <label>
            <input type="checkbox" data-task-index="${index}" ${task.completed ? "checked" : ""}>
            <span>${window.Notepilot.utils.escapeText(task.text)}</span>
          </label>
        </div>
        <button type="button" class="task-delete" data-task-index="${index}">Delete</button>
      `;
      taskList.appendChild(li);
    });
  }

  function addTask() {
    if (!taskInput) return;
    const taskText = taskInput.value.trim();
    if (taskText === "") return;
    tasks.push({ text: taskText, completed: false });
    saveTasks();
    loadTasks();
    taskInput.value = "";
  }

  function toggleTask(index) {
    if (tasks[index]) {
      tasks[index].completed = !tasks[index].completed;
      saveTasks();
      loadTasks();
    }
  }

  function deleteTask(index) {
    if (index < 0 || !tasks[index]) return;
    tasks.splice(index, 1);
    saveTasks();
    loadTasks();
  }

  function handleTaskListChange(event) {
    const checkbox = event.target.closest("input[type=checkbox]");
    if (!checkbox) return;
    const index = Number(checkbox.dataset.taskIndex);
    if (Number.isNaN(index)) return;
    toggleTask(index);
  }

  function handleTaskListClick(event) {
    const deleteButton = event.target.closest("button[data-task-index]");
    if (!deleteButton) return;
    const index = Number(deleteButton.dataset.taskIndex);
    if (Number.isNaN(index)) return;
    deleteTask(index);
  }

  function loadNotebookState() {
    const savedPagesRaw =
      localStorage.getItem(window.Notepilot.Auth.getUserScopedKey("notebook:pages")) ??
      localStorage.getItem("notepilot:notebook:pages");
    const savedPageIndexRaw =
      localStorage.getItem(window.Notepilot.Auth.getUserScopedKey("notebook:current-page")) ??
      localStorage.getItem("notepilot:notebook:current-page");

    try {
      const parsedPages = JSON.parse(savedPagesRaw || "[]");
      if (Array.isArray(parsedPages) && parsedPages.length) {
        notebookState.pages = parsedPages.map((page) => String(page));
      }
    } catch {
      notebookState.pages = [""];
    }

    if (
      (!savedPagesRaw || (notebookState.pages.length === 1 && notebookState.pages[0] === "")) &&
      localStorage.getItem("notes")
    ) {
      notebookState.pages[0] = localStorage.getItem("notes") || "";
    }

    const parsedIndex = Number(savedPageIndexRaw);
    if (Number.isInteger(parsedIndex) && parsedIndex >= 0) {
      notebookState.currentPage = Math.min(parsedIndex, notebookState.pages.length - 1);
    }
  }

  function saveNotebookState() {
    localStorage.setItem(
      window.Notepilot.Auth.getUserScopedKey("notebook:pages"),
      JSON.stringify(notebookState.pages)
    );
    localStorage.setItem(
      window.Notepilot.Auth.getUserScopedKey("notebook:current-page"),
      String(notebookState.currentPage)
    );
  }

  function updateNotebookControls() {
    if (notesPageIndicator) {
      notesPageIndicator.textContent = `Page ${notebookState.currentPage + 1} / ${notebookState.pages.length}`;
    }
    if (prevPageBtn) {
      prevPageBtn.disabled = notebookState.currentPage === 0;
    }
    if (nextPageBtn) {
      nextPageBtn.disabled = notebookState.currentPage >= notebookState.pages.length - 1;
    }
    if (deletePageBtn) {
      deletePageBtn.disabled = notebookState.pages.length <= 1;
    }
  }

  function renderCurrentNotebookPage(animate = false) {
    if (!notesArea) return;
    if (animate) {
      notesArea.classList.remove("page-switch");
      requestAnimationFrame(() => {
        notesArea.classList.add("page-switch");
      });
    }
    notesArea.value = notebookState.pages[notebookState.currentPage] || "";
    updateNotebookControls();
  }

  function changeNotebookPage(nextIndex) {
    if (nextIndex < 0 || nextIndex >= notebookState.pages.length) return;
    notebookState.currentPage = nextIndex;
    saveNotebookState();
    renderCurrentNotebookPage(true);
  }

  function createNotebookPage() {
    notebookState.pages.push("");
    notebookState.currentPage = notebookState.pages.length - 1;
    saveNotebookState();
    renderCurrentNotebookPage(true);
    notesArea?.focus();
  }

  function deleteCurrentNotebookPage() {
    if (notebookState.pages.length <= 1) return;
    const shouldDelete = confirm(`Delete Page ${notebookState.currentPage + 1}?`);
    if (!shouldDelete) return;
    notebookState.pages.splice(notebookState.currentPage, 1);
    if (notebookState.currentPage >= notebookState.pages.length) {
      notebookState.currentPage = notebookState.pages.length - 1;
    }
    saveNotebookState();
    notesArea?.classList.remove("page-delete-switch");
    requestAnimationFrame(() => {
      notesArea?.classList.add("page-delete-switch");
    });
    renderCurrentNotebookPage(true);
    notesArea?.focus();
  }

  function bindNotebookEvents() {
    if (notesArea) {
      notesArea.addEventListener("input", () => {
        notebookState.pages[notebookState.currentPage] = notesArea.value;
        saveNotebookState();
      });
    }
    if (prevPageBtn) {
      prevPageBtn.addEventListener("click", () => {
        changeNotebookPage(notebookState.currentPage - 1);
      });
    }
    if (nextPageBtn) {
      nextPageBtn.addEventListener("click", () => {
        changeNotebookPage(notebookState.currentPage + 1);
      });
    }
    if (newPageBtn) {
      newPageBtn.addEventListener("click", createNotebookPage);
    }
    if (deletePageBtn) {
      deletePageBtn.addEventListener("click", deleteCurrentNotebookPage);
    }
  }

  function init() {
    if (taskList && addTaskBtn) {
      addTaskBtn.addEventListener("click", addTask);
      taskList.addEventListener("change", handleTaskListChange);
      taskList.addEventListener("click", handleTaskListClick);
      loadTasks();
    }
    if (notesArea) {
      loadNotebookState();
      renderCurrentNotebookPage();
      bindNotebookEvents();
    }
  }

  return {
    init
  };
})();

window.Notepilot.registerModule(window.Notepilot.NotesSystem.init);
