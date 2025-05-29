"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RetryManager = exports.RetryStrategy = void 0;
exports.withRetry = withRetry;
const ErrorHandler_1 = require("./ErrorHandler");
/**
 * Стратегии повторных попыток
 */
var RetryStrategy;
(function (RetryStrategy) {
    RetryStrategy["EXPONENTIAL_BACKOFF"] = "exponential_backoff";
    RetryStrategy["LINEAR_BACKOFF"] = "linear_backoff";
    RetryStrategy["FIXED_DELAY"] = "fixed_delay";
    RetryStrategy["IMMEDIATE"] = "immediate";
})(RetryStrategy || (exports.RetryStrategy = RetryStrategy = {}));
/**
 * Менеджер повторных попыток
 */
class RetryManager {
    defaultConfig = {
        maxAttempts: 3,
        strategy: RetryStrategy.EXPONENTIAL_BACKOFF,
        baseDelay: 1000,
        maxDelay: 10000,
        multiplier: 2,
        jitter: true
    };
    errorHandler;
    constructor(errorHandler) {
        this.errorHandler = errorHandler;
    }
    /**
     * Выполнение операции с повторными попытками
     */
    async retry(operation, operationName, config, errorContext) {
        const finalConfig = { ...this.defaultConfig, ...config };
        const startTime = Date.now();
        let lastError;
        for (let attempt = 1; attempt <= finalConfig.maxAttempts; attempt++) {
            try {
                console.log(`🔄 Attempting ${operationName} (${attempt}/${finalConfig.maxAttempts})`);
                const result = await operation();
                const totalTime = Date.now() - startTime;
                console.log(`✅ ${operationName} succeeded on attempt ${attempt} (${totalTime}ms)`);
                return {
                    success: true,
                    result,
                    attempts: attempt,
                    totalTime
                };
            }
            catch (error) {
                lastError = error;
                console.log(`❌ ${operationName} failed on attempt ${attempt}: ${lastError.message}`);
                // Если это последняя попытка, не делаем задержку
                if (attempt === finalConfig.maxAttempts) {
                    break;
                }
                // Проверяем, можно ли повторить эту ошибку
                const errorType = this.classifyError(lastError);
                if (!this.errorHandler.isRetryable(errorType)) {
                    console.log(`🚫 Error type ${errorType} is not retryable, stopping attempts`);
                    break;
                }
                // Вычисляем задержку и ждем
                const delay = this.calculateDelay(attempt, finalConfig);
                console.log(`⏳ Waiting ${delay}ms before next attempt...`);
                await this.sleep(delay);
            }
        }
        const totalTime = Date.now() - startTime;
        console.log(`💥 ${operationName} failed after ${finalConfig.maxAttempts} attempts (${totalTime}ms)`);
        return {
            success: false,
            lastError,
            attempts: finalConfig.maxAttempts,
            totalTime
        };
    }
    /**
     * Retry специально для API запросов с детектированием сетевых ошибок
     */
    async retryApiRequest(operation, operationName, config) {
        const apiConfig = {
            maxAttempts: 3,
            strategy: RetryStrategy.EXPONENTIAL_BACKOFF,
            baseDelay: 1000,
            maxDelay: 8000,
            multiplier: 2,
            jitter: true,
            ...config
        };
        return await this.retry(operation, operationName, apiConfig, {
            type: 'api_request'
        });
    }
    /**
     * Retry для операций с микрофоном
     */
    async retryMicrophoneOperation(operation, operationName, config) {
        const micConfig = {
            maxAttempts: 2,
            strategy: RetryStrategy.FIXED_DELAY,
            baseDelay: 500,
            maxDelay: 1000,
            multiplier: 1,
            jitter: false,
            ...config
        };
        return await this.retry(operation, operationName, micConfig, {
            type: 'microphone_operation'
        });
    }
    /**
     * Классификация ошибки (упрощенная версия)
     */
    classifyError(error) {
        const message = error.message.toLowerCase();
        if (message.includes('network') || message.includes('timeout') ||
            message.includes('fetch') || message.includes('connection')) {
            return ErrorHandler_1.ErrorType.NETWORK_ERROR;
        }
        if (message.includes('rate limit')) {
            return ErrorHandler_1.ErrorType.API_RATE_LIMIT;
        }
        if (message.includes('api key')) {
            return ErrorHandler_1.ErrorType.API_KEY_INVALID;
        }
        if (message.includes('microphone') || message.includes('permission')) {
            return ErrorHandler_1.ErrorType.MICROPHONE_ACCESS;
        }
        return ErrorHandler_1.ErrorType.UNKNOWN_ERROR;
    }
    /**
     * Вычисление задержки на основе стратегии
     */
    calculateDelay(attempt, config) {
        let delay;
        switch (config.strategy) {
            case RetryStrategy.EXPONENTIAL_BACKOFF:
                delay = Math.min(config.baseDelay * Math.pow(config.multiplier, attempt - 1), config.maxDelay);
                break;
            case RetryStrategy.LINEAR_BACKOFF:
                delay = Math.min(config.baseDelay * attempt, config.maxDelay);
                break;
            case RetryStrategy.FIXED_DELAY:
                delay = config.baseDelay;
                break;
            case RetryStrategy.IMMEDIATE:
                delay = 0;
                break;
            default:
                delay = config.baseDelay;
        }
        // Добавляем jitter если включен
        if (config.jitter) {
            const jitterAmount = delay * 0.1; // 10% от задержки
            const randomJitter = (Math.random() - 0.5) * 2 * jitterAmount;
            delay = Math.max(0, delay + randomJitter);
        }
        return Math.round(delay);
    }
    /**
     * Утилита для ожидания
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    /**
     * Создание предконфигурированного RetryManager для разных типов операций
     */
    static createForApiOperations(errorHandler) {
        const manager = new RetryManager(errorHandler);
        return manager;
    }
    static createForMicrophoneOperations(errorHandler) {
        const manager = new RetryManager(errorHandler);
        return manager;
    }
}
exports.RetryManager = RetryManager;
/**
 * Декоратор для автоматического retry
 */
function withRetry(retryManager, operationName, config) {
    return function (target, propertyKey, descriptor) {
        const originalMethod = descriptor.value;
        descriptor.value = async function (...args) {
            const result = await retryManager.retry(() => originalMethod.apply(this, args), `${target.constructor.name}.${operationName}`, config);
            if (result.success) {
                return result.result;
            }
            else {
                throw result.lastError || new Error(`${operationName} failed after retries`);
            }
        };
        return descriptor;
    };
}
//# sourceMappingURL=RetryManager.js.map