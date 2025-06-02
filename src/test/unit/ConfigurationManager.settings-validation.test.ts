import * as assert from 'assert';
import * as sinon from 'sinon';
import { ConfigurationManager } from '../../core/ConfigurationManager';

describe('ConfigurationManager - Settings Validation Tests', () => {
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

    describe('API Key Validation', () => {
        it('должен принимать валидный API key', () => {
            const loadConfigurationStub = sandbox.stub(configManager as any, 'loadConfiguration');
            loadConfigurationStub.returns({
                whisper: {
                    apiKey: 'sk-test123456789abcdef',
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
            assert.ok(validation.isValid, 'Валидный API key должен проходить валидацию');
            assert.strictEqual(validation.errors.length, 0, 'Не должно быть ошибок для валидного API key');
        });

        it('должен отклонять пустой API key', () => {
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

        it('должен принимать короткий API key (только проверка на пустоту)', () => {
            const loadConfigurationStub = sandbox.stub(configManager as any, 'loadConfiguration');
            loadConfigurationStub.returns({
                whisper: {
                    apiKey: 'sk-123',
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
            assert.ok(validation.isValid, 'Короткий, но непустой API key должен быть валидным');
            assert.strictEqual(validation.errors.length, 0, 'Не должно быть ошибок для непустого API key');
        });
    });

    describe('Temperature Validation', () => {
        it('должен принимать валидные значения температуры - граничные случаи', () => {
            // Тест минимального значения (0.0)
            const loadConfigurationStub = sandbox.stub(configManager as any, 'loadConfiguration');
            loadConfigurationStub.returns({
                whisper: {
                    apiKey: 'sk-test123456789',
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

            let validation = configManager.validateConfiguration();
            assert.ok(validation.isValid, 'Температура 0.0 должна быть валидной');

            // Тест максимального значения (1.0)
            loadConfigurationStub.returns({
                whisper: {
                    apiKey: 'sk-test123456789',
                    language: 'auto', 
                    whisperModel: 'whisper-1',
                    prompt: '',
                    temperature: 1.0,
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

            (configManager as any).invalidateCache();
            validation = configManager.validateConfiguration();
            assert.ok(validation.isValid, 'Температура 1.0 должна быть валидной');
        });

        it('должен отклонять невалидные значения температуры', () => {
            // Тест значения выше максимума
            const loadConfigurationStub = sandbox.stub(configManager as any, 'loadConfiguration');
            loadConfigurationStub.returns({
                whisper: {
                    apiKey: 'sk-test123456789',
                    language: 'auto', 
                    whisperModel: 'whisper-1',
                    prompt: '',
                    temperature: 1.5,
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
            assert.ok(!validation.isValid, 'Температура 1.5 должна быть невалидной');
            assert.ok(validation.errors.some(err => err.includes('Temperature')), 'Должна быть ошибка для температуры 1.5');

            // Тест отрицательного значения
            loadConfigurationStub.returns({
                whisper: {
                    apiKey: 'sk-test123456789',
                    language: 'auto', 
                    whisperModel: 'whisper-1',
                    prompt: '',
                    temperature: -0.1,
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

            (configManager as any).invalidateCache();
            validation = configManager.validateConfiguration();
            assert.ok(!validation.isValid, 'Температура -0.1 должна быть невалидной');
            assert.ok(validation.errors.some(err => err.includes('Temperature')), 'Должна быть ошибка для температуры -0.1');
        });
    });

    describe('Timeout Validation', () => {
        it('должен принимать валидные значения timeout', () => {
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

            const validation = configManager.validateConfiguration();
            assert.ok(validation.isValid, 'Timeout 30000 должен быть валидным');
        });

        it('должен отклонять невалидные значения timeout', () => {
            const loadConfigurationStub = sandbox.stub(configManager as any, 'loadConfiguration');
            loadConfigurationStub.returns({
                whisper: {
                    apiKey: 'sk-test123456789',
                    language: 'auto', 
                    whisperModel: 'whisper-1',
                    prompt: '',
                    temperature: 0.1,
                    timeout: 0,
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
            assert.ok(!validation.isValid, 'Timeout 0 должен быть невалидным');
            assert.ok(validation.errors.some(err => err.includes('Timeout')), 'Должна быть ошибка для timeout 0');
        });
    });

    describe('Silence Threshold Validation', () => {
        it('должен принимать валидные значения silenceThreshold (20-80)', () => {
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

            let validation = configManager.validateConfiguration();
            assert.ok(validation.isValid, 'Silence threshold 50 должен быть валидным');

            // Тест граничных значений
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
                    silenceThreshold: 20, // Минимум
                    inputDevice: 'auto'
                },
                ui: {
                    showStatusBar: true
                }
            });

            (configManager as any).invalidateCache();
            validation = configManager.validateConfiguration();
            assert.ok(validation.isValid, 'Silence threshold 20 должен быть валидным');

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
                    silenceThreshold: 80, // Максимум
                    inputDevice: 'auto'
                },
                ui: {
                    showStatusBar: true
                }
            });

            (configManager as any).invalidateCache();
            validation = configManager.validateConfiguration();
            assert.ok(validation.isValid, 'Silence threshold 80 должен быть валидным');
        });

        it('должен отклонять невалидные значения silenceThreshold', () => {
            // Ниже минимума
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
                    silenceThreshold: 15,
                    inputDevice: 'auto'
                },
                ui: {
                    showStatusBar: true
                }
            });

            let validation = configManager.validateConfiguration();
            assert.ok(!validation.isValid, 'Silence threshold 15 должен быть невалидным');
            assert.ok(validation.errors.some(err => err.includes('Silence threshold')), 'Должна быть ошибка для silence threshold 15');

            // Выше максимума
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
                    silenceThreshold: 85,
                    inputDevice: 'auto'
                },
                ui: {
                    showStatusBar: true
                }
            });

            (configManager as any).invalidateCache();
            validation = configManager.validateConfiguration();
            assert.ok(!validation.isValid, 'Silence threshold 85 должен быть невалидным');
            assert.ok(validation.errors.some(err => err.includes('Silence threshold')), 'Должна быть ошибка для silence threshold 85');
        });
    });

    describe('Max Retries Validation', () => {
        it('должен принимать валидные значения maxRetries (неотрицательные)', () => {
            const loadConfigurationStub = sandbox.stub(configManager as any, 'loadConfiguration');
            loadConfigurationStub.returns({
                whisper: {
                    apiKey: 'sk-test123456789',
                    language: 'auto', 
                    whisperModel: 'whisper-1',
                    prompt: '',
                    temperature: 0.1,
                    timeout: 30000,
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

            let validation = configManager.validateConfiguration();
            assert.ok(validation.isValid, 'Max retries 5 должно быть валидным');

            // Тест нулевого значения
            loadConfigurationStub.returns({
                whisper: {
                    apiKey: 'sk-test123456789',
                    language: 'auto', 
                    whisperModel: 'whisper-1',
                    prompt: '',
                    temperature: 0.1,
                    timeout: 30000,
                    maxRetries: 0
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

            (configManager as any).invalidateCache();
            validation = configManager.validateConfiguration();
            assert.ok(validation.isValid, 'Max retries 0 должно быть валидным');
        });

        it('должен отклонять отрицательные значения maxRetries', () => {
            const loadConfigurationStub = sandbox.stub(configManager as any, 'loadConfiguration');
            loadConfigurationStub.returns({
                whisper: {
                    apiKey: 'sk-test123456789',
                    language: 'auto', 
                    whisperModel: 'whisper-1',
                    prompt: '',
                    temperature: 0.1,
                    timeout: 30000,
                    maxRetries: -1
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
            assert.ok(!validation.isValid, 'Max retries -1 должно быть невалидным');
            assert.ok(validation.errors.some(err => err.includes('Max retries')), 'Должна быть ошибка для max retries -1');
        });
    });

    describe('Combined Validation Tests', () => {
        it('должен обрабатывать множественные ошибки валидации', () => {
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
            assert.ok(!validation.isValid, 'Конфигурация с множественными ошибками должна быть невалидна');
            assert.ok(validation.errors.length > 1, 'Должно быть несколько ошибок валидации');
            
            // Проверяем что есть ошибки для каждой категории
            const errorText = validation.errors.join(' ');
            assert.ok(errorText.includes('API key'), 'Должна быть ошибка API key');
            assert.ok(errorText.includes('Temperature'), 'Должна быть ошибка температуры');
            assert.ok(errorText.includes('Timeout'), 'Должна быть ошибка timeout');
        });

        it('должен проходить валидацию с корректными настройками', () => {
            const loadConfigurationStub = sandbox.stub(configManager as any, 'loadConfiguration');
            loadConfigurationStub.returns({
                whisper: {
                    apiKey: 'sk-validapikey123456789',
                    language: 'en', 
                    whisperModel: 'whisper-1',
                    prompt: 'Valid prompt',
                    temperature: 0.3,
                    timeout: 45000,
                    maxRetries: 3
                },
                audio: {
                    audioQuality: 'high',
                    ffmpegPath: '/usr/bin/ffmpeg',
                    maxRecordingDuration: 120,
                    silenceDetection: true,
                    silenceDuration: 5,
                    silenceThreshold: 40,
                    inputDevice: 'Microphone'
                },
                ui: {
                    showStatusBar: false
                }
            });

            const validation = configManager.validateConfiguration();
            assert.ok(validation.isValid, 'Корректная конфигурация должна проходить валидацию');
            assert.strictEqual(validation.errors.length, 0, 'Не должно быть ошибок для корректной конфигурации');
        });
    });
}); 