/**
 * IndexedDB Manager for Note - Files App
 * Handles persistent storage of file handles, folder handles, and metadata
 */

class IndexedDBManager {
  constructor() {
    this.dbName = 'NotePilotFiles';
    this.version = 1;
    this.db = null;
    this.stores = {
      fileHandles: 'fileHandles',
      folderHandles: 'folderHandles',
      recentFiles: 'recentFiles',
      fileMetadata: 'fileMetadata'
    };
  }

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => {
        console.error('IndexedDB initialization failed:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('IndexedDB initialized successfully');
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        
        // File Handles Store: key = "${folderId}/${fileName}"
        if (!db.objectStoreNames.contains(this.stores.fileHandles)) {
          const fileStore = db.createObjectStore(this.stores.fileHandles, { keyPath: 'id' });
          fileStore.createIndex('folderId', 'folderId', { unique: false });
          fileStore.createIndex('fileName', 'fileName', { unique: false });
          fileStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        // Folder Handles Store: key = folderId
        if (!db.objectStoreNames.contains(this.stores.folderHandles)) {
          const folderStore = db.createObjectStore(this.stores.folderHandles, { keyPath: 'folderId' });
          folderStore.createIndex('folderName', 'folderName', { unique: false });
          folderStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        // Recent Files Store
        if (!db.objectStoreNames.contains(this.stores.recentFiles)) {
          const recentStore = db.createObjectStore(this.stores.recentFiles, { keyPath: 'id' });
          recentStore.createIndex('accessed', 'accessed', { unique: false });
          recentStore.createIndex('folderId', 'folderId', { unique: false });
        }

        // File Metadata Store: key = "${folderId}/${fileName}"
        if (!db.objectStoreNames.contains(this.stores.fileMetadata)) {
          const metaStore = db.createObjectStore(this.stores.fileMetadata, { keyPath: 'id' });
          metaStore.createIndex('folderId', 'folderId', { unique: false });
          metaStore.createIndex('type', 'type', { unique: false });
        }
      };
    });
  }

  // File Handles Operations
  async saveFileHandle(folderId, fileName, fileHandle) {
    const transaction = this.db.transaction([this.stores.fileHandles], 'readwrite');
    const store = transaction.objectStore(this.stores.fileHandles);
    
    const id = `${folderId}/${fileName}`;
    const data = {
      id,
      folderId,
      fileName,
      handle: fileHandle,
      timestamp: Date.now()
    };

    return new Promise((resolve, reject) => {
      const request = store.put(data);
      request.onsuccess = () => resolve(data);
      request.onerror = () => reject(request.error);
    });
  }

  async getFileHandle(folderId, fileName) {
    const transaction = this.db.transaction([this.stores.fileHandles], 'readonly');
    const store = transaction.objectStore(this.stores.fileHandles);
    const id = `${folderId}/${fileName}`;

    return new Promise((resolve, reject) => {
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getFilesInFolder(folderId) {
    const transaction = this.db.transaction([this.stores.fileHandles], 'readonly');
    const store = transaction.objectStore(this.stores.fileHandles);
    const index = store.index('folderId');

    return new Promise((resolve, reject) => {
      const request = index.getAll(folderId);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async deleteFileHandle(folderId, fileName) {
    const transaction = this.db.transaction([this.stores.fileHandles], 'readwrite');
    const store = transaction.objectStore(this.stores.fileHandles);
    const id = `${folderId}/${fileName}`;

    return new Promise((resolve, reject) => {
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Folder Handles Operations
  async saveFolderHandle(folderId, folderName, folderHandle) {
    const transaction = this.db.transaction([this.stores.folderHandles], 'readwrite');
    const store = transaction.objectStore(this.stores.folderHandles);
    
    const data = {
      folderId,
      folderName,
      handle: folderHandle,
      timestamp: Date.now()
    };

    return new Promise((resolve, reject) => {
      const request = store.put(data);
      request.onsuccess = () => resolve(data);
      request.onerror = () => reject(request.error);
    });
  }

  async getFolderHandle(folderId) {
    const transaction = this.db.transaction([this.stores.folderHandles], 'readonly');
    const store = transaction.objectStore(this.stores.folderHandles);

    return new Promise((resolve, reject) => {
      const request = store.get(folderId);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getAllFolderHandles() {
    const transaction = this.db.transaction([this.stores.folderHandles], 'readonly');
    const store = transaction.objectStore(this.stores.folderHandles);

    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async deleteFolderHandle(folderId) {
    const transaction = this.db.transaction([this.stores.folderHandles], 'readwrite');
    const store = transaction.objectStore(this.stores.folderHandles);

    return new Promise((resolve, reject) => {
      const request = store.delete(folderId);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // File Metadata Operations
  async saveFileMetadata(folderId, fileName, metadata) {
    const transaction = this.db.transaction([this.stores.fileMetadata], 'readwrite');
    const store = transaction.objectStore(this.stores.fileMetadata);
    
    const id = `${folderId}/${fileName}`;
    const data = {
      id,
      folderId,
      fileName,
      ...metadata,
      timestamp: Date.now()
    };

    return new Promise((resolve, reject) => {
      const request = store.put(data);
      request.onsuccess = () => resolve(data);
      request.onerror = () => reject(request.error);
    });
  }

  async getFileMetadata(folderId, fileName) {
    const transaction = this.db.transaction([this.stores.fileMetadata], 'readonly');
    const store = transaction.objectStore(this.stores.fileMetadata);
    const id = `${folderId}/${fileName}`;

    return new Promise((resolve, reject) => {
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // Recent Files Operations
  async addRecentFile(fileName, folderId, preview = null) {
    const transaction = this.db.transaction([this.stores.recentFiles], 'readwrite');
    const store = transaction.objectStore(this.stores.recentFiles);
    
    const id = `${folderId}/${fileName}`;
    const data = {
      id,
      fileName,
      folderId,
      preview,
      accessed: Date.now()
    };

    return new Promise((resolve, reject) => {
      const request = store.put(data);
      request.onsuccess = () => resolve(data);
      request.onerror = () => reject(request.error);
    });
  }

  async getRecentFiles(limit = 10) {
    const transaction = this.db.transaction([this.stores.recentFiles], 'readonly');
    const store = transaction.objectStore(this.stores.recentFiles);
    const index = store.index('accessed');

    return new Promise((resolve, reject) => {
      const request = index.getAll();
      request.onsuccess = () => {
        const result = request.result;
        // Sort by accessed time descending and limit
        resolve(result.sort((a, b) => b.accessed - a.accessed).slice(0, limit));
      };
      request.onerror = () => reject(request.error);
    });
  }

  async deleteRecentFile(fileName, folderId) {
    const transaction = this.db.transaction([this.stores.recentFiles], 'readwrite');
    const store = transaction.objectStore(this.stores.recentFiles);
    const id = `${folderId}/${fileName}`;

    return new Promise((resolve, reject) => {
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async clearAllData() {
    const stores = Object.values(this.stores);
    const transaction = this.db.transaction(stores, 'readwrite');

    return new Promise((resolve, reject) => {
      let completed = 0;
      stores.forEach(storeName => {
        const request = transaction.objectStore(storeName).clear();
        request.onsuccess = () => {
          completed++;
          if (completed === stores.length) resolve();
        };
        request.onerror = () => reject(request.error);
      });
    });
  }
}

// Initialize global instance
const idbManager = new IndexedDBManager();
