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
exports.activate = activate;
exports.deactivate = deactivate;
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = __importStar(require("vscode"));
const AudioRecorder_1 = require("./core/AudioRecorder");
const WhisperClient_1 = require("./core/WhisperClient");
const TextInserter_1 = require("./ui/TextInserter");
const StatusBarManager_1 = require("./ui/StatusBarManager");
const ErrorHandler_1 = require("./utils/ErrorHandler");
const RetryManager_1 = require("./utils/RetryManager");
const RecoveryActionHandler_1 = require("./utils/RecoveryActionHandler");
// Глобальные переменные для компонентов
let audioRecorder;
let whisperClient;
let textInserter;
let statusBarManager;
// Система обработки ошибок
let errorHandler;
let retryManager;
let recoveryHandler;
// Состояние hold-to-record
let isHoldToRecordActive = false;
let holdToRecordDisposable = null;
// Контекст расширения для глобального доступа
let extensionContext;
// Переменная для хранения последней транскрибации
let lastTranscribedText = null;
/**
 * Функция активации расширения
 * Вызывается при первом использовании команды расширения
 */
function activate(context) {
    console.log('🎤 VoiceScribe extension is now active!');
    // Сохраняем контекст для глобального использования
    extensionContext = context;
    try {
        // Инициализируем систему обработки ошибок
        initializeErrorHandling();
        // Инициализируем компоненты
        initializeComponents();
        // Регистрируем все команды
        registerCommands(context);
        // Настраиваем горячие клавиши
        setupKeyBindings(context);
        // Инициализируем WhisperClient при первом использовании
        initializeWhisperClient();
        // Показываем приветственное сообщение
        showWelcomeMessage();
        console.log('✅ VoiceScribe extension successfully activated');
    }
    catch (error) {
        const errorMessage = `Failed to activate VoiceScribe: ${error.message}`;
        console.error(errorMessage);
        vscode.window.showErrorMessage(errorMessage);
    }
}
/**
 * Инициализация системы обработки ошибок
 */
function initializeErrorHandling() {
    console.log('🔧 Initializing error handling system...');
    // Создаем ErrorHandler с VS Code display handler
    errorHandler = new ErrorHandler_1.ErrorHandler(new ErrorHandler_1.VSCodeErrorDisplayHandler());
    // Создаем RetryManager
    retryManager = new RetryManager_1.RetryManager(errorHandler);
    // Создаем RecoveryActionHandler с зависимостями
    const recoveryDependencies = {
        checkMicrophone: async () => {
            const compatibility = AudioRecorder_1.AudioRecorder.checkBrowserCompatibility();
            const permission = await AudioRecorder_1.AudioRecorder.checkMicrophonePermission();
            return compatibility && permission.state === 'granted';
        },
        testApiKey: async () => {
            if (!whisperClient) {
                return false;
            }
            try {
                // Создаем минимальный тестовый blob
                const testBlob = new Blob(['test'], { type: 'audio/wav' });
                await whisperClient.transcribe(testBlob);
                return true;
            }
            catch (error) {
                // Проверяем тип ошибки - если это ошибка API ключа, то false
                const errorMessage = error.message.toLowerCase();
                return !errorMessage.includes('api key') && !errorMessage.includes('unauthorized');
            }
        },
        openSettings: () => {
            vscode.commands.executeCommand('workbench.action.openSettings', 'voiceScribe');
        },
        reloadExtension: () => {
            vscode.commands.executeCommand('workbench.action.reloadWindow');
        },
        retryLastOperation: async () => {
            // Это будет реализовано в конкретных операциях
            throw new Error('No operation to retry');
        }
    };
    recoveryHandler = new RecoveryActionHandler_1.RecoveryActionHandler(recoveryDependencies);
    console.log('✅ Error handling system initialized');
}
/**
 * Инициализация всех компонентов расширения
 */
function initializeComponents() {
    console.log('🔧 Initializing VoiceScribe components...');
    // Инициализируем TextInserter
    textInserter = new TextInserter_1.TextInserter();
    // События для AudioRecorder
    const audioRecorderEvents = {
        onRecordingStart: () => {
            console.log('🎤 Recording started');
            statusBarManager.updateRecordingState(true);
            // Показываем уведомление только если не в hold-to-record режиме
            if (!isHoldToRecordActive) {
                vscode.window.showInformationMessage('🎤 Recording started...');
            }
        },
        onRecordingStop: async (audioBlob) => {
            console.log('⏹️ Recording stopped');
            statusBarManager.updateRecordingState(false);
            await handleTranscription(audioBlob);
        },
        onError: async (error) => {
            console.error('❌ Recording error:', error);
            // Используем новую систему обработки ошибок
            const context = {
                operation: 'audio_recording',
                isHoldToRecordMode: isHoldToRecordActive,
                timestamp: new Date()
            };
            const userAction = await errorHandler.handleErrorFromException(error, context);
            // Обрабатываем действие пользователя если есть
            if (userAction) {
                await handleUserRecoveryAction(userAction, context);
            }
        }
    };
    // События для StatusBar
    const statusBarEvents = {
        onRecordingToggle: () => {
            toggleRecording();
        },
        onSettings: () => {
            openSettings();
        },
        onHelp: () => {
            showHelp();
        }
    };
    // Создаем AudioRecorder
    audioRecorder = new AudioRecorder_1.AudioRecorder(audioRecorderEvents);
    // Создаем StatusBarManager с конфигурацией
    const config = vscode.workspace.getConfiguration('voiceScribe');
    const statusBarConfig = {
        position: config.get('statusBarPosition', 'right'),
        showTooltips: config.get('showTooltips', true),
        enableAnimations: config.get('enableAnimations', true),
        autoHideOnSuccess: config.get('autoHideSuccess', true),
        successDisplayDuration: config.get('successDuration', 2000),
        errorDisplayDuration: config.get('errorDuration', 3000)
    };
    statusBarManager = new StatusBarManager_1.StatusBarManager(statusBarEvents, statusBarConfig);
    // Интегрируем StatusBarManager с ErrorHandler
    errorHandler.setStatusBarManager(statusBarManager);
    console.log('✅ Components initialized successfully');
}
/**
 * Регистрация всех команд расширения
 */
function registerCommands(context) {
    console.log('📝 Registering commands...');
    const commands = [
        // Основные команды записи
        vscode.commands.registerCommand('voiceScribe.startRecording', startRecording),
        vscode.commands.registerCommand('voiceScribe.stopRecording', stopRecording),
        vscode.commands.registerCommand('voiceScribe.toggleRecording', toggleRecording),
        // Hold-to-record команды
        vscode.commands.registerCommand('voiceScribe.startHoldToRecord', startHoldToRecord),
        vscode.commands.registerCommand('voiceScribe.stopHoldToRecord', stopHoldToRecord),
        // Команды режимов вставки
        vscode.commands.registerCommand('voiceScribe.insertAtCursor', () => insertLastTranscription('cursor')),
        vscode.commands.registerCommand('voiceScribe.insertAsComment', () => insertLastTranscription('comment')),
        vscode.commands.registerCommand('voiceScribe.replaceSelection', () => insertLastTranscription('replace')),
        vscode.commands.registerCommand('voiceScribe.copyToClipboard', () => insertLastTranscription('clipboard')),
        // Утилитные команды
        vscode.commands.registerCommand('voiceScribe.openSettings', openSettings),
        vscode.commands.registerCommand('voiceScribe.showHelp', showHelp),
        vscode.commands.registerCommand('voiceScribe.showStatus', showStatus),
        vscode.commands.registerCommand('voiceScribe.checkMicrophone', checkMicrophone),
        vscode.commands.registerCommand('voiceScribe.testApiKey', testApiKey),
        // Команды управления
        vscode.commands.registerCommand('voiceScribe.resetConfiguration', resetConfiguration),
        vscode.commands.registerCommand('voiceScribe.toggleStatusBar', toggleStatusBar)
    ];
    // Добавляем все команды в подписки
    context.subscriptions.push(...commands, statusBarManager);
    console.log(`✅ Registered ${commands.length} commands`);
}
/**
 * Настройка горячих клавиш и key bindings
 */
function setupKeyBindings(context) {
    console.log('⌨️ Setting up key bindings...');
    // F9 hold-to-record: нажал = начал запись, отпустил = остановил
    const keyDownCommand = vscode.commands.registerCommand('voiceScribe.keyDown', () => {
        if (!isHoldToRecordActive) {
            startHoldToRecord();
        }
    });
    const keyUpCommand = vscode.commands.registerCommand('voiceScribe.keyUp', () => {
        if (isHoldToRecordActive) {
            stopHoldToRecord();
        }
    });
    context.subscriptions.push(keyDownCommand, keyUpCommand);
    console.log('✅ Key bindings configured');
}
/**
 * Команды записи
 */
async function startRecording() {
    const context = {
        operation: 'start_recording',
        isHoldToRecordMode: isHoldToRecordActive,
        timestamp: new Date()
    };
    try {
        console.log('▶️ Starting recording...');
        // Проверяем состояние микрофона с retry
        const microphoneResult = await retryManager.retryMicrophoneOperation(async () => {
            const hasPermission = await AudioRecorder_1.AudioRecorder.checkMicrophonePermission();
            if (hasPermission.state !== 'granted') {
                throw new Error('Microphone permission not granted');
            }
            return hasPermission;
        }, 'microphone_permission_check');
        if (!microphoneResult.success) {
            const error = microphoneResult.lastError || new Error('Microphone access failed');
            const userAction = await errorHandler.handleErrorFromException(error, context);
            if (userAction) {
                await handleUserRecoveryAction(userAction, context);
            }
            return;
        }
        await audioRecorder.startRecording();
    }
    catch (error) {
        console.error('❌ Failed to start recording:', error);
        const userAction = await errorHandler.handleErrorFromException(error, context);
        if (userAction) {
            await handleUserRecoveryAction(userAction, context);
        }
    }
}
function stopRecording() {
    const context = {
        operation: 'stop_recording',
        isHoldToRecordMode: isHoldToRecordActive,
        timestamp: new Date()
    };
    try {
        console.log('⏹️ Stopping recording...');
        audioRecorder.stopRecording();
    }
    catch (error) {
        console.error('❌ Failed to stop recording:', error);
        // Для stop recording используем синхронную обработку ошибок
        errorHandler.handleErrorFromException(error, context);
    }
}
function toggleRecording() {
    if (audioRecorder.getIsRecording()) {
        stopRecording();
    }
    else {
        startRecording();
    }
}
/**
 * Hold-to-record функции (F9)
 */
async function startHoldToRecord() {
    if (isHoldToRecordActive) {
        return; // Уже активен
    }
    console.log('🎯 Starting hold-to-record mode');
    isHoldToRecordActive = true;
    try {
        await startRecording();
    }
    catch (error) {
        isHoldToRecordActive = false;
        throw error;
    }
}
function stopHoldToRecord() {
    if (!isHoldToRecordActive) {
        return; // Не активен
    }
    console.log('🎯 Stopping hold-to-record mode');
    isHoldToRecordActive = false;
    if (audioRecorder.getIsRecording()) {
        stopRecording();
    }
}
/**
 * Обработка транскрибации
 */
async function handleTranscription(audioBlob) {
    const context = {
        operation: 'transcription',
        isHoldToRecordMode: isHoldToRecordActive,
        timestamp: new Date(),
        additionalData: { audioBlobSize: audioBlob.size }
    };
    try {
        console.log('🔄 Starting transcription process...');
        // Показываем состояние обработки
        statusBarManager.showProcessing();
        // Проверяем наличие WhisperClient
        if (!whisperClient) {
            initializeWhisperClient();
            if (!whisperClient) {
                await errorHandler.handleError(ErrorHandler_1.ErrorType.API_KEY_MISSING, context);
                return;
            }
        }
        // Переход к состоянию транскрибации
        statusBarManager.showTranscribing();
        // Получаем настройки
        const config = vscode.workspace.getConfiguration('voiceScribe');
        const language = config.get('language', 'auto');
        const insertMode = config.get('insertMode', 'cursor');
        const prompt = config.get('prompt', '');
        // Опции для транскрибации
        const transcriptionOptions = {
            language: language === 'auto' ? undefined : language,
            prompt: prompt || undefined,
            temperature: config.get('temperature', 0.1)
        };
        console.log('🎯 Sending audio to Whisper API...');
        // Используем retry для API запроса
        const transcriptionResult = await retryManager.retryApiRequest(() => whisperClient.transcribe(audioBlob, transcriptionOptions), 'whisper_transcription', {
            maxAttempts: config.get('maxRetries', 3),
            baseDelay: config.get('retryDelay', 1000)
        });
        if (!transcriptionResult.success) {
            // Если retry не помог, обрабатываем через ErrorHandler
            const error = transcriptionResult.lastError || new Error('Transcription failed after retries');
            const userAction = await errorHandler.handleErrorFromException(error, context);
            if (userAction) {
                await handleUserRecoveryAction(userAction, context);
            }
            return;
        }
        const transcribedText = transcriptionResult.result;
        if (transcribedText && transcribedText.trim()) {
            console.log('✅ Transcription successful:', transcribedText.substring(0, 100));
            // Сохраняем последнюю транскрибацию
            lastTranscribedText = transcribedText.trim();
            // Показываем состояние вставки
            statusBarManager.showInserting();
            // Вставляем текст с обработкой ошибок
            await insertTranscribedTextWithErrorHandling(lastTranscribedText, insertMode, context);
            // Показываем успех с сообщением
            const truncatedText = lastTranscribedText.substring(0, 50) + (lastTranscribedText.length > 50 ? '...' : '');
            statusBarManager.showSuccess(`Inserted: "${truncatedText}"`);
            // Показываем уведомление только если не в hold-to-record режиме
            if (!isHoldToRecordActive) {
                vscode.window.showInformationMessage(`✅ Transcribed: "${truncatedText}"`);
            }
        }
        else {
            // Обработка пустой транскрибации
            const userAction = await errorHandler.handleError(ErrorHandler_1.ErrorType.TRANSCRIPTION_EMPTY, context);
            if (userAction) {
                await handleUserRecoveryAction(userAction, context);
            }
        }
    }
    catch (error) {
        console.error('❌ Transcription process failed:', error);
        // Обработка через ErrorHandler
        const userAction = await errorHandler.handleErrorFromException(error, context);
        if (userAction) {
            await handleUserRecoveryAction(userAction, context);
        }
    }
}
/**
 * Вставка транскрибированного текста с обработкой ошибок
 */
async function insertTranscribedTextWithErrorHandling(text, mode, parentContext) {
    const context = {
        operation: 'text_insertion',
        isHoldToRecordMode: parentContext.isHoldToRecordMode,
        timestamp: new Date(),
        additionalData: {
            textLength: text.length,
            insertMode: mode,
            parentOperation: parentContext.operation
        }
    };
    try {
        console.log(`📝 Inserting text in ${mode} mode...`);
        const config = vscode.workspace.getConfiguration('voiceScribe');
        const formatText = config.get('formatText', true);
        const addNewLine = config.get('addNewLine', true);
        const indentToSelection = config.get('indentToSelection', false);
        // Используем retry для операции вставки текста
        const insertResult = await retryManager.retry(() => textInserter.insertText(text, {
            mode: mode,
            formatText,
            addNewLine,
            indentToSelection
        }), 'text_insertion', { maxAttempts: 2, strategy: 'fixed_delay', baseDelay: 500 });
        if (!insertResult.success) {
            const error = insertResult.lastError || new Error('Text insertion failed after retries');
            const userAction = await errorHandler.handleErrorFromException(error, context);
            if (userAction) {
                await handleUserRecoveryAction(userAction, context);
            }
            throw error;
        }
        console.log('✅ Text inserted successfully');
    }
    catch (error) {
        console.error('❌ Text insertion failed:', error);
        // Обработка через ErrorHandler если не было обработано выше
        if (!error.handled) {
            const userAction = await errorHandler.handleErrorFromException(error, context);
            if (userAction) {
                await handleUserRecoveryAction(userAction, context);
            }
        }
        throw error; // Перебрасываем ошибку для обработки выше
    }
}
/**
 * Команды режимов вставки
 */
async function insertLastTranscription(mode) {
    if (!lastTranscribedText) {
        vscode.window.showWarningMessage('No transcribed text available. Please record something first.');
        return;
    }
    try {
        await insertTranscribedTextWithErrorHandling(lastTranscribedText, mode, {
            operation: 'text_insertion',
            isHoldToRecordMode: isHoldToRecordActive,
            timestamp: new Date(),
            additionalData: {
                textLength: lastTranscribedText.length,
                insertMode: mode,
                parentOperation: 'transcription'
            }
        });
        vscode.window.showInformationMessage(`Text inserted in ${mode} mode`);
    }
    catch (error) {
        // Ошибка уже обработана в insertTranscribedTextWithErrorHandling
    }
}
/**
 * Инициализация WhisperClient
 */
function initializeWhisperClient() {
    console.log('🔧 Initializing Whisper client...');
    const config = vscode.workspace.getConfiguration('voiceScribe');
    const apiKey = config.get('apiKey');
    if (!apiKey) {
        console.warn('⚠️ OpenAI API key not configured');
        statusBarManager.showWarning('API key not configured');
        return;
    }
    if (!WhisperClient_1.WhisperClient.validateApiKey(apiKey)) {
        console.error('❌ Invalid OpenAI API key format');
        statusBarManager.showError('Invalid API key format', 'critical');
        return;
    }
    try {
        whisperClient = new WhisperClient_1.WhisperClient({
            apiKey,
            timeout: config.get('timeout', 30000),
            maxRetries: config.get('maxRetries', 3),
            retryDelay: config.get('retryDelay', 1000),
            baseURL: config.get('baseURL') || undefined
        });
        console.log('✅ Whisper client initialized successfully');
    }
    catch (error) {
        const errorMessage = `Failed to initialize Whisper client: ${error.message}`;
        console.error(errorMessage);
        statusBarManager.showError(errorMessage, 'critical');
    }
}
/**
 * Утилитные команды
 */
function openSettings() {
    vscode.commands.executeCommand('workbench.action.openSettings', 'voiceScribe');
}
function showHelp() {
    const helpText = `
🎤 **VoiceScribe Help**

**Recording:**
• F9 (hold): Hold to record, release to stop
• Toggle recording: Ctrl+Shift+V (or use command palette)

**Commands:**
• Voice Scribe: Start Recording
• Voice Scribe: Stop Recording  
• Voice Scribe: Toggle Recording
• Voice Scribe: Insert as Comment
• Voice Scribe: Replace Selection

**Settings:**
• OpenAI API Key (required)
• Language (auto-detect or specific)
• Insert Mode (cursor/comment/replace)
• Audio Quality settings

**Troubleshooting:**
• Check microphone permissions
• Verify API key is valid
• Test microphone access
`;
    vscode.window.showInformationMessage(helpText, { modal: true });
}
function showStatus() {
    const status = statusBarManager.getStatus();
    const context = textInserter.getActiveContext();
    const statusText = `
**VoiceScribe Status:**

🎤 Recording: ${status.isRecording ? 'Active' : 'Inactive'}
📊 State: ${status.state}
🔧 API Client: ${whisperClient ? 'Ready' : 'Not configured'}
📝 Context: ${context.type} (${context.language || 'unknown'})
💾 Last Error: ${status.lastError || 'None'}
📋 Last Transcription: ${lastTranscribedText ? 'Available' : 'None'}
`;
    vscode.window.showInformationMessage(statusText, { modal: true });
}
async function checkMicrophone() {
    try {
        statusBarManager.showProcessing();
        const compatibility = AudioRecorder_1.AudioRecorder.checkBrowserCompatibility();
        const permission = await AudioRecorder_1.AudioRecorder.checkMicrophonePermission();
        if (compatibility && permission) {
            statusBarManager.showSuccess('Microphone ready');
            vscode.window.showInformationMessage('✅ Microphone is working correctly');
        }
        else {
            throw new Error(`Microphone check failed: ${!compatibility ? 'Incompatible browser' : 'Permission denied'}`);
        }
    }
    catch (error) {
        const errorMessage = error.message;
        statusBarManager.showError(errorMessage, 'error');
        vscode.window.showErrorMessage(`❌ ${errorMessage}`);
    }
}
async function testApiKey() {
    if (!whisperClient) {
        vscode.window.showWarningMessage('Please configure your OpenAI API key first');
        return;
    }
    try {
        statusBarManager.showProcessing();
        // Создаем тестовый аудио blob (минимальный WAV файл)
        const testBlob = new Blob(['test'], { type: 'audio/wav' });
        try {
            await whisperClient.transcribe(testBlob);
            statusBarManager.showSuccess('API key validated');
            vscode.window.showInformationMessage('✅ OpenAI API key is working correctly');
        }
        catch (error) {
            // Ожидаемая ошибка с тестовыми данными, но API key валиден если мы получили ответ от API
            const errorMessage = error.message;
            if (errorMessage.includes('audio') || errorMessage.includes('format')) {
                statusBarManager.showSuccess('API key validated');
                vscode.window.showInformationMessage('✅ OpenAI API key is working correctly');
            }
            else {
                throw error;
            }
        }
    }
    catch (error) {
        const errorMessage = error.message;
        statusBarManager.showError(errorMessage, 'critical');
        vscode.window.showErrorMessage(`❌ API key test failed: ${errorMessage}`);
    }
}
function resetConfiguration() {
    vscode.window.showWarningMessage('This will reset all VoiceScribe settings to defaults. Continue?', 'Yes', 'No').then(selection => {
        if (selection === 'Yes') {
            const config = vscode.workspace.getConfiguration('voiceScribe');
            // Сбрасываем основные настройки (кроме API ключа)
            config.update('language', 'auto', vscode.ConfigurationTarget.Global);
            config.update('insertMode', 'cursor', vscode.ConfigurationTarget.Global);
            config.update('formatText', true, vscode.ConfigurationTarget.Global);
            vscode.window.showInformationMessage('✅ Configuration reset to defaults');
        }
    });
}
function toggleStatusBar() {
    const status = statusBarManager.getStatus();
    if (status.isVisible) {
        statusBarManager.hide();
        vscode.window.showInformationMessage('Status bar hidden');
    }
    else {
        statusBarManager.show();
        vscode.window.showInformationMessage('Status bar shown');
    }
}
/**
 * Приветственное сообщение
 */
function showWelcomeMessage() {
    const config = vscode.workspace.getConfiguration('voiceScribe');
    const hasApiKey = config.get('apiKey');
    if (!hasApiKey) {
        vscode.window.showInformationMessage('🎤 Welcome to VoiceScribe! Please configure your OpenAI API key to get started.', 'Open Settings').then(selection => {
            if (selection === 'Open Settings') {
                openSettings();
            }
        });
    }
}
/**
 * Функция деактивации расширения
 * Вызывается при отключении расширения
 */
function deactivate() {
    console.log('🔌 Deactivating VoiceScribe extension...');
    try {
        // Останавливаем запись если активна
        if (audioRecorder && audioRecorder.getIsRecording()) {
            console.log('⏹️ Stopping active recording...');
            audioRecorder.stopRecording();
        }
        // Очищаем hold-to-record состояние
        if (isHoldToRecordActive) {
            isHoldToRecordActive = false;
        }
        // Очищаем диспозаблы
        if (holdToRecordDisposable) {
            holdToRecordDisposable.dispose();
        }
        console.log('✅ VoiceScribe extension deactivated successfully');
    }
    catch (error) {
        console.error('❌ Error during deactivation:', error);
    }
}
/**
 * Обработка действий пользователя для восстановления
 */
async function handleUserRecoveryAction(userAction, context) {
    console.log(`🔧 Handling user recovery action: ${userAction}`);
    try {
        // Определяем действие восстановления на основе пользовательского выбора
        if (userAction === 'Open Settings') {
            await recoveryHandler.executeRecoveryAction('open_settings');
        }
        else if (userAction === 'Check Microphone') {
            await recoveryHandler.executeRecoveryAction('enable_microphone');
        }
        else if (userAction === 'Retry') {
            await recoveryHandler.executeRecoveryAction('retry');
        }
        else if (userAction === 'Check Network') {
            await recoveryHandler.executeRecoveryAction('check_network');
        }
        else if (userAction === 'Reload Extension') {
            await recoveryHandler.executeRecoveryAction('refresh_extension');
        }
    }
    catch (error) {
        console.error('❌ Recovery action failed:', error);
        vscode.window.showErrorMessage(`Recovery action failed: ${error.message}`);
    }
}
//# sourceMappingURL=extension.js.map