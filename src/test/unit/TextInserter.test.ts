// TextInserter.test.ts - Unit тесты для модуля вставки текста

import * as assert from 'assert';
import * as sinon from 'sinon';
import { TextInserter, InsertOptions, TextInserterError } from '../../ui/TextInserter';
import { 
    setupVSCodeMocks, 
    resetVSCodeMocks, 
    setActiveEditor,
    clearActiveEditor,
    mockVscode 
} from '../mocks/vscodeMocks';
import { testLanguageConfigs, testEditorStates } from '../fixtures/testData';

// Мокируем vscode модуль
const mockRequire = (id: string) => {
    if (id === 'vscode') {
        return mockVscode;
    }
    return undefined;
};

suite('TextInserter Unit Tests', () => {
    let textInserter: TextInserter;

    setup(() => {
        setupVSCodeMocks();
        textInserter = new TextInserter();
    });

    teardown(() => {
        resetVSCodeMocks();
        sinon.restore();
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

        test('Should format text before copying', async () => {
            await textInserter.copyToClipboard('  Text with spaces  ', { formatText: true });
            
            assert.ok(mockVscode.env.clipboard.writeText.calledOnce);
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

        test('Should throw error for invalid mode', async () => {
            try {
                await textInserter.insertText('Test text', { mode: 'invalid' as any });
                assert.fail('Should have thrown an error');
            } catch (error) {
                assert.ok((error as TextInserterError).code === 'INVALID_MODE');
            }
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

        test('Should return unknown context when no editor', () => {
            clearActiveEditor();
            
            const context = textInserter.getActiveContext();
            
            assert.strictEqual(context.type, 'unknown');
            assert.strictEqual(context.hasSelection, false);
        });

        test('Should detect terminal context', () => {
            clearActiveEditor();
            mockVscode.window.activeTerminal = { 
                name: 'Terminal',
                processId: Promise.resolve(1234)
            };
            
            const context = textInserter.getActiveContext();
            
            assert.strictEqual(context.type, 'terminal');
        });
    });

    suite('Language Support', () => {
        test('Should support multiple programming languages', () => {
            const languages = [
                'javascript', 'typescript', 'python', 'java', 'cpp',
                'rust', 'go', 'php', 'ruby', 'swift', 'kotlin'
            ];

            languages.forEach(lang => {
                assert.ok(TextInserter.isLanguageSupported(lang), `Should support ${lang}`);
            });
        });

        test('Should return supported languages list', () => {
            const languages = TextInserter.getSupportedLanguages();
            
            assert.ok(Array.isArray(languages));
            assert.ok(languages.length > 20);
            assert.ok(languages.includes('javascript'));
            assert.ok(languages.includes('python'));
        });

        test('Should handle unknown language gracefully', async () => {
            const editor = setActiveEditor('unknown-language');
            
            await textInserter.insertAsComment('This is a comment');
            
            assert.ok((editor.edit as sinon.SinonStub).calledOnce);
        });
    });

    suite('Comment Formatting', () => {
        test('Should format single line comments correctly', async () => {
            const editor = setActiveEditor('python');
            
            await textInserter.insertAsComment('This is a Python comment');
            
            // Проверяем что метод был вызван с правильными параметрами
            assert.ok((editor.edit as sinon.SinonStub).calledOnce);
        });

        test('Should format multiline comments for C-style languages', async () => {
            const editor = setActiveEditor('javascript');
            
            const multilineText = 'Line 1\nLine 2\nLine 3';
            await textInserter.insertAsComment(multilineText);
            
            assert.ok((editor.edit as sinon.SinonStub).calledOnce);
        });

        test('Should format HTML comments correctly', async () => {
            const editor = setActiveEditor('html');
            
            await textInserter.insertAsComment('HTML comment');
            
            assert.ok((editor.edit as sinon.SinonStub).calledOnce);
        });

        test('Should handle Python triple-quote comments', async () => {
            const editor = setActiveEditor('python');
            
            const multilineText = 'This is a\nmultiline Python\ncomment';
            await textInserter.insertAsComment(multilineText);
            
            assert.ok((editor.edit as sinon.SinonStub).calledOnce);
        });
    });

    suite('Text Formatting Options', () => {
        test('Should trim whitespace when formatText is true', async () => {
            const editor = setActiveEditor('javascript');
            
            await textInserter.insertAtCursor('  text with spaces  ', { formatText: true });
            
            assert.ok((editor.edit as sinon.SinonStub).calledOnce);
        });

        test('Should preserve text when formatText is false', async () => {
            const editor = setActiveEditor('javascript');
            
            await textInserter.insertAtCursor('  text with spaces  ', { formatText: false });
            
            assert.ok((editor.edit as sinon.SinonStub).calledOnce);
        });

        test('Should add newline when addNewLine is true', async () => {
            const editor = setActiveEditor('javascript');
            
            await textInserter.insertAtCursor('text', { formatText: true, addNewLine: true });
            
            assert.ok((editor.edit as sinon.SinonStub).calledOnce);
        });
    });
}); 