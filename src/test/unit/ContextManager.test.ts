import * as assert from 'assert';

// Создаем простой класс для управления состоянием записи для тестов
class RecordingStateManager {
    private isRecording: boolean = false;
    private mode: string | null = null;
    private startTime: number | null = null;
    private configuration: any = {};

    startRecording(recordingMode: string): void {
        this.isRecording = true;
        this.mode = recordingMode;
        this.startTime = Date.now();
    }

    stopRecording(): void {
        this.isRecording = false;
        this.mode = null;
        this.startTime = null;
    }

    getRecordingState() {
        return {
            isRecording: this.isRecording,
            mode: this.mode,
            startTime: this.startTime
        };
    }

    setConfiguration(config: any): void {
        this.configuration = { ...config };
    }

    updateConfiguration(update: any): void {
        this.configuration = { ...this.configuration, ...update };
    }

    getConfiguration(): any {
        return { ...this.configuration };
    }
}

describe('RecordingStateManager Recording State Tests', () => {
    let stateManager: RecordingStateManager;

    beforeEach(() => {
        stateManager = new RecordingStateManager();
    });

    it('should initialize with default state', () => {
        const state = stateManager.getRecordingState();
        
        assert.strictEqual(state.isRecording, false, 'Should not be recording initially');
        assert.strictEqual(state.mode, null, 'Mode should be null initially');
        assert.strictEqual(state.startTime, null, 'Start time should be null initially');
    });

    it('should start recording with correct mode', () => {
        stateManager.startRecording('insertOrClipboard');
        const state = stateManager.getRecordingState();
        
        assert.strictEqual(state.isRecording, true, 'Should be recording');
        assert.strictEqual(state.mode, 'insertOrClipboard', 'Mode should be set correctly');
        assert.ok(state.startTime, 'Start time should be set');
        assert.ok(typeof state.startTime === 'number', 'Start time should be a number');
    });

    it('should stop recording and reset state', () => {
        stateManager.startRecording('newChat');
        stateManager.stopRecording();
        const state = stateManager.getRecordingState();
        
        assert.strictEqual(state.isRecording, false, 'Should not be recording after stop');
        assert.strictEqual(state.mode, null, 'Mode should be reset to null');
        assert.strictEqual(state.startTime, null, 'Start time should be reset to null');
    });

    it('should handle multiple mode changes correctly', () => {
        // Первая запись
        stateManager.startRecording('insertOrClipboard');
        let state = stateManager.getRecordingState();
        assert.strictEqual(state.mode, 'insertOrClipboard', 'First mode should be set');
        
        // Остановка
        stateManager.stopRecording();
        state = stateManager.getRecordingState();
        assert.strictEqual(state.mode, null, 'Mode should be reset');
        
        // Вторая запись с другим режимом
        stateManager.startRecording('newChat');
        state = stateManager.getRecordingState();
        assert.strictEqual(state.mode, 'newChat', 'Second mode should be set');
    });

    it('should preserve mode during recording', () => {
        stateManager.startRecording('currentChat');
        
        // Проверяем несколько раз подряд
        for (let i = 0; i < 5; i++) {
            const state = stateManager.getRecordingState();
            assert.strictEqual(state.mode, 'currentChat', `Mode should remain 'currentChat' on check ${i + 1}`);
            assert.strictEqual(state.isRecording, true, `Should still be recording on check ${i + 1}`);
        }
    });

    it('should handle rapid start/stop cycles', () => {
        const modes = ['insertOrClipboard', 'newChat', 'currentChat'];
        
        for (const mode of modes) {
            stateManager.startRecording(mode);
            let state = stateManager.getRecordingState();
            assert.strictEqual(state.mode, mode, `Mode should be ${mode}`);
            assert.strictEqual(state.isRecording, true, 'Should be recording');
            
            stateManager.stopRecording();
            state = stateManager.getRecordingState();
            assert.strictEqual(state.mode, null, 'Mode should be reset');
            assert.strictEqual(state.isRecording, false, 'Should not be recording');
        }
    });

    it('should track recording duration', async () => {
        stateManager.startRecording('insertOrClipboard');
        const startState = stateManager.getRecordingState();
        
        // Ждем немного
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const endState = stateManager.getRecordingState();
        
        assert.strictEqual(startState.startTime, endState.startTime, 'Start time should not change during recording');
        assert.ok(endState.startTime! < Date.now(), 'Start time should be in the past');
    });
});

describe('RecordingStateManager Configuration Tests', () => {
    let stateManager: RecordingStateManager;

    beforeEach(() => {
        stateManager = new RecordingStateManager();
    });

    it('should store and retrieve configuration', () => {
        const config = {
            language: 'ru',
            model: 'whisper-1',
            temperature: 0.5
        };
        
        stateManager.setConfiguration(config);
        const retrieved = stateManager.getConfiguration();
        
        assert.deepStrictEqual(retrieved, config, 'Configuration should be stored and retrieved correctly');
    });

    it('should merge configuration updates', () => {
        const initialConfig = {
            language: 'en',
            model: 'whisper-1',
            temperature: 0.0
        };
        
        stateManager.setConfiguration(initialConfig);
        
        const update = {
            language: 'ru',
            temperature: 0.5
        };
        
        stateManager.updateConfiguration(update);
        const result = stateManager.getConfiguration();
        
        assert.strictEqual(result.language, 'ru', 'Language should be updated');
        assert.strictEqual(result.model, 'whisper-1', 'Model should remain unchanged');
        assert.strictEqual(result.temperature, 0.5, 'Temperature should be updated');
    });

    it('should handle empty configuration', () => {
        const config = stateManager.getConfiguration();
        assert.ok(typeof config === 'object', 'Should return an object');
    });
});

describe('RecordingStateManager Integration Tests', () => {
    let stateManager: RecordingStateManager;

    beforeEach(() => {
        stateManager = new RecordingStateManager();
    });

    it('should maintain state consistency during complex operations', () => {
        // Симулируем сложный сценарий использования
        
        // 1. Настройка конфигурации
        stateManager.setConfiguration({
            language: 'ru',
            model: 'whisper-1'
        });
        
        // 2. Начало записи
        stateManager.startRecording('insertOrClipboard');
        let state = stateManager.getRecordingState();
        assert.strictEqual(state.isRecording, true, 'Should be recording');
        assert.strictEqual(state.mode, 'insertOrClipboard', 'Mode should be set');
        
        // 3. Обновление конфигурации во время записи
        stateManager.updateConfiguration({ temperature: 0.7 });
        const config = stateManager.getConfiguration();
        assert.strictEqual(config.temperature, 0.7, 'Configuration should be updated');
        
        // 4. Состояние записи должно остаться неизменным
        state = stateManager.getRecordingState();
        assert.strictEqual(state.isRecording, true, 'Should still be recording');
        assert.strictEqual(state.mode, 'insertOrClipboard', 'Mode should remain unchanged');
        
        // 5. Остановка записи
        stateManager.stopRecording();
        state = stateManager.getRecordingState();
        assert.strictEqual(state.isRecording, false, 'Should not be recording');
        assert.strictEqual(state.mode, null, 'Mode should be reset');
        
        // 6. Конфигурация должна сохраниться
        const finalConfig = stateManager.getConfiguration();
        assert.strictEqual(finalConfig.language, 'ru', 'Language should be preserved');
        assert.strictEqual(finalConfig.temperature, 0.7, 'Temperature should be preserved');
    });
}); 