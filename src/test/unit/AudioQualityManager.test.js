"use strict";
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
const assert = __importStar(require("assert"));
const sinon = __importStar(require("sinon"));
// Создаем mock конфигурации
let mockConfig;
const mockVSCode = {
    workspace: {
        getConfiguration: sinon.stub()
    },
    ConfigurationTarget: {
        Global: 1
    }
};
// Сначала устанавливаем глобальный vscode
global.vscode = mockVSCode;
// И только потом требуем модуль через require
const { AudioQualityManager } = require('../../utils/AudioQualityManager');
suite('AudioQualityManager Tests', () => {
    setup(() => {
        // Сбрасываем моки
        sinon.resetHistory();
        sinon.resetBehavior();
        // Настраиваем mock конфигурации
        mockConfig = {
            get: sinon.stub(),
            update: sinon.stub().resolves()
        };
        // Устанавливаем возврат конфигурации
        mockVSCode.workspace.getConfiguration.returns(mockConfig);
        // Базовые настройки с правильными ключами
        mockConfig.get.withArgs('audioQuality', 'standard').returns('standard');
        mockConfig.get.withArgs('audioFormat', 'wav').returns('wav');
        mockConfig.get.withArgs('echoCancellation', true).returns(true);
        mockConfig.get.withArgs('noiseReduction', true).returns(true);
        mockConfig.get.withArgs('autoGain', true).returns(true);
        mockConfig.get.withArgs('silenceDetection', true).returns(true);
        mockConfig.get.withArgs('silenceThreshold', 2.0).returns(2.0);
        // Добавим дополнительные настройки
        mockConfig.get.withArgs('sampleRate').returns(undefined);
        mockConfig.get.withArgs('channelCount').returns(undefined);
    });
    teardown(() => {
        sinon.restore();
    });
    suite('getCurrentSettings', () => {
        test('Should return current settings from configuration', () => {
            const settings = AudioQualityManager.getCurrentSettings();
            assert.strictEqual(settings.quality, 'standard');
            assert.strictEqual(settings.audioFormat, 'wav');
            assert.strictEqual(settings.echoCancellation, true);
            assert.strictEqual(settings.noiseSuppression, true);
            assert.strictEqual(settings.autoGainControl, true);
            assert.strictEqual(settings.silenceDetection, true);
            assert.strictEqual(settings.silenceThreshold, 2.0);
        });
        test('Should handle undefined optional settings', () => {
            mockConfig.get.withArgs('sampleRate').returns(undefined);
            mockConfig.get.withArgs('channelCount').returns(undefined);
            const settings = AudioQualityManager.getCurrentSettings();
            assert.strictEqual(settings.sampleRate, undefined);
            assert.strictEqual(settings.channelCount, undefined);
        });
    });
    suite('getAvailablePresets', () => {
        test('Should return all quality presets', () => {
            const presets = AudioQualityManager.getAvailablePresets();
            assert.strictEqual(presets.length, 3);
            assert.ok(presets.find((p) => p.name === 'standard'));
            assert.ok(presets.find((p) => p.name === 'high'));
            assert.ok(presets.find((p) => p.name === 'ultra'));
        });
        test('Should include preset descriptions and recommendations', () => {
            const presets = AudioQualityManager.getAvailablePresets();
            const standardPreset = presets.find((p) => p.name === 'standard');
            assert.ok(standardPreset);
            assert.ok(standardPreset.description.includes('16kHz'));
            assert.ok(standardPreset.recommendedFor.length > 0);
        });
    });
    suite('applyQualityPreset', () => {
        test('Should apply standard preset successfully', async () => {
            await AudioQualityManager.applyQualityPreset('standard');
            assert.ok(mockConfig.update.calledWith('quality', 'standard'));
            assert.ok(mockConfig.update.calledWith('sampleRate', 16000));
            assert.ok(mockConfig.update.calledWith('audioFormat', 'webm'));
        });
        test('Should apply high preset successfully', async () => {
            await AudioQualityManager.applyQualityPreset('high');
            assert.ok(mockConfig.update.calledWith('quality', 'high'));
            assert.ok(mockConfig.update.calledWith('sampleRate', 44100));
            assert.ok(mockConfig.update.calledWith('audioFormat', 'wav'));
        });
        test('Should throw error for unknown preset', async () => {
            try {
                await AudioQualityManager.applyQualityPreset('unknown');
                assert.fail('Should have thrown an error');
            }
            catch (error) {
                assert.ok(error.message.includes('not found'));
            }
        });
    });
    suite('getOptimizedSettings', () => {
        test('Should optimize for meeting context', () => {
            const optimized = AudioQualityManager.getOptimizedSettings('meeting');
            assert.strictEqual(optimized.quality, 'high');
            assert.strictEqual(optimized.echoCancellation, true);
            assert.strictEqual(optimized.noiseSuppression, true);
            assert.strictEqual(optimized.silenceDetection, false);
        });
        test('Should optimize for dictation context', () => {
            const optimized = AudioQualityManager.getOptimizedSettings('dictation');
            assert.strictEqual(optimized.quality, 'high');
            assert.strictEqual(optimized.silenceDetection, true);
            assert.strictEqual(optimized.silenceThreshold, 3.0);
        });
        test('Should optimize for quick notes context', () => {
            const optimized = AudioQualityManager.getOptimizedSettings('quick_notes');
            assert.strictEqual(optimized.quality, 'standard');
            assert.strictEqual(optimized.silenceDetection, true);
            assert.strictEqual(optimized.silenceThreshold, 1.5);
        });
        test('Should optimize for noisy environment context', () => {
            const optimized = AudioQualityManager.getOptimizedSettings('noisy_environment');
            assert.strictEqual(optimized.quality, 'ultra');
            assert.strictEqual(optimized.echoCancellation, true);
            assert.strictEqual(optimized.noiseSuppression, true);
            assert.strictEqual(optimized.autoGainControl, true);
            assert.strictEqual(optimized.silenceThreshold, 4.0);
        });
    });
    suite('validateSettings', () => {
        test('Should validate correct settings', () => {
            const settings = {
                quality: 'standard',
                audioFormat: 'wav',
                sampleRate: 16000,
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
                silenceDetection: true,
                silenceThreshold: 2.0
            };
            const validation = AudioQualityManager.validateSettings(settings);
            assert.strictEqual(validation.isValid, true);
            assert.strictEqual(validation.warnings.length, 0);
        });
        test('Should warn about high sample rate', () => {
            const settings = {
                quality: 'ultra',
                audioFormat: 'wav',
                sampleRate: 96000,
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
                silenceDetection: true,
                silenceThreshold: 2.0
            };
            const validation = AudioQualityManager.validateSettings(settings);
            assert.ok(validation.warnings.some((w) => w.includes('Sample rate')));
            assert.ok(validation.suggestions.some((s) => s.includes('48kHz')));
        });
        test('Should warn about MP3 with ultra quality', () => {
            const settings = {
                quality: 'ultra',
                audioFormat: 'mp3',
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
                silenceDetection: true,
                silenceThreshold: 2.0
            };
            const validation = AudioQualityManager.validateSettings(settings);
            assert.ok(validation.warnings.some((w) => w.includes('MP3')));
            assert.ok(validation.suggestions.some((s) => s.includes('WAV')));
        });
        test('Should warn about low silence threshold', () => {
            const settings = {
                quality: 'standard',
                audioFormat: 'wav',
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
                silenceDetection: true,
                silenceThreshold: 0.3
            };
            const validation = AudioQualityManager.validateSettings(settings);
            assert.ok(validation.warnings.some((w) => w.includes('порог тишины')));
        });
    });
    suite('getPerformanceRecommendations', () => {
        test('Should recommend for ultra quality', () => {
            const settings = {
                quality: 'ultra',
                audioFormat: 'wav',
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
                silenceDetection: true,
                silenceThreshold: 2.0
            };
            const recommendations = AudioQualityManager.getPerformanceRecommendations(settings);
            assert.ok(recommendations.some((r) => r.includes('Ultra качество')));
        });
        test('Should recommend WebM for standard quality with WAV', () => {
            const settings = {
                quality: 'standard',
                audioFormat: 'wav',
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
                silenceDetection: true,
                silenceThreshold: 2.0
            };
            const recommendations = AudioQualityManager.getPerformanceRecommendations(settings);
            assert.ok(recommendations.some((r) => r.includes('WebM')));
        });
        test('Should warn about disabled audio processing', () => {
            const settings = {
                quality: 'standard',
                audioFormat: 'wav',
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: true,
                silenceDetection: true,
                silenceThreshold: 2.0
            };
            const recommendations = AudioQualityManager.getPerformanceRecommendations(settings);
            assert.ok(recommendations.some((r) => r.includes('echo cancellation')));
        });
    });
    suite('exportSettings', () => {
        test('Should export settings as JSON string', () => {
            const json = AudioQualityManager.exportSettings();
            const parsed = JSON.parse(json);
            assert.strictEqual(typeof json, 'string');
            assert.strictEqual(parsed.quality, 'standard');
            assert.strictEqual(parsed.audioFormat, 'wav');
        });
    });
    suite('importSettings', () => {
        test('Should import valid settings', async () => {
            const settingsJson = JSON.stringify({
                quality: 'high',
                audioFormat: 'wav',
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
                silenceDetection: true,
                silenceThreshold: 2.5
            });
            await AudioQualityManager.importSettings(settingsJson);
            assert.ok(mockConfig.update.called);
        });
        test('Should reject invalid JSON', async () => {
            try {
                await AudioQualityManager.importSettings('invalid json');
                assert.fail('Should have thrown an error');
            }
            catch (error) {
                assert.ok(error.message.includes('Failed to import'));
            }
        });
        test('Should reject settings with warnings', async () => {
            const settingsJson = JSON.stringify({
                quality: 'ultra',
                audioFormat: 'mp3',
                sampleRate: 96000,
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
                silenceDetection: true,
                silenceThreshold: 0.1
            });
            try {
                await AudioQualityManager.importSettings(settingsJson);
                assert.fail('Should have thrown an error');
            }
            catch (error) {
                assert.ok(error.message.includes('Invalid settings'));
            }
        });
    });
});
//# sourceMappingURL=AudioQualityManager.test.js.map