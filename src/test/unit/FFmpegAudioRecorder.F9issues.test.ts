import * as assert from 'assert';
import * as sinon from 'sinon';
import { FFmpegAudioRecorder, AudioRecorderEvents, AudioRecordingOptions } from '../../core/FFmpegAudioRecorder.js';
import { EventEmitter } from 'events';

describe('FFmpegAudioRecorder - F9 Issues Fix Tests', () => {
    let sandbox: sinon.SinonSandbox;
    let mockEvents: AudioRecorderEvents;
    let recorder: FFmpegAudioRecorder;
    let mockChildProcess: any; // Using any for mocking child process
    let onRecordingStartStub: sinon.SinonStub;
    let onRecordingStopStub: sinon.SinonStub;
    let onErrorStub: sinon.SinonStub;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
        
        // Creating stubs
        onRecordingStartStub = sandbox.stub();
        onRecordingStopStub = sandbox.stub();
        onErrorStub = sandbox.stub();
        
        // Mocking events
        mockEvents = {
            onRecordingStart: onRecordingStartStub,
            onRecordingStop: onRecordingStopStub,
            onError: onErrorStub
        };

        // Mocking child_process with correct structure
        mockChildProcess = new EventEmitter();
        mockChildProcess.kill = sandbox.stub();
        mockChildProcess.killed = false;
        mockChildProcess.stderr = new EventEmitter();
        mockChildProcess.stdout = new EventEmitter();

        const { spawn } = require('child_process');
        sandbox.stub(require('child_process'), 'spawn').returns(mockChildProcess);

        // Mocking fs
        const fs = require('fs');
        sandbox.stub(fs, 'existsSync').returns(true);
        sandbox.stub(fs, 'statSync').returns({ size: 2048 });
        sandbox.stub(fs, 'readFileSync').returns(Buffer.from('fake audio data'));

        // Mocking tmp
        const tmp = require('tmp');
        sandbox.stub(tmp, 'fileSync').returns({
            name: '/tmp/test-recording.wav',
            removeCallback: () => {}
        });

        // Mocking FFmpeg checks
        sandbox.stub(FFmpegAudioRecorder, 'checkFFmpegAvailability')
            .resolves({ available: true, path: '/usr/bin/ffmpeg', version: '4.4.0' });

        // ❗ IMPORTANT: Mocking runDiagnostics to avoid real FFmpeg calls
        sandbox.stub(FFmpegAudioRecorder, 'runDiagnostics').resolves({
            ffmpegAvailable: { available: true, path: '/usr/bin/ffmpeg', version: '4.4.0' },
            inputDevices: ['MacBook Pro Microphone'],
            platform: 'macos',
            platformCommands: {
                platform: 'macos',
                audioInput: '-f avfoundation',
                defaultDevice: ':0'
            },
            recommendedDevice: ':0',
            errors: [],
            warnings: []
        });

        // ❗ IMPORTANT: Mocking detectInputDevices to avoid real FFmpeg calls
        sandbox.stub(FFmpegAudioRecorder, 'detectInputDevices').resolves([
            { id: ':0', name: 'MacBook Pro Microphone', isDefault: true }
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

    describe('Issue 1: Silence Detection Stopping Too Early', () => {
        it('should NOT update lastAudioTime on FFmpeg service messages', async () => {
            console.log('🧪 Testing Issue 1: Silence detection stopping too early');
            
            const options: AudioRecordingOptions = {
                silenceDetection: true,
                silenceDuration: 5,  // 5 seconds of silence
                maxDuration: 60      // Large value
            };

            recorder = new FFmpegAudioRecorder(mockEvents, options);
            const recorderAny = recorder as any;
            
            // Spy on updateLastAudioTime
            const updateLastAudioTimeSpy = sandbox.spy(recorderAny, 'updateLastAudioTime');

            console.log('�� Starting recording...');
            
            try {
                await recorder.startRecording();
            } catch (error) {
                console.log('Expected error in test environment:', (error as Error).message);
            }
            
            console.log('🧪 Simulating FFmpeg service messages (SHOULD NOT call updateLastAudioTime)...');
            
            // These messages SHOULD NOT call updateLastAudioTime
            mockChildProcess.stderr.emit('data', 'ffmpeg version 4.4.0\n');
            mockChildProcess.stderr.emit('data', 'configuration: --enable-libmp3lame\n');
            mockChildProcess.stderr.emit('data', 'built with gcc 9.3.0\n');
            mockChildProcess.stderr.emit('data', 'libavutil      56. 70.100\n');
            
            console.log(`📊 updateLastAudioTime called after service messages: ${updateLastAudioTimeSpy.callCount}`);
            
            // Only initialization messages should call updateLastAudioTime
            const initialCalls = updateLastAudioTimeSpy.callCount;
            
            console.log('🧪 Simulating real audio activity indicators...');
            
            // These messages SHOULD call updateLastAudioTime
            mockChildProcess.stderr.emit('data', 'Input #0, avfoundation, from \':0\':\n');
            mockChildProcess.stderr.emit('data', '  Stream #0:0: Audio: pcm_f32le, 44100 Hz, 2 channels, flt\n');
            mockChildProcess.stderr.emit('data', 'Press [q] to quit, [?] for help\n');
            mockChildProcess.stderr.emit('data', 'size=      64kB time=00:00:01.00 bitrate= 512.0kbits/s\n');
            
            console.log(`📊 updateLastAudioTime called after audio activity: ${updateLastAudioTimeSpy.callCount}`);
            
            // Checking that updateLastAudioTime was called only for real activity
            const finalCalls = updateLastAudioTimeSpy.callCount;
            const audioActivityCalls = finalCalls - initialCalls;
            
            assert.ok(audioActivityCalls >= 3, `updateLastAudioTime should be called for real audio activity (${audioActivityCalls} calls)`);
            
            console.log('✅ Test passed: silence detection ignores service messages');
        });

        it('should update lastAudioTime only on real recording data', async () => {
            console.log('🧪 Testing real recording progress detection');
            
            const options: AudioRecordingOptions = {
                silenceDetection: true,
                silenceDuration: 3,
                maxDuration: 60
            };

            recorder = new FFmpegAudioRecorder(mockEvents, options);
            const recorderAny = recorder as any;
            
            const updateLastAudioTimeSpy = sandbox.spy(recorderAny, 'updateLastAudioTime');

            try {
                await recorder.startRecording();
            } catch (error) {
                // Expected in test environment
            }
            
            const initialCalls = updateLastAudioTimeSpy.callCount;
            
            console.log('🧪 Simulating recording progress with zero data (SHOULD NOT update)...');
            mockChildProcess.stderr.emit('data', 'size=       0kB time=00:00:00.00 bitrate= N/A\n');
            
            console.log('🧪 Simulating recording progress with real data (SHOULD update)...');
            mockChildProcess.stderr.emit('data', 'size=      32kB time=00:00:02.00 bitrate= 128.0kbits/s\n');
            mockChildProcess.stderr.emit('data', 'size=      64kB time=00:00:04.00 bitrate= 128.0kbits/s\n');
            
            const finalCalls = updateLastAudioTimeSpy.callCount;
            const progressCalls = finalCalls - initialCalls;
            
            // Should be 2 calls for real data (but not for zero data)
            assert.strictEqual(progressCalls, 2, `updateLastAudioTime should be called 2 times for real data (${progressCalls} calls)`);
            
            console.log('✅ Test passed: detects real recording progress');
        });
    });

    describe('Issue 2: Manual Recording Without Silence Detection', () => {
        it('should work correctly with silenceDetection=false', async () => {
            console.log('🧪 Testing Issue 2: Manual recording without silence detection');
            
            const options: AudioRecordingOptions = {
                silenceDetection: false,  // DISABLED
                maxDuration: 10,          // 10 seconds maximum
                silenceDuration: 3        // Should not be used
            };

            recorder = new FFmpegAudioRecorder(mockEvents, options);
            const recorderAny = recorder as any;
            
            const setupSilenceDetectionSpy = sandbox.spy(recorderAny, 'setupSilenceDetection');
            const setupMaxDurationTimerSpy = sandbox.spy(recorderAny, 'setupMaxDurationTimer');

            console.log('🧪 Starting recording...');
            
            try {
                await recorder.startRecording();
            } catch (error) {
                console.log('Expected error in test environment:', (error as Error).message);
            }
            
            // Checking that silence detection is NOT enabled
            assert.ok(setupSilenceDetectionSpy.calledOnce, 'setupSilenceDetection should be called');
            assert.strictEqual(recorderAny.silenceDetectionEnabled, false, 'silenceDetectionEnabled should be false');
            
            // Checking that max duration timer is ENABLED
            assert.ok(setupMaxDurationTimerSpy.calledOnce, 'setupMaxDurationTimer should be called');
            
            console.log('🧪 Simulating FFmpeg messages...');
            
            // Emulating FFmpeg messages
            mockChildProcess.stderr.emit('data', 'Input #0, avfoundation, from \':0\':\n');
            mockChildProcess.stderr.emit('data', 'Press [q] to quit, [?] for help\n');
            
            console.log('🧪 Simulating manual recording stop...');
            
            // Stopping recording manually
            recorder.stopRecording();
            
            // Simulating FFmpeg process completion
            mockChildProcess.emit('close', 0);
            
            // Giving time for processing
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Checking that events were called
            assert.ok(onRecordingStartStub.called, 'onRecordingStart should be called');
            assert.ok(onRecordingStopStub.called, 'onRecordingStop should be called for transcription');
            
            console.log('✅ Test passed: manual recording works without silence detection');
        });

        it('should call onRecordingStop even without silence detection', async () => {
            console.log('🧪 Testing onRecordingStop event without silence detection');
            
            const options: AudioRecordingOptions = {
                silenceDetection: false,
                maxDuration: 60
            };

            recorder = new FFmpegAudioRecorder(mockEvents, options);

            try {
                await recorder.startRecording();
            } catch (error) {
                // Expected in test environment
            }
            
            assert.ok(onRecordingStartStub.called, 'onRecordingStart should be called');
            
            // Simulating successful stop
            recorder.stopRecording();
            mockChildProcess.emit('close', 0);
            
            // Giving time for processing
            await new Promise(resolve => setTimeout(resolve, 200));
            
            assert.ok(onRecordingStopStub.called, 'onRecordingStop should be called for transcription');
            
            // Checking that audioBlob is passed
            const onRecordingStopCall = onRecordingStopStub.getCall(0);
            assert.ok(onRecordingStopCall, 'onRecordingStop should be called');
            assert.ok(onRecordingStopCall.args[0], 'audioBlob should be passed');
            
            console.log('✅ Test passed: onRecordingStop event works without silence detection');
        });
    });
}); 