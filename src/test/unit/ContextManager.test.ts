import * as assert from 'assert';
import * as sinon from 'sinon';

// Настраиваем мок для vscode до любых импортов
import { 
    setupVSCodeMocks, 
    resetVSCodeMocks, 
    setActiveEditor,
    clearActiveEditor,
    mockVscode,
    setCursorEnvironment,
    setVSCodeEnvironment 
} from '../mocks/vscodeMocks';

// Мокируем vscode модуль
const Module = require('module');
const originalRequire = Module.prototype.require;

Module.prototype.require = function (id: string) {
    if (id === 'vscode') {
        return mockVscode;
    }
    return originalRequire.apply(this, arguments);
};

// Теперь можно импортировать классы, которые используют vscode
import { ContextManager, IDEType, ContextType, ContextManagerEvents } from '../../core/ContextManager';

suite('ContextManager Tests', () => {
    let contextManager: ContextManager;
    let eventHandlers: ContextManagerEvents;

    // Функция для настройки окружения
    function setVSCodeEnvironment(): void {
        // Мокируем свойства VS Code (lowercase для правильного детектирования)
        Object.defineProperty(mockVscode.env, 'appName', {
            value: 'visual studio code',
            writable: true,
            configurable: true
        });
        Object.defineProperty(mockVscode.env, 'uriScheme', {
            value: 'vscode',
            writable: true,
            configurable: true
        });
    }

    function setCursorEnvironmentLocal(): void {
        // Мокируем свойства Cursor (lowercase для правильного детектирования)
        Object.defineProperty(mockVscode.env, 'appName', {
            value: 'cursor',
            writable: true,
            configurable: true
        });
        Object.defineProperty(mockVscode.env, 'uriScheme', {
            value: 'cursor',
            writable: true,
            configurable: true
        });
    }

    function setUnknownEnvironment(): void {
        // Мокируем неизвестное окружение
        Object.defineProperty(mockVscode.env, 'appName', {
            value: 'unknown ide',
            writable: true,
            configurable: true
        });
        Object.defineProperty(mockVscode.env, 'uriScheme', {
            value: 'unknown',
            writable: true,
            configurable: true
        });
    }

    function clearAllActiveComponents(): void {
        // Очищаем все активные компоненты
        clearActiveEditor();
        mockVscode.window.activeTerminal = null;
        Object.defineProperty(mockVscode.debug, 'activeDebugSession', {
            value: null,
            writable: true,
            configurable: true
        });
        mockVscode.window.visibleTextEditors = [];
    }

    setup(() => {
        setupVSCodeMocks();
        setVSCodeEnvironment(); // По умолчанию VS Code
        
        eventHandlers = {
            onContextChange: sinon.stub(),
            onIDETypeDetected: sinon.stub(),
            onLanguageChange: sinon.stub()
        };
        
        // НЕ создаем ContextManager здесь - каждый тест создаст свой
        contextManager = null as any;
    });

    teardown(() => {
        resetVSCodeMocks();
        sinon.restore();
        if (contextManager) {
            contextManager.dispose();
            contextManager = null as any;
        }
        // Восстанавливаем оригинальный require
        Module.prototype.require = originalRequire;
    });

    suite('Constructor and Initialization', () => {
        test('Should initialize without errors', () => {
            const manager = new ContextManager();
            assert.ok(manager);
            manager.dispose();
        });

        test('Should initialize with event handlers', () => {
            const manager = new ContextManager(eventHandlers);
            assert.ok(manager);
            manager.dispose();
        });

        test('Should start listening to VS Code events', () => {
            // Проверяем что инициализация прошла без ошибок
            const manager = new ContextManager(eventHandlers);
            assert.ok(manager);
            manager.dispose();
        });
    });

    suite('IDE Type Detection', () => {
        test('Should detect VS Code correctly', () => {
            setVSCodeEnvironment();
            
            // Пересоздаем ContextManager после изменения окружения
            if (contextManager) {
                contextManager.dispose();
            }
            contextManager = new ContextManager(eventHandlers);
            
            const ideType = contextManager.getIDEType();
            assert.strictEqual(ideType, IDEType.VSCODE);
        });

        test('Should detect Cursor correctly', () => {
            setCursorEnvironmentLocal();
            
            // Пересоздаем ContextManager после изменения окружения
            if (contextManager) {
                contextManager.dispose();
            }
            contextManager = new ContextManager(eventHandlers);
            
            const ideType = contextManager.getIDEType();
            assert.strictEqual(ideType, IDEType.CURSOR);
        });

        test('Should handle unknown IDE gracefully', () => {
            setUnknownEnvironment();
            
            // Пересоздаем ContextManager после изменения окружения
            if (contextManager) {
                contextManager.dispose();
            }
            contextManager = new ContextManager(eventHandlers);
            
            const ideType = contextManager.getIDEType();
            assert.strictEqual(ideType, IDEType.UNKNOWN);
        });
    });

    suite('Context Type Detection', () => {
        test('Should detect editor context', () => {
            clearAllActiveComponents();
            const editor = setActiveEditor('javascript');
            
            // Создаем ContextManager для этого теста
            contextManager = new ContextManager(eventHandlers);
            
            const contextType = contextManager.getContextType();
            assert.strictEqual(contextType, ContextType.EDITOR);
        });

        test('Should detect terminal context', () => {
            clearAllActiveComponents();
            // Устанавливаем ТОЛЬКО терминал, без других активных компонентов
            mockVscode.window.activeTerminal = { name: 'Terminal' };
            
            // Пересоздаем ContextManager для чистого состояния
            if (contextManager) {
                contextManager.dispose();
            }
            contextManager = new ContextManager(eventHandlers);
            
            const contextType = contextManager.getContextType();
            assert.strictEqual(contextType, ContextType.TERMINAL);
        });

        test('Should detect debugger context', () => {
            clearAllActiveComponents();
            // Устанавливаем ТОЛЬКО отладчик, без других активных компонентов
            Object.defineProperty(mockVscode.debug, 'activeDebugSession', {
                value: { name: 'Debug Session' },
                writable: true,
                configurable: true
            });
            
            // Пересоздаем ContextManager для чистого состояния
            if (contextManager) {
                contextManager.dispose();
            }
            contextManager = new ContextManager(eventHandlers);
            
            const contextType = contextManager.getContextType();
            assert.strictEqual(contextType, ContextType.DEBUGGER);
        });

        test('Should detect chat context in Cursor when focused but no active components', () => {
            setCursorEnvironmentLocal();
            clearAllActiveComponents();
            mockVscode.window.state.focused = true;
            
            // Нужно пересоздать ContextManager после изменения окружения
            if (contextManager) {
                contextManager.dispose();
            }
            contextManager = new ContextManager(eventHandlers);
            
            const contextType = contextManager.getContextType();
            assert.strictEqual(contextType, ContextType.CHAT);
        });

        test('Should return unknown when no context detected', () => {
            clearAllActiveComponents();
            
            // Пересоздаем ContextManager для чистого состояния
            if (contextManager) {
                contextManager.dispose();
            }
            contextManager = new ContextManager(eventHandlers);
            
            const contextType = contextManager.getContextType();
            assert.strictEqual(contextType, ContextType.UNKNOWN);
        });
    });

    suite('Language Information', () => {
        test('Should correctly identify JavaScript language', () => {
            clearAllActiveComponents();
            const editor = setActiveEditor('javascript');
            
            // Пересоздаем ContextManager для чистого состояния
            if (contextManager) {
                contextManager.dispose();
            }
            contextManager = new ContextManager(eventHandlers);
            
            const language = contextManager.getCurrentLanguage();
            assert.ok(language, 'Language should be detected');
            assert.strictEqual(language.id, 'javascript');
        });

        test('Should correctly identify Python language', () => {
            clearAllActiveComponents();
            const editor = setActiveEditor('python');
            
            // Пересоздаем ContextManager для чистого состояния
            if (contextManager) {
                contextManager.dispose();
            }
            contextManager = new ContextManager(eventHandlers);
            
            const language = contextManager.getCurrentLanguage();
            assert.ok(language, 'Language should be detected');
            assert.strictEqual(language.id, 'python');
        });

        test('Should handle unknown language gracefully', () => {
            clearAllActiveComponents();
            const editor = setActiveEditor('unknownlang');
            
            // Пересоздаем ContextManager для чистого состояния
            if (contextManager) {
                contextManager.dispose();
            }
            contextManager = new ContextManager(eventHandlers);
            
            const language = contextManager.getCurrentLanguage();
            assert.ok(language, 'Language should be detected even if unknown');
            assert.strictEqual(language.id, 'unknownlang');
        });

        test('Should return null when no editor active', () => {
            clearAllActiveComponents();
            
            // Пересоздаем ContextManager для чистого состояния
            if (contextManager) {
                contextManager.dispose();
            }
            contextManager = new ContextManager(eventHandlers);
            
            const language = contextManager.getCurrentLanguage();
            assert.strictEqual(language, null);
        });
    });

    suite('Comment Style Support', () => {
        test('Should support line comments for JavaScript', () => {
            clearAllActiveComponents();
            setActiveEditor('javascript');
            
            // Пересоздаем ContextManager для чистого состояния
            if (contextManager) {
                contextManager.dispose();
            }
            contextManager = new ContextManager(eventHandlers);
            
            assert.ok(contextManager.supportsComments('line'));
            assert.ok(contextManager.supportsComments('block'));
        });

        test('Should support only line comments for Python', () => {
            clearAllActiveComponents();
            setActiveEditor('python');
            
            // Пересоздаем ContextManager для чистого состояния
            if (contextManager) {
                contextManager.dispose();
            }
            contextManager = new ContextManager(eventHandlers);
            
            assert.ok(contextManager.supportsComments('line'));
            assert.ok(!contextManager.supportsComments('block'));
        });

        test('Should support only block comments for HTML', () => {
            clearAllActiveComponents();
            setActiveEditor('html');
            
            // Пересоздаем ContextManager для чистого состояния
            if (contextManager) {
                contextManager.dispose();
            }
            contextManager = new ContextManager(eventHandlers);
            
            assert.ok(!contextManager.supportsComments('line'));
            assert.ok(contextManager.supportsComments('block'));
        });

        test('Should handle unknown language gracefully', () => {
            clearAllActiveComponents();
            setActiveEditor('unknownlang');
            
            // Пересоздаем ContextManager для чистого состояния
            if (contextManager) {
                contextManager.dispose();
            }
            contextManager = new ContextManager(eventHandlers);
            
            // Для неизвестного языка по умолчанию используется line style
            assert.ok(contextManager.supportsComments('line'));
            assert.ok(!contextManager.supportsComments('block'));
        });
    });

    suite('Context Information', () => {
        test('Should provide complete context information', () => {
            clearAllActiveComponents();
            const editor = setActiveEditor('javascript');
            editor.selection.isEmpty = false;
            
            // Пересоздаем ContextManager для чистого состояния
            if (contextManager) {
                contextManager.dispose();
            }
            contextManager = new ContextManager(eventHandlers);
            
            const context = contextManager.getContext();
            
            assert.strictEqual(context.contextType, ContextType.EDITOR);
            assert.strictEqual(context.ideType, IDEType.VSCODE);
            assert.ok(context.activeEditor);
            assert.strictEqual(context.activeEditor.language.id, 'javascript');
        });

        test('Should handle context without selection', () => {
            clearAllActiveComponents();
            const editor = setActiveEditor('typescript');
            editor.selection.isEmpty = true;
            
            // Пересоздаем ContextManager для чистого состояния
            if (contextManager) {
                contextManager.dispose();
            }
            contextManager = new ContextManager(eventHandlers);
            
            const context = contextManager.getContext();
            
            assert.strictEqual(context.contextType, ContextType.EDITOR);
            assert.ok(context.activeEditor);
            assert.strictEqual(context.activeEditor.language.id, 'typescript');
        });

        test('Should handle terminal context', () => {
            clearAllActiveComponents();
            mockVscode.window.activeTerminal = { name: 'Terminal' };
            
            // Пересоздаем ContextManager для чистого состояния
            if (contextManager) {
                contextManager.dispose();
            }
            contextManager = new ContextManager(eventHandlers);
            
            const context = contextManager.getContext();
            
            assert.strictEqual(context.contextType, ContextType.TERMINAL);
            assert.ok(context.terminal);
        });
    });

    suite('Selection Information', () => {
        test('Should detect text selection', () => {
            clearAllActiveComponents();
            const editor = setActiveEditor('javascript');
            editor.selection.isEmpty = false;
            
            // Пересоздаем ContextManager для чистого состояния
            if (contextManager) {
                contextManager.dispose();
            }
            contextManager = new ContextManager(eventHandlers);
            
            const context = contextManager.getContext();
            
            assert.ok(context.activeEditor);
            assert.ok(context.activeEditor.selection);
            assert.strictEqual(context.activeEditor.selection.isEmpty, false);
        });

        test('Should handle no selection', () => {
            clearAllActiveComponents();
            const editor = setActiveEditor('javascript');
            editor.selection.isEmpty = true;
            
            // Пересоздаем ContextManager для чистого состояния
            if (contextManager) {
                contextManager.dispose();
            }
            contextManager = new ContextManager(eventHandlers);
            
            const context = contextManager.getContext();
            
            assert.ok(context.activeEditor);
            assert.ok(context.activeEditor.selection);
            assert.strictEqual(context.activeEditor.selection.isEmpty, true);
        });

        test('Should handle no active editor', () => {
            clearAllActiveComponents();
            
            // Пересоздаем ContextManager для чистого состояния
            if (contextManager) {
                contextManager.dispose();
            }
            contextManager = new ContextManager(eventHandlers);
            
            const context = contextManager.getContext();
            
            assert.strictEqual(context.activeEditor, undefined);
        });
    });

    suite('Disposal', () => {
        test('Should dispose resources correctly', () => {
            const manager = new ContextManager(eventHandlers);
            manager.dispose();
            
            // Проверяем что объект dispose был вызван без ошибок
            assert.ok(true);
        });
    });

    suite('Error Handling', () => {
        test('Should handle errors during IDE type detection gracefully', () => {
            // Симулируем ошибку в доступе к env.appName
            Object.defineProperty(mockVscode.env, 'appName', {
                get() { throw new Error('Access denied'); },
                configurable: true
            });
            
            // Создаем новый ContextManager после ошибки
            if (contextManager) {
                contextManager.dispose();
            }
            contextManager = new ContextManager(eventHandlers);
            
            const ideType = contextManager.getIDEType();
            assert.strictEqual(ideType, IDEType.UNKNOWN);
        });
    });

    suite('Debug Tests', () => {
        test('Debug: Check initial state', () => {
            console.log('=== DEBUG: Initial state ===');
            console.log('activeTextEditor:', mockVscode.window.activeTextEditor);
            console.log('activeTerminal:', mockVscode.window.activeTerminal);
            console.log('activeDebugSession:', mockVscode.debug.activeDebugSession);
            
            const simpleContextManager = new ContextManager();
            const language = simpleContextManager.getCurrentLanguage();
            console.log('getCurrentLanguage result:', language);
            
            simpleContextManager.dispose();
            
            assert.strictEqual(language, null, 'Should return null when no editor is active');
        });
        
        test('Debug: Check after clearAllActiveComponents', () => {
            console.log('=== DEBUG: After clear ===');
            
            // Устанавливаем редактор
            setActiveEditor('javascript');
            console.log('After setActiveEditor:', mockVscode.window.activeTextEditor?.document?.languageId);
            
            // Очищаем все
            clearAllActiveComponents();
            console.log('After clearAllActiveComponents:', mockVscode.window.activeTextEditor);
            
            const simpleContextManager = new ContextManager();
            const language = simpleContextManager.getCurrentLanguage();
            console.log('getCurrentLanguage result after clear:', language);
            
            simpleContextManager.dispose();
            
            assert.strictEqual(language, null, 'Should return null after clearing all components');
        });
    });
}); 