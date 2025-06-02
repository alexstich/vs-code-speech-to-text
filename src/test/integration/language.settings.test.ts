import * as assert from 'assert';
import * as vscode from 'vscode';
import { WhisperClient } from '../../core/WhisperClient.js';

describe('Language Settings Integration Tests', () => {
    let originalFetch: typeof global.fetch;
    let lastRequestData: FormData | null = null;
    let extension: vscode.Extension<any> | undefined;

    before(async function() {
        this.timeout(30000);
        
        // Активируем расширение
        extension = vscode.extensions.getExtension('your-extension-id'); // Замените на реальный ID
        if (extension && !extension.isActive) {
            await extension.activate();
        }
    });

    beforeEach(() => {
        // Мокаем fetch для перехвата запросов к Whisper API
        originalFetch = global.fetch;
        lastRequestData = null;
        
        global.fetch = async (url: string | URL | Request, init?: RequestInit): Promise<Response> => {
            // Сохраняем данные запроса для анализа
            if (init?.body instanceof FormData) {
                lastRequestData = init.body;
            }

            // Возвращаем успешный ответ
            return new Response(JSON.stringify({ text: 'Test transcription result' }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        };
    });

    afterEach(async () => {
        // Восстанавливаем оригинальный fetch
        global.fetch = originalFetch;
        lastRequestData = null;
        
        // Сбрасываем конфигурацию к значениям по умолчанию
        const config = vscode.workspace.getConfiguration('speechToTextWhisper');
        await config.update('language', 'auto', vscode.ConfigurationTarget.Global);
        await config.update('prompt', '', vscode.ConfigurationTarget.Global);
        await config.update('temperature', 0.1, vscode.ConfigurationTarget.Global);
        await config.update('whisperModel', 'whisper-1', vscode.ConfigurationTarget.Global);
    });

    it('should use Russian language when configured', async function() {
        this.timeout(10000);
        
        // Устанавливаем русский язык в конфигурации
        const config = vscode.workspace.getConfiguration('speechToTextWhisper');
        await config.update('language', 'ru', vscode.ConfigurationTarget.Global);
        
        // Создаем WhisperClient и тестируем
        const whisperClient = new WhisperClient({
            apiKey: 'test-api-key',
            timeout: 5000
        });
        
        // Симулируем вызов из extension.ts
        const audioBlob = new Blob(['test audio data'], { type: 'audio/wav' });
        const language = config.get<string>('language', 'auto');
        const prompt = config.get<string>('prompt', '');
        const temperature = config.get<number>('temperature', 0.1);
        const whisperModel = config.get<string>('whisperModel', 'whisper-1');
        
        await whisperClient.transcribe(audioBlob, {
            language: language === 'auto' ? undefined : language,
            prompt: prompt || undefined,
            temperature: temperature,
            model: whisperModel,
            response_format: 'json'
        });

        assert.ok(lastRequestData, 'Request data should be captured');
        
        // Проверяем что русский язык передан в запрос
        const languageValue = lastRequestData!.get('language');
        assert.strictEqual(languageValue, 'ru', 'Language should be set to "ru"');
    });

    it('should not include language parameter when set to auto', async function() {
        this.timeout(10000);
        
        // Устанавливаем автоопределение языка
        const config = vscode.workspace.getConfiguration('speechToTextWhisper');
        await config.update('language', 'auto', vscode.ConfigurationTarget.Global);
        
        const whisperClient = new WhisperClient({
            apiKey: 'test-api-key',
            timeout: 5000
        });
        
        const audioBlob = new Blob(['test audio data'], { type: 'audio/wav' });
        const language = config.get<string>('language', 'auto');
        const prompt = config.get<string>('prompt', '');
        const temperature = config.get<number>('temperature', 0.1);
        const whisperModel = config.get<string>('whisperModel', 'whisper-1');
        
        await whisperClient.transcribe(audioBlob, {
            language: language === 'auto' ? undefined : language,
            prompt: prompt || undefined,
            temperature: temperature,
            model: whisperModel,
            response_format: 'json'
        });

        assert.ok(lastRequestData, 'Request data should be captured');
        
        // Проверяем что язык НЕ передан при auto
        const languageValue = lastRequestData!.get('language');
        assert.strictEqual(languageValue, null, 'Language should not be set when "auto"');
    });

    it('should include prompt when configured', async function() {
        this.timeout(10000);
        
        const testPrompt = 'This is a context prompt for better transcription accuracy';
        
        // Устанавливаем prompt в конфигурации
        const config = vscode.workspace.getConfiguration('speechToTextWhisper');
        await config.update('prompt', testPrompt, vscode.ConfigurationTarget.Global);
        
        const whisperClient = new WhisperClient({
            apiKey: 'test-api-key',
            timeout: 5000
        });
        
        const audioBlob = new Blob(['test audio data'], { type: 'audio/wav' });
        const language = config.get<string>('language', 'auto');
        const prompt = config.get<string>('prompt', '');
        const temperature = config.get<number>('temperature', 0.1);
        const whisperModel = config.get<string>('whisperModel', 'whisper-1');
        
        await whisperClient.transcribe(audioBlob, {
            language: language === 'auto' ? undefined : language,
            prompt: prompt || undefined,
            temperature: temperature,
            model: whisperModel,
            response_format: 'json'
        });

        assert.ok(lastRequestData, 'Request data should be captured');
        
        // Проверяем что prompt передан
        const promptValue = lastRequestData!.get('prompt');
        assert.strictEqual(promptValue, testPrompt, 'Prompt should be included');
    });

    it('should use custom temperature when configured', async function() {
        this.timeout(10000);
        
        const customTemperature = 0.7;
        
        // Устанавливаем температуру в конфигурации
        const config = vscode.workspace.getConfiguration('speechToTextWhisper');
        await config.update('temperature', customTemperature, vscode.ConfigurationTarget.Global);
        
        const whisperClient = new WhisperClient({
            apiKey: 'test-api-key',
            timeout: 5000
        });
        
        const audioBlob = new Blob(['test audio data'], { type: 'audio/wav' });
        const language = config.get<string>('language', 'auto');
        const prompt = config.get<string>('prompt', '');
        const temperature = config.get<number>('temperature', 0.1);
        const whisperModel = config.get<string>('whisperModel', 'whisper-1');
        
        await whisperClient.transcribe(audioBlob, {
            language: language === 'auto' ? undefined : language,
            prompt: prompt || undefined,
            temperature: temperature,
            model: whisperModel,
            response_format: 'json'
        });

        assert.ok(lastRequestData, 'Request data should be captured');
        
        // Проверяем что температура передана
        const temperatureValue = lastRequestData!.get('temperature');
        assert.strictEqual(temperatureValue, customTemperature.toString(), 'Temperature should be set correctly');
    });

    it('should test all supported languages', async function() {
        this.timeout(30000);
        
        const supportedLanguages = [
            'en', 'ru', 'es', 'fr', 'de', 'it', 'pt', 'zh', 'ja', 'ko', 'ar',
            'bg', 'ca', 'cs', 'da', 'el', 'et', 'fi', 'he', 'hi', 'hr', 'hu',
            'is', 'id', 'lv', 'lt', 'mk', 'ms', 'mt', 'nl', 'no', 'pl', 'ro',
            'sk', 'sl', 'sr', 'sv', 'th', 'tr', 'uk', 'vi'
        ];
        
        const config = vscode.workspace.getConfiguration('speechToTextWhisper');
        const whisperClient = new WhisperClient({
            apiKey: 'test-api-key',
            timeout: 5000
        });
        
        for (const lang of supportedLanguages) {
            // Устанавливаем язык
            await config.update('language', lang, vscode.ConfigurationTarget.Global);
            
            const audioBlob = new Blob(['test audio data'], { type: 'audio/wav' });
            const language = config.get<string>('language', 'auto');
            const prompt = config.get<string>('prompt', '');
            const temperature = config.get<number>('temperature', 0.1);
            const whisperModel = config.get<string>('whisperModel', 'whisper-1');
            
            await whisperClient.transcribe(audioBlob, {
                language: language === 'auto' ? undefined : language,
                prompt: prompt || undefined,
                temperature: temperature,
                model: whisperModel,
                response_format: 'json'
            });

            assert.ok(lastRequestData, `Request data should be captured for language ${lang}`);
            
            const languageValue = lastRequestData!.get('language');
            assert.strictEqual(languageValue, lang, `Language should be set to "${lang}"`);
        }
    });

    it('should handle configuration changes dynamically', async function() {
        this.timeout(15000);
        
        const config = vscode.workspace.getConfiguration('speechToTextWhisper');
        const whisperClient = new WhisperClient({
            apiKey: 'test-api-key',
            timeout: 5000
        });
        
        // Тест 1: Английский язык
        await config.update('language', 'en', vscode.ConfigurationTarget.Global);
        
        let audioBlob = new Blob(['test audio data'], { type: 'audio/wav' });
        let language = config.get<string>('language', 'auto');
        
        await whisperClient.transcribe(audioBlob, {
            language: language === 'auto' ? undefined : language,
            response_format: 'json'
        });
        
        assert.strictEqual(lastRequestData!.get('language'), 'en', 'First request should use English');
        
        // Тест 2: Изменяем на русский
        await config.update('language', 'ru', vscode.ConfigurationTarget.Global);
        
        audioBlob = new Blob(['test audio data 2'], { type: 'audio/wav' });
        language = config.get<string>('language', 'auto');
        
        await whisperClient.transcribe(audioBlob, {
            language: language === 'auto' ? undefined : language,
            response_format: 'json'
        });
        
        assert.strictEqual(lastRequestData!.get('language'), 'ru', 'Second request should use Russian');
        
        // Тест 3: Изменяем на auto
        await config.update('language', 'auto', vscode.ConfigurationTarget.Global);
        
        audioBlob = new Blob(['test audio data 3'], { type: 'audio/wav' });
        language = config.get<string>('language', 'auto');
        
        await whisperClient.transcribe(audioBlob, {
            language: language === 'auto' ? undefined : language,
            response_format: 'json'
        });
        
        assert.strictEqual(lastRequestData!.get('language'), null, 'Third request should not include language (auto)');
    });
});

describe('Configuration Validation Tests', () => {
    it('should validate language configuration options', async () => {
        const config = vscode.workspace.getConfiguration('speechToTextWhisper');
        
        // Получаем схему конфигурации
        const languageProperty = vscode.workspace.getConfiguration().inspect('speechToTextWhisper.language');
        
        assert.ok(languageProperty, 'Language property should be defined in configuration schema');
        
        // Проверяем что значение по умолчанию - 'auto'
        const defaultLanguage = config.get<string>('language');
        assert.ok(['auto', 'en', 'ru'].includes(defaultLanguage || 'auto'), 'Default language should be valid');
    });

    it('should validate temperature range', async () => {
        const config = vscode.workspace.getConfiguration('speechToTextWhisper');
        
        // Проверяем что температура в допустимом диапазоне
        const temperature = config.get<number>('temperature', 0.1);
        assert.ok(temperature >= 0 && temperature <= 1, 'Temperature should be between 0 and 1');
    });

    it('should validate whisper model', async () => {
        const config = vscode.workspace.getConfiguration('speechToTextWhisper');
        
        // Проверяем что модель валидна
        const model = config.get<string>('whisperModel', 'whisper-1');
        assert.strictEqual(model, 'whisper-1', 'Default model should be whisper-1');
    });
}); 