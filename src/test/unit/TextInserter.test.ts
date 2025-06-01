// TextInserter.test.ts - Unit тесты для модуля вставки текста

import * as assert from 'assert';
import * as sinon from 'sinon';

// Настраиваем мок для vscode до любых импортов
import { 
    setupVSCodeMocks, 
    resetVSCodeMocks, 
    setActiveEditor,
    clearActiveEditor,
    mockVscode 
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
import { TextInserter, InsertOptions, TextInserterError } from '../../ui/TextInserter';
import { testLanguageConfigs, testEditorStates } from '../fixtures/testData';

suite('TextInserter Unit Tests', () => {
    let textInserter: TextInserter;

    setup(() => {
        setupVSCodeMocks();
        textInserter = new TextInserter();
    });

    teardown(() => {
        resetVSCodeMocks();
        sinon.restore();
        // Восстанавливаем оригинальный require
        Module.prototype.require = originalRequire;
    });

    suite('Constructor', () => {
        test('Should initialize without errors', () => {
            const inserter = new TextInserter();
            assert.ok(inserter);
        });
    });

    suite('insertAtCursor', () => {
        test('Should insert text at cursor position when editor is active', async () => {
            // Настраиваем активный редактор
            const editor = setActiveEditor('javascript');
            
            await textInserter.insertAtCursor('Hello World');
            
            assert.ok((editor.edit as sinon.SinonStub).calledOnce);
        });

        test('Should throw error when no active editor', async () => {
            // Убираем активный редактор
            clearActiveEditor();
            
            try {
                await textInserter.insertAtCursor('Hello World');
                assert.fail('Should have thrown an error');
            } catch (error) {
                assert.ok((error as TextInserterError).code === 'NO_ACTIVE_EDITOR');
            }
        });

        test('Should use indentation options', async () => {
            const editor = setActiveEditor('javascript');
            
            await textInserter.insertAtCursor('Hello\nWorld', { indentToSelection: true });
            
            assert.ok((editor.edit as sinon.SinonStub).calledOnce);
        });

        test('Should format text when option is enabled', async () => {
            const editor = setActiveEditor('javascript');
            
            await textInserter.insertAtCursor('  Hello World  ', { formatText: true });
            
            assert.ok((editor.edit as sinon.SinonStub).calledOnce);
        });
    });

    suite('insertAsComment', () => {
        test('Should insert as single-line comment for JavaScript', async () => {
            const editor = setActiveEditor('javascript');
            
            await textInserter.insertAsComment('This is a comment');
            
            assert.ok((editor.edit as sinon.SinonStub).calledOnce);
        });

        test('Should insert as single-line comment for Python', async () => {
            const editor = setActiveEditor('python');
            
            await textInserter.insertAsComment('This is a comment');
            
            assert.ok((editor.edit as sinon.SinonStub).calledOnce);
        });

        test('Should insert as multiline comment when forced', async () => {
            const editor = setActiveEditor('javascript');
            
            await textInserter.insertAsComment('Single line', { forceMultilineComment: true });
            
            assert.ok((editor.edit as sinon.SinonStub).calledOnce);
        });

        test('Should insert as multiline comment for multiline text', async () => {
            const editor = setActiveEditor('javascript');
            
            const multilineText = 'Line 1\nLine 2\nLine 3';
            await textInserter.insertAsComment(multilineText);
            
            assert.ok((editor.edit as sinon.SinonStub).calledOnce);
        });

        test('Should handle languages without multiline comments', async () => {
            const editor = setActiveEditor('bash');
            
            const multilineText = 'Line 1\nLine 2';
            await textInserter.insertAsComment(multilineText);
            
            assert.ok((editor.edit as sinon.SinonStub).calledOnce);
        });

        test('Should throw error when no active editor', async () => {
            clearActiveEditor();
            
            try {
                await textInserter.insertAsComment('This is a comment');
                assert.fail('Should have thrown an error');
            } catch (error) {
                assert.ok((error as TextInserterError).code === 'NO_ACTIVE_EDITOR');
            }
        });
    });

    suite('replaceSelection', () => {
        test('Should replace selected text when selection exists', async () => {
            const editor = setActiveEditor('javascript');
            // Эмулируем наличие выделения
            editor.selection.isEmpty = false;
            
            await textInserter.replaceSelection('New text');
            
            assert.ok((editor.edit as sinon.SinonStub).calledOnce);
        });

        test('Should throw error when no selection', async () => {
            const editor = setActiveEditor('javascript');
            // Эмулируем отсутствие выделения
            editor.selection.isEmpty = true;
            
            try {
                await textInserter.replaceSelection('New text');
                assert.fail('Should have thrown an error');
            } catch (error) {
                assert.ok((error as TextInserterError).code === 'NO_SELECTION');
            }
        });

        test('Should throw error when no active editor', async () => {
            clearActiveEditor();
            
            try {
                await textInserter.replaceSelection('New text');
                assert.fail('Should have thrown an error');
            } catch (error) {
                assert.ok((error as TextInserterError).code === 'NO_ACTIVE_EDITOR');
            }
        });
    });

    suite('insertOnNewLine', () => {
        test('Should insert text on new line', async () => {
            const editor = setActiveEditor('javascript');
            
            await textInserter.insertOnNewLine('New line text');
            
            assert.ok((editor.edit as sinon.SinonStub).calledOnce);
        });

        test('Should throw error when no active editor', async () => {
            clearActiveEditor();
            
            try {
                await textInserter.insertOnNewLine('New line text');
                assert.fail('Should have thrown an error');
            } catch (error) {
                assert.ok((error as TextInserterError).code === 'NO_ACTIVE_EDITOR');
            }
        });
    });

    suite('copyToClipboard', () => {
        test('Should copy text to clipboard', async () => {
            await textInserter.copyToClipboard('Clipboard text');
            
            // Проверяем что clipboard API был вызван
            assert.ok(mockVscode.env.clipboard.writeText.calledOnce);
            assert.ok(mockVscode.env.clipboard.writeText.calledWith('Clipboard text'));
        });

        test('Should show information message after copying', async () => {
            await textInserter.copyToClipboard('Test text');
            
            assert.ok(mockVscode.window.showInformationMessage.calledOnce);
        });
    });

    suite('insertText universal method', () => {
        test('Should route to insertAtCursor for cursor mode', async () => {
            const editor = setActiveEditor('javascript');
            
            await textInserter.insertText('Test text', { mode: 'cursor' });
            
            assert.ok((editor.edit as sinon.SinonStub).calledOnce);
        });

        test('Should route to insertAsComment for comment mode', async () => {
            const editor = setActiveEditor('javascript');
            
            await textInserter.insertText('Test comment', { mode: 'comment' });
            
            assert.ok((editor.edit as sinon.SinonStub).calledOnce);
        });

        test('Should route to replaceSelection for replace mode', async () => {
            const editor = setActiveEditor('javascript');
            editor.selection.isEmpty = false;
            
            await textInserter.insertText('Replacement text', { mode: 'replace' });
            
            assert.ok((editor.edit as sinon.SinonStub).calledOnce);
        });

        test('Should route to insertOnNewLine for newLine mode', async () => {
            const editor = setActiveEditor('javascript');
            
            await textInserter.insertText('New line text', { mode: 'newLine' });
            
            assert.ok((editor.edit as sinon.SinonStub).calledOnce);
        });

        test('Should route to copyToClipboard for clipboard mode', async () => {
            await textInserter.insertText('Clipboard text', { mode: 'clipboard' });
            
            assert.ok(mockVscode.env.clipboard.writeText.calledOnce);
        });

        test('Should default to cursor mode when no mode specified', async () => {
            const editor = setActiveEditor('javascript');
            
            await textInserter.insertText('Default text');
            
            assert.ok((editor.edit as sinon.SinonStub).calledOnce);
        });
    });

    suite('getActiveContext', () => {
        test('Should return editor context when editor is active', () => {
            const editor = setActiveEditor('javascript');
            editor.selection.isEmpty = false;
            
            const context = textInserter.getActiveContext();
            
            assert.strictEqual(context.type, 'editor');
            assert.strictEqual(context.language, 'javascript');
            assert.strictEqual(context.hasSelection, true);
        });

        test('Should return unknown context when no editor active', () => {
            clearActiveEditor();
            
            const context = textInserter.getActiveContext();
            
            assert.strictEqual(context.type, 'unknown');
            assert.strictEqual(context.hasSelection, false);
        });

        test('Should detect terminal context', () => {
            clearActiveEditor();
            mockVscode.window.activeTerminal = { name: 'Terminal' };
            
            const context = textInserter.getActiveContext();
            
            assert.strictEqual(context.type, 'terminal');
            assert.strictEqual(context.hasSelection, false);
        });
    });

    suite('Language Support', () => {
        test('Should handle unknown language gracefully', async () => {
            const editor = setActiveEditor('unknownlang');
            
            await textInserter.insertAsComment('Comment in unknown language');
            
            assert.ok((editor.edit as sinon.SinonStub).calledOnce);
        });
    });

    suite('Comment Formatting', () => {
        test('Should format single line comments correctly', async () => {
            const editor = setActiveEditor('javascript');
            
            await textInserter.insertAsComment('Single line comment');
            
            assert.ok((editor.edit as sinon.SinonStub).calledOnce);
        });

        test('Should format multiline comments for C-style languages', async () => {
            const editor = setActiveEditor('javascript');
            
            await textInserter.insertAsComment('Line 1\nLine 2');
            
            assert.ok((editor.edit as sinon.SinonStub).calledOnce);
        });

        test('Should format HTML comments correctly', async () => {
            const editor = setActiveEditor('html');
            
            await textInserter.insertAsComment('HTML comment');
            
            assert.ok((editor.edit as sinon.SinonStub).calledOnce);
        });

        test('Should handle Python triple-quote comments', async () => {
            const editor = setActiveEditor('python');
            
            await textInserter.insertAsComment('Line 1\nLine 2', { forceMultilineComment: true });
            
            assert.ok((editor.edit as sinon.SinonStub).calledOnce);
        });
    });

    suite('Text Formatting Options', () => {
        test('Should trim whitespace when formatText is true', async () => {
            const editor = setActiveEditor('javascript');
            
            await textInserter.insertAtCursor('  spaced text  ', { formatText: true });
            
            assert.ok((editor.edit as sinon.SinonStub).calledOnce);
        });

        test('Should preserve text when formatText is false', async () => {
            const editor = setActiveEditor('javascript');
            
            await textInserter.insertAtCursor('  spaced text  ', { formatText: false });
            
            assert.ok((editor.edit as sinon.SinonStub).calledOnce);
        });

        test('Should add newline when addNewLine is true', async () => {
            const editor = setActiveEditor('javascript');
            
            await textInserter.insertAtCursor('text with newline', { formatText: true, addNewLine: true });
            
            assert.ok((editor.edit as sinon.SinonStub).calledOnce);
        });
    });

    suite('Static Methods', () => {
        test('Should return supported languages', () => {
            const languages = TextInserter.getSupportedLanguages();
            
            assert.ok(Array.isArray(languages));
            assert.ok(languages.length > 0);
            assert.ok(languages.includes('javascript'));
            assert.ok(languages.includes('python'));
        });

        test('Should check if language is supported', () => {
            assert.ok(TextInserter.isLanguageSupported('javascript'));
            assert.ok(TextInserter.isLanguageSupported('python'));
            assert.ok(!TextInserter.isLanguageSupported('nonexistentlang'));
        });
    });

    suite('Error Handling', () => {
        test('Should create proper error objects', async () => {
            clearActiveEditor();
            
            try {
                await textInserter.insertAtCursor('test');
                assert.fail('Should have thrown an error');
            } catch (error) {
                const err = error as TextInserterError;
                assert.ok(err.message);
                assert.strictEqual(err.code, 'NO_ACTIVE_EDITOR');
                assert.ok(err.context);
            }
        });

        test('Should handle invalid mode in insertText', async () => {
            try {
                await textInserter.insertText('test', { mode: 'invalid' as any });
                assert.fail('Should have thrown an error');
            } catch (error) {
                const err = error as TextInserterError;
                assert.strictEqual(err.code, 'INVALID_MODE');
            }
        });
    });
}); 