/**
 * File Manager Module
 * Manages file operations, UI, and state
 */

class FileManager {
  constructor(idbManager, fsManager) {
    this.idb = idbManager;
    this.fs = fsManager;
    this.currentFolderId = null;
    this.folderHandles = new Map();
    this.initEventListeners();
  }

  initEventListeners() {
    const selectRootBtn = document.getElementById('selectRootBtn');
    const permissionStatusBtn = document.getElementById('permissionStatusBtn');
    const modalOverlay = document.getElementById('modalOverlay');
    const modalCloseBtn = document.getElementById('modalCloseBtn');

    if (selectRootBtn) {
      selectRootBtn.addEventListener('click', () => this.selectRootDirectory());
    }

    if (permissionStatusBtn) {
      permissionStatusBtn.addEventListener('click', () => this.showPermissionStatus());
    }

    if (modalOverlay) {
      modalOverlay.addEventListener('click', () => this.closeModal());
    }

    if (modalCloseBtn) {
      modalCloseBtn.addEventListener('click', () => this.closeModal());
    }
  }

  async selectRootDirectory() {
    try {
      if (!FileSystemAccessManager.isSupported()) {
        alert('File System Access API is not supported in your browser. Please use a modern browser like Chrome, Edge, or Opera.');
        return;
      }

      const selectBtn = document.getElementById('selectRootBtn');
      const originalText = selectBtn.textContent;
      selectBtn.textContent = 'Selecting...';
      selectBtn.disabled = true;

      const rootHandle = await this.fs.selectRootDirectory();
      
      // Load folder structure
      await this.loadFolderStructure();
      
      selectBtn.textContent = 'Folder Selected ✓';
      setTimeout(() => {
        selectBtn.textContent = originalText;
        selectBtn.disabled = false;
      }, 2000);

      // Show success message
      this.showNotification('Root directory selected successfully!');
      
    } catch (error) {
      console.error('Error selecting root directory:', error);
      alert(`Error: ${error.message}`);
      const selectBtn = document.getElementById('selectRootBtn');
      if (selectBtn) {
        selectBtn.disabled = false;
        selectBtn.textContent = 'Select Folder';
      }
    }
  }

  async loadFolderStructure() {
    try {
      if (!this.fs.selectedRootHandle) {
        console.warn('No root handle available');
        return;
      }

      // Get all subdirectories
      const subfolders = ['School', 'Coding', 'Photos', 'Important'];
      this.folderHandles.clear();

      for (const folderName of subfolders) {
        try {
          const folderHandle = await this.fs.selectedRootHandle.getDirectoryHandle(folderName, {
            create: true
          });
          this.folderHandles.set(folderName.toLowerCase(), {
            name: folderName,
            handle: folderHandle
          });
          await this.idb.saveFolderHandle(folderName.toLowerCase(), folderName, folderHandle);
        } catch (error) {
          console.warn(`Could not access/create folder '${folderName}':`, error);
        }
      }

      await this.loadRecentFiles();
      this.showEmptyState();
    } catch (error) {
      console.error('Error loading folder structure:', error);
    }
  }

  async openFolder(folderName) {
    try {
      const folderInfo = this.folderHandles.get(folderName.toLowerCase());
      if (!folderInfo) {
        throw new Error(`Folder '${folderName}' not found`);
      }

      this.currentFolderId = folderName.toLowerCase();
      const files = await this.fs.getFilesInFolder(this.currentFolderId, folderInfo.handle);

      // Update UI
      const currentFolderName = document.getElementById('currentFolderName');
      if (currentFolderName) {
        currentFolderName.textContent = folderName;
      }

      await this.displayFolderFiles(files, folderInfo.handle);
      
      // Show folder contents, hide recent files
      const recentContainer = document.getElementById('recentFilesContainer');
      const folderContainer = document.getElementById('folderContentsContainer');
      const emptyState = document.getElementById('emptyState');
      
      if (recentContainer) recentContainer.classList.add('hidden');
      if (folderContainer) folderContainer.classList.remove('hidden');
      if (emptyState) emptyState.classList.add('hidden');

    } catch (error) {
      console.error('Error opening folder:', error);
      this.showNotification(`Error opening folder: ${error.message}`, 'error');
    }
  }

  async displayFolderFiles(files, folderHandle) {
    const filesList = document.getElementById('folderFilesList');
    if (!filesList) return;

    filesList.innerHTML = '';

    if (files.length === 0) {
      filesList.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; color: #94a3b8; padding: 2rem;">
          <p>No files in this folder</p>
        </div>
      `;
      return;
    }

    for (const file of files) {
      try {
        const card = await this.createFileCard(file, folderHandle);
        filesList.appendChild(card);
      } catch (error) {
        console.error(`Error creating card for file '${file.name}':`, error);
      }
    }
  }

  async createFileCard(file, folderHandle) {
    const card = document.createElement('div');
    card.className = 'file-card';

    const fileInfo = await this.fs.readFile(file.handle);
    const fileType = FileSystemAccessManager.getFileTypeCategory(file.name, fileInfo.type);
    const fileIcon = FileSystemAccessManager.getFileIcon(file.name, fileInfo.type);
    const fileSize = this.formatFileSize(fileInfo.size);

    // Generate preview
    let preview = null;
    if (fileType === 'image') {
      preview = await this.fs.generatePreview(fileInfo);
    }

    const previewHTML = this.getPreviewHTML(preview, fileType, fileIcon, fileInfo);

    card.innerHTML = `
      <div class="file-preview">
        ${previewHTML}
      </div>
      <div class="file-info">
        <div class="file-name">${file.name}</div>
        <div class="file-size">${fileSize}</div>
      </div>
      <div class="file-card-actions" style="display: none;">
        <button class="file-action-btn view-btn" title="Preview">Preview</button>
        <button class="file-action-btn delete-btn" title="Delete">Delete</button>
      </div>
    `;

    // Event listeners
    card.querySelector('.view-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      this.previewFile(file, fileInfo, fileType, fileIcon);
    });

    card.querySelector('.delete-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      this.deleteFile(file, folderHandle);
    });

    card.addEventListener('click', () => {
      this.previewFile(file, fileInfo, fileType, fileIcon);
    });

    // Show actions on hover
    card.addEventListener('mouseenter', () => {
      const actions = card.querySelector('.file-card-actions');
      if (actions) actions.style.display = 'flex';
    });

    card.addEventListener('mouseleave', () => {
      const actions = card.querySelector('.file-card-actions');
      if (actions) actions.style.display = 'none';
    });

    return card;
  }

  getPreviewHTML(preview, fileType, fileIcon, fileInfo) {
    if (fileType === 'image' && preview) {
      return `<img src="${preview}" alt="preview" style="width: 100%; height: 100%; object-fit: cover;">`;
    }
    if (fileType === 'pdf') {
      return `<div style="font-size: 2.5rem;">📄</div>`;
    }
    if (fileType === 'text' && preview) {
      return `<div class="file-preview-text">${this.escapeHtml(preview)}</div>`;
    }
    return `<div class="file-preview-icon">${fileIcon}</div>`;
  }

  async previewFile(file, fileInfo, fileType, fileIcon) {
    try {
      const modal = document.getElementById('filePreviewModal');
      const previewContainer = document.getElementById('previewContainer');

      if (!modal || !previewContainer) return;

      previewContainer.innerHTML = '';

      // Show file info
      const infoDiv = document.createElement('div');
      infoDiv.innerHTML = `
        <div style="margin-bottom: 1rem;">
          <h2 style="margin: 0 0 0.5rem 0; color: #f1f5f9;">${file.name}</h2>
          <p style="margin: 0; color: #94a3b8; font-size: 0.875rem;">
            Size: ${this.formatFileSize(fileInfo.size)} | Type: ${fileInfo.type || 'Unknown'}
          </p>
        </div>
      `;
      previewContainer.appendChild(infoDiv);

      // Show preview based on type
      if (fileType === 'image') {
        const img = document.createElement('img');
        img.src = await this.fs.generatePreview(fileInfo);
        img.className = 'preview-image';
        previewContainer.appendChild(img);
      } else if (fileType === 'text') {
        const text = await fileInfo.text();
        const textDiv = document.createElement('div');
        textDiv.className = 'preview-text';
        textDiv.textContent = text;
        previewContainer.appendChild(textDiv);
      } else if (fileType === 'pdf') {
        const pdfDiv = document.createElement('div');
        pdfDiv.className = 'preview-pdf';
        pdfDiv.innerHTML = `
          <div class="preview-pdf-icon">📄</div>
          <p style="margin: 0;">PDF Preview</p>
          <p style="font-size: 0.875rem; color: #94a3b8;">Click "Open File" to view in your system</p>
        `;
        previewContainer.appendChild(pdfDiv);
      } else {
        const unsupportedDiv = document.createElement('div');
        unsupportedDiv.className = 'preview-pdf';
        unsupportedDiv.innerHTML = `
          <div style="font-size: 3rem;">${fileIcon}</div>
          <p style="margin-top: 1rem;">Preview not available for this file type</p>
        `;
        previewContainer.appendChild(unsupportedDiv);
      }

      // Store current file for delete and open actions
      modal.dataset.currentFile = JSON.stringify({
        name: file.name,
        handle: file.handle,
        folderHandle: file.folderHandle
      });

      // Add to recent files
      let preview = null;
      if (fileType === 'image') {
        preview = await this.fs.generatePreview(fileInfo);
      }
      await this.idb.addRecentFile(file.name, this.currentFolderId, preview);

      modal.classList.remove('hidden');

    } catch (error) {
      console.error('Error previewing file:', error);
      this.showNotification('Error previewing file', 'error');
    }
  }

  async deleteFile(file, folderHandle) {
    try {
      if (!confirm(`Are you sure you want to delete "${file.name}"?`)) {
        return;
      }

      await this.fs.deleteFile(folderHandle, file.name);
      await this.idb.deleteFileHandle(this.currentFolderId, file.name);
      await this.idb.deleteRecentFile(file.name, this.currentFolderId);

      // Reload folder contents
      await this.openFolder(this.folderHandles.get(this.currentFolderId).name);
      this.closeModal();
      this.showNotification('File deleted successfully');

    } catch (error) {
      console.error('Error deleting file:', error);
      this.showNotification(`Error deleting file: ${error.message}`, 'error');
    }
  }

  async openFile(file) {
    try {
      const fileHandle = file.handle;
      const fileObj = await fileHandle.getFile();
      const url = URL.createObjectURL(fileObj);
      window.open(url, '_blank');
    } catch (error) {
      console.error('Error opening file:', error);
      this.showNotification('Error opening file', 'error');
    }
  }

  async loadRecentFiles() {
    try {
      const recentFiles = await this.idb.getRecentFiles(6);
      
      if (recentFiles.length === 0) {
        return;
      }

      const recentContainer = document.getElementById('recentFilesContainer');
      const recentFilesList = document.getElementById('recentFilesList');

      if (!recentContainer || !recentFilesList) return;

      recentFilesList.innerHTML = '';

      for (const fileRecord of recentFiles) {
        try {
          const folderInfo = this.folderHandles.get(fileRecord.folderId);
          if (!folderInfo) continue;

          const card = document.createElement('div');
          card.className = 'file-card';

          const fileIcon = FileSystemAccessManager.getFileIcon(fileRecord.fileName);
          const previewHTML = fileRecord.preview 
            ? `<img src="${fileRecord.preview}" alt="preview" style="width: 100%; height: 100%; object-fit: cover;">`
            : `<div class="file-preview-icon">${fileIcon}</div>`;

          card.innerHTML = `
            <div class="file-preview">
              ${previewHTML}
            </div>
            <div class="file-info">
              <div class="file-name">${fileRecord.fileName}</div>
              <div class="file-size">${fileRecord.folderId}</div>
            </div>
          `;

          card.addEventListener('click', async () => {
            try {
              const fileHandle = await folderInfo.handle.getFileHandle(fileRecord.fileName);
              const fileInfo = await fileHandle.getFile();
              const fileType = FileSystemAccessManager.getFileTypeCategory(fileRecord.fileName, fileInfo.type);
              const fileIcon = FileSystemAccessManager.getFileIcon(fileRecord.fileName);
              
              this.currentFolderId = fileRecord.folderId;
              this.previewFile(
                { name: fileRecord.fileName, handle: fileHandle },
                fileInfo,
                fileType,
                fileIcon
              );
            } catch (error) {
              console.error('Error opening recent file:', error);
              this.showNotification('Could not open file. It may have been moved or deleted.', 'error');
            }
          });

          recentFilesList.appendChild(card);
        } catch (error) {
          console.error('Error creating recent file card:', error);
        }
      }

      recentContainer.classList.remove('hidden');
    } catch (error) {
      console.error('Error loading recent files:', error);
    }
  }

  showPermissionStatus() {
    try {
      if (!this.fs.selectedRootHandle) {
        alert('No directory selected yet. Please select a folder first.');
        return;
      }

      alert(`✓ File System Access permissions are currently GRANTED\n\nYou can access and manage files in the selected directory.`);
    } catch (error) {
      console.error('Error checking permission:', error);
      alert('Unable to check permission status');
    }
  }

  closeModal() {
    const modal = document.getElementById('filePreviewModal');
    if (modal) {
      modal.classList.add('hidden');
      modal.dataset.currentFile = null;
    }
  }

  showEmptyState() {
    const emptyState = document.getElementById('emptyState');
    const recentContainer = document.getElementById('recentFilesContainer');
    const folderContainer = document.getElementById('folderContentsContainer');

    if (emptyState && recentContainer && folderContainer) {
      emptyState.classList.remove('hidden');
      recentContainer.classList.add('hidden');
      folderContainer.classList.add('hidden');
    }
  }

  showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      bottom: 2rem;
      right: 2rem;
      padding: 1rem 1.5rem;
      background: ${type === 'error' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(34, 197, 94, 0.1)'};
      border: 1px solid ${type === 'error' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(34, 197, 94, 0.3)'};
      color: ${type === 'error' ? '#ef4444' : '#22c55e'};
      border-radius: 8px;
      backdrop-filter: blur(10px);
      animation: slideIn 0.3s ease-out;
      z-index: 2000;
      max-width: 300px;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
      notification.style.animation = 'slideOut 0.3s ease-out';
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }

  escapeHtml(text) {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
  }

  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }
}

// Initialize after DOM is ready
let fileManager = null;
