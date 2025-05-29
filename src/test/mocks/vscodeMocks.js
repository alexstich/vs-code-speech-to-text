"use strict";
// vscodeMocks.ts - моки для VS Code API для тестирования
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.mockVscode = exports.MockEvent = exports.MockDisposable = exports.MockThemeColor = exports.MockExtensionContext = exports.MockExtension = exports.MockWorkspaceConfiguration = exports.MockStatusBarItem = exports.MockPosition = exports.MockSelection = exports.MockTextDocument = exports.MockTextEditor = void 0;
exports.setupVSCodeMocks = setupVSCodeMocks;
exports.resetVSCodeMocks = resetVSCodeMocks;
exports.setActiveEditor = setActiveEditor;
exports.clearActiveEditor = clearActiveEditor;
exports.setConfiguration = setConfiguration;
exports.setCursorEnvironment = setCursorEnvironment;
exports.setVSCodeEnvironment = setVSCodeEnvironment;
const sinon = __importStar(require("sinon"));
class MockTextEditor {
    document;
    selection;
    edit;
    constructor(languageId = 'javascript') {
        this.document = new MockTextDocument(languageId);
        this.selection = new MockSelection();
        this.edit = sinon.stub().resolves(true);
    }
}
exports.MockTextEditor = MockTextEditor;
class MockTextDocument {
    languageId;
    fileName = 'test.js';
    uri = { fsPath: '/test/test.js' };
    constructor(languageId = 'javascript') {
        this.languageId = languageId;
    }
    getText(range) {
        if (range) {
            return 'selected text';
        }
        return 'document content';
    }
    lineAt(line) {
        return {
            text: '    some indented text',
            firstNonWhitespaceCharacterIndex: 4
        };
    }
}
exports.MockTextDocument = MockTextDocument;
class MockSelection {
    active;
    anchor;
    isEmpty = false;
    constructor() {
        this.active = new MockPosition(0, 0);
        this.anchor = new MockPosition(0, 0);
    }
}
exports.MockSelection = MockSelection;
class MockPosition {
    line;
    character;
    constructor(line, character) {
        this.line = line;
        this.character = character;
    }
    translate(deltaLine, deltaCharacter) {
        return new MockPosition(this.line + deltaLine, this.character + deltaCharacter);
    }
}
exports.MockPosition = MockPosition;
class MockStatusBarItem {
    text = '';
    tooltip = '';
    command = '';
    backgroundColor = undefined;
    show = sinon.stub();
    hide = sinon.stub();
    dispose = sinon.stub();
}
exports.MockStatusBarItem = MockStatusBarItem;
class MockWorkspaceConfiguration {
    config = new Map();
    constructor() {
        // Настройки по умолчанию для расширения
        this.config.set('speechToTextWhisper.apiKey', 'test-api-key');
        this.config.set('speechToTextWhisper.language', 'en');
        this.config.set('speechToTextWhisper.quality', 'standard');
        this.config.set('speechToTextWhisper.toggleMode', false);
        this.config.set('speechToTextWhisper.maxRecordingDuration', 60);
        this.config.set('speechToTextWhisper.insertMode', 'cursor');
        // Настройки аудио качества
        this.config.set('speechToTextWhisper.audioQuality.format', 'webm');
        this.config.set('speechToTextWhisper.audioQuality.sampleRate', 16000);
        this.config.set('speechToTextWhisper.audioQuality.channelCount', 1);
        this.config.set('speechToTextWhisper.audioQuality.bitRate', 128000);
        this.config.set('speechToTextWhisper.audioQuality.enableAudioProcessing', true);
        this.config.set('speechToTextWhisper.audioQuality.noiseSuppression', true);
        this.config.set('speechToTextWhisper.audioQuality.autoGainControl', true);
        this.config.set('speechToTextWhisper.audioQuality.echoCancellation', true);
    }
    get(key, defaultValue) {
        return this.config.get(key) || defaultValue;
    }
    update(key, value) {
        this.config.set(key, value);
        return Promise.resolve();
    }
    has(key) {
        return this.config.has(key);
    }
}
exports.MockWorkspaceConfiguration = MockWorkspaceConfiguration;
class MockExtension {
    id;
    isActive = false;
    activate = sinon.stub().resolves();
    constructor(id) {
        this.id = id;
    }
}
exports.MockExtension = MockExtension;
class MockExtensionContext {
    subscriptions = [];
    workspaceState = {
        get: sinon.stub(),
        update: sinon.stub()
    };
    globalState = {
        get: sinon.stub(),
        update: sinon.stub()
    };
}
exports.MockExtensionContext = MockExtensionContext;
class MockThemeColor {
    id;
    constructor(id) {
        this.id = id;
    }
}
exports.MockThemeColor = MockThemeColor;
class MockDisposable {
    dispose = sinon.stub();
}
exports.MockDisposable = MockDisposable;
class MockEvent {
    listeners = [];
    constructor() {
        // Возвращаем функцию, которая добавляет слушателя
        const eventFunction = (listener) => {
            this.listeners.push(listener);
            return new MockDisposable();
        };
        // Копируем методы в функцию
        Object.setPrototypeOf(eventFunction, MockEvent.prototype);
        eventFunction.listeners = this.listeners;
        eventFunction.emit = this.emit.bind(this);
        return eventFunction;
    }
    addListener(listener) {
        this.listeners.push(listener);
        return new MockDisposable();
    }
    // Метод для тестов - эмитирует событие
    emit(data) {
        this.listeners.forEach(listener => listener(data));
    }
}
exports.MockEvent = MockEvent;
// Основной объект для мокирования VS Code API
exports.mockVscode = {
    StatusBarAlignment: {
        Left: 1,
        Right: 2
    },
    ThemeColor: MockThemeColor,
    Selection: class {
        anchor;
        active;
        constructor(anchor, active) {
            this.anchor = anchor;
            this.active = active;
        }
    },
    Position: MockPosition,
    Uri: {
        parse: sinon.stub().returns({ scheme: 'vscode' })
    },
    window: {
        activeTextEditor: null,
        activeTerminal: null,
        showInformationMessage: sinon.stub().resolves('OK'),
        showWarningMessage: sinon.stub().resolves('OK'),
        showErrorMessage: sinon.stub().resolves('OK'),
        createStatusBarItem: sinon.stub().returns(new MockStatusBarItem()),
        onDidChangeActiveTextEditor: (listener) => {
            return new MockDisposable();
        },
        onDidChangeTextEditorSelection: (listener) => {
            return new MockDisposable();
        },
        onDidChangeActiveTerminal: (listener) => {
            return new MockDisposable();
        },
        state: {
            focused: true
        }
    },
    workspace: {
        getConfiguration: sinon.stub().returns(new MockWorkspaceConfiguration()),
        onDidChangeWorkspaceFolders: (listener) => {
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
        onDidStartDebugSession: (listener) => {
            return new MockDisposable();
        },
        onDidTerminateDebugSession: (listener) => {
            return new MockDisposable();
        }
    },
    extensions: {
        getExtension: sinon.stub().callsFake((id) => {
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
function setupVSCodeMocks() {
    // Мокируем активный редактор
    exports.mockVscode.window.activeTextEditor = new MockTextEditor();
    // Создаем новый экземпляр конфигурации для каждого теста
    exports.mockVscode.workspace.getConfiguration = sinon.stub().returns(new MockWorkspaceConfiguration());
    // Сброс всех стабов
    resetVSCodeMocks();
}
function resetVSCodeMocks() {
    // Сброс стабов в window
    exports.mockVscode.window.showInformationMessage.resetHistory();
    exports.mockVscode.window.showWarningMessage.resetHistory();
    exports.mockVscode.window.showErrorMessage.resetHistory();
    exports.mockVscode.window.createStatusBarItem.resetHistory();
    // Сброс стабов в workspace
    exports.mockVscode.workspace.getConfiguration.resetHistory();
    // Сброс стабов в commands
    exports.mockVscode.commands.registerCommand.resetHistory();
    exports.mockVscode.commands.executeCommand.resetHistory();
    exports.mockVscode.commands.getCommands.resetHistory();
    // Сброс стабов в clipboard
    exports.mockVscode.env.clipboard.writeText.resetHistory();
    // Сброс стабов в Uri
    exports.mockVscode.Uri.parse.resetHistory();
    // Сброс стабов в extensions
    exports.mockVscode.extensions.getExtension.resetHistory();
}
function setActiveEditor(languageId = 'javascript') {
    const editor = new MockTextEditor(languageId);
    exports.mockVscode.window.activeTextEditor = editor;
    return editor;
}
function clearActiveEditor() {
    exports.mockVscode.window.activeTextEditor = null;
}
function setConfiguration(config) {
    const mockConfig = new MockWorkspaceConfiguration();
    Object.entries(config).forEach(([key, value]) => {
        mockConfig.update(key, value);
    });
    exports.mockVscode.workspace.getConfiguration = sinon.stub().returns(mockConfig);
}
function setCursorEnvironment() {
    exports.mockVscode.env.appName = 'Cursor';
    exports.mockVscode.env.uriScheme = 'cursor';
}
function setVSCodeEnvironment() {
    exports.mockVscode.env.appName = 'Visual Studio Code';
    exports.mockVscode.env.uriScheme = 'vscode';
}
//# sourceMappingURL=vscodeMocks.js.map