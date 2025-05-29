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
const ErrorHandler_1 = require("../../utils/ErrorHandler");
// Mock для vscode API
const mockVSCode = {
    window: {
        showErrorMessage: sinon.stub(),
        showWarningMessage: sinon.stub(),
        showInformationMessage: sinon.stub()
    }
};
// Мокируем vscode модуль
global.vscode = mockVSCode;
suite('ErrorHandler Tests', () => {
    let errorHandler;
    let mockDisplayHandler;
    let mockStatusBarManager;
    setup(() => {
        // Сбрасываем все моки
        sinon.reset();
        // Создаем моки
        mockDisplayHandler = {
            showError: sinon.stub(),
            showWarning: sinon.stub(),
            showInformation: sinon.stub(),
            updateStatusBar: sinon.stub()
        };
        mockStatusBarManager = {
            showError: sinon.stub(),
            showWarning: sinon.stub()
        };
        // Создаем ErrorHandler с моками
        errorHandler = new ErrorHandler_1.ErrorHandler(mockDisplayHandler, mockStatusBarManager);
    });
    teardown(() => {
        sinon.restore();
    });
    suite('Error Classification', () => {
        test('Should classify API key missing error correctly', async () => {
            const error = new Error('API key not configured');
            const context = {
                operation: 'test',
                timestamp: new Date()
            };
            await errorHandler.handleErrorFromException(error, context);
            // Проверяем что был вызван showError для критической ошибки
            assert.ok(mockDisplayHandler.showError.called);
            assert.ok(mockStatusBarManager.showError.called);
        });
        test('Should classify microphone permission error correctly', async () => {
            const error = new Error('Microphone permission denied');
            const context = {
                operation: 'test',
                timestamp: new Date()
            };
            await errorHandler.handleErrorFromException(error, context);
            assert.ok(mockDisplayHandler.showError.called);
            const errorMessage = mockDisplayHandler.showError.firstCall.args[0];
            assert.ok(errorMessage.includes('microphone'), 'Should mention microphone in error message');
        });
        test('Should classify transcription empty error as warning', async () => {
            const error = new Error('No speech detected in the audio');
            const context = {
                operation: 'test',
                timestamp: new Date()
            };
            await errorHandler.handleErrorFromException(error, context);
            // Для empty transcription должен использоваться status bar, а не popup
            assert.ok(mockDisplayHandler.updateStatusBar.called);
        });
        test('Should classify network error correctly', async () => {
            const error = new Error('Network connection failed');
            const context = {
                operation: 'test',
                timestamp: new Date()
            };
            await errorHandler.handleErrorFromException(error, context);
            assert.ok(mockDisplayHandler.showError.called);
            const actions = mockDisplayHandler.showError.firstCall.args[2];
            assert.ok(actions?.includes('Retry'), 'Should offer retry action for network errors');
        });
    });
    suite('Hold-to-Record Mode Handling', () => {
        test('Should suppress non-critical errors in hold-to-record mode', async () => {
            const error = new Error('No speech detected');
            const context = {
                operation: 'test',
                isHoldToRecordMode: true,
                timestamp: new Date()
            };
            await errorHandler.handleErrorFromException(error, context);
            // В hold-to-record режиме warning ошибки не должны показывать popup
            assert.ok(!mockDisplayHandler.showWarning.called);
            assert.ok(!mockDisplayHandler.showError.called);
        });
        test('Should show critical errors even in hold-to-record mode', async () => {
            const error = new Error('API key not configured');
            const context = {
                operation: 'test',
                isHoldToRecordMode: true,
                timestamp: new Date()
            };
            await errorHandler.handleErrorFromException(error, context);
            // Критические ошибки должны показываться даже в hold-to-record режиме
            assert.ok(mockDisplayHandler.showError.called);
        });
    });
    suite('Recovery Actions', () => {
        test('Should provide correct recovery actions for API key errors', async () => {
            const error = new Error('Invalid API key format');
            const context = {
                operation: 'test',
                timestamp: new Date()
            };
            await errorHandler.handleErrorFromException(error, context);
            assert.ok(mockDisplayHandler.showError.called);
            const actions = mockDisplayHandler.showError.firstCall.args[2];
            assert.ok(actions?.includes('Open Settings'), 'Should offer settings action for API key errors');
        });
        test('Should provide microphone recovery actions', async () => {
            const error = new Error('Microphone access denied');
            const context = {
                operation: 'test',
                timestamp: new Date()
            };
            await errorHandler.handleErrorFromException(error, context);
            assert.ok(mockDisplayHandler.showError.called);
            const actions = mockDisplayHandler.showError.firstCall.args[2];
            assert.ok(actions?.includes('Check Microphone'), 'Should offer microphone check action');
        });
        test('Should provide retry actions for retryable errors', async () => {
            const error = new Error('Network timeout occurred');
            const context = {
                operation: 'test',
                timestamp: new Date()
            };
            await errorHandler.handleErrorFromException(error, context);
            assert.ok(mockDisplayHandler.showError.called);
            const actions = mockDisplayHandler.showError.firstCall.args[2];
            assert.ok(actions?.includes('Retry'), 'Should offer retry action for network errors');
        });
    });
    suite('Status Bar Integration', () => {
        test('Should update status bar for all errors', async () => {
            const error = new Error('Test error');
            const context = {
                operation: 'test',
                timestamp: new Date()
            };
            await errorHandler.handleErrorFromException(error, context);
            assert.ok(mockStatusBarManager.showError.called);
            const message = mockStatusBarManager.showError.firstCall.args[0];
            const severity = mockStatusBarManager.showError.firstCall.args[1];
            assert.ok(typeof message === 'string');
            assert.ok(['warning', 'error', 'critical'].includes(severity));
        });
    });
    suite('Error Configuration', () => {
        test('Should identify retryable errors correctly', () => {
            assert.ok(errorHandler.isRetryable(ErrorHandler_1.ErrorType.NETWORK_ERROR));
            assert.ok(errorHandler.isRetryable(ErrorHandler_1.ErrorType.API_RATE_LIMIT));
            assert.ok(errorHandler.isRetryable(ErrorHandler_1.ErrorType.TRANSCRIPTION_FAILED));
            assert.ok(!errorHandler.isRetryable(ErrorHandler_1.ErrorType.API_KEY_MISSING));
            assert.ok(!errorHandler.isRetryable(ErrorHandler_1.ErrorType.MICROPHONE_COMPATIBILITY));
        });
        test('Should get error config correctly', () => {
            const config = errorHandler.getErrorConfig(ErrorHandler_1.ErrorType.API_KEY_MISSING);
            assert.ok(config);
            assert.strictEqual(config.severity, ErrorHandler_1.ErrorSeverity.CRITICAL);
            assert.strictEqual(config.userActionRequired, true);
        });
    });
    suite('VSCodeErrorDisplayHandler', () => {
        let displayHandler;
        setup(() => {
            displayHandler = new ErrorHandler_1.VSCodeErrorDisplayHandler();
        });
        test('Should call vscode.window.showErrorMessage for errors', async () => {
            await displayHandler.showError('Test error', ErrorHandler_1.ErrorSeverity.ERROR, ['Action']);
            assert.ok(mockVSCode.window.showErrorMessage.called);
            const message = mockVSCode.window.showErrorMessage.firstCall.args[0];
            assert.ok(message.includes('❌'));
        });
        test('Should call vscode.window.showWarningMessage for warnings', async () => {
            await displayHandler.showWarning('Test warning', ['Action']);
            assert.ok(mockVSCode.window.showWarningMessage.called);
            const message = mockVSCode.window.showWarningMessage.firstCall.args[0];
            assert.ok(message.includes('⚠️'));
        });
        test('Should call vscode.window.showInformationMessage for info', async () => {
            await displayHandler.showInformation('Test info', ['Action']);
            assert.ok(mockVSCode.window.showInformationMessage.called);
            const message = mockVSCode.window.showInformationMessage.firstCall.args[0];
            assert.ok(message.includes('ℹ️'));
        });
    });
    suite('Error Logging', () => {
        let consoleErrorStub;
        setup(() => {
            consoleErrorStub = sinon.stub(console, 'error');
        });
        teardown(() => {
            consoleErrorStub.restore();
        });
        test('Should log errors with proper format', async () => {
            const error = new Error('Test error');
            const context = {
                operation: 'test_operation',
                timestamp: new Date(),
                additionalData: { test: 'data' }
            };
            await errorHandler.handleErrorFromException(error, context);
            assert.ok(consoleErrorStub.called);
            // Проверяем что логирование включает все необходимые детали
            const logCalls = consoleErrorStub.getCalls();
            const logMessages = logCalls.map(call => call.args.join(' '));
            const fullLog = logMessages.join(' ');
            assert.ok(fullLog.includes('[VoiceScribe]'), 'Should include app prefix');
            assert.ok(fullLog.includes('test_operation'), 'Should include operation name');
            assert.ok(fullLog.includes('Original error'), 'Should log original error');
        });
    });
    suite('Error Context', () => {
        test('Should handle error context with additional data', async () => {
            const error = new Error('Test error');
            const context = {
                operation: 'complex_operation',
                timestamp: new Date(),
                attemptNumber: 2,
                additionalData: {
                    userId: '123',
                    sessionId: 'abc',
                    audioSize: 1024
                }
            };
            // Должно выполниться без ошибок
            await errorHandler.handleErrorFromException(error, context);
            assert.ok(mockDisplayHandler.showError.called);
        });
        test('Should handle minimal error context', async () => {
            const error = new Error('Test error');
            const context = {
                operation: 'simple_operation',
                timestamp: new Date()
            };
            // Должно выполниться без ошибок
            await errorHandler.handleErrorFromException(error, context);
            assert.ok(mockDisplayHandler.showError.called);
        });
    });
});
//# sourceMappingURL=ErrorHandler.test.js.map