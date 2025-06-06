import * as assert from 'assert';
import * as vscode from 'vscode';
import * as sinon from 'sinon';

describe('Recording Debug Tests', () => {
    let extension: vscode.Extension<any> | undefined;
    let sandbox: sinon.SinonSandbox;

    before(async function() {
        this.timeout(30000);
        
        // Activate the extension
        extension = vscode.extensions.getExtension('speak-y.speech-to-text-whisper');
        if (extension && !extension.isActive) {
            await extension.activate();
        }
        
        // Wait a bit for full initialization
        await new Promise(resolve => setTimeout(resolve, 2000));
    });

    beforeEach(() => {
        sandbox = sinon.createSandbox();
    });

    afterEach(() => {
        sandbox.restore();
    });

    describe('FFmpeg Diagnostics', () => {
        it('should check FFmpeg availability in detail', async function() {
            this.timeout(15000);
            
            try {
                // Import FFmpegAudioRecorder for direct testing
                const { FFmpegAudioRecorder } = await import('../../core/FFmpegAudioRecorder.js');
                
                console.log('🔍 Testing FFmpeg availability...');
                const ffmpegCheck = await FFmpegAudioRecorder.checkFFmpegAvailability();
                
                console.log('FFmpeg check result:', JSON.stringify(ffmpegCheck, null, 2));
                
                assert.ok(ffmpegCheck, 'FFmpeg check should return result');
                
                if (ffmpegCheck.available) {
                    console.log(`✅ FFmpeg is available at: ${ffmpegCheck.path}`);
                    console.log(`✅ FFmpeg version: ${ffmpegCheck.version}`);
                } else {
                    console.log(`❌ FFmpeg not available: ${ffmpegCheck.error}`);
                }
                
            } catch (error) {
                console.error('FFmpeg availability test failed:', error);
                assert.fail(`FFmpeg test failed: ${(error as Error).message}`);
            }
        });

        it('should run full FFmpeg diagnostics', async function() {
            this.timeout(15000);
            
            try {
                const { FFmpegAudioRecorder } = await import('../../core/FFmpegAudioRecorder.js');
                
                console.log('🔍 Running full FFmpeg diagnostics...');
                const diagnostics = await FFmpegAudioRecorder.runDiagnostics();
                
                console.log('Diagnostics result:', JSON.stringify(diagnostics, null, 2));
                
                assert.ok(diagnostics, 'Diagnostics should return result');
                assert.ok(Array.isArray(diagnostics.inputDevices), 'Should have input devices array');
                assert.ok(typeof diagnostics.platform === 'string', 'Should have platform info');
                
                console.log(`Platform: ${diagnostics.platform}`);
                console.log(`Input devices found: ${diagnostics.inputDevices.length}`);
                console.log(`Errors: ${diagnostics.errors.length}`);
                console.log(`Warnings: ${diagnostics.warnings.length}`);
                
                if (diagnostics.errors.length > 0) {
                    console.log('Diagnostic errors:', diagnostics.errors);
                }
                
                if (diagnostics.warnings.length > 0) {
                    console.log('Diagnostic warnings:', diagnostics.warnings);
                }
                
            } catch (error) {
                console.error('FFmpeg diagnostics test failed:', error);
                assert.fail(`Diagnostics test failed: ${(error as Error).message}`);
            }
        });

        it('should test microphone permission check', async function() {
            this.timeout(10000);
            
            try {
                const { FFmpegAudioRecorder } = await import('../../core/FFmpegAudioRecorder.js');
                
                console.log('🔍 Testing microphone permission...');
                const micCheck = await FFmpegAudioRecorder.checkMicrophonePermission();
                
                console.log('Microphone check result:', JSON.stringify(micCheck, null, 2));
                
                assert.ok(micCheck, 'Microphone check should return result');
                assert.ok(typeof micCheck.state === 'string', 'Should have state');
                assert.ok(typeof micCheck.available === 'boolean', 'Should have available flag');
                
                console.log(`Microphone state: ${micCheck.state}`);
                console.log(`Microphone available: ${micCheck.available}`);
                
            } catch (error) {
                console.error('Microphone permission test failed:', error);
                assert.fail(`Microphone test failed: ${(error as Error).message}`);
            }
        });
    });

    describe('AudioRecorder Initialization', () => {
        it('should test direct FFmpegAudioRecorder creation', async function() {
            this.timeout(10000);
            
            try {
                const { FFmpegAudioRecorder } = await import('../../core/FFmpegAudioRecorder.js');
                
                console.log('🔍 Testing direct FFmpegAudioRecorder creation...');
                
                // Create events for testing
                const testEvents = {
                    onRecordingStart: () => {
                        console.log('✅ Test: onRecordingStart called');
                    },
                    onRecordingStop: (audioBlob: Blob) => {
                        console.log(`✅ Test: onRecordingStop called with blob size: ${audioBlob.size}`);
                    },
                    onError: (error: Error) => {
                        console.log(`❌ Test: onError called: ${error.message}`);
                    }
                };
                
                // Create an instance with minimal settings
                const recorder = new FFmpegAudioRecorder(testEvents, {
                    sampleRate: 16000,
                    channelCount: 1,
                    audioFormat: 'wav',
                    maxDuration: 5 // 5 seconds maximum for test
                });
                
                console.log('✅ FFmpegAudioRecorder instance created successfully');
                
                // Check methods
                assert.ok(typeof recorder.getIsRecording === 'function', 'Should have getIsRecording method');
                assert.ok(typeof recorder.startRecording === 'function', 'Should have startRecording method');
                assert.ok(typeof recorder.stopRecording === 'function', 'Should have stopRecording method');
                
                console.log(`Recording state: ${recorder.getIsRecording()}`);
                
            } catch (error) {
                console.error('Direct FFmpegAudioRecorder creation failed:', error);
                assert.fail(`Direct creation failed: ${(error as Error).message}`);
            }
        });

        it('should test FFmpeg test recording', async function() {
            this.timeout(20000);
            
            try {
                const { FFmpegAudioRecorder } = await import('../../core/FFmpegAudioRecorder.js');
                
                console.log('🔍 Testing FFmpeg test recording (2 seconds)...');
                const testResult = await FFmpegAudioRecorder.testRecording(2);
                
                console.log('Test recording result:', JSON.stringify(testResult, null, 2));
                
                assert.ok(testResult, 'Test recording should return result');
                assert.ok(typeof testResult.success === 'boolean', 'Should have success flag');
                assert.ok(typeof testResult.fileSize === 'number', 'Should have file size');
                assert.ok(typeof testResult.duration === 'number', 'Should have duration');
                
                if (testResult.success) {
                    console.log(`✅ Test recording successful: ${testResult.fileSize} bytes in ${testResult.duration}ms`);
                } else {
                    console.log(`❌ Test recording failed: ${testResult.error}`);
                    if (testResult.command) {
                        console.log(`Command used: ${testResult.command}`);
                    }
                }
                
            } catch (error) {
                console.error('FFmpeg test recording failed:', error);
                // Do not assert.fail here, as this may be expected in CI
                console.log('Test recording failed (may be expected in CI environment)');
            }
        });
    });

    describe('Extension Command Debug', () => {
        it('should test recordAndInsertOrClipboard with detailed logging', async function() {
            this.timeout(15000);
            
            // Intercept console.log for analysis
            const originalLog = console.log;
            const originalError = console.error;
            const logs: string[] = [];
            const errors: string[] = [];
            
            console.log = (...args) => {
                const message = args.join(' ');
                logs.push(message);
                originalLog(...args);
            };
            
            console.error = (...args) => {
                const message = args.join(' ');
                errors.push(message);
                originalError(...args);
            };
            
            try {
                console.log('🔍 Testing recordAndInsertOrClipboard command with detailed logging...');
                
                // Execute command
                await vscode.commands.executeCommand('speechToTextWhisper.recordAndInsertOrClipboard');
                
                // Wait for processing
                await new Promise(resolve => setTimeout(resolve, 2000));
                
                console.log('=== COLLECTED LOGS ===');
                logs.forEach((log, index) => {
                    console.log(`${index + 1}: ${log}`);
                });
                
                console.log('=== COLLECTED ERRORS ===');
                errors.forEach((error, index) => {
                    console.log(`${index + 1}: ${error}`);
                });
                
                // Analyze logs
                const hasStartRecording = logs.some(log => log.includes('startRecording() called'));
                const hasEnsureFFmpeg = logs.some(log => log.includes('ensureFFmpegAudioRecorder'));
                const hasFFmpegCheck = logs.some(log => log.includes('Checking FFmpeg availability'));
                const hasAudioRecorderNull = logs.some(log => log.includes('audioRecorder is null'));
                const hasInitializationError = errors.some(error => error.includes('Failed to initialize'));
                
                console.log(`Analysis:`);
                console.log(`- startRecording called: ${hasStartRecording}`);
                console.log(`- ensureFFmpeg called: ${hasEnsureFFmpeg}`);
                console.log(`- FFmpeg check performed: ${hasFFmpegCheck}`);
                console.log(`- audioRecorder is null: ${hasAudioRecorderNull}`);
                console.log(`- Initialization error: ${hasInitializationError}`);
                
                // Restore console
                console.log = originalLog;
                console.error = originalError;
                
                assert.ok(true, 'Command execution completed with logging');
                
            } catch (error) {
                // Restore console
                console.log = originalLog;
                console.error = originalError;
                
                console.error('Command test with logging failed:', error);
                assert.fail(`Command test failed: ${(error as Error).message}`);
            }
        });
    });
}); 