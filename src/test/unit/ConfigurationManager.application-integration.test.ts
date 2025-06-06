import * as assert from 'assert';
import * as sinon from 'sinon';
import { ConfigurationManager } from '../../core/ConfigurationManager';

describe('ConfigurationManager - Application Integration Tests', () => {
    let configManager: ConfigurationManager;
    let sandbox: sinon.SinonSandbox;

    beforeEach(() => {
        // Create sinon sandbox
        sandbox = sinon.createSandbox();
        
        // Reset singleton
        (ConfigurationManager as any).instance = null;
        
        // Create new instance
        configManager = ConfigurationManager.getInstance();
    });

    afterEach(() => {
        configManager.dispose();
        sandbox.restore();
    });

    describe('WhisperClient Configuration Usage', () => {
        it('should provide correct settings for WhisperClient', () => {
            const loadConfigurationStub = sandbox.stub(configManager as any, 'loadConfiguration');
            loadConfigurationStub.returns({
                whisper: {
                    apiKey: 'sk-test123456789',
                    language: 'ru', 
                    whisperModel: 'whisper-1',
                    prompt: 'This is a test',
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

        it('should validate API key for WhisperClient', () => {
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
            assert.ok(!validation.isValid, 'Configuration should be invalid without API key');
            assert.ok(validation.errors.some(err => err.includes('API key')), 'There should be an API key error');
        });

        it('should validate timeout for WhisperClient', () => {
            const loadConfigurationStub = sandbox.stub(configManager as any, 'loadConfiguration');
            loadConfigurationStub.returns({
                whisper: {
                    apiKey: 'test-key',
                    language: 'auto', 
                    whisperModel: 'whisper-1',
                    prompt: '',
                    temperature: 0.1,
                    timeout: 0, // Zero timeout
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
            assert.ok(!validation.isValid, 'Zero timeout should be invalid');
            assert.ok(validation.errors.some(err => err.includes('Timeout')), 'There should be a timeout error');
        });
    });

    describe('Audio Recorder Configuration Usage', () => {
        it('should provide correct settings for AudioRecorder', () => {
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

        it('should validate silence threshold with correct range', () => {
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
                    silenceThreshold: 10, // Invalid value
                    inputDevice: 'auto'
                },
                ui: {
                    showStatusBar: true
                }
            });

            const validation = configManager.validateConfiguration();
            assert.ok(!validation.isValid, 'silenceThreshold=10 should be invalid in ConfigurationManager');
            assert.ok(validation.errors.some(err => err.includes('Silence threshold')), 'There should be an error for silenceThreshold');
        });

        it('should check boundary values for recording duration - zero value', () => {
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
            assert.ok(!validation.isValid, 'zero value (0) should be invalid');
        });

        it('should check boundary values for recording duration - negative value', () => {
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
            assert.ok(!validation.isValid, 'negative value (-10) should be invalid');
        });

        it('should check boundary values for recording duration - valid values', () => {
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
            assert.ok(validation.isValid, 'minimum valid value (1) should be valid');

            // Testing large valid value
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
            assert.ok(validation.isValid, 'large valid value (300) should be valid');
        });
    });

    describe('UI Configuration Usage', () => {
        it('should handle changes to showStatusBar correctly', () => {
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
        it('should handle full configuration for production usage', () => {
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

        it('should handle configuration for development', () => {
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

        it('should detect issues with incorrect configuration', () => {
            const loadConfigurationStub = sandbox.stub(configManager as any, 'loadConfiguration');
            loadConfigurationStub.returns({
                whisper: {
                    apiKey: '', // Empty API key
                    language: 'auto', 
                    whisperModel: 'whisper-1',
                    prompt: '',
                    temperature: 2.0, // Invalid temperature
                    timeout: -1000, // Invalid timeout
                    maxRetries: -5 // Invalid retry
                },
                audio: {
                    audioQuality: 'standard',
                    ffmpegPath: '',
                    maxRecordingDuration: -10, // Invalid duration
                    silenceDetection: true,
                    silenceDuration: -1, // Invalid silence duration
                    silenceThreshold: 100, // Invalid threshold
                    inputDevice: 'auto'
                },
                ui: {
                    showStatusBar: true
                }
            });

            const validation = configManager.validateConfiguration();
            assert.ok(!validation.isValid, 'Incorrect configuration should be invalid');
            assert.ok(validation.errors.length > 0, 'There should be validation errors');
        });
    });

    describe('Configuration Persistence and Caching', () => {
        it('should cache configuration for performance', () => {
            const loadConfigurationStub = sandbox.stub(configManager as any, 'loadConfiguration');
            loadConfigurationStub.returns({
                whisper: { apiKey: 'test-key', language: 'auto', whisperModel: 'whisper-1', prompt: '', temperature: 0.1, timeout: 30000, maxRetries: 3 },
                audio: { audioQuality: 'standard', ffmpegPath: '', maxRecordingDuration: 60, silenceDetection: true, silenceDuration: 3, silenceThreshold: 50, inputDevice: 'auto' },
                ui: { showStatusBar: true }
            });

            // First call should load configuration
            const config1 = configManager.getConfiguration();
            
            // Second call should use cache
            const config2 = configManager.getConfiguration();
            
            // Check that loadConfiguration was called only once
            assert.strictEqual(loadConfigurationStub.callCount, 1, 'loadConfiguration should have been called only once');
            
            // Configurations should be identical (same object)
            assert.strictEqual(config1, config2, 'Configurations should be cached');
        });

        it('should invalidate cache when updating configuration', () => {
            const loadConfigurationStub = sandbox.stub(configManager as any, 'loadConfiguration');
            
            // First configuration
            loadConfigurationStub.returns({
                whisper: { apiKey: 'test-key', language: 'auto', whisperModel: 'whisper-1', prompt: '', temperature: 0.1, timeout: 30000, maxRetries: 3 },
                audio: { audioQuality: 'standard', ffmpegPath: '', maxRecordingDuration: 60, silenceDetection: true, silenceDuration: 3, silenceThreshold: 50, inputDevice: 'auto' },
                ui: { showStatusBar: true }
            });

            const config1 = configManager.getConfiguration();
            
            // Change configuration in mock
            loadConfigurationStub.returns({
                whisper: { apiKey: 'test-key', language: 'auto', whisperModel: 'whisper-1', prompt: '', temperature: 0.1, timeout: 30000, maxRetries: 3 },
                audio: { audioQuality: 'standard', ffmpegPath: '', maxRecordingDuration: 60, silenceDetection: true, silenceDuration: 3, silenceThreshold: 50, inputDevice: 'auto' },
                ui: { showStatusBar: true }
            });

            // Invalidate cache
            (configManager as any).invalidateCache();
            
            const config2 = configManager.getConfiguration();
            
            // Check that configuration is reloaded
            assert.strictEqual(loadConfigurationStub.callCount, 2, 'loadConfiguration should have been called twice');
        });
    });

    describe('Environment Simulation Tests', () => {
        it('should work in development environment', () => {
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

        it('should work in production environment', () => {
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

        it('should work in test environment', () => {
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

        it('should handle missing configuration', () => {
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
            assert.ok(!validation.isValid, 'Configuration without API key should be invalid');
        });

        it('should handle partially corrupted configuration', () => {
            const loadConfigurationStub = sandbox.stub(configManager as any, 'loadConfiguration');
            loadConfigurationStub.returns({
                whisper: {
                    apiKey: '',
                    language: 'auto', 
                    whisperModel: 'whisper-1',
                    prompt: '',
                    temperature: 5.0, // Invalid temperature
                    timeout: 30000,
                    maxRetries: 3
                },
                audio: {
                    audioQuality: 'standard',
                    ffmpegPath: '',
                    maxRecordingDuration: 60,
                    silenceDetection: true,
                    silenceDuration: 3,
                    silenceThreshold: 5, // Invalid threshold
                    inputDevice: 'auto'
                },
                ui: {
                    showStatusBar: true
                }
            });

            const validation = configManager.validateConfiguration();
            assert.ok(!validation.isValid, 'Configuration should be invalid');
            assert.ok(validation.errors.length > 0, 'There should be validation errors');
        });
    }); 

