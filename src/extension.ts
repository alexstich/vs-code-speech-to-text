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
import { ConfigurationManager } from './core/ConfigurationManager';
import { initializeGlobalOutput, ExtensionLog, disposeGlobalOutput } from './utils/GlobalOutput';

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
	 * Остановка записи с сохранением режима (для транскрибации)
	 */
	static stopRecordingKeepMode(): RecordingMode | null {
		if (!recordingState.isRecording) {
			console.warn('⚠️ No recording in progress to stop');
			return null;
		}

		const mode = recordingState.mode;
		recordingState.isRecording = false;
		// mode и startTime остаются для обработки транскрибации

		console.log(`⏹️ Recording stopped, mode preserved for transcription: ${mode}`);
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
	
	// Также попробуем window.showInformationMessage для проверки
	vscode.window.showInformationMessage('🎤 SpeechToTextWhisper extension is activating...');
	
	console.log('🎤 SpeechToTextWhisper extension activation started! NEW VERSION 2024');
	vscode.window.showInformationMessage('🎤 SpeechToTextWhisper extension is activating...');
	
	// Сохраняем контекст для глобального использования
	extensionContext = context;

	try {
		// Инициализируем систему обработки ошибок
		console.log('🎤 Initializing error handling...');
		initializeErrorHandling();
		
		// Инициализируем компоненты
		console.log('🎤 Initializing components...');
		initializeComponents();
		
		// Регистрируем все команды
		console.log('🎤 Registering commands...');
		registerCommands(context);
		
		// Инициализируем WhisperClient при первом использовании
		console.log('🎤 Initializing Whisper client...');
		initializeWhisperClient();
		
		// Показываем приветственное сообщение и StatusBar
		console.log('🎤 Showing welcome message...');
		showWelcomeMessage();
		
		// Добавляем слушатель изменений конфигурации
		console.log('🎤 Setting up configuration change listener...');
		configurationManager.addChangeListener((config) => {
			console.log('🔧 Configuration changed, reinitializing components...');
			
			// Переинициализируем WhisperClient при изменении настроек
			console.log('🔄 Reinitializing WhisperClient due to configuration change...');
			initializeWhisperClient();
			
			// Сбрасываем audioRecorder при изменении аудио настроек
			console.log('🔄 Resetting audioRecorder due to configuration change...');
			audioRecorder = null;
			
			// Обновляем видимость StatusBar
			if (config.ui.showStatusBar) {
				statusBarManager.show();
			} else {
				statusBarManager.hide();
			}
		});
		
		console.log('✅ SpeechToTextWhisper extension successfully activated');
		vscode.window.showInformationMessage('✅ SpeechToTextWhisper extension successfully activated!');
		
	} catch (error) {
		const errorMessage = `Failed to activate SpeechToTextWhisper: ${(error as Error).message}`;
		console.error('❌ Activation error:', errorMessage);
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
	
	// Инициализируем ConfigurationManager
	configurationManager = ConfigurationManager.getInstance();
	console.log('✅ ConfigurationManager initialized');
	
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
	console.log('📝 Registering commands...');
	
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
				console.log('🔍 Testing FFmpeg availability...');
				vscode.window.showInformationMessage('🔍 Testing FFmpeg...');
				
				const ffmpegCheck = await FFmpegAudioRecorder.checkFFmpegAvailability();
				console.log('🔍 FFmpeg check result:', ffmpegCheck);
				
				if (ffmpegCheck.available) {
					vscode.window.showInformationMessage(`✅ FFmpeg is available! Version: ${ffmpegCheck.version}`);
				} else {
					vscode.window.showErrorMessage(`❌ FFmpeg not available: ${ffmpegCheck.error}`);
				}
				
				// Пробуем диагностику
				const diagnostics = await FFmpegAudioRecorder.runDiagnostics();
				console.log('🔍 FFmpeg diagnostics:', diagnostics);
				
				const deviceCount = diagnostics.inputDevices.length;
				const errorCount = diagnostics.errors.length;
				const warningCount = diagnostics.warnings.length;
				
				vscode.window.showInformationMessage(`FFmpeg Diagnostics: ${deviceCount} devices, ${errorCount} errors, ${warningCount} warnings`);
				
			} catch (error) {
				const errorMsg = `FFmpeg test failed: ${(error as Error).message}`;
				console.error('❌ FFmpeg test error:', errorMsg);
				vscode.window.showErrorMessage(errorMsg);
			}
		}),
		// Команда тестирования инициализации audioRecorder
		vscode.commands.registerCommand('speechToTextWhisper.testAudioRecorder', async () => {
			try {
				console.log('🔍 Testing audioRecorder initialization...');
				vscode.window.showInformationMessage('🔍 Testing Audio Recorder...');
				
				// Сбрасываем текущий audioRecorder
				audioRecorder = null;
				
				// Пробуем инициализировать
				await ensureFFmpegAudioRecorder();
				
				if (audioRecorder) {
					vscode.window.showInformationMessage('✅ Audio Recorder initialized successfully!');
					console.log('✅ Audio Recorder test passed');
				} else {
					vscode.window.showErrorMessage('❌ Audio Recorder is still null after initialization');
					console.error('❌ Audio Recorder test failed - still null');
				}
				
			} catch (error) {
				const errorMsg = `Audio Recorder test failed: ${(error as Error).message}`;
				console.error('❌ Audio Recorder test error:', errorMsg);
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

	console.log(`📝 Created ${commands.length} command registrations`);

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
	
	console.log(`✅ Registered ${commands.length} commands and added to subscriptions`);
}

/**
 * Обработка транскрибации
 */
async function handleTranscription(audioBlob: Blob): Promise<void> {
	console.log('🎯 [TRANSCRIPTION] handleTranscription called');
	console.log('🎯 [TRANSCRIPTION] Audio blob size:', audioBlob.size);
	console.log('🎯 [TRANSCRIPTION] Audio blob type:', audioBlob.type);
	console.log('🎯 [TRANSCRIPTION] Current recording state:', RecordingStateManager.isRecording());
	console.log('🎯 [TRANSCRIPTION] Current mode:', RecordingStateManager.getCurrentMode());
	
	const context: ErrorContext = {
		operation: 'transcription',
		isHoldToRecordMode: false,
		timestamp: new Date(),
		additionalData: { audioBlobSize: audioBlob.size }
	};

	try {
		console.log('🎯 [TRANSCRIPTION] Step 1: Getting recording state...');
		const recordingState = RecordingStateManager.getState();
		console.log('🎯 [TRANSCRIPTION] Recording state:', JSON.stringify(recordingState, null, 2));
		
		if (!recordingState.mode) {
			console.log('❌ [TRANSCRIPTION] No recording mode set, aborting');
			return;
		}

		console.log('🎯 [TRANSCRIPTION] Step 2: Checking WhisperClient...');
		if (!whisperClient) {
			console.error('❌ [TRANSCRIPTION] WhisperClient not initialized');
			throw new Error('WhisperClient not initialized');
		}
		console.log('🎯 [TRANSCRIPTION] WhisperClient is available');

		// Получаем настройки из конфигурации VS Code через ConfigurationManager
		console.log('🎯 [TRANSCRIPTION] Step 2.5: Getting configuration settings...');
		const whisperConfig = configurationManager.getWhisperConfiguration();
		
		console.log('🎯 [TRANSCRIPTION] Configuration settings:', {
			language: whisperConfig.language,
			prompt: whisperConfig.prompt ? `"${whisperConfig.prompt.substring(0, 50)}..."` : '(empty)',
			temperature: whisperConfig.temperature,
			whisperModel: whisperConfig.whisperModel
		});

		console.log('🎯 [TRANSCRIPTION] Step 3: Starting transcription...');
		console.time('whisper.transcription');
		const transcriptionResult = await whisperClient.transcribe(audioBlob, {
			language: whisperConfig.language === 'auto' ? undefined : whisperConfig.language,
			prompt: whisperConfig.prompt || undefined,
			temperature: whisperConfig.temperature,
			model: whisperConfig.whisperModel,
			response_format: 'json'
		});
		console.timeEnd('whisper.transcription');
		console.log('🎯 [TRANSCRIPTION] Step 3: Transcription completed');
		console.log('🎯 [TRANSCRIPTION] Transcription result length:', transcriptionResult.length);
		console.log('🎯 [TRANSCRIPTION] Transcription preview:', transcriptionResult.substring(0, 100) + (transcriptionResult.length > 100 ? '...' : ''));

		if (transcriptionResult && transcriptionResult.trim().length > 0) {
			console.log('🎯 [TRANSCRIPTION] Step 4: Processing non-empty transcription...');
			lastTranscribedText = transcriptionResult.trim();
			console.log('🎯 [TRANSCRIPTION] lastTranscribedText set, length:', lastTranscribedText.length);
			
			// Сохраняем последнюю транскрибацию
			lastTranscribedText = transcriptionResult.trim();
			
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
				console.log('🎯 [CHAT] Starting CURRENT_CHAT mode processing');
				console.log('🎯 [CHAT] Transcribed text length:', lastTranscribedText.length);
				console.log('🎯 [CHAT] Transcribed text preview:', lastTranscribedText.substring(0, 100) + (lastTranscribedText.length > 100 ? '...' : ''));
				
				try {
					// Последовательность команд для текущего чата
					console.log('🎯 [CHAT] Step 1: Executing aichat.insertselectionintochat...');
					console.time('aichat.insertselectionintochat');
					await vscode.commands.executeCommand('aichat.insertselectionintochat');
					console.timeEnd('aichat.insertselectionintochat');
					console.log('🎯 [CHAT] Step 1: aichat.insertselectionintochat completed successfully');
					
					// Задержка 200ms
					console.log('🎯 [CHAT] Step 2: Waiting 200ms...');
					await new Promise(resolve => setTimeout(resolve, 200));
					console.log('🎯 [CHAT] Step 2: Wait completed');
					
					console.log('🎯 [CHAT] Step 3: Executing chat.action.focus...');
					console.time('chat.action.focus');
					await vscode.commands.executeCommand('chat.action.focus');
					console.timeEnd('chat.action.focus');
					console.log('🎯 [CHAT] Step 3: chat.action.focus completed successfully');
					
					// Задержка 200ms
					console.log('🎯 [CHAT] Step 4: Waiting 200ms...');
					await new Promise(resolve => setTimeout(resolve, 200));
					console.log('🎯 [CHAT] Step 4: Wait completed');
					
					// Вставляем текст в чат
					console.log('🎯 [CHAT] Step 5: Copying text to clipboard...');
					console.time('clipboard.writeText');
					await vscode.env.clipboard.writeText(lastTranscribedText);
					console.timeEnd('clipboard.writeText');
					console.log('🎯 [CHAT] Step 5: Text copied to clipboard successfully');
					
					console.log('🎯 [CHAT] Step 6: Executing paste action...');
					console.time('editor.action.clipboardPasteAction');
					await vscode.commands.executeCommand('editor.action.clipboardPasteAction');
					console.timeEnd('editor.action.clipboardPasteAction');
					console.log('🎯 [CHAT] Step 6: Paste action completed successfully');
					
					// Показываем успех
					const truncatedText = lastTranscribedText.substring(0, 50) + (lastTranscribedText.length > 50 ? '...' : '');
					console.log('🎯 [CHAT] Step 7: Showing success messages...');
					statusBarManager.showSuccess(`Sent to chat: "${truncatedText}"`);
					vscode.window.showInformationMessage(`✅ Transcribed and sent to chat: "${truncatedText}"`);
					console.log('🎯 [CHAT] Step 7: Success messages shown');
					
					// Сбрасываем режим
					console.log('🎯 [CHAT] Step 8: Resetting recording state...');
					RecordingStateManager.resetState();
					console.log('🎯 [CHAT] Step 8: Recording state reset');
					console.log('🎯 [CHAT] CURRENT_CHAT mode processing completed successfully');
					return;
					
				} catch (error) {
					console.error('❌ [CHAT] Failed to send to chat:', error);
					console.error('❌ [CHAT] Error details:', {
						name: (error as Error).name,
						message: (error as Error).message,
						stack: (error as Error).stack
					});
					vscode.window.showErrorMessage(`Failed to send to chat: ${(error as Error).message}`);
					RecordingStateManager.resetState();
					return;
				}
			} else if (recordingState.mode === RecordingMode.NEW_CHAT) {
				console.log('🎯 [CHAT] Starting NEW_CHAT mode processing');
				console.log('🎯 [CHAT] Transcribed text length:', lastTranscribedText.length);
				console.log('🎯 [CHAT] Transcribed text preview:', lastTranscribedText.substring(0, 100) + (lastTranscribedText.length > 100 ? '...' : ''));
				
				try {
					// Выполняем команду открытия нового чата
					console.log('🎯 [CHAT] Step 1: Executing aichat.newfollowupaction...');
					console.time('aichat.newfollowupaction');
					await vscode.commands.executeCommand('aichat.newfollowupaction');
					console.timeEnd('aichat.newfollowupaction');
					console.log('🎯 [CHAT] Step 1: aichat.newfollowupaction completed successfully');
					
					// Задержка 300ms
					console.log('🎯 [CHAT] Step 2: Waiting 300ms...');
					await new Promise(resolve => setTimeout(resolve, 300));
					console.log('🎯 [CHAT] Step 2: Wait completed');
					
					// Вставляем текст в новый чат
					console.log('🎯 [CHAT] Step 3: Copying text to clipboard...');
					console.time('clipboard.writeText');
					await vscode.env.clipboard.writeText(lastTranscribedText);
					console.timeEnd('clipboard.writeText');
					console.log('🎯 [CHAT] Step 3: Text copied to clipboard successfully');
					
					console.log('🎯 [CHAT] Step 4: Executing paste action...');
					console.time('editor.action.clipboardPasteAction');
					await vscode.commands.executeCommand('editor.action.clipboardPasteAction');
					console.timeEnd('editor.action.clipboardPasteAction');
					console.log('🎯 [CHAT] Step 4: Paste action completed successfully');
					
					// Показываем успех
					const truncatedText = lastTranscribedText.substring(0, 50) + (lastTranscribedText.length > 50 ? '...' : '');
					console.log('🎯 [CHAT] Step 5: Showing success messages...');
					statusBarManager.showSuccess(`Opened new chat: "${truncatedText}"`);
					vscode.window.showInformationMessage(`✅ Transcribed and opened new chat: "${truncatedText}"`);
					console.log('🎯 [CHAT] Step 5: Success messages shown');
					
					// Сбрасываем режим
					console.log('🎯 [CHAT] Step 6: Resetting recording state...');
					RecordingStateManager.resetState();
					console.log('🎯 [CHAT] Step 6: Recording state reset');
					console.log('🎯 [CHAT] NEW_CHAT mode processing completed successfully');
					return;
					
				} catch (error) {
					console.error('❌ [CHAT] Failed to open new chat:', error);
					console.error('❌ [CHAT] Error details:', {
						name: (error as Error).name,
						message: (error as Error).message,
						stack: (error as Error).stack
					});
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
	
	const whisperConfig = configurationManager.getWhisperConfiguration();
	
	if (!whisperConfig.apiKey) {
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
			apiKey: whisperConfig.apiKey,
			timeout: whisperConfig.timeout
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
	console.log('🎤 recordAndInsertOrClipboard called! UNIQUE COMMAND MESSAGE 67890');
	console.log('🎤 recordAndInsertOrClipboard called! MODIFIED MESSAGE 99999');
	
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
			console.log('⚠️ Too frequent recording attempts in command, skipping');
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
	console.log('🎤 [COMMAND] recordAndInsertToCurrentChat called!');
	console.log('🎤 [COMMAND] Current recording state:', RecordingStateManager.isRecording());
	console.log('🎤 [COMMAND] Current mode:', RecordingStateManager.getCurrentMode());
	
	const context: ErrorContext = {
		operation: 'record_and_insert_to_current_chat',
		isHoldToRecordMode: false,
		timestamp: new Date()
	};

	try {
		// Проверяем, идет ли уже запись
		if (RecordingStateManager.isRecording()) {
			// Останавливаем запись
			console.log('⏹️ [COMMAND] Stopping recording (recordAndInsertToCurrentChat)');
			stopRecording();
			return;
		}

		// Проверяем минимальный интервал между попытками ЗДЕСЬ
		const now = Date.now();
		console.log('🎤 [COMMAND] Checking recording interval, now:', now, 'last:', lastRecordingStartTime);
		if (now - lastRecordingStartTime < MIN_RECORDING_INTERVAL) {
			console.log('⚠️ [COMMAND] Too frequent recording attempts in command, skipping');
			vscode.window.showWarningMessage('Too frequent recording attempts. Please wait a moment.');
			return;
		}

		console.log('🎤 [COMMAND] Starting record and insert to current chat...');
		
		// Начинаем запись с режимом CURRENT_CHAT
		console.log('🎤 [COMMAND] Attempting to start recording with CURRENT_CHAT mode');
		if (RecordingStateManager.startRecording(RecordingMode.CURRENT_CHAT)) {
			console.log('🎤 [COMMAND] Recording state started successfully');
			
			// Обновляем StatusBar сразу при начале попытки записи
			if (statusBarManager) {
				console.log('🎤 [COMMAND] Updating status bar to recording state');
				statusBarManager.updateRecordingState(true);
			}
			
			// Устанавливаем время попытки записи
			lastRecordingStartTime = now;
			console.log('🎤 [COMMAND] Set lastRecordingStartTime to:', lastRecordingStartTime);
			
			console.log('🎤 [COMMAND] Calling startRecording()...');
			await startRecording();
			console.log('🎤 [COMMAND] startRecording() completed');
			vscode.window.showInformationMessage('🎤 Recording... Press Ctrl+Shift+N again to stop and send to chat');
		} else {
			console.log('❌ [COMMAND] Failed to start recording state');
			vscode.window.showWarningMessage('Recording already in progress or too frequent attempts');
		}
		
	} catch (error) {
		console.error('❌ [COMMAND] recordAndInsertToCurrentChat failed:', error);
		console.error('❌ [COMMAND] Error details:', {
			name: (error as Error).name,
			message: (error as Error).message,
			stack: (error as Error).stack
		});
		await errorHandler.handleErrorFromException(error as Error, context);
	}
}

/**
 * Команда записи с открытием нового чата (F9)
 */
async function recordAndOpenNewChat(): Promise<void> {
	// САМОЕ РАННЕЕ логирование для диагностики
	console.log('🔥 === F9 COMMAND CALLED! ===');
	console.log('🔥 Time:', new Date().toISOString());
	console.log('🔥 console.log working:', true);
	
	// Также попробуем window.showInformationMessage
	vscode.window.showInformationMessage('🔥 F9 COMMAND EXECUTED!');
	
	// Используем глобальный output channel
	outputChannel.appendLine('🔥 === F9 COMMAND CALLED! ===');
	outputChannel.appendLine('🔥 Time: ' + new Date().toISOString());
	outputChannel.show();
	
	try {
		console.log('🎤 [COMMAND] recordAndOpenNewChat called!');
		outputChannel.appendLine('🎤 [COMMAND] recordAndOpenNewChat called!');
		
		console.log('🎤 [COMMAND] Step 1: Getting current recording state...');
		outputChannel.appendLine('🎤 [COMMAND] Step 1: Getting current recording state...');
		
		const isCurrentlyRecording = RecordingStateManager.isRecording();
		const currentMode = RecordingStateManager.getCurrentMode();
		
		console.log('🎤 [COMMAND] Current recording state:', isCurrentlyRecording);
		console.log('🎤 [COMMAND] Current mode:', currentMode);
		outputChannel.appendLine('🎤 [COMMAND] Current recording state: ' + isCurrentlyRecording);
		outputChannel.appendLine('🎤 [COMMAND] Current mode: ' + currentMode);
		
	} catch (error) {
		console.error('❌ [COMMAND] Error in step 1:', error);
		outputChannel.appendLine('❌ [COMMAND] Error in step 1: ' + error);
		return;
	}
	
	const context: ErrorContext = {
		operation: 'record_and_open_new_chat',
		isHoldToRecordMode: false,
		timestamp: new Date()
	};

	try {
		console.log('🎤 [COMMAND] Step 2: Creating error context...');
		outputChannel.appendLine('🎤 [COMMAND] Step 2: Creating error context...');
		
		// Проверяем, идет ли уже запись
		console.log('🎤 [COMMAND] Step 3: Checking if recording is in progress...');
		outputChannel.appendLine('🎤 [COMMAND] Step 3: Checking if recording is in progress...');
		
		if (RecordingStateManager.isRecording()) {
			// Останавливаем запись
			console.log('⏹️ [COMMAND] Stopping recording (recordAndOpenNewChat)');
			outputChannel.appendLine('⏹️ [COMMAND] Stopping recording (recordAndOpenNewChat)');
			stopRecording();
			return;
		}

		console.log('🎤 [COMMAND] Step 4: Getting current time...');
		outputChannel.appendLine('🎤 [COMMAND] Step 4: Getting current time...');
		
		// Проверяем минимальный интервал между попытками ЗДЕСЬ
		const now = Date.now();
		console.log('🎤 [COMMAND] Checking recording interval, now:', now, 'last:', lastRecordingStartTime);
		outputChannel.appendLine('🎤 [COMMAND] Checking recording interval, now: ' + now + ' last: ' + lastRecordingStartTime);
		
		if (now - lastRecordingStartTime < MIN_RECORDING_INTERVAL) {
			console.log('⚠️ [COMMAND] Too frequent recording attempts in command, skipping');
			outputChannel.appendLine('⚠️ [COMMAND] Too frequent recording attempts in command, skipping');
			vscode.window.showWarningMessage('Too frequent recording attempts. Please wait a moment.');
			return;
		}

		console.log('🎤 [COMMAND] Step 5: Starting record and open new chat...');
		outputChannel.appendLine('🎤 [COMMAND] Step 5: Starting record and open new chat...');
		
		// Начинаем запись с режимом NEW_CHAT
		console.log('🎤 [COMMAND] Step 6: Attempting to start recording with NEW_CHAT mode');
		outputChannel.appendLine('🎤 [COMMAND] Step 6: Attempting to start recording with NEW_CHAT mode');
		
		const startRecordingResult = RecordingStateManager.startRecording(RecordingMode.NEW_CHAT);
		console.log('🎤 [COMMAND] RecordingStateManager.startRecording result:', startRecordingResult);
		outputChannel.appendLine('🎤 [COMMAND] RecordingStateManager.startRecording result: ' + startRecordingResult);
		
		if (startRecordingResult) {
			console.log('🎤 [COMMAND] Step 7: Recording state started successfully');
			outputChannel.appendLine('🎤 [COMMAND] Step 7: Recording state started successfully');
			
			// Обновляем StatusBar сразу при начале попытки записи
			console.log('🎤 [COMMAND] Step 8: Checking statusBarManager...');
			outputChannel.appendLine('🎤 [COMMAND] Step 8: Checking statusBarManager...');
			
			if (statusBarManager) {
				console.log('🎤 [COMMAND] Step 9: Updating status bar to recording state');
				outputChannel.appendLine('🎤 [COMMAND] Step 9: Updating status bar to recording state');
				statusBarManager.updateRecordingState(true);
				console.log('🎤 [COMMAND] Step 9: Status bar updated successfully');
				outputChannel.appendLine('🎤 [COMMAND] Step 9: Status bar updated successfully');
			} else {
				console.log('🎤 [COMMAND] Step 9: statusBarManager is null');
				outputChannel.appendLine('🎤 [COMMAND] Step 9: statusBarManager is null');
			}
			
			// Устанавливаем время попытки записи
			console.log('🎤 [COMMAND] Step 10: Setting lastRecordingStartTime...');
			outputChannel.appendLine('🎤 [COMMAND] Step 10: Setting lastRecordingStartTime...');
			lastRecordingStartTime = now;
			console.log('🎤 [COMMAND] Set lastRecordingStartTime to:', lastRecordingStartTime);
			outputChannel.appendLine('🎤 [COMMAND] Set lastRecordingStartTime to: ' + lastRecordingStartTime);
			
			console.log('🎤 [COMMAND] Step 11: About to call startRecording()...');
			outputChannel.appendLine('🎤 [COMMAND] Step 11: About to call startRecording()...');
			
			try {
				console.time('startRecording');
				await startRecording();
				console.timeEnd('startRecording');
				console.log('🎤 [COMMAND] Step 12: startRecording() completed successfully');
				outputChannel.appendLine('🎤 [COMMAND] Step 12: startRecording() completed successfully');
			} catch (startRecordingError) {
				console.error('❌ [COMMAND] Error in startRecording():', startRecordingError);
				outputChannel.appendLine('❌ [COMMAND] Error in startRecording(): ' + startRecordingError);
				throw startRecordingError;
			}
			
			console.log('🎤 [COMMAND] Step 13: Showing information message...');
			outputChannel.appendLine('🎤 [COMMAND] Step 13: Showing information message...');
			vscode.window.showInformationMessage('🎤 Recording... Press F9 again to stop and open new chat');
			console.log('🎤 [COMMAND] Step 14: Function completed successfully');
			outputChannel.appendLine('🎤 [COMMAND] Step 14: Function completed successfully');
			
		} else {
			console.log('❌ [COMMAND] Failed to start recording state');
			outputChannel.appendLine('❌ [COMMAND] Failed to start recording state');
			vscode.window.showWarningMessage('Recording already in progress or too frequent attempts');
		}
		
	} catch (error) {
		console.error('❌ [COMMAND] recordAndOpenNewChat failed:', error);
		outputChannel.appendLine('❌ [COMMAND] recordAndOpenNewChat failed: ' + error);
		console.error('❌ [COMMAND] Error details:', {
			name: (error as Error).name,
			message: (error as Error).message,
			stack: (error as Error).stack
		});
		outputChannel.appendLine('❌ [COMMAND] Error name: ' + (error as Error).name);
		outputChannel.appendLine('❌ [COMMAND] Error message: ' + (error as Error).message);
		
		// Сбрасываем состояние при ошибке
		console.log('🔄 [COMMAND] Resetting recording state due to error...');
		outputChannel.appendLine('🔄 [COMMAND] Resetting recording state due to error...');
		RecordingStateManager.resetState();
		
		// Сбрасываем StatusBar при ошибке
		if (statusBarManager) {
			statusBarManager.updateRecordingState(false);
		}
		
		try {
			await errorHandler.handleErrorFromException(error as Error, context);
		} catch (handlerError) {
			console.error('❌ [COMMAND] Error in error handler:', handlerError);
			outputChannel.appendLine('❌ [COMMAND] Error in error handler: ' + handlerError);
		}
	}
}

/**
 * Команды записи
 */
async function startRecording(): Promise<void> {
	console.log('▶️ [RECORDING] startRecording() called');
	outputChannel.appendLine('▶️ [RECORDING] startRecording() called');
	
	console.log('▶️ [RECORDING] Current recording state:', RecordingStateManager.isRecording());
	console.log('▶️ [RECORDING] Current mode:', RecordingStateManager.getCurrentMode());
	console.log('▶️ [RECORDING] audioRecorder initialized:', !!audioRecorder);
	outputChannel.appendLine('▶️ [RECORDING] Current recording state: ' + RecordingStateManager.isRecording());
	outputChannel.appendLine('▶️ [RECORDING] Current mode: ' + RecordingStateManager.getCurrentMode());
	outputChannel.appendLine('▶️ [RECORDING] audioRecorder initialized: ' + !!audioRecorder);
	
	const context: ErrorContext = {
		operation: 'start_recording',
		isHoldToRecordMode: false,
		timestamp: new Date()
	};

	try {
		console.log('▶️ [RECORDING] Starting recording process...');
		outputChannel.appendLine('▶️ [RECORDING] Starting recording process...');
		
		// Обеспечиваем инициализацию FFmpeg Audio Recorder
		console.log('🔧 [RECORDING] Step 1: Ensuring FFmpeg Audio Recorder initialization...');
		outputChannel.appendLine('🔧 [RECORDING] Step 1: Ensuring FFmpeg Audio Recorder initialization...');
		
		console.time('ensureFFmpegAudioRecorder');
		
		try {
			await ensureFFmpegAudioRecorder();
			console.timeEnd('ensureFFmpegAudioRecorder');
			console.log('🔧 [RECORDING] Step 1: ensureFFmpegAudioRecorder completed successfully');
			outputChannel.appendLine('🔧 [RECORDING] Step 1: ensureFFmpegAudioRecorder completed successfully');
		} catch (ensureError) {
			console.timeEnd('ensureFFmpegAudioRecorder');
			console.error('❌ [RECORDING] Error in ensureFFmpegAudioRecorder:', ensureError);
			outputChannel.appendLine('❌ [RECORDING] Error in ensureFFmpegAudioRecorder: ' + ensureError);
			throw ensureError;
		}
		
		// Проверяем, что audioRecorder инициализирован
		console.log('🔧 [RECORDING] Step 1.5: Checking audioRecorder after ensure...');
		outputChannel.appendLine('🔧 [RECORDING] Step 1.5: Checking audioRecorder after ensure...');
		
		if (!audioRecorder) {
			console.error('❌ [RECORDING] audioRecorder is null after ensureFFmpegAudioRecorder');
			outputChannel.appendLine('❌ [RECORDING] audioRecorder is null after ensureFFmpegAudioRecorder');
			// Сбрасываем состояние записи если audioRecorder не инициализирован
			RecordingStateManager.resetState();
			vscode.window.showErrorMessage('❌ Failed to initialize audio recorder');
			return;
		}
		
		console.log('✅ [RECORDING] Step 2: audioRecorder is initialized, checking if already recording...');
		outputChannel.appendLine('✅ [RECORDING] Step 2: audioRecorder is initialized, checking if already recording...');
		
		// Проверяем, не идет ли уже запись
		const isCurrentlyRecording = audioRecorder.getIsRecording();
		console.log('✅ [RECORDING] audioRecorder.getIsRecording():', isCurrentlyRecording);
		outputChannel.appendLine('✅ [RECORDING] audioRecorder.getIsRecording(): ' + isCurrentlyRecording);
		
		if (isCurrentlyRecording) {
			console.log('⚠️ [RECORDING] Recording already in progress, skipping start');
			outputChannel.appendLine('⚠️ [RECORDING] Recording already in progress, skipping start');
			return;
		}
		
		console.log('🎤 [RECORDING] Step 3: audioRecorder not recording, checking microphone...');
		outputChannel.appendLine('🎤 [RECORDING] Step 3: audioRecorder not recording, checking microphone...');
		
		// Проверяем состояние микрофона с retry
		console.log('🔍 [RECORDING] Step 3a: Starting microphone permission check...');
		outputChannel.appendLine('🔍 [RECORDING] Step 3a: Starting microphone permission check...');
		
		console.time('microphone.permission.check');
		
		let microphoneResult;
		try {
			microphoneResult = await retryManager.retryMicrophoneOperation(
				async () => {
					console.log('🔍 [RECORDING] Calling FFmpegAudioRecorder.checkMicrophonePermission...');
					outputChannel.appendLine('🔍 [RECORDING] Calling FFmpegAudioRecorder.checkMicrophonePermission...');
					const hasPermission = await FFmpegAudioRecorder.checkMicrophonePermission();
					console.log('🔍 [RECORDING] Microphone permission result:', JSON.stringify(hasPermission, null, 2));
					outputChannel.appendLine('🔍 [RECORDING] Microphone permission result: ' + JSON.stringify(hasPermission, null, 2));
					if (hasPermission.state !== 'granted') {
						throw new Error('Microphone permission not granted');
					}
					return hasPermission;
				},
				'microphone_permission_check'
			);
			console.timeEnd('microphone.permission.check');
		} catch (micError) {
			console.timeEnd('microphone.permission.check');
			console.error('❌ [RECORDING] Error in microphone check:', micError);
			outputChannel.appendLine('❌ [RECORDING] Error in microphone check: ' + micError);
			throw micError;
		}

		console.log('🔍 [RECORDING] Step 3b: Microphone operation result:', JSON.stringify(microphoneResult, null, 2));
		outputChannel.appendLine('🔍 [RECORDING] Step 3b: Microphone operation result: ' + JSON.stringify(microphoneResult, null, 2));

		if (!microphoneResult.success) {
			const error = microphoneResult.lastError || new Error('Microphone access failed');
			console.error('❌ [RECORDING] Microphone check failed:', error);
			outputChannel.appendLine('❌ [RECORDING] Microphone check failed: ' + error);
			// Сбрасываем состояние записи при ошибке микрофона
			RecordingStateManager.resetState();
			await errorHandler.handleErrorFromException(error, context);
			return;
		}
		
		console.log('✅ [RECORDING] Step 4: Microphone check passed, calling audioRecorder.startRecording()...');
		outputChannel.appendLine('✅ [RECORDING] Step 4: Microphone check passed, calling audioRecorder.startRecording()...');
		
		console.time('audioRecorder.startRecording');
		
		try {
			await audioRecorder.startRecording();
			console.timeEnd('audioRecorder.startRecording');
			console.log('✅ [RECORDING] Step 4: audioRecorder.startRecording() completed successfully');
			outputChannel.appendLine('✅ [RECORDING] Step 4: audioRecorder.startRecording() completed successfully');
			console.log('✅ [RECORDING] Recording process completed successfully');
			outputChannel.appendLine('✅ [RECORDING] Recording process completed successfully');
		} catch (startError) {
			console.timeEnd('audioRecorder.startRecording');
			console.error('❌ [RECORDING] Error in audioRecorder.startRecording():', startError);
			outputChannel.appendLine('❌ [RECORDING] Error in audioRecorder.startRecording(): ' + startError);
			throw startError;
		}
		
	} catch (error) {
		console.error('❌ [RECORDING] Failed to start recording:', error);
		outputChannel.appendLine('❌ [RECORDING] Failed to start recording: ' + error);
		console.error('❌ [RECORDING] Error details:', {
			name: (error as Error).name,
			message: (error as Error).message,
			stack: (error as Error).stack
		});
		outputChannel.appendLine('❌ [RECORDING] Error name: ' + (error as Error).name);
		outputChannel.appendLine('❌ [RECORDING] Error message: ' + (error as Error).message);
		
		// Сбрасываем состояние записи при любой ошибке
		console.log('🔄 [RECORDING] Resetting state due to error...');
		outputChannel.appendLine('🔄 [RECORDING] Resetting state due to error...');
		RecordingStateManager.resetState();
		
		try {
			await errorHandler.handleErrorFromException(error as Error, context);
		} catch (handlerError) {
			console.error('❌ [RECORDING] Error in error handler:', handlerError);
			outputChannel.appendLine('❌ [RECORDING] Error in error handler: ' + handlerError);
		}
	}
}

function stopRecording(): void {
	try {
		console.log('⏹️ [RECORDING] stopRecording() called');
		console.log('⏹️ [RECORDING] Current recording state:', RecordingStateManager.isRecording());
		console.log('⏹️ [RECORDING] Current mode:', RecordingStateManager.getCurrentMode());
		console.log('⏹️ [RECORDING] audioRecorder initialized:', !!audioRecorder);
		
		// Останавливаем запись но сохраняем режим для транскрибации
		console.log('⏹️ [RECORDING] Step 1: Stopping recording but keeping mode for transcription...');
		const previousMode = RecordingStateManager.stopRecordingKeepMode();
		console.log(`⏹️ [RECORDING] Step 1: Recording stopped, mode preserved for transcription: ${previousMode}`);
		
		// Обновляем StatusBar сразу при остановке
		console.log('⏹️ [RECORDING] Step 2: Updating status bar...');
		if (statusBarManager) {
			statusBarManager.updateRecordingState(false);
			console.log('⏹️ [RECORDING] Step 2: Status bar updated to not recording');
		} else {
			console.log('⏹️ [RECORDING] Step 2: statusBarManager not available');
		}
		
		if (!audioRecorder) {
			console.warn('⚠️ [RECORDING] Audio recorder not initialized, but mode was preserved');
			return;
		}
		
		console.log('⏹️ [RECORDING] Step 3: Calling audioRecorder.stopRecording()...');
		console.log('⏹️ [RECORDING] audioRecorder.getIsRecording() before stop:', audioRecorder.getIsRecording());
		console.time('audioRecorder.stopRecording');
		audioRecorder.stopRecording();
		console.timeEnd('audioRecorder.stopRecording');
		console.log('⏹️ [RECORDING] Step 3: audioRecorder.stopRecording() completed');
		console.log('⏹️ [RECORDING] audioRecorder.getIsRecording() after stop:', audioRecorder.getIsRecording());
		console.log('✅ [RECORDING] stopRecording completed successfully');
		
	} catch (error) {
		console.error('❌ [RECORDING] Failed to stop recording:', error);
		console.error('❌ [RECORDING] Error details:', {
			name: (error as Error).name,
			message: (error as Error).message,
			stack: (error as Error).stack
		});
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
	console.log('🔧 ensureFFmpegAudioRecorder() called');
	
	if (audioRecorder) {
		console.log('✅ audioRecorder already initialized');
		return; // Уже инициализирован
	}

	console.log('🔧 Initializing FFmpeg Audio Recorder...');
	
	try {
		// Проверяем доступность FFmpeg
		console.log('🔍 Checking FFmpeg availability...');
		const ffmpegCheck = await FFmpegAudioRecorder.checkFFmpegAvailability();
		console.log('🔍 FFmpeg check result:', JSON.stringify(ffmpegCheck, null, 2));
		
		if (!ffmpegCheck.available) {
			const errorMsg = `FFmpeg not available: ${ffmpegCheck.error || 'Unknown error'}`;
			console.error('❌ FFmpeg check failed:', errorMsg);
			vscode.window.showErrorMessage(`❌ FFmpeg Error: ${errorMsg}`);
			throw new Error(errorMsg);
		}
		
		console.log('✅ FFmpeg is available, version:', ffmpegCheck.version);
		
		// Получаем настройки аудио
		console.log('⚙️ Reading audio configuration...');
		const audioConfig = configurationManager.getAudioConfiguration();
		console.log('⚙️ Audio quality setting:', audioConfig.audioQuality);
		
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
		
		console.log(`⚙️ Audio settings: ${audioConfig.audioQuality} quality, ${sampleRate}Hz sample rate`);
		
		// События для AudioRecorder - создаем здесь для правильной работы с StatusBar
		const audioRecorderEvents: AudioRecorderEvents = {
			onRecordingStart: () => {
				console.log('🎤 AudioRecorder event: onRecordingStart');
				// Обновляем StatusBar
				if (statusBarManager) {
					statusBarManager.updateRecordingState(true);
				}
				vscode.window.showInformationMessage('🎤 Recording started...');
			},
			onRecordingStop: async (audioBlob: Blob) => {
				console.log('⏹️ AudioRecorder event: onRecordingStop, blob size:', audioBlob.size);
				console.log('⏹️ AudioRecorder event: onRecordingStop, blob type:', audioBlob.type);
				console.log('⏹️ AudioRecorder event: About to call handleTranscription...');
				
				// Обновляем StatusBar
				if (statusBarManager) {
					statusBarManager.updateRecordingState(false);
				}
				
				try {
					// Обрабатываем транскрибацию
					console.log('⏹️ AudioRecorder event: Calling handleTranscription...');
					await handleTranscription(audioBlob);
					console.log('⏹️ AudioRecorder event: handleTranscription completed successfully');
				} catch (error) {
					console.error('❌ AudioRecorder event: Error in handleTranscription:', error);
					console.error('❌ AudioRecorder event: Error details:', {
						name: (error as Error).name,
						message: (error as Error).message,
						stack: (error as Error).stack
					});
					// Показываем ошибку пользователю
					vscode.window.showErrorMessage(`Transcription failed: ${(error as Error).message}`);
					// Сбрасываем состояние при ошибке транскрибации
					RecordingStateManager.resetState();
				}
			},
			onError: (error: Error) => {
				console.error('❌ AudioRecorder event: onError:', error);
				// Обновляем StatusBar
				if (statusBarManager) {
					statusBarManager.showError(`Recording error: ${error.message}`);
				}
				vscode.window.showErrorMessage(`Recording failed: ${error.message}`);
				// Сбрасываем состояние при ошибке
				RecordingStateManager.resetState();
			}
		};
		
		console.log('🔧 Creating FFmpegAudioRecorder instance...');
		
		// Создаем экземпляр FFmpegAudioRecorder
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
		
		console.log('🔧 Recorder options:', JSON.stringify(recorderOptions, null, 2));
		
		// Создаем новый экземпляр аудио рекордера
		console.log('🎤 [RECORDING] Creating new FFmpegAudioRecorder instance...');
		outputChannel.appendLine('🎤 [RECORDING] Creating new FFmpegAudioRecorder instance...');
		
		audioRecorder = new FFmpegAudioRecorder(audioRecorderEvents, recorderOptions, outputChannel);
		console.log('🎤 [RECORDING] FFmpegAudioRecorder instance created successfully!');
		
	} catch (error) {
		console.error('❌ Failed to initialize FFmpeg Audio Recorder:', error);
		audioRecorder = null; // Убеждаемся что он null при ошибке
		
		// Показываем подробную ошибку пользователю
		const errorMessage = `Failed to initialize audio recorder: ${(error as Error).message}`;
		vscode.window.showErrorMessage(errorMessage);
		
		throw error;
	}
}