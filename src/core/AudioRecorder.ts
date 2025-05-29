// AudioRecorder.ts - модуль для записи аудио через Web Audio API

// Расширенные типы для DOM API в контексте VS Code extension
declare global {
    interface MediaRecorderConstructor {
        new (stream: MediaStream, options?: MediaRecorderOptions): MediaRecorder;
        isTypeSupported(type: string): boolean;
    }

    interface MediaRecorderOptions {
        mimeType?: string;
        audioBitsPerSecond?: number;
        videoBitsPerSecond?: number;
        bitsPerSecond?: number;
    }

    interface MediaRecorder extends EventTarget {
        readonly mimeType: string;
        readonly state: 'inactive' | 'recording' | 'paused';
        readonly stream: MediaStream;
        start(timeslice?: number): void;
        stop(): void;
        pause(): void;
        resume(): void;
        ondataavailable: ((event: BlobEvent) => void) | null;
        onerror: ((event: Event) => void) | null;
        onstop: (() => void) | null;
        onstart: (() => void) | null;
        onpause: (() => void) | null;
        onresume: (() => void) | null;
        requestData(): void;
    }

    interface BlobEvent extends Event {
        readonly data: Blob;
        readonly timecode: number;
    }

    interface MediaStream extends EventTarget {
        readonly id: string;
        readonly active: boolean;
        getTracks(): MediaStreamTrack[];
        getAudioTracks(): MediaStreamTrack[];
        getVideoTracks(): MediaStreamTrack[];
        getTrackById(trackId: string): MediaStreamTrack | null;
        addTrack(track: MediaStreamTrack): void;
        removeTrack(track: MediaStreamTrack): void;
        clone(): MediaStream;
    }

    interface MediaStreamTrack extends EventTarget {
        readonly id: string;
        readonly kind: string;
        readonly label: string;
        readonly enabled: boolean;
        readonly muted: boolean;
        readonly readyState: 'live' | 'ended';
        stop(): void;
        clone(): MediaStreamTrack;
        getCapabilities(): MediaTrackCapabilities;
        getConstraints(): MediaTrackConstraints;
        getSettings(): MediaTrackSettings;
        applyConstraints(constraints?: MediaTrackConstraints): Promise<void>;
    }

    interface MediaTrackConstraints {
        sampleRate?: number | ConstrainULong;
        sampleSize?: number | ConstrainULong;
        channelCount?: number | ConstrainULong;
        echoCancellation?: boolean | ConstrainBoolean;
        noiseSuppression?: boolean | ConstrainBoolean;
        autoGainControl?: boolean | ConstrainBoolean;
        latency?: number | ConstrainDouble;
        deviceId?: string | string[] | ConstrainDOMString;
        groupId?: string | string[] | ConstrainDOMString;
    }

    interface MediaTrackCapabilities {
        sampleRate?: ULongRange;
        sampleSize?: ULongRange;
        channelCount?: ULongRange;
        echoCancellation?: boolean[];
        noiseSuppression?: boolean[];
        autoGainControl?: boolean[];
        latency?: DoubleRange;
        deviceId?: string;
        groupId?: string;
    }

    interface MediaTrackSettings {
        sampleRate?: number;
        sampleSize?: number;
        channelCount?: number;
        echoCancellation?: boolean;
        noiseSuppression?: boolean;
        autoGainControl?: boolean;
        latency?: number;
        deviceId?: string;
        groupId?: string;
    }

    interface ConstrainULong {
        exact?: number;
        ideal?: number;
        max?: number;
        min?: number;
    }

    interface ConstrainBoolean {
        exact?: boolean;
        ideal?: boolean;
    }

    interface ConstrainDouble {
        exact?: number;
        ideal?: number;
        max?: number;
        min?: number;
    }

    interface ConstrainDOMString {
        exact?: string | string[];
        ideal?: string | string[];
    }

    interface ULongRange {
        max?: number;
        min?: number;
    }

    interface DoubleRange {
        max?: number;
        min?: number;
    }

    const MediaRecorder: MediaRecorderConstructor;

    interface Navigator {
        mediaDevices: MediaDevices;
        permissions?: Permissions;
    }

    interface MediaDevices extends EventTarget {
        getUserMedia(constraints?: MediaStreamConstraints): Promise<MediaStream>;
        enumerateDevices(): Promise<MediaDeviceInfo[]>;
        getSupportedConstraints(): MediaTrackSupportedConstraints;
    }

    interface MediaStreamConstraints {
        audio?: boolean | MediaTrackConstraints;
        video?: boolean | MediaTrackConstraints;
    }

    interface Permissions {
        query(permissionDesc: PermissionDescriptor): Promise<PermissionStatus>;
    }

    interface PermissionDescriptor {
        name: string;
    }

    interface PermissionStatus extends EventTarget {
        readonly state: 'granted' | 'denied' | 'prompt';
        onchange: ((event: Event) => void) | null;
    }

    const navigator: Navigator;

    interface MediaDeviceInfo {
        readonly deviceId: string;
        readonly kind: 'audioinput' | 'audiooutput' | 'videoinput';
        readonly label: string;
        readonly groupId: string;
        toJSON(): any;
    }

    interface MediaTrackSupportedConstraints {
        aspectRatio?: boolean;
        autoGainControl?: boolean;
        brightness?: boolean;
        channelCount?: boolean;
        colorTemperature?: boolean;
        contrast?: boolean;
        deviceId?: boolean;
        echoCancellation?: boolean;
        exposureCompensation?: boolean;
        exposureMode?: boolean;
        facingMode?: boolean;
        focusDistance?: boolean;
        focusMode?: boolean;
        frameRate?: boolean;
        groupId?: boolean;
        height?: boolean;
        iso?: boolean;
        latency?: boolean;
        noiseSuppression?: boolean;
        pan?: boolean;
        pointsOfInterest?: boolean;
        resizeMode?: boolean;
        sampleRate?: boolean;
        sampleSize?: boolean;
        saturation?: boolean;
        sharpness?: boolean;
        suppressLocalAudioPlayback?: boolean;
        tilt?: boolean;
        torch?: boolean;
        whiteBalanceMode?: boolean;
        width?: boolean;
        zoom?: boolean;
    }
}

export interface AudioRecorderEvents {
    onRecordingStart: () => void;
    onRecordingStop: (audioBlob: Blob) => void;
    onError: (error: Error) => void;
    onDataAvailable?: (data: Blob) => void;
}

export interface AudioRecordingOptions {
    sampleRate?: number;
    channelCount?: number;
    echoCancellation?: boolean;
    noiseSuppression?: boolean;
    autoGainControl?: boolean;
    quality?: 'standard' | 'high' | 'ultra';
    maxDuration?: number; // в секундах
    audioFormat?: 'wav' | 'mp3' | 'webm'; // Предпочитаемый формат
    silenceDetection?: boolean; // Автоматическое определение тишины
    silenceThreshold?: number; // Порог тишины в секундах
}

export class AudioRecorder {
    private mediaRecorder: MediaRecorder | null = null;
    private audioChunks: Blob[] = [];
    private stream: MediaStream | null = null;
    private isRecording = false;
    private recordingStartTime: number = 0;
    private maxDurationTimer: NodeJS.Timeout | null = null;
    private supportedMimeTypes: string[] = [];

    constructor(
        private events: AudioRecorderEvents,
        private options: AudioRecordingOptions = {}
    ) {
        this.detectSupportedFormats();
    }

    /**
     * Определяет поддерживаемые аудио форматы
     */
    private detectSupportedFormats(): void {
        const formats = [
            'audio/webm;codecs=opus',
            'audio/webm',
            'audio/mp4',
            'audio/wav',
            'audio/ogg;codecs=opus',
            'audio/ogg'
        ];

        this.supportedMimeTypes = formats.filter(format => 
            MediaRecorder.isTypeSupported(format)
        );
    }

    /**
     * Получает оптимальный MIME тип для записи
     */
    private getBestMimeType(): string {
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
    static checkBrowserCompatibility(): { 
        supported: boolean; 
        missing: string[] 
    } {
        const missing: string[] = [];

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
    async startRecording(): Promise<void> {
        if (this.isRecording) {
            const error = new Error('Запись уже идет');
            this.events.onError(error);
            return;
        }

        const compatibility = AudioRecorder.checkBrowserCompatibility();
        if (!compatibility.supported) {
            const error = new Error(
                `Браузер не поддерживает запись аудио. Отсутствуют: ${compatibility.missing.join(', ')}`
            );
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
            const recorderOptions: MediaRecorderOptions = {
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

        } catch (error) {
            this.cleanup();
            this.events.onError(error as Error);
        }
    }

    /**
     * Останавливает запись аудио
     */
    stopRecording(): void {
        if (!this.isRecording || !this.mediaRecorder) {
            return;
        }

        try {
            this.mediaRecorder.stop();
            this.isRecording = false;
            this.clearMaxDurationTimer();
        } catch (error) {
            this.events.onError(error as Error);
        }
    }

    /**
     * Получает настройки аудио потока
     */
    private getAudioConstraints(): MediaTrackConstraints {
        const quality = this.options.quality || 'standard';
        
        // Базовые настройки для разных уровней качества
        let sampleRate: number;
        let sampleSize: number;
        
        switch (quality) {
            case 'ultra':
                sampleRate = 48000;  // 48kHz для максимального качества
                sampleSize = 24;     // 24-bit глубина
                break;
            case 'high':
                sampleRate = 44100;  // 44.1kHz CD качество
                sampleSize = 16;     // 16-bit стандарт
                break;
            case 'standard':
            default:
                sampleRate = 16000;  // 16kHz оптимально для Whisper
                sampleSize = 16;     // 16-bit
                break;
        }
        
        // Применяем пользовательские настройки если заданы
        const finalSampleRate = this.options.sampleRate || sampleRate;
        const channelCount = this.options.channelCount || 1; // Моно по умолчанию
        
        return {
            sampleRate: finalSampleRate,
            sampleSize: sampleSize,
            channelCount: channelCount,
            echoCancellation: this.options.echoCancellation !== false,
            noiseSuppression: this.options.noiseSuppression !== false,
            autoGainControl: this.options.autoGainControl !== false,
            // Дополнительные настройки для улучшения качества
            latency: quality === 'ultra' ? 0.01 : 0.02  // Низкая задержка для высокого качества
        };
    }

    /**
     * Получает битрейт для аудио в зависимости от настроек качества
     */
    private getAudioBitrate(): number {
        const quality = this.options.quality || 'standard';
        
        switch (quality) {
            case 'ultra':
                return 256000;  // 256kbps для максимального качества
            case 'high':
                return 128000;  // 128kbps для высокого качества
            case 'standard':
            default:
                return 64000;   // 64kbps для стандартного качества
        }
    }

    /**
     * Настраивает обработчики событий MediaRecorder
     */
    private setupMediaRecorderEvents(): void {
        if (!this.mediaRecorder) {return;}

        this.mediaRecorder.ondataavailable = (event: BlobEvent) => {
            if (event.data.size > 0) {
                this.audioChunks.push(event.data);
                this.events.onDataAvailable?.(event.data);
            }
        };

        this.mediaRecorder.onstop = () => {
            try {
                const audioBlob = this.createAudioBlob();
                this.events.onRecordingStop(audioBlob);
            } catch (error) {
                this.events.onError(error as Error);
            } finally {
                this.cleanup();
            }
        };

        this.mediaRecorder.onerror = (event: Event) => {
            this.events.onError(new Error(`Ошибка MediaRecorder: ${event}`));
            this.cleanup();
        };
    }

    /**
     * Создает финальный аудио blob
     */
    private createAudioBlob(): Blob {
        if (this.audioChunks.length === 0) {
            throw new Error('Нет записанных аудио данных');
        }

        const mimeType = this.mediaRecorder?.mimeType || 'audio/webm';
        return new Blob(this.audioChunks, { type: mimeType });
    }

    /**
     * Настраивает таймер максимальной длительности
     */
    private setupMaxDurationTimer(): void {
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
    private clearMaxDurationTimer(): void {
        if (this.maxDurationTimer) {
            clearTimeout(this.maxDurationTimer);
            this.maxDurationTimer = null;
        }
    }

    /**
     * Очищает ресурсы
     */
    private cleanup(): void {
        this.clearMaxDurationTimer();
        
        if (this.stream) {
            this.stream.getTracks().forEach((track: MediaStreamTrack) => track.stop());
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
    getIsRecording(): boolean {
        return this.isRecording;
    }

    /**
     * Возвращает длительность текущей записи в миллисекундах
     */
    getRecordingDuration(): number {
        if (!this.isRecording) {return 0;}
        return Date.now() - this.recordingStartTime;
    }

    /**
     * Возвращает поддерживаемые MIME типы
     */
    getSupportedMimeTypes(): string[] {
        return [...this.supportedMimeTypes];
    }

    /**
     * Проверяет, доступен ли микрофон
     */
    static async checkMicrophonePermission(): Promise<{
        state: 'granted' | 'denied' | 'prompt' | 'unknown';
        available: boolean;
    }> {
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
        } catch (error) {
            return { state: 'unknown', available: false };
        }
    }
} 