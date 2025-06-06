import * as vscode from 'vscode';
import { TranscriptionHistoryManager } from '../core/TranscriptionHistoryManager';
import { TranscriptionEntry, DateGroupCategory } from '../types/TranscriptionHistory';
import { CursorIntegration, CursorIntegrationStrategy } from '../integrations/CursorIntegration';

/**
 * Tree item for transcription history
 */
export class TranscriptionHistoryItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly entry?: TranscriptionEntry,
        public readonly isGroupHeader: boolean = false
    ) {
        super(label, collapsibleState);
        
        if (entry) {
            // This is a transcription entry
            this.description = this.formatEntryDescription(entry);
            this.tooltip = this.formatEntryTooltip(entry);
            this.contextValue = 'transcriptionEntry';
            this.iconPath = new vscode.ThemeIcon('file-text');
        } else {
            // This is a group header
            this.iconPath = new vscode.ThemeIcon('folder');
            this.contextValue = 'transcriptionGroup';
        }
    }

    private formatEntryDescription(entry: TranscriptionEntry): string {
        const timestamp = new Date(entry.timestamp).toLocaleTimeString('ru-RU', {
            hour: '2-digit',
            minute: '2-digit'
        });
        const duration = entry.duration ? `${entry.duration.toFixed(1)}s` : '';
        return `${timestamp} ${duration}`.trim();
    }

    private formatEntryTooltip(entry: TranscriptionEntry): string {
        const date = new Date(entry.timestamp).toLocaleString('ru-RU');
        const mode = entry.mode === 'insertOrClipboard' ? 'Insert/Clipboard' : 'New Chat';
        const duration = entry.duration ? `Duration: ${entry.duration.toFixed(1)}s` : '';
        const language = entry.language ? `Language: ${entry.language}` : '';
        
        return [
            `Text: ${entry.text}`,
            `Date: ${date}`,
            `Mode: ${mode}`,
            duration,
            language
        ].filter(Boolean).join('\n');
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
            // Root elements - date groups
            return this.getDateGroups();
        } else if (element.isGroupHeader) {
            // Elements inside date group
            return this.getEntriesForGroup(element.label);
        }
        return [];
    }

    private async getDateGroups(): Promise<TranscriptionHistoryItem[]> {
        try {
            const history = await this.historyManager.getHistory();
            if (!history) {
                return [this.createErrorItem('Failed to load transcription history')];
            }

            const entries = history.entries;
            if (entries.length === 0) {
                return [this.createEmptyItem()];
            }

            // Group entries by date categories
            const groups = this.groupEntriesByDate(entries);
            const items: TranscriptionHistoryItem[] = [];

            for (const [category, groupEntries] of groups.entries()) {
                if (groupEntries.length > 0) {
                    const groupName = this.getGroupDisplayName(category);
                    const item = new TranscriptionHistoryItem(
                        `${groupName} (${groupEntries.length})`,
                        vscode.TreeItemCollapsibleState.Expanded,
                        undefined,
                        true
                    );
                    items.push(item);
                }
            }

            return items;
        } catch (error) {
            return [this.createErrorItem(`Error loading history: ${(error as Error).message}`)];
        }
    }

    private async getEntriesForGroup(groupLabel: string): Promise<TranscriptionHistoryItem[]> {
        try {
            const history = await this.historyManager.getHistory();
            if (!history) {
                return [];
            }

            const entries = history.entries;
            const groups = this.groupEntriesByDate(entries);

            // Extract category from group label
            const category = this.getCategoryFromGroupLabel(groupLabel);
            const groupEntries = groups.get(category) || [];

            return groupEntries.map(entry => {
                const displayText = entry.text.length > 50 ? 
                    `${entry.text.substring(0, 50)}...` : 
                    entry.text;
                
                return new TranscriptionHistoryItem(
                    displayText,
                    vscode.TreeItemCollapsibleState.None,
                    entry,
                    false
                );
            });
        } catch (error) {
            return [this.createErrorItem(`Error loading entries: ${(error as Error).message}`)];
        }
    }

    private groupEntriesByDate(entries: TranscriptionEntry[]): Map<DateGroupCategory, TranscriptionEntry[]> {
        const groups = new Map<DateGroupCategory, TranscriptionEntry[]>();
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
        const thisWeekStart = new Date(today.getTime() - (today.getDay() * 24 * 60 * 60 * 1000));

        // Initialize all groups
        Object.values(DateGroupCategory).forEach(category => {
            groups.set(category, []);
        });

        entries.forEach(entry => {
            const entryDate = new Date(entry.timestamp);
            const entryDay = new Date(entryDate.getFullYear(), entryDate.getMonth(), entryDate.getDate());

            let category: DateGroupCategory;
            if (entryDay.getTime() === today.getTime()) {
                category = DateGroupCategory.TODAY;
            } else if (entryDay.getTime() === yesterday.getTime()) {
                category = DateGroupCategory.YESTERDAY;
            } else if (entryDay >= thisWeekStart) {
                category = DateGroupCategory.THIS_WEEK;
            } else {
                category = DateGroupCategory.OLDER;
            }

            groups.get(category)?.push(entry);
        });

        return groups;
    }

    private getGroupDisplayName(category: DateGroupCategory): string {
        switch (category) {
            case DateGroupCategory.TODAY:
                return 'Today';
            case DateGroupCategory.YESTERDAY:
                return 'Yesterday';
            case DateGroupCategory.THIS_WEEK:
                return 'This Week';
            case DateGroupCategory.OLDER:
                return 'Older';
            default:
                return 'Unknown';
        }
    }

    private getCategoryFromGroupLabel(groupLabel: string): DateGroupCategory {
        if (groupLabel.startsWith('Today')) {
            return DateGroupCategory.TODAY;
        } else if (groupLabel.startsWith('Yesterday')) {
            return DateGroupCategory.YESTERDAY;
        } else if (groupLabel.startsWith('This Week')) {
            return DateGroupCategory.THIS_WEEK;
        } else if (groupLabel.startsWith('Older')) {
            return DateGroupCategory.OLDER;
        }
        return DateGroupCategory.OLDER;
    }

    private createErrorItem(message: string): TranscriptionHistoryItem {
        const item = new TranscriptionHistoryItem(
            `❌ ${message}`,
            vscode.TreeItemCollapsibleState.None,
            undefined,
            false
        );
        item.iconPath = new vscode.ThemeIcon('error');
        return item;
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

    // Methods for commands

    /**
     * Copies the transcription text to the clipboard
     */
    async copyToClipboard(item: TranscriptionHistoryItem): Promise<void> {
        if (!item.entry) {
            vscode.window.showErrorMessage('No transcription text to copy');
            return;
        }

        try {
            await vscode.env.clipboard.writeText(item.entry.text);
            vscode.window.showInformationMessage('✅ Transcription copied to clipboard');
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to copy: ${(error as Error).message}`);
        }
    }

    /**
     * Inserts the transcription text into Cursor chat
     */
    async insertAtCursor(item: TranscriptionHistoryItem): Promise<void> {
        if (!item.entry) {
            vscode.window.showErrorMessage('No transcription text to insert');
            return;
        }

        try {
            // Check the availability of the Cursor integration
            if (!this.cursorIntegration.isIntegrationEnabled()) {
                // If the integration is not available, use fallback
                await this.fallbackToEditor(item.entry.text);
                return;
            }

            // Show the progress indicator during insertion
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "Inserting to Cursor chat...",
                cancellable: false
            }, async (progress) => {
                progress.report({ increment: 30, message: "Preparing chat..." });
                
                // Use the verified CursorIntegration
                const result = await this.cursorIntegration.sendToChat(item.entry!.text);
                
                progress.report({ increment: 70, message: "Text sent!" });
                
                if (result.success) {
                    const strategyMessage = result.strategy === CursorIntegrationStrategy.AICHAT_COMMAND ? 
                        'direct chat' : `${result.strategy} strategy`;
                    vscode.window.showInformationMessage(`✅ Transcription sent to Cursor chat via ${strategyMessage}`);
                } else {
                    throw new Error(result.error || 'Unknown error occurred');
                }
            });
            
        } catch (error) {
            // If the insertion into the chat fails, try to insert into the active editor as fallback
            console.warn('Failed to insert to Cursor chat, trying fallback:', error);
            
            try {
                await this.fallbackToEditor(item.entry.text);
            } catch (fallbackError) {
                vscode.window.showErrorMessage(`Failed to insert text: ${(error as Error).message}`);
            }
        }
    }

    /**
     * Fallback method for inserting into the active editor
     */
    private async fallbackToEditor(text: string): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('Failed to insert to Cursor chat and no active editor available');
            return;
        }

        const position = editor.selection.active;
        await editor.edit(editBuilder => {
            editBuilder.insert(position, text);
        });
        
        vscode.window.showInformationMessage('✅ Transcription inserted at cursor (fallback mode)');
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
     * Clears the entire transcription history
     */
    async clearHistory(): Promise<void> {
        try {
            const confirmResult = await vscode.window.showWarningMessage(
                'Are you sure you want to clear all transcription history? This action cannot be undone.',
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