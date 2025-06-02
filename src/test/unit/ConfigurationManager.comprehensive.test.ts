import * as assert from 'assert';
import * as sinon from 'sinon';
import { ConfigurationManager, WhisperConfiguration, AudioConfiguration, UIConfiguration, FullConfiguration } from '../../core/ConfigurationManager';

describe('ConfigurationManager - Comprehensive Settings Tests', () => {
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

    describe('Whisper Configuration Tests', () => {
        it('should handle valid API key', () => {
            // Создаем мок для loadConfiguration с валидным API key
            const loadConfigurationStub = sandbox.stub(configManager as any, 'loadConfiguration');
            loadConfigurationStub.returns({
                whisper: {
                    apiKey: 'sk-test123456789',
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
            });

            const config = configManager.getConfiguration();
            assert.strictEqual(config.whisper.apiKey, 'sk-test123456789');
        });

        it('should handle invalid API key', () => {
            // Создаем мок для loadConfiguration с пустым API key
            const loadConfigurationStub = sandbox.stub(configManager as any, 'loadConfiguration');
            loadConfigurationStub.returns({
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
            });

            const validation = configManager.validateConfiguration();
            assert.ok(!validation.isValid, 'Пустой API key должен быть невалидным');
            assert.ok(validation.errors.some(err => err.includes('API key')), 'Должна быть ошибка для API key');
        });

        it('should handle temperature bounds', () => {
            // Тестируем валидную температуру
            const loadConfigurationStub = sandbox.stub(configManager as any, 'loadConfiguration');
            loadConfigurationStub.returns({
                whisper: {
                    apiKey: 'test-key',
                    language: 'auto', 
                    whisperModel: 'whisper-1',
                    prompt: '',
                    temperature: 0.5,
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

            let validation = configManager.validateConfiguration();
            assert.ok(validation.isValid, 'Температура 0.5 должна быть валидной');

            // Тестируем невалидную температуру
            loadConfigurationStub.returns({
                whisper: {
                    apiKey: 'test-key',
                    language: 'auto', 
                    whisperModel: 'whisper-1',
                    prompt: '',
                    temperature: 1.5, // Невалидное значение
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

            // Очищаем кэш чтобы новая конфигурация загрузилась
            (configManager as any).invalidateCache();
            
            validation = configManager.validateConfiguration();
            assert.ok(!validation.isValid, 'Температура 1.5 должна быть невалидной');
            assert.ok(validation.errors.some(err => err.includes('Temperature')), 'Должна быть ошибка для температуры');
        });
    });

    describe('Audio Configuration Tests', () => {
        it('should handle audio quality settings', () => {
            const loadConfigurationStub = sandbox.stub(configManager as any, 'loadConfiguration');
            loadConfigurationStub.returns({
                whisper: {
                    apiKey: 'test-key',
                    language: 'auto', 
                    whisperModel: 'whisper-1',
                    prompt: '',
                    temperature: 0.1,
                    timeout: 30000,
                    maxRetries: 3
                },
                audio: {
                    audioQuality: 'high',
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
            assert.strictEqual(config.audio.audioQuality, 'high');
        });

        it('should validate silence threshold ranges', () => {
            const loadConfigurationStub = sandbox.stub(configManager as any, 'loadConfiguration');
            
            // Тест валидного значения (в диапазоне 20-80)
            loadConfigurationStub.returns({
                whisper: {
                    apiKey: 'test-key',
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
                    silenceThreshold: 30,
                    inputDevice: 'auto'
                },
                ui: {
                    showStatusBar: true
                }
            });

            let validation = configManager.validateConfiguration();
            assert.ok(validation.isValid, 'silenceThreshold=30 должно быть валидным');

            // Тест невалидного значения (вне диапазона)
            loadConfigurationStub.returns({
                whisper: {
                    apiKey: 'test-key',
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
                    silenceThreshold: 10, // Слишком мало
                    inputDevice: 'auto'
                },
                ui: {
                    showStatusBar: true
                }
            });

            // Очищаем кэш чтобы новая конфигурация загрузилась
            (configManager as any).invalidateCache();

            validation = configManager.validateConfiguration();
            assert.ok(!validation.isValid, 'silenceThreshold=10 должно быть невалидным');
            assert.ok(validation.errors.some(err => err.includes('Silence threshold')), 'Должна быть ошибка для silenceThreshold');
        });
    });

    describe('UI Configuration Tests', () => {
        it('should handle UI settings', () => {
            const loadConfigurationStub = sandbox.stub(configManager as any, 'loadConfiguration');
            loadConfigurationStub.returns({
                whisper: {
                    apiKey: 'test-key',
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

            const config = configManager.getConfiguration();
            assert.strictEqual(config.ui.showStatusBar, false);
        });
    });

    describe('Section Configuration Tests', () => {
        it('should return individual configuration sections', () => {
            const loadConfigurationStub = sandbox.stub(configManager as any, 'loadConfiguration');
            loadConfigurationStub.returns({
                whisper: {
                    apiKey: 'section-test-key',
                    language: 'ru', 
                    whisperModel: 'whisper-1',
                    prompt: 'test prompt',
                    temperature: 0.3,
                    timeout: 45000,
                    maxRetries: 5
                },
                audio: {
                    audioQuality: 'ultra',
                    ffmpegPath: '/custom/path',
                    maxRecordingDuration: 120,
                    silenceDetection: false,
                    silenceDuration: 5,
                    silenceThreshold: 30,
                    inputDevice: 'custom-device'
                },
                ui: {
                    showStatusBar: false
                }
            });

            const whisperConfig = configManager.getWhisperConfiguration();
            const audioConfig = configManager.getAudioConfiguration();
            const uiConfig = configManager.getUIConfiguration();

            // Проверяем whisper конфигурацию
            assert.strictEqual(whisperConfig.apiKey, 'section-test-key');
            assert.strictEqual(whisperConfig.language, 'ru');
            assert.strictEqual(whisperConfig.temperature, 0.3);

            // Проверяем audio конфигурацию
            assert.strictEqual(audioConfig.audioQuality, 'ultra');
            assert.strictEqual(audioConfig.maxRecordingDuration, 120);
            assert.strictEqual(audioConfig.silenceDetection, false);

            // Проверяем ui конфигурацию
            assert.strictEqual(uiConfig.showStatusBar, false);
        });
    });
});