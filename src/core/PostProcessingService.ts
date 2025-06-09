// PostProcessingService.ts - Main service for text post-processing coordination

import { OpenAIPostProcessor, PostProcessingOptions } from './OpenAIPostProcessor';
import { ConfigurationManager, PostProcessingConfiguration } from './ConfigurationManager';
import { ExtensionLog } from '../utils/GlobalOutput';
import { SUPPORTED_OPENAI_MODELS } from './OpenAIModels';

export interface PostProcessingResult {
    originalText: string;
    processedText: string;
    wasProcessed: boolean;
    model?: string;
    tokensUsed?: number;
    processingTime?: number;
}

export interface PostProcessingValidationResult {
    isValid: boolean;
    errors: string[];
    warnings: string[];
}

/**
 * Main service for coordinating text post-processing
 * Handles configuration validation, processing decisions, and integration with OpenAI
 */
export class PostProcessingService {
    private processor: OpenAIPostProcessor | null = null;
    private configurationManager: ConfigurationManager;

    constructor(configurationManager: ConfigurationManager) {
        this.configurationManager = configurationManager;
    }

    /**
     * Process text based on current configuration
     */
    async processText(text: string): Promise<PostProcessingResult> {
        const startTime = Date.now();
        const config = this.configurationManager.getPostProcessingConfiguration();
        
        try {
            ExtensionLog.info(`🧠 [POST-PROCESSING] Starting text processing`, {
                textLength: text.length,
                model: config.model,
                minTextLength: config.minTextLength
            });

            // Check if processing should occur
            if (!this.shouldProcess(text, config)) {
                ExtensionLog.info(`🧠 [POST-PROCESSING] Skipping processing (model: ${config.model}, length: ${text.length})`);
                return {
                    originalText: text,
                    processedText: text,
                    wasProcessed: false
                };
            }

            // Validate configuration before processing
            const validation = this.validateConfiguration();
            if (!validation.isValid) {
                ExtensionLog.error(`🧠 [POST-PROCESSING] Configuration invalid:`, validation.errors);
                return {
                    originalText: text,
                    processedText: text,
                    wasProcessed: false
                };
            }

            // Ensure processor is initialized
            await this.ensureProcessor();
            
            if (!this.processor) {
                ExtensionLog.error(`🧠 [POST-PROCESSING] Processor not available`);
                return {
                    originalText: text,
                    processedText: text,
                    wasProcessed: false
                };
            }

            // Process the text
            const options: PostProcessingOptions = {
                model: config.model,
                prompt: config.prompt,
                temperature: 0.1, // Low temperature for consistency
                maxTokens: Math.min(4000, Math.ceil(text.length * 2)) // Reasonable limit based on input
            };

            const processedText = await this.processor.processText(text, options);
            const processingTime = Date.now() - startTime;

            ExtensionLog.info(`🧠 [POST-PROCESSING] Processing completed`, {
                originalLength: text.length,
                processedLength: processedText.length,
                processingTime: processingTime,
                wasActuallyProcessed: processedText !== text
            });

            return {
                originalText: text,
                processedText: processedText,
                wasProcessed: processedText !== text, // True only if text was actually changed
                model: config.model,
                processingTime: processingTime
            };

        } catch (error) {
            const processingTime = Date.now() - startTime;
            ExtensionLog.error(`🧠 [POST-PROCESSING] Error during processing:`, undefined, error as Error);
            
            // Always return original text on error (fallback)
            return {
                originalText: text,
                processedText: text,
                wasProcessed: false,
                processingTime: processingTime
            };
        }
    }

    /**
     * Check if text should be processed based on configuration
     */
    shouldProcess(text: string, config?: PostProcessingConfiguration): boolean {
        const postConfig = config || this.configurationManager.getPostProcessingConfiguration();
        
        // Skip if model is set to "Without post-processing"
        if (postConfig.model === 'Without post-processing') {
            return false;
        }

        // Skip if text is empty or too short
        if (!text || text.trim().length === 0) {
            return false;
        }

        // Check minimum text length
        if (text.length < postConfig.minTextLength) {
            ExtensionLog.info(`🧠 [POST-PROCESSING] Text too short (${text.length} < ${postConfig.minTextLength})`);
            return false;
        }

        return true;
    }

    /**
     * Validate current configuration for post-processing
     */
    validateConfiguration(): PostProcessingValidationResult {
        const config = this.configurationManager.getPostProcessingConfiguration();
        const whisperConfig = this.configurationManager.getWhisperConfiguration();
        const errors: string[] = [];
        const warnings: string[] = [];

        // Check if API key is available
        if (!whisperConfig.apiKey || whisperConfig.apiKey.trim() === '') {
            errors.push('OpenAI API key is required for post-processing');
        }

        // Validate model selection 
        const validModels = SUPPORTED_OPENAI_MODELS as readonly string[];
        if (!validModels.includes(config.model)) {
            errors.push(`Invalid model selection: ${config.model}`);
        }

        // Validate timeout
        if (config.timeout <= 0) {
            errors.push('Timeout must be greater than 0');
        }

        // Validate minimum text length
        if (config.minTextLength < 0) {
            errors.push('Minimum text length cannot be negative');
        }

        // Check if prompt is empty (warning, not error)
        if (!config.prompt || config.prompt.trim().length === 0) {
            warnings.push('Post-processing prompt is empty, using default');
        }

        // Check for very long timeout (warning)
        if (config.timeout > 60000) {
            warnings.push('Timeout is very long (>60s), may affect user experience');
        }

        return {
            isValid: errors.length === 0,
            errors,
            warnings
        };
    }

    /**
     * Get current configuration status
     */
    getConfigurationStatus(): {
        isEnabled: boolean;
        model: string;
        minTextLength: number;
        isConfigValid: boolean;
        validationResult: PostProcessingValidationResult;
    } {
        const config = this.configurationManager.getPostProcessingConfiguration();
        const validation = this.validateConfiguration();
        
        return {
            isEnabled: config.model !== 'Without post-processing',
            model: config.model,
            minTextLength: config.minTextLength,
            isConfigValid: validation.isValid,
            validationResult: validation
        };
    }

    /**
     * Check if post-processing is currently enabled
     */
    isEnabled(): boolean {
        const config = this.configurationManager.getPostProcessingConfiguration();
        return config.model !== 'Without post-processing';
    }

    /**
     * Reset processor instance (useful for configuration changes)
     */
    resetProcessor(): void {
        this.processor = null;
        ExtensionLog.info(`🧠 [POST-PROCESSING] Processor reset`);
    }

    /**
     * Ensure processor is initialized with current configuration
     */
    private async ensureProcessor(): Promise<void> {
        if (this.processor) {
            return; // Already initialized
        }

        const whisperConfig = this.configurationManager.getWhisperConfiguration();
        const postConfig = this.configurationManager.getPostProcessingConfiguration();

        if (!whisperConfig.apiKey) {
            throw new Error('OpenAI API key is required for post-processing');
        }

        try {
            this.processor = new OpenAIPostProcessor({
                apiKey: whisperConfig.apiKey,
                timeout: postConfig.timeout,
                maxRetries: 3, // Fixed retry count
                retryDelay: 1000 // 1 second
            });

            // Validate the API key
            const isValidKey = await this.processor.checkApiKey();
            if (!isValidKey) {
                ExtensionLog.warn(`🧠 [POST-PROCESSING] API key validation failed`);
                this.processor = null;
                throw new Error('Invalid OpenAI API key');
            }

            ExtensionLog.info(`🧠 [POST-PROCESSING] Processor initialized successfully`);
        } catch (error) {
            ExtensionLog.error(`🧠 [POST-PROCESSING] Failed to initialize processor:`, undefined, error as Error);
            this.processor = null;
            throw error;
        }
    }

    /**
     * Dispose of resources
     */
    dispose(): void {
        this.processor = null;
        ExtensionLog.info(`🧠 [POST-PROCESSING] Service disposed`);
    }
} 