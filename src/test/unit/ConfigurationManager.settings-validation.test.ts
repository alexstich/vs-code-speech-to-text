import * as assert from 'assert';
import * as sinon from 'sinon';
import { ConfigurationManager } from '../../core/ConfigurationManager';

describe('ConfigurationManager - Settings Validation Tests', () => {
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

    describe('API Key Validation', () => {
        it('should accept a valid API key', () => {
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
            assert.ok(validation.isValid, 'Valid API key should pass validation');
            assert.strictEqual(validation.errors.length, 0, 'There should be no errors for a valid API key');
        });

        it('should reject empty API key', () => {
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
            assert.ok(validation.errors.some(err => err.includes('API key')), 'There should be an error for API key');
        });

        it('should accept short API key (only checks for emptiness)', () => {
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
            assert.ok(validation.isValid, 'Short but non-empty API key should be valid');
            assert.strictEqual(validation.errors.length, 0, 'There should be no errors for a non-empty API key');
        });
    });

    describe('Temperature Validation', () => {
        it('should accept valid temperature values - boundary cases', () => {
            // Test minimal value (0.0)
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
            assert.ok(validation.isValid, 'Temperature 0.0 should be valid');

            // Test maximal value (1.0)
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
            assert.ok(validation.isValid, 'Temperature 1.0 should be valid');
        });

        it('should reject invalid temperature values', () => {
            // Test value above maximum
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
            assert.ok(!validation.isValid, 'Temperature 1.5 should be invalid');
            assert.ok(validation.errors.some(err => err.includes('Temperature')), 'There should be an error for temperature 1.5');

            // Test negative value
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
            assert.ok(!validation.isValid, 'Temperature -0.1 should be invalid');
            assert.ok(validation.errors.some(err => err.includes('Temperature')), 'There should be an error for temperature -0.1');
        });
    });

    describe('Timeout Validation', () => {
        it('should accept valid timeout values', () => {
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
            assert.ok(validation.isValid, 'Timeout 30000 should be valid');
        });

        it('should reject invalid timeout values', () => {
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
            assert.ok(!validation.isValid, 'Timeout 0 should be invalid');
            assert.ok(validation.errors.some(err => err.includes('Timeout')), 'There should be an error for timeout 0');
        });
    });

    describe('Silence Threshold Validation', () => {
        it('should accept valid silenceThreshold values (20-80)', () => {
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
            assert.ok(validation.isValid, 'Silence threshold 50 should be valid');

            // Test boundary values
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
                    silenceThreshold: 20, // Minimum
                    inputDevice: 'auto'
                },
                ui: {
                    showStatusBar: true
                }
            });

            (configManager as any).invalidateCache();
            validation = configManager.validateConfiguration();
            assert.ok(validation.isValid, 'Silence threshold 20 should be valid');

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
                    silenceThreshold: 80, // Maximum
                    inputDevice: 'auto'
                },
                ui: {
                    showStatusBar: true
                }
            });

            (configManager as any).invalidateCache();
            validation = configManager.validateConfiguration();
            assert.ok(validation.isValid, 'Silence threshold 80 should be valid');
        });

        it('should reject invalid silenceThreshold values', () => {
            // Below minimum
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
            assert.ok(!validation.isValid, 'Silence threshold 15 should be invalid');
            assert.ok(validation.errors.some(err => err.includes('Silence threshold')), 'There should be an error for silence threshold 15');

            // Above maximum
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
            assert.ok(!validation.isValid, 'Silence threshold 85 should be invalid');
            assert.ok(validation.errors.some(err => err.includes('Silence threshold')), 'There should be an error for silence threshold 85');
        });
    });

    describe('Max Retries Validation', () => {
        it('should accept valid maxRetries values (non-negative)', () => {
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
            assert.ok(validation.isValid, 'Max retries 5 should be valid');

            // Test zero value
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
            assert.ok(validation.isValid, 'Max retries 0 should be valid');
        });

        it('should reject negative maxRetries values', () => {
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
            assert.ok(!validation.isValid, 'Max retries -1 should be invalid');
            assert.ok(validation.errors.some(err => err.includes('Max retries')), 'There should be an error for max retries -1');
        });
    });

    describe('Combined Validation Tests', () => {
        it('should handle multiple validation errors', () => {
            const loadConfigurationStub = sandbox.stub(configManager as any, 'loadConfiguration');
            loadConfigurationStub.returns({
                whisper: {
                    apiKey: '', // Empty API key
                    language: 'auto', 
                    whisperModel: 'whisper-1',
                    prompt: '',
                    temperature: 2.0, // Invalid temperature
                    timeout: -1000, // Invalid timeout
                    maxRetries: -5 // Invalid retries
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
            assert.ok(!validation.isValid, 'Configuration with multiple errors should be invalid');
            assert.ok(validation.errors.length > 1, 'There should be multiple validation errors');
            
            // Check that there are errors for each category
            const errorText = validation.errors.join(' ');
            assert.ok(errorText.includes('API key'), 'There should be an error for API key');
            assert.ok(errorText.includes('Temperature'), 'There should be an error for temperature');
            assert.ok(errorText.includes('Timeout'), 'There should be an error for timeout');
        });

        it('should pass validation with correct settings', () => {
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
            assert.ok(validation.isValid, 'Correct configuration should pass validation');
            assert.strictEqual(validation.errors.length, 0, 'There should be no errors for correct configuration');
        });
    });
}); 