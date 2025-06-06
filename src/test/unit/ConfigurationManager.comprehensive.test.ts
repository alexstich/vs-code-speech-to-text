import * as assert from 'assert';
import * as sinon from 'sinon';
import { ConfigurationManager, WhisperConfiguration, AudioConfiguration, UIConfiguration, FullConfiguration } from '../../core/ConfigurationManager';

describe('ConfigurationManager - Comprehensive Settings Tests', () => {
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

    describe('Whisper Configuration Tests', () => {
        it('should handle valid API key', () => {
            // Create mock for loadConfiguration with a valid API key
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
            // Create mock for loadConfiguration with an empty API key
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
            assert.ok(!validation.isValid, 'Empty API key should be invalid');
            assert.ok(validation.errors.some(err => err.includes('API key')), 'Should be an error for API key');
        });

        it('should handle temperature bounds', () => {
            // Test valid temperature
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
            assert.ok(validation.isValid, 'Temperature 0.5 should be valid');

            // Test invalid temperature
            loadConfigurationStub.returns({
                whisper: {
                    apiKey: 'test-key',
                    language: 'auto', 
                    whisperModel: 'whisper-1',
                    prompt: '',
                    temperature: 1.5, // Invalid value
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

            // Clear cache for new configuration to load
            (configManager as any).invalidateCache();
            
            validation = configManager.validateConfiguration();
            assert.ok(!validation.isValid, 'Temperature 1.5 should be invalid');
            assert.ok(validation.errors.some(err => err.includes('Temperature')), 'Should be an error for temperature');
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
            
            // Test valid value (in 20-80 range)
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
            assert.ok(validation.isValid, 'silenceThreshold=30 should be valid');

            // Test invalid value (outside range)
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
                    silenceThreshold: 10, // Too low
                    inputDevice: 'auto'
                },
                ui: {
                    showStatusBar: true
                }
            });

            // Clear cache for new configuration to load
            (configManager as any).invalidateCache();

            validation = configManager.validateConfiguration();
            assert.ok(!validation.isValid, 'silenceThreshold=10 should be invalid');
            assert.ok(validation.errors.some(err => err.includes('Silence threshold')), 'Should be an error for silenceThreshold');
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

            // Check whisper configuration
            assert.strictEqual(whisperConfig.apiKey, 'section-test-key');
            assert.strictEqual(whisperConfig.language, 'ru');
            assert.strictEqual(whisperConfig.temperature, 0.3);

            // Check audio configuration
            assert.strictEqual(audioConfig.audioQuality, 'ultra');
            assert.strictEqual(audioConfig.maxRecordingDuration, 120);
            assert.strictEqual(audioConfig.silenceDetection, false);

            // Check ui configuration
            assert.strictEqual(uiConfig.showStatusBar, false);
        });
    });
});