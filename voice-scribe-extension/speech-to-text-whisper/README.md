# VoiceScribe - Speech to Text Extension

Transform your voice into text effortlessly with OpenAI Whisper API integration for VS Code and Cursor IDE.

## ✨ Features

- **🎙️ Voice Recording**: Hold F9 or use command palette to record audio
- **🤖 AI Transcription**: Powered by OpenAI Whisper API for accurate speech-to-text
- **🎯 Smart Insertion**: Insert text at cursor, as comments, or replace selection
- **🔄 Multiple Modes**: Hold-to-record or toggle recording modes
- **🌐 Multi-language**: Support for auto-detection and 11+ languages
- **💬 Cursor Integration**: Special integration with Cursor IDE AI chat
- **⚡ Fast & Efficient**: Quick transcription with status bar indicators

## 🚀 Quick Start

1. **Install the extension** from VS Code Marketplace
2. **Set your OpenAI API key**:
   - Open VS Code settings (`Ctrl+,` / `Cmd+,`)
   - Search for "VoiceScribe"
   - Enter your OpenAI API key
3. **Start recording**: Press `F9` and start speaking!

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
- **Audio Quality**: Standard or high quality recording

### Advanced Settings

- **Cursor Integration**: Enable special Cursor IDE features
- **Status Bar**: Show/hide recording status indicator
- **Context Detection**: Auto-detect active IDE context
- **Max Duration**: Set maximum recording length (5-300 seconds)

## 📋 Commands

Access via Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`):

- `VoiceScribe: Start Voice Recording`
- `VoiceScribe: Stop Voice Recording`
- `VoiceScribe: Toggle Voice Recording`
- `VoiceScribe: Record and Send to AI Chat`
- `VoiceScribe: Record and Insert as Comment`
- `VoiceScribe: Open VoiceScribe Settings`

## 🌍 Supported Languages

- Auto-detect (recommended)
- English, Russian, Spanish, French
- German, Italian, Portuguese
- Chinese, Japanese, Korean

## 🔧 Requirements

- VS Code 1.74.0 or later
- OpenAI API key with Whisper access
- Microphone access permission

## 🐛 Troubleshooting

### Common Issues

1. **No microphone access**: Grant microphone permissions in your browser/OS
2. **API errors**: Verify your OpenAI API key and account credits
3. **Recording not working**: Check microphone settings and restart VS Code
4. **Poor transcription quality**: Try adjusting audio quality settings

### Getting Help

- Check the extension settings for configuration options
- Report issues on our GitHub repository
- Ensure your OpenAI API key has Whisper API access

## 🎯 Use Cases

- **Code Documentation**: Quickly add voice comments to your code
- **AI Chat Interaction**: Voice input for Cursor IDE AI conversations  
- **Meeting Notes**: Transcribe discussions directly into your editor
- **Accessibility**: Voice input for hands-free coding
- **Multilingual Development**: Support for international teams

## 🔒 Privacy & Security

- Audio is only sent to OpenAI Whisper API for transcription
- No audio data is stored locally or elsewhere
- Your API key is stored securely in VS Code settings
- All communication uses HTTPS encryption

## 📝 License

MIT License - see LICENSE file for details.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit issues and pull requests.

---

**Made with ❤️ for developers who want to code with their voice**
