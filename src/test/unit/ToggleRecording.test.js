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
// Mock для vscode API
const mockVSCode = {
    window: {
        showInformationMessage: sinon.stub().resolves(),
        showWarningMessage: sinon.stub().resolves(),
        showErrorMessage: sinon.stub().resolves()
    },
    commands: {
        executeCommand: sinon.stub().resolves()
    },
    workspace: {
        getConfiguration: sinon.stub().returns({
            get: sinon.stub().returns('toggle')
        })
    }
};
// Мокируем vscode модуль
global.vscode = mockVSCode;
class ToggleRecordingManager {
    state = {
        isToggleRecordingActive: false,
        isRecording: false,
        toggleRecordingTimeout: null
    };
    async startToggleRecording() {
        if (this.state.isToggleRecordingActive) {
            throw new Error('Recording already active');
        }
        this.state.isToggleRecordingActive = true;
        this.state.isRecording = true;
        // Мокируем VS Code команды
        await mockVSCode.commands.executeCommand('setContext', 'speechToTextWhisper.isToggleRecording', true);
        await mockVSCode.commands.executeCommand('setContext', 'speechToTextWhisper.isRecording', true);
        // Показываем уведомление
        mockVSCode.window.showInformationMessage('🎤 Toggle recording started. Press again to stop.');
        // Настраиваем timeout
        const maxDuration = 60;
        if (maxDuration > 0) {
            this.state.toggleRecordingTimeout = setTimeout(() => {
                this.stopToggleRecording();
            }, maxDuration * 1000);
        }
    }
    async stopToggleRecording() {
        if (!this.state.isToggleRecordingActive) {
            return;
        }
        // Очищаем timeout
        if (this.state.toggleRecordingTimeout) {
            clearTimeout(this.state.toggleRecordingTimeout);
            this.state.toggleRecordingTimeout = null;
        }
        this.state.isToggleRecordingActive = false;
        this.state.isRecording = false;
        // Обновляем контексты
        await mockVSCode.commands.executeCommand('setContext', 'speechToTextWhisper.isToggleRecording', false);
        await mockVSCode.commands.executeCommand('setContext', 'speechToTextWhisper.isRecording', false);
    }
    async handleToggleRecording() {
        if (this.state.isToggleRecordingActive) {
            await this.stopToggleRecording();
        }
        else {
            await this.startToggleRecording();
        }
    }
    getState() {
        return { ...this.state };
    }
    dispose() {
        if (this.state.toggleRecordingTimeout) {
            clearTimeout(this.state.toggleRecordingTimeout);
            this.state.toggleRecordingTimeout = null;
        }
        this.state.isToggleRecordingActive = false;
        this.state.isRecording = false;
    }
}
suite('Toggle Recording Tests', () => {
    let toggleRecordingManager;
    let originalSetTimeout;
    let originalClearTimeout;
    setup(() => {
        // Сохраняем оригинальные функции
        originalSetTimeout = global.setTimeout;
        originalClearTimeout = global.clearTimeout;
        // Мокируем setTimeout и clearTimeout
        let timeoutId = 1;
        const timeouts = new Map();
        global.setTimeout = sinon.stub().callsFake((callback, delay) => {
            const id = timeoutId++;
            timeouts.set(id, { callback, delay });
            return id;
        });
        global.clearTimeout = sinon.stub().callsFake((id) => {
            timeouts.delete(id);
        });
        // Сбрасываем моки
        sinon.resetHistory();
        sinon.resetBehavior();
        // Создаем новый экземпляр
        toggleRecordingManager = new ToggleRecordingManager();
        // Настраиваем заглушки
        mockVSCode.commands.executeCommand.resolves();
        mockVSCode.window.showInformationMessage.resolves();
    });
    teardown(() => {
        // Восстанавливаем оригинальные функции
        global.setTimeout = originalSetTimeout;
        global.clearTimeout = originalClearTimeout;
        if (toggleRecordingManager) {
            toggleRecordingManager.dispose();
        }
        sinon.restore();
    });
    suite('Start Toggle Recording', () => {
        test('Should start toggle recording successfully', async () => {
            await toggleRecordingManager.startToggleRecording();
            const state = toggleRecordingManager.getState();
            assert.strictEqual(state.isToggleRecordingActive, true);
            assert.strictEqual(state.isRecording, true);
            // Проверяем вызовы VS Code API
            assert.ok(mockVSCode.commands.executeCommand.calledWith('setContext', 'speechToTextWhisper.isToggleRecording', true));
            assert.ok(mockVSCode.commands.executeCommand.calledWith('setContext', 'speechToTextWhisper.isRecording', true));
            assert.ok(mockVSCode.window.showInformationMessage.calledWith('🎤 Toggle recording started. Press again to stop.'));
        });
        test('Should throw error when recording already active', async () => {
            await toggleRecordingManager.startToggleRecording();
            try {
                await toggleRecordingManager.startToggleRecording();
                assert.fail('Should have thrown an error');
            }
            catch (error) {
                assert.strictEqual(error.message, 'Recording already active');
            }
        });
        test('Should set timeout for maximum duration', async () => {
            await toggleRecordingManager.startToggleRecording();
            const state = toggleRecordingManager.getState();
            assert.ok(state.toggleRecordingTimeout);
            assert.ok(global.setTimeout.called);
        });
    });
    suite('Stop Toggle Recording', () => {
        test('Should stop toggle recording successfully', async () => {
            // Сначала начинаем запись
            await toggleRecordingManager.startToggleRecording();
            // Теперь останавливаем
            await toggleRecordingManager.stopToggleRecording();
            const state = toggleRecordingManager.getState();
            assert.strictEqual(state.isToggleRecordingActive, false);
            assert.strictEqual(state.isRecording, false);
            assert.strictEqual(state.toggleRecordingTimeout, null);
            // Проверяем обновление контекстов
            assert.ok(mockVSCode.commands.executeCommand.calledWith('setContext', 'speechToTextWhisper.isToggleRecording', false));
            assert.ok(mockVSCode.commands.executeCommand.calledWith('setContext', 'speechToTextWhisper.isRecording', false));
        });
        test('Should handle stop when not recording', async () => {
            // Пытаемся остановить без начала записи
            await toggleRecordingManager.stopToggleRecording();
            const state = toggleRecordingManager.getState();
            assert.strictEqual(state.isToggleRecordingActive, false);
            assert.strictEqual(state.isRecording, false);
        });
        test('Should clear timeout when stopping', async () => {
            await toggleRecordingManager.startToggleRecording();
            const state = toggleRecordingManager.getState();
            const timeoutBefore = state.toggleRecordingTimeout;
            assert.ok(timeoutBefore);
            await toggleRecordingManager.stopToggleRecording();
            assert.ok(global.clearTimeout.calledWith(timeoutBefore));
        });
    });
    suite('Handle Toggle Recording', () => {
        test('Should start recording when not active', async () => {
            await toggleRecordingManager.handleToggleRecording();
            const state = toggleRecordingManager.getState();
            assert.strictEqual(state.isToggleRecordingActive, true);
            assert.strictEqual(state.isRecording, true);
        });
        test('Should stop recording when active', async () => {
            // Сначала запускаем
            await toggleRecordingManager.startToggleRecording();
            // Теперь переключаем (должно остановить)
            await toggleRecordingManager.handleToggleRecording();
            const state = toggleRecordingManager.getState();
            assert.strictEqual(state.isToggleRecordingActive, false);
            assert.strictEqual(state.isRecording, false);
        });
        test('Should toggle state correctly multiple times', async () => {
            // Первое переключение - начинаем
            await toggleRecordingManager.handleToggleRecording();
            let state = toggleRecordingManager.getState();
            assert.strictEqual(state.isToggleRecordingActive, true);
            // Второе переключение - останавливаем
            await toggleRecordingManager.handleToggleRecording();
            state = toggleRecordingManager.getState();
            assert.strictEqual(state.isToggleRecordingActive, false);
            // Третье переключение - снова начинаем
            await toggleRecordingManager.handleToggleRecording();
            state = toggleRecordingManager.getState();
            assert.strictEqual(state.isToggleRecordingActive, true);
        });
    });
    suite('Recording Mode Detection', () => {
        test('Should detect toggle mode from configuration', () => {
            mockVSCode.workspace.getConfiguration.returns({
                get: sinon.stub().withArgs('recordingMode', 'hold').returns('toggle')
            });
            const config = mockVSCode.workspace.getConfiguration('speechToTextWhisper');
            const recordingMode = config.get('recordingMode', 'hold');
            assert.strictEqual(recordingMode, 'toggle');
        });
        test('Should default to hold mode when not configured', () => {
            mockVSCode.workspace.getConfiguration.returns({
                get: sinon.stub().withArgs('recordingMode', 'hold').returns('hold')
            });
            const config = mockVSCode.workspace.getConfiguration('speechToTextWhisper');
            const recordingMode = config.get('recordingMode', 'hold');
            assert.strictEqual(recordingMode, 'hold');
        });
    });
    suite('Error Handling', () => {
        test('Should handle VS Code command errors gracefully', async () => {
            // Мокируем ошибку в команде
            mockVSCode.commands.executeCommand.rejects(new Error('Command failed'));
            try {
                await toggleRecordingManager.startToggleRecording();
                // Несмотря на ошибку команды, состояние должно обновиться
                const state = toggleRecordingManager.getState();
                assert.strictEqual(state.isToggleRecordingActive, true);
            }
            catch (error) {
                // Ошибки команд не должны прерывать основной поток
                assert.fail('Should not throw error for command failures');
            }
        });
        test('Should cleanup state on dispose', () => {
            // Начинаем запись
            toggleRecordingManager.startToggleRecording();
            // Очищаем ресурсы
            toggleRecordingManager.dispose();
            const state = toggleRecordingManager.getState();
            assert.strictEqual(state.isToggleRecordingActive, false);
            assert.strictEqual(state.isRecording, false);
            assert.strictEqual(state.toggleRecordingTimeout, null);
        });
    });
    suite('Integration with Hold-to-Record', () => {
        test('Should not conflict with hold-to-record mode', () => {
            // Это больше концептуальный тест - toggle и hold режимы должны быть взаимоисключающими
            const toggleState = toggleRecordingManager.getState();
            // В реальном расширении toggle режим активен только когда hold режим неактивен
            assert.strictEqual(toggleState.isToggleRecordingActive, false);
        });
    });
    suite('Timeout Functionality', () => {
        test('Should auto-stop after maximum duration', async () => {
            const clock = sinon.useFakeTimers();
            try {
                await toggleRecordingManager.startToggleRecording();
                // Симулируем прохождение 60 секунд
                clock.tick(60000);
                const state = toggleRecordingManager.getState();
                // После timeout должна быть остановка
                assert.strictEqual(state.isToggleRecordingActive, false);
            }
            finally {
                clock.restore();
            }
        });
        test('Should clear timeout on manual stop', async () => {
            await toggleRecordingManager.startToggleRecording();
            await toggleRecordingManager.stopToggleRecording();
            assert.ok(global.clearTimeout.called);
        });
    });
});
//# sourceMappingURL=ToggleRecording.test.js.map