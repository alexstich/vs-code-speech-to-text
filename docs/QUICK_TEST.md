# 🚀 Quick Test SpeechToTextWhisper

## ⚡ Installation and First Run

### 1. Install the Package
```bash
code --install-extension speech-to-text-whisper-0.1.0.vsix
```

### 2. Configure API Key
1. `Ctrl+,` → Search for "Speech to Text with Whisper"
2. Enter your OpenAI API key

### 3. Quick Test
1. Press `Ctrl+Shift+P`
2. Execute `Speech to Text with Whisper: Run Diagnostics`
3. **Expected**: ✅ for all checks

## 🎤 Main Functions for Testing

### F9 - Hold to Record (main function)
1. **Hold F9** and speak
2. **Release F9** 
3. ✅ Text should appear in the editor

### Alternative Commands
- `Ctrl+Shift+V` - Toggle recording
- `Ctrl+Shift+P` → "Start Recording" / "Stop Recording"

## 🔧 Troubleshooting

### If F9 doesn't work:
1. Check status bar at the bottom right - should show 🎤 icon
2. `Ctrl+Shift+P` → "Run Diagnostics"
3. Open Developer Tools (`Help > Toggle Developer Tools`) for logs

### If no status bar:
- `Ctrl+Shift+P` → "Toggle Status Bar"

### If API issues:
- `Ctrl+Shift+P` → "Test OpenAI API Key"

---

**Main issues fixed:**
✅ F9 now works (command names fixed)  
✅ Context variables configured correctly  
✅ Status bar displays  
✅ Notifications work  
✅ Diagnostics available  

**Ready for testing!** 🎉 