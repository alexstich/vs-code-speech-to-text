"use strict";
// AudioRecorder.ts - модуль для записи аудио через Web Audio API
Object.defineProperty(exports, "__esModule", { value: true });
exports.AudioRecorder = void 0;
class AudioRecorder {
    events;
    options;
    mediaRecorder = null;
    audioChunks = [];
    stream = null;
    isRecording = false;
    recordingStartTime = 0;
    maxDurationTimer = null;
    supportedMimeTypes = [];
    constructor(events, options = {}) {
        this.events = events;
        this.options = options;
        this.detectSupportedFormats();
    }
    /**
     * Определяет поддерживаемые аудио форматы
     */
    detectSupportedFormats() {
        const formats = [
            'audio/webm;codecs=opus',
            'audio/webm',
            'audio/mp4',
            'audio/wav',
            'audio/ogg;codecs=opus',
            'audio/ogg'
        ];
        this.supportedMimeTypes = formats.filter(format => MediaRecorder.isTypeSupported(format));
    }
    /**
     * Получает оптимальный MIME тип для записи
     */
    getBestMimeType() {
        // Приоритет: WebM/Opus > WebM > MP4 > WAV > OGG
        const preferred = [
            'audio/webm;codecs=opus',
            'audio/webm',
            'audio/mp4',
            'audio/wav',
            'audio/ogg;codecs=opus',
            'audio/ogg'
        ];
        for (const type of preferred) {
            if (this.supportedMimeTypes.includes(type)) {
                return type;
            }
        }
        throw new Error('Браузер не поддерживает запись аудио');
    }
    /**
     * Проверяет совместимость браузера с API записи
     */
    static checkBrowserCompatibility() {
        const missing = [];
        if (!navigator?.mediaDevices?.getUserMedia) {
            missing.push('getUserMedia API');
        }
        if (typeof MediaRecorder === 'undefined') {
            missing.push('MediaRecorder API');
        }
        return {
            supported: missing.length === 0,
            missing
        };
    }
    /**
     * Начинает запись аудио
     */
    async startRecording() {
        if (this.isRecording) {
            const error = new Error('Запись уже идет');
            this.events.onError(error);
            return;
        }
        const compatibility = AudioRecorder.checkBrowserCompatibility();
        if (!compatibility.supported) {
            const error = new Error(`Браузер не поддерживает запись аудио. Отсутствуют: ${compatibility.missing.join(', ')}`);
            this.events.onError(error);
            return;
        }
        try {
            // Настройки аудио потока
            const audioConstraints = this.getAudioConstraints();
            // Получаем доступ к микрофону
            this.stream = await navigator.mediaDevices.getUserMedia({
                audio: audioConstraints
            });
            // Получаем поддерживаемый MIME тип
            const mimeType = this.getBestMimeType();
            // Создаем MediaRecorder с оптимальными настройками
            const recorderOptions = {
                mimeType,
                audioBitsPerSecond: this.getAudioBitrate()
            };
            this.mediaRecorder = new MediaRecorder(this.stream, recorderOptions);
            this.audioChunks = [];
            this.isRecording = true;
            this.recordingStartTime = Date.now();
            // Настраиваем обработчики событий
            this.setupMediaRecorderEvents();
            // Настраиваем таймер максимальной длительности
            this.setupMaxDurationTimer();
            // Начинаем запись
            this.mediaRecorder.start(100); // Собираем данные каждые 100мс
            this.events.onRecordingStart();
        }
        catch (error) {
            this.cleanup();
            this.events.onError(error);
        }
    }
    /**
     * Останавливает запись аудио
     */
    stopRecording() {
        if (!this.isRecording || !this.mediaRecorder) {
            return;
        }
        try {
            this.mediaRecorder.stop();
            this.isRecording = false;
            this.clearMaxDurationTimer();
        }
        catch (error) {
            this.events.onError(error);
        }
    }
    /**
     * Получает настройки аудио потока
     */
    getAudioConstraints() {
        const quality = this.options.quality || 'standard';
        return {
            sampleRate: this.options.sampleRate || 16000, // Оптимально для Whisper
            channelCount: this.options.channelCount || 1, // Моно
            echoCancellation: this.options.echoCancellation !== false,
            noiseSuppression: this.options.noiseSuppression !== false,
            autoGainControl: this.options.autoGainControl !== false,
            ...(quality === 'high' ? {
                sampleRate: 44100,
                sampleSize: 16
            } : {})
        };
    }
    /**
     * Получает битрейт для аудио
     */
    getAudioBitrate() {
        const quality = this.options.quality || 'standard';
        return quality === 'high' ? 128000 : 64000; // 128kbps или 64kbps
    }
    /**
     * Настраивает обработчики событий MediaRecorder
     */
    setupMediaRecorderEvents() {
        if (!this.mediaRecorder) {
            return;
        }
        this.mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                this.audioChunks.push(event.data);
                this.events.onDataAvailable?.(event.data);
            }
        };
        this.mediaRecorder.onstop = () => {
            try {
                const audioBlob = this.createAudioBlob();
                this.events.onRecordingStop(audioBlob);
            }
            catch (error) {
                this.events.onError(error);
            }
            finally {
                this.cleanup();
            }
        };
        this.mediaRecorder.onerror = (event) => {
            this.events.onError(new Error(`Ошибка MediaRecorder: ${event}`));
            this.cleanup();
        };
    }
    /**
     * Создает финальный аудио blob
     */
    createAudioBlob() {
        if (this.audioChunks.length === 0) {
            throw new Error('Нет записанных аудио данных');
        }
        const mimeType = this.mediaRecorder?.mimeType || 'audio/webm';
        return new Blob(this.audioChunks, { type: mimeType });
    }
    /**
     * Настраивает таймер максимальной длительности
     */
    setupMaxDurationTimer() {
        const maxDuration = this.options.maxDuration;
        if (maxDuration && maxDuration > 0) {
            this.maxDurationTimer = setTimeout(() => {
                if (this.isRecording) {
                    this.stopRecording();
                }
            }, maxDuration * 1000);
        }
    }
    /**
     * Очищает таймер максимальной длительности
     */
    clearMaxDurationTimer() {
        if (this.maxDurationTimer) {
            clearTimeout(this.maxDurationTimer);
            this.maxDurationTimer = null;
        }
    }
    /**
     * Очищает ресурсы
     */
    cleanup() {
        this.clearMaxDurationTimer();
        if (this.stream) {
            this.stream.getTracks().forEach((track) => track.stop());
            this.stream = null;
        }
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.isRecording = false;
        this.recordingStartTime = 0;
    }
    /**
     * Возвращает текущее состояние записи
     */
    getIsRecording() {
        return this.isRecording;
    }
    /**
     * Возвращает длительность текущей записи в миллисекундах
     */
    getRecordingDuration() {
        if (!this.isRecording) {
            return 0;
        }
        return Date.now() - this.recordingStartTime;
    }
    /**
     * Возвращает поддерживаемые MIME типы
     */
    getSupportedMimeTypes() {
        return [...this.supportedMimeTypes];
    }
    /**
     * Проверяет, доступен ли микрофон
     */
    static async checkMicrophonePermission() {
        try {
            if (!navigator?.permissions) {
                return { state: 'unknown', available: false };
            }
            const permission = await navigator.permissions.query({ name: 'microphone' });
            const available = permission.state === 'granted';
            return {
                state: permission.state,
                available
            };
        }
        catch (error) {
            return { state: 'unknown', available: false };
        }
    }
}
exports.AudioRecorder = AudioRecorder;
//# sourceMappingURL=AudioRecorder.js.map