// StatusBarManager.ts - managing the interface elements in the VS Code status bar

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
 * Managing the interface elements in the VS Code status bar
 * Provides visual feedback on the recording and speech processing state
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
    
    // Configuration for different states
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
     * Creates a status bar item
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
     * Updates the recording state
     */
    updateRecordingState(isRecording: boolean): void {
        this.isRecording = isRecording;
        if (isRecording) {
            this.setState('recording');
            this.startProgressAnimation(); // Start the animation for recording
        } else {
            this.clearProgressAnimation(); // Stop the animation when recording is stopped
            this.setState('idle');
        }
    }

    /**
     * Shows the processing state of audio
     */
    showProcessing(): void {
        this.setState('processing');
        this.startProgressAnimation();
    }

    /**
     * Shows the transcription state
     */
    showTranscribing(): void {
        this.setState('transcribing');
        this.startProgressAnimation();
    }

    /**
     * Shows the inserting state of text
     */
    showInserting(): void {
        this.setState('inserting');
    }

    /**
     * Shows the success state
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
     * Shows the error state
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
     * Shows the warning state
     */
    showWarning(message: string): void {
        this.showError(message, 'warning');
    }

    /**
     * Updates the progress of the operation
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
     * Gets the information about the current state
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
     * Updates the configuration
     */
    updateConfiguration(newConfig: Partial<StatusBarConfiguration>): void {
        Object.assign(this.config, newConfig);
        
        // Recreate the element if the position has changed
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
     * Shows the status bar item
     */
    show(): void {
        if (this.statusBarItem) {
            this.statusBarItem.show();
        }
    }

    /**
     * Hides the status bar item
     */
    hide(): void {
        if (this.statusBarItem) {
            this.statusBarItem.hide();
        }
    }

    /**
     * Toggles the visibility of the item
     */
    toggle(): void {
        // VS Code API does not provide a direct way to check visibility
        // So we track the state ourselves
        if (this.statusBarItem) {
            // Simple implementation: always show
            this.show();
        }
    }

    /**
     * Sets a new state
     */
    private setState(newState: StatusBarState): void {
        if (this.currentState === newState) {return;}
        
        this.currentState = newState;
        this.updateUI();
    }

    /**
     * Updates the UI of the item
     */
    private updateUI(): void {
        if (!this.statusBarItem) {return;}

        const config = this.stateConfig[this.currentState];
        
        // Update the text with animation if enabled
        if (this.config.enableAnimations && this.isAnimatedState()) {
            this.statusBarItem.text = this.getAnimatedText(config);
        } else {
            this.statusBarItem.text = config.text;
        }

        // Update the tooltip if enabled
        if (this.config.showTooltips) {
            this.statusBarItem.tooltip = this.buildTooltip(config);
        }

        // Update the colors
        this.statusBarItem.backgroundColor = config.backgroundColor;
        this.statusBarItem.color = config.color;
        
        // Update the command
        this.statusBarItem.command = config.command;
    }

    /**
     * Updates the tooltip
     */
    private updateTooltip(tooltip: string): void {
        if (this.config.showTooltips && this.statusBarItem) {
            this.statusBarItem.tooltip = tooltip;
        }
    }

    /**
     * Creates a progress bar
     */
    private createProgressBar(percentage: number): string {
        const totalBlocks = 10;
        const filledBlocks = Math.round((percentage / 100) * totalBlocks);
        const emptyBlocks = totalBlocks - filledBlocks;
        
        return '█'.repeat(filledBlocks) + '░'.repeat(emptyBlocks);
    }

    /**
     * Checks if the state is animated
     */
    private isAnimatedState(): boolean {
        return ['recording', 'processing', 'transcribing'].includes(this.currentState);
    }

    /**
     * Gets the animated text
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
     * Builds the full tooltip
     */
    private buildTooltip(config: StatusBarInfo): string {
        let tooltip = config.tooltip;
        
        // Add additional information for different states
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
     * Starts the progress animation
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
     * Stops the progress animation
     */
    private clearProgressAnimation(): void {
        if (this.progressInterval) {
            clearInterval(this.progressInterval);
            this.progressInterval = null;
        }
    }

    /**
     * Clears all timers
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
     * Makes the first letter uppercase
     */
    private capitalizeFirst(str: string): string {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    /**
     * Releases resources
     */
    dispose(): void {
        this.clearTimers();
        
        if (this.statusBarItem) {
            this.statusBarItem.dispose();
        }
    }

    /**
     * Static methods for creating standard configurations
     */
    
    /**
     * Creates a minimal configuration
     */
    static createMinimalConfig(): StatusBarConfiguration {
        return {
            showTooltips: false,
            enableAnimations: false,
            showProgress: false
        };
    }

    /**
     * Creates a full configuration
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
     * Creates a configuration for development
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