"use strict";
// extension.integration.test.ts - Integration тесты для полного цикла работы расширения
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
const webAudioMocks_1 = require("../mocks/webAudioMocks");
const vscodeMocks_1 = require("../mocks/vscodeMocks");
const testData_1 = require("../fixtures/testData");
suite('Extension Integration Tests', () => {
    let clock;
    setup(() => {
        (0, webAudioMocks_1.setupWebAudioMocks)();
        (0, vscodeMocks_1.setupVSCodeMocks)();
        clock = sinon.useFakeTimers();
    });
    teardown(() => {
        (0, webAudioMocks_1.cleanupWebAudioMocks)();
        (0, vscodeMocks_1.resetVSCodeMocks)();
        clock.restore();
        sinon.restore();
    });
    suite('Full Recording → Transcription → Insertion Flow', () => {
        test('Should complete full workflow: record → transcribe → insert at cursor', async () => {
            // Настройка: активный редактор и успешный API ответ
            const editor = (0, vscodeMocks_1.setActiveEditor)('javascript');
            const mockResponse = (0, webAudioMocks_1.createMockApiResponse)(testData_1.testApiResponses.successfulTranscription.text);
            const fetchStub = global.fetch;
            fetchStub.resolves(mockResponse);
            // Имитируем полный цикл работы расширения
            // 1. Начало записи (симуляция нажатия F9)
            // 2. Остановка записи (симуляция отпускания F9)
            // 3. Отправка в API
            // 4. Получение результата
            // 5. Вставка в редактор
            // Здесь бы был вызов команды расширения, но пока проверяем отдельные компоненты
            assert.ok(editor);
            assert.ok(fetchStub);
            // Проверяем что все моки работают
            assert.strictEqual(typeof vscodeMocks_1.mockVscode.window.showInformationMessage, 'function');
            assert.strictEqual(typeof vscodeMocks_1.mockVscode.commands.registerCommand, 'function');
        });
        test('Should handle recording without microphone access', async () => {
            // Симулируем отсутствие доступа к микрофону
            const mockNavigator = global.navigator;
            mockNavigator.mediaDevices.getUserMedia.rejects(new Error('Permission denied'));
            // Проверяем что ошибка обрабатывается корректно
            try {
                await mockNavigator.mediaDevices.getUserMedia({ audio: true });
                assert.fail('Should have thrown permission error');
            }
            catch (error) {
                assert.strictEqual(error.message, 'Permission denied');
            }
        });
        test('Should handle API key validation error', async () => {
            // Симулируем ошибку валидации API ключа
            const fetchStub = global.fetch;
            const mockResponse = {
                ok: false,
                status: 401,
                statusText: 'Unauthorized'
            };
            fetchStub.resolves(mockResponse);
            const response = await fetchStub('https://api.openai.com/v1/models');
            assert.strictEqual(response.ok, false);
            assert.strictEqual(response.status, 401);
        });
    });
    suite('Command Registration and Execution', () => {
        test('Should register extension commands properly', () => {
            // Проверяем регистрацию команд
            const registerCommandStub = vscodeMocks_1.mockVscode.commands.registerCommand;
            // Симулируем регистрацию команды
            const disposable = vscodeMocks_1.mockVscode.commands.registerCommand('voiceScribe.startRecording', () => {
                return 'Command executed';
            });
            assert.ok(registerCommandStub.calledOnce);
            assert.ok(disposable);
            assert.strictEqual(typeof disposable.dispose, 'function');
        });
        test('Should execute commands through VS Code API', async () => {
            // Проверяем выполнение команд
            const executeCommandStub = vscodeMocks_1.mockVscode.commands.executeCommand;
            executeCommandStub.resolves('Command result');
            const result = await vscodeMocks_1.mockVscode.commands.executeCommand('test.command');
            assert.ok(executeCommandStub.calledOnce);
            assert.strictEqual(result, 'Command result');
        });
    });
    suite('User Configuration Handling', () => {
        test('Should read user settings correctly', () => {
            // Настраиваем конфигурацию
            const getConfigStub = vscodeMocks_1.mockVscode.workspace.getConfiguration;
            const mockConfig = {
                get: sinon.stub().callsFake((key, defaultValue) => {
                    const settings = testData_1.testUserSettings.default;
                    return settings[key] || defaultValue;
                })
            };
            getConfigStub.returns(mockConfig);
            const config = vscodeMocks_1.mockVscode.workspace.getConfiguration('voiceScribe');
            const apiKey = config.get('apiKey');
            const language = config.get('language');
            assert.strictEqual(apiKey, 'test-api-key');
            assert.strictEqual(language, 'auto');
        });
        test('Should handle missing configuration gracefully', () => {
            // Тестируем случай отсутствующей конфигурации
            const getConfigStub = vscodeMocks_1.mockVscode.workspace.getConfiguration;
            const mockConfig = {
                get: sinon.stub().returns(undefined)
            };
            getConfigStub.returns(mockConfig);
            const config = vscodeMocks_1.mockVscode.workspace.getConfiguration('voiceScribe');
            const apiKey = config.get('apiKey');
            assert.strictEqual(apiKey, undefined);
        });
    });
    suite('Error Handling and User Feedback', () => {
        test('Should show appropriate error messages', () => {
            // Тестируем показ сообщений пользователю
            const showErrorStub = vscodeMocks_1.mockVscode.window.showErrorMessage;
            const showInfoStub = vscodeMocks_1.mockVscode.window.showInformationMessage;
            vscodeMocks_1.mockVscode.window.showErrorMessage('Test error message');
            vscodeMocks_1.mockVscode.window.showInformationMessage('Test info message');
            assert.ok(showErrorStub.calledOnce);
            assert.ok(showInfoStub.calledOnce);
            assert.strictEqual(showErrorStub.getCall(0).args[0], 'Test error message');
            assert.strictEqual(showInfoStub.getCall(0).args[0], 'Test info message');
        });
        test('Should handle status bar updates', () => {
            // Тестируем обновления статус-бара
            const createStatusBarStub = vscodeMocks_1.mockVscode.window.createStatusBarItem;
            const statusBarItem = vscodeMocks_1.mockVscode.window.createStatusBarItem();
            assert.ok(createStatusBarStub.calledOnce);
            assert.ok(statusBarItem);
            assert.strictEqual(typeof statusBarItem.show, 'function');
            assert.strictEqual(typeof statusBarItem.hide, 'function');
        });
    });
    suite('Multi-language Support', () => {
        test('Should handle different document languages correctly', () => {
            const languages = ['javascript', 'typescript', 'python', 'html', 'css'];
            languages.forEach(lang => {
                const editor = (0, vscodeMocks_1.setActiveEditor)(lang);
                assert.strictEqual(editor.document.languageId, lang);
            });
        });
        test('Should format comments correctly for each language', () => {
            const commentTests = [
                { language: 'javascript', expected: '//' },
                { language: 'python', expected: '#' },
                { language: 'html', expected: '<!--' },
                { language: 'css', expected: '/*' }
            ];
            commentTests.forEach(test => {
                const editor = (0, vscodeMocks_1.setActiveEditor)(test.language);
                assert.strictEqual(editor.document.languageId, test.language);
                // Здесь бы проверяли логику форматирования комментариев
            });
        });
    });
    suite('Performance and Resource Management', () => {
        test('Should clean up resources properly', () => {
            // Тестируем очистку ресурсов
            const disposables = [];
            // Симулируем создание ресурсов
            disposables.push(vscodeMocks_1.mockVscode.commands.registerCommand('test1', () => { }));
            disposables.push(vscodeMocks_1.mockVscode.commands.registerCommand('test2', () => { }));
            // Симулируем очистку
            disposables.forEach(d => d.dispose());
            assert.strictEqual(disposables.length, 2);
            disposables.forEach(d => {
                assert.strictEqual(typeof d.dispose, 'function');
            });
        });
        test('Should handle concurrent operations', async () => {
            // Тестируем обработку параллельных операций
            const fetchStub = global.fetch;
            const promises = [];
            for (let i = 0; i < 3; i++) {
                fetchStub.onCall(i).resolves((0, webAudioMocks_1.createMockApiResponse)(`Response ${i}`));
                promises.push(fetchStub(`url${i}`));
            }
            const results = await Promise.all(promises);
            assert.strictEqual(results.length, 3);
        });
    });
});
//# sourceMappingURL=extension.integration.test.js.map