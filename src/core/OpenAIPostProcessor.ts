// OpenAIPostProcessor.ts - HTTP client for text post-processing using OpenAI GPT API

import { ExtensionLog } from '../utils/GlobalOutput';
import { SUPPORTED_OPENAI_MODELS, DEFAULT_OPENAI_MODEL, getSupportedModels } from './OpenAIModels';

export interface PostProcessingOptions {
    model?: string;         // OpenAI model to use (gpt-4.1-mini-2025-04-14, gpt-4o-mini-2024-07-18, etc.)
    prompt?: string;        // Custom prompt for text improvement
    temperature?: number;   // 0-1, creativity (0 = deterministic)
    maxTokens?: number;     // Maximum tokens in response
}

export interface PostProcessingResult {
    processedText: string;
    originalText: string;
    model: string;
    tokensUsed?: number;
}

export interface PostProcessingError extends Error {
    code?: string;
    statusCode?: number;
    details?: any;
}

export interface OpenAIResponse {
    choices: Array<{
        message: {
            content: string;
        };
    }>;
    usage?: {
        total_tokens: number;
        prompt_tokens: number;
        completion_tokens: number;
    };
}

export interface OpenAIPostProcessorConfig {
    apiKey: string;
    baseURL?: string;
    timeout?: number;
    maxRetries?: number;
    retryDelay?: number;
}

/**
 * HTTP client for post-processing text using OpenAI GPT API
 */
export class OpenAIPostProcessor {
    private apiKey: string;
    private baseURL: string;
    private timeout: number;
    private maxRetries: number;
    private retryDelay: number;

    // Use centralized model list
    private readonly supportedModels = SUPPORTED_OPENAI_MODELS;

    constructor(config: OpenAIPostProcessorConfig) {
        this.apiKey = config.apiKey;
        this.baseURL = config.baseURL || 'https://api.openai.com/v1';
        this.timeout = config.timeout || 30000; // 30 seconds
        this.maxRetries = config.maxRetries || 3;
        this.retryDelay = config.retryDelay || 1000; // 1 second
    }

    /**
     * Process text to improve quality
     */
    async processText(text: string, options: PostProcessingOptions = {}): Promise<string> {
        // Validate input
        this.validateText(text);
        
        const model = options.model || DEFAULT_OPENAI_MODEL;
        this.validateModel(model);

        // Log the request parameters
        this.logRequestParameters(text, options);

        // Prepare the request payload
        const requestBody = this.prepareRequestBody(text, options);
        
        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            try {
                const response = await this.makeRequest('/chat/completions', requestBody);
                return this.processResponse(response, text);
            } catch (error) {
                ExtensionLog.error(`🤖 [POST-PROCESSOR] Attempt ${attempt} failed:`, undefined, error as Error);
                
                const isRetryable = this.isRetryableError(error);
                const enhancedError = this.enhanceError(error as Error);
                
                if (attempt === this.maxRetries || !isRetryable) {
                    // Fallback: return original text on any error
                    ExtensionLog.warn(`🤖 [POST-PROCESSOR] All attempts failed, returning original text`);
                    return text;
                }
                
                // Wait before the next attempt
                await this.delay(this.retryDelay * attempt);
            }
        }
        
        // Final fallback (should not reach here, but just in case)
        ExtensionLog.warn(`🤖 [POST-PROCESSOR] Exhausted all retries, returning original text`);
        return text;
    }

    /**
     * Check if API key is valid
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
     * Validate input text
     */
    private validateText(text: string): void {
        if (!text || text.trim().length === 0) {
            throw this.createError('Input text is empty', 'EMPTY_TEXT');
        }

        // OpenAI has a context limit, but we'll let the API handle that
        if (text.length > 100000) { // 100k characters as a reasonable limit
            throw this.createError('Text is too long for processing', 'TEXT_TOO_LONG');
        }
    }

    /**
     * Validate model selection
     */
    private validateModel(model: string): void {
        if (!(this.supportedModels as readonly string[]).includes(model)) {
            throw this.createError(`Unsupported model: ${model}`, 'UNSUPPORTED_MODEL');
        }
    }

    /**
     * Prepare request body for OpenAI API
     */
    private prepareRequestBody(text: string, options: PostProcessingOptions): any {
        const model = options.model || DEFAULT_OPENAI_MODEL;
        const temperature = options.temperature ?? 0.1; // Low temperature for consistency
        const maxTokens = options.maxTokens || 4000; // Reasonable limit

        // Build the complete prompt by concatenating prompt with original text
        const userPrompt = options.prompt || this.getDefaultPrompt();
        const fullPrompt = `${userPrompt} ${text}`;
        
        return {
            model: model,
            messages: [
                {
                    role: 'user',
                    content: fullPrompt
                }
            ],
            temperature: temperature,
            max_tokens: maxTokens,
            stream: false
        };
    }

    /**
     * Get default prompt for text improvement
     */
    private getDefaultPrompt(): string {
        return `Please improve this transcribed text by:
1. Adding proper punctuation and capitalization
2. Removing filler words (um, uh, like, you know)
3. Always try to structure sentences for lists and paragraphs for better readability
4. Maintaining the original meaning and technical terms
5. Return improved text without any additional text or explanations

Return only the improved text without any additional comments or explanations.`;
    }

    /**
     * Log request parameters
     */
    private logRequestParameters(text: string, options: PostProcessingOptions): void {
        const prompt = options.prompt || this.getDefaultPrompt();
        const fullRequest = `${prompt} ${text}`;
        
        const requestInfo = {
            endpoint: `${this.baseURL}/chat/completions`,
            method: 'POST',
            parameters: {
                model: options.model || DEFAULT_OPENAI_MODEL,
                temperature: options.temperature ?? 0.1,
                maxTokens: options.maxTokens || 4000,
                promptLength: prompt.length,
                originalTextLength: text.length,
                fullRequestLength: fullRequest.length
            }
        };

        ExtensionLog.info(`🤖 [POST-PROCESSOR] Starting text processing:`, requestInfo);
        
        ExtensionLog.info(`🤖 [POST-PROCESSOR] === POST-PROCESSING DETAILS ===`);
        
        // Log configuration prompt (user's template)
        ExtensionLog.info(`🤖 [POST-PROCESSOR] User prompt template:`, {
            prompt: prompt,
            promptLength: prompt.length,
            note: "This is the prompt from settings that will be concatenated with original text"
        });
        
        // Log original text from Whisper
        ExtensionLog.info(`🤖 [POST-PROCESSOR] Original text from Whisper:`, {
            originalText: text,
            wordCount: text.split(' ').length,
            charCount: text.length,
            note: "This text will be appended to the prompt above"
        });
        
        // Log the complete request that will be sent to AI
        ExtensionLog.info(`🤖 [POST-PROCESSOR] Complete request sent to AI:`, {
            fullRequest: fullRequest,
            totalLength: fullRequest.length,
            note: "This is the final text sent to OpenAI API (prompt + original text)"
        });
        
        ExtensionLog.info(`🤖 [POST-PROCESSOR] === END POST-PROCESSING DETAILS ===`);
    }

    /**
     * Make HTTP request to OpenAI API
     */
    private async makeRequest(endpoint: string, requestBody: any): Promise<Response> {
        const url = `${this.baseURL}${endpoint}`;
        
        // Log the actual request being sent
        ExtensionLog.info(`🤖 [POST-PROCESSOR] Sending HTTP request:`, {
            url: url,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey.substring(0, 7)}...`,
                'User-Agent': 'SpeechToTextWhisper-Extension/1.0'
            },
            bodySize: JSON.stringify(requestBody).length,
            timeout: this.timeout
        });
        
        // Log the complete request body structure
        ExtensionLog.info(`🤖 [POST-PROCESSOR] Request body structure:`, {
            model: requestBody.model,
            temperature: requestBody.temperature,
            max_tokens: requestBody.max_tokens,
            messagesCount: requestBody.messages.length,
            requestBody: requestBody,
            note: "Complete OpenAI API request payload"
        });
        
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`,
                'User-Agent': 'SpeechToTextWhisper-Extension/1.0'
            },
            body: JSON.stringify(requestBody),
            signal: AbortSignal.timeout(this.timeout)
        });

        // Log response status
        ExtensionLog.info(`🤖 [POST-PROCESSOR] Received HTTP response:`, {
            status: response.status,
            statusText: response.statusText,
            headers: {
                'content-type': response.headers.get('content-type'),
                'content-length': response.headers.get('content-length')
            }
        });

        if (!response.ok) {
            const errorData = await this.parseErrorResponse(response);
            throw this.createApiError(response.status, response.statusText, errorData);
        }

        return response;
    }

    /**
     * Process API response
     */
    private async processResponse(response: Response, originalText: string): Promise<string> {
        try {
            const result = await response.json() as OpenAIResponse;
            
            if (!result.choices || result.choices.length === 0) {
                throw this.createError('No choices in API response', 'NO_CHOICES');
            }

            const processedText = result.choices[0].message?.content?.trim();
            
            if (!processedText) {
                ExtensionLog.warn(`🤖 [POST-PROCESSOR] Empty response, returning original text`);
                return originalText;
            }

            ExtensionLog.info(`🤖 [POST-PROCESSOR] Text processed successfully:`, {
                originalLength: originalText.length,
                processedLength: processedText.length,
                tokensUsed: result.usage?.total_tokens || 'unknown'
            });
            
            // Log full processed text
            ExtensionLog.info(`🤖 [POST-PROCESSOR] Full processed result:`, {
                processedText: processedText,
                wordCountBefore: originalText.split(' ').length,
                wordCountAfter: processedText.split(' ').length,
                improvementApplied: processedText !== originalText
            });

            return processedText;
        } catch (error) {
            ExtensionLog.error(`🤖 [POST-PROCESSOR] Error processing response:`, undefined, error as Error);
            throw this.enhanceError(error as Error);
        }
    }

    /**
     * Parse error response from API
     */
    private async parseErrorResponse(response: Response): Promise<any> {
        try {
            return await response.json();
        } catch {
            return { error: { message: response.statusText } };
        }
    }

    /**
     * Create API error with detailed information
     */
    private createApiError(status: number, statusText: string, errorData: any): PostProcessingError {
        let message = `OpenAI API Error: ${status} ${statusText}`;
        let code = `HTTP_${status}`;

        if (errorData?.error?.message) {
            message = errorData.error.message;
        }

        if (errorData?.error?.code) {
            code = errorData.error.code;
        }

        // Handle specific error cases
        switch (status) {
            case 401:
                message = 'Invalid API key for OpenAI';
                code = 'INVALID_API_KEY';
                break;
            case 429:
                message = 'Rate limit exceeded for OpenAI API';
                code = 'RATE_LIMIT_EXCEEDED';
                break;
            case 500:
                message = 'OpenAI server error';
                code = 'SERVER_ERROR';
                break;
        }

        return this.createError(message, code, status, errorData);
    }

    /**
     * Create enhanced error object
     */
    private createError(
        message: string, 
        code?: string, 
        statusCode?: number, 
        details?: any
    ): PostProcessingError {
        const error = new Error(message) as PostProcessingError;
        error.name = 'PostProcessingError';
        if (code) error.code = code;
        if (statusCode) error.statusCode = statusCode;
        if (details) error.details = details;
        return error;
    }

    /**
     * Enhance generic error with additional context
     */
    private enhanceError(error: Error): PostProcessingError {
        if (error.name === 'PostProcessingError') {
            return error as PostProcessingError;
        }

        const enhanced = this.createError(error.message);
        enhanced.stack = error.stack;

        // Handle specific error types
        if (error.name === 'AbortError') {
            enhanced.code = 'TIMEOUT';
            enhanced.message = 'Post-processing request timed out';
        } else if (error.name === 'TypeError' && error.message.includes('fetch')) {
            enhanced.code = 'NETWORK_ERROR';
            enhanced.message = 'Network error during post-processing';
        }

        return enhanced;
    }

    /**
     * Check if error is retryable
     */
    private isRetryableError(error: any): boolean {
        // Network errors and timeouts are retryable
        if (error.name === 'AbortError' || error.name === 'TypeError') {
            return true;
        }

        // HTTP errors
        if (error.statusCode) {
            // Retry on server errors and rate limits
            return error.statusCode >= 500 || error.statusCode === 429;
        }

        // Default to retryable for unknown errors
        return true;
    }

    /**
     * Delay utility for retries
     */
    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Static method to validate API key format
     */
    static validateApiKey(apiKey: string): boolean {
        return typeof apiKey === 'string' && 
               apiKey.length > 0 && 
               apiKey.startsWith('sk-');
    }

    /**
     * Get supported models
     */
    static getSupportedModels(): readonly string[] {
        return getSupportedModels();
    }
} 