// FFmpegAudioRecorder.ts - модуль для записи аудио через FFmpeg

import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as tmp from 'tmp';
import which from 'which';
import * as os from 'os';
import * as path from 'path';

// Совместимые интерфейсы с текущим AudioRecorder
export interface AudioRecorderEvents {
    onRecordingStart: () => void;
    onRecordingStop: (audioBlob: Blob) => void;
    onError: (error: Error) => void;
    onDataAvailable?: (data: Blob) => void;
}

export interface AudioRecordingOptions {
    sampleRate?: number;           // -ar (default: 16000)
    channelCount?: number;         // -ac (default: 1)
    echoCancellation?: boolean;    // игнорируется в FFmpeg
    noiseSuppression?: boolean;    // игнорируется в FFmpeg
    autoGainControl?: boolean;     // игнорируется в FFmpeg
    quality?: 'standard' | 'high' | 'ultra';
    maxDuration?: number;          // -t (в секундах)
    audioFormat?: 'wav' | 'mp3' | 'webm' | 'opus'; // формат выходного файла
    silenceDetection?: boolean;    // игнорируется пока
    silenceThreshold?: number;     // игнорируется пока
    inputDevice?: string;          // автоопределение или путь к устройству
    codec?: string;               // -acodec (default: pcm_s16le для WAV)
    outputPath?: string;          // временная папка для файлов
    ffmpegPath?: string;          // путь к FFmpeg исполняемому файлу
}

// Платформо-специфические команды FFmpeg
export interface PlatformCommands {
    platform: 'windows' | 'macos' | 'linux';
    audioInput: string;
    defaultDevice: string;
}

// Результат проверки FFmpeg
export interface FFmpegAvailability {
    available: boolean;
    version?: string;
    path?: string;
    error?: string;
}

export class FFmpegAudioRecorder {
    private ffmpegProcess: ChildProcess | null = null;
    private isRecording = false;
    private recordingStartTime: number = 0;
    private maxDurationTimer: NodeJS.Timeout | null = null;
    private tempFilePath: string | null = null;
    private tempFileCleanup: (() => void) | null = null;

    constructor(
        private events: AudioRecorderEvents,
        private options: AudioRecordingOptions = {}
    ) {
        // Настройка временной очистки при выходе из процесса
        process.on('exit', () => this.cleanup());
        process.on('SIGINT', () => this.cleanup());
        process.on('SIGTERM', () => this.cleanup());
    }

    /**
     * Определение текущей платформы
     */
    static detectPlatform(): 'windows' | 'macos' | 'linux' {
        const platform = os.platform();
        switch (platform) {
            case 'win32':
                return 'windows';
            case 'darwin':
                return 'macos';
            default:
                return 'linux';
        }
    }

    /**
     * Получение платформо-специфических команд
     */
    static getPlatformCommands(): PlatformCommands {
        const platform = FFmpegAudioRecorder.detectPlatform();
        
        switch (platform) {
            case 'macos':
                return {
                    platform,
                    audioInput: '-f avfoundation',
                    defaultDevice: ':0'  // ":0" - встроенный микрофон
                };
            case 'windows':
                return {
                    platform,
                    audioInput: '-f dshow',
                    defaultDevice: 'audio="Microphone"'  // можно также использовать "default"
                };
            case 'linux':
                return {
                    platform,
                    audioInput: '-f pulse',  // или -f alsa
                    defaultDevice: 'default'  // или hw:0
                };
        }
    }

    /**
     * Проверка доступности FFmpeg в системе
     */
    static async checkFFmpegAvailability(): Promise<FFmpegAvailability> {
        try {
            // Сначала пробуем найти FFmpeg в PATH
            let ffmpegPath: string;
            try {
                ffmpegPath = await which('ffmpeg');
            } catch (pathError) {
                return {
                    available: false,
                    error: 'FFmpeg not found in PATH. Please install FFmpeg and add it to your system PATH, or specify the path in extension settings.'
                };
            }

            // Проверяем версию для подтверждения работоспособности
            return new Promise((resolve) => {
                const versionProcess = spawn(ffmpegPath, ['-version']);
                let output = '';
                
                versionProcess.stdout.on('data', (data) => {
                    output += data.toString();
                });

                versionProcess.on('close', (code) => {
                    if (code === 0) {
                        // Извлекаем версию из output
                        const versionMatch = output.match(/ffmpeg version ([^\s]+)/);
                        const version = versionMatch ? versionMatch[1] : 'unknown';
                        
                        resolve({
                            available: true,
                            version,
                            path: ffmpegPath
                        });
                    } else {
                        resolve({
                            available: false,
                            error: `FFmpeg found but not working properly (exit code: ${code})`
                        });
                    }
                });

                versionProcess.on('error', (error) => {
                    resolve({
                        available: false,
                        error: `Error running FFmpeg: ${error.message}`
                    });
                });
            });

        } catch (error) {
            return {
                available: false,
                error: `Unexpected error checking FFmpeg: ${(error as Error).message}`
            };
        }
    }

    /**
     * Обнаружение доступных аудио устройств
     */
    static async detectInputDevices(): Promise<string[]> {
        try {
            const ffmpegPath = await which('ffmpeg');
            const platform = FFmpegAudioRecorder.detectPlatform();
            
            return new Promise((resolve) => {
                let args: string[] = [];
                
                switch (platform) {
                    case 'macos':
                        args = ['-f', 'avfoundation', '-list_devices', 'true', '-i', '""'];
                        break;
                    case 'windows':
                        args = ['-list_devices', 'true', '-f', 'dshow', '-i', 'dummy'];
                        break;
                    case 'linux':
                        args = ['-f', 'pulse', '-list_devices', 'true', '-i', '""'];
                        break;
                }

                const listProcess = spawn(ffmpegPath, args);
                let output = '';
                
                listProcess.stderr.on('data', (data) => {
                    output += data.toString();
                });

                listProcess.on('close', () => {
                    const devices: string[] = [];
                    
                    // Парсинг зависит от платформы
                    const lines = output.split('\n');
                    console.log('FFmpeg device detection output:', output);
                    
                    for (const line of lines) {
                        if (platform === 'macos') {
                            // AVFoundation формат: [AVFoundation indev @ 0x...] [0] MacBook Pro Microphone
                            if (line.includes('AVFoundation indev') && line.match(/\[\d+\]/)) {
                                const match = line.match(/\[\d+\]\s+(.+)$/);
                                if (match && match[1].trim()) {
                                    devices.push(match[1].trim());
                                }
                            }
                        } else if (platform === 'windows' && line.includes('DirectShow audio device')) {
                            const match = line.match(/"([^"]+)"/);
                            if (match) devices.push(match[1]);
                        } else if (platform === 'linux' && line.includes('pulse audio device')) {
                            const match = line.match(/\[([^\]]+)\]/);
                            if (match) devices.push(match[1]);
                        }
                    }
                    
                    // Если не нашли устройства, возвращаем дефолтные
                    if (devices.length === 0) {
                        console.log('No devices found, using default');
                        devices.push('default');
                    } else {
                        console.log('Found devices:', devices);
                    }
                    
                    resolve(devices);
                });

                listProcess.on('error', () => {
                    resolve(['default']); // Fallback
                });
            });

        } catch (error) {
            return ['default']; // Fallback если что-то пошло не так
        }
    }

    /**
     * Начать запись аудио
     */
    async startRecording(): Promise<void> {
        if (this.isRecording) {
            throw new Error('Recording is already in progress');
        }

        // Проверяем доступность FFmpeg
        const ffmpegCheck = await FFmpegAudioRecorder.checkFFmpegAvailability();
        if (!ffmpegCheck.available || !ffmpegCheck.path) {
            throw new Error(ffmpegCheck.error || 'FFmpeg is not available');
        }

        try {
            // Создаем временный файл
            const tempFile = tmp.fileSync({ 
                prefix: 'vscs-recording-', 
                postfix: `.${this.options.audioFormat || 'wav'}`,
                keep: false // будет удален автоматически
            });
            
            this.tempFilePath = tempFile.name;
            this.tempFileCleanup = tempFile.removeCallback;

            // Формируем команду FFmpeg
            const ffmpegArgs = this.buildFFmpegArgs(this.tempFilePath);
            
            // Запускаем процесс записи
            this.ffmpegProcess = spawn(ffmpegCheck.path!, ffmpegArgs);
            
            this.setupFFmpegEvents();
            this.recordingStartTime = Date.now();
            this.isRecording = true;

            // Устанавливаем таймер максимальной продолжительности
            this.setupMaxDurationTimer();

            // Уведомляем о начале записи
            this.events.onRecordingStart();

        } catch (error) {
            this.cleanup();
            throw new Error(`Failed to start recording: ${(error as Error).message}`);
        }
    }

    /**
     * Остановить запись аудио
     */
    stopRecording(): void {
        if (!this.isRecording || !this.ffmpegProcess) {
            return;
        }

        try {
            // Отправляем SIGTERM для graceful shutdown
            this.ffmpegProcess.kill('SIGTERM');
            
            // Timeout на случай, если процесс не завершится gracefully
            setTimeout(() => {
                if (this.ffmpegProcess && !this.ffmpegProcess.killed) {
                    this.ffmpegProcess.kill('SIGKILL');
                }
            }, 5000);

        } catch (error) {
            this.events.onError(new Error(`Error stopping recording: ${(error as Error).message}`));
        }
    }

    /**
     * Создание аргументов для FFmpeg команды
     */
    private buildFFmpegArgs(outputPath: string): string[] {
        const platformCommands = FFmpegAudioRecorder.getPlatformCommands();
        const args: string[] = [];

        // Уровень логирования
        args.push('-loglevel', 'error');

        // Платформо-специфический ввод
        const inputParts = platformCommands.audioInput.split(' ');
        args.push(...inputParts);

        // Устройство ввода
        const inputDevice = this.options.inputDevice || platformCommands.defaultDevice;
        args.push('-i', inputDevice);

        // Настройки аудио
        if (this.options.sampleRate) {
            args.push('-ar', this.options.sampleRate.toString());
        } else {
            args.push('-ar', '16000'); // По умолчанию 16kHz для Whisper
        }

        if (this.options.channelCount) {
            args.push('-ac', this.options.channelCount.toString());
        } else {
            args.push('-ac', '1'); // Mono по умолчанию
        }

        // Кодек
        const codec = this.options.codec || this.getDefaultCodec();
        args.push('-acodec', codec);

        // Максимальная продолжительность
        if (this.options.maxDuration) {
            args.push('-t', this.options.maxDuration.toString());
        }

        // Выходной файл
        args.push('-y'); // Перезаписать если существует
        args.push(outputPath);

        return args;
    }

    /**
     * Получить кодек по умолчанию для формата
     */
    private getDefaultCodec(): string {
        const format = this.options.audioFormat || 'wav';
        
        switch (format) {
            case 'wav':
                return 'pcm_s16le';
            case 'mp3':
                return 'libmp3lame';
            case 'opus':
                return 'libopus';
            case 'webm':
                return 'libvorbis';
            default:
                return 'pcm_s16le';
        }
    }

    /**
     * Настройка обработчиков событий FFmpeg процесса
     */
    private setupFFmpegEvents(): void {
        if (!this.ffmpegProcess) return;

        this.ffmpegProcess.on('close', (code) => {
            if (this.isRecording) {
                this.handleRecordingComplete(code);
            }
        });

        this.ffmpegProcess.on('error', (error) => {
            this.isRecording = false;
            this.clearMaxDurationTimer();
            this.events.onError(new Error(`FFmpeg process error: ${error.message}`));
            this.cleanup();
        });

        this.ffmpegProcess.stdout?.on('data', (data) => {
            const output = data.toString();
            console.log('FFmpeg stdout:', output);
        });

        this.ffmpegProcess.stderr?.on('data', (data) => {
            const errorMessage = data.toString();
            console.log('FFmpeg stderr:', errorMessage);
            
            // Проверяем критические ошибки, но не паникуем по поводу предупреждений
            if (errorMessage.includes('No such file or directory') || 
                errorMessage.includes('Permission denied') ||
                errorMessage.includes('Device or resource busy')) {
                console.error('FFmpeg critical error:', errorMessage);
            }
        });
    }

    /**
     * Обработка завершения записи
     */
    private async handleRecordingComplete(exitCode: number | null): Promise<void> {
        this.isRecording = false;
        this.clearMaxDurationTimer();

        try {
            // На macOS FFmpeg может завершиться с кодом 255 при SIGTERM, что нормально
            // Также код null означает, что процесс был убит принудительно
            if (exitCode !== 0 && exitCode !== null && exitCode !== 255) {
                console.warn(`FFmpeg exited with code ${exitCode}, but checking if file was created anyway`);
            }

            if (!this.tempFilePath || !fs.existsSync(this.tempFilePath)) {
                throw new Error('Recording file was not created');
            }

            // Проверяем размер файла - если файл пустой, это ошибка
            const stats = fs.statSync(this.tempFilePath);
            if (stats.size === 0) {
                throw new Error('Recording file is empty');
            }

            // Читаем записанный файл
            const audioBuffer = fs.readFileSync(this.tempFilePath);
            
            // Определяем MIME type
            const mimeType = this.getMimeType();
            
            // Создаем Blob совместимый с текущим API
            const audioBlob = new Blob([audioBuffer], { type: mimeType });

            console.log(`Recording completed: ${stats.size} bytes, ${mimeType}`);

            // Уведомляем о завершении записи
            this.events.onRecordingStop(audioBlob);

        } catch (error) {
            this.events.onError(new Error(`Failed to process recording: ${(error as Error).message}`));
        } finally {
            this.cleanup();
        }
    }

    /**
     * Получение MIME type для записанного аудио
     */
    private getMimeType(): string {
        const format = this.options.audioFormat || 'wav';
        
        switch (format) {
            case 'wav':
                return 'audio/wav';
            case 'mp3':
                return 'audio/mpeg';
            case 'opus':
                return 'audio/ogg; codecs=opus';
            case 'webm':
                return 'audio/webm';
            default:
                return 'audio/wav';
        }
    }

    /**
     * Настройка таймера максимальной продолжительности
     */
    private setupMaxDurationTimer(): void {
        if (this.options.maxDuration && this.options.maxDuration > 0) {
            this.maxDurationTimer = setTimeout(() => {
                this.stopRecording();
            }, this.options.maxDuration * 1000);
        }
    }

    /**
     * Очистка таймера максимальной продолжительности
     */
    private clearMaxDurationTimer(): void {
        if (this.maxDurationTimer) {
            clearTimeout(this.maxDurationTimer);
            this.maxDurationTimer = null;
        }
    }

    /**
     * Очистка ресурсов
     */
    private cleanup(): void {
        this.clearMaxDurationTimer();
        
        if (this.ffmpegProcess && !this.ffmpegProcess.killed) {
            this.ffmpegProcess.kill('SIGKILL');
            this.ffmpegProcess = null;
        }

        if (this.tempFileCleanup) {
            try {
                this.tempFileCleanup();
            } catch (error) {
                // Игнорируем ошибки очистки
            }
            this.tempFileCleanup = null;
        }

        this.tempFilePath = null;
        this.isRecording = false;
    }

    // ============ СОВМЕСТИМЫЕ МЕТОДЫ С ТЕКУЩИМ AudioRecorder ============

    /**
     * Получить статус записи
     */
    getIsRecording(): boolean {
        return this.isRecording;
    }

    /**
     * Получить продолжительность текущей записи в миллисекундах
     */
    getRecordingDuration(): number {
        if (!this.isRecording) {
            return 0;
        }
        return Date.now() - this.recordingStartTime;
    }

    /**
     * Получить поддерживаемые MIME типы (для совместимости)
     */
    getSupportedMimeTypes(): string[] {
        return [
            'audio/wav',
            'audio/mpeg',
            'audio/ogg; codecs=opus',
            'audio/webm'
        ];
    }

    /**
     * Проверка совместимости (замена checkBrowserCompatibility)
     */
    static checkBrowserCompatibility(): { 
        supported: boolean; 
        missing: string[] 
    } {
        // Для FFmpeg проверяем доступность Node.js модулей
        const missing: string[] = [];

        try {
            require('child_process');
        } catch {
            missing.push('child_process');
        }

        try {
            require('fs');
        } catch {
            missing.push('fs');
        }

        try {
            require('tmp');
        } catch {
            missing.push('tmp package');
        }

        try {
            require('which');
        } catch {
            missing.push('which package');
        }

        return {
            supported: missing.length === 0,
            missing
        };
    }

    /**
     * Проверка доступности микрофона (замена checkMicrophonePermission)
     */
    static async checkMicrophonePermission(): Promise<{
        state: 'granted' | 'denied' | 'prompt' | 'unknown';
        available: boolean;
    }> {
        try {
            const ffmpegCheck = await FFmpegAudioRecorder.checkFFmpegAvailability();
            if (!ffmpegCheck.available) {
                return {
                    state: 'denied',
                    available: false
                };
            }

            const devices = await FFmpegAudioRecorder.detectInputDevices();
            return {
                state: devices.length > 0 ? 'granted' : 'denied',
                available: devices.length > 0
            };

        } catch (error) {
            return {
                state: 'unknown',
                available: false
            };
        }
    }
} 