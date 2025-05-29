// vscodeMocks.ts - моки для VS Code API для тестирования

import * as sinon from 'sinon';

export class MockTextEditor {
    public document: MockTextDocument;
    public selection: MockSelection;
    public edit: sinon.SinonStub;

    constructor(languageId: string = 'javascript') {
        this.document = new MockTextDocument(languageId);
        this.selection = new MockSelection();
        this.edit = sinon.stub().resolves(true);
    }
}

export class MockTextDocument {
    public languageId: string;
    public fileName: string = 'test.js';
    public uri: any = { fsPath: '/test/test.js' };

    constructor(languageId: string = 'javascript') {
        this.languageId = languageId;
    }

    getText(range?: any): string {
        if (range) {
            return 'selected text';
        }
        return 'document content';
    }

    lineAt(line: number): any {
        return {
            text: '    some indented text',
            firstNonWhitespaceCharacterIndex: 4
        };
    }
}

export class MockSelection {
    public active: MockPosition;
    public anchor: MockPosition;
    public isEmpty: boolean = false;

    constructor() {
        this.active = new MockPosition(0, 0);
        this.anchor = new MockPosition(0, 0);
    }
}

export class MockPosition {
    public line: number;
    public character: number;

    constructor(line: number, character: number) {
        this.line = line;
        this.character = character;
    }

    translate(deltaLine: number, deltaCharacter: number): MockPosition {
        return new MockPosition(this.line + deltaLine, this.character + deltaCharacter);
    }
}

export class MockStatusBarItem {
    public text: string = '';
    public tooltip: string = '';
    public command: string = '';
    public backgroundColor: any = undefined;
    public show: sinon.SinonStub = sinon.stub();
    public hide: sinon.SinonStub = sinon.stub();
    public dispose: sinon.SinonStub = sinon.stub();
}

export class MockWorkspaceConfiguration {
    private config: Map<string, any> = new Map();

    constructor() {
        // Настройки по умолчанию для расширения
        this.config.set('voiceScribe.apiKey', 'test-api-key');
        this.config.set('voiceScribe.language', 'en');
        this.config.set('voiceScribe.quality', 'standard');
        this.config.set('voiceScribe.toggleMode', false);
        this.config.set('voiceScribe.maxRecordingDuration', 60);
        this.config.set('voiceScribe.insertMode', 'cursor');
        
        // Настройки аудио качества
        this.config.set('voiceScribe.audioQuality.format', 'webm');
        this.config.set('voiceScribe.audioQuality.sampleRate', 16000);
        this.config.set('voiceScribe.audioQuality.channelCount', 1);
        this.config.set('voiceScribe.audioQuality.bitRate', 128000);
        this.config.set('voiceScribe.audioQuality.enableAudioProcessing', true);
        this.config.set('voiceScribe.audioQuality.noiseSuppression', true);
        this.config.set('voiceScribe.audioQuality.autoGainControl', true);
        this.config.set('voiceScribe.audioQuality.echoCancellation', true);
    }

    get<T>(key: string, defaultValue?: T): T {
        return this.config.get(key) || defaultValue;
    }

    update(key: string, value: any): Promise<void> {
        this.config.set(key, value);
        return Promise.resolve();
    }

    has(key: string): boolean {
        return this.config.has(key);
    }
}

export class MockExtension {
    public id: string;
    public isActive: boolean = false;
    public activate: sinon.SinonStub = sinon.stub().resolves();

    constructor(id: string) {
        this.id = id;
    }
}

export class MockExtensionContext {
    public subscriptions: any[] = [];
    public workspaceState: any = {
        get: sinon.stub(),
        update: sinon.stub()
    };
    public globalState: any = {
        get: sinon.stub(),
        update: sinon.stub()
    };
}

export class MockThemeColor {
    public id: string;

    constructor(id: string) {
        this.id = id;
    }
}

export class MockDisposable {
    public dispose: sinon.SinonStub = sinon.stub();
}

export class MockEvent {
    private listeners: Array<(e: any) => void> = [];

    constructor() {
        // Возвращаем функцию, которая добавляет слушателя
        const eventFunction = (listener: (e: any) => void): MockDisposable => {
            this.listeners.push(listener);
            return new MockDisposable();
        };

        // Копируем методы в функцию
        Object.setPrototypeOf(eventFunction, MockEvent.prototype);
        (eventFunction as any).listeners = this.listeners;
        (eventFunction as any).emit = this.emit.bind(this);
        
        return eventFunction as any;
    }

    addListener(listener: (e: any) => void): MockDisposable {
        this.listeners.push(listener);
        return new MockDisposable();
    }

    // Метод для тестов - эмитирует событие
    emit(data: any): void {
        this.listeners.forEach(listener => listener(data));
    }
}

// Основной объект для мокирования VS Code API
export const mockVscode = {
    StatusBarAlignment: {
        Left: 1,
        Right: 2
    },
    
    ThemeColor: MockThemeColor,
    
    Selection: class {
        constructor(public anchor: any, public active: any) {}
    },

    Position: MockPosition,

    Uri: {
        parse: sinon.stub().returns({ scheme: 'vscode' })
    },

    window: {
        activeTextEditor: null as MockTextEditor | null,
        activeTerminal: null as any,
        showInformationMessage: sinon.stub().resolves('OK'),
        showWarningMessage: sinon.stub().resolves('OK'),
        showErrorMessage: sinon.stub().resolves('OK'),
        createStatusBarItem: sinon.stub().returns(new MockStatusBarItem()),
        onDidChangeActiveTextEditor: (listener: (e: any) => void) => {
            return new MockDisposable();
        },
        onDidChangeTextEditorSelection: (listener: (e: any) => void) => {
            return new MockDisposable();
        },
        onDidChangeActiveTerminal: (listener: (e: any) => void) => {
            return new MockDisposable();
        },
        state: {
            focused: true
        }
    },

    workspace: {
        getConfiguration: sinon.stub().returns(new MockWorkspaceConfiguration()),
        onDidChangeWorkspaceFolders: (listener: (e: any) => void) => {
            return new MockDisposable();
        }
    },

    commands: {
        registerCommand: sinon.stub().returns(new MockDisposable()),
        executeCommand: sinon.stub().resolves(),
        getCommands: sinon.stub().resolves([
            'voiceScribe.startRecording',
            'voiceScribe.stopRecording',
            'voiceScribe.toggleRecording',
            'voiceScribe.startHoldToRecord',
            'voiceScribe.stopHoldToRecord',
            'voiceScribe.insertAtCursor',
            'voiceScribe.insertAsComment',
            'voiceScribe.replaceSelection',
            'voiceScribe.copyToClipboard',
            'voiceScribe.openSettings',
            'voiceScribe.showHelp',
            'voiceScribe.showStatus',
            'voiceScribe.checkMicrophone',
            'voiceScribe.testApiKey',
            'voiceScribe.resetConfiguration',
            'voiceScribe.toggleStatusBar'
        ])
    },

    env: {
        clipboard: {
            writeText: sinon.stub().resolves()
        },
        appName: 'Visual Studio Code',
        uriScheme: 'vscode'
    },

    debug: {
        activeDebugSession: null,
        onDidStartDebugSession: (listener: (e: any) => void) => {
            return new MockDisposable();
        },
        onDidTerminateDebugSession: (listener: (e: any) => void) => {
            return new MockDisposable();
        }
    },

    extensions: {
        getExtension: sinon.stub().callsFake((id: string) => {
            if (id === 'voicescribe.voice-scribe') {
                const extension = new MockExtension(id);
                extension.isActive = true;
                return extension;
            }
            return undefined;
        }),
        all: []
    }
};

export function setupVSCodeMocks(): void {
    // Мокируем активный редактор
    mockVscode.window.activeTextEditor = new MockTextEditor();
    
    // Создаем новый экземпляр конфигурации для каждого теста
    mockVscode.workspace.getConfiguration = sinon.stub().returns(new MockWorkspaceConfiguration());
    
    // Сброс всех стабов
    resetVSCodeMocks();
}

export function resetVSCodeMocks(): void {
    // Сброс стабов в window
    (mockVscode.window.showInformationMessage as sinon.SinonStub).resetHistory();
    (mockVscode.window.showWarningMessage as sinon.SinonStub).resetHistory();
    (mockVscode.window.showErrorMessage as sinon.SinonStub).resetHistory();
    (mockVscode.window.createStatusBarItem as sinon.SinonStub).resetHistory();

    // Сброс стабов в workspace
    (mockVscode.workspace.getConfiguration as sinon.SinonStub).resetHistory();

    // Сброс стабов в commands
    (mockVscode.commands.registerCommand as sinon.SinonStub).resetHistory();
    (mockVscode.commands.executeCommand as sinon.SinonStub).resetHistory();
    (mockVscode.commands.getCommands as sinon.SinonStub).resetHistory();

    // Сброс стабов в clipboard
    (mockVscode.env.clipboard.writeText as sinon.SinonStub).resetHistory();

    // Сброс стабов в Uri
    (mockVscode.Uri.parse as sinon.SinonStub).resetHistory();

    // Сброс стабов в extensions
    (mockVscode.extensions.getExtension as sinon.SinonStub).resetHistory();
}

export function setActiveEditor(languageId: string = 'javascript'): MockTextEditor {
    const editor = new MockTextEditor(languageId);
    mockVscode.window.activeTextEditor = editor;
    return editor;
}

export function clearActiveEditor(): void {
    mockVscode.window.activeTextEditor = null;
}

export function setConfiguration(config: Record<string, any>): void {
    const mockConfig = new MockWorkspaceConfiguration();
    Object.entries(config).forEach(([key, value]) => {
        mockConfig.update(key, value);
    });
    mockVscode.workspace.getConfiguration = sinon.stub().returns(mockConfig);
}

export function setCursorEnvironment(): void {
    mockVscode.env.appName = 'Cursor';
    mockVscode.env.uriScheme = 'cursor';
}

export function setVSCodeEnvironment(): void {
    mockVscode.env.appName = 'Visual Studio Code';
    mockVscode.env.uriScheme = 'vscode';
} 