// FFmpegIntegration.test.ts - Интеграционные тесты для FFmpegAudioRecorder

import * as assert from 'assert';
import * as sinon from 'sinon';
import { FFmpegAudioRecorder, AudioRecorderEvents, AudioRecordingOptions } from '../../core/FFmpegAudioRecorder';
import { 
    setupFFmpegMocks, 
    cleanupFFmpegMocks,
    FFmpegTestScenarios,
    simulatePlatformSpecificBehavior 
} from '../mocks/ffmpegMocks';

suite('FFmpeg Integration Tests', () => {
    let audioRecorder: FFmpegAudioRecorder;
    let mockEvents: AudioRecorderEvents;

    setup(() => {
        setupFFmpegMocks();
        
        mockEvents = {
            onRecordingStart: sinon.stub(),
            onRecordingStop: sinon.stub(),
            onError: sinon.stub()
        };
    });

    teardown(() => {
        cleanupFFmpegMocks();
        if (audioRecorder) {
            audioRecorder.stopRecording();
        }
    });

    suite('Cross-platform Recording', () => {
        test('Should record on macOS', async () => {
            simulatePlatformSpecificBehavior('darwin');
            FFmpegTestScenarios.successfulRecording();
            
            const options: AudioRecordingOptions = {
                sampleRate: 16000,
                channelCount: 1,
                audioFormat: 'wav'
            };
            
            audioRecorder = new FFmpegAudioRecorder(mockEvents, options);
            
            await audioRecorder.startRecording();
            assert.strictEqual(audioRecorder.getIsRecording(), true);
            
            audioRecorder.stopRecording();
            assert.strictEqual(audioRecorder.getIsRecording(), false);
        });

        test('Should record on Windows', async () => {
            simulatePlatformSpecificBehavior('win32');
            FFmpegTestScenarios.successfulRecording();
            
            const options: AudioRecordingOptions = {
                sampleRate: 44100,
                channelCount: 2,
                audioFormat: 'mp3'
            };
            
            audioRecorder = new FFmpegAudioRecorder(mockEvents, options);
            
            await audioRecorder.startRecording();
            assert.strictEqual(audioRecorder.getIsRecording(), true);
            
            audioRecorder.stopRecording();
            assert.strictEqual(audioRecorder.getIsRecording(), false);
        });

        test('Should record on Linux', async () => {
            simulatePlatformSpecificBehavior('linux');
            FFmpegTestScenarios.successfulRecording();
            
            const options: AudioRecordingOptions = {
                sampleRate: 22050,
                channelCount: 1,
                audioFormat: 'opus'
            };
            
            audioRecorder = new FFmpegAudioRecorder(mockEvents, options);
            
            await audioRecorder.startRecording();
            assert.strictEqual(audioRecorder.getIsRecording(), true);
            
            audioRecorder.stopRecording();
            assert.strictEqual(audioRecorder.getIsRecording(), false);
        });
    });

    suite('Device Detection Integration', () => {
        test('Should detect devices on all platforms', async () => {
            const platforms = ['darwin', 'win32', 'linux'];
            
            for (const platform of platforms) {
                simulatePlatformSpecificBehavior(platform);
                FFmpegTestScenarios.successfulRecording();
                
                const devices = await FFmpegAudioRecorder.detectInputDevices();
                assert.ok(Array.isArray(devices));
                // В тестовой среде могут быть найдены устройства или нет - оба варианта валидны
            }
        });
    });

    suite('Error Recovery Integration', () => {
        test('Should recover from FFmpeg process failure', async () => {
            FFmpegTestScenarios.recordingError();
            
            const options: AudioRecordingOptions = {
                sampleRate: 16000,
                channelCount: 1,
                audioFormat: 'wav'
            };
            
            audioRecorder = new FFmpegAudioRecorder(mockEvents, options);
            
            await audioRecorder.startRecording();
            
            // Проверяем что обработчик ошибок был вызван
            setTimeout(() => {
                assert.ok((mockEvents.onError as sinon.SinonStub).calledOnce);
                assert.strictEqual(audioRecorder.getIsRecording(), false);
            }, 150);
        });
    });

    suite('Format Support Integration', () => {
        test('Should support multiple audio formats', async () => {
            const formats: Array<'wav' | 'mp3' | 'opus'> = ['wav', 'mp3', 'opus'];
            
            for (const format of formats) {
                FFmpegTestScenarios.successfulRecording();
                
                const options: AudioRecordingOptions = {
                    sampleRate: 16000,
                    channelCount: 1,
                    audioFormat: format
                };
                
                audioRecorder = new FFmpegAudioRecorder(mockEvents, options);
                
                await audioRecorder.startRecording();
                assert.strictEqual(audioRecorder.getIsRecording(), true);
                
                audioRecorder.stopRecording();
                assert.strictEqual(audioRecorder.getIsRecording(), false);
            }
        });
    });

    suite('Custom Configuration Integration', () => {
        test('Should work with custom FFmpeg path', async () => {
            FFmpegTestScenarios.successfulRecording();
            
            const options: AudioRecordingOptions = {
                sampleRate: 16000,
                channelCount: 1,
                audioFormat: 'wav',
                ffmpegPath: '/custom/path/to/ffmpeg'
            };
            
            audioRecorder = new FFmpegAudioRecorder(mockEvents, options);
            
            await audioRecorder.startRecording();
            assert.strictEqual(audioRecorder.getIsRecording(), true);
            
            audioRecorder.stopRecording();
            assert.strictEqual(audioRecorder.getIsRecording(), false);
        });

        test('Should work with custom input device', async () => {
            FFmpegTestScenarios.successfulRecording();
            
            const options: AudioRecordingOptions = {
                sampleRate: 16000,
                channelCount: 1,
                audioFormat: 'wav',
                inputDevice: 'custom-microphone-device'
            };
            
            audioRecorder = new FFmpegAudioRecorder(mockEvents, options);
            
            await audioRecorder.startRecording();
            assert.strictEqual(audioRecorder.getIsRecording(), true);
            
            audioRecorder.stopRecording();
            assert.strictEqual(audioRecorder.getIsRecording(), false);
        });
    });

    suite('Resource Management Integration', () => {
        test('Should properly cleanup resources on multiple start/stop cycles', async () => {
            FFmpegTestScenarios.successfulRecording();
            
            const options: AudioRecordingOptions = {
                sampleRate: 16000,
                channelCount: 1,
                audioFormat: 'wav'
            };
            
            audioRecorder = new FFmpegAudioRecorder(mockEvents, options);
            
            // Несколько циклов записи
            for (let i = 0; i < 3; i++) {
                await audioRecorder.startRecording();
                assert.strictEqual(audioRecorder.getIsRecording(), true);
                
                audioRecorder.stopRecording();
                assert.strictEqual(audioRecorder.getIsRecording(), false);
                
                // Небольшая пауза между циклами
                await new Promise(resolve => setTimeout(resolve, 50));
            }
        });
    });
}); 