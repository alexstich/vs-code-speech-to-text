"use strict";
// StatusBarManager.ts - управление элементами интерфейса в статус-баре VS Code
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
exports.StatusBarManager = void 0;
const vscode = __importStar(require("vscode"));
class StatusBarManager {
    events;
    statusBarItem;
    isRecording = false;
    constructor(events) {
        this.events = events;
        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
        this.statusBarItem.command = 'voiceScribe.toggleRecording';
        this.updateUI();
        this.statusBarItem.show();
    }
    updateRecordingState(isRecording) {
        this.isRecording = isRecording;
        this.updateUI();
    }
    updateUI() {
        if (this.isRecording) {
            this.statusBarItem.text = '$(record) Recording...';
            this.statusBarItem.tooltip = 'Click to stop recording (or press F9)';
            this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
        }
        else {
            this.statusBarItem.text = '$(mic) Voice';
            this.statusBarItem.tooltip = 'Click to start voice recording (or press F9)';
            this.statusBarItem.backgroundColor = undefined;
        }
    }
    showTranscribing() {
        this.statusBarItem.text = '$(sync~spin) Transcribing...';
        this.statusBarItem.tooltip = 'Processing audio...';
        this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.prominentBackground');
    }
    showError(message) {
        this.statusBarItem.text = '$(error) Voice Error';
        this.statusBarItem.tooltip = `Error: ${message}`;
        this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
        // Возвращаем к нормальному состоянию через 3 секунды
        setTimeout(() => {
            this.updateUI();
        }, 3000);
    }
    showSuccess() {
        const originalText = this.statusBarItem.text;
        this.statusBarItem.text = '$(check) Voice Done';
        this.statusBarItem.tooltip = 'Text successfully inserted';
        this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.prominentBackground');
        // Возвращаем к нормальному состоянию через 2 секунды
        setTimeout(() => {
            this.updateUI();
        }, 2000);
    }
    dispose() {
        this.statusBarItem.dispose();
    }
}
exports.StatusBarManager = StatusBarManager;
//# sourceMappingURL=StatusBarManager.js.map