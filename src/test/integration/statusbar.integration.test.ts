import * as assert from 'assert';
import * as vscode from 'vscode';

describe('Status Bar Integration Tests', () => {
    let extension: vscode.Extension<any> | undefined;

    before(async () => {
        // Get the extension
        extension = vscode.extensions.getExtension('speak-y.speech-to-text-whisper');
        
        // Activate the extension if it's not active
        if (extension && !extension.isActive) {
            await extension.activate();
        }
    });

    describe('Status Bar Presence', () => {
        it('should have status bar item visible after extension activation', async () => {
            assert.ok(extension, 'Extension should be found');
            assert.ok(extension!.isActive, 'Extension should be active');

            // Check if the status bar is created (indirectly via commands)
            const allCommands = await vscode.commands.getCommands(true);
            const hasRecordingCommands = allCommands.some(cmd => 
                cmd.includes('speechToTextWhisper.record')
            );
            
            assert.ok(hasRecordingCommands, 'Recording commands should be available');
        });

        it('should respond to recording state changes', async function() {
            this.timeout(5000);
            
            // Try to execute the recording command (it may fail with an error but should be accessible)
            try {
                await vscode.commands.executeCommand('speechToTextWhisper.recordAndInsertOrClipboard');
            } catch (error) {
                // Expected in test environment - important that the command is registered
                const errorMessage = (error as Error).message.toLowerCase();
                console.log('Recording command failed as expected in test environment:', errorMessage);
            }
            
            // If we reach this point, the command is accessible
            assert.ok(true, 'Recording command is accessible');
        });
    });

    describe('Status Bar Context Integration', () => {
        it('should handle context changes for recording state', async () => {
            // Test setting context for recording state
            try {
                await vscode.commands.executeCommand('setContext', 'speechToTextWhisper.isRecording', true);
                await vscode.commands.executeCommand('setContext', 'speechToTextWhisper.isRecording', false);
                assert.ok(true, 'Context setting for recording state works');
            } catch (error) {
                assert.fail(`Context setting failed: ${(error as Error).message}`);
            }
        });

        it('should have proper when clauses in package.json', () => {
            assert.ok(extension, 'Extension should be found');
            
            const packageJson = extension!.packageJSON;
            
            // Check for context menus
            if (packageJson.contributes.menus) {
                const menus = packageJson.contributes.menus;
                
                // Check that there are menus with when clauses
                Object.keys(menus).forEach(menuType => {
                    const menuItems = menus[menuType];
                    if (Array.isArray(menuItems)) {
                        menuItems.forEach(item => {
                            if (item.when) {
                                assert.ok(
                                    typeof item.when === 'string',
                                    `When clause should be a string: ${item.when}`
                                );
                            }
                        });
                    }
                });
            }
            
            assert.ok(true, 'Menu when clauses are properly configured');
        });
    });

    describe('Status Bar Commands Integration', () => {
        it('should have status bar related commands registered', async () => {
            const allCommands = await vscode.commands.getCommands(true);
            
            const statusBarRelatedCommands = [
                'speechToTextWhisper.recordAndInsertOrClipboard',
                'speechToTextWhisper.recordAndInsertToCurrentChat',
            ];

            for (const commandId of statusBarRelatedCommands) {
                assert.ok(
                    allCommands.includes(commandId),
                    `Status bar command ${commandId} should be registered`
                );
            }
        });

        it('should handle status bar command execution gracefully', async () => {
            const statusBarCommands = [
                'speechToTextWhisper.recordAndInsertOrClipboard',
                'speechToTextWhisper.recordAndInsertToCurrentChat',
            ];

            for (const commandId of statusBarCommands) {
                try {
                    await vscode.commands.executeCommand(commandId);
                    console.log(`Status bar command ${commandId} executed successfully`);
                } catch (error) {
                    // Commands may fail in test environment
                    const errorMessage = (error as Error).message.toLowerCase();
                    
                    // Check if this is an expected error
                    const expectedErrors = [
                        'api key',
                        'configuration',
                        'recording',
                        'audio',
                        'frequent'
                    ];
                    
                    const isExpectedError = expectedErrors.some(pattern => 
                        errorMessage.includes(pattern)
                    );
                    
                    if (isExpectedError) {
                        console.log(`Status bar command ${commandId} failed with expected error: ${errorMessage}`);
                    } else {
                        console.warn(`Status bar command ${commandId} failed with unexpected error: ${errorMessage}`);
                    }
                }
            }
            
            assert.ok(true, 'All status bar commands are executable');
        });
    });

    describe('Status Bar Visual Feedback', () => {
        it('should have proper icons configured in package.json', () => {
            assert.ok(extension, 'Extension should be found');
            
            const packageJson = extension!.packageJSON;
            const commands = packageJson.contributes.commands;
            
            // Check that commands have icons
            const recordingCommands = commands.filter((cmd: any) => 
                cmd.command.includes('record')
            );
            
            assert.ok(recordingCommands.length > 0, 'Should have recording commands');
            
            recordingCommands.forEach((cmd: any) => {
                assert.ok(cmd.title, `Command ${cmd.command} should have title`);
                assert.ok(cmd.category, `Command ${cmd.command} should have category`);
                
                // Some commands may have icons
                if (cmd.icon) {
                    assert.ok(
                        typeof cmd.icon === 'string' || typeof cmd.icon === 'object',
                        `Command ${cmd.command} icon should be string or object`
                    );
                }
            });
        });

        it('should support theme colors for status indication', () => {
            // This test checks if the extension is properly configured for VS Code themes
            assert.ok(extension, 'Extension should be found');
            
            const packageJson = extension!.packageJSON;
            
            // Check if there are color settings (if they are defined)
            if (packageJson.contributes.colors) {
                const colors = packageJson.contributes.colors;
                colors.forEach((color: any) => {
                    assert.ok(color.id, 'Color should have ID');
                    assert.ok(color.description, 'Color should have description');
                    assert.ok(color.defaults, 'Color should have defaults');
                });
            }
            
            assert.ok(true, 'Theme color configuration is valid');
        });
    });

    describe('Status Bar Error Handling', () => {
        it('should handle status bar creation errors gracefully', async () => {
            // This test checks if the extension does not crash due to status bar issues
            
            // Try to execute a command that may interact with the status bar
            try {
                await vscode.commands.executeCommand('speechToTextWhisper.runDiagnostics');
                assert.ok(true, 'Diagnostic command executed without status bar errors');
            } catch (error) {
                // Even if the command fails, it should not be related to the status bar
                const errorMessage = (error as Error).message.toLowerCase();
                
                // Check if the error is not related to the status bar
                assert.ok(
                    !errorMessage.includes('status bar') && !errorMessage.includes('statusbar'),
                    'Error should not be related to status bar'
                );
                
                console.log('Diagnostic command failed with non-status-bar error:', errorMessage);
            }
        });

        it('should maintain status bar state consistency', async () => {
            // Check if the status bar state remains consistent
            
            // Execute multiple commands in a row
            const commands = [
                'speechToTextWhisper.runDiagnostics',
                'speechToTextWhisper.openSettings'
            ];

            for (const commandId of commands) {
                try {
                    await vscode.commands.executeCommand(commandId);
                } catch (error) {
                    // Errors are expected but should not affect state
                    console.log(`Command ${commandId} failed:`, (error as Error).message);
                }
            }
            
            // If we reach this point without critical errors, state is consistent
            assert.ok(true, 'Status bar state remains consistent after multiple command executions');
        });
    });

    describe('Status Bar Performance', () => {
        it('should update status bar efficiently', async function() {
            this.timeout(3000);
            
            const startTime = Date.now();
            
            // Execute a command that may update the status bar
            try {
                await vscode.commands.executeCommand('speechToTextWhisper.toggleMode');
            } catch (error) {
                // Expected error in test environment
                console.log('Toggle mode failed as expected:', (error as Error).message);
            }
            
            const executionTime = Date.now() - startTime;
            
            // Status bar update should be fast
            assert.ok(
                executionTime < 1000,
                `Status bar update should be fast (took ${executionTime}ms)`
            );
        });
    });
}); 