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

		console.log('🎯 [TRANSCRIPTION] Step 3: Starting transcription...');
		console.time('whisper.transcription');
		const transcriptionResult = await whisperClient.transcribe(audioBlob);
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
	console.log('🎤 [COMMAND] recordAndInsertToCurrentChat called!');
	console.log('🎤 [COMMAND] Current recording state:', RecordingStateManager.isRecording());
	console.log('🎤 [COMMAND] Current mode:', RecordingStateManager.getCurrentMode());
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
	console.log('🎤 [COMMAND] recordAndOpenNewChat called!');
	console.log('🎤 [COMMAND] Current recording state:', RecordingStateManager.isRecording());
	console.log('🎤 [COMMAND] Current mode:', RecordingStateManager.getCurrentMode());
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
			console.log('⏹️ [COMMAND] Stopping recording (recordAndOpenNewChat)');
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

		console.log('🎤 [COMMAND] Starting record and open new chat...');
		
		// Начинаем запись с режимом NEW_CHAT
		console.log('🎤 [COMMAND] Attempting to start recording with NEW_CHAT mode');
		if (RecordingStateManager.startRecording(RecordingMode.NEW_CHAT)) {
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
			vscode.window.showInformationMessage('🎤 Recording... Press F9 again to stop and open new chat');
		} else {
			console.log('❌ [COMMAND] Failed to start recording state');
			vscode.window.showWarningMessage('Recording already in progress or too frequent attempts');
		}
		
	} catch (error) {
		console.error('❌ [COMMAND] recordAndOpenNewChat failed:', error);
		console.error('❌ [COMMAND] Error details:', {
			name: (error as Error).name,
			message: (error as Error).message,
			stack: (error as Error).stack
		});
		await errorHandler.handleErrorFromException(error as Error, context);
	}
}

/**
 * Команды записи
 */
async function startRecording(): Promise<void> {
	console.log('▶️ [RECORDING] startRecording() called');
	console.log('▶️ [RECORDING] Current recording state:', RecordingStateManager.isRecording());
	console.log('▶️ [RECORDING] Current mode:', RecordingStateManager.getCurrentMode());
	console.log('▶️ [RECORDING] audioRecorder initialized:', !!audioRecorder);
	
	const context: ErrorContext = {
		operation: 'start_recording',
		isHoldToRecordMode: false,
		timestamp: new Date()
	};

	try {
		console.log('▶️ [RECORDING] Starting recording process...');
		
		// Обеспечиваем инициализацию FFmpeg Audio Recorder
		console.log('🔧 [RECORDING] Step 1: Ensuring FFmpeg Audio Recorder initialization...');
		console.time('ensureFFmpegAudioRecorder');
		await ensureFFmpegAudioRecorder();
		console.timeEnd('ensureFFmpegAudioRecorder');
		console.log('🔧 [RECORDING] Step 1: ensureFFmpegAudioRecorder completed successfully');
		
		// Проверяем, что audioRecorder инициализирован
		if (!audioRecorder) {
			console.error('❌ [RECORDING] audioRecorder is null after ensureFFmpegAudioRecorder');
			// Сбрасываем состояние записи если audioRecorder не инициализирован
			RecordingStateManager.resetState();
			vscode.window.showErrorMessage('❌ Failed to initialize audio recorder');
			return;
		}
		
		console.log('✅ [RECORDING] Step 2: audioRecorder is initialized, checking if already recording...');
		
		// Проверяем, не идет ли уже запись
		const isCurrentlyRecording = audioRecorder.getIsRecording();
		console.log('✅ [RECORDING] audioRecorder.getIsRecording():', isCurrentlyRecording);
		if (isCurrentlyRecording) {
			console.log('⚠️ [RECORDING] Recording already in progress, skipping start');
			return;
		}
		
		console.log('🎤 [RECORDING] Step 3: audioRecorder not recording, checking microphone...');
		
		// Проверяем состояние микрофона с retry
		console.log('🔍 [RECORDING] Step 3a: Starting microphone permission check...');
		console.time('microphone.permission.check');
		const microphoneResult = await retryManager.retryMicrophoneOperation(
			async () => {
				console.log('🔍 [RECORDING] Calling FFmpegAudioRecorder.checkMicrophonePermission...');
				const hasPermission = await FFmpegAudioRecorder.checkMicrophonePermission();
				console.log('🔍 [RECORDING] Microphone permission result:', JSON.stringify(hasPermission, null, 2));
				if (hasPermission.state !== 'granted') {
					throw new Error('Microphone permission not granted');
				}
				return hasPermission;
			},
			'microphone_permission_check'
		);
		console.timeEnd('microphone.permission.check');

		console.log('🔍 [RECORDING] Step 3b: Microphone operation result:', JSON.stringify(microphoneResult, null, 2));

		if (!microphoneResult.success) {
			const error = microphoneResult.lastError || new Error('Microphone access failed');
			console.error('❌ [RECORDING] Microphone check failed:', error);
			// Сбрасываем состояние записи при ошибке микрофона
			RecordingStateManager.resetState();
			await errorHandler.handleErrorFromException(error, context);
			return;
		}
		
		console.log('✅ [RECORDING] Step 4: Microphone check passed, calling audioRecorder.startRecording()...');
		console.time('audioRecorder.startRecording');
		await audioRecorder.startRecording();
		console.timeEnd('audioRecorder.startRecording');
		console.log('✅ [RECORDING] Step 4: audioRecorder.startRecording() completed successfully');
		console.log('✅ [RECORDING] Recording process completed successfully');
		
	} catch (error) {
		console.error('❌ [RECORDING] Failed to start recording:', error);
		console.error('❌ [RECORDING] Error details:', {
			name: (error as Error).name,
			message: (error as Error).message,
			stack: (error as Error).stack
		});
		// Сбрасываем состояние записи при любой ошибке
		RecordingStateManager.resetState();
		await errorHandler.handleErrorFromException(error as Error, context);
	}
}

function stopRecording(): void {
	try {
		console.log('⏹️ [RECORDING] stopRecording() called');
		console.log('⏹️ [RECORDING] Current recording state:', RecordingStateManager.isRecording());
		console.log('⏹️ [RECORDING] Current mode:', RecordingStateManager.getCurrentMode());
		console.log('⏹️ [RECORDING] audioRecorder initialized:', !!audioRecorder);
		
		// Сбрасываем режим записи через RecordingStateManager в любом случае
		console.log('⏹️ [RECORDING] Step 1: Stopping recording state...');
		const previousMode = RecordingStateManager.stopRecording();
		console.log(`⏹️ [RECORDING] Step 1: Recording state reset, previous mode was: ${previousMode}`);
		
		// Обновляем StatusBar сразу при остановке
		console.log('⏹️ [RECORDING] Step 2: Updating status bar...');
		if (statusBarManager) {
			statusBarManager.updateRecordingState(false);
			console.log('⏹️ [RECORDING] Step 2: Status bar updated to not recording');
		} else {
			console.log('⏹️ [RECORDING] Step 2: statusBarManager not available');
		}
		
		if (!audioRecorder) {
			console.warn('⚠️ [RECORDING] Audio recorder not initialized, but state was reset');
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
