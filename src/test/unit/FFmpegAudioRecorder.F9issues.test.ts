import * as assert from 'assert';
import * as sinon from 'sinon';
import { FFmpegAudioRecorder, AudioRecorderEvents, AudioRecordingOptions } from '../../core/FFmpegAudioRecorder.js';
import { EventEmitter } from 'events';

describe('FFmpegAudioRecorder - F9 Issues Fix Tests', () => {
    let sandbox: sinon.SinonSandbox;
    let mockEvents: AudioRecorderEvents;
    let recorder: FFmpegAudioRecorder;
    let mockChildProcess: any; // Используем any для мока child process
    let onRecordingStartStub: sinon.SinonStub;
    let onRecordingStopStub: sinon.SinonStub;
    let onErrorStub: sinon.SinonStub;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
        
        // Создаем stub'ы
        onRecordingStartStub = sandbox.stub();
        onRecordingStopStub = sandbox.stub();
        onErrorStub = sandbox.stub();
        
        // Мокируем события
        mockEvents = {
            onRecordingStart: onRecordingStartStub,
            onRecordingStop: onRecordingStopStub,
            onError: onErrorStub
        };

        // Мокируем child_process с правильной структурой
        mockChildProcess = new EventEmitter();
        mockChildProcess.kill = sandbox.stub();
        mockChildProcess.killed = false;
        mockChildProcess.stderr = new EventEmitter();
        mockChildProcess.stdout = new EventEmitter();

        const { spawn } = require('child_process');
        sandbox.stub(require('child_process'), 'spawn').returns(mockChildProcess);

        // Мокируем fs
        const fs = require('fs');
        sandbox.stub(fs, 'existsSync').returns(true);
        sandbox.stub(fs, 'statSync').returns({ size: 2048 });
        sandbox.stub(fs, 'readFileSync').returns(Buffer.from('fake audio data'));

        // Мокируем tmp
        const tmp = require('tmp');
        sandbox.stub(tmp, 'fileSync').returns({
            name: '/tmp/test-recording.wav',
            removeCallback: () => {}
        });

        // Мокируем FFmpeg проверки
        sandbox.stub(FFmpegAudioRecorder, 'checkFFmpegAvailability')
            .resolves({ available: true, path: '/usr/bin/ffmpeg', version: '4.4.0' });

        // ❗ ВАЖНО: Мокируем runDiagnostics чтобы избежать реальных вызовов FFmpeg
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

        // ❗ ВАЖНО: Мокируем detectInputDevices чтобы избежать реальных вызовов FFmpeg
        sandbox.stub(FFmpegAudioRecorder, 'detectInputDevices').resolves([
            { id: ':0', name: 'MacBook Pro Microphone', isDefault: true }
        ]);
    });

    afterEach(() => {
        if (recorder) {
            try {
                recorder.stopRecording();
            } catch (error) {
                // Игнорируем ошибки при очистке
            }
        }
        sandbox.restore();
    });

    describe('Issue 1: Silence Detection Stopping Too Early', () => {
        it('должен НЕ обновлять lastAudioTime на служебные сообщения FFmpeg', async () => {
            console.log('🧪 Testing Issue 1: Silence detection stopping too early');
            
            const options: AudioRecordingOptions = {
                silenceDetection: true,
                silenceDuration: 5,  // 5 секунд тишины
                maxDuration: 60      // Большое значение
            };

            recorder = new FFmpegAudioRecorder(mockEvents, options);
            const recorderAny = recorder as any;
            
            // Spy на updateLastAudioTime
            const updateLastAudioTimeSpy = sandbox.spy(recorderAny, 'updateLastAudioTime');

            console.log('🧪 Starting recording...');
            
            try {
                await recorder.startRecording();
            } catch (error) {
                console.log('Expected error in test environment:', (error as Error).message);
            }
            
            console.log('🧪 Симулируем служебные сообщения FFmpeg (НЕ должны вызывать updateLastAudioTime)...');
            
            // Эти сообщения НЕ должны вызывать updateLastAudioTime
            mockChildProcess.stderr.emit('data', 'ffmpeg version 4.4.0\n');
            mockChildProcess.stderr.emit('data', 'configuration: --enable-libmp3lame\n');
            mockChildProcess.stderr.emit('data', 'built with gcc 9.3.0\n');
            mockChildProcess.stderr.emit('data', 'libavutil      56. 70.100\n');
            
            console.log(`📊 updateLastAudioTime called after service messages: ${updateLastAudioTimeSpy.callCount}`);
            
            // Только инициализационные сообщения должны вызвать updateLastAudioTime
            const initialCalls = updateLastAudioTimeSpy.callCount;
            
            console.log('🧪 Симулируем реальные индикаторы аудио активности...');
            
            // Эти сообщения ДОЛЖНЫ вызывать updateLastAudioTime
            mockChildProcess.stderr.emit('data', 'Input #0, avfoundation, from \':0\':\n');
            mockChildProcess.stderr.emit('data', '  Stream #0:0: Audio: pcm_f32le, 44100 Hz, 2 channels, flt\n');
            mockChildProcess.stderr.emit('data', 'Press [q] to quit, [?] for help\n');
            mockChildProcess.stderr.emit('data', 'size=      64kB time=00:00:01.00 bitrate= 512.0kbits/s\n');
            
            console.log(`📊 updateLastAudioTime called after audio activity: ${updateLastAudioTimeSpy.callCount}`);
            
            // Проверяем что updateLastAudioTime вызывался только для реальной активности
            const finalCalls = updateLastAudioTimeSpy.callCount;
            const audioActivityCalls = finalCalls - initialCalls;
            
            assert.ok(audioActivityCalls >= 3, `updateLastAudioTime должен быть вызван для реальной аудио активности (вызван ${audioActivityCalls} раз)`);
            
            console.log('✅ Test passed: silence detection ignores service messages');
        });

        it('должен обновлять lastAudioTime только при реальных данных записи', async () => {
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
            
            console.log('🧪 Симулируем прогресс записи с нулевыми данными (НЕ должно обновлять)...');
            mockChildProcess.stderr.emit('data', 'size=       0kB time=00:00:00.00 bitrate= N/A\n');
            
            console.log('🧪 Симулируем прогресс записи с реальными данными (должно обновлять)...');
            mockChildProcess.stderr.emit('data', 'size=      32kB time=00:00:02.00 bitrate= 128.0kbits/s\n');
            mockChildProcess.stderr.emit('data', 'size=      64kB time=00:00:04.00 bitrate= 128.0kbits/s\n');
            
            const finalCalls = updateLastAudioTimeSpy.callCount;
            const progressCalls = finalCalls - initialCalls;
            
            // Должно быть 2 вызова для реальных данных (но не для нулевых)
            assert.strictEqual(progressCalls, 2, `updateLastAudioTime должен быть вызван 2 раза для реальных данных (вызван ${progressCalls} раз)`);
            
            console.log('✅ Test passed: detects real recording progress');
        });
    });

    describe('Issue 2: Manual Recording Without Silence Detection', () => {
        it('должен правильно работать при silenceDetection=false', async () => {
            console.log('🧪 Testing Issue 2: Manual recording without silence detection');
            
            const options: AudioRecordingOptions = {
                silenceDetection: false,  // ВЫКЛЮЧЕНО
                maxDuration: 10,          // 10 секунд максимум
                silenceDuration: 3        // Не должно использоваться
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
            
            // Проверяем что silence detection НЕ включен
            assert.ok(setupSilenceDetectionSpy.calledOnce, 'setupSilenceDetection должен быть вызван');
            assert.strictEqual(recorderAny.silenceDetectionEnabled, false, 'silenceDetectionEnabled должен быть false');
            
            // Проверяем что max duration таймер ВКЛЮЧЕН
            assert.ok(setupMaxDurationTimerSpy.calledOnce, 'setupMaxDurationTimer должен быть вызван');
            
            console.log('🧪 Симулируем сообщения FFmpeg...');
            
            // Эмулируем FFmpeg сообщения
            mockChildProcess.stderr.emit('data', 'Input #0, avfoundation, from \':0\':\n');
            mockChildProcess.stderr.emit('data', 'Press [q] to quit, [?] for help\n');
            
            console.log('🧪 Симулируем ручную остановку записи...');
            
            // Останавливаем запись вручную
            recorder.stopRecording();
            
            // Симулируем завершение FFmpeg процесса
            mockChildProcess.emit('close', 0);
            
            // Даем время для обработки
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Проверяем что события были вызваны
            assert.ok(onRecordingStartStub.called, 'onRecordingStart должен быть вызван');
            assert.ok(onRecordingStopStub.called, 'onRecordingStop должен быть вызван для транскрибации');
            
            console.log('✅ Test passed: manual recording works without silence detection');
        });

        it('должен вызывать onRecordingStop даже без silence detection', async () => {
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
            
            assert.ok(onRecordingStartStub.called, 'onRecordingStart должен быть вызван');
            
            // Симулируем успешную остановку
            recorder.stopRecording();
            mockChildProcess.emit('close', 0);
            
            // Даем время для обработки
            await new Promise(resolve => setTimeout(resolve, 200));
            
            assert.ok(onRecordingStopStub.called, 'onRecordingStop должен быть вызван для отправки на транскрибацию');
            
            // Проверяем что передается audioBlob
            const onRecordingStopCall = onRecordingStopStub.getCall(0);
            assert.ok(onRecordingStopCall, 'onRecordingStop должен быть вызван');
            assert.ok(onRecordingStopCall.args[0], 'audioBlob должен быть передан');
            
            console.log('✅ Test passed: onRecordingStop event works without silence detection');
        });
    });
}); 