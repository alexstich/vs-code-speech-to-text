import * as vscode from 'vscode';

/**
 * Diagnostics for checking command registration and operation
 */
export class CommandDiagnostics {
    
    /**
     * Checks if extension commands are registered
     */
    static async checkCommandRegistration(): Promise<{ [commandId: string]: boolean }> {
        const expectedCommands = [
            'speechToTextWhisper.recordAndInsertOrClipboard',
            'speechToTextWhisper.recordAndOpenCurrentChat', 
            'speechToTextWhisper.runDiagnostics',
            'speechToTextWhisper.testFFmpeg',
            'speechToTextWhisper.testAudioRecorder',
            'speechToTextWhisper.openSettings',
            'speechToTextWhisper.toggleMode'
        ];

        const registrationStatus: { [commandId: string]: boolean } = {};
        
        for (const commandId of expectedCommands) {
            try {
                // Get list of all commands
                const allCommands = await vscode.commands.getCommands(true);
                registrationStatus[commandId] = allCommands.includes(commandId);
            } catch (error) {
                registrationStatus[commandId] = false;
            }
        }

        return registrationStatus;
    }

    /**
     * Checks extension activation
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
     * Attempts to execute a command and check its functionality
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
     * Full extension diagnostics
     */
    static async runFullDiagnostics(): Promise<{
        extension: any;
        commands: { [commandId: string]: boolean };
        commandTests: { [commandId: string]: any };
        keybindings: any[];
    }> {
        console.log('🔍 Running full extension diagnostics...');

        // Check extension activation
        const extensionStatus = await this.checkExtensionActivation();
        console.log('📊 Extension status:', extensionStatus);

        // Check command registration
        const commandStatus = await this.checkCommandRegistration();
        console.log('📊 Command status:', commandStatus);

        // Test command execution (safe ones only)
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

        // Check keybindings
        const keybindings = await this.getKeybindings();

        const result = {
            extension: extensionStatus,
            commands: commandStatus,
            commandTests,
            keybindings
        };

        console.log('📊 Diagnostics results:', JSON.stringify(result, null, 2));
        
        return result;
    }

    /**
     * Gets keybinding information
     */
    static async getKeybindings(): Promise<any[]> {
        try {
            // VS Code API does not provide direct access to keybindings
            // Returning expected bindings from package.json
            const expectedKeybindings = [
                { command: 'speechToTextWhisper.recordAndInsertOrClipboard', key: 'ctrl+shift+m', mac: 'cmd+shift+m' },
                { command: 'speechToTextWhisper.recordAndOpenCurrentChat', key: 'ctrl+shift+n', mac: 'cmd+shift+n' }
            ];
            
            return expectedKeybindings;
        } catch (error) {
            return [];
        }
    }
}

/**
 * Command for diagnosing extension issues
 */
export async function registerDiagnosticCommand(context: vscode.ExtensionContext): Promise<void> {
    const disposable = vscode.commands.registerCommand(
        'speechToTextWhisper.runFullDiagnostics',
        async () => {
            try {
                const diagnostics = await CommandDiagnostics.runFullDiagnostics();
                
                // Create report
                const report = [
                    '🔍 Speech-to-Text Whisper Extension Diagnostics',
                    '=' .repeat(50),
                    '',
                    '📊 Extension Status:',
                    `- Active: ${diagnostics.extension.isActive}`,
                    '',
                    '📋 Commands:',
                    ...Object.entries(diagnostics.commands).map(([cmd, registered]) => 
                        `- ${cmd}: ${registered ? '✅' : '❌'}`
                    ),
                    '',
                    '🧪 Command Tests:',
                    ...Object.entries(diagnostics.commandTests).map(([cmd, result]) => 
                        `- ${cmd}: ${result.success ? '✅' : '❌'} ${result.error ? `(${result.error})` : ''}`
                    ),
                    '',
                    '⌨️ Keybindings:',
                    ...diagnostics.keybindings.map(kb => 
                        `- ${kb.command}: ${kb.key}${kb.mac ? ` / ${kb.mac}` : ''}`
                    )
                ].join('\n');

                // Show report in a new document
                const doc = await vscode.workspace.openTextDocument({
                    content: report,
                    language: 'plaintext'
                });
                await vscode.window.showTextDocument(doc);

                // Also show a brief result in a notification
                const registeredCount = Object.values(diagnostics.commands).filter(Boolean).length;
                const totalCount = Object.keys(diagnostics.commands).length;
                
                vscode.window.showInformationMessage(
                    `🔍 Diagnostics complete: ${registeredCount}/${totalCount} commands registered`
                );

            } catch (error) {
                vscode.window.showErrorMessage(
                    `❌ Diagnostics error: ${(error as Error).message}`
                );
            }
        }
    );

    context.subscriptions.push(disposable);
} 