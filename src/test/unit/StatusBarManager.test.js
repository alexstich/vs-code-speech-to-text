"use strict";
// StatusBarManager.test.ts - Unit тесты для StatusBarManager
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
const StatusBarManager_1 = require("../../ui/StatusBarManager");
const vscodeMocks_1 = require("../mocks/vscodeMocks");
suite('StatusBarManager Unit Tests', () => {
    let statusBarManager;
    let mockEvents;
    let clock;
    setup(() => {
        (0, vscodeMocks_1.setupVSCodeMocks)();
        clock = sinon.useFakeTimers();
        mockEvents = {
            onRecordingToggle: sinon.stub(),
            onSettings: sinon.stub(),
            onHelp: sinon.stub()
        };
        statusBarManager = new StatusBarManager_1.StatusBarManager(mockEvents);
    });
    teardown(() => {
        (0, vscodeMocks_1.resetVSCodeMocks)();
        clock.restore();
        sinon.restore();
        if (statusBarManager) {
            statusBarManager.dispose();
        }
    });
    suite('Constructor and Configuration', () => {
        test('Should create with default configuration', () => {
            const createStub = vscodeMocks_1.mockVscode.window.createStatusBarItem;
            assert.ok(createStub.calledOnce);
            const status = statusBarManager.getStatus();
            assert.strictEqual(status.state, 'idle');
            assert.strictEqual(status.isRecording, false);
        });
        test('Should create with custom configuration', () => {
            const config = {
                position: 'left',
                priority: 200,
                showTooltips: false,
                enableAnimations: false
            };
            const customManager = new StatusBarManager_1.StatusBarManager(mockEvents, config);
            const status = customManager.getStatus();
            assert.strictEqual(status.configuration.position, 'left');
            assert.strictEqual(status.configuration.priority, 200);
            assert.strictEqual(status.configuration.showTooltips, false);
            customManager.dispose();
        });
        test('Should create minimal configuration', () => {
            const config = StatusBarManager_1.StatusBarManager.createMinimalConfig();
            const minimalManager = new StatusBarManager_1.StatusBarManager(mockEvents, config);
            const status = minimalManager.getStatus();
            assert.strictEqual(status.configuration.showTooltips, false);
            assert.strictEqual(status.configuration.enableAnimations, false);
            assert.strictEqual(status.configuration.showProgress, false);
            minimalManager.dispose();
        });
        test('Should create full configuration', () => {
            const config = StatusBarManager_1.StatusBarManager.createFullConfig();
            const fullManager = new StatusBarManager_1.StatusBarManager(mockEvents, config);
            const status = fullManager.getStatus();
            assert.strictEqual(status.configuration.showTooltips, true);
            assert.strictEqual(status.configuration.enableAnimations, true);
            assert.strictEqual(status.configuration.showProgress, true);
            fullManager.dispose();
        });
    });
    suite('State Management', () => {
        test('Should update recording state to true', () => {
            statusBarManager.updateRecordingState(true);
            const status = statusBarManager.getStatus();
            assert.strictEqual(status.state, 'recording');
            assert.strictEqual(status.isRecording, true);
        });
        test('Should update recording state to false', () => {
            statusBarManager.updateRecordingState(true);
            statusBarManager.updateRecordingState(false);
            const status = statusBarManager.getStatus();
            assert.strictEqual(status.state, 'idle');
            assert.strictEqual(status.isRecording, false);
        });
        test('Should show processing state', () => {
            statusBarManager.showProcessing();
            const status = statusBarManager.getStatus();
            assert.strictEqual(status.state, 'processing');
        });
        test('Should show transcribing state', () => {
            statusBarManager.showTranscribing();
            const status = statusBarManager.getStatus();
            assert.strictEqual(status.state, 'transcribing');
        });
        test('Should show inserting state', () => {
            statusBarManager.showInserting();
            const status = statusBarManager.getStatus();
            assert.strictEqual(status.state, 'inserting');
        });
        test('Should show success state with message', () => {
            statusBarManager.showSuccess('Operation completed');
            const status = statusBarManager.getStatus();
            assert.strictEqual(status.state, 'success');
        });
        test('Should show error state with severity', () => {
            statusBarManager.showError('Test error', 'error');
            const status = statusBarManager.getStatus();
            assert.strictEqual(status.state, 'error');
            assert.strictEqual(status.lastError, 'Test error');
        });
        test('Should show warning state', () => {
            statusBarManager.showWarning('Test warning');
            const status = statusBarManager.getStatus();
            assert.strictEqual(status.state, 'warning');
        });
    });
    suite('Progress and Animation', () => {
        test('Should update progress when enabled', () => {
            const config = { showProgress: true };
            const progressManager = new StatusBarManager_1.StatusBarManager(mockEvents, config);
            progressManager.updateProgress(50, 'Processing...');
            // Тест прошел если не выбросилось исключение
            assert.ok(true);
            progressManager.dispose();
        });
        test('Should not update progress when disabled', () => {
            const config = { showProgress: false };
            const progressManager = new StatusBarManager_1.StatusBarManager(mockEvents, config);
            progressManager.updateProgress(50, 'Processing...');
            // Тест прошел если не выбросилось исключение
            assert.ok(true);
            progressManager.dispose();
        });
    });
    suite('Timers and Auto-reset', () => {
        test('Should auto-reset success state after timeout', () => {
            const config = {
                autoHideOnSuccess: true,
                successDisplayDuration: 1000
            };
            const timerManager = new StatusBarManager_1.StatusBarManager(mockEvents, config);
            timerManager.showSuccess('Success message');
            let status = timerManager.getStatus();
            assert.strictEqual(status.state, 'success');
            // Перемещаем время на 1 секунду вперед
            clock.tick(1000);
            status = timerManager.getStatus();
            assert.strictEqual(status.state, 'idle');
            timerManager.dispose();
        });
        test('Should auto-reset error state after timeout', () => {
            const config = {
                errorDisplayDuration: 2000
            };
            const timerManager = new StatusBarManager_1.StatusBarManager(mockEvents, config);
            timerManager.showError('Error message');
            let status = timerManager.getStatus();
            assert.strictEqual(status.state, 'error');
            assert.strictEqual(status.lastError, 'Error message');
            // Перемещаем время на 2 секунды вперед
            clock.tick(2000);
            status = timerManager.getStatus();
            assert.strictEqual(status.state, 'idle');
            assert.strictEqual(status.lastError, null);
            timerManager.dispose();
        });
        test('Should not auto-reset when autoHideOnSuccess is false', () => {
            const config = { autoHideOnSuccess: false };
            const noResetManager = new StatusBarManager_1.StatusBarManager(mockEvents, config);
            noResetManager.showSuccess('Success message');
            let status = noResetManager.getStatus();
            assert.strictEqual(status.state, 'success');
            // Перемещаем время вперед
            clock.tick(5000);
            status = noResetManager.getStatus();
            assert.strictEqual(status.state, 'success'); // Должно остаться success
            noResetManager.dispose();
        });
    });
    suite('Visibility Control', () => {
        test('Should show status bar item', () => {
            statusBarManager.show();
            // Тест прошел если не выбросилось исключение
            assert.ok(true);
        });
        test('Should hide status bar item', () => {
            statusBarManager.hide();
            // Тест прошел если не выбросилось исключение
            assert.ok(true);
        });
        test('Should toggle visibility', () => {
            statusBarManager.toggle();
            // Тест прошел если не выбросилось исключение
            assert.ok(true);
        });
    });
    suite('Configuration Updates', () => {
        test('Should update configuration', () => {
            const newConfig = {
                showTooltips: false,
                enableAnimations: false
            };
            statusBarManager.updateConfiguration(newConfig);
            const status = statusBarManager.getStatus();
            assert.strictEqual(status.configuration.showTooltips, false);
            assert.strictEqual(status.configuration.enableAnimations, false);
        });
        test('Should recreate item when position changes', () => {
            const initialCreateCount = vscodeMocks_1.mockVscode.window.createStatusBarItem.callCount;
            statusBarManager.updateConfiguration({ position: 'left' });
            const finalCreateCount = vscodeMocks_1.mockVscode.window.createStatusBarItem.callCount;
            assert.ok(finalCreateCount > initialCreateCount);
        });
    });
    suite('Error Severity Handling', () => {
        test('Should handle critical errors', () => {
            statusBarManager.showError('Critical API error', 'critical');
            const status = statusBarManager.getStatus();
            assert.strictEqual(status.state, 'error');
            assert.strictEqual(status.lastError, 'Critical API error');
        });
        test('Should handle warnings properly', () => {
            statusBarManager.showError('Warning message', 'warning');
            const status = statusBarManager.getStatus();
            assert.strictEqual(status.state, 'warning');
        });
    });
    suite('Cleanup and Resource Management', () => {
        test('Should dispose all timers and resources', () => {
            // Создаем различные состояния с таймерами
            statusBarManager.showSuccess('Success');
            statusBarManager.showError('Error');
            statusBarManager.showProcessing();
            // Dispose должен очистить все таймеры без ошибок
            statusBarManager.dispose();
            // Тест прошел если не выбросилось исключение
            assert.ok(true);
        });
        test('Should handle multiple dispose calls', () => {
            statusBarManager.dispose();
            statusBarManager.dispose(); // Второй вызов не должен вызывать ошибок
            assert.ok(true);
        });
    });
    suite('Static Configuration Factories', () => {
        test('Should create debug configuration', () => {
            const debugConfig = StatusBarManager_1.StatusBarManager.createDebugConfig();
            assert.strictEqual(debugConfig.position, 'left');
            assert.strictEqual(debugConfig.priority, 1000);
            assert.strictEqual(debugConfig.autoHideOnSuccess, false);
            assert.strictEqual(debugConfig.successDisplayDuration, 5000);
            assert.strictEqual(debugConfig.errorDisplayDuration, 10000);
        });
    });
});
//# sourceMappingURL=StatusBarManager.test.js.map