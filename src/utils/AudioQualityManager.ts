// AudioQualityManager.ts - Менеджер настроек качества аудио

import * as vscode from 'vscode';

export interface AudioQualitySettings {
    quality: 'standard' | 'high' | 'ultra';
    audioFormat: 'wav' | 'mp3' | 'webm';
    sampleRate?: number;
    channelCount?: number;
    echoCancellation: boolean;
    noiseSuppression: boolean;
    autoGainControl: boolean;
    silenceDetection: boolean;
    silenceThreshold: number;
    bitrate?: number;
}

export interface QualityPreset {
    name: string;
    description: string;
    settings: Partial<AudioQualitySettings>;
    recommendedFor: string[];
}

/**
 * Менеджер настроек качества аудио для SpeechToTextWhisper
 */
export class AudioQualityManager {
    private static readonly QUALITY_PRESETS: QualityPreset[] = [
        {
            name: 'standard',
            description: 'Стандартное качество (16kHz, 64kbps)',
            settings: {
                quality: 'standard',
                sampleRate: 16000,
                channelCount: 1,
                audioFormat: 'webm'
            },
            recommendedFor: ['general use', 'quick notes', 'basic transcription']
        },
        {
            name: 'high',
            description: 'Высокое качество (44.1kHz, 128kbps)',
            settings: {
                quality: 'high',
                sampleRate: 44100,
                channelCount: 1,
                audioFormat: 'wav'
            },
            recommendedFor: ['meetings', 'interviews', 'important content']
        },
        {
            name: 'ultra',
            description: 'Максимальное качество (48kHz, 256kbps)',
            settings: {
                quality: 'ultra',
                sampleRate: 48000,
                channelCount: 1,
                audioFormat: 'wav'
            },
            recommendedFor: ['critical recordings', 'noisy environments', 'technical dictation']
        }
    ];

    /**
     * Получает текущие настройки качества аудио из конфигурации VS Code
     */
    static getCurrentSettings(): AudioQualitySettings {
        const config = vscode.workspace.getConfiguration('speechToTextWhisper');
        
        return {
            quality: config.get<'standard' | 'high' | 'ultra'>('audioQuality', 'standard'),
            audioFormat: config.get<'wav' | 'mp3' | 'webm'>('audioFormat', 'wav'),
            sampleRate: config.get<number>('sampleRate'),
            channelCount: config.get<number>('channels'),
            echoCancellation: config.get<boolean>('echoCancellation', true),
            noiseSuppression: config.get<boolean>('noiseSuppression', true),
            autoGainControl: config.get<boolean>('autoGain', true),
            silenceDetection: config.get<boolean>('silenceDetection', true),
            silenceThreshold: config.get<number>('silenceThreshold', 2.0)
        };
    }

    /**
     * Применяет пресет качества к настройкам VS Code
     */
    static async applyQualityPreset(presetName: string): Promise<void> {
        const preset = this.QUALITY_PRESETS.find(p => p.name === presetName);
        if (!preset) {
            throw new Error(`Quality preset '${presetName}' not found`);
        }

        const config = vscode.workspace.getConfiguration('speechToTextWhisper');
        
        // Маппинг ключей между внутренним интерфейсом и VSCode настройками
        const keyMapping: Record<string, string> = {
            'quality': 'audioQuality',
            'channelCount': 'channels',
            'autoGainControl': 'autoGain'
        };
        
        // Применяем настройки из пресета
        for (const [key, value] of Object.entries(preset.settings)) {
            if (value !== undefined) {
                const configKey = keyMapping[key] || key;
                await config.update(configKey, value, vscode.ConfigurationTarget.Global);
            }
        }

        console.log(`Applied audio quality preset: ${preset.name}`);
    }

    /**
     * Получает список доступных пресетов качества
     */
    static getAvailablePresets(): QualityPreset[] {
        return [...this.QUALITY_PRESETS];
    }

    /**
     * Оптимизирует настройки качества на основе контекста использования
     */
    static getOptimizedSettings(context: 'meeting' | 'dictation' | 'quick_notes' | 'noisy_environment'): AudioQualitySettings {
        const baseSettings = this.getCurrentSettings();
        
        switch (context) {
            case 'meeting':
                return {
                    ...baseSettings,
                    quality: 'high',
                    echoCancellation: true,
                    noiseSuppression: true,
                    silenceDetection: false // Не прерывать на паузах в разговоре
                };
                
            case 'dictation':
                return {
                    ...baseSettings,
                    quality: 'high',
                    echoCancellation: true,
                    noiseSuppression: true,
                    silenceDetection: true,
                    silenceThreshold: 3.0 // Дольше ждать перед остановкой
                };
                
            case 'quick_notes':
                return {
                    ...baseSettings,
                    quality: 'standard',
                    silenceDetection: true,
                    silenceThreshold: 1.5 // Быстрая остановка
                };
                
            case 'noisy_environment':
                return {
                    ...baseSettings,
                    quality: 'ultra',
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    silenceThreshold: 4.0 // Больше времени для фильтрации шума
                };
                
            default:
                return baseSettings;
        }
    }

    /**
     * Валидирует настройки качества на совместимость с браузером
     */
    static validateSettings(settings: AudioQualitySettings): { 
        isValid: boolean; 
        warnings: string[];
        suggestions: string[];
    } {
        const warnings: string[] = [];
        const suggestions: string[] = [];
        let isValid = true;

        // Проверяем поддержку высоких sample rate
        if (settings.sampleRate && settings.sampleRate > 48000) {
            warnings.push('Sample rate выше 48kHz может не поддерживаться всеми браузерами');
            suggestions.push('Рассмотрите использование 48kHz для максимальной совместимости');
        }

        // Проверяем комбинацию формата и качества
        if (settings.quality === 'ultra' && settings.audioFormat === 'mp3') {
            warnings.push('MP3 формат может не обеспечить максимальное качество для ultra режима');
            suggestions.push('Используйте WAV формат для ultra качества');
        }

        // Проверяем настройки silence detection
        if (settings.silenceDetection && settings.silenceThreshold < 0.5) {
            warnings.push('Слишком низкий порог тишины может привести к преждевременной остановке записи');
            suggestions.push('Рекомендуется порог тишины не менее 1 секунды');
        }

        return { isValid, warnings, suggestions };
    }

    /**
     * Возвращает рекомендации по оптимизации производительности
     */
    static getPerformanceRecommendations(settings: AudioQualitySettings): string[] {
        const recommendations: string[] = [];

        if (settings.quality === 'ultra') {
            recommendations.push('Ultra качество потребляет больше ресурсов. Используйте для критически важных записей.');
        }

        if (settings.audioFormat === 'wav' && settings.quality === 'standard') {
            recommendations.push('WAV формат с standard качеством может быть избыточным. Рассмотрите WebM для лучшего сжатия.');
        }

        if (!settings.echoCancellation && !settings.noiseSuppression) {
            recommendations.push('Отключение echo cancellation и noise suppression может ухудшить качество в шумной среде.');
        }

        if (settings.silenceDetection && settings.silenceThreshold > 5.0) {
            recommendations.push('Высокий порог тишины может пропускать короткие паузы в речи.');
        }

        return recommendations;
    }

    /**
     * Экспортирует текущие настройки в JSON
     */
    static exportSettings(): string {
        const settings = this.getCurrentSettings();
        return JSON.stringify(settings, null, 2);
    }

    /**
     * Импортирует настройки из JSON
     */
    static async importSettings(settingsJson: string): Promise<void> {
        try {
            const settings = JSON.parse(settingsJson) as AudioQualitySettings;
            const validation = this.validateSettings(settings);
            
            if (!validation.isValid) {
                throw new Error(`Invalid settings: ${validation.warnings.join(', ')}`);
            }

            const config = vscode.workspace.getConfiguration('speechToTextWhisper');
            
            // Маппинг ключей между внутренним интерфейсом и VSCode настройками
            const keyMapping: Record<string, string> = {
                'quality': 'audioQuality',
                'channelCount': 'channels',
                'autoGainControl': 'autoGain'
            };
            
            // Применяем настройки
            for (const [key, value] of Object.entries(settings)) {
                if (value !== undefined) {
                    const configKey = keyMapping[key] || key;
                    await config.update(configKey, value, vscode.ConfigurationTarget.Global);
                }
            }

            console.log('Audio quality settings imported successfully');
            
        } catch (error) {
            throw new Error(`Failed to import settings: ${(error as Error).message}`);
        }
    }
} 