// WhisperClient.test.ts - Unit тесты для OpenAI Whisper API клиента

import * as assert from 'assert';
import * as sinon from 'sinon';
import { WhisperClient } from '../../core/WhisperClient';
import { setupWebAudioMocks, cleanupWebAudioMocks, createMockApiResponse, createMockApiError } from '../mocks/webAudioMocks';
import { testAudioData, testApiResponses } from '../fixtures/testData';

suite('WhisperClient Unit Tests', () => {
    let whisperClient: WhisperClient;
    let fetchStub: sinon.SinonStub;

    setup(() => {
        setupWebAudioMocks();
        fetchStub = (global as any).fetch;
        whisperClient = new WhisperClient({ apiKey: 'test-api-key' });
    });

    teardown(() => {
        cleanupWebAudioMocks();
        sinon.restore();
    });

    suite('Constructor', () => {
        test('Should initialize with API key', () => {
            const client = new WhisperClient({ apiKey: 'my-api-key' });
            assert.ok(client);
        });

        test('Should handle empty API key', () => {
            const client = new WhisperClient({ apiKey: '' });
            assert.ok(client);
        });
    });

    suite('transcribe', () => {
        test('Should transcribe audio successfully', async () => {
            // Настраиваем мок успешного ответа
            const mockResponse = createMockApiResponse(testApiResponses.successfulTranscription.text);
            fetchStub.resolves(mockResponse);

            const audioBlob = new (global as any).Blob(['mock audio'], { type: 'audio/webm' });
            const result = await whisperClient.transcribe(audioBlob);

            assert.strictEqual(result, testApiResponses.successfulTranscription.text);
        });

        test('Should handle API error responses', async () => {
            // Настраиваем мок API ошибки
            const mockResponse = createMockApiError(401, 'Invalid API key');
            fetchStub.resolves(mockResponse);

            const audioBlob = new (global as any).Blob(['mock audio'], { type: 'audio/webm' });
            
            try {
                await whisperClient.transcribe(audioBlob);
                assert.fail('Should have thrown an error');
            } catch (error) {
                assert.ok(error instanceof Error);
                // Исправляем ожидаемое сообщение - код возвращает "Неверный API ключ OpenAI"
                assert.ok((error as Error).message.includes('Неверный API ключ OpenAI'));
            }
        });

        test('Should handle network error', async () => {
            // Настраиваем мок сетевой ошибки с 'fetch' в сообщении для правильного enhance
            fetchStub.rejects(new Error('fetch failed'));

            const audioBlob = new (global as any).Blob(['mock audio'], { type: 'audio/webm' });
            
            try {
                await whisperClient.transcribe(audioBlob);
                assert.fail('Should have thrown an error');
            } catch (error) {
                assert.ok(error instanceof Error);
                // Проверяем что ошибка была enhanced правильно после всех попыток
                assert.ok((error as Error).message.includes('Ошибка сети при подключении к API'));
            }
        });

        test('Should send correct request format', async () => {
            // Настраиваем мок успешного ответа
            const mockResponse = createMockApiResponse(testApiResponses.englishTranscription.text);
            fetchStub.resolves(mockResponse);

            const audioBlob = new (global as any).Blob(['mock audio'], { type: 'audio/webm' });
            await whisperClient.transcribe(audioBlob);

            // Проверяем что fetch был вызван с правильными параметрами
            assert.ok(fetchStub.calledOnce);
            const [url, options] = fetchStub.getCall(0).args;

            assert.strictEqual(url, 'https://api.openai.com/v1/audio/transcriptions');
            assert.strictEqual(options.method, 'POST');
            assert.strictEqual(options.headers['Authorization'], 'Bearer test-api-key');
            assert.ok(options.body instanceof (global as any).FormData);
        });

        test('Should send correct FormData with language option', async () => {
            // Настраиваем мок успешного ответа
            const mockResponse = createMockApiResponse(testApiResponses.englishTranscription.text);
            fetchStub.resolves(mockResponse);

            const audioBlob = new (global as any).Blob(['mock audio'], { type: 'audio/webm' });
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
            const mockResponse = createMockApiResponse(testApiResponses.englishTranscription.text);
            fetchStub.resolves(mockResponse);

            const audioBlob = new (global as any).Blob(['mock audio'], { type: 'audio/webm' });
            await whisperClient.transcribe(audioBlob);

            const [, options] = fetchStub.getCall(0).args;
            const formData = options.body;

            // Если язык не указан, поле language не должно быть в FormData
            assert.strictEqual(formData.has('language'), false);
        });

        test('Should include prompt if provided', async () => {
            const mockResponse = createMockApiResponse(testApiResponses.englishTranscription.text);
            fetchStub.resolves(mockResponse);

            const audioBlob = new (global as any).Blob(['mock audio'], { type: 'audio/webm' });
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
            const result = WhisperClient.validateApiKey(validKey);
            
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
                const result = WhisperClient.validateApiKey(key);
                assert.strictEqual(result, false, `Should reject key: ${key}`);
            });
        });

        test('Should handle null and undefined', () => {
            assert.strictEqual(WhisperClient.validateApiKey(null as any), false);
            assert.strictEqual(WhisperClient.validateApiKey(undefined as any), false);
        });
    });

    suite('Retry Mechanism', () => {
        test('Should retry on network errors', async () => {
            // Настраиваем клиент с быстрыми retry
            const retryClient = new WhisperClient({ 
                apiKey: 'test-api-key',
                maxRetries: 3,
                retryDelay: 10
            });
            
            // Первый вызов с network error (retryable), второй успешный
            const networkError = new Error('fetch failed');
            fetchStub
                .onFirstCall().rejects(networkError)
                .onSecondCall().resolves(createMockApiResponse('success'));

            const audioBlob = new (global as any).Blob(['mock audio'], { type: 'audio/webm' });
            const result = await retryClient.transcribe(audioBlob);

            assert.strictEqual(result, 'success');
            assert.strictEqual(fetchStub.callCount, 2);
        });

        test('Should not retry on non-retryable errors', async () => {
            const retryClient = new WhisperClient({ 
                apiKey: 'test-api-key',
                maxRetries: 3
            });
            
            // 401 ошибка не должна вызывать retry
            fetchStub.resolves(createMockApiError(401, 'Invalid API key'));

            const audioBlob = new (global as any).Blob(['mock audio'], { type: 'audio/webm' });
            
            try {
                await retryClient.transcribe(audioBlob);
                assert.fail('Should have thrown an error');
            } catch (error) {
                assert.ok(error);
                assert.strictEqual(fetchStub.callCount, 1);
            }
        });
    });

    suite('File Validation', () => {
        test('Should reject empty audio blob', async () => {
            const emptyBlob = new (global as any).Blob([], { type: 'audio/webm' });
            
            try {
                await whisperClient.transcribe(emptyBlob);
                assert.fail('Should have thrown an error');
            } catch (error) {
                assert.ok((error as any).code === 'EMPTY_AUDIO');
            }
        });

        test('Should reject oversized files', async () => {
            // Создаем "большой" файл
            const largeMockData = 'x'.repeat(26 * 1024 * 1024); // 26MB
            const largeBlob = new (global as any).Blob([largeMockData], { type: 'audio/webm' });
            
            try {
                await whisperClient.transcribe(largeBlob);
                assert.fail('Should have thrown an error');
            } catch (error) {
                assert.ok((error as any).code === 'FILE_TOO_LARGE');
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
                fetchStub.resolves(createMockApiError(status, 'Test error'));
                
                const audioBlob = new (global as any).Blob(['mock audio'], { type: 'audio/webm' });
                
                try {
                    await whisperClient.transcribe(audioBlob);
                    assert.fail(`Should have thrown an error for status ${status}`);
                } catch (error) {
                    assert.strictEqual((error as any).code, expectedCode);
                }
            }
        });
    });

    suite('Static Helper Methods', () => {
        test('Should return supported formats', () => {
            const formats = WhisperClient.getSupportedFormats();
            assert.ok(Array.isArray(formats));
            assert.ok(formats.includes('webm'));
            assert.ok(formats.includes('wav'));
            assert.ok(formats.includes('mp3'));
        });

        test('Should return max file size', () => {
            const maxSize = WhisperClient.getMaxFileSize();
            assert.strictEqual(maxSize, 25 * 1024 * 1024);
        });
    });

    suite('Configuration Options', () => {
        test('Should use custom timeout', async () => {
            const quickClient = new WhisperClient({ 
                apiKey: 'test-api-key',
                timeout: 100 // Очень короткий timeout
            });
            
            // Мок задержки в ответе - используем AbortError для имитации timeout
            fetchStub.callsFake(() => {
                const error = new Error('The operation was aborted');
                error.name = 'AbortError';
                return Promise.reject(error);
            });
            
            const audioBlob = new (global as any).Blob(['mock audio'], { type: 'audio/webm' });
            
            try {
                await quickClient.transcribe(audioBlob);
                assert.fail('Should have timed out');
            } catch (error) {
                assert.ok((error as any).code === 'TIMEOUT');
            }
        });

        test('Should use custom base URL', async () => {
            const customClient = new WhisperClient({ 
                apiKey: 'test-api-key',
                baseURL: 'https://custom-api.example.com/v1'
            });
            
            fetchStub.resolves(createMockApiResponse('success'));
            
            const audioBlob = new (global as any).Blob(['mock audio'], { type: 'audio/webm' });
            await customClient.transcribe(audioBlob);
            
            const [url] = fetchStub.getCall(0).args;
            assert.ok(url.startsWith('https://custom-api.example.com/v1'));
        });
    });

    suite('Configuration and Options', () => {
        test('Should support different language codes', async () => {
            const mockResponse = createMockApiResponse(testApiResponses.successfulTranscription.text);
            fetchStub.resolves(mockResponse);

            const audioBlob = new (global as any).Blob(['mock audio'], { type: 'audio/webm' });
            
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
            const mockResponse = createMockApiResponse(testApiResponses.englishTranscription.text);
            fetchStub.resolves(mockResponse);

            const audioBlob = new (global as any).Blob(['mock audio'], { type: 'audio/webm' });
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