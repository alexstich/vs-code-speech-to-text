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
import { PostProcessingService } from './core/PostProcessingService';
import { TextProcessingPipeline } from './core/TextProcessingPipeline';

/**
 * Recording modes for the new command architecture
 */
enum RecordingMode {
	INSERT_OR_CLIPBOARD = 'insertOrClipboard',  // Ctrl+Shift+M - insert into cursor or clipboard
	INSERT_AT_CURRENT_CHAT = 'insertAtCurrentChat' // Ctrl+Shift+N - insert into current chat Cursor
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

// Post-processing services
let postProcessingService: PostProcessingService;
let textProcessingPipeline: TextProcessingPipeline;

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
			return false;
		}

		// Setting the state
		const now = Date.now();
		recordingState = {
			isRecording: true,
			mode: mode,
			startTime: now
		};

		return true;
	}

	/**
	 * Stopping recording
	 */
	static stopRecording(): RecordingMode | null {
		if (!recordingState.isRecording) {
			return null;
		}

		const mode = recordingState.mode;
		recordingState = {
			isRecording: false,
			mode: null,
			startTime: null
		};

		return mode;
	}

	/**
	 * Stopping recording with mode preservation (for transcription)
	 */
	static stopRecordingKeepMode(): RecordingMode | null {
		if (!recordingState.isRecording) {
			return null;
		}

		const mode = recordingState.mode;
		recordingState.isRecording = false;
		// mode and startTime remain for transcription processing

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
	
	// Initialize the global logging system
	initializeGlobalOutput(outputChannel);
	
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
		
		// Show the welcome message and StatusBar
		showWelcomeMessage();
		
		// Add a listener for configuration changes
		configurationManager.addChangeListener((config) => {
			// Reinitialize the WhisperClient when settings change
			initializeWhisperClient();
			
			// Recreate TextProcessingPipeline with new whisperClient
			textProcessingPipeline = new TextProcessingPipeline(
				whisperClient,
				postProcessingService,
				textInserter,
				configurationManager
			);
			
			// Reset the audioRecorder when audio settings change
			audioRecorder = null;
			
			// Update the visibility of the StatusBar
			if (config.ui.showStatusBar) {
				statusBarManager.show();
			} else {
				statusBarManager.hide();
			}
		});
		
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
	// Create an ErrorHandler with the VS Code display handler
	errorHandler = new ErrorHandler(new VSCodeErrorDisplayHandler());
	
	// Create a RetryManager
	retryManager = new RetryManager(errorHandler);
}

/**
 * Initializing all extension components
 */
function initializeComponents(): void {
	// Initialize the ConfigurationManager
	configurationManager = ConfigurationManager.getInstance();
	
	// Initialize the WhisperClient first
	initializeWhisperClient();
	
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
	
	// Initialize post-processing services
	// Note: OpenAIPostProcessor will be initialized lazily when needed
	postProcessingService = new PostProcessingService(configurationManager);
	
	// Initialize TextProcessingPipeline with initialized whisperClient
	textProcessingPipeline = new TextProcessingPipeline(
		whisperClient,
		postProcessingService,
		textInserter,
		configurationManager
	);
}

/**
 * Registering extension commands
 */
function registerCommands(context: vscode.ExtensionContext): void {
	
	const commands = [
		// Main recording commands
		vscode.commands.registerCommand('speechToTextWhisper.recordAndInsertOrClipboard', recordAndInsertOrClipboard),
		vscode.commands.registerCommand('speechToTextWhisper.recordAndOpenCurrentChat', recordAndOpenCurrentChat),
		// Diagnostics command
		vscode.commands.registerCommand('speechToTextWhisper.runDiagnostics', () => diagnosticsProvider.runAllDiagnostics()),
		// FFmpeg test command
		vscode.commands.registerCommand('speechToTextWhisper.testFFmpeg', async () => {
			try {
				const ffmpegCheck = await FFmpegAudioRecorder.checkFFmpegAvailability();
				
				if (ffmpegCheck.available) {
					vscode.window.showInformationMessage(`✅ FFmpeg is available! Version: ${ffmpegCheck.version}`);
				} else {
					vscode.window.showErrorMessage(`❌ FFmpeg not available: ${ffmpegCheck.error}`);
				}
				
				// Try diagnostics
				const diagnostics = await FFmpegAudioRecorder.runDiagnostics();
				
				const deviceCount = diagnostics.inputDevices.length;
				const errorCount = diagnostics.errors.length;
				const warningCount = diagnostics.warnings.length;
				
				vscode.window.showInformationMessage(`FFmpeg Diagnostics: ${deviceCount} devices, ${errorCount} errors, ${warningCount} warnings`);
				
			} catch (error) {
				const errorMsg = `FFmpeg test failed: ${(error as Error).message}`;
				ExtensionLog.error('❌ FFmpeg test failed: ' + errorMsg);
				vscode.window.showErrorMessage(errorMsg);
			}
		}),
		// AudioRecorder initialization test command
		vscode.commands.registerCommand('speechToTextWhisper.testAudioRecorder', async () => {
			try {
				// Reset the current audioRecorder
				audioRecorder = null;
				
				// Try to initialize
				await ensureFFmpegAudioRecorder();
				
				if (audioRecorder) {
					vscode.window.showInformationMessage('✅ Audio Recorder initialized successfully!');
				} else {
					vscode.window.showErrorMessage('❌ Audio Recorder is still null after initialization');
					ExtensionLog.error('❌ Audio Recorder test failed');
				}
				
			} catch (error) {
				const errorMsg = `Audio Recorder test failed: ${(error as Error).message}`;
				ExtensionLog.error('❌ Audio Recorder test failed: ' + errorMsg);
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
}

/**
 * Handling transcription using TextProcessingPipeline
 */
async function handleTranscription(audioBlob: Blob): Promise<void> {
	const context: ErrorContext = {
		operation: 'transcription',
		isHoldToRecordMode: false,
		timestamp: new Date(),
		additionalData: { audioBlobSize: audioBlob.size }
	};

	try {
		const recordingState = RecordingStateManager.getState();
		
		if (!recordingState.mode) {
			return;
		}

		if (!textProcessingPipeline) {
			ExtensionLog.error('❌ TextProcessingPipeline not initialized');
			throw new Error('TextProcessingPipeline not initialized');
		}

		// Determine insertion mode based on recording mode and current mode selector
		let insertionMode: 'cursor' | 'clipboard' = 'cursor';
		let skipTextInsertion = false; // Flag to skip text insertion in pipeline for special modes
		
		if (recordingState.mode === RecordingMode.INSERT_OR_CLIPBOARD) {
			const currentMode = modeSelectorProvider.getCurrentMode();
			insertionMode = currentMode === 'clipboard' ? 'clipboard' : 'cursor';
		} else if (recordingState.mode === RecordingMode.INSERT_AT_CURRENT_CHAT) {
			const currentMode = modeSelectorProvider.getCurrentMode();
			if (currentMode === 'clipboard') {
				insertionMode = 'clipboard';
			} else {
				// For chat mode, we'll handle text insertion specially after pipeline
				// Skip text insertion in the pipeline
				skipTextInsertion = true;
				insertionMode = 'cursor'; // This won't be used, but needed for the pipeline interface
			}
		}

		// Progress callback for status updates
		const progressCallback = (progress: any) => {
			if (progress.currentStep === 'Transcribing audio...') {
				statusBarManager.showTranscribing();
			} else if (progress.currentStep === 'Improving text quality...') {
				statusBarManager.showPostProcessing();
			} else if (progress.currentStep === 'Inserting text...') {
				statusBarManager.showInserting();
			}
		};

		// Execute the complete pipeline
		console.time('complete.pipeline');
		const pipelineResult = await textProcessingPipeline.processAudio(
			audioBlob,
			insertionMode,
			progressCallback,
			skipTextInsertion // Pass the flag to skip text insertion
		);
		console.timeEnd('complete.pipeline');

		if (pipelineResult.success) {
			lastTranscribedText = pipelineResult.finalText;
			
			// Add entry to transcription history with post-processing info
			try {
				const duration = recordingState.startTime ? Date.now() - recordingState.startTime : 0;
				const whisperConfig = configurationManager.getWhisperConfiguration();
				const language = whisperConfig.language === 'auto' ? 'auto' : whisperConfig.language;
				
				await transcriptionHistoryManager.addEntry({
					text: pipelineResult.finalText,
					duration: duration,
					language: language,
					mode: recordingState.mode as any,
					// Post-processing fields
					originalText: pipelineResult.postProcessingResult?.originalText,
					isPostProcessed: pipelineResult.postProcessingResult?.wasProcessed || false,
					postProcessingModel: pipelineResult.postProcessingResult?.model
				});
				
				// Update UI history
				transcriptionHistoryProvider.refresh();
			} catch (error) {
				ExtensionLog.error('❌ Failed to add transcription to history:', undefined, error as Error);
				// Do not interrupt execution if failed to add to history
			}

			// Handle special case for chat mode (when text insertion was skipped in pipeline)
			if (skipTextInsertion && recordingState.mode === RecordingMode.INSERT_AT_CURRENT_CHAT) {
				try {
					// Execute command to open current chat
					await vscode.commands.executeCommand('aichat.newfollowupaction');
					
					// Delay 300ms
					await new Promise(resolve => setTimeout(resolve, 300));
					
					// Insert text into current chat
					await vscode.env.clipboard.writeText(pipelineResult.finalText);
					await vscode.commands.executeCommand('editor.action.clipboardPasteAction');
					
					// Show success
					const truncatedText = pipelineResult.finalText.substring(0, 50) + (pipelineResult.finalText.length > 50 ? '...' : '');
					const postProcessedIcon = pipelineResult.postProcessingResult?.wasProcessed ? ' ✨' : '';
					statusBarManager.showSuccess(`Opened current chat: "${truncatedText}"${postProcessedIcon}`);
					vscode.window.showInformationMessage(`✅ Transcribed and opened current chat: "${truncatedText}"${postProcessedIcon}`);
					
				} catch (error) {
					ExtensionLog.error(`❌ Failed to open current chat:`, undefined, error as Error);
					vscode.window.showErrorMessage(`Failed to open current chat: ${(error as Error).message}`);
				}
			} else {
				// Show success for normal insertion modes (when text was inserted by pipeline)
				const truncatedText = pipelineResult.finalText.substring(0, 50) + (pipelineResult.finalText.length > 50 ? '...' : '');
				const postProcessedIcon = pipelineResult.postProcessingResult?.wasProcessed ? ' ✨' : '';
				const modeText = insertionMode === 'clipboard' ? 'copied to clipboard' : 'inserted at cursor';
				
				statusBarManager.showSuccess(`${modeText.charAt(0).toUpperCase() + modeText.slice(1)}: "${truncatedText}"${postProcessedIcon}`);
				vscode.window.showInformationMessage(`✅ Transcribed and ${modeText}: "${truncatedText}"${postProcessedIcon}`);
			}
			
			// Reset mode
			RecordingStateManager.resetState();
			
		} else {
			// Pipeline failed
			const error = pipelineResult.error || new Error('Pipeline processing failed');
			ExtensionLog.error(`❌ Pipeline failed:`, undefined, error);
			
			// Reset StatusBar on pipeline failure
			if (statusBarManager) {
				statusBarManager.showError(`Transcription failed: ${error.message}`);
				// Ensure status resets after a delay
				setTimeout(() => {
					statusBarManager.updateRecordingState(false);
				}, 3000);
			}
			
			await errorHandler.handleErrorFromException(error, context);
			RecordingStateManager.resetState();
		}
		
	} catch (error) {
		ExtensionLog.error(`❌ Transcription pipeline failed:`, undefined, error as Error);
		
		// Reset StatusBar on error
		if (statusBarManager) {
			statusBarManager.showError(`Pipeline failed: ${(error as Error).message}`);
			// Ensure status resets after a delay
			setTimeout(() => {
				statusBarManager.updateRecordingState(false);
			}, 3000);
		}
		
		await errorHandler.handleErrorFromException(error as Error, context);
		RecordingStateManager.resetState();
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
		// Use retry for text insertion
		const insertResult = await retryManager.retry(
			() => textInserter.insertText(text, { mode: mode as 'cursor' | 'clipboard' }),
			'text_insertion'
		);

		if (!insertResult.success) {
			const error = insertResult.lastError || new Error('Text insertion failed after retries');
			await errorHandler.handleErrorFromException(error, context);
		}
		
	} catch (error) {
		ExtensionLog.error(`❌ Text insertion failed:`, undefined, error as Error);
		await errorHandler.handleErrorFromException(error as Error, context);
	}
}

/**
 * Initializing WhisperClient
 */
function initializeWhisperClient(): void {
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
		// Set whisperClient to null if not configured
		whisperClient = null as any;
		return;
	}
	
	try {
		whisperClient = new WhisperClient({
			apiKey: whisperConfig.apiKey,
			timeout: whisperConfig.timeout
		});
		
	} catch (error) {
		ExtensionLog.error('❌ Failed to initialize WhisperClient:', undefined, error as Error);
		vscode.window.showErrorMessage(`Failed to initialize Whisper client: ${(error as Error).message}`);
		// Set whisperClient to null on error
		whisperClient = null as any;
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
				'🎤 Speech to Text with Whisper activated! Use Ctrl+Shift+N to record and send to chat, Ctrl+Shift+M to record to clipboard.',
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
	
	// Dispose post-processing services
	if (postProcessingService) {
		postProcessingService.dispose();
	}
	
	if (textProcessingPipeline) {
		textProcessingPipeline.dispose();
	}
	
	// Release global logging resources
	disposeGlobalOutput();
}

/**
 * Initializing Cursor integration
 */
function initializeCursorIntegration(): void {
	// Use default strategy
	const primaryStrategy = CursorIntegrationStrategy.AICHAT_COMMAND;
	
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
			// Silent success
		},
		onFallbackUsed: (primary: CursorIntegrationStrategy, fallback: CursorIntegrationStrategy) => {
			vscode.window.showWarningMessage(`Cursor chat: fell back to ${fallback} strategy`);
		},
		onError: (error: Error, strategy: CursorIntegrationStrategy) => {
			ExtensionLog.error(`❌ CursorIntegration error with ${strategy}:`, undefined, error);
		}
	});
}

/**
 * Command to record and insert into cursor or clipboard (Ctrl+Shift+M)
 */
async function recordAndInsertOrClipboard(): Promise<void> {
	const context: ErrorContext = {
		operation: 'record_and_insert_or_clipboard',
		isHoldToRecordMode: false,
		timestamp: new Date()
	};

	try {
		// Check if recording is already in progress
		if (RecordingStateManager.isRecording()) {
			// Stop recording
			stopRecording();
			return;
		}

		// Check minimum interval between attempts
		const now = Date.now();
		if (now - lastRecordingStartTime < MIN_RECORDING_INTERVAL) {
			vscode.window.showWarningMessage('Too frequent recording attempts. Please wait a moment.');
			return;
		}
		
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
		ExtensionLog.error('❌ Record and insert or clipboard failed:', undefined, error as Error);
		RecordingStateManager.resetState();
		// Reset StatusBar on error
		if (statusBarManager) {
			statusBarManager.updateRecordingState(false);
		}
		await errorHandler.handleErrorFromException(error as Error, context);
	}
}

/**
 * Command to record and open current chat in Cursor (Ctrl+Shift+N)
 */
async function recordAndOpenCurrentChat(): Promise<void> {
	const context: ErrorContext = {
		operation: 'record_and_open_current_chat',
		isHoldToRecordMode: false,
		timestamp: new Date()
	};

	try {
		// Check if recording is already in progress
		if (RecordingStateManager.isRecording()) {
			stopRecording();
			return;
		}

		// Check minimum interval between attempts
		const now = Date.now();
		if (now - lastRecordingStartTime < MIN_RECORDING_INTERVAL) {
			vscode.window.showWarningMessage('Too frequent recording attempts. Please wait a moment.');
			return;
		}

		// Start recording with INSERT_AT_CURRENT_CHAT mode
		if (RecordingStateManager.startRecording(RecordingMode.INSERT_AT_CURRENT_CHAT)) {
			// Do not update StatusBar here - will be updated in onRecordingStart event
			
			// Set the time of the recording attempt
			lastRecordingStartTime = now;
			
			await startRecording();
			
		} else {
			vscode.window.showWarningMessage('Recording already in progress or too frequent attempts');
		}
		
	} catch (error) {
		ExtensionLog.error('❌ recordAndOpenCurrentChat failed:', undefined, error as Error);
		
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
			ExtensionLog.error('❌ audioRecorder is null after initialization');
			RecordingStateManager.resetState();
			vscode.window.showErrorMessage('❌ Failed to initialize audio recorder');
			return;
		}
		
		// Check if recording is already in progress
		if (audioRecorder.getIsRecording()) {
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
			ExtensionLog.error('❌ Microphone check failed:', undefined, error as Error);
			RecordingStateManager.resetState();
			await errorHandler.handleErrorFromException(error, context);
			return;
		}
		
		console.time('audioRecorder.startRecording');
		await audioRecorder.startRecording();
		console.timeEnd('audioRecorder.startRecording');
		
	} catch (error) {
		ExtensionLog.error('❌ Failed to start recording:', undefined, error as Error);
		
		// Reset recording state on any error
		RecordingStateManager.resetState();
		
		await errorHandler.handleErrorFromException(error as Error, context);
	}
}

function stopRecording(): void {
	try {
		// Stop recording but keep mode for transcription
		const previousMode = RecordingStateManager.stopRecordingKeepMode();
		
		// Update StatusBar
		if (statusBarManager) {
			statusBarManager.updateRecordingState(false);
		}
		
		if (!audioRecorder) {
			return;
		}
		
		console.time('audioRecorder.stopRecording');
		audioRecorder.stopRecording();
		console.timeEnd('audioRecorder.stopRecording');
		
	} catch (error) {
					ExtensionLog.error('❌ [RECORDING] Failed to stop recording:', undefined, error as Error);
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
	
	try {
		// Check FFmpeg availability
		const ffmpegCheck = await FFmpegAudioRecorder.checkFFmpegAvailability();
		
		if (!ffmpegCheck.available) {
			const errorMsg = `FFmpeg not available: ${ffmpegCheck.error || 'Unknown error'}`;
			ExtensionLog.error('❌ FFmpeg check failed:', errorMsg);
			vscode.window.showErrorMessage(`❌ FFmpeg Error: ${errorMsg}`);
			throw new Error(errorMsg);
		}
		
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
		
		// Events for AudioRecorder
		const audioRecorderEvents: AudioRecorderEvents = {
			onRecordingStart: () => {
				if (statusBarManager) {
					statusBarManager.updateRecordingState(true);
				}
			},
			onRecordingStop: async (audioBlob: Blob) => {
				// Update StatusBar
				if (statusBarManager) {
					statusBarManager.updateRecordingState(false);
				}
				
				try {
					await handleTranscription(audioBlob);
				} catch (error) {
					ExtensionLog.error('❌ AudioRecorder event: Error in handleTranscription:', undefined, error as Error);
					vscode.window.showErrorMessage(`Transcription failed: ${(error as Error).message}`);
					RecordingStateManager.resetState();
				}
			},
			onError: (error: Error) => {
				ExtensionLog.error('❌ AudioRecorder event: onError:', undefined, error);
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
		
	} catch (error) {
		ExtensionLog.error('❌ Failed to initialize FFmpeg Audio Recorder:', undefined, error as Error);
		audioRecorder = null;
		
		const errorMessage = `Failed to initialize audio recorder: ${(error as Error).message}`;
		vscode.window.showErrorMessage(errorMessage);
		
		throw error;
	}
}