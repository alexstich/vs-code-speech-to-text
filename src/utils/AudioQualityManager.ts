// AudioQualityManager.ts - Audio quality settings manager

import * as vscode from 'vscode';
import { AudioQualityManagerLog } from './GlobalOutput';

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
 * Audio quality settings manager for SpeechToTextWhisper
 */
export class AudioQualityManager {
    private static readonly QUALITY_PRESETS: QualityPreset[] = [
        {
            name: 'standard',
            description: 'Standard quality (16kHz, 64kbps)',
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
            description: 'High quality (44.1kHz, 128kbps)',
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
            description: 'Maximum quality (48kHz, 256kbps)',
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
     * Gets the current audio quality settings from the VS Code configuration
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
     * Applies the quality preset to the VS Code settings
     */
    static async applyQualityPreset(presetName: string): Promise<void> {
        const preset = this.QUALITY_PRESETS.find(p => p.name === presetName);
        if (!preset) {
            throw new Error(`Quality preset '${presetName}' not found`);
        }

        const config = vscode.workspace.getConfiguration('speechToTextWhisper');
        
        // Mapping keys between the internal interface and VSCode settings
        const keyMapping: Record<string, string> = {
            'quality': 'audioQuality',
            'channelCount': 'channels',
            'autoGainControl': 'autoGain'
        };
        
        // Apply settings from the preset
        for (const [key, value] of Object.entries(preset.settings)) {
            if (value !== undefined) {
                const configKey = keyMapping[key] || key;
                await config.update(configKey, value, vscode.ConfigurationTarget.Global);
            }
        }

        AudioQualityManagerLog.info(`Applied audio quality preset: ${preset.name}`);
    }

    /**
     * Gets the list of available quality presets
     */
    static getAvailablePresets(): QualityPreset[] {
        return [...this.QUALITY_PRESETS];
    }

    /**
     * Optimizes the quality settings based on the usage context
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
                    silenceDetection: false // Don't interrupt on pauses in conversation
                };
                
            case 'dictation':
                return {
                    ...baseSettings,
                    quality: 'high',
                    echoCancellation: true,
                    noiseSuppression: true,
                    silenceDetection: true,
                    silenceThreshold: 3.0 // Wait longer before stopping
                };
                
            case 'quick_notes':
                return {
                    ...baseSettings,
                    quality: 'standard',
                    silenceDetection: true,
                    silenceThreshold: 1.5 // Fast stop
                };
                
            case 'noisy_environment':
                return {
                    ...baseSettings,
                    quality: 'ultra',
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    silenceThreshold: 4.0 // More time for noise filtering
                };
                
            default:
                return baseSettings;
        }
    }

    /**
     * Validates the quality settings for compatibility with the browser
     */
    static validateSettings(settings: AudioQualitySettings): { 
        isValid: boolean; 
        warnings: string[];
        suggestions: string[];
    } {
        const warnings: string[] = [];
        const suggestions: string[] = [];
        let isValid = true;

        // Check support for high sample rate
        if (settings.sampleRate && settings.sampleRate > 48000) {
            warnings.push('Sample rate above 48kHz may not be supported by all browsers');
            suggestions.push('Consider using 48kHz for maximum compatibility');
        }

        // Check the combination of format and quality
        if (settings.quality === 'ultra' && settings.audioFormat === 'mp3') {
            warnings.push('MP3 format may not provide maximum quality for ultra mode');
            suggestions.push('Use WAV format for ultra quality');
        }

        // Check the silence detection settings
        if (settings.silenceDetection && settings.silenceThreshold < 0.5) {
            warnings.push('Too low silence threshold may lead to premature stop of recording');
            suggestions.push('Recommended silence threshold is at least 1 second');
        }

        return { isValid, warnings, suggestions };
    }

    /**
     * Returns recommendations for performance optimization
     */
    static getPerformanceRecommendations(settings: AudioQualitySettings): string[] {
        const recommendations: string[] = [];

        if (settings.quality === 'ultra') {
            recommendations.push('Ultra quality consumes more resources. Use for critical recordings.');
        }

        if (settings.audioFormat === 'wav' && settings.quality === 'standard') {
            recommendations.push('WAV format with standard quality may be excessive. Consider WebM for better compression.');
        }

        if (!settings.echoCancellation && !settings.noiseSuppression) {
            recommendations.push('Disabling echo cancellation and noise suppression may degrade quality in noisy environments.');
        }

        if (settings.silenceDetection && settings.silenceThreshold > 5.0) {
            recommendations.push('High silence threshold may miss short pauses in speech.');
        }

        return recommendations;
    }

    /**
     * Exports the current settings to JSON
     */
    static exportSettings(): string {
        const settings = this.getCurrentSettings();
        return JSON.stringify(settings, null, 2);
    }

    /**
     * Imports settings from JSON
     */
    static async importSettings(settingsJson: string): Promise<void> {
        try {
            const settings = JSON.parse(settingsJson) as AudioQualitySettings;
            const validation = this.validateSettings(settings);
            
            if (!validation.isValid) {
                throw new Error(`Invalid settings: ${validation.warnings.join(', ')}`);
            }

            const config = vscode.workspace.getConfiguration('speechToTextWhisper');
            
            // Mapping keys between the internal interface and VSCode settings
            const keyMapping: Record<string, string> = {
                'quality': 'audioQuality',
                'channelCount': 'channels',
                'autoGainControl': 'autoGain'
            };
            
            // Apply settings
            for (const [key, value] of Object.entries(settings)) {
                if (value !== undefined) {
                    const configKey = keyMapping[key] || key;
                    await config.update(configKey, value, vscode.ConfigurationTarget.Global);
                }
            }

            AudioQualityManagerLog.info('Audio quality settings imported successfully');
            
        } catch (error) {
            throw new Error(`Failed to import settings: ${(error as Error).message}`);
        }
    }
} 