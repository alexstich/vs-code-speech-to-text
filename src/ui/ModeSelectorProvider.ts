import * as vscode from 'vscode';
import { ExtensionLog } from '../utils/GlobalOutput';

export type RecordingMode = 'insert' | 'clipboard';

/**
 * Провайдер данных для переключения режимов записи
 */
export class ModeSelectorProvider implements vscode.TreeDataProvider<ModeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<ModeItem | undefined | void> = new vscode.EventEmitter<ModeItem | undefined | void>();
    readonly onDidChangeTreeData: vscode.Event<ModeItem | undefined | void> = this._onDidChangeTreeData.event;

    private currentMode: RecordingMode = 'insert';

    constructor() {}

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: ModeItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: ModeItem): Promise<ModeItem[]> {
        if (!element) {
            return this.getModeItems();
        }
        return [];
    }

    private async getModeItems(): Promise<ModeItem[]> {
        const items: ModeItem[] = [];

        // Option для режима "Insert Text" с галочкой
        const insertModeItem = new ModeItem(
            'Insert Text',
            'Insert transcribed text at cursor position',
            vscode.TreeItemCollapsibleState.None
        );
        insertModeItem.iconPath = this.currentMode === 'insert' ? new vscode.ThemeIcon('check') : undefined;
        insertModeItem.command = {
            command: 'speechToTextWhisper.setMode',
            title: 'Set Insert Mode',
            arguments: ['insert']
        };
        items.push(insertModeItem);

        // Option для режима "Copy to Clipboard" с галочкой
        const clipboardModeItem = new ModeItem(
            'Copy to Clipboard',
            'Copy transcribed text to clipboard',
            vscode.TreeItemCollapsibleState.None
        );
        clipboardModeItem.iconPath = this.currentMode === 'clipboard' ? new vscode.ThemeIcon('check') : undefined;
        clipboardModeItem.command = {
            command: 'speechToTextWhisper.setMode',
            title: 'Set Clipboard Mode',
            arguments: ['clipboard']
        };
        items.push(clipboardModeItem);

        return items;
    }

    getCurrentMode(): RecordingMode {
        ExtensionLog.info(`🔍 [ModeSelectorProvider] getCurrentMode() called, returning: ${this.currentMode}`);
        return this.currentMode;
    }

    toggleMode(): void {
        const oldMode = this.currentMode;
        this.currentMode = this.currentMode === 'insert' ? 'clipboard' : 'insert';
        ExtensionLog.info(`🔄 [ModeSelectorProvider] toggleMode() called, changed from ${oldMode} to ${this.currentMode}`);
        this.refresh();
        
        // Показываем уведомление о смене режима
        const modeText = this.currentMode === 'insert' ? 'Insert Text' : 'Copy to Clipboard';
        vscode.window.showInformationMessage(`🔄 Mode switched to: ${modeText}`);
    }

    setMode(mode: RecordingMode): void {
        ExtensionLog.info(`✓ [ModeSelectorProvider] setMode() called with mode: ${mode}, current mode: ${this.currentMode}`);
        if (this.currentMode !== mode) {
            const oldMode = this.currentMode;
            this.currentMode = mode;
            ExtensionLog.info(`✓ [ModeSelectorProvider] Mode changed from ${oldMode} to ${mode}`);
            this.refresh();
            
            // Показываем уведомление о смене режима
            const modeText = mode === 'insert' ? 'Insert Text' : 'Copy to Clipboard';
            vscode.window.showInformationMessage(`✓ Mode set to: ${modeText}`);
        } else {
            ExtensionLog.info(`✓ [ModeSelectorProvider] Mode already set to ${mode}, no change needed`);
        }
    }
}

class ModeItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly tooltip: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState
    ) {
        super(label, collapsibleState);
        this.tooltip = tooltip;
    }
} 