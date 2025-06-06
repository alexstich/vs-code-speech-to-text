import * as assert from 'assert';
import * as sinon from 'sinon';

// Import ConfigurationManager without mocking vscode
import { ConfigurationManager } from '../../core/ConfigurationManager';

describe('ConfigurationManager - Working Tests', () => {
    let configManager: ConfigurationManager;
    let sandbox: sinon.SinonSandbox;

    beforeEach(() => {
        // Create sinon sandbox
        sandbox = sinon.createSandbox();
        
        // Reset singleton
        (ConfigurationManager as any).instance = null;
        
        // Create new instance
        configManager = ConfigurationManager.getInstance();
        
        // Mock VS Code methods directly through private methods
        const loadConfigurationStub = sandbox.stub(configManager as any, 'loadConfiguration');
        
        // Return our test configuration
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
    });

    afterEach(() => {
        configManager.dispose();
        sandbox.restore();
    });

    it('should return mocked configuration', () => {
        console.log('🧪 Test: should return mocked configuration');
        
        const config = configManager.getConfiguration();
        
        // Check that configuration has the correct structure
        assert.ok(config.whisper, 'Whisper section should exist');
        assert.ok(config.audio, 'Audio section should exist');
        assert.ok(config.ui, 'UI section should exist');

        // Check values from our mock
        console.log('🔍 Actual apiKey:', config.whisper.apiKey);
        assert.strictEqual(config.whisper.apiKey, 'test-api-key');
        assert.strictEqual(config.whisper.language, 'auto');
        assert.strictEqual(config.whisper.whisperModel, 'whisper-1');
        assert.strictEqual(config.audio.audioQuality, 'standard');
        assert.strictEqual(config.ui.showStatusBar, true);
    });

    it('should return individual configuration sections', () => {
        console.log('🧪 Test: should return individual configuration sections');
        
        const whisperConfig = configManager.getWhisperConfiguration();
        const audioConfig = configManager.getAudioConfiguration();
        const uiConfig = configManager.getUIConfiguration();

        // Check that the correct sections are returned
        assert.strictEqual(whisperConfig.apiKey, 'test-api-key');
        assert.strictEqual(whisperConfig.language, 'auto');
        assert.strictEqual(audioConfig.audioQuality, 'standard');
        assert.strictEqual(uiConfig.showStatusBar, true);
    });

    it('should validate a valid configuration', () => {
        console.log('🧪 Test: should validate a valid configuration');
        
        const validation = configManager.validateConfiguration();
        console.log('🔍 Validation result:', validation);
        
        // We have a valid API key, so it should be valid
        assert.ok(validation.isValid, 'Configuration should be valid');
        assert.strictEqual(validation.errors.length, 0, 'There should be no validation errors');
    });

    it('should work with configuration cache', () => {
        console.log('🧪 Test: should work with configuration cache');
        
        // First call loads the configuration
        const config1 = configManager.getConfiguration();
        
        // Second call should use cache
        const config2 = configManager.getConfiguration();
        
        // They should be the same (same object)
        assert.strictEqual(config1, config2, 'Configuration should be cached');
        
        // Clear cache
        (configManager as any).invalidateCache();
        
        // Change existing stub to return new data
        const loadConfigurationStub = (configManager as any).loadConfiguration;
        loadConfigurationStub.returns({
            whisper: {
                apiKey: 'test-api-key-2', // Change value
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
        
        // Now it should be a new object with new values
        const config3 = configManager.getConfiguration();
        assert.notStrictEqual(config1, config3, 'After clearing cache, there should be a new object');
        
        // And values should be different
        assert.strictEqual(config3.whisper.apiKey, 'test-api-key-2');
        assert.notStrictEqual(config1.whisper.apiKey, config3.whisper.apiKey, 'Values should be different');
    });

    it('should manage change listeners', () => {
        console.log('🧪 Test: should manage change listeners');
        
        const listener1 = sandbox.spy();
        const listener2 = sandbox.spy();
        
        // Add listeners
        configManager.addChangeListener(listener1);
        configManager.addChangeListener(listener2);
        
        // Simulate configuration change
        (configManager as any).notifyListeners();
        
        // Check that both listeners were called
        assert.ok(listener1.called, 'First listener should have been called');
        assert.ok(listener2.called, 'Second listener should have been called');
        
        // Remove one listener
        configManager.removeChangeListener(listener1);
        
        // Reset spy
        listener1.resetHistory();
        listener2.resetHistory();
        
        // Simulate new change
        (configManager as any).notifyListeners();
        
        // Check that only the second listener was called
        assert.ok(!listener1.called, 'First listener should not have been called');
        assert.ok(listener2.called, 'Second listener should have been called');
    });
}); 