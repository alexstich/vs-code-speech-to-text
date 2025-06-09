import * as vscode from 'vscode';
import { TranscriptionHistoryManager } from '../core/TranscriptionHistoryManager';
import { TranscriptionEntry, DateGroupCategory } from '../types/TranscriptionHistory';
import { CursorIntegration, CursorIntegrationStrategy } from '../integrations/CursorIntegration';
import { TextInserter } from './TextInserter';

/**
 * Tree item for transcription history
 */
export class TranscriptionHistoryItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly entry?: TranscriptionEntry,
        public readonly isGroupHeader: boolean = false,
        public readonly textType?: 'original' | 'improved'
    ) {
        super(label, collapsibleState);
        
        if (entry && textType) {
            // This is a text variant (original or improved)
            this.description = this.formatTextVariantDescription(entry, textType);
            this.tooltip = this.formatTextVariantTooltip(entry, textType);
            this.contextValue = 'transcriptionText';
            this.iconPath = textType === 'original' ? new vscode.ThemeIcon('file-text') : new vscode.ThemeIcon('sparkle');
        } else if (entry) {
            // This is a transcription entry container
            this.description = this.formatEntryDescription(entry);
            this.tooltip = this.formatEntryTooltip(entry);
            this.contextValue = 'transcriptionEntry';
            this.iconPath = new vscode.ThemeIcon('history');
        } else {
            // This is a group header
            this.iconPath = new vscode.ThemeIcon('folder');
            this.contextValue = 'transcriptionGroup';
        }
    }

    private formatTextVariantDescription(entry: TranscriptionEntry, textType: 'original' | 'improved'): string {
        const text = textType === 'original' ? (entry.originalText || entry.text) : entry.text;
        const preview = text.length > 50 ? text.substring(0, 50) + '...' : text;
        return preview;
    }

    private formatTextVariantTooltip(entry: TranscriptionEntry, textType: 'original' | 'improved'): string {
        const text = textType === 'original' ? (entry.originalText || entry.text) : entry.text;
        const date = new Date(entry.timestamp).toLocaleString('ru-RU');
        
        let tooltip = `${textType === 'original' ? 'Original (Whisper)' : 'Improved (AI)'}: ${text}\n\nDate: ${date}`;
        
        if (textType === 'improved' && entry.isPostProcessed && entry.postProcessingModel) {
            tooltip += `\nModel: ${entry.postProcessingModel}`;
        }

        // Add comparison if both versions exist
        if (entry.originalText && entry.originalText !== entry.text) {
            const otherText = textType === 'original' ? entry.text : entry.originalText;
            tooltip += `\n\n--- ${textType === 'original' ? 'Improved' : 'Original'} version ---\n${otherText}`;
        }

        return tooltip;
    }

    private formatEntryDescription(entry: TranscriptionEntry): string {
        const timestamp = new Date(entry.timestamp).toLocaleTimeString('ru-RU', {
            hour: '2-digit',
            minute: '2-digit'
        });
        const duration = entry.duration ? `${entry.duration.toFixed(1)}s` : '';
        const postProcessedIcon = entry.isPostProcessed ? ' ✨' : '';
        return `${timestamp} ${duration}${postProcessedIcon}`.trim();
    }

    private formatEntryTooltip(entry: TranscriptionEntry): string {
        const date = new Date(entry.timestamp).toLocaleString('ru-RU');
        const mode = entry.mode === 'insertOrClipboard' ? 'Insert/Clipboard' : 'New Chat';
        const duration = entry.duration ? `Duration: ${entry.duration.toFixed(1)}s` : '';
        const language = entry.language ? `Language: ${entry.language}` : '';
        
        const tooltipParts = [
            `Date: ${date}`,
            `Mode: ${mode}`,
            duration,
            language
        ];

        // Add post-processing information if available
        if (entry.isPostProcessed && entry.postProcessingModel) {
            tooltipParts.push(`AI Model: ${entry.postProcessingModel}`);
        }
        
        return tooltipParts.filter(Boolean).join('\n');
    }

    getTextForAction(): string {
        if (this.entry && this.textType) {
            return this.textType === 'original' ? (this.entry.originalText || this.entry.text) : this.entry.text;
        }
        return '';
    }
}

/**
 * Data provider for transcription history
 */
export class TranscriptionHistoryProvider implements vscode.TreeDataProvider<TranscriptionHistoryItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<TranscriptionHistoryItem | undefined | void> = 
        new vscode.EventEmitter<TranscriptionHistoryItem | undefined | void>();
    readonly onDidChangeTreeData: vscode.Event<TranscriptionHistoryItem | undefined | void> = 
        this._onDidChangeTreeData.event;

    private cursorIntegration: CursorIntegration;

    constructor(
        private historyManager: TranscriptionHistoryManager
    ) {
        // Initialize CursorIntegration for chat work
        this.cursorIntegration = new CursorIntegration({
            primaryStrategy: CursorIntegrationStrategy.AICHAT_COMMAND,
            fallbackStrategies: [
                CursorIntegrationStrategy.CLIPBOARD,
                CursorIntegrationStrategy.COMMAND_PALETTE
            ],
            autoFocusChat: true,
            prefixText: '',
            suffixText: '',
            useMarkdownFormat: false,
            timeout: 5000
        });
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: TranscriptionHistoryItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: TranscriptionHistoryItem): Promise<TranscriptionHistoryItem[]> {
        if (!element) {
            // Root level - show groups
            return this.getRootItems();
        }

        if (element.isGroupHeader) {
            // Group level - show entries
            const groupName = element.label.split(' (')[0]; // Extract group name from "Today (3)" format
            return this.getGroupEntries(groupName);
        }

        if (element.entry && !element.textType) {
            // Entry level - show text variants
            return this.getTextVariants(element.entry);
        }

        return [];
    }

    private async getRootItems(): Promise<TranscriptionHistoryItem[]> {
        const history = await this.historyManager.getHistory();
        
        if (!history?.entries.length) {
            return [this.createEmptyItem()];
        }

        const entries = history.entries;
        const groups = this.groupEntriesByDate(entries);
        
        return Object.entries(groups).map(([groupName, groupEntries]) => {
            const item = new TranscriptionHistoryItem(
                `${groupName} (${groupEntries.length})`,
                vscode.TreeItemCollapsibleState.Expanded,
                undefined,
                true
            );
            return item;
        });
    }

    private async getGroupEntries(groupCategory: string): Promise<TranscriptionHistoryItem[]> {
        const history = await this.historyManager.getHistory();
        
        if (!history?.entries.length) {
            return [];
        }

        const entries = history.entries;
        const groups = this.groupEntriesByDate(entries);
        const groupEntries = groups[groupCategory] || [];

        return groupEntries.map(entry => {
            const item = new TranscriptionHistoryItem(
                this.formatEntryTitle(entry),
                vscode.TreeItemCollapsibleState.Expanded,
                entry,
                false
            );
            return item;
        });
    }

    private getTextVariants(entry: TranscriptionEntry): TranscriptionHistoryItem[] {
        const variants: TranscriptionHistoryItem[] = [];

        // Always show original text
        const originalItem = new TranscriptionHistoryItem(
            'Original (Whisper)',
            vscode.TreeItemCollapsibleState.None,
            entry,
            false,
            'original'
        );
        variants.push(originalItem);

        // Show improved text if post-processing was applied
        if (entry.isPostProcessed && entry.originalText && entry.originalText !== entry.text) {
            const improvedItem = new TranscriptionHistoryItem(
                'Improved (AI)',
                vscode.TreeItemCollapsibleState.None,
                entry,
                false,
                'improved'
            );
            variants.push(improvedItem);
        }

        return variants;
    }

    private formatEntryTitle(entry: TranscriptionEntry): string {
        const time = new Date(entry.timestamp).toLocaleTimeString('ru-RU', {
            hour: '2-digit',
            minute: '2-digit'
        });
        
        // Use the final text (improved if available) for preview
        const text = entry.text;
        const preview = text.length > 30 ? text.substring(0, 30) + '...' : text;
        
        return `${time} - ${preview}`;
    }

    private groupEntriesByDate(entries: TranscriptionEntry[]): Record<string, TranscriptionEntry[]> {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
        const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

        const groups: Record<string, TranscriptionEntry[]> = {
            'Today': [],
            'Yesterday': [],
            'This week': [],
            'Earlier': []
        };

        for (const entry of entries) {
            const entryDate = new Date(entry.timestamp);
            const entryDay = new Date(entryDate.getFullYear(), entryDate.getMonth(), entryDate.getDate());

            if (entryDay.getTime() === today.getTime()) {
                groups['Today'].push(entry);
            } else if (entryDay.getTime() === yesterday.getTime()) {
                groups['Yesterday'].push(entry);
            } else if (entryDate >= weekAgo) {
                groups['This week'].push(entry);
            } else {
                groups['Earlier'].push(entry);
            }
        }

        // Remove empty groups
        return Object.fromEntries(
            Object.entries(groups).filter(([, entries]) => entries.length > 0)
        );
    }

    private createEmptyItem(): TranscriptionHistoryItem {
        const item = new TranscriptionHistoryItem(
            'No transcriptions yet',
            vscode.TreeItemCollapsibleState.None,
            undefined,
            false
        );
        item.iconPath = new vscode.ThemeIcon('info');
        item.description = 'Start recording to see history';
        return item;
    }

    // Simplified command methods - only copy and insert

    /**
     * Copies the text to the clipboard
     */
    async copyToClipboard(item: TranscriptionHistoryItem): Promise<void> {
        const text = item.getTextForAction();
        if (!text) {
            vscode.window.showErrorMessage('No text to copy');
            return;
        }

        try {
            await vscode.env.clipboard.writeText(text);
            const textType = item.textType === 'original' ? 'Original' : 'Improved';
            vscode.window.showInformationMessage(`✅ ${textType} text copied to clipboard`);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to copy: ${(error as Error).message}`);
        }
    }

    /**
     * Inserts the text at cursor position
     */
    async insertAtCursor(item: TranscriptionHistoryItem): Promise<void> {
        const text = item.getTextForAction();
        if (!text) {
            vscode.window.showErrorMessage('No text to insert');
            return;
        }

        try {
            // Use TextInserter with fallback logic
            const textInserter = new TextInserter();
            await textInserter.insertText(text, { mode: 'cursor' });
            
            const textType = item.textType === 'original' ? 'Original' : 'Improved';
            vscode.window.showInformationMessage(`✅ ${textType} text inserted at cursor`);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to insert text: ${(error as Error).message}`);
        }
    }

    /**
     * Deletes the entry from the history
     */
    async deleteEntry(item: TranscriptionHistoryItem): Promise<void> {
        if (!item.entry) {
            vscode.window.showErrorMessage('No transcription entry to delete');
            return;
        }

        try {
            const confirmResult = await vscode.window.showWarningMessage(
                'Are you sure you want to delete this transcription?',
                { modal: true },
                'Delete'
            );

            if (confirmResult === 'Delete') {
                const result = await this.historyManager.removeEntry(item.entry.id);
                if (result.success) {
                    this.refresh();
                    vscode.window.showInformationMessage('✅ Transcription deleted');
                } else {
                    vscode.window.showErrorMessage(`Failed to delete: ${result.error}`);
                }
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to delete: ${(error as Error).message}`);
        }
    }

    /**
     * Clears the entire history
     */
    async clearHistory(): Promise<void> {
        try {
            const confirmResult = await vscode.window.showWarningMessage(
                'Are you sure you want to clear the entire transcription history?',
                { modal: true },
                'Clear All'
            );

            if (confirmResult === 'Clear All') {
                const result = await this.historyManager.clearHistory();
                if (result.success) {
                    this.refresh();
                    vscode.window.showInformationMessage('✅ Transcription history cleared');
                } else {
                    vscode.window.showErrorMessage(`Failed to clear history: ${result.error}`);
                }
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to clear history: ${(error as Error).message}`);
        }
    }

    /**
     * Cleaning up resources
     */
    dispose(): void {
        if (this.cursorIntegration) {
            this.cursorIntegration.dispose();
        }
    }
} 