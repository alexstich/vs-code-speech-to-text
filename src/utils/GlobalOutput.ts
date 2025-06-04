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
function logMessage(level: LogLevel, component: string, message: string, data?: any, error?: Error): void {
    const timestamp = new Date().toISOString();
    
    // Если есть дополнительные данные, добавляем их к сообщению
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
export function logDebug(component: string, message: string, data?: any): void {
    logMessage(LogLevel.DEBUG, component, message, data);
}

/**
 * Логирование информационных сообщений
 */
export function logInfo(component: string, message: string, data?: any): void {
    logMessage(LogLevel.INFO, component, message, data);
}

/**
 * Логирование предупреждений
 */
export function logWarn(component: string, message: string, data?: any): void {
    logMessage(LogLevel.WARN, component, message, data);
}

/**
 * Логирование ошибок
 */
export function logError(component: string, message: string, data?: any, error?: Error): void {
    logMessage(LogLevel.ERROR, component, message, data, error);
}

/**
 * Логирование критических ошибок
 */
export function logCritical(component: string, message: string, data?: any, error?: Error): void {
    logMessage(LogLevel.CRITICAL, component, message, data, error);
}

/**
 * Универсальная функция логирования с произвольным уровнем
 */
export function log(level: LogLevel, component: string, message: string, data?: any, error?: Error): void {
    logMessage(level, component, message, data, error);
}

/**
 * Утилитарные функции для специфичных компонентов
 */

// Для AudioQualityManager
export const AudioQualityManagerLog = {
    info: (message: string, data?: any) => logInfo('AudioQualityManager', message, data),
    warn: (message: string, data?: any) => logWarn('AudioQualityManager', message, data),
    error: (message: string, data?: any, error?: Error) => logError('AudioQualityManager', message, data, error)
};

// Для RecoveryActionHandler
export const RecoveryActionHandlerLog = {
    info: (message: string, data?: any) => logInfo('RecoveryActionHandler', message, data),
    warn: (message: string, data?: any) => logWarn('RecoveryActionHandler', message, data),
    error: (message: string, data?: any, error?: Error) => logError('RecoveryActionHandler', message, data, error)
};

// Для ErrorHandler
export const ErrorHandlerLog = {
    info: (message: string, data?: any) => logInfo('ErrorHandler', message, data),
    warn: (message: string, data?: any) => logWarn('ErrorHandler', message, data),
    error: (message: string, data?: any, error?: Error) => logError('ErrorHandler', message, data, error)
};

// Для RetryManager
export const RetryManagerLog = {
    info: (message: string, data?: any) => logInfo('RetryManager', message, data),
    warn: (message: string, data?: any) => logWarn('RetryManager', message, data),
    error: (message: string, data?: any, error?: Error) => logError('RetryManager', message, data, error)
};

// Для ConfigurationManager
export const ConfigurationManagerLog = {
    info: (message: string, data?: any) => logInfo('ConfigurationManager', message, data),
    warn: (message: string, data?: any) => logWarn('ConfigurationManager', message, data),
    error: (message: string, data?: any, error?: Error) => logError('ConfigurationManager', message, data, error)
};

// Для CursorIntegration
export const CursorIntegrationLog = {
    debug: (message: string, data?: any) => logDebug('CursorIntegration', message, data),
    info: (message: string, data?: any) => logInfo('CursorIntegration', message, data),
    warn: (message: string, data?: any) => logWarn('CursorIntegration', message, data),
    error: (message: string, data?: any, error?: Error) => logError('CursorIntegration', message, data, error)
};

// Для Extension (основного модуля)
export const ExtensionLog = {
    debug: (message: string, data?: any) => logDebug('Extension', message, data),
    info: (message: string, data?: any) => logInfo('Extension', message, data),
    warn: (message: string, data?: any) => logWarn('Extension', message, data),
    error: (message: string, data?: any, error?: Error) => logError('Extension', message, data, error)
};

// Для FFmpegAudioRecorder
export const FFmpegAudioRecorderLog = {
    debug: (message: string, data?: any) => logDebug('FFmpegAudioRecorder', message, data),
    info: (message: string, data?: any) => logInfo('FFmpegAudioRecorder', message, data),
    warn: (message: string, data?: any) => logWarn('FFmpegAudioRecorder', message, data),
    error: (message: string, data?: any, error?: Error) => logError('FFmpegAudioRecorder', message, data, error)
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