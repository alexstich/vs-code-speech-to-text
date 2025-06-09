// OpenAIModels.ts - Central definition of supported OpenAI models

/**
 * Supported OpenAI models for post-processing (only models with dates)
 * Based on official OpenAI pricing page as of June 2025
 */
export const SUPPORTED_OPENAI_MODELS = [
    'Without post-processing',
    // GPT-4.1 series (April 2025)
    'gpt-4.1-2025-04-14',
    'gpt-4.1-mini-2025-04-14', 
    'gpt-4.1-nano-2025-04-14',
    // GPT-4.5 series (February 2025)
    'gpt-4.5-preview-2025-02-27',
    // GPT-4o series
    'gpt-4o-2024-08-06',
    'gpt-4o-mini-2024-07-18',
    // GPT-4 Turbo
    'gpt-4-turbo-2024-04-09',
    // GPT-3.5 series
    'gpt-3.5-turbo-0125',
    // o-series models
    'o1-2024-12-17',
    'o1-mini-2024-09-12',
    'o3-2025-04-16',
    'o3-mini-2025-01-31',
    'o4-mini-2025-04-16',
    // Special models
    'chatgpt-4o-latest'
] as const;

/**
 * Default model for post-processing
 */
export const DEFAULT_OPENAI_MODEL = 'gpt-4.1-mini-2025-04-14';

/**
 * Model descriptions for UI
 */
export const OPENAI_MODEL_DESCRIPTIONS = [
    'No post-processing - use original Whisper output',
    'GPT-4.1 (April 2025) - flagship model with specific date version',
    'GPT-4.1 Mini (April 2025) - compact flagship with date version (recommended)',
    'GPT-4.1 Nano (April 2025) - ultra-fast model with date version',
    'GPT-4.5 Preview (February 2025) - cutting-edge model with date',
    'GPT-4o (August 2024) - flagship model with specific date version',
    'GPT-4o mini (July 2024) - balanced model with specific date version',
    'GPT-4 Turbo (April 2024) - turbo model with specific date version',
    'GPT-3.5 Turbo (January 2025) - turbo model with date version',
    'o1 (December 2024) - reasoning model with specific date version',
    'o1-mini (September 2024) - compact reasoning with date version',
    'o3 (April 2025) - advanced reasoning model with date version',
    'o3-mini (January 2025) - compact reasoning model with date',
    'o4-mini (April 2025) - compact multimodal model with date',
    'ChatGPT-4o latest - continuously updated flagship model'
] as const;

/**
 * Type for supported models
 */
export type SupportedOpenAIModel = typeof SUPPORTED_OPENAI_MODELS[number];

/**
 * Check if a model is supported
 */
export function isSupportedModel(model: string): model is SupportedOpenAIModel {
    return SUPPORTED_OPENAI_MODELS.includes(model as SupportedOpenAIModel);
}

/**
 * Get all supported models as array
 */
export function getSupportedModels(): readonly string[] {
    return SUPPORTED_OPENAI_MODELS;
} 