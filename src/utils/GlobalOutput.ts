import * as vscode from 'vscode';

/**
 * Уровни логирования
 */
export enum LogLevel {
    DEBUG = '🔍',
    INFO = 'ℹ️',
    WARN = '⚠️',
    ERROR = '❌',
    CRITICAL = '🚨'
}

/**
 * Глобальный outputChannel для всего расширения
 */
let globalOutputChannel: vscode.OutputChannel | null = null;

/**
 * Инициализация глобального outputChannel
 * Должна вызываться в функции activate() расширения
 */
export function initializeGlobalOutput(outputChannel: vscode.OutputChannel): void {
    globalOutputChannel = outputChannel;
}

/**
 * Получение глобального outputChannel
 */
export function getGlobalOutputChannel(): vscode.OutputChannel | null {
    return globalOutputChannel;
}

/**
 * Базовая функция логирования
 */
function logMessage(level: LogLevel, component: string, message: string, error?: Error): void {
    const timestamp = new Date().toISOString();
    const formattedMessage = `${timestamp} ${level} [${component}] ${message}`;
    
    // Логируем в консоль (для отладки в DevTools)
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
    
    // Логируем в VS Code Output Channel если доступен
    if (globalOutputChannel) {
        globalOutputChannel.appendLine(formattedMessage);
        
        if (error) {
            globalOutputChannel.appendLine(`    Error: ${error.message}`);
            if (error.stack) {
                globalOutputChannel.appendLine(`    Stack: ${error.stack}`);
            }
        }
        
        // Показываем панель для критических ошибок
        if (level === LogLevel.CRITICAL) {
            globalOutputChannel.show(true);
        }
    }
}

/**
 * Логирование отладочной информации
 */
export function logDebug(component: string, message: string): void {
    logMessage(LogLevel.DEBUG, component, message);
}

/**
 * Логирование информационных сообщений
 */
export function logInfo(component: string, message: string): void {
    logMessage(LogLevel.INFO, component, message);
}

/**
 * Логирование предупреждений
 */
export function logWarn(component: string, message: string): void {
    logMessage(LogLevel.WARN, component, message);
}

/**
 * Логирование ошибок
 */
export function logError(component: string, message: string, error?: Error): void {
    logMessage(LogLevel.ERROR, component, message, error);
}

/**
 * Логирование критических ошибок
 */
export function logCritical(component: string, message: string, error?: Error): void {
    logMessage(LogLevel.CRITICAL, component, message, error);
}

/**
 * Универсальная функция логирования с произвольным уровнем
 */
export function log(level: LogLevel, component: string, message: string, error?: Error): void {
    logMessage(level, component, message, error);
}

/**
 * Утилитарные функции для специфичных компонентов
 */

// Для AudioQualityManager
export const AudioQualityManagerLog = {
    info: (message: string) => logInfo('AudioQualityManager', message),
    warn: (message: string) => logWarn('AudioQualityManager', message),
    error: (message: string, error?: Error) => logError('AudioQualityManager', message, error)
};

// Для RecoveryActionHandler
export const RecoveryActionHandlerLog = {
    info: (message: string) => logInfo('RecoveryActionHandler', message),
    warn: (message: string) => logWarn('RecoveryActionHandler', message),
    error: (message: string, error?: Error) => logError('RecoveryActionHandler', message, error)
};

// Для ErrorHandler
export const ErrorHandlerLog = {
    info: (message: string) => logInfo('ErrorHandler', message),
    warn: (message: string) => logWarn('ErrorHandler', message),
    error: (message: string, error?: Error) => logError('ErrorHandler', message, error)
};

// Для RetryManager
export const RetryManagerLog = {
    info: (message: string) => logInfo('RetryManager', message),
    warn: (message: string) => logWarn('RetryManager', message),
    error: (message: string, error?: Error) => logError('RetryManager', message, error)
};

// Для ConfigurationManager
export const ConfigurationManagerLog = {
    info: (message: string) => logInfo('ConfigurationManager', message),
    warn: (message: string) => logWarn('ConfigurationManager', message),
    error: (message: string, error?: Error) => logError('ConfigurationManager', message, error)
};

// Для CursorIntegration
export const CursorIntegrationLog = {
    debug: (message: string) => logDebug('CursorIntegration', message),
    info: (message: string) => logInfo('CursorIntegration', message),
    warn: (message: string) => logWarn('CursorIntegration', message),
    error: (message: string, error?: Error) => logError('CursorIntegration', message, error)
};

// Для Extension (основного модуля)
export const ExtensionLog = {
    debug: (message: string) => logDebug('Extension', message),
    info: (message: string) => logInfo('Extension', message),
    warn: (message: string) => logWarn('Extension', message),
    error: (message: string, error?: Error) => logError('Extension', message, error)
};

// Для FFmpegAudioRecorder
export const FFmpegAudioRecorderLog = {
    debug: (message: string) => logDebug('FFmpegAudioRecorder', message),
    info: (message: string) => logInfo('FFmpegAudioRecorder', message),
    warn: (message: string) => logWarn('FFmpegAudioRecorder', message),
    error: (message: string, error?: Error) => logError('FFmpegAudioRecorder', message, error)
};

/**
 * Показать Output Channel пользователю
 */
export function showOutputChannel(): void {
    if (globalOutputChannel) {
        globalOutputChannel.show();
    }
}

/**
 * Очистить Output Channel
 */
export function clearOutputChannel(): void {
    if (globalOutputChannel) {
        globalOutputChannel.clear();
    }
}

/**
 * Освобождение ресурсов при деактивации расширения
 */
export function disposeGlobalOutput(): void {
    if (globalOutputChannel) {
        globalOutputChannel.dispose();
        globalOutputChannel = null;
    }
} 