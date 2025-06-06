import * as assert from 'assert';
import * as sinon from 'sinon';
import { spawn } from 'child_process';
import { EventEmitter } from 'events';
import { FFmpegAudioRecorder, AudioRecorderEvents, AudioRecordingOptions } from '../../core/FFmpegAudioRecorder.js';

describe('FFmpegAudioRecorder - Timer Cleanup and Recording Lifecycle Tests', () => {
    let sandbox: sinon.SinonSandbox;
    let mockEvents: AudioRecorderEvents;
    let recorder: FFmpegAudioRecorder;
    let mockChildProcess: any;
    let onRecordingStartSpy: sinon.SinonSpy;
    let onRecordingStopSpy: sinon.SinonSpy;
    let onErrorSpy: sinon.SinonSpy;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
        
        // Creating spies for events
        onRecordingStartSpy = sandbox.spy();
        onRecordingStopSpy = sandbox.spy();
        onErrorSpy = sandbox.spy();
        
        // Mocking events
        mockEvents = {
            onRecordingStart: onRecordingStartSpy,
            onRecordingStop: onRecordingStopSpy,
            onError: onErrorSpy
        };

        // Mocking child process for FFmpeg emulation
        mockChildProcess = new EventEmitter();
        mockChildProcess.killed = false;
        mockChildProcess.stdout = new EventEmitter();
        mockChildProcess.stderr = new EventEmitter();
        mockChildProcess.kill = sandbox.stub().callsFake((signal: string) => {
            console.log(`Mock process kill called with signal: ${signal}`);
            mockChildProcess.killed = true;
            // Emulating process completion
            setTimeout(() => {
                console.log('Mock process emitting close event');
                mockChildProcess.emit('close', signal === 'SIGTERM' ? 0 : 255);
            }, 50);
        });
        
        // Mocking spawn
        sandbox.stub(require('child_process'), 'spawn').returns(mockChildProcess);
        
        // Mocking FFmpeg availability
        sandbox.stub(FFmpegAudioRecorder, 'checkFFmpegAvailability').resolves({
            available: true,
            version: '4.4.0',
            path: '/usr/local/bin/ffmpeg'
        });
        
        // Mocking detectInputDevices
        sandbox.stub(FFmpegAudioRecorder, 'detectInputDevices').resolves([
            { id: ':0', name: 'Built-in Microphone', isDefault: true }
        ]);
    });

    afterEach(() => {
        if (recorder) {
            try {
                recorder.stopRecording();
            } catch (error) {
                // Ignoring errors during cleanup
            }
        }
        sandbox.restore();
    });

    describe('Timer Cleanup - The Critical Bug That Tests Should Catch', () => {
        it('should call clearSilenceTimer() and clearMaxDurationTimer() when silenceDetection=false', async () => {
            console.log('🧪 Starting test: timer cleanup with silenceDetection=false');
            
            const options: AudioRecordingOptions = {
                silenceDetection: false,  // CRITICAL: disabled
                maxDuration: 2,           // Short recording
                silenceDuration: 1        // Should not affect
            };

            recorder = new FFmpegAudioRecorder(mockEvents, options);
            
            // Spy on cleanup methods through private access
            const recorderAny = recorder as any;
            const clearSilenceTimerSpy = sandbox.spy(recorderAny, 'clearSilenceTimer');
            const clearMaxDurationTimerSpy = sandbox.spy(recorderAny, 'clearMaxDurationTimer');
            const setupSilenceDetectionSpy = sandbox.spy(recorderAny, 'setupSilenceDetection');

            console.log('🧪 Starting recording...');
            
            try {
                await recorder.startRecording();
            } catch (error) {
                // Expecting error due to missing file system in tests, but we are interested in timer logic
                console.log('Expected error in test environment:', (error as Error).message);
            }
            
            // Checking that setupSilenceDetection was called
            assert.ok(setupSilenceDetectionSpy.calledOnce, 'setupSilenceDetection should be called during initialization');
            
            console.log(`📊 setupSilenceDetection called: ${setupSilenceDetectionSpy.callCount}`);
            
            // Forcibly calling stopRecording to check timer cleanup
            recorder.stopRecording();
            
            console.log(`📊 clearSilenceTimer called after stopRecording: ${clearSilenceTimerSpy.callCount}`);
            console.log(`📊 clearMaxDurationTimer called after stopRecording: ${clearMaxDurationTimerSpy.callCount}`);
            
            // CRITICAL CHECK: clearSilenceTimer should be called when stopping
            assert.ok(clearSilenceTimerSpy.called, 'clearSilenceTimer should be called when stopping recording');
            assert.ok(clearMaxDurationTimerSpy.called, 'clearMaxDurationTimer should be called when stopping recording');
            
            console.log('✅ Test passed: timers properly cleared with silenceDetection=false');
        });

        it('should call clearSilenceTimer() and clearMaxDurationTimer() when silenceDetection=true', async () => {
            console.log('🧪 Starting test: timer cleanup with silenceDetection=true');
            
            const options: AudioRecordingOptions = {
                silenceDetection: true,   // Enabled
                maxDuration: 10,          // Large value
                silenceDuration: 1        // Fast trigger
            };

            recorder = new FFmpegAudioRecorder(mockEvents, options);
            
            // Spy on cleanup methods
            const recorderAny = recorder as any;
            const clearSilenceTimerSpy = sandbox.spy(recorderAny, 'clearSilenceTimer');
            const clearMaxDurationTimerSpy = sandbox.spy(recorderAny, 'clearMaxDurationTimer');
            const setupSilenceDetectionSpy = sandbox.spy(recorderAny, 'setupSilenceDetection');

            console.log('🧪 Starting recording...');
            
            try {
                await recorder.startRecording();
            } catch (error) {
                // Expecting error due to missing file system in tests
                console.log('Expected error in test environment:', (error as Error).message);
            }
            
            // Checking that setupSilenceDetection was called
            assert.ok(setupSilenceDetectionSpy.calledOnce, 'setupSilenceDetection should be called');
            
            // Forcibly calling stopRecording
            recorder.stopRecording();
            
            console.log(`📊 clearSilenceTimer called: ${clearSilenceTimerSpy.callCount}`);
            console.log(`📊 clearMaxDurationTimer called: ${clearMaxDurationTimerSpy.callCount}`);
            
            // Checks similar to the previous test
            assert.ok(clearSilenceTimerSpy.called, 'clearSilenceTimer should be called');
            assert.ok(clearMaxDurationTimerSpy.called, 'clearMaxDurationTimer should be called');
            
            console.log('✅ Test passed: timers properly cleared with silenceDetection=true');
        });

        it('should correctly set up silence detection based on the option', () => {
            console.log('🧪 Starting test: silence detection setup logic');
            
            // Test 1: silenceDetection = false
            const optionsDisabled: AudioRecordingOptions = {
                silenceDetection: false,
                maxDuration: 60
            };

            const recorderDisabled = new FFmpegAudioRecorder(mockEvents, optionsDisabled);
            const recorderDisabledAny = recorderDisabled as any;
            
            // Spy on setupSilenceDetection
            const setupSilenceDetectionSpyDisabled = sandbox.spy(recorderDisabledAny, 'setupSilenceDetection');
            
            // Calling setupSilenceDetection directly to check the logic
            recorderDisabledAny.setupSilenceDetection();
            
            assert.ok(setupSilenceDetectionSpyDisabled.calledOnce, 'setupSilenceDetection should be called');
            
            // Checking that silenceDetectionEnabled remains false when silenceDetection=false
            assert.strictEqual(recorderDisabledAny.silenceDetectionEnabled, false, 'silenceDetectionEnabled should be false when silenceDetection=false');
            
            // Test 2: silenceDetection = true
            const optionsEnabled: AudioRecordingOptions = {
                silenceDetection: true,
                maxDuration: 60,
                silenceDuration: 3
            };

            const recorderEnabled = new FFmpegAudioRecorder(mockEvents, optionsEnabled);
            const recorderEnabledAny = recorderEnabled as any;
            
            // Spy on setupSilenceDetection
            const setupSilenceDetectionSpyEnabled = sandbox.spy(recorderEnabledAny, 'setupSilenceDetection');
            
            // Calling setupSilenceDetection directly
            recorderEnabledAny.setupSilenceDetection();
            
            assert.ok(setupSilenceDetectionSpyEnabled.calledOnce, 'setupSilenceDetection should be called');
            
            // Checking that silenceDetectionEnabled becomes true when silenceDetection=true
            assert.strictEqual(recorderEnabledAny.silenceDetectionEnabled, true, 'silenceDetectionEnabled should be true when silenceDetection=true');
            
            console.log('✅ Test passed: silence detection setup logic works correctly');
        });

        it('should correctly use the new default value maxDuration=3600', () => {
            console.log('🧪 Starting test: new default value maxDuration=3600');
            
            const options: AudioRecordingOptions = {
                silenceDetection: false,
                maxDuration: 3600  // New default value (1 hour)
            };

            recorder = new FFmpegAudioRecorder(mockEvents, options);
            
            // Mocking buildFFmpegArgs to check arguments
            const recorderAny = recorder as any;
            const buildArgsSpy = sandbox.spy(recorderAny, 'buildFFmpegArgs');
            
            // Calling buildFFmpegArgs directly for checking
            const ffmpegArgs = recorderAny.buildFFmpegArgs('/tmp/test.wav', ':0');
            
            // Checking that buildFFmpegArgs returned the correct arguments
            assert.ok(Array.isArray(ffmpegArgs), 'Should return an array of arguments');
            
            const tIndex = ffmpegArgs.indexOf('-t');
            assert.ok(tIndex !== -1, 'Should contain -t argument for maxDuration');
            assert.strictEqual(ffmpegArgs[tIndex + 1], '3600', 'Should use 3600 seconds value');
            
            console.log(`✅ Test passed: FFmpeg uses -t 3600 (${ffmpegArgs[tIndex + 1]} seconds)`);
        });
    });

    describe('Regression Tests - Specific Bug Scenarios', () => {
        it('should correctly handle isRecording state regardless of silenceDetection', () => {
            console.log('🧪 Starting REGRESSION test: isRecording state management');
            
            const testCases = [
                { silenceDetection: false, description: 'with silenceDetection disabled' },
                { silenceDetection: true, description: 'with silenceDetection enabled' }
            ];

            for (const testCase of testCases) {
                console.log(`🧪 Testing ${testCase.description}...`);
                
                const options: AudioRecordingOptions = {
                    silenceDetection: testCase.silenceDetection,
                    maxDuration: 3600,
                    silenceDuration: 3
                };

                const testRecorder = new FFmpegAudioRecorder(mockEvents, options);
                
                // Checking initial state
                assert.strictEqual(testRecorder.getIsRecording(), false, `Should not be recording ${testCase.description}`);
                
                // Checking recording duration
                assert.strictEqual(testRecorder.getRecordingDuration(), 0, `Duration should be 0 ${testCase.description}`);
                
                // Checking supported MIME types
                const mimeTypes = testRecorder.getSupportedMimeTypes();
                assert.ok(Array.isArray(mimeTypes), `Should return an array of MIME types ${testCase.description}`);
                assert.ok(mimeTypes.length > 0, `Should support at least one MIME type ${testCase.description}`);
                assert.ok(mimeTypes.includes('audio/wav'), `Should support audio/wav ${testCase.description}`);
                
                console.log(`✅ Test case passed: ${testCase.description}`);
            }
            
            console.log('✅ All state management tests passed');
        });

        it('should correctly check compatibility and microphone availability regardless of silenceDetection', async () => {
            console.log('🧪 Starting test: compatibility and microphone checks');
            
            // Checking browser compatibility
            const compatibility = FFmpegAudioRecorder.checkBrowserCompatibility();
            
            assert.ok(typeof compatibility.supported === 'boolean', 'supported should be boolean');
            assert.ok(Array.isArray(compatibility.missing), 'missing should be an array');
            
            console.log(`Compatibility check: supported=${compatibility.supported}, missing=${compatibility.missing.length} items`);
            
            // Checking microphone availability
            const microphoneCheck = await FFmpegAudioRecorder.checkMicrophonePermission();
            
            assert.ok(typeof microphoneCheck.state === 'string', 'state should be a string');
            assert.ok(typeof microphoneCheck.available === 'boolean', 'available should be boolean');
            
            console.log(`Microphone check: state=${microphoneCheck.state}, available=${microphoneCheck.available}`);
            
            console.log('✅ Test passed: compatibility and microphone checks work correctly');
        });

        it('should correctly update lastAudioTime for various FFmpeg messages', () => {
            console.log('🧪 Starting test: lastAudioTime update logic');
            
            const options: AudioRecordingOptions = {
                silenceDetection: true,
                silenceDuration: 3
            };

            recorder = new FFmpegAudioRecorder(mockEvents, options);
            const recorderAny = recorder as any;
            
            // Spy on updateLastAudioTime
            const updateLastAudioTimeSpy = sandbox.spy(recorderAny, 'updateLastAudioTime');
            
            // Setting initial conditions
            recorderAny.silenceDetectionEnabled = true;
            recorderAny.recordingStartTime = Date.now();
            recorderAny.lastAudioTime = recorderAny.recordingStartTime;
            
            console.log('🧪 Testing various types of FFmpeg messages...');
            
            // Imitating child process creation
            recorderAny.ffmpegProcess = mockChildProcess;
            recorderAny.setupFFmpegEvents();
            
            // Test 1: Recording progress message
            mockChildProcess.stderr.emit('data', 'size=    1024kB time=00:00:10.50 bitrate= 845.3kbits/s');
            assert.ok(updateLastAudioTimeSpy.called, 'updateLastAudioTime should be called for progress message');
            
            updateLastAudioTimeSpy.resetHistory();
            
            // Test 2: Stream information
            mockChildProcess.stderr.emit('data', 'Stream #0:0: Audio: pcm_s16le, 44100 Hz, 2 channels');
            assert.ok(updateLastAudioTimeSpy.called, 'updateLastAudioTime should be called for stream info');
            
            updateLastAudioTimeSpy.resetHistory();
            
            // Test 3: FFmpeg ready
            mockChildProcess.stderr.emit('data', 'Press [q] to quit, [?] for help');
            assert.ok(updateLastAudioTimeSpy.called, 'updateLastAudioTime should be called for FFmpeg ready');
            
            updateLastAudioTimeSpy.resetHistory();
            
            // Test 4: Input/output information
            mockChildProcess.stderr.emit('data', 'Input #0, avfoundation, from \':0\':');
            assert.ok(updateLastAudioTimeSpy.called, 'updateLastAudioTime should be called for input info');
            
            updateLastAudioTimeSpy.resetHistory();
            
            // Test 5: Regular message (not an error) in silence detection mode
            mockChildProcess.stderr.emit('data', 'frame=  100 fps= 10 q=-0.0 size=    1024kB time=00:00:05.00');
            assert.ok(updateLastAudioTimeSpy.called, 'updateLastAudioTime should be called for regular message');
            
            updateLastAudioTimeSpy.resetHistory();
            
            // Test 6: Error message (SHOULD NOT update lastAudioTime)
            mockChildProcess.stderr.emit('data', 'Error: Permission denied accessing microphone');
            assert.ok(!updateLastAudioTimeSpy.called, 'updateLastAudioTime SHOULD NOT be called for error message');
            
            console.log('✅ Test passed: lastAudioTime update logic works correctly');
        });
    });
}); 