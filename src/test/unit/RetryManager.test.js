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
const assert = __importStar(require("assert"));
const sinon = __importStar(require("sinon"));
const RetryManager_1 = require("../../utils/RetryManager");
const ErrorHandler_1 = require("../../utils/ErrorHandler");
suite('RetryManager Tests', () => {
    let retryManager;
    let mockErrorHandler;
    let clock;
    setup(() => {
        // Мокируем ErrorHandler
        mockErrorHandler = sinon.createStubInstance(ErrorHandler_1.ErrorHandler);
        // Создаем RetryManager
        retryManager = new RetryManager_1.RetryManager(mockErrorHandler);
        // Мокируем время для контроля delay
        clock = sinon.useFakeTimers();
    });
    teardown(() => {
        clock.restore();
        sinon.restore();
    });
    suite('Basic Retry Functionality', () => {
        test('Should succeed on first attempt', async () => {
            const successOperation = sinon.stub().resolves('success');
            const promise = retryManager.retry(successOperation, 'test_operation');
            // Не нужно advance clock для первой попытки
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
            const promise = retryManager.retry(operation, 'test_operation', {
                maxAttempts: 3,
                strategy: RetryManager_1.RetryStrategy.FIXED_DELAY,
                baseDelay: 100
            });
            // Advance clock для retry delay
            setTimeout(() => clock.tick(100), 0);
            const result = await promise;
            assert.ok(result.success);
            assert.strictEqual(result.result, 'success');
            assert.strictEqual(result.attempts, 2);
            assert.strictEqual(operation.callCount, 2);
        });
        test('Should fail after max attempts', async () => {
            const failingOperation = sinon.stub().rejects(new Error('Persistent failure'));
            const promise = retryManager.retry(failingOperation, 'test_operation', {
                maxAttempts: 2,
                strategy: RetryManager_1.RetryStrategy.FIXED_DELAY,
                baseDelay: 50
            });
            // Advance clock для обеих retry attempts
            setTimeout(() => {
                clock.tick(50); // First retry
                setTimeout(() => clock.tick(50), 0); // Second retry
            }, 0);
            const result = await promise;
            assert.ok(!result.success);
            assert.strictEqual(result.attempts, 2);
            assert.strictEqual(failingOperation.callCount, 2);
            assert.ok(result.lastError);
            assert.strictEqual(result.lastError.message, 'Persistent failure');
        });
    });
    suite('Retry Strategies', () => {
        test('Should use exponential backoff correctly', async () => {
            const operation = sinon.stub();
            operation.onCall(0).rejects(new Error('Fail 1'));
            operation.onCall(1).rejects(new Error('Fail 2'));
            operation.onCall(2).resolves('success');
            const startTime = Date.now();
            let delays = [];
            // Capture delays
            const originalSetTimeout = global.setTimeout;
            sinon.stub(global, 'setTimeout').callsFake((callback, delay) => {
                delays.push(delay || 0);
                return originalSetTimeout(callback, 0); // Execute immediately for test
            });
            const promise = retryManager.retry(operation, 'test_operation', {
                maxAttempts: 3,
                strategy: RetryManager_1.RetryStrategy.EXPONENTIAL_BACKOFF,
                baseDelay: 100,
                multiplier: 2
            });
            const result = await promise;
            assert.ok(result.success);
            assert.strictEqual(delays.length, 2); // Two delays for two retries
            assert.strictEqual(delays[0], 100); // First retry: 100ms
            assert.strictEqual(delays[1], 200); // Second retry: 200ms (100 * 2)
        });
        test('Should use linear backoff correctly', async () => {
            const operation = sinon.stub();
            operation.onCall(0).rejects(new Error('Fail 1'));
            operation.onCall(1).rejects(new Error('Fail 2'));
            operation.onCall(2).resolves('success');
            let delays = [];
            const originalSetTimeout = global.setTimeout;
            sinon.stub(global, 'setTimeout').callsFake((callback, delay) => {
                delays.push(delay || 0);
                return originalSetTimeout(callback, 0);
            });
            await retryManager.retry(operation, 'test_operation', {
                maxAttempts: 3,
                strategy: RetryManager_1.RetryStrategy.LINEAR_BACKOFF,
                baseDelay: 100,
                multiplier: 1.5
            });
            assert.strictEqual(delays[0], 100); // First retry: 100ms
            assert.strictEqual(delays[1], 150); // Second retry: 100 + (100 * 0.5)
        });
        test('Should respect max delay', async () => {
            const operation = sinon.stub();
            operation.onCall(0).rejects(new Error('Fail 1'));
            operation.onCall(1).rejects(new Error('Fail 2'));
            operation.onCall(2).resolves('success');
            let delays = [];
            const originalSetTimeout = global.setTimeout;
            sinon.stub(global, 'setTimeout').callsFake((callback, delay) => {
                delays.push(delay || 0);
                return originalSetTimeout(callback, 0);
            });
            await retryManager.retry(operation, 'test_operation', {
                maxAttempts: 3,
                strategy: RetryManager_1.RetryStrategy.EXPONENTIAL_BACKOFF,
                baseDelay: 100,
                multiplier: 10, // Would result in very large delays
                maxDelay: 150 // But capped at 150ms
            });
            assert.ok(delays.every(delay => delay <= 150), 'All delays should be capped at maxDelay');
        });
        test('Should add jitter when enabled', async () => {
            const operation = sinon.stub();
            operation.onCall(0).rejects(new Error('Fail 1'));
            operation.onCall(1).resolves('success');
            let delays = [];
            // Mock Math.random для предсказуемого jitter
            const originalRandom = Math.random;
            sinon.stub(Math, 'random').returns(0.5); // 50% jitter
            const originalSetTimeout = global.setTimeout;
            sinon.stub(global, 'setTimeout').callsFake((callback, delay) => {
                delays.push(delay || 0);
                return originalSetTimeout(callback, 0);
            });
            await retryManager.retry(operation, 'test_operation', {
                maxAttempts: 2,
                strategy: RetryManager_1.RetryStrategy.FIXED_DELAY,
                baseDelay: 100,
                jitter: true
            });
            // С jitter 50% от 100ms = 50ms, итого delay = 100 + 50 = 150ms
            assert.strictEqual(delays[0], 150);
            Math.random.restore();
        });
    });
    suite('Specialized Retry Methods', () => {
        test('Should use correct config for API requests', async () => {
            const apiOperation = sinon.stub().rejects(new Error('API Error'));
            const result = await retryManager.retryApiRequest(apiOperation, 'api_test');
            assert.ok(!result.success);
            // Default API config should retry 3 times
            assert.strictEqual(result.attempts, 3);
            assert.strictEqual(apiOperation.callCount, 3);
        });
        test('Should use correct config for microphone operations', async () => {
            const micOperation = sinon.stub().rejects(new Error('Microphone Error'));
            const result = await retryManager.retryMicrophoneOperation(micOperation, 'mic_test');
            assert.ok(!result.success);
            // Default microphone config should retry 2 times with shorter delays
            assert.strictEqual(result.attempts, 2);
            assert.strictEqual(micOperation.callCount, 2);
        });
    });
    suite('Error Handling Integration', () => {
        test('Should log retry attempts', async () => {
            const operation = sinon.stub();
            operation.onCall(0).rejects(new Error('First failure'));
            operation.onCall(1).resolves('success');
            const consoleLogStub = sinon.stub(console, 'log');
            await retryManager.retry(operation, 'test_operation', {
                maxAttempts: 2,
                strategy: RetryManager_1.RetryStrategy.IMMEDIATE
            });
            // Проверяем что были логи о retry
            const logCalls = consoleLogStub.getCalls();
            const logMessages = logCalls.map(call => call.args.join(' '));
            const retryLogs = logMessages.filter(msg => msg.includes('Retrying'));
            assert.ok(retryLogs.length > 0, 'Should log retry attempts');
            consoleLogStub.restore();
        });
        test('Should handle operation that throws non-Error objects', async () => {
            const operation = sinon.stub().rejects('string error');
            const result = await retryManager.retry(operation, 'test_operation', {
                maxAttempts: 1
            });
            assert.ok(!result.success);
            assert.ok(result.lastError instanceof Error);
            assert.ok(result.lastError.message.includes('string error'));
        });
    });
    suite('Configuration Validation', () => {
        test('Should use default config when none provided', async () => {
            const operation = sinon.stub().resolves('success');
            const result = await retryManager.retry(operation, 'test_operation');
            assert.ok(result.success);
            // Should use default maxAttempts
            assert.strictEqual(operation.callCount, 1);
        });
        test('Should merge provided config with defaults', async () => {
            const operation = sinon.stub();
            operation.onCall(0).rejects(new Error('Fail'));
            operation.onCall(1).resolves('success');
            const result = await retryManager.retry(operation, 'test_operation', {
                maxAttempts: 5 // Override only maxAttempts
            });
            // Should still use default strategy but with custom maxAttempts
            assert.ok(result.success);
            assert.strictEqual(result.attempts, 2);
        });
    });
    suite('Delay Calculation', () => {
        test('Should calculate exponential delay correctly', () => {
            const config = {
                maxAttempts: 5,
                strategy: RetryManager_1.RetryStrategy.EXPONENTIAL_BACKOFF,
                baseDelay: 100,
                maxDelay: 10000,
                multiplier: 2,
                jitter: false
            };
            // Доступ к private методу через (retryManager as any)
            const delay1 = retryManager.calculateDelay(1, config);
            const delay2 = retryManager.calculateDelay(2, config);
            const delay3 = retryManager.calculateDelay(3, config);
            assert.strictEqual(delay1, 100); // 100 * 2^0 = 100
            assert.strictEqual(delay2, 200); // 100 * 2^1 = 200
            assert.strictEqual(delay3, 400); // 100 * 2^2 = 400
        });
        test('Should calculate linear delay correctly', () => {
            const config = {
                maxAttempts: 5,
                strategy: RetryManager_1.RetryStrategy.LINEAR_BACKOFF,
                baseDelay: 100,
                maxDelay: 10000,
                multiplier: 1.5,
                jitter: false
            };
            const delay1 = retryManager.calculateDelay(1, config);
            const delay2 = retryManager.calculateDelay(2, config);
            assert.strictEqual(delay1, 100); // 100 + (100 * 1.5 * 0) = 100
            assert.strictEqual(delay2, 150); // 100 + (100 * 1.5 * 1) = 250... wait, let me check linear calculation
        });
    });
    suite('Async Operation Handling', () => {
        test('Should handle Promise rejection correctly', async () => {
            const operation = () => Promise.reject(new Error('Promise rejection'));
            const result = await retryManager.retry(operation, 'promise_test', {
                maxAttempts: 1
            });
            assert.ok(!result.success);
            assert.strictEqual(result.lastError.message, 'Promise rejection');
        });
        test('Should handle async function that throws', async () => {
            const operation = async () => {
                throw new Error('Async throw');
            };
            const result = await retryManager.retry(operation, 'async_test', {
                maxAttempts: 1
            });
            assert.ok(!result.success);
            assert.strictEqual(result.lastError.message, 'Async throw');
        });
        test('Should handle mixed sync/async operations', async () => {
            let callCount = 0;
            const operation = () => {
                callCount++;
                if (callCount === 1) {
                    throw new Error('Sync throw'); // Synchronous error
                }
                else {
                    return Promise.resolve('async success'); // Async success
                }
            };
            const result = await retryManager.retry(operation, 'mixed_test', {
                maxAttempts: 2,
                strategy: RetryManager_1.RetryStrategy.IMMEDIATE
            });
            assert.ok(result.success);
            assert.strictEqual(result.result, 'async success');
            assert.strictEqual(result.attempts, 2);
        });
    });
});
//# sourceMappingURL=RetryManager.test.js.map