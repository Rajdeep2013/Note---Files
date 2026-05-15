# File Manager - File System Access API Integration

## Overview

The Note - Files app has been upgraded to use the **File System Access API** for local file management instead of Firebase. All files are now stored on the user's device with persistent access through IndexedDB file handle storage.

## Features

### 1. **Local File Storage**
- Files remain on the user's device
- No cloud upload or external storage required
- Complete privacy - only the user's browser accesses the files

### 2. **File Persistence**
- File handles stored in IndexedDB
- Files accessible across browser sessions
- Automatic restore of folder structure on reload
- Permission management for continued access

### 3. **Modern File Explorer UI**
- Grid/collage layout with thumbnails
- Professional dark glassmorphism design
- Smooth animations and hover effects
- Responsive design for all devices

### 4. **File Operations**
- **Preview**: View images, PDFs, and text files
- **Delete**: Remove files with confirmation dialog
- **Open**: Open files in system default application
- **Organize**: Files grouped by folder (School, Coding, Photos, Important)

### 5. **File Types Supported**
- **Images**: JPG, PNG, GIF, WebP, SVG (with preview)
- **PDFs**: Full support with preview placeholder
- **Text Files**: TXT, MD, JSON, HTML (with preview)
- **Other**: Any file type with generic icon display

### 6. **Recent Files Tracking**
- Automatically track accessed files
- Display up to 10 most recent files
- Quick access to frequently used documents

## Browser Requirements

### Required APIs
- **File System Access API** (Chrome 86+, Edge 86+, Opera 72+)
- **IndexedDB** (All modern browsers)
- **Blob/URL.createObjectURL** (All modern browsers)

### Recommended Browsers
- Google Chrome/Chromium (latest)
- Microsoft Edge (latest)
- Opera (latest)

**Note**: Firefox and Safari support is limited as they don't support the File System Access API

## Architecture

### Core Modules

#### 1. `indexeddb-manager.js`
Manages all persistent storage using IndexedDB:
- File handle persistence
- Folder handle storage
- File metadata caching
- Recent files tracking

**Key Classes & Methods**:
```javascript
const idbManager = new IndexedDBManager();
await idbManager.init(); // Initialize database
await idbManager.saveFolderHandle(folderId, folderName, handle);
await idbManager.getFilesInFolder(folderId);
await idbManager.addRecentFile(fileName, folderId, preview);
```

#### 2. `filesystem-manager.js`
Wraps File System Access API functionality:
- Directory selection and restoration
- File read/write operations
- Permission checking and requesting
- File type detection and icon generation

**Key Classes & Methods**:
```javascript
const fsManager = new FileSystemAccessManager(idbManager);
await fsManager.selectRootDirectory(); // Open directory picker
const files = await fsManager.getFilesInFolder(folderId, folderHandle);
await fsManager.deleteFile(parentHandle, fileName);
```

#### 3. `file-manager.js`
High-level file management and UI orchestration:
- File card creation and rendering
- Preview modal handling
- Recent files display
- Folder navigation
- Notifications and UI state

**Key Classes & Methods**:
```javascript
const fileManager = new FileManager(idbManager, fsManager);
await fileManager.selectRootDirectory();
await fileManager.openFolder(folderName);
await fileManager.previewFile(file, fileInfo, fileType, icon);
```

### Data Flow

```
User Action
    ↓
FileManager (UI layer)
    ↓
FileSystemAccessManager (File I/O)
    ↓
IndexedDBManager (Persistence)
    ↓
Device Storage
```

## IndexedDB Schema

### Database: `NotePilotFiles` (v1)

#### Store: `fileHandles`
```javascript
{
  id: "folderid/filename",
  folderId: "school",
  fileName: "notes.txt",
  handle: FileHandle,
  timestamp: 1234567890
}
```

#### Store: `folderHandles`
```javascript
{
  folderId: "school",
  folderName: "School",
  handle: DirectoryHandle,
  timestamp: 1234567890
}
```

#### Store: `recentFiles`
```javascript
{
  id: "folderid/filename",
  fileName: "document.pdf",
  folderId: "important",
  preview: "data:image/...",
  accessed: 1234567890
}
```

#### Store: `fileMetadata`
```javascript
{
  id: "folderid/filename",
  folderId: "photos",
  fileName: "photo.jpg",
  type: "image/jpeg",
  size: 2048000,
  lastModified: 1234567890
}
```

## Usage Guide

### 1. **First Time Setup**
1. Click "Files" in the sidebar
2. Click "Select Folder" button
3. Choose a directory where you want to store your files
4. Select or create subdirectories (School, Coding, Photos, Important)

### 2. **Accessing Files**
- Navigate to Files section in sidebar
- View recent files or select a folder
- Click on a file to preview
- Use action buttons: Preview, Delete, or Open

### 3. **Managing Files**
- **Upload**: Click "Add File" in folder view (traditional upload)
- **Delete**: Click delete icon on file card or in preview modal
- **Open**: Click "Open File" button in preview modal
- **View**: Click any file card to see preview

### 4. **Permission Management**
- Permissions are automatic on first selection
- If permissions expire, you'll be prompted to grant them again
- Check permission status with "Permission Status" button

## File Preview

### Image Files
- Display thumbnail in file card
- Full resolution preview in modal
- Supported: JPG, PNG, GIF, WebP, SVG

### PDF Files
- Icon display in file card
- System default viewer when opened
- Preview placeholder in modal

### Text Files
- First 500 characters shown in modal
- Code formatting preserved
- Supported: TXT, MD, JSON, HTML, CSS, JS

## Security & Privacy

### Data Storage
- ✓ All files stored on user's device
- ✓ No data sent to external servers
- ✓ LocalStorage only for authentication
- ✓ IndexedDB for file handle storage (secure, domain-isolated)

### Permissions
- Users explicitly grant access to directories
- Permissions tied to user interaction
- Can be revoked through browser settings

### Best Practices
1. Don't store sensitive data without encryption
2. Regularly backup important files
3. Grant permissions only to trusted directories
4. Check browser security for IndexedDB

## Troubleshooting

### "File System Access API is not supported"
- Use Chrome, Edge, or Opera (latest versions)
- Firefox and Safari don't support this API yet
- Try updating your browser

### "Permission denied"
- Re-select the directory
- Check browser permissions settings
- Ensure the directory is readable/writable

### Files not persisting after reload
- Check IndexedDB is enabled in browser
- Verify localStorage is not disabled
- Clear browser cache and reload
- Try re-selecting the root directory

### Preview not showing
- Supported file types: images, PDFs, text files
- For other types, click "Open File" to use system viewer
- Some file types may require additional permissions

## Performance Considerations

### Optimization Tips
- Keep file list under 100 items per folder
- Compress images before adding to file manager
- Clear recent files list if it grows too large
- Use IndexedDB cleanup in browser dev tools

### Limitations
- Max file size: Depends on available storage
- File list render: ~500 files acceptable before slowdown
- Thumbnails: Generated on-demand, cached in IndexedDB

## Development

### Adding New File Types
Edit `FileSystemAccessManager.getFileTypeCategory()`:
```javascript
static getFileTypeCategory(fileName, mimeType = '') {
  const ext = fileName.split('.').pop().toLowerCase();
  if (['new', 'type'].includes(ext)) {
    return 'custom-type';
  }
  // ...
}
```

### Extending File Operations
Add methods to `FileManager` class:
```javascript
async customOperation(file, folderHandle) {
  // Implement custom logic
  // Use fsManager and idbManager as needed
}
```

### Custom Preview Handlers
Modify `FileManager.getPreviewHTML()`:
```javascript
getPreviewHTML(preview, fileType, fileIcon, fileInfo) {
  if (fileType === 'custom') {
    return `<div class="custom-preview">...</div>`;
  }
  // ...
}
```

## Future Enhancements

- [ ] Drag & drop file upload
- [ ] Batch file operations
- [ ] File search and filtering
- [ ] Folder creation from UI
- [ ] File size statistics
- [ ] Cloud sync integration (optional)
- [ ] File versioning
- [ ] Share functionality

## API Reference

### FileSystemAccessManager

```javascript
// Check API support
FileSystemAccessManager.isSupported() → boolean

// Directory operations
selectRootDirectory() → Promise<DirectoryHandle>
restoreRootDirectory() → Promise<DirectoryHandle | null>
getSubfolderHandle(folderName) → Promise<DirectoryHandle>
getFilesInFolder(folderId, folderHandle?) → Promise<File[]>

// File operations
readFile(fileHandle) → Promise<File>
deleteFile(parentHandle, fileName) → Promise<boolean>
generatePreview(file, maxSize?) → Promise<string | null>

// Permissions
checkPermission(folderHandle) → Promise<'granted' | 'denied' | 'prompt'>
requestPermission(folderHandle) → Promise<'granted' | 'denied' | 'prompt'>

// Utilities
static getFileIcon(fileName, mimeType?) → string
static getFileTypeCategory(fileName, mimeType?) → string
```

### FileManager

```javascript
// Directory operations
selectRootDirectory() → Promise<void>
loadFolderStructure() → Promise<void>
openFolder(folderName) → Promise<void>

// File operations
previewFile(file, fileInfo, fileType, icon) → Promise<void>
deleteFile(file, folderHandle) → Promise<void>
openFile(file) → Promise<void>

// UI Management
loadRecentFiles() → Promise<void>
showPermissionStatus() → void
closeModal() → void
showNotification(message, type?) → void
```

### IndexedDBManager

```javascript
// File handle operations
saveFileHandle(folderId, fileName, handle) → Promise<object>
getFileHandle(folderId, fileName) → Promise<object | undefined>
getFilesInFolder(folderId) → Promise<object[]>
deleteFileHandle(folderId, fileName) → Promise<void>

// Folder handle operations
saveFolderHandle(folderId, folderName, handle) → Promise<object>
getFolderHandle(folderId) → Promise<object | undefined>
getAllFolderHandles() → Promise<object[]>
deleteFolderHandle(folderId) → Promise<void>

// Metadata operations
saveFileMetadata(folderId, fileName, metadata) → Promise<object>
getFileMetadata(folderId, fileName) → Promise<object | undefined>

// Recent files
addRecentFile(fileName, folderId, preview?) → Promise<object>
getRecentFiles(limit?) → Promise<object[]>
deleteRecentFile(fileName, folderId) → Promise<void>

// Database management
init() → Promise<IDBDatabase>
clearAllData() → Promise<void>
```

## License

This File Manager component is part of the Note - Files application. It uses only standard web APIs and vanilla JavaScript - no external dependencies required.

## Support

For issues or feature requests, please refer to the main Note - Files documentation or repository.
