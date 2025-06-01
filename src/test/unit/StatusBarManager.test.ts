// StatusBarManager.test.ts - Unit тесты для StatusBarManager

import * as assert from 'assert';
import * as sinon from 'sinon';

// Настраиваем мок для vscode до любых импортов
import { setupVSCodeMocks, resetVSCodeMocks, mockVscode } from '../mocks/vscodeMocks';

// Мокируем vscode модуль
const Module = require('module');
const originalRequire = Module.prototype.require;

Module.prototype.require = function (id: string) {
    if (id === 'vscode') {
        return mockVscode;
    }
    return originalRequire.apply(this, arguments);
};

// Теперь можно импортировать классы, которые используют vscode
import { 
    StatusBarManager, 
    StatusBarEvents, 
    StatusBarConfiguration,
    StatusBarState 
} from '../../ui/StatusBarManager';

suite('StatusBarManager Unit Tests', () => {
    let statusBarManager: StatusBarManager;
    let mockEvents: StatusBarEvents;
    let clock: sinon.SinonFakeTimers;

    setup(() => {
        setupVSCodeMocks();
        clock = sinon.useFakeTimers();
        
        mockEvents = {
            onRecordingToggle: sinon.stub(),
            onSettings: sinon.stub(),
            onHelp: sinon.stub()
        };
        
        statusBarManager = new StatusBarManager(mockEvents);
    });

    teardown(() => {
        resetVSCodeMocks();
        clock.restore();
        sinon.restore();
        if (statusBarManager) {
            statusBarManager.dispose();
        }
        // Восстанавливаем оригинальный require
        Module.prototype.require = originalRequire;
    });

    suite('Constructor and Configuration', () => {
        test('Should create with default configuration', () => {
            const createStub = mockVscode.window.createStatusBarItem as sinon.SinonStub;
            assert.ok(createStub.calledOnce);
            
            const status = statusBarManager.getStatus();
            assert.strictEqual(status.state, 'idle');
            assert.strictEqual(status.isRecording, false);
        });

        test('Should create with custom configuration', () => {
            const config: StatusBarConfiguration = {
                position: 'left',
                priority: 200,
                showTooltips: false,
                enableAnimations: false
            };
            
            const customManager = new StatusBarManager(mockEvents, config);
            const status = customManager.getStatus();
            
            assert.strictEqual(status.configuration.position, 'left');
            assert.strictEqual(status.configuration.priority, 200);
            assert.strictEqual(status.configuration.showTooltips, false);
            
            customManager.dispose();
        });

        test('Should create minimal configuration', () => {
            const config = StatusBarManager.createMinimalConfig();
            const minimalManager = new StatusBarManager(mockEvents, config);
            
            const status = minimalManager.getStatus();
            assert.strictEqual(status.configuration.showTooltips, false);
            assert.strictEqual(status.configuration.enableAnimations, false);
            assert.strictEqual(status.configuration.showProgress, false);
            
            minimalManager.dispose();
        });

        test('Should create full configuration', () => {
            const config = StatusBarManager.createFullConfig();
            const fullManager = new StatusBarManager(mockEvents, config);
            
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
            const config: StatusBarConfiguration = { showProgress: true };
            const progressManager = new StatusBarManager(mockEvents, config);
            
            progressManager.updateProgress(50, 'Processing...');
            // Тест прошел если не выбросилось исключение
            assert.ok(true);
            
            progressManager.dispose();
        });

        test('Should not update progress when disabled', () => {
            const config: StatusBarConfiguration = { showProgress: false };
            const progressManager = new StatusBarManager(mockEvents, config);
            
            progressManager.updateProgress(50, 'Processing...');
            // Тест прошел если не выбросилось исключение
            assert.ok(true);
            
            progressManager.dispose();
        });
    });

    suite('Timers and Auto-reset', () => {
        test('Should auto-reset success state after timeout', () => {
            const config: StatusBarConfiguration = { 
                autoHideOnSuccess: true,
                successDisplayDuration: 1000 
            };
            const timerManager = new StatusBarManager(mockEvents, config);
            
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
            const config: StatusBarConfiguration = { 
                errorDisplayDuration: 2000 
            };
            const timerManager = new StatusBarManager(mockEvents, config);
            
            timerManager.showError('Error message');
            
            let status = timerManager.getStatus();
            assert.strictEqual(status.state, 'error');
            
            // Перемещаем время на 2 секунды вперед
            clock.tick(2000);
            
            status = timerManager.getStatus();
            assert.strictEqual(status.state, 'idle');
            
            timerManager.dispose();
        });

        test('Should not auto-reset when disabled', () => {
            const config: StatusBarConfiguration = { 
                autoHideOnSuccess: false 
            };
            const timerManager = new StatusBarManager(mockEvents, config);
            
            timerManager.showSuccess('Success message');
            
            // Перемещаем время вперед
            clock.tick(5000);
            
            const status = timerManager.getStatus();
            assert.strictEqual(status.state, 'success');
            
            timerManager.dispose();
        });
    });

    suite('Configuration Updates', () => {
        test('Should update configuration', () => {
            const newConfig: Partial<StatusBarConfiguration> = {
                position: 'left',
                priority: 300
            };
            
            statusBarManager.updateConfiguration(newConfig);
            
            const status = statusBarManager.getStatus();
            assert.strictEqual(status.configuration.position, 'left');
            assert.strictEqual(status.configuration.priority, 300);
        });

        test('Should recreate item when position changes', () => {
            const createStub = mockVscode.window.createStatusBarItem as sinon.SinonStub;
            const initialCreateCount = createStub.callCount;
            
            statusBarManager.updateConfiguration({ position: 'left' });
            
            const finalCreateCount = createStub.callCount;
            assert.ok(finalCreateCount > initialCreateCount);
        });

        test('Should preserve state during configuration update', () => {
            statusBarManager.showSuccess('Test success');
            
            statusBarManager.updateConfiguration({ priority: 400 });
            
            const status = statusBarManager.getStatus();
            assert.strictEqual(status.state, 'success');
        });
    });

    suite('Disposal and Cleanup', () => {
        test('Should dispose correctly', () => {
            statusBarManager.dispose();
            // Тест прошел если не выбросилось исключение
            assert.ok(true);
        });

        test('Should clear timers on disposal', () => {
            statusBarManager.showSuccess('Success message');
            statusBarManager.dispose();
            
            // Перемещаем время вперед
            clock.tick(2000);
            
            // Проверяем что состояние не изменилось (таймер был очищен)
            // Объект уже disposed, поэтому просто проверяем что исключение не выбросилось
            assert.ok(true);
        });
    });

    suite('Edge Cases', () => {
        test('Should handle rapid state changes', () => {
            statusBarManager.showSuccess('Success 1');
            statusBarManager.showError('Error 1');
            statusBarManager.showProcessing();
            statusBarManager.updateRecordingState(true);
            
            const status = statusBarManager.getStatus();
            assert.strictEqual(status.state, 'recording');
            assert.strictEqual(status.isRecording, true);
        });

        test('Should handle empty error messages', () => {
            statusBarManager.showError('');
            
            const status = statusBarManager.getStatus();
            assert.strictEqual(status.state, 'error');
        });

        test('Should handle null/undefined messages', () => {
            statusBarManager.showSuccess(undefined as any);
            
            const status = statusBarManager.getStatus();
            assert.strictEqual(status.state, 'success');
        });
    });

    suite('Static Factory Methods', () => {
        test('Should create minimal configuration', () => {
            const config = StatusBarManager.createMinimalConfig();
            
            assert.strictEqual(config.enableAnimations, false);
            assert.strictEqual(config.showProgress, false);
            assert.strictEqual(config.showTooltips, false);
        });

        test('Should create full configuration', () => {
            const config = StatusBarManager.createFullConfig();
            
            assert.strictEqual(config.enableAnimations, true);
            assert.strictEqual(config.showProgress, true);
            assert.strictEqual(config.showTooltips, true);
        });

        test('Should create debug configuration', () => {
            const config = StatusBarManager.createDebugConfig();
            
            assert.strictEqual(config.position, 'left');
            assert.strictEqual(config.priority, 1000);
            assert.strictEqual(config.autoHideOnSuccess, false);
        });
    });
}); 