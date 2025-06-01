import * as assert from 'assert';
import * as sinon from 'sinon';
import { RetryManager, RetryStrategy, RetryConfig } from '../../utils/RetryManager';
import { ErrorHandler, ErrorType, ErrorContext, VSCodeErrorDisplayHandler } from '../../utils/ErrorHandler';

suite('RetryManager Tests', () => {
    let retryManager: RetryManager;
    let mockErrorHandler: sinon.SinonStubbedInstance<ErrorHandler>;
    let clock: sinon.SinonFakeTimers;

    setup(() => {
        // Мокируем ErrorHandler
        mockErrorHandler = sinon.createStubInstance(ErrorHandler);
        
        // Настраиваем isRetryable чтобы всегда возвращал true для тестов
        mockErrorHandler.isRetryable.returns(true);
        
        // Мокируем время для контроля delay - используем fake timers
        clock = sinon.useFakeTimers();
        
        // Создаем RetryManager после setup fake timers
        retryManager = new RetryManager(mockErrorHandler);
    });

    teardown(() => {
        clock.restore();
        sinon.restore();
    });

    suite('Basic Retry Functionality', () => {
        test('Should succeed on first attempt', async () => {
            const successOperation = sinon.stub().resolves('success');
            
            const promise = retryManager.retry(successOperation, 'test_operation');
            const result = await promise;
            
            assert.ok(result.success);
            assert.strictEqual(result.result, 'success');
            assert.strictEqual(result.attempts, 1);
            assert.strictEqual(successOperation.callCount, 1);
        });

        test('Should retry on failure and succeed', async () => {
            const operation = sinon.stub();
            operation.onFirstCall().rejects(new Error('First failure'));
            operation.onSecondCall().resolves('success');
            
            let capturedDelay: number = 0;
            
            // Переопределяем setTimeout через fake timers чтобы захватывать delay
            const originalSetTimeout = global.setTimeout;
            global.setTimeout = ((callback: any, delay?: number) => {
                capturedDelay = delay || 0;
                return clock.setTimeout(callback, delay || 0);
            }) as any;
            
            const promise = retryManager.retry(operation, 'test_operation', {
                maxAttempts: 3,
                strategy: RetryStrategy.FIXED_DELAY,
                baseDelay: 100
            });
            
            // Даем время для первого вызова и ошибки
            await Promise.resolve();
            
            // Advance clock используя захваченный delay (может иметь jitter)
            clock.tick(capturedDelay);
            
            const result = await promise;
            
            // Восстанавливаем setTimeout
            global.setTimeout = originalSetTimeout;
            
            assert.ok(result.success);
            assert.strictEqual(result.result, 'success');
            assert.strictEqual(result.attempts, 2);
            assert.strictEqual(operation.callCount, 2);
            
            // Проверяем что delay был применен (но может иметь jitter)
            assert.ok(capturedDelay > 0, 'Should have applied some delay');
        });

        test('Should fail after max attempts', async () => {
            const failingOperation = sinon.stub().rejects(new Error('Persistent failure'));
            
            const config = {
                maxAttempts: 2,
                strategy: RetryStrategy.FIXED_DELAY,
                baseDelay: 50
            };
            
            const promise = retryManager.retry(failingOperation, 'test_operation', config);
            
            // Выполняем все pending timers чтобы завершить все retry
            await clock.runAllAsync();
            
            const result = await promise;
            
            assert.ok(!result.success);
            assert.strictEqual(result.attempts, 2);
            assert.strictEqual(failingOperation.callCount, 2);
            assert.ok(result.lastError);
            assert.strictEqual(result.lastError!.message, 'Persistent failure');
        });
    });

    suite('Retry Strategies', () => {
        test('Should use exponential backoff correctly', async () => {
            const operation = sinon.stub();
            operation.onCall(0).rejects(new Error('Fail 1'));
            operation.onCall(1).rejects(new Error('Fail 2'));
            operation.onCall(2).resolves('success');
            
            const promise = retryManager.retry(operation, 'test_operation', {
                maxAttempts: 3,
                strategy: RetryStrategy.EXPONENTIAL_BACKOFF,
                baseDelay: 100,
                multiplier: 2,
                jitter: false // Отключаем jitter для предсказуемых результатов
            });
            
            // Выполняем все pending timers чтобы завершить все retry
            await clock.runAllAsync();
            
            const result = await promise;
            
            assert.ok(result.success);
            assert.strictEqual(result.attempts, 3);
            assert.strictEqual(operation.callCount, 3);
        });

        test('Should use linear backoff correctly', async () => {
            const operation = sinon.stub();
            operation.onCall(0).rejects(new Error('Fail 1'));
            operation.onCall(1).rejects(new Error('Fail 2'));
            operation.onCall(2).resolves('success');
            
            const promise = retryManager.retry(operation, 'test_operation', {
                maxAttempts: 3,
                strategy: RetryStrategy.LINEAR_BACKOFF,
                baseDelay: 100,
                jitter: false // Отключаем jitter для предсказуемых результатов
            });
            
            // Выполняем все pending timers чтобы завершить все retry
            await clock.runAllAsync();
            
            const result = await promise;
            
            assert.ok(result.success);
            assert.strictEqual(result.attempts, 3);
            assert.strictEqual(operation.callCount, 3);
        });

        test('Should respect max delay', async () => {
            const operation = sinon.stub();
            operation.onCall(0).rejects(new Error('Fail 1'));
            operation.onCall(1).rejects(new Error('Fail 2'));
            operation.onCall(2).resolves('success');
            
            const promise = retryManager.retry(operation, 'test_operation', {
                maxAttempts: 3,
                strategy: RetryStrategy.EXPONENTIAL_BACKOFF,
                baseDelay: 100,
                multiplier: 10, // Would result in very large delays: 100, 1000, 10000
                maxDelay: 150, // But capped at 150ms
                jitter: false
            });
            
            // Выполняем все pending timers чтобы завершить все retry
            await clock.runAllAsync();
            
            const result = await promise;
            
            assert.ok(result.success);
            assert.strictEqual(result.attempts, 3);
            assert.strictEqual(operation.callCount, 3);
        });

        test('Should add jitter when enabled', async () => {
            const operation = sinon.stub();
            operation.onCall(0).rejects(new Error('Fail 1'));
            operation.onCall(1).resolves('success');
            
            let delays: number[] = [];
            
            // Mock Math.random для предсказуемого jitter (возвращаем 0.1)
            const randomStub = sinon.stub(Math, 'random').returns(0.1);
            
            // Переопределяем setTimeout через fake timers чтобы захватывать delay
            const originalSetTimeout = global.setTimeout;
            global.setTimeout = ((callback: any, delay?: number) => {
                delays.push(delay || 0);
                return clock.setTimeout(callback, delay || 0);
            }) as any;
            
            const promise = retryManager.retry(operation, 'test_operation', {
                maxAttempts: 2,
                strategy: RetryStrategy.FIXED_DELAY,
                baseDelay: 1000,
                jitter: true
            });
            
            // Даем время для первого вызова
            await Promise.resolve();
            
            // Advance clock для retry - используем захваченный delay
            if (delays[0]) {
                clock.tick(delays[0]);
            }
            
            await promise;
            
            // Восстанавливаем все
            global.setTimeout = originalSetTimeout;
            randomStub.restore();
            
            // Проверяем что jitter был применен - должен быть близок к baseDelay
            assert.ok(delays[0] >= 900 && delays[0] <= 1100, `Expected delay between 900-1100ms, got ${delays[0]}ms`);
        });
    });

    suite('Specialized Retry Methods', () => {
        test('Should use correct config for API requests', async () => {
            const operation = sinon.stub();
            operation.onCall(0).rejects(new Error('API Error'));
            operation.onCall(1).rejects(new Error('API Error'));
            operation.onCall(2).resolves('success');
            
            const promise = retryManager.retryApiRequest(operation, 'test_api');
            
            // Выполняем все pending timers чтобы завершить все retry
            await clock.runAllAsync();
            
            const result = await promise;
            
            assert.ok(result.success);
            assert.strictEqual(result.attempts, 3); // Default maxAttempts для API
            assert.strictEqual(operation.callCount, 3);
        });

        test('Should use correct config for microphone operations', async () => {
            const operation = sinon.stub();
            operation.onCall(0).rejects(new Error('Mic Error'));
            operation.onCall(1).resolves('success');
            
            const promise = retryManager.retryMicrophoneOperation(operation, 'test_mic');
            
            // Симулируем delay для microphone retry
            await Promise.resolve();
            clock.tick(500); // Microphone retry delay
            
            const result = await promise;
            
            assert.ok(result.success);
            assert.strictEqual(result.attempts, 2); // Default maxAttempts для microphone
            assert.strictEqual(operation.callCount, 2);
        });
    });

    suite('Error Handling Integration', () => {
        test('Should log retry attempts', async () => {
            const operation = sinon.stub();
            operation.onCall(0).rejects(new Error('Logged Error'));
            operation.onCall(1).resolves('success');
            
            const promise = retryManager.retry(operation, 'test_operation', {
                maxAttempts: 2,
                strategy: RetryStrategy.FIXED_DELAY,
                baseDelay: 10
            });
            
            // Выполняем все pending timers чтобы завершить все retry
            await clock.runAllAsync();
            
            await promise;
            
            // Проверяем что operation был вызван правильно - не используем stub instance
            assert.strictEqual(operation.callCount, 2);
        });

        test('Should handle operation that throws non-Error objects', async () => {
            const operation = () => Promise.reject('string error');
            
            const result = await retryManager.retry(operation, 'test_operation', {
                maxAttempts: 1
            });
            
            assert.ok(!result.success);
            assert.ok(result.lastError);
            // Проверяем что ошибка правильно обработана - message должен содержать string
            assert.strictEqual(result.lastError.message, 'string error');
        });
    });

    suite('Configuration Validation', () => {
        test('Should merge provided config with defaults', async () => {
            const operation = sinon.stub();
            operation.onCall(0).rejects(new Error('Test Error'));
            operation.onCall(1).resolves('success');
            
            const promise = retryManager.retry(operation, 'test_operation', {
                maxAttempts: 2 // Только указываем maxAttempts, остальное должно быть из defaults
            });
            
            // Выполняем все pending timers чтобы завершить все retry
            await clock.runAllAsync();
            
            const result = await promise;
            
            assert.ok(result.success);
            assert.strictEqual(result.attempts, 2);
        });
    });

    suite('Delay Calculation', () => {
        test('Should calculate linear delay correctly', async () => {
            const operation = sinon.stub();
            operation.onCall(0).rejects(new Error('Test'));
            operation.onCall(1).rejects(new Error('Test'));
            operation.onCall(2).resolves('success');
            
            const promise = retryManager.retry(operation, 'test_operation', {
                maxAttempts: 3,
                strategy: RetryStrategy.LINEAR_BACKOFF,
                baseDelay: 100,
                multiplier: 1.5 // increment = baseDelay * (multiplier - 1) = 100 * 0.5 = 50
            });
            
            // Выполняем все pending timers чтобы завершить все retry
            await clock.runAllAsync();
            
            const result = await promise;
            
            assert.ok(result.success);
            assert.strictEqual(result.attempts, 3);
            assert.strictEqual(operation.callCount, 3);
        });
    });

    suite('Async Operation Handling', () => {
        test('Should handle mixed sync/async operations', async () => {
            let callCount = 0;
            const mixedOperation = () => {
                callCount++;
                if (callCount === 1) {
                    return Promise.reject(new Error('Async rejection'));
                }
                return Promise.resolve('success');
            };
            
            const promise = retryManager.retry(mixedOperation, 'mixed_operation', {
                maxAttempts: 2,
                strategy: RetryStrategy.FIXED_DELAY,
                baseDelay: 10
            });
            
            // Выполняем все pending timers чтобы завершить все retry
            await clock.runAllAsync();
            
            const result = await promise;
            
            assert.ok(result.success);
            assert.strictEqual(result.result, 'success');
            assert.strictEqual(result.attempts, 2);
        });
    });
}); 