# 🎤 Speech to Text with Whisper

> Turn your voice into code! Professional voice input extension for VS Code and Cursor IDE with OpenAI Whisper API integration.

[![VS Code](https://img.shields.io/badge/VS%20Code-1.74.0+-blue.svg)](https://code.visualstudio.com/)
[![Cursor IDE](https://img.shields.io/badge/Cursor%20IDE-Supported-green.svg)](https://cursor.sh/)
[![OpenAI Whisper](https://img.shields.io/badge/OpenAI-Whisper%20API-orange.svg)](https://openai.com/research/whisper)
[![FFmpeg](https://img.shields.io/badge/FFmpeg-Required-red.svg)](https://ffmpeg.org/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## ✨ Key Features

### 🎙️ **Professional Audio Recording**
- **High-quality recording** using FFmpeg
- **Cross-platform support**: Windows, macOS, Linux
- **Multiple formats**: WAV (uncompressed), MP3, WebM, Opus
- **Configurable quality**: from 16kHz to 48kHz
- **Automatic device detection**: microphones, line inputs

### 🤖 **AI Transcription**
- **OpenAI Whisper API**: most accurate speech recognition model
- **Auto language detection**: support for 40+ languages
- **Context prompts**: improved accuracy for technical terms
- **Configurable temperature**: from deterministic to creative recognition

### 🎯 **Smart Text Insertion**
- **Insert at cursor position**: exactly where you're working
- **Clipboard**: copy for use in other applications

### 💬 **Cursor IDE Integration** ⭐ *NEW*
- **Direct send to AI chat**: voice communication with AI assistant

> ⚠️ **Important Note**: Chat insertion functions use unofficial Cursor IDE APIs and may be changed by Cursor IDE developers in future versions without prior notice.

### ⚡ **Fast and Efficient**
- **Instant feedback**: status bar indicators
- **Automatic silence detection**: smart recording stop
- **Retry mechanisms**: automatic retries on network failures

## 🚀 Quick Start

### 1️⃣ Install FFmpeg (Required)

<details>
<summary><strong>🪟 Windows</strong></summary>

```bash
# Using winget (recommended)
winget install FFmpeg

# Or download from https://ffmpeg.org/download.html
# Add FFmpeg to PATH environment variable
```
</details>

<details>
<summary><strong>🍎 macOS</strong></summary>

```bash
# Using Homebrew (recommended)
brew install ffmpeg

# Using MacPorts
sudo port install ffmpeg
```
</details>

<details>
<summary><strong>🐧 Linux</strong></summary>

```bash
# Ubuntu/Debian
sudo apt update && sudo apt install ffmpeg

# Fedora/RHEL
sudo dnf install ffmpeg

# Arch Linux
sudo pacman -S ffmpeg
```
</details>

### 2️⃣ Install Extension

1. Open VS Code or Cursor IDE
2. Go to Extensions (`Ctrl+Shift+X`)
3. Search for "Speech to Text with Whisper"
4. Click **Install**

### 3️⃣ Configure API Key

1. Get API key from [platform.openai.com](https://platform.openai.com/api-keys)
2. Open Settings (`Ctrl+,` / `Cmd+,`)
3. Search for "Speech to Text with Whisper"
4. Enter your OpenAI API key

### 4️⃣ First Recording

1. Press **Ctrl+Shift+M** to start recording
2. Speak clearly into the microphone
3. Press **Ctrl+Shift+M** again to finish
4. Text will automatically insert at cursor or clipboard based on settings!

**💡 Tip:** Look for the Speech to Text panel in the Activity Bar (microphone icon) for quick access to settings, history, and diagnostics!

## ⌨️ Keyboard Shortcuts

| Combination | Action | Mode |
|------------|----------|-------|
| **Ctrl+Shift+M** | Record and Insert Text | Record and insert into editor |
| **Ctrl+Shift+N** | Record and Insert Text | Record and insert into AI Chat |

## 🎛️ Settings

### 🔧 Basic Settings

| Parameter | Description | Default | Values |
|----------|-------------|---------|--------|
| **API Key** | OpenAI key for Whisper | *Required* | String |
| **Language** | Recognition language | Auto-detect | 43+ languages |
| **Whisper Model** | OpenAI model | whisper-1 | whisper-1 |
| **Prompt** | Context for accuracy | Default prompt | String |
| **Temperature** | Creativity (0-1) | 0.1 | 0.0-1.0 |

### 🔊 Audio Settings

| Parameter | Description | Default | Options |
|----------|-------------|---------|---------|
| **Audio Quality** | Recording quality | Standard | Standard, High, Ultra |
| **FFmpeg Path** | FFmpeg executable path | Auto-detect | File path |
| **Max Duration** | Recording time limit | 3600s | 5-7200s |
| **Silence Detection** | Auto-stop on silence | Enabled | Boolean |
| **Silence Duration** | Silence time threshold | 3s | 1-10s |
| **Silence Threshold** | Sensitivity level | 30 | 20-80 |
| **Input Device** | Audio input | Auto | Auto/Specific |

### ⚙️ System Settings

| Parameter | Description | Default | Range |
|----------|-------------|---------|-------|
| **Timeout** | API timeout | 30s | 5-120s |
| **Max Retries** | Retry attempts | 3 | 0-10 |
| **Show Status Bar** | Display recording status | Enabled | Boolean |

## 🌍 Supported Languages

### Main Languages
- 🇺🇸 **English** - English
- 🇷🇺 **Russian** - Russian  
- 🇪🇸 **Spanish** - Spanish
- 🇫🇷 **French** - French
- 🇩🇪 **German** - German
- 🇮🇹 **Italian** - Italian
- 🇵🇹 **Portuguese** - Portuguese

### Asian Languages
- 🇨🇳 **Chinese** - Chinese (Mandarin)
- 🇯🇵 **Japanese** - Japanese
- 🇰🇷 **Korean** - Korean
- 🇮🇳 **Hindi** - Hindi
- 🇹🇭 **Thai** - Thai
- 🇮🇩 **Indonesian** - Indonesian
- 🇲🇾 **Malay** - Malay
- 🇻🇳 **Vietnamese** - Vietnamese

### European Languages
- 🇳🇱 **Dutch** - Dutch
- 🇸🇪 **Swedish** - Swedish
- 🇳🇴 **Norwegian** - Norwegian
- 🇩🇰 **Danish** - Danish
- 🇫🇮 **Finnish** - Finnish
- 🇬🇷 **Greek** - Greek
- 🇭🇺 **Hungarian** - Hungarian
- 🇨🇿 **Czech** - Czech
- 🇵🇱 **Polish** - Polish
- 🇷🇴 **Romanian** - Romanian
- 🇸🇰 **Slovak** - Slovak
- 🇸🇮 **Slovenian** - Slovenian
- 🇭🇷 **Croatian** - Croatian
- 🇷🇸 **Serbian** - Serbian
- 🇧🇬 **Bulgarian** - Bulgarian
- 🇪🇪 **Estonian** - Estonian
- 🇱🇻 **Latvian** - Latvian
- 🇱🇹 **Lithuanian** - Lithuanian
- 🇲🇰 **Macedonian** - Macedonian
- 🇺🇦 **Ukrainian** - Ukrainian
- 🇮🇸 **Icelandic** - Icelandic
- 🇲🇹 **Maltese** - Maltese

### Other Languages
- 🇦🇪 **Arabic** - Arabic
- 🇮🇱 **Hebrew** - Hebrew
- 🇹🇷 **Turkish** - Turkish
- 🇪🇸 **Catalan** - Catalan

**Total: 43+ languages with automatic detection!**

## 📋 Commands

Access via Command Palette (`Ctrl+Shift+P`):

### 🎤 Recording
- `Speech to Text with Whisper: Record and Insert at Cursor or Clipboard`
- `Speech to Text with Whisper: Record and Open New Chat` ⚠️ *Uses unofficial Cursor IDE APIs*

### 🔧 Diagnostics & Settings
- `Speech to Text with Whisper: Run Diagnostics`
- `Speech to Text with Whisper: Test FFmpeg Availability`
- `Speech to Text with Whisper: Test Audio Recorder Initialization`
- `Speech to Text with Whisper: Open Settings`
- `Speech to Text with Whisper: Toggle Recording Mode`

### 📝 History & Tools
- `Speech to Text with Whisper: Select Audio Device`
- `Speech to Text with Whisper: Copy to Clipboard` (from history)
- `Speech to Text with Whisper: Insert at Cursor Chat` (from history) ⚠️ *Uses unofficial Cursor IDE APIs*
- `Speech to Text with Whisper: Clear History`

## 🎛️ Extension Panel

Access the Speech to Text panel via the Activity Bar (🎤 microphone icon):

### 📱 **Available Views**
- **Device Manager**: Select and configure audio input devices
- **Recording Mode**: Switch between "Insert Text" and "Copy to Clipboard"
- **Settings**: Quick access to extension configuration
- **Transcription History**: View, reuse, and manage past transcriptions
- **Diagnostics**: System health check and troubleshooting tools

## 🎯 Use Cases

### 👨‍💻 **Code Development**
```javascript
// Say: "Create function for email validation"
function validateEmail(email) {
    // Your voice becomes code
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
```

### 📝 **Quick Text Insertion**
1. Press **Ctrl+Shift+M** to start recording
2. Say what needs to be inserted: "console.log hello world"
3. Press **Ctrl+Shift+M** again to finish recording
4. Text automatically inserts at cursor position

### 🤖 **AI Chat Integration**
1. Press **Ctrl+Shift+N** to record and send to AI chat
2. Say your question or instruction to the AI
3. Text will be sent directly to Cursor IDE AI chat

> ⚠️ **Warning**: Cursor IDE chat integration uses unofficial internal commands that may be changed in future IDE updates.

### 🌐 **Multilingual Development**
- Speak in Russian - get text in Russian
- Switch to English for technical terms
- Auto language detection works in real-time

## 🔧 System Requirements

### 💻 Minimum Requirements
- **VS Code**: 1.74.0 or newer
- **FFmpeg**: Installed in system
- **OpenAI API**: Key with Whisper access
- **Microphone**: Any audio input device

### 🖥️ Platform Support

| Platform | Audio System | Status |
|-----------|---------------|--------|
| **Windows 10/11** | DirectShow | ✅ Full support |
| **macOS** | AVFoundation | ✅ Full support |
| **Linux** | PulseAudio/ALSA | ✅ Full support |

## 🐛 Troubleshooting

### ❌ Common Issues and Solutions

<details>
<summary><strong>🔴 "FFmpeg not found"</strong></summary>

**Issue**: FFmpeg not found in system

**Solutions**:
1. Check installation: `ffmpeg -version`
2. Windows: add FFmpeg to PATH
3. Use "Run Diagnostics" command
4. Specify path in `ffmpegPath` settings
</details>

<details>
<summary><strong>🔴 "Recording is already in progress"</strong></summary>

**Issue**: Multiple recording attempts

**Solutions**:
1. Wait for current recording to finish
2. Don't press recording shortcuts too frequently (200ms protection)
3. Check status in Status Bar
4. Restart extension if stuck
</details>

<details>
<summary><strong>🔴 "No audio input devices"</strong></summary>

**Issue**: No audio devices found

**Solutions**:
- **Windows**: Check DirectShow devices
- **macOS**: Allow microphone access in Privacy & Security
- **Linux**: Add user to `audio` group
- Check microphone connection
</details>

<details>
<summary><strong>🔴 "API key invalid"</strong></summary>

**Issue**: OpenAI API problems

**Solutions**:
1. Check key format (starts with `sk-`)
2. Ensure account has credits
3. Verify Whisper API access
4. Use "Test API Key" command
</details>

### 🛠️ Diagnostics

Use built-in diagnostics for automatic system check:

1. Open Command Palette (`Ctrl+Shift+P`)
2. Run `Speech to Text with Whisper: Run Diagnostics`
3. Review detailed system report
4. Follow recommendations to fix issues

## 📊 Technical Details

### 🎵 **Audio Recording**
- **Engine**: FFmpeg with cross-platform drivers
- **Formats**: WAV (PCM), MP3, WebM, Opus
- **Quality Presets**: Standard (16kHz), High (44.1kHz), Ultra (48kHz)
- **Channels**: Mono (optimal for speech recognition)
- **Codecs**: PCM (WAV), MP3, Vorbis (WebM), Opus
- **Platform Support**: Windows (DirectShow), macOS (AVFoundation), Linux (ALSA/PulseAudio)

### 🤖 **AI Processing**
- **Model**: OpenAI Whisper-1 (latest production model)
- **Language Detection**: Automatic detection from 43+ languages
- **Context Prompts**: Configurable for technical accuracy
- **Temperature**: 0.1 (default) - 1.0 (configurable creativity)
- **Timeout**: 30s (default, 5-120s configurable)
- **Retry Logic**: 3 attempts with exponential backoff
- **File Size Limit**: 25MB (OpenAI API limit)

### 🔒 **Security and Privacy**
- **Encryption**: HTTPS for all API requests
- **Storage**: API key only in VS Code settings
- **Temporary Files**: Automatic deletion after processing
- **Data**: Audio sent only to OpenAI Whisper API
- **Permissions**: Minimal system rights for FFmpeg

## 🎯 Advanced Features

### 🎛️ **Audio Quality Profiles**

#### Standard Quality (Default)
- **Sample Rate**: 16kHz (optimal for Whisper)
- **Format**: WebM with Opus codec
- **Use Case**: General speech recognition, quick notes
- **File Size**: Smallest, fastest processing

#### High Quality  
- **Sample Rate**: 44.1kHz (CD quality)
- **Format**: WAV with PCM codec
- **Use Case**: Meetings, interviews, important recordings
- **File Size**: Medium, better accuracy

#### Ultra Quality
- **Sample Rate**: 48kHz (professional audio)
- **Format**: WAV with PCM codec  
- **Use Case**: Critical recordings, noisy environments
- **File Size**: Largest, maximum accuracy

### 🔧 **Smart Features**
- **Silence Detection**: Automatic recording stop after 3s of silence
- **Device Auto-Selection**: Chooses best available microphone
- **Error Recovery**: Automatic retries with fallback strategies
- **History Management**: Track and reuse previous transcriptions
- **Mode Switching**: Toggle between cursor insertion and clipboard copy

## 🤝 Community and Support

### 📞 **Get Help**
- 🐛 [GitHub Issues](https://github.com/speak-y/vs-code-speech-to-text/issues) - Report a problem
- 💡 [Feature Requests](https://github.com/speak-y/vs-code-speech-to-text/discussions) - Suggest improvements


### 🛠️ **Development**

#### Environment Setup
```bash
git clone https://github.com/speak-y/vs-code-speech-to-text.git
cd vs-code-speech-to-text
npm install
npm run compile
```

#### Run Tests
```bash
npm run test:unit      # Unit tests
npm run test:integration # Integration tests
npm run test:cursor    # Cursor integration tests
```