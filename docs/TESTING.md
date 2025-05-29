# 🧪 SpeechToTextWhisper Testing Instructions

## 📦 Test Preparation

### 1. Install FFmpeg
Before testing the extension, ensure FFmpeg is installed on your system:

#### Windows
```bash
# Using winget (Windows 11/Windows 10 with App Installer)
winget install FFmpeg

# Or download from https://ffmpeg.org/download.html
# Add FFmpeg to your PATH environment variable
```

#### macOS
```bash
# Using Homebrew (recommended)
brew install ffmpeg
```

#### Linux
```bash
# Ubuntu/Debian
sudo apt update && sudo apt install ffmpeg

# Fedora/RHEL
sudo dnf install ffmpeg
```

### 2. Build Extension
```bash
# Install dependencies
npm install

# Build project
npm run compile

# Create VSIX package
npx vsce package
```

### 3. Install in VS Code
```bash
# Install via command line
code --install-extension speech-to-text-whisper-0.1.0.vsix

# Or via VS Code: Extensions > ... > Install from VSIX
```

## ⚙️ Initial Setup

### 1. Configure API Key
1. Open `Settings` (`Ctrl+,` / `Cmd+,`)
2. Search for `Speech to Text with Whisper`
3. Enter your OpenAI API key in the `API Key` field

### 2. Basic Settings
- **Language**: `auto` (auto-detection) or select a specific language
- **Recording Mode**: `hold` (default) or `toggle`
- **Insert Mode**: `cursor` (at cursor position)
- **Audio Quality**: `16000` (standard) or `44100` (high quality)
- **Audio Format**: `wav` (default) or `mp3`

## 🔧 Main Tests

### ✅ Test 1: Extension Activation Check
1. Open Command Palette (`Ctrl+Shift+P`)
2. Search for `Speech to Text with Whisper` commands
3. **Expected**: Extension command list should appear

### ✅ Test 2: System Diagnostics
1. Execute command `Speech to Text with Whisper: Run Diagnostics`
2. **Expected**: Report with status:
   - ✅ Extension activated
   - ✅ API key configured (if set up)
   - ✅ FFmpeg available and working
   - ✅ Audio input devices detected
   - ✅ Platform audio support (DirectShow/AVFoundation/PulseAudio)

### ✅ Test 3: Status Bar
1. After extension activation, find microphone icon in status bar (bottom right)
2. **Expected**: Microphone icon with tooltip "SpeechToTextWhisper"
3. Click on the icon
4. **Expected**: Context menu with options

### ✅ Test 4: FFmpeg Check
1. Execute command `Speech to Text with Whisper: Run Diagnostics`
2. **Expected**: 
   - ✅ FFmpeg version information displayed
   - ✅ Audio input devices list (platform-specific)
   - ✅ Supported audio formats confirmed

### ✅ Test 5: API Key Test
1. Execute command `Speech to Text with Whisper: Test OpenAI API Key`
2. **Expected**: Message "✅ OpenAI API key is working correctly"

## 🎤 Recording Tests

### ✅ Test 6: F9 Hold-to-Record
1. Ensure `Recording Mode` = `hold`
2. Press and **hold** the `F9` key
3. **Expected**: 
   - Status bar shows recording state
   - Notification "🎤 Recording started with FFmpeg..."
   - No browser permissions prompt (FFmpeg handles audio directly)
4. Speak for a few seconds
5. Release `F9`
6. **Expected**:
   - Notification "🔄 Transcribing audio..."
   - After transcription: "✅ Transcribed and inserted: [text]"
   - Text appears in editor
   - Temporary audio file automatically cleaned up

### ✅ Test 7: Toggle Recording Mode
1. Change `Recording Mode` to `toggle`
2. Press `F9` once
3. **Expected**: Recording starts using FFmpeg
4. Speak for a few seconds
5. Press `F9` again
6. **Expected**: Recording stops and transcription begins

### ✅ Test 8: Keyboard Shortcuts
- `Ctrl+Shift+V` (`Cmd+Shift+V` on Mac): Toggle recording
- `Ctrl+Shift+Alt+V`: Record and send to AI chat
- `Ctrl+Shift+C`: Insert as comment

### ✅ Test 9: Audio Quality Tests
1. Change `Audio Quality` to `44100` (high quality)
2. Record a sentence
3. **Expected**: Higher quality audio captured (larger file size)
4. Change to `16000` (standard)
5. **Expected**: Standard quality audio (smaller file size)

### ✅ Test 10: Audio Format Tests
1. Set `Audio Format` to `wav`
2. Record audio
3. **Expected**: WAV format used (lossless, larger files)
4. Set `Audio Format` to `mp3`
5. **Expected**: MP3 format used (compressed, smaller files)

## 📝 Text Insertion Tests

### ✅ Test 11: Different Insertion Modes
1. Record audio
2. Use commands:
   - `Insert Last Transcription at Cursor`
   - `Insert Last Transcription as Comment`
   - `Replace Selection with Last Transcription`
   - `Copy Last Transcription to Clipboard`

### ✅ Test 12: Context Menu
1. Right-click in editor
2. **Expected**: SpeechToTextWhisper menu items

## 🖥️ Cross-Platform Tests

### Windows-Specific Tests
1. Verify DirectShow device detection
2. Test with different microphone inputs
3. Check Windows-specific audio permissions

### macOS-Specific Tests
1. Verify AVFoundation device detection
2. Test microphone permission handling
3. Check System Preferences > Privacy & Security integration

### Linux-Specific Tests
1. Verify PulseAudio/ALSA detection
2. Test with different audio servers
3. Check user audio group membership

## 🔍 Debugging and Logs

### Viewing Logs
1. Open `Developer Tools` (`Help > Toggle Developer Tools`)
2. Go to `Console` tab
3. Filter by "SpeechToTextWhisper", "FFmpeg", or "🎤"

### FFmpeg Debugging
- Look for FFmpeg process start/stop messages
- Check for audio device detection logs
- Monitor temporary file creation/cleanup

### Useful Debugging Commands
- `Speech to Text with Whisper: Show Status`
- `Speech to Text with Whisper: Show Context Information`
- `Speech to Text with Whisper: Run Diagnostics`

## ❗ Common Issues

### FFmpeg Not Found
- Verify installation: `ffmpeg -version` in terminal
- Check PATH environment variable (Windows)
- Use diagnostics to confirm detection

### No Audio Devices
- **Windows**: Check DirectShow devices in Device Manager
- **macOS**: Verify microphone permissions in System Preferences
- **Linux**: Check PulseAudio: `pulseaudio --check -v`

### Recording Permission Denied
- **macOS**: Grant microphone access in System Preferences > Privacy & Security
- **Linux**: Add user to audio group: `sudo usermod -a -G audio $USER`
- **Windows**: Check microphone privacy settings

### F9 Not Working
- Check that extension is activated
- Ensure `Recording Mode` is configured correctly
- Verify FFmpeg is available via diagnostics

### Poor Audio Quality
- Try different audio quality settings (16kHz vs 44.1kHz)
- Check input device selection
- Test microphone levels in OS settings

### No Status Bar
- Execute `Speech to Text with Whisper: Toggle Status Bar`
- Reload VS Code

### API Errors
- Check API key
- Ensure you have access to Whisper API
- Check internet connection

### Audio File Cleanup Issues
- Check for temporary files in system temp directory
- Verify FFmpeg process termination
- Monitor disk space usage

## 🎯 Advanced Tests

### Test in Different Contexts
- Test in different file types (.js, .py, .md)
- Check how comments work in different languages
- Test in VS Code terminal

### Performance Testing
- Record long fragments (up to 25 seconds)
- Test with poor internet connection
- Check retry mechanism
- Monitor FFmpeg memory usage

### Audio Device Testing
- Test with different microphone types (USB, built-in, Bluetooth)
- Test device switching during operation
- Verify device detection after hot-plugging

### Cursor Integration
- If using Cursor IDE, test sending to AI chat
- Command `Record and Send to AI Chat`

### Multi-Platform Testing
- Test same project across Windows, macOS, and Linux
- Verify consistent behavior across platforms
- Check audio quality consistency

## 🔧 Development Testing

### Unit Tests
```bash
# Run unit tests
npm test

# Run specific test suites
npm run test:unit
npm run test:integration
```

### Mock Testing
- Tests use FFmpeg mocks for reliable cross-platform testing
- Mock scenarios include various system configurations
- Test error conditions and edge cases

---

**If something doesn't work:**
1. Check Developer Console for errors
2. Run diagnostics (`Run Diagnostics`) for FFmpeg and audio status
3. Verify FFmpeg installation: `ffmpeg -version`
4. Check platform-specific audio permissions
5. Reload VS Code
6. Reinstall extension 