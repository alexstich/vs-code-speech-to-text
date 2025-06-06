# Speech to Text with Whisper

> Professional voice input extension for VS Code and Cursor IDE with OpenAI Whisper API integration.

[![VS Code](https://img.shields.io/badge/VS%20Code-1.74.0+-blue.svg)](https://code.visualstudio.com/)
[![Cursor IDE](https://img.shields.io/badge/Cursor%20IDE-Supported-green.svg)](https://cursor.sh/)
[![OpenAI Whisper](https://img.shields.io/badge/OpenAI-Whisper%20API-orange.svg)](https://openai.com/research/whisper)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## Key Features

### Professional Audio Recording
- High-quality recording using FFmpeg
- Cross-platform support: Windows, macOS, Linux
- Multiple formats: WAV, MP3, WebM, Opus
- Automatic device detection

### AI Transcription
- OpenAI Whisper API with support for 40+ languages
- Auto language detection and context prompts
- Configurable temperature for recognition accuracy

### Smart Text Insertion
- Insert at cursor position or copy to clipboard
- **Cursor IDE Integration**: Direct send to AI chat

> **Important Note**: Chat insertion functions use unofficial Cursor IDE APIs and may change in future versions.

## Quick Start

### 1. Install FFmpeg (Required)

**Windows**
```bash
winget install FFmpeg
```

**macOS**
```bash
brew install ffmpeg
```

**Linux**
```bash
# Ubuntu/Debian
sudo apt update && sudo apt install ffmpeg

# Fedora/RHEL
sudo dnf install ffmpeg
```

### 2. Install Extension

1. Open VS Code or Cursor IDE
2. Go to Extensions (`Ctrl+Shift+X`)
3. Search for "Speech to Text with Whisper"
4. Click **Install**

### 3. Configure API Key

1. Get API key from [platform.openai.com](https://platform.openai.com/api-keys)
2. Open Settings (`Ctrl+,`)
3. Search for "Speech to Text with Whisper"
4. Enter your OpenAI API key

### 4. Start Recording

1. Press **Ctrl+Shift+M** to start/stop recording
2. Speak clearly into the microphone
3. Text will insert at cursor or copy to clipboard

## Keyboard Shortcuts

| Combination | Action |
|------------|----------|
| **Ctrl+Shift+M** | Record and Insert Text |
| **Ctrl+Shift+N** | Record and Send to AI Chat |

## Settings

### Basic Settings

| Parameter | Description | Default |
|----------|-------------|---------|
| **API Key** | OpenAI key for Whisper | *Required* |
| **Language** | Recognition language | Auto-detect |
| **Prompt** | Context for accuracy | Default prompt |
| **Temperature** | Creativity (0-1) | 0.1 |

### Audio Settings

| Parameter | Description | Default |
|----------|-------------|---------|
| **Audio Quality** | Recording quality | Standard |
| **Max Duration** | Recording time limit | 3600s |
| **Silence Detection** | Auto-stop on silence | Enabled |
| **Input Device** | Audio input | Auto |

## Supported Languages

**Main Languages**: English, Russian, Spanish, French, German, Italian, Portuguese

**Asian Languages**: Chinese, Japanese, Korean, Hindi, Thai, Indonesian, Vietnamese

**European Languages**: Dutch, Swedish, Norwegian, Danish, Finnish, Greek, Hungarian, Czech, Polish, Romanian, Ukrainian, Turkish

**Other Languages**: Arabic, Hebrew, Catalan

**Total: 43+ languages with automatic detection**

## Commands

Access via Command Palette (`Ctrl+Shift+P`):

### Recording
- `Speech to Text with Whisper: Record and Insert at Cursor or Clipboard`
- `Speech to Text with Whisper: Record and Open New Chat`

### Settings & Tools
- `Speech to Text with Whisper: Run Diagnostics`
- `Speech to Text with Whisper: Open Settings`
- `Speech to Text with Whisper: Select Audio Device`
- `Speech to Text with Whisper: Clear History`

## Extension Panel

Access via Activity Bar (microphone icon):

- **Device Manager**: Select audio input devices
- **Recording Mode**: Switch between "Insert Text" and "Copy to Clipboard"
- **Settings**: Quick access to configuration
- **History**: View and reuse past transcriptions
- **Diagnostics**: System health check

## System Requirements

- **VS Code**: 1.74.0 or newer
- **FFmpeg**: Installed in system
- **OpenAI API**: Key with Whisper access
- **Platform**: Windows 10/11, macOS, Linux

## Troubleshooting

### Common Issues

**"FFmpeg not found"**
1. Check installation: `ffmpeg -version`
2. Add FFmpeg to PATH (Windows)
3. Use "Run Diagnostics" command

**"Recording is already in progress"**
1. Wait for current recording to finish
2. Check status in Status Bar
3. Restart extension if stuck

**"No audio input devices"**
- **Windows**: Check DirectShow devices
- **macOS**: Allow microphone access in Privacy settings
- **Linux**: Add user to `audio` group

**"API key invalid"**
1. Check key format (starts with `sk-`)
2. Ensure account has credits
3. Use "Test API Key" command

### Diagnostics

Run `Speech to Text with Whisper: Run Diagnostics` from Command Palette for automatic system check.

## Development

```bash
git clone https://github.com/speak-y/vs-code-speech-to-text.git
cd vs-code-speech-to-text
npm install
npm run compile
npm run test
```

## Support

- [GitHub Issues](https://github.com/speak-y/vs-code-speech-to-text/issues) - Report problems
- [Discussions](https://github.com/speak-y/vs-code-speech-to-text/discussions) - Feature requests