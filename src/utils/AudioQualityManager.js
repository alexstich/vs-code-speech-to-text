"use strict";
// AudioQualityManager.ts - Менеджер настроек качества аудио
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
exports.AudioQualityManager = void 0;
const vscode = __importStar(require("vscode"));
/**
 * Менеджер настроек качества аудио для SpeechToTextWhisper
 */
class AudioQualityManager {
    static QUALITY_PRESETS = [
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
    static getCurrentSettings() {
        const config = vscode.workspace.getConfiguration('speechToTextWhisper');
        return {
            quality: config.get('audioQuality', 'standard'),
            audioFormat: config.get('audioFormat', 'wav'),
            sampleRate: config.get('sampleRate'),
            channelCount: config.get('channelCount'),
            echoCancellation: config.get('echoCancellation', true),
            noiseSuppression: config.get('noiseReduction', true),
            autoGainControl: config.get('autoGain', true),
            silenceDetection: config.get('silenceDetection', true),
            silenceThreshold: config.get('silenceThreshold', 2.0)
        };
    }
    /**
     * Применяет пресет качества к настройкам VS Code
     */
    static async applyQualityPreset(presetName) {
        const preset = this.QUALITY_PRESETS.find(p => p.name === presetName);
        if (!preset) {
            throw new Error(`Quality preset '${presetName}' not found`);
        }
        const config = vscode.workspace.getConfiguration('speechToTextWhisper');
        // Применяем настройки из пресета
        for (const [key, value] of Object.entries(preset.settings)) {
            if (value !== undefined) {
                await config.update(key, value, vscode.ConfigurationTarget.Global);
            }
        }
        console.log(`Applied audio quality preset: ${preset.name}`);
    }
    /**
     * Получает список доступных пресетов качества
     */
    static getAvailablePresets() {
        return [...this.QUALITY_PRESETS];
    }
    /**
     * Оптимизирует настройки качества на основе контекста использования
     */
    static getOptimizedSettings(context) {
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
    static validateSettings(settings) {
        const warnings = [];
        const suggestions = [];
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
    static getPerformanceRecommendations(settings) {
        const recommendations = [];
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
    static exportSettings() {
        const settings = this.getCurrentSettings();
        return JSON.stringify(settings, null, 2);
    }
    /**
     * Импортирует настройки из JSON
     */
    static async importSettings(settingsJson) {
        try {
            const settings = JSON.parse(settingsJson);
            const validation = this.validateSettings(settings);
            if (!validation.isValid) {
                throw new Error(`Invalid settings: ${validation.warnings.join(', ')}`);
            }
            const config = vscode.workspace.getConfiguration('speechToTextWhisper');
            // Применяем настройки
            for (const [key, value] of Object.entries(settings)) {
                if (value !== undefined) {
                    await config.update(key, value, vscode.ConfigurationTarget.Global);
                }
            }
            console.log('Audio quality settings imported successfully');
        }
        catch (error) {
            throw new Error(`Failed to import settings: ${error.message}`);
        }
    }
}
exports.AudioQualityManager = AudioQualityManager;
//# sourceMappingURL=AudioQualityManager.js.map