import * as assert from 'assert';
import * as sinon from 'sinon';

// Mock для vscode API
const mockVSCode = {
    env: {
        appName: 'Visual Studio Code',
        uriScheme: 'vscode'
    },
    window: {
        activeTextEditor: null as any,
        activeTerminal: null as any,
        state: {
            focused: true
        },
        onDidChangeActiveTextEditor: sinon.stub(),
        onDidChangeTextEditorSelection: sinon.stub(),
        onDidChangeActiveTerminal: sinon.stub()
    },
    debug: {
        activeDebugSession: null as any,
        onDidStartDebugSession: sinon.stub(),
        onDidTerminateDebugSession: sinon.stub()
    },
    workspace: {
        workspaceFolders: null as any,
        name: 'Test Workspace',
        onDidChangeWorkspaceFolders: sinon.stub()
    },
    Selection: class {
        constructor(public anchor: any, public active: any) {}
    },
    Uri: {
        parse: sinon.stub()
    }
};

// Мокируем vscode модуль перед импортом ContextManager
(global as any).vscode = mockVSCode;

// Теперь импортируем ContextManager после установки моков
import { 
    ContextManager, 
    IDEType, 
    ContextType, 
    LanguageInfo,
    IDEContext,
    ContextManagerEvents 
} from '../../core/ContextManager';

// Helper функции для управления мок-средой
function setCursorEnvironment(): void {
    mockVSCode.env.appName = 'Cursor';
    mockVSCode.env.uriScheme = 'cursor';
}

function setVSCodeEnvironment(): void {
    mockVSCode.env.appName = 'Visual Studio Code';
    mockVSCode.env.uriScheme = 'vscode';
}

function setUnknownEnvironment(): void {
    mockVSCode.env.appName = 'Unknown Editor';
    mockVSCode.env.uriScheme = 'unknown';
}

suite('ContextManager Tests', () => {
    let contextManager: ContextManager;
    let eventHandlers: sinon.SinonStubbedInstance<ContextManagerEvents>;

    setup(() => {
        // Сбрасываем все моки
        sinon.reset();
        
        // Устанавливаем VS Code среду по умолчанию
        setVSCodeEnvironment();
        
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
        contextManager = new ContextManager(eventHandlers);
    });

    teardown(() => {
        if (contextManager) {
            contextManager.dispose();
        }
        sinon.restore();
    });

    suite('IDE Type Detection', () => {
        test('Should detect VS Code correctly', () => {
            setVSCodeEnvironment();
            const manager = new ContextManager();
            
            assert.strictEqual(manager.getIDEType(), IDEType.VSCODE);
            assert.ok(manager.isVSCode());
            assert.ok(!manager.isCursor());
            
            manager.dispose();
        });

        test('Should detect Cursor correctly', () => {
            setCursorEnvironment();
            const manager = new ContextManager();
            
            assert.strictEqual(manager.getIDEType(), IDEType.CURSOR);
            assert.ok(manager.isCursor());
            assert.ok(!manager.isVSCode());
            
            manager.dispose();
        });

        test('Should handle unknown IDE gracefully', () => {
            setUnknownEnvironment();
            const manager = new ContextManager();
            
            assert.strictEqual(manager.getIDEType(), IDEType.UNKNOWN);
            assert.ok(!manager.isVSCode());
            assert.ok(!manager.isCursor());
            
            manager.dispose();
        });

        test('Should trigger onIDETypeDetected event', () => {
            // Проверяем событие, которое произошло при создании contextManager в setup()
            assert.ok(eventHandlers.onIDETypeDetected?.called);
            const detectedType = eventHandlers.onIDETypeDetected?.firstCall.args[0];
            assert.strictEqual(detectedType, IDEType.VSCODE);
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
            
            assert.strictEqual(contextManager.getContextType(), ContextType.EDITOR);
            assert.ok(contextManager.isEditorActive());
        });

        test('Should detect terminal context', () => {
            mockVSCode.window.activeTextEditor = null;
            mockVSCode.window.activeTerminal = {
                name: 'bash'
            };
            
            contextManager.refreshContext();
            
            assert.strictEqual(contextManager.getContextType(), ContextType.TERMINAL);
            assert.ok(contextManager.isTerminalActive());
        });

        test('Should detect debugger context', () => {
            mockVSCode.window.activeTextEditor = null;
            mockVSCode.window.activeTerminal = null;
            mockVSCode.debug.activeDebugSession = {
                name: 'Node.js Debug'
            };
            
            contextManager.refreshContext();
            
            assert.strictEqual(contextManager.getContextType(), ContextType.DEBUGGER);
        });

        test('Should detect chat context in Cursor when focused but no active components', () => {
            // Создаем отдельный экземпляр для Cursor
            setCursorEnvironment();
            const cursorManager = new ContextManager();
            
            mockVSCode.window.activeTextEditor = null;
            mockVSCode.window.activeTerminal = null;
            mockVSCode.debug.activeDebugSession = null;
            mockVSCode.window.state.focused = true;
            
            cursorManager.refreshContext();
            
            assert.strictEqual(cursorManager.getContextType(), ContextType.CHAT);
            
            cursorManager.dispose();
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
            assert.ok(language, 'Language should be detected');
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
            assert.ok(language, 'Language should be detected');
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
            assert.ok(language, 'Language should be detected even if unknown');
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
            
            assert.strictEqual(context.ideType, IDEType.VSCODE);
            assert.strictEqual(context.contextType, ContextType.EDITOR);
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
            
            assert.strictEqual(context.contextType, ContextType.UNKNOWN);
            assert.strictEqual(context.activeEditor, undefined);
            assert.strictEqual(contextManager.getCurrentLanguage(), null);
        });
    });

    suite('Event Handling', () => {
        test('Should trigger onContextChange when context changes', () => {
            // Устанавливаем начальное состояние
            mockVSCode.window.activeTextEditor = null;
            mockVSCode.window.activeTerminal = null;
            mockVSCode.debug.activeDebugSession = null;
            contextManager.refreshContext();
            
            // Сбрасываем историю событий
            eventHandlers.onContextChange?.resetHistory();
            
            // Изменяем контекст на редактор
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
            assert.strictEqual(newContext.contextType, ContextType.EDITOR);
        });

        test('Should trigger onLanguageChange when language changes', () => {
            // Устанавливаем начальный язык
            mockVSCode.window.activeTextEditor = {
                document: {
                    fileName: '/test/file.js',
                    languageId: 'javascript'
                },
                selection: { active: { line: 0, character: 0 } }
            };
            contextManager.refreshContext();
            
            // Сбрасываем историю событий
            eventHandlers.onLanguageChange?.resetHistory();
            
            // Изменяем язык
            mockVSCode.window.activeTextEditor = {
                document: {
                    fileName: '/test/script.py',
                    languageId: 'python'
                },
                selection: { active: { line: 0, character: 0 } }
            };
            
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
            
            const manager = new ContextManager();
            manager.dispose();
            
            // Проверяем что dispose был вызван
            assert.ok(disposeStub.called);
        });
    });

    suite('Error Handling', () => {
        test('Should handle errors during IDE type detection gracefully', () => {
            // Мокируем ошибку в vscode.env
            const originalEnv = mockVSCode.env;
            (mockVSCode as any).env = {
                get appName() {
                    throw new Error('Test error');
                }
            };
            
            const manager = new ContextManager();
            
            // Должен не падать и установить UNKNOWN тип
            assert.strictEqual(manager.getIDEType(), IDEType.UNKNOWN);
            
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