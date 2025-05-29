# Техническая интеграция с IDE

## VS Code Extension API

### Основные компоненты интеграции

#### 1. Регистрация команд
```typescript
// extension.ts
export function activate(context: vscode.ExtensionContext) {
    // Регистрация команд для записи
    const startRecordingCommand = vscode.commands.registerCommand(
        'voiceScribe.startRecording', 
        () => audioRecorder.startRecording()
    );
    
    const stopRecordingCommand = vscode.commands.registerCommand(
        'voiceScribe.stopRecording',
        () => audioRecorder.stopRecording()
    );
    
    context.subscriptions.push(startRecordingCommand, stopRecordingCommand);
}
```

#### 2. Статус-бар интеграция
```typescript
// statusBar.ts
export class StatusBarManager {
    private statusBarItem: vscode.StatusBarItem;
    
    constructor() {
        this.statusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right, 
            100
        );
        this.statusBarItem.command = 'voiceScribe.toggleRecording';
        this.statusBarItem.show();
    }
    
    updateRecordingState(isRecording: boolean) {
        this.statusBarItem.text = isRecording ? 
            '$(record) Recording...' : 
            '$(mic) Voice';
        this.statusBarItem.tooltip = isRecording ? 
            'Click to stop recording' : 
            'Click to start recording';
    }
}
```

#### 3. Вставка текста в редактор
```typescript
// textInserter.ts
export class TextInserter {
    async insertAtCursor(text: string): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            throw new Error('No active editor');
        }
        
        const position = editor.selection.active;
        await editor.edit(editBuilder => {
            editBuilder.insert(position, text);
        });
    }
    
    async insertAsComment(text: string): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return;
        
        const languageId = editor.document.languageId;
        const commentPrefix = this.getCommentPrefix(languageId);
        const commentedText = `${commentPrefix} ${text}`;
        
        await this.insertAtCursor(commentedText + '\n');
    }
    
    private getCommentPrefix(languageId: string): string {
        const commentMap: Record<string, string> = {
            'javascript': '//',
            'typescript': '//',
            'python': '#',
            'rust': '//',
            'go': '//',
            'java': '//',
            'csharp': '//',
            'cpp': '//',
            'c': '//'
        };
        return commentMap[languageId] || '//';
    }
}
```

## Cursor IDE Integration

### Обнаружение Cursor IDE
```typescript
// contextManager.ts
export class ContextManager {
    detectIDE(): 'vscode' | 'cursor' | 'unknown' {
        // Cursor основан на VS Code, но имеет специфичные расширения
        const product = vscode.env.appName;
        if (product.toLowerCase().includes('cursor')) {
            return 'cursor';
        } else if (product.toLowerCase().includes('visual studio code')) {
            return 'vscode';
        }
        return 'unknown';
    }
    
    detectActiveContext(): 'editor' | 'chat' | 'terminal' | 'unknown' {
        const activeEditor = vscode.window.activeTextEditor;
        
        // Проверяем активное окно
        if (activeEditor) {
            const uri = activeEditor.document.uri;
            
            // Cursor chat имеет специфичный scheme
            if (uri.scheme === 'cursor-chat' || 
                uri.path.includes('chat')) {
                return 'chat';
            }
            
            if (uri.scheme === 'file') {
                return 'editor';
            }
        }
        
        // Проверяем активный терминал
        if (vscode.window.activeTerminal) {
            return 'terminal';
        }
        
        return 'unknown';
    }
}
```

### Интеграция с AI-чатом Cursor

#### Методы интеграции

**1. Через буфер обмена (самый надежный)**
```typescript
// cursorChatIntegration.ts
export class CursorChatIntegration {
    async sendToChat(text: string): Promise<void> {
        // Копируем текст в буфер обмена
        await vscode.env.clipboard.writeText(text);
        
        // Фокусируемся на поле ввода чата
        await this.focusChatInput();
        
        // Вставляем текст
        await vscode.commands.executeCommand('editor.action.clipboardPasteAction');
        
        // Опционально отправляем сообщение
        if (this.shouldAutoSend()) {
            await vscode.commands.executeCommand('workbench.action.acceptSuggestion');
        }
    }
    
    private async focusChatInput(): Promise<void> {
        // Пытаемся найти и сфокусироваться на поле ввода чата
        await vscode.commands.executeCommand('workbench.view.extension.cursor-chat');
        
        // Даем время для открытия панели
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Пытаемся сфокусироваться на поле ввода
        await vscode.commands.executeCommand('workbench.action.terminal.focus');
    }
}
```

**2. Через команды VS Code**
```typescript
// Использование существующих команд Cursor (если доступны)
export class CursorCommandIntegration {
    async sendToChat(text: string): Promise<void> {
        try {
            // Пытаемся использовать специфичные команды Cursor
            await vscode.commands.executeCommand('cursor.chat.sendMessage', {
                message: text
            });
        } catch (error) {
            // Fallback к методу через буфер обмена
            await this.fallbackToClipboard(text);
        }
    }
    
    private async fallbackToClipboard(text: string): Promise<void> {
        const integration = new CursorChatIntegration();
        await integration.sendToChat(text);
    }
}
```

**3. Через Webview (для расширенной интеграции)**
```typescript
// webviewIntegration.ts
export class WebviewChatIntegration {
    private panel: vscode.WebviewPanel | undefined;
    
    createChatPanel(): void {
        this.panel = vscode.window.createWebviewPanel(
            'voiceScribeChat',
            'Voice Scribe Chat',
            vscode.ViewColumn.Beside,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );
        
        this.panel.webview.html = this.getWebviewContent();
        
        // Обработка сообщений от webview
        this.panel.webview.onDidReceiveMessage(
            message => this.handleWebviewMessage(message)
        );
    }
    
    private getWebviewContent(): string {
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Voice Scribe Chat Interface</title>
                <style>
                    body { padding: 20px; }
                    .chat-input { width: 100%; min-height: 100px; }
                    .send-btn { margin-top: 10px; }
                </style>
            </head>
            <body>
                <h3>Voice Transcribed Text</h3>
                <textarea id="chatInput" class="chat-input" 
                         placeholder="Transcribed text will appear here..."></textarea>
                <button id="sendBtn" class="send-btn">Send to Cursor Chat</button>
                
                <script>
                    const vscode = acquireVsCodeApi();
                    
                    document.getElementById('sendBtn').addEventListener('click', () => {
                        const text = document.getElementById('chatInput').value;
                        vscode.postMessage({
                            command: 'sendToChat',
                            text: text
                        });
                    });
                    
                    // Прослушивание обновлений текста
                    window.addEventListener('message', event => {
                        const message = event.data;
                        if (message.command === 'updateText') {
                            document.getElementById('chatInput').value = message.text;
                        }
                    });
                </script>
            </body>
            </html>
        `;
    }
}
```

## Web Audio API для записи

### Основной класс записи аудио
```typescript
// audioRecorder.ts
export class AudioRecorder {
    private mediaRecorder: MediaRecorder | null = null;
    private audioChunks: Blob[] = [];
    private stream: MediaStream | null = null;
    
    async startRecording(): Promise<void> {
        try {
            // Получаем доступ к микрофону
            this.stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    sampleRate: 16000, // Оптимально для Whisper
                    channelCount: 1,   // Моно
                    echoCancellation: true,
                    noiseSuppression: true
                }
            });
            
            // Создаем MediaRecorder
            this.mediaRecorder = new MediaRecorder(this.stream, {
                mimeType: 'audio/webm;codecs=opus'
            });
            
            this.audioChunks = [];
            
            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.audioChunks.push(event.data);
                }
            };
            
            this.mediaRecorder.onstop = () => {
                this.processRecording();
            };
            
            this.mediaRecorder.start();
            
        } catch (error) {
            throw new Error(`Failed to start recording: ${error.message}`);
        }
    }
    
    async stopRecording(): Promise<Blob> {
        return new Promise((resolve, reject) => {
            if (!this.mediaRecorder) {
                reject(new Error('No active recording'));
                return;
            }
            
            this.mediaRecorder.onstop = () => {
                const audioBlob = new Blob(this.audioChunks, { 
                    type: 'audio/webm' 
                });
                this.cleanup();
                resolve(audioBlob);
            };
            
            this.mediaRecorder.stop();
        });
    }
    
    private cleanup(): void {
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
        this.mediaRecorder = null;
        this.audioChunks = [];
    }
    
    private async processRecording(): Promise<void> {
        const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
        
        // Конвертируем в WAV если нужно
        const wavBlob = await this.convertToWav(audioBlob);
        
        // Отправляем на транскрибацию
        await this.transcribeAudio(wavBlob);
    }
    
    private async convertToWav(blob: Blob): Promise<Blob> {
        // Реализация конвертации в WAV формат
        // Используем Web Audio API
        const arrayBuffer = await blob.arrayBuffer();
        const audioContext = new AudioContext();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        
        // Конвертируем в WAV
        return this.audioBufferToWav(audioBuffer);
    }
}
```

## OpenAI Whisper API интеграция

### Клиент для Whisper API
```typescript
// whisperClient.ts
export class WhisperClient {
    private apiKey: string;
    private baseURL = 'https://api.openai.com/v1';
    
    constructor(apiKey: string) {
        this.apiKey = apiKey;
    }
    
    async transcribe(audioBlob: Blob, options: TranscriptionOptions = {}): Promise<string> {
        const formData = new FormData();
        formData.append('file', audioBlob, 'audio.wav');
        formData.append('model', 'whisper-1');
        
        if (options.language) {
            formData.append('language', options.language);
        }
        
        if (options.prompt) {
            formData.append('prompt', options.prompt);
        }
        
        // Температура для определения креативности
        formData.append('temperature', '0');
        
        try {
            const response = await fetch(`${this.baseURL}/audio/transcriptions`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: formData
            });
            
            if (!response.ok) {
                throw new Error(`API Error: ${response.status} ${response.statusText}`);
            }
            
            const result = await response.json();
            return result.text;
            
        } catch (error) {
            throw new Error(`Transcription failed: ${error.message}`);
        }
    }
    
    async checkApiKey(): Promise<boolean> {
        try {
            const response = await fetch(`${this.baseURL}/models`, {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`
                }
            });
            return response.ok;
        } catch {
            return false;
        }
    }
}

export interface TranscriptionOptions {
    language?: string;  // ISO 639-1 код языка
    prompt?: string;    // Контекстная подсказка
    temperature?: number; // 0-1, креативность
}
```

## Горячие клавиши и команды

### Регистрация в package.json
```json
{
    "contributes": {
        "commands": [
            {
                "command": "voiceScribe.startRecording",
                "title": "Start Voice Recording",
                "category": "VoiceScribe"
            },
            {
                "command": "voiceScribe.stopRecording", 
                "title": "Stop Voice Recording",
                "category": "VoiceScribe"
            },
            {
                "command": "voiceScribe.toggleRecording",
                "title": "Toggle Voice Recording",
                "category": "VoiceScribe"
            }
        ],
        "keybindings": [
            {
                "command": "voiceScribe.toggleRecording",
                "key": "F9",
                "when": "editorTextFocus"
            },
            {
                "command": "voiceScribe.startRecording",
                "key": "ctrl+shift+v",
                "when": "editorTextFocus"
            }
        ],
        "configuration": {
            "title": "VoiceScribe",
            "properties": {
                "voiceScribe.apiKey": {
                    "type": "string",
                    "description": "OpenAI API Key for Whisper",
                    "scope": "application"
                },
                "voiceScribe.language": {
                    "type": "string", 
                    "default": "auto",
                    "description": "Language for transcription (auto-detect if 'auto')"
                },
                "voiceScribe.recordingMode": {
                    "type": "string",
                    "enum": ["hold", "toggle"],
                    "default": "hold",
                    "description": "Recording mode: hold button or toggle on/off"
                }
            }
        }
    }
}
```

## Обработка ошибок и fallback

### Централизованная обработка ошибок
```typescript
// errorHandler.ts
export class ErrorHandler {
    static async handleRecordingError(error: Error): Promise<void> {
        if (error.name === 'NotAllowedError') {
            vscode.window.showErrorMessage(
                'Microphone access denied. Please allow microphone access in browser settings.',
                'Open Settings'
            ).then(selection => {
                if (selection === 'Open Settings') {
                    vscode.env.openExternal(vscode.Uri.parse('https://support.google.com/chrome/answer/2693767'));
                }
            });
        } else if (error.name === 'NotFoundError') {
            vscode.window.showErrorMessage('No microphone found. Please connect a microphone.');
        } else {
            vscode.window.showErrorMessage(`Recording error: ${error.message}`);
        }
    }
    
    static async handleApiError(error: Error): Promise<void> {
        if (error.message.includes('401')) {
            vscode.window.showErrorMessage(
                'Invalid OpenAI API key. Please check your configuration.',
                'Open Settings'
            ).then(selection => {
                if (selection === 'Open Settings') {
                    vscode.commands.executeCommand('workbench.action.openSettings', 'voiceScribe.apiKey');
                }
            });
        } else if (error.message.includes('429')) {
            vscode.window.showWarningMessage('API rate limit exceeded. Please wait and try again.');
        } else {
            vscode.window.showErrorMessage(`Transcription error: ${error.message}`);
        }
    }
}
```

Эта техническая документация покрывает все основные аспекты интеграции с VS Code и Cursor IDE, включая обходные пути для работы с AI-чатом и надежную обработку аудио. 