// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { FFmpegAudioRecorder, AudioRecorderEvents } from './core/FFmpegAudioRecorder';
import { WhisperClient } from './core/WhisperClient';
import { TextInserter } from './ui/TextInserter';
import { StatusBarManager, StatusBarEvents, StatusBarConfiguration } from './ui/StatusBarManager';
import { DiagnosticsProvider } from './ui/DiagnosticsProvider';
import { DeviceManagerProvider } from './ui/DiagnosticsProvider';
import { SettingsProvider } from './ui/SettingsProvider';
import { ModeSelectorProvider } from './ui/ModeSelectorProvider';
import { ErrorHandler, ErrorType, ErrorContext, VSCodeErrorDisplayHandler } from './utils/ErrorHandler';
import { RetryManager } from './utils/RetryManager';
import { CursorIntegration, CursorIntegrationStrategy } from './integrations/CursorIntegration';

/**
 * Режимы записи для новой архитектуры команд
 */
enum RecordingMode {
	INSERT_OR_CLIPBOARD = 'insertOrClipboard',  // Ctrl+Shift+M - вставка в курсор или буфер обмена
	CURRENT_CHAT = 'currentChat',               // Ctrl+Shift+N - отправка в текущий чат Cursor
	NEW_CHAT = 'newChat'                        // F9 - открытие нового чата
}

/**
 * Состояние записи
 */
interface RecordingState {
	isRecording: boolean;
	mode: RecordingMode | null;
	startTime: number | null;
}

// Глобальные переменные для компонентов
let audioRecorder: FFmpegAudioRecorder | null = null;
let whisperClient: WhisperClient;
let textInserter: TextInserter;
let statusBarManager: StatusBarManager;
let diagnosticsProvider: DiagnosticsProvider;
let deviceManagerProvider: DeviceManagerProvider;
let settingsProvider: SettingsProvider;
let modeSelectorProvider: ModeSelectorProvider;

// Система обработки ошибок
let errorHandler: ErrorHandler;
let retryManager: RetryManager;

// Контекст расширения для глобального доступа
let extensionContext: vscode.ExtensionContext;

// Переменная для отслеживания состояния записи (заменяет currentRecordingMode)
let recordingState: RecordingState = {
	isRecording: false,
	mode: null,
	startTime: null
};

// Время последнего запуска записи для предотвращения частых попыток
let lastRecordingStartTime = 0;
const MIN_RECORDING_INTERVAL = 100; // минимум 100ms между попытками (было 200ms)

// Переменная для хранения последней транскрибации
let lastTranscribedText: string | null = null;

// Интеграция с Cursor чатом
let cursorIntegration: CursorIntegration;

/**
 * Утилиты для управления состоянием записи
 */
class RecordingStateManager {
	/**
	 * Проверка, идет ли запись
	 */
	static isRecording(): boolean {
		return recordingState.isRecording;
	}

	/**
	 * Получение текущего режима записи
	 */
	static getCurrentMode(): RecordingMode | null {
		return recordingState.mode;
	}

	/**
	 * Начало записи с указанным режимом
	 */
	static startRecording(mode: RecordingMode): boolean {
		// Проверяем, не идет ли уже запись
		if (recordingState.isRecording) {
			console.warn('⚠️ Recording already in progress');
			return false;
		}

		// Устанавливаем состояние
		const now = Date.now();
		recordingState = {
			isRecording: true,
			mode: mode,
			startTime: now
		};

		console.log(`🎤 Recording started with mode: ${mode}`);
		return true;
	}

	/**
	 * Остановка записи
	 */
	static stopRecording(): RecordingMode | null {
		if (!recordingState.isRecording) {
			console.warn('⚠️ No recording in progress to stop');
			return null;
		}

		const mode = recordingState.mode;
		recordingState = {
			isRecording: false,
			mode: null,
			startTime: null
		};

		console.log(`⏹️ Recording stopped, mode was: ${mode}`);
		return mode;
	}

	/**
	 * Принудительный сброс состояния (для ошибок)
	 */
	static resetState(): void {
		recordingState = {
			isRecording: false,
			mode: null,
			startTime: null
		};
		console.log('🔄 Recording state reset');
	}

	/**
	 * Получение длительности текущей записи в ms
	 */
	static getRecordingDuration(): number {
		if (!recordingState.isRecording || !recordingState.startTime) {
			return 0;
		}
		return Date.now() - recordingState.startTime;
	}
}

/**
 * Функция активации расширения
 * Вызывается при первом использовании команды расширения
 */
export function activate(context: vscode.ExtensionContext) {
	console.log('🎤 [DEBUG] SpeechToTextWhisper extension activation started! NEW VERSION 2024');
	vscode.window.showInformationMessage('🎤 [DEBUG] SpeechToTextWhisper extension is activating...');
	
	// Сохраняем контекст для глобального использования
	extensionContext = context;

	try {
		// Инициализируем систему обработки ошибок
		console.log('🎤 [DEBUG] Initializing error handling...');
		initializeErrorHandling();
		
		// Инициализируем компоненты
		console.log('🎤 [DEBUG] Initializing components...');
		initializeComponents();
		
		// Регистрируем все команды
		console.log('🎤 [DEBUG] Registering commands...');
		registerCommands(context);
		
		// Инициализируем WhisperClient при первом использовании
		console.log('🎤 [DEBUG] Initializing Whisper client...');
		initializeWhisperClient();
		
		// Показываем приветственное сообщение и StatusBar
		console.log('🎤 [DEBUG] Showing welcome message...');
		showWelcomeMessage();
		
		console.log('✅ [DEBUG] SpeechToTextWhisper extension successfully activated');
		vscode.window.showInformationMessage('✅ [DEBUG] SpeechToTextWhisper extension successfully activated!');
		
	} catch (error) {
		const errorMessage = `Failed to activate SpeechToTextWhisper: ${(error as Error).message}`;
		console.error('❌ [DEBUG] Activation error:', errorMessage);
		vscode.window.showErrorMessage(errorMessage);
	}
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
	
	console.log('✅ Error handling system initialized');
}

/**
 * Инициализация всех компонентов расширения
 */
function initializeComponents(): void {
	console.log('🔧 Initializing SpeechToTextWhisper components...');
	
	// Инициализируем CursorIntegration
	initializeCursorIntegration();
	
	// Инициализируем TextInserter
	textInserter = new TextInserter();
	
	// Инициализируем DiagnosticsProvider
	diagnosticsProvider = new DiagnosticsProvider();
	
	// Инициализируем DeviceManagerProvider
	deviceManagerProvider = new DeviceManagerProvider();
	
	// Инициализируем SettingsProvider
	settingsProvider = new SettingsProvider();
	
	// Инициализируем ModeSelectorProvider
	modeSelectorProvider = new ModeSelectorProvider();
	
	// События для StatusBar
	const statusBarEvents: StatusBarEvents = {
		onRecordingToggle: () => {
			console.log('📊 Status bar clicked');
			vscode.commands.executeCommand('workbench.action.openSettings', 'speechToTextWhisper');
		}
	};
	
	// Конфигурация StatusBar
	const statusBarConfig: StatusBarConfiguration = {
		position: 'right',
		priority: 100,
		showTooltips: true,
		enableAnimations: true
	};
	
	// Инициализируем StatusBarManager
	statusBarManager = new StatusBarManager(statusBarEvents, statusBarConfig);
	
	console.log('✅ Components initialized');
}

/**
 * Регистрация команд расширения
 */
function registerCommands(context: vscode.ExtensionContext): void {
	console.log('📝 [DEBUG] Registering commands...');
	
	const commands = [
		// Основные команды записи
		vscode.commands.registerCommand('speechToTextWhisper.recordAndInsertOrClipboard', recordAndInsertOrClipboard),
		vscode.commands.registerCommand('speechToTextWhisper.recordAndInsertToCurrentChat', recordAndInsertToCurrentChat),
		vscode.commands.registerCommand('speechToTextWhisper.recordAndOpenNewChat', recordAndOpenNewChat),
		// Команда диагностики
		vscode.commands.registerCommand('speechToTextWhisper.runDiagnostics', () => diagnosticsProvider.runAllDiagnostics()),
		// Команда тестирования FFmpeg
		vscode.commands.registerCommand('speechToTextWhisper.testFFmpeg', async () => {
			try {
				console.log('🔍 [DEBUG] Testing FFmpeg availability...');
				vscode.window.showInformationMessage('🔍 Testing FFmpeg...');
				
				const ffmpegCheck = await FFmpegAudioRecorder.checkFFmpegAvailability();
				console.log('🔍 [DEBUG] FFmpeg check result:', ffmpegCheck);
				
				if (ffmpegCheck.available) {
					vscode.window.showInformationMessage(`✅ FFmpeg is available! Version: ${ffmpegCheck.version}`);
				} else {
					vscode.window.showErrorMessage(`❌ FFmpeg not available: ${ffmpegCheck.error}`);
				}
				
				// Пробуем диагностику
				const diagnostics = await FFmpegAudioRecorder.runDiagnostics();
				console.log('🔍 [DEBUG] FFmpeg diagnostics:', diagnostics);
				
				const deviceCount = diagnostics.inputDevices.length;
				const errorCount = diagnostics.errors.length;
				const warningCount = diagnostics.warnings.length;
				
				vscode.window.showInformationMessage(`FFmpeg Diagnostics: ${deviceCount} devices, ${errorCount} errors, ${warningCount} warnings`);
				
			} catch (error) {
				const errorMsg = `FFmpeg test failed: ${(error as Error).message}`;
				console.error('❌ [DEBUG] FFmpeg test error:', errorMsg);
				vscode.window.showErrorMessage(errorMsg);
			}
		}),
		// Команда тестирования инициализации audioRecorder
		vscode.commands.registerCommand('speechToTextWhisper.testAudioRecorder', async () => {
			try {
				console.log('🔍 [DEBUG] Testing audioRecorder initialization...');
				vscode.window.showInformationMessage('🔍 Testing Audio Recorder...');
				
				// Сбрасываем текущий audioRecorder
				audioRecorder = null;
				
				// Пробуем инициализировать
				await ensureFFmpegAudioRecorder();
				
				if (audioRecorder) {
					vscode.window.showInformationMessage('✅ Audio Recorder initialized successfully!');
					console.log('✅ [DEBUG] Audio Recorder test passed');
				} else {
					vscode.window.showErrorMessage('❌ Audio Recorder is still null after initialization');
					console.error('❌ [DEBUG] Audio Recorder test failed - still null');
				}
				
			} catch (error) {
				const errorMsg = `Audio Recorder test failed: ${(error as Error).message}`;
				console.error('❌ [DEBUG] Audio Recorder test error:', errorMsg);
				vscode.window.showErrorMessage(errorMsg);
			}
		}),
		// Команды для управления устройствами
		vscode.commands.registerCommand('speechToTextWhisper.audioSettings.selectDevice', (deviceId: string) => deviceManagerProvider.selectDevice(deviceId)),
		// Команды для настроек
		vscode.commands.registerCommand('speechToTextWhisper.openSettings', () => settingsProvider.openSettings()),
		// Команды для переключения режима
		vscode.commands.registerCommand('speechToTextWhisper.toggleMode', () => modeSelectorProvider.toggleMode())
	];

	console.log(`📝 [DEBUG] Created ${commands.length} command registrations`);

	// Регистрируем DiagnosticsProvider как TreeDataProvider
	vscode.window.registerTreeDataProvider('speechToTextWhisper.diagnostics', diagnosticsProvider);

	// Регистрируем DeviceManagerProvider как TreeDataProvider
	vscode.window.registerTreeDataProvider('speechToTextWhisper.deviceManager', deviceManagerProvider);

	// Регистрируем SettingsProvider как TreeDataProvider
	vscode.window.registerTreeDataProvider('speechToTextWhisper.settings', settingsProvider);

	// Регистрируем ModeSelectorProvider как TreeDataProvider
	vscode.window.registerTreeDataProvider('speechToTextWhisper.modeSelector', modeSelectorProvider);

	// Добавляем все команды в подписки
	context.subscriptions.push(...commands, statusBarManager);
	
	console.log(`✅ [DEBUG] Registered ${commands.length} commands and added to subscriptions`);
}

/**
 * Обработка транскрибации
 */
async function handleTranscription(audioBlob: Blob): Promise<void> {
	const context: ErrorContext = {
		operation: 'transcription',
		isHoldToRecordMode: false,
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
				await errorHandler.handleError(ErrorType.API_KEY_MISSING, context);
				return;
			}
		}

		// Переход к состоянию транскрибации
		statusBarManager.showTranscribing();

		// Получаем настройки
		const config = vscode.workspace.getConfiguration('speechToTextWhisper');
		const language = config.get<string>('language', 'auto');
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
				baseDelay: 1000
			}
		);

		if (!transcriptionResult.success) {
			// Если retry не помог, обрабатываем через ErrorHandler
			const error = transcriptionResult.lastError || new Error('Transcription failed after retries');
			await errorHandler.handleErrorFromException(error, context);
			return;
		}

		const transcribedText = transcriptionResult.result;
		
		if (transcribedText && transcribedText.trim()) {
			console.log('✅ Transcription successful:', transcribedText.substring(0, 100));
			
			// Сохраняем последнюю транскрибацию
			lastTranscribedText = transcribedText.trim();
			
			// Показываем состояние вставки
			statusBarManager.showInserting();
			
			// Используем currentRecordingMode для определения действия
			console.log(`🔍 Current recording mode: ${recordingState.mode}`);
			
			if (recordingState.mode === RecordingMode.INSERT_OR_CLIPBOARD) {
				console.log('📝 Processing insertOrClipboard mode...');
				
				try {
					// Читаем режим вставки из ModeSelectorProvider
					const insertMode = modeSelectorProvider.getCurrentMode();
					
					if (insertMode === 'insert') {
						// Режим вставки в позицию курсора
						console.log('📝 Inserting into active editor at cursor position');
						await insertTranscribedTextWithErrorHandling(lastTranscribedText, 'cursor', context);
						
						// Показываем успех
						const truncatedText = lastTranscribedText.substring(0, 50) + (lastTranscribedText.length > 50 ? '...' : '');
						statusBarManager.showSuccess(`Inserted: "${truncatedText}"`);
						vscode.window.showInformationMessage(`✅ Transcribed and inserted at cursor: "${truncatedText}"`);
						
					} else if (insertMode === 'clipboard') {
						// Режим копирования в буфер обмена
						console.log('📋 Copying to clipboard');
						await vscode.env.clipboard.writeText(lastTranscribedText);
						
						// Показываем успех
						const truncatedText = lastTranscribedText.substring(0, 50) + (lastTranscribedText.length > 50 ? '...' : '');
						statusBarManager.showSuccess(`Copied: "${truncatedText}"`);
						vscode.window.showInformationMessage(`✅ Transcribed and copied to clipboard: "${truncatedText}"`);
					}
					
					// Сбрасываем режим
					RecordingStateManager.resetState();
					return;
					
				} catch (error) {
					console.error('❌ Failed to process insertOrClipboard:', error);
					vscode.window.showErrorMessage(`Failed to process text: ${(error as Error).message}`);
					RecordingStateManager.resetState();
					return;
				}
			} else if (recordingState.mode === RecordingMode.CURRENT_CHAT) {
				console.log('🎯 Sending to Cursor chat (mode: currentChat)');
				
				try {
					// Последовательность команд для текущего чата
					console.log('🎯 Executing composer:startComposerPrompt...');
					await vscode.commands.executeCommand('composer:startComposerPrompt');
					
					// Задержка 200ms
					await new Promise(resolve => setTimeout(resolve, 200));
					
					console.log('🎯 Executing chat.action.focus...');
					await vscode.commands.executeCommand('chat.action.focus');
					
					// Задержка 200ms
					await new Promise(resolve => setTimeout(resolve, 200));
					
					// Вставляем текст в чат
					console.log('🎯 Inserting text into chat...');
					await vscode.env.clipboard.writeText(lastTranscribedText);
					await vscode.commands.executeCommand('editor.action.clipboardPasteAction');
					
					// Показываем успех
					const truncatedText = lastTranscribedText.substring(0, 50) + (lastTranscribedText.length > 50 ? '...' : '');
					statusBarManager.showSuccess(`Sent to chat: "${truncatedText}"`);
					vscode.window.showInformationMessage(`✅ Transcribed and sent to chat: "${truncatedText}"`);
					
					// Сбрасываем режим
					RecordingStateManager.resetState();
					return;
					
				} catch (error) {
					console.error('❌ Failed to send to chat:', error);
					vscode.window.showErrorMessage(`Failed to send to chat: ${(error as Error).message}`);
					RecordingStateManager.resetState();
					return;
				}
			} else if (recordingState.mode === RecordingMode.NEW_CHAT) {
				console.log('🎯 Opening new chat (mode: newChat)');
				
				try {
					// Выполняем команду открытия нового чата
					console.log('🎯 Executing aichat.newfollowupaction...');
					await vscode.commands.executeCommand('aichat.newfollowupaction');
					
					// Задержка 300ms
					await new Promise(resolve => setTimeout(resolve, 300));
					
					// Вставляем текст в новый чат
					console.log('🎯 Inserting text into new chat...');
					await vscode.env.clipboard.writeText(lastTranscribedText);
					await vscode.commands.executeCommand('editor.action.clipboardPasteAction');
					
					// Показываем успех
					const truncatedText = lastTranscribedText.substring(0, 50) + (lastTranscribedText.length > 50 ? '...' : '');
					statusBarManager.showSuccess(`Opened new chat: "${truncatedText}"`);
					vscode.window.showInformationMessage(`✅ Transcribed and opened new chat: "${truncatedText}"`);
					
					// Сбрасываем режим
					RecordingStateManager.resetState();
					return;
					
				} catch (error) {
					console.error('❌ Failed to open new chat:', error);
					vscode.window.showErrorMessage(`Failed to open new chat: ${(error as Error).message}`);
					RecordingStateManager.resetState();
					return;
				}
			}
			
		} else {
			// Обработка пустой транскрибации
			await errorHandler.handleError(ErrorType.TRANSCRIPTION_EMPTY, context);
		}
		
	} catch (error) {
		console.error('❌ Transcription failed:', error);
		await errorHandler.handleErrorFromException(error as Error, context);
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
			insertMode: mode, 
			textLength: text.length,
			parentOperation: parentContext.operation
		}
	};

	try {
		console.log(`📝 Inserting text with mode: ${mode}`);
		
		// Используем retry для вставки текста
		const insertResult = await retryManager.retry(
			() => textInserter.insertText(text, { mode: mode as 'cursor' | 'comment' | 'replace' | 'newLine' | 'clipboard' }),
			'text_insertion'
		);

		if (!insertResult.success) {
			const error = insertResult.lastError || new Error('Text insertion failed after retries');
			await errorHandler.handleErrorFromException(error, context);
		}
		
	} catch (error) {
		console.error('❌ Text insertion failed:', error);
		await errorHandler.handleErrorFromException(error as Error, context);
	}
}

/**
 * Вставка последней транскрибации
 */
async function insertLastTranscription(mode: string): Promise<void> {
	if (!lastTranscribedText) {
		vscode.window.showWarningMessage('No transcribed text available');
		return;
	}

	const context: ErrorContext = {
		operation: 'insert_last_transcription',
		isHoldToRecordMode: false,
		timestamp: new Date(),
		additionalData: { insertMode: mode }
	};

	try {
		console.log(`📝 Inserting last transcription with mode: ${mode}`);
		
		if (mode === 'currentChat') {
			// Отправляем в Cursor чат
			if (!cursorIntegration || !cursorIntegration.isIntegrationEnabled()) {
				throw new Error('Cursor integration not available');
			}
			
			await cursorIntegration.sendToChat(lastTranscribedText);
			console.log('✅ Text sent to Cursor chat');
			
		} else if (mode === 'newChat') {
			// Отправляем в новый чат через CursorIntegration
			await cursorIntegration.sendToChat(lastTranscribedText);
			console.log('✅ Text sent to new chat');
			
		} else {
			// Вставляем в редактор
			await insertTranscribedTextWithErrorHandling(lastTranscribedText, mode, context);
		}
		
	} catch (error) {
		console.error(`❌ Failed to insert last transcription (mode: ${mode}):`, error);
		await errorHandler.handleErrorFromException(error as Error, context);
	}
}

/**
 * Инициализация WhisperClient
 */
function initializeWhisperClient(): void {
	console.log('🔧 Initializing WhisperClient...');
	
	const config = vscode.workspace.getConfiguration('speechToTextWhisper');
	const apiKey = config.get<string>('apiKey');
	
	if (!apiKey) {
		console.warn('⚠️ OpenAI API key not configured');
		vscode.window.showWarningMessage(
			'OpenAI API key not configured. Please set it in settings.',
			'Open Settings'
		).then(selection => {
			if (selection === 'Open Settings') {
				vscode.commands.executeCommand('workbench.action.openSettings', 'speechToTextWhisper.apiKey');
			}
		});
		return;
	}
	
	try {
		whisperClient = new WhisperClient({
			apiKey: apiKey,
			timeout: config.get<number>('timeout', 30000)
		});
		
		console.log('✅ WhisperClient initialized');
		
	} catch (error) {
		console.error('❌ Failed to initialize WhisperClient:', error);
		vscode.window.showErrorMessage(`Failed to initialize Whisper client: ${(error as Error).message}`);
	}
}

function showWelcomeMessage(): void {
	// Принудительно показываем StatusBar
	statusBarManager.show();
	
	const config = vscode.workspace.getConfiguration('speechToTextWhisper');
	const showStatusBar = config.get<boolean>('showStatusBar', true);
	
	if (!showStatusBar) {
		statusBarManager.hide();
	}
	
	// Показываем краткую справку при первом запуске
	if (extensionContext && extensionContext.globalState) {
		const hasShownWelcome = extensionContext.globalState.get<boolean>('hasShownWelcome', false);
		if (!hasShownWelcome) {
			vscode.window.showInformationMessage(
				'🎤 Speech to Text with Whisper activated! Use F9 to record and send to chat, Ctrl+Shift+M to record to clipboard.',
				'Got it!'
			).then(() => {
				if (extensionContext && extensionContext.globalState) {
					extensionContext.globalState.update('hasShownWelcome', true);
				}
			});
		}
	}
}

/**
 * Функция деактивации расширения
 */
export function deactivate() {
	console.log('🔌 Deactivating SpeechToTextWhisper extension...');
	
	// Останавливаем запись если она идет
	if (audioRecorder && audioRecorder.getIsRecording()) {
		audioRecorder.stopRecording();
	}
	
	// Очищаем ресурсы
	audioRecorder = null;
	lastTranscribedText = null;
	recordingState = {
		isRecording: false,
		mode: null,
		startTime: null
	};
	
	console.log('✅ SpeechToTextWhisper extension deactivated');
}

/**
 * Инициализация интеграции с Cursor
 */
function initializeCursorIntegration(): void {
	console.log('🔧 Initializing Cursor integration...');
	
	// Используем стратегию по умолчанию
	const primaryStrategy = CursorIntegrationStrategy.AICHAT_COMMAND;
	
	console.log(`🎯 Using Cursor integration strategy: ${primaryStrategy}`);
	
	// Создаем экземпляр CursorIntegration
	cursorIntegration = new CursorIntegration({
		primaryStrategy: primaryStrategy,
		fallbackStrategies: [
			CursorIntegrationStrategy.CLIPBOARD,
			CursorIntegrationStrategy.COMMAND_PALETTE
		],
		autoFocusChat: true,
		prefixText: '',
		suffixText: '',
		useMarkdownFormat: true,
		timeout: 5000
	}, {
		onChatSent: (text: string, strategy: CursorIntegrationStrategy) => {
			console.log(`✅ Text sent to chat via ${strategy}: "${text.substring(0, 50)}..."`);
		},
		onFallbackUsed: (primary: CursorIntegrationStrategy, fallback: CursorIntegrationStrategy) => {
			console.log(`🔄 Fallback used: ${primary} -> ${fallback}`);
			vscode.window.showWarningMessage(`Cursor chat: fell back to ${fallback} strategy`);
		},
		onError: (error: Error, strategy: CursorIntegrationStrategy) => {
			console.error(`❌ CursorIntegration error with ${strategy}:`, error);
		}
	});
	
	console.log(`✅ CursorIntegration initialized, enabled: ${cursorIntegration.isIntegrationEnabled()}`);
}

/**
 * Команда записи с вставкой в курсор или буфер обмена (Ctrl+Shift+M)
 */
async function recordAndInsertOrClipboard(): Promise<void> {
	console.log('🎤 [DEBUG] recordAndInsertOrClipboard called! UNIQUE COMMAND MESSAGE 67890');
	console.log('🎤 [DEBUG] recordAndInsertOrClipboard called! MODIFIED MESSAGE 99999');
	vscode.window.showInformationMessage('🎤 [DEBUG] Command recordAndInsertOrClipboard executed!');
	
	const context: ErrorContext = {
		operation: 'record_and_insert_or_clipboard',
		isHoldToRecordMode: false,
		timestamp: new Date()
	};

	try {
		// Проверяем, идет ли уже запись
		if (RecordingStateManager.isRecording()) {
			// Останавливаем запись
			console.log('⏹️ Stopping recording (recordAndInsertOrClipboard)');
			stopRecording();
			return;
		}

		// Проверяем минимальный интервал между попытками ЗДЕСЬ
		const now = Date.now();
		if (now - lastRecordingStartTime < MIN_RECORDING_INTERVAL) {
			console.log('⚠️ [DEBUG] Too frequent recording attempts in command, skipping');
			vscode.window.showWarningMessage('Too frequent recording attempts. Please wait a moment.');
			return;
		}

		console.log('🎤 Starting record and insert or clipboard...');
		
		// Начинаем запись с режимом INSERT_OR_CLIPBOARD
		if (RecordingStateManager.startRecording(RecordingMode.INSERT_OR_CLIPBOARD)) {
			// Обновляем StatusBar сразу при начале попытки записи
			if (statusBarManager) {
				statusBarManager.updateRecordingState(true);
			}
			
			// Устанавливаем время попытки записи
			lastRecordingStartTime = now;
			
			await startRecording();
			vscode.window.showInformationMessage('🎤 Recording... Press Ctrl+Shift+M again to stop');
		} else {
			vscode.window.showWarningMessage('Recording already in progress or too frequent attempts');
		}
		
	} catch (error) {
		console.error('❌ Record and insert or clipboard failed:', error);
		RecordingStateManager.resetState();
		// Сбрасываем StatusBar при ошибке
		if (statusBarManager) {
			statusBarManager.updateRecordingState(false);
		}
		await errorHandler.handleErrorFromException(error as Error, context);
	}
}

/**
 * Команда записи с отправкой в текущий чат Cursor (Ctrl+Shift+N)
 */
async function recordAndInsertToCurrentChat(): Promise<void> {
	console.log('🎤 [DEBUG] recordAndInsertToCurrentChat called!');
	vscode.window.showInformationMessage('🎤 [DEBUG] Command recordAndInsertToCurrentChat executed!');
	
	const context: ErrorContext = {
		operation: 'record_and_insert_to_current_chat',
		isHoldToRecordMode: false,
		timestamp: new Date()
	};

	try {
		// Проверяем, идет ли уже запись
		if (RecordingStateManager.isRecording()) {
			// Останавливаем запись
			console.log('⏹️ Stopping recording (recordAndInsertToCurrentChat)');
			stopRecording();
			return;
		}

		// Проверяем минимальный интервал между попытками ЗДЕСЬ
		const now = Date.now();
		if (now - lastRecordingStartTime < MIN_RECORDING_INTERVAL) {
			console.log('⚠️ [DEBUG] Too frequent recording attempts in command, skipping');
			vscode.window.showWarningMessage('Too frequent recording attempts. Please wait a moment.');
			return;
		}

		console.log('🎤 Starting record and insert to current chat...');
		
		// Начинаем запись с режимом CURRENT_CHAT
		if (RecordingStateManager.startRecording(RecordingMode.CURRENT_CHAT)) {
			// Обновляем StatusBar сразу при начале попытки записи
			if (statusBarManager) {
				statusBarManager.updateRecordingState(true);
			}
			
			// Устанавливаем время попытки записи
			lastRecordingStartTime = now;
			
			await startRecording();
			vscode.window.showInformationMessage('🎤 Recording... Press Ctrl+Shift+N again to stop and send to chat');
		} else {
			vscode.window.showWarningMessage('Recording already in progress or too frequent attempts');
		}
		
	} catch (error) {
		console.error('❌ Record and insert to current chat failed:', error);
		RecordingStateManager.resetState();
		// Сбрасываем StatusBar при ошибке
		if (statusBarManager) {
			statusBarManager.updateRecordingState(false);
		}
		await errorHandler.handleErrorFromException(error as Error, context);
	}
}

/**
 * Команда записи с открытием нового чата (F9)
 */
async function recordAndOpenNewChat(): Promise<void> {
	console.log('🎤 [DEBUG] recordAndOpenNewChat called!');
	vscode.window.showInformationMessage('🎤 [DEBUG] Command recordAndOpenNewChat executed!');
	
	const context: ErrorContext = {
		operation: 'record_and_open_new_chat',
		isHoldToRecordMode: false,
		timestamp: new Date()
	};

	try {
		// Проверяем, идет ли уже запись
		if (RecordingStateManager.isRecording()) {
			// Останавливаем запись
			console.log('⏹️ Stopping recording (recordAndOpenNewChat)');
			stopRecording();
			return;
		}

		// Проверяем минимальный интервал между попытками ЗДЕСЬ
		const now = Date.now();
		if (now - lastRecordingStartTime < MIN_RECORDING_INTERVAL) {
			console.log('⚠️ [DEBUG] Too frequent recording attempts in command, skipping');
			vscode.window.showWarningMessage('Too frequent recording attempts. Please wait a moment.');
			return;
		}

		console.log('🎤 Starting record and open new chat...');
		
		// Начинаем запись с режимом NEW_CHAT
		if (RecordingStateManager.startRecording(RecordingMode.NEW_CHAT)) {
			// Обновляем StatusBar сразу при начале попытки записи
			if (statusBarManager) {
				statusBarManager.updateRecordingState(true);
			}
			
			// Устанавливаем время попытки записи
			lastRecordingStartTime = now;
			
			await startRecording();
			vscode.window.showInformationMessage('🎤 Recording... Press F9 again to stop and open new chat');
		} else {
			vscode.window.showWarningMessage('Recording already in progress or too frequent attempts');
		}
		
	} catch (error) {
		console.error('❌ Record and open new chat failed:', error);
		RecordingStateManager.resetState();
		// Сбрасываем StatusBar при ошибке
		if (statusBarManager) {
			statusBarManager.updateRecordingState(false);
		}
		await errorHandler.handleErrorFromException(error as Error, context);
	}
}

/**
 * Команды записи
 */
async function startRecording(): Promise<void> {
	console.log('▶️ [DEBUG] startRecording() called - UNIQUE MESSAGE 12345');
	console.log('▶️ [DEBUG] startRecording() called - FINAL VERSION 2024');
	
	const context: ErrorContext = {
		operation: 'start_recording',
		isHoldToRecordMode: false,
		timestamp: new Date()
	};

	try {
		console.log('▶️ [DEBUG] Starting recording... NO INTERVAL CHECKS');
		
		// УБИРАЕМ ВСЕ ПРОВЕРКИ ИНТЕРВАЛА - они только в командах
		
		// Обеспечиваем инициализацию FFmpeg Audio Recorder
		console.log('🔧 [DEBUG] Calling ensureFFmpegAudioRecorder...');
		await ensureFFmpegAudioRecorder();
		console.log('🔧 [DEBUG] ensureFFmpegAudioRecorder completed successfully');
		
		// Проверяем, что audioRecorder инициализирован
		if (!audioRecorder) {
			console.error('❌ [DEBUG] audioRecorder is null after ensureFFmpegAudioRecorder');
			// Сбрасываем состояние записи если audioRecorder не инициализирован
			RecordingStateManager.resetState();
			vscode.window.showErrorMessage('❌ Failed to initialize audio recorder');
			return;
		}
		
		console.log('✅ [DEBUG] audioRecorder is initialized, checking if already recording...');
		
		// Проверяем, не идет ли уже запись
		if (audioRecorder.getIsRecording()) {
			console.log('⚠️ [DEBUG] Recording already in progress, skipping start');
			return;
		}
		
		console.log('🎤 [DEBUG] audioRecorder not recording, checking microphone...');
		
		// Проверяем состояние микрофона с retry
		console.log('🔍 [DEBUG] Starting microphone permission check...');
		const microphoneResult = await retryManager.retryMicrophoneOperation(
			async () => {
				console.log('🔍 [DEBUG] Calling FFmpegAudioRecorder.checkMicrophonePermission...');
				const hasPermission = await FFmpegAudioRecorder.checkMicrophonePermission();
				console.log('🔍 [DEBUG] Microphone permission result:', JSON.stringify(hasPermission, null, 2));
				if (hasPermission.state !== 'granted') {
					throw new Error('Microphone permission not granted');
				}
				return hasPermission;
			},
			'microphone_permission_check'
		);

		console.log('🔍 [DEBUG] Microphone operation result:', JSON.stringify(microphoneResult, null, 2));

		if (!microphoneResult.success) {
			const error = microphoneResult.lastError || new Error('Microphone access failed');
			console.error('❌ [DEBUG] Microphone check failed:', error);
			// Сбрасываем состояние записи при ошибке микрофона
			RecordingStateManager.resetState();
			await errorHandler.handleErrorFromException(error, context);
			return;
		}
		
		console.log('✅ [DEBUG] Microphone check passed, calling audioRecorder.startRecording()...');
		await audioRecorder.startRecording();
		console.log('✅ [DEBUG] audioRecorder.startRecording() completed successfully');
		
	} catch (error) {
		console.error('❌ [DEBUG] Failed to start recording:', error);
		console.error('❌ [DEBUG] Error stack:', (error as Error).stack);
		// Сбрасываем состояние записи при любой ошибке
		RecordingStateManager.resetState();
		await errorHandler.handleErrorFromException(error as Error, context);
	}
}

function stopRecording(): void {
	try {
		console.log('⏹️ [DEBUG] stopRecording() called');
		
		// Сбрасываем режим записи через RecordingStateManager в любом случае
		const previousMode = RecordingStateManager.stopRecording();
		console.log(`⏹️ [DEBUG] Recording state reset, previous mode was: ${previousMode}`);
		
		// Обновляем StatusBar сразу при остановке
		if (statusBarManager) {
			statusBarManager.updateRecordingState(false);
		}
		
		if (!audioRecorder) {
			console.warn('⚠️ [DEBUG] Audio recorder not initialized, but state was reset');
			return;
		}
		
		console.log('⏹️ [DEBUG] Calling audioRecorder.stopRecording()...');
		audioRecorder.stopRecording();
		console.log('✅ [DEBUG] stopRecording completed');
		
	} catch (error) {
		console.error('❌ [DEBUG] Failed to stop recording:', error);
		// Убеждаемся что состояние сброшено даже при ошибке
		RecordingStateManager.resetState();
		// Обновляем StatusBar при ошибке
		if (statusBarManager) {
			statusBarManager.updateRecordingState(false);
		}
		vscode.window.showErrorMessage(`Failed to stop recording: ${(error as Error).message}`);
	}
}

/**
 * Обеспечение инициализации FFmpeg Audio Recorder
 */
async function ensureFFmpegAudioRecorder(): Promise<void> {
	console.log('🔧 [DEBUG] ensureFFmpegAudioRecorder() called');
	
	if (audioRecorder) {
		console.log('✅ [DEBUG] audioRecorder already initialized');
		return; // Уже инициализирован
	}

	console.log('🔧 [DEBUG] Initializing FFmpeg Audio Recorder...');
	
	try {
		// Проверяем доступность FFmpeg
		console.log('🔍 [DEBUG] Checking FFmpeg availability...');
		const ffmpegCheck = await FFmpegAudioRecorder.checkFFmpegAvailability();
		console.log('🔍 [DEBUG] FFmpeg check result:', JSON.stringify(ffmpegCheck, null, 2));
		
		if (!ffmpegCheck.available) {
			const errorMsg = `FFmpeg not available: ${ffmpegCheck.error || 'Unknown error'}`;
			console.error('❌ [DEBUG] FFmpeg check failed:', errorMsg);
			vscode.window.showErrorMessage(`❌ FFmpeg Error: ${errorMsg}`);
			throw new Error(errorMsg);
		}
		
		console.log('✅ [DEBUG] FFmpeg is available, version:', ffmpegCheck.version);
		
		// Получаем настройки аудио
		console.log('⚙️ [DEBUG] Reading audio configuration...');
		const config = vscode.workspace.getConfiguration('speechToTextWhisper');
		const audioQuality = config.get<string>('audioQuality', 'standard');
		console.log('⚙️ [DEBUG] Audio quality setting:', audioQuality);
		
		// Определяем параметры качества
		let sampleRate = 16000;
		let bitrate = '64k';
		
		switch (audioQuality) {
			case 'high':
				sampleRate = 44100;
				bitrate = '128k';
				break;
			case 'ultra':
				sampleRate = 48000;
				bitrate = '192k';
				break;
			default: // standard
				sampleRate = 16000;
				bitrate = '64k';
				break;
		}
		
		console.log(`⚙️ [DEBUG] Audio settings: ${audioQuality} quality, ${sampleRate}Hz sample rate`);
		
		// События для AudioRecorder - создаем здесь для правильной работы с StatusBar
		const audioRecorderEvents: AudioRecorderEvents = {
			onRecordingStart: () => {
				console.log('🎤 [DEBUG] AudioRecorder event: onRecordingStart');
				// Обновляем StatusBar
				if (statusBarManager) {
					statusBarManager.updateRecordingState(true);
				}
				vscode.window.showInformationMessage('🎤 Recording started...');
			},
			onRecordingStop: async (audioBlob: Blob) => {
				console.log('⏹️ [DEBUG] AudioRecorder event: onRecordingStop, blob size:', audioBlob.size);
				// Обновляем StatusBar
				if (statusBarManager) {
					statusBarManager.updateRecordingState(false);
				}
				
				// Обрабатываем транскрибацию
				await handleTranscription(audioBlob);
			},
			onError: (error: Error) => {
				console.error('❌ [DEBUG] AudioRecorder event: onError:', error);
				// Обновляем StatusBar
				if (statusBarManager) {
					statusBarManager.showError(`Recording error: ${error.message}`);
				}
				vscode.window.showErrorMessage(`Recording failed: ${error.message}`);
				// Сбрасываем состояние при ошибке
				RecordingStateManager.resetState();
			}
		};
		
		console.log('🔧 [DEBUG] Creating FFmpegAudioRecorder instance...');
		
		// Создаем экземпляр FFmpegAudioRecorder
		const recorderOptions = {
			sampleRate: sampleRate,
			channelCount: 1, // Моно для речи
			audioFormat: 'wav' as const,
			codec: 'pcm_s16le',
			maxDuration: config.get<number>('maxRecordingDuration', 60),
			ffmpegPath: config.get<string>('ffmpegPath', '') || undefined,
			silenceDetection: config.get<boolean>('silenceDetection', true),
			silenceDuration: config.get<number>('silenceDuration', 3),
			silenceThreshold: -(config.get<number>('silenceThreshold', 50)) // Применяем минус автоматически
		};
		
		console.log('🔧 [DEBUG] Recorder options:', JSON.stringify(recorderOptions, null, 2));
		
		audioRecorder = new FFmpegAudioRecorder(audioRecorderEvents, recorderOptions);
		
		console.log(`✅ [DEBUG] FFmpeg Audio Recorder initialized successfully (quality: ${audioQuality}, sample rate: ${sampleRate}Hz)`);
		vscode.window.showInformationMessage(`✅ FFmpeg Audio Recorder initialized (${audioQuality} quality)`);
		
	} catch (error) {
		console.error('❌ [DEBUG] Failed to initialize FFmpeg Audio Recorder:', error);
		audioRecorder = null; // Убеждаемся что он null при ошибке
		
		// Показываем подробную ошибку пользователю
		const errorMessage = `Failed to initialize audio recorder: ${(error as Error).message}`;
		vscode.window.showErrorMessage(errorMessage);
		
		throw error;
	}
}
