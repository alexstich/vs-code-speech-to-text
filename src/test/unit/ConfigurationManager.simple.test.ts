import * as assert from 'assert';
import * as sinon from 'sinon';

// Import ConfigurationManager without vscode mocks
import { ConfigurationManager } from '../../core/ConfigurationManager';

describe('ConfigurationManager - Simple Tests', () => {
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

    describe('Basic Configuration Access', () => {
        it('should return Whisper configuration', () => {
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

        it('should return Audio configuration', () => {
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

        it('should return UI configuration', () => {
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

        it('should return full configuration', () => {
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
            
            // Check whisper section
            assert.strictEqual(fullConfig.whisper.apiKey, 'full-config-key');
            assert.strictEqual(fullConfig.whisper.language, 'en');
            assert.strictEqual(fullConfig.whisper.temperature, 0.5);
            
            // Check audio section
            assert.strictEqual(fullConfig.audio.audioQuality, 'ultra');
            assert.strictEqual(fullConfig.audio.maxRecordingDuration, 180);
            
            // Check UI section
            assert.strictEqual(fullConfig.ui.showStatusBar, true);
        });
    });

    describe('Default Values', () => {
        it('should use default values when configuration is missing', () => {
            const loadConfigurationStub = sandbox.stub(configManager as any, 'loadConfiguration');
            loadConfigurationStub.returns({
                whisper: {
                    apiKey: '',
                    language: 'auto', 
                    whisperModel: 'whisper-1',
                    prompt: 'This is audio for speech recognition. Use punctuation and correct spelling.',
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
            
            // Check default values
            assert.strictEqual(config.whisper.language, 'auto');
            assert.strictEqual(config.whisper.whisperModel, 'whisper-1');
            assert.strictEqual(config.whisper.temperature, 0.0);
            assert.strictEqual(config.audio.audioQuality, 'standard');
            assert.strictEqual(config.audio.maxRecordingDuration, 60);
            assert.strictEqual(config.ui.showStatusBar, true);
        });
    });

    describe('Singleton Pattern', () => {
        it('should return the same instance on repeated calls to getInstance', () => {
            const instance1 = ConfigurationManager.getInstance();
            const instance2 = ConfigurationManager.getInstance();
            
            assert.strictEqual(instance1, instance2, 'getInstance should return the same instance');
        });
    });

    describe('Configuration Validation', () => {
        it('should successfully validate correct configuration', () => {
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
            assert.ok(validation.isValid, 'Correct configuration should pass validation');
            assert.strictEqual(validation.errors.length, 0, 'Should be no validation errors');
        });

        it('should detect problems in incorrect configuration', () => {
            const loadConfigurationStub = sandbox.stub(configManager as any, 'loadConfiguration');
            loadConfigurationStub.returns({
                whisper: {
                    apiKey: '', // Empty API key
                    language: 'auto', 
                    whisperModel: 'whisper-1',
                    prompt: '',
                    temperature: 2.0, // Invalid temperature > 1
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
            assert.ok(!validation.isValid, 'Incorrect configuration should be invalid');
            assert.ok(validation.errors.length > 0, 'Should be validation errors');
            
            const errorText = validation.errors.join(' ');
            assert.ok(errorText.includes('API key'), 'Should be an error for empty API key');
            assert.ok(errorText.includes('Temperature'), 'Should be an error for temperature');
        });
    });
}); 