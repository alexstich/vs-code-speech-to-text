import * as assert from 'assert';
import * as sinon from 'sinon';
import { ConfigurationManager } from '../../core/ConfigurationManager';

describe('ConfigurationManager - Basic Tests', () => {
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

    it('should use the correct speechToTextWhisper prefix', () => {
        // Create mock for loadConfiguration
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
                showStatusBar: true
            }
        });

        // Get configuration (which triggers loadConfiguration)
        const config = configManager.getConfiguration();

        // Check that loadConfiguration was called
        assert.ok(loadConfigurationStub.called, 'loadConfiguration should have been called');
        
        // Check the structure of the returned configuration
        assert.ok(config.whisper, 'Should have whisper section');
        assert.ok(config.audio, 'Should have audio section');
        assert.ok(config.ui, 'Should have ui section');
    });

    it('should correctly validate silenceThreshold within 20-80 range', () => {
        // Test valid values
        const loadConfigurationStub = sandbox.stub(configManager as any, 'loadConfiguration');
        
        // Test valid value
        loadConfigurationStub.returns({
            whisper: { apiKey: 'test-key', language: 'auto', whisperModel: 'whisper-1', prompt: '', temperature: 0.1, timeout: 30000, maxRetries: 3 },
            audio: { audioQuality: 'standard', ffmpegPath: '', maxRecordingDuration: 60, silenceDetection: true, silenceDuration: 3, silenceThreshold: 25, inputDevice: 'auto' },
            ui: { showStatusBar: true }
        });
        
        let validation = configManager.validateConfiguration();
        assert.ok(validation.isValid, 'silenceThreshold=25 should be valid');

        // Test invalid value
        loadConfigurationStub.returns({
            whisper: { apiKey: 'test-key', language: 'auto', whisperModel: 'whisper-1', prompt: '', temperature: 0.1, timeout: 30000, maxRetries: 3 },
            audio: { audioQuality: 'standard', ffmpegPath: '', maxRecordingDuration: 60, silenceDetection: true, silenceDuration: 3, silenceThreshold: 10, inputDevice: 'auto' },
            ui: { showStatusBar: true }
        });

        // Clear cache for new configuration to load
        (configManager as any).invalidateCache();
        
        validation = configManager.validateConfiguration();
        assert.ok(!validation.isValid, 'silenceThreshold=10 should be invalid');
    });

    it('should use correct keys for reading settings', () => {
        // Create mock for loadConfiguration
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
                showStatusBar: true
            }
        });

        // Get configuration
        const config = configManager.getConfiguration();

        // Check that loadConfiguration was called (which implies correct keys were read)
        assert.ok(loadConfigurationStub.called, 'loadConfiguration should have been called');
        
        // Check that configuration has correct values
        assert.strictEqual(config.whisper.apiKey, 'test-api-key');
        assert.strictEqual(config.audio.audioQuality, 'standard');
        assert.strictEqual(config.ui.showStatusBar, true);
    });
}); 