// FFmpegAudioRecorder.ts - module for recording audio through FFmpeg

import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as tmp from 'tmp';
import which from 'which';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';

// Compatible interfaces with the current AudioRecorder
export interface AudioRecorderEvents {
    onRecordingStart: () => void;
    onRecordingStop: (audioBlob: Blob) => void;
    onError: (error: Error) => void;
    onDataAvailable?: (data: Blob) => void;
}

export interface AudioRecordingOptions {
    sampleRate?: number;           // -ar (default: 16000)
    channelCount?: number;         // -ac (default: 1)
    echoCancellation?: boolean;    // ignored in FFmpeg
    noiseSuppression?: boolean;    // ignored in FFmpeg
    autoGainControl?: boolean;     // ignored in FFmpeg
    quality?: 'standard' | 'high' | 'ultra';
    maxDuration?: number;          // -t (in seconds)
    audioFormat?: 'wav' | 'mp3' | 'webm' | 'opus'; // output file format
    silenceDetection?: boolean;    // silence detection
    silenceThreshold?: number;     // silence threshold in dB (default: -50)
    silenceDuration?: number;      // silence duration for auto-stop in seconds (default: 3)
    inputDevice?: string;          // auto-detection or device path
    codec?: string;               // -acodec (default: pcm_s16le for WAV)
    outputPath?: string;          // temporary folder for files
    ffmpegPath?: string;          // path to the FFmpeg executable file
}

// Platform-specific commands for FFmpeg
export interface PlatformCommands {
    platform: 'windows' | 'macos' | 'linux';
    audioInput: string;
    defaultDevice: string;
}

// Result of checking FFmpeg
export interface FFmpegAvailability {
    available: boolean;
    version?: string;
    path?: string;
    error?: string;
}

// Result of detecting audio devices
export interface AudioDevice {
    id: string;           // ID for FFmpeg (e.g., ":0", ":1")
    name: string;         // Readable name (e.g., "MacBook Pro Microphone")
    isDefault?: boolean;  // Is the device the default one
}

export class FFmpegAudioRecorder {
    private ffmpegProcess: ChildProcess | null = null;
    private isRecording = false;
    private recordingStartTime: number = 0;
    private maxDurationTimer: NodeJS.Timeout | null = null;
    private tempFilePath: string | null = null;
    private tempFileCleanup: (() => void) | null = null;
    
    // Variables for determining silence
    private silenceTimer: NodeJS.Timeout | null = null;
    private lastAudioTime: number = 0;
    private silenceDetectionEnabled: boolean = false;
    private lastFileSize: number = 0; // DEPRECATED: Tracking file size for growth detection
    
    // New variables for volumedetect system
    private volumeDetectProcess: ChildProcess | null = null;
    private volumeTempFilePath: string | null = null;
    private volumeTempFileCleanup: (() => void) | null = null;
    private lastVolumeLevel: number = -91; // dB, start with "silence"
    private volumeCheckInterval: NodeJS.Timeout | null = null;
    private volumeSegmentDuration: number = 1; // seconds for analyzing segments
    private currentRecordingDevice: string | null = null; // current recording device

    constructor(
        private events: AudioRecorderEvents,
        private options: AudioRecordingOptions = {},
        private outputChannel?: any // vscode.OutputChannel, but avoid importing vscode here
    ) {
        // Setup temporary cleanup on process exit
        process.on('exit', () => this.cleanup());
        process.on('SIGINT', () => this.cleanup());
        process.on('SIGTERM', () => this.cleanup());
    }

    /**
     * Logging with support for outputChannel
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
     * Determining the current platform
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
     * Getting
     */
    static getPlatformCommands(): PlatformCommands {
        const platform = FFmpegAudioRecorder.detectPlatform();
        
        switch (platform) {
            case 'macos':
                return {
                    platform,
                    audioInput: '-f avfoundation',
                    defaultDevice: ':0'  // ":0" - first audio device (microphone)
                };
            case 'windows':
                return {
                    platform,
                    audioInput: '-f dshow',
                    defaultDevice: 'audio="Microphone"'  // can also use "default"
                };
            case 'linux':
                return {
                    platform,
                    audioInput: '-f pulse',  // or -f alsa
                    defaultDevice: 'default'  // or hw:0
                };
        }
    }

    /**
     * Checking the availability of FFmpeg in the system
     */
    static async checkFFmpegAvailability(): Promise<FFmpegAvailability> {
        try {
            // First try to find FFmpeg in PATH
            let ffmpegPath: string;
            try {
                ffmpegPath = await which('ffmpeg');
            } catch (pathError) {
                return {
                    available: false,
                    error: 'FFmpeg not found in PATH. Please install FFmpeg and add it to your system PATH, or specify the path in extension settings.'
                };
            }

            // Check the version to confirm functionality
            return new Promise((resolve) => {
                const versionProcess = spawn(ffmpegPath, ['-version']);
                let output = '';
                
                versionProcess.stdout.on('data', (data) => {
                    output += data.toString();
                });

                versionProcess.on('close', (code) => {
                    if (code === 0) {
                        // Extract the version from output
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
     * Detecting available audio devices
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

                const listProcess = spawn(ffmpegPath, args);
                let output = '';
                
                // AVFoundation output goes to stderr
                listProcess.stderr.on('data', (data) => {
                    output += data.toString();
                });

                listProcess.on('close', () => {
                    const devices: AudioDevice[] = [];
                    
                    // Parsing depends on the platform
                    const lines = output.split('\n');
                    
                    if (platform === 'macos') {
                        let inAudioSection = false;
                        
                        for (const line of lines) {
                            const trimmedLine = line.trim();
                            
                            // Search for the beginning of the audio devices section
                            if (trimmedLine.includes('AVFoundation audio devices:')) {
                                inAudioSection = true;
                                continue;
                            }
                            
                            // Parse audio devices in the format [AVFoundation indev @ 0x...] [0] Device Name
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
                    
                    // If no devices are found, return default ones
                    if (devices.length === 0) {
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
            }]; // Fallback if something went wrong
        }
    }

    /**
     * Start recording audio
     */
    async startRecording(): Promise<void> {
        if (this.isRecording) {
            throw new Error('Recording is already in progress');
        }

        // Check the availability of FFmpeg
        const ffmpegCheck = await FFmpegAudioRecorder.checkFFmpegAvailability();
        if (!ffmpegCheck.available || !ffmpegCheck.path) {
            throw new Error(ffmpegCheck.error || 'FFmpeg is not available');
        }

        try {
            // Run diagnostics to get the recommended device
            const diagnostics = await FFmpegAudioRecorder.runDiagnostics();
            
            if (diagnostics.errors.length > 0) {
                console.warn('Diagnostic errors:', diagnostics.errors);
            }
            
            if (diagnostics.warnings.length > 0) {
                console.warn('Diagnostic warnings:', diagnostics.warnings);
            }

            // Create a temporary file
            const tempFile = tmp.fileSync({ 
                prefix: 'vscs-recording-', 
                postfix: `.${this.options.audioFormat || 'wav'}`,
                keep: false // will be deleted automatically
            });
            
            this.tempFilePath = tempFile.name;
            this.tempFileCleanup = tempFile.removeCallback;

            const config = vscode.workspace.getConfiguration('speechToTextWhisper');
            const selectedDeviceId = config.get<string>('inputDevice', 'auto');
            const platformCommands = FFmpegAudioRecorder.getPlatformCommands();
            
            // Define the device for recording
            let deviceToUse: string;
            
            try {
                // Get available devices
                const devices = await FFmpegAudioRecorder.detectInputDevices();
                
                if (selectedDeviceId === 'auto' || !selectedDeviceId) {
                    // Use the first available device (usually default)
                    const defaultDevice = devices.find(device => device.isDefault) || devices[0];
                    deviceToUse = defaultDevice?.id || platformCommands.defaultDevice;
                } else {
                    // Check if the selected device exists
                    const selectedDevice = devices.find(device => device.id === selectedDeviceId);
                    if (selectedDevice) {
                        deviceToUse = selectedDevice.id;
                    } else {
                        const defaultDevice = devices.find(device => device.isDefault) || devices[0];
                        deviceToUse = defaultDevice?.id || platformCommands.defaultDevice;
                    }
                }
            } catch (error) {
                deviceToUse = platformCommands.defaultDevice;
            }

            // Build the FFmpeg command with the recommended device
            const ffmpegArgs = this.buildFFmpegArgs(this.tempFilePath, deviceToUse);
            
            // Start the recording process
            this.ffmpegProcess = spawn(ffmpegCheck.path!, ffmpegArgs);
            
            this.setupFFmpegEvents();
            this.recordingStartTime = Date.now();
            this.lastFileSize = 0; // Reset the file size for a new recording
            this.isRecording = true;

            // Set the maximum duration timer
            this.setupMaxDurationTimer();
            
            // Initialize silence detection if enabled
            this.setupSilenceDetection();

            // Save the device for volumedetect and start volume analysis
            this.currentRecordingDevice = deviceToUse;
            if (this.options.silenceDetection) {
                await this.startVolumeDetection(deviceToUse);
            }

            // Notify about the start of recording
            this.events.onRecordingStart();

        } catch (error) {
            this.cleanup();
            throw new Error(`Failed to start recording: ${(error as Error).message}`);
        }
    }

    /**
     * Stop recording audio
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

        // If the recording is too short (less than 500ms), show a warning
        if (recordingDuration < 500) {
            this.logWarn('⚠️ Very short recording detected, may result in empty file');
            // But still try to stop the recording
        }

        // Clear timers when stopping the recording
        this.log(`🎤 [RECORDER] stopRecording: Clearing timers...`);
        this.clearMaxDurationTimer();
        this.clearSilenceTimer();
        this.log(`🎤 [RECORDER] stopRecording: Timers cleared`);

        try {
            this.log(`🎤 [RECORDER] stopRecording: About to send SIGTERM to FFmpeg process PID: ${this.ffmpegProcess.pid}`);
            // Send SIGTERM for graceful shutdown
            this.ffmpegProcess.kill('SIGTERM');
            this.log(`🎤 [RECORDER] stopRecording: SIGTERM sent successfully`);
            
            // Timeout in case the process does not terminate gracefully
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
     * Creating arguments for the FFmpeg command
     */
    private buildFFmpegArgs(outputPath: string, recommendedDevice?: string): string[] {
        const platformCommands = FFmpegAudioRecorder.getPlatformCommands();
        const args: string[] = [];

        // Logging level
        args.push('-loglevel', 'info');

        // Platform-specific input
        const inputParts = platformCommands.audioInput.split(' ');
        args.push(...inputParts);

        // Input device
        const inputDevice = recommendedDevice || platformCommands.defaultDevice;

        args.push('-i', inputDevice);

        // Audio settings
        if (this.options.sampleRate) {
            args.push('-ar', this.options.sampleRate.toString());
        } else {
            args.push('-ar', '16000'); // Default 16kHz for Whisper
        }

        if (this.options.channelCount) {
            args.push('-ac', this.options.channelCount.toString());
        } else {
            args.push('-ac', '1'); // Default Mono
        }

        // Codec
        const codec = this.options.codec || this.getDefaultCodec();
        args.push('-acodec', codec);

        // Maximum duration
        if (this.options.maxDuration) {
            args.push('-t', this.options.maxDuration.toString());
        }

        // Output file
        args.push('-y'); // Overwrite if exists
        args.push(outputPath);

        return args;
    }

    /**
     * Get the default codec for the format
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
     * Setting up event handlers for the FFmpeg process
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
            
            // Detailed logging for silence detection (now volumedetect controls activity)
            if (this.silenceDetectionEnabled) {
                this.log(`🔇 [VOLUMEDETECT] Processing FFmpeg output: "${output.trim()}"`);
                this.log(`🔇 [VOLUMEDETECT] Current lastAudioTime: ${this.lastAudioTime}, timeSinceLastAudio: ${Date.now() - this.lastAudioTime}ms`);
            }
            
            // Analyze recording progress for monitoring (activity is now determined by volumedetect)
            
            // Check for REAL audio activity indicators
            if (output.includes('size=') && output.includes('time=') && output.includes('bitrate=') && 
                output.includes('kbits/s')) {
                // This is a progress message - check if there are real data
                
                if (this.silenceDetectionEnabled) {
                    this.log(`🔇 [LEGACY DEBUG] Found progress message: ${output.trim()}`);
                }
                
                // Extract the size from the string "size=      14KiB time=00:00:00.51 bitrate= 219.8kbits/s"
                // Support both formats: kB/MB/B (decimal) and KiB/MiB/B (binary)
                const sizeMatch = output.match(/size=\s*(\d+(?:\.\d+)?)(KiB|MiB|kB|MB|B|bytes?)/i);
                if (sizeMatch) {
                    const size = parseFloat(sizeMatch[1]);
                    const unit = sizeMatch[2].toLowerCase();
                    
                    // Convert to bytes for uniformity
                    let sizeInBytes = size;
                    if (unit === 'kib' || unit === 'kb') {
                        sizeInBytes = size * 1024;
                    } else if (unit === 'mib' || unit === 'mb') {
                        sizeInBytes = size * 1024 * 1024;
                    }
                    
                    if (this.silenceDetectionEnabled) {
                        this.log(`🔇 [LEGACY DEBUG] Extracted file size: ${size}${unit} = ${sizeInBytes} bytes`);
                        this.log(`🔇 [LEGACY DEBUG] Previous file size: ${this.lastFileSize} bytes`);
                    }
                    
                    // OLD LOGIC (DISABLED): Activity detection by file size is not accurate
                    // Now we use volumedetect for precise volume analysis
                    if (this.silenceDetectionEnabled) {
                        this.log(`🔇 [LEGACY DEBUG] File size: ${size}${unit} = ${sizeInBytes} bytes (volumedetect now controls silence detection)`);
                    }
                    this.lastFileSize = sizeInBytes; // Save for compatibility with logs
                    
                    // NO MORE UPDATING lastAudioTime here - this is now done by volumedetect
                } else if (!output.includes('size=       0kB') && !output.includes('size=       0KiB') && !output.includes('size=       0B')) {
                    // Fallback: if we can't extract the size
                    if (this.silenceDetectionEnabled) {
                        this.log(`🔇 [LEGACY DEBUG] Unable to parse file size - volumedetect handles activity detection`);
                    }
                }
            } else if (this.silenceDetectionEnabled) {
                // Log messages that are NOT progress
                if (output.includes('Stream #0:0: Audio:') || 
                    output.includes('Press [q] to quit') || 
                    output.includes('Input #0') || 
                    output.includes('Output #0')) {
                    this.log(`🔇 [LEGACY DEBUG] ℹ️ Service message (ignored): ${output.trim()}`);
                } else {
                    this.log(`🔇 [LEGACY DEBUG] ⚠️ Unknown FFmpeg output: ${output.trim()}`);
                }
            }
            
            // FIXED: NO UPDATING lastAudioTime for service messages:
            // - "Stream #0:0: Audio:" - information about the stream 
            // - "Press [q] to quit" - readiness of FFmpeg
            // - "Input #0" / "Output #0" - input/output settings
            // - other configuration messages
            // These messages DO NOT mean that the user is speaking!
            
            // Search for specific errors that may indicate problems
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
            
            // Device errors on macOS
            if (output.includes('AVFoundation input device') && output.includes('not found')) {
                this.logError(`❌ macOS audio device error: ${output}`);
                this.events.onError(new Error('Audio input device not found on macOS. Please check microphone permissions in System Preferences.'));
                return;
            }
            
            // Check for successful recording indicators (without updating lastAudioTime)
            if (output.includes('size=') && output.includes('time=')) {
                this.log(`✅ FFmpeg recording progress: ${output.trim()}`);
            }
        });
        
        this.log(`🎤 [RECORDER] setupFFmpegEvents: All event handlers setup completed`);
    }

    /**
     * Handling the completion of recording
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

            // On macOS, FFmpeg may exit with code 255 on SIGTERM, which is normal
            // Also, code null means that the process was killed forcefully
            if (exitCode !== 0 && exitCode !== null && exitCode !== 255) {
                this.logWarn(`FFmpeg exited with code ${exitCode}, but checking if file was created anyway`);
            }

            // Check for the presence of tempFilePath before all operations
            if (!this.tempFilePath) {
                throw new Error('Recording was cancelled or temp file path is not available');
            }

            const currentTempFilePath = this.tempFilePath; // Save a local copy

            // Give FFmpeg time to write the file
            await new Promise(resolve => setTimeout(resolve, 100));

            this.log(`Checking for recording file: ${currentTempFilePath}`);

            if (!fs.existsSync(currentTempFilePath)) {
                // Try waiting a little longer
                await new Promise(resolve => setTimeout(resolve, 500));
                if (!fs.existsSync(currentTempFilePath)) {
                    throw new Error(`Recording file was not created at: ${currentTempFilePath}`);
                }
            }

            // Check the file size - if the file is empty, this is an error
            const stats = fs.statSync(currentTempFilePath);
            this.log(`Recording file size: ${stats.size} bytes`);
            
            const recordingDuration = Date.now() - this.recordingStartTime;
            const MIN_FILE_SIZE = 1000; // Minimum 1KB for a valid audio file
            
            if (stats.size === 0) {
                // Wait a little longer and check again
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

            // Read the recorded file
            const audioBuffer = fs.readFileSync(currentTempFilePath);
            
            // Determine the MIME type and file extension
            const mimeType = this.getMimeType();
            const fileExtension = this.getFileExtension();
            
            // Create a Blob compatible with the current API
            // Add the name property to determine the format in the Whisper API
            const audioBlob = new Blob([audioBuffer], { type: mimeType }) as Blob & { name?: string };
            audioBlob.name = `recording.${fileExtension}`;

            this.log(`Recording completed successfully: ${audioBuffer.length} bytes, ${mimeType}, filename: ${audioBlob.name}`);
            this.log(`🎤 [RECORDER] handleRecordingComplete: About to call events.onRecordingStop. Blob name: ${audioBlob.name}, size: ${audioBlob.size}`);
            // Notify about the completion of recording
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
     * Getting the MIME type for the recorded audio
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
     * Getting the file extension for the recorded audio
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
     * Setting up the maximum duration timer for recording
     */
    private setupMaxDurationTimer(): void {

        
        if (this.options.maxDuration && this.options.maxDuration > 0) {
            const maxDurationMs = this.options.maxDuration * 1000;
            
            this.maxDurationTimer = setTimeout(() => {
                this.stopRecording();
            }, maxDurationMs);
        }
    }

    /**
     * Starting the volumedetect process for audio volume analysis
     */
    private async startVolumeDetection(recommendedDevice?: string): Promise<void> {
        if (!this.options.silenceDetection) {
            return;
        }

        this.log('🔊 [VOLUMEDETECT] Starting volume detection process');
        
        try {
            // Building the volumedetect command (without a temporary file, using null output)
            const args = this.buildVolumeDetectArgs(recommendedDevice);
            
            this.log(`🔊 [VOLUMEDETECT] Command: ffmpeg ${args.join(' ')}`);

            // Starting the volumedetect process
            this.volumeDetectProcess = spawn('ffmpeg', args);
            
            if (this.volumeDetectProcess.pid) {
                this.log(`🔊 [VOLUMEDETECT] Process started with PID: ${this.volumeDetectProcess.pid}`);
                this.setupVolumeDetectEvents();
                this.startVolumeCheckInterval();
            } else {
                throw new Error('Failed to start volumedetect process');
            }

        } catch (error) {
            this.logError('🔊 [VOLUMEDETECT] Failed to start volume detection', error);
            this.cleanupVolumeDetection();
            // Continue recording without volume detection
        }
    }

    /**
     * Building arguments for the volumedetect command
     */
    private buildVolumeDetectArgs(recommendedDevice?: string): string[] {
        const platformCommands = FFmpegAudioRecorder.getPlatformCommands();
        const args: string[] = [];

        // Logging level for getting volumedetect data
        args.push('-loglevel', 'info');

        // Platform-specific input (the same as for the main recording)
        const inputParts = platformCommands.audioInput.split(' ');
        args.push(...inputParts);

        // Input device (the same as for the main recording)
        const inputDevice = recommendedDevice || platformCommands.defaultDevice;
        args.push('-i', inputDevice);

        // KEY CHANGE: analyze a short segment (1 second)
        args.push('-t', '1.0');  // Segment duration 1 second

        // Volumedetect filter - analyzes the volume level
        args.push('-filter_complex', `[0:a]volumedetect[out]`);

        // Output the processed sound to null (we don't save, only analyze)
        args.push('-map', '[out]');
        args.push('-f', 'null');
        args.push('-');

        return args;
    }

    /**
     * Setting up events for the volumedetect process
     */
    private setupVolumeDetectEvents(): void {
        if (!this.volumeDetectProcess) {
            return;
        }

        this.volumeDetectProcess.on('error', (error) => {
            this.logError('🔊 [VOLUMEDETECT] Process error', error);
            this.cleanupVolumeDetection();
        });

        this.volumeDetectProcess.stderr?.on('data', (data) => {
            const output = data.toString();
            
            // Search for volumedetect data in the output
            // Format: [Parsed_volumedetect_0 @ 0x...] mean_volume: -23.1 dB
            // Format: [Parsed_volumedetect_0 @ 0x...] max_volume: -10.5 dB
            const meanVolumeMatch = output.match(/mean_volume:\s*(-?\d+(?:\.\d+)?)\s*dB/);
            const maxVolumeMatch = output.match(/max_volume:\s*(-?\d+(?:\.\d+)?)\s*dB/);
            
            if (meanVolumeMatch || maxVolumeMatch) {
                const meanVolume = meanVolumeMatch ? parseFloat(meanVolumeMatch[1]) : null;
                const maxVolume = maxVolumeMatch ? parseFloat(maxVolumeMatch[1]) : null;
                
                // Use the maximum volume if available, otherwise use the average
                const currentVolume = maxVolume !== null ? maxVolume : meanVolume;
                
                if (currentVolume !== null) {
                    this.lastVolumeLevel = currentVolume;
                    this.processVolumeLevel(currentVolume);
                }
            }
        });

        this.volumeDetectProcess.on('close', (code) => {
            this.log(`🔊 [VOLUMEDETECT] Process closed with code: ${code}`);
            this.cleanupVolumeDetection();
        });
    }

    /**
     * Processing the volume level from volumedetect
     */
    private processVolumeLevel(volumeDb: number): void {
        if (!this.silenceDetectionEnabled) {
            return;
        }

        // Use the silenceThreshold setting from the options
        // silenceThreshold in the settings is a positive number (20-80)
        // Convert it to negative dB for FFmpeg
        const thresholdFromSettings = this.options.silenceThreshold || 30; // Default 30
        const silenceThreshold = -thresholdFromSettings; // Make negative (-30dB)
        const isAudioActive = volumeDb > silenceThreshold;
        
        this.log(`🔊 [VOLUMEDETECT] Volume: ${volumeDb.toFixed(1)}dB (threshold: ${silenceThreshold}dB) - ${isAudioActive ? 'ACTIVE' : 'SILENT'}`);
        
        if (isAudioActive) {
            this.log(`🎵 Audio activity detected via volumedetect: ${volumeDb.toFixed(1)}dB > ${silenceThreshold}dB`);
            this.updateLastAudioTime();
        }
    }

    /**
     * Starting the volume check interval
     */
    private startVolumeCheckInterval(): void {
        if (this.volumeCheckInterval) {
            clearInterval(this.volumeCheckInterval);
        }

        // Restart the volumedetect process every N seconds for fresh data
        this.volumeCheckInterval = setInterval(() => {
            if (this.isRecording && this.silenceDetectionEnabled) {
                this.restartVolumeDetection();
            }
        }, this.volumeSegmentDuration * 1000);
    }

    /**
     * Restarting the volumedetect for fresh data
     */
    private async restartVolumeDetection(): Promise<void> {
        if (!this.isRecording || !this.silenceDetectionEnabled) {
            return;
        }

        this.log('🔊 [VOLUMEDETECT] Restarting volume detection for fresh data');
        
        // Stop the current process
        if (this.volumeDetectProcess && !this.volumeDetectProcess.killed) {
            this.volumeDetectProcess.kill('SIGTERM');
        }

        // Small pause before restarting
        setTimeout(async () => {
            if (this.isRecording && this.silenceDetectionEnabled) {
                // Use the same device that was selected for the main recording
                await this.startVolumeDetection(this.currentRecordingDevice || undefined);
            }
        }, 100);
    }

    /**
     * Cleaning up the volumedetect resources
     */
    private cleanupVolumeDetection(): void {
        this.log('🔊 [VOLUMEDETECT] Cleaning up volume detection');

        if (this.volumeCheckInterval) {
            clearInterval(this.volumeCheckInterval);
            this.volumeCheckInterval = null;
        }

        if (this.volumeDetectProcess && !this.volumeDetectProcess.killed) {
            this.volumeDetectProcess.kill('SIGTERM');
            this.volumeDetectProcess = null;
        }

        if (this.volumeTempFileCleanup) {
            try {
                this.volumeTempFileCleanup();
            } catch (error) {
                // Ignore cleaning errors
            }
            this.volumeTempFileCleanup = null;
        }

        this.volumeTempFilePath = null;
    }

    /**
     * Setting up silence detection (updated with volumedetect)
     */
    private setupSilenceDetection(): void {
        this.log(`🔇 [SILENCE DEBUG] 🚀 setupSilenceDetection called`);
        this.log(`🔇 [SILENCE DEBUG] silenceDetection option: ${this.options.silenceDetection}`);
        this.log(`🔇 [SILENCE DEBUG] silenceDuration option: ${this.options.silenceDuration}`);
        this.log(`🔇 [SILENCE DEBUG] Recording start time: ${this.recordingStartTime}`);
        
        if (this.options.silenceDetection !== true) {
            this.log('🔇 [SILENCE DEBUG] ❌ Silence detection disabled - will only use maxDuration timer');
            // ❌ DO NOT RETURN! Need to make sure there is at least maxDuration control
            // Even without silence detection, the maximum duration timer should work
            return;
        }

        this.log('🔇 [SILENCE DEBUG] ✅ Silence detection enabled - setting up silence monitoring');
        this.silenceDetectionEnabled = true;
        
        // Set the initial time of audio activity at the start of recording
        this.lastAudioTime = this.recordingStartTime;

        const silenceDuration = (this.options.silenceDuration || 3) * 1000; // Convert to milliseconds
        const minRecordingTime = 5000; // Minimum 5 seconds of recording before enabling silence detection (increased from 5)

        this.log(`🔇 [SILENCE DEBUG] Configuration:`);
        this.log(`🔇 [SILENCE DEBUG]   - Silence threshold: ${silenceDuration}ms (${this.options.silenceDuration || 3}s)`);
        this.log(`🔇 [SILENCE DEBUG]   - Minimum recording time: ${minRecordingTime}ms`);
        this.log(`🔇 [SILENCE DEBUG]   - Initial lastAudioTime: ${this.lastAudioTime}`);
        this.log(`🔇 [SILENCE DEBUG]   - silenceDetectionEnabled: ${this.silenceDetectionEnabled}`);

        // Start the silence check timer every 2000ms
        const checkSilence = () => {
            if (!this.isRecording || !this.silenceDetectionEnabled) {
                this.log('🔇 [SILENCE DEBUG] 🛑 Stopping silence check - recording stopped or silence detection disabled');
                this.log(`🔇 [SILENCE DEBUG] isRecording: ${this.isRecording}, silenceDetectionEnabled: ${this.silenceDetectionEnabled}`);
                return;
            }

            const recordingDuration = Date.now() - this.recordingStartTime;
            const timeSinceLastAudio = Date.now() - this.lastAudioTime;
            
            this.log(`🔇 [SILENCE DEBUG] 🔍 Silence check cycle:`);
            this.log(`🔇 [SILENCE DEBUG]   - Recording duration: ${recordingDuration}ms`);
            this.log(`🔇 [SILENCE DEBUG]   - Time since last audio: ${timeSinceLastAudio}ms`);
            this.log(`🔇 [SILENCE DEBUG]   - Minimum recording time: ${minRecordingTime}ms`);
            this.log(`🔇 [SILENCE DEBUG]   - Silence threshold: ${silenceDuration}ms`);
            this.log(`🔇 [SILENCE DEBUG]   - Current time: ${Date.now()}`);
            this.log(`🔇 [SILENCE DEBUG]   - Last audio time: ${this.lastAudioTime}`);
            this.log(`🔇 [SILENCE DEBUG]   - Recording start time: ${this.recordingStartTime}`);
            
            // Do not check for silence in the first minRecordingTime milliseconds
            if (recordingDuration < minRecordingTime) {
                this.log(`🔇 [SILENCE DEBUG] ⏳ Still in minimum recording period (${recordingDuration}ms < ${minRecordingTime}ms) - continuing`);
                this.silenceTimer = setTimeout(checkSilence, 2000);
                return;
            }
            
            if (timeSinceLastAudio >= silenceDuration) {
                this.log(`🔇 [SILENCE DEBUG] ⏰ SILENCE THRESHOLD REACHED!`);
                this.log(`🔇 [SILENCE DEBUG] Time since last audio: ${timeSinceLastAudio}ms >= threshold: ${silenceDuration}ms`);
                this.log(`🔇 [SILENCE DEBUG] Stopping recording after ${recordingDuration}ms total duration`);
                this.stopRecording();
                return;
            } else {
                const remainingTime = silenceDuration - timeSinceLastAudio;
                this.log(`🔇 [SILENCE DEBUG] ✅ Audio activity recent enough - ${remainingTime}ms remaining until silence threshold`);
            }

            // Schedule the next check
            this.log(`🔇 [SILENCE DEBUG] 🔄 Scheduling next silence check in 2000ms`);
            this.silenceTimer = setTimeout(checkSilence, 2000);
        };

        // Start the first check after 2 seconds after the start of recording
        this.log('🔇 [SILENCE DEBUG] ⏰ Starting silence detection timer - first check in 2000ms');
        this.silenceTimer = setTimeout(checkSilence, 2000);
        this.log('🎯 [SILENCE DEBUG] 🎯 Silence detection setup completed successfully');
    }

    /**
     * Updating the time of the last audio activity
     */
    private updateLastAudioTime(): void {
        if (this.silenceDetectionEnabled) {
            const oldTime = this.lastAudioTime;
            this.lastAudioTime = Date.now();
            const timeSinceLastUpdate = this.lastAudioTime - oldTime;
            const recordingDuration = Date.now() - this.recordingStartTime;
            
            this.log(`🔇 [SILENCE DEBUG] 🎵 Audio activity: lastAudioTime updated`);
            this.log(`🔇 [SILENCE DEBUG] Previous lastAudioTime: ${oldTime} (${timeSinceLastUpdate}ms ago)`);
            this.log(`🔇 [SILENCE DEBUG] New lastAudioTime: ${this.lastAudioTime}`);
            this.log(`🔇 [SILENCE DEBUG] Recording duration: ${recordingDuration}ms`);
            this.log(`🔇 [SILENCE DEBUG] Silence timer reset - will check for silence again in next cycle`);
        } else {
            this.log('🔇 Audio activity detected, but silence detection is disabled - ignoring');
        }
    }

    /**
     * Clearing the silence detection timer
     */
    private clearSilenceTimer(): void {
        this.log('🔇 [SILENCE DEBUG] 🧹 clearSilenceTimer called');
        
        if (this.silenceTimer) {
            this.log('🔇 [SILENCE DEBUG] ✅ Clearing active silence detection timer');
            clearTimeout(this.silenceTimer);
            this.silenceTimer = null;
            this.log('🔇 [SILENCE DEBUG] Silence timer cleared successfully');
        } else {
            this.log('🔇 [SILENCE DEBUG] ❌ Silence detection timer was not set, nothing to clear');
        }
        
        if (this.silenceDetectionEnabled) {
            this.log('🔇 [SILENCE DEBUG] ⏹️ Disabling silence detection');
            this.silenceDetectionEnabled = false;
            this.log('🔇 [SILENCE DEBUG] Silence detection disabled successfully');
        } else {
            this.log('🔇 [SILENCE DEBUG] Silence detection was already disabled');
        }
    }

    /**
     * Clearing the maximum duration timer
     */
    private clearMaxDurationTimer(): void {
        if (this.maxDurationTimer) {
            clearTimeout(this.maxDurationTimer);
            this.maxDurationTimer = null;
        }
    }

    /**
     * Cleaning up resources
     */
    private cleanup(): void {
        this.clearMaxDurationTimer();
        this.clearSilenceTimer();
        this.cleanupVolumeDetection(); // Add volumedetect cleanup
        
        if (this.ffmpegProcess && !this.ffmpegProcess.killed) {
            this.ffmpegProcess.kill('SIGKILL');
            this.ffmpegProcess = null;
        }

        if (this.tempFileCleanup) {
            try {
                this.tempFileCleanup();
            } catch (error) {
                // Ignore cleaning errors
            }
            this.tempFileCleanup = null;
        }

        this.tempFilePath = null;
        this.currentRecordingDevice = null;
        this.isRecording = false;
    }

    // ============ COMPATIBLE METHODS WITH THE CURRENT AudioRecorder ============

    /**
     * Getting the recording status
     */
    getIsRecording(): boolean {
        return this.isRecording;
    }

    /**
     * Getting the duration of the current recording in milliseconds
     */
    getRecordingDuration(): number {
        if (!this.isRecording) {
            return 0;
        }
        return Date.now() - this.recordingStartTime;
    }

    /**
     * Getting supported MIME types (for compatibility)
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
     * Checking compatibility (replacement for checkBrowserCompatibility)
     */
    static checkBrowserCompatibility(): { 
        supported: boolean; 
        missing: string[] 
    } {
        // For FFmpeg, check the availability of Node.js modules
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
     * Checking the availability of the microphone (replacement for checkMicrophonePermission)
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
     * Diagnostics of audio devices and FFmpeg
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

        // Check available devices only if FFmpeg is available
        if (result.ffmpegAvailable.available) {
            try {
                result.inputDevices = await FFmpegAudioRecorder.detectInputDevices().then(devices => devices.map(device => device.name));
                
                // Recommendations for devices for macOS
                if (result.platform === 'macos') {
                    // Check the availability of the device ":0"
                    const hasBuiltinMic = result.inputDevices.some(device => 
                        device.toLowerCase().includes('built-in') || 
                        device.toLowerCase().includes('microphone')
                    );
                    
                    if (!hasBuiltinMic) {
                        result.warnings.push('Built-in microphone not detected. You may need to grant microphone permissions to VS Code.');
                    }
                    
                    // If there are devices, recommend the first found audio device
                    if (result.inputDevices.length > 0) {
                        // Search for a device in the format [0] Device Name
                        const firstDevice = result.inputDevices[0];
                        const match = firstDevice.match(/^\[(\d+)\]/);
                        if (match) {
                            result.recommendedDevice = `:${match[1]}`;
                        } else {
                            // Fallback - use :0
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
     * Test recording audio for diagnostics
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
                '-loglevel', 'info',  // More information for diagnostics
                ...platformCommands.audioInput.split(' '),
                '-i', inputDevice,
                '-ar', '16000',
                '-ac', '1',
                '-acodec', 'pcm_s16le',
                '-t', duration.toString(),
                '-y',
                tempFile.name
            ];

            const startTime = Date.now();
            const testProcess = spawn(diagnostics.ffmpegAvailable.path!, args);
            
            let errorOutput = '';
            let hasOutput = false;

            testProcess.stderr?.on('data', (data) => {
                const output = data.toString();
                errorOutput += output;
                
                // Check if there are signs of successful recording
                if (output.includes('size=') || output.includes('time=')) {
                    hasOutput = true;
                }
            });

            testProcess.on('close', (code) => {
                const actualDuration = Date.now() - startTime;
                
                try {
                    if (fs.existsSync(tempFile.name)) {
                        const stats = fs.statSync(tempFile.name);
                        
                        // Clean up the temporary file
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