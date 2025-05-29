"use strict";
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
const assert = __importStar(require("assert"));
const sinon = __importStar(require("sinon"));
// Mock для vscode API
const mockVSCode = {
    env: {
        appName: 'Visual Studio Code',
        uriScheme: 'vscode'
    },
    window: {
        activeTextEditor: null,
        activeTerminal: null,
        state: {
            focused: true
        },
        onDidChangeActiveTextEditor: sinon.stub(),
        onDidChangeTextEditorSelection: sinon.stub(),
        onDidChangeActiveTerminal: sinon.stub()
    },
    debug: {
        activeDebugSession: null,
        onDidStartDebugSession: sinon.stub(),
        onDidTerminateDebugSession: sinon.stub()
    },
    workspace: {
        workspaceFolders: null,
        name: 'Test Workspace',
        onDidChangeWorkspaceFolders: sinon.stub()
    },
    Selection: class {
        anchor;
        active;
        constructor(anchor, active) {
            this.anchor = anchor;
            this.active = active;
        }
    },
    Uri: {
        parse: sinon.stub()
    }
};
// Мокируем vscode модуль перед импортом ContextManager
global.vscode = mockVSCode;
// Теперь импортируем ContextManager после установки моков
const ContextManager_1 = require("../../core/ContextManager");
// Helper функции для управления мок-средой
function setCursorEnvironment() {
    mockVSCode.env.appName = 'Cursor';
    mockVSCode.env.uriScheme = 'cursor';
}
function setVSCodeEnvironment() {
    mockVSCode.env.appName = 'Visual Studio Code';
    mockVSCode.env.uriScheme = 'vscode';
}
suite('ContextManager Tests', () => {
    let contextManager;
    let eventHandlers;
    setup(() => {
        // Сбрасываем все моки
        sinon.reset();
        // Настраиваем заглушки для событий
        eventHandlers = {
            onContextChange: sinon.stub(),
            onIDETypeDetected: sinon.stub(),
            onLanguageChange: sinon.stub()
        };
        // Мокируем disposable для событий
        const mockDisposable = { dispose: sinon.stub() };
        mockVSCode.window.onDidChangeActiveTextEditor.returns(mockDisposable);
        mockVSCode.window.onDidChangeTextEditorSelection.returns(mockDisposable);
        mockVSCode.window.onDidChangeActiveTerminal.returns(mockDisposable);
        mockVSCode.debug.onDidStartDebugSession.returns(mockDisposable);
        mockVSCode.debug.onDidTerminateDebugSession.returns(mockDisposable);
        mockVSCode.workspace.onDidChangeWorkspaceFolders.returns(mockDisposable);
        // Создаем ContextManager
        contextManager = new ContextManager_1.ContextManager(eventHandlers);
    });
    teardown(() => {
        if (contextManager) {
            contextManager.dispose();
        }
        sinon.restore();
    });
    suite('IDE Type Detection', () => {
        test('Should detect VS Code correctly', () => {
            mockVSCode.env.appName = 'Visual Studio Code';
            mockVSCode.env.uriScheme = 'vscode';
            const manager = new ContextManager_1.ContextManager(eventHandlers);
            assert.strictEqual(manager.getIDEType(), ContextManager_1.IDEType.VSCODE);
            assert.ok(manager.isVSCode());
            assert.ok(!manager.isCursor());
            manager.dispose();
        });
        test('Should detect Cursor correctly', () => {
            // Используем helper функцию для установки Cursor среды
            setCursorEnvironment();
            const manager = new ContextManager_1.ContextManager(eventHandlers);
            assert.strictEqual(manager.getIDEType(), ContextManager_1.IDEType.CURSOR);
            assert.ok(manager.isCursor());
            assert.ok(!manager.isVSCode());
            manager.dispose();
            // Возвращаем VS Code среду
            setVSCodeEnvironment();
        });
        test('Should handle unknown IDE gracefully', () => {
            mockVSCode.env.appName = 'Unknown Editor';
            mockVSCode.env.uriScheme = 'unknown';
            const manager = new ContextManager_1.ContextManager(eventHandlers);
            assert.strictEqual(manager.getIDEType(), ContextManager_1.IDEType.UNKNOWN);
            assert.ok(!manager.isVSCode());
            assert.ok(!manager.isCursor());
            manager.dispose();
            // Восстанавливаем VS Code среду
            setVSCodeEnvironment();
        });
        test('Should trigger onIDETypeDetected event', () => {
            assert.ok(eventHandlers.onIDETypeDetected?.called);
            const detectedType = eventHandlers.onIDETypeDetected?.firstCall.args[0];
            assert.strictEqual(detectedType, ContextManager_1.IDEType.VSCODE);
        });
    });
    suite('Context Type Detection', () => {
        test('Should detect editor context', () => {
            // Мокируем активный редактор
            mockVSCode.window.activeTextEditor = {
                document: {
                    fileName: '/test/file.js',
                    languageId: 'javascript'
                },
                selection: {
                    active: { line: 10, character: 5 }
                }
            };
            contextManager.refreshContext();
            assert.strictEqual(contextManager.getContextType(), ContextManager_1.ContextType.EDITOR);
            assert.ok(contextManager.isEditorActive());
        });
        test('Should detect terminal context', () => {
            mockVSCode.window.activeTextEditor = null;
            mockVSCode.window.activeTerminal = {
                name: 'bash'
            };
            contextManager.refreshContext();
            assert.strictEqual(contextManager.getContextType(), ContextManager_1.ContextType.TERMINAL);
            assert.ok(contextManager.isTerminalActive());
        });
        test('Should detect debugger context', () => {
            mockVSCode.window.activeTextEditor = null;
            mockVSCode.window.activeTerminal = null;
            mockVSCode.debug.activeDebugSession = {
                name: 'Node.js Debug'
            };
            contextManager.refreshContext();
            assert.strictEqual(contextManager.getContextType(), ContextManager_1.ContextType.DEBUGGER);
        });
        test('Should detect chat context in Cursor when focused but no active components', () => {
            // Настраиваем для Cursor IDE
            mockVSCode.env.appName = 'Cursor';
            const manager = new ContextManager_1.ContextManager(eventHandlers);
            mockVSCode.window.activeTextEditor = null;
            mockVSCode.window.activeTerminal = null;
            mockVSCode.debug.activeDebugSession = null;
            mockVSCode.window.state.focused = true;
            manager.refreshContext();
            assert.strictEqual(manager.getContextType(), ContextManager_1.ContextType.CHAT);
            assert.ok(manager.isChatActive());
            manager.dispose();
        });
    });
    suite('Language Information', () => {
        test('Should correctly identify JavaScript language', () => {
            mockVSCode.window.activeTextEditor = {
                document: {
                    fileName: '/test/file.js',
                    languageId: 'javascript'
                },
                selection: {
                    active: { line: 0, character: 0 }
                }
            };
            contextManager.refreshContext();
            const language = contextManager.getCurrentLanguage();
            assert.ok(language);
            assert.strictEqual(language.id, 'javascript');
            assert.strictEqual(language.name, 'JavaScript');
            assert.strictEqual(language.commentStyle, 'both');
            assert.strictEqual(language.lineComment, '//');
            assert.deepStrictEqual(language.blockComment, { start: '/*', end: '*/' });
        });
        test('Should correctly identify Python language', () => {
            mockVSCode.window.activeTextEditor = {
                document: {
                    fileName: '/test/script.py',
                    languageId: 'python'
                },
                selection: {
                    active: { line: 0, character: 0 }
                }
            };
            contextManager.refreshContext();
            const language = contextManager.getCurrentLanguage();
            assert.ok(language);
            assert.strictEqual(language.id, 'python');
            assert.strictEqual(language.name, 'Python');
            assert.strictEqual(language.commentStyle, 'line');
            assert.strictEqual(language.lineComment, '#');
        });
        test('Should handle unknown language gracefully', () => {
            mockVSCode.window.activeTextEditor = {
                document: {
                    fileName: '/test/file.unknown',
                    languageId: 'unknown-lang'
                },
                selection: {
                    active: { line: 0, character: 0 }
                }
            };
            contextManager.refreshContext();
            const language = contextManager.getCurrentLanguage();
            assert.ok(language);
            assert.strictEqual(language.id, 'unknown-lang');
            assert.strictEqual(language.name, 'UNKNOWN-LANG');
            assert.strictEqual(language.commentStyle, 'line');
        });
    });
    suite('Comment Style Support', () => {
        test('Should support line comments for JavaScript', () => {
            mockVSCode.window.activeTextEditor = {
                document: {
                    fileName: '/test/file.js',
                    languageId: 'javascript'
                },
                selection: { active: { line: 0, character: 0 } }
            };
            contextManager.refreshContext();
            assert.ok(contextManager.supportsComments('line'));
            assert.ok(contextManager.supportsComments('block'));
            assert.strictEqual(contextManager.getPreferredCommentStyle(), 'line');
        });
        test('Should support only line comments for Python', () => {
            mockVSCode.window.activeTextEditor = {
                document: {
                    fileName: '/test/script.py',
                    languageId: 'python'
                },
                selection: { active: { line: 0, character: 0 } }
            };
            contextManager.refreshContext();
            assert.ok(contextManager.supportsComments('line'));
            assert.ok(!contextManager.supportsComments('block'));
            assert.strictEqual(contextManager.getPreferredCommentStyle(), 'line');
        });
        test('Should support only block comments for HTML', () => {
            mockVSCode.window.activeTextEditor = {
                document: {
                    fileName: '/test/page.html',
                    languageId: 'html'
                },
                selection: { active: { line: 0, character: 0 } }
            };
            contextManager.refreshContext();
            assert.ok(!contextManager.supportsComments('line'));
            assert.ok(contextManager.supportsComments('block'));
            assert.strictEqual(contextManager.getPreferredCommentStyle(), 'block');
        });
    });
    suite('Context Information', () => {
        test('Should provide complete context information', () => {
            mockVSCode.window.activeTextEditor = {
                document: {
                    fileName: '/test/file.ts',
                    languageId: 'typescript'
                },
                selection: {
                    active: { line: 5, character: 10 }
                }
            };
            mockVSCode.workspace.workspaceFolders = [
                { uri: { fsPath: '/test/workspace' } }
            ];
            contextManager.refreshContext();
            const context = contextManager.getContext();
            assert.strictEqual(context.ideType, ContextManager_1.IDEType.VSCODE);
            assert.strictEqual(context.contextType, ContextManager_1.ContextType.EDITOR);
            assert.ok(context.activeEditor);
            assert.strictEqual(context.activeEditor.fileName, '/test/file.ts');
            assert.strictEqual(context.activeEditor.language.id, 'typescript');
            assert.strictEqual(context.activeEditor.lineNumber, 6); // 1-based
            assert.strictEqual(context.activeEditor.columnNumber, 11); // 1-based
            assert.ok(context.workspace);
            assert.strictEqual(context.workspace.name, 'Test Workspace');
            assert.deepStrictEqual(context.workspace.folders, ['/test/workspace']);
        });
        test('Should handle context without active editor', () => {
            mockVSCode.window.activeTextEditor = null;
            mockVSCode.window.activeTerminal = null;
            mockVSCode.debug.activeDebugSession = null;
            contextManager.refreshContext();
            const context = contextManager.getContext();
            assert.strictEqual(context.contextType, ContextManager_1.ContextType.UNKNOWN);
            assert.strictEqual(context.activeEditor, undefined);
            assert.strictEqual(contextManager.getCurrentLanguage(), null);
        });
    });
    suite('Event Handling', () => {
        test('Should trigger onContextChange when context changes', () => {
            // Initial context
            mockVSCode.window.activeTextEditor = null;
            contextManager.refreshContext();
            // Clear previous calls
            eventHandlers.onContextChange?.resetHistory();
            // Change to editor context
            mockVSCode.window.activeTextEditor = {
                document: {
                    fileName: '/test/file.js',
                    languageId: 'javascript'
                },
                selection: { active: { line: 0, character: 0 } }
            };
            contextManager.refreshContext();
            assert.ok(eventHandlers.onContextChange?.called);
            const newContext = eventHandlers.onContextChange?.firstCall.args[0];
            assert.strictEqual(newContext.contextType, ContextManager_1.ContextType.EDITOR);
        });
        test('Should trigger onLanguageChange when language changes', () => {
            // Initial language
            mockVSCode.window.activeTextEditor = {
                document: {
                    fileName: '/test/file.js',
                    languageId: 'javascript'
                },
                selection: { active: { line: 0, character: 0 } }
            };
            contextManager.refreshContext();
            // Clear previous calls
            eventHandlers.onLanguageChange?.resetHistory();
            // Change language
            mockVSCode.window.activeTextEditor.document.fileName = '/test/file.py';
            mockVSCode.window.activeTextEditor.document.languageId = 'python';
            contextManager.refreshContext();
            assert.ok(eventHandlers.onLanguageChange?.called);
            const newLanguage = eventHandlers.onLanguageChange?.firstCall.args[0];
            assert.strictEqual(newLanguage.id, 'python');
        });
        test('Should not trigger events when context remains the same', () => {
            mockVSCode.window.activeTextEditor = {
                document: {
                    fileName: '/test/file.js',
                    languageId: 'javascript'
                },
                selection: { active: { line: 0, character: 0 } }
            };
            contextManager.refreshContext();
            // Clear previous calls
            eventHandlers.onContextChange?.resetHistory();
            eventHandlers.onLanguageChange?.resetHistory();
            // Refresh with same context
            contextManager.refreshContext();
            assert.ok(!eventHandlers.onContextChange?.called);
            assert.ok(!eventHandlers.onLanguageChange?.called);
        });
    });
    suite('Language Cache', () => {
        test('Should cache language information', () => {
            // First access
            mockVSCode.window.activeTextEditor = {
                document: {
                    fileName: '/test/file1.js',
                    languageId: 'javascript'
                },
                selection: { active: { line: 0, character: 0 } }
            };
            contextManager.refreshContext();
            const language1 = contextManager.getCurrentLanguage();
            // Second access to same language
            mockVSCode.window.activeTextEditor.document.fileName = '/test/file2.js';
            contextManager.refreshContext();
            const language2 = contextManager.getCurrentLanguage();
            // Should be the same object (cached)
            assert.strictEqual(language1, language2);
        });
    });
    suite('Disposal', () => {
        test('Should dispose resources correctly', () => {
            const disposeStub = sinon.stub();
            const mockDisposable = { dispose: disposeStub };
            // Мокируем новые disposables
            mockVSCode.window.onDidChangeActiveTextEditor.returns(mockDisposable);
            const manager = new ContextManager_1.ContextManager();
            manager.dispose();
            // Проверяем что dispose был вызван
            assert.ok(disposeStub.called);
        });
    });
    suite('Error Handling', () => {
        test('Should handle errors during IDE type detection gracefully', () => {
            // Мокируем ошибку в vscode.env
            const originalEnv = mockVSCode.env;
            mockVSCode.env = {
                get appName() {
                    throw new Error('Test error');
                }
            };
            const manager = new ContextManager_1.ContextManager();
            // Должен не падать и установить UNKNOWN тип
            assert.strictEqual(manager.getIDEType(), ContextManager_1.IDEType.UNKNOWN);
            // Восстанавливаем env
            mockVSCode.env = originalEnv;
            manager.dispose();
        });
        test('Should handle errors during context update gracefully', () => {
            const consoleErrorStub = sinon.stub(console, 'error');
            // Мокируем ошибку в detectContextType
            const originalActiveTextEditor = mockVSCode.window.activeTextEditor;
            Object.defineProperty(mockVSCode.window, 'activeTextEditor', {
                get() {
                    throw new Error('Test error in activeTextEditor');
                },
                configurable: true
            });
            // Должен не падать
            contextManager.refreshContext();
            // Проверяем что ошибка была залогирована
            assert.ok(consoleErrorStub.called);
            // Восстанавливаем
            Object.defineProperty(mockVSCode.window, 'activeTextEditor', {
                value: originalActiveTextEditor,
                configurable: true,
                writable: true
            });
            consoleErrorStub.restore();
        });
    });
});
//# sourceMappingURL=ContextManager.test.js.map