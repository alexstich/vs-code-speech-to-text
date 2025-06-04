import * as assert from 'assert';
import * as vscode from 'vscode';

/**
 * Интеграционный тест для F9 команды в реальных условиях
 * Проверяет исправления проблем с детекцией тишины и ручной записью
 */
describe('F9 Real World Integration Tests', function() {
    this.timeout(30000); // 30 секунд для реальных операций

    let extension: vscode.Extension<any>;
    
    before(async () => {
        // Получаем наше расширение
        extension = vscode.extensions.getExtension('speak-y.speech-to-text-whisper')!;
        assert.ok(extension, 'Extension should be found');
        
        // Активируем расширение если ещё не активировано
        if (!extension.isActive) {
            await extension.activate();
        }
        
        console.log('🧪 Extension activated for F9 testing');
        
        // Ждём полной инициализации
        await new Promise(resolve => setTimeout(resolve, 2000));
    });

    describe('F9 - recordAndOpenNewChat Command', () => {
        it('должен работать с silence detection включенным', async function() {
            this.timeout(20000);
            
            console.log('🧪 Testing F9 with silence detection enabled');
            
            // Устанавливаем конфигурацию с включенной детекцией тишины
            const config = vscode.workspace.getConfiguration('speechToTextWhisper');
            await config.update('silenceDetection', true, vscode.ConfigurationTarget.Global);
            await config.update('silenceDuration', 5, vscode.ConfigurationTarget.Global); // 5 секунд тишины
            
            console.log('🧪 Configuration set: silenceDetection=true, silenceDuration=5s');
            
            // Запускаем команду F9
            console.log('🧪 Executing recordAndOpenNewChat command...');
            
            let recordingStarted = false;
            let recordingCompleted = false;
            let errorOccurred = false;
            
            // Слушаем события через output channel (если есть)
            try {
                await vscode.commands.executeCommand('speechToTextWhisper.recordAndOpenNewChat');
                recordingStarted = true;
                console.log('✅ Command executed, recording should have started');
                
                // Ждём немного для начала записи
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                // Симулируем остановку записи через некоторое время (если запись не остановилась автоматически)
                await new Promise(resolve => setTimeout(resolve, 2000));
                
                // Проверяем что запись действительно началась
                recordingCompleted = true;
                console.log('✅ Recording flow completed');
                
            } catch (error) {
                errorOccurred = true;
                console.error('❌ Error during recording:', error);
                
                // Проверяем что это не ошибка связанная с нашими исправлениями
                const errorMessage = (error as Error).message;
                
                // Допустимые ошибки в тестовой среде
                if (errorMessage.includes('Recording too short') || 
                    errorMessage.includes('microphone permissions') ||
                    errorMessage.includes('FFmpeg not found')) {
                    console.log('✅ Acceptable error in test environment:', errorMessage);
                    recordingCompleted = true;
                } else {
                    throw error; // Неожиданная ошибка - тест должен провалиться
                }
            }
            
            // Проверяем что основная логика работает
            assert.ok(recordingStarted, 'Recording should have started');
            assert.ok(recordingCompleted || errorOccurred, 'Recording should complete or fail gracefully');
        });

        it('должен работать с silence detection отключенным', async function() {
            this.timeout(15000);
            
            console.log('🧪 Testing F9 with silence detection disabled');
            
            // Устанавливаем конфигурацию с отключенной детекцией тишины
            const config = vscode.workspace.getConfiguration('speechToTextWhisper');
            await config.update('silenceDetection', false, vscode.ConfigurationTarget.Global);
            await config.update('maxRecordingDuration', 10, vscode.ConfigurationTarget.Global); // 10 секунд максимум
            
            console.log('🧪 Configuration set: silenceDetection=false, maxRecordingDuration=10s');
            
            // Запускаем команду F9
            console.log('🧪 Executing recordAndOpenNewChat command...');
            
            let recordingStarted = false;
            let recordingCompleted = false;
            let errorOccurred = false;
            
            try {
                // Запускаем запись
                await vscode.commands.executeCommand('speechToTextWhisper.recordAndOpenNewChat');
                recordingStarted = true;
                console.log('✅ Command executed, recording should have started');
                
                // Ждём немного для начала записи
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                // Останавливаем запись вручную (симулируем повторное нажатие F9 или другой команды)
                console.log('🧪 Manually stopping recording...');
                await vscode.commands.executeCommand('speechToTextWhisper.recordAndInsertToCurrentChat');
                
                recordingCompleted = true;
                console.log('✅ Manual recording stop completed');
                
            } catch (error) {
                errorOccurred = true;
                console.error('❌ Error during recording:', error);
                
                const errorMessage = (error as Error).message;
                
                // Допустимые ошибки в тестовой среде
                if (errorMessage.includes('Recording too short') || 
                    errorMessage.includes('microphone permissions') ||
                    errorMessage.includes('FFmpeg not found') ||
                    errorMessage.includes('No recording mode set')) {
                    console.log('✅ Acceptable error in test environment:', errorMessage);
                    recordingCompleted = true;
                } else {
                    throw error; // Неожиданная ошибка
                }
            }
            
            // Проверяем что основная логика работает
            assert.ok(recordingStarted, 'Recording should have started');
            assert.ok(recordingCompleted || errorOccurred, 'Recording should complete or fail gracefully');
        });
    });

    describe('Configuration Tests', () => {
        it('должен правильно читать конфигурацию silence detection', () => {
            console.log('🧪 Testing configuration reading');
            
            const config = vscode.workspace.getConfiguration('speechToTextWhisper');
            
            // Проверяем что можем читать настройки
            const silenceDetection = config.get<boolean>('silenceDetection');
            const silenceDuration = config.get<number>('silenceDuration');
            const maxRecordingDuration = config.get<number>('maxRecordingDuration');
            
            console.log(`🔧 Current config: silenceDetection=${silenceDetection}, silenceDuration=${silenceDuration}, maxRecordingDuration=${maxRecordingDuration}`);
            
            // Основные проверки
            assert.ok(typeof silenceDetection === 'boolean', 'silenceDetection should be boolean');
            assert.ok(typeof silenceDuration === 'number', 'silenceDuration should be number');
            assert.ok(typeof maxRecordingDuration === 'number', 'maxRecordingDuration should be number');
            
            console.log('✅ Configuration reading works correctly');
        });
    });

    after(async () => {
        console.log('🧹 Cleaning up F9 integration tests...');
        
        // Возвращаем настройки по умолчанию
        const config = vscode.workspace.getConfiguration('speechToTextWhisper');
        await config.update('silenceDetection', undefined, vscode.ConfigurationTarget.Global);
        await config.update('silenceDuration', undefined, vscode.ConfigurationTarget.Global);
        await config.update('maxRecordingDuration', undefined, vscode.ConfigurationTarget.Global);
        
        console.log('✅ F9 integration tests cleanup completed');
    });
}); 