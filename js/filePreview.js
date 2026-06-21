(() => {
  "use strict";

  const SUPPORTED_IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "gif", "svg", "bmp", "avif"]);
  const SUPPORTED_IMAGE_MIME_TYPES = new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "image/svg+xml",
    "image/bmp",
    "image/avif"
  ]);

  const SUPPORTED_CODE_EXTENSIONS = new Set([
    "js",
    "ts",
    "jsx",
    "tsx",
    "json",
    "html",
    "css",
    "xml",
    "yaml",
    "yml",
    "py",
    "java",
    "c",
    "cpp",
    "cs",
    "php",
    "rb",
    "go",
    "rs",
    "sql",
    "sh",
    "bat",
    "ps1"
  ]);

  const SUPPORTED_TEXT_EXTENSIONS = new Set([
    "txt",
    "md",
    "markdown",
    "csv",
    "log",
    "rtf",
    ...SUPPORTED_CODE_EXTENSIONS
  ]);

  const SUPPORTED_TEXT_MIME_TYPES = new Set([
    "application/json",
    "application/javascript",
    "text/javascript",
    "application/x-javascript",
    "text/markdown",
    "text/xml",
    "application/xml",
    "application/xhtml+xml",
    "text/csv",
    "application/csv",
    "application/rtf"
  ]);

  const OFFICE_MIME_TYPES = {
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    xls: "application/vnd.ms-excel",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ppt: "application/vnd.ms-powerpoint"
  };

  const MAX_TEXT_PREVIEW_BYTES = 1024 * 1024;
  const MAX_DOCX_PREVIEW_BYTES = 25 * 1024 * 1024;
  const MAX_XLSX_PREVIEW_BYTES = 25 * 1024 * 1024;
  const MAX_EXCEL_ROWS = 100;
  const MAX_EXCEL_COLUMNS = 50;
  const MAX_SHEET_TABS = 12;
  const MAX_PPTX_PREVIEW_BYTES = 35 * 1024 * 1024;
  const MAX_PPTX_SLIDES = 24;
  const MAX_PPTX_XML_BYTES = 4 * 1024 * 1024;
  const MAX_PPTX_SLIDE_TEXT = 1800;

  const state = {
    initialized: false,
    isOpen: false,
    isMaximized: false,
    imageScale: 1,
    requestToken: 0,
    closeTimerId: null,
    objectUrls: new Set(),
    currentFileEntry: null,
    xlsxWorkbook: null
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
      } else if(action === "actual") {
        setImageZoom(1, "actual");
      } else {
        setImageZoom(1, "fit");
      }
      return;
    }

    const sheetButton = event.target.closest("[data-preview-sheet]");

    if(sheetButton) {
      const sheetIndex = Number(sheetButton.dataset.previewSheet);
      if(Number.isInteger(sheetIndex)) {
        renderXlsxSheet(sheetIndex);
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
    updateImageZoom(event.deltaY < 0 ? 0.15 : -0.15);
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

    state.currentFileEntry = file;
    state.xlsxWorkbook = null;
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
      } else if(typeInfo.kind === "docx") {
        await renderDocxPreview(file, blob);
      } else if(typeInfo.kind === "xlsx") {
        await renderXlsxPreview(file, blob);
      } else if(typeInfo.kind === "pptx") {
        await renderPptxPreview(file, blob, typeInfo);
      } else {
        renderUnsupportedPreview(file, typeInfo, options.iconSvg);
      }
    } catch(error) {
      setError(`Unable to preview file: ${error?.message || "Unknown error"}`);
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
      setError("Image preview is not available for this file. Re-upload it, then try again.");
      renderUnsupportedPreview(file, detectFileType(file), "");
      return;
    }

    state.imageScale = 1;

    elements.content.innerHTML = `
      <div class="preview-image-shell">
        <div class="preview-image-controls" aria-label="Image preview controls">
          <button type="button" class="preview-zoom-btn" data-preview-zoom="fit" aria-label="Fit image to screen">Fit</button>
          <button type="button" class="preview-zoom-btn" data-preview-zoom="actual" aria-label="Show image at actual size">100%</button>
          <button type="button" class="preview-zoom-btn" data-preview-zoom="out" aria-label="Zoom out">-</button>
          <span class="preview-zoom-label">Fit</span>
          <button type="button" class="preview-zoom-btn" data-preview-zoom="in" aria-label="Zoom in">+</button>
        </div>
        <div class="preview-image-stage">
          <img src="${escapeHtml(source)}" alt="${escapeHtml(file.name)}" class="preview-image is-fit">
        </div>
      </div>
    `;
  }

  function renderPdfPreview(file, blob, existingUrl = "") {
    if(!(blob instanceof Blob)) {
      setError("PDF preview needs stored file data. Re-upload this PDF, then try again.");
      renderUnsupportedPreview(file, detectFileType(file), "");
      return;
    }

    const pdfUrl = existingUrl || createManagedObjectUrl(blob);
    updateDownloadButton(pdfUrl, file.name);

    elements.content.innerHTML = `
      <div class="preview-pdf-shell">
        <iframe class="preview-pdf-frame" src="${escapeHtml(pdfUrl)}#toolbar=1&navpanes=0" title="${escapeHtml(file.name)}" allow="fullscreen"></iframe>
      </div>
    `;
  }

  async function renderTextPreview(file, blob, typeInfo) {
    const text = await getTextPreviewContent(blob, file.textData);

    if(text === null) {
      setError("Text preview is unavailable for this file. Re-upload it, then try again.");
      renderUnsupportedPreview(file, typeInfo, "");
      return;
    }

    const extensionLabel = typeInfo.extension ? typeInfo.extension.toUpperCase() : "TEXT";
    const shouldHighlight = isCodeType(typeInfo.extension, typeInfo.mime);

    if(!shouldHighlight) {
      elements.content.innerHTML = `
        <div class="preview-text-shell">
          <div class="preview-text-head">
            <span class="preview-text-title">Text Preview</span>
            <span class="preview-text-lang">${escapeHtml(extensionLabel)}</span>
          </div>
          <pre class="preview-text-block preview-plain-text"><code>${escapeHtml(text)}</code></pre>
        </div>
      `;
      return;
    }

    let codeHtml = escapeHtml(text);
    let languageLabel = extensionLabel;

    if(typeof hljs !== "undefined") {
      try {
        const language = getHighlightLanguage(typeInfo.extension);
        const highlighted = hljs.highlight(text, { language, ignoreIllegals: true });
        codeHtml = highlighted.value;
        languageLabel = language.toUpperCase();
      } catch {
        codeHtml = escapeHtml(text);
      }
    }

    elements.content.innerHTML = `
      <div class="preview-text-shell preview-code-shell">
        <div class="preview-text-head">
          <span class="preview-text-title">Code Preview</span>
          <span class="preview-text-lang">${escapeHtml(languageLabel)}</span>
        </div>
        <div class="preview-code-grid">
          <pre class="preview-line-numbers" aria-hidden="true">${buildLineNumbers(text)}</pre>
          <pre class="preview-text-block preview-code-highlighted"><code>${codeHtml}</code></pre>
        </div>
      </div>
    `;
  }

  async function renderDocxPreview(file, blob) {
    if(!(blob instanceof Blob)) {
      setError("DOCX preview requires stored file data. Re-upload this DOCX, then try again.");
      renderUnsupportedPreview(file, detectFileType(file), "");
      return;
    }

    if(blob.size > MAX_DOCX_PREVIEW_BYTES) {
      setError(`This DOCX is too large to preview safely in the browser. Download it to view the full document.`);
      renderUnsupportedPreview(file, detectFileType(file), "");
      return;
    }

    if(typeof mammoth === "undefined" || typeof mammoth.convertToHtml !== "function") {
      setError("DOCX preview library is not available. Check your connection, refresh the app, and try again.");
      renderUnsupportedPreview(file, detectFileType(file), "");
      return;
    }

    try {
      const arrayBuffer = await blob.arrayBuffer();
      const result = await mammoth.convertToHtml(
        { arrayBuffer },
        {
          styleMap: [
            "p[style-name='Title'] => h1:fresh",
            "p[style-name='Subtitle'] => p:fresh"
          ]
        }
      );

      const safeHtml = sanitizeDocxHtml(result.value);
      const messages = Array.isArray(result.messages)
        ? result.messages.filter((message) => message && message.message)
        : [];

      elements.content.innerHTML = `
        <div class="preview-docx-shell">
          <article class="preview-docx-content">
            ${safeHtml || "<p>This DOCX did not contain readable document text.</p>"}
          </article>
          ${messages.length ? `<p class="preview-docx-note">${escapeHtml(messages.length === 1 ? messages[0].message : `${messages.length} document formatting notices were ignored.`)}</p>` : ""}
        </div>
      `;
    } catch(error) {
      setError(`We could not read this DOCX. The file may be encrypted, corrupted, or saved in an unsupported Word format.`);
      renderUnsupportedPreview(file, detectFileType(file), "");
    }
  }

  async function renderXlsxPreview(file, blob) {
    if(!(blob instanceof Blob)) {
      setError("Excel preview requires stored file data. Re-upload this spreadsheet, then try again.");
      renderUnsupportedPreview(file, detectFileType(file), "");
      return;
    }

    if(blob.size > MAX_XLSX_PREVIEW_BYTES) {
      setError("This spreadsheet is too large to preview safely in the browser. Download it to view the full workbook.");
      renderUnsupportedPreview(file, detectFileType(file), "");
      return;
    }

    if(typeof XLSX === "undefined" || typeof XLSX.read !== "function") {
      setError("Spreadsheet preview library is not available. Check your connection, refresh the app, and try again.");
      renderUnsupportedPreview(file, detectFileType(file), "");
      return;
    }

    try {
      const arrayBuffer = await blob.arrayBuffer();
      state.xlsxWorkbook = XLSX.read(arrayBuffer, {
        type: "array",
        cellDates: true,
        dense: false
      });

      renderXlsxSheet(0);
    } catch(error) {
      state.xlsxWorkbook = null;
      setError(`Failed to preview spreadsheet: ${error?.message || "Unknown error"}`);
      renderUnsupportedPreview(file, detectFileType(file), "");
    }
  }

  function renderXlsxSheet(sheetIndex = 0) {
    const workbook = state.xlsxWorkbook;

    if(!workbook || !Array.isArray(workbook.SheetNames) || !workbook.SheetNames.length) {
      setError("This workbook does not contain any readable sheets.");
      return;
    }

    const safeIndex = Math.max(0, Math.min(sheetIndex, workbook.SheetNames.length - 1));
    const sheetName = workbook.SheetNames[safeIndex];
    const sheet = workbook.Sheets[sheetName];

    if(!sheet) {
      setError("This sheet could not be read.");
      return;
    }

    const rows = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: "",
      raw: false,
      blankrows: false
    });

    const maxColumns = Math.min(
      MAX_EXCEL_COLUMNS,
      Math.max(1, ...rows.map((row) => Array.isArray(row) ? row.length : 0))
    );
    const visibleRows = rows.slice(0, MAX_EXCEL_ROWS);
    const sheetTabs = workbook.SheetNames.slice(0, MAX_SHEET_TABS)
      .map((name, index) => `
        <button type="button" class="preview-xlsx-tab ${index === safeIndex ? "is-active" : ""}" data-preview-sheet="${index}">
          ${escapeHtml(name)}
        </button>
      `)
      .join("");

    const hasHiddenTabs = workbook.SheetNames.length > MAX_SHEET_TABS;
    const tableHtml = buildSpreadsheetTable(visibleRows, maxColumns);
    const rowCount = rows.length;
    const truncatedRows = rowCount > MAX_EXCEL_ROWS;
    const truncatedColumns = rows.some((row) => Array.isArray(row) && row.length > MAX_EXCEL_COLUMNS);

    elements.content.innerHTML = `
      <div class="preview-xlsx-shell">
        <div class="preview-xlsx-meta">
          <span class="preview-xlsx-sheet">Sheet: ${escapeHtml(sheetName)}</span>
          <span class="preview-xlsx-count">${workbook.SheetNames.length} sheet${workbook.SheetNames.length !== 1 ? "s" : ""}</span>
        </div>
        <div class="preview-xlsx-tabs" role="tablist" aria-label="Workbook sheets">
          ${sheetTabs}
          ${hasHiddenTabs ? `<span class="preview-xlsx-tab-note">+${workbook.SheetNames.length - MAX_SHEET_TABS} more</span>` : ""}
        </div>
        <div class="preview-xlsx-content">
          ${tableHtml}
        </div>
        ${(truncatedRows || truncatedColumns) ? `<p class="preview-xlsx-note">Showing ${Math.min(rowCount, MAX_EXCEL_ROWS)} rows and up to ${maxColumns} columns for browser performance.</p>` : ""}
      </div>
    `;
  }

  function buildSpreadsheetTable(rows, maxColumns) {
    if(!rows.length || rows.every((row) => !Array.isArray(row) || row.every((cell) => String(cell || "").trim() === ""))) {
      return `<div class="preview-xlsx-empty">This sheet is empty.</div>`;
    }

    const columnHeadings = Array.from({ length: maxColumns }, (_, index) => {
      return `<th scope="col">${escapeHtml(getSpreadsheetColumnName(index))}</th>`;
    }).join("");

    const bodyRows = rows.map((row, rowIndex) => {
      const cells = Array.from({ length: maxColumns }, (_, columnIndex) => {
        const value = Array.isArray(row) ? row[columnIndex] : "";
        return `<td>${escapeHtml(formatSpreadsheetCell(value))}</td>`;
      }).join("");

      return `
        <tr>
          <th scope="row">${rowIndex + 1}</th>
          ${cells}
        </tr>
      `;
    }).join("");

    return `
      <table class="preview-xlsx-table">
        <thead>
          <tr>
            <th class="preview-xlsx-corner" aria-label="Row"></th>
            ${columnHeadings}
          </tr>
        </thead>
        <tbody>${bodyRows}</tbody>
      </table>
    `;
  }

  async function renderPptxPreview(file, blob, typeInfo) {
    if(!(blob instanceof Blob)) {
      setError("PowerPoint preview requires stored file data. Re-upload this presentation, then try again.");
      renderPptxFallback(file);
      return;
    }

    if(typeInfo.extension === "ppt" || blob.size > MAX_PPTX_PREVIEW_BYTES) {
      setError("This presentation cannot be rendered directly in the browser. Download it to view the full slides.");
      renderPptxFallback(file);
      return;
    }

    try {
      const arrayBuffer = await blob.arrayBuffer();
      const slides = await extractPptxSlides(arrayBuffer);

      if(!slides.length) {
        renderPptxFallback(file, "No slide text could be extracted from this PPTX.");
        return;
      }

      const slideCards = slides.map((slide) => `
        <article class="preview-pptx-slide">
          <div class="preview-pptx-slide-number">Slide ${slide.index}</div>
          <div class="preview-pptx-slide-text">
            ${slide.lines.length ? slide.lines.map((line) => `<p>${escapeHtml(line)}</p>`).join("") : "<p>No readable text on this slide.</p>"}
          </div>
        </article>
      `).join("");

      elements.content.innerHTML = `
        <div class="preview-pptx-shell preview-pptx-outline">
          <div class="preview-pptx-summary">
            <p class="preview-pptx-title">PowerPoint Outline Preview</p>
            <p class="preview-pptx-message">Showing extracted slide text. Download the file for full layout, media, animations, and speaker notes.</p>
          </div>
          <div class="preview-pptx-slides">
            ${slideCards}
          </div>
          ${slides.length >= MAX_PPTX_SLIDES ? `<p class="preview-pptx-note">Showing the first ${MAX_PPTX_SLIDES} slides.</p>` : ""}
        </div>
      `;
    } catch(error) {
      setError("PowerPoint outline preview is unavailable for this file. Download it to view the full presentation.");
      renderPptxFallback(file);
    }
  }

  function renderPptxFallback(file, message = "Presentation layout preview is limited in the browser. Download to view full slides.") {
    elements.content.innerHTML = `
      <div class="preview-pptx-shell">
        <div class="preview-unsupported-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path d="M3 7v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7M3 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2m-8 3v4m-4-4v4m8-4v4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <p class="preview-pptx-title">PowerPoint Preview</p>
        <p class="preview-pptx-message">${escapeHtml(message)}</p>
        <button type="button" class="preview-inline-download" data-preview-download>Download Presentation</button>
      </div>
    `;
  }

  async function extractPptxSlides(arrayBuffer) {
    const entries = readZipDirectory(arrayBuffer);
    const slideEntries = entries
      .filter((entry) => /^ppt\/slides\/slide\d+\.xml$/i.test(entry.name))
      .sort((first, second) => getSlideNumber(first.name) - getSlideNumber(second.name))
      .slice(0, MAX_PPTX_SLIDES);

    const slides = [];

    for(const entry of slideEntries) {
      const xml = await readZipEntryText(arrayBuffer, entry);
      const lines = extractSlideLines(xml);
      slides.push({
        index: getSlideNumber(entry.name),
        lines
      });
    }

    return slides;
  }

  function readZipDirectory(arrayBuffer) {
    const view = new DataView(arrayBuffer);
    const length = view.byteLength;
    const searchStart = Math.max(0, length - 0xffff - 22);
    let eocdOffset = -1;

    for(let offset = length - 22; offset >= searchStart; offset--) {
      if(view.getUint32(offset, true) === 0x06054b50) {
        eocdOffset = offset;
        break;
      }
    }

    if(eocdOffset < 0) {
      throw new Error("ZIP directory not found");
    }

    const totalEntries = view.getUint16(eocdOffset + 10, true);
    const centralDirectoryOffset = view.getUint32(eocdOffset + 16, true);
    const decoder = new TextDecoder("utf-8");
    const entries = [];
    let offset = centralDirectoryOffset;

    for(let index = 0; index < totalEntries && offset + 46 <= length; index++) {
      if(view.getUint32(offset, true) !== 0x02014b50) {
        break;
      }

      const method = view.getUint16(offset + 10, true);
      const compressedSize = view.getUint32(offset + 20, true);
      const uncompressedSize = view.getUint32(offset + 24, true);
      const fileNameLength = view.getUint16(offset + 28, true);
      const extraLength = view.getUint16(offset + 30, true);
      const commentLength = view.getUint16(offset + 32, true);
      const localHeaderOffset = view.getUint32(offset + 42, true);
      const nameStart = offset + 46;
      const nameBytes = new Uint8Array(arrayBuffer, nameStart, fileNameLength);
      const name = decoder.decode(nameBytes);

      entries.push({
        name,
        method,
        compressedSize,
        uncompressedSize,
        localHeaderOffset
      });

      offset += 46 + fileNameLength + extraLength + commentLength;
    }

    return entries;
  }

  async function readZipEntryText(arrayBuffer, entry) {
    if(entry.uncompressedSize > MAX_PPTX_XML_BYTES || entry.compressedSize > MAX_PPTX_XML_BYTES) {
      throw new Error("Slide XML is too large");
    }

    const view = new DataView(arrayBuffer);

    if(view.getUint32(entry.localHeaderOffset, true) !== 0x04034b50) {
      throw new Error("ZIP local header not found");
    }

    const fileNameLength = view.getUint16(entry.localHeaderOffset + 26, true);
    const extraLength = view.getUint16(entry.localHeaderOffset + 28, true);
    const dataStart = entry.localHeaderOffset + 30 + fileNameLength + extraLength;
    const dataEnd = dataStart + entry.compressedSize;

    if(dataStart < 0 || dataEnd > arrayBuffer.byteLength) {
      throw new Error("ZIP entry data is invalid");
    }

    const compressedBytes = new Uint8Array(arrayBuffer, dataStart, entry.compressedSize);
    let outputBytes = compressedBytes;

    if(entry.method === 8) {
      outputBytes = await inflateRawBytes(compressedBytes);
    } else if(entry.method !== 0) {
      throw new Error("Unsupported ZIP compression method");
    }

    return new TextDecoder("utf-8").decode(outputBytes);
  }

  async function inflateRawBytes(bytes) {
    if(typeof DecompressionStream === "undefined") {
      throw new Error("Browser does not support ZIP decompression");
    }

    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    const arrayBuffer = await new Response(stream).arrayBuffer();
    return new Uint8Array(arrayBuffer);
  }

  function extractSlideLines(xml) {
    const parser = new DOMParser();
    const documentXml = parser.parseFromString(xml, "application/xml");

    if(documentXml.getElementsByTagName("parsererror").length) {
      return [];
    }

    const paragraphs = Array.from(documentXml.getElementsByTagName("*"))
      .filter((node) => node.localName === "p");

    const lines = paragraphs
      .map((paragraph) => Array.from(paragraph.getElementsByTagName("*"))
        .filter((node) => node.localName === "t")
        .map((node) => node.textContent || "")
        .join("")
        .replace(/\s+/g, " ")
        .trim())
      .filter(Boolean);

    const uniqueLines = [];
    const seen = new Set();

    lines.forEach((line) => {
      const clipped = line.length > MAX_PPTX_SLIDE_TEXT
        ? `${line.slice(0, MAX_PPTX_SLIDE_TEXT)}...`
        : line;

      if(!seen.has(clipped)) {
        uniqueLines.push(clipped);
        seen.add(clipped);
      }
    });

    return uniqueLines;
  }

  function getSlideNumber(name) {
    const match = String(name || "").match(/slide(\d+)\.xml$/i);
    return match ? Number(match[1]) : 0;
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
        // Fall through to the stored text fallback.
      }
    }

    if(typeof fallbackText === "string") {
      return fallbackText;
    }

    return null;
  }

  function renderUnsupportedPreview(file, typeInfo, iconSvg) {
    const typeLabel = typeInfo.badge || "FILE";
    const isDisabled = elements.downloadBtn?.classList.contains("is-disabled");
    const inlineActionClass = isDisabled ? "preview-inline-download is-disabled" : "preview-inline-download";

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
    setImageZoom(state.imageScale + delta, "zoom");
  }

  function setImageZoom(nextScale, mode = "zoom") {
    const image = elements.content?.querySelector(".preview-image");
    const label = elements.content?.querySelector(".preview-zoom-label");

    if(!image || !label) {
      return;
    }

    if(mode === "fit") {
      state.imageScale = 1;
      image.classList.add("is-fit");
      image.classList.remove("is-actual");
      image.style.transform = "scale(1)";
      label.textContent = "Fit";
      return;
    }

    state.imageScale = Math.max(0.25, Math.min(5, Number(nextScale) || 1));
    image.classList.toggle("is-actual", mode === "actual");
    image.classList.remove("is-fit");
    image.style.transform = `scale(${state.imageScale})`;
    label.textContent = `${Math.round(state.imageScale * 100)}%`;
  }

  function resetPreviewSurface(file, subtitle) {
    clearError();
    clearRenderedContent();
    setTitle(file.name || "File Preview");
    setSubtitle(subtitle || formatFileLabel(file));
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
      elements.maxBtn.setAttribute(
        "title",
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
    state.xlsxWorkbook = null;

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
        // Best effort cleanup.
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

    if(extension === "docx" || mime === OFFICE_MIME_TYPES.docx) {
      return {
        kind: "docx",
        extension: "docx",
        mime,
        badge: "DOCX"
      };
    }

    if(["xlsx", "xls"].includes(extension) || mime === OFFICE_MIME_TYPES.xlsx || mime === OFFICE_MIME_TYPES.xls) {
      return {
        kind: "xlsx",
        extension: extension || (mime === OFFICE_MIME_TYPES.xls ? "xls" : "xlsx"),
        mime,
        badge: extension === "xls" || mime === OFFICE_MIME_TYPES.xls ? "XLS" : "XLSX"
      };
    }

    if(["pptx", "ppt"].includes(extension) || mime === OFFICE_MIME_TYPES.pptx || mime === OFFICE_MIME_TYPES.ppt) {
      return {
        kind: "pptx",
        extension: extension || (mime === OFFICE_MIME_TYPES.ppt ? "ppt" : "pptx"),
        mime,
        badge: extension === "ppt" || mime === OFFICE_MIME_TYPES.ppt ? "PPT" : "PPTX"
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

  function isCodeType(extension, mime) {
    return SUPPORTED_CODE_EXTENSIONS.has(extension) ||
      ["application/json", "application/javascript", "text/javascript", "application/x-javascript"].includes(mime);
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

  function getHighlightLanguage(extension) {
    const langMap = {
      js: "javascript",
      ts: "typescript",
      jsx: "javascript",
      tsx: "typescript",
      json: "json",
      html: "xml",
      css: "css",
      xml: "xml",
      yaml: "yaml",
      yml: "yaml",
      py: "python",
      java: "java",
      c: "c",
      cpp: "cpp",
      cs: "csharp",
      php: "php",
      rb: "ruby",
      go: "go",
      rs: "rust",
      sql: "sql",
      sh: "bash",
      bat: "dos",
      ps1: "powershell"
    };

    const language = langMap[extension] || "plaintext";

    if(typeof hljs !== "undefined" && typeof hljs.getLanguage === "function" && !hljs.getLanguage(language)) {
      return "plaintext";
    }

    return language;
  }

  function buildLineNumbers(text) {
    const lineCount = Math.max(1, String(text || "").split(/\r\n|\r|\n/).length);
    return Array.from({ length: lineCount }, (_, index) => `<span>${index + 1}</span>`).join("");
  }

  function formatFileLabel(file) {
    if(!file) return "File";

    const parts = [];

    if(file.size) {
      parts.push(formatFileSize(file.size));
    }

    const ext = normalizeExtension(file.extension || file.name || "");
    if(ext) {
      parts.push(ext.toUpperCase());
    }

    return parts.length > 0 ? parts.join(" - ") : "File";
  }

  function formatFileSize(bytes) {
    if(bytes === 0) return "0 B";

    const units = ["B", "KB", "MB", "GB"];
    const size = Math.abs(bytes);
    let unitIndex = 0;

    while(size >= 1024 && unitIndex < units.length - 1) {
      unitIndex++;
    }

    const value = (bytes / Math.pow(1024, unitIndex)).toFixed(unitIndex === 0 ? 0 : 1);
    return `${value} ${units[unitIndex]}`;
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

  function sanitizeDocxHtml(html) {
    const template = document.createElement("template");
    template.innerHTML = String(html || "");

    const allowedTags = new Set([
      "a",
      "article",
      "br",
      "code",
      "div",
      "em",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "hr",
      "img",
      "li",
      "ol",
      "p",
      "pre",
      "s",
      "span",
      "strong",
      "sub",
      "sup",
      "table",
      "tbody",
      "td",
      "tfoot",
      "th",
      "thead",
      "tr",
      "u",
      "ul"
    ]);

    const cleaned = document.createElement("div");

    Array.from(template.content.childNodes).forEach((child) => {
      cleaned.appendChild(cleanDocxNode(child, allowedTags));
    });

    return cleaned.innerHTML;
  }

  function cleanDocxNode(node, allowedTags) {
    if(node.nodeType === Node.TEXT_NODE) {
      return document.createTextNode(node.textContent || "");
    }

    if(node.nodeType !== Node.ELEMENT_NODE) {
      return document.createDocumentFragment();
    }

    const tag = node.tagName.toLowerCase();

    if(!allowedTags.has(tag)) {
      const fragment = document.createDocumentFragment();
      Array.from(node.childNodes).forEach((child) => {
        fragment.appendChild(cleanDocxNode(child, allowedTags));
      });
      return fragment;
    }

    if(tag === "img" && !isSafeEmbeddedImageDataUrl(node.getAttribute("src"))) {
      return document.createDocumentFragment();
    }

    const element = document.createElement(tag);

    if(tag === "a") {
      const href = node.getAttribute("href") || "";
      if(isSafeDocumentUrl(href)) {
        element.setAttribute("href", href);
        element.setAttribute("target", "_blank");
        element.setAttribute("rel", "noopener noreferrer");
      }
      const title = node.getAttribute("title");
      if(title) {
        element.setAttribute("title", title);
      }
    }

    if(tag === "img") {
      element.setAttribute("src", node.getAttribute("src"));
      element.setAttribute("alt", node.getAttribute("alt") || "");
    }

    if(["td", "th"].includes(tag)) {
      copyNumericTableSpan(node, element, "colspan");
      copyNumericTableSpan(node, element, "rowspan");
    }

    Array.from(node.childNodes).forEach((child) => {
      element.appendChild(cleanDocxNode(child, allowedTags));
    });

    return element;
  }

  function copyNumericTableSpan(source, target, attribute) {
    const value = Number(source.getAttribute(attribute));

    if(Number.isInteger(value) && value > 1 && value <= 50) {
      target.setAttribute(attribute, String(value));
    }
  }

  function isSafeDocumentUrl(value) {
    const url = String(value || "").trim();

    if(!url) {
      return false;
    }

    return /^(https?:|mailto:|#)/i.test(url);
  }

  function isSafeImageDataUrl(value) {
    return /^data:image\/(jpeg|jpg|png|webp|gif|svg\+xml|bmp|avif);base64,/i.test(String(value || ""));
  }

  function isSafeEmbeddedImageDataUrl(value) {
    return /^data:image\/(jpeg|jpg|png|webp|gif);base64,/i.test(String(value || ""));
  }

  function formatSpreadsheetCell(value) {
    if(value === null || value === undefined) {
      return "";
    }

    if(value instanceof Date) {
      return value.toLocaleDateString();
    }

    return String(value);
  }

  function getSpreadsheetColumnName(index) {
    let value = index + 1;
    let name = "";

    while(value > 0) {
      const remainder = (value - 1) % 26;
      name = String.fromCharCode(65 + remainder) + name;
      value = Math.floor((value - 1) / 26);
    }

    return name;
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
      .replace(/"/g, "&quot;")
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
    state.currentFileEntry = null;

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
