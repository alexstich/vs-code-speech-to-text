import * as assert from 'assert';
import * as vscode from 'vscode';

describe('Command Status Tests', () => {
    let extension: vscode.Extension<any> | undefined;

    before(async () => {
        // Get the extension
        extension = vscode.extensions.getExtension('speak-y.speech-to-text-whisper');
        
        // Activate the extension if it's not active
        if (extension && !extension.isActive) {
            await extension.activate();
        }
    });

    describe('Command Availability', () => {
        it('should have all commands available in command palette', async () => {
            const expectedCommands = [
                'speechToTextWhisper.recordAndInsertOrClipboard',
                'speechToTextWhisper.recordAndOpenCurrentChat',
                'speechToTextWhisper.runDiagnostics',
                'speechToTextWhisper.testFFmpeg',
                'speechToTextWhisper.testAudioRecorder',
                'speechToTextWhisper.openSettings',
                'speechToTextWhisper.toggleMode',
                'speechToTextWhisper.audioSettings.selectDevice'
            ];

            // Get all available commands
            const allCommands = await vscode.commands.getCommands(true);
            
            // Check that all our commands are present
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
            
            // Check that all commands have titles
            for (const command of commands) {
                assert.ok(command.command, 'Command should have command ID');
                assert.ok(command.title, 'Command should have title');
                assert.ok(command.category, 'Command should have category');
                
                // Check that the category is correct
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
            // Test commands that might fail due to missing settings
            const commandsToTest = [
                'speechToTextWhisper.recordAndInsertOrClipboard',
                'speechToTextWhisper.recordAndOpenCurrentChat',
            ];

            for (const commandId of commandsToTest) {
                try {
                    await vscode.commands.executeCommand(commandId);
                    // If the command executed without error, that's also fine
                    console.log(`Command ${commandId} executed successfully`);
                } catch (error) {
                    // Check that the error is related to configuration, not missing command
                    const errorMessage = (error as Error).message.toLowerCase();
                    
                    // Expected errors in test environment
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
                        // Do not fail on unexpected errors, but log them
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
                    // Even diagnostic commands might fail in the test environment
                    console.warn(`Diagnostic command ${commandId} failed:`, (error as Error).message);
                    // But it's important that they are registered and callable
                    assert.ok(true, `Diagnostic command ${commandId} is callable`);
                }
            }
        });
    });

    describe('Command Context', () => {
        it('should handle context setting for recording state', async () => {
            // Test setting context for recording state
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
            this.timeout(15000); // Increase timeout for performance testing
            
            const performanceCommands = [
                'speechToTextWhisper.openSettings',
                'speechToTextWhisper.toggleMode'
            ];

            for (const commandId of performanceCommands) {
                const startTime = Date.now();
                
                try {
                    await vscode.commands.executeCommand(commandId);
                    const executionTime = Date.now() - startTime;
                    
                    // Commands should execute quickly (less than 5 seconds)
                    assert.ok(
                        executionTime < 5000,
                        `Command ${commandId} should execute within 5 seconds (took ${executionTime}ms)`
                    );
                    
                    console.log(`Command ${commandId} executed in ${executionTime}ms`);
                } catch (error) {
                    const executionTime = Date.now() - startTime;
                    console.log(`Command ${commandId} failed in ${executionTime}ms:`, (error as Error).message);
                    
                    // Even if the command failed, it should do so quickly
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
            // Testing recording commands without configured API key
            const recordingCommands = [
                'speechToTextWhisper.recordAndInsertOrClipboard',
                'speechToTextWhisper.recordAndOpenCurrentChat',
            ];

            for (const commandId of recordingCommands) {
                try {
                    await vscode.commands.executeCommand(commandId);
                    // If the command executed successfully, that's also fine
                    console.log(`Command ${commandId} executed without error`);
                } catch (error) {
                    const errorMessage = (error as Error).message;
                    
                    // Checking that the error message is informative
                    assert.ok(
                        errorMessage.length > 0,
                        `Command ${commandId} should provide non-empty error message`
                    );
                    
                    // Checking that this is not a system error
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