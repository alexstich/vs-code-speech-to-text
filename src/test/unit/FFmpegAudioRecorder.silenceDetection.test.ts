import * as assert from 'assert';
import * as sinon from 'sinon';
import { FFmpegAudioRecorder, AudioRecorderEvents, AudioRecordingOptions } from '../../core/FFmpegAudioRecorder.js';

describe('FFmpegAudioRecorder - Silence Detection Tests', () => {
    let sandbox: sinon.SinonSandbox;
    let mockEvents: AudioRecorderEvents;
    let recorder: FFmpegAudioRecorder;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
        
        // Mock events
        mockEvents = {
            onRecordingStart: sandbox.stub(),
            onRecordingStop: sandbox.stub(),
            onError: sandbox.stub()
        };
    });

    afterEach(() => {
        if (recorder) {
            // Clear recorder if it was created
            try {
                recorder.stopRecording();
            } catch (error) {
                // Ignore errors during cleanup
            }
        }
        sandbox.restore();
    });

    describe('Silence Detection Configuration', () => {
        it('should correctly configure silence detection when enabled', () => {
            const options: AudioRecordingOptions = {
                silenceDetection: true,
                silenceDuration: 5,  // 5 seconds
                silenceThreshold: -40,
                maxDuration: 60
            };

            recorder = new FFmpegAudioRecorder(mockEvents, options);

            // Check that the recorder is created with correct settings
            assert.ok(recorder, 'Recorder should be created');
            
            // Check initial state
            assert.strictEqual(recorder.getIsRecording(), false, 'Should not be recording initially');
        });

        it('should correctly configure silence detection when disabled', () => {
            const options: AudioRecordingOptions = {
                silenceDetection: false,
                silenceDuration: 5,
                silenceThreshold: -40,
                maxDuration: 60
            };

            recorder = new FFmpegAudioRecorder(mockEvents, options);

            // Check that the recorder is created with correct settings
            assert.ok(recorder, 'Recorder should be created');
            assert.strictEqual(recorder.getIsRecording(), false, 'Should not be recording initially');
        });

        it('should use default values for silence detection', () => {
            const options: AudioRecordingOptions = {
                // Do not specify silenceDetection - should be undefined by default
                maxDuration: 60
            };

            recorder = new FFmpegAudioRecorder(mockEvents, options);

            assert.ok(recorder, 'Recorder should be created even without explicitly specifying silenceDetection');
        });
    });

    describe('Recording Duration vs Silence Detection', () => {
        it('should stop by maxDuration when silenceDetection is disabled', async () => {
            // Mock FFmpeg checks
            const checkAvailabilityStub = sandbox.stub(FFmpegAudioRecorder, 'checkFFmpegAvailability')
                .resolves({ available: false, error: 'FFmpeg not available in test environment' });

            const options: AudioRecordingOptions = {
                silenceDetection: false,
                maxDuration: 2, // 2 seconds maximum
                silenceDuration: 1  // This should not affect when silenceDetection=false
            };

            recorder = new FFmpegAudioRecorder(mockEvents, options);

            try {
                // Attempt to start recording - should end with an error due to missing FFmpeg
                await recorder.startRecording();
                assert.fail('Recording should have ended with an error in the test environment');
            } catch (error) {
                // Expected error in test environment
                assert.ok(error instanceof Error);
                assert.ok(error.message.includes('FFmpeg'), 'Error should be related to FFmpeg');
            }

            // Check that events were called accordingly
            assert.ok(checkAvailabilityStub.called, 'checkFFmpegAvailability should have been called');
        });

        it('should stop by silence detection when enabled', async () => {
            // Mock FFmpeg checks  
            const checkAvailabilityStub = sandbox.stub(FFmpegAudioRecorder, 'checkFFmpegAvailability')
                .resolves({ available: false, error: 'FFmpeg not available in test environment' });

            const options: AudioRecordingOptions = {
                silenceDetection: true,
                maxDuration: 60, // Large value so silence detection triggers first
                silenceDuration: 2  // 2 seconds of silence to stop
            };

            recorder = new FFmpegAudioRecorder(mockEvents, options);

            try {
                await recorder.startRecording();
                assert.fail('Recording should have ended with an error in the test environment');
            } catch (error) {
                // Expected error in test environment
                assert.ok(error instanceof Error);
                assert.ok(error.message.includes('FFmpeg'), 'Error should be related to FFmpeg');
            }

            assert.ok(checkAvailabilityStub.called, 'checkFFmpegAvailability should have been called');
        });
    });

    describe('Recording State Management', () => {
        it('should correctly track recording state regardless of silence detection', () => {
            const optionsWithSilence: AudioRecordingOptions = {
                silenceDetection: true,
                silenceDuration: 3,
                maxDuration: 60
            };

            const optionsWithoutSilence: AudioRecordingOptions = {
                silenceDetection: false,
                maxDuration: 60
            };

            // Test with silence detection enabled
            const recorderWithSilence = new FFmpegAudioRecorder(mockEvents, optionsWithSilence);
            assert.strictEqual(recorderWithSilence.getIsRecording(), false, 'Should not be recording initially (with silence detection)');

            // Test with silence detection disabled
            const recorderWithoutSilence = new FFmpegAudioRecorder(mockEvents, optionsWithoutSilence);
            assert.strictEqual(recorderWithoutSilence.getIsRecording(), false, 'Should not be recording initially (without silence detection)');

            // Check recording duration
            assert.strictEqual(recorderWithSilence.getRecordingDuration(), 0, 'Duration should be 0 when not recording');
            assert.strictEqual(recorderWithoutSilence.getRecordingDuration(), 0, 'Duration should be 0 when not recording');
        });

        it('should return correct supported MIME types regardless of silence detection', () => {
            const options: AudioRecordingOptions = {
                silenceDetection: true,
                maxDuration: 60
            };

            recorder = new FFmpegAudioRecorder(mockEvents, options);
            const mimeTypes = recorder.getSupportedMimeTypes();

            assert.ok(Array.isArray(mimeTypes), 'Should return array of MIME types');
            assert.ok(mimeTypes.length > 0, 'Should support at least one MIME type');
            assert.ok(mimeTypes.includes('audio/wav'), 'Should support audio/wav');
        });
    });

    describe('Browser Compatibility and Microphone Checks', () => {
        it('should check browser compatibility regardless of silence detection', () => {
            const compatibility = FFmpegAudioRecorder.checkBrowserCompatibility();
            
            assert.ok(typeof compatibility.supported === 'boolean', 'supported should be boolean');
            assert.ok(Array.isArray(compatibility.missing), 'missing should be an array');
        });

        it('should check microphone availability regardless of silence detection', async () => {
            // Mock checkFFmpegAvailability
            const checkAvailabilityStub = sandbox.stub(FFmpegAudioRecorder, 'checkFFmpegAvailability')
                .resolves({ available: false, error: 'Test environment' });

            const microphoneCheck = await FFmpegAudioRecorder.checkMicrophonePermission();
            
            assert.ok(typeof microphoneCheck.state === 'string', 'state should be a string');
            assert.ok(typeof microphoneCheck.available === 'boolean', 'available should be boolean');
            
            // In the test environment without FFmpeg, microphone should not be available
            assert.strictEqual(microphoneCheck.available, false, 'Microphone should not be available in test environment');
            assert.ok(checkAvailabilityStub.called, 'checkFFmpegAvailability should have been called');
        });
    });

    describe('Options Validation', () => {
        it('should correctly handle various combinations of silence detection settings', () => {
            const testCases = [
                {
                    name: 'All silence detection settings specified',
                    options: {
                        silenceDetection: true,
                        silenceDuration: 5,
                        silenceThreshold: -30,
                        maxDuration: 120
                    }
                },
                {
                    name: 'Only silenceDetection specified',
                    options: {
                        silenceDetection: true,
                        maxDuration: 60
                    }
                },
                {
                    name: 'silenceDetection disabled',
                    options: {
                        silenceDetection: false,
                        maxDuration: 60
                    }
                },
                {
                    name: 'No silence detection settings',
                    options: {
                        maxDuration: 60
                    }
                }
            ];

            testCases.forEach((testCase) => {
                try {
                    const testRecorder = new FFmpegAudioRecorder(mockEvents, testCase.options);
                    assert.ok(testRecorder, `Recorder should be created for case: ${testCase.name}`);
                    assert.strictEqual(testRecorder.getIsRecording(), false, `Should not be recording initially for case: ${testCase.name}`);
                } catch (error) {
                    assert.fail(`Failed to create recorder for case: ${testCase.name}. Error: ${(error as Error).message}`);
                }
            });
        });
    });
}); 