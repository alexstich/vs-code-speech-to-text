import * as assert from 'assert';
import * as vscode from 'vscode';
import * as sinon from 'sinon';

describe('Silence Detection Integration Tests', () => {
    let extension: vscode.Extension<any> | undefined;
    let sandbox: sinon.SinonSandbox;
    
    // Test timeout
    const TEST_TIMEOUT = 15000;

    before(async function() {
        this.timeout(TEST_TIMEOUT);
        
        // Activate the extension
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
        it('should respect the silenceDetection=true setting in configuration', async function() {
            this.timeout(TEST_TIMEOUT);
            
            // Get configuration
            const config = vscode.workspace.getConfiguration('speechToTextWhisper');
            const originalSilenceDetection = config.get<boolean>('silenceDetection');
            const originalMaxRecordingDuration = config.get<number>('maxRecordingDuration');
            
            try {
                // Set silenceDetection to true
                await config.update('silenceDetection', true, vscode.ConfigurationTarget.Global);
                await config.update('maxRecordingDuration', 120, vscode.ConfigurationTarget.Global); // 2 minutes
                
                // Wait for configuration to apply
                await new Promise(resolve => setTimeout(resolve, 100));
                
                // Check that the setting applied
                const updatedConfig = vscode.workspace.getConfiguration('speechToTextWhisper');
                assert.strictEqual(updatedConfig.get<boolean>('silenceDetection'), true, 'silenceDetection should be true');
                assert.strictEqual(updatedConfig.get<number>('maxRecordingDuration'), 120, 'maxRecordingDuration should be 120');
                
                // Check that recording commands are available
                const commands = await vscode.commands.getCommands(true);
                const recordingCommands = [
                    'speechToTextWhisper.recordAndInsertOrClipboard',
                    'speechToTextWhisper.recordAndInsertToCurrentChat',
                ];
                
                recordingCommands.forEach(commandId => {
                    assert.ok(
                        commands.includes(commandId), 
                        `Command ${commandId} should be registered`
                    );
                });
                
            } finally {
                // Restore original settings
                if (originalSilenceDetection !== undefined) {
                    await config.update('silenceDetection', originalSilenceDetection, vscode.ConfigurationTarget.Global);
                }
                if (originalMaxRecordingDuration !== undefined) {
                    await config.update('maxRecordingDuration', originalMaxRecordingDuration, vscode.ConfigurationTarget.Global);
                }
            }
        });

        it('should respect the silenceDetection=false setting in configuration', async function() {
            this.timeout(TEST_TIMEOUT);
            
            const config = vscode.workspace.getConfiguration('speechToTextWhisper');
            const originalSilenceDetection = config.get<boolean>('silenceDetection');
            const originalMaxRecordingDuration = config.get<number>('maxRecordingDuration');
            
            try {
                // Set silenceDetection to false
                await config.update('silenceDetection', false, vscode.ConfigurationTarget.Global);
                await config.update('maxRecordingDuration', 30, vscode.ConfigurationTarget.Global); // 30 seconds
                
                // Wait for configuration to apply
                await new Promise(resolve => setTimeout(resolve, 100));
                
                // Check that the setting applied
                const updatedConfig = vscode.workspace.getConfiguration('speechToTextWhisper');
                assert.strictEqual(updatedConfig.get<boolean>('silenceDetection'), false, 'silenceDetection should be false');
                assert.strictEqual(updatedConfig.get<number>('maxRecordingDuration'), 30, 'maxRecordingDuration should be 30');
                
                // Check that recording commands are available
                const commands = await vscode.commands.getCommands(true);
                const recordingCommands = [
                    'speechToTextWhisper.recordAndInsertOrClipboard',
                    'speechToTextWhisper.recordAndInsertToCurrentChat', 
                ];
                
                recordingCommands.forEach(commandId => {
                    assert.ok(
                        commands.includes(commandId), 
                        `Command ${commandId} should be registered`
                    );
                });
                
            } finally {
                // Restore original settings
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
        it('should handle recording commands with silenceDetection=true without errors', async function() {
            this.timeout(TEST_TIMEOUT);
            
            const config = vscode.workspace.getConfiguration('speechToTextWhisper');
            const originalSilenceDetection = config.get<boolean>('silenceDetection');
            
            // Mute messages for the test
            const showInfoStub = sandbox.stub(vscode.window, 'showInformationMessage');
            const showErrorStub = sandbox.stub(vscode.window, 'showErrorMessage');
            
            try {
                // Set silenceDetection to true
                await config.update('silenceDetection', true, vscode.ConfigurationTarget.Global);
                await new Promise(resolve => setTimeout(resolve, 100));
                
                // Attempt to execute recording command
                await vscode.commands.executeCommand('speechToTextWhisper.recordAndInsertOrClipboard');
                
                // In the test environment, the command might fail (no microphone/FFmpeg),
                // but it's important that it doesn't crash with a critical error
                const errorCalls = showErrorStub.getCalls();
                const infoCalls = showInfoStub.getCalls();
                
                // Should show some message (success or error)
                assert.ok(
                    errorCalls.length > 0 || infoCalls.length > 0,
                    'Should show a message to the user'
                );
                
                // If there are errors, they should be understandable
                if (errorCalls.length > 0) {
                    const errorMessage = errorCalls[0].args[0];
                    assert.ok(
                        typeof errorMessage === 'string' && errorMessage.length > 0,
                        'Error message should be a non-empty string'
                    );
                }
                
            } finally {
                // Restore original setting
                if (originalSilenceDetection !== undefined) {
                    await config.update('silenceDetection', originalSilenceDetection, vscode.ConfigurationTarget.Global);
                }
            }
        });

        it('should handle recording commands with silenceDetection=false without errors', async function() {
            this.timeout(TEST_TIMEOUT);
            
            const config = vscode.workspace.getConfiguration('speechToTextWhisper');
            const originalSilenceDetection = config.get<boolean>('silenceDetection');
            
            // Mute messages for the test
            const showInfoStub = sandbox.stub(vscode.window, 'showInformationMessage');
            const showErrorStub = sandbox.stub(vscode.window, 'showErrorMessage');
            
            try {
                // Set silenceDetection to false
                await config.update('silenceDetection', false, vscode.ConfigurationTarget.Global);
                await new Promise(resolve => setTimeout(resolve, 100));
                
                // Attempt to execute recording command
                await vscode.commands.executeCommand('speechToTextWhisper.recordAndInsertOrClipboard');
                
                // In the test environment, the command might fail (no microphone/FFmpeg),
                // but it's important that it doesn't crash with a critical error
                const errorCalls = showErrorStub.getCalls();
                const infoCalls = showInfoStub.getCalls();
                
                // Should show some message (success or error)
                assert.ok(
                    errorCalls.length > 0 || infoCalls.length > 0,
                    'Should show a message to the user'
                );
                
                // If there are errors, they should be understandable
                if (errorCalls.length > 0) {
                    const errorMessage = errorCalls[0].args[0];
                    assert.ok(
                        typeof errorMessage === 'string' && errorMessage.length > 0,
                        'Error message should be a non-empty string'
                    );
                }
                
            } finally {
                // Restore original setting
                if (originalSilenceDetection !== undefined) {
                    await config.update('silenceDetection', originalSilenceDetection, vscode.ConfigurationTarget.Global);
                }
            }
        });
    });

    describe('Configuration Validation', () => {
        it('should correctly validate various combinations of silence detection settings', async function() {
            this.timeout(TEST_TIMEOUT);
            
            const config = vscode.workspace.getConfiguration('speechToTextWhisper');
            
            // Save original values
            const originalValues = {
                silenceDetection: config.get<boolean>('silenceDetection'),
                silenceDuration: config.get<number>('silenceDuration'),
                silenceThreshold: config.get<number>('silenceThreshold'),
                maxRecordingDuration: config.get<number>('maxRecordingDuration')
            };
            
            try {
                // Test various valid combinations
                const validCombinations = [
                    {
                        name: 'Full silence detection settings',
                        settings: {
                            silenceDetection: true,
                            silenceDuration: 5,
                            silenceThreshold: 30,
                            maxRecordingDuration: 120
                        }
                    },
                    {
                        name: 'Silence detection off',
                        settings: {
                            silenceDetection: false,
                            maxRecordingDuration: 60
                        }
                    },
                    {
                        name: 'Minimum settings',
                        settings: {
                            silenceDetection: true,
                            silenceDuration: 1,
                            silenceThreshold: 20,
                            maxRecordingDuration: 5
                        }
                    },
                    {
                        name: 'Maximum settings',
                        settings: {
                            silenceDetection: true,
                            silenceDuration: 10,
                            silenceThreshold: 80,
                            maxRecordingDuration: 300
                        }
                    }
                ];
                
                for (const combination of validCombinations) {
                    console.log(`Testing combination: ${combination.name}`);
                    
                    // Apply settings
                    for (const [key, value] of Object.entries(combination.settings)) {
                        await config.update(key, value, vscode.ConfigurationTarget.Global);
                    }
                    
                    // Wait for settings to apply
                    await new Promise(resolve => setTimeout(resolve, 50));
                    
                    // Check that settings applied
                    const updatedConfig = vscode.workspace.getConfiguration('speechToTextWhisper');
                    for (const [key, expectedValue] of Object.entries(combination.settings)) {
                        const actualValue = updatedConfig.get(key);
                        assert.strictEqual(
                            actualValue, 
                            expectedValue, 
                            `Setting ${key} should be ${expectedValue} for combination: ${combination.name}`
                        );
                    }
                    
                    // Check that commands are available (which means configuration is valid)
                    const commands = await vscode.commands.getCommands(true);
                    assert.ok(
                        commands.includes('speechToTextWhisper.recordAndInsertOrClipboard'),
                        `Commands should be available for combination: ${combination.name}`
                    );
                }
                
            } finally {
                // Restore all original values
                for (const [key, value] of Object.entries(originalValues)) {
                    if (value !== undefined) {
                        await config.update(key, value, vscode.ConfigurationTarget.Global);
                    }
                }
            }
        });
    });

    describe('Error Handling with Different Silence Detection Settings', () => {
        it('should correctly handle errors independently of silenceDetection setting', async function() {
            this.timeout(TEST_TIMEOUT);
            
            const config = vscode.workspace.getConfiguration('speechToTextWhisper');
            const originalSilenceDetection = config.get<boolean>('silenceDetection');
            
            // Mute error messages
            const showErrorStub = sandbox.stub(vscode.window, 'showErrorMessage');
            
            try {
                // Test with silence detection enabled
                await config.update('silenceDetection', true, vscode.ConfigurationTarget.Global);
                await new Promise(resolve => setTimeout(resolve, 50));
                
                try {
                    await vscode.commands.executeCommand('speechToTextWhisper.recordAndInsertOrClipboard');
                } catch (error) {
                    // Expected error in test environment
                    console.log('Expected error with silenceDetection=true:', (error as Error).message);
                }
                
                // Test with silence detection disabled
                await config.update('silenceDetection', false, vscode.ConfigurationTarget.Global);
                await new Promise(resolve => setTimeout(resolve, 50));
                
                try {
                    await vscode.commands.executeCommand('speechToTextWhisper.recordAndInsertOrClipboard');
                } catch (error) {
                    // Expected error in test environment
                    console.log('Expected error with silenceDetection=false:', (error as Error).message);
                }
                
                // Check that error handling works correctly
                // (in test environment, usually no access to microphone/FFmpeg)
                console.log(`Shown error messages: ${showErrorStub.callCount}`);
                
                // Check that if there were errors, they have meaningful messages
                showErrorStub.getCalls().forEach((call, index) => {
                    const errorMessage = call.args[0];
                    assert.ok(
                        typeof errorMessage === 'string' && errorMessage.length > 0,
                        `Error message ${index + 1} should be a non-empty string`
                    );
                });
                
            } finally {
                // Restore original setting
                if (originalSilenceDetection !== undefined) {
                    await config.update('silenceDetection', originalSilenceDetection, vscode.ConfigurationTarget.Global);
                }
            }
        });
    });
}); 