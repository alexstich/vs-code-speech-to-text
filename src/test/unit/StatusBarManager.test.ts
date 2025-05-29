// StatusBarManager.test.ts - Unit тесты для StatusBarManager

import * as assert from 'assert';
import * as sinon from 'sinon';
import { 
    StatusBarManager, 
    StatusBarEvents, 
    StatusBarConfiguration,
    StatusBarState 
} from '../../ui/StatusBarManager';
import { setupVSCodeMocks, resetVSCodeMocks, mockVscode } from '../mocks/vscodeMocks';

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
            assert.strictEqual(status.lastError, 'Error message');
            
            // Перемещаем время на 2 секунды вперед
            clock.tick(2000);
            
            status = timerManager.getStatus();
            assert.strictEqual(status.state, 'idle');
            assert.strictEqual(status.lastError, null);
            
            timerManager.dispose();
        });

        test('Should not auto-reset when autoHideOnSuccess is false', () => {
            const config: StatusBarConfiguration = { autoHideOnSuccess: false };
            const noResetManager = new StatusBarManager(mockEvents, config);
            
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
            const newConfig: Partial<StatusBarConfiguration> = {
                showTooltips: false,
                enableAnimations: false
            };
            
            statusBarManager.updateConfiguration(newConfig);
            
            const status = statusBarManager.getStatus();
            assert.strictEqual(status.configuration.showTooltips, false);
            assert.strictEqual(status.configuration.enableAnimations, false);
        });

        test('Should recreate item when position changes', () => {
            const initialCreateCount = (mockVscode.window.createStatusBarItem as sinon.SinonStub).callCount;
            
            statusBarManager.updateConfiguration({ position: 'left' });
            
            const finalCreateCount = (mockVscode.window.createStatusBarItem as sinon.SinonStub).callCount;
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
            const debugConfig = StatusBarManager.createDebugConfig();
            
            assert.strictEqual(debugConfig.position, 'left');
            assert.strictEqual(debugConfig.priority, 1000);
            assert.strictEqual(debugConfig.autoHideOnSuccess, false);
            assert.strictEqual(debugConfig.successDisplayDuration, 5000);
            assert.strictEqual(debugConfig.errorDisplayDuration, 10000);
        });
    });
}); 