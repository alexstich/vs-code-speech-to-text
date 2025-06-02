import * as assert from 'assert';
import * as sinon from 'sinon';

// Импортируем ConfigurationManager без моков vscode
import { ConfigurationManager } from '../../core/ConfigurationManager';

describe('ConfigurationManager - Working Tests', () => {
    let configManager: ConfigurationManager;
    let sandbox: sinon.SinonSandbox;

    beforeEach(() => {
        // Создаем песочницу sinon
        sandbox = sinon.createSandbox();
        
        // Сбрасываем синглтон
        (ConfigurationManager as any).instance = null;
        
        // Создаем новый экземпляр
        configManager = ConfigurationManager.getInstance();
        
        // Мокаем методы VS Code напрямую через приватные методы
        const loadConfigurationStub = sandbox.stub(configManager as any, 'loadConfiguration');
        
        // Возвращаем нашу тестовую конфигурацию
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

    it('должен возвращать замоканную конфигурацию', () => {
        console.log('🧪 Test: должен возвращать замоканную конфигурацию');
        
        const config = configManager.getConfiguration();
        
        // Проверяем что конфигурация имеет правильную структуру
        assert.ok(config.whisper, 'Должна быть секция whisper');
        assert.ok(config.audio, 'Должна быть секция audio');
        assert.ok(config.ui, 'Должна быть секция ui');

        // Проверяем значения из нашего мока
        console.log('🔍 Actual apiKey:', config.whisper.apiKey);
        assert.strictEqual(config.whisper.apiKey, 'test-api-key');
        assert.strictEqual(config.whisper.language, 'auto');
        assert.strictEqual(config.whisper.whisperModel, 'whisper-1');
        assert.strictEqual(config.audio.audioQuality, 'standard');
        assert.strictEqual(config.ui.showStatusBar, true);
    });

    it('должен возвращать отдельные секции конфигурации', () => {
        console.log('🧪 Test: должен возвращать отдельные секции конфигурации');
        
        const whisperConfig = configManager.getWhisperConfiguration();
        const audioConfig = configManager.getAudioConfiguration();
        const uiConfig = configManager.getUIConfiguration();

        // Проверяем что возвращаются правильные секции
        assert.strictEqual(whisperConfig.apiKey, 'test-api-key');
        assert.strictEqual(whisperConfig.language, 'auto');
        assert.strictEqual(audioConfig.audioQuality, 'standard');
        assert.strictEqual(uiConfig.showStatusBar, true);
    });

    it('должен валидировать корректную конфигурацию', () => {
        console.log('🧪 Test: должен валидировать корректную конфигурацию');
        
        const validation = configManager.validateConfiguration();
        console.log('🔍 Validation result:', validation);
        
        // У нас есть валидный API key, поэтому должно быть валидно
        assert.ok(validation.isValid, 'Конфигурация должна быть валидной');
        assert.strictEqual(validation.errors.length, 0, 'Не должно быть ошибок валидации');
    });

    it('должен работать с кэшем конфигурации', () => {
        console.log('🧪 Test: должен работать с кэшем конфигурации');
        
        // Первый вызов загружает конфигурацию
        const config1 = configManager.getConfiguration();
        
        // Второй вызов должен использовать кэш
        const config2 = configManager.getConfiguration();
        
        // Они должны быть одинаковыми (тот же объект)
        assert.strictEqual(config1, config2, 'Конфигурация должна кэшироваться');
        
        // Очищаем кэш
        (configManager as any).invalidateCache();
        
        // Изменяем существующий стаб чтобы он возвращал новые данные
        const loadConfigurationStub = (configManager as any).loadConfiguration;
        loadConfigurationStub.returns({
            whisper: {
                apiKey: 'test-api-key-2', // Изменяем значение
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
        
        // Теперь должен быть новый объект с новыми значениями
        const config3 = configManager.getConfiguration();
        assert.notStrictEqual(config1, config3, 'После очистки кэша должен быть новый объект');
        
        // И значения должны отличаться
        assert.strictEqual(config3.whisper.apiKey, 'test-api-key-2');
        assert.notStrictEqual(config1.whisper.apiKey, config3.whisper.apiKey, 'Значения должны отличаться');
    });

    it('должен управлять слушателями изменений', () => {
        console.log('🧪 Test: должен управлять слушателями изменений');
        
        const listener1 = sandbox.spy();
        const listener2 = sandbox.spy();
        
        // Добавляем слушателей
        configManager.addChangeListener(listener1);
        configManager.addChangeListener(listener2);
        
        // Имитируем изменение конфигурации
        (configManager as any).notifyListeners();
        
        // Проверяем что оба слушателя были вызваны
        assert.ok(listener1.called, 'Первый слушатель должен был быть вызван');
        assert.ok(listener2.called, 'Второй слушатель должен был быть вызван');
        
        // Удаляем одного слушателя
        configManager.removeChangeListener(listener1);
        
        // Сбрасываем spy
        listener1.resetHistory();
        listener2.resetHistory();
        
        // Имитируем новое изменение
        (configManager as any).notifyListeners();
        
        // Проверяем что только второй слушатель был вызван
        assert.ok(!listener1.called, 'Первый слушатель не должен был быть вызван');
        assert.ok(listener2.called, 'Второй слушатель должен был быть вызван');
    });
}); 