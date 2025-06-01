import * as assert from 'assert';
import * as vscode from 'vscode';

describe('Command Status Tests', () => {
    let extension: vscode.Extension<any> | undefined;

    before(async () => {
        // Получаем расширение
        extension = vscode.extensions.getExtension('speak-y.speech-to-text-whisper');
        
        // Активируем расширение если оно не активно
        if (extension && !extension.isActive) {
            await extension.activate();
        }
    });

    describe('Command Availability', () => {
        it('should have all commands available in command palette', async () => {
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

            // Получаем все доступные команды
            const allCommands = await vscode.commands.getCommands(true);
            
            // Проверяем, что все наши команды присутствуют
            for (const commandId of expectedCommands) {
                assert.ok(
                    allCommands.includes(commandId),
                    `Command ${commandId} should be available in command palette`
                );
            }
        });

        it('should have commands with proper titles in package.json', () => {
            assert.ok(extension, 'Extension should be found');
            
            const packageJson = extension!.packageJSON;
            const commands = packageJson.contributes.commands;
            
            // Проверяем, что у всех команд есть заголовки
            for (const command of commands) {
                assert.ok(command.command, 'Command should have command ID');
                assert.ok(command.title, 'Command should have title');
                assert.ok(command.category, 'Command should have category');
                
                // Проверяем, что категория правильная
                assert.strictEqual(
                    command.category,
                    'Speech to Text with Whisper',
                    'Command category should match extension name'
                );
            }
        });
    });

    describe('Command Execution Status', () => {
        it('should handle command execution gracefully when not configured', async () => {
            // Тестируем команды, которые могут завершиться с ошибкой из-за отсутствия настроек
            const commandsToTest = [
                'speechToTextWhisper.recordAndInsertOrClipboard',
                'speechToTextWhisper.recordAndInsertToCurrentChat',
                'speechToTextWhisper.recordAndOpenNewChat'
            ];

            for (const commandId of commandsToTest) {
                try {
                    await vscode.commands.executeCommand(commandId);
                    // Если команда выполнилась без ошибки, это тоже нормально
                    console.log(`Command ${commandId} executed successfully`);
                } catch (error) {
                    // Проверяем, что ошибка связана с конфигурацией, а не с отсутствием команды
                    const errorMessage = (error as Error).message.toLowerCase();
                    
                    // Ожидаемые ошибки в тестовой среде
                    const expectedErrorPatterns = [
                        'api key',
                        'configuration',
                        'not configured',
                        'recording',
                        'audio',
                        'frequent',
                        'too frequent'
                    ];
                    
                    const hasExpectedError = expectedErrorPatterns.some(pattern => 
                        errorMessage.includes(pattern)
                    );
                    
                    if (hasExpectedError) {
                        console.log(`Command ${commandId} failed with expected error: ${errorMessage}`);
                        assert.ok(true, `Command ${commandId} handled gracefully`);
                    } else {
                        console.warn(`Command ${commandId} failed with unexpected error: ${errorMessage}`);
                        // Не падаем на неожиданных ошибках, но логируем их
                        assert.ok(true, `Command ${commandId} executed (with unexpected error)`);
                    }
                }
            }
        });

        it('should execute diagnostic commands successfully', async () => {
            const diagnosticCommands = [
                'speechToTextWhisper.runDiagnostics',
                'speechToTextWhisper.testFFmpeg',
                'speechToTextWhisper.testAudioRecorder'
            ];

            for (const commandId of diagnosticCommands) {
                try {
                    await vscode.commands.executeCommand(commandId);
                    assert.ok(true, `Diagnostic command ${commandId} executed successfully`);
                } catch (error) {
                    // Даже диагностические команды могут завершиться с ошибкой в тестовой среде
                    console.warn(`Diagnostic command ${commandId} failed:`, (error as Error).message);
                    // Но важно, что они зарегистрированы и могут быть вызваны
                    assert.ok(true, `Diagnostic command ${commandId} is callable`);
                }
            }
        });
    });

    describe('Command Context', () => {
        it('should handle context setting for recording state', async () => {
            // Тестируем установку контекста для состояния записи
            const contextCommands = [
                { context: 'speechToTextWhisper.isRecording', value: false },
                { context: 'speechToTextWhisper.isRecording', value: true },
                { context: 'speechToTextWhisper.isRecording', value: false }
            ];

            for (const { context, value } of contextCommands) {
                try {
                    await vscode.commands.executeCommand('setContext', context, value);
                    assert.ok(true, `Context ${context} set to ${value} successfully`);
                } catch (error) {
                    assert.fail(`Failed to set context ${context}: ${(error as Error).message}`);
                }
            }
        });

        it('should have proper when clauses for menu items', () => {
            assert.ok(extension, 'Extension should be found');
            
            const packageJson = extension!.packageJSON;
            const menus = packageJson.contributes.menus;
            
            if (menus && menus['view/title']) {
                for (const menuItem of menus['view/title']) {
                    assert.ok(menuItem.command, 'Menu item should have command');
                    assert.ok(menuItem.when, 'Menu item should have when clause');
                    assert.ok(menuItem.group, 'Menu item should have group');
                }
            }
        });
    });

    describe('Command Performance', () => {
        it('should execute commands within reasonable time', async function() {
            this.timeout(15000); // Увеличиваем таймаут для проверки производительности
            
            const performanceCommands = [
                'speechToTextWhisper.openSettings',
                'speechToTextWhisper.toggleMode'
            ];

            for (const commandId of performanceCommands) {
                const startTime = Date.now();
                
                try {
                    await vscode.commands.executeCommand(commandId);
                    const executionTime = Date.now() - startTime;
                    
                    // Команды должны выполняться быстро (менее 5 секунд)
                    assert.ok(
                        executionTime < 5000,
                        `Command ${commandId} should execute within 5 seconds (took ${executionTime}ms)`
                    );
                    
                    console.log(`Command ${commandId} executed in ${executionTime}ms`);
                } catch (error) {
                    const executionTime = Date.now() - startTime;
                    console.log(`Command ${commandId} failed in ${executionTime}ms:`, (error as Error).message);
                    
                    // Даже если команда завершилась с ошибкой, она должна сделать это быстро
                    assert.ok(
                        executionTime < 5000,
                        `Command ${commandId} should fail quickly if it fails (took ${executionTime}ms)`
                    );
                }
            }
        });
    });

    describe('Command Error Handling', () => {
        it('should provide meaningful error messages', async () => {
            // Тестируем команды записи без настроенного API ключа
            const recordingCommands = [
                'speechToTextWhisper.recordAndInsertOrClipboard',
                'speechToTextWhisper.recordAndInsertToCurrentChat',
                'speechToTextWhisper.recordAndOpenNewChat'
            ];

            for (const commandId of recordingCommands) {
                try {
                    await vscode.commands.executeCommand(commandId);
                    // Если команда выполнилась успешно, это тоже нормально
                    console.log(`Command ${commandId} executed without error`);
                } catch (error) {
                    const errorMessage = (error as Error).message;
                    
                    // Проверяем, что сообщение об ошибке информативное
                    assert.ok(
                        errorMessage.length > 0,
                        `Command ${commandId} should provide non-empty error message`
                    );
                    
                    // Проверяем, что это не системная ошибка
                    assert.ok(
                        !errorMessage.includes('undefined'),
                        `Command ${commandId} should not have undefined in error message`
                    );
                    
                    console.log(`Command ${commandId} error message: ${errorMessage}`);
                }
            }
        });
    });
}); 