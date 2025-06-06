// AudioRecorder.ts - module for recording audio through Web Audio API

// Extended types for DOM API in the context of VS Code extension
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
    maxDuration?: number; // in seconds
    audioFormat?: 'wav' | 'mp3' | 'webm'; // Preferred format
    silenceDetection?: boolean; // Automatic silence detection
    silenceThreshold?: number; // Silence threshold in seconds
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
     * Determines supported audio formats
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
     * Gets the optimal MIME type for recording
     */
    private getBestMimeType(): string {
        // Priority: WebM/Opus > WebM > MP4 > WAV > OGG
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

        throw new Error('Browser does not support audio recording');
    }

    /**
     * Checks browser compatibility with the recording API
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
     * Starts recording audio
     */
    async startRecording(): Promise<void> {
        if (this.isRecording) {
            const error = new Error('Recording already in progress');
            this.events.onError(error);
            return;
        }

        const compatibility = AudioRecorder.checkBrowserCompatibility();
        if (!compatibility.supported) {
            const error = new Error(
                `Browser does not support audio recording. Missing: ${compatibility.missing.join(', ')}`
            );
            this.events.onError(error);
            return;
        }

        try {
            // Audio stream settings
            const audioConstraints = this.getAudioConstraints();
            
            // Get access to the microphone
            this.stream = await navigator.mediaDevices.getUserMedia({
                audio: audioConstraints
            });

            // Get the supported MIME type
            const mimeType = this.getBestMimeType();
            
            // Create MediaRecorder with optimal settings
            const recorderOptions: MediaRecorderOptions = {
                mimeType,
                audioBitsPerSecond: this.getAudioBitrate()
            };

            this.mediaRecorder = new MediaRecorder(this.stream, recorderOptions);
            this.audioChunks = [];
            this.isRecording = true;
            this.recordingStartTime = Date.now();

            // Setup event handlers
            this.setupMediaRecorderEvents();

            // Setup the maximum duration timer
            this.setupMaxDurationTimer();

            // Start recording
            this.mediaRecorder.start(100); // Collect data every 100ms
            this.events.onRecordingStart();

        } catch (error) {
            this.cleanup();
            this.events.onError(error as Error);
        }
    }

    /**
     * Stops recording audio
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
     * Gets audio stream settings
     */
    private getAudioConstraints(): MediaTrackConstraints {
        const quality = this.options.quality || 'standard';
        
        // Base settings for different quality levels
        let sampleRate: number;
        let sampleSize: number;
        
        switch (quality) {
            case 'ultra':
                sampleRate = 48000;  // 48kHz for maximum quality
                sampleSize = 24;     // 24-bit depth
                break;
            case 'high':
                sampleRate = 44100;  // 44.1kHz CD quality
                sampleSize = 16;     // 16-bit standard
                break;
            case 'standard':
            default:
                sampleRate = 16000;  // 16kHz optimal for Whisper
                sampleSize = 16;     // 16-bit
                break;
        }
        
        // Apply user settings if provided
        const finalSampleRate = this.options.sampleRate || sampleRate;
        const channelCount = this.options.channelCount || 1; // Mono by default
        
        return {
            sampleRate: finalSampleRate,
            sampleSize: sampleSize,
            channelCount: channelCount,
            echoCancellation: this.options.echoCancellation !== false,
            noiseSuppression: this.options.noiseSuppression !== false,
            autoGainControl: this.options.autoGainControl !== false,
            // Additional settings for improved quality
            latency: quality === 'ultra' ? 0.01 : 0.02  // Low latency for high quality
        };
    }

    /**
     * Gets audio bitrate based on quality settings
     */
    private getAudioBitrate(): number {
        const quality = this.options.quality || 'standard';
        
        switch (quality) {
            case 'ultra':
                return 256000;  // 256kbps for maximum quality
            case 'high':
                return 128000;  // 128kbps for high quality
            case 'standard':
            default:
                return 64000;   // 64kbps for standard quality
        }
    }

    /**
     * Sets up event handlers for MediaRecorder
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
            this.events.onError(new Error(`Error in MediaRecorder: ${event}`));
            this.cleanup();
        };
    }

    /**
     * Creates the final audio blob
     */
    private createAudioBlob(): Blob {
        if (this.audioChunks.length === 0) {
            throw new Error('No recorded audio data');
        }

        const mimeType = this.mediaRecorder?.mimeType || 'audio/webm';
        return new Blob(this.audioChunks, { type: mimeType });
    }

    /**
     * Sets up the maximum duration timer
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
     * Clears the maximum duration timer
     */
    private clearMaxDurationTimer(): void {
        if (this.maxDurationTimer) {
            clearTimeout(this.maxDurationTimer);
            this.maxDurationTimer = null;
        }
    }

    /**
     * Clears resources
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
     * Returns the current recording state
     */
    getIsRecording(): boolean {
        return this.isRecording;
    }

    /**
     * Returns the duration of the current recording in milliseconds
     */
    getRecordingDuration(): number {
        if (!this.isRecording) {return 0;}
        return Date.now() - this.recordingStartTime;
    }

    /**
     * Returns supported MIME types
     */
    getSupportedMimeTypes(): string[] {
        return [...this.supportedMimeTypes];
    }

    /**
     * Checks if the microphone is available
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