import * as vscode from 'vscode';
import { TranscriptionHistoryManager } from '../core/TranscriptionHistoryManager';
import { TranscriptionEntry, DateGroupCategory } from '../types/TranscriptionHistory';

/**
 * Элемент дерева для истории транскрипций
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
            // Это элемент транскрипции
            this.description = this.formatEntryDescription(entry);
            this.tooltip = this.formatEntryTooltip(entry);
            this.contextValue = 'transcriptionEntry';
            this.iconPath = new vscode.ThemeIcon('file-text');
        } else {
            // Это заголовок группы
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
 * Провайдер данных для истории транскрипций
 */
export class TranscriptionHistoryProvider implements vscode.TreeDataProvider<TranscriptionHistoryItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<TranscriptionHistoryItem | undefined | void> = 
        new vscode.EventEmitter<TranscriptionHistoryItem | undefined | void>();
    readonly onDidChangeTreeData: vscode.Event<TranscriptionHistoryItem | undefined | void> = 
        this._onDidChangeTreeData.event;

    constructor(
        private historyManager: TranscriptionHistoryManager
    ) {}

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: TranscriptionHistoryItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: TranscriptionHistoryItem): Promise<TranscriptionHistoryItem[]> {
        if (!element) {
            // Корневые элементы - группы по датам
            return this.getDateGroups();
        } else if (element.isGroupHeader) {
            // Элементы внутри группы даты
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

            // Группируем записи по категориям дат
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

            // Извлекаем категорию из label группы
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

        // Инициализируем все группы
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

    // Методы для команд

    /**
     * Копирует текст записи в буфер обмена
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
     * Вставляет текст записи в чат Cursor
     */
    async insertAtCursor(item: TranscriptionHistoryItem): Promise<void> {
        if (!item.entry) {
            vscode.window.showErrorMessage('No transcription text to insert');
            return;
        }

        try {
            // Показываем индикатор прогресса во время вставки
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "Inserting to Cursor chat...",
                cancellable: false
            }, async (progress) => {
                progress.report({ increment: 50, message: "Opening chat..." });
                await this.insertToCursorChat(item.entry!.text);
                progress.report({ increment: 50, message: "Text inserted!" });
            });
            
            vscode.window.showInformationMessage('✅ Transcription inserted to Cursor chat');
        } catch (error) {
            // Если вставка в чат не удалась, пытаемся вставить в активный редактор как fallback
            console.warn('Failed to insert to Cursor chat, trying fallback:', error);
            
            try {
                const editor = vscode.window.activeTextEditor;
                if (!editor) {
                    vscode.window.showErrorMessage('Failed to insert to Cursor chat and no active editor available');
                    return;
                }

                const position = editor.selection.active;
                await editor.edit(editBuilder => {
                    editBuilder.insert(position, item.entry!.text);
                });
                
                vscode.window.showInformationMessage('✅ Transcription inserted at cursor (fallback mode)');
            } catch (fallbackError) {
                vscode.window.showErrorMessage(`Failed to insert text: ${(error as Error).message}`);
            }
        }
    }

    /**
     * Вставляет текст в чат Cursor
     */
    private async insertToCursorChat(text: string): Promise<void> {
        try {
            // Наиболее вероятные команды Cursor для работы с чатом
            const cursorChatCommands = [
                'workbench.panel.chat.view.copilot.focus', // Фокус на чат Copilot
                'workbench.action.chat.newChatEditor', // Новый чат редактор
                'workbench.view.extension.cursor', // Открыть расширение Cursor
                'workbench.action.chat.start', // Запуск чата
                'workbench.action.toggleAuxiliaryBar', // Переключить боковую панель
                'workbench.action.chat.openChatEditor' // Открыть чат редактор
            ];

            // Сначала копируем текст в буфер обмена
            await vscode.env.clipboard.writeText(text);

            // Пытаемся открыть чат Cursor различными способами
            let chatOpened = false;
            for (const command of cursorChatCommands) {
                try {
                    await vscode.commands.executeCommand(command);
                    chatOpened = true;
                    // Даем время на открытие чата
                    await new Promise(resolve => setTimeout(resolve, 200));
                    break;
                } catch (cmdError) {
                    // Команда не существует или не доступна, пробуем следующую
                    continue;
                }
            }

            // Если специфичные команды чата не сработали, пытаемся использовать универсальные методы
            if (!chatOpened) {
                try {
                    // Пытаемся открыть Command Palette и найти команды чата
                    await vscode.commands.executeCommand('workbench.action.showCommands');
                    await new Promise(resolve => setTimeout(resolve, 100));
                    
                    // Отправляем последовательность символов для поиска чата
                    await vscode.commands.executeCommand('type', { text: 'chat' });
                    await new Promise(resolve => setTimeout(resolve, 100));
                    
                    // Нажимаем Enter для выбора первой команды чата
                    await vscode.commands.executeCommand('workbench.action.acceptSelectedQuickOpenItem');
                    await new Promise(resolve => setTimeout(resolve, 200));
                    
                    chatOpened = true;
                } catch (universalError) {
                    // Если и это не сработало, пробуем альтернативный подход
                    try {
                        // Открываем боковую панель и ищем чат там
                        await vscode.commands.executeCommand('workbench.action.toggleSidebar');
                        await new Promise(resolve => setTimeout(resolve, 100));
                        chatOpened = true;
                    } catch (sidebarError) {
                        // Последняя попытка - открыть терминал и использовать его
                        await vscode.commands.executeCommand('workbench.action.terminal.focus');
                        chatOpened = true;
                    }
                }
            }

            // Теперь пытаемся вставить текст
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Пытаемся различные методы вставки
            try {
                // Основной метод - вставка через буфер обмена
                await vscode.commands.executeCommand('editor.action.clipboardPasteAction');
            } catch (pasteError) {
                try {
                    // Альтернативный метод - прямая вставка через type
                    await vscode.commands.executeCommand('type', { text: text });
                } catch (typeError) {
                    // Последний способ - симуляция нажатий клавиш
                    await vscode.commands.executeCommand('editor.action.paste');
                }
            }

        } catch (error) {
            throw new Error(`Unable to insert text to Cursor chat: ${(error as Error).message}`);
        }
    }

    /**
     * Удаляет запись из истории
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
     * Очищает всю историю транскрипций
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
} 