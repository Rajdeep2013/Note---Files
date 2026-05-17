window.Notepilot.NavigationSystem = (() => {
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
    if (!elements.sidebar || !elements.sidebarNav || !elements.mainContent) {
      return;
    }
    bindEvents();
    updateActiveItem(activeTarget);
  }

  function bindEvents() {
    elements.sidebarNav.addEventListener("click", handleSidebarClick);
    if (elements.sidebarToggle) {
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
    const navItem = event.target.closest(".nav-item");
    if (!navItem || !elements.sidebarNav.contains(navItem)) return;
    const target = navItem.dataset.navTarget;
    if (!target || target === "logout") {
      return;
    }
    event.preventDefault();
    if (window.Notepilot.FolderSystem?.isFolderOpen() && target !== "files") {
      window.Notepilot.FolderSystem.closeFolder();
    }
    activeTarget = target;
    updateActiveItem(target);
    scrollToSection(target);
    closeMobileSidebar();
  }

  function handleSidebarToggle(event) {
    event.stopPropagation();
    if (window.innerWidth <= 980) {
      elements.sidebar.classList.toggle("open");
      return;
    }
    elements.sidebar.classList.toggle("collapsed");
  }

  function handleOutsideSidebarClick(event) {
    if (window.innerWidth > 980) return;
    if (!elements.sidebar.contains(event.target) && !elements.sidebarToggle?.contains(event.target)) {
      elements.sidebar.classList.remove("open");
    }
  }

  function handleResize() {
    if (window.innerWidth > 980) {
      elements.sidebar.classList.remove("open");
      return;
    }
    elements.sidebar.classList.remove("collapsed");
  }

  function handleMainScroll() {
    if (window.Notepilot.FolderSystem?.isFolderOpen()) return;
    const headerHeight = (elements.dashboardHeader?.offsetHeight || 0) + 32;
    const sectionOrder = ["dashboard", "files", "tasks", "notes", "ai"];
    let resolved = "dashboard";
    sectionOrder.forEach((key) => {
      const section = elements.sections[key];
      if (!section) return;
      const sectionTop = section.getBoundingClientRect().top - elements.mainContent.getBoundingClientRect().top;
      if (sectionTop <= headerHeight) {
        resolved = key;
      }
    });
    if (resolved !== activeTarget) {
      activeTarget = resolved;
      updateActiveItem(activeTarget);
    }
  }

  function scrollToSection(target) {
    if (target === "files" && window.Notepilot.FolderSystem?.isFolderOpen()) {
      return;
    }
    if (elements.dashboardView.classList.contains("hidden")) {
      elements.dashboardView.classList.remove("hidden");
      elements.folderView.classList.add("hidden");
    }
    const section = elements.sections[target] || elements.sections.dashboard;
    if (!section) return;
    const headerOffset = (elements.dashboardHeader?.offsetHeight || 0) + 14;
    const mainRect = elements.mainContent.getBoundingClientRect();
    const sectionRect = section.getBoundingClientRect();
    const top = elements.mainContent.scrollTop + sectionRect.top - mainRect.top - headerOffset;
    elements.mainContent.scrollTo({ top: Math.max(top, 0), behavior: "smooth" });
  }

  function closeMobileSidebar() {
    if (window.innerWidth <= 980) {
      elements.sidebar.classList.remove("open");
    }
  }

  function updateActiveItem(target) {
    const navItems = elements.sidebarNav.querySelectorAll(".nav-item");
    navItems.forEach((item) => {
      item.classList.toggle("active", item.dataset.navTarget === target);
    });
  }

  return {
    init
  };
})();

window.Notepilot.registerModule(window.Notepilot.NavigationSystem.init);

window.addEventListener("DOMContentLoaded", () => {
  if (window.Notepilot && typeof window.Notepilot.start === "function") {
    window.Notepilot.start();
  }
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", (event) => {
      event.preventDefault();
      localStorage.removeItem(AUTH_SESSION_KEY);
      window.location.href = "login.html";
    });
  }
});
