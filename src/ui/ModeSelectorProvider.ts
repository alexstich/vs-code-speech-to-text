import * as vscode from 'vscode';

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

        // Текущий режим
        const currentModeItem = new ModeItem(
            `Current Mode: ${this.currentMode === 'insert' ? 'Insert Text' : 'Copy to Clipboard'}`,
            `Currently set to ${this.currentMode === 'insert' ? 'insert text at cursor' : 'copy to clipboard'}`,
            vscode.TreeItemCollapsibleState.None
        );
        currentModeItem.iconPath = new vscode.ThemeIcon(this.currentMode === 'insert' ? 'edit' : 'clippy');
        items.push(currentModeItem);

        // Кнопка переключения режима
        const switchModeItem = new ModeItem(
            `Switch to ${this.currentMode === 'insert' ? 'Clipboard' : 'Insert'} Mode`,
            `Click to switch to ${this.currentMode === 'insert' ? 'clipboard copying' : 'text insertion'} mode`,
            vscode.TreeItemCollapsibleState.None
        );
        switchModeItem.iconPath = new vscode.ThemeIcon('arrow-swap');
        switchModeItem.command = {
            command: 'speechToTextWhisper.toggleMode',
            title: 'Toggle Mode'
        };
        items.push(switchModeItem);

        return items;
    }

    getCurrentMode(): RecordingMode {
        return this.currentMode;
    }

    toggleMode(): void {
        this.currentMode = this.currentMode === 'insert' ? 'clipboard' : 'insert';
        this.refresh();
        
        // Показываем уведомление о смене режима
        const modeText = this.currentMode === 'insert' ? 'Insert Text' : 'Copy to Clipboard';
        vscode.window.showInformationMessage(`🔄 Mode switched to: ${modeText}`);
    }

    setMode(mode: RecordingMode): void {
        if (this.currentMode !== mode) {
            this.currentMode = mode;
            this.refresh();
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