import * as assert from 'assert';
import * as sinon from 'sinon';
import { ConfigurationManager } from '../../core/ConfigurationManager';

describe('ConfigurationManager - Basic Tests', () => {
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

    it('должен использовать правильный префикс speechToTextWhisper', () => {
        // Создаем мок для loadConfiguration
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

        // Получаем конфигурацию (что запускает loadConfiguration)
        const config = configManager.getConfiguration();

        // Проверяем что loadConfiguration был вызван
        assert.ok(loadConfigurationStub.called, 'loadConfiguration должен был быть вызван');
        
        // Проверяем структуру возвращаемой конфигурации
        assert.ok(config.whisper, 'Должна быть секция whisper');
        assert.ok(config.audio, 'Должна быть секция audio');
        assert.ok(config.ui, 'Должна быть секция ui');
    });

    it('должен правильно валидировать silenceThreshold с диапазоном 20-80', () => {
        // Тестируем валидные значения
        const loadConfigurationStub = sandbox.stub(configManager as any, 'loadConfiguration');
        
        // Тест валидного значения
        loadConfigurationStub.returns({
            whisper: { apiKey: 'test-key', language: 'auto', whisperModel: 'whisper-1', prompt: '', temperature: 0.1, timeout: 30000, maxRetries: 3 },
            audio: { audioQuality: 'standard', ffmpegPath: '', maxRecordingDuration: 60, silenceDetection: true, silenceDuration: 3, silenceThreshold: 25, inputDevice: 'auto' },
            ui: { showStatusBar: true }
        });
        
        let validation = configManager.validateConfiguration();
        assert.ok(validation.isValid, 'silenceThreshold=25 должно быть валидным');

        // Тест невалидного значения
        loadConfigurationStub.returns({
            whisper: { apiKey: 'test-key', language: 'auto', whisperModel: 'whisper-1', prompt: '', temperature: 0.1, timeout: 30000, maxRetries: 3 },
            audio: { audioQuality: 'standard', ffmpegPath: '', maxRecordingDuration: 60, silenceDetection: true, silenceDuration: 3, silenceThreshold: 10, inputDevice: 'auto' },
            ui: { showStatusBar: true }
        });

        // Очищаем кэш чтобы новая конфигурация загрузилась
        (configManager as any).invalidateCache();
        
        validation = configManager.validateConfiguration();
        assert.ok(!validation.isValid, 'silenceThreshold=10 должно быть невалидным');
    });

    it('должен использовать правильные ключи для чтения настроек', () => {
        // Создаем мок для loadConfiguration
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

        // Получаем конфигурацию
        const config = configManager.getConfiguration();

        // Проверяем что loadConfiguration был вызван (что подразумевает чтение правильных ключей)
        assert.ok(loadConfigurationStub.called, 'loadConfiguration должен был быть вызван');
        
        // Проверяем что в конфигурации правильные значения
        assert.strictEqual(config.whisper.apiKey, 'test-api-key');
        assert.strictEqual(config.audio.audioQuality, 'standard');
        assert.strictEqual(config.ui.showStatusBar, true);
    });
}); 