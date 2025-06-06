// vscodeMocks.ts - VS Code API mocks for testing

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
    public get: sinon.SinonStub;

    constructor() {
        // Create stub for get method
        this.get = sinon.stub();
        
        // Default settings for the extension with the correct speechToTextWhisper prefix
        this.config.set('speechToTextWhisper.apiKey', '');
        this.config.set('speechToTextWhisper.language', 'auto');
        this.config.set('speechToTextWhisper.whisperModel', 'whisper-1');
        this.config.set('speechToTextWhisper.audioQuality', 'standard');
        this.config.set('speechToTextWhisper.ffmpegPath', '');
        this.config.set('speechToTextWhisper.showStatusBar', true);
        this.config.set('speechToTextWhisper.maxRecordingDuration', 60);
        this.config.set('speechToTextWhisper.prompt', 'This is audio for speech recognition. Use punctuation and correct spelling.');
        this.config.set('speechToTextWhisper.temperature', 0.1);
        this.config.set('speechToTextWhisper.timeout', 30000);
        this.config.set('speechToTextWhisper.maxRetries', 3);
        this.config.set('speechToTextWhisper.silenceDetection', true);
        this.config.set('speechToTextWhisper.silenceDuration', 3);
        this.config.set('speechToTextWhisper.silenceThreshold', 50);
        this.config.set('speechToTextWhisper.inputDevice', 'auto');
        
        // Configure stub to return default values
        this.get.callsFake((key: string, defaultValue?: any) => {
            const fullKey = `speechToTextWhisper.${key}`;
            return this.config.get(fullKey) ?? defaultValue;
        });
    }

    update(key: string, value: any): Promise<void> {
        const fullKey = `speechToTextWhisper.${key}`;
        this.config.set(fullKey, value);
        return Promise.resolve();
    }

    has(key: string): boolean {
        const fullKey = `speechToTextWhisper.${key}`;
        return this.config.has(fullKey);
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
        // Return a function that adds a listener
        const eventFunction = (listener: (e: any) => void): MockDisposable => {
            this.listeners.push(listener);
            return new MockDisposable();
        };

        // Copy methods to the function
        Object.setPrototypeOf(eventFunction, MockEvent.prototype);
        (eventFunction as any).listeners = this.listeners;
        (eventFunction as any).emit = this.emit.bind(this);
        
        return eventFunction as any;
    }

    addListener(listener: (e: any) => void): MockDisposable {
        this.listeners.push(listener);
        return new MockDisposable();
    }

    // Method for tests - emits an event
    emit(data: any): void {
        this.listeners.forEach(listener => listener(data));
    }
}

// Main object for mocking VS Code API
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
        visibleTextEditors: [] as MockTextEditor[],
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
        getConfiguration: sinon.stub().callsFake((section?: string) => {
            // Return different configurations depending on the section
            if (section === 'speechToText') {
                return new MockWorkspaceConfiguration();
            } else if (section === 'speechToTextWhisper') {
                return new MockWorkspaceConfiguration();
            } else {
                return new MockWorkspaceConfiguration();
            }
        }),
        onDidChangeConfiguration: sinon.stub().returns(new MockDisposable()),
        onDidChangeWorkspaceFolders: (listener: (e: any) => void) => {
            return new MockDisposable();
        }
    },

    commands: {
        registerCommand: sinon.stub().returns(new MockDisposable()),
        executeCommand: sinon.stub().resolves(),
        getCommands: sinon.stub().resolves([
            'speechToTextWhisper.startRecording',
            'speechToTextWhisper.stopRecording',
            'speechToTextWhisper.toggleRecording',
            'speechToTextWhisper.startHoldToRecord',
            'speechToTextWhisper.stopHoldToRecord',
            'speechToTextWhisper.insertAtCursor',
            'speechToTextWhisper.insertAsComment',
            'speechToTextWhisper.replaceSelection',
            'speechToTextWhisper.copyToClipboard',
            'speechToTextWhisper.openSettings',
            'speechToTextWhisper.showHelp',
            'speechToTextWhisper.showStatus',
            'speechToTextWhisper.checkMicrophone',
            'speechToTextWhisper.testApiKey',
            'speechToTextWhisper.resetConfiguration',
            'speechToTextWhisper.toggleStatusBar'
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
    // DO NOT set the active editor by default - tests should do this explicitly
    mockVscode.window.activeTextEditor = null;
    mockVscode.window.activeTerminal = null;
    mockVscode.window.visibleTextEditors = [];
    
    // Clear debug session
    Object.defineProperty(mockVscode.debug, 'activeDebugSession', {
        value: null,
        writable: true,
        configurable: true
    });
    
    // Create a new stub for getConfiguration
    mockVscode.workspace.getConfiguration = sinon.stub().callsFake((section?: string) => {
        // Return different configurations depending on the section
        if (section === 'speechToText') {
            return new MockWorkspaceConfiguration();
        } else if (section === 'speechToTextWhisper') {
            return new MockWorkspaceConfiguration();
        } else {
            return new MockWorkspaceConfiguration();
        }
    });
    
    // Reset all stubs
    resetVSCodeMocks();
}

export function resetVSCodeMocks(): void {
    // Reset stubs in window
    (mockVscode.window.showInformationMessage as sinon.SinonStub).resetHistory();
    (mockVscode.window.showWarningMessage as sinon.SinonStub).resetHistory();
    (mockVscode.window.showErrorMessage as sinon.SinonStub).resetHistory();
    (mockVscode.window.createStatusBarItem as sinon.SinonStub).resetHistory();

    // Reset stubs in workspace
    (mockVscode.workspace.getConfiguration as sinon.SinonStub).resetHistory();
    (mockVscode.workspace.onDidChangeConfiguration as sinon.SinonStub).resetHistory();

    // Reset stubs in commands
    (mockVscode.commands.registerCommand as sinon.SinonStub).resetHistory();
    (mockVscode.commands.executeCommand as sinon.SinonStub).resetHistory();
    (mockVscode.commands.getCommands as sinon.SinonStub).resetHistory();

    // Reset stubs in clipboard
    (mockVscode.env.clipboard.writeText as sinon.SinonStub).resetHistory();

    // Reset stubs in Uri
    (mockVscode.Uri.parse as sinon.SinonStub).resetHistory();

    // Reset stubs in extensions
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