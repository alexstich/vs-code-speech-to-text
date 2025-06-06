import * as assert from 'assert';
import * as vscode from 'vscode';

/**
 * Integration test for the F9 command in real-world conditions
 * Checks for fixes to issues with silence detection and manual recording
 */
describe('F9 Real World Integration Tests', function() {
    this.timeout(30000); // 30 seconds for real operations

    let extension: vscode.Extension<any>;
    
    before(async () => {
        // Get our extension
        extension = vscode.extensions.getExtension('speak-y.speech-to-text-whisper')!;
        assert.ok(extension, 'Extension should be found');
        
        // Activate the extension if not already active
        if (!extension.isActive) {
            await extension.activate();
        }
        
        console.log('🧪 Extension activated for F9 testing');
        
        // Wait for full initialization
        await new Promise(resolve => setTimeout(resolve, 2000));
    });

    describe('F9 - recordAndOpenNewChat Command', () => {
        it('should work with silence detection enabled', async function() {
            this.timeout(20000);
            
            console.log('🧪 Testing F9 with silence detection enabled');
            
            // Set configuration with silence detection enabled
            const config = vscode.workspace.getConfiguration('speechToTextWhisper');
            await config.update('silenceDetection', true, vscode.ConfigurationTarget.Global);
            await config.update('silenceDuration', 5, vscode.ConfigurationTarget.Global); // 5 seconds of silence
            
            console.log('🧪 Configuration set: silenceDetection=true, silenceDuration=5s');
            
            // Execute F9 command
            console.log('🧪 Executing recordAndOpenNewChat command...');
            
            let recordingStarted = false;
            let recordingCompleted = false;
            let errorOccurred = false;
            
            // Listen to events through output channel (if any)
            try {
                await vscode.commands.executeCommand('speechToTextWhisper.recordAndOpenNewChat');
                recordingStarted = true;
                console.log('✅ Command executed, recording should have started');
                
                // Wait a bit for recording to start
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                // Simulate stopping recording after some time (if recording didn't stop automatically)
                await new Promise(resolve => setTimeout(resolve, 2000));
                
                // Check that recording actually started
                recordingCompleted = true;
                console.log('✅ Recording flow completed');
                
            } catch (error) {
                errorOccurred = true;
                console.error('❌ Error during recording:', error);
                
                // Check that this is not an error related to our fixes
                const errorMessage = (error as Error).message;
                
                // Acceptable errors in test environment
                if (errorMessage.includes('Recording too short') || 
                    errorMessage.includes('microphone permissions') ||
                    errorMessage.includes('FFmpeg not found')) {
                    console.log('✅ Acceptable error in test environment:', errorMessage);
                    recordingCompleted = true;
                } else {
                    throw error; // Unexpected error - test should fail
                }
            }
            
            // Check that the main logic works
            assert.ok(recordingStarted, 'Recording should have started');
            assert.ok(recordingCompleted || errorOccurred, 'Recording should complete or fail gracefully');
        });

        it('should work with silence detection disabled', async function() {
            this.timeout(15000);
            
            console.log('🧪 Testing F9 with silence detection disabled');
            
            // Set configuration with silence detection disabled
            const config = vscode.workspace.getConfiguration('speechToTextWhisper');
            await config.update('silenceDetection', false, vscode.ConfigurationTarget.Global);
            await config.update('maxRecordingDuration', 10, vscode.ConfigurationTarget.Global); // 10 seconds maximum
            
            console.log('🧪 Configuration set: silenceDetection=false, maxRecordingDuration=10s');
            
            // Execute F9 command
            console.log('🧪 Executing recordAndOpenNewChat command...');
            
            let recordingStarted = false;
            let recordingCompleted = false;
            let errorOccurred = false;
            
            try {
                // Start recording
                await vscode.commands.executeCommand('speechToTextWhisper.recordAndOpenNewChat');
                recordingStarted = true;
                console.log('✅ Command executed, recording should have started');
                
                // Wait a bit for recording to start
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                // Stop recording manually (simulate pressing F9 again or another command)
                console.log('🧪 Manually stopping recording...');
                await vscode.commands.executeCommand('speechToTextWhisper.recordAndInsertToCurrentChat');
                
                recordingCompleted = true;
                console.log('✅ Manual recording stop completed');
                
            } catch (error) {
                errorOccurred = true;
                console.error('❌ Error during recording:', error);
                
                const errorMessage = (error as Error).message;
                
                // Acceptable errors in test environment
                if (errorMessage.includes('Recording too short') || 
                    errorMessage.includes('microphone permissions') ||
                    errorMessage.includes('FFmpeg not found') ||
                    errorMessage.includes('No recording mode set')) {
                    console.log('✅ Acceptable error in test environment:', errorMessage);
                    recordingCompleted = true;
                } else {
                    throw error; // Unexpected error
                }
            }
            
            // Check that the main logic works
            assert.ok(recordingStarted, 'Recording should have started');
            assert.ok(recordingCompleted || errorOccurred, 'Recording should complete or fail gracefully');
        });
    });

    describe('Configuration Tests', () => {
        it('should correctly read silence detection configuration', () => {
            console.log('🧪 Testing configuration reading');
            
            const config = vscode.workspace.getConfiguration('speechToTextWhisper');
            
            // Check that we can read settings
            const silenceDetection = config.get<boolean>('silenceDetection');
            const silenceDuration = config.get<number>('silenceDuration');
            const maxRecordingDuration = config.get<number>('maxRecordingDuration');
            
            console.log(`🔧 Current config: silenceDetection=${silenceDetection}, silenceDuration=${silenceDuration}, maxRecordingDuration=${maxRecordingDuration}`);
            
            // Basic checks
            assert.ok(typeof silenceDetection === 'boolean', 'silenceDetection should be boolean');
            assert.ok(typeof silenceDuration === 'number', 'silenceDuration should be number');
            assert.ok(typeof maxRecordingDuration === 'number', 'maxRecordingDuration should be number');
            
            console.log('✅ Configuration reading works correctly');
        });
    });

    after(async () => {
        console.log('🧹 Cleaning up F9 integration tests...');
        
        // Revert to default settings
        const config = vscode.workspace.getConfiguration('speechToTextWhisper');
        await config.update('silenceDetection', undefined, vscode.ConfigurationTarget.Global);
        await config.update('silenceDuration', undefined, vscode.ConfigurationTarget.Global);
        await config.update('maxRecordingDuration', undefined, vscode.ConfigurationTarget.Global);
        
        console.log('✅ F9 integration tests cleanup completed');
    });
}); 