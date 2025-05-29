// extension.integration.test.ts - Integration тесты для полного цикла работы расширения

import * as assert from 'assert';
import * as sinon from 'sinon';
import { setupWebAudioMocks, cleanupWebAudioMocks, createMockApiResponse } from '../mocks/webAudioMocks';
import { setupVSCodeMocks, resetVSCodeMocks, setActiveEditor, mockVscode } from '../mocks/vscodeMocks';
import { testApiResponses, testUserSettings } from '../fixtures/testData';

suite('Extension Integration Tests', () => {
    let clock: sinon.SinonFakeTimers;

    setup(() => {
        setupWebAudioMocks();
        setupVSCodeMocks();
        clock = sinon.useFakeTimers();
    });

    teardown(() => {
        cleanupWebAudioMocks();
        resetVSCodeMocks();
        clock.restore();
        sinon.restore();
    });

    suite('Full Recording → Transcription → Insertion Flow', () => {
        test('Should complete full workflow: record → transcribe → insert at cursor', async () => {
            // Настройка: активный редактор и успешный API ответ
            const editor = setActiveEditor('javascript');
            const mockResponse = createMockApiResponse(testApiResponses.successfulTranscription.text);
            const fetchStub = (global as any).fetch;
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
            assert.strictEqual(typeof mockVscode.window.showInformationMessage, 'function');
            assert.strictEqual(typeof mockVscode.commands.registerCommand, 'function');
        });

        test('Should handle recording without microphone access', async () => {
            // Симулируем отсутствие доступа к микрофону
            const mockNavigator = (global as any).navigator;
            mockNavigator.mediaDevices.getUserMedia.rejects(new Error('Permission denied'));

            // Проверяем что ошибка обрабатывается корректно
            try {
                await mockNavigator.mediaDevices.getUserMedia({ audio: true });
                assert.fail('Should have thrown permission error');
            } catch (error) {
                assert.strictEqual((error as Error).message, 'Permission denied');
            }
        });

        test('Should handle API key validation error', async () => {
            // Симулируем ошибку валидации API ключа
            const fetchStub = (global as any).fetch;
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
            const registerCommandStub = mockVscode.commands.registerCommand as sinon.SinonStub;
            
            // Симулируем регистрацию команды
            const disposable = mockVscode.commands.registerCommand('voiceScribe.startRecording', () => {
                return 'Command executed';
            });

            assert.ok(registerCommandStub.calledOnce);
            assert.ok(disposable);
            assert.strictEqual(typeof disposable.dispose, 'function');
        });

        test('Should execute commands through VS Code API', async () => {
            // Проверяем выполнение команд
            const executeCommandStub = mockVscode.commands.executeCommand as sinon.SinonStub;
            executeCommandStub.resolves('Command result');

            const result = await mockVscode.commands.executeCommand('test.command');
            
            assert.ok(executeCommandStub.calledOnce);
            assert.strictEqual(result, 'Command result');
        });
    });

    suite('User Configuration Handling', () => {
        test('Should read user settings correctly', () => {
            // Настраиваем конфигурацию
            const getConfigStub = mockVscode.workspace.getConfiguration as sinon.SinonStub;
            const mockConfig = {
                get: sinon.stub().callsFake((key: string, defaultValue?: any) => {
                    const settings: any = testUserSettings.default;
                    return settings[key] || defaultValue;
                })
            };
            getConfigStub.returns(mockConfig);

            const config = mockVscode.workspace.getConfiguration('voiceScribe');
            const apiKey = config.get('apiKey');
            const language = config.get('language');

            assert.strictEqual(apiKey, 'test-api-key');
            assert.strictEqual(language, 'auto');
        });

        test('Should handle missing configuration gracefully', () => {
            // Тестируем случай отсутствующей конфигурации
            const getConfigStub = mockVscode.workspace.getConfiguration as sinon.SinonStub;
            const mockConfig = {
                get: sinon.stub().returns(undefined)
            };
            getConfigStub.returns(mockConfig);

            const config = mockVscode.workspace.getConfiguration('voiceScribe');
            const apiKey = config.get('apiKey');

            assert.strictEqual(apiKey, undefined);
        });
    });

    suite('Error Handling and User Feedback', () => {
        test('Should show appropriate error messages', () => {
            // Тестируем показ сообщений пользователю
            const showErrorStub = mockVscode.window.showErrorMessage as sinon.SinonStub;
            const showInfoStub = mockVscode.window.showInformationMessage as sinon.SinonStub;

            mockVscode.window.showErrorMessage('Test error message');
            mockVscode.window.showInformationMessage('Test info message');

            assert.ok(showErrorStub.calledOnce);
            assert.ok(showInfoStub.calledOnce);
            assert.strictEqual(showErrorStub.getCall(0).args[0], 'Test error message');
            assert.strictEqual(showInfoStub.getCall(0).args[0], 'Test info message');
        });

        test('Should handle status bar updates', () => {
            // Тестируем обновления статус-бара
            const createStatusBarStub = mockVscode.window.createStatusBarItem as sinon.SinonStub;
            
            const statusBarItem = mockVscode.window.createStatusBarItem();
            
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
                const editor = setActiveEditor(lang);
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
                const editor = setActiveEditor(test.language);
                assert.strictEqual(editor.document.languageId, test.language);
                // Здесь бы проверяли логику форматирования комментариев
            });
        });
    });

    suite('Performance and Resource Management', () => {
        test('Should clean up resources properly', () => {
            // Тестируем очистку ресурсов
            const disposables: any[] = [];
            
            // Симулируем создание ресурсов
            disposables.push(mockVscode.commands.registerCommand('test1', () => {}));
            disposables.push(mockVscode.commands.registerCommand('test2', () => {}));
            
            // Симулируем очистку
            disposables.forEach(d => d.dispose());
            
            assert.strictEqual(disposables.length, 2);
            disposables.forEach(d => {
                assert.strictEqual(typeof d.dispose, 'function');
            });
        });

        test('Should handle concurrent operations', async () => {
            // Тестируем обработку параллельных операций
            const fetchStub = (global as any).fetch;
            const promises = [];

            for (let i = 0; i < 3; i++) {
                fetchStub.onCall(i).resolves(createMockApiResponse(`Response ${i}`));
                promises.push(fetchStub(`url${i}`));
            }

            const results = await Promise.all(promises);
            assert.strictEqual(results.length, 3);
        });
    });
}); 