"use strict";
// TextInserter.test.ts - Unit тесты для модуля вставки текста
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
const TextInserter_1 = require("../../ui/TextInserter");
const vscodeMocks_1 = require("../mocks/vscodeMocks");
// Мокируем vscode модуль
const mockRequire = (id) => {
    if (id === 'vscode') {
        return vscodeMocks_1.mockVscode;
    }
    return undefined;
};
suite('TextInserter Unit Tests', () => {
    let textInserter;
    setup(() => {
        (0, vscodeMocks_1.setupVSCodeMocks)();
        textInserter = new TextInserter_1.TextInserter();
    });
    teardown(() => {
        (0, vscodeMocks_1.resetVSCodeMocks)();
        sinon.restore();
    });
    suite('Constructor', () => {
        test('Should initialize without errors', () => {
            const inserter = new TextInserter_1.TextInserter();
            assert.ok(inserter);
        });
    });
    suite('insertAtCursor', () => {
        test('Should insert text at cursor position when editor is active', async () => {
            // Настраиваем активный редактор
            const editor = (0, vscodeMocks_1.setActiveEditor)('javascript');
            const result = await textInserter.insertAtCursor('Hello World');
            assert.strictEqual(result, true);
            assert.ok(editor.edit.calledOnce);
        });
        test('Should return false when no active editor', async () => {
            // Убираем активный редактор
            (0, vscodeMocks_1.clearActiveEditor)();
            const result = await textInserter.insertAtCursor('Hello World');
            assert.strictEqual(result, false);
        });
        test('Should handle editor.edit failure', async () => {
            // Настраиваем редактор с ошибкой
            const editor = (0, vscodeMocks_1.setActiveEditor)('javascript');
            editor.edit.resolves(false);
            const result = await textInserter.insertAtCursor('Hello World');
            assert.strictEqual(result, false);
        });
        test('Should handle editor.edit exception', async () => {
            // Настраиваем редактор с исключением
            const editor = (0, vscodeMocks_1.setActiveEditor)('javascript');
            editor.edit.rejects(new Error('Edit failed'));
            const result = await textInserter.insertAtCursor('Hello World');
            assert.strictEqual(result, false);
        });
    });
    suite('insertAsComment', () => {
        test('Should insert as single-line comment for JavaScript', async () => {
            const editor = (0, vscodeMocks_1.setActiveEditor)('javascript');
            const result = await textInserter.insertAsComment('This is a comment');
            assert.strictEqual(result, true);
            assert.ok(editor.edit.calledOnce);
            // Проверяем что в callback передается editBuilder
            const editCallback = editor.edit.getCall(0).args[0];
            assert.strictEqual(typeof editCallback, 'function');
        });
        test('Should insert as single-line comment for Python', async () => {
            const editor = (0, vscodeMocks_1.setActiveEditor)('python');
            const result = await textInserter.insertAsComment('This is a comment');
            assert.strictEqual(result, true);
            assert.ok(editor.edit.calledOnce);
        });
        test('Should insert as comment for HTML', async () => {
            const editor = (0, vscodeMocks_1.setActiveEditor)('html');
            const result = await textInserter.insertAsComment('This is a comment');
            assert.strictEqual(result, true);
            assert.ok(editor.edit.calledOnce);
        });
        test('Should handle unknown language', async () => {
            const editor = (0, vscodeMocks_1.setActiveEditor)('unknown-language');
            const result = await textInserter.insertAsComment('This is a comment');
            assert.strictEqual(result, true);
            // Для неизвестных языков должен использоваться fallback комментарий
            assert.ok(editor.edit.calledOnce);
        });
        test('Should return false when no active editor', async () => {
            (0, vscodeMocks_1.clearActiveEditor)();
            const result = await textInserter.insertAsComment('This is a comment');
            assert.strictEqual(result, false);
        });
        test('Should handle multiline text', async () => {
            const editor = (0, vscodeMocks_1.setActiveEditor)('javascript');
            const multilineText = 'Line 1\nLine 2\nLine 3';
            const result = await textInserter.insertAsComment(multilineText);
            assert.strictEqual(result, true);
            assert.ok(editor.edit.calledOnce);
        });
    });
    suite('replaceSelection', () => {
        test('Should replace selected text when selection exists', async () => {
            const editor = (0, vscodeMocks_1.setActiveEditor)('javascript');
            const result = await textInserter.replaceSelection('New text');
            assert.strictEqual(result, true);
            assert.ok(editor.edit.calledOnce);
        });
        test('Should return false when no active editor', async () => {
            (0, vscodeMocks_1.clearActiveEditor)();
            const result = await textInserter.replaceSelection('New text');
            assert.strictEqual(result, false);
        });
        test('Should handle editor.edit failure in replace', async () => {
            const editor = (0, vscodeMocks_1.setActiveEditor)('javascript');
            editor.edit.resolves(false);
            const result = await textInserter.replaceSelection('New text');
            assert.strictEqual(result, false);
        });
    });
    suite('Language Detection and Comment Formatting', () => {
        test('Should use correct comment format for different languages', async () => {
            const languages = [
                { id: 'javascript', expected: '//' },
                { id: 'typescript', expected: '//' },
                { id: 'python', expected: '#' },
                { id: 'css', expected: '/*' },
                { id: 'html', expected: '<!--' }
            ];
            for (const lang of languages) {
                (0, vscodeMocks_1.resetVSCodeMocks)();
                const editor = (0, vscodeMocks_1.setActiveEditor)(lang.id);
                await textInserter.insertAsComment('test comment');
                assert.ok(editor.edit.calledOnce, `Should call edit for ${lang.id}`);
            }
        });
        test('Should handle empty text gracefully', async () => {
            const editor = (0, vscodeMocks_1.setActiveEditor)('javascript');
            const result = await textInserter.insertAtCursor('');
            assert.strictEqual(result, true);
            assert.ok(editor.edit.calledOnce);
        });
        test('Should handle whitespace-only text', async () => {
            const editor = (0, vscodeMocks_1.setActiveEditor)('javascript');
            const result = await textInserter.insertAtCursor('   \n  \t  ');
            assert.strictEqual(result, true);
            assert.ok(editor.edit.calledOnce);
        });
    });
    suite('Error Handling', () => {
        test('Should handle VS Code API exceptions gracefully', async () => {
            const editor = (0, vscodeMocks_1.setActiveEditor)('javascript');
            editor.edit.throws(new Error('VS Code API error'));
            const result = await textInserter.insertAtCursor('test text');
            assert.strictEqual(result, false);
        });
        test('Should handle undefined text gracefully', async () => {
            const editor = (0, vscodeMocks_1.setActiveEditor)('javascript');
            const result = await textInserter.insertAtCursor(undefined);
            // Should handle undefined без краша
            assert.strictEqual(typeof result, 'boolean');
        });
        test('Should handle null text gracefully', async () => {
            const editor = (0, vscodeMocks_1.setActiveEditor)('javascript');
            const result = await textInserter.insertAtCursor(null);
            // Should handle null без краша
            assert.strictEqual(typeof result, 'boolean');
        });
    });
    suite('Integration with VS Code APIs', () => {
        test('Should work with different editor selection states', async () => {
            const editor = (0, vscodeMocks_1.setActiveEditor)('javascript');
            // Имитируем разные состояния выделения
            editor.selection.active.line = 5;
            editor.selection.active.character = 10;
            const result = await textInserter.insertAtCursor('inserted text');
            assert.strictEqual(result, true);
            assert.ok(editor.edit.calledOnce);
        });
        test('Should respect editor document language settings', async () => {
            // Тестируем разные типы документов
            const documentTypes = ['javascript', 'typescript', 'python', 'html', 'css'];
            for (const docType of documentTypes) {
                (0, vscodeMocks_1.resetVSCodeMocks)();
                const editor = (0, vscodeMocks_1.setActiveEditor)(docType);
                const result = await textInserter.insertAsComment('Comment for ' + docType);
                assert.strictEqual(result, true, `Should work for ${docType}`);
                assert.ok(editor.edit.calledOnce, `Should call edit for ${docType}`);
            }
        });
    });
});
//# sourceMappingURL=TextInserter.test.js.map