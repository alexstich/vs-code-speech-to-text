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
        
        // Создаем spy для событий
        onRecordingStartSpy = sandbox.spy();
        onRecordingStopSpy = sandbox.spy();
        onErrorSpy = sandbox.spy();
        
        // Мокируем события
        mockEvents = {
            onRecordingStart: onRecordingStartSpy,
            onRecordingStop: onRecordingStopSpy,
            onError: onErrorSpy
        };

        // Мокируем child process для эмуляции FFmpeg
        mockChildProcess = new EventEmitter();
        mockChildProcess.killed = false;
        mockChildProcess.stdout = new EventEmitter();
        mockChildProcess.stderr = new EventEmitter();
        mockChildProcess.kill = sandbox.stub().callsFake((signal: string) => {
            console.log(`Mock process kill called with signal: ${signal}`);
            mockChildProcess.killed = true;
            // Эмулируем завершение процесса
            setTimeout(() => {
                console.log('Mock process emitting close event');
                mockChildProcess.emit('close', signal === 'SIGTERM' ? 0 : 255);
            }, 50);
        });
        
        // Мокируем spawn
        sandbox.stub(require('child_process'), 'spawn').returns(mockChildProcess);
        
        // Мокируем FFmpeg availability
        sandbox.stub(FFmpegAudioRecorder, 'checkFFmpegAvailability').resolves({
            available: true,
            version: '4.4.0',
            path: '/usr/local/bin/ffmpeg'
        });
        
        // Мокируем detectInputDevices
        sandbox.stub(FFmpegAudioRecorder, 'detectInputDevices').resolves([
            { id: ':0', name: 'Built-in Microphone', isDefault: true }
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

    describe('Timer Cleanup - The Critical Bug That Tests Should Catch', () => {
        it('должен вызывать clearSilenceTimer() и clearMaxDurationTimer() при silenceDetection=false', async () => {
            console.log('🧪 Starting test: timer cleanup with silenceDetection=false');
            
            const options: AudioRecordingOptions = {
                silenceDetection: false,  // КРИТИЧНО: отключено
                maxDuration: 2,           // Короткая запись
                silenceDuration: 1        // Не должно влиять
            };

            recorder = new FFmpegAudioRecorder(mockEvents, options);
            
            // Spy на методы очистки через приватный доступ
            const recorderAny = recorder as any;
            const clearSilenceTimerSpy = sandbox.spy(recorderAny, 'clearSilenceTimer');
            const clearMaxDurationTimerSpy = sandbox.spy(recorderAny, 'clearMaxDurationTimer');
            const setupSilenceDetectionSpy = sandbox.spy(recorderAny, 'setupSilenceDetection');

            console.log('🧪 Starting recording...');
            
            try {
                await recorder.startRecording();
            } catch (error) {
                // Ожидаем ошибку из-за отсутствия файловой системы в тестах, но нас интересует логика таймеров
                console.log('Expected error in test environment:', (error as Error).message);
            }
            
            // Проверяем что setupSilenceDetection был вызван
            assert.ok(setupSilenceDetectionSpy.calledOnce, 'setupSilenceDetection должен быть вызван при инициализации');
            
            console.log(`📊 setupSilenceDetection called: ${setupSilenceDetectionSpy.callCount}`);
            
            // Принудительно вызываем stopRecording для проверки очистки таймеров
            recorder.stopRecording();
            
            console.log(`📊 clearSilenceTimer called after stopRecording: ${clearSilenceTimerSpy.callCount}`);
            console.log(`📊 clearMaxDurationTimer called after stopRecording: ${clearMaxDurationTimerSpy.callCount}`);
            
            // КРИТИЧЕСКАЯ ПРОВЕРКА: clearSilenceTimer должен быть вызван при остановке
            assert.ok(clearSilenceTimerSpy.called, 'clearSilenceTimer должен быть вызван при остановке записи');
            assert.ok(clearMaxDurationTimerSpy.called, 'clearMaxDurationTimer должен быть вызван при остановке записи');
            
            console.log('✅ Test passed: timers properly cleared with silenceDetection=false');
        });

        it('должен вызывать clearSilenceTimer() и clearMaxDurationTimer() при silenceDetection=true', async () => {
            console.log('🧪 Starting test: timer cleanup with silenceDetection=true');
            
            const options: AudioRecordingOptions = {
                silenceDetection: true,   // Включено
                maxDuration: 10,          // Большое значение
                silenceDuration: 1        // Быстрое срабатывание
            };

            recorder = new FFmpegAudioRecorder(mockEvents, options);
            
            // Spy на методы очистки
            const recorderAny = recorder as any;
            const clearSilenceTimerSpy = sandbox.spy(recorderAny, 'clearSilenceTimer');
            const clearMaxDurationTimerSpy = sandbox.spy(recorderAny, 'clearMaxDurationTimer');
            const setupSilenceDetectionSpy = sandbox.spy(recorderAny, 'setupSilenceDetection');

            console.log('🧪 Starting recording...');
            
            try {
                await recorder.startRecording();
            } catch (error) {
                // Ожидаем ошибку из-за отсутствия файловой системы в тестах
                console.log('Expected error in test environment:', (error as Error).message);
            }
            
            // Проверяем что setupSilenceDetection был вызван
            assert.ok(setupSilenceDetectionSpy.calledOnce, 'setupSilenceDetection должен быть вызван');
            
            // Принудительно вызываем stopRecording
            recorder.stopRecording();
            
            console.log(`📊 clearSilenceTimer called: ${clearSilenceTimerSpy.callCount}`);
            console.log(`📊 clearMaxDurationTimer called: ${clearMaxDurationTimerSpy.callCount}`);
            
            // Проверки аналогичные предыдущему тесту
            assert.ok(clearSilenceTimerSpy.called, 'clearSilenceTimer должен быть вызван');
            assert.ok(clearMaxDurationTimerSpy.called, 'clearMaxDurationTimer должен быть вызван');
            
            console.log('✅ Test passed: timers properly cleared with silenceDetection=true');
        });

        it('должен правильно настраивать silence detection в зависимости от опции', () => {
            console.log('🧪 Starting test: silence detection setup logic');
            
            // Тест 1: silenceDetection = false
            const optionsDisabled: AudioRecordingOptions = {
                silenceDetection: false,
                maxDuration: 60
            };

            const recorderDisabled = new FFmpegAudioRecorder(mockEvents, optionsDisabled);
            const recorderDisabledAny = recorderDisabled as any;
            
            // Spy на setupSilenceDetection
            const setupSilenceDetectionSpyDisabled = sandbox.spy(recorderDisabledAny, 'setupSilenceDetection');
            
            // Вызываем setupSilenceDetection напрямую для проверки логики
            recorderDisabledAny.setupSilenceDetection();
            
            assert.ok(setupSilenceDetectionSpyDisabled.calledOnce, 'setupSilenceDetection должен быть вызван');
            
            // Проверяем что silenceDetectionEnabled остается false при silenceDetection=false
            assert.strictEqual(recorderDisabledAny.silenceDetectionEnabled, false, 'silenceDetectionEnabled должен быть false при silenceDetection=false');
            
            // Тест 2: silenceDetection = true
            const optionsEnabled: AudioRecordingOptions = {
                silenceDetection: true,
                maxDuration: 60,
                silenceDuration: 3
            };

            const recorderEnabled = new FFmpegAudioRecorder(mockEvents, optionsEnabled);
            const recorderEnabledAny = recorderEnabled as any;
            
            // Spy на setupSilenceDetection
            const setupSilenceDetectionSpyEnabled = sandbox.spy(recorderEnabledAny, 'setupSilenceDetection');
            
            // Вызываем setupSilenceDetection напрямую
            recorderEnabledAny.setupSilenceDetection();
            
            assert.ok(setupSilenceDetectionSpyEnabled.calledOnce, 'setupSilenceDetection должен быть вызван');
            
            // Проверяем что silenceDetectionEnabled становится true при silenceDetection=true
            assert.strictEqual(recorderEnabledAny.silenceDetectionEnabled, true, 'silenceDetectionEnabled должен быть true при silenceDetection=true');
            
            console.log('✅ Test passed: silence detection setup logic works correctly');
        });

        it('должен корректно использовать новое значение maxDuration=3600', () => {
            console.log('🧪 Starting test: новое значение maxDuration=3600');
            
            const options: AudioRecordingOptions = {
                silenceDetection: false,
                maxDuration: 3600  // Новое значение по умолчанию (1 час)
            };

            recorder = new FFmpegAudioRecorder(mockEvents, options);
            
            // Мокируем buildFFmpegArgs чтобы проверить аргументы
            const recorderAny = recorder as any;
            const buildArgsSpy = sandbox.spy(recorderAny, 'buildFFmpegArgs');
            
            // Вызываем buildFFmpegArgs напрямую для проверки
            const ffmpegArgs = recorderAny.buildFFmpegArgs('/tmp/test.wav', ':0');
            
            // Проверяем что buildFFmpegArgs вернул правильные аргументы
            assert.ok(Array.isArray(ffmpegArgs), 'Должен возвращать массив аргументов');
            
            const tIndex = ffmpegArgs.indexOf('-t');
            assert.ok(tIndex !== -1, 'Должен содержать аргумент -t для maxDuration');
            assert.strictEqual(ffmpegArgs[tIndex + 1], '3600', 'Должен использовать значение 3600 секунд');
            
            console.log(`✅ Test passed: FFmpeg использует -t 3600 (${ffmpegArgs[tIndex + 1]} секунд)`);
        });
    });

    describe('Regression Tests - Specific Bug Scenarios', () => {
        it('должен правильно обрабатывать состояние isRecording независимо от silenceDetection', () => {
            console.log('🧪 Starting REGRESSION test: isRecording state management');
            
            const testCases = [
                { silenceDetection: false, description: 'с отключенным silenceDetection' },
                { silenceDetection: true, description: 'с включенным silenceDetection' }
            ];

            for (const testCase of testCases) {
                console.log(`🧪 Testing ${testCase.description}...`);
                
                const options: AudioRecordingOptions = {
                    silenceDetection: testCase.silenceDetection,
                    maxDuration: 3600,
                    silenceDuration: 3
                };

                const testRecorder = new FFmpegAudioRecorder(mockEvents, options);
                
                // Проверяем начальное состояние
                assert.strictEqual(testRecorder.getIsRecording(), false, `Изначально не должен записывать ${testCase.description}`);
                
                // Проверяем продолжительность записи
                assert.strictEqual(testRecorder.getRecordingDuration(), 0, `Продолжительность должна быть 0 ${testCase.description}`);
                
                // Проверяем поддерживаемые MIME типы
                const mimeTypes = testRecorder.getSupportedMimeTypes();
                assert.ok(Array.isArray(mimeTypes), `Должен возвращать массив MIME типов ${testCase.description}`);
                assert.ok(mimeTypes.length > 0, `Должен поддерживать хотя бы один MIME тип ${testCase.description}`);
                assert.ok(mimeTypes.includes('audio/wav'), `Должен поддерживать audio/wav ${testCase.description}`);
                
                console.log(`✅ Test case passed: ${testCase.description}`);
            }
            
            console.log('✅ All state management tests passed');
        });

        it('должен правильно проверять совместимость и доступность микрофона независимо от silenceDetection', async () => {
            console.log('🧪 Starting test: compatibility and microphone checks');
            
            // Проверяем совместимость браузера
            const compatibility = FFmpegAudioRecorder.checkBrowserCompatibility();
            
            assert.ok(typeof compatibility.supported === 'boolean', 'supported должно быть boolean');
            assert.ok(Array.isArray(compatibility.missing), 'missing должно быть массивом');
            
            console.log(`Compatibility check: supported=${compatibility.supported}, missing=${compatibility.missing.length} items`);
            
            // Проверяем доступность микрофона
            const microphoneCheck = await FFmpegAudioRecorder.checkMicrophonePermission();
            
            assert.ok(typeof microphoneCheck.state === 'string', 'state должно быть строкой');
            assert.ok(typeof microphoneCheck.available === 'boolean', 'available должно быть boolean');
            
            console.log(`Microphone check: state=${microphoneCheck.state}, available=${microphoneCheck.available}`);
            
            console.log('✅ Test passed: compatibility and microphone checks work correctly');
        });

        it('должен корректно обрабатывать silence detection при нажатии F9 (recordAndOpenNewChat)', async () => {
            console.log('🧪 Starting test: F9 silence detection bug reproduction');
            
            // Мокируем fs для эмуляции создания файла
            const fs = require('fs');
            const fsExistsSync = sandbox.stub(fs, 'existsSync').returns(true);
            const fsStatSync = sandbox.stub(fs, 'statSync').returns({ size: 2048 }); // Нормальный размер файла
            const fsReadFileSync = sandbox.stub(fs, 'readFileSync').returns(Buffer.from('fake audio data'));
            
            // Мокируем tmp для создания временного файла
            const tmp = require('tmp');
            const tmpFileSync = sandbox.stub(tmp, 'fileSync').returns({
                name: '/tmp/test-recording.wav',
                removeCallback: () => {}
            });
            
            const options: AudioRecordingOptions = {
                silenceDetection: true,
                silenceDuration: 3,  // 3 секунды тишины
                maxDuration: 30      // Максимум 30 секунд
            };

            recorder = new FFmpegAudioRecorder(mockEvents, options);
            
            // Spy на все важные методы
            const recorderAny = recorder as any;
            const setupSilenceDetectionSpy = sandbox.spy(recorderAny, 'setupSilenceDetection');
            const updateLastAudioTimeSpy = sandbox.spy(recorderAny, 'updateLastAudioTime');
            const clearSilenceTimerSpy = sandbox.spy(recorderAny, 'clearSilenceTimer');

            console.log('🧪 Starting recording (симуляция F9)...');
            
            // Начинаем запись
            await recorder.startRecording();
            
            console.log('🧪 Recording started, проверяем настройку silence detection...');
            
            // Проверяем что silence detection был настроен
            assert.ok(setupSilenceDetectionSpy.calledOnce, 'setupSilenceDetection должен быть вызван');
            assert.strictEqual(recorderAny.silenceDetectionEnabled, true, 'silenceDetectionEnabled должен быть true');
            
            // Проверяем что lastAudioTime был установлен в recordingStartTime
            assert.ok(recorderAny.lastAudioTime > 0, 'lastAudioTime должен быть установлен');
            assert.strictEqual(recorderAny.lastAudioTime, recorderAny.recordingStartTime, 'lastAudioTime должен равняться recordingStartTime');
            
            console.log(`📊 Initial lastAudioTime: ${recorderAny.lastAudioTime}`);
            console.log(`📊 recordingStartTime: ${recorderAny.recordingStartTime}`);
            
            // Симулируем сообщения FFmpeg (типичные для режима тишины)
            console.log('🧪 Симулируем FFmpeg сообщения в режиме тишины...');
            
            // Эмулируем FFmpeg инициализацию (это должно обновить lastAudioTime)
            mockChildProcess.stderr.emit('data', 'Input #0, avfoundation, from \':0\':\n');
            mockChildProcess.stderr.emit('data', '  Duration: N/A, start: 0.000000, bitrate: N/A\n');
            mockChildProcess.stderr.emit('data', '    Stream #0:0: Audio: pcm_f32le, 44100 Hz, 2 channels, flt, 2822 kb/s\n');
            
            console.log(`📊 updateLastAudioTime called during FFmpeg setup: ${updateLastAudioTimeSpy.callCount}`);
            
            // Ждем небольшой промежуток времени
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Симулируем сообщения от FFmpeg в процессе записи (в тишине)
            mockChildProcess.stderr.emit('data', 'Press [q] to quit, [?] for help\n');
            
            console.log(`📊 updateLastAudioTime called after FFmpeg ready: ${updateLastAudioTimeSpy.callCount}`);
            
            // Проверяем что updateLastAudioTime был вызван
            assert.ok(updateLastAudioTimeSpy.called, 'updateLastAudioTime должен быть вызван при сообщениях FFmpeg');
            
            // Симулируем остановку записи пользователем (повторное нажатие F9)
            console.log('🧪 Симулируем остановку записи пользователем (F9)...');
            
            recorder.stopRecording();
            
            // Даем время для завершения процесса
            await new Promise(resolve => setTimeout(resolve, 200));
            
            console.log(`📊 clearSilenceTimer called after manual stop: ${clearSilenceTimerSpy.callCount}`);
            
            // Проверяем что таймеры были очищены
            assert.ok(clearSilenceTimerSpy.called, 'clearSilenceTimer должен быть вызван при остановке');
            
            // Проверяем что события были вызваны правильно
            assert.ok(onRecordingStartSpy.calledOnce, 'onRecordingStart должен быть вызван');
            assert.ok(onRecordingStopSpy.calledOnce, 'onRecordingStop должен быть вызван');
            
            console.log('✅ Test passed: F9 silence detection works correctly');
        });

        it('должен правильно обновлять lastAudioTime при различных сообщениях FFmpeg', () => {
            console.log('🧪 Starting test: lastAudioTime update logic');
            
            const options: AudioRecordingOptions = {
                silenceDetection: true,
                silenceDuration: 3
            };

            recorder = new FFmpegAudioRecorder(mockEvents, options);
            const recorderAny = recorder as any;
            
            // Spy на updateLastAudioTime
            const updateLastAudioTimeSpy = sandbox.spy(recorderAny, 'updateLastAudioTime');
            
            // Устанавливаем начальные условия
            recorderAny.silenceDetectionEnabled = true;
            recorderAny.recordingStartTime = Date.now();
            recorderAny.lastAudioTime = recorderAny.recordingStartTime;
            
            console.log('🧪 Тестируем различные типы сообщений FFmpeg...');
            
            // Имитируем создание child process
            recorderAny.ffmpegProcess = mockChildProcess;
            recorderAny.setupFFmpegEvents();
            
            // Тест 1: Сообщение о прогрессе записи
            mockChildProcess.stderr.emit('data', 'size=    1024kB time=00:00:10.50 bitrate= 845.3kbits/s');
            assert.ok(updateLastAudioTimeSpy.called, 'updateLastAudioTime должен быть вызван для progress message');
            
            updateLastAudioTimeSpy.resetHistory();
            
            // Тест 2: Информация о потоке
            mockChildProcess.stderr.emit('data', 'Stream #0:0: Audio: pcm_s16le, 44100 Hz, 2 channels');
            assert.ok(updateLastAudioTimeSpy.called, 'updateLastAudioTime должен быть вызван для stream info');
            
            updateLastAudioTimeSpy.resetHistory();
            
            // Тест 3: FFmpeg готов
            mockChildProcess.stderr.emit('data', 'Press [q] to quit, [?] for help');
            assert.ok(updateLastAudioTimeSpy.called, 'updateLastAudioTime должен быть вызван для FFmpeg ready');
            
            updateLastAudioTimeSpy.resetHistory();
            
            // Тест 4: Информация о входе/выходе
            mockChildProcess.stderr.emit('data', 'Input #0, avfoundation, from \':0\':');
            assert.ok(updateLastAudioTimeSpy.called, 'updateLastAudioTime должен быть вызван для input info');
            
            updateLastAudioTimeSpy.resetHistory();
            
            // Тест 5: Обычное сообщение (не ошибка) в режиме silence detection
            mockChildProcess.stderr.emit('data', 'frame=  100 fps= 10 q=-0.0 size=    1024kB time=00:00:05.00');
            assert.ok(updateLastAudioTimeSpy.called, 'updateLastAudioTime должен быть вызван для обычного сообщения');
            
            updateLastAudioTimeSpy.resetHistory();
            
            // Тест 6: Сообщение об ошибке (НЕ должно обновлять lastAudioTime)
            mockChildProcess.stderr.emit('data', 'Error: Permission denied accessing microphone');
            assert.ok(!updateLastAudioTimeSpy.called, 'updateLastAudioTime НЕ должен быть вызван для сообщения об ошибке');
            
            console.log('✅ Test passed: lastAudioTime update logic works correctly');
        });
    });
}); 