// WhisperClient.ts - HTTP клиент для интеграции с OpenAI Whisper API

export interface TranscriptionOptions {
    language?: string;      // ISO 639-1 код языка или 'auto' для автоопределения
    prompt?: string;        // Контекстная подсказка для улучшения точности
    temperature?: number;   // 0-1, креативность (0 = детерминированный)
    response_format?: 'json' | 'text' | 'srt' | 'verbose_json' | 'vtt';
    timestamp_granularities?: ('word' | 'segment')[];
}

export interface TranscriptionResult {
    text: string;
    language?: string;
    duration?: number;
    words?: WordTimestamp[];
    segments?: SegmentTimestamp[];
}

export interface WordTimestamp {
    word: string;
    start: number;
    end: number;
}

export interface SegmentTimestamp {
    id: number;
    seek: number;
    start: number;
    end: number;
    text: string;
    tokens: number[];
    temperature: number;
    avg_logprob: number;
    compression_ratio: number;
    no_speech_prob: number;
}

export interface WhisperError extends Error {
    code?: string;
    statusCode?: number;
    details?: any;
}

export interface WhisperClientConfig {
    apiKey: string;
    baseURL?: string;
    timeout?: number;
    maxRetries?: number;
    retryDelay?: number;
}

/**
 * HTTP клиент для интеграции с OpenAI Whisper API
 */
export class WhisperClient {
    private apiKey: string;
    private baseURL: string;
    private timeout: number;
    private maxRetries: number;
    private retryDelay: number;

    // Поддерживаемые форматы аудио
    private readonly supportedFormats = [
        'flac', 'mp3', 'mp4', 'mpeg', 'mpga', 'm4a', 'ogg', 'wav', 'webm'
    ];

    // Максимальный размер файла (25MB)
    private readonly maxFileSize = 25 * 1024 * 1024;

    constructor(config: WhisperClientConfig) {
        this.apiKey = config.apiKey;
        this.baseURL = config.baseURL || 'https://api.openai.com/v1';
        this.timeout = config.timeout || 30000; // 30 секунд
        this.maxRetries = config.maxRetries || 3;
        this.retryDelay = config.retryDelay || 1000; // 1 секунда
    }

    /**
     * Транскрибация аудио файла
     */
    async transcribe(audioBlob: Blob, options: TranscriptionOptions = {}): Promise<string> {
        this.validateAudioBlob(audioBlob);
        
        const formData = this.prepareFormData(audioBlob, options);
        
        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            try {
                const response = await this.makeRequest('/audio/transcriptions', formData);
                return this.processTranscriptionResponse(response, options);
            } catch (error) {
                if (attempt === this.maxRetries || !this.isRetryableError(error)) {
                    throw this.enhanceError(error as Error);
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
    async checkApiKey(): Promise<boolean> {
        try {
            const response = await fetch(`${this.baseURL}/models`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'User-Agent': 'VoiceScribe-Extension/1.0'
                },
                signal: AbortSignal.timeout(this.timeout)
            });
            return response.ok;
        } catch {
            return false;
        }
    }

    /**
     * Получение информации об использовании API
     */
    async getUsage(): Promise<any> {
        try {
            const response = await fetch(`${this.baseURL}/usage`, {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'User-Agent': 'VoiceScribe-Extension/1.0'
                },
                signal: AbortSignal.timeout(this.timeout)
            });

            if (!response.ok) {
                throw new Error(`API Error: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            throw this.enhanceError(error as Error);
        }
    }

    /**
     * Валидация аудио blob
     */
    private validateAudioBlob(audioBlob: Blob): void {
        if (!audioBlob || audioBlob.size === 0) {
            throw this.createError('Аудио файл пуст', 'EMPTY_AUDIO');
        }

        if (audioBlob.size > this.maxFileSize) {
            throw this.createError(
                `Размер файла превышает лимит в ${this.maxFileSize / (1024 * 1024)}MB`,
                'FILE_TOO_LARGE'
            );
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
    private isSupportedFormat(mimeType: string): boolean {
        return this.supportedFormats.some(format => 
            mimeType.includes(format) || mimeType.includes(`audio/${format}`)
        );
    }

    /**
     * Подготовка FormData для запроса
     */
    private prepareFormData(audioBlob: Blob, options: TranscriptionOptions): FormData {
        const formData = new FormData();
        
        // Определяем расширение файла на основе MIME типа
        const extension = this.getFileExtension(audioBlob.type);
        formData.append('file', audioBlob, `audio.${extension}`);
        formData.append('model', 'whisper-1');

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

        // Формат ответа
        const responseFormat = options.response_format || 'json';
        formData.append('response_format', responseFormat);

        // Временные метки
        if (options.timestamp_granularities) {
            formData.append('timestamp_granularities[]', options.timestamp_granularities.join(','));
        }

        return formData;
    }

    /**
     * Получение расширения файла по MIME типу
     */
    private getFileExtension(mimeType: string): string {
        const mimeToExtension: { [key: string]: string } = {
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
    private async makeRequest(endpoint: string, formData: FormData): Promise<Response> {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        try {
            const response = await fetch(`${this.baseURL}${endpoint}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'User-Agent': 'VoiceScribe-Extension/1.0'
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
        } catch (error) {
            clearTimeout(timeoutId);
            throw error;
        }
    }

    /**
     * Обработка ответа транскрибации
     */
    private async processTranscriptionResponse(
        response: Response, 
        options: TranscriptionOptions
    ): Promise<string> {
        const responseFormat = options.response_format || 'json';
        
        if (responseFormat === 'text') {
            return await response.text();
        }

        const result = await response.json() as TranscriptionResult;
        return result.text;
    }

    /**
     * Парсинг ошибок API
     */
    private async parseErrorResponse(response: Response): Promise<any> {
        try {
            return await response.json();
        } catch {
            return { message: response.statusText };
        }
    }

    /**
     * Создание API ошибки
     */
    private createApiError(status: number, statusText: string, errorData: any): WhisperError {
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
    private createError(
        message: string, 
        code?: string, 
        statusCode?: number, 
        details?: any
    ): WhisperError {
        const error = new Error(message) as WhisperError;
        error.code = code;
        error.statusCode = statusCode;
        error.details = details;
        return error;
    }

    /**
     * Улучшение существующей ошибки
     */
    private enhanceError(error: Error): WhisperError {
        if (error.name === 'AbortError') {
            return this.createError('Превышено время ожидания ответа API', 'TIMEOUT');
        }

        if (error.message.includes('fetch')) {
            return this.createError('Ошибка сети при подключении к API', 'NETWORK_ERROR');
        }

        return error as WhisperError;
    }

    /**
     * Проверка возможности повтора запроса
     */
    private isRetryableError(error: any): boolean {
        if (error.code === 'TIMEOUT' || error.code === 'NETWORK_ERROR') {
            return true;
        }

        const retryableStatuses = [429, 500, 502, 503, 504];
        return retryableStatuses.includes(error.statusCode);
    }

    /**
     * Задержка для повторных попыток
     */
    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Статическая валидация API ключа
     */
    static validateApiKey(apiKey: string): boolean {
        if (!apiKey || typeof apiKey !== 'string') {
            return false;
        }

        // OpenAI ключи начинаются с sk- и имеют определенную длину
        return apiKey.startsWith('sk-') && apiKey.length >= 48;
    }

    /**
     * Получение поддерживаемых форматов
     */
    static getSupportedFormats(): string[] {
        return [
            'flac', 'mp3', 'mp4', 'mpeg', 'mpga', 'm4a', 'ogg', 'wav', 'webm'
        ];
    }

    /**
     * Получение максимального размера файла
     */
    static getMaxFileSize(): number {
        return 25 * 1024 * 1024; // 25MB
    }
} 