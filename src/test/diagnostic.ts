import * as vscode from 'vscode';

/**
 * Диагностика для проверки регистрации и работы команд
 */
export class CommandDiagnostics {
    
    /**
     * Проверяет, зарегистрированы ли команды расширения
     */
    static async checkCommandRegistration(): Promise<{ [commandId: string]: boolean }> {
        const expectedCommands = [
            'speechToTextWhisper.recordAndInsertOrClipboard',
            'speechToTextWhisper.recordAndInsertToCurrentChat', 
            'speechToTextWhisper.recordAndOpenNewChat',
            'speechToTextWhisper.runDiagnostics',
            'speechToTextWhisper.testFFmpeg',
            'speechToTextWhisper.testAudioRecorder',
            'speechToTextWhisper.openSettings',
            'speechToTextWhisper.toggleMode'
        ];

        const registrationStatus: { [commandId: string]: boolean } = {};
        
        for (const commandId of expectedCommands) {
            try {
                // Получаем список всех команд
                const allCommands = await vscode.commands.getCommands(true);
                registrationStatus[commandId] = allCommands.includes(commandId);
            } catch (error) {
                registrationStatus[commandId] = false;
            }
        }

        return registrationStatus;
    }

    /**
     * Проверяет активацию расширения
     */
    static async checkExtensionActivation(): Promise<{
        isActive: boolean;
        packageJson?: any;
        extensionId?: string;
        activationEvents?: string[];
    }> {
        try {
            const extension = vscode.extensions.getExtension('speak-y.speech-to-text-whisper');
            
            if (!extension) {
                return { isActive: false };
            }

            return {
                isActive: extension.isActive,
                packageJson: extension.packageJSON,
                extensionId: extension.id,
                activationEvents: extension.packageJSON?.activationEvents || []
            };
        } catch (error) {
            return { 
                isActive: false,
                packageJson: { error: (error as Error).message }
            };
        }
    }

    /**
     * Пытается выполнить команду и проверить её работоспособность
     */
    static async testCommandExecution(commandId: string): Promise<{
        success: boolean;
        error?: string;
        executionTime?: number;
    }> {
        const startTime = Date.now();
        
        try {
            await vscode.commands.executeCommand(commandId);
            return {
                success: true,
                executionTime: Date.now() - startTime
            };
        } catch (error) {
            return {
                success: false,
                error: (error as Error).message,
                executionTime: Date.now() - startTime
            };
        }
    }

    /**
     * Полная диагностика расширения
     */
    static async runFullDiagnostics(): Promise<{
        extension: any;
        commands: { [commandId: string]: boolean };
        commandTests: { [commandId: string]: any };
        keybindings: any[];
    }> {
        console.log('🔍 Запуск полной диагностики расширения...');

        // Проверка активации расширения
        const extensionStatus = await this.checkExtensionActivation();
        console.log('📊 Статус расширения:', extensionStatus);

        // Проверка регистрации команд
        const commandStatus = await this.checkCommandRegistration();
        console.log('📊 Статус команд:', commandStatus);

        // Тестирование выполнения команд (только безопасных)
        const safeCommandsToTest = [
            'speechToTextWhisper.runDiagnostics',
            'speechToTextWhisper.testFFmpeg',
            'speechToTextWhisper.testAudioRecorder',
            'speechToTextWhisper.openSettings'
        ];

        const commandTests: { [commandId: string]: any } = {};
        for (const commandId of safeCommandsToTest) {
            if (commandStatus[commandId]) {
                commandTests[commandId] = await this.testCommandExecution(commandId);
            } else {
                commandTests[commandId] = { success: false, error: 'Command not registered' };
            }
        }

        // Проверка клавиатурных привязок
        const keybindings = await this.getKeybindings();

        const result = {
            extension: extensionStatus,
            commands: commandStatus,
            commandTests,
            keybindings
        };

        console.log('📊 Результаты диагностики:', JSON.stringify(result, null, 2));
        
        return result;
    }

    /**
     * Получает информацию о клавиатурных привязках
     */
    static async getKeybindings(): Promise<any[]> {
        try {
            // VS Code API не предоставляет прямого доступа к keybindings
            // Возвращаем ожидаемые привязки из package.json
            const expectedKeybindings = [
                { command: 'speechToTextWhisper.recordAndOpenNewChat', key: 'F9' },
                { command: 'speechToTextWhisper.recordAndInsertOrClipboard', key: 'ctrl+shift+m', mac: 'cmd+shift+m' },
                { command: 'speechToTextWhisper.recordAndInsertToCurrentChat', key: 'ctrl+shift+n', mac: 'cmd+shift+n' }
            ];
            
            return expectedKeybindings;
        } catch (error) {
            return [];
        }
    }
}

/**
 * Команда для диагностики проблем с расширением
 */
export async function registerDiagnosticCommand(context: vscode.ExtensionContext): Promise<void> {
    const disposable = vscode.commands.registerCommand(
        'speechToTextWhisper.runFullDiagnostics',
        async () => {
            try {
                const diagnostics = await CommandDiagnostics.runFullDiagnostics();
                
                // Создаем отчет
                const report = [
                    '🔍 Диагностика расширения Speech-to-Text Whisper',
                    '=' .repeat(50),
                    '',
                    '📊 Статус расширения:',
                    `- Активно: ${diagnostics.extension.isActive}`,
                    `- ID: ${diagnostics.extension.extensionId}`,
                    '',
                    '📋 Команды:',
                    ...Object.entries(diagnostics.commands).map(([cmd, registered]) => 
                        `- ${cmd}: ${registered ? '✅' : '❌'}`
                    ),
                    '',
                    '🧪 Тесты команд:',
                    ...Object.entries(diagnostics.commandTests).map(([cmd, result]) => 
                        `- ${cmd}: ${result.success ? '✅' : '❌'} ${result.error ? `(${result.error})` : ''}`
                    ),
                    '',
                    '⌨️ Клавиатурные привязки:',
                    ...diagnostics.keybindings.map(kb => 
                        `- ${kb.command}: ${kb.key}${kb.mac ? ` / ${kb.mac}` : ''}`
                    )
                ].join('\n');

                // Показываем отчет в новом документе
                const doc = await vscode.workspace.openTextDocument({
                    content: report,
                    language: 'plaintext'
                });
                await vscode.window.showTextDocument(doc);

                // Также показываем краткий результат в уведомлении
                const registeredCount = Object.values(diagnostics.commands).filter(Boolean).length;
                const totalCount = Object.keys(diagnostics.commands).length;
                
                vscode.window.showInformationMessage(
                    `🔍 Диагностика завершена: ${registeredCount}/${totalCount} команд зарегистрировано`
                );

            } catch (error) {
                vscode.window.showErrorMessage(
                    `❌ Ошибка диагностики: ${(error as Error).message}`
                );
            }
        }
    );

    context.subscriptions.push(disposable);
} 