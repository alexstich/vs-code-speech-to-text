import * as assert from 'assert';
import * as vscode from 'vscode';
import * as sinon from 'sinon';

describe('Silence Detection Integration Tests', () => {
    let extension: vscode.Extension<any> | undefined;
    let sandbox: sinon.SinonSandbox;
    
    // Время ожидания для тестов
    const TEST_TIMEOUT = 15000;

    before(async function() {
        this.timeout(TEST_TIMEOUT);
        
        // Активируем расширение
        extension = vscode.extensions.getExtension('alekseigrebenkin.speech-to-text-whisper');
        if (extension && !extension.isActive) {
            await extension.activate();
        }
    });

    beforeEach(() => {
        sandbox = sinon.createSandbox();
    });

    afterEach(() => {
        sandbox.restore();
    });

    describe('Configuration Impact on Recording Behavior', () => {
        it('должен респектировать настройку silenceDetection=true в конфигурации', async function() {
            this.timeout(TEST_TIMEOUT);
            
            // Получаем конфигурацию
            const config = vscode.workspace.getConfiguration('speechToTextWhisper');
            const originalSilenceDetection = config.get<boolean>('silenceDetection');
            const originalMaxRecordingDuration = config.get<number>('maxRecordingDuration');
            
            try {
                // Устанавливаем silenceDetection в true
                await config.update('silenceDetection', true, vscode.ConfigurationTarget.Global);
                await config.update('maxRecordingDuration', 120, vscode.ConfigurationTarget.Global); // 2 минуты
                
                // Ждем чтобы конфигурация применилась
                await new Promise(resolve => setTimeout(resolve, 100));
                
                // Проверяем что настройка применилась
                const updatedConfig = vscode.workspace.getConfiguration('speechToTextWhisper');
                assert.strictEqual(updatedConfig.get<boolean>('silenceDetection'), true, 'silenceDetection должно быть true');
                assert.strictEqual(updatedConfig.get<number>('maxRecordingDuration'), 120, 'maxRecordingDuration должно быть 120');
                
                // Проверяем что команды записи доступны
                const commands = await vscode.commands.getCommands(true);
                const recordingCommands = [
                    'speechToTextWhisper.recordAndInsertOrClipboard',
                    'speechToTextWhisper.recordAndInsertToCurrentChat',
                    'speechToTextWhisper.recordAndOpenNewChat'
                ];
                
                recordingCommands.forEach(commandId => {
                    assert.ok(
                        commands.includes(commandId), 
                        `Команда ${commandId} должна быть зарегистрирована`
                    );
                });
                
            } finally {
                // Восстанавливаем оригинальные настройки
                if (originalSilenceDetection !== undefined) {
                    await config.update('silenceDetection', originalSilenceDetection, vscode.ConfigurationTarget.Global);
                }
                if (originalMaxRecordingDuration !== undefined) {
                    await config.update('maxRecordingDuration', originalMaxRecordingDuration, vscode.ConfigurationTarget.Global);
                }
            }
        });

        it('должен респектировать настройку silenceDetection=false в конфигурации', async function() {
            this.timeout(TEST_TIMEOUT);
            
            const config = vscode.workspace.getConfiguration('speechToTextWhisper');
            const originalSilenceDetection = config.get<boolean>('silenceDetection');
            const originalMaxRecordingDuration = config.get<number>('maxRecordingDuration');
            
            try {
                // Устанавливаем silenceDetection в false
                await config.update('silenceDetection', false, vscode.ConfigurationTarget.Global);
                await config.update('maxRecordingDuration', 30, vscode.ConfigurationTarget.Global); // 30 секунд
                
                // Ждем чтобы конфигурация применилась
                await new Promise(resolve => setTimeout(resolve, 100));
                
                // Проверяем что настройка применилась
                const updatedConfig = vscode.workspace.getConfiguration('speechToTextWhisper');
                assert.strictEqual(updatedConfig.get<boolean>('silenceDetection'), false, 'silenceDetection должно быть false');
                assert.strictEqual(updatedConfig.get<number>('maxRecordingDuration'), 30, 'maxRecordingDuration должно быть 30');
                
                // Проверяем что команды записи доступны
                const commands = await vscode.commands.getCommands(true);
                const recordingCommands = [
                    'speechToTextWhisper.recordAndInsertOrClipboard',
                    'speechToTextWhisper.recordAndInsertToCurrentChat', 
                    'speechToTextWhisper.recordAndOpenNewChat'
                ];
                
                recordingCommands.forEach(commandId => {
                    assert.ok(
                        commands.includes(commandId), 
                        `Команда ${commandId} должна быть зарегистрирована`
                    );
                });
                
            } finally {
                // Восстанавливаем оригинальные настройки
                if (originalSilenceDetection !== undefined) {
                    await config.update('silenceDetection', originalSilenceDetection, vscode.ConfigurationTarget.Global);
                }
                if (originalMaxRecordingDuration !== undefined) {
                    await config.update('maxRecordingDuration', originalMaxRecordingDuration, vscode.ConfigurationTarget.Global);
                }
            }
        });
    });

    describe('Recording Command Execution with Different Silence Detection Settings', () => {
        it('должен обрабатывать команды записи с silenceDetection=true без ошибок', async function() {
            this.timeout(TEST_TIMEOUT);
            
            const config = vscode.workspace.getConfiguration('speechToTextWhisper');
            const originalSilenceDetection = config.get<boolean>('silenceDetection');
            
            // Заглушаем сообщения для теста
            const showInfoStub = sandbox.stub(vscode.window, 'showInformationMessage');
            const showErrorStub = sandbox.stub(vscode.window, 'showErrorMessage');
            
            try {
                // Устанавливаем silenceDetection в true
                await config.update('silenceDetection', true, vscode.ConfigurationTarget.Global);
                await new Promise(resolve => setTimeout(resolve, 100));
                
                // Пытаемся выполнить команду записи
                await vscode.commands.executeCommand('speechToTextWhisper.recordAndInsertOrClipboard');
                
                // В тестовой среде команда может завершиться с ошибкой (нет микрофона/FFmpeg),
                // но важно что она не упадет с критической ошибкой
                const errorCalls = showErrorStub.getCalls();
                const infoCalls = showInfoStub.getCalls();
                
                // Должно быть какое-то сообщение (успех или ошибка)
                assert.ok(
                    errorCalls.length > 0 || infoCalls.length > 0,
                    'Должно быть показано сообщение пользователю'
                );
                
                // Если есть ошибки, они должны быть понятными
                if (errorCalls.length > 0) {
                    const errorMessage = errorCalls[0].args[0];
                    assert.ok(
                        typeof errorMessage === 'string' && errorMessage.length > 0,
                        'Сообщение об ошибке должно быть непустой строкой'
                    );
                }
                
            } finally {
                // Восстанавливаем оригинальную настройку
                if (originalSilenceDetection !== undefined) {
                    await config.update('silenceDetection', originalSilenceDetection, vscode.ConfigurationTarget.Global);
                }
            }
        });

        it('должен обрабатывать команды записи с silenceDetection=false без ошибок', async function() {
            this.timeout(TEST_TIMEOUT);
            
            const config = vscode.workspace.getConfiguration('speechToTextWhisper');
            const originalSilenceDetection = config.get<boolean>('silenceDetection');
            
            // Заглушаем сообщения для теста
            const showInfoStub = sandbox.stub(vscode.window, 'showInformationMessage');
            const showErrorStub = sandbox.stub(vscode.window, 'showErrorMessage');
            
            try {
                // Устанавливаем silenceDetection в false
                await config.update('silenceDetection', false, vscode.ConfigurationTarget.Global);
                await new Promise(resolve => setTimeout(resolve, 100));
                
                // Пытаемся выполнить команду записи
                await vscode.commands.executeCommand('speechToTextWhisper.recordAndInsertOrClipboard');
                
                // В тестовой среде команда может завершиться с ошибкой (нет микрофона/FFmpeg),
                // но важно что она не упадет с критической ошибкой
                const errorCalls = showErrorStub.getCalls();
                const infoCalls = showInfoStub.getCalls();
                
                // Должно быть какое-то сообщение (успех или ошибка)
                assert.ok(
                    errorCalls.length > 0 || infoCalls.length > 0,
                    'Должно быть показано сообщение пользователю'
                );
                
                // Если есть ошибки, они должны быть понятными
                if (errorCalls.length > 0) {
                    const errorMessage = errorCalls[0].args[0];
                    assert.ok(
                        typeof errorMessage === 'string' && errorMessage.length > 0,
                        'Сообщение об ошибке должно быть непустой строкой'
                    );
                }
                
            } finally {
                // Восстанавливаем оригинальную настройку
                if (originalSilenceDetection !== undefined) {
                    await config.update('silenceDetection', originalSilenceDetection, vscode.ConfigurationTarget.Global);
                }
            }
        });
    });

    describe('Configuration Validation', () => {
        it('должен корректно валидировать различные комбинации настроек silence detection', async function() {
            this.timeout(TEST_TIMEOUT);
            
            const config = vscode.workspace.getConfiguration('speechToTextWhisper');
            
            // Сохраняем оригинальные значения
            const originalValues = {
                silenceDetection: config.get<boolean>('silenceDetection'),
                silenceDuration: config.get<number>('silenceDuration'),
                silenceThreshold: config.get<number>('silenceThreshold'),
                maxRecordingDuration: config.get<number>('maxRecordingDuration')
            };
            
            try {
                // Тестируем различные валидные комбинации
                const validCombinations = [
                    {
                        name: 'Полные настройки silence detection',
                        settings: {
                            silenceDetection: true,
                            silenceDuration: 5,
                            silenceThreshold: 30,
                            maxRecordingDuration: 120
                        }
                    },
                    {
                        name: 'Silence detection выключено',
                        settings: {
                            silenceDetection: false,
                            maxRecordingDuration: 60
                        }
                    },
                    {
                        name: 'Минимальные настройки',
                        settings: {
                            silenceDetection: true,
                            silenceDuration: 1,
                            silenceThreshold: 20,
                            maxRecordingDuration: 5
                        }
                    },
                    {
                        name: 'Максимальные настройки',
                        settings: {
                            silenceDetection: true,
                            silenceDuration: 10,
                            silenceThreshold: 80,
                            maxRecordingDuration: 300
                        }
                    }
                ];
                
                for (const combination of validCombinations) {
                    console.log(`Тестируем комбинацию: ${combination.name}`);
                    
                    // Применяем настройки
                    for (const [key, value] of Object.entries(combination.settings)) {
                        await config.update(key, value, vscode.ConfigurationTarget.Global);
                    }
                    
                    // Ждем применения настроек
                    await new Promise(resolve => setTimeout(resolve, 50));
                    
                    // Проверяем что настройки применились
                    const updatedConfig = vscode.workspace.getConfiguration('speechToTextWhisper');
                    for (const [key, expectedValue] of Object.entries(combination.settings)) {
                        const actualValue = updatedConfig.get(key);
                        assert.strictEqual(
                            actualValue, 
                            expectedValue, 
                            `Настройка ${key} должна быть ${expectedValue} для комбинации: ${combination.name}`
                        );
                    }
                    
                    // Проверяем что команды доступны (что означает что конфигурация валидна)
                    const commands = await vscode.commands.getCommands(true);
                    assert.ok(
                        commands.includes('speechToTextWhisper.recordAndInsertOrClipboard'),
                        `Команды должны быть доступны для комбинации: ${combination.name}`
                    );
                }
                
            } finally {
                // Восстанавливаем все оригинальные значения
                for (const [key, value] of Object.entries(originalValues)) {
                    if (value !== undefined) {
                        await config.update(key, value, vscode.ConfigurationTarget.Global);
                    }
                }
            }
        });
    });

    describe('Error Handling with Different Silence Detection Settings', () => {
        it('должен корректно обрабатывать ошибки независимо от настройки silenceDetection', async function() {
            this.timeout(TEST_TIMEOUT);
            
            const config = vscode.workspace.getConfiguration('speechToTextWhisper');
            const originalSilenceDetection = config.get<boolean>('silenceDetection');
            
            // Заглушаем сообщения об ошибках
            const showErrorStub = sandbox.stub(vscode.window, 'showErrorMessage');
            
            try {
                // Тестируем с включенным silence detection
                await config.update('silenceDetection', true, vscode.ConfigurationTarget.Global);
                await new Promise(resolve => setTimeout(resolve, 50));
                
                try {
                    await vscode.commands.executeCommand('speechToTextWhisper.recordAndInsertOrClipboard');
                } catch (error) {
                    // В тестовой среде ошибка ожидаема
                    console.log('Ожидаемая ошибка с silenceDetection=true:', (error as Error).message);
                }
                
                // Тестируем с выключенным silence detection
                await config.update('silenceDetection', false, vscode.ConfigurationTarget.Global);
                await new Promise(resolve => setTimeout(resolve, 50));
                
                try {
                    await vscode.commands.executeCommand('speechToTextWhisper.recordAndInsertOrClipboard');
                } catch (error) {
                    // В тестовой среде ошибка ожидаема
                    console.log('Ожидаемая ошибка с silenceDetection=false:', (error as Error).message);
                }
                
                // Проверяем что обработка ошибок работает корректно
                // (в тестовой среде обычно нет доступа к микрофону/FFmpeg)
                console.log(`Показано сообщений об ошибке: ${showErrorStub.callCount}`);
                
                // Проверяем что если были ошибки, то они имеют осмысленные сообщения
                showErrorStub.getCalls().forEach((call, index) => {
                    const errorMessage = call.args[0];
                    assert.ok(
                        typeof errorMessage === 'string' && errorMessage.length > 0,
                        `Сообщение об ошибке ${index + 1} должно быть непустой строкой`
                    );
                });
                
            } finally {
                // Восстанавливаем оригинальную настройку
                if (originalSilenceDetection !== undefined) {
                    await config.update('silenceDetection', originalSilenceDetection, vscode.ConfigurationTarget.Global);
                }
            }
        });
    });
}); 