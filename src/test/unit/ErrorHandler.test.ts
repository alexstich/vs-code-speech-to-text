import * as assert from 'assert';
import * as sinon from 'sinon';
import { 
    ErrorHandler, 
    ErrorType, 
    ErrorSeverity, 
    ErrorContext, 
    ErrorDisplayHandler,
    VSCodeErrorDisplayHandler
} from '../../utils/ErrorHandler';

// Mock для vscode API
const mockVSCode = {
    window: {
        showErrorMessage: sinon.stub(),
        showWarningMessage: sinon.stub(),
        showInformationMessage: sinon.stub()
    }
};

// Мокируем vscode модуль
(global as any).vscode = mockVSCode;

suite('ErrorHandler Tests', () => {
    let errorHandler: ErrorHandler;
    let mockDisplayHandler: sinon.SinonStubbedInstance<ErrorDisplayHandler>;
    let mockStatusBarManager: any;

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
        errorHandler = new ErrorHandler(mockDisplayHandler, mockStatusBarManager);
    });

    teardown(() => {
        sinon.restore();
    });

    suite('Error Classification', () => {
        test('Should classify API key missing error correctly', async () => {
            const error = new Error('API key not configured');
            const context: ErrorContext = {
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
            const context: ErrorContext = {
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
            const context: ErrorContext = {
                operation: 'test',
                timestamp: new Date()
            };

            await errorHandler.handleErrorFromException(error, context);

            // Для empty transcription должен использоваться status bar, а не popup
            assert.ok(mockDisplayHandler.updateStatusBar.called);
        });

        test('Should classify network error correctly', async () => {
            const error = new Error('Network connection failed');
            const context: ErrorContext = {
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
            const context: ErrorContext = {
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
            const context: ErrorContext = {
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
            const context: ErrorContext = {
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
            const context: ErrorContext = {
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
            const context: ErrorContext = {
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
            const context: ErrorContext = {
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
            assert.ok(errorHandler.isRetryable(ErrorType.NETWORK_ERROR));
            assert.ok(errorHandler.isRetryable(ErrorType.API_RATE_LIMIT));
            assert.ok(errorHandler.isRetryable(ErrorType.TRANSCRIPTION_FAILED));
            
            assert.ok(!errorHandler.isRetryable(ErrorType.API_KEY_MISSING));
            assert.ok(!errorHandler.isRetryable(ErrorType.MICROPHONE_COMPATIBILITY));
        });

        test('Should get error config correctly', () => {
            const config = errorHandler.getErrorConfig(ErrorType.API_KEY_MISSING);
            assert.ok(config);
            assert.strictEqual(config.severity, ErrorSeverity.CRITICAL);
            assert.strictEqual(config.userActionRequired, true);
        });
    });

    suite('VSCodeErrorDisplayHandler', () => {
        let displayHandler: VSCodeErrorDisplayHandler;

        setup(() => {
            displayHandler = new VSCodeErrorDisplayHandler();
        });

        test('Should call vscode.window.showErrorMessage for errors', async () => {
            await displayHandler.showError('Test error', ErrorSeverity.ERROR, ['Action']);

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
        let consoleErrorStub: sinon.SinonStub;

        setup(() => {
            consoleErrorStub = sinon.stub(console, 'error');
        });

        teardown(() => {
            consoleErrorStub.restore();
        });

        test('Should log errors with proper format', async () => {
            const error = new Error('Test error');
            const context: ErrorContext = {
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
            
            assert.ok(fullLog.includes('[SpeechToTextWhisper]'), 'Should include app prefix');
            assert.ok(fullLog.includes('test_operation'), 'Should include operation name');
            assert.ok(fullLog.includes('Original error'), 'Should log original error');
        });
    });

    suite('Error Context', () => {
        test('Should handle error context with additional data', async () => {
            const error = new Error('Test error');
            const context: ErrorContext = {
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
            const context: ErrorContext = {
                operation: 'simple_operation',
                timestamp: new Date()
            };

            // Должно выполниться без ошибок
            await errorHandler.handleErrorFromException(error, context);
            
            assert.ok(mockDisplayHandler.showError.called);
        });
    });
}); 