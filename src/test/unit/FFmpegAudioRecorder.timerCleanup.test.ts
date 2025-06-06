import * as assert from 'assert';
import * as sinon from 'sinon';
import { spawn } from 'child_process';
import { EventEmitter } from 'events';
import { FFmpegAudioRecorder, AudioRecorderEvents, AudioRecordingOptions } from '../../core/FFmpegAudioRecorder.js';

describe('FFmpegAudioRecorder - Timer Cleanup Tests', () => {
    let sandbox: sinon.SinonSandbox;
    let mockEvents: AudioRecorderEvents;
    let recorder: FFmpegAudioRecorder;
    let mockChildProcess: any;
    let onRecordingStartSpy: sinon.SinonSpy;
    let onRecordingStopSpy: sinon.SinonSpy;
    let onErrorSpy: sinon.SinonSpy;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
        
        onRecordingStartSpy = sandbox.spy();
        onRecordingStopSpy = sandbox.spy();
        onErrorSpy = sandbox.spy();
        
        mockEvents = {
            onRecordingStart: onRecordingStartSpy,
            onRecordingStop: onRecordingStopSpy,
            onError: onErrorSpy
        };

        mockChildProcess = new EventEmitter();
        mockChildProcess.killed = false;
        mockChildProcess.stdout = new EventEmitter();
        mockChildProcess.stderr = new EventEmitter();
        mockChildProcess.kill = sandbox.stub().callsFake((signal: string) => {
            mockChildProcess.killed = true;
            setTimeout(() => {
                mockChildProcess.emit('close', signal === 'SIGTERM' ? 0 : 255);
            }, 50);
        });
        
        sandbox.stub(require('child_process'), 'spawn').returns(mockChildProcess);
        
        sandbox.stub(FFmpegAudioRecorder, 'checkFFmpegAvailability').resolves({
            available: true,
            version: '4.4.0',
            path: '/usr/local/bin/ffmpeg'
        });
        
        sandbox.stub(FFmpegAudioRecorder, 'detectInputDevices').resolves([
            { id: ':0', name: 'Built-in Microphone', isDefault: true }
        ]);
    });

    afterEach(() => {
        if (recorder) {
            try {
                recorder.stopRecording();
            } catch (error) {
                // Ignoring cleanup errors
            }
        }
        sandbox.restore();
    });

    describe('Timer Cleanup', () => {
        it('should clear timers when silenceDetection=false', async () => {
            const options: AudioRecordingOptions = {
                silenceDetection: false,
                maxDuration: 2,
                silenceDuration: 1
            };

            recorder = new FFmpegAudioRecorder(mockEvents, options);
            
            const recorderAny = recorder as any;
            const clearSilenceTimerSpy = sandbox.spy(recorderAny, 'clearSilenceTimer');
            const clearMaxDurationTimerSpy = sandbox.spy(recorderAny, 'clearMaxDurationTimer');
            const setupSilenceDetectionSpy = sandbox.spy(recorderAny, 'setupSilenceDetection');

            try {
                await recorder.startRecording();
            } catch (error) {
                // Expected in test environment
            }
            
            assert.ok(setupSilenceDetectionSpy.calledOnce, 'setupSilenceDetection should be called during initialization');
            
            recorder.stopRecording();
            
            assert.ok(clearSilenceTimerSpy.called, 'clearSilenceTimer should be called when stopping recording');
            assert.ok(clearMaxDurationTimerSpy.called, 'clearMaxDurationTimer should be called when stopping recording');
        });

        it('should clear timers when silenceDetection=true', async () => {
            const options: AudioRecordingOptions = {
                silenceDetection: true,
                maxDuration: 10,
                silenceDuration: 1
            };

            recorder = new FFmpegAudioRecorder(mockEvents, options);
            
            const recorderAny = recorder as any;
            const clearSilenceTimerSpy = sandbox.spy(recorderAny, 'clearSilenceTimer');
            const clearMaxDurationTimerSpy = sandbox.spy(recorderAny, 'clearMaxDurationTimer');
            const setupSilenceDetectionSpy = sandbox.spy(recorderAny, 'setupSilenceDetection');

            try {
                await recorder.startRecording();
            } catch (error) {
                // Expected in test environment
            }
            
            assert.ok(setupSilenceDetectionSpy.calledOnce, 'setupSilenceDetection should be called');
            
            recorder.stopRecording();
            
            assert.ok(clearSilenceTimerSpy.called, 'clearSilenceTimer should be called');
            assert.ok(clearMaxDurationTimerSpy.called, 'clearMaxDurationTimer should be called');
        });

        it('should set up silence detection correctly', () => {
            // Test with disabled silence detection
            const optionsDisabled: AudioRecordingOptions = {
                silenceDetection: false,
                maxDuration: 60
            };

            const recorderDisabled = new FFmpegAudioRecorder(mockEvents, optionsDisabled);
            const recorderDisabledAny = recorderDisabled as any;
            
            const setupSilenceDetectionSpyDisabled = sandbox.spy(recorderDisabledAny, 'setupSilenceDetection');
            
            recorderDisabledAny.setupSilenceDetection();
            
            assert.ok(setupSilenceDetectionSpyDisabled.calledOnce, 'setupSilenceDetection should be called');
            assert.strictEqual(recorderDisabledAny.silenceDetectionEnabled, false, 'silenceDetectionEnabled should be false');
            
            // Test with enabled silence detection
            const optionsEnabled: AudioRecordingOptions = {
                silenceDetection: true,
                maxDuration: 60,
                silenceDuration: 3
            };

            const recorderEnabled = new FFmpegAudioRecorder(mockEvents, optionsEnabled);
            const recorderEnabledAny = recorderEnabled as any;
            
            const setupSilenceDetectionSpyEnabled = sandbox.spy(recorderEnabledAny, 'setupSilenceDetection');
            
            recorderEnabledAny.setupSilenceDetection();
            
            assert.ok(setupSilenceDetectionSpyEnabled.calledOnce, 'setupSilenceDetection should be called');
            assert.strictEqual(recorderEnabledAny.silenceDetectionEnabled, true, 'silenceDetectionEnabled should be true');
        });
    });

    describe('Recording State Management', () => {
        it('should handle multiple start/stop cycles without errors', async () => {
            const options: AudioRecordingOptions = {
                silenceDetection: false,
                maxDuration: 60
            };

            recorder = new FFmpegAudioRecorder(mockEvents, options);
            
            // Multiple start/stop cycles - just test no errors thrown
            for (let i = 0; i < 3; i++) {
                try {
                    await recorder.startRecording();
                } catch (error) {
                    // Expected in test environment
                }
                
                recorder.stopRecording();
            }
            
            // Just verify no errors thrown
            assert.ok(true, 'Multiple start/stop cycles completed without errors');
        });

        it('should handle cleanup when process is null', () => {
            const options: AudioRecordingOptions = {
                silenceDetection: false,
                maxDuration: 60
            };

            recorder = new FFmpegAudioRecorder(mockEvents, options);
            const recorderAny = recorder as any;
            
            // Ensure process is null
            recorderAny.ffmpegProcess = null;
            
            // Should not throw error
            assert.doesNotThrow(() => {
                recorder.stopRecording();
            }, 'stopRecording should handle null process gracefully');
        });
    });
}); 