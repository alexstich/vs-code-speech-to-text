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

// Переменная для хранения последней транскрибации
let lastTranscribedText: string | null = null;

// Время последнего запуска записи для предотвращения частых попыток
let lastRecordingStartTime = 0;
const MIN_RECORDING_INTERVAL = 200; // минимум 200ms между попытками

// Переменная для отслеживания текущего режима записи
let currentRecordingMode: 'insert' | 'clipboard' | 'chat' | null = null;

// Интеграция с Cursor чатом
let cursorIntegration: CursorIntegration;

/**
 * Функция активации расширения
 * Вызывается при первом использовании команды расширения
 */
export function activate(context: vscode.ExtensionContext) {
	console.log('🎤 SpeechToTextWhisper extension is now active!');
	
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
	
	// События для AudioRecorder
	const audioRecorderEvents: AudioRecorderEvents = {
		onRecordingStart: () => {
			console.log('🎤 Recording started');
			statusBarManager.updateRecordingState(true);
			vscode.window.showInformationMessage('🎤 Recording started...');
		},
		onRecordingStop: async (audioBlob: Blob) => {
			console.log('⏹️ Recording stopped, processing audio...');
			statusBarManager.updateRecordingState(false);
			
			// Обрабатываем транскрибацию
			await handleTranscription(audioBlob);
		},
		onError: (error: Error) => {
			console.error('❌ Audio recording error:', error);
			statusBarManager.showError(`Recording error: ${error.message}`);
			vscode.window.showErrorMessage(`Recording failed: ${error.message}`);
		}
	};
	
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
		vscode.commands.registerCommand('speechToTextWhisper.recordAndInsert', recordAndInsert),
		vscode.commands.registerCommand('speechToTextWhisper.recordToClipboard', recordToClipboard),
		// Команда диагностики
		vscode.commands.registerCommand('speechToTextWhisper.runDiagnostics', () => diagnosticsProvider.runAllDiagnostics()),
		// Команды для управления устройствами
		vscode.commands.registerCommand('speechToTextWhisper.audioSettings.selectDevice', (deviceId: string) => deviceManagerProvider.selectDevice(deviceId)),
		// Команды для настроек
		vscode.commands.registerCommand('speechToTextWhisper.openSettings', () => settingsProvider.openSettings()),
		// Команды для переключения режима
		vscode.commands.registerCommand('speechToTextWhisper.toggleMode', () => modeSelectorProvider.toggleMode())
	];

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
	
	console.log(`✅ Registered ${commands.length} commands`);
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
			console.log(`🔍 Current recording mode: ${currentRecordingMode}`);
			
			if (currentRecordingMode === 'insert') {
				console.log('📝 Inserting into editor (mode: insert)');
				
				try {
					// Вставляем в редактор
					await insertTranscribedTextWithErrorHandling(lastTranscribedText, 'cursor', context);
					
					// Показываем успех
					const truncatedText = lastTranscribedText.substring(0, 50) + (lastTranscribedText.length > 50 ? '...' : '');
					statusBarManager.showSuccess(`Inserted: "${truncatedText}"`);
					
					// Показываем уведомление о завершении
					vscode.window.showInformationMessage(`✅ Transcribed and inserted: "${truncatedText}"`);
					
					// Сбрасываем режим
					currentRecordingMode = null;
					return;
					
				} catch (error) {
					console.error('❌ Failed to insert text:', error);
					vscode.window.showErrorMessage(`Failed to insert text: ${(error as Error).message}`);
					currentRecordingMode = null;
					return;
				}
			} else if (currentRecordingMode === 'chat') {
				console.log('🎯 Sending to Cursor chat (mode: chat)');
				
				try {
					// Отправляем в чат через CursorIntegration
					await insertLastTranscription('chat');
					
					// Показываем успех
					const truncatedText = lastTranscribedText.substring(0, 50) + (lastTranscribedText.length > 50 ? '...' : '');
					statusBarManager.showSuccess(`Sent to chat: "${truncatedText}"`);
					
					// Показываем уведомление о завершении
					vscode.window.showInformationMessage(`✅ Transcribed and sent to chat: "${truncatedText}"`);
					
					// Сбрасываем режим
					currentRecordingMode = null;
					return;
					
				} catch (error) {
					console.error('❌ Failed to send to chat:', error);
					vscode.window.showErrorMessage(`Failed to send to chat: ${(error as Error).message}`);
					currentRecordingMode = null;
					return;
				}
			} else if (currentRecordingMode === 'clipboard') {
				console.log('📋 Copying to clipboard (mode: clipboard)');
				
				try {
					// Копируем в буфер обмена
					await insertLastTranscription('clipboard');
					
					// Показываем успех
					const truncatedText = lastTranscribedText.substring(0, 50) + (lastTranscribedText.length > 50 ? '...' : '');
					statusBarManager.showSuccess(`Copied: "${truncatedText}"`);
					
					// Показываем уведомление о завершении
					vscode.window.showInformationMessage(`✅ Transcribed and copied to clipboard: "${truncatedText}"`);
					
					// Сбрасываем режим
					currentRecordingMode = null;
					return;
					
				} catch (error) {
					console.error('❌ Failed to copy to clipboard:', error);
					vscode.window.showErrorMessage(`Failed to copy to clipboard: ${(error as Error).message}`);
					currentRecordingMode = null;
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
		
		if (mode === 'chat') {
			// Отправляем в Cursor чат
			if (!cursorIntegration || !cursorIntegration.isIntegrationEnabled()) {
				throw new Error('Cursor integration not available');
			}
			
			await cursorIntegration.sendToChat(lastTranscribedText);
			console.log('✅ Text sent to Cursor chat');
			
		} else if (mode === 'clipboard') {
			// Копируем в буфер обмена
			await vscode.env.clipboard.writeText(lastTranscribedText);
			console.log('✅ Text copied to clipboard');
			
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
	const config = vscode.workspace.getConfiguration('speechToTextWhisper');
	const showStatusBar = config.get<boolean>('showStatusBar', true);
	
	if (showStatusBar) {
		statusBarManager.show();
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
	currentRecordingMode = null;
	
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
 * Команда записи с вставкой текста
 */
async function recordAndInsert(): Promise<void> {
	const context: ErrorContext = {
		operation: 'record_and_insert',
		isHoldToRecordMode: false,
		timestamp: new Date()
	};

	try {
		console.log('🎤 Starting record and insert...');
		
		// Устанавливаем режим записи в 'insert'
		currentRecordingMode = 'insert';
		
		// Начинаем запись
		await startRecording();
		
		// Показываем уведомление
		vscode.window.showInformationMessage('🎤 Recording... Release F9 to insert');
		
	} catch (error) {
		console.error('❌ Record and insert failed:', error);
		currentRecordingMode = null;
		await errorHandler.handleErrorFromException(error as Error, context);
	}
}

/**
 * Команда записи в буфер обмена
 */
async function recordToClipboard(): Promise<void> {
	const context: ErrorContext = {
		operation: 'record_to_clipboard',
		isHoldToRecordMode: false,
		timestamp: new Date()
	};

	try {
		console.log('📋 Starting record to clipboard...');
		
		// Устанавливаем режим записи в 'clipboard'
		currentRecordingMode = 'clipboard';
		
		// Начинаем запись
		await startRecording();
		
		// Показываем уведомление
		vscode.window.showInformationMessage('🎤 Recording... Release Ctrl+Shift+M to copy to clipboard');
		
	} catch (error) {
		console.error('❌ Record to clipboard failed:', error);
		currentRecordingMode = null;
		await errorHandler.handleErrorFromException(error as Error, context);
	}
}

/**
 * Команды записи
 */
async function startRecording(): Promise<void> {
	const context: ErrorContext = {
		operation: 'start_recording',
		isHoldToRecordMode: false,
		timestamp: new Date()
	};

	try {
		console.log('▶️ Starting recording...');
		
		// Проверяем минимальный интервал между попытками
		const now = Date.now();
		if (now - lastRecordingStartTime < MIN_RECORDING_INTERVAL) {
			console.log('⚠️ Too frequent recording attempts, skipping');
			return;
		}
		lastRecordingStartTime = now;
		
		// Обеспечиваем инициализацию FFmpeg Audio Recorder
		await ensureFFmpegAudioRecorder();
		
		// Проверяем, не идет ли уже запись
		if (audioRecorder && audioRecorder.getIsRecording()) {
			console.log('⚠️ Recording already in progress, skipping start');
			return;
		}
		
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
			await errorHandler.handleErrorFromException(error, context);
			return;
		}
		
		if (!audioRecorder) {
			throw new Error('Failed to initialize audio recorder');
		}
		
		await audioRecorder.startRecording();
		
	} catch (error) {
		console.error('❌ Failed to start recording:', error);
		await errorHandler.handleErrorFromException(error as Error, context);
	}
}

function stopRecording(): void {
	try {
		console.log('⏹️ Stopping recording...');
		
		if (!audioRecorder) {
			console.warn('Audio recorder not initialized');
			return;
		}
		
		audioRecorder.stopRecording();
		
		// Сбрасываем режим записи
		currentRecordingMode = null;
		
	} catch (error) {
		console.error('❌ Failed to stop recording:', error);
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

	console.log('🔧 Initializing FFmpeg Audio Recorder...');
	
	try {
		// Проверяем доступность FFmpeg
		const ffmpegCheck = await FFmpegAudioRecorder.checkFFmpegAvailability();
		if (!ffmpegCheck.available) {
			throw new Error(`FFmpeg not available: ${ffmpegCheck.error || 'Unknown error'}`);
		}
		
		// Получаем настройки аудио
		const config = vscode.workspace.getConfiguration('speechToTextWhisper');
		const audioQuality = config.get<string>('audioQuality', 'standard');
		
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
		
		// События для AudioRecorder
		const audioRecorderEvents: AudioRecorderEvents = {
			onRecordingStart: () => {
				console.log('🎤 Recording started');
				statusBarManager.updateRecordingState(true);
				vscode.window.showInformationMessage('🎤 Recording started...');
			},
			onRecordingStop: async (audioBlob: Blob) => {
				console.log('⏹️ Recording stopped, processing audio...');
				statusBarManager.updateRecordingState(false);
				
				// Обрабатываем транскрибацию
				await handleTranscription(audioBlob);
			},
			onError: (error: Error) => {
				console.error('❌ Audio recording error:', error);
				statusBarManager.showError(`Recording error: ${error.message}`);
				vscode.window.showErrorMessage(`Recording failed: ${error.message}`);
			}
		};
		
		// Создаем экземпляр FFmpegAudioRecorder
		audioRecorder = new FFmpegAudioRecorder(audioRecorderEvents, {
			sampleRate: sampleRate,
			channelCount: 1, // Моно для речи
			audioFormat: 'wav',
			codec: 'pcm_s16le',
			maxDuration: config.get<number>('maxRecordingDuration', 60),
			ffmpegPath: config.get<string>('ffmpegPath', '') || undefined,
			silenceDetection: config.get<boolean>('silenceDetection', true),
			silenceDuration: config.get<number>('silenceDuration', 3),
			silenceThreshold: config.get<number>('silenceThreshold', -50)
		});
		
		console.log(`✅ FFmpeg Audio Recorder initialized (quality: ${audioQuality}, sample rate: ${sampleRate}Hz)`);
		
	} catch (error) {
		console.error('❌ Failed to initialize FFmpeg Audio Recorder:', error);
		throw error;
	}
}
