"use strict";
// WhisperClient.test.ts - Unit тесты для OpenAI Whisper API клиента
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const assert = __importStar(require("assert"));
const sinon = __importStar(require("sinon"));
const WhisperClient_1 = require("../../core/WhisperClient");
const webAudioMocks_1 = require("../mocks/webAudioMocks");
const testData_1 = require("../fixtures/testData");
suite('WhisperClient Unit Tests', () => {
    let whisperClient;
    let fetchStub;
    setup(() => {
        (0, webAudioMocks_1.setupWebAudioMocks)();
        fetchStub = global.fetch;
        whisperClient = new WhisperClient_1.WhisperClient({ apiKey: 'test-api-key' });
    });
    teardown(() => {
        (0, webAudioMocks_1.cleanupWebAudioMocks)();
        sinon.restore();
    });
    suite('Constructor', () => {
        test('Should initialize with API key', () => {
            const client = new WhisperClient_1.WhisperClient({ apiKey: 'my-api-key' });
            assert.ok(client);
        });
        test('Should handle empty API key', () => {
            const client = new WhisperClient_1.WhisperClient({ apiKey: '' });
            assert.ok(client);
        });
    });
    suite('transcribe', () => {
        test('Should transcribe audio successfully', async () => {
            // Настраиваем мок успешного ответа
            const mockResponse = (0, webAudioMocks_1.createMockApiResponse)(testData_1.testApiResponses.successfulTranscription.text);
            fetchStub.resolves(mockResponse);
            const audioBlob = new global.Blob(['mock audio'], { type: 'audio/webm' });
            const result = await whisperClient.transcribe(audioBlob);
            assert.strictEqual(result, testData_1.testApiResponses.successfulTranscription.text);
        });
        test('Should handle API error responses', async () => {
            // Настраиваем мок ошибки
            const mockResponse = (0, webAudioMocks_1.createMockApiError)(401, 'Invalid API key');
            fetchStub.resolves(mockResponse);
            const audioBlob = new global.Blob(['mock audio'], { type: 'audio/webm' });
            try {
                await whisperClient.transcribe(audioBlob);
                assert.fail('Should have thrown an error');
            }
            catch (error) {
                assert.ok(error instanceof Error);
                assert.ok(error.message.includes('OpenAI API Error'));
            }
        });
        test('Should handle network error', async () => {
            // Настраиваем мок сетевой ошибки
            fetchStub.rejects(new Error('Network error'));
            const audioBlob = new global.Blob(['mock audio'], { type: 'audio/webm' });
            try {
                await whisperClient.transcribe(audioBlob);
                assert.fail('Should have thrown an error');
            }
            catch (error) {
                assert.ok(error instanceof Error);
                assert.ok(error.message.includes('Transcription failed'));
            }
        });
        test('Should send correct request format', async () => {
            // Настраиваем мок успешного ответа
            const mockResponse = (0, webAudioMocks_1.createMockApiResponse)(testData_1.testApiResponses.englishTranscription.text);
            fetchStub.resolves(mockResponse);
            const audioBlob = new global.Blob(['mock audio'], { type: 'audio/webm' });
            await whisperClient.transcribe(audioBlob);
            // Проверяем что fetch был вызван с правильными параметрами
            assert.ok(fetchStub.calledOnce);
            const [url, options] = fetchStub.getCall(0).args;
            assert.strictEqual(url, 'https://api.openai.com/v1/audio/transcriptions');
            assert.strictEqual(options.method, 'POST');
            assert.strictEqual(options.headers['Authorization'], 'Bearer test-api-key');
            assert.ok(options.body instanceof global.FormData);
        });
        test('Should send correct FormData with language option', async () => {
            // Настраиваем мок успешного ответа
            const mockResponse = (0, webAudioMocks_1.createMockApiResponse)(testData_1.testApiResponses.englishTranscription.text);
            fetchStub.resolves(mockResponse);
            const audioBlob = new global.Blob(['mock audio'], { type: 'audio/webm' });
            await whisperClient.transcribe(audioBlob, { language: 'ru' });
            const [, options] = fetchStub.getCall(0).args;
            const formData = options.body;
            // Проверяем что FormData содержит правильные поля
            assert.ok(formData.has('file'));
            assert.ok(formData.has('model'));
            assert.ok(formData.has('language'));
            assert.ok(formData.has('temperature'));
            assert.strictEqual(formData.get('model'), 'whisper-1');
            assert.strictEqual(formData.get('language'), 'ru');
            assert.strictEqual(formData.get('temperature'), '0');
        });
        test('Should use auto language detection by default', async () => {
            // Настраиваем мок успешного ответа
            const mockResponse = (0, webAudioMocks_1.createMockApiResponse)(testData_1.testApiResponses.englishTranscription.text);
            fetchStub.resolves(mockResponse);
            const audioBlob = new global.Blob(['mock audio'], { type: 'audio/webm' });
            await whisperClient.transcribe(audioBlob);
            const [, options] = fetchStub.getCall(0).args;
            const formData = options.body;
            // Если язык не указан, поле language не должно быть в FormData
            assert.strictEqual(formData.has('language'), false);
        });
        test('Should include prompt if provided', async () => {
            const mockResponse = (0, webAudioMocks_1.createMockApiResponse)(testData_1.testApiResponses.englishTranscription.text);
            fetchStub.resolves(mockResponse);
            const audioBlob = new global.Blob(['mock audio'], { type: 'audio/webm' });
            await whisperClient.transcribe(audioBlob, { prompt: 'This is code' });
            const [, options] = fetchStub.getCall(0).args;
            const formData = options.body;
            assert.ok(formData.has('prompt'));
            assert.strictEqual(formData.get('prompt'), 'This is code');
        });
    });
    suite('checkApiKey', () => {
        test('Should return true for valid API key', async () => {
            // Настраиваем мок успешного ответа
            const mockResponse = { ok: true };
            fetchStub.resolves(mockResponse);
            const result = await whisperClient.checkApiKey();
            assert.strictEqual(result, true);
            // Проверяем правильность запроса
            const [url, options] = fetchStub.getCall(0).args;
            assert.strictEqual(url, 'https://api.openai.com/v1/models');
            assert.strictEqual(options.headers['Authorization'], 'Bearer test-api-key');
        });
        test('Should return false for invalid API key', async () => {
            // Настраиваем мок ошибки авторизации
            const mockResponse = { ok: false };
            fetchStub.resolves(mockResponse);
            const result = await whisperClient.checkApiKey();
            assert.strictEqual(result, false);
        });
        test('Should return false on network error', async () => {
            // Настраиваем мок сетевой ошибки
            fetchStub.rejects(new Error('Network error'));
            const result = await whisperClient.checkApiKey();
            assert.strictEqual(result, false);
        });
    });
    suite('validateApiKey static method', () => {
        test('Should validate correct API key format', () => {
            const validKey = 'sk-1234567890abcdef1234567890abcdef1234567890abcdef12';
            const result = WhisperClient_1.WhisperClient.validateApiKey(validKey);
            assert.strictEqual(result, true);
        });
        test('Should reject invalid API key formats', () => {
            const invalidKeys = [
                '',
                'invalid-key',
                'sk-',
                'sk-short',
                'wrong-prefix-1234567890abcdef1234567890abcdef',
                'sk-tooshort'
            ];
            invalidKeys.forEach(key => {
                const result = WhisperClient_1.WhisperClient.validateApiKey(key);
                assert.strictEqual(result, false, `Should reject key: ${key}`);
            });
        });
        test('Should handle null and undefined', () => {
            assert.strictEqual(WhisperClient_1.WhisperClient.validateApiKey(null), false);
            assert.strictEqual(WhisperClient_1.WhisperClient.validateApiKey(undefined), false);
        });
    });
    suite('Retry Mechanism', () => {
        test('Should retry on network errors', async () => {
            // Настраиваем клиент с быстрыми retry
            const retryClient = new WhisperClient_1.WhisperClient({
                apiKey: 'test-api-key',
                maxRetries: 2,
                retryDelay: 10
            });
            // Первые два вызова с ошибкой, третий успешный
            fetchStub
                .onFirstCall().rejects(new Error('Network error'))
                .onSecondCall().rejects(new Error('Network error'))
                .onThirdCall().resolves((0, webAudioMocks_1.createMockApiResponse)('success'));
            const audioBlob = new global.Blob(['mock audio'], { type: 'audio/webm' });
            const result = await retryClient.transcribe(audioBlob);
            assert.strictEqual(result, 'success');
            assert.strictEqual(fetchStub.callCount, 3);
        });
        test('Should not retry on non-retryable errors', async () => {
            const retryClient = new WhisperClient_1.WhisperClient({
                apiKey: 'test-api-key',
                maxRetries: 3
            });
            // 401 ошибка не должна вызывать retry
            fetchStub.resolves((0, webAudioMocks_1.createMockApiError)(401, 'Invalid API key'));
            const audioBlob = new global.Blob(['mock audio'], { type: 'audio/webm' });
            try {
                await retryClient.transcribe(audioBlob);
                assert.fail('Should have thrown an error');
            }
            catch (error) {
                assert.ok(error);
                assert.strictEqual(fetchStub.callCount, 1);
            }
        });
    });
    suite('File Validation', () => {
        test('Should reject empty audio blob', async () => {
            const emptyBlob = new global.Blob([], { type: 'audio/webm' });
            try {
                await whisperClient.transcribe(emptyBlob);
                assert.fail('Should have thrown an error');
            }
            catch (error) {
                assert.ok(error.code === 'EMPTY_AUDIO');
            }
        });
        test('Should reject oversized files', async () => {
            // Создаем "большой" файл
            const largeMockData = 'x'.repeat(26 * 1024 * 1024); // 26MB
            const largeBlob = new global.Blob([largeMockData], { type: 'audio/webm' });
            try {
                await whisperClient.transcribe(largeBlob);
                assert.fail('Should have thrown an error');
            }
            catch (error) {
                assert.ok(error.code === 'FILE_TOO_LARGE');
            }
        });
    });
    suite('Enhanced Error Handling', () => {
        test('Should provide specific error codes for API errors', async () => {
            const testCases = [
                { status: 401, expectedCode: 'INVALID_API_KEY' },
                { status: 429, expectedCode: 'RATE_LIMIT_EXCEEDED' },
                { status: 413, expectedCode: 'FILE_TOO_LARGE' }
            ];
            for (const { status, expectedCode } of testCases) {
                fetchStub.resolves((0, webAudioMocks_1.createMockApiError)(status, 'Test error'));
                const audioBlob = new global.Blob(['mock audio'], { type: 'audio/webm' });
                try {
                    await whisperClient.transcribe(audioBlob);
                    assert.fail(`Should have thrown an error for status ${status}`);
                }
                catch (error) {
                    assert.strictEqual(error.code, expectedCode);
                }
            }
        });
    });
    suite('Static Helper Methods', () => {
        test('Should return supported formats', () => {
            const formats = WhisperClient_1.WhisperClient.getSupportedFormats();
            assert.ok(Array.isArray(formats));
            assert.ok(formats.includes('webm'));
            assert.ok(formats.includes('wav'));
            assert.ok(formats.includes('mp3'));
        });
        test('Should return max file size', () => {
            const maxSize = WhisperClient_1.WhisperClient.getMaxFileSize();
            assert.strictEqual(maxSize, 25 * 1024 * 1024);
        });
    });
    suite('Configuration Options', () => {
        test('Should use custom timeout', async () => {
            const quickClient = new WhisperClient_1.WhisperClient({
                apiKey: 'test-api-key',
                timeout: 100 // Очень короткий timeout
            });
            // Мок задержки в ответе
            fetchStub.callsFake(() => new Promise(resolve => setTimeout(resolve, 200)));
            const audioBlob = new global.Blob(['mock audio'], { type: 'audio/webm' });
            try {
                await quickClient.transcribe(audioBlob);
                assert.fail('Should have timed out');
            }
            catch (error) {
                assert.ok(error.code === 'TIMEOUT');
            }
        });
        test('Should use custom base URL', async () => {
            const customClient = new WhisperClient_1.WhisperClient({
                apiKey: 'test-api-key',
                baseURL: 'https://custom-api.example.com/v1'
            });
            fetchStub.resolves((0, webAudioMocks_1.createMockApiResponse)('success'));
            const audioBlob = new global.Blob(['mock audio'], { type: 'audio/webm' });
            await customClient.transcribe(audioBlob);
            const [url] = fetchStub.getCall(0).args;
            assert.ok(url.startsWith('https://custom-api.example.com/v1'));
        });
    });
    suite('Configuration and Options', () => {
        test('Should support different language codes', async () => {
            const mockResponse = (0, webAudioMocks_1.createMockApiResponse)(testData_1.testApiResponses.successfulTranscription.text);
            fetchStub.resolves(mockResponse);
            const audioBlob = new global.Blob(['mock audio'], { type: 'audio/webm' });
            // Тестируем разные языковые коды
            const languages = ['en', 'ru', 'fr', 'de', 'es'];
            for (const lang of languages) {
                await whisperClient.transcribe(audioBlob, { language: lang });
                const [, options] = fetchStub.getCall(fetchStub.callCount - 1).args;
                const formData = options.body;
                assert.strictEqual(formData.get('language'), lang);
            }
        });
        test('Should handle empty options object', async () => {
            const mockResponse = (0, webAudioMocks_1.createMockApiResponse)(testData_1.testApiResponses.englishTranscription.text);
            fetchStub.resolves(mockResponse);
            const audioBlob = new global.Blob(['mock audio'], { type: 'audio/webm' });
            await whisperClient.transcribe(audioBlob, {});
            const [, options] = fetchStub.getCall(0).args;
            const formData = options.body;
            // При пустых опциях только базовые поля должны присутствовать
            assert.ok(formData.has('file'));
            assert.ok(formData.has('model'));
            assert.ok(formData.has('temperature'));
            assert.strictEqual(formData.has('language'), false);
            assert.strictEqual(formData.has('prompt'), false);
        });
    });
});
//# sourceMappingURL=WhisperClient.test.js.map