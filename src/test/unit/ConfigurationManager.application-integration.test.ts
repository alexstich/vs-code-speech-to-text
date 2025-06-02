import * as assert from 'assert';
import * as sinon from 'sinon';
import { ConfigurationManager } from '../../core/ConfigurationManager';

describe('ConfigurationManager - Application Integration Tests', () => {
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

    describe('WhisperClient Configuration Usage', () => {
        it('должен предоставлять правильные настройки для WhisperClient', () => {
            const loadConfigurationStub = sandbox.stub(configManager as any, 'loadConfiguration');
            loadConfigurationStub.returns({
                whisper: {
                    apiKey: 'sk-test123456789',
                    language: 'ru', 
                    whisperModel: 'whisper-1',
                    prompt: 'Это тест',
                    temperature: 0.2,
                    timeout: 45000,
                    maxRetries: 5
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
            
            assert.strictEqual(whisperConfig.apiKey, 'sk-test123456789');
            assert.strictEqual(whisperConfig.language, 'ru');
            assert.strictEqual(whisperConfig.temperature, 0.2);
            assert.strictEqual(whisperConfig.timeout, 45000);
        });

        it('должен валидировать API key для WhisperClient', () => {
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
            assert.ok(!validation.isValid, 'Конфигурация должна быть невалидна без API key');
            assert.ok(validation.errors.some(err => err.includes('API key')), 'Должна быть ошибка API key');
        });

        it('должен валидировать timeout для WhisperClient', () => {
            const loadConfigurationStub = sandbox.stub(configManager as any, 'loadConfiguration');
            loadConfigurationStub.returns({
                whisper: {
                    apiKey: 'test-key',
                    language: 'auto', 
                    whisperModel: 'whisper-1',
                    prompt: '',
                    temperature: 0.1,
                    timeout: 0, // Нулевой timeout
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
            assert.ok(!validation.isValid, 'Нулевой timeout должен быть невалиден');
            assert.ok(validation.errors.some(err => err.includes('Timeout')), 'Должна быть ошибка timeout');
        });
    });

    describe('Audio Recorder Configuration Usage', () => {
        it('должен предоставлять правильные настройки для AudioRecorder', () => {
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
                    ffmpegPath: '/custom/ffmpeg',
                    maxRecordingDuration: 180,
                    silenceDetection: false,
                    silenceDuration: 5,
                    silenceThreshold: 40,
                    inputDevice: 'Built-in Microphone'
                },
                ui: {
                    showStatusBar: true
                }
            });

            const audioConfig = configManager.getAudioConfiguration();
            
            assert.strictEqual(audioConfig.audioQuality, 'high');
            assert.strictEqual(audioConfig.maxRecordingDuration, 180);
            assert.strictEqual(audioConfig.silenceDetection, false);
            assert.strictEqual(audioConfig.silenceThreshold, 40);
        });

        it('должен валидировать silence threshold с правильным диапазоном', () => {
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
                    silenceThreshold: 10, // Невалидное значение
                    inputDevice: 'auto'
                },
                ui: {
                    showStatusBar: true
                }
            });

            const validation = configManager.validateConfiguration();
            assert.ok(!validation.isValid, 'Значение silenceThreshold=10 должно быть невалидным в ConfigurationManager');
            assert.ok(validation.errors.some(err => err.includes('Silence threshold')), 'Должна быть ошибка для silenceThreshold');
        });

        it('должен проверять граничные значения длительности записи - нулевое значение', () => {
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
                    maxRecordingDuration: 0,
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
            assert.ok(!validation.isValid, 'нулевое значение (0) должно быть невалидным');
        });

        it('должен проверять граничные значения длительности записи - отрицательное значение', () => {
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
                    maxRecordingDuration: -10,
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
            assert.ok(!validation.isValid, 'отрицательное значение (-10) должно быть невалидным');
        });

        it('должен проверять граничные значения длительности записи - валидные значения', () => {
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
                    maxRecordingDuration: 1,
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
            assert.ok(validation.isValid, 'минимальное валидное значение (1) должно быть валидным');

            // Тестируем большое валидное значение
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
                    maxRecordingDuration: 300,
                    silenceDetection: true,
                    silenceDuration: 3,
                    silenceThreshold: 50,
                    inputDevice: 'auto'
                },
                ui: {
                    showStatusBar: true
                }
            });

            (configManager as any).invalidateCache();
            validation = configManager.validateConfiguration();
            assert.ok(validation.isValid, 'большое валидное значение (300) должно быть валидным');
        });
    });

    describe('UI Configuration Usage', () => {
        it('должен правильно обрабатывать изменения showStatusBar', () => {
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
                    showStatusBar: true
                }
            });

            const uiConfig = configManager.getUIConfiguration();
            assert.strictEqual(uiConfig.showStatusBar, true);
        });
    });

    describe('Real-world Configuration Scenarios', () => {
        it('должен обрабатывать полную конфигурацию для production использования', () => {
            const loadConfigurationStub = sandbox.stub(configManager as any, 'loadConfiguration');
            loadConfigurationStub.returns({
                whisper: {
                    apiKey: 'sk-prod-key-example',
                    language: 'en', 
                    whisperModel: 'whisper-1',
                    prompt: 'Production prompt',
                    temperature: 0.0,
                    timeout: 60000,
                    maxRetries: 5
                },
                audio: {
                    audioQuality: 'ultra',
                    ffmpegPath: '/usr/local/bin/ffmpeg',
                    maxRecordingDuration: 300,
                    silenceDetection: true,
                    silenceDuration: 2,
                    silenceThreshold: 30,
                    inputDevice: 'Professional USB Microphone'
                },
                ui: {
                    showStatusBar: false
                }
            });

            const config = configManager.getConfiguration();
            assert.strictEqual(config.whisper.apiKey, 'sk-prod-key-example');
            assert.strictEqual(config.audio.audioQuality, 'ultra');
            assert.strictEqual(config.ui.showStatusBar, false);
        });

        it('должен обрабатывать конфигурацию для разработки', () => {
            const loadConfigurationStub = sandbox.stub(configManager as any, 'loadConfiguration');
            loadConfigurationStub.returns({
                whisper: {
                    apiKey: 'sk-dev-key',
                    language: 'auto', 
                    whisperModel: 'whisper-1',
                    prompt: 'Dev test',
                    temperature: 0.7,
                    timeout: 30000,
                    maxRetries: 1
                },
                audio: {
                    audioQuality: 'standard',
                    ffmpegPath: '',
                    maxRecordingDuration: 30,
                    silenceDetection: false,
                    silenceDuration: 1,
                    silenceThreshold: 60,
                    inputDevice: 'auto'
                },
                ui: {
                    showStatusBar: true
                }
            });

            const config = configManager.getConfiguration();
            assert.strictEqual(config.whisper.temperature, 0.7);
            assert.strictEqual(config.audio.maxRecordingDuration, 30);
        });

        it('должен выявлять проблемы в некорректной конфигурации', () => {
            const loadConfigurationStub = sandbox.stub(configManager as any, 'loadConfiguration');
            loadConfigurationStub.returns({
                whisper: {
                    apiKey: '', // Пустой API key
                    language: 'auto', 
                    whisperModel: 'whisper-1',
                    prompt: '',
                    temperature: 2.0, // Невалидная температура
                    timeout: -1000, // Невалидный timeout
                    maxRetries: -5 // Невалидные retry
                },
                audio: {
                    audioQuality: 'standard',
                    ffmpegPath: '',
                    maxRecordingDuration: -10, // Невалидная длительность
                    silenceDetection: true,
                    silenceDuration: -1, // Невалидная длительность тишины
                    silenceThreshold: 100, // Невалидный порог
                    inputDevice: 'auto'
                },
                ui: {
                    showStatusBar: true
                }
            });

            const validation = configManager.validateConfiguration();
            assert.ok(!validation.isValid, 'Некорректная конфигурация должна быть невалидна');
            assert.ok(validation.errors.length > 0, 'Должны быть ошибки валидации');
        });
    });

    describe('Configuration Persistence and Caching', () => {
        it('должен кэшировать конфигурацию для производительности', () => {
            const loadConfigurationStub = sandbox.stub(configManager as any, 'loadConfiguration');
            loadConfigurationStub.returns({
                whisper: { apiKey: 'test-key', language: 'auto', whisperModel: 'whisper-1', prompt: '', temperature: 0.1, timeout: 30000, maxRetries: 3 },
                audio: { audioQuality: 'standard', ffmpegPath: '', maxRecordingDuration: 60, silenceDetection: true, silenceDuration: 3, silenceThreshold: 50, inputDevice: 'auto' },
                ui: { showStatusBar: true }
            });

            // Первый вызов должен загрузить конфигурацию
            const config1 = configManager.getConfiguration();
            
            // Второй вызов должен использовать кэш
            const config2 = configManager.getConfiguration();
            
            // Проверяем что loadConfiguration был вызван только один раз
            assert.strictEqual(loadConfigurationStub.callCount, 1, 'loadConfiguration должен был быть вызван только один раз');
            
            // Конфигурации должны быть идентичными (один объект)
            assert.strictEqual(config1, config2, 'Конфигурации должны быть кэшированы');
        });

        it('должен сбрасывать кэш при обновлении конфигурации', () => {
            const loadConfigurationStub = sandbox.stub(configManager as any, 'loadConfiguration');
            
            // Первая конфигурация
            loadConfigurationStub.returns({
                whisper: { apiKey: 'test-key', language: 'auto', whisperModel: 'whisper-1', prompt: '', temperature: 0.1, timeout: 30000, maxRetries: 3 },
                audio: { audioQuality: 'standard', ffmpegPath: '', maxRecordingDuration: 60, silenceDetection: true, silenceDuration: 3, silenceThreshold: 50, inputDevice: 'auto' },
                ui: { showStatusBar: true }
            });

            const config1 = configManager.getConfiguration();
            
            // Изменяем конфигурацию в моке
            loadConfigurationStub.returns({
                whisper: { apiKey: 'test-key', language: 'auto', whisperModel: 'whisper-1', prompt: '', temperature: 0.1, timeout: 30000, maxRetries: 3 },
                audio: { audioQuality: 'standard', ffmpegPath: '', maxRecordingDuration: 60, silenceDetection: true, silenceDuration: 3, silenceThreshold: 50, inputDevice: 'auto' },
                ui: { showStatusBar: true }
            });

            // Сбрасываем кэш
            (configManager as any).invalidateCache();
            
            const config2 = configManager.getConfiguration();
            
            // Проверяем что конфигурация перезагружена
            assert.strictEqual(loadConfigurationStub.callCount, 2, 'loadConfiguration должен был быть вызван дважды');
        });
    });

    describe('Environment Simulation Tests', () => {
        it('должен работать в development environment', () => {
            const loadConfigurationStub = sandbox.stub(configManager as any, 'loadConfiguration');
            loadConfigurationStub.returns({
                whisper: {
                    apiKey: 'sk-test123456789',
                    language: 'auto', 
                    whisperModel: 'whisper-1',
                    prompt: '',
                    temperature: 0.5,
                    timeout: 15000,
                    maxRetries: 1
                },
                audio: {
                    audioQuality: 'standard',
                    ffmpegPath: '',
                    maxRecordingDuration: 30,
                    silenceDetection: false,
                    silenceDuration: 1,
                    silenceThreshold: 70,
                    inputDevice: 'auto'
                },
                ui: {
                    showStatusBar: true
                }
            });

            const config = configManager.getConfiguration();
            assert.strictEqual(config.whisper.apiKey, 'sk-test123456789');
            assert.strictEqual(config.whisper.timeout, 15000);
        });

        it('должен работать в production environment', () => {
            const loadConfigurationStub = sandbox.stub(configManager as any, 'loadConfiguration');
            loadConfigurationStub.returns({
                whisper: {
                    apiKey: 'sk-prod-key-example',
                    language: 'en', 
                    whisperModel: 'whisper-1',
                    prompt: 'Production',
                    temperature: 0.0,
                    timeout: 60000,
                    maxRetries: 10
                },
                audio: {
                    audioQuality: 'ultra',
                    ffmpegPath: '/opt/ffmpeg/bin/ffmpeg',
                    maxRecordingDuration: 600,
                    silenceDetection: true,
                    silenceDuration: 5,
                    silenceThreshold: 25,
                    inputDevice: 'pro-microphone'
                },
                ui: {
                    showStatusBar: false
                }
            });

            const config = configManager.getConfiguration();
            assert.strictEqual(config.whisper.apiKey, 'sk-prod-key-example');
        });

        it('должен работать в test environment', () => {
            const loadConfigurationStub = sandbox.stub(configManager as any, 'loadConfiguration');
            loadConfigurationStub.returns({
                whisper: {
                    apiKey: 'sk-dev-test-key',
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
            assert.strictEqual(config.whisper.apiKey, 'sk-dev-test-key');
        });

        it('должен обрабатывать отсутствующую конфигурацию', () => {
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

            const config = configManager.getConfiguration();
            assert.strictEqual(config.whisper.apiKey, '');
            
            const validation = configManager.validateConfiguration();
            assert.ok(!validation.isValid, 'Конфигурация без API key должна быть невалидна');
        });

        it('должен обрабатывать частично поврежденную конфигурацию', () => {
            const loadConfigurationStub = sandbox.stub(configManager as any, 'loadConfiguration');
            loadConfigurationStub.returns({
                whisper: {
                    apiKey: '',
                    language: 'auto', 
                    whisperModel: 'whisper-1',
                    prompt: '',
                    temperature: 5.0, // Невалидная температура
                    timeout: 30000,
                    maxRetries: 3
                },
                audio: {
                    audioQuality: 'standard',
                    ffmpegPath: '',
                    maxRecordingDuration: 60,
                    silenceDetection: true,
                    silenceDuration: 3,
                    silenceThreshold: 5, // Невалидный порог
                    inputDevice: 'auto'
                },
                ui: {
                    showStatusBar: true
                }
            });

            const validation = configManager.validateConfiguration();
            assert.ok(!validation.isValid, 'Конфигурация должна быть невалидной');
            assert.ok(validation.errors.length > 0, 'Должны быть ошибки валидации');
        });
    });
}); 

