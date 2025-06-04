// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { FFmpegAudioRecorder, AudioRecorderEvents } from './core/FFmpegAudioRecorder';
import { WhisperClient } from './core/WhisperClient';
import { TextInserter } from './ui/TextInserter';
import { StatusBarManager, StatusBarEvents, StatusBarConfiguration } from './ui/StatusBarManager';
import { DiagnosticsProvider } from './ui/DiagnosticsProvider';
import { DeviceManagerProvider } from './ui/DeviceManagerProvider';
import { SettingsProvider } from './ui/SettingsProvider';
import { ModeSelectorProvider } from './ui/ModeSelectorProvider';
import { ErrorHandler, ErrorType, ErrorContext, VSCodeErrorDisplayHandler } from './utils/ErrorHandler';
import { RetryManager } from './utils/RetryManager';
import { CursorIntegration, CursorIntegrationStrategy } from './integrations/CursorIntegration';
import { ConfigurationManager } from './core/ConfigurationManager';
import { initializeGlobalOutput, ExtensionLog, disposeGlobalOutput } from './utils/GlobalOutput';

/**
 * Режимы записи для новой архитектуры команд
 */
enum RecordingMode {
	INSERT_OR_CLIPBOARD = 'insertOrClipboard',  // Ctrl+Shift+M - вставка в курсор или буфер обмена
	NEW_CHAT = 'newChat'                        // Ctrl+Shift+N - вставка в текущий чат Cursor
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

// Глобальный output канал для всего расширения
let outputChannel: vscode.OutputChannel;

// Система обработки ошибок
let errorHandler: ErrorHandler;
let retryManager: RetryManager;

// Менеджер конфигурации
let configurationManager: ConfigurationManager;

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
			ExtensionLog.warn('⚠️ Recording already in progress');
			return false;
		}

		// Устанавливаем состояние
		const now = Date.now();
		recordingState = {
			isRecording: true,
			mode: mode,
			startTime: now
		};

		ExtensionLog.info(`🎤 Recording started with mode: ${mode}`);
		return true;
	}

	/**
	 * Остановка записи
	 */
	static stopRecording(): RecordingMode | null {
		if (!recordingState.isRecording) {
			ExtensionLog.warn('⚠️ No recording in progress to stop');
			return null;
		}

		const mode = recordingState.mode;
		recordingState = {
			isRecording: false,
			mode: null,
			startTime: null
		};

		ExtensionLog.info(`⏹️ Recording stopped, mode was: ${mode}`);
		return mode;
	}

	/**
	 * Остановка записи с сохранением режима (для транскрибации)
	 */
	static stopRecordingKeepMode(): RecordingMode | null {
		if (!recordingState.isRecording) {
			ExtensionLog.warn('⚠️ No recording in progress to stop');
			return null;
		}

		const mode = recordingState.mode;
		recordingState.isRecording = false;
		// mode и startTime остаются для обработки транскрибации

		ExtensionLog.info(`⏹️ Recording stopped, mode preserved for transcription: ${mode}`);
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
		ExtensionLog.info('🔄 Recording state reset');
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

	/**
	 * Получение состояния записи
	 */
	static getState(): RecordingState {
		return recordingState;
	}
}

/**
 * Функция активации расширения
 * Вызывается при первом использовании команды расширения
 */
export function activate(context: vscode.ExtensionContext) {
	// Создаем output channel для логирования
	outputChannel = vscode.window.createOutputChannel('Speech to Text Whisper');
	outputChannel.appendLine('🚀 Extension activation started');
	outputChannel.show(); // Автоматически показываем в Output panel
	
	// Инициализируем глобальную систему логирования
	initializeGlobalOutput(outputChannel);
	ExtensionLog.info('SpeechToTextWhisper extension activation started! NEW VERSION 2024');
	ExtensionLog.info(`VS Code version: ${vscode.version}`);
	ExtensionLog.info(`Extension folder: ${context.extensionPath}`);
	
	// Сохраняем контекст для глобального использования
	extensionContext = context;

	try {
		// Инициализируем систему обработки ошибок
		initializeErrorHandling();
		
		// Инициализируем компоненты
		initializeComponents();
		
		// Регистрируем все команды
		registerCommands(context);
		
		// Инициализируем WhisperClient при первом использовании
		initializeWhisperClient();
		
		// Показываем приветственное сообщение и StatusBar
		showWelcomeMessage();
		
		// Добавляем слушатель изменений конфигурации
		configurationManager.addChangeListener((config) => {
			ExtensionLog.info('🔧 Configuration changed, reinitializing components...');
			
			// Переинициализируем WhisperClient при изменении настроек
			initializeWhisperClient();
			
			// Сбрасываем audioRecorder при изменении аудио настроек
			audioRecorder = null;
			
			// Обновляем видимость StatusBar
			if (config.ui.showStatusBar) {
				statusBarManager.show();
			} else {
				statusBarManager.hide();
			}
		});
		
		ExtensionLog.info('✅ SpeechToTextWhisper extension successfully activated');
		
	} catch (error) {
		const errorMessage = `Failed to activate SpeechToTextWhisper: ${(error as Error).message}`;
		ExtensionLog.error('❌ Activation error: ' + errorMessage);
		vscode.window.showErrorMessage(errorMessage);
	}
}

/**
 * Инициализация системы обработки ошибок
 */
function initializeErrorHandling(): void {
	ExtensionLog.info('🔧 Initializing error handling system...');
	
	// Создаем ErrorHandler с VS Code display handler
	errorHandler = new ErrorHandler(new VSCodeErrorDisplayHandler());
	
	// Создаем RetryManager
	retryManager = new RetryManager(errorHandler);
	
	ExtensionLog.info('✅ Error handling system initialized');
}

/**
 * Инициализация всех компонентов расширения
 */
function initializeComponents(): void {
	ExtensionLog.info('🔧 Initializing SpeechToTextWhisper components...');
	
	// Инициализируем ConfigurationManager
	configurationManager = ConfigurationManager.getInstance();
	ExtensionLog.info('✅ ConfigurationManager initialized');
	
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
			ExtensionLog.info('📊 Status bar clicked');
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
	
	ExtensionLog.info('✅ Components initialized');
}

/**
 * Регистрация команд расширения
 */
function registerCommands(context: vscode.ExtensionContext): void {
	ExtensionLog.info('📝 Registering commands...');
	
	const commands = [
		// Основные команды записи
		vscode.commands.registerCommand('speechToTextWhisper.recordAndInsertOrClipboard', recordAndInsertOrClipboard),
		vscode.commands.registerCommand('speechToTextWhisper.recordAndOpenNewChat', recordAndOpenNewChat),
		// Команда диагностики
		vscode.commands.registerCommand('speechToTextWhisper.runDiagnostics', () => diagnosticsProvider.runAllDiagnostics()),
		// Команда тестирования FFmpeg
		vscode.commands.registerCommand('speechToTextWhisper.testFFmpeg', async () => {
			try {
				ExtensionLog.info('🔍 Testing FFmpeg availability...');
				
				const ffmpegCheck = await FFmpegAudioRecorder.checkFFmpegAvailability();
				ExtensionLog.info(`🔍 FFmpeg check result: ${JSON.stringify(ffmpegCheck)}`);
				
				if (ffmpegCheck.available) {
					vscode.window.showInformationMessage(`✅ FFmpeg is available! Version: ${ffmpegCheck.version}`);
				} else {
					vscode.window.showErrorMessage(`❌ FFmpeg not available: ${ffmpegCheck.error}`);
				}
				
				// Пробуем диагностику
				const diagnostics = await FFmpegAudioRecorder.runDiagnostics();
				ExtensionLog.info(`🔍 FFmpeg diagnostics: ${JSON.stringify(diagnostics)}`);
				
				const deviceCount = diagnostics.inputDevices.length;
				const errorCount = diagnostics.errors.length;
				const warningCount = diagnostics.warnings.length;
				
				vscode.window.showInformationMessage(`FFmpeg Diagnostics: ${deviceCount} devices, ${errorCount} errors, ${warningCount} warnings`);
				
			} catch (error) {
				const errorMsg = `FFmpeg test failed: ${(error as Error).message}`;
				ExtensionLog.error('❌ FFmpeg test error: ' + errorMsg);
				vscode.window.showErrorMessage(errorMsg);
			}
		}),
		// Команда тестирования инициализации audioRecorder
		vscode.commands.registerCommand('speechToTextWhisper.testAudioRecorder', async () => {
			try {
				ExtensionLog.info('🔍 Testing audioRecorder initialization...');
				
				// Сбрасываем текущий audioRecorder
				audioRecorder = null;
				
				// Пробуем инициализировать
				await ensureFFmpegAudioRecorder();
				
				if (audioRecorder) {
					vscode.window.showInformationMessage('✅ Audio Recorder initialized successfully!');
					ExtensionLog.info('✅ Audio Recorder test passed');
				} else {
					vscode.window.showErrorMessage('❌ Audio Recorder is still null after initialization');
					ExtensionLog.error('❌ Audio Recorder test failed - still null');
				}
				
			} catch (error) {
				const errorMsg = `Audio Recorder test failed: ${(error as Error).message}`;
				ExtensionLog.error('❌ Audio Recorder test error: ' + errorMsg);
				vscode.window.showErrorMessage(errorMsg);
			}
		}),
		// Команды для управления устройствами
		vscode.commands.registerCommand('speechToTextWhisper.audioSettings.selectDevice', (deviceId: string) => deviceManagerProvider.selectDevice(deviceId)),
		// Команды для настроек
		vscode.commands.registerCommand('speechToTextWhisper.openSettings', () => settingsProvider.openSettings()),
		// Команды для переключения режима
		vscode.commands.registerCommand('speechToTextWhisper.toggleMode', () => modeSelectorProvider.toggleMode()),
		vscode.commands.registerCommand('speechToTextWhisper.setMode', (mode: string) => modeSelectorProvider.setMode(mode as 'insert' | 'clipboard'))
	];

	ExtensionLog.info(`📝 Created ${commands.length} command registrations`);

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
	
	ExtensionLog.info(`✅ Registered ${commands.length} commands and added to subscriptions`);
}

/**
 * Обработка транскрибации
 */
async function handleTranscription(audioBlob: Blob): Promise<void> {
	ExtensionLog.info('🎯 [TRANSCRIPTION] Processing transcription...');
	
	const context: ErrorContext = {
		operation: 'transcription',
		isHoldToRecordMode: false,
		timestamp: new Date(),
		additionalData: { audioBlobSize: audioBlob.size }
	};

	try {
		const recordingState = RecordingStateManager.getState();
		
		if (!recordingState.mode) {
			ExtensionLog.info('❌ [TRANSCRIPTION] No recording mode set, aborting');
			return;
		}

		if (!whisperClient) {
			ExtensionLog.error('❌ [TRANSCRIPTION] WhisperClient not initialized');
			throw new Error('WhisperClient not initialized');
		}

		// Получаем настройки из конфигурации
		const whisperConfig = configurationManager.getWhisperConfiguration();

		ExtensionLog.info('🎯 [TRANSCRIPTION] Starting transcription...');
		console.time('whisper.transcription');
		const transcriptionResult = await whisperClient.transcribe(audioBlob, {
			language: whisperConfig.language === 'auto' ? undefined : whisperConfig.language,
			prompt: whisperConfig.prompt || undefined,
			temperature: whisperConfig.temperature,
			model: whisperConfig.whisperModel,
			response_format: 'json'
		});
		console.timeEnd('whisper.transcription');
		
		ExtensionLog.info(`🎯 [TRANSCRIPTION] Transcription completed, length: ${transcriptionResult.length}`);

		if (transcriptionResult && transcriptionResult.trim().length > 0) {
			lastTranscribedText = transcriptionResult.trim();
			
			// Показываем состояние вставки
			statusBarManager.showInserting();
			
			if (recordingState.mode === RecordingMode.INSERT_OR_CLIPBOARD) {
				ExtensionLog.info('📝 Processing insertOrClipboard mode...');
				
				try {
					// Читаем режим вставки из ModeSelectorProvider
					const insertMode = modeSelectorProvider.getCurrentMode();
					
					if (insertMode === 'insert') {
						// Режим вставки в позицию курсора
						ExtensionLog.info('📝 Inserting into active editor at cursor position');
						await insertTranscribedTextWithErrorHandling(lastTranscribedText, 'cursor', context);
						
						// Показываем успех
						const truncatedText = lastTranscribedText.substring(0, 50) + (lastTranscribedText.length > 50 ? '...' : '');
						statusBarManager.showSuccess(`Inserted: "${truncatedText}"`);
						vscode.window.showInformationMessage(`✅ Transcribed and inserted at cursor: "${truncatedText}"`);
						
					} else if (insertMode === 'clipboard') {
						// Режим копирования в буфер обмена
						ExtensionLog.info('📋 [CLIPBOARD_MODE] Copying to clipboard');
						await vscode.env.clipboard.writeText(lastTranscribedText);
						
						// Показываем успех
						const truncatedText = lastTranscribedText.substring(0, 50) + (lastTranscribedText.length > 50 ? '...' : '');
						statusBarManager.showSuccess(`Copied: "${truncatedText}"`);
						vscode.window.showInformationMessage(`✅ Transcribed and copied to clipboard: "${truncatedText}"`);
					} else {
						ExtensionLog.error(`❌ Unknown insertMode: ${insertMode}`);
						vscode.window.showErrorMessage(`Unknown insert mode: ${insertMode}`);
					}
					
					// Сбрасываем режим
					RecordingStateManager.resetState();
					return;
					
				} catch (error) {
					ExtensionLog.error(`❌ Failed to process insertOrClipboard:`, error);
					vscode.window.showErrorMessage(`Failed to process text: ${(error as Error).message}`);
					RecordingStateManager.resetState();
					return;
				}
			} else if (recordingState.mode === RecordingMode.NEW_CHAT) {
				ExtensionLog.info('🎯 [CHAT] Starting NEW_CHAT mode processing');
				
				// Проверяем режим вставки - если clipboard, то не отправляем в чат
				const insertMode = modeSelectorProvider.getCurrentMode();
				
				if (insertMode === 'clipboard') {
					// Режим копирования в буфер обмена - игнорируем чат
					ExtensionLog.info('📋 [CLIPBOARD_MODE] F9/Ctrl+Shift+N in clipboard mode - copying to clipboard instead of chat');
					await vscode.env.clipboard.writeText(lastTranscribedText);
					
					// Показываем успех
					const truncatedText = lastTranscribedText.substring(0, 50) + (lastTranscribedText.length > 50 ? '...' : '');
					statusBarManager.showSuccess(`Copied: "${truncatedText}"`);
					vscode.window.showInformationMessage(`✅ Transcribed and copied to clipboard: "${truncatedText}"`);
					
					// Сбрасываем режим
					RecordingStateManager.resetState();
					return;
				}
				
				try {
					// Выполняем команду открытия нового чата
					ExtensionLog.info('🎯 [CHAT] Executing aichat.newfollowupaction...');
					await vscode.commands.executeCommand('aichat.newfollowupaction');
					
					// Задержка 300ms
					await new Promise(resolve => setTimeout(resolve, 300));
					
					// Вставляем текст в новый чат
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
					ExtensionLog.error(`❌ [CHAT] Failed to open new chat:`, error);
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
		ExtensionLog.error(`❌ Transcription failed:`, error);
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
		ExtensionLog.info(`📝 Inserting text with mode: ${mode}`);
		
		// Используем retry для вставки текста
		const insertResult = await retryManager.retry(
			() => textInserter.insertText(text, { mode: mode as 'cursor' | 'clipboard' }),
			'text_insertion'
		);

		if (!insertResult.success) {
			const error = insertResult.lastError || new Error('Text insertion failed after retries');
			await errorHandler.handleErrorFromException(error, context);
		} else {
			ExtensionLog.info(`✅ Text insertion successful with mode: ${mode}`);
		}
		
	} catch (error) {
		ExtensionLog.error(`❌ Text insertion failed:`, error);
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
		ExtensionLog.info(`📝 Inserting last transcription with mode: ${mode}`);
		
		if (mode === 'currentChat') {
			// Отправляем в Cursor чат
			if (!cursorIntegration || !cursorIntegration.isIntegrationEnabled()) {
				throw new Error('Cursor integration not available');
			}
			
			await cursorIntegration.sendToChat(lastTranscribedText);
			ExtensionLog.info('✅ Text sent to Cursor chat');
			
		} else if (mode === 'newChat') {
			// Отправляем в новый чат через CursorIntegration
			await cursorIntegration.sendToChat(lastTranscribedText);
			ExtensionLog.info('✅ Text sent to new chat');
			
		} else {
			// Вставляем в редактор
			await insertTranscribedTextWithErrorHandling(lastTranscribedText, mode, context);
		}
		
	} catch (error) {
		ExtensionLog.error(`❌ Failed to insert last transcription (mode: ${mode}):`, error);
		await errorHandler.handleErrorFromException(error as Error, context);
	}
}

/**
 * Инициализация WhisperClient
 */
function initializeWhisperClient(): void {
	ExtensionLog.info('🔧 Initializing WhisperClient...');
	
	const whisperConfig = configurationManager.getWhisperConfiguration();
	
	if (!whisperConfig.apiKey) {
		ExtensionLog.warn('⚠️ OpenAI API key not configured');
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
			apiKey: whisperConfig.apiKey,
			timeout: whisperConfig.timeout
		});
		
		ExtensionLog.info('✅ WhisperClient initialized');
		
	} catch (error) {
		ExtensionLog.error('❌ Failed to initialize WhisperClient: ' + error);
		vscode.window.showErrorMessage(`Failed to initialize Whisper client: ${(error as Error).message}`);
	}
}

function showWelcomeMessage(): void {
	// Принудительно показываем StatusBar
	statusBarManager.show();
	
	const uiConfig = configurationManager.getUIConfiguration();
	
	if (!uiConfig.showStatusBar) {
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
	ExtensionLog.info('Extension deactivating...');
	
	// Останавливаем запись если активна
	if (audioRecorder && audioRecorder.getIsRecording()) {
		audioRecorder.stopRecording();
	}

	// Очищаем ресурсы
	if (statusBarManager) {
		statusBarManager.dispose();
	}
	
	if (configurationManager) {
		configurationManager.dispose();
	}
	
	if (cursorIntegration) {
		cursorIntegration.dispose();
	}
	
	// Освобождаем ресурсы глобального логирования
	disposeGlobalOutput();
	
	ExtensionLog.info('Extension deactivated');
}

/**
 * Инициализация интеграции с Cursor
 */
function initializeCursorIntegration(): void {
	ExtensionLog.info('🔧 Initializing Cursor integration...');
	
	// Используем стратегию по умолчанию
	const primaryStrategy = CursorIntegrationStrategy.AICHAT_COMMAND;
	
	ExtensionLog.info(`🎯 Using Cursor integration strategy: ${primaryStrategy}`);
	
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
			ExtensionLog.info(`✅ Text sent to chat via ${strategy}: "${text.substring(0, 50)}..."`);
		},
		onFallbackUsed: (primary: CursorIntegrationStrategy, fallback: CursorIntegrationStrategy) => {
			ExtensionLog.info(`🔄 Fallback used: ${primary} -> ${fallback}`);
			vscode.window.showWarningMessage(`Cursor chat: fell back to ${fallback} strategy`);
		},
		onError: (error: Error, strategy: CursorIntegrationStrategy) => {
			ExtensionLog.error(`❌ CursorIntegration error with ${strategy}:`, error);
		}
	});
	
	ExtensionLog.info(`✅ CursorIntegration initialized, enabled: ${cursorIntegration.isIntegrationEnabled()}`);
}

/**
 * Команда записи с вставкой в курсор или буфер обмена (Ctrl+Shift+M)
 */
async function recordAndInsertOrClipboard(): Promise<void> {
	ExtensionLog.info('🎤 recordAndInsertOrClipboard called!');
	
	const context: ErrorContext = {
		operation: 'record_and_insert_or_clipboard',
		isHoldToRecordMode: false,
		timestamp: new Date()
	};

	try {
		// Проверяем, идет ли уже запись
		if (RecordingStateManager.isRecording()) {
			// Останавливаем запись
			ExtensionLog.info('⏹️ Stopping recording (recordAndInsertOrClipboard)');
			stopRecording();
			return;
		}

		// Проверяем минимальный интервал между попытками
		const now = Date.now();
		if (now - lastRecordingStartTime < MIN_RECORDING_INTERVAL) {
			ExtensionLog.info('⚠️ Too frequent recording attempts, skipping');
			vscode.window.showWarningMessage('Too frequent recording attempts. Please wait a moment.');
			return;
		}

		ExtensionLog.info('🎤 Starting record and insert or clipboard...');
		
		// Начинаем запись с режимом INSERT_OR_CLIPBOARD
		if (RecordingStateManager.startRecording(RecordingMode.INSERT_OR_CLIPBOARD)) {
			// Обновляем StatusBar сразу при начале попытки записи
			if (statusBarManager) {
				statusBarManager.updateRecordingState(true);
			}
			
			// Устанавливаем время попытки записи
			lastRecordingStartTime = now;
			
			await startRecording();
		} else {
			vscode.window.showWarningMessage('Recording already in progress or too frequent attempts');
		}
		
	} catch (error) {
		ExtensionLog.error('❌ Record and insert or clipboard failed:', error);
		RecordingStateManager.resetState();
		// Сбрасываем StatusBar при ошибке
		if (statusBarManager) {
			statusBarManager.updateRecordingState(false);
		}
		await errorHandler.handleErrorFromException(error as Error, context);
	}
}

/**
 * Команда записи в текущий чат Cursor(Ctrl+Shift+N)
 */
async function recordAndOpenNewChat(): Promise<void> {
	ExtensionLog.info('🎤 [COMMAND] recordAndOpenNewChat called!');
	
	const context: ErrorContext = {
		operation: 'record_and_open_new_chat',
		isHoldToRecordMode: false,
		timestamp: new Date()
	};

	try {
		// Проверяем, идет ли уже запись
		if (RecordingStateManager.isRecording()) {
			ExtensionLog.info('⏹️ [COMMAND] Stopping recording (recordAndOpenNewChat)');
			stopRecording();
			return;
		}

		// Проверяем минимальный интервал между попытками
		const now = Date.now();
		if (now - lastRecordingStartTime < MIN_RECORDING_INTERVAL) {
			ExtensionLog.info('⚠️ [COMMAND] Too frequent recording attempts, skipping');
			vscode.window.showWarningMessage('Too frequent recording attempts. Please wait a moment.');
			return;
		}

		ExtensionLog.info('🎤 [COMMAND] Starting record and open new chat...');
		
		// Начинаем запись с режимом NEW_CHAT
		if (RecordingStateManager.startRecording(RecordingMode.NEW_CHAT)) {
			// Обновляем StatusBar
			if (statusBarManager) {
				statusBarManager.updateRecordingState(true);
			}
			
			// Устанавливаем время попытки записи
			lastRecordingStartTime = now;
			
			await startRecording();
			
		} else {
			ExtensionLog.info('❌ [COMMAND] Failed to start recording state');
			vscode.window.showWarningMessage('Recording already in progress or too frequent attempts');
		}
		
	} catch (error) {
		ExtensionLog.error('❌ [COMMAND] recordAndOpenNewChat failed:', error);
		
		// Сбрасываем состояние при ошибке
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
	ExtensionLog.info('▶️ [RECORDING] Starting recording process...');
	
	const context: ErrorContext = {
		operation: 'start_recording',
		isHoldToRecordMode: false,
		timestamp: new Date()
	};

	try {
		// Обеспечиваем инициализацию FFmpeg Audio Recorder
		console.time('ensureFFmpegAudioRecorder');
		await ensureFFmpegAudioRecorder();
		console.timeEnd('ensureFFmpegAudioRecorder');
		
		// Проверяем, что audioRecorder инициализирован
		if (!audioRecorder) {
			ExtensionLog.error('❌ [RECORDING] audioRecorder is null after initialization');
			RecordingStateManager.resetState();
			vscode.window.showErrorMessage('❌ Failed to initialize audio recorder');
			return;
		}
		
		// Проверяем, не идет ли уже запись
		if (audioRecorder.getIsRecording()) {
			ExtensionLog.info('⚠️ [RECORDING] Recording already in progress, skipping');
			return;
		}
		
		// Проверяем состояние микрофона с retry
		console.time('microphone.permission.check');
		
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
		console.timeEnd('microphone.permission.check');

		if (!microphoneResult.success) {
			const error = microphoneResult.lastError || new Error('Microphone access failed');
			ExtensionLog.error('❌ [RECORDING] Microphone check failed:', error);
			RecordingStateManager.resetState();
			await errorHandler.handleErrorFromException(error, context);
			return;
		}
		
		ExtensionLog.info('✅ [RECORDING] Starting audio recording...');
		console.time('audioRecorder.startRecording');
		await audioRecorder.startRecording();
		console.timeEnd('audioRecorder.startRecording');
		ExtensionLog.info('✅ [RECORDING] Recording started successfully');
		
	} catch (error) {
		ExtensionLog.error('❌ [RECORDING] Failed to start recording:', error);
		
		// Сбрасываем состояние записи при любой ошибке
		RecordingStateManager.resetState();
		
		await errorHandler.handleErrorFromException(error as Error, context);
	}
}

function stopRecording(): void {
	try {
		ExtensionLog.info('⏹️ [RECORDING] Stopping recording...');
		
		// Останавливаем запись но сохраняем режим для транскрибации
		const previousMode = RecordingStateManager.stopRecordingKeepMode();
		
		// Обновляем StatusBar
		if (statusBarManager) {
			statusBarManager.updateRecordingState(false);
		}
		
		if (!audioRecorder) {
			ExtensionLog.warn('⚠️ [RECORDING] Audio recorder not initialized, but mode was preserved');
			return;
		}
		
		console.time('audioRecorder.stopRecording');
		audioRecorder.stopRecording();
		console.timeEnd('audioRecorder.stopRecording');
		ExtensionLog.info('✅ [RECORDING] Recording stopped successfully');
		
	} catch (error) {
		ExtensionLog.error('❌ [RECORDING] Failed to stop recording:', error);
		// Сбрасываем состояние только при ошибке
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
	if (audioRecorder) {
		return; // Уже инициализирован
	}

	ExtensionLog.info('🔧 Initializing FFmpeg Audio Recorder...');
	
	try {
		// Проверяем доступность FFmpeg
		const ffmpegCheck = await FFmpegAudioRecorder.checkFFmpegAvailability();
		
		if (!ffmpegCheck.available) {
			const errorMsg = `FFmpeg not available: ${ffmpegCheck.error || 'Unknown error'}`;
			ExtensionLog.error('❌ FFmpeg check failed:', errorMsg);
			vscode.window.showErrorMessage(`❌ FFmpeg Error: ${errorMsg}`);
			throw new Error(errorMsg);
		}
		
		ExtensionLog.info('✅ FFmpeg is available, version:', ffmpegCheck.version);
		
		// Получаем настройки аудио
		const audioConfig = configurationManager.getAudioConfiguration();
		
		// Определяем параметры качества
		let sampleRate = 16000;
		let bitrate = '64k';
		
		switch (audioConfig.audioQuality) {
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
		
		ExtensionLog.info(`⚙️ Audio settings: ${audioConfig.audioQuality} quality, ${sampleRate}Hz sample rate`);
		
		// События для AudioRecorder
		const audioRecorderEvents: AudioRecorderEvents = {
			onRecordingStart: () => {
				ExtensionLog.info('🎤 AudioRecorder event: onRecordingStart');
				if (statusBarManager) {
					statusBarManager.updateRecordingState(true);
				}
			},
			onRecordingStop: async (audioBlob: Blob) => {
				ExtensionLog.info('⏹️ AudioRecorder event: onRecordingStop, blob size:', audioBlob.size);
				
				// Обновляем StatusBar
				if (statusBarManager) {
					statusBarManager.updateRecordingState(false);
				}
				
				try {
					await handleTranscription(audioBlob);
					ExtensionLog.info('⏹️ AudioRecorder event: handleTranscription completed successfully');
				} catch (error) {
					ExtensionLog.error('❌ AudioRecorder event: Error in handleTranscription:', error);
					vscode.window.showErrorMessage(`Transcription failed: ${(error as Error).message}`);
					RecordingStateManager.resetState();
				}
			},
			onError: (error: Error) => {
				ExtensionLog.error('❌ AudioRecorder event: onError:', error);
				if (statusBarManager) {
					statusBarManager.showError(`Recording error: ${error.message}`);
				}
				vscode.window.showErrorMessage(`Recording failed: ${error.message}`);
				RecordingStateManager.resetState();
			}
		};
		
		const recorderOptions = {
			sampleRate: sampleRate,
			channelCount: 1, // Моно для речи
			audioFormat: 'wav' as const,
			codec: 'pcm_s16le',
			maxDuration: audioConfig.maxRecordingDuration,
			ffmpegPath: audioConfig.ffmpegPath || undefined,
			silenceDetection: audioConfig.silenceDetection,
			silenceDuration: audioConfig.silenceDuration,
			silenceThreshold: -(audioConfig.silenceThreshold) // Применяем минус автоматически
		};
		
		// Создаем новый экземпляр аудио рекордера
		audioRecorder = new FFmpegAudioRecorder(audioRecorderEvents, recorderOptions, outputChannel);
		ExtensionLog.info('✅ FFmpegAudioRecorder instance created successfully');
		
	} catch (error) {
		ExtensionLog.error('❌ Failed to initialize FFmpeg Audio Recorder:', error);
		audioRecorder = null;
		
		const errorMessage = `Failed to initialize audio recorder: ${(error as Error).message}`;
		vscode.window.showErrorMessage(errorMessage);
		
		throw error;
	}
}