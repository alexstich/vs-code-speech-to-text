// WhisperClient.ts - HTTP client for integration with OpenAI Whisper API

export interface TranscriptionOptions {
    language?: string;      // ISO 639-1 code of the language or 'auto' for auto-detection
    prompt?: string;        // Contextual prompt for improving accuracy
    temperature?: number;   // 0-1, creativity (0 = deterministic)
    response_format?: 'json' | 'text' | 'srt' | 'verbose_json' | 'vtt';
    timestamp_granularities?: ('word' | 'segment')[];
    model?: string;         // Whisper model to use
    confidence_threshold?: number; // Minimum confidence for language auto-detection
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
 * HTTP client for integration with OpenAI Whisper API
 */
export class WhisperClient {
    private apiKey: string;
    private baseURL: string;
    private timeout: number;
    private maxRetries: number;
    private retryDelay: number;

    // Supported audio formats
    private readonly supportedFormats = [
        'flac', 'mp3', 'mp4', 'mpeg', 'mpga', 'm4a', 'ogg', 'wav', 'webm'
    ];

    // Maximum file size (25MB)
    private readonly maxFileSize = 25 * 1024 * 1024;

    constructor(config: WhisperClientConfig) {
        this.apiKey = config.apiKey;
        this.baseURL = config.baseURL || 'https://api.openai.com/v1';
        this.timeout = config.timeout || 30000; // 30 seconds
        this.maxRetries = config.maxRetries || 3;
        this.retryDelay = config.retryDelay || 1000; // 1 second
    }

    /**
     * Transcription of an audio file
     */
    async transcribe(audioBlob: Blob, options: TranscriptionOptions = {}): Promise<string> {
        this.validateAudioBlob(audioBlob);
        
        const formData = this.prepareFormData(audioBlob, options);
        
        // Log the request parameters
        this.logRequestParameters(audioBlob, options);
        
        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            try {
                const response = await this.makeRequest('/audio/transcriptions', formData);
                return this.processTranscriptionResponse(response, options);
            } catch (error) {
                // Check retryable for correct logic
                const isRetryable = this.isRetryableError(error);
                const enhancedError = this.enhanceError(error as Error);
                
                if (attempt === this.maxRetries || !isRetryable) {
                    throw enhancedError;
                }
                
                // Wait before the next attempt
                await this.delay(this.retryDelay * attempt);
            }
        }
        
        throw new Error('All transcription attempts have been exhausted');
    }

    /**
     * Checking the validity of the API key
     */
    async checkApiKey(): Promise<boolean> {
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
        } catch {
            return false;
        }
    }

    /**
     * Getting information about the use of the API
     */
    async getUsage(): Promise<any> {
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
        } catch (error) {
            throw this.enhanceError(error as Error);
        }
    }

    /**
     * Validation of the audio blob
     */
    private validateAudioBlob(audioBlob: Blob): void {
        if (!audioBlob || audioBlob.size === 0) {
            throw this.createError('Audio file is empty', 'EMPTY_AUDIO');
        }

        if (audioBlob.size > this.maxFileSize) {
            throw this.createError(
                `File size exceeds the limit of ${this.maxFileSize / (1024 * 1024)}MB`,
                'FILE_TOO_LARGE'
            );
        }

        // Check the format by MIME type
        const mimeType = audioBlob.type;
        if (mimeType && !this.isSupportedFormat(mimeType)) {
            console.warn(`Unsupported MIME type: ${mimeType}. Continuing...`);
        }
    }

    /**
     * Checking the support of the format
     */
    private isSupportedFormat(mimeType: string): boolean {
        return this.supportedFormats.some(format => 
            mimeType.includes(format) || mimeType.includes(`audio/${format}`)
        );
    }

    /**
     * Preparing FormData for the request
     */
    private prepareFormData(audioBlob: Blob, options: TranscriptionOptions): FormData {
        const formData = new FormData();
        
        // Determine the file extension based on the MIME type
        const extension = this.getFileExtension(audioBlob.type);
        formData.append('file', audioBlob, `audio.${extension}`);
        
        // Model (default whisper-1, but can be configured)
        const model = options.model || 'whisper-1';
        formData.append('model', model);

        // Add options
        if (options.language && options.language !== 'auto') {
            formData.append('language', options.language);
        }

        if (options.prompt) {
            formData.append('prompt', options.prompt);
        }

        // Temperature for determining creativity
        const temperature = options.temperature ?? 0;
        formData.append('temperature', temperature.toString());

        // Response format (support new variants)
        if (options.response_format) {
            formData.append('response_format', options.response_format);
        }

        // Timestamp granularities (only for json formats)
        if (options.timestamp_granularities && 
            (options.response_format === 'verbose_json' || options.response_format === 'json')) {
            formData.append('timestamp_granularities[]', options.timestamp_granularities.join(','));
        }

        return formData;
    }

    /**
     * Getting the file extension by MIME type
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
     * Logging the request parameters to the Whisper API
     */
    private logRequestParameters(audioBlob: Blob, options: TranscriptionOptions): void {
        const requestInfo = {
            endpoint: `${this.baseURL}/audio/transcriptions`,
            method: 'POST',
            parameters: {
                model: options.model || 'whisper-1',
                language: options.language && options.language !== 'auto' ? options.language : 'auto-detect',
                prompt: options.prompt || '(no prompt)',
                temperature: options.temperature ?? 0,
                response_format: options.response_format || 'json',
                timestamp_granularities: options.timestamp_granularities || '(not specified)'
            },
            audioFile: {
                size: `${(audioBlob.size / 1024).toFixed(2)} KB`,
                type: audioBlob.type || 'unknown',
                extension: this.getFileExtension(audioBlob.type)
            }
        };

        console.log('🚀 [WHISPER REQUEST] Sending a request to the Whisper API:');
        console.log(JSON.stringify(requestInfo, null, 2));
    }

    /**
     * Performing an HTTP request
     */
    private async makeRequest(endpoint: string, formData: FormData): Promise<Response> {
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
        } catch (error) {
            clearTimeout(timeoutId);
            throw error;
        }
    }

    /**
     * Processing the transcription response
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
     * Parsing API errors
     */
    private async parseErrorResponse(response: Response): Promise<any> {
        try {
            return await response.json();
        } catch {
            return { message: response.statusText };
        }
    }

    /**
     * Creating an API error
     */
    private createApiError(status: number, statusText: string, errorData: any): WhisperError {
        let message = `OpenAI API Error: ${status} ${statusText}`;
        let code = 'API_ERROR';

        if (errorData?.error) {
            message = errorData.error.message || message;
            code = errorData.error.code || code;
        }

        // Specific messages for different error codes
        switch (status) {
            case 401:
                message = 'Invalid OpenAI API key';
                code = 'INVALID_API_KEY';
                break;
            case 429:
                message = 'API request limit exceeded. Please try again later';
                code = 'RATE_LIMIT_EXCEEDED';
                break;
            case 413:
                message = 'File too large for processing';
                code = 'FILE_TOO_LARGE';
                break;
            case 400:
                if (errorData?.error?.message?.includes('audio')) {
                    message = 'Unsupported audio format';
                    code = 'UNSUPPORTED_FORMAT';
                }
                break;
        }

        return this.createError(message, code, status, errorData);
    }

    /**
     * Creating an enhanced error
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
     * Improving an existing error
     */
    private enhanceError(error: Error): WhisperError {
        if (error.name === 'AbortError') {
            return this.createError('Timeout waiting for API response', 'TIMEOUT');
        }

        if (error.message.includes('fetch')) {
            return this.createError('Network error when connecting to the API', 'NETWORK_ERROR');
        }

        return error as WhisperError;
    }

    /**
     * Checking the possibility of repeating the request
     */
    private isRetryableError(error: any): boolean {
        // Check the type of error
        if (error.name === 'AbortError') {
            return true; // TIMEOUT - retryable
        }
        
        // Check network errors by message
        if (error.message && error.message.includes('fetch')) {
            return true; // NETWORK_ERROR - retryable
        }
        
        // Check by code (if already enhanced)
        if (error.code === 'TIMEOUT' || error.code === 'NETWORK_ERROR') {
            return true;
        }

        // Check by HTTP status
        const retryableStatuses = [429, 500, 502, 503, 504];
        return retryableStatuses.includes(error.statusCode);
    }

    /**
     * Delay for retries
     */
    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Static validation of the API key
     */
    static validateApiKey(apiKey: string): boolean {
        if (!apiKey || typeof apiKey !== 'string') {
            return false;
        }

        // OpenAI keys start with sk- and have a certain length
        return apiKey.startsWith('sk-') && apiKey.length >= 48;
    }

    /**
     * Getting supported formats
     */
    static getSupportedFormats(): string[] {
        return [
            'flac', 'mp3', 'mp4', 'mpeg', 'mpga', 'm4a', 'ogg', 'wav', 'webm'
        ];
    }

    /**
     * Getting the maximum file size
     */
    static getMaxFileSize(): number {
        return 25 * 1024 * 1024; // 25MB
    }
} 