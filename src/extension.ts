// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { FFmpegAudioRecorder, AudioRecorderEvents } from './core/FFmpegAudioRecorder';
import { WhisperClient } from './core/WhisperClient';
import { TextInserter } from './ui/TextInserter';
import { StatusBarManager, StatusBarEvents, StatusBarConfiguration } from './ui/StatusBarManager';
import { AudioSettingsProvider, AudioDevice } from './ui/AudioSettingsProvider';
import { DiagnosticsProvider } from './ui/DiagnosticsProvider';
import { ErrorHandler, ErrorType, ErrorContext, VSCodeErrorDisplayHandler } from './utils/ErrorHandler';
import { RetryManager } from './utils/RetryManager';
import { RecoveryActionHandler, RecoveryDependencies } from './utils/RecoveryActionHandler';
import { ContextManager, IDEType, ContextType, IDEContext, ContextManagerEvents } from './core/ContextManager';

// Глобальные переменные для компонентов
let audioRecorder: FFmpegAudioRecorder | null = null;
let whisperClient: WhisperClient;
let textInserter: TextInserter;
let statusBarManager: StatusBarManager;

// Система обработки ошибок
let errorHandler: ErrorHandler;
let retryManager: RetryManager;
let recoveryHandler: RecoveryActionHandler;

// Менеджер контекста IDE
let contextManager: ContextManager;

// Состояние hold-to-record
let isHoldToRecordActive = false;
let holdToRecordDisposable: vscode.Disposable | null = null;

// Контекст расширения для глобального доступа
let extensionContext: vscode.ExtensionContext;

// Переменная для хранения последней транскрибации
let lastTranscribedText: string | null = null;

// UI провайдеры для боковых панелей
let audioSettingsProvider: AudioSettingsProvider;
let diagnosticsProvider: DiagnosticsProvider;

/**
 * Функция активации расширения
 * Вызывается при первом использовании команды расширения
 */
export function activate(context: vscode.ExtensionContext) {
	console.log('🎤 SpeechToTextWhisper extension is now active!');
	
	// Сохраняем контекст для глобального использования
	extensionContext = context;

	try {
		// Устанавливаем начальные context variables для управления горячими клавишами
		initializeContextVariables();
		
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
		
		console.log('✅ SpeechToTextWhisper extension successfully activated');
		
	} catch (error) {
		const errorMessage = `Failed to activate SpeechToTextWhisper: ${(error as Error).message}`;
		console.error(errorMessage);
		vscode.window.showErrorMessage(errorMessage);
	}
}

/**
 * Инициализация context variables для управления состоянием расширения
 */
function initializeContextVariables(): void {
	console.log('🔧 Initializing context variables...');
	
	// Устанавливаем начальные значения context variables
	vscode.commands.executeCommand('setContext', 'speechToTextWhisper.active', true);
	vscode.commands.executeCommand('setContext', 'speechToTextWhisper.isRecording', false);
	vscode.commands.executeCommand('setContext', 'speechToTextWhisper.holdToRecordActive', false);
	
	// Получаем режим записи из настроек
	const config = vscode.workspace.getConfiguration('speechToTextWhisper');
	const recordingMode = config.get<string>('recordingMode', 'hold');
	vscode.commands.executeCommand('setContext', 'speechToTextWhisper.recordingMode', recordingMode);
	
	console.log(`✅ Context variables initialized (recordingMode: ${recordingMode})`);
}

/**
 * Инициализация системы обработки ошибок
 */
function initializeErrorHandling(): void {
	console.log('🔧 Initializing error handling system...');
	
	// Создаем ErrorHandler с VS Code display handler
	errorHandler = new ErrorHandler(new VSCodeErrorDisplayHandler());
	
	// Создаем RetryManager
	retryManager = new RetryManager(errorHandler);
	
	// Создаем RecoveryActionHandler с зависимостями
	const recoveryDependencies: RecoveryDependencies = {
		checkMicrophone: async () => {
			try {
				const ffmpegCheck = await FFmpegAudioRecorder.checkFFmpegAvailability();
				if (!ffmpegCheck.available) return false;
				
				const devices = await FFmpegAudioRecorder.detectInputDevices();
				return devices.length > 0;
			} catch (error) {
				return false;
			}
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
			} catch (error) {
				// Проверяем тип ошибки - если это ошибка API ключа, то false
				const errorMessage = (error as Error).message.toLowerCase();
				return !errorMessage.includes('api key') && !errorMessage.includes('unauthorized');
			}
		},
		openSettings: () => {
			vscode.commands.executeCommand('workbench.action.openSettings', 'speechToTextWhisper');
		},
		reloadExtension: () => {
			vscode.commands.executeCommand('workbench.action.reloadWindow');
		},
		retryLastOperation: async () => {
			// Это будет реализовано в конкретных операциях
			throw new Error('No operation to retry');
		}
	};
	
	recoveryHandler = new RecoveryActionHandler(recoveryDependencies);
	
	console.log('✅ Error handling system initialized');
}

/**
 * Инициализация всех компонентов расширения
 */
function initializeComponents(): void {
	console.log('🔧 Initializing SpeechToTextWhisper components...');
	
	// Инициализируем ContextManager
	initializeContextManager();
	
	// Инициализируем TextInserter
	textInserter = new TextInserter();
	
	// События для AudioRecorder
	const audioRecorderEvents: AudioRecorderEvents = {
		onRecordingStart: () => {
			console.log('🎤 Recording started');
			
			// Обновляем context variables
			vscode.commands.executeCommand('setContext', 'speechToTextWhisper.isRecording', true);
			
			statusBarManager.updateRecordingState(true);
			
			// Показываем уведомление только если не в hold-to-record режиме
			if (!isHoldToRecordActive) {
				vscode.window.showInformationMessage('🎤 Recording started...');
			}
		},
		onRecordingStop: async (audioBlob: Blob) => {
			console.log('⏹️ Recording stopped');
			
			// Обновляем context variables
			vscode.commands.executeCommand('setContext', 'speechToTextWhisper.isRecording', false);
			
			statusBarManager.updateRecordingState(false);
			await handleTranscription(audioBlob);
		},
		onError: async (error: Error) => {
			console.error('❌ Recording error:', error);
			
			// Сбрасываем состояния при ошибке
			vscode.commands.executeCommand('setContext', 'speechToTextWhisper.isRecording', false);
			vscode.commands.executeCommand('setContext', 'speechToTextWhisper.holdToRecordActive', false);
			isHoldToRecordActive = false;
			
			// Используем новую систему обработки ошибок
			const context: ErrorContext = {
				operation: 'audio_recording',
				isHoldToRecordMode: isHoldToRecordActive,
				timestamp: new Date()
			};
			
			const userAction = await errorHandler.handleErrorFromException(error, context);
			
			if (userAction && userAction !== 'ignore') {
				await handleUserRecoveryAction(userAction, context);
			}
		}
	};

	// События для StatusBar
	const statusBarEvents: StatusBarEvents = {
		onRecordingToggle: () => {
			// Запускаем асинхронную операцию, но не ждем ее завершения в этом контексте
			toggleRecording().catch(error => {
				console.error('❌ Error in toggleRecording from StatusBar:', error);
				vscode.window.showErrorMessage(`Recording toggle failed: ${error.message}`);
			});
		},
		onSettings: () => {
			openSettings();
		},
		onHelp: () => {
			showHelp();
		}
	};

	// Создаем StatusBarManager с конфигурацией
	const statusBarConfig: StatusBarConfiguration = {
		position: 'right',
		showTooltips: true,
		enableAnimations: true,
		autoHideOnSuccess: true,
		successDisplayDuration: 2000,
		errorDisplayDuration: 3000
	};
	
	statusBarManager = new StatusBarManager(statusBarEvents, statusBarConfig);
	
	// Интегрируем StatusBarManager с ErrorHandler
	errorHandler.setStatusBarManager(statusBarManager);
	
	console.log('✅ Components initialized successfully');
}

/**
 * Регистрация всех команд расширения
 */
function registerCommands(context: vscode.ExtensionContext): void {
	console.log('📝 Registering commands...');
	
	// Инициализируем провайдеры для боковых панелей
	audioSettingsProvider = new AudioSettingsProvider();
	diagnosticsProvider = new DiagnosticsProvider();
	
	// Регистрируем провайдеры панелей
	vscode.window.createTreeView('speechToTextWhisper.audioSettings', {
		treeDataProvider: audioSettingsProvider
	});
	
	vscode.window.createTreeView('speechToTextWhisper.deviceManager', {
		treeDataProvider: audioSettingsProvider
	});
	
	vscode.window.createTreeView('speechToTextWhisper.diagnostics', {
		treeDataProvider: diagnosticsProvider
	});
	
	const commands = [
		// Основные команды записи
		vscode.commands.registerCommand('speechToTextWhisper.startRecording', startRecording),
		vscode.commands.registerCommand('speechToTextWhisper.stopRecording', stopRecording),
		vscode.commands.registerCommand('speechToTextWhisper.toggleRecording', toggleRecording),
		
		// Hold-to-record команды
		vscode.commands.registerCommand('speechToTextWhisper.startHoldToRecord', startHoldToRecord),
		vscode.commands.registerCommand('speechToTextWhisper.stopHoldToRecord', stopHoldToRecord),
		
		// Команды режимов вставки
		vscode.commands.registerCommand('speechToTextWhisper.insertAtCursor', () => insertLastTranscription('cursor')),
		vscode.commands.registerCommand('speechToTextWhisper.insertAsComment', () => insertLastTranscription('comment')),
		vscode.commands.registerCommand('speechToTextWhisper.replaceSelection', () => insertLastTranscription('replace')),
		vscode.commands.registerCommand('speechToTextWhisper.copyToClipboard', () => insertLastTranscription('clipboard')),
		
		// Команды интеграции
		vscode.commands.registerCommand('speechToTextWhisper.sendToChat', () => insertLastTranscription('chat')),
		vscode.commands.registerCommand('speechToTextWhisper.recordAndSendToChat', async () => {
			await toggleRecording();
			// После записи автоматически отправляем в чат
		}),
		
		// Команды для аудио панелей
		vscode.commands.registerCommand('speechToTextWhisper.audioSettings.refresh', () => audioSettingsProvider.refresh()),
		vscode.commands.registerCommand('speechToTextWhisper.audioSettings.detectDevices', () => audioSettingsProvider.detectDevices()),
		vscode.commands.registerCommand('speechToTextWhisper.audioSettings.selectDevice', (device: AudioDevice) => audioSettingsProvider.selectDevice(device)),
		vscode.commands.registerCommand('speechToTextWhisper.audioSettings.testDevice', (device: AudioDevice) => audioSettingsProvider.testDevice(device)),
		vscode.commands.registerCommand('speechToTextWhisper.audioSettings.openFFmpegSettings', () => audioSettingsProvider.openFFmpegSettings()),
		vscode.commands.registerCommand('speechToTextWhisper.deviceManager.refresh', () => audioSettingsProvider.refresh()),
		vscode.commands.registerCommand('speechToTextWhisper.diagnostics.runAll', () => diagnosticsProvider.runAllDiagnostics()),
		vscode.commands.registerCommand('speechToTextWhisper.diagnostics.refresh', () => diagnosticsProvider.refresh()),
		
		// Утилитные команды
		vscode.commands.registerCommand('speechToTextWhisper.openSettings', openSettings),
		vscode.commands.registerCommand('speechToTextWhisper.showHelp', showHelp),
		vscode.commands.registerCommand('speechToTextWhisper.showStatus', showStatus),
		vscode.commands.registerCommand('speechToTextWhisper.checkMicrophone', checkMicrophone),
		vscode.commands.registerCommand('speechToTextWhisper.testApiKey', testApiKey),
		vscode.commands.registerCommand('speechToTextWhisper.showContext', showContextInfo),
		vscode.commands.registerCommand('speechToTextWhisper.refreshContext', refreshContext),
		
		// Команды управления
		vscode.commands.registerCommand('speechToTextWhisper.resetConfiguration', resetConfiguration),
		vscode.commands.registerCommand('speechToTextWhisper.toggleStatusBar', toggleStatusBar),
		
		// Команда для тестирования
		vscode.commands.registerCommand('speechToTextWhisper.runDiagnostics', runDiagnostics)
		
		// TODO: Добавить команды качества аудио позже
		// vscode.commands.registerCommand('speechToTextWhisper.showQualitySettings', showQualitySettings),
		// vscode.commands.registerCommand('speechToTextWhisper.applyQualityPreset', applyQualityPreset),
		// vscode.commands.registerCommand('speechToTextWhisper.optimizeForContext', optimizeForContext),
		// vscode.commands.executeCommand('speechToTextWhisper.exportQualitySettings', exportQualitySettings),
		// vscode.commands.registerCommand('speechToTextWhisper.importQualitySettings', importQualitySettings)
	];

	// Добавляем все команды в подписки
	context.subscriptions.push(...commands, statusBarManager);
	
	console.log(`✅ Registered ${commands.length} commands`);
}

/**
 * Настройка горячих клавиш и key bindings
 */
function setupKeyBindings(context: vscode.ExtensionContext): void {
	console.log('⌨️ Setting up key bindings...');
	
	// Команды startHoldToRecord и stopHoldToRecord уже зарегистрированы в registerCommands
	// и используются напрямую через keybindings в package.json
	// Дополнительная регистрация keyDown/keyUp команд не нужна
	
	console.log('✅ Key bindings configured (using package.json keybindings)');
}

/**
 * Команды записи
 */
async function startRecording(): Promise<void> {
	const context: ErrorContext = {
		operation: 'start_recording',
		isHoldToRecordMode: isHoldToRecordActive,
		timestamp: new Date()
	};

	try {
		console.log('▶️ Starting recording...');
		
		// Обеспечиваем инициализацию FFmpeg Audio Recorder
		await ensureFFmpegAudioRecorder();
		
		// Проверяем состояние микрофона с retry
		const microphoneResult = await retryManager.retryMicrophoneOperation(
			async () => {
				const hasPermission = await FFmpegAudioRecorder.checkMicrophonePermission();
				if (hasPermission.state !== 'granted') {
					throw new Error('Microphone permission not granted');
				}
				return hasPermission;
			},
			'microphone_permission_check'
		);

		if (!microphoneResult.success) {
			const error = microphoneResult.lastError || new Error('Microphone access failed');
			const userAction = await errorHandler.handleErrorFromException(error, context);
			
			if (userAction && userAction !== 'ignore') {
				await handleUserRecoveryAction(userAction, context);
			}
			return;
		}
		
		if (!audioRecorder) {
			throw new Error('Failed to initialize audio recorder');
		}
		
		await audioRecorder.startRecording();
		
	} catch (error) {
		console.error('❌ Failed to start recording:', error);
		
		const userAction = await errorHandler.handleErrorFromException(error as Error, context);
		
		if (userAction && userAction !== 'ignore') {
			await handleUserRecoveryAction(userAction, context);
		}
	}
}

function stopRecording(): void {
	const context: ErrorContext = {
		operation: 'stop_recording',
		isHoldToRecordMode: isHoldToRecordActive,
		timestamp: new Date()
	};

	try {
		console.log('⏹️ Stopping recording...');
		
		if (!audioRecorder) {
			console.warn('Audio recorder not initialized');
			return;
		}
		
		audioRecorder.stopRecording();
		
	} catch (error) {
		console.error('❌ Failed to stop recording:', error);
		
		// Для stop recording используем синхронную обработку ошибок
		errorHandler.handleErrorFromException(error as Error, context);
	}
}

async function toggleRecording(): Promise<void> {
	try {
		// Обеспечиваем инициализацию FFmpeg Audio Recorder
		await ensureFFmpegAudioRecorder();
		
		if (!audioRecorder) {
			throw new Error('Failed to initialize audio recorder');
		}
		
		if (audioRecorder.getIsRecording()) {
			stopRecording();
		} else {
			await startRecording();
		}
	} catch (error) {
		console.error('❌ Failed to toggle recording:', error);
		vscode.window.showErrorMessage(`Recording toggle failed: ${(error as Error).message}`);
	}
}

/**
 * Hold-to-record функции (F9)
 */
async function startHoldToRecord(): Promise<void> {
	if (isHoldToRecordActive) {
		return; // Уже активен
	}
	
	console.log('🎯 Starting hold-to-record mode');
	isHoldToRecordActive = true;
	
	// Обновляем context variable
	vscode.commands.executeCommand('setContext', 'speechToTextWhisper.holdToRecordActive', true);
	
	try {
		await startRecording();
	} catch (error) {
		isHoldToRecordActive = false;
		vscode.commands.executeCommand('setContext', 'speechToTextWhisper.holdToRecordActive', false);
		throw error;
	}
}

function stopHoldToRecord(): void {
	if (!isHoldToRecordActive) {
		return; // Не активен
	}
	
	console.log('🎯 Stopping hold-to-record mode');
	isHoldToRecordActive = false;
	
	// Обновляем context variable
	vscode.commands.executeCommand('setContext', 'speechToTextWhisper.holdToRecordActive', false);
	
	if (audioRecorder && audioRecorder.getIsRecording()) {
		stopRecording();
	}
}

/**
 * Обработка транскрибации
 */
async function handleTranscription(audioBlob: Blob): Promise<void> {
	const context: ErrorContext = {
		operation: 'transcription',
		isHoldToRecordMode: isHoldToRecordActive,
		timestamp: new Date(),
		additionalData: { audioBlobSize: audioBlob.size }
	};

	try {
		console.log('🔄 Starting transcription process...');
		
		// Показываем уведомление о начале транскрибации
		if (!isHoldToRecordActive) {
			vscode.window.showInformationMessage('🔄 Transcribing audio...');
		}
		
		// Показываем состояние обработки
		statusBarManager.showProcessing();
		
		// Проверяем наличие WhisperClient
		if (!whisperClient) {
			initializeWhisperClient();
			if (!whisperClient) {
				await errorHandler.handleError(ErrorType.API_KEY_MISSING, context);
				return;
			}
		}

		// Переход к состоянию транскрибации
		statusBarManager.showTranscribing();

		// Получаем настройки
		const config = vscode.workspace.getConfiguration('speechToTextWhisper');
		const language = config.get<string>('language', 'auto');
		const insertMode = config.get<string>('insertMode', 'cursor');
		const prompt = config.get<string>('prompt', '');

		// Опции для транскрибации
		const transcriptionOptions = {
			language: language === 'auto' ? undefined : language,
			prompt: prompt || undefined,
			temperature: config.get<number>('temperature', 0.1)
		};

		console.log('🎯 Sending audio to Whisper API...');
		
		// Используем retry для API запроса
		const transcriptionResult = await retryManager.retryApiRequest(
			() => whisperClient.transcribe(audioBlob, transcriptionOptions),
			'whisper_transcription',
			{
				maxAttempts: config.get<number>('maxRetries', 3),
				baseDelay: config.get<number>('retryDelay', 1000)
			}
		);

		if (!transcriptionResult.success) {
			// Если retry не помог, обрабатываем через ErrorHandler
			const error = transcriptionResult.lastError || new Error('Transcription failed after retries');
			const userAction = await errorHandler.handleErrorFromException(error, context);
			
			if (userAction && userAction !== 'ignore') {
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
			
			// Показываем уведомление о завершении
			if (!isHoldToRecordActive) {
				vscode.window.showInformationMessage(`✅ Transcribed and inserted: "${truncatedText}"`);
			}
			
		} else {
			// Обработка пустой транскрибации
			const userAction = await errorHandler.handleError(ErrorType.TRANSCRIPTION_EMPTY, context);
			
			if (userAction && userAction !== 'ignore') {
				await handleUserRecoveryAction(userAction, context);
			}
		}
		
	} catch (error) {
		console.error('❌ Transcription failed:', error);
		
		const userAction = await errorHandler.handleErrorFromException(error as Error, context);
		
		if (userAction && userAction !== 'ignore') {
			await handleUserRecoveryAction(userAction, context);
		}
	}
}

/**
 * Вставка транскрибированного текста с обработкой ошибок
 */
async function insertTranscribedTextWithErrorHandling(text: string, mode: string, parentContext: ErrorContext): Promise<void> {
	const context: ErrorContext = {
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
		
		const config = vscode.workspace.getConfiguration('speechToTextWhisper');
		const formatText = config.get<boolean>('formatText', true);
		const addNewLine = config.get<boolean>('addNewLine', true);
		const indentToSelection = config.get<boolean>('indentToSelection', false);

		// Используем retry для операции вставки текста
		const insertResult = await retryManager.retry(
			() => textInserter.insertText(text, {
				mode: mode as 'cursor' | 'comment' | 'replace' | 'newLine' | 'clipboard',
				formatText,
				addNewLine,
				indentToSelection
			}),
			'text_insertion',
			{ maxAttempts: 2, strategy: 'fixed_delay' as any, baseDelay: 500 }
		);

		if (!insertResult.success) {
			const error = insertResult.lastError || new Error('Text insertion failed after retries');
			const userAction = await errorHandler.handleErrorFromException(error, context);
			
			if (userAction && userAction !== 'ignore') {
				await handleUserRecoveryAction(userAction, context);
			}
			throw error;
		}
		
		console.log('✅ Text inserted successfully');
		
	} catch (error) {
		console.error('❌ Text insertion failed:', error);
		
		// Обработка через ErrorHandler если не было обработано выше
		if (!(error as any).handled) {
			const userAction = await errorHandler.handleErrorFromException(error as Error, context);
			
			if (userAction && userAction !== 'ignore') {
				await handleUserRecoveryAction(userAction, context);
			}
		}
		
		throw error; // Перебрасываем ошибку для обработки выше
	}
}

/**
 * Команды режимов вставки
 */
async function insertLastTranscription(mode: string): Promise<void> {
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
	} catch (error) {
		// Ошибка уже обработана в insertTranscribedTextWithErrorHandling
	}
}

/**
 * Инициализация WhisperClient
 */
function initializeWhisperClient(): void {
	console.log('🔧 Initializing Whisper client...');
	
	const config = vscode.workspace.getConfiguration('speechToTextWhisper');
	const apiKey = config.get<string>('apiKey');

	if (!apiKey) {
		console.warn('⚠️ OpenAI API key not configured');
		statusBarManager.showWarning('API key not configured');
		return;
	}

	if (!WhisperClient.validateApiKey(apiKey)) {
		console.error('❌ Invalid OpenAI API key format');
		statusBarManager.showError('Invalid API key format', 'critical');
		return;
	}

	try {
		whisperClient = new WhisperClient({
			apiKey,
			timeout: config.get<number>('timeout', 30000),
			maxRetries: config.get<number>('maxRetries', 3),
			retryDelay: config.get<number>('retryDelay', 1000),
			baseURL: config.get<string>('baseURL') || undefined
		});
		
		console.log('✅ Whisper client initialized successfully');
		
	} catch (error) {
		const errorMessage = `Failed to initialize Whisper client: ${(error as Error).message}`;
		console.error(errorMessage);
		statusBarManager.showError(errorMessage, 'critical');
	}
}

/**
 * Утилитные команды
 */
function openSettings(): void {
	vscode.commands.executeCommand('workbench.action.openSettings', 'speechToTextWhisper');
}

function showHelp(): void {
	const helpText = `
🎤 **SpeechToTextWhisper Help**

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

function showStatus(): void {
	const status = statusBarManager.getStatus();
	const context = textInserter.getActiveContext();
	
	const statusText = `
**SpeechToTextWhisper Status:**

🎤 Recording: ${status.isRecording ? 'Active' : 'Inactive'}
📊 State: ${status.state}
🔧 API Client: ${whisperClient ? 'Ready' : 'Not configured'}
📝 Context: ${context.type} (${context.language || 'unknown'})
💾 Last Error: ${status.lastError || 'None'}
📋 Last Transcription: ${lastTranscribedText ? 'Available' : 'None'}
`;

	vscode.window.showInformationMessage(statusText, { modal: true });
}

function showContextInfo(): void {
	if (!contextManager) {
		vscode.window.showWarningMessage('ContextManager not initialized');
		return;
	}
	
	const context = contextManager.getContext();
	const language = contextManager.getCurrentLanguage();
	
	const contextText = `
**SpeechToTextWhisper Context Information:**

🔍 **IDE Type:** ${context.ideType}
📍 **Current Context:** ${context.contextType}

${context.activeEditor ? `📝 **Active Editor:**
• File: ${context.activeEditor.fileName}
• Language: ${context.activeEditor.language.name} (${context.activeEditor.language.id})
• Position: Line ${context.activeEditor.lineNumber}, Column ${context.activeEditor.columnNumber}
• Comment Style: ${context.activeEditor.language.commentStyle}
${context.activeEditor.language.lineComment ? `• Line Comment: ${context.activeEditor.language.lineComment}` : ''}
${context.activeEditor.language.blockComment ? `• Block Comment: ${context.activeEditor.language.blockComment.start} ... ${context.activeEditor.language.blockComment.end}` : ''}
` : ''}

${context.terminal?.isActive ? `💻 **Terminal:** ${context.terminal.name}\n` : ''}

${context.debugger?.isActive ? `🐛 **Debugger:** ${context.debugger.sessionName || 'Active'}\n` : ''}

${context.workspace ? `📁 **Workspace:** ${context.workspace.name}
• Folders: ${context.workspace.folders.length} folder(s)
` : ''}

**Comment Support:**
• Line Comments: ${language ? contextManager.supportsComments('line') : 'N/A'}
• Block Comments: ${language ? contextManager.supportsComments('block') : 'N/A'}
• Preferred Style: ${contextManager.getPreferredCommentStyle() || 'N/A'}
`;

	vscode.window.showInformationMessage(contextText, { modal: true });
}

function refreshContext(): void {
	if (!contextManager) {
		vscode.window.showWarningMessage('ContextManager not initialized');
		return;
	}
	
	try {
		contextManager.refreshContext();
		const context = contextManager.getContext();
		vscode.window.showInformationMessage(
			`🔄 Context refreshed: ${context.contextType} in ${context.ideType}`
		);
	} catch (error) {
		const errorMessage = (error as Error).message;
		vscode.window.showErrorMessage(`❌ Failed to refresh context: ${errorMessage}`);
	}
}

async function checkMicrophone(): Promise<void> {
	try {
		statusBarManager.showProcessing();
		
		// Проверяем доступность FFmpeg
		const ffmpegCheck = await FFmpegAudioRecorder.checkFFmpegAvailability();
		if (!ffmpegCheck.available) {
			throw new Error(`FFmpeg not available: ${ffmpegCheck.error || 'Not found in PATH'}`);
		}
		
		// Проверяем наличие аудио устройств
		const devices = await FFmpegAudioRecorder.detectInputDevices();
		if (devices.length === 0) {
			throw new Error('No audio input devices found');
		}
		
		statusBarManager.showSuccess('Microphone ready');
		vscode.window.showInformationMessage(`✅ Microphone is working correctly. Found ${devices.length} audio device(s).`);
		
	} catch (error) {
		const errorMessage = (error as Error).message;
		statusBarManager.showError(errorMessage, 'error');
		vscode.window.showErrorMessage(`❌ ${errorMessage}`);
	}
}

async function testApiKey(): Promise<void> {
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
		} catch (error) {
			// Ожидаемая ошибка с тестовыми данными, но API key валиден если мы получили ответ от API
			const errorMessage = (error as Error).message;
			if (errorMessage.includes('audio') || errorMessage.includes('format')) {
				statusBarManager.showSuccess('API key validated');
				vscode.window.showInformationMessage('✅ OpenAI API key is working correctly');
			} else {
				throw error;
			}
		}
		
	} catch (error) {
		const errorMessage = (error as Error).message;
		statusBarManager.showError(errorMessage, 'critical');
		vscode.window.showErrorMessage(`❌ API key test failed: ${errorMessage}`);
	}
}

function resetConfiguration(): void {
	vscode.window.showWarningMessage(
		'This will reset all SpeechToTextWhisper settings to defaults. Continue?',
		'Yes', 'No'
	).then(selection => {
		if (selection === 'Yes') {
			const config = vscode.workspace.getConfiguration('speechToTextWhisper');
			// Сбрасываем основные настройки (кроме API ключа)
			config.update('language', 'auto', vscode.ConfigurationTarget.Global);
			config.update('insertMode', 'cursor', vscode.ConfigurationTarget.Global);
			config.update('formatText', true, vscode.ConfigurationTarget.Global);
			
			vscode.window.showInformationMessage('✅ Configuration reset to defaults');
		}
	});
}

function toggleStatusBar(): void {
	const status = statusBarManager.getStatus();
	if (status.isVisible) {
		statusBarManager.hide();
		vscode.window.showInformationMessage('Status bar hidden');
	} else {
		statusBarManager.show();
		vscode.window.showInformationMessage('Status bar shown');
	}
}

/**
 * Приветственное сообщение
 */
function showWelcomeMessage(): void {
	const config = vscode.workspace.getConfiguration('speechToTextWhisper');
	const hasApiKey = config.get<string>('apiKey');
	
	if (!hasApiKey) {
		vscode.window.showInformationMessage(
			'🎤 Welcome to SpeechToTextWhisper! Please configure your OpenAI API key to get started.',
			'Open Settings'
		).then(selection => {
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
export function deactivate() {
	console.log('🔌 Deactivating SpeechToTextWhisper extension...');
	
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
		
		// Освобождаем ресурсы ContextManager
		if (contextManager) {
			console.log('🔌 Disposing ContextManager...');
			contextManager.dispose();
		}
		
		console.log('✅ SpeechToTextWhisper extension deactivated successfully');
		
	} catch (error) {
		console.error('❌ Error during deactivation:', error);
	}
}

/**
 * Обработка действий пользователя для восстановления
 */
async function handleUserRecoveryAction(userAction: string, context: ErrorContext): Promise<void> {
	console.log(`🔧 Handling user recovery action: ${userAction}`);
	
	try {
		// Определяем действие восстановления на основе пользовательского выбора
		if (userAction === 'Open Settings') {
			await recoveryHandler.executeRecoveryAction('open_settings' as any);
		} else if (userAction === 'Check Microphone') {
			await recoveryHandler.executeRecoveryAction('enable_microphone' as any);
		} else if (userAction === 'Retry') {
			await recoveryHandler.executeRecoveryAction('retry' as any);
		} else if (userAction === 'Check Network') {
			await recoveryHandler.executeRecoveryAction('check_network' as any);
		} else if (userAction === 'Reload Extension') {
			await recoveryHandler.executeRecoveryAction('refresh_extension' as any);
		}
	} catch (error) {
		console.error('❌ Recovery action failed:', error);
		vscode.window.showErrorMessage(`Recovery action failed: ${(error as Error).message}`);
	}
}

/**
 * Инициализация ContextManager
 */
function initializeContextManager(): void {
	console.log('🔧 Initializing ContextManager...');
	
	const contextEvents: ContextManagerEvents = {
		onContextChange: (context: IDEContext) => {
			console.log(`🔄 Context changed: ${context.contextType} in ${context.ideType}`);
			
			// Адаптируем поведение в зависимости от контекста
			adaptToContext(context);
		},
		
		onIDETypeDetected: (ideType: IDEType) => {
			console.log(`🔍 IDE detected: ${ideType}`);
			
			// Показываем специфичные для IDE сообщения
			if (ideType === IDEType.CURSOR) {
				console.log('🎯 Cursor IDE detected - AI chat integration available');
			} else if (ideType === IDEType.VSCODE) {
				console.log('💡 VS Code detected - standard functionality enabled');
			}
		},
		
		onLanguageChange: (language) => {
			console.log(`📝 Language changed: ${language.name} (${language.id})`);
			
			// Адаптируем настройки комментариев под язык
			if (textInserter) {
				// TextInserter уже использует VS Code API для определения языка
				// но теперь у нас есть дополнительная информация о стиле комментариев
			}
		}
	};
	
	contextManager = new ContextManager(contextEvents);
	
	console.log('✅ ContextManager initialized successfully');
}

/**
 * Адаптация поведения к текущему контексту
 */
function adaptToContext(context: IDEContext): void {
	try {
		// Адаптируем поведение StatusBar в зависимости от контекста
		if (statusBarManager) {
			// В режиме терминала или отладчика показываем минимальную информацию
			if (context.contextType === ContextType.TERMINAL || context.contextType === ContextType.DEBUGGER) {
				// StatusBarManager уже настроен, но можем адаптировать tooltip
			}
		}
		
		// Для Cursor - готовимся к интеграции с чатом
		if (context.ideType === IDEType.CURSOR && context.contextType === ContextType.CHAT) {
			console.log('💬 Cursor chat context detected - ready for AI chat integration');
		}
		
		// Адаптируем режим вставки в зависимости от типа файла
		if (context.activeEditor) {
			const language = context.activeEditor.language;
			console.log(`📝 Active file: ${language.name}, supports comments: line=${contextManager.supportsComments('line')}, block=${contextManager.supportsComments('block')}`);
		}
		
	} catch (error) {
		console.error('❌ Error adapting to context:', error);
	}
}

/**
 * Команда для комплексной диагностики расширения
 */
async function runDiagnostics(): Promise<void> {
	console.log('🔧 Running SpeechToTextWhisper diagnostics...');
	
	const diagnosticsResults: string[] = [];
	
	// Проверяем активацию расширения
	diagnosticsResults.push('✅ Extension activated');
	
	// Проверяем API ключ
	const config = vscode.workspace.getConfiguration('speechToTextWhisper');
	const apiKey = config.get<string>('apiKey');
	if (apiKey && apiKey.trim()) {
		diagnosticsResults.push('✅ API key configured');
	} else {
		diagnosticsResults.push('❌ API key missing');
	}
	
	// Проверяем поддержку FFmpeg
	const ffmpegCheck = await FFmpegAudioRecorder.checkFFmpegAvailability();
	if (ffmpegCheck.available) {
		diagnosticsResults.push('✅ FFmpeg available');
		if (ffmpegCheck.version) {
			diagnosticsResults.push(`📦 FFmpeg version: ${ffmpegCheck.version}`);
		}
	} else {
		diagnosticsResults.push(`❌ FFmpeg not available: ${ffmpegCheck.error || 'Not found'}`);
	}
	
	// Проверяем аудио устройства
	try {
		const devices = await FFmpegAudioRecorder.detectInputDevices();
		if (devices.length > 0) {
			diagnosticsResults.push(`✅ Audio devices found: ${devices.length}`);
			devices.slice(0, 3).forEach(device => {
				diagnosticsResults.push(`  📱 ${device}`);
			});
		} else {
			diagnosticsResults.push('❌ No audio input devices found');
		}
	} catch (error) {
		diagnosticsResults.push(`❌ Audio device check failed: ${(error as Error).message}`);
	}
	
	// Проверяем состояния
	diagnosticsResults.push(`📊 Recording state: ${audioRecorder?.getIsRecording() ? 'active' : 'inactive'}`);
	diagnosticsResults.push(`📊 Hold-to-record: ${isHoldToRecordActive ? 'active' : 'inactive'}`);
	diagnosticsResults.push(`📊 Last transcription: ${lastTranscribedText ? 'available' : 'none'}`);
	
	// Проверяем настройки
	const recordingMode = config.get<string>('recordingMode', 'hold');
	const language = config.get<string>('language', 'auto');
	const insertMode = config.get<string>('insertMode', 'cursor');
	
	diagnosticsResults.push(`⚙️ Recording mode: ${recordingMode}`);
	diagnosticsResults.push(`⚙️ Language: ${language}`);
	diagnosticsResults.push(`⚙️ Insert mode: ${insertMode}`);
	
	// Показываем результаты
	const message = 'SpeechToTextWhisper Diagnostics:\n\n' + diagnosticsResults.join('\n');
	
	vscode.window.showInformationMessage(message, 'Copy to Clipboard', 'OK').then(selection => {
		if (selection === 'Copy to Clipboard') {
			vscode.env.clipboard.writeText(message);
			vscode.window.showInformationMessage('Diagnostics copied to clipboard');
		}
	});
	
	console.log('Diagnostics results:', diagnosticsResults);
}

/**
 * Ленивая инициализация FFmpeg Audio Recorder
 */
async function ensureFFmpegAudioRecorder(): Promise<void> {
	if (audioRecorder) return;

	console.log('🔧 Initializing FFmpeg audio recorder...');

	// Проверка доступности FFmpeg
	const ffmpegCheck = await FFmpegAudioRecorder.checkFFmpegAvailability();
	if (!ffmpegCheck.available) {
		const error = new Error('FFmpeg not found. Please install FFmpeg and add it to PATH.');
		
		// Показать пользователю инструкции по установке
		const action = await vscode.window.showErrorMessage(
			'FFmpeg is required for audio recording but was not found.',
			'Install Guide', 'Settings'
		);
		
		if (action === 'Install Guide') {
			vscode.env.openExternal(vscode.Uri.parse('https://ffmpeg.org/download.html'));
		} else if (action === 'Settings') {
			vscode.commands.executeCommand('workbench.action.openSettings', 'speechToTextWhisper.ffmpegPath');
		}
		
		throw error;
	}

	// Создание экземпляра с настройками из конфигурации
	const config = vscode.workspace.getConfiguration('speechToTextWhisper');
	
	// Получаем inputDevice настройку и обрабатываем ее правильно
	const inputDeviceSetting = config.get<string>('inputDevice');
	const inputDevice = inputDeviceSetting === 'auto' || !inputDeviceSetting ? undefined : inputDeviceSetting;
	
	// События для AudioRecorder
	const audioRecorderEvents: AudioRecorderEvents = {
		onRecordingStart: () => {
			console.log('🎤 Recording started');
			
			// Обновляем context variables
			vscode.commands.executeCommand('setContext', 'speechToTextWhisper.isRecording', true);
			
			statusBarManager.updateRecordingState(true);
			
			// Показываем уведомление только если не в hold-to-record режиме
			if (!isHoldToRecordActive) {
				vscode.window.showInformationMessage('🎤 Recording started...');
			}
		},
		onRecordingStop: async (audioBlob: Blob) => {
			console.log('⏹️ Recording stopped');
			
			// Обновляем context variables
			vscode.commands.executeCommand('setContext', 'speechToTextWhisper.isRecording', false);
			
			statusBarManager.updateRecordingState(false);
			await handleTranscription(audioBlob);
		},
		onError: async (error: Error) => {
			console.error('❌ Recording error:', error);
			
			// Сбрасываем состояния при ошибке
			vscode.commands.executeCommand('setContext', 'speechToTextWhisper.isRecording', false);
			vscode.commands.executeCommand('setContext', 'speechToTextWhisper.holdToRecordActive', false);
			isHoldToRecordActive = false;
			
			// Используем новую систему обработки ошибок
			const context: ErrorContext = {
				operation: 'audio_recording',
				isHoldToRecordMode: isHoldToRecordActive,
				timestamp: new Date()
			};
			
			const userAction = await errorHandler.handleErrorFromException(error, context);
			
			if (userAction && userAction !== 'ignore') {
				await handleUserRecoveryAction(userAction, context);
			}
		}
	};
	
	audioRecorder = new FFmpegAudioRecorder(audioRecorderEvents, {
		sampleRate: config.get<number>('sampleRate', 16000),
		channelCount: config.get<number>('channels', 1),
		audioFormat: config.get<'wav' | 'mp3' | 'webm' | 'opus'>('audioFormat', 'wav'),
		codec: config.get<string>('audioCodec', 'pcm_s16le'),
		inputDevice: inputDevice,
		ffmpegPath: config.get<string>('ffmpegPath') || undefined,
		maxDuration: config.get<number>('maxRecordingDuration', 60)
	});
	
	console.log('✅ FFmpeg audio recorder initialized');
}
