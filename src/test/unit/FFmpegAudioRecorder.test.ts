// FFmpegAudioRecorder.test.ts - Unit тесты для модуля записи аудио через FFmpeg

import * as assert from 'assert';
import * as sinon from 'sinon';
import { FFmpegAudioRecorder, AudioRecorderEvents, AudioRecordingOptions, AudioDevice } from '../../core/FFmpegAudioRecorder';
import { EventEmitter } from 'events';

// Полный мок ChildProcess
class MockChildProcess extends EventEmitter {
    stderr = new EventEmitter();
    stdout = new EventEmitter();
    killed = false;
    
    kill(signal?: string) {
        this.killed = true;
        // Симулируем завершение процесса
        setTimeout(() => {
            this.emit('close', signal === 'SIGKILL' ? -1 : 0);
        }, 10);
        return true;
    }

    simulateSuccess() {
        setTimeout(() => {
            this.emit('close', 0);
        }, 50);
    }

    simulateError(exitCode: number = 1, errorMessage: string = 'Mock error') {
        setTimeout(() => {
            this.stderr.emit('data', errorMessage);
            this.emit('close', exitCode);
        }, 50);
    }
}

// Моки для модулей
let mockChildProcess: {
    spawn: sinon.SinonStub;
};

let mockWhich: sinon.SinonStub;
let mockTmp: {
    fileSync: sinon.SinonStub;
};
let mockFs: {
    existsSync: sinon.SinonStub;
    statSync: sinon.SinonStub;
    readFileSync: sinon.SinonStub;
};

suite('FFmpegAudioRecorder Unit Tests', () => {
    let audioRecorder: FFmpegAudioRecorder;
    let mockEvents: AudioRecorderEvents;
    let clock: sinon.SinonFakeTimers;

    setup(() => {
        // Настройка моков
        clock = sinon.useFakeTimers();
        
        // Мок для child_process
        mockChildProcess = {
            spawn: sinon.stub()
        };
        
        // Мок для which
        mockWhich = sinon.stub().resolves('/usr/local/bin/ffmpeg');
        
        // Мок для tmp
        mockTmp = {
            fileSync: sinon.stub().returns({
                name: '/tmp/test-recording.wav',
                removeCallback: sinon.stub()
            })
        };
        
        // Мок для fs
        mockFs = {
            existsSync: sinon.stub().returns(true),
            statSync: sinon.stub().returns({ size: 1024 }),
            readFileSync: sinon.stub().returns(Buffer.from('mock audio data'))
        };

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
        clock.restore();
        sinon.restore();
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
            const mockProcess = new MockChildProcess();
            mockChildProcess.spawn.returns(mockProcess);
            
            // Симулируем успешный вывод версии
            setTimeout(() => {
                mockProcess.stdout.emit('data', 'ffmpeg version 4.4.0 Copyright (c) 2000-2021');
                mockProcess.emit('close', 0);
            }, 10);
            
            const result = await FFmpegAudioRecorder.checkFFmpegAvailability();
            
            assert.strictEqual(result.available, true);
            assert.ok(result.version);
        });

        test('checkFFmpegAvailability - should handle FFmpeg not found', async () => {
            mockWhich.rejects(new Error('not found'));
            
            const result = await FFmpegAudioRecorder.checkFFmpegAvailability();
            
            assert.strictEqual(result.available, false);
            assert.ok(result.error);
        });

        test('detectInputDevices - should return device list for macOS', async () => {
            const mockProcess = new MockChildProcess();
            mockChildProcess.spawn.returns(mockProcess);
            
            // Симулируем вывод FFmpeg для macOS
            setTimeout(() => {
                const output = `AVFoundation audio devices:
[AVFoundation indev @ 0x7f8b8c004200] [0] MacBook Pro Microphone
[AVFoundation indev @ 0x7f8b8c004200] [1] External Microphone`;
                mockProcess.stderr.emit('data', output);
                mockProcess.emit('close', 0);
            }, 10);

            const devices = await FFmpegAudioRecorder.detectInputDevices();
            
            // Продвигаем время вперед для завершения setTimeout
            clock.tick(50);
            
            assert.ok(Array.isArray(devices));
            assert.strictEqual(devices.length, 2);
            
            const device1 = devices.find(d => d.name === 'MacBook Pro Microphone');
            const device2 = devices.find(d => d.name === 'External Microphone');
            
            assert.ok(device1);
            assert.strictEqual(device1!.id, ':0');
            assert.strictEqual(device1!.isDefault, true);
            
            assert.ok(device2);
            assert.strictEqual(device2!.id, ':1');
            assert.strictEqual(device2!.isDefault, false);
        });

        test('detectInputDevices - should return device list for Windows', async () => {
            const mockProcess = new MockChildProcess();
            mockChildProcess.spawn.returns(mockProcess);
            
            // Симулируем вывод FFmpeg для Windows
            setTimeout(() => {
                const output = `DirectShow video devices:
DirectShow audio devices:
"Microphone (High Definition Audio Device)"
"Line In (High Definition Audio Device)"`;
                mockProcess.stderr.emit('data', output);
                mockProcess.emit('close', 0);
            }, 10);

            const devices = await FFmpegAudioRecorder.detectInputDevices();
            
            clock.tick(50);
            
            assert.ok(Array.isArray(devices));
            assert.strictEqual(devices.length, 2);
            
            const device1 = devices.find(d => d.name === 'Microphone (High Definition Audio Device)');
            const device2 = devices.find(d => d.name === 'Line In (High Definition Audio Device)');
            
            assert.ok(device1);
            assert.strictEqual(device1!.id, 'audio="Microphone (High Definition Audio Device)"');
            assert.strictEqual(device1!.isDefault, true);
            
            assert.ok(device2);
            assert.strictEqual(device2!.id, 'audio="Line In (High Definition Audio Device)"');
        });

        test('detectInputDevices - should return default when no devices found', async () => {
            const mockProcess = new MockChildProcess();
            mockChildProcess.spawn.returns(mockProcess);
            
            // Симулируем пустой вывод
            setTimeout(() => {
                mockProcess.stderr.emit('data', 'No devices found');
                mockProcess.emit('close', 0);
            }, 10);

            const devices = await FFmpegAudioRecorder.detectInputDevices();
            
            clock.tick(50);
            
            assert.ok(Array.isArray(devices));
            assert.strictEqual(devices.length, 1);
            assert.ok(devices[0].name.includes('Default Audio Device'));
            assert.strictEqual(devices[0].isDefault, true);
        });

        test('detectInputDevices - should handle error gracefully', async () => {
            const mockProcess = new MockChildProcess();
            mockChildProcess.spawn.returns(mockProcess);
            
            // Симулируем ошибку процесса
            setTimeout(() => {
                mockProcess.emit('error', new Error('spawn error'));
            }, 10);

            const devices = await FFmpegAudioRecorder.detectInputDevices();
            
            clock.tick(50);
            
            assert.ok(Array.isArray(devices));
            assert.strictEqual(devices.length, 1);
            assert.ok(devices[0].name.includes('Default Audio Device'));
        });
    });

    suite('startRecording', () => {
        test('Should start recording successfully', async () => {
            const mockProcess = new MockChildProcess();
            mockChildProcess.spawn.returns(mockProcess);
            
            // Настраиваем успешную диагностику
            const diagnosticsStub = sinon.stub(FFmpegAudioRecorder, 'runDiagnostics').resolves({
                ffmpegAvailable: { available: true, path: '/usr/bin/ffmpeg' },
                inputDevices: ['MacBook Pro Microphone'],
                platform: 'macos',
                platformCommands: { platform: 'macos', audioInput: '-f avfoundation', defaultDevice: ':0' },
                errors: [],
                warnings: []
            });
            
            // Настраиваем успешное обнаружение устройств
            const devicesStub = sinon.stub(FFmpegAudioRecorder, 'detectInputDevices').resolves([
                { id: ':0', name: 'MacBook Pro Microphone', isDefault: true }
            ]);
            
            const startPromise = audioRecorder.startRecording();
            
            // Симулируем успешный запуск записи
            setTimeout(() => {
                mockProcess.simulateSuccess();
            }, 10);
            
            await startPromise;
            clock.tick(100);
            
            assert.strictEqual(audioRecorder.getIsRecording(), true);
            assert.ok((mockEvents.onRecordingStart as sinon.SinonStub).calledOnce);
            assert.ok(mockTmp.fileSync.calledOnce);
            assert.ok(mockChildProcess.spawn.calledOnce);
            
            diagnosticsStub.restore();
            devicesStub.restore();
        });

        test('Should handle FFmpeg not available', async () => {
            const diagnosticsStub = sinon.stub(FFmpegAudioRecorder, 'runDiagnostics').resolves({
                ffmpegAvailable: { available: false, error: 'FFmpeg not found' },
                inputDevices: [],
                platform: 'macos',
                platformCommands: { platform: 'macos', audioInput: '-f avfoundation', defaultDevice: ':0' },
                errors: ['FFmpeg not found'],
                warnings: []
            });
            
            await audioRecorder.startRecording();
            
            assert.strictEqual(audioRecorder.getIsRecording(), false);
            assert.ok((mockEvents.onError as sinon.SinonStub).calledOnce);
            
            const errorCall = (mockEvents.onError as sinon.SinonStub).getCall(0);
            assert.ok(errorCall.args[0].message.includes('FFmpeg'));
            
            diagnosticsStub.restore();
        });

        test('Should not start if already recording', async () => {
            const mockProcess = new MockChildProcess();
            mockChildProcess.spawn.returns(mockProcess);
            
            const diagnosticsStub = sinon.stub(FFmpegAudioRecorder, 'runDiagnostics').resolves({
                ffmpegAvailable: { available: true, path: '/usr/bin/ffmpeg' },
                inputDevices: ['Test Device'],
                platform: 'macos',
                platformCommands: { platform: 'macos', audioInput: '-f avfoundation', defaultDevice: ':0' },
                errors: [],
                warnings: []
            });
            
            const devicesStub = sinon.stub(FFmpegAudioRecorder, 'detectInputDevices').resolves([
                { id: ':0', name: 'Test Device', isDefault: true }
            ]);
            
            // Запускаем первую запись
            await audioRecorder.startRecording();
            clock.tick(50);
            
            assert.strictEqual(audioRecorder.getIsRecording(), true);
            
            // Пытаемся запустить вторую запись
            try {
                await audioRecorder.startRecording();
                assert.fail('Should have thrown an error');
            } catch (error) {
                assert.ok((error as Error).message.includes('already in progress'));
            }
            
            // События должны быть вызваны только один раз
            assert.strictEqual((mockEvents.onRecordingStart as sinon.SinonStub).callCount, 1);
            
            diagnosticsStub.restore();
            devicesStub.restore();
        });
    });

    suite('stopRecording', () => {
        test('Should stop recording successfully', async () => {
            const mockProcess = new MockChildProcess();
            mockChildProcess.spawn.returns(mockProcess);
            
            const diagnosticsStub = sinon.stub(FFmpegAudioRecorder, 'runDiagnostics').resolves({
                ffmpegAvailable: { available: true, path: '/usr/bin/ffmpeg' },
                inputDevices: ['Test Device'],
                platform: 'macos',
                platformCommands: { platform: 'macos', audioInput: '-f avfoundation', defaultDevice: ':0' },
                errors: [],
                warnings: []
            });
            
            const devicesStub = sinon.stub(FFmpegAudioRecorder, 'detectInputDevices').resolves([
                { id: ':0', name: 'Test Device', isDefault: true }
            ]);
            
            // Начинаем запись
            await audioRecorder.startRecording();
            clock.tick(50);
            
            assert.strictEqual(audioRecorder.getIsRecording(), true);
            
            // Останавливаем запись
            audioRecorder.stopRecording();
            
            // Симулируем завершение процесса
            setTimeout(() => {
                mockProcess.emit('close', 0);
            }, 100);
            
            clock.tick(200);
            
            assert.strictEqual(audioRecorder.getIsRecording(), false);
            
            diagnosticsStub.restore();
            devicesStub.restore();
        });

        test('Should handle stop when not recording', () => {
            audioRecorder.stopRecording();
            
            assert.strictEqual(audioRecorder.getIsRecording(), false);
            // Не должно быть ошибок или событий
            assert.ok((mockEvents.onError as sinon.SinonStub).notCalled);
        });
    });

    suite('Error Handling', () => {
        test('Should handle recording process error', async () => {
            const mockProcess = new MockChildProcess();
            mockChildProcess.spawn.returns(mockProcess);
            
            const diagnosticsStub = sinon.stub(FFmpegAudioRecorder, 'runDiagnostics').resolves({
                ffmpegAvailable: { available: true, path: '/usr/bin/ffmpeg' },
                inputDevices: ['Test Device'],
                platform: 'macos',
                platformCommands: { platform: 'macos', audioInput: '-f avfoundation', defaultDevice: ':0' },
                errors: [],
                warnings: []
            });
            
            const devicesStub = sinon.stub(FFmpegAudioRecorder, 'detectInputDevices').resolves([
                { id: ':0', name: 'Test Device', isDefault: true }
            ]);
            
            await audioRecorder.startRecording();
            
            // Симулируем ошибку процесса
            setTimeout(() => {
                mockProcess.emit('error', new Error('Process error'));
            }, 50);
            
            clock.tick(100);
            
            assert.strictEqual(audioRecorder.getIsRecording(), false);
            assert.ok((mockEvents.onError as sinon.SinonStub).calledOnce);
            
            diagnosticsStub.restore();
            devicesStub.restore();
        });
    });

    suite('Compatibility Methods', () => {
        test('getSupportedMimeTypes - should return array of supported types', () => {
            const mimeTypes = audioRecorder.getSupportedMimeTypes();
            
            assert.ok(Array.isArray(mimeTypes));
            assert.ok(mimeTypes.includes('audio/wav'));
            assert.ok(mimeTypes.includes('audio/mpeg'));
            assert.ok(mimeTypes.includes('audio/ogg; codecs=opus'));
            assert.ok(mimeTypes.includes('audio/webm'));
        });

        test('checkBrowserCompatibility - should check Node.js modules', () => {
            const result = FFmpegAudioRecorder.checkBrowserCompatibility();
            
            assert.ok(typeof result.supported === 'boolean');
            assert.ok(Array.isArray(result.missing));
        });

        test('checkMicrophonePermission - should check FFmpeg and devices', async () => {
            const ffmpegStub = sinon.stub(FFmpegAudioRecorder, 'checkFFmpegAvailability').resolves({
                available: true,
                path: '/usr/bin/ffmpeg'
            });
            
            const devicesStub = sinon.stub(FFmpegAudioRecorder, 'detectInputDevices').resolves([
                { id: ':0', name: 'Test Device', isDefault: true }
            ]);
            
            const result = await FFmpegAudioRecorder.checkMicrophonePermission();
            
            assert.strictEqual(result.state, 'granted');
            assert.strictEqual(result.available, true);
            
            ffmpegStub.restore();
            devicesStub.restore();
        });
    });

    suite('Diagnostics', () => {
        test('runDiagnostics - should return comprehensive system info', async () => {
            const ffmpegStub = sinon.stub(FFmpegAudioRecorder, 'checkFFmpegAvailability').resolves({
                available: true,
                version: '4.4.0',
                path: '/usr/bin/ffmpeg'
            });
            
            const devicesStub = sinon.stub(FFmpegAudioRecorder, 'detectInputDevices').resolves([
                { id: ':0', name: 'MacBook Pro Microphone', isDefault: true },
                { id: ':1', name: 'External Microphone', isDefault: false }
            ]);
            
            const result = await FFmpegAudioRecorder.runDiagnostics();
            
            assert.ok(result.ffmpegAvailable);
            assert.strictEqual(result.ffmpegAvailable.available, true);
            assert.ok(Array.isArray(result.inputDevices));
            assert.strictEqual(result.inputDevices.length, 2);
            assert.ok(result.platform);
            assert.ok(result.platformCommands);
            assert.ok(Array.isArray(result.errors));
            assert.ok(Array.isArray(result.warnings));
            
            ffmpegStub.restore();
            devicesStub.restore();
        });
    });
}); 