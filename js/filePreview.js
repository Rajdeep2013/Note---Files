(() => {
  "use strict";

  const SUPPORTED_IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "gif"]);
  const SUPPORTED_IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

  const SUPPORTED_TEXT_EXTENSIONS = new Set(["txt", "md", "json", "js", "html", "css"]);
  const SUPPORTED_TEXT_MIME_TYPES = new Set([
    "application/json",
    "application/javascript",
    "text/javascript",
    "application/x-javascript",
    "text/markdown"
  ]);

  const MAX_TEXT_PREVIEW_BYTES = 1024 * 1024;

  const state = {
    initialized: false,
    isOpen: false,
    isMaximized: false,
    imageScale: 1,
    requestToken: 0,
    closeTimerId: null,
    objectUrls: new Set()
  };

  const elements = {
    modal: null,
    panel: null,
    title: null,
    subtitle: null,
    typeBadge: null,
    downloadBtn: null,
    maxBtn: null,
    closeBtn: null,
    loader: null,
    error: null,
    content: null
  };

  function cacheElements() {
    elements.modal = document.getElementById("filePreviewModal");
    elements.panel = elements.modal?.querySelector(".preview-panel") || null;
    elements.title = document.getElementById("previewTitle");
    elements.subtitle = document.getElementById("previewSubtitle");
    elements.typeBadge = document.getElementById("previewTypeBadge");
    elements.downloadBtn = document.getElementById("previewDownloadBtn");
    elements.maxBtn = document.getElementById("previewMaxBtn");
    elements.closeBtn = document.getElementById("previewCloseBtn");
    elements.loader = document.getElementById("previewLoader");
    elements.error = document.getElementById("previewError");
    elements.content = document.getElementById("previewContent");
  }

  function init() {
    if(state.initialized) {
      return true;
    }

    cacheElements();

    if(!elements.modal || !elements.panel || !elements.content) {
      return false;
    }

    bindEvents();
    state.initialized = true;

    return true;
  }

  function bindEvents() {
    if(elements.closeBtn) {
      elements.closeBtn.addEventListener("click", close);
    }

    if(elements.maxBtn) {
      elements.maxBtn.addEventListener("click", () => {
        toggleMaximize();
      });
    }

    if(elements.modal) {
      elements.modal.addEventListener("click", (event) => {
        if(event.target === elements.modal) {
          close();
        }
      });
    }

    if(elements.downloadBtn) {
      elements.downloadBtn.addEventListener("click", (event) => {
        if(elements.downloadBtn.classList.contains("is-disabled")) {
          event.preventDefault();
        }
      });
    }

    if(elements.content) {
      elements.content.addEventListener("click", handleContentClick);
      elements.content.addEventListener("wheel", handleContentWheel, { passive: false });
    }

    document.addEventListener("keydown", (event) => {
      if(event.key === "Escape" && state.isOpen) {
        close();
      }
    });

    window.addEventListener("resize", handleViewportResize);
  }

  function handleContentClick(event) {
    const zoomButton = event.target.closest("[data-preview-zoom]");

    if(zoomButton) {
      const action = zoomButton.dataset.previewZoom;

      if(action === "in") {
        updateImageZoom(0.2);
      } else if(action === "out") {
        updateImageZoom(-0.2);
      } else {
        setImageZoom(1);
      }
      return;
    }

    const inlineDownload = event.target.closest("[data-preview-download]");

    if(inlineDownload && elements.downloadBtn && !elements.downloadBtn.classList.contains("is-disabled")) {
      elements.downloadBtn.click();
    }
  }

  function handleContentWheel(event) {
    const stage = event.target.closest(".preview-image-stage");

    if(!stage) {
      return;
    }

    event.preventDefault();

    if(event.deltaY < 0) {
      updateImageZoom(0.15);
    } else {
      updateImageZoom(-0.15);
    }
  }

  function handleViewportResize() {
    const viewportUnit = window.innerHeight * 0.01;
    document.documentElement.style.setProperty("--preview-vh", `${viewportUnit}px`);
  }

  async function open(options = {}) {
    if(!init()) {
      return;
    }

    const file = normalizeFileEntry(options.file);

    if(!file) {
      return;
    }

    const requestToken = ++state.requestToken;

    showModal();
    resetPreviewSurface(file, options.subtitle);
    setLoading(true);

    const blob = await resolveBlob(options.getBlob);

    if(requestToken !== state.requestToken) {
      return;
    }

    const typeInfo = detectFileType(file, blob?.type || "");

    updateTypeBadge(typeInfo.badge);

    let downloadUrl = "";

    if(blob) {
      downloadUrl = createManagedObjectUrl(blob);
    } else if(typeInfo.kind === "image" && isSafeImageDataUrl(file.previewDataUrl)) {
      downloadUrl = file.previewDataUrl;
    }

    updateDownloadButton(downloadUrl, file.name);

    try {
      if(typeInfo.kind === "image") {
        renderImagePreview(file, downloadUrl);
      } else if(typeInfo.kind === "pdf") {
        renderPdfPreview(file, blob, downloadUrl);
      } else if(typeInfo.kind === "text") {
        await renderTextPreview(file, blob, typeInfo);
      } else {
        renderUnsupportedPreview(file, typeInfo, options.iconSvg);
      }
    } catch {
      setError("Unable to open this file safely. Please use the download button.");
      renderUnsupportedPreview(file, typeInfo, options.iconSvg);
    }

    if(requestToken === state.requestToken) {
      setLoading(false);
    }
  }

  async function resolveBlob(getBlob) {
    if(typeof getBlob !== "function") {
      return null;
    }

    try {
      const blob = await getBlob();
      return blob instanceof Blob ? blob : null;
    } catch {
      return null;
    }
  }

  function renderImagePreview(file, blobUrl) {
    const source = blobUrl || (isSafeImageDataUrl(file.previewDataUrl) ? file.previewDataUrl : "");

    if(!source) {
      setError("Image preview is not available for this file.");
      renderUnsupportedPreview(file, detectFileType(file), "");
      return;
    }

    state.imageScale = 1;

    elements.content.innerHTML = `
      <div class="preview-image-shell">
        <div class="preview-image-controls">
          <button type="button" class="preview-zoom-btn" data-preview-zoom="out" aria-label="Zoom out">-</button>
          <span class="preview-zoom-label">100%</span>
          <button type="button" class="preview-zoom-btn" data-preview-zoom="in" aria-label="Zoom in">+</button>
          <button type="button" class="preview-zoom-btn" data-preview-zoom="reset" aria-label="Reset zoom">Reset</button>
        </div>
        <div class="preview-image-stage">
          <img src="${escapeHtml(source)}" alt="${escapeHtml(file.name)}" class="preview-image">
        </div>
      </div>
    `;
  }

  function renderPdfPreview(file, blob, existingUrl = "") {
    if(!(blob instanceof Blob)) {
      setError("PDF preview needs stored file data. Please re-upload this file.");
      renderUnsupportedPreview(file, detectFileType(file), "");
      return;
    }

    const pdfUrl = existingUrl || createManagedObjectUrl(blob);
    updateDownloadButton(pdfUrl, file.name);

    elements.content.innerHTML = `
      <div class="preview-pdf-shell">
        <iframe class="preview-pdf-frame" src="${escapeHtml(pdfUrl)}#toolbar=1&navpanes=0" title="${escapeHtml(file.name)}"></iframe>
      </div>
    `;
  }

  async function renderTextPreview(file, blob, typeInfo) {
    const text = await getTextPreviewContent(blob, file.textData);

    if(text === null) {
      setError("Text preview is unavailable for this file.");
      renderUnsupportedPreview(file, typeInfo, "");
      return;
    }

    const extensionLabel = typeInfo.extension ? typeInfo.extension.toUpperCase() : "TEXT";

    elements.content.innerHTML = `
      <div class="preview-text-shell">
        <div class="preview-text-head">
          <span class="preview-text-title">Code / Text Preview</span>
          <span class="preview-text-lang">${escapeHtml(extensionLabel)}</span>
        </div>
        <pre class="preview-text-block"><code>${escapeHtml(text)}</code></pre>
      </div>
    `;
  }

  async function getTextPreviewContent(blob, fallbackText) {
    if(blob instanceof Blob) {
      const previewBlob = blob.size > MAX_TEXT_PREVIEW_BYTES
        ? blob.slice(0, MAX_TEXT_PREVIEW_BYTES, blob.type)
        : blob;

      try {
        let text = await previewBlob.text();

        if(blob.size > MAX_TEXT_PREVIEW_BYTES) {
          text += "\n\n[Preview truncated at 1 MB]";
        }

        return text;
      } catch {
        // fall through
      }
    }

    if(typeof fallbackText === "string" && fallbackText.trim().length > 0) {
      return fallbackText;
    }

    if(typeof fallbackText === "string") {
      return fallbackText;
    }

    return null;
  }

  function renderUnsupportedPreview(file, typeInfo, iconSvg) {
    const typeLabel = typeInfo.badge || "FILE";
    const inlineActionClass = elements.downloadBtn?.classList.contains("is-disabled")
      ? "preview-inline-download is-disabled"
      : "preview-inline-download";

    elements.content.innerHTML = `
      <div class="preview-unsupported">
        <div class="preview-unsupported-icon" aria-hidden="true">
          ${iconSvg || defaultFileIconSvg()}
        </div>
        <p class="preview-unsupported-name" title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</p>
        <p class="preview-unsupported-type">${escapeHtml(typeLabel)} file preview is not supported in-app.</p>
        <button type="button" class="${inlineActionClass}" data-preview-download>Download File</button>
      </div>
    `;
  }

  function updateImageZoom(delta) {
    setImageZoom(state.imageScale + delta);
  }

  function setImageZoom(nextScale) {
    const image = elements.content?.querySelector(".preview-image");
    const label = elements.content?.querySelector(".preview-zoom-label");

    if(!image || !label) {
      return;
    }

    state.imageScale = Math.max(0.5, Math.min(4, Number(nextScale) || 1));

    image.style.transform = `scale(${state.imageScale})`;
    label.textContent = `${Math.round(state.imageScale * 100)}%`;
  }

  function resetPreviewSurface(file, subtitle) {
    clearError();
    clearRenderedContent();
    setTitle(file.name || "File Preview");
    setSubtitle(subtitle || "Previewing file content inside the app");
    updateTypeBadge("FILE");
    updateDownloadButton("", file.name || "file");
  }

  function applyMaximizeState(nextValue) {
    const shouldMaximize = Boolean(nextValue);
    state.isMaximized = shouldMaximize;

    if(elements.modal) {
      elements.modal.classList.toggle("maximized", shouldMaximize);
    }

    if(elements.maxBtn) {
      elements.maxBtn.classList.toggle("is-active", shouldMaximize);
      elements.maxBtn.setAttribute("aria-pressed", String(shouldMaximize));
      elements.maxBtn.setAttribute(
        "aria-label",
        shouldMaximize ? "Restore preview size" : "Maximize preview"
      );
    }
  }

  function toggleMaximize(forceValue) {
    if(!state.isOpen || !elements.modal) {
      return;
    }

    const nextValue = typeof forceValue === "boolean" ? forceValue : !state.isMaximized;
    applyMaximizeState(nextValue);
  }

  function clearRenderedContent() {
    revokeManagedObjectUrls();
    state.imageScale = 1;

    if(elements.content) {
      elements.content.innerHTML = "";
      elements.content.scrollTop = 0;
    }
  }

  function setTitle(value) {
    if(elements.title) {
      elements.title.textContent = value || "File Preview";
    }
  }

  function setSubtitle(value) {
    if(elements.subtitle) {
      elements.subtitle.textContent = value || "";
    }
  }

  function updateTypeBadge(value) {
    if(elements.typeBadge) {
      elements.typeBadge.textContent = value || "FILE";
    }
  }

  function setLoading(isLoading) {
    if(elements.loader) {
      elements.loader.classList.toggle("hidden", !isLoading);
    }
  }

  function setError(message) {
    if(!elements.error) {
      return;
    }

    if(message) {
      elements.error.textContent = message;
      elements.error.classList.remove("hidden");
    } else {
      elements.error.textContent = "";
      elements.error.classList.add("hidden");
    }
  }

  function clearError() {
    setError("");
  }

  function updateDownloadButton(url, fileName) {
    if(!elements.downloadBtn) {
      return;
    }

    if(url) {
      elements.downloadBtn.href = url;
      elements.downloadBtn.setAttribute("download", sanitizeDownloadName(fileName));
      elements.downloadBtn.classList.remove("is-disabled");
      elements.downloadBtn.setAttribute("aria-disabled", "false");
      return;
    }

    elements.downloadBtn.removeAttribute("href");
    elements.downloadBtn.removeAttribute("download");
    elements.downloadBtn.classList.add("is-disabled");
    elements.downloadBtn.setAttribute("aria-disabled", "true");
  }

  function sanitizeDownloadName(fileName) {
    const safeName = String(fileName || "file").trim();

    if(!safeName) {
      return "file";
    }

    return safeName.replace(/[\\/:*?"<>|]+/g, "_");
  }

  function createManagedObjectUrl(blob) {
    const url = URL.createObjectURL(blob);
    state.objectUrls.add(url);

    return url;
  }

  function revokeManagedObjectUrls() {
    state.objectUrls.forEach((url) => {
      try {
        URL.revokeObjectURL(url);
      } catch {
        // best effort
      }
    });

    state.objectUrls.clear();
  }

  function detectFileType(fileEntry, resolvedMime = "") {
    const extension = normalizeExtension(fileEntry?.extension || fileEntry?.name || "");
    const mime = String(resolvedMime || fileEntry?.type || "").toLowerCase();

    if(SUPPORTED_IMAGE_EXTENSIONS.has(extension) || SUPPORTED_IMAGE_MIME_TYPES.has(mime)) {
      return {
        kind: "image",
        extension,
        mime,
        badge: extension ? extension.toUpperCase() : "IMAGE"
      };
    }

    if(extension === "pdf" || mime === "application/pdf") {
      return {
        kind: "pdf",
        extension,
        mime,
        badge: "PDF"
      };
    }

    if(SUPPORTED_TEXT_EXTENSIONS.has(extension) || isTextMime(mime)) {
      return {
        kind: "text",
        extension,
        mime,
        badge: extension ? extension.toUpperCase() : "TEXT"
      };
    }

    return {
      kind: "unsupported",
      extension,
      mime,
      badge: extension ? extension.toUpperCase() : "FILE"
    };
  }

  function isTextMime(mime) {
    if(!mime) {
      return false;
    }

    return mime.startsWith("text/") || SUPPORTED_TEXT_MIME_TYPES.has(mime);
  }

  function normalizeExtension(value) {
    const source = String(value || "").trim().toLowerCase();

    if(!source) {
      return "";
    }

    if(source.includes(".")) {
      const parts = source.split(".");
      return parts.pop() || "";
    }

    return source;
  }

  function normalizeFileEntry(fileEntry) {
    if(!fileEntry || typeof fileEntry !== "object") {
      return null;
    }

    return {
      name: String(fileEntry.name || "Untitled file"),
      type: String(fileEntry.type || ""),
      extension: normalizeExtension(fileEntry.extension || fileEntry.name || ""),
      size: Number(fileEntry.size) || 0,
      previewDataUrl: typeof fileEntry.previewDataUrl === "string" ? fileEntry.previewDataUrl : "",
      textData: typeof fileEntry.textData === "string" ? fileEntry.textData : ""
    };
  }

  function isSafeImageDataUrl(value) {
    return /^data:image\/(jpeg|jpg|png|webp|gif);base64,/i.test(String(value || ""));
  }

  function defaultFileIconSvg() {
    return `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 5a2 2 0 0 1 2-2h8l6 6v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5zm12-2v6h6" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `;
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function showModal() {
    if(!elements.modal) {
      return;
    }

    clearTimeout(state.closeTimerId);

    elements.modal.classList.remove("hidden");
    elements.modal.setAttribute("aria-hidden", "false");

    requestAnimationFrame(() => {
      elements.modal.classList.add("is-open");
    });

    state.isOpen = true;
    document.body.classList.add("preview-open");
    applyMaximizeState(state.isMaximized);
  }

  function close() {
    if(!init()) {
      return;
    }

    state.requestToken += 1;

    elements.modal.classList.remove("is-open");
    elements.modal.setAttribute("aria-hidden", "true");

    state.isOpen = false;
    document.body.classList.remove("preview-open");
    applyMaximizeState(false);

    clearRenderedContent();
    clearError();
    setLoading(false);
    updateTypeBadge("FILE");
    updateDownloadButton("", "file");

    clearTimeout(state.closeTimerId);

    state.closeTimerId = setTimeout(() => {
      if(elements.modal) {
        elements.modal.classList.add("hidden");
      }
    }, 220);
  }

  window.FilePreview = {
    init,
    open,
    close,
    detectFileType
  };

  if(document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }

  handleViewportResize();
})();
