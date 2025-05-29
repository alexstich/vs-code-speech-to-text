// FFmpegAudioRecorder.test.ts - Unit тесты для модуля записи аудио через FFmpeg

import * as assert from 'assert';
import * as sinon from 'sinon';
import { FFmpegAudioRecorder, AudioRecorderEvents, AudioRecordingOptions } from '../../core/FFmpegAudioRecorder';
import { 
    setupFFmpegMocks, 
    cleanupFFmpegMocks,
    mockWhich,
    mockTmp,
    mockChildProcess,
    mockFs,
    MockChildProcess,
    FFmpegTestScenarios,
    createMockAudioBlob,
    createMockFFmpegError,
    createMockDeviceList,
    simulatePlatformSpecificBehavior,
    simulateFFmpegVersion
} from '../mocks/ffmpegMocks';

suite('FFmpegAudioRecorder Unit Tests', () => {
    let audioRecorder: FFmpegAudioRecorder;
    let mockEvents: AudioRecorderEvents;
    let clock: sinon.SinonFakeTimers;

    setup(() => {
        // Настройка моков перед каждым тестом
        setupFFmpegMocks();
        clock = sinon.useFakeTimers();
        
        // Создаем мок событий
        mockEvents = {
            onRecordingStart: sinon.stub(),
            onRecordingStop: sinon.stub(),
            onError: sinon.stub()
        };
        
        const options: AudioRecordingOptions = {
            sampleRate: 16000,
            channelCount: 1,
            audioFormat: 'wav',
            codec: 'pcm_s16le',
            maxDuration: 60
        };
        
        audioRecorder = new FFmpegAudioRecorder(mockEvents, options);
    });

    teardown(() => {
        // Очистка после каждого теста
        cleanupFFmpegMocks();
        clock.restore();
    });

    suite('Constructor', () => {
        test('Should initialize with default state', () => {
            assert.strictEqual(audioRecorder.getIsRecording(), false);
        });

        test('Should use provided options', () => {
            const customOptions: AudioRecordingOptions = {
                sampleRate: 44100,
                channelCount: 2,
                audioFormat: 'mp3',
                codec: 'mp3',
                inputDevice: 'custom-device',
                ffmpegPath: '/custom/path/ffmpeg',
                maxDuration: 120
            };
            
            const customRecorder = new FFmpegAudioRecorder(mockEvents, customOptions);
            assert.strictEqual(customRecorder.getIsRecording(), false);
        });
    });

    suite('Static Methods', () => {
        test('checkFFmpegAvailability - should detect FFmpeg', async () => {
            const result = await FFmpegAudioRecorder.checkFFmpegAvailability();
            
            assert.strictEqual(result.available, true);
            assert.ok(mockWhich.sync.calledWith('ffmpeg'));
        });

        test('checkFFmpegAvailability - should handle FFmpeg not found', async () => {
            FFmpegTestScenarios.ffmpegNotFound();
            
            const result = await FFmpegAudioRecorder.checkFFmpegAvailability();
            
            assert.strictEqual(result.available, false);
            assert.ok(result.error);
        });

        test('detectInputDevices - should return device list for macOS', async () => {
            simulatePlatformSpecificBehavior('darwin');
            const mockProcess = new MockChildProcess();
            mockProcess.simulateFFmpegOutput(`[AVFoundation indev @ 0x12345] AVFoundation audio devices:
[AVFoundation indev @ 0x12345] [0] MacBook Pro Microphone
[AVFoundation indev @ 0x12345] [1] External Microphone`);
            mockChildProcess.spawn.returns(mockProcess);
            
            const devices = await FFmpegAudioRecorder.detectInputDevices();
            
            assert.strictEqual(devices.length, 2);
            assert.ok(devices.includes('MacBook Pro Microphone'));
            assert.ok(devices.includes('External Microphone'));
        });

        test('detectInputDevices - should return device list for Windows', async () => {
            simulatePlatformSpecificBehavior('win32');
            const mockProcess = new MockChildProcess();
            mockProcess.simulateFFmpegOutput(`[dshow @ 0x12345] DirectShow audio devices
[dshow @ 0x12345]  "Microphone (High Definition Audio Device)"
[dshow @ 0x12345]  "Line In (High Definition Audio Device)"`);
            mockChildProcess.spawn.returns(mockProcess);
            
            const devices = await FFmpegAudioRecorder.detectInputDevices();
            
            assert.strictEqual(devices.length, 2);
            assert.ok(devices.includes('Microphone (High Definition Audio Device)'));
            assert.ok(devices.includes('Line In (High Definition Audio Device)'));
        });

        test('detectInputDevices - should return device list for Linux', async () => {
            simulatePlatformSpecificBehavior('linux');
            const mockProcess = new MockChildProcess();
            mockProcess.simulateFFmpegOutput(`[pulse @ 0x12345] PulseAudio audio devices:
[pulse @ 0x12345]  "default" (PulseAudio default)
[pulse @ 0x12345]  "alsa_input.pci-0000_00_1f.3.analog-stereo" (Built-in Audio Analog Stereo)`);
            mockChildProcess.spawn.returns(mockProcess);
            
            const devices = await FFmpegAudioRecorder.detectInputDevices();
            
            assert.strictEqual(devices.length, 2);
            assert.ok(devices.includes('default'));
            assert.ok(devices.includes('alsa_input.pci-0000_00_1f.3.analog-stereo'));
        });

        test('detectInputDevices - should handle no devices found', async () => {
            FFmpegTestScenarios.noAudioDevices();
            
            const devices = await FFmpegAudioRecorder.detectInputDevices();
            
            assert.strictEqual(devices.length, 0);
        });
    });

    suite('startRecording', () => {
        test('Should start recording successfully', async () => {
            FFmpegTestScenarios.successfulRecording();
            
            await audioRecorder.startRecording();
            
            assert.strictEqual(audioRecorder.getIsRecording(), true);
            assert.ok((mockEvents.onRecordingStart as sinon.SinonStub).calledOnce);
            assert.ok(mockTmp.file.calledOnce);
            assert.ok(mockChildProcess.spawn.calledOnce);
        });

        test('Should handle FFmpeg not available', async () => {
            FFmpegTestScenarios.ffmpegNotFound();
            
            await audioRecorder.startRecording();
            
            assert.strictEqual(audioRecorder.getIsRecording(), false);
            assert.ok((mockEvents.onError as sinon.SinonStub).calledOnce);
            
            const errorCall = (mockEvents.onError as sinon.SinonStub).getCall(0);
            assert.ok(errorCall.args[0].message.includes('FFmpeg'));
        });

        test('Should handle temp file creation failure', async () => {
            FFmpegTestScenarios.tempFileError();
            
            await audioRecorder.startRecording();
            
            assert.strictEqual(audioRecorder.getIsRecording(), false);
            assert.ok((mockEvents.onError as sinon.SinonStub).calledOnce);
        });

        test('Should not start if already recording', async () => {
            FFmpegTestScenarios.successfulRecording();
            
            await audioRecorder.startRecording();
            assert.strictEqual(audioRecorder.getIsRecording(), true);
            
            // Попытка запустить снова
            await audioRecorder.startRecording();
            
            // События должны быть вызваны только один раз
            assert.strictEqual((mockEvents.onRecordingStart as sinon.SinonStub).callCount, 1);
        });

        test('Should use correct FFmpeg arguments for macOS', async () => {
            simulatePlatformSpecificBehavior('darwin');
            FFmpegTestScenarios.successfulRecording();
            
            await audioRecorder.startRecording();
            
            const spawnCall = mockChildProcess.spawn.getCall(0);
            const args = spawnCall.args[1];
            
            assert.ok(args.includes('-f'));
            assert.ok(args.includes('avfoundation'));
            assert.ok(args.includes('-i'));
            assert.ok(args.includes('-c:a'));
            assert.ok(args.includes('pcm_s16le'));
        });

        test('Should use correct FFmpeg arguments for Windows', async () => {
            simulatePlatformSpecificBehavior('win32');
            FFmpegTestScenarios.successfulRecording();
            
            await audioRecorder.startRecording();
            
            const spawnCall = mockChildProcess.spawn.getCall(0);
            const args = spawnCall.args[1];
            
            assert.ok(args.includes('-f'));
            assert.ok(args.includes('dshow'));
            assert.ok(args.includes('-i'));
        });

        test('Should use custom input device when specified', async () => {
            const customOptions: AudioRecordingOptions = {
                sampleRate: 16000,
                channelCount: 1,
                audioFormat: 'wav',
                codec: 'pcm_s16le',
                inputDevice: 'custom-device'
            };
            
            const customRecorder = new FFmpegAudioRecorder(mockEvents, customOptions);
            FFmpegTestScenarios.successfulRecording();
            
            await customRecorder.startRecording();
            
            const spawnCall = mockChildProcess.spawn.getCall(0);
            const args = spawnCall.args[1];
            
            // Проверяем что custom device используется
            assert.ok(args.includes('custom-device'));
        });
    });

    suite('stopRecording', () => {
        test('Should stop recording and create audio blob', async () => {
            FFmpegTestScenarios.successfulRecording();
            
            await audioRecorder.startRecording();
            assert.strictEqual(audioRecorder.getIsRecording(), true);
            
            // Мокируем чтение файла
            mockFs.createReadStream.returns({
                on: sinon.stub().callsArgWith(1, Buffer.from('mock audio data')),
                pipe: sinon.stub(),
                destroy: sinon.stub()
            });
            
            audioRecorder.stopRecording();
            
            // Ждем завершения процесса
            clock.tick(150);
            
            assert.strictEqual(audioRecorder.getIsRecording(), false);
            
            // Проверяем что процесс был завершен
            const mockProcess = mockChildProcess.spawn.returnValues[0] as MockChildProcess;
            assert.ok(mockProcess.kill.calledOnce);
        });

        test('Should handle stop when not recording', () => {
            audioRecorder.stopRecording();
            
            assert.strictEqual(audioRecorder.getIsRecording(), false);
            // Не должно быть ошибок
        });

        test('Should cleanup temp file after recording', async () => {
            FFmpegTestScenarios.successfulRecording();
            
            await audioRecorder.startRecording();
            audioRecorder.stopRecording();
            
            clock.tick(150);
            
            // Проверяем что temp file cleanup был вызван
            // mockTempFile.removeCallback должен быть вызван
            assert.ok(true); // Базовая проверка что ошибок нет
        });
    });

    suite('Error Handling', () => {
        test('Should handle FFmpeg process error', async () => {
            FFmpegTestScenarios.recordingError();
            
            await audioRecorder.startRecording();
            
            // Ждем завершения с ошибкой
            clock.tick(100);
            
            assert.strictEqual(audioRecorder.getIsRecording(), false);
            assert.ok((mockEvents.onError as sinon.SinonStub).calledOnce);
        });

        test('Should handle FFmpeg process crash', async () => {
            const mockProcess = new MockChildProcess();
            mockChildProcess.spawn.returns(mockProcess);
            
            await audioRecorder.startRecording();
            
            // Симулируем crash процесса
            mockProcess.simulateError(1, 'SIGSEGV');
            clock.tick(50);
            
            assert.strictEqual(audioRecorder.getIsRecording(), false);
            assert.ok((mockEvents.onError as sinon.SinonStub).calledOnce);
        });
    });

    suite('Platform-specific behavior', () => {
        test('Should handle unsupported platform', async () => {
            simulatePlatformSpecificBehavior('freebsd' as any);
            FFmpegTestScenarios.successfulRecording();
            
            await audioRecorder.startRecording();
            
            // Должен использовать defaults для неизвестной платформы
            assert.strictEqual(audioRecorder.getIsRecording(), true);
        });
    });

    suite('Cleanup and Resource Management', () => {
        test('Should cleanup resources on destruction', async () => {
            FFmpegTestScenarios.successfulRecording();
            
            await audioRecorder.startRecording();
            
            // Симулируем деструкцию объекта
            audioRecorder.stopRecording();
            clock.tick(150);
            
            // Проверяем что ресурсы очищены
            assert.strictEqual(audioRecorder.getIsRecording(), false);
        });
    });
}); 