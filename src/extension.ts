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
import { TranscriptionHistoryProvider } from './ui/TranscriptionHistoryProvider';
import { TranscriptionHistoryManager } from './core/TranscriptionHistoryManager';
import { ErrorHandler, ErrorType, ErrorContext, VSCodeErrorDisplayHandler } from './utils/ErrorHandler';
import { RetryManager } from './utils/RetryManager';
import { CursorIntegration, CursorIntegrationStrategy } from './integrations/CursorIntegration';
import { ConfigurationManager } from './core/ConfigurationManager';
import { initializeGlobalOutput, ExtensionLog, disposeGlobalOutput } from './utils/GlobalOutput';

/**
 * Recording modes for the new command architecture
 */
enum RecordingMode {
	INSERT_OR_CLIPBOARD = 'insertOrClipboard',  // Ctrl+Shift+M - insert into cursor or clipboard
	NEW_CHAT = 'newChat'                        // Ctrl+Shift+N - insert into current chat Cursor
}

/**
 * Recording state
 */
interface RecordingState {
	isRecording: boolean;
	mode: RecordingMode | null;
	startTime: number | null;
}

// Global variables for components
let audioRecorder: FFmpegAudioRecorder | null = null;
let whisperClient: WhisperClient;
let textInserter: TextInserter;
let statusBarManager: StatusBarManager;
let diagnosticsProvider: DiagnosticsProvider;
let deviceManagerProvider: DeviceManagerProvider;
let settingsProvider: SettingsProvider;
let modeSelectorProvider: ModeSelectorProvider;
let transcriptionHistoryProvider: TranscriptionHistoryProvider;
let transcriptionHistoryManager: TranscriptionHistoryManager;

// Global output channel for the entire extension
let outputChannel: vscode.OutputChannel;

// Error handling system
let errorHandler: ErrorHandler;
let retryManager: RetryManager;

// Configuration manager
let configurationManager: ConfigurationManager;

// Extension context for global access
let extensionContext: vscode.ExtensionContext;

// Variable for tracking recording state (replaces currentRecordingMode)
let recordingState: RecordingState = {
	isRecording: false,
	mode: null,
	startTime: null
};

// Time of the last recording start to prevent frequent attempts
let lastRecordingStartTime = 0;
const MIN_RECORDING_INTERVAL = 100; // minimum 100ms between attempts (was 200ms)

// Variable for storing the last transcription
let lastTranscribedText: string | null = null;

// Cursor chat integration
let cursorIntegration: CursorIntegration;

/**
 * Utilities for managing the recording state
 */
class RecordingStateManager {
	/**
	 * Checking if recording is in progress
	 */
	static isRecording(): boolean {
		return recordingState.isRecording;
	}

	/**
	 * Getting the current recording mode
	 */
	static getCurrentMode(): RecordingMode | null {
		return recordingState.mode;
	}

	/**
	 * Starting recording with the specified mode
	 */
	static startRecording(mode: RecordingMode): boolean {
		// Checking if recording is already in progress
		if (recordingState.isRecording) {
			ExtensionLog.warn('⚠️ Recording already in progress');
			return false;
		}

		// Setting the state
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
	 * Stopping recording
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
	 * Stopping recording with mode preservation (for transcription)
	 */
	static stopRecordingKeepMode(): RecordingMode | null {
		if (!recordingState.isRecording) {
			ExtensionLog.warn('⚠️ No recording in progress to stop');
			return null;
		}

		const mode = recordingState.mode;
		recordingState.isRecording = false;
		// mode and startTime remain for transcription processing

		ExtensionLog.info(`⏹️ Recording stopped, mode preserved for transcription: ${mode}`);
		return mode;
	}

	/**
	 * Forced state reset (for errors)
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
	 * Getting the duration of the current recording in ms
	 */
	static getRecordingDuration(): number {
		if (!recordingState.isRecording || !recordingState.startTime) {
			return 0;
		}
		return Date.now() - recordingState.startTime;
	}

	/**
	 * Getting the recording state
	 */
	static getState(): RecordingState {
		return recordingState;
	}
}

/**
 * Activation function for the extension
 * Called when the extension is first used
 */
export async function activate(context: vscode.ExtensionContext) {
	// Create an output channel for logging
	outputChannel = vscode.window.createOutputChannel('Speech to Text Whisper');
	outputChannel.appendLine('🚀 Extension activation started');
	outputChannel.show(); // Automatically show in the Output panel
	
	// Initialize the global logging system
	initializeGlobalOutput(outputChannel);
	ExtensionLog.info('SpeechToTextWhisper extension activation started! NEW VERSION 2024');
	ExtensionLog.info(`VS Code version: ${vscode.version}`);
	ExtensionLog.info(`Extension folder: ${context.extensionPath}`);
	
	// Save the context for global use
	extensionContext = context;

	try {
		// Initialize the error handling system
		initializeErrorHandling();
		
		// Initialize the components
		initializeComponents();
		
		// Initialize the TranscriptionHistoryManager
		await transcriptionHistoryManager.initialize();
		
		// Register all commands
		registerCommands(context);
		
		// Initialize the WhisperClient on first use
		initializeWhisperClient();
		
		// Show the welcome message and StatusBar
		showWelcomeMessage();
		
		// Add a listener for configuration changes
		configurationManager.addChangeListener((config) => {
			ExtensionLog.info('🔧 Configuration changed, reinitializing components...');
			
			// Reinitialize the WhisperClient when settings change
			initializeWhisperClient();
			
			// Reset the audioRecorder when audio settings change
			audioRecorder = null;
			
			// Update the visibility of the StatusBar
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
 * Initializing the error handling system
 */
function initializeErrorHandling(): void {
	ExtensionLog.info('🔧 Initializing error handling system...');
	
	// Create an ErrorHandler with the VS Code display handler
	errorHandler = new ErrorHandler(new VSCodeErrorDisplayHandler());
	
	// Create a RetryManager
	retryManager = new RetryManager(errorHandler);
	
	ExtensionLog.info('✅ Error handling system initialized');
}

/**
 * Initializing all extension components
 */
function initializeComponents(): void {
	ExtensionLog.info('🔧 Initializing SpeechToTextWhisper components...');
	
	// Initialize the ConfigurationManager
	configurationManager = ConfigurationManager.getInstance();
	ExtensionLog.info('✅ ConfigurationManager initialized');
	
	// Initialize the CursorIntegration
	initializeCursorIntegration();
	
	// Initialize the TextInserter
	textInserter = new TextInserter();
	
	// Initialize the DiagnosticsProvider
	diagnosticsProvider = new DiagnosticsProvider();
	
	// Initialize the DeviceManagerProvider
	deviceManagerProvider = new DeviceManagerProvider();
	
	// Initialize the SettingsProvider
	settingsProvider = new SettingsProvider();
	
	// Initialize the ModeSelectorProvider
	modeSelectorProvider = new ModeSelectorProvider();
	
	// Initialize the TranscriptionHistoryManager
	transcriptionHistoryManager = new TranscriptionHistoryManager(extensionContext, errorHandler);
	
	// Initialize the TranscriptionHistoryProvider
	transcriptionHistoryProvider = new TranscriptionHistoryProvider(transcriptionHistoryManager);
	
	// Events for the StatusBar
	const statusBarEvents: StatusBarEvents = {
		onRecordingToggle: () => {
			ExtensionLog.info('📊 Status bar clicked');
			vscode.commands.executeCommand('workbench.action.openSettings', 'speechToTextWhisper');
		}
	};
	
	// Configuration for the StatusBar
	const statusBarConfig: StatusBarConfiguration = {
		position: 'right',
		priority: 100,
		showTooltips: true,
		enableAnimations: true
	};
	
	// Initialize the StatusBarManager
	statusBarManager = new StatusBarManager(statusBarEvents, statusBarConfig);
	
	ExtensionLog.info('✅ Components initialized');
}

/**
 * Registering extension commands
 */
function registerCommands(context: vscode.ExtensionContext): void {
	ExtensionLog.info('📝 Registering commands...');
	
	const commands = [
		// Main recording commands
		vscode.commands.registerCommand('speechToTextWhisper.recordAndInsertOrClipboard', recordAndInsertOrClipboard),
		vscode.commands.registerCommand('speechToTextWhisper.recordAndOpenNewChat', recordAndOpenNewChat),
		// Diagnostics command
		vscode.commands.registerCommand('speechToTextWhisper.runDiagnostics', () => diagnosticsProvider.runAllDiagnostics()),
		// FFmpeg test command
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
				
				// Try diagnostics
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
		// AudioRecorder initialization test command
		vscode.commands.registerCommand('speechToTextWhisper.testAudioRecorder', async () => {
			try {
				ExtensionLog.info('🔍 Testing audioRecorder initialization...');
				
				// Reset the current audioRecorder
				audioRecorder = null;
				
				// Try to initialize
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
		// Commands for device management
		vscode.commands.registerCommand('speechToTextWhisper.audioSettings.selectDevice', (deviceId: string) => deviceManagerProvider.selectDevice(deviceId)),
		// Commands for settings
		vscode.commands.registerCommand('speechToTextWhisper.openSettings', () => settingsProvider.openSettings()),
		// Commands for mode switching
		vscode.commands.registerCommand('speechToTextWhisper.toggleMode', () => modeSelectorProvider.toggleMode()),
		vscode.commands.registerCommand('speechToTextWhisper.setMode', (mode: string) => modeSelectorProvider.setMode(mode as 'insert' | 'clipboard')),
		// Commands for transcription history
		vscode.commands.registerCommand('speechToTextWhisper.transcriptionHistory.copyToClipboard', (item) => transcriptionHistoryProvider.copyToClipboard(item)),
		vscode.commands.registerCommand('speechToTextWhisper.transcriptionHistory.insertAtCursor', (item) => transcriptionHistoryProvider.insertAtCursor(item)),
		vscode.commands.registerCommand('speechToTextWhisper.transcriptionHistory.deleteEntry', (item) => transcriptionHistoryProvider.deleteEntry(item)),
		vscode.commands.registerCommand('speechToTextWhisper.transcriptionHistory.clearHistory', () => transcriptionHistoryProvider.clearHistory()),
		vscode.commands.registerCommand('speechToTextWhisper.transcriptionHistory.refresh', () => transcriptionHistoryProvider.refresh())
	];

	ExtensionLog.info(`📝 Created ${commands.length} command registrations`);

	// Register DiagnosticsProvider as TreeDataProvider
	vscode.window.registerTreeDataProvider('speechToTextWhisper.diagnostics', diagnosticsProvider);

	// Register DeviceManagerProvider as TreeDataProvider
	vscode.window.registerTreeDataProvider('speechToTextWhisper.deviceManager', deviceManagerProvider);

	// Register SettingsProvider as TreeDataProvider
	vscode.window.registerTreeDataProvider('speechToTextWhisper.settings', settingsProvider);

	// Register ModeSelectorProvider as TreeDataProvider
	vscode.window.registerTreeDataProvider('speechToTextWhisper.modeSelector', modeSelectorProvider);

	// Register TranscriptionHistoryProvider as TreeDataProvider
	vscode.window.registerTreeDataProvider('speechToTextWhisper.transcriptionHistory', transcriptionHistoryProvider);

	// Add all commands to subscriptions
	context.subscriptions.push(...commands, statusBarManager);
	
	ExtensionLog.info(`✅ Registered ${commands.length} commands and added to subscriptions`);
}

/**
 * Handling transcription
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

		// Show transcription state
		if (statusBarManager) {
			statusBarManager.showTranscribing();
		}

		// Get settings from configuration
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
			
			// Add entry to transcription history
			try {
				const duration = recordingState.startTime ? Date.now() - recordingState.startTime : 0;
				const language = whisperConfig.language === 'auto' ? 'auto' : whisperConfig.language;
				
				await transcriptionHistoryManager.addEntry({
					text: lastTranscribedText,
					duration: duration,
					language: language,
					mode: recordingState.mode as any // cast to type from TranscriptionHistory
				});
				
				// Update UI history
				transcriptionHistoryProvider.refresh();
				
				ExtensionLog.info('📚 [HISTORY] Transcription added to history');
			} catch (error) {
				ExtensionLog.error('❌ [HISTORY] Failed to add transcription to history:', error);
				// Do not interrupt execution if failed to add to history
			}
			
			// Show inserting state
			statusBarManager.showInserting();
			
			if (recordingState.mode === RecordingMode.INSERT_OR_CLIPBOARD) {
				ExtensionLog.info('📝 Processing insertOrClipboard mode...');
				
				try {
					// Read insert mode from ModeSelectorProvider
					const insertMode = modeSelectorProvider.getCurrentMode();
					
					if (insertMode === 'insert') {
						// Insert mode at cursor position
						ExtensionLog.info('📝 Inserting into active editor at cursor position');
						await insertTranscribedTextWithErrorHandling(lastTranscribedText, 'cursor', context);
						
						// Show success
						const truncatedText = lastTranscribedText.substring(0, 50) + (lastTranscribedText.length > 50 ? '...' : '');
						statusBarManager.showSuccess(`Inserted: "${truncatedText}"`);
						vscode.window.showInformationMessage(`✅ Transcribed and inserted at cursor: "${truncatedText}"`);
						
					} else if (insertMode === 'clipboard') {
						// Copy to clipboard mode
						ExtensionLog.info('📋 [CLIPBOARD_MODE] Copying to clipboard');
						await vscode.env.clipboard.writeText(lastTranscribedText);
						
						// Show success
						const truncatedText = lastTranscribedText.substring(0, 50) + (lastTranscribedText.length > 50 ? '...' : '');
						statusBarManager.showSuccess(`Copied: "${truncatedText}"`);
						vscode.window.showInformationMessage(`✅ Transcribed and copied to clipboard: "${truncatedText}"`);
					} else {
						ExtensionLog.error(`❌ Unknown insertMode: ${insertMode}`);
						vscode.window.showErrorMessage(`Unknown insert mode: ${insertMode}`);
					}
					
					// Reset mode
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
				
				// Check insert mode - if clipboard, then do not send to chat
				const insertMode = modeSelectorProvider.getCurrentMode();
				
				if (insertMode === 'clipboard') {
					// Copy to clipboard mode - ignore chat
					ExtensionLog.info('📋 [CLIPBOARD_MODE] F9/Ctrl+Shift+N in clipboard mode - copying to clipboard instead of chat');
					await vscode.env.clipboard.writeText(lastTranscribedText);
					
					// Show success
					const truncatedText = lastTranscribedText.substring(0, 50) + (lastTranscribedText.length > 50 ? '...' : '');
					statusBarManager.showSuccess(`Copied: "${truncatedText}"`);
					vscode.window.showInformationMessage(`✅ Transcribed and copied to clipboard: "${truncatedText}"`);
					
					// Reset mode
					RecordingStateManager.resetState();
					return;
				}
				
				try {
					// Execute command to open new chat
					ExtensionLog.info('🎯 [CHAT] Executing aichat.newfollowupaction...');
					await vscode.commands.executeCommand('aichat.newfollowupaction');
					
					// Delay 300ms
					await new Promise(resolve => setTimeout(resolve, 300));
					
					// Insert text into new chat
					await vscode.env.clipboard.writeText(lastTranscribedText);
					await vscode.commands.executeCommand('editor.action.clipboardPasteAction');
					
					// Show success
					const truncatedText = lastTranscribedText.substring(0, 50) + (lastTranscribedText.length > 50 ? '...' : '');
					statusBarManager.showSuccess(`Opened new chat: "${truncatedText}"`);
					vscode.window.showInformationMessage(`✅ Transcribed and opened new chat: "${truncatedText}"`);
					
					// Reset mode
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
			// Empty transcription processing
			await errorHandler.handleError(ErrorType.TRANSCRIPTION_EMPTY, context);
		}
		
	} catch (error) {
		ExtensionLog.error(`❌ Transcription failed:`, error);
		await errorHandler.handleErrorFromException(error as Error, context);
	}
}

/**
 * Insert transcribed text with error handling
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
		
		// Use retry for text insertion
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
 * Inserting the last transcription
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
			// Send to Cursor chat
			if (!cursorIntegration || !cursorIntegration.isIntegrationEnabled()) {
				throw new Error('Cursor integration not available');
			}
			
			await cursorIntegration.sendToChat(lastTranscribedText);
			ExtensionLog.info('✅ Text sent to Cursor chat');
			
		} else if (mode === 'newChat') {
			// Send to new chat through CursorIntegration
			await cursorIntegration.sendToChat(lastTranscribedText);
			ExtensionLog.info('✅ Text sent to new chat');
			
		} else {
			// Insert into editor
			await insertTranscribedTextWithErrorHandling(lastTranscribedText, mode, context);
		}
		
	} catch (error) {
		ExtensionLog.error(`❌ Failed to insert last transcription (mode: ${mode}):`, error);
		await errorHandler.handleErrorFromException(error as Error, context);
	}
}

/**
 * Initializing WhisperClient
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
	// Force show StatusBar
	statusBarManager.show();
	
	const uiConfig = configurationManager.getUIConfiguration();
	
	if (!uiConfig.showStatusBar) {
		statusBarManager.hide();
	}
	
	// Show a brief guide on first launch
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
 * Deactivation function for the extension
 */
export function deactivate() {
	ExtensionLog.info('Extension deactivating...');
	
	// Stop recording if active
	if (audioRecorder && audioRecorder.getIsRecording()) {
		audioRecorder.stopRecording();
	}

	// Clean up resources
	if (statusBarManager) {
		statusBarManager.dispose();
	}
	
	if (configurationManager) {
		configurationManager.dispose();
	}
	
	if (cursorIntegration) {
		cursorIntegration.dispose();
	}
	
	if (transcriptionHistoryProvider) {
		transcriptionHistoryProvider.dispose();
	}
	
	// Release global logging resources
	disposeGlobalOutput();
	
	ExtensionLog.info('Extension deactivated');
}

/**
 * Initializing Cursor integration
 */
function initializeCursorIntegration(): void {
	ExtensionLog.info('🔧 Initializing Cursor integration...');
	
	// Use default strategy
	const primaryStrategy = CursorIntegrationStrategy.AICHAT_COMMAND;
	
	ExtensionLog.info(`🎯 Using Cursor integration strategy: ${primaryStrategy}`);
	
	// Create CursorIntegration instance
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
 * Command to record and insert into cursor or clipboard (Ctrl+Shift+M)
 */
async function recordAndInsertOrClipboard(): Promise<void> {
	ExtensionLog.info('🎤 recordAndInsertOrClipboard called!');
	
	const context: ErrorContext = {
		operation: 'record_and_insert_or_clipboard',
		isHoldToRecordMode: false,
		timestamp: new Date()
	};

	try {
		// Check if recording is already in progress
		if (RecordingStateManager.isRecording()) {
			// Stop recording
			ExtensionLog.info('⏹️ Stopping recording (recordAndInsertOrClipboard)');
			stopRecording();
			return;
		}

		// Check minimum interval between attempts
		const now = Date.now();
		if (now - lastRecordingStartTime < MIN_RECORDING_INTERVAL) {
			ExtensionLog.info('⚠️ Too frequent recording attempts, skipping');
			vscode.window.showWarningMessage('Too frequent recording attempts. Please wait a moment.');
			return;
		}

		ExtensionLog.info('🎤 Starting record and insert or clipboard...');
		
		// Start recording with INSERT_OR_CLIPBOARD mode
		if (RecordingStateManager.startRecording(RecordingMode.INSERT_OR_CLIPBOARD)) {
			// Do not update StatusBar here - will be updated in onRecordingStart event
			
			// Set the time of the recording attempt
			lastRecordingStartTime = now;
			
			await startRecording();
		} else {
			vscode.window.showWarningMessage('Recording already in progress or too frequent attempts');
		}
		
	} catch (error) {
		ExtensionLog.error('❌ Record and insert or clipboard failed:', error);
		RecordingStateManager.resetState();
		// Reset StatusBar on error
		if (statusBarManager) {
			statusBarManager.updateRecordingState(false);
		}
		await errorHandler.handleErrorFromException(error as Error, context);
	}
}

/**
 * Command to record and open new chat in Cursor (Ctrl+Shift+N)
 */
async function recordAndOpenNewChat(): Promise<void> {
	ExtensionLog.info('🎤 [COMMAND] recordAndOpenNewChat called!');
	
	const context: ErrorContext = {
		operation: 'record_and_open_new_chat',
		isHoldToRecordMode: false,
		timestamp: new Date()
	};

	try {
		// Check if recording is already in progress
		if (RecordingStateManager.isRecording()) {
			ExtensionLog.info('⏹️ [COMMAND] Stopping recording (recordAndOpenNewChat)');
			stopRecording();
			return;
		}

		// Check minimum interval between attempts
		const now = Date.now();
		if (now - lastRecordingStartTime < MIN_RECORDING_INTERVAL) {
			ExtensionLog.info('⚠️ [COMMAND] Too frequent recording attempts, skipping');
			vscode.window.showWarningMessage('Too frequent recording attempts. Please wait a moment.');
			return;
		}

		ExtensionLog.info('🎤 [COMMAND] Starting record and open new chat...');
		
		// Start recording with NEW_CHAT mode
		if (RecordingStateManager.startRecording(RecordingMode.NEW_CHAT)) {
			// Do not update StatusBar here - will be updated in onRecordingStart event
			
			// Set the time of the recording attempt
			lastRecordingStartTime = now;
			
			await startRecording();
			
		} else {
			ExtensionLog.info('❌ [COMMAND] Failed to start recording state');
			vscode.window.showWarningMessage('Recording already in progress or too frequent attempts');
		}
		
	} catch (error) {
		ExtensionLog.error('❌ [COMMAND] recordAndOpenNewChat failed:', error);
		
		// Reset state on error
		RecordingStateManager.resetState();
		
		// Reset StatusBar on error
		if (statusBarManager) {
			statusBarManager.updateRecordingState(false);
		}
		
		await errorHandler.handleErrorFromException(error as Error, context);
	}
}

/**
 * Recording commands
 */
async function startRecording(): Promise<void> {
	ExtensionLog.info('▶️ [RECORDING] Starting recording process...');
	
	const context: ErrorContext = {
		operation: 'start_recording',
		isHoldToRecordMode: false,
		timestamp: new Date()
	};

	try {
		// Ensure initialization of FFmpeg Audio Recorder
		console.time('ensureFFmpegAudioRecorder');
		await ensureFFmpegAudioRecorder();
		console.timeEnd('ensureFFmpegAudioRecorder');
		
		// Check that audioRecorder is initialized
		if (!audioRecorder) {
			ExtensionLog.error('❌ [RECORDING] audioRecorder is null after initialization');
			RecordingStateManager.resetState();
			vscode.window.showErrorMessage('❌ Failed to initialize audio recorder');
			return;
		}
		
		// Check if recording is already in progress
		if (audioRecorder.getIsRecording()) {
			ExtensionLog.info('⚠️ [RECORDING] Recording already in progress, skipping');
			return;
		}
		
		// Check microphone state with retry
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
		
		// Reset recording state on any error
		RecordingStateManager.resetState();
		
		await errorHandler.handleErrorFromException(error as Error, context);
	}
}

function stopRecording(): void {
	try {
		ExtensionLog.info('⏹️ [RECORDING] Stopping recording...');
		
		// Stop recording but keep mode for transcription
		const previousMode = RecordingStateManager.stopRecordingKeepMode();
		
		// Update StatusBar
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
		// Reset state only on error
		RecordingStateManager.resetState();
		// Update StatusBar on error
		if (statusBarManager) {
			statusBarManager.updateRecordingState(false);
		}
		vscode.window.showErrorMessage(`Failed to stop recording: ${(error as Error).message}`);
	}
}

/**
 * Ensuring initialization of FFmpeg Audio Recorder
 */
async function ensureFFmpegAudioRecorder(): Promise<void> {
	if (audioRecorder) { // Already initialized
		return; // Already initialized
	}

	ExtensionLog.info('🔧 Initializing FFmpeg Audio Recorder...');
	
	try {
		// Check FFmpeg availability
		const ffmpegCheck = await FFmpegAudioRecorder.checkFFmpegAvailability();
		
		if (!ffmpegCheck.available) {
			const errorMsg = `FFmpeg not available: ${ffmpegCheck.error || 'Unknown error'}`;
			ExtensionLog.error('❌ FFmpeg check failed:', errorMsg);
			vscode.window.showErrorMessage(`❌ FFmpeg Error: ${errorMsg}`);
			throw new Error(errorMsg);
		}
		
		ExtensionLog.info('✅ FFmpeg is available, version:', ffmpegCheck.version);
		
		// Get audio settings
		const audioConfig = configurationManager.getAudioConfiguration();
		
		// Define quality parameters
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
		
		// Events for AudioRecorder
		const audioRecorderEvents: AudioRecorderEvents = {
			onRecordingStart: () => {
				ExtensionLog.info('🎤 AudioRecorder event: onRecordingStart');
				if (statusBarManager) {
					statusBarManager.updateRecordingState(true);
				}
			},
			onRecordingStop: async (audioBlob: Blob) => {
				ExtensionLog.info('⏹️ AudioRecorder event: onRecordingStop, blob size:', audioBlob.size);
				
				// Update StatusBar
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
			channelCount: 1, // Mono for speech
			audioFormat: 'wav' as const,
			codec: 'pcm_s16le',
			maxDuration: audioConfig.maxRecordingDuration,
			ffmpegPath: audioConfig.ffmpegPath || undefined,
			silenceDetection: audioConfig.silenceDetection,
			silenceDuration: audioConfig.silenceDuration,
			silenceThreshold: audioConfig.silenceThreshold // Removed automatic minus
		};
		
		// Create new instance of audio recorder
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