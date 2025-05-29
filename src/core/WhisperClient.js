"use strict";
// WhisperClient.ts - HTTP клиент для интеграции с OpenAI Whisper API
Object.defineProperty(exports, "__esModule", { value: true });
exports.WhisperClient = void 0;
/**
 * HTTP клиент для интеграции с OpenAI Whisper API
 */
class WhisperClient {
    apiKey;
    baseURL;
    timeout;
    maxRetries;
    retryDelay;
    // Поддерживаемые форматы аудио
    supportedFormats = [
        'flac', 'mp3', 'mp4', 'mpeg', 'mpga', 'm4a', 'ogg', 'wav', 'webm'
    ];
    // Максимальный размер файла (25MB)
    maxFileSize = 25 * 1024 * 1024;
    constructor(config) {
        this.apiKey = config.apiKey;
        this.baseURL = config.baseURL || 'https://api.openai.com/v1';
        this.timeout = config.timeout || 30000; // 30 секунд
        this.maxRetries = config.maxRetries || 3;
        this.retryDelay = config.retryDelay || 1000; // 1 секунда
    }
    /**
     * Транскрибация аудио файла
     */
    async transcribe(audioBlob, options = {}) {
        this.validateAudioBlob(audioBlob);
        const formData = this.prepareFormData(audioBlob, options);
        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            try {
                const response = await this.makeRequest('/audio/transcriptions', formData);
                return this.processTranscriptionResponse(response, options);
            }
            catch (error) {
                if (attempt === this.maxRetries || !this.isRetryableError(error)) {
                    throw this.enhanceError(error);
                }
                // Ждем перед повторной попыткой
                await this.delay(this.retryDelay * attempt);
            }
        }
        throw new Error('Все попытки транскрибации исчерпаны');
    }
    /**
     * Проверка валидности API ключа
     */
    async checkApiKey() {
        try {
            const response = await fetch(`${this.baseURL}/models`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'User-Agent': 'SpeechToTextWhisper-Extension/1.0'
                },
                signal: AbortSignal.timeout(this.timeout)
            });
            return response.ok;
        }
        catch {
            return false;
        }
    }
    /**
     * Получение информации об использовании API
     */
    async getUsage() {
        try {
            const response = await fetch(`${this.baseURL}/usage`, {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'User-Agent': 'SpeechToTextWhisper-Extension/1.0'
                },
                signal: AbortSignal.timeout(this.timeout)
            });
            if (!response.ok) {
                throw new Error(`API Error: ${response.status}`);
            }
            return await response.json();
        }
        catch (error) {
            throw this.enhanceError(error);
        }
    }
    /**
     * Валидация аудио blob
     */
    validateAudioBlob(audioBlob) {
        if (!audioBlob || audioBlob.size === 0) {
            throw this.createError('Аудио файл пуст', 'EMPTY_AUDIO');
        }
        if (audioBlob.size > this.maxFileSize) {
            throw this.createError(`Размер файла превышает лимит в ${this.maxFileSize / (1024 * 1024)}MB`, 'FILE_TOO_LARGE');
        }
        // Проверка формата по MIME типу
        const mimeType = audioBlob.type;
        if (mimeType && !this.isSupportedFormat(mimeType)) {
            console.warn(`Неподдерживаемый MIME тип: ${mimeType}. Продолжаем...`);
        }
    }
    /**
     * Проверка поддерживаемости формата
     */
    isSupportedFormat(mimeType) {
        return this.supportedFormats.some(format => mimeType.includes(format) || mimeType.includes(`audio/${format}`));
    }
    /**
     * Подготовка FormData для запроса
     */
    prepareFormData(audioBlob, options) {
        const formData = new FormData();
        // Определяем расширение файла на основе MIME типа
        const extension = this.getFileExtension(audioBlob.type);
        formData.append('file', audioBlob, `audio.${extension}`);
        // Модель (по умолчанию whisper-1, но можно настроить)
        const model = options.model || 'whisper-1';
        formData.append('model', model);
        // Добавляем опции
        if (options.language && options.language !== 'auto') {
            formData.append('language', options.language);
        }
        if (options.prompt) {
            formData.append('prompt', options.prompt);
        }
        // Температура для определения креативности
        const temperature = options.temperature ?? 0;
        formData.append('temperature', temperature.toString());
        // Формат ответа (поддерживаем новые варианты)
        if (options.response_format) {
            formData.append('response_format', options.response_format);
        }
        // Временные метки (только для json форматов)
        if (options.timestamp_granularities &&
            (options.response_format === 'verbose_json' || options.response_format === 'json')) {
            formData.append('timestamp_granularities[]', options.timestamp_granularities.join(','));
        }
        return formData;
    }
    /**
     * Получение расширения файла по MIME типу
     */
    getFileExtension(mimeType) {
        const mimeToExtension = {
            'audio/webm': 'webm',
            'audio/wav': 'wav',
            'audio/mp3': 'mp3',
            'audio/mp4': 'mp4',
            'audio/ogg': 'ogg',
            'audio/flac': 'flac',
            'audio/m4a': 'm4a'
        };
        return mimeToExtension[mimeType] || 'webm';
    }
    /**
     * Выполнение HTTP запроса
     */
    async makeRequest(endpoint, formData) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);
        try {
            const response = await fetch(`${this.baseURL}${endpoint}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'User-Agent': 'SpeechToTextWhisper-Extension/1.0'
                },
                body: formData,
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            if (!response.ok) {
                const errorData = await this.parseErrorResponse(response);
                throw this.createApiError(response.status, response.statusText, errorData);
            }
            return response;
        }
        catch (error) {
            clearTimeout(timeoutId);
            throw error;
        }
    }
    /**
     * Обработка ответа транскрибации
     */
    async processTranscriptionResponse(response, options) {
        const responseFormat = options.response_format || 'json';
        if (responseFormat === 'text') {
            return await response.text();
        }
        const result = await response.json();
        return result.text;
    }
    /**
     * Парсинг ошибок API
     */
    async parseErrorResponse(response) {
        try {
            return await response.json();
        }
        catch {
            return { message: response.statusText };
        }
    }
    /**
     * Создание API ошибки
     */
    createApiError(status, statusText, errorData) {
        let message = `OpenAI API Error: ${status} ${statusText}`;
        let code = 'API_ERROR';
        if (errorData?.error) {
            message = errorData.error.message || message;
            code = errorData.error.code || code;
        }
        // Специфичные сообщения для разных кодов ошибок
        switch (status) {
            case 401:
                message = 'Неверный API ключ OpenAI';
                code = 'INVALID_API_KEY';
                break;
            case 429:
                message = 'Превышен лимит запросов API. Попробуйте позже';
                code = 'RATE_LIMIT_EXCEEDED';
                break;
            case 413:
                message = 'Файл слишком большой для обработки';
                code = 'FILE_TOO_LARGE';
                break;
            case 400:
                if (errorData?.error?.message?.includes('audio')) {
                    message = 'Неподдерживаемый формат аудио';
                    code = 'UNSUPPORTED_FORMAT';
                }
                break;
        }
        return this.createError(message, code, status, errorData);
    }
    /**
     * Создание расширенной ошибки
     */
    createError(message, code, statusCode, details) {
        const error = new Error(message);
        error.code = code;
        error.statusCode = statusCode;
        error.details = details;
        return error;
    }
    /**
     * Улучшение существующей ошибки
     */
    enhanceError(error) {
        if (error.name === 'AbortError') {
            return this.createError('Превышено время ожидания ответа API', 'TIMEOUT');
        }
        if (error.message.includes('fetch')) {
            return this.createError('Ошибка сети при подключении к API', 'NETWORK_ERROR');
        }
        return error;
    }
    /**
     * Проверка возможности повтора запроса
     */
    isRetryableError(error) {
        if (error.code === 'TIMEOUT' || error.code === 'NETWORK_ERROR') {
            return true;
        }
        const retryableStatuses = [429, 500, 502, 503, 504];
        return retryableStatuses.includes(error.statusCode);
    }
    /**
     * Задержка для повторных попыток
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    /**
     * Статическая валидация API ключа
     */
    static validateApiKey(apiKey) {
        if (!apiKey || typeof apiKey !== 'string') {
            return false;
        }
        // OpenAI ключи начинаются с sk- и имеют определенную длину
        return apiKey.startsWith('sk-') && apiKey.length >= 48;
    }
    /**
     * Получение поддерживаемых форматов
     */
    static getSupportedFormats() {
        return [
            'flac', 'mp3', 'mp4', 'mpeg', 'mpga', 'm4a', 'ogg', 'wav', 'webm'
        ];
    }
    /**
     * Получение максимального размера файла
     */
    static getMaxFileSize() {
        return 25 * 1024 * 1024; // 25MB
    }
}
exports.WhisperClient = WhisperClient;
//# sourceMappingURL=WhisperClient.js.map