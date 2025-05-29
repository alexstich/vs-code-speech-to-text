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
/**
 * Управление элементами интерфейса в статус-баре VS Code
 * Предоставляет визуальную обратную связь о состоянии записи и обработки речи
 */
class StatusBarManager {
    events;
    statusBarItem;
    currentState = 'idle';
    isRecording = false;
    lastError = null;
    successTimer = null;
    errorTimer = null;
    progressInterval = null;
    progressStep = 0;
    config;
    // Конфигурация для различных состояний
    stateConfig = {
        idle: {
            text: '$(mic)',
            tooltip: 'Click to start voice recording',
            icon: 'mic',
            command: 'voiceScribe.toggleRecording'
        },
        recording: {
            text: '$(record)',
            tooltip: 'Recording... Click to stop',
            icon: 'record',
            backgroundColor: new vscode.ThemeColor('statusBarItem.warningBackground'),
            command: 'voiceScribe.toggleRecording'
        },
        processing: {
            text: '$(loading~spin)',
            tooltip: 'Processing audio data...',
            icon: 'loading',
            backgroundColor: new vscode.ThemeColor('statusBarItem.prominentBackground')
        },
        transcribing: {
            text: '$(sync~spin)',
            tooltip: 'Transcribing speech to text...',
            icon: 'sync',
            backgroundColor: new vscode.ThemeColor('statusBarItem.prominentBackground')
        },
        inserting: {
            text: '$(edit)',
            tooltip: 'Inserting transcribed text...',
            icon: 'edit',
            backgroundColor: new vscode.ThemeColor('statusBarItem.prominentBackground')
        },
        success: {
            text: '$(check)',
            tooltip: 'Text successfully inserted!',
            icon: 'check',
            backgroundColor: new vscode.ThemeColor('statusBarItem.prominentBackground'),
            color: new vscode.ThemeColor('statusBarItem.prominentForeground')
        },
        error: {
            text: '$(error)',
            tooltip: 'Voice recording error occurred',
            icon: 'error',
            backgroundColor: new vscode.ThemeColor('statusBarItem.errorBackground'),
            color: new vscode.ThemeColor('statusBarItem.errorForeground')
        },
        warning: {
            text: '$(warning)',
            tooltip: 'Voice recording warning',
            icon: 'warning',
            backgroundColor: new vscode.ThemeColor('statusBarItem.warningBackground'),
            color: new vscode.ThemeColor('statusBarItem.warningForeground')
        }
    };
    constructor(events, config = {}) {
        this.events = events;
        this.config = {
            position: config.position || 'right',
            priority: config.priority || 100,
            showTooltips: config.showTooltips !== false,
            autoHideOnSuccess: config.autoHideOnSuccess !== false,
            successDisplayDuration: config.successDisplayDuration || 2000,
            errorDisplayDuration: config.errorDisplayDuration || 3000,
            enableAnimations: config.enableAnimations !== false,
            showProgress: config.showProgress !== false
        };
        this.createStatusBarItem();
        this.updateUI();
        this.show();
    }
    /**
     * Создает элемент статус-бара
     */
    createStatusBarItem() {
        const alignment = this.config.position === 'left'
            ? vscode.StatusBarAlignment.Left
            : vscode.StatusBarAlignment.Right;
        this.statusBarItem = vscode.window.createStatusBarItem(alignment, this.config.priority);
    }
    /**
     * Обновляет состояние записи
     */
    updateRecordingState(isRecording) {
        this.isRecording = isRecording;
        this.setState(isRecording ? 'recording' : 'idle');
    }
    /**
     * Показывает состояние обработки аудио
     */
    showProcessing() {
        this.setState('processing');
        this.startProgressAnimation();
    }
    /**
     * Показывает состояние транскрибации
     */
    showTranscribing() {
        this.setState('transcribing');
        this.startProgressAnimation();
    }
    /**
     * Показывает состояние вставки текста
     */
    showInserting() {
        this.setState('inserting');
    }
    /**
     * Показывает состояние успеха
     */
    showSuccess(message) {
        this.clearTimers();
        this.setState('success');
        if (message) {
            this.updateTooltip(`Success: ${message}`);
        }
        if (this.config.autoHideOnSuccess) {
            this.successTimer = setTimeout(() => {
                this.setState('idle');
            }, this.config.successDisplayDuration);
        }
    }
    /**
     * Показывает состояние ошибки
     */
    showError(message, severity = 'error') {
        this.clearTimers();
        this.lastError = message;
        const state = severity === 'warning' ? 'warning' : 'error';
        this.setState(state);
        this.updateTooltip(`${this.capitalizeFirst(severity)}: ${message}`);
        this.errorTimer = setTimeout(() => {
            this.setState('idle');
            this.lastError = null;
        }, this.config.errorDisplayDuration);
    }
    /**
     * Показывает предупреждение
     */
    showWarning(message) {
        this.showError(message, 'warning');
    }
    /**
     * Обновляет прогресс операции
     */
    updateProgress(percentage, message) {
        if (!this.config.showProgress) {
            return;
        }
        const progressBar = this.createProgressBar(percentage);
        const currentConfig = this.stateConfig[this.currentState];
        this.statusBarItem.text = `${currentConfig.icon} ${progressBar}`;
        if (message && this.config.showTooltips) {
            this.updateTooltip(`${currentConfig.tooltip} (${Math.round(percentage)}%) - ${message}`);
        }
    }
    /**
     * Получает информацию о текущем состоянии
     */
    getStatus() {
        return {
            state: this.currentState,
            isRecording: this.isRecording,
            isVisible: this.statusBarItem ? true : false,
            lastError: this.lastError,
            configuration: this.config
        };
    }
    /**
     * Обновляет конфигурацию
     */
    updateConfiguration(newConfig) {
        Object.assign(this.config, newConfig);
        // Пересоздаем элемент если изменилась позиция
        if (newConfig.position || newConfig.priority !== undefined) {
            const wasVisible = this.statusBarItem ? true : false;
            this.dispose();
            this.createStatusBarItem();
            if (wasVisible) {
                this.show();
            }
        }
        this.updateUI();
    }
    /**
     * Показывает элемент статус-бара
     */
    show() {
        if (this.statusBarItem) {
            this.statusBarItem.show();
        }
    }
    /**
     * Скрывает элемент статус-бара
     */
    hide() {
        if (this.statusBarItem) {
            this.statusBarItem.hide();
        }
    }
    /**
     * Переключает видимость элемента
     */
    toggle() {
        // VS Code API не предоставляет прямой способ проверить видимость
        // Поэтому мы отслеживаем состояние самостоятельно
        if (this.statusBarItem) {
            // Простая реализация: всегда показываем
            this.show();
        }
    }
    /**
     * Устанавливает новое состояние
     */
    setState(newState) {
        if (this.currentState === newState) {
            return;
        }
        this.currentState = newState;
        this.updateUI();
    }
    /**
     * Обновляет UI элемента
     */
    updateUI() {
        if (!this.statusBarItem) {
            return;
        }
        const config = this.stateConfig[this.currentState];
        // Обновляем текст с анимацией если включена
        if (this.config.enableAnimations && this.isAnimatedState()) {
            this.statusBarItem.text = this.getAnimatedText(config);
        }
        else {
            this.statusBarItem.text = config.text;
        }
        // Обновляем tooltip если включен
        if (this.config.showTooltips) {
            this.statusBarItem.tooltip = this.buildTooltip(config);
        }
        // Обновляем цвета
        this.statusBarItem.backgroundColor = config.backgroundColor;
        this.statusBarItem.color = config.color;
        // Обновляем команду
        this.statusBarItem.command = config.command;
    }
    /**
     * Обновляет tooltip
     */
    updateTooltip(tooltip) {
        if (this.config.showTooltips && this.statusBarItem) {
            this.statusBarItem.tooltip = tooltip;
        }
    }
    /**
     * Создает строку прогресса
     */
    createProgressBar(percentage) {
        const totalBlocks = 10;
        const filledBlocks = Math.round((percentage / 100) * totalBlocks);
        const emptyBlocks = totalBlocks - filledBlocks;
        return '█'.repeat(filledBlocks) + '░'.repeat(emptyBlocks);
    }
    /**
     * Проверяет является ли состояние анимированным
     */
    isAnimatedState() {
        return ['recording', 'processing', 'transcribing'].includes(this.currentState);
    }
    /**
     * Получает анимированный текст
     */
    getAnimatedText(config) {
        if (this.currentState === 'recording') {
            const dots = '.'.repeat((this.progressStep % 3) + 1);
            return `${config.text} Recording${dots}`;
        }
        return config.text;
    }
    /**
     * Строит полный tooltip
     */
    buildTooltip(config) {
        let tooltip = config.tooltip;
        // Добавляем дополнительную информацию для разных состояний
        switch (this.currentState) {
            case 'idle':
                tooltip += '\n\nHotkey: F9 (hold to record)';
                tooltip += '\nRight-click for settings';
                break;
            case 'recording':
                tooltip += '\n\nHotkey: F9 (release to stop)';
                break;
            case 'error':
                if (this.lastError) {
                    tooltip += `\n\nLast error: ${this.lastError}`;
                }
                tooltip += '\n\nClick to retry';
                break;
        }
        return tooltip;
    }
    /**
     * Запускает анимацию прогресса
     */
    startProgressAnimation() {
        if (!this.config.enableAnimations) {
            return;
        }
        this.clearProgressAnimation();
        this.progressStep = 0;
        this.progressInterval = setInterval(() => {
            this.progressStep++;
            this.updateUI();
        }, 500);
    }
    /**
     * Останавливает анимацию прогресса
     */
    clearProgressAnimation() {
        if (this.progressInterval) {
            clearInterval(this.progressInterval);
            this.progressInterval = null;
        }
    }
    /**
     * Очищает все таймеры
     */
    clearTimers() {
        if (this.successTimer) {
            clearTimeout(this.successTimer);
            this.successTimer = null;
        }
        if (this.errorTimer) {
            clearTimeout(this.errorTimer);
            this.errorTimer = null;
        }
        this.clearProgressAnimation();
    }
    /**
     * Делает первую букву заглавной
     */
    capitalizeFirst(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }
    /**
     * Освобождает ресурсы
     */
    dispose() {
        this.clearTimers();
        if (this.statusBarItem) {
            this.statusBarItem.dispose();
        }
    }
    /**
     * Статические методы для создания стандартных конфигураций
     */
    /**
     * Создает минимальную конфигурацию
     */
    static createMinimalConfig() {
        return {
            showTooltips: false,
            enableAnimations: false,
            showProgress: false
        };
    }
    /**
     * Создает полную конфигурацию
     */
    static createFullConfig() {
        return {
            position: 'right',
            priority: 100,
            showTooltips: true,
            autoHideOnSuccess: true,
            successDisplayDuration: 2000,
            errorDisplayDuration: 5000,
            enableAnimations: true,
            showProgress: true
        };
    }
    /**
     * Создает конфигурацию для разработки
     */
    static createDebugConfig() {
        return {
            position: 'left',
            priority: 1000,
            showTooltips: true,
            autoHideOnSuccess: false,
            successDisplayDuration: 5000,
            errorDisplayDuration: 10000,
            enableAnimations: true,
            showProgress: true
        };
    }
}
exports.StatusBarManager = StatusBarManager;
//# sourceMappingURL=StatusBarManager.js.map