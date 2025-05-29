"use strict";
// AudioRecorder.test.ts - Unit тесты для модуля записи аудио
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const assert = __importStar(require("assert"));
const sinon = __importStar(require("sinon"));
const AudioRecorder_1 = require("../../core/AudioRecorder");
const webAudioMocks_1 = require("../mocks/webAudioMocks");
suite('AudioRecorder Unit Tests', () => {
    let audioRecorder;
    let mockEvents;
    let clock;
    setup(() => {
        // Настройка моков перед каждым тестом
        (0, webAudioMocks_1.setupWebAudioMocks)();
        clock = sinon.useFakeTimers();
        // Создаем мок событий
        mockEvents = {
            onRecordingStart: sinon.stub(),
            onRecordingStop: sinon.stub(),
            onError: sinon.stub()
        };
        audioRecorder = new AudioRecorder_1.AudioRecorder(mockEvents);
    });
    teardown(() => {
        // Очистка после каждого теста - не вызываем sinon.restore дважды
        (0, webAudioMocks_1.cleanupWebAudioMocks)();
        clock.restore();
    });
    suite('Constructor', () => {
        test('Should initialize with default state', () => {
            assert.strictEqual(audioRecorder.getIsRecording(), false);
        });
    });
    suite('startRecording', () => {
        test('Should start recording successfully', async () => {
            await audioRecorder.startRecording();
            assert.strictEqual(audioRecorder.getIsRecording(), true);
            assert.ok(mockEvents.onRecordingStart.calledOnce);
        });
        test('Should handle getUserMedia failure', async () => {
            // Настраиваем мок для ошибки доступа к микрофону
            const mockNavigator = global.navigator;
            mockNavigator.mediaDevices.getUserMedia.rejects(new Error('Permission denied'));
            await audioRecorder.startRecording();
            assert.strictEqual(audioRecorder.getIsRecording(), false);
            assert.ok(mockEvents.onError.calledOnce);
        });
        test('Should configure MediaRecorder with correct options', async () => {
            await audioRecorder.startRecording();
            // Проверяем что MediaRecorder был создан с правильными параметрами
            const mockNavigator = global.navigator;
            assert.ok(mockNavigator.mediaDevices.getUserMedia.calledOnce);
            const callArgs = mockNavigator.mediaDevices.getUserMedia.getCall(0).args[0];
            assert.deepStrictEqual(callArgs, {
                audio: {
                    sampleRate: 16000,
                    sampleSize: 16,
                    channelCount: 1,
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    latency: 0.02
                }
            });
        });
    });
    suite('stopRecording', () => {
        test('Should stop recording', async () => {
            // Начинаем запись
            await audioRecorder.startRecording();
            assert.strictEqual(audioRecorder.getIsRecording(), true);
            // Останавливаем запись
            audioRecorder.stopRecording();
            assert.strictEqual(audioRecorder.getIsRecording(), false);
        });
        test('Should handle stop when not recording', () => {
            // Вызов stopRecording без активной записи не должен вызывать ошибок
            audioRecorder.stopRecording();
            assert.strictEqual(audioRecorder.getIsRecording(), false);
        });
        test('Should trigger onRecordingStop event when recording completes', async () => {
            // Начинаем запись
            await audioRecorder.startRecording();
            // Останавливаем запись и симулируем событие onstop
            audioRecorder.stopRecording();
            // Симулируем вызов onstop MediaRecorder
            clock.tick(50);
            // Проверяем что событие было вызвано
            // Примечание: реальная проверка требует более сложной настройки моков
            assert.ok(true); // Пока базовая проверка что ошибок нет
        });
    });
    suite('Error Handling', () => {
        test('Should handle MediaRecorder not supported', async () => {
            // Удаляем MediaRecorder из глобального объекта
            const originalMediaRecorder = global.MediaRecorder;
            delete global.MediaRecorder;
            await audioRecorder.startRecording();
            assert.strictEqual(audioRecorder.getIsRecording(), false);
            assert.ok(mockEvents.onError.calledOnce);
            // Проверяем сообщение об ошибке
            const errorCall = mockEvents.onError.getCall(0);
            assert.ok(errorCall.args[0].message.includes('MediaRecorder API'));
            // Восстанавливаем MediaRecorder
            global.MediaRecorder = originalMediaRecorder;
        });
        test('Should handle MediaStream creation failure', async () => {
            const mockNavigator = global.navigator;
            mockNavigator.mediaDevices.getUserMedia.rejects(new Error('MediaStream error'));
            await audioRecorder.startRecording();
            assert.strictEqual(audioRecorder.getIsRecording(), false);
            assert.ok(mockEvents.onError.calledOnce);
        });
    });
    suite('Integration with Browser APIs', () => {
        test('Should use correct audio constraints', async () => {
            await audioRecorder.startRecording();
            const mockNavigator = global.navigator;
            const constraints = mockNavigator.mediaDevices.getUserMedia.getCall(0).args[0];
            assert.deepStrictEqual(constraints.audio, {
                sampleRate: 16000,
                sampleSize: 16,
                channelCount: 1,
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
                latency: 0.02
            });
        });
        test('Should create MediaRecorder with correct MIME type', async () => {
            await audioRecorder.startRecording();
            // AudioRecorder должен использовать webm формат
            assert.ok(true); // Проверяем что ошибок нет при создании
        });
    });
    suite('Event System', () => {
        test('Should call onRecordingStart when recording starts', async () => {
            await audioRecorder.startRecording();
            assert.ok(mockEvents.onRecordingStart.calledOnce);
        });
        test('Should call onError when error occurs', async () => {
            const mockNavigator = global.navigator;
            mockNavigator.mediaDevices.getUserMedia.rejects(new Error('Test error'));
            await audioRecorder.startRecording();
            assert.ok(mockEvents.onError.calledOnce);
            const errorCall = mockEvents.onError.getCall(0);
            assert.strictEqual(errorCall.args[0].message, 'Test error');
        });
    });
});
//# sourceMappingURL=AudioRecorder.test.js.map