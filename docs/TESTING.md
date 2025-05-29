# 🧪 SpeechToTextWhisper Testing Instructions

## 📦 Test Preparation

### 1. Build Extension
```bash
# Install dependencies
npm install

# Build project
npm run compile

# Create VSIX package
npx vsce package
```

### 2. Install in VS Code
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
   - ✅ Browser compatibility OK
   - ✅ Microphone permission granted

### ✅ Test 3: Status Bar
1. After extension activation, find microphone icon in status bar (bottom right)
2. **Expected**: Microphone icon with tooltip "SpeechToTextWhisper"
3. Click on the icon
4. **Expected**: Context menu with options

### ✅ Test 4: Microphone Check
1. Execute command `Speech to Text with Whisper: Check Microphone`
2. **Expected**: 
   - Microphone permission request (if not granted)
   - Message "✅ Microphone is working correctly"

### ✅ Test 5: API Key Test
1. Execute command `Speech to Text with Whisper: Test OpenAI API Key`
2. **Expected**: Message "✅ OpenAI API key is working correctly"

## 🎤 Recording Tests

### ✅ Test 6: F9 Hold-to-Record
1. Ensure `Recording Mode` = `hold`
2. Press and **hold** the `F9` key
3. **Expected**: 
   - Status bar shows recording state
   - Notification "🎤 Recording started..."
4. Speak for a few seconds
5. Release `F9`
6. **Expected**:
   - Notification "🔄 Transcribing audio..."
   - After transcription: "✅ Transcribed and inserted: [text]"
   - Text appears in editor

### ✅ Test 7: Toggle Recording Mode
1. Change `Recording Mode` to `toggle`
2. Press `F9` once
3. **Expected**: Recording starts
4. Speak for a few seconds
5. Press `F9` again
6. **Expected**: Recording stops and transcription begins

### ✅ Test 8: Keyboard Shortcuts
- `Ctrl+Shift+V` (`Cmd+Shift+V` on Mac): Toggle recording
- `Ctrl+Shift+Alt+V`: Record and send to AI chat
- `Ctrl+Shift+C`: Insert as comment

## 📝 Text Insertion Tests

### ✅ Test 9: Different Insertion Modes
1. Record audio
2. Use commands:
   - `Insert Last Transcription at Cursor`
   - `Insert Last Transcription as Comment`
   - `Replace Selection with Last Transcription`
   - `Copy Last Transcription to Clipboard`

### ✅ Test 10: Context Menu
1. Right-click in editor
2. **Expected**: SpeechToTextWhisper menu items

## 🔍 Debugging and Logs

### Viewing Logs
1. Open `Developer Tools` (`Help > Toggle Developer Tools`)
2. Go to `Console` tab
3. Filter by "SpeechToTextWhisper" or "🎤"

### Useful Debugging Commands
- `Speech to Text with Whisper: Show Status`
- `Speech to Text with Whisper: Show Context Information`
- `Speech to Text with Whisper: Run Diagnostics`

## ❗ Common Issues

### F9 Not Working
- Check that extension is activated
- Ensure `Recording Mode` is configured correctly
- Check microphone permissions

### No Status Bar
- Execute `Speech to Text with Whisper: Toggle Status Bar`
- Reload VS Code

### API Errors
- Check API key
- Ensure you have access to Whisper API
- Check internet connection

### No Notifications
- In hold-to-record mode notifications are minimal (this is normal)
- In toggle mode there should be full notifications

## 🎯 Advanced Tests

### Test in Different Contexts
- Test in different file types (.js, .py, .md)
- Check how comments work in different languages
- Test in VS Code terminal

### Performance Testing
- Record long fragments (up to 25 seconds)
- Test with poor internet connection
- Check retry mechanism

### Cursor Integration
- If using Cursor IDE, test sending to AI chat
- Command `Record and Send to AI Chat`

---

**If something doesn't work:**
1. Check Developer Console for errors
2. Run diagnostics (`Run Diagnostics`)
3. Reload VS Code
4. Reinstall extension 