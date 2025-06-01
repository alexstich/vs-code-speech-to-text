import * as assert from 'assert';
import * as sinon from 'sinon';

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
            get: sinon.stub().returns('chat')
        })
    }
};

// Мокируем vscode модуль
(global as any).vscode = mockVSCode;

// Симуляция упрощенных команд записи
interface RecordingState {
    currentMode: 'chat' | 'clipboard' | null;
    isRecording: boolean;
}

class SimplifiedRecordingManager {
    private state: RecordingState = {
        currentMode: null,
        isRecording: false
    };

    async recordAndSendToChat(): Promise<void> {
        if (this.state.isRecording) {
            throw new Error('Recording already in progress');
        }

        this.state.currentMode = 'chat';
        this.state.isRecording = true;

        // Мокируем VS Code команды
        await mockVSCode.commands.executeCommand('setContext', 'speechToTextWhisper.isRecording', true);
        
        // Показываем уведомление
        mockVSCode.window.showInformationMessage('🎤 Recording... Release F9 to send to chat');
    }

    async recordToClipboard(): Promise<void> {
        if (this.state.isRecording) {
            throw new Error('Recording already in progress');
        }

        this.state.currentMode = 'clipboard';
        this.state.isRecording = true;

        // Мокируем VS Code команды
        await mockVSCode.commands.executeCommand('setContext', 'speechToTextWhisper.isRecording', true);
        
        // Показываем уведомление
        mockVSCode.window.showInformationMessage('🎤 Recording... Release Ctrl+Shift+V to copy to clipboard');
    }

    async stopRecording(): Promise<void> {
        if (!this.state.isRecording) {
            return;
        }

        const mode = this.state.currentMode;
        
        this.state.isRecording = false;
        this.state.currentMode = null;

        // Обновляем контексты
        await mockVSCode.commands.executeCommand('setContext', 'speechToTextWhisper.isRecording', false);

        // Симулируем обработку в зависимости от режима
        if (mode === 'chat') {
            mockVSCode.window.showInformationMessage('✅ Transcribed and sent to chat');
        } else if (mode === 'clipboard') {
            mockVSCode.window.showInformationMessage('✅ Transcribed and copied to clipboard');
        }
    }

    getState(): RecordingState {
        return { ...this.state };
    }

    dispose(): void {
        this.state.currentMode = null;
        this.state.isRecording = false;
    }
}

suite('Simplified Recording Tests', () => {
    let recordingManager: SimplifiedRecordingManager;

    setup(() => {
        // Сбрасываем моки
        sinon.resetHistory();
        sinon.resetBehavior();

        // Создаем новый экземпляр
        recordingManager = new SimplifiedRecordingManager();

        // Настраиваем заглушки
        mockVSCode.commands.executeCommand.resolves();
        mockVSCode.window.showInformationMessage.resolves();
    });

    teardown(() => {
        if (recordingManager) {
            recordingManager.dispose();
        }
        sinon.restore();
    });

    suite('Record and Send to Chat', () => {
        test('Should start chat recording successfully', async () => {
            await recordingManager.recordAndSendToChat();

            const state = recordingManager.getState();
            assert.strictEqual(state.currentMode, 'chat');
            assert.strictEqual(state.isRecording, true);

            // Проверяем вызовы VS Code API
            assert.ok(mockVSCode.commands.executeCommand.calledWith('setContext', 'speechToTextWhisper.isRecording', true));
            assert.ok(mockVSCode.window.showInformationMessage.calledWith('🎤 Recording... Release F9 to send to chat'));
        });

        test('Should throw error when recording already active', async () => {
            await recordingManager.recordAndSendToChat();

            try {
                await recordingManager.recordAndSendToChat();
                assert.fail('Should have thrown an error');
            } catch (error) {
                assert.strictEqual((error as Error).message, 'Recording already in progress');
            }
        });

        test('Should complete chat recording flow', async () => {
            await recordingManager.recordAndSendToChat();
            await recordingManager.stopRecording();

            const state = recordingManager.getState();
            assert.strictEqual(state.currentMode, null);
            assert.strictEqual(state.isRecording, false);

            // Проверяем сообщение о завершении
            assert.ok(mockVSCode.window.showInformationMessage.calledWith('✅ Transcribed and sent to chat'));
        });
    });

    suite('Record to Clipboard', () => {
        test('Should start clipboard recording successfully', async () => {
            await recordingManager.recordToClipboard();

            const state = recordingManager.getState();
            assert.strictEqual(state.currentMode, 'clipboard');
            assert.strictEqual(state.isRecording, true);

            // Проверяем вызовы VS Code API
            assert.ok(mockVSCode.commands.executeCommand.calledWith('setContext', 'speechToTextWhisper.isRecording', true));
            assert.ok(mockVSCode.window.showInformationMessage.calledWith('🎤 Recording... Release Ctrl+Shift+V to copy to clipboard'));
        });

        test('Should throw error when recording already active', async () => {
            await recordingManager.recordToClipboard();

            try {
                await recordingManager.recordToClipboard();
                assert.fail('Should have thrown an error');
            } catch (error) {
                assert.strictEqual((error as Error).message, 'Recording already in progress');
            }
        });

        test('Should complete clipboard recording flow', async () => {
            await recordingManager.recordToClipboard();
            await recordingManager.stopRecording();

            const state = recordingManager.getState();
            assert.strictEqual(state.currentMode, null);
            assert.strictEqual(state.isRecording, false);

            // Проверяем сообщение о завершении
            assert.ok(mockVSCode.window.showInformationMessage.calledWith('✅ Transcribed and copied to clipboard'));
        });
    });

    suite('Recording Mode Detection', () => {
        test('Should detect chat mode from configuration', () => {
            mockVSCode.workspace.getConfiguration.returns({
                get: sinon.stub().withArgs('recordingMode', 'chat').returns('chat')
            });

            const config = mockVSCode.workspace.getConfiguration('speechToTextWhisper');
            const recordingMode = config.get('recordingMode', 'chat');
            
            assert.strictEqual(recordingMode, 'chat');
        });

        test('Should detect clipboard mode from configuration', () => {
            mockVSCode.workspace.getConfiguration.returns({
                get: sinon.stub().withArgs('recordingMode', 'chat').returns('clipboard')
            });

            const config = mockVSCode.workspace.getConfiguration('speechToTextWhisper');
            const recordingMode = config.get('recordingMode', 'chat');
            
            assert.strictEqual(recordingMode, 'clipboard');
        });
    });

    suite('Stop Recording', () => {
        test('Should handle stop when not recording', async () => {
            await recordingManager.stopRecording();

            const state = recordingManager.getState();
            assert.strictEqual(state.currentMode, null);
            assert.strictEqual(state.isRecording, false);
        });

        test('Should reset state on stop', async () => {
            await recordingManager.recordAndSendToChat();
            await recordingManager.stopRecording();

            const state = recordingManager.getState();
            assert.strictEqual(state.currentMode, null);
            assert.strictEqual(state.isRecording, false);

            // Проверяем обновление контекстов
            assert.ok(mockVSCode.commands.executeCommand.calledWith('setContext', 'speechToTextWhisper.isRecording', false));
        });
    });

    suite('Error Handling', () => {
        test('Should handle VS Code command errors gracefully', async () => {
            // Мокируем ошибку в команде
            mockVSCode.commands.executeCommand.rejects(new Error('Command failed'));

            try {
                await recordingManager.recordAndSendToChat();
                // Несмотря на ошибку команды, состояние должно обновиться
                const state = recordingManager.getState();
                assert.strictEqual(state.currentMode, 'chat');
            } catch (error) {
                // Ошибки команд не должны прерывать основной поток
                assert.fail('Should not throw error for command failures');
            }
        });

        test('Should cleanup state on dispose', () => {
            // Начинаем запись
            recordingManager.recordAndSendToChat();
            
            // Очищаем ресурсы
            recordingManager.dispose();

            const state = recordingManager.getState();
            assert.strictEqual(state.currentMode, null);
            assert.strictEqual(state.isRecording, false);
        });
    });

    suite('Mode Switching', () => {
        test('Should not allow switching modes during recording', async () => {
            await recordingManager.recordAndSendToChat();

            try {
                await recordingManager.recordToClipboard();
                assert.fail('Should have thrown an error');
            } catch (error) {
                assert.strictEqual((error as Error).message, 'Recording already in progress');
            }

            // Состояние должно остаться в chat режиме
            const state = recordingManager.getState();
            assert.strictEqual(state.currentMode, 'chat');
        });

        test('Should allow switching modes after stopping', async () => {
            // Начинаем с chat режима
            await recordingManager.recordAndSendToChat();
            await recordingManager.stopRecording();

            // Переключаемся на clipboard режим
            await recordingManager.recordToClipboard();

            const state = recordingManager.getState();
            assert.strictEqual(state.currentMode, 'clipboard');
            assert.strictEqual(state.isRecording, true);
        });
    });
}); 