// FFmpegAudioRecorder.ts - модуль для записи аудио через FFmpeg

import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as tmp from 'tmp';
import which from 'which';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';

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
    silenceDetection?: boolean;    // определение тишины
    silenceThreshold?: number;     // порог тишины в dB (default: -50)
    silenceDuration?: number;      // длительность тишины для автостопа в секундах (default: 3)
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

// Результат обнаружения аудио устройств
export interface AudioDevice {
    id: string;           // ID для FFmpeg (например, ":0", ":1")
    name: string;         // Читаемое имя (например, "MacBook Pro Microphone")
    isDefault?: boolean;  // Является ли устройством по умолчанию
}

export class FFmpegAudioRecorder {
    private ffmpegProcess: ChildProcess | null = null;
    private isRecording = false;
    private recordingStartTime: number = 0;
    private maxDurationTimer: NodeJS.Timeout | null = null;
    private tempFilePath: string | null = null;
    private tempFileCleanup: (() => void) | null = null;
    
    // Переменные для определения тишины
    private silenceTimer: NodeJS.Timeout | null = null;
    private lastAudioTime: number = 0;
    private silenceDetectionEnabled: boolean = false;

    constructor(
        private events: AudioRecorderEvents,
        private options: AudioRecordingOptions = {},
        private outputChannel?: any // vscode.OutputChannel, но избегаем импорта vscode здесь
    ) {
        // Настройка временной очистки при выходе из процесса
        process.on('exit', () => this.cleanup());
        process.on('SIGINT', () => this.cleanup());
        process.on('SIGTERM', () => this.cleanup());
    }

    /**
     * Логирование с поддержкой outputChannel
     */
    private log(message: string): void {
        console.log(message);
        if (this.outputChannel) {
            this.outputChannel.appendLine(message);
        }
    }

    private logError(message: string, error?: any): void {
        console.error(message, error || '');
        if (this.outputChannel) {
            this.outputChannel.appendLine(message + (error ? ` ${error}` : ''));
        }
    }

    private logWarn(message: string): void {
        console.warn(message);
        if (this.outputChannel) {
            this.outputChannel.appendLine(message);
        }
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
                    defaultDevice: ':0'  // ":0" - первое аудио устройство (микрофон)
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
    static async detectInputDevices(): Promise<AudioDevice[]> {
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

                console.log(`Detecting input devices with command: ffmpeg ${args.join(' ')}`);
                const listProcess = spawn(ffmpegPath, args);
                let output = '';
                
                // AVFoundation output идет в stderr
                listProcess.stderr.on('data', (data) => {
                    output += data.toString();
                });

                listProcess.on('close', () => {
                    const devices: AudioDevice[] = [];
                    
                    // Парсинг зависит от платформы
                    const lines = output.split('\n');
                    console.log('FFmpeg device detection raw output:', output);
                    
                    if (platform === 'macos') {
                        let inAudioSection = false;
                        
                        for (const line of lines) {
                            const trimmedLine = line.trim();
                            
                            // Ищем начало секции аудио устройств
                            if (trimmedLine.includes('AVFoundation audio devices:')) {
                                inAudioSection = true;
                                continue;
                            }
                            
                            // Парсим аудио устройства в формате [AVFoundation indev @ 0x...] [0] Device Name
                            if (inAudioSection && trimmedLine.match(/\[AVFoundation.*?\]\s+\[(\d+)\]\s+(.+)$/)) {
                                const match = trimmedLine.match(/\[AVFoundation.*?\]\s+\[(\d+)\]\s+(.+)$/);
                                if (match && match[2].trim()) {
                                    const deviceIndex = match[1];
                                    const deviceName = match[2].trim();
                                    devices.push({
                                        id: `:${deviceIndex}`,
                                        name: deviceName,
                                        isDefault: deviceIndex === '0'
                                    });
                                }
                            }
                        }
                    } else if (platform === 'windows') {
                        for (const line of lines) {
                            if (line.includes('DirectShow audio device') || line.includes('"')) {
                                const match = line.match(/"([^"]+)"/);
                                if (match) {
                                    devices.push({
                                        id: `audio="${match[1]}"`,
                                        name: match[1],
                                        isDefault: devices.length === 0
                                    });
                                }
                            }
                        }
                    } else if (platform === 'linux') {
                        for (const line of lines) {
                            if (line.includes('pulse') || line.includes('alsa')) {
                                const match = line.match(/\[([^\]]+)\]/);
                                if (match) {
                                    devices.push({
                                        id: match[1],
                                        name: match[1],
                                        isDefault: match[1] === 'default'
                                    });
                                }
                            }
                        }
                    }
                    
                    console.log('Parsed devices:', devices);
                    
                    // Если не нашли устройства, возвращаем дефолтные
                    if (devices.length === 0) {
                        console.log('No devices found, using default');
                        const platformCommands = FFmpegAudioRecorder.getPlatformCommands();
                        devices.push({
                            id: platformCommands.defaultDevice,
                            name: 'Default Audio Device',
                            isDefault: true
                        });
                    }
                    
                    resolve(devices);
                });

                listProcess.on('error', (error) => {
                    console.error('Error detecting devices:', error);
                    const platformCommands = FFmpegAudioRecorder.getPlatformCommands();
                    resolve([{
                        id: platformCommands.defaultDevice,
                        name: 'Default Audio Device (Error)',
                        isDefault: true
                    }]); // Fallback
                });
            });

        } catch (error) {
            console.error('Exception in detectInputDevices:', error);
            const platformCommands = FFmpegAudioRecorder.getPlatformCommands();
            return [{
                id: platformCommands.defaultDevice,
                name: 'Default Audio Device (Exception)',
                isDefault: true
            }]; // Fallback если что-то пошло не так
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
            // Запускаем диагностику для получения рекомендуемого устройства
            console.log('Running audio diagnostics...');
            const diagnostics = await FFmpegAudioRecorder.runDiagnostics();
            
            if (diagnostics.errors.length > 0) {
                console.warn('Diagnostic errors:', diagnostics.errors);
            }
            
            if (diagnostics.warnings.length > 0) {
                console.warn('Diagnostic warnings:', diagnostics.warnings);
            }

            // Создаем временный файл
            const tempFile = tmp.fileSync({ 
                prefix: 'vscs-recording-', 
                postfix: `.${this.options.audioFormat || 'wav'}`,
                keep: false // будет удален автоматически
            });
            
            this.tempFilePath = tempFile.name;
            this.tempFileCleanup = tempFile.removeCallback;

            const config = vscode.workspace.getConfiguration('speechToTextWhisper');
            const selectedDeviceId = config.get<string>('inputDevice', 'auto');
            const platformCommands = FFmpegAudioRecorder.getPlatformCommands();
            
            // Определяем устройство для записи
            let deviceToUse: string;
            
            try {
                // Получаем доступные устройства
                const devices = await FFmpegAudioRecorder.detectInputDevices();
                
                if (selectedDeviceId === 'auto' || !selectedDeviceId) {
                    // Используем первое доступное устройство (обычно default)
                    const defaultDevice = devices.find(device => device.isDefault) || devices[0];
                    deviceToUse = defaultDevice?.id || platformCommands.defaultDevice;
                    console.log(`🎯 Using auto-selected device: ${defaultDevice?.name || 'Default'} (${deviceToUse})`);
                } else {
                    // Проверяем, существует ли выбранное устройство
                    const selectedDevice = devices.find(device => device.id === selectedDeviceId);
                    if (selectedDevice) {
                        deviceToUse = selectedDevice.id;
                        console.log(`🎯 Using configured device: ${selectedDevice.name} (${deviceToUse})`);
                    } else {
                        console.warn(`⚠️ Configured device "${selectedDeviceId}" not found, falling back to default`);
                        const defaultDevice = devices.find(device => device.isDefault) || devices[0];
                        deviceToUse = defaultDevice?.id || platformCommands.defaultDevice;
                    }
                }
            } catch (error) {
                console.warn(`⚠️ Failed to get devices list, using platform default: ${(error as Error).message}`);
                deviceToUse = platformCommands.defaultDevice;
            }

            // Формируем команду FFmpeg с рекомендуемым устройством
            const ffmpegArgs = this.buildFFmpegArgs(this.tempFilePath, deviceToUse);
            
            console.log(`Starting recording with command: ffmpeg ${ffmpegArgs.join(' ')}`);
            
            // Запускаем процесс записи
            this.ffmpegProcess = spawn(ffmpegCheck.path!, ffmpegArgs);
            
            this.setupFFmpegEvents();
            this.recordingStartTime = Date.now();
            this.isRecording = true;

            // Устанавливаем таймер максимальной продолжительности
            this.setupMaxDurationTimer();
            
            // Инициализируем определение тишины если включено
            this.setupSilenceDetection();

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
        this.log(`🎤 [RECORDER] stopRecording called. Current isRecording: ${this.isRecording}`);
        this.log(`🎤 [RECORDER] stopRecording: ffmpegProcess exists: ${!!this.ffmpegProcess}`);
        this.log(`🎤 [RECORDER] stopRecording: ffmpegProcess killed: ${this.ffmpegProcess?.killed}`);
        this.log(`🎤 [RECORDER] stopRecording: tempFilePath: ${this.tempFilePath}`);
        
        if (!this.isRecording || !this.ffmpegProcess) {
            this.logWarn(`🎤 [RECORDER] stopRecording: Not recording or no process. isRecording: ${this.isRecording}, ffmpegProcess: ${!!this.ffmpegProcess}`);
            return;
        }

        const recordingDuration = Date.now() - this.recordingStartTime;
        this.log(`📊 Recording duration: ${recordingDuration}ms`);

        // Если запись слишком короткая (менее 500ms), покажем предупреждение
        if (recordingDuration < 500) {
            this.logWarn('⚠️ Very short recording detected, may result in empty file');
            // Но все равно попробуем остановить запись
        }

        // Очищаем таймеры при остановке записи
        this.log(`🎤 [RECORDER] stopRecording: Clearing timers...`);
        this.clearMaxDurationTimer();
        this.clearSilenceTimer();
        this.log(`🎤 [RECORDER] stopRecording: Timers cleared`);

        try {
            this.log(`🎤 [RECORDER] stopRecording: About to send SIGTERM to FFmpeg process PID: ${this.ffmpegProcess.pid}`);
            // Отправляем SIGTERM для graceful shutdown
            this.ffmpegProcess.kill('SIGTERM');
            this.log(`🎤 [RECORDER] stopRecording: SIGTERM sent successfully`);
            
            // Timeout на случай, если процесс не завершится gracefully
            setTimeout(() => {
                this.log(`🎤 [RECORDER] stopRecording: Timeout callback triggered. Process killed: ${this.ffmpegProcess?.killed}, exists: ${!!this.ffmpegProcess}`);
                if (this.ffmpegProcess && !this.ffmpegProcess.killed) {
                    this.log('⚠️ FFmpeg process did not terminate gracefully, forcing kill');
                    this.ffmpegProcess.kill('SIGKILL');
                    this.log('⚠️ SIGKILL sent to FFmpeg process');
                }
            }, 5000);

        } catch (error) {
            this.logError(`🎤 [RECORDER] stopRecording: Error while killing process: ${error}`);
            this.events.onError(new Error(`Error stopping recording: ${(error as Error).message}`));
        }
        
        this.log(`🎤 [RECORDER] stopRecording: Method completed, waiting for 'close' event...`);
    }

    /**
     * Создание аргументов для FFmpeg команды
     */
    private buildFFmpegArgs(outputPath: string, recommendedDevice?: string): string[] {
        const platformCommands = FFmpegAudioRecorder.getPlatformCommands();
        const args: string[] = [];

        // Уровень логирования
        args.push('-loglevel', 'info');

        // Платформо-специфический ввод
        const inputParts = platformCommands.audioInput.split(' ');
        args.push(...inputParts);

        // Устройство ввода
        const inputDevice = recommendedDevice || platformCommands.defaultDevice;
        console.log(`Using input device: ${inputDevice} (platform: ${platformCommands.platform})`);
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

        console.log(`FFmpeg command: ffmpeg ${args.join(' ')}`);
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
        if (!this.ffmpegProcess) {
            this.log(`🎤 [RECORDER] setupFFmpegEvents: No ffmpegProcess to setup events for`);
            return;
        }

        this.log(`🎤 [RECORDER] setupFFmpegEvents: Setting up events for FFmpeg PID: ${this.ffmpegProcess.pid}`);

        this.ffmpegProcess.on('close', (code) => {
            this.log(`🎤 [RECORDER] FFmpeg 'close' event triggered!`);
            this.log(`🎤 [RECORDER] FFmpeg process closed with code: ${code}`);
            this.log(`🎤 [RECORDER] Current isRecording state at close: ${this.isRecording}`);
            this.log(`🎤 [RECORDER] Process PID: ${this.ffmpegProcess?.pid}`);
            this.log(`🎤 [RECORDER] Process killed: ${this.ffmpegProcess?.killed}`);
            this.log(`🎤 [RECORDER] tempFilePath: ${this.tempFilePath}`);
            
            if (this.isRecording) {
                this.log(`🎤 [RECORDER] isRecording is true, calling handleRecordingComplete...`);
                this.handleRecordingComplete(code);
            } else {
                this.logWarn('🎤 [RECORDER] FFmpeg process closed, but isRecording was false. Skipping handleRecordingComplete.');
                this.log(`🎤 [RECORDER] Calling cleanup due to isRecording = false`);
                this.cleanup(); 
            }
        });

        this.ffmpegProcess.on('error', (error) => {
            this.logError(`🎤 [RECORDER] FFmpeg process error event: ${error}`);
            this.log(`🎤 [RECORDER] Error event: Setting isRecording to false`);
            this.isRecording = false;
            this.clearMaxDurationTimer();
            this.log(`🎤 [RECORDER] Error event: Calling events.onError`);
            this.events.onError(new Error(`FFmpeg process error: ${error.message}`));
            this.cleanup();
        });

        this.ffmpegProcess.stdout?.on('data', (data) => {
            const output = data.toString();
            this.log(`🎤 [RECORDER] FFmpeg stdout: ${output.trim()}`);
        });

        this.ffmpegProcess.stderr?.on('data', (data) => {
            const output = data.toString();
            this.log(`🎤 [RECORDER] FFmpeg stderr: ${output.trim()}`);
            
            // Обновляем время последней аудио активности только при РЕАЛЬНЫХ индикаторах активности
            // Убираем слишком агрессивную логику, которая считала любое сообщение активностью
            
            // Проверяем на индикаторы реальной аудио активности
            if (output.includes('size=') && output.includes('time=') && output.includes('bitrate=') && 
                output.includes('kbits/s') && !output.includes('size=       0kB')) {
                // Это сообщение о прогрессе записи с реальными данными - означает аудио активность
                this.log('🎵 Audio activity detected: recording progress with data');
                this.updateLastAudioTime();
            } else if (output.includes('Stream #') && output.includes('Audio:')) {
                // Информация о аудио потоке - считаем началом активности (однократно)
                this.log('🎵 Audio activity detected: stream info');
                this.updateLastAudioTime();
            } else if (output.includes('Press [q] to quit')) {
                // FFmpeg готов к записи - считаем началом активности (однократно)
                this.log('🎵 Audio activity detected: FFmpeg ready');
                this.updateLastAudioTime();
            } else if (output.includes('Input #0') || output.includes('Output #0')) {
                // Информация о входе/выходе - активность настройки (однократно)
                this.log('🎵 Audio activity detected: input/output setup');
                this.updateLastAudioTime();
            }
            
            // Ищем специфические ошибки, которые могут указывать на проблемы
            if (output.includes('No such file or directory')) {
                this.logError(`❌ FFmpeg error: Input device not found - ${output}`);
                this.events.onError(new Error('Audio input device not found. Please check your microphone.'));
                return;
            }
            
            if (output.includes('Permission denied')) {
                this.logError(`❌ FFmpeg error: Permission denied - ${output}`);
                this.events.onError(new Error('Permission denied accessing microphone. Please grant microphone access to VS Code.'));
                return;
            }
            
            if (output.includes('Device or resource busy')) {
                this.logError(`❌ FFmpeg error: Device busy - ${output}`);
                this.events.onError(new Error('Microphone is busy or being used by another application.'));
                return;
            }
            
            if (output.includes('Invalid data found when processing input')) {
                this.logError(`❌ FFmpeg error: Invalid input data - ${output}`);
                this.events.onError(new Error('Invalid audio input. Please check your microphone settings.'));
                return;
            }
            
            if (output.includes('Immediate exit requested')) {
                this.log('ℹ️ FFmpeg immediate exit (normal for short recordings)');
                return;
            }
            
            // Ошибки устройств на macOS
            if (output.includes('AVFoundation input device') && output.includes('not found')) {
                this.logError(`❌ macOS audio device error: ${output}`);
                this.events.onError(new Error('Audio input device not found on macOS. Please check microphone permissions in System Preferences.'));
                return;
            }
            
            // Проверяем на успешные индикаторы записи
            if (output.includes('size=') && output.includes('time=')) {
                this.log('✅ FFmpeg recording progress:', output.trim());
            }
        });
        
        this.log(`🎤 [RECORDER] setupFFmpegEvents: All event handlers setup completed`);
    }

    /**
     * Обработка завершения записи
     */
    private async handleRecordingComplete(exitCode: number | null): Promise<void> {
        this.log(`🎤 [RECORDER] handleRecordingComplete called. Exit code: ${exitCode}, Original isRecording: ${this.isRecording}`);
        const wasRecording = this.isRecording;
        this.isRecording = false; 
        
        this.clearMaxDurationTimer();
        this.clearSilenceTimer();

        try {
            this.log(`🎤 [RECORDER] handleRecordingComplete: Cleared timers. WasRecording: ${wasRecording}`);

            if (!wasRecording) {
                this.logWarn('🎤 [RECORDER] handleRecordingComplete called, but wasRecording is false. Potential issue or duplicate call. Cleaning up.');
                this.cleanup();
                return;
            }

            // На macOS FFmpeg может завершиться с кодом 255 при SIGTERM, что нормально
            // Также код null означает, что процесс был убит принудительно
            if (exitCode !== 0 && exitCode !== null && exitCode !== 255) {
                this.logWarn(`FFmpeg exited with code ${exitCode}, but checking if file was created anyway`);
            }

            // Проверяем наличие tempFilePath до всех операций
            if (!this.tempFilePath) {
                throw new Error('Recording was cancelled or temp file path is not available');
            }

            const currentTempFilePath = this.tempFilePath; // Сохраняем локальную копию

            // Даем FFmpeg время записать файл
            await new Promise(resolve => setTimeout(resolve, 100));

            this.log(`Checking for recording file: ${currentTempFilePath}`);

            if (!fs.existsSync(currentTempFilePath)) {
                // Попробуем подождать еще немного
                await new Promise(resolve => setTimeout(resolve, 500));
                if (!fs.existsSync(currentTempFilePath)) {
                    throw new Error(`Recording file was not created at: ${currentTempFilePath}`);
                }
            }

            // Проверяем размер файла - если файл пустой, это ошибка
            const stats = fs.statSync(currentTempFilePath);
            this.log(`Recording file size: ${stats.size} bytes`);
            
            const recordingDuration = Date.now() - this.recordingStartTime;
            const MIN_FILE_SIZE = 1000; // Минимум 1KB для валидного аудиофайла
            
            if (stats.size === 0) {
                // Подождем еще немного и проверим снова
                await new Promise(resolve => setTimeout(resolve, 500));
                const newStats = fs.statSync(currentTempFilePath);
                this.log(`Recording file size after wait: ${newStats.size} bytes`);
                
                if (newStats.size === 0) {
                    this.logError(`❌ Recording file is empty after ${recordingDuration}ms recording`);
                    
                    if (recordingDuration < 500) {
                        throw new Error('Recording too short. Hold the record button for at least 0.5 seconds.');
                    } else {
                        throw new Error('Recording file is empty. Please check your microphone permissions and ensure your microphone is working.');
                    }
                }
            } else if (stats.size < MIN_FILE_SIZE) {
                this.logWarn(`⚠️ Recording file is very small: ${stats.size} bytes (duration: ${recordingDuration}ms)`);
                
                if (recordingDuration < 500) {
                    throw new Error(`Recording too short (${recordingDuration}ms). Hold the record button longer to capture audio.`);
                } else {
                    throw new Error(`Recording file too small (${stats.size} bytes). Please check your microphone and try again.`);
                }
            }

            // Читаем записанный файл
            const audioBuffer = fs.readFileSync(currentTempFilePath);
            
            // Определяем MIME type и расширение файла
            const mimeType = this.getMimeType();
            const fileExtension = this.getFileExtension();
            
            // Создаем Blob совместимый с текущим API
            // Добавляем свойство name для определения формата в Whisper API
            const audioBlob = new Blob([audioBuffer], { type: mimeType }) as Blob & { name?: string };
            audioBlob.name = `recording.${fileExtension}`;

            this.log(`Recording completed successfully: ${audioBuffer.length} bytes, ${mimeType}, filename: ${audioBlob.name}`);
            this.log(`🎤 [RECORDER] handleRecordingComplete: About to call events.onRecordingStop. Blob name: ${audioBlob.name}, size: ${audioBlob.size}`);
            // Уведомляем о завершении записи
            this.events.onRecordingStop(audioBlob);
            
        } catch (error) {
            this.logError(`🎤 [RECORDER] Error processing recording in handleRecordingComplete: ${error}`);
            this.events.onError(new Error(`Failed to process recording: ${(error as Error).message}`));
        } finally {
            this.log('🎤 [RECORDER] handleRecordingComplete: Entering finally block for cleanup.');
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
     * Получение расширения файла для записанного аудио
     */
    private getFileExtension(): string {
        const format = this.options.audioFormat || 'wav';
        
        switch (format) {
            case 'wav':
                return 'wav';
            case 'mp3':
                return 'mp3';
            case 'opus':
                return 'opus';
            case 'webm':
                return 'webm';
            default:
                return 'wav';
        }
    }

    /**
     * Настройка таймера максимальной продолжительности записи
     */
    private setupMaxDurationTimer(): void {
        console.log(`⏱️ setupMaxDurationTimer called, maxDuration=${this.options.maxDuration}`);
        
        if (this.options.maxDuration && this.options.maxDuration > 0) {
            const maxDurationMs = this.options.maxDuration * 1000;
            console.log(`⏱️ Setting up max duration timer: ${this.options.maxDuration}s (${maxDurationMs}ms)`);
            
            this.maxDurationTimer = setTimeout(() => {
                console.log(`⏱️ ⏰ Max duration timer triggered after ${this.options.maxDuration}s - stopping recording`);
                this.stopRecording();
            }, maxDurationMs);
            
            console.log(`⏱️ Max duration timer set successfully`);
        } else {
            console.log(`⏱️ No max duration set or invalid value (${this.options.maxDuration})`);
        }
    }

    /**
     * Настройка определения тишины
     */
    private setupSilenceDetection(): void {
        console.log(`🔇 setupSilenceDetection called, silenceDetection=${this.options.silenceDetection}`);
        
        if (this.options.silenceDetection !== true) {
            console.log('🔇 Silence detection disabled - will only use maxDuration timer');
            // ❌ НЕ ВОЗВРАЩАЕМСЯ! Нужно убедиться что есть хотя бы maxDuration контроль
            // Даже без детекции тишины должен работать таймер максимальной продолжительности
            return;
        }

        console.log('🔇 Silence detection enabled - setting up silence monitoring');
        this.silenceDetectionEnabled = true;
        
        // Устанавливаем начальное время аудио активности в момент старта записи
        this.lastAudioTime = this.recordingStartTime;

        const silenceDuration = (this.options.silenceDuration || 3) * 1000; // Преобразуем в миллисекунды
        const minRecordingTime = 2000; // Минимум 2 секунды записи перед включением определения тишины

        console.log(`🔇 Silence detection parameters: ${silenceDuration}ms silence threshold, ${minRecordingTime}ms minimum recording time`);
        console.log(`🔇 Initial lastAudioTime set to: ${this.lastAudioTime}`);

        // Запускаем таймер проверки тишины каждые 500ms
        const checkSilence = () => {
            if (!this.isRecording || !this.silenceDetectionEnabled) {
                console.log('🔇 Stopping silence check - recording stopped or silence detection disabled');
                return;
            }

            const recordingDuration = Date.now() - this.recordingStartTime;
            const timeSinceLastAudio = Date.now() - this.lastAudioTime;
            
            console.log(`🔇 Silence check: recording=${recordingDuration}ms, since_audio=${timeSinceLastAudio}ms, min_time=${minRecordingTime}ms, threshold=${silenceDuration}ms`);
            
            // Не проверяем тишину в первые minRecordingTime миллисекунд
            if (recordingDuration < minRecordingTime) {
                console.log(`🔇 Still in minimum recording period (${recordingDuration}ms < ${minRecordingTime}ms)`);
                this.silenceTimer = setTimeout(checkSilence, 500);
                return;
            }
            
            if (timeSinceLastAudio >= silenceDuration) {
                console.log(`🔇 ⏰ Silence detected for ${timeSinceLastAudio}ms (>= ${silenceDuration}ms), stopping recording (total duration: ${recordingDuration}ms)`);
                this.stopRecording();
                return;
            }

            // Планируем следующую проверку
            this.silenceTimer = setTimeout(checkSilence, 500);
        };

        // Запускаем первую проверку через 1 секунду после начала записи
        console.log('🔇 Starting silence detection timer - first check in 1000ms');
        this.silenceTimer = setTimeout(checkSilence, 1000);
    }

    /**
     * Обновление времени последней активности аудио
     */
    private updateLastAudioTime(): void {
        if (this.silenceDetectionEnabled) {
            const oldTime = this.lastAudioTime;
            this.lastAudioTime = Date.now();
            const timeSinceLastUpdate = this.lastAudioTime - oldTime;
            console.log(`🔇 Audio activity: lastAudioTime updated (was ${timeSinceLastUpdate}ms ago)`);
        } else {
            console.log('🔇 Audio activity detected, but silence detection is disabled - ignoring');
        }
    }

    /**
     * Очистка таймера определения тишины
     */
    private clearSilenceTimer(): void {
        if (this.silenceTimer) {
            console.log('🔇 Clearing silence detection timer');
            clearTimeout(this.silenceTimer);
            this.silenceTimer = null;
        } else {
            console.log('🔇 Silence detection timer was not set, nothing to clear');
        }
        
        if (this.silenceDetectionEnabled) {
            console.log('🔇 Disabling silence detection');
            this.silenceDetectionEnabled = false;
        }
    }

    /**
     * Очистка таймера максимальной продолжительности
     */
    private clearMaxDurationTimer(): void {
        if (this.maxDurationTimer) {
            console.log('⏱️ Clearing max duration timer');
            clearTimeout(this.maxDurationTimer);
            this.maxDurationTimer = null;
        } else {
            console.log('⏱️ Max duration timer was not set, nothing to clear');
        }
    }

    /**
     * Очистка ресурсов
     */
    private cleanup(): void {
        this.clearMaxDurationTimer();
        this.clearSilenceTimer();
        
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

    /**
     * Диагностика аудиоустройств и FFmpeg
     */
    static async runDiagnostics(): Promise<{
        ffmpegAvailable: FFmpegAvailability;
        inputDevices: string[];
        platform: string;
        platformCommands: PlatformCommands;
        recommendedDevice?: string;
        errors: string[];
        warnings: string[];
    }> {
        const result = {
            ffmpegAvailable: await FFmpegAudioRecorder.checkFFmpegAvailability(),
            inputDevices: [] as string[],
            platform: FFmpegAudioRecorder.detectPlatform(),
            platformCommands: FFmpegAudioRecorder.getPlatformCommands(),
            recommendedDevice: undefined as string | undefined,
            errors: [] as string[],
            warnings: [] as string[]
        };

        // Проверяем доступные устройства только если FFmpeg доступен
        if (result.ffmpegAvailable.available) {
            try {
                result.inputDevices = await FFmpegAudioRecorder.detectInputDevices().then(devices => devices.map(device => device.name));
                
                // Рекомендации по устройствам для macOS
                if (result.platform === 'macos') {
                    // Проверяем доступность устройства ":0"
                    const hasBuiltinMic = result.inputDevices.some(device => 
                        device.toLowerCase().includes('built-in') || 
                        device.toLowerCase().includes('microphone')
                    );
                    
                    if (!hasBuiltinMic) {
                        result.warnings.push('Built-in microphone not detected. You may need to grant microphone permissions to VS Code.');
                    }
                    
                    // Если есть устройства, рекомендуем первое найденное аудиоустройство
                    if (result.inputDevices.length > 0) {
                        // Ищем устройство в формате [0] Device Name
                        const firstDevice = result.inputDevices[0];
                        const match = firstDevice.match(/^\[(\d+)\]/);
                        if (match) {
                            result.recommendedDevice = `:${match[1]}`;
                        } else {
                            // Fallback - используем :0
                            result.recommendedDevice = ':0';
                        }
                    }
                }
            } catch (error) {
                result.errors.push(`Failed to detect input devices: ${(error as Error).message}`);
            }
        }

        return result;
    }

    /**
     * Тест записи аудио для диагностики
     */
    static async testRecording(duration: number = 2): Promise<{
        success: boolean;
        fileSize: number;
        duration: number;
        error?: string;
        command?: string;
    }> {
        const diagnostics = await FFmpegAudioRecorder.runDiagnostics();
        
        if (!diagnostics.ffmpegAvailable.available) {
            return {
                success: false,
                fileSize: 0,
                duration: 0,
                error: diagnostics.ffmpegAvailable.error || 'FFmpeg not available'
            };
        }

        return new Promise((resolve) => {
            const tempFile = tmp.fileSync({ 
                prefix: 'vscs-test-recording-', 
                postfix: '.wav',
                keep: false
            });

            const platformCommands = FFmpegAudioRecorder.getPlatformCommands();
            const inputDevice = diagnostics.recommendedDevice || platformCommands.defaultDevice;
            
            const args = [
                '-loglevel', 'info',  // Больше информации для диагностики
                ...platformCommands.audioInput.split(' '),
                '-i', inputDevice,
                '-ar', '16000',
                '-ac', '1',
                '-acodec', 'pcm_s16le',
                '-t', duration.toString(),
                '-y',
                tempFile.name
            ];

            console.log(`Test recording command: ffmpeg ${args.join(' ')}`);

            const startTime = Date.now();
            const testProcess = spawn(diagnostics.ffmpegAvailable.path!, args);
            
            let errorOutput = '';
            let hasOutput = false;

            testProcess.stderr?.on('data', (data) => {
                const output = data.toString();
                errorOutput += output;
                console.log('FFmpeg test stderr:', output);
                
                // Проверяем есть ли признаки успешной записи
                if (output.includes('size=') || output.includes('time=')) {
                    hasOutput = true;
                }
            });

            testProcess.on('close', (code) => {
                const actualDuration = Date.now() - startTime;
                
                try {
                    if (fs.existsSync(tempFile.name)) {
                        const stats = fs.statSync(tempFile.name);
                        
                        // Очищаем временный файл
                        tempFile.removeCallback();
                        
                        resolve({
                            success: code === 0 && stats.size > 0,
                            fileSize: stats.size,
                            duration: actualDuration,
                            command: `ffmpeg ${args.join(' ')}`,
                            error: code !== 0 ? `Exit code: ${code}, stderr: ${errorOutput}` : undefined
                        });
                    } else {
                        resolve({
                            success: false,
                            fileSize: 0,
                            duration: actualDuration,
                            command: `ffmpeg ${args.join(' ')}`,
                            error: `No output file created. Exit code: ${code}, stderr: ${errorOutput}`
                        });
                    }
                } catch (error) {
                    resolve({
                        success: false,
                        fileSize: 0,
                        duration: actualDuration,
                        command: `ffmpeg ${args.join(' ')}`,
                        error: `Error checking file: ${(error as Error).message}`
                    });
                }
            });

            testProcess.on('error', (error) => {
                resolve({
                    success: false,
                    fileSize: 0,
                    duration: Date.now() - startTime,
                    command: `ffmpeg ${args.join(' ')}`,
                    error: `Process error: ${error.message}`
                });
            });
        });
    }
}