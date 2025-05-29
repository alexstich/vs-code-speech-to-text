# 🚀 Quick Test SpeechToTextWhisper

## ⚡ Installation and First Run

### 1. Install FFmpeg
**Required:** Install FFmpeg before testing the extension:

```bash
# Windows (using winget)
winget install FFmpeg

# macOS (using Homebrew)
brew install ffmpeg

# Linux (Ubuntu/Debian)
sudo apt install ffmpeg
```

### 2. Install the Package
```bash
code --install-extension speech-to-text-whisper-0.1.0.vsix
```

### 3. Configure API Key
1. `Ctrl+,` → Search for "Speech to Text with Whisper"
2. Enter your OpenAI API key

### 4. Quick Test
1. Press `Ctrl+Shift+P`
2. Execute `Speech to Text with Whisper: Run Diagnostics`
3. **Expected**: ✅ for all checks including:
   - ✅ FFmpeg available and working
   - ✅ Audio input devices detected
   - ✅ Platform audio support

## 🎤 Main Functions for Testing

### F9 - Hold to Record (main function)
1. **Hold F9** and speak
2. **Expected**: "🎤 Recording started with FFmpeg..." notification
3. **Release F9** 
4. ✅ Text should appear in the editor
5. ✅ Temporary audio files automatically cleaned up

### Alternative Commands
- `Ctrl+Shift+V` - Toggle recording
- `Ctrl+Shift+P` → "Start Recording" / "Stop Recording"

## 🔧 Troubleshooting

### If FFmpeg not found:
1. Verify installation: `ffmpeg -version` in terminal
2. Windows: Check PATH environment variable
3. Run diagnostics for detailed FFmpeg status

### If F9 doesn't work:
1. Check status bar at the bottom right - should show 🎤 icon
2. `Ctrl+Shift+P` → "Run Diagnostics"
3. Verify FFmpeg and audio devices are detected
4. Open Developer Tools (`Help > Toggle Developer Tools`) for logs

### If no audio devices:
- **Windows**: Check DirectShow devices in Device Manager
- **macOS**: Grant microphone permissions in System Preferences
- **Linux**: Check PulseAudio: `pulseaudio --check -v`

### If no status bar:
- `Ctrl+Shift+P` → "Toggle Status Bar"

### If API issues:
- `Ctrl+Shift+P` → "Test OpenAI API Key"

---

**Migration to FFmpeg completed:**
✅ Web Audio API replaced with FFmpeg  
✅ Cross-platform audio recording  
✅ High-quality audio capture (16kHz/44.1kHz)  
✅ Platform-specific device detection  
✅ Automatic temporary file cleanup  
✅ Enhanced diagnostics with FFmpeg status  

**Ready for testing!** 🎉 