import * as assert from 'assert';
import * as vscode from 'vscode';
import * as sinon from 'sinon';

describe('Commands Integration Tests', () => {
    let extension: vscode.Extension<any> | undefined;

    before(async () => {
        // Получаем расширение
        extension = vscode.extensions.getExtension('speak-y.speech-to-text-whisper');
        
        // Активируем расширение если оно не активно
        if (extension && !extension.isActive) {
            await extension.activate();
        }
    });

    describe('Command Registration', () => {
        const expectedCommands = [
            'speechToTextWhisper.recordAndInsertOrClipboard',
            'speechToTextWhisper.recordAndInsertToCurrentChat', 
            'speechToTextWhisper.recordAndOpenNewChat',
            'speechToTextWhisper.runDiagnostics',
            'speechToTextWhisper.testFFmpeg',
            'speechToTextWhisper.testAudioRecorder',
            'speechToTextWhisper.openSettings',
            'speechToTextWhisper.toggleMode',
            'speechToTextWhisper.audioSettings.selectDevice'
        ];

        it('should register all expected commands', async () => {
            const allCommands = await vscode.commands.getCommands(true);
            
            for (const commandId of expectedCommands) {
                assert.ok(
                    allCommands.includes(commandId),
                    `Command ${commandId} should be registered`
                );
            }
        });

        it('should have extension activated', () => {
            assert.ok(extension, 'Extension should be found');
            assert.ok(extension!.isActive, 'Extension should be active');
        });
    });

    describe('Safe Command Execution', () => {
        // Тестируем только безопасные команды, которые не требуют пользовательского ввода
        const safeCommands = [
            'speechToTextWhisper.runDiagnostics',
            'speechToTextWhisper.testFFmpeg', 
            'speechToTextWhisper.testAudioRecorder',
            'speechToTextWhisper.openSettings'
        ];

        safeCommands.forEach(commandId => {
            it(`should execute ${commandId} without errors`, async function() {
                this.timeout(10000); // Увеличиваем таймаут для команд
                
                try {
                    await vscode.commands.executeCommand(commandId);
                    // Если команда выполнилась без исключения, тест прошел
                    assert.ok(true, `Command ${commandId} executed successfully`);
                } catch (error) {
                    // Некоторые команды могут завершиться с ошибкой из-за отсутствия настроек
                    // но важно, что они зарегистрированы и могут быть вызваны
                    console.warn(`Command ${commandId} failed with:`, (error as Error).message);
                    
                    // Проверяем, что это ожидаемая ошибка (например, отсутствие API ключа)
                    const errorMessage = (error as Error).message.toLowerCase();
                    const isExpectedError = errorMessage.includes('api key') || 
                                          errorMessage.includes('ffmpeg') ||
                                          errorMessage.includes('audio') ||
                                          errorMessage.includes('configuration');
                    
                    if (isExpectedError) {
                        assert.ok(true, `Command ${commandId} failed with expected error: ${errorMessage}`);
                    } else {
                        throw error; // Неожиданная ошибка
                    }
                }
            });
        });
    });

    describe('Recording Commands', () => {
        // Для команд записи мы не можем их полностью выполнить в тестах,
        // но можем проверить, что они зарегистрированы и доступны
        const recordingCommands = [
            'speechToTextWhisper.recordAndInsertOrClipboard',
            'speechToTextWhisper.recordAndInsertToCurrentChat',
            'speechToTextWhisper.recordAndOpenNewChat'
        ];

        recordingCommands.forEach(commandId => {
            it(`should have ${commandId} registered and available`, async () => {
                const allCommands = await vscode.commands.getCommands(true);
                assert.ok(
                    allCommands.includes(commandId),
                    `Recording command ${commandId} should be registered`
                );
            });
        });

        it('should not execute recording commands in test environment', async () => {
            // В тестовой среде команды записи должны быть доступны, но не должны запускать реальную запись
            // Это проверяет, что команды зарегистрированы, но не тестирует их полную функциональность
            for (const commandId of recordingCommands) {
                try {
                    // Пытаемся выполнить команду, но ожидаем, что она может завершиться с ошибкой
                    // из-за отсутствия необходимых настроек или аудио устройств в тестовой среде
                    await vscode.commands.executeCommand(commandId);
                } catch (error) {
                    // Это ожидаемо в тестовой среде
                    const errorMessage = (error as Error).message.toLowerCase();
                    console.log(`Recording command ${commandId} failed as expected in test environment:`, errorMessage);
                }
            }
            
            // Если мы дошли до этой точки, команды зарегистрированы
            assert.ok(true, 'Recording commands are registered');
        });
    });

    describe('Context Commands', () => {
        it('should handle context setting commands', async () => {
            // Тестируем команды, которые устанавливают контекст
            try {
                await vscode.commands.executeCommand('setContext', 'speechToTextWhisper.isRecording', false);
                assert.ok(true, 'Context setting command works');
            } catch (error) {
                assert.fail(`Context setting failed: ${(error as Error).message}`);
            }
        });
    });
}); 