// StatusBarManager.ts - управление элементами интерфейса в статус-баре VS Code

import * as vscode from 'vscode';

export interface StatusBarEvents {
    onRecordingToggle: () => void;
    onSettings?: () => void;
    onHelp?: () => void;
}

export interface StatusBarConfiguration {
    position?: 'left' | 'right';
    priority?: number;
    showTooltips?: boolean;
    autoHideOnSuccess?: boolean;
    successDisplayDuration?: number;
    errorDisplayDuration?: number;
    enableAnimations?: boolean;
    showProgress?: boolean;
}

export type StatusBarState = 
    | 'idle' 
    | 'recording' 
    | 'processing' 
    | 'transcribing' 
    | 'inserting' 
    | 'success' 
    | 'error' 
    | 'warning';

export interface StatusBarInfo {
    text: string;
    tooltip: string;
    icon: string;
    backgroundColor?: vscode.ThemeColor;
    command?: string;
    color?: vscode.ThemeColor;
}

export interface StatusBarError extends Error {
    code?: string;
    context?: string;
    severity?: 'warning' | 'error' | 'critical';
}

/**
 * Управление элементами интерфейса в статус-баре VS Code
 * Предоставляет визуальную обратную связь о состоянии записи и обработки речи
 */
export class StatusBarManager implements vscode.Disposable {
    private statusBarItem!: vscode.StatusBarItem;
    private currentState: StatusBarState = 'idle';
    private isRecording = false;
    private lastError: string | null = null;
    private successTimer: NodeJS.Timeout | null = null;
    private errorTimer: NodeJS.Timeout | null = null;
    private progressInterval: NodeJS.Timeout | null = null;
    private progressStep = 0;

    private readonly config: Required<StatusBarConfiguration>;
    
    // Конфигурация для различных состояний
    private readonly stateConfig: Record<StatusBarState, StatusBarInfo> = {
        idle: {
            text: '$(mic)',
            tooltip: 'Click to start voice recording',
            icon: 'mic',
            command: 'speechToTextWhisper.recordAndInsertOrClipboard'
        },
        recording: {
            text: '$(sync~spin)',
            tooltip: 'Recording... Click to stop',
            icon: 'sync',
            backgroundColor: new vscode.ThemeColor('statusBarItem.warningBackground'),
            color: new vscode.ThemeColor('statusBarItem.warningForeground'),
            command: 'speechToTextWhisper.recordAndInsertOrClipboard'
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
            backgroundColor: new vscode.ThemeColor('statusBarItem.warningBackground'),
            color: new vscode.ThemeColor('statusBarItem.warningForeground')
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

    constructor(
        private events: StatusBarEvents,
        config: StatusBarConfiguration = {}
    ) {
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
    private createStatusBarItem(): void {
        const alignment = this.config.position === 'left' 
            ? vscode.StatusBarAlignment.Left 
            : vscode.StatusBarAlignment.Right;

        this.statusBarItem = vscode.window.createStatusBarItem(
            alignment,
            this.config.priority
        );
    }

    /**
     * Обновляет состояние записи
     */
    updateRecordingState(isRecording: boolean): void {
        this.isRecording = isRecording;
        if (isRecording) {
            this.setState('recording');
            this.startProgressAnimation(); // Запускаем анимацию для записи
        } else {
            this.clearProgressAnimation(); // Останавливаем анимацию при остановке записи
            this.setState('idle');
        }
    }

    /**
     * Показывает состояние обработки аудио
     */
    showProcessing(): void {
        this.setState('processing');
        this.startProgressAnimation();
    }

    /**
     * Показывает состояние транскрибации
     */
    showTranscribing(): void {
        this.setState('transcribing');
        this.startProgressAnimation();
    }

    /**
     * Показывает состояние вставки текста
     */
    showInserting(): void {
        this.setState('inserting');
    }

    /**
     * Показывает состояние успеха
     */
    showSuccess(message?: string): void {
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
    showError(message: string, severity: 'warning' | 'error' | 'critical' = 'error'): void {
        this.clearTimers();
        this.lastError = message;
        
        const state: StatusBarState = severity === 'warning' ? 'warning' : 'error';
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
    showWarning(message: string): void {
        this.showError(message, 'warning');
    }

    /**
     * Обновляет прогресс операции
     */
    updateProgress(percentage: number, message?: string): void {
        if (!this.config.showProgress) {return;}

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
    getStatus(): {
        state: StatusBarState;
        isRecording: boolean;
        isVisible: boolean;
        lastError: string | null;
        configuration: StatusBarConfiguration;
    } {
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
    updateConfiguration(newConfig: Partial<StatusBarConfiguration>): void {
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
    show(): void {
        if (this.statusBarItem) {
            this.statusBarItem.show();
        }
    }

    /**
     * Скрывает элемент статус-бара
     */
    hide(): void {
        if (this.statusBarItem) {
            this.statusBarItem.hide();
        }
    }

    /**
     * Переключает видимость элемента
     */
    toggle(): void {
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
    private setState(newState: StatusBarState): void {
        if (this.currentState === newState) {return;}
        
        this.currentState = newState;
        this.updateUI();
    }

    /**
     * Обновляет UI элемента
     */
    private updateUI(): void {
        if (!this.statusBarItem) {return;}

        const config = this.stateConfig[this.currentState];
        
        // Обновляем текст с анимацией если включена
        if (this.config.enableAnimations && this.isAnimatedState()) {
            this.statusBarItem.text = this.getAnimatedText(config);
        } else {
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
    private updateTooltip(tooltip: string): void {
        if (this.config.showTooltips && this.statusBarItem) {
            this.statusBarItem.tooltip = tooltip;
        }
    }

    /**
     * Создает строку прогресса
     */
    private createProgressBar(percentage: number): string {
        const totalBlocks = 10;
        const filledBlocks = Math.round((percentage / 100) * totalBlocks);
        const emptyBlocks = totalBlocks - filledBlocks;
        
        return '█'.repeat(filledBlocks) + '░'.repeat(emptyBlocks);
    }

    /**
     * Проверяет является ли состояние анимированным
     */
    private isAnimatedState(): boolean {
        return ['recording', 'processing', 'transcribing'].includes(this.currentState);
    }

    /**
     * Получает анимированный текст
     */
    private getAnimatedText(config: StatusBarInfo): string {
        if (this.currentState === 'recording') {
            return `$(sync~spin) Recording`;
        }
        
        if (this.currentState === 'transcribing') {
            return `$(sync~spin) Transcribing`;
        }
        
        return config.text;
    }

    /**
     * Строит полный tooltip
     */
    private buildTooltip(config: StatusBarInfo): string {
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
    private startProgressAnimation(): void {
        if (!this.config.enableAnimations) {return;}
        
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
    private clearProgressAnimation(): void {
        if (this.progressInterval) {
            clearInterval(this.progressInterval);
            this.progressInterval = null;
        }
    }

    /**
     * Очищает все таймеры
     */
    private clearTimers(): void {
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
    private capitalizeFirst(str: string): string {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    /**
     * Освобождает ресурсы
     */
    dispose(): void {
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
    static createMinimalConfig(): StatusBarConfiguration {
        return {
            showTooltips: false,
            enableAnimations: false,
            showProgress: false
        };
    }

    /**
     * Создает полную конфигурацию
     */
    static createFullConfig(): StatusBarConfiguration {
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
    static createDebugConfig(): StatusBarConfiguration {
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