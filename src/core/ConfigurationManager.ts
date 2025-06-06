import * as vscode from 'vscode';

// Interfaces for different configuration types
export interface WhisperConfiguration {
    apiKey: string;
    language: string;
    whisperModel: string;
    prompt: string;
    temperature: number;
    timeout: number;
    maxRetries: number;
}

export interface AudioConfiguration {
    audioQuality: string;
    ffmpegPath: string;
    maxRecordingDuration: number;
    silenceDetection: boolean;
    silenceDuration: number;
    silenceThreshold: number;
    inputDevice: string;
}

export interface UIConfiguration {
    showStatusBar: boolean;
}

export interface FullConfiguration {
    whisper: WhisperConfiguration;
    audio: AudioConfiguration;
    ui: UIConfiguration;
}

// Type for configuration change listeners
export type ConfigurationChangeListener = (config: FullConfiguration) => void;

/**
 * Centralized manager for managing extension settings
 * Uses singleton pattern to ensure a single source of truth
 */
export class ConfigurationManager {
    private static instance: ConfigurationManager;
    private cachedConfig: FullConfiguration | null = null;
    private changeListeners: ConfigurationChangeListener[] = [];
    private disposables: vscode.Disposable[] = [];

    private constructor() {
        // Subscribe to VS Code configuration changes
        const configChangeDisposable = vscode.workspace.onDidChangeConfiguration((event) => {
            if (event.affectsConfiguration('speechToTextWhisper')) {
                this.invalidateCache();
                this.notifyListeners();
            }
        });
        this.disposables.push(configChangeDisposable);
    }

    /**
     * Get the single instance of ConfigurationManager
     */
    public static getInstance(): ConfigurationManager {
        if (!ConfigurationManager.instance) {
            ConfigurationManager.instance = new ConfigurationManager();
        }
        return ConfigurationManager.instance;
    }

    /**
     * Get the full configuration
     */
    public getConfiguration(): FullConfiguration {
        if (!this.cachedConfig) {
            this.cachedConfig = this.loadConfiguration();
        }
        return this.cachedConfig;
    }

    /**
     * Get the Whisper configuration
     */
    public getWhisperConfiguration(): WhisperConfiguration {
        return this.getConfiguration().whisper;
    }

    /**
     * Get the audio configuration
     */
    public getAudioConfiguration(): AudioConfiguration {
        return this.getConfiguration().audio;
    }

    /**
     * Get the UI configuration
     */
    public getUIConfiguration(): UIConfiguration {
        return this.getConfiguration().ui;
    }

    /**
     * Set the configuration value
     */
    public async setConfigurationValue<T>(section: string, value: T): Promise<void> {
        const config = vscode.workspace.getConfiguration('speechToTextWhisper');
        await config.update(section, value, vscode.ConfigurationTarget.Global);
        this.invalidateCache();
    }

    /**
     * Add a configuration change listener
     */
    public addChangeListener(listener: ConfigurationChangeListener): void {
        this.changeListeners.push(listener);
    }

    /**
     * Remove a configuration change listener
     */
    public removeChangeListener(listener: ConfigurationChangeListener): void {
        const index = this.changeListeners.indexOf(listener);
        if (index > -1) {
            this.changeListeners.splice(index, 1);
        }
    }

    /**
     * Validate the configuration
     */
    public validateConfiguration(): { isValid: boolean; errors: string[] } {
        const config = this.getConfiguration();
        const errors: string[] = [];

        // Validate the Whisper configuration
        if (!config.whisper.apiKey || config.whisper.apiKey.trim() === '') {
            errors.push('Whisper API key is required');
        }

        if (config.whisper.temperature < 0 || config.whisper.temperature > 1) {
            errors.push('Temperature must be between 0 and 1');
        }

        if (config.whisper.timeout <= 0) {
            errors.push('Timeout must be greater than 0');
        }

        if (config.whisper.maxRetries < 0) {
            errors.push('Max retries must be non-negative');
        }

        // Validate the audio configuration
        if (config.audio.maxRecordingDuration <= 0) {
            errors.push('Max recording duration must be greater than 0');
        }

        if (config.audio.silenceDuration <= 0) {
            errors.push('Silence duration must be greater than 0');
        }

        if (config.audio.silenceThreshold < 20 || config.audio.silenceThreshold > 80) {
            errors.push('Silence threshold must be between 20 and 80');
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    /**
     * Get the default configuration value
     */
    public getDefaultConfiguration(): FullConfiguration {
        return {
            whisper: {
                apiKey: '',
                language: 'auto',
                whisperModel: 'whisper-1',
                prompt: "This is a technical instruction about programming in Visual Studio Code IDE. The speaker provides step-by-step coding instructions related to features, extensions, debugging, and software development workflows. Output should be formatted in markdown with proper code blocks and structure.",
                temperature: 0.1,
                timeout: 30000,
                maxRetries: 3
            },
            audio: {
                audioQuality: 'standard',
                ffmpegPath: '',
                maxRecordingDuration: 3600,
                silenceDetection: true,
                silenceDuration: 3,
                silenceThreshold: 20,
                inputDevice: 'auto'
            },
            ui: {
                showStatusBar: true
            }
        };
    }

    /**
     * Reset the configuration to default values
     */
    public async resetToDefaults(): Promise<void> {
        const defaultConfig = this.getDefaultConfiguration();
        const config = vscode.workspace.getConfiguration('speechToTextWhisper');

        // Reset Whisper settings
        await config.update('language', defaultConfig.whisper.language, vscode.ConfigurationTarget.Global);
        await config.update('whisperModel', defaultConfig.whisper.whisperModel, vscode.ConfigurationTarget.Global);
        await config.update('prompt', defaultConfig.whisper.prompt, vscode.ConfigurationTarget.Global);
        await config.update('temperature', defaultConfig.whisper.temperature, vscode.ConfigurationTarget.Global);
        await config.update('timeout', defaultConfig.whisper.timeout, vscode.ConfigurationTarget.Global);
        await config.update('maxRetries', defaultConfig.whisper.maxRetries, vscode.ConfigurationTarget.Global);

        // Reset audio settings
        await config.update('audioQuality', defaultConfig.audio.audioQuality, vscode.ConfigurationTarget.Global);
        await config.update('ffmpegPath', defaultConfig.audio.ffmpegPath, vscode.ConfigurationTarget.Global);
        await config.update('maxRecordingDuration', defaultConfig.audio.maxRecordingDuration, vscode.ConfigurationTarget.Global);
        await config.update('silenceDetection', defaultConfig.audio.silenceDetection, vscode.ConfigurationTarget.Global);
        await config.update('silenceDuration', defaultConfig.audio.silenceDuration, vscode.ConfigurationTarget.Global);
        await config.update('silenceThreshold', defaultConfig.audio.silenceThreshold, vscode.ConfigurationTarget.Global);
        await config.update('inputDevice', defaultConfig.audio.inputDevice, vscode.ConfigurationTarget.Global);

        // Reset UI settings
        await config.update('showStatusBar', defaultConfig.ui.showStatusBar, vscode.ConfigurationTarget.Global);

        this.invalidateCache();
    }

    /**
     * Release resources
     */
    public dispose(): void {
        this.disposables.forEach(disposable => disposable.dispose());
        this.disposables = [];
        this.changeListeners = [];
        this.cachedConfig = null;
    }

    /**
     * Load the configuration from VS Code settings
     */
    private loadConfiguration(): FullConfiguration {
        const config = vscode.workspace.getConfiguration('speechToTextWhisper');
        const defaultConfig = this.getDefaultConfiguration();

        return {
            whisper: {
                apiKey: config.get<string>('apiKey', defaultConfig.whisper.apiKey),
                language: config.get<string>('language', defaultConfig.whisper.language),
                whisperModel: config.get<string>('whisperModel', defaultConfig.whisper.whisperModel),
                prompt: config.get<string>('prompt', defaultConfig.whisper.prompt),
                temperature: config.get<number>('temperature', defaultConfig.whisper.temperature),
                timeout: config.get<number>('timeout', defaultConfig.whisper.timeout),
                maxRetries: config.get<number>('maxRetries', defaultConfig.whisper.maxRetries)
            },
            audio: {
                audioQuality: config.get<string>('audioQuality', defaultConfig.audio.audioQuality),
                ffmpegPath: config.get<string>('ffmpegPath', defaultConfig.audio.ffmpegPath),
                maxRecordingDuration: config.get<number>('maxRecordingDuration', defaultConfig.audio.maxRecordingDuration),
                silenceDetection: config.get<boolean>('silenceDetection', defaultConfig.audio.silenceDetection),
                silenceDuration: config.get<number>('silenceDuration', defaultConfig.audio.silenceDuration),
                silenceThreshold: config.get<number>('silenceThreshold', defaultConfig.audio.silenceThreshold),
                inputDevice: config.get<string>('inputDevice', defaultConfig.audio.inputDevice)
            },
            ui: {
                showStatusBar: config.get<boolean>('showStatusBar', defaultConfig.ui.showStatusBar)
            }
        };
    }

    /**
     * Clear the configuration cache
     */
    private invalidateCache(): void {
        this.cachedConfig = null;
    }

    /**
     * Notify all listeners about configuration changes
     */
    private notifyListeners(): void {
        const config = this.getConfiguration();
        this.changeListeners.forEach(listener => {
            try {
                listener(config);
            } catch (error) {
                console.error('Error in configuration change listener:', error);
            }
        });
    }
}

// Export the single instance for convenience
export const configurationManager = ConfigurationManager.getInstance(); 