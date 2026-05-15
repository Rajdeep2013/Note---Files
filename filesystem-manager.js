/**
 * Unified File System Manager for Note - Files
 * Professional local-first file management system
 * Handles folders, files, persistence, and UI state
 */

class UnifiedFileSystemManager {
  constructor() {
    this.dbName = 'NotePilotFileSystem';
    this.version = 2;
    this.db = null;
    this.rootHandle = null;
    this.currentFolderId = null;
    this.folderStack = [];
    this.recentFolders = [];
    this.fileCache = new Map();

    // Default folder structure
    this.defaultFolders = [
      { id: 'school', name: 'School', icon: '📚', description: 'Lecture notes and assignments' },
      { id: 'coding', name: 'Coding', icon: '💻', description: 'Projects, snippets and references' },
      { id: 'photos', name: 'Photos', icon: '📸', description: 'Images, memories and captures' },
      { id: 'important', name: 'Important', icon: '⭐', description: 'Priority docs and quick access' }
    ];

    this.init();
  }

  async init() {
    try {
      await this.initIndexedDB();
      await this.restoreState();
      this.bindEvents();
      console.log('Unified File System Manager initialized');
    } catch (error) {
      console.error('Failed to initialize file system:', error);
    }
  }

  async initIndexedDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Folder structure store
        if (!db.objectStoreNames.contains('folders')) {
          const folderStore = db.createObjectStore('folders', { keyPath: 'id' });
          folderStore.createIndex('parentId', 'parentId', { unique: false });
          folderStore.createIndex('name', 'name', { unique: false });
        }

        // File metadata store
        if (!db.objectStoreNames.contains('files')) {
          const fileStore = db.createObjectStore('files', { keyPath: 'id' });
          fileStore.createIndex('folderId', 'folderId', { unique: false });
          fileStore.createIndex('name', 'name', { unique: false });
          fileStore.createIndex('type', 'type', { unique: false });
          fileStore.createIndex('lastOpened', 'lastOpened', { unique: false });
        }

        // File handles store (for File System Access API)
        if (!db.objectStoreNames.contains('fileHandles')) {
          db.createObjectStore('fileHandles', { keyPath: 'id' });
        }

        // App state store
        if (!db.objectStoreNames.contains('appState')) {
          db.createObjectStore('appState', { keyPath: 'key' });
        }
      };
    });
  }

  async restoreState() {
    try {
      // Restore root directory handle
      const rootData = await this.getAppState('rootHandle');
      if (rootData?.handle) {
        const permission = await rootData.handle.queryPermission({ mode: 'readwrite' });
        if (permission === 'granted') {
          this.rootHandle = rootData.handle;
        }
      }

      // Restore folder structure
      await this.ensureDefaultFolders();

      // Restore current folder and navigation stack
      const currentFolder = await this.getAppState('currentFolder');
      if (currentFolder) {
        this.currentFolderId = currentFolder.id;
        this.folderStack = currentFolder.stack || [];
      }

      // Restore recent folders
      const recent = await this.getAppState('recentFolders');
      this.recentFolders = recent || [];

    } catch (error) {
      console.warn('Failed to restore state:', error);
      await this.ensureDefaultFolders();
    }
  }

  async ensureDefaultFolders() {
    for (const folder of this.defaultFolders) {
      const existing = await this.getFolder(folder.id);
      if (!existing) {
        await this.createFolder(folder.id, folder.name, null, folder.icon, folder.description);
      }
    }
  }

  bindEvents() {
    // Listen for folder card clicks
    document.addEventListener('click', (e) => {
      const folderCard = e.target.closest('.folder-card[data-folder]');
      if (folderCard) {
        const folderId = folderCard.dataset.folder;
        this.openFolder(folderId);
      }
    });

    // Back button
    const backBtn = document.getElementById('backBtn');
    if (backBtn) {
      backBtn.addEventListener('click', () => this.goBack());
    }

    // File input
    const fileInput = document.getElementById('fileInput');
    if (fileInput) {
      fileInput.addEventListener('change', (e) => this.handleFileUpload(e));
    }

    // Add file button
    const addFileBtn = document.getElementById('addFileBtn');
    if (addFileBtn) {
      addFileBtn.addEventListener('click', () => {
        if (fileInput) fileInput.click();
      });
    }
  }

  // Folder Operations
  async createFolder(id, name, parentId = null, icon = '📁', description = '') {
    const folder = {
      id,
      name,
      parentId,
      icon,
      description,
      createdAt: Date.now(),
      fileCount: 0
    };

    const transaction = this.db.transaction(['folders'], 'readwrite');
    const store = transaction.objectStore('folders');
    await new Promise((resolve, reject) => {
      const request = store.put(folder);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    return folder;
  }

  async getFolder(id) {
    const transaction = this.db.transaction(['folders'], 'readonly');
    const store = transaction.objectStore('folders');
    return new Promise((resolve, reject) => {
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getFolders(parentId = null) {
    const transaction = this.db.transaction(['folders'], 'readonly');
    const store = transaction.objectStore('folders');
    const index = store.index('parentId');

    return new Promise((resolve, reject) => {
      const request = index.getAll(parentId);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async updateFolder(id, updates) {
    const folder = await this.getFolder(id);
    if (!folder) return null;

    const updated = { ...folder, ...updates };
    const transaction = this.db.transaction(['folders'], 'readwrite');
    const store = transaction.objectStore('folders');
    await new Promise((resolve, reject) => {
      const request = store.put(updated);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    return updated;
  }

  // File Operations
  async addFile(file, folderId) {
    const fileId = `${folderId}/${file.name}_${Date.now()}`;

    // Generate preview
    const preview = await this.generateFilePreview(file);

    const fileData = {
      id: fileId,
      folderId,
      name: file.name,
      type: file.type,
      size: file.size,
      extension: this.getFileExtension(file.name),
      preview,
      uploadedAt: Date.now(),
      lastOpened: Date.now()
    };

    // Store file metadata
    const transaction = this.db.transaction(['files'], 'readwrite');
    const store = transaction.objectStore('files');
    await new Promise((resolve, reject) => {
      const request = store.put(fileData);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    // Store file handle if using File System Access API
    if (this.rootHandle) {
      try {
        const folderHandle = await this.getFolderHandle(folderId);
        if (folderHandle) {
          const fileHandle = await folderHandle.getFileHandle(file.name, { create: true });
          const writable = await fileHandle.createWritable();
          await writable.write(file);
          await writable.close();

          // Store handle reference
          await this.storeFileHandle(fileId, fileHandle);
        }
      } catch (error) {
        console.warn('Failed to store file via File System API:', error);
      }
    }

    // Update folder file count
    await this.updateFolderFileCount(folderId);

    return fileData;
  }

  async getFiles(folderId) {
    const transaction = this.db.transaction(['files'], 'readonly');
    const store = transaction.objectStore('files');
    const index = store.index('folderId');

    return new Promise((resolve, reject) => {
      const request = index.getAll(folderId);
      request.onsuccess = () => {
        const files = request.result.sort((a, b) => b.lastOpened - a.lastOpened);
        resolve(files);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async deleteFile(fileId) {
    const file = await this.getFile(fileId);
    if (!file) return;

    // Remove from IndexedDB
    const transaction = this.db.transaction(['files', 'fileHandles'], 'readwrite');
    const fileStore = transaction.objectStore('files');
    const handleStore = transaction.objectStore('fileHandles');

    await Promise.all([
      new Promise((resolve, reject) => {
        const request = fileStore.delete(fileId);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      }),
      new Promise((resolve, reject) => {
        const request = handleStore.delete(fileId);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      })
    ]);

    // Update folder file count
    await this.updateFolderFileCount(file.folderId);
  }

  async getFile(fileId) {
    const transaction = this.db.transaction(['files'], 'readonly');
    const store = transaction.objectStore('files');
    return new Promise((resolve, reject) => {
      const request = store.get(fileId);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async updateFile(fileId, updates) {
    const file = await this.getFile(fileId);
    if (!file) return null;

    const updated = { ...file, ...updates };
    const transaction = this.db.transaction(['files'], 'readwrite');
    const store = transaction.objectStore('files');
    await new Promise((resolve, reject) => {
      const request = store.put(updated);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    return updated;
  }

  // Navigation
  async openFolder(folderId) {
    const folder = await this.getFolder(folderId);
    if (!folder) return;

    // Update navigation stack
    if (this.currentFolderId) {
      this.folderStack.push(this.currentFolderId);
    }
    this.currentFolderId = folderId;

    // Add to recent folders
    this.addToRecentFolders(folderId);

    // Save state
    await this.saveAppState('currentFolder', {
      id: folderId,
      stack: this.folderStack
    });

    // Update UI
    this.renderFolderView(folder);
    this.updateBreadcrumbs();
  }

  async goBack() {
    if (this.folderStack.length === 0) {
      this.closeFolderView();
      return;
    }

    const previousFolderId = this.folderStack.pop();
    this.currentFolderId = previousFolderId;

    await this.saveAppState('currentFolder', {
      id: this.currentFolderId,
      stack: this.folderStack
    });

    const folder = await this.getFolder(this.currentFolderId);
    if (folder) {
      this.renderFolderView(folder);
      this.updateBreadcrumbs();
    }
  }

  closeFolderView() {
    this.currentFolderId = null;
    this.folderStack = [];

    // Switch to dashboard view
    const dashboardView = document.getElementById('dashboardView');
    const folderView = document.getElementById('folderView');

    if (dashboardView) dashboardView.classList.remove('hidden');
    if (folderView) folderView.classList.add('hidden');
  }

  // UI Rendering
  async renderFolderView(folder) {
    const folderView = document.getElementById('folderView');
    const dashboardView = document.getElementById('dashboardView');
    const folderTitle = document.getElementById('folderTitle');
    const filesList = document.getElementById('filesList');

    if (!folderView || !dashboardView) return;

    // Switch views
    dashboardView.classList.add('hidden');
    folderView.classList.remove('hidden');

    // Update title
    if (folderTitle) {
      folderTitle.textContent = folder.name;
    }

    // Render files
    const files = await this.getFiles(folder.id);
    this.renderFiles(files);
  }

  renderFiles(files) {
    const filesList = document.getElementById('filesList');
    if (!filesList) return;

    filesList.innerHTML = '';

    if (files.length === 0) {
      filesList.innerHTML = `
        <div class="empty-files-state">
          <div class="empty-icon">📄</div>
          <h3>No files yet</h3>
          <p>Upload files to get started</p>
        </div>
      `;
      return;
    }

    files.forEach(file => {
      const fileCard = this.createFileCard(file);
      filesList.appendChild(fileCard);
    });
  }

  createFileCard(file) {
    const card = document.createElement('div');
    card.className = 'file-card';
    card.dataset.fileId = file.id;

    const icon = this.getFileIcon(file.extension, file.type);
    const size = this.formatFileSize(file.size);
    const lastOpened = this.formatLastOpened(file.lastOpened);

    card.innerHTML = `
      <div class="file-preview">
        ${file.preview ? `<img src="${file.preview}" alt="${file.name}">` : `<div class="file-icon">${icon}</div>`}
      </div>
      <div class="file-info">
        <div class="file-name" title="${file.name}">${file.name}</div>
        <div class="file-meta">${size} • ${lastOpened}</div>
      </div>
      <div class="file-actions">
        <button class="file-action-btn preview-btn" title="Preview">👁️</button>
        <button class="file-action-btn open-btn" title="Open">📂</button>
        <button class="file-action-btn delete-btn" title="Delete">🗑️</button>
      </div>
    `;

    // Event listeners
    card.addEventListener('click', () => this.previewFile(file));
    card.querySelector('.delete-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      this.confirmDeleteFile(file);
    });
    card.querySelector('.open-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      this.openFile(file);
    });

    return card;
  }

  updateBreadcrumbs() {
    // Implementation for breadcrumbs
    const breadcrumbs = document.getElementById('breadcrumbs');
    if (!breadcrumbs) return;

    // Simple breadcrumb implementation
    let breadcrumbHTML = '<span>Home</span>';
    if (this.currentFolderId) {
      const folderNames = [];
      let currentId = this.currentFolderId;

      // Build breadcrumb trail
      while (currentId) {
        // This would need to be implemented to get folder names
        folderNames.unshift(currentId);
        currentId = null; // Simplified
      }

      breadcrumbHTML += folderNames.map(name => `<span> > ${name}</span>`).join('');
    }

    breadcrumbs.innerHTML = breadcrumbHTML;
  }

  // File Handling
  async handleFileUpload(event) {
    const files = event.target.files;
    if (!files || !this.currentFolderId) return;

    for (const file of files) {
      try {
        await this.addFile(file, this.currentFolderId);
      } catch (error) {
        console.error('Failed to upload file:', error);
        this.showNotification(`Failed to upload ${file.name}`, 'error');
      }
    }

    // Refresh file list
    const folder = await this.getFolder(this.currentFolderId);
    if (folder) {
      const files = await this.getFiles(this.currentFolderId);
      this.renderFiles(files);
    }

    // Clear input
    event.target.value = '';

    this.showNotification('Files uploaded successfully');
  }

  async previewFile(file) {
    // Update last opened
    await this.updateFile(file.id, { lastOpened: Date.now() });

    // Show preview modal
    const modal = document.getElementById('filePreviewModal');
    const previewContainer = document.getElementById('previewContainer');

    if (!modal || !previewContainer) return;

    previewContainer.innerHTML = `
      <div class="file-header">
        <h3>${file.name}</h3>
        <div class="file-details">
          <span>Type: ${file.type || 'Unknown'}</span>
          <span>Size: ${this.formatFileSize(file.size)}</span>
          <span>Last opened: ${this.formatLastOpened(file.lastOpened)}</span>
        </div>
      </div>
      <div class="file-preview-content">
        ${this.renderFilePreview(file)}
      </div>
    `;

    modal.classList.remove('hidden');
  }

  renderFilePreview(file) {
    if (file.preview && file.type.startsWith('image/')) {
      return `<img src="${file.preview}" alt="${file.name}" class="preview-image">`;
    }

    if (file.type === 'text/plain' || file.type.startsWith('text/')) {
      return `<div class="preview-text">Text file preview would go here</div>`;
    }

    if (file.type === 'application/pdf') {
      return `<div class="preview-pdf">📄 PDF preview not available</div>`;
    }

    return `<div class="preview-generic">${this.getFileIcon(file.extension, file.type)}<br>No preview available</div>`;
  }

  async openFile(file) {
    // Update last opened
    await this.updateFile(file.id, { lastOpened: Date.now() });

    // Try to open with File System Access API first
    try {
      const handle = await this.getFileHandle(file.id);
      if (handle) {
        const fileObj = await handle.getFile();
        const url = URL.createObjectURL(fileObj);
        window.open(url, '_blank');
        return;
      }
    } catch (error) {
      console.warn('Failed to open via File System API:', error);
    }

    // Fallback: show preview
    this.previewFile(file);
  }

  async confirmDeleteFile(file) {
    if (confirm(`Delete "${file.name}"?`)) {
      await this.deleteFile(file.id);
      const files = await this.getFiles(this.currentFolderId);
      this.renderFiles(files);
      this.showNotification('File deleted');
    }
  }

  // Utility Methods
  async updateFolderFileCount(folderId) {
    const files = await this.getFiles(folderId);
    await this.updateFolder(folderId, { fileCount: files.length });
  }

  addToRecentFolders(folderId) {
    this.recentFolders = this.recentFolders.filter(id => id !== folderId);
    this.recentFolders.unshift(folderId);
    this.recentFolders = this.recentFolders.slice(0, 5); // Keep only 5 recent
    this.saveAppState('recentFolders', this.recentFolders);
  }

  async saveAppState(key, value) {
    const transaction = this.db.transaction(['appState'], 'readwrite');
    const store = transaction.objectStore('appState');
    await new Promise((resolve, reject) => {
      const request = store.put({ key, value });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getAppState(key) {
    const transaction = this.db.transaction(['appState'], 'readonly');
    const store = transaction.objectStore('appState');
    return new Promise((resolve, reject) => {
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result?.value);
      request.onerror = () => reject(request.error);
    });
  }

  async storeFileHandle(fileId, handle) {
    const transaction = this.db.transaction(['fileHandles'], 'readwrite');
    const store = transaction.objectStore('fileHandles');
    await new Promise((resolve, reject) => {
      const request = store.put({ id: fileId, handle });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getFileHandle(fileId) {
    const transaction = this.db.transaction(['fileHandles'], 'readonly');
    const store = transaction.objectStore('fileHandles');
    return new Promise((resolve, reject) => {
      const request = store.get(fileId);
      request.onsuccess = () => resolve(request.result?.handle);
      request.onerror = () => reject(request.error);
    });
  }

  async getFolderHandle(folderId) {
    if (!this.rootHandle) return null;

    try {
      const folder = await this.getFolder(folderId);
      if (!folder) return null;

      return await this.rootHandle.getDirectoryHandle(folder.name, { create: true });
    } catch (error) {
      console.warn('Failed to get folder handle:', error);
      return null;
    }
  }

  async generateFilePreview(file) {
    if (!file.type.startsWith('image/')) return null;

    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    });
  }

  getFileExtension(filename) {
    const parts = filename.split('.');
    return parts.length > 1 ? parts.pop().toLowerCase() : '';
  }

  getFileIcon(extension, mimeType = '') {
    const iconMap = {
      'pdf': '📄',
      'doc': '📝', 'docx': '📝',
      'txt': '📄',
      'jpg': '🖼️', 'jpeg': '🖼️', 'png': '🖼️', 'gif': '🖼️', 'webp': '🖼️', 'svg': '🖼️',
      'mp3': '🎵', 'wav': '🎵', 'mp4': '🎬',
      'zip': '📦', 'rar': '📦',
      'html': '🌐', 'css': '🎨', 'js': '💻', 'json': '📋'
    };

    return iconMap[extension] || '📄';
  }

  formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  formatLastOpened(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;

    return new Date(timestamp).toLocaleDateString();
  }

  showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
      notification.classList.add('show');
      setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
      }, 3000);
    }, 100);
  }
}

// Initialize global instance
const fileSystemManager = new UnifiedFileSystemManager();

      const files = [];
      for await (const entry of currentHandle.values()) {
        if (entry.kind === 'file') {
          files.push({
            name: entry.name,
            handle: entry,
            kind: 'file'
          });
        }
      }

      return files;
    } catch (error) {
      console.error(`Error getting files from folder '${folderId}':`, error);
      throw error;
    }
  }

  // Read file content
  async readFile(fileHandle) {
    try {
      const file = await fileHandle.getFile();
      return file;
    } catch (error) {
      console.error('Error reading file:', error);
      throw error;
    }
  }

  // Generate preview for file
  async generatePreview(file, maxSize = 1024 * 1024) {
    const type = file.type;

    if (type.startsWith('image/')) {
      // Image preview - base64 encode
      try {
        const buffer = await file.arrayBuffer();
        const blob = new Blob([buffer], { type: file.type });
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.readAsDataURL(blob);
        });
      } catch (error) {
        console.error('Error generating image preview:', error);
        return null;
      }
    }

    if (type === 'application/pdf') {
      // For PDF, just return a placeholder
      return 'pdf-icon';
    }

    if (type === 'text/plain' || type.startsWith('text/')) {
      // Text preview - read first 500 chars
      try {
        const text = await file.text();
        return text.substring(0, 500);
      } catch (error) {
        console.error('Error generating text preview:', error);
        return null;
      }
    }

    return null;
  }

  // Delete file
  async deleteFile(parentFolderHandle, fileName) {
    try {
      const fileHandle = await parentFolderHandle.getFileHandle(fileName);
      await parentFolderHandle.removeEntry(fileName);
      return true;
    } catch (error) {
      console.error(`Error deleting file '${fileName}':`, error);
      throw error;
    }
  }

  // Check file permission status
  async checkPermission(folderHandle) {
    try {
      return await folderHandle.queryPermission({ mode: 'readwrite' });
    } catch (error) {
      console.error('Error checking permission:', error);
      return 'denied';
    }
  }

  // Request file permission
  async requestPermission(folderHandle) {
    try {
      return await folderHandle.requestPermission({ mode: 'readwrite' });
    } catch (error) {
      console.error('Error requesting permission:', error);
      return 'denied';
    }
  }

  // Get file icon based on type
  static getFileIcon(fileName, mimeType = '') {
    const ext = fileName.split('.').pop().toLowerCase();
    
    const iconMap = {
      'pdf': '📄',
      'txt': '📝',
      'md': '📝',
      'doc': '📄',
      'docx': '📄',
      'jpg': '🖼️',
      'jpeg': '🖼️',
      'png': '🖼️',
      'gif': '🖼️',
      'webp': '🖼️',
      'svg': '🖼️',
      'zip': '📦',
      'rar': '📦',
      'mp3': '🎵',
      'mp4': '🎬',
      'xls': '📊',
      'xlsx': '📊',
      'csv': '📊',
      'ppt': '📽️',
      'pptx': '📽️'
    };

    return iconMap[ext] || '📎';
  }

  // Get file type category
  static getFileTypeCategory(fileName, mimeType = '') {
    const ext = fileName.split('.').pop().toLowerCase();
    const mime = mimeType.toLowerCase();

    if (mime.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) {
      return 'image';
    }
    if (mime === 'application/pdf' || ext === 'pdf') {
      return 'pdf';
    }
    if (mime.startsWith('text/') || ['txt', 'md', 'json', 'xml', 'html', 'css', 'js'].includes(ext)) {
      return 'text';
    }
    if (mime.startsWith('audio/') || ['mp3', 'wav', 'ogg', 'flac'].includes(ext)) {
      return 'audio';
    }
    if (mime.startsWith('video/') || ['mp4', 'webm', 'mkv', 'avi'].includes(ext)) {
      return 'video';
    }
    if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) {
      return 'archive';
    }
    return 'other';
  }
}

// Initialize global instance (after idbManager is initialized)
let fsManager = null;
