// TextProcessingPipeline.ts - Coordinator for the complete text processing workflow

import { WhisperClient, TranscriptionOptions } from './WhisperClient';
import { PostProcessingService, PostProcessingResult } from './PostProcessingService';
import { TextInserter } from '../ui/TextInserter';
import { ConfigurationManager } from './ConfigurationManager';
import { ExtensionLog } from '../utils/GlobalOutput';

export interface ProcessingStep {
    name: string;
    status: 'pending' | 'in-progress' | 'completed' | 'failed' | 'skipped';
    startTime?: number;
    endTime?: number;
    error?: Error;
    result?: any;
}

export interface PipelineResult {
    success: boolean;
    originalAudioBlob: Blob;
    transcriptionResult?: string;
    postProcessingResult?: PostProcessingResult;
    finalText: string;
    steps: ProcessingStep[];
    totalProcessingTime: number;
    insertionMode: 'cursor' | 'clipboard';
    error?: Error;
}

export interface ProcessingProgress {
    currentStep: string;
    stepIndex: number;
    totalSteps: number;
    message: string;
}

export type ProgressCallback = (progress: ProcessingProgress) => void;

/**
 * Coordinates the complete text processing workflow:
 * Audio Blob → Whisper Transcription → Post-processing → Text Insertion
 */
export class TextProcessingPipeline {
    private whisperClient: WhisperClient;
    private postProcessingService: PostProcessingService;
    private textInserter: TextInserter;
    private configurationManager: ConfigurationManager;

    constructor(
        whisperClient: WhisperClient,
        postProcessingService: PostProcessingService,
        textInserter: TextInserter,
        configurationManager: ConfigurationManager
    ) {
        this.whisperClient = whisperClient;
        this.postProcessingService = postProcessingService;
        this.textInserter = textInserter;
        this.configurationManager = configurationManager;
    }

    /**
     * Execute the complete processing pipeline
     */
    async processAudio(
        audioBlob: Blob,
        insertionMode: 'cursor' | 'clipboard' = 'cursor',
        progressCallback?: ProgressCallback,
        skipTextInsertion: boolean = false
    ): Promise<PipelineResult> {
        const startTime = Date.now();
        const steps: ProcessingStep[] = [];
        
        ExtensionLog.info(`🔄 [PIPELINE] Starting audio processing pipeline`, {
            audioBlobSize: audioBlob.size,
            insertionMode: insertionMode
        });

        try {
            // Step 1: Whisper Transcription
            const transcriptionStep = this.createStep('Whisper Transcription');
            steps.push(transcriptionStep);
            this.updateProgress(progressCallback, 'Transcribing audio...', 0, 3);

            const transcriptionResult = await this.executeTranscription(audioBlob, transcriptionStep);
            
            if (!transcriptionResult) {
                return this.createFailureResult(audioBlob, steps, startTime, insertionMode, new Error('Transcription failed'));
            }

            // Step 2: Post-processing (conditional)
            const postProcessingStep = this.createStep('Post-processing');
            steps.push(postProcessingStep);
            this.updateProgress(progressCallback, 'Improving text quality...', 1, 3);

            const postProcessingResult = await this.executePostProcessing(transcriptionResult, postProcessingStep);
            const finalText = postProcessingResult.processedText;

            // Step 3: Text Insertion
            const insertionStep = this.createStep('Text Insertion');
            steps.push(insertionStep);
            this.updateProgress(progressCallback, 'Inserting text...', 2, 3);

            if (!skipTextInsertion) {
                await this.executeTextInsertion(finalText, insertionMode, insertionStep);
            } else {
                // Mark step as skipped
                insertionStep.status = 'skipped';
                insertionStep.startTime = Date.now();
                insertionStep.endTime = Date.now();
                insertionStep.result = { mode: 'skipped', reason: 'Special mode handling' };
                
                ExtensionLog.info(`🔄 [PIPELINE] Text insertion skipped (special mode handling):`, {
                    insertionMode: insertionMode,
                    skipTextInsertion: skipTextInsertion
                });
            }

            const totalTime = Date.now() - startTime;
            ExtensionLog.info(`🔄 [PIPELINE] Processing completed successfully`, {
                totalTime: totalTime,
                originalLength: transcriptionResult.length,
                finalLength: finalText.length,
                wasPostProcessed: postProcessingResult.wasProcessed,
                insertionMode: insertionMode
            });

            return {
                success: true,
                originalAudioBlob: audioBlob,
                transcriptionResult: transcriptionResult,
                postProcessingResult: postProcessingResult,
                finalText: finalText,
                steps: steps,
                totalProcessingTime: totalTime,
                insertionMode: insertionMode
            };

        } catch (error) {
            ExtensionLog.error(`🔄 [PIPELINE] Processing failed:`, undefined, error as Error);
            return this.createFailureResult(audioBlob, steps, startTime, insertionMode, error as Error);
        }
    }

    /**
     * Execute Whisper transcription step
     */
    private async executeTranscription(audioBlob: Blob, step: ProcessingStep): Promise<string | null> {
        step.status = 'in-progress';
        step.startTime = Date.now();

        try {
            // Check if whisperClient is initialized
            if (!this.whisperClient) {
                throw new Error('WhisperClient not initialized. Please check your OpenAI API key configuration.');
            }

            const whisperConfig = this.configurationManager.getWhisperConfiguration();
            const options: TranscriptionOptions = {
                language: whisperConfig.language === 'auto' ? undefined : whisperConfig.language,
                model: whisperConfig.whisperModel,
                prompt: whisperConfig.prompt,
                temperature: whisperConfig.temperature,
                response_format: 'text'
            };

            // Log all transcription parameters
            ExtensionLog.info(`🔄 [PIPELINE] Whisper transcription parameters:`, {
                language: options.language || 'auto-detect',
                model: options.model,
                prompt: options.prompt || '(no prompt)',
                temperature: options.temperature,
                responseFormat: options.response_format,
                audioSize: `${(audioBlob.size / 1024).toFixed(2)} KB`,
                audioType: audioBlob.type
            });

            const result = await this.whisperClient.transcribe(audioBlob, options);
            
            step.status = 'completed';
            step.endTime = Date.now();
            step.result = { text: result, length: result.length };

            ExtensionLog.info(`🔄 [PIPELINE] Transcription completed:`, {
                textLength: result.length,
                processingTime: step.endTime - (step.startTime || 0),
                transcribedText: result,
                wordCount: result.split(' ').length
            });

            return result;

        } catch (error) {
            step.status = 'failed';
            step.endTime = Date.now();
            step.error = error as Error;
            
            ExtensionLog.error(`🔄 [PIPELINE] Transcription failed:`, undefined, error as Error);
            throw error;
        }
    }

    /**
     * Execute post-processing step
     */
    private async executePostProcessing(text: string, step: ProcessingStep): Promise<PostProcessingResult> {
        step.status = 'in-progress';
        step.startTime = Date.now();

        try {
            // Check if post-processing should be applied
            if (!this.postProcessingService.shouldProcess(text)) {
                step.status = 'skipped';
                step.endTime = Date.now();
                
                ExtensionLog.info(`🔄 [PIPELINE] Post-processing skipped`);
                
                return {
                    originalText: text,
                    processedText: text,
                    wasProcessed: false
                };
            }

            const result = await this.postProcessingService.processText(text);
            
            step.status = 'completed';
            step.endTime = Date.now();
            step.result = {
                wasProcessed: result.wasProcessed,
                originalLength: result.originalText.length,
                processedLength: result.processedText.length,
                model: result.model,
                processingTime: result.processingTime
            };

            ExtensionLog.info(`🔄 [PIPELINE] Post-processing completed:`, {
                wasProcessed: result.wasProcessed,
                processingTime: step.endTime - (step.startTime || 0),
                originalText: result.originalText,
                processedText: result.processedText,
                textImproved: result.processedText !== result.originalText,
                model: result.model || 'unknown'
            });

            return result;

        } catch (error) {
            step.status = 'failed';
            step.endTime = Date.now();
            step.error = error as Error;
            
            ExtensionLog.error(`🔄 [PIPELINE] Post-processing failed, using original text:`, undefined, error as Error);
            
            // Fallback to original text on error
            return {
                originalText: text,
                processedText: text,
                wasProcessed: false
            };
        }
    }

    /**
     * Execute text insertion step
     */
    private async executeTextInsertion(text: string, mode: 'cursor' | 'clipboard', step: ProcessingStep): Promise<void> {
        step.status = 'in-progress';
        step.startTime = Date.now();

        try {
            // Use the universal insertText method which has fallback logic
            await this.textInserter.insertText(text, { mode: mode });
            
            step.status = 'completed';
            step.endTime = Date.now();
            step.result = { mode: mode, textLength: text.length };

            ExtensionLog.info(`🔄 [PIPELINE] Text insertion completed:`, {
                mode: mode,
                textLength: text.length,
                processingTime: step.endTime - (step.startTime || 0)
            });

        } catch (error) {
            step.status = 'failed';
            step.endTime = Date.now();
            step.error = error as Error;
            
            ExtensionLog.error(`🔄 [PIPELINE] Text insertion failed:`, undefined, error as Error);
            throw error;
        }
    }

    /**
     * Create a new processing step
     */
    private createStep(name: string): ProcessingStep {
        return {
            name: name,
            status: 'pending'
        };
    }

    /**
     * Update progress callback if provided
     */
    private updateProgress(callback: ProgressCallback | undefined, message: string, stepIndex: number, totalSteps: number): void {
        if (callback) {
            callback({
                currentStep: message,
                stepIndex: stepIndex,
                totalSteps: totalSteps,
                message: message
            });
        }
    }

    /**
     * Create a failure result
     */
    private createFailureResult(
        audioBlob: Blob,
        steps: ProcessingStep[],
        startTime: number,
        insertionMode: 'cursor' | 'clipboard',
        error: Error
    ): PipelineResult {
        const totalTime = Date.now() - startTime;
        
        return {
            success: false,
            originalAudioBlob: audioBlob,
            finalText: '',
            steps: steps,
            totalProcessingTime: totalTime,
            insertionMode: insertionMode,
            error: error
        };
    }

    /**
     * Get pipeline configuration status
     */
    getConfigurationStatus(): {
        whisperConfigured: boolean;
        postProcessingEnabled: boolean;
        postProcessingConfigured: boolean;
    } {
        const whisperConfig = this.configurationManager.getWhisperConfiguration();
        const postProcessingStatus = this.postProcessingService.getConfigurationStatus();

        return {
            whisperConfigured: !!whisperConfig.apiKey,
            postProcessingEnabled: postProcessingStatus.isEnabled,
            postProcessingConfigured: postProcessingStatus.isConfigValid
        };
    }

    /**
     * Validate pipeline configuration
     */
    validateConfiguration(): { isValid: boolean; errors: string[] } {
        const errors: string[] = [];
        
        // Validate Whisper configuration
        const whisperConfig = this.configurationManager.getWhisperConfiguration();
        if (!whisperConfig.apiKey) {
            errors.push('OpenAI API key is required');
        }

        // Validate post-processing configuration if enabled
        const postProcessingStatus = this.postProcessingService.getConfigurationStatus();
        if (postProcessingStatus.isEnabled && !postProcessingStatus.isConfigValid) {
            errors.push(...postProcessingStatus.validationResult.errors);
        }

        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }

    /**
     * Reset all services (useful for configuration changes)
     */
    reset(): void {
        this.postProcessingService.resetProcessor();
        ExtensionLog.info(`🔄 [PIPELINE] Pipeline reset`);
    }

    /**
     * Dispose of resources
     */
    dispose(): void {
        this.postProcessingService.dispose();
        ExtensionLog.info(`🔄 [PIPELINE] Pipeline disposed`);
    }
} 