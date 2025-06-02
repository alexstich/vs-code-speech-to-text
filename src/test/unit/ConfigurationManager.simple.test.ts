import * as assert from 'assert';
import * as sinon from 'sinon';

// Импортируем ConfigurationManager без моков vscode
import { ConfigurationManager } from '../../core/ConfigurationManager';

describe('ConfigurationManager - Simple Tests', () => {
    let configManager: ConfigurationManager;
    let sandbox: sinon.SinonSandbox;

    beforeEach(() => {
        // Создаем песочницу sinon
        sandbox = sinon.createSandbox();
        
        // Сбрасываем синглтон
        (ConfigurationManager as any).instance = null;
        
        // Создаем новый экземпляр
        configManager = ConfigurationManager.getInstance();
    });

    afterEach(() => {
        configManager.dispose();
        sandbox.restore();
    });

    describe('Basic Configuration Access', () => {
        it('должен вернуть конфигурацию Whisper', () => {
            const loadConfigurationStub = sandbox.stub(configManager as any, 'loadConfiguration');
            loadConfigurationStub.returns({
                whisper: {
                    apiKey: 'test-api-key',
                    language: 'auto', 
                    whisperModel: 'whisper-1',
                    prompt: 'test prompt',
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
            });

            const whisperConfig = configManager.getWhisperConfiguration();
            assert.strictEqual(whisperConfig.apiKey, 'test-api-key');
            assert.strictEqual(whisperConfig.language, 'auto');
            assert.strictEqual(whisperConfig.whisperModel, 'whisper-1');
            assert.strictEqual(whisperConfig.temperature, 0.1);
        });

        it('должен вернуть конфигурацию Audio', () => {
            const loadConfigurationStub = sandbox.stub(configManager as any, 'loadConfiguration');
            loadConfigurationStub.returns({
                whisper: {
                    apiKey: 'test-api-key',
                    language: 'auto', 
                    whisperModel: 'whisper-1',
                    prompt: '',
                    temperature: 0.1,
                    timeout: 30000,
                    maxRetries: 3
                },
                audio: {
                    audioQuality: 'high',
                    ffmpegPath: '/usr/bin/ffmpeg',
                    maxRecordingDuration: 120,
                    silenceDetection: false,
                    silenceDuration: 2,
                    silenceThreshold: 40,
                    inputDevice: 'Built-in Microphone'
                },
                ui: {
                    showStatusBar: true
                }
            });

            const audioConfig = configManager.getAudioConfiguration();
            assert.strictEqual(audioConfig.audioQuality, 'high');
            assert.strictEqual(audioConfig.ffmpegPath, '/usr/bin/ffmpeg');
            assert.strictEqual(audioConfig.maxRecordingDuration, 120);
            assert.strictEqual(audioConfig.silenceDetection, false);
            assert.strictEqual(audioConfig.inputDevice, 'Built-in Microphone');
        });

        it('должен вернуть конфигурацию UI', () => {
            const loadConfigurationStub = sandbox.stub(configManager as any, 'loadConfiguration');
            loadConfigurationStub.returns({
                whisper: {
                    apiKey: 'test-api-key',
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
                    showStatusBar: false
                }
            });

            const uiConfig = configManager.getUIConfiguration();
            assert.strictEqual(uiConfig.showStatusBar, false);
        });

        it('должен вернуть полную конфигурацию', () => {
            const loadConfigurationStub = sandbox.stub(configManager as any, 'loadConfiguration');
            loadConfigurationStub.returns({
                whisper: {
                    apiKey: 'full-config-key',
                    language: 'en', 
                    whisperModel: 'whisper-1',
                    prompt: 'Full config prompt',
                    temperature: 0.5,
                    timeout: 45000,
                    maxRetries: 5
                },
                audio: {
                    audioQuality: 'ultra',
                    ffmpegPath: '/custom/ffmpeg',
                    maxRecordingDuration: 180,
                    silenceDetection: true,
                    silenceDuration: 4,
                    silenceThreshold: 35,
                    inputDevice: 'Custom Microphone'
                },
                ui: {
                    showStatusBar: true
                }
            });

            const fullConfig = configManager.getConfiguration();
            
            // Проверяем whisper секцию
            assert.strictEqual(fullConfig.whisper.apiKey, 'full-config-key');
            assert.strictEqual(fullConfig.whisper.language, 'en');
            assert.strictEqual(fullConfig.whisper.temperature, 0.5);
            
            // Проверяем audio секцию
            assert.strictEqual(fullConfig.audio.audioQuality, 'ultra');
            assert.strictEqual(fullConfig.audio.maxRecordingDuration, 180);
            
            // Проверяем UI секцию
            assert.strictEqual(fullConfig.ui.showStatusBar, true);
        });
    });

    describe('Default Values', () => {
        it('должен использовать значения по умолчанию при отсутствии конфигурации', () => {
            const loadConfigurationStub = sandbox.stub(configManager as any, 'loadConfiguration');
            loadConfigurationStub.returns({
                whisper: {
                    apiKey: '',
                    language: 'auto', 
                    whisperModel: 'whisper-1',
                    prompt: '',
                    temperature: 0.0,
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
            });

            const config = configManager.getConfiguration();
            
            // Проверяем default значения
            assert.strictEqual(config.whisper.language, 'auto');
            assert.strictEqual(config.whisper.whisperModel, 'whisper-1');
            assert.strictEqual(config.whisper.temperature, 0.0);
            assert.strictEqual(config.audio.audioQuality, 'standard');
            assert.strictEqual(config.audio.maxRecordingDuration, 60);
            assert.strictEqual(config.ui.showStatusBar, true);
        });
    });

    describe('Singleton Pattern', () => {
        it('должен возвращать тот же экземпляр при повторных вызовах getInstance', () => {
            const instance1 = ConfigurationManager.getInstance();
            const instance2 = ConfigurationManager.getInstance();
            
            assert.strictEqual(instance1, instance2, 'getInstance должен возвращать тот же экземпляр');
        });
    });

    describe('Configuration Validation', () => {
        it('должен успешно валидировать корректную конфигурацию', () => {
            const loadConfigurationStub = sandbox.stub(configManager as any, 'loadConfiguration');
            loadConfigurationStub.returns({
                whisper: {
                    apiKey: 'valid-api-key-12345',
                    language: 'auto', 
                    whisperModel: 'whisper-1',
                    prompt: '',
                    temperature: 0.2,
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
            });

            const validation = configManager.validateConfiguration();
            assert.ok(validation.isValid, 'Корректная конфигурация должна проходить валидацию');
            assert.strictEqual(validation.errors.length, 0, 'Не должно быть ошибок валидации');
        });

        it('должен обнаруживать проблемы в некорректной конфигурации', () => {
            const loadConfigurationStub = sandbox.stub(configManager as any, 'loadConfiguration');
            loadConfigurationStub.returns({
                whisper: {
                    apiKey: '', // Пустой API key
                    language: 'auto', 
                    whisperModel: 'whisper-1',
                    prompt: '',
                    temperature: 2.0, // Невалидная температура > 1
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
            });

            const validation = configManager.validateConfiguration();
            assert.ok(!validation.isValid, 'Некорректная конфигурация должна быть невалидна');
            assert.ok(validation.errors.length > 0, 'Должны быть ошибки валидации');
            
            const errorText = validation.errors.join(' ');
            assert.ok(errorText.includes('API key'), 'Должна быть ошибка для пустого API key');
            assert.ok(errorText.includes('Temperature'), 'Должна быть ошибка для температуры');
        });
    });
}); 