import * as vscode from 'vscode';

/**
 * Logging levels
 */
export enum LogLevel {
    DEBUG = '🔍',
    INFO = 'ℹ️',
    WARN = '⚠️',
    ERROR = '❌',
    CRITICAL = '🚨'
}

/**
 * Global outputChannel for the entire extension
 */
let globalOutputChannel: vscode.OutputChannel | null = null;

/**
 * Initialization of the global outputChannel
 * Must be called in the activate() function of the extension
 */
export function initializeGlobalOutput(outputChannel: vscode.OutputChannel): void {
    globalOutputChannel = outputChannel;
}

/**
 * Getting the global outputChannel
 */
export function getGlobalOutputChannel(): vscode.OutputChannel | null {
    return globalOutputChannel;
}

/**
 * Base logging function
 */
function logMessage(level: LogLevel, component: string, message: string, data?: any, error?: Error): void {
    const timestamp = new Date().toISOString();
    
    // If there are additional data, add them to the message
    let fullMessage = message;
    if (data !== undefined) {
        if (typeof data === 'string') {
            fullMessage += ` ${data}`;
        } else if (typeof data === 'object' && data !== null) {
            fullMessage += ` ${JSON.stringify(data)}`;
        } else {
            fullMessage += ` ${String(data)}`;
        }
    }
    
    const formattedMessage = `${timestamp} ${level} [${component}] ${fullMessage}`;
    
    // Log to the console (for debugging in DevTools)
    if (level === LogLevel.ERROR || level === LogLevel.CRITICAL) {
        console.error(formattedMessage);
        if (error) {
            console.error('Error details:', error);
        }
    } else if (level === LogLevel.WARN) {
        console.warn(formattedMessage);
    } else {
        console.log(formattedMessage);
    }
    
    // Log to the VS Code Output Channel if available
    if (globalOutputChannel) {
        globalOutputChannel.appendLine(formattedMessage);
        
        if (error) {
            globalOutputChannel.appendLine(`    Error: ${error.message}`);
            if (error.stack) {
                globalOutputChannel.appendLine(`    Stack: ${error.stack}`);
            }
        }
        
        // Show the panel for critical errors
        if (level === LogLevel.CRITICAL) {
            globalOutputChannel.show(true);
        }
    }
}

/**
 * Logging debug information
 */
export function logDebug(component: string, message: string, data?: any): void {
    logMessage(LogLevel.DEBUG, component, message, data);
}

/**
 * Logging informational messages
 */
export function logInfo(component: string, message: string, data?: any): void {
    logMessage(LogLevel.INFO, component, message, data);
}

/**
 * Logging warnings
 */
export function logWarn(component: string, message: string, data?: any): void {
    logMessage(LogLevel.WARN, component, message, data);
}

/**
 * Logging errors
 */
export function logError(component: string, message: string, data?: any, error?: Error): void {
    logMessage(LogLevel.ERROR, component, message, data, error);
}

/**
 * Logging critical errors
 */
export function logCritical(component: string, message: string, data?: any, error?: Error): void {
    logMessage(LogLevel.CRITICAL, component, message, data, error);
}

/**
 * Universal logging function with arbitrary level
 */
export function log(level: LogLevel, component: string, message: string, data?: any, error?: Error): void {
    logMessage(level, component, message, data, error);
}

/**
 * Utility functions for specific components
 */

// For AudioQualityManager
export const AudioQualityManagerLog = {
    info: (message: string, data?: any) => logInfo('AudioQualityManager', message, data),
    warn: (message: string, data?: any) => logWarn('AudioQualityManager', message, data),
    error: (message: string, data?: any, error?: Error) => logError('AudioQualityManager', message, data, error)
};

// For RecoveryActionHandler
export const RecoveryActionHandlerLog = {
    info: (message: string, data?: any) => logInfo('RecoveryActionHandler', message, data),
    warn: (message: string, data?: any) => logWarn('RecoveryActionHandler', message, data),
    error: (message: string, data?: any, error?: Error) => logError('RecoveryActionHandler', message, data, error)
};

// For ErrorHandler
export const ErrorHandlerLog = {
    info: (message: string, data?: any) => logInfo('ErrorHandler', message, data),
    warn: (message: string, data?: any) => logWarn('ErrorHandler', message, data),
    error: (message: string, data?: any, error?: Error) => logError('ErrorHandler', message, data, error)
};

// For RetryManager
export const RetryManagerLog = {
    info: (message: string, data?: any) => logInfo('RetryManager', message, data),
    warn: (message: string, data?: any) => logWarn('RetryManager', message, data),
    error: (message: string, data?: any, error?: Error) => logError('RetryManager', message, data, error)
};

// For ConfigurationManager
export const ConfigurationManagerLog = {
    info: (message: string, data?: any) => logInfo('ConfigurationManager', message, data),
    warn: (message: string, data?: any) => logWarn('ConfigurationManager', message, data),
    error: (message: string, data?: any, error?: Error) => logError('ConfigurationManager', message, data, error)
};

// For CursorIntegration
export const CursorIntegrationLog = {
    debug: (message: string, data?: any) => logDebug('CursorIntegration', message, data),
    info: (message: string, data?: any) => logInfo('CursorIntegration', message, data),
    warn: (message: string, data?: any) => logWarn('CursorIntegration', message, data),
    error: (message: string, data?: any, error?: Error) => logError('CursorIntegration', message, data, error)
};

// For Extension (main module)
export const ExtensionLog = {
    debug: (message: string, data?: any) => logDebug('Extension', message, data),
    info: (message: string, data?: any) => logInfo('Extension', message, data),
    warn: (message: string, data?: any) => logWarn('Extension', message, data),
    error: (message: string, data?: any, error?: Error) => logError('Extension', message, data, error)
};

// For FFmpegAudioRecorder
export const FFmpegAudioRecorderLog = {
    debug: (message: string, data?: any) => logDebug('FFmpegAudioRecorder', message, data),
    info: (message: string, data?: any) => logInfo('FFmpegAudioRecorder', message, data),
    warn: (message: string, data?: any) => logWarn('FFmpegAudioRecorder', message, data),
    error: (message: string, data?: any, error?: Error) => logError('FFmpegAudioRecorder', message, data, error)
};

/**
 * Show Output Channel to the user
 */
export function showOutputChannel(): void {
    if (globalOutputChannel) {
        globalOutputChannel.show();
    }
}

/**
 * Clear Output Channel
 */
export function clearOutputChannel(): void {
    if (globalOutputChannel) {
        globalOutputChannel.clear();
    }
}

/**
 * Release resources when the extension is deactivated
 */
export function disposeGlobalOutput(): void {
    if (globalOutputChannel) {
        globalOutputChannel.dispose();
        globalOutputChannel = null;
    }
} 