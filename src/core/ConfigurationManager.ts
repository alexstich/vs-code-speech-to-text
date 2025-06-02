import * as vscode from 'vscode';

// Интерфейсы для различных типов конфигураций
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

// Тип для слушателей изменений конфигурации
export type ConfigurationChangeListener = (config: FullConfiguration) => void;

/**
 * Централизованный менеджер для управления настройками расширения
 * Использует singleton паттерн для обеспечения единого источника истины
 */
export class ConfigurationManager {
    private static instance: ConfigurationManager;
    private cachedConfig: FullConfiguration | null = null;
    private changeListeners: ConfigurationChangeListener[] = [];
    private disposables: vscode.Disposable[] = [];

    private constructor() {
        // Подписываемся на изменения конфигурации VS Code
        const configChangeDisposable = vscode.workspace.onDidChangeConfiguration((event) => {
            if (event.affectsConfiguration('speechToTextWhisper')) {
                this.invalidateCache();
                this.notifyListeners();
            }
        });
        this.disposables.push(configChangeDisposable);
    }

    /**
     * Получить единственный экземпляр ConfigurationManager
     */
    public static getInstance(): ConfigurationManager {
        if (!ConfigurationManager.instance) {
            ConfigurationManager.instance = new ConfigurationManager();
        }
        return ConfigurationManager.instance;
    }

    /**
     * Получить полную конфигурацию
     */
    public getConfiguration(): FullConfiguration {
        if (!this.cachedConfig) {
            this.cachedConfig = this.loadConfiguration();
        }
        return this.cachedConfig;
    }

    /**
     * Получить конфигурацию Whisper
     */
    public getWhisperConfiguration(): WhisperConfiguration {
        return this.getConfiguration().whisper;
    }

    /**
     * Получить конфигурацию аудио
     */
    public getAudioConfiguration(): AudioConfiguration {
        return this.getConfiguration().audio;
    }

    /**
     * Получить конфигурацию UI
     */
    public getUIConfiguration(): UIConfiguration {
        return this.getConfiguration().ui;
    }

    /**
     * Установить значение конфигурации
     */
    public async setConfigurationValue<T>(section: string, value: T): Promise<void> {
        const config = vscode.workspace.getConfiguration('speechToTextWhisper');
        await config.update(section, value, vscode.ConfigurationTarget.Global);
        this.invalidateCache();
    }

    /**
     * Добавить слушатель изменений конфигурации
     */
    public addChangeListener(listener: ConfigurationChangeListener): void {
        this.changeListeners.push(listener);
    }

    /**
     * Удалить слушатель изменений конфигурации
     */
    public removeChangeListener(listener: ConfigurationChangeListener): void {
        const index = this.changeListeners.indexOf(listener);
        if (index > -1) {
            this.changeListeners.splice(index, 1);
        }
    }

    /**
     * Валидировать конфигурацию
     */
    public validateConfiguration(): { isValid: boolean; errors: string[] } {
        const config = this.getConfiguration();
        const errors: string[] = [];

        // Валидация Whisper конфигурации
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

        // Валидация аудио конфигурации
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
     * Получить значение конфигурации по умолчанию
     */
    public getDefaultConfiguration(): FullConfiguration {
        return {
            whisper: {
                apiKey: '',
                language: 'auto',
                whisperModel: 'whisper-1',
                prompt: '',
                temperature: 0.1,
                timeout: 30000,
                maxRetries: 3
            },
            audio: {
                audioQuality: 'standard',
                ffmpegPath: '',
                maxRecordingDuration: 60,
                silenceDetection: true,
                silenceDuration: 3,
                silenceThreshold: 50,
                inputDevice: 'auto'
            },
            ui: {
                showStatusBar: true
            }
        };
    }

    /**
     * Сбросить конфигурацию к значениям по умолчанию
     */
    public async resetToDefaults(): Promise<void> {
        const defaultConfig = this.getDefaultConfiguration();
        const config = vscode.workspace.getConfiguration('speechToTextWhisper');

        // Сброс Whisper настроек
        await config.update('language', defaultConfig.whisper.language, vscode.ConfigurationTarget.Global);
        await config.update('whisperModel', defaultConfig.whisper.whisperModel, vscode.ConfigurationTarget.Global);
        await config.update('prompt', defaultConfig.whisper.prompt, vscode.ConfigurationTarget.Global);
        await config.update('temperature', defaultConfig.whisper.temperature, vscode.ConfigurationTarget.Global);
        await config.update('timeout', defaultConfig.whisper.timeout, vscode.ConfigurationTarget.Global);
        await config.update('maxRetries', defaultConfig.whisper.maxRetries, vscode.ConfigurationTarget.Global);

        // Сброс аудио настроек
        await config.update('audioQuality', defaultConfig.audio.audioQuality, vscode.ConfigurationTarget.Global);
        await config.update('ffmpegPath', defaultConfig.audio.ffmpegPath, vscode.ConfigurationTarget.Global);
        await config.update('maxRecordingDuration', defaultConfig.audio.maxRecordingDuration, vscode.ConfigurationTarget.Global);
        await config.update('silenceDetection', defaultConfig.audio.silenceDetection, vscode.ConfigurationTarget.Global);
        await config.update('silenceDuration', defaultConfig.audio.silenceDuration, vscode.ConfigurationTarget.Global);
        await config.update('silenceThreshold', defaultConfig.audio.silenceThreshold, vscode.ConfigurationTarget.Global);
        await config.update('inputDevice', defaultConfig.audio.inputDevice, vscode.ConfigurationTarget.Global);

        // Сброс UI настроек
        await config.update('showStatusBar', defaultConfig.ui.showStatusBar, vscode.ConfigurationTarget.Global);

        this.invalidateCache();
    }

    /**
     * Освободить ресурсы
     */
    public dispose(): void {
        this.disposables.forEach(disposable => disposable.dispose());
        this.disposables = [];
        this.changeListeners = [];
        this.cachedConfig = null;
    }

    /**
     * Загрузить конфигурацию из VS Code settings
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
     * Сбросить кэш конфигурации
     */
    private invalidateCache(): void {
        this.cachedConfig = null;
    }

    /**
     * Уведомить всех слушателей об изменении конфигурации
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

// Экспорт единственного экземпляра для удобства использования
export const configurationManager = ConfigurationManager.getInstance(); 