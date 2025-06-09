# Speech to Text with Whisper

> Professional voice input extension for VS Code and Cursor IDE with OpenAI Whisper API integration and AI text post-processing.

[![VS Code](https://img.shields.io/badge/VS%20Code-1.74.0+-blue.svg)](https://code.visualstudio.com/)
[![Cursor IDE](https://img.shields.io/badge/Cursor%20IDE-Supported-green.svg)](https://cursor.sh/)
[![OpenAI Whisper](https://img.shields.io/badge/OpenAI-Whisper%20API-orange.svg)](https://openai.com/research/whisper)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## Core Functions

| Shortcut | Action |
|----------|--------|
| **Ctrl+Shift+N** | 💬 **Record and Send to AI Chat** - Record speech and send transcribed text directly to Cursor IDE chat |
| **Ctrl+Shift+M** | 🎤 **Record and Insert Text** - Record speech and insert transcribed text at cursor position |

## Key Features

### Professional Audio Recording
- High-quality recording using FFmpeg • Cross-platform support: Windows, macOS, Linux
- Multiple formats: WAV, MP3, WebM, Opus • Automatic device detection

### AI Transcription & Post-Processing
- **OpenAI Whisper API** with support for 40+ languages and auto language detection
- **AI Text Post-Processing** - Improve transcribed text quality using GPT models
  - Remove filler words (um, uh, like, you know)
  - Add proper punctuation and capitalization
  - Structure sentences for better readability
  - Maintain original meaning and technical terms

### Smart Text Insertion
- Insert at cursor position or copy to clipboard
- **Cursor IDE Integration**: Direct send to AI chat

> **Important Note**: Chat insertion functions use unofficial Cursor IDE APIs and may change in future versions.

## Quick Start

### 1. Install FFmpeg (Required)

**Windows**: `winget install FFmpeg` | **macOS**: `brew install ffmpeg` | **Linux**: `sudo apt install ffmpeg`

### 2. Install Extension

Open VS Code/Cursor IDE → Extensions (`Ctrl+Shift+X`) → Search "Speech to Text with Whisper" → Install

### 3. Configure API Key

Get API key from [platform.openai.com](https://platform.openai.com/api-keys) → Settings (`Ctrl+,`) → Search "Speech to Text with Whisper" → Enter OpenAI API key

### 4. Start Recording

Press **Ctrl+Shift+N** for AI chat or **Ctrl+Shift+M** for text insertion

## Settings

### Basic Settings

| Parameter | Description | Default |
|----------|-------------|---------|
| **API Key** | OpenAI key for Whisper | *Required* |
| **Language** | Recognition language | Auto-detect |
| **Prompt** | Context for accuracy | Default prompt |
| **Temperature** | Creativity (0-1) | 0.1 |

### Post-Processing Settings

| Parameter | Description | Default |
|----------|-------------|---------|
| **Model** | AI model for text improvement | gpt-4.1-mini |
| **Custom Prompt** | Instructions for text improvement | Default prompt |
| **Min Text Length** | Minimum characters to trigger post-processing | 50 |
| **Timeout** | Post-processing request timeout | 30000ms |

**Available Models**: Without post-processing, GPT-4.1 Mini (recommended), GPT-4o, GPT-3.5 Turbo, o1, o3, and others

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

**Recording**
- `Speech to Text with Whisper: Record and Insert at Cursor or Clipboard`
- `Speech to Text with Whisper: Record and Open New Chat`

**Settings & Tools**
- `Speech to Text with Whisper: Run Diagnostics`
- `Speech to Text with Whisper: Open Settings`
- `Speech to Text with Whisper: Select Audio Device`
- `Speech to Text with Whisper: Clear History`

## Extension Panel

Access via Activity Bar (microphone icon):

- **Device Manager**: Select audio input devices
- **Recording Mode**: Switch between "Insert Text" and "Copy to Clipboard"
- **Settings**: Quick access to configuration
- **History**: View and reuse past transcriptions with post-processing indicators
- **Diagnostics**: System health check

## System Requirements

- **VS Code**: 1.74.0+ • **FFmpeg**: Installed in system
- **OpenAI API**: Key with Whisper access • **Platform**: Windows 10/11, macOS, Linux

## Troubleshooting

**"FFmpeg not found"**: Check installation with `ffmpeg -version`, add to PATH  
**"Recording in progress"**: Wait for completion or restart extension  
**"Recording stops automatically"**: Check silence detection sensitivity, increase to 30, 40, or 50 if needed  
**"No audio devices"**: Check DirectShow (Windows), Privacy settings (macOS), audio group (Linux)  
**"API key invalid"**: Verify format (starts with `sk-`), check credits

Run `Speech to Text with Whisper: Run Diagnostics` for automatic system check.

## Development

```bash
git clone https://github.com/alexstich/vs-code-speech-to-text.git
cd vs-code-speech-to-text
npm install && npm run compile && npm run test
```

## Support

- [GitHub Issues](https://github.com/alexstich/vs-code-speech-to-text/issues) - Report problems
- [Discussions](https://github.com/alexstich/vs-code-speech-to-text/discussions) - Feature requests