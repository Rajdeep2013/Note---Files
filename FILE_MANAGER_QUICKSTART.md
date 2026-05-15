# File Manager - Quick Start Guide

## 🚀 Getting Started

### First Time Setup (2 minutes)

1. **Navigate to Files**
   - Click "Files" in the left sidebar

2. **Select Your Directory**
   - Click "Select Folder" button
   - Choose where you want to store files (e.g., a Documents folder, Desktop, or any directory)
   - Grant browser permission when prompted

3. **Folder Structure Created**
   - App automatically creates 4 folders:
     - **School** - Lecture notes & assignments
     - **Coding** - Projects & code snippets  
     - **Photos** - Images & screenshots
     - **Important** - Critical documents

✓ Done! You're ready to use the File Manager.

---

## 📁 Basic Operations

### Add Files
```
Files Section → Choose a Folder → "Add File" button → Select file
```

### View Files
```
Files Section → Select Folder → Click any file to preview
```

### Delete Files
```
In Preview Modal → Click "Delete File" → Confirm
```

### Open Files
```
In Preview Modal → Click "Open File" → Opens in system default app
```

---

## 👀 File Previews

### Supported Preview Types

| Type | Preview | How to Open |
|------|---------|------------|
| **Images** (JPG, PNG, GIF, WebP) | ✓ Thumbnail | Click on card to preview |
| **PDFs** | ✓ Icon only | Click "Open File" to view |
| **Text** (TXT, MD, JSON) | ✓ First 500 chars | Click on card to see content |
| **Other** | ✓ Type icon | Click "Open File" to view |

---

## ⚙️ Permissions & Status

### Check Permissions
- Click "Permission Status" button
- Shows current access level
- If expired, re-select the directory

### Troubleshoot Access Issues
1. Click "Permission Status"
2. If denied, click "Select Folder" again
3. Make sure directory is readable

---

## 💾 Where Are My Files?

### File Location
✓ Files stay in the directory you selected  
✓ App cannot move or delete files outside this folder  
✓ You control the storage location  

### Folder Structure
```
Your Selected Directory/
├── School/          (lecture notes, assignments)
├── Coding/          (projects, code files)
├── Photos/          (images, screenshots)
└── Important/       (critical documents)
```

### Accessing Files Directly
You can also browse files using:
- File Explorer (Windows)
- Finder (Mac)
- Files app (Linux)

The files are regular files in your filesystem - you're not locked in!

---

## 🔐 Privacy & Security

### Your Data is Safe
✓ Files stored only on your device  
✓ No cloud upload (completely local)  
✓ No external servers involved  
✓ No analytics or tracking  

### Browser Permissions
- You grant explicit permission for directory access
- You can revoke in browser settings anytime
- Permission is isolated per browser/device

---

## 🐛 Common Issues & Solutions

### "Select Folder" Button Doesn't Work
**Problem**: Browser doesn't support File System Access API  
**Solution**: Update to Chrome, Edge, or Opera (latest versions)  
**Note**: Firefox & Safari don't support this API yet

### Files Disappear After Browser Close
**Problem**: Usually permissions issue  
**Solution**:  
1. Click "Permission Status"  
2. Re-select the directory  
3. Check browser settings for permissions

### Can't Preview Certain Files
**Problem**: File type not directly previewable  
**Solution**: Click "Open File" to use system default viewer  
**Supported previews**: Images, PDFs (placeholder), Text files

### Permission Denied Error
**Problem**: Browser lost permission to directory  
**Solution**:  
1. Click "Select Folder" again  
2. Choose the same directory  
3. Grant permission in dialog

---

## 🎯 Tips & Tricks

### Organize Your Files
- Use different folders for different types
- Keep School folder for notes and assignments
- Use Coding for projects and snippets
- Photos for all visual content
- Important for critical documents

### Fast Access
- Recent files show up at the top
- Click any recent file to open preview
- Perfect for frequently used documents

### Backup Your Files
Since files are on your device:
- Regular backups still apply
- Files sync with system backup tools
- Consider cloud backup services separately

### Multi-Device Access
- Each device needs independent setup
- Select folder on each device
- Sync important files manually between devices

---

## ✅ Browser Compatibility

### ✓ Full Support
- Chrome/Chromium 86+
- Microsoft Edge 86+
- Opera 72+
- Brave (Chromium-based)

### ✗ No Support
- Firefox (API not implemented)
- Safari (API not implemented)
- Internet Explorer (too old)

### Check Your Browser
Not sure what browser you're using?  
The app will automatically show a message if your browser isn't supported.

---

## 🚀 Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Close Preview Modal | `Esc` or click ✕ button |
| Delete File | In modal: Click "Delete File" button |
| Open in System | In modal: Click "Open File" button |

---

## 💡 Best Practices

### Do's ✓
- ✓ Keep backup copies of important files
- ✓ Organize files into appropriate folders
- ✓ Close preview modal when done
- ✓ Use meaningful file names
- ✓ Regularly verify permissions work

### Don'ts ✗
- ✗ Don't rely solely on app for critical data (keep backups)
- ✗ Don't delete original files from system
- ✗ Don't revoke permissions without selecting folder again
- ✗ Don't assume files are synced across devices
- ✗ Don't use special characters in folder names

---

## 📞 Need Help?

### Troubleshooting Steps
1. Check browser compatibility
2. Clear browser cache
3. Re-select the directory
4. Check Permission Status
5. Restart browser

### Before You Report an Issue
- Verify browser version is latest
- Try a different folder location
- Test with a simple text file first
- Check browser console for errors

---

## 🎓 Understanding File System Access API

### What It Is
Modern API that lets web apps access your file system with permission

### Why It's Better
- ✓ Files stay on your device
- ✓ No cloud storage needed
- ✓ Works offline completely
- ✓ You control who accesses what
- ✓ Better performance

### How Permissions Work
1. You click "Select Folder"
2. Native file picker opens (same as any app)
3. You choose a folder
4. App remembers the folder handle
5. You can revoke anytime in browser settings

---

## 📊 File Limits

### Practical Limits
- Max files per folder: ~500 (before slowdown)
- Max folder size: Limited by disk space
- File size: Depends on available RAM (for preview)
- Recent files list: Last 10 files tracked

### Performance Tips
- Keep folders under 100 files for best performance
- Use subfolders for organization
- Archive old files if directory gets large
- Clear browser cache periodically

---

## 🔄 Version Info

**File Manager Version**: 1.0  
**Release Date**: 2025  
**API Used**: File System Access API (standard)  
**Storage**: IndexedDB + Native Filesystem  

### What's New
- ✨ Full File System Access API integration
- ✨ Modern glassmorphism UI
- ✨ Fast file previews
- ✨ Recent files tracking
- ✨ Zero cloud dependency
- ✨ Complete privacy

---

## 📝 Notes

### Data Ownership
- You own 100% of your files
- App cannot access anything outside selected folder
- App cannot delete files you don't manage through it
- Direct filesystem access always available

### Storage is Permanent
- Files aren't deleted when browser closes
- Files aren't deleted when app updates
- Files persist indefinitely unless you delete them
- Use system tools to manage directly

### No Lock-in
- Export files anytime (they're regular files)
- Use files with any other app
- No proprietary format
- Full control over your data

---

## 🎉 You're Ready!

Start by clicking **Files** in the sidebar and selecting your directory.

Happy file managing! 📁✨
