import { ErrorType, ErrorHandler } from './ErrorHandler';
import { RetryManagerLog } from './GlobalOutput';

/**
 * Стратегии повторных попыток
 */
export enum RetryStrategy {
    EXPONENTIAL_BACKOFF = 'exponential_backoff',
    LINEAR_BACKOFF = 'linear_backoff',
    FIXED_DELAY = 'fixed_delay',
    IMMEDIATE = 'immediate'
}

/**
 * Конфигурация повторных попыток
 */
export interface RetryConfig {
    maxAttempts: number;
    strategy: RetryStrategy;
    baseDelay: number;         // Базовая задержка в мс
    maxDelay: number;          // Максимальная задержка в мс
    multiplier: number;        // Множитель для экспоненциального backoff
    jitter: boolean;           // Добавлять случайность к задержке
}

/**
 * Результат операции с повторными попытками
 */
export interface RetryResult<T> {
    success: boolean;
    result?: T;
    lastError?: Error;
    attempts: number;
    totalTime: number;
}

/**
 * Менеджер повторных попыток
 */
export class RetryManager {
    private readonly defaultConfig: RetryConfig = {
        maxAttempts: 3,
        strategy: RetryStrategy.EXPONENTIAL_BACKOFF,
        baseDelay: 1000,
        maxDelay: 10000,
        multiplier: 2,
        jitter: true
    };

    private errorHandler: ErrorHandler;

    constructor(errorHandler: ErrorHandler) {
        this.errorHandler = errorHandler;
    }

    /**
     * Выполнение операции с повторными попытками
     */
    async retry<T>(
        operation: () => Promise<T>,
        operationName: string,
        config?: Partial<RetryConfig>,
        errorContext?: Record<string, any>
    ): Promise<RetryResult<T>> {
        const finalConfig = { ...this.defaultConfig, ...config };
        const startTime = Date.now();
        let lastError: Error | undefined;
        
        for (let attempt = 1; attempt <= finalConfig.maxAttempts; attempt++) {
            try {
                RetryManagerLog.info(`🔄 Attempting ${operationName} (${attempt}/${finalConfig.maxAttempts})`);
                
                const result = await operation();
                
                const totalTime = Date.now() - startTime;
                RetryManagerLog.info(`✅ ${operationName} succeeded on attempt ${attempt} (${totalTime}ms)`);
                
                return {
                    success: true,
                    result,
                    attempts: attempt,
                    totalTime
                };
                
            } catch (error) {
                // Правильно обрабатываем non-Error объекты
                lastError = error instanceof Error 
                    ? error 
                    : new Error(String(error));
                
                RetryManagerLog.warn(`❌ ${operationName} failed on attempt ${attempt}: ${lastError.message}`);
                
                // Если это последняя попытка, не делаем задержку
                if (attempt === finalConfig.maxAttempts) {
                    break;
                }
                
                // Проверяем, можно ли повторить эту ошибку
                const errorType = this.classifyError(lastError);
                if (!this.errorHandler.isRetryable(errorType)) {
                    RetryManagerLog.warn(`🚫 Error type ${errorType} is not retryable, stopping attempts`);
                    break;
                }
                
                // Вычисляем задержку и ждем
                const delay = this.calculateDelay(attempt, finalConfig);
                RetryManagerLog.info(`⏳ Waiting ${delay}ms before next attempt...`);
                await this.sleep(delay);
            }
        }
        
        const totalTime = Date.now() - startTime;
        RetryManagerLog.error(`💥 ${operationName} failed after ${finalConfig.maxAttempts} attempts (${totalTime}ms)`);
        
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
    async retryApiRequest<T>(
        operation: () => Promise<T>,
        operationName: string,
        config?: Partial<RetryConfig>
    ): Promise<RetryResult<T>> {
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
    async retryMicrophoneOperation<T>(
        operation: () => Promise<T>,
        operationName: string,
        config?: Partial<RetryConfig>
    ): Promise<RetryResult<T>> {
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
    private classifyError(error: Error): ErrorType {
        const message = error.message.toLowerCase();
        
        if (message.includes('network') || message.includes('timeout') || 
            message.includes('fetch') || message.includes('connection')) {
            return ErrorType.NETWORK_ERROR;
        }
        
        if (message.includes('rate limit')) {
            return ErrorType.API_RATE_LIMIT;
        }
        
        if (message.includes('api key')) {
            return ErrorType.API_KEY_INVALID;
        }
        
        if (message.includes('microphone') || message.includes('permission')) {
            return ErrorType.MICROPHONE_ACCESS;
        }
        
        return ErrorType.UNKNOWN_ERROR;
    }

    /**
     * Вычисление задержки на основе стратегии
     */
    private calculateDelay(attempt: number, config: RetryConfig): number {
        let delay: number;
        
        switch (config.strategy) {
            case RetryStrategy.EXPONENTIAL_BACKOFF:
                delay = Math.min(
                    config.baseDelay * Math.pow(config.multiplier, attempt - 1),
                    config.maxDelay
                );
                break;
                
            case RetryStrategy.LINEAR_BACKOFF:
                delay = Math.min(
                    config.baseDelay * attempt,
                    config.maxDelay
                );
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
    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Создание предконфигурированного RetryManager для разных типов операций
     */
    static createForApiOperations(errorHandler: ErrorHandler): RetryManager {
        const manager = new RetryManager(errorHandler);
        return manager;
    }

    static createForMicrophoneOperations(errorHandler: ErrorHandler): RetryManager {
        const manager = new RetryManager(errorHandler);
        return manager;
    }
}

/**
 * Декоратор для автоматического retry
 */
export function withRetry<T extends any[], R>(
    retryManager: RetryManager,
    operationName: string,
    config?: Partial<RetryConfig>
) {
    return function(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
        const originalMethod = descriptor.value;
        
        descriptor.value = async function(...args: T): Promise<R> {
            const result = await retryManager.retry(
                () => originalMethod.apply(this, args),
                `${target.constructor.name}.${operationName}`,
                config
            );
            
            if (result.success) {
                return result.result as R;
            } else {
                throw result.lastError || new Error(`${operationName} failed after retries`);
            }
        };
        
        return descriptor;
    };
} 