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
exports.mockVscode = exports.MockThemeColor = exports.MockExtensionContext = exports.MockWorkspaceConfiguration = exports.MockStatusBarItem = exports.MockPosition = exports.MockSelection = exports.MockTextDocument = exports.MockTextEditor = void 0;
exports.setupVSCodeMocks = setupVSCodeMocks;
exports.resetVSCodeMocks = resetVSCodeMocks;
exports.setActiveEditor = setActiveEditor;
exports.clearActiveEditor = clearActiveEditor;
exports.setConfiguration = setConfiguration;
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
        // Мок для получения текста документа
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
    get(key, defaultValue) {
        return this.config.get(key) || defaultValue;
    }
    set(key, value) {
        this.config.set(key, value);
    }
    has(key) {
        return this.config.has(key);
    }
}
exports.MockWorkspaceConfiguration = MockWorkspaceConfiguration;
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
    window: {
        activeTextEditor: null,
        activeTerminal: null,
        showInformationMessage: sinon.stub(),
        showWarningMessage: sinon.stub(),
        showErrorMessage: sinon.stub(),
        createStatusBarItem: sinon.stub().returns(new MockStatusBarItem())
    },
    workspace: {
        getConfiguration: sinon.stub().returns(new MockWorkspaceConfiguration())
    },
    commands: {
        registerCommand: sinon.stub().returns({ dispose: sinon.stub() }),
        executeCommand: sinon.stub()
    },
    env: {
        clipboard: {
            writeText: sinon.stub()
        }
    }
};
function setupVSCodeMocks() {
    // Мокируем активный редактор
    exports.mockVscode.window.activeTextEditor = new MockTextEditor();
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
    // Сброс стабов в clipboard
    exports.mockVscode.env.clipboard.writeText.resetHistory();
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
        mockConfig.set(key, value);
    });
    exports.mockVscode.workspace.getConfiguration = sinon.stub().returns(mockConfig);
}
//# sourceMappingURL=vscodeMocks.js.map