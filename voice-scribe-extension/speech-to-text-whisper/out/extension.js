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
let audioRecorder;
let whisperClient;
let textInserter;
let statusBarManager;
// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
function activate(context) {
    console.log('VoiceScribe extension is now active!');
    // Инициализируем компоненты
    textInserter = new TextInserter_1.TextInserter();
    // События для AudioRecorder
    const audioRecorderEvents = {
        onRecordingStart: () => {
            statusBarManager.updateRecordingState(true);
            vscode.window.showInformationMessage('Recording started...');
        },
        onRecordingStop: async (audioBlob) => {
            statusBarManager.updateRecordingState(false);
            await handleTranscription(audioBlob);
        },
        onError: (error) => {
            statusBarManager.showError(error.message);
            vscode.window.showErrorMessage(`Recording error: ${error.message}`);
        }
    };
    // События для StatusBar
    const statusBarEvents = {
        onRecordingToggle: () => {
            toggleRecording();
        }
    };
    audioRecorder = new AudioRecorder_1.AudioRecorder(audioRecorderEvents);
    statusBarManager = new StatusBarManager_1.StatusBarManager(statusBarEvents);
    // Регистрируем команды
    const startRecordingCommand = vscode.commands.registerCommand('voiceScribe.startRecording', startRecording);
    const stopRecordingCommand = vscode.commands.registerCommand('voiceScribe.stopRecording', stopRecording);
    const toggleRecordingCommand = vscode.commands.registerCommand('voiceScribe.toggleRecording', toggleRecording);
    // Добавляем команды в подписки
    context.subscriptions.push(startRecordingCommand, stopRecordingCommand, toggleRecordingCommand, statusBarManager);
    // Инициализируем WhisperClient при первом использовании
    initializeWhisperClient();
}
async function startRecording() {
    try {
        await audioRecorder.startRecording();
    }
    catch (error) {
        vscode.window.showErrorMessage(`Failed to start recording: ${error.message}`);
    }
}
function stopRecording() {
    try {
        audioRecorder.stopRecording();
    }
    catch (error) {
        vscode.window.showErrorMessage(`Failed to stop recording: ${error.message}`);
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
async function handleTranscription(audioBlob) {
    try {
        statusBarManager.showTranscribing();
        if (!whisperClient) {
            initializeWhisperClient();
            if (!whisperClient) {
                throw new Error('API key not configured');
            }
        }
        const config = vscode.workspace.getConfiguration('voiceScribe');
        const language = config.get('language');
        const insertMode = config.get('insertMode', 'cursor');
        const transcriptionOptions = {
            language: language === 'auto' ? undefined : language
        };
        const transcribedText = await whisperClient.transcribe(audioBlob, transcriptionOptions);
        if (transcribedText.trim()) {
            await insertTranscribedText(transcribedText.trim(), insertMode);
            statusBarManager.showSuccess();
            vscode.window.showInformationMessage(`Transcribed: "${transcribedText.substring(0, 50)}${transcribedText.length > 50 ? '...' : ''}"`);
        }
        else {
            throw new Error('No speech detected');
        }
    }
    catch (error) {
        const errorMessage = error.message;
        statusBarManager.showError(errorMessage);
        vscode.window.showErrorMessage(`Transcription failed: ${errorMessage}`);
    }
}
async function insertTranscribedText(text, mode) {
    switch (mode) {
        case 'comment':
            await textInserter.insertAsComment(text);
            break;
        case 'replace':
            await textInserter.replaceSelection(text);
            break;
        case 'cursor':
        default:
            await textInserter.insertAtCursor(text);
            break;
    }
}
function initializeWhisperClient() {
    const config = vscode.workspace.getConfiguration('voiceScribe');
    const apiKey = config.get('apiKey');
    if (!apiKey) {
        vscode.window.showWarningMessage('OpenAI API key not configured. Please set it in Settings.', 'Open Settings').then(selection => {
            if (selection === 'Open Settings') {
                vscode.commands.executeCommand('workbench.action.openSettings', 'voiceScribe.apiKey');
            }
        });
        return;
    }
    if (!WhisperClient_1.WhisperClient.validateApiKey(apiKey)) {
        vscode.window.showErrorMessage('Invalid OpenAI API key format.');
        return;
    }
    whisperClient = new WhisperClient_1.WhisperClient({
        apiKey,
        timeout: 30000,
        maxRetries: 3,
        retryDelay: 1000
    });
}
// This method is called when your extension is deactivated
function deactivate() {
    if (audioRecorder && audioRecorder.getIsRecording()) {
        audioRecorder.stopRecording();
    }
}
//# sourceMappingURL=extension.js.map