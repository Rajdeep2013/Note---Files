window.Notepilot.FileTools = (() => {
  function safeParseArray(value) {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function normalizeFileEntry(entry) {
    if (typeof entry === "string") {
      const id = `file-${Math.random().toString(36).slice(2)}-${Date.now()}`;
      return {
        id,
        fileKey: `notepilot:file:${window.Notepilot.Auth.ACTIVE_USER_SLUG}:${entry.folderId || "unknown"}:${id}`,
        name: entry,
        type: "",
        size: 0,
        extension: getFileExtension(entry),
        uploadedAt: Date.now(),
        folderId: entry.folderId || "",
        previewDataUrl: "",
        textData: ""
      };
    }

    const id = entry.id || `file-${Math.random().toString(36).slice(2)}-${Date.now()}`;
    return {
      id,
      fileKey: entry.fileKey || `notepilot:file:${window.Notepilot.Auth.ACTIVE_USER_SLUG}:${entry.folderId || "unknown"}:${id}`,
      name: entry.name || "Untitled file",
      type: entry.type || "",
      size: Number(entry.size) || 0,
      extension: entry.extension || getFileExtension(entry.name || ""),
      uploadedAt: entry.uploadedAt || Date.now(),
      folderId: entry.folderId || "",
      previewDataUrl: entry.previewDataUrl || "",
      textData: entry.textData || ""
    };
  }

  function getFileExtension(fileName) {
    if (!fileName || typeof fileName !== "string") return "";
    const parts = fileName.split(".");
    if (parts.length < 2) return "";
    return parts.pop().toLowerCase();
  }

  function formatBytes(bytes) {
    if (bytes === undefined || bytes === null || Number.isNaN(Number(bytes))) return "0 B";
    const size = Number(bytes);
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${Math.round(size / 102.4) / 10} KB`;
    return `${Math.round(size / (1024 * 102.4)) / 10} MB`;
  }

  function formatFileLabel(file) {
    const extension = file.extension ? file.extension.toUpperCase() : "FILE";
    if (!file.size) {
      return extension;
    }
    return `${extension} - ${formatBytes(file.size)}`;
  }

  async function getFilePreviewDataUrl(file) {
    if (!file || !file.type || !file.type.startsWith("image/")) {
      return "";
    }
    if (file.size > 2 * 1024 * 1024) {
      return "";
    }
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
      reader.onerror = () => resolve("");
      reader.readAsDataURL(file);
    });
  }

  async function getFileTextFallback(file) {
    if (!file || !file.type) return "";
    const lowerType = file.type.toLowerCase();
    const supportedText =
      lowerType.startsWith("text/") ||
      ["application/json", "application/xml", "application/javascript", "application/xhtml+xml"].includes(lowerType);
    if (!supportedText) return "";
    if (file.size > 200 * 1024) return "";
    try {
      return await file.text();
    } catch {
      return "";
    }
  }

  async function getFileBinaryData(file) {
    if (!file) return null;
    if (typeof file.arrayBuffer === "function") {
      return await file.arrayBuffer();
    }
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (reader.result instanceof ArrayBuffer) {
          resolve(reader.result);
        } else {
          reject(new Error("Unable to read file binary data"));
        }
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(file);
    });
  }

  async function getStoredFileBlob(fileKey) {
    if (!fileKey) return null;
    try {
      const record = await window.Notepilot.FileDatabase.getFileData(fileKey);
      if (!record) return null;
      if (record.data) {
        const fileData = record.data instanceof ArrayBuffer
          ? record.data
          : (ArrayBuffer.isView(record.data) ? record.data.buffer : null);
        if (fileData) {
          return new Blob([fileData], { type: record.type || "" });
        }
      }
      if (record.blob instanceof Blob) {
        return record.blob;
      }
      if (record.blob && typeof record.blob === "object" && record.blob.data) {
        return new Blob([record.blob.data], { type: record.blob.type || "" });
      }
      return null;
    } catch {
      return null;
    }
  }

  return {
    normalizeFileEntry,
    getFilePreviewDataUrl,
    getFileTextFallback,
    getFileBinaryData,
    getStoredFileBlob,
    getFileExtension,
    formatBytes,
    formatFileLabel
  };
})();
