"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.globalErrorHandler = exports.ErrorHandler = exports.VSCodeErrorDisplayHandler = exports.DisplayStrategy = exports.RecoveryAction = exports.ErrorSeverity = exports.ErrorType = void 0;
const vscode = __importStar(require("vscode"));
/**
 * Типы ошибок в системе SpeechToTextWhisper
 */
var ErrorType;
(function (ErrorType) {
    ErrorType["MICROPHONE_ACCESS"] = "microphone_access";
    ErrorType["MICROPHONE_PERMISSION"] = "microphone_permission";
    ErrorType["MICROPHONE_COMPATIBILITY"] = "microphone_compatibility";
    ErrorType["API_KEY_MISSING"] = "api_key_missing";
    ErrorType["API_KEY_INVALID"] = "api_key_invalid";
    ErrorType["API_REQUEST_FAILED"] = "api_request_failed";
    ErrorType["API_RATE_LIMIT"] = "api_rate_limit";
    ErrorType["API_QUOTA_EXCEEDED"] = "api_quota_exceeded";
    ErrorType["NETWORK_ERROR"] = "network_error";
    ErrorType["TRANSCRIPTION_FAILED"] = "transcription_failed";
    ErrorType["TRANSCRIPTION_EMPTY"] = "transcription_empty";
    ErrorType["TEXT_INSERTION_FAILED"] = "text_insertion_failed";
    ErrorType["AUDIO_RECORDING_FAILED"] = "audio_recording_failed";
    ErrorType["CONFIGURATION_ERROR"] = "configuration_error";
    ErrorType["UNKNOWN_ERROR"] = "unknown_error";
})(ErrorType || (exports.ErrorType = ErrorType = {}));
/**
 * Уровни серьезности ошибок
 */
var ErrorSeverity;
(function (ErrorSeverity) {
    ErrorSeverity["WARNING"] = "warning";
    ErrorSeverity["ERROR"] = "error";
    ErrorSeverity["CRITICAL"] = "critical"; // Критические ошибки, блокируют работу
})(ErrorSeverity || (exports.ErrorSeverity = ErrorSeverity = {}));
/**
 * Действия восстановления
 */
var RecoveryAction;
(function (RecoveryAction) {
    RecoveryAction["NONE"] = "none";
    RecoveryAction["RETRY"] = "retry";
    RecoveryAction["CONFIGURE_API_KEY"] = "configure_api_key";
    RecoveryAction["ENABLE_MICROPHONE"] = "enable_microphone";
    RecoveryAction["CHECK_NETWORK"] = "check_network";
    RecoveryAction["OPEN_SETTINGS"] = "open_settings";
    RecoveryAction["REFRESH_EXTENSION"] = "refresh_extension";
})(RecoveryAction || (exports.RecoveryAction = RecoveryAction = {}));
/**
 * Стратегии отображения ошибок
 */
var DisplayStrategy;
(function (DisplayStrategy) {
    DisplayStrategy["POPUP"] = "popup";
    DisplayStrategy["STATUS_BAR"] = "status_bar";
    DisplayStrategy["CONSOLE"] = "console";
    DisplayStrategy["SILENT"] = "silent"; // Тихая обработка
})(DisplayStrategy || (exports.DisplayStrategy = DisplayStrategy = {}));
/**
 * Реализация отображения ошибок через VS Code API
 */
class VSCodeErrorDisplayHandler {
    async showError(message, severity, actions) {
        if (severity === ErrorSeverity.CRITICAL) {
            return await vscode.window.showErrorMessage(`❌ ${message}`, ...(actions || []));
        }
        else {
            return await vscode.window.showErrorMessage(`❌ ${message}`, ...(actions || []));
        }
    }
    async showWarning(message, actions) {
        return await vscode.window.showWarningMessage(`⚠️ ${message}`, ...(actions || []));
    }
    async showInformation(message, actions) {
        return await vscode.window.showInformationMessage(`ℹ️ ${message}`, ...(actions || []));
    }
    updateStatusBar(message, severity) {
        // Эта функция будет интегрирована с StatusBarManager
        console.log(`[StatusBar] ${severity.toUpperCase()}: ${message}`);
    }
}
exports.VSCodeErrorDisplayHandler = VSCodeErrorDisplayHandler;
/**
 * Централизованный обработчик ошибок
 */
class ErrorHandler {
    displayHandler;
    statusBarManager; // Интеграция с StatusBarManager
    // Конфигурации для разных типов ошибок
    errorConfigs = new Map([
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
                severity: ErrorSeverity.ERROR,
                displayStrategy: DisplayStrategy.POPUP,
                recoveryAction: RecoveryAction.ENABLE_MICROPHONE,
                message: 'Audio recording failed. Please check your microphone.',
                retryable: true
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
    constructor(displayHandler, statusBarManager) {
        this.displayHandler = displayHandler || new VSCodeErrorDisplayHandler();
        this.statusBarManager = statusBarManager;
    }
    /**
     * Обработка ошибки по типу
     */
    async handleError(errorType, context, originalError) {
        const config = this.errorConfigs.get(errorType);
        if (!config) {
            return await this.handleError(ErrorType.UNKNOWN_ERROR, context, originalError);
        }
        // Логирование
        this.logError(config, context, originalError);
        // Обновление статус-бара если есть
        if (this.statusBarManager) {
            this.statusBarManager.showError(config.message, config.severity);
        }
        else {
            this.displayHandler.updateStatusBar(config.message, config.severity);
        }
        // Отображение ошибки согласно стратегии
        return await this.displayError(config, context);
    }
    /**
     * Обработка ошибки из исключения
     */
    async handleErrorFromException(error, context) {
        const errorType = this.classifyError(error);
        return await this.handleError(errorType, context, error);
    }
    /**
     * Классификация ошибки по сообщению
     */
    classifyError(error) {
        const message = error.message.toLowerCase();
        // API ошибки
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
        // Микрофон ошибки
        if (message.includes('permission') && message.includes('microphone')) {
            return ErrorType.MICROPHONE_PERMISSION;
        }
        if (message.includes('microphone') || message.includes('media')) {
            return ErrorType.MICROPHONE_ACCESS;
        }
        if (message.includes('incompatible') || message.includes('not supported')) {
            return ErrorType.MICROPHONE_COMPATIBILITY;
        }
        // Транскрибация ошибки
        if (message.includes('no speech detected') || message.includes('empty audio')) {
            return ErrorType.TRANSCRIPTION_EMPTY;
        }
        if (message.includes('transcription') || message.includes('whisper')) {
            return ErrorType.TRANSCRIPTION_FAILED;
        }
        // Сетевые ошибки
        if (message.includes('network') || message.includes('connection') ||
            message.includes('timeout') || message.includes('fetch')) {
            return ErrorType.NETWORK_ERROR;
        }
        // Вставка текста
        if (message.includes('insert') || message.includes('text insertion')) {
            return ErrorType.TEXT_INSERTION_FAILED;
        }
        // Запись аудио
        if (message.includes('recording') || message.includes('audio')) {
            return ErrorType.AUDIO_RECORDING_FAILED;
        }
        return ErrorType.UNKNOWN_ERROR;
    }
    /**
     * Отображение ошибки согласно стратегии
     */
    async displayError(config, context) {
        const { displayStrategy, severity, recoveryAction } = config;
        // В hold-to-record режиме показываем только критические ошибки
        if (context.isHoldToRecordMode && severity !== ErrorSeverity.CRITICAL) {
            return;
        }
        // Определяем действия для пользователя
        const actions = this.getRecoveryActions(recoveryAction);
        switch (displayStrategy) {
            case DisplayStrategy.POPUP:
                if (severity === ErrorSeverity.WARNING) {
                    return await this.displayHandler.showWarning(config.message, actions);
                }
                else {
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
     * Получение действий восстановления
     */
    getRecoveryActions(recoveryAction) {
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
     * Логирование ошибки
     */
    logError(config, context, originalError) {
        const logPrefix = `[SpeechToTextWhisper][${config.severity.toUpperCase()}]`;
        const logMessage = `${logPrefix} ${config.type}: ${config.message}`;
        const contextInfo = `Operation: ${context.operation}, Timestamp: ${context.timestamp.toISOString()}`;
        console.error(logMessage);
        console.error(`Context: ${contextInfo}`);
        if (originalError) {
            console.error('Original error:', originalError);
            if (config.technicalDetails) {
                console.error('Technical details:', config.technicalDetails);
            }
        }
        if (context.additionalData) {
            console.error('Additional data:', context.additionalData);
        }
    }
    /**
     * Проверка, можно ли повторить операцию
     */
    isRetryable(errorType) {
        const config = this.errorConfigs.get(errorType);
        return config?.retryable || false;
    }
    /**
     * Получение конфигурации ошибки
     */
    getErrorConfig(errorType) {
        return this.errorConfigs.get(errorType);
    }
    /**
     * Установка StatusBarManager для интеграции
     */
    setStatusBarManager(statusBarManager) {
        this.statusBarManager = statusBarManager;
    }
}
exports.ErrorHandler = ErrorHandler;
/**
 * Глобальный экземпляр ErrorHandler
 */
exports.globalErrorHandler = new ErrorHandler();
//# sourceMappingURL=ErrorHandler.js.map