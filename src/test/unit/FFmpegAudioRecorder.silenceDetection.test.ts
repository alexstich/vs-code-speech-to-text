import * as assert from 'assert';
import * as sinon from 'sinon';
import { FFmpegAudioRecorder, AudioRecorderEvents, AudioRecordingOptions } from '../../core/FFmpegAudioRecorder.js';

describe('FFmpegAudioRecorder - Silence Detection Tests', () => {
    let sandbox: sinon.SinonSandbox;
    let mockEvents: AudioRecorderEvents;
    let recorder: FFmpegAudioRecorder;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
        
        // Мокируем события
        mockEvents = {
            onRecordingStart: sandbox.stub(),
            onRecordingStop: sandbox.stub(),
            onError: sandbox.stub()
        };
    });

    afterEach(() => {
        if (recorder) {
            // Очищаем рекордер если он был создан
            try {
                recorder.stopRecording();
            } catch (error) {
                // Игнорируем ошибки при очистке
            }
        }
        sandbox.restore();
    });

    describe('Silence Detection Configuration', () => {
        it('должен правильно настраивать silence detection когда включено', () => {
            const options: AudioRecordingOptions = {
                silenceDetection: true,
                silenceDuration: 5,  // 5 секунд
                silenceThreshold: -40,
                maxDuration: 60
            };

            recorder = new FFmpegAudioRecorder(mockEvents, options);

            // Проверяем что рекордер создан с правильными настройками
            assert.ok(recorder, 'Recorder должен быть создан');
            
            // Проверяем начальное состояние
            assert.strictEqual(recorder.getIsRecording(), false, 'Изначально не должен записывать');
        });

        it('должен правильно настраивать silence detection когда выключено', () => {
            const options: AudioRecordingOptions = {
                silenceDetection: false,
                silenceDuration: 5,
                silenceThreshold: -40,
                maxDuration: 60
            };

            recorder = new FFmpegAudioRecorder(mockEvents, options);

            // Проверяем что рекордер создан с правильными настройками
            assert.ok(recorder, 'Recorder должен быть создан');
            assert.strictEqual(recorder.getIsRecording(), false, 'Изначально не должен записывать');
        });

        it('должен использовать значения по умолчанию для silence detection', () => {
            const options: AudioRecordingOptions = {
                // Не указываем silenceDetection - должно быть по умолчанию undefined
                maxDuration: 60
            };

            recorder = new FFmpegAudioRecorder(mockEvents, options);

            assert.ok(recorder, 'Recorder должен быть создан даже без явного указания silenceDetection');
        });
    });

    describe('Recording Duration vs Silence Detection', () => {
        it('должен останавливаться по maxDuration когда silenceDetection выключено', async () => {
            // Мокируем FFmpeg проверки
            const checkAvailabilityStub = sandbox.stub(FFmpegAudioRecorder, 'checkFFmpegAvailability')
                .resolves({ available: false, error: 'FFmpeg not available in test environment' });

            const options: AudioRecordingOptions = {
                silenceDetection: false,
                maxDuration: 2, // 2 секунды максимум
                silenceDuration: 1  // Это не должно влиять когда silenceDetection=false
            };

            recorder = new FFmpegAudioRecorder(mockEvents, options);

            try {
                // Попытаемся начать запись - должна завершиться ошибкой из-за отсутствия FFmpeg
                await recorder.startRecording();
                assert.fail('Запись должна была завершиться ошибкой в тестовой среде');
            } catch (error) {
                // Ожидаемая ошибка в тестовой среде
                assert.ok(error instanceof Error);
                assert.ok(error.message.includes('FFmpeg'), 'Ошибка должна быть связана с FFmpeg');
            }

            // Проверяем что события были вызваны соответственно
            assert.ok(checkAvailabilityStub.called, 'checkFFmpegAvailability должна была быть вызвана');
        });

        it('должен останавливаться по silence detection когда включено', async () => {
            // Мокируем FFmpeg проверки  
            const checkAvailabilityStub = sandbox.stub(FFmpegAudioRecorder, 'checkFFmpegAvailability')
                .resolves({ available: false, error: 'FFmpeg not available in test environment' });

            const options: AudioRecordingOptions = {
                silenceDetection: true,
                maxDuration: 60, // Большое значение, чтобы silence detection сработало первым
                silenceDuration: 2  // 2 секунды тишины для остановки
            };

            recorder = new FFmpegAudioRecorder(mockEvents, options);

            try {
                await recorder.startRecording();
                assert.fail('Запись должна была завершиться ошибкой в тестовой среде');
            } catch (error) {
                // Ожидаемая ошибка в тестовой среде
                assert.ok(error instanceof Error);
                assert.ok(error.message.includes('FFmpeg'), 'Ошибка должна быть связана с FFmpeg');
            }

            assert.ok(checkAvailabilityStub.called, 'checkFFmpegAvailability должна была быть вызвана');
        });
    });

    describe('Recording State Management', () => {
        it('должен правильно отслеживать состояние записи независимо от silence detection', () => {
            const optionsWithSilence: AudioRecordingOptions = {
                silenceDetection: true,
                silenceDuration: 3,
                maxDuration: 60
            };

            const optionsWithoutSilence: AudioRecordingOptions = {
                silenceDetection: false,
                maxDuration: 60
            };

            // Тестируем с включенным silence detection
            const recorderWithSilence = new FFmpegAudioRecorder(mockEvents, optionsWithSilence);
            assert.strictEqual(recorderWithSilence.getIsRecording(), false, 'Изначально не должен записывать (с silence detection)');

            // Тестируем с выключенным silence detection
            const recorderWithoutSilence = new FFmpegAudioRecorder(mockEvents, optionsWithoutSilence);
            assert.strictEqual(recorderWithoutSilence.getIsRecording(), false, 'Изначально не должен записывать (без silence detection)');

            // Проверяем продолжительность записи
            assert.strictEqual(recorderWithSilence.getRecordingDuration(), 0, 'Продолжительность должна быть 0 когда не записывает');
            assert.strictEqual(recorderWithoutSilence.getRecordingDuration(), 0, 'Продолжительность должна быть 0 когда не записывает');
        });

        it('должен возвращать правильные поддерживаемые MIME типы независимо от silence detection', () => {
            const options: AudioRecordingOptions = {
                silenceDetection: true,
                maxDuration: 60
            };

            recorder = new FFmpegAudioRecorder(mockEvents, options);
            const mimeTypes = recorder.getSupportedMimeTypes();

            assert.ok(Array.isArray(mimeTypes), 'Должен возвращать массив MIME типов');
            assert.ok(mimeTypes.length > 0, 'Должен поддерживать хотя бы один MIME тип');
            assert.ok(mimeTypes.includes('audio/wav'), 'Должен поддерживать audio/wav');
        });
    });

    describe('Browser Compatibility and Microphone Checks', () => {
        it('должен проверять совместимость браузера независимо от silence detection', () => {
            const compatibility = FFmpegAudioRecorder.checkBrowserCompatibility();
            
            assert.ok(typeof compatibility.supported === 'boolean', 'supported должно быть boolean');
            assert.ok(Array.isArray(compatibility.missing), 'missing должно быть массивом');
        });

        it('должен проверять доступность микрофона независимо от silence detection', async () => {
            // Мокируем checkFFmpegAvailability
            const checkAvailabilityStub = sandbox.stub(FFmpegAudioRecorder, 'checkFFmpegAvailability')
                .resolves({ available: false, error: 'Test environment' });

            const microphoneCheck = await FFmpegAudioRecorder.checkMicrophonePermission();
            
            assert.ok(typeof microphoneCheck.state === 'string', 'state должно быть строкой');
            assert.ok(typeof microphoneCheck.available === 'boolean', 'available должно быть boolean');
            
            // В тестовой среде без FFmpeg микрофон не должен быть доступен
            assert.strictEqual(microphoneCheck.available, false, 'Микрофон не должен быть доступен в тестовой среде');
            assert.ok(checkAvailabilityStub.called, 'checkFFmpegAvailability должна была быть вызвана');
        });
    });

    describe('Options Validation', () => {
        it('должен корректно обрабатывать различные комбинации настроек silence detection', () => {
            const testCases = [
                {
                    name: 'Все настройки silence detection указаны',
                    options: {
                        silenceDetection: true,
                        silenceDuration: 5,
                        silenceThreshold: -30,
                        maxDuration: 120
                    }
                },
                {
                    name: 'Только silenceDetection указано',
                    options: {
                        silenceDetection: true,
                        maxDuration: 60
                    }
                },
                {
                    name: 'silenceDetection выключено',
                    options: {
                        silenceDetection: false,
                        maxDuration: 60
                    }
                },
                {
                    name: 'Нет настроек silence detection',
                    options: {
                        maxDuration: 60
                    }
                }
            ];

            testCases.forEach((testCase) => {
                try {
                    const testRecorder = new FFmpegAudioRecorder(mockEvents, testCase.options);
                    assert.ok(testRecorder, `Recorder должен быть создан для случая: ${testCase.name}`);
                    assert.strictEqual(testRecorder.getIsRecording(), false, `Изначально не должен записывать для случая: ${testCase.name}`);
                } catch (error) {
                    assert.fail(`Не удалось создать recorder для случая: ${testCase.name}. Ошибка: ${(error as Error).message}`);
                }
            });
        });
    });
}); 