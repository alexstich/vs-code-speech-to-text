// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { AudioRecorder, AudioRecorderEvents } from './core/AudioRecorder';
import { WhisperClient } from './core/WhisperClient';
import { TextInserter } from './ui/TextInserter';
import { StatusBarManager, StatusBarEvents } from './ui/StatusBarManager';

let audioRecorder: AudioRecorder;
let whisperClient: WhisperClient;
let textInserter: TextInserter;
let statusBarManager: StatusBarManager;

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	console.log('VoiceScribe extension is now active!');

	// Инициализируем компоненты
	textInserter = new TextInserter();
	
	// События для AudioRecorder
	const audioRecorderEvents: AudioRecorderEvents = {
		onRecordingStart: () => {
			statusBarManager.updateRecordingState(true);
			vscode.window.showInformationMessage('Recording started...');
		},
		onRecordingStop: async (audioBlob: Blob) => {
			statusBarManager.updateRecordingState(false);
			await handleTranscription(audioBlob);
		},
		onError: (error: Error) => {
			statusBarManager.showError(error.message);
			vscode.window.showErrorMessage(`Recording error: ${error.message}`);
		}
	};

	// События для StatusBar
	const statusBarEvents: StatusBarEvents = {
		onRecordingToggle: () => {
			toggleRecording();
		}
	};

	audioRecorder = new AudioRecorder(audioRecorderEvents);
	statusBarManager = new StatusBarManager(statusBarEvents);

	// Регистрируем команды
	const startRecordingCommand = vscode.commands.registerCommand(
		'voiceScribe.startRecording',
		startRecording
	);

	const stopRecordingCommand = vscode.commands.registerCommand(
		'voiceScribe.stopRecording',
		stopRecording
	);

	const toggleRecordingCommand = vscode.commands.registerCommand(
		'voiceScribe.toggleRecording',
		toggleRecording
	);

	// Добавляем команды в подписки
	context.subscriptions.push(
		startRecordingCommand,
		stopRecordingCommand,
		toggleRecordingCommand,
		statusBarManager
	);

	// Инициализируем WhisperClient при первом использовании
	initializeWhisperClient();
}

async function startRecording(): Promise<void> {
	try {
		await audioRecorder.startRecording();
	} catch (error) {
		vscode.window.showErrorMessage(`Failed to start recording: ${(error as Error).message}`);
	}
}

function stopRecording(): void {
	try {
		audioRecorder.stopRecording();
	} catch (error) {
		vscode.window.showErrorMessage(`Failed to stop recording: ${(error as Error).message}`);
	}
}

function toggleRecording(): void {
	if (audioRecorder.getIsRecording()) {
		stopRecording();
	} else {
		startRecording();
	}
}

async function handleTranscription(audioBlob: Blob): Promise<void> {
	try {
		// Показываем состояние обработки
		statusBarManager.showProcessing();
		
		if (!whisperClient) {
			initializeWhisperClient();
			if (!whisperClient) {
				throw new Error('API key not configured');
			}
		}

		// Переход к состоянию транскрибации
		statusBarManager.showTranscribing();

		const config = vscode.workspace.getConfiguration('voiceScribe');
		const language = config.get<string>('language');
		const insertMode = config.get<string>('insertMode', 'cursor');

		const transcriptionOptions = {
			language: language === 'auto' ? undefined : language
		};

		const transcribedText = await whisperClient.transcribe(audioBlob, transcriptionOptions);
		
		if (transcribedText.trim()) {
			// Показываем состояние вставки
			statusBarManager.showInserting();
			
			await insertTranscribedText(transcribedText.trim(), insertMode);
			
			// Показываем успех с сообщением
			const truncatedText = transcribedText.substring(0, 50) + (transcribedText.length > 50 ? '...' : '');
			statusBarManager.showSuccess(`Inserted: "${truncatedText}"`);
			vscode.window.showInformationMessage(`Transcribed: "${truncatedText}"`);
		} else {
			throw new Error('No speech detected');
		}

	} catch (error) {
		const errorMessage = (error as Error).message;
		
		// Определяем серьезность ошибки
		let severity: 'warning' | 'error' | 'critical' = 'error';
		if (errorMessage.includes('API key')) {
			severity = 'critical';
		} else if (errorMessage.includes('No speech detected')) {
			severity = 'warning';
		}
		
		statusBarManager.showError(errorMessage, severity);
		vscode.window.showErrorMessage(`Transcription failed: ${errorMessage}`);
	}
}

async function insertTranscribedText(text: string, mode: string): Promise<void> {
	try {
		const config = vscode.workspace.getConfiguration('voiceScribe');
		const formatText = config.get<boolean>('formatText', true);
		const addNewLine = config.get<boolean>('addNewLine', true);
		const indentToSelection = config.get<boolean>('indentToSelection', false);

		await textInserter.insertText(text, {
			mode: mode as 'cursor' | 'comment' | 'replace' | 'newLine' | 'clipboard',
			formatText,
			addNewLine,
			indentToSelection
		});
	} catch (error) {
		const errorMessage = (error as any).message || 'Unknown error';
		vscode.window.showErrorMessage(`Text insertion failed: ${errorMessage}`);
		throw error; // Перебрасываем ошибку для обработки выше
	}
}

function initializeWhisperClient(): void {
	const config = vscode.workspace.getConfiguration('voiceScribe');
	const apiKey = config.get<string>('apiKey');

	if (!apiKey) {
		vscode.window.showWarningMessage(
			'OpenAI API key not configured. Please set it in Settings.',
			'Open Settings'
		).then(selection => {
			if (selection === 'Open Settings') {
				vscode.commands.executeCommand('workbench.action.openSettings', 'voiceScribe.apiKey');
			}
		});
		return;
	}

	if (!WhisperClient.validateApiKey(apiKey)) {
		vscode.window.showErrorMessage('Invalid OpenAI API key format.');
		return;
	}

	whisperClient = new WhisperClient({
		apiKey,
		timeout: 30000,
		maxRetries: 3,
		retryDelay: 1000
	});
}

// This method is called when your extension is deactivated
export function deactivate() {
	if (audioRecorder && audioRecorder.getIsRecording()) {
		audioRecorder.stopRecording();
	}
}
