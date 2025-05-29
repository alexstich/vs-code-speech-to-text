# SpeechToTextWhisper - Speech to Text Extension

Transform your voice into text effortlessly with OpenAI Whisper API integration for VS Code and Cursor IDE.

## ✨ Features

- **🎙️ Voice Recording**: High-quality audio recording using FFmpeg
- **🤖 AI Transcription**: Powered by OpenAI Whisper API for accurate speech-to-text
- **🎯 Smart Insertion**: Insert text at cursor, as comments, or replace selection
- **🔄 Multiple Modes**: Hold-to-record or toggle recording modes
- **🌐 Multi-language**: Support for auto-detection and 11+ languages
- **💬 Cursor Integration**: Special integration with Cursor IDE AI chat
- **⚡ Fast & Efficient**: Quick transcription with status bar indicators
- **🖥️ Cross-platform**: Native audio recording on Windows, macOS, and Linux

## 🚀 Quick Start

1. **Install FFmpeg** (required for audio recording):
   - **Windows**: Download from [ffmpeg.org](https://ffmpeg.org/download.html) or use `winget install FFmpeg`
   - **macOS**: `brew install ffmpeg`
   - **Linux**: `sudo apt install ffmpeg` (Ubuntu/Debian) or `sudo dnf install ffmpeg` (Fedora)

2. **Install the extension** from VS Code Marketplace

3. **Set your OpenAI API key**:
   - Open VS Code settings (`Ctrl+,` / `Cmd+,`)
   - Search for "SpeechToTextWhisper"
   - Enter your OpenAI API key

4. **Start recording**: Press `F9` and start speaking!

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `F9` | Toggle voice recording (hold mode) |
| `Ctrl+Shift+V` / `Cmd+Shift+V` | Start recording |
| `Ctrl+Shift+Alt+V` / `Cmd+Shift+Alt+V` | Record and send to AI chat |

## 🛠️ Configuration

### Basic Settings

- **API Key**: Your OpenAI API key for Whisper transcription
- **Language**: Choose specific language or auto-detect (default)
- **Recording Mode**: Hold or toggle recording
- **Insert Mode**: How to insert transcribed text
- **Audio Quality**: Standard or high quality recording (16kHz/44.1kHz)
- **Audio Format**: WAV or MP3 output format
- **Input Device**: Select specific microphone/audio input device

### Advanced Settings

- **Cursor Integration**: Enable special Cursor IDE features
- **Status Bar**: Show/hide recording status indicator
- **Context Detection**: Auto-detect active IDE context
- **Max Duration**: Set maximum recording length (5-300 seconds)
- **FFmpeg Path**: Custom FFmpeg executable path (auto-detected by default)
- **Recording Device**: Platform-specific input device selection

## 📋 Commands

Access via Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`):

- `SpeechToTextWhisper: Start Voice Recording`
- `SpeechToTextWhisper: Stop Voice Recording`
- `SpeechToTextWhisper: Toggle Voice Recording`
- `SpeechToTextWhisper: Record and Send to AI Chat`
- `SpeechToTextWhisper: Record and Insert as Comment`
- `SpeechToTextWhisper: Open SpeechToTextWhisper Settings`
- `SpeechToTextWhisper: Run Diagnostics`

## 🌍 Supported Languages

- Auto-detect (recommended)
- English, Russian, Spanish, French
- German, Italian, Portuguese
- Chinese, Japanese, Korean

## 🔧 Requirements

### System Requirements
- VS Code 1.74.0 or later
- **FFmpeg** (required for audio recording)
- OpenAI API key with Whisper access
- Audio input device (microphone)

### Platform Support
- **Windows 10/11**: DirectShow audio input
- **macOS**: AVFoundation audio input
- **Linux**: PulseAudio/ALSA audio input

### FFmpeg Installation

The extension requires FFmpeg for high-quality, cross-platform audio recording:

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

# Using MacPorts
sudo port install ffmpeg
```

#### Linux
```bash
# Ubuntu/Debian
sudo apt update && sudo apt install ffmpeg

# Fedora/RHEL
sudo dnf install ffmpeg

# Arch Linux
sudo pacman -S ffmpeg

# Alpine Linux
sudo apk add ffmpeg
```

## 🐛 Troubleshooting

### FFmpeg Issues

1. **FFmpeg not found**:
   - Verify FFmpeg is installed: run `ffmpeg -version` in terminal
   - On Windows, ensure FFmpeg is in your PATH environment variable
   - Use the "Run Diagnostics" command to check FFmpeg availability

2. **No audio input devices detected**:
   - **Windows**: Check if DirectShow devices are available
   - **macOS**: Verify microphone permissions in System Preferences
   - **Linux**: Ensure PulseAudio/ALSA is configured properly

3. **Recording permission denied**:
   - **macOS**: Grant microphone access in System Preferences > Privacy & Security
   - **Linux**: Add your user to the `audio` group: `sudo usermod -a -G audio $USER`
   - **Windows**: Check microphone privacy settings

### Common Issues

1. **Poor audio quality**: 
   - Adjust audio quality settings (try 44.1kHz for better quality)
   - Select correct input device in settings
   - Check microphone levels in your OS

2. **API errors**: 
   - Verify your OpenAI API key and account credits
   - Check internet connection for API requests

3. **Recording not starting**: 
   - Run diagnostics command to check system compatibility
   - Verify FFmpeg installation and audio device access
   - Check VS Code developer console for error messages

### Getting Help

- Use the **"Run Diagnostics"** command for automated troubleshooting
- Check the extension settings for configuration options
- Report issues on our GitHub repository with diagnostic output
- Ensure your OpenAI API key has Whisper API access

## 📊 Audio Recording Details

The extension uses FFmpeg for professional-grade audio recording:

- **Formats**: WAV (lossless) or MP3 (compressed)
- **Sample Rates**: 16kHz (standard) or 44.1kHz (high quality)
- **Channels**: Mono recording optimized for speech
- **Bitrate**: 128kbps for MP3, PCM for WAV
- **Platform Integration**: Native audio drivers for each OS

## 🎯 Use Cases

- **Code Documentation**: Quickly add voice comments to your code
- **AI Chat Interaction**: Voice input for Cursor IDE AI conversations  
- **Meeting Notes**: Transcribe discussions directly into your editor
- **Accessibility**: Voice input for hands-free coding
- **Multilingual Development**: Support for international teams
- **Cross-platform Development**: Consistent audio recording across all platforms

## 🔒 Privacy & Security

- Audio is only sent to OpenAI Whisper API for transcription
- Temporary audio files are automatically cleaned up after processing
- No audio data is stored permanently locally or elsewhere
- Your API key is stored securely in VS Code settings
- All communication uses HTTPS encryption
- FFmpeg processes run locally with minimal system permissions

## 📝 License

MIT License - see LICENSE file for details.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit issues and pull requests.

### Development Setup

1. Install FFmpeg development dependencies
2. Run `npm install` to install Node.js dependencies
3. Use the included FFmpeg mocks for testing
4. Test across multiple platforms when possible

---

**Made with ❤️ for developers who want to code with their voice**
