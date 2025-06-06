import * as assert from 'assert';
import { WhisperClient } from '../../core/WhisperClient.js';

describe('WhisperClient Language Settings Tests', () => {
    let whisperClient: WhisperClient;
    let originalFetch: typeof global.fetch;
    let lastRequestData: FormData | null = null;

    beforeEach(() => {
        // Create mock for fetch
        originalFetch = global.fetch;
        global.fetch = async (url: string | URL | Request, init?: RequestInit): Promise<Response> => {
            // Save request data for analysis
            if (init?.body instanceof FormData) {
                lastRequestData = init.body;
            }

            // Return a successful response
            return new Response(JSON.stringify({ text: 'Test transcription result' }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        };

        whisperClient = new WhisperClient({
            apiKey: 'test-api-key',
            timeout: 5000
        });
    });

    afterEach(() => {
        global.fetch = originalFetch;
        lastRequestData = null;
    });

    it('should include language parameter when language is specified', async () => {
        const audioBlob = new Blob(['test audio data'], { type: 'audio/wav' });
        
        await whisperClient.transcribe(audioBlob, {
            language: 'ru'
        });

        assert.ok(lastRequestData, 'Request data should be captured');
        
        // Check that language is passed in FormData
        const languageValue = lastRequestData!.get('language');
        assert.strictEqual(languageValue, 'ru', 'Language should be set to "ru"');
    });

    it('should not include language parameter when language is "auto"', async () => {
        const audioBlob = new Blob(['test audio data'], { type: 'audio/wav' });
        
        await whisperClient.transcribe(audioBlob, {
            language: 'auto'
        });

        assert.ok(lastRequestData, 'Request data should be captured');
        
        // Check that language is NOT passed in FormData when auto
        const languageValue = lastRequestData!.get('language');
        assert.strictEqual(languageValue, null, 'Language should not be set when "auto"');
    });

    it('should not include language parameter when language is undefined', async () => {
        const audioBlob = new Blob(['test audio data'], { type: 'audio/wav' });
        
        await whisperClient.transcribe(audioBlob, {
            // language is not specified
        });

        assert.ok(lastRequestData, 'Request data should be captured');
        
        // Check that language is NOT passed in FormData
        const languageValue = lastRequestData!.get('language');
        assert.strictEqual(languageValue, null, 'Language should not be set when undefined');
    });

    it('should include all transcription options correctly', async () => {
        const audioBlob = new Blob(['test audio data'], { type: 'audio/wav' });
        
        await whisperClient.transcribe(audioBlob, {
            language: 'en',
            prompt: 'This is a test prompt',
            temperature: 0.5,
            model: 'whisper-1',
            response_format: 'json'
        });

        assert.ok(lastRequestData, 'Request data should be captured');
        
        // Check all parameters
        assert.strictEqual(lastRequestData!.get('language'), 'en', 'Language should be "en"');
        assert.strictEqual(lastRequestData!.get('prompt'), 'This is a test prompt', 'Prompt should be set');
        assert.strictEqual(lastRequestData!.get('temperature'), '0.5', 'Temperature should be "0.5"');
        assert.strictEqual(lastRequestData!.get('model'), 'whisper-1', 'Model should be "whisper-1"');
        assert.strictEqual(lastRequestData!.get('response_format'), 'json', 'Response format should be "json"');
    });

    it('should handle different language codes correctly', async () => {
        const audioBlob = new Blob(['test audio data'], { type: 'audio/wav' });
        const testLanguages = ['en', 'ru', 'es', 'fr', 'de', 'zh', 'ja'];
        
        for (const lang of testLanguages) {
            await whisperClient.transcribe(audioBlob, {
                language: lang
            });

            assert.ok(lastRequestData, `Request data should be captured for language ${lang}`);
            
            const languageValue = lastRequestData!.get('language');
            assert.strictEqual(languageValue, lang, `Language should be set to "${lang}"`);
        }
    });

    it('should not include empty prompt', async () => {
        const audioBlob = new Blob(['test audio data'], { type: 'audio/wav' });
        
        await whisperClient.transcribe(audioBlob, {
            language: 'en',
            prompt: '' // Empty prompt
        });

        assert.ok(lastRequestData, 'Request data should be captured');
        
        // Check that empty prompt is NOT passed
        const promptValue = lastRequestData!.get('prompt');
        assert.strictEqual(promptValue, null, 'Empty prompt should not be included');
    });

    it('should include non-empty prompt', async () => {
        const audioBlob = new Blob(['test audio data'], { type: 'audio/wav' });
        const testPrompt = 'This is a context prompt for better transcription';
        
        await whisperClient.transcribe(audioBlob, {
            language: 'en',
            prompt: testPrompt
        });

        assert.ok(lastRequestData, 'Request data should be captured');
        
        // Check that prompt is passed
        const promptValue = lastRequestData!.get('prompt');
        assert.strictEqual(promptValue, testPrompt, 'Prompt should be included');
    });

    it('should use default values when options are not provided', async () => {
        const audioBlob = new Blob(['test audio data'], { type: 'audio/wav' });
        
        await whisperClient.transcribe(audioBlob); // No options

        assert.ok(lastRequestData, 'Request data should be captured');
        
        // Check default values
        assert.strictEqual(lastRequestData!.get('model'), 'whisper-1', 'Default model should be "whisper-1"');
        assert.strictEqual(lastRequestData!.get('temperature'), '0', 'Default temperature should be "0"');
        assert.strictEqual(lastRequestData!.get('language'), null, 'Language should not be set by default');
        assert.strictEqual(lastRequestData!.get('prompt'), null, 'Prompt should not be set by default');
    });
});

describe('WhisperClient Configuration Integration Tests', () => {
    it('should validate API key format', () => {
        // API key validation test
        assert.strictEqual(WhisperClient.validateApiKey('sk-1234567890123456789012345678901234567890123456'), true, 'Valid API key should pass validation');
        assert.strictEqual(WhisperClient.validateApiKey('invalid-key'), false, 'Invalid API key should fail validation');
        assert.strictEqual(WhisperClient.validateApiKey(''), false, 'Empty API key should fail validation');
        assert.strictEqual(WhisperClient.validateApiKey('sk-short'), false, 'Short API key should fail validation');
    });

    it('should return supported formats', () => {
        const formats = WhisperClient.getSupportedFormats();
        assert.ok(Array.isArray(formats), 'Should return array of formats');
        assert.ok(formats.includes('wav'), 'Should support WAV format');
        assert.ok(formats.includes('mp3'), 'Should support MP3 format');
        assert.ok(formats.includes('webm'), 'Should support WebM format');
    });

    it('should return max file size', () => {
        const maxSize = WhisperClient.getMaxFileSize();
        assert.strictEqual(maxSize, 25 * 1024 * 1024, 'Max file size should be 25MB');
    });

    it('should initialize with any API key (validation happens at runtime)', () => {
        // WhisperClient does not check API key in the constructor
        const whisperClient = new WhisperClient({
            apiKey: 'invalid-key',
            timeout: 5000
        });
        
        assert.ok(whisperClient, 'WhisperClient should be initialized even with invalid key');
    });

    it('should initialize with empty API key (validation happens at runtime)', () => {
        // WhisperClient does not check API key in the constructor
        const whisperClient = new WhisperClient({
            apiKey: '',
            timeout: 5000
        });
        
        assert.ok(whisperClient, 'WhisperClient should be initialized even with empty key');
    });

    it('should validate API key format using static method', () => {
        // Test the static validation method
        assert.strictEqual(WhisperClient.validateApiKey('sk-1234567890123456789012345678901234567890123456'), true, 'Valid API key should pass validation');
        assert.strictEqual(WhisperClient.validateApiKey('invalid-key'), false, 'Invalid API key should fail validation');
        assert.strictEqual(WhisperClient.validateApiKey(''), false, 'Empty API key should fail validation');
        assert.strictEqual(WhisperClient.validateApiKey('sk-short'), false, 'Short API key should fail validation');
    });
});

describe('WhisperClient Initialization Tests', () => {
    it('should initialize with valid API key', () => {
        const whisperClient = new WhisperClient({
            apiKey: 'sk-1234567890123456789012345678901234567890123456',
            timeout: 5000
        });
        
        assert.ok(whisperClient, 'WhisperClient should be initialized');
    });

    it('should use default timeout when not specified', () => {
        const whisperClient = new WhisperClient({
            apiKey: 'sk-1234567890123456789012345678901234567890123456'
        });
        
        assert.ok(whisperClient, 'WhisperClient should be initialized with default timeout');
    });
});

describe('WhisperClient Error Handling Tests', () => {
    let whisperClient: WhisperClient;
    let originalFetch: typeof global.fetch;

    beforeEach(() => {
        originalFetch = global.fetch;
        whisperClient = new WhisperClient({
            apiKey: 'sk-1234567890123456789012345678901234567890123456',
            timeout: 5000
        });
    });

    afterEach(() => {
        global.fetch = originalFetch;
    });

    it('should handle network errors', async () => {
        global.fetch = async () => {
            throw new Error('Network error');
        };

        const audioBlob = new Blob(['test audio data'], { type: 'audio/wav' });
        
        try {
            await whisperClient.transcribe(audioBlob);
            assert.fail('Should have thrown an error');
        } catch (error) {
            assert.ok(error instanceof Error, 'Should throw Error instance');
            assert.ok(error.message.includes('Network error'), 'Should include network error message');
        }
    });

    it('should handle API errors', async () => {
        global.fetch = async () => {
            return new Response(JSON.stringify({ error: { message: 'API rate limit exceeded' } }), {
                status: 429,
                headers: { 'Content-Type': 'application/json' }
            });
        };

        const audioBlob = new Blob(['test audio data'], { type: 'audio/wav' });
        
        try {
            await whisperClient.transcribe(audioBlob);
            assert.fail('Should have thrown an error');
        } catch (error) {
            assert.ok(error instanceof Error, 'Should throw Error instance');
            // Check that the error contains information about the API status or message
            const errorMessage = error.message.toLowerCase();
            assert.ok(
                errorMessage.includes('rate limit') || 
                errorMessage.includes('429') || 
                errorMessage.includes('api error') ||
                errorMessage.includes('limit') ||
                errorMessage.includes('exceeded'),
                `Should include API error information, got: ${error.message}`
            );
        }
    });

    it('should handle timeout errors', async () => {
        const shortTimeoutClient = new WhisperClient({
            apiKey: 'sk-1234567890123456789012345678901234567890123456',
            timeout: 100 // Very short timeout
        });

        global.fetch = async () => {
            // Simulate a long request
            await new Promise(resolve => setTimeout(resolve, 200));
            return new Response(JSON.stringify({ text: 'Test' }), { status: 200 });
        };

        const audioBlob = new Blob(['test audio data'], { type: 'audio/wav' });
        
        try {
            await shortTimeoutClient.transcribe(audioBlob);
            assert.fail('Should have thrown a timeout error');
        } catch (error) {
            assert.ok(error instanceof Error, 'Should throw Error instance');
            assert.ok(error.message.includes('timeout') || error.message.includes('aborted'), 'Should include timeout error message');
        }
    });
}); 