import * as vscode from 'vscode';
import { ErrorHandlerLog } from './GlobalOutput';

/**
 * Types of errors in the SpeechToTextWhisper system
 */
export enum ErrorType {
    MICROPHONE_ACCESS = 'microphone_access',
    MICROPHONE_PERMISSION = 'microphone_permission',
    MICROPHONE_COMPATIBILITY = 'microphone_compatibility',
    API_KEY_MISSING = 'api_key_missing',
    API_KEY_INVALID = 'api_key_invalid',
    API_REQUEST_FAILED = 'api_request_failed',
    API_RATE_LIMIT = 'api_rate_limit',
    API_QUOTA_EXCEEDED = 'api_quota_exceeded',
    NETWORK_ERROR = 'network_error',
    TRANSCRIPTION_FAILED = 'transcription_failed',
    TRANSCRIPTION_EMPTY = 'transcription_empty',
    TEXT_INSERTION_FAILED = 'text_insertion_failed',
    AUDIO_RECORDING_FAILED = 'audio_recording_failed',
    CONFIGURATION_ERROR = 'configuration_error',
    UNKNOWN_ERROR = 'unknown_error'
}

/**
 * Levels of error severity
 */
export enum ErrorSeverity {
    WARNING = 'warning',    // Warnings, not critical
    ERROR = 'error',        // Errors, require attention
    CRITICAL = 'critical'   // Critical errors, block work
}

/**
 * Recovery actions
 */
export enum RecoveryAction {
    NONE = 'none',
    RETRY = 'retry',
    CONFIGURE_API_KEY = 'configure_api_key',
    ENABLE_MICROPHONE = 'enable_microphone',
    CHECK_NETWORK = 'check_network',
    OPEN_SETTINGS = 'open_settings',
    REFRESH_EXTENSION = 'refresh_extension'
}

/**
 * Strategies for displaying errors
 */
export enum DisplayStrategy {
    POPUP = 'popup',           // Show popup notification
    STATUS_BAR = 'status_bar', // Show only in status bar
    CONSOLE = 'console',       // Only in console
    SILENT = 'silent'          // Silent processing
}

/**
 * Error configuration
 */
export interface ErrorConfig {
    type: ErrorType;
    severity: ErrorSeverity;
    displayStrategy: DisplayStrategy;
    recoveryAction: RecoveryAction;
    message: string;
    technicalDetails?: string;
    userActionRequired?: boolean;
    retryable?: boolean;
}

/**
 * Execution context for an error
 */
export interface ErrorContext {
    operation: string;
    isHoldToRecordMode?: boolean;
    attemptNumber?: number;
    timestamp: Date;
    additionalData?: Record<string, any>;
}

/**
 * Interface for displaying errors (dependency injection)
 */
export interface ErrorDisplayHandler {
    showError(message: string, severity: ErrorSeverity, actions?: string[]): Promise<string | undefined>;
    showWarning(message: string, actions?: string[]): Promise<string | undefined>;
    showInformation(message: string, actions?: string[]): Promise<string | undefined>;
    updateStatusBar(message: string, severity: ErrorSeverity): void;
}

/**
 * Implementation of error display through VS Code API
 */
export class VSCodeErrorDisplayHandler implements ErrorDisplayHandler {
    async showError(message: string, severity: ErrorSeverity, actions?: string[]): Promise<string | undefined> {
        if (severity === ErrorSeverity.CRITICAL) {
            return await vscode.window.showErrorMessage(`❌ ${message}`, ...(actions || []));
        } else {
            return await vscode.window.showErrorMessage(`❌ ${message}`, ...(actions || []));
        }
    }

    async showWarning(message: string, actions?: string[]): Promise<string | undefined> {
        return await vscode.window.showWarningMessage(`⚠️ ${message}`, ...(actions || []));
    }

    async showInformation(message: string, actions?: string[]): Promise<string | undefined> {
        return await vscode.window.showInformationMessage(`ℹ️ ${message}`, ...(actions || []));
    }

    updateStatusBar(message: string, severity: ErrorSeverity): void {
        // This function will be integrated with StatusBarManager
        ErrorHandlerLog.info(`[StatusBar] ${severity.toUpperCase()}: ${message}`);
    }
}

/**
 * Centralized error handler
 */
export class ErrorHandler {
    private displayHandler: ErrorDisplayHandler;
    private statusBarManager?: any; // Integration with StatusBarManager
    
    // Configurations for different types of errors
    private readonly errorConfigs: Map<ErrorType, ErrorConfig> = new Map([
        [ErrorType.MICROPHONE_ACCESS, {
            type: ErrorType.MICROPHONE_ACCESS,
            severity: ErrorSeverity.ERROR,
            displayStrategy: DisplayStrategy.POPUP,
            recoveryAction: RecoveryAction.ENABLE_MICROPHONE,
            message: 'Cannot access microphone. Please check your microphone settings.',
            userActionRequired: true
        }],
        [ErrorType.MICROPHONE_PERMISSION, {
            type: ErrorType.MICROPHONE_PERMISSION,
            severity: ErrorSeverity.ERROR,
            displayStrategy: DisplayStrategy.POPUP,
            recoveryAction: RecoveryAction.ENABLE_MICROPHONE,
            message: 'Microphone permission denied. Please allow microphone access.',
            userActionRequired: true
        }],
        [ErrorType.MICROPHONE_COMPATIBILITY, {
            type: ErrorType.MICROPHONE_COMPATIBILITY,
            severity: ErrorSeverity.CRITICAL,
            displayStrategy: DisplayStrategy.POPUP,
            recoveryAction: RecoveryAction.NONE,
            message: 'Your browser/environment does not support audio recording.',
            userActionRequired: false
        }],
        [ErrorType.API_KEY_MISSING, {
            type: ErrorType.API_KEY_MISSING,
            severity: ErrorSeverity.CRITICAL,
            displayStrategy: DisplayStrategy.POPUP,
            recoveryAction: RecoveryAction.CONFIGURE_API_KEY,
            message: 'OpenAI API key not configured. Please configure it in settings.',
            userActionRequired: true
        }],
        [ErrorType.API_KEY_INVALID, {
            type: ErrorType.API_KEY_INVALID,
            severity: ErrorSeverity.CRITICAL,
            displayStrategy: DisplayStrategy.POPUP,
            recoveryAction: RecoveryAction.CONFIGURE_API_KEY,
            message: 'Invalid OpenAI API key format. Please check your API key.',
            userActionRequired: true
        }],
        [ErrorType.API_RATE_LIMIT, {
            type: ErrorType.API_RATE_LIMIT,
            severity: ErrorSeverity.CRITICAL,
            displayStrategy: DisplayStrategy.POPUP,
            recoveryAction: RecoveryAction.RETRY,
            message: 'API rate limit exceeded. Please wait and try again.',
            retryable: true
        }],
        [ErrorType.API_QUOTA_EXCEEDED, {
            type: ErrorType.API_QUOTA_EXCEEDED,
            severity: ErrorSeverity.CRITICAL,
            displayStrategy: DisplayStrategy.POPUP,
            recoveryAction: RecoveryAction.CONFIGURE_API_KEY,
            message: 'API quota exceeded. Please check your OpenAI account.',
            userActionRequired: true
        }],
        [ErrorType.NETWORK_ERROR, {
            type: ErrorType.NETWORK_ERROR,
            severity: ErrorSeverity.ERROR,
            displayStrategy: DisplayStrategy.POPUP,
            recoveryAction: RecoveryAction.CHECK_NETWORK,
            message: 'Network error. Please check your internet connection.',
            retryable: true
        }],
        [ErrorType.TRANSCRIPTION_EMPTY, {
            type: ErrorType.TRANSCRIPTION_EMPTY,
            severity: ErrorSeverity.WARNING,
            displayStrategy: DisplayStrategy.STATUS_BAR,
            recoveryAction: RecoveryAction.RETRY,
            message: 'No speech detected in the audio. Try speaking louder or closer to the microphone.',
            retryable: true
        }],
        [ErrorType.TRANSCRIPTION_FAILED, {
            type: ErrorType.TRANSCRIPTION_FAILED,
            severity: ErrorSeverity.ERROR,
            displayStrategy: DisplayStrategy.POPUP,
            recoveryAction: RecoveryAction.RETRY,
            message: 'Transcription failed. Please try again.',
            retryable: true
        }],
        [ErrorType.TEXT_INSERTION_FAILED, {
            type: ErrorType.TEXT_INSERTION_FAILED,
            severity: ErrorSeverity.ERROR,
            displayStrategy: DisplayStrategy.POPUP,
            recoveryAction: RecoveryAction.RETRY,
            message: 'Failed to insert text. Please try again.',
            retryable: true
        }],
        [ErrorType.AUDIO_RECORDING_FAILED, {
            type: ErrorType.AUDIO_RECORDING_FAILED,
            severity: ErrorSeverity.WARNING,
            displayStrategy: DisplayStrategy.STATUS_BAR,
            recoveryAction: RecoveryAction.NONE,
            message: 'Audio recording issue detected.',
            retryable: false
        }],
        [ErrorType.CONFIGURATION_ERROR, {
            type: ErrorType.CONFIGURATION_ERROR,
            severity: ErrorSeverity.ERROR,
            displayStrategy: DisplayStrategy.POPUP,
            recoveryAction: RecoveryAction.OPEN_SETTINGS,
            message: 'Configuration error. Please check your settings.',
            userActionRequired: true
        }],
        [ErrorType.UNKNOWN_ERROR, {
            type: ErrorType.UNKNOWN_ERROR,
            severity: ErrorSeverity.ERROR,
            displayStrategy: DisplayStrategy.POPUP,
            recoveryAction: RecoveryAction.RETRY,
            message: 'An unexpected error occurred. Please try again.',
            retryable: true
        }]
    ]);

    constructor(displayHandler?: ErrorDisplayHandler, statusBarManager?: any) {
        this.displayHandler = displayHandler || new VSCodeErrorDisplayHandler();
        this.statusBarManager = statusBarManager;
    }

    /**
     * Handling an error by type
     */
    async handleError(
        errorType: ErrorType, 
        context: ErrorContext, 
        originalError?: Error
    ): Promise<string | undefined> {
        const config = this.errorConfigs.get(errorType);
        if (!config) {
            return await this.handleError(ErrorType.UNKNOWN_ERROR, context, originalError);
        }

        // Logging
        this.logError(config, context, originalError);

        // Updating the status bar if there is one
        if (this.statusBarManager) {
            this.statusBarManager.showError(config.message, config.severity);
        } else {
            this.displayHandler.updateStatusBar(config.message, config.severity);
        }

        // Displaying the error according to the strategy
        return await this.displayError(config, context);
    }

    /**
     * Handling an error from an exception
     */
    async handleErrorFromException(
        error: Error,
        context: ErrorContext
    ): Promise<string | undefined> {
        const errorType = this.classifyError(error);
        return await this.handleError(errorType, context, error);
    }

    /**
     * Classifying an error by message
     */
    private classifyError(error: Error): ErrorType {
        const message = error.message.toLowerCase();

        // API errors
        if (message.includes('api key') && message.includes('not configured')) {
            return ErrorType.API_KEY_MISSING;
        }
        if (message.includes('invalid') && message.includes('api key')) {
            return ErrorType.API_KEY_INVALID;
        }
        if (message.includes('rate limit') || message.includes('too many requests')) {
            return ErrorType.API_RATE_LIMIT;
        }
        if (message.includes('quota') || message.includes('insufficient funds')) {
            return ErrorType.API_QUOTA_EXCEEDED;
        }

        // Microphone errors
        if (message.includes('permission') && message.includes('microphone')) {
            return ErrorType.MICROPHONE_PERMISSION;
        }
        if (message.includes('microphone') || message.includes('media')) {
            return ErrorType.MICROPHONE_ACCESS;
        }
        if (message.includes('incompatible') || message.includes('not supported')) {
            return ErrorType.MICROPHONE_COMPATIBILITY;
        }

        // Transcription errors
        if (message.includes('no speech detected') || message.includes('empty audio')) {
            return ErrorType.TRANSCRIPTION_EMPTY;
        }
        if (message.includes('transcription') || message.includes('whisper')) {
            return ErrorType.TRANSCRIPTION_FAILED;
        }

        // Network errors
        if (message.includes('network') || message.includes('connection') || 
            message.includes('timeout') || message.includes('fetch')) {
            return ErrorType.NETWORK_ERROR;
        }

        // Text insertion errors
        if (message.includes('insert') || message.includes('text insertion')) {
            return ErrorType.TEXT_INSERTION_FAILED;
        }

        // Audio recording errors
        if (message.includes('recording') || message.includes('audio')) {
            return ErrorType.AUDIO_RECORDING_FAILED;
        }

        return ErrorType.UNKNOWN_ERROR;
    }

    /**
     * Displaying an error according to the strategy
     */
    private async displayError(config: ErrorConfig, context: ErrorContext): Promise<string | undefined> {
        const { displayStrategy, severity, recoveryAction } = config;
        
        // In hold-to-record mode, only show critical errors
        if (context.isHoldToRecordMode && severity !== ErrorSeverity.CRITICAL) {
            return;
        }

        // Determine actions for the user
        const actions = this.getRecoveryActions(recoveryAction);

        switch (displayStrategy) {
            case DisplayStrategy.POPUP:
                if (severity === ErrorSeverity.WARNING) {
                    return await this.displayHandler.showWarning(config.message, actions);
                } else {
                    return await this.displayHandler.showError(config.message, severity, actions);
                }

            case DisplayStrategy.STATUS_BAR:
                this.displayHandler.updateStatusBar(config.message, severity);
                return;

            case DisplayStrategy.CONSOLE:
                console.error(`[SpeechToTextWhisper] ${config.message}`);
                return;

            case DisplayStrategy.SILENT:
                return;

            default:
                return await this.displayHandler.showError(config.message, severity, actions);
        }
    }

    /**
     * Getting recovery actions
     */
    private getRecoveryActions(recoveryAction: RecoveryAction): string[] {
        switch (recoveryAction) {
            case RecoveryAction.CONFIGURE_API_KEY:
                return ['Open Settings'];
            case RecoveryAction.ENABLE_MICROPHONE:
                return ['Check Microphone', 'Open Settings'];
            case RecoveryAction.CHECK_NETWORK:
                return ['Retry', 'Check Network'];
            case RecoveryAction.RETRY:
                return ['Retry'];
            case RecoveryAction.OPEN_SETTINGS:
                return ['Open Settings'];
            case RecoveryAction.REFRESH_EXTENSION:
                return ['Reload Extension'];
            default:
                return [];
        }
    }

    /**
     * Logging an error
     */
    private logError(config: ErrorConfig, context: ErrorContext, originalError?: Error): void {
        const timestamp = context.timestamp.toISOString();
        const contextInfo = `Operation: ${context.operation}, Attempt: ${context.attemptNumber || 1}`;
        const logMessage = `[${config.type}] ${config.message}`;

        // Log based on severity
        if (config.severity === ErrorSeverity.CRITICAL) {
            ErrorHandlerLog.error(`[SpeechToTextWhisper] ${config.message}`);
        } else if (config.severity === ErrorSeverity.ERROR) {
            ErrorHandlerLog.error(logMessage);
            ErrorHandlerLog.error(`Context: ${contextInfo}`);
        } else {
            ErrorHandlerLog.warn(logMessage);
        }

        if (originalError) {
            ErrorHandlerLog.error('Original error:', originalError);
        }

        if (config.technicalDetails) {
            ErrorHandlerLog.warn(`Technical details: ${config.technicalDetails}`);
        }

        // Additional information
        if (context.additionalData) {
            ErrorHandlerLog.warn(`Additional data: ${JSON.stringify(context.additionalData)}`);
        }
    }

    /**
     * Checking if the operation can be retried
     */
    isRetryable(errorType: ErrorType): boolean {
        const config = this.errorConfigs.get(errorType);
        return config?.retryable || false;
    }

    /**
     * Getting the error configuration
     */
    getErrorConfig(errorType: ErrorType): ErrorConfig | undefined {
        return this.errorConfigs.get(errorType);
    }

    /**
     * Setting the StatusBarManager for integration
     */
    setStatusBarManager(statusBarManager: any): void {
        this.statusBarManager = statusBarManager;
    }
}

/**
 * Global instance of ErrorHandler
 */
export const globalErrorHandler = new ErrorHandler(); 