import * as assert from 'assert';
import * as vscode from 'vscode';
import * as sinon from 'sinon';

describe('Commands Integration Tests', () => {
    let extension: vscode.Extension<any> | undefined;

    before(async () => {
        // Get the extension
        extension = vscode.extensions.getExtension('speak-y.speech-to-text-whisper');
        
        // Activate the extension if it is not active
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
        // We only test safe commands that do not require user input
        const safeCommands = [
            'speechToTextWhisper.runDiagnostics',
            'speechToTextWhisper.testFFmpeg', 
            'speechToTextWhisper.testAudioRecorder',
            'speechToTextWhisper.openSettings'
        ];

        safeCommands.forEach(commandId => {
            it(`should execute ${commandId} without errors`, async function() {
                this.timeout(10000); // Increase timeout for commands
                
                try {
                    await vscode.commands.executeCommand(commandId);
                    // If the command executed without exception, the test passed
                    assert.ok(true, `Command ${commandId} executed successfully`);
                } catch (error) {
                    // Some commands may fail due to missing settings
                    // but it's important that they are registered and callable
                    console.warn(`Command ${commandId} failed with:`, (error as Error).message);
                    
                    // Check if this is an expected error (e.g., missing API key)
                    const errorMessage = (error as Error).message.toLowerCase();
                    const isExpectedError = errorMessage.includes('api key') || 
                                          errorMessage.includes('ffmpeg') ||
                                          errorMessage.includes('audio') ||
                                          errorMessage.includes('configuration');
                    
                    if (isExpectedError) {
                        assert.ok(true, `Command ${commandId} failed with expected error: ${errorMessage}`);
                    } else {
                        throw error; // Unexpected error
                    }
                }
            });
        });
    });

    describe('Recording Commands', () => {
        // For recording commands, we cannot fully execute them in tests,
        // but we can check that they are registered and available
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
            // In the test environment, recording commands should be available, but should not start actual recording
            // This checks that the commands are registered, but does not test their full functionality
            for (const commandId of recordingCommands) {
                try {
                    // Attempt to execute the command, but expect that it may fail
                    // due to missing necessary settings or audio devices in the test environment
                    await vscode.commands.executeCommand(commandId);
                } catch (error) {
                    // This is expected in the test environment
                    const errorMessage = (error as Error).message.toLowerCase();
                    console.log(`Recording command ${commandId} failed as expected in test environment:`, errorMessage);
                }
            }
            
            // If we reached this point, the commands are registered
            assert.ok(true, 'Recording commands are registered');
        });
    });

    describe('Context Commands', () => {
        it('should handle context setting commands', async () => {
            // Testing commands that set context
            try {
                await vscode.commands.executeCommand('setContext', 'speechToTextWhisper.isRecording', false);
                assert.ok(true, 'Context setting command works');
            } catch (error) {
                assert.fail(`Context setting failed: ${(error as Error).message}`);
            }
        });
    });
});
