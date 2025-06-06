import * as vscode from 'vscode';
import { ExtensionLog } from '../utils/GlobalOutput';

export type RecordingMode = 'insert' | 'clipboard';

/**
 * Data provider for switching recording modes
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

        // Option for the "Insert Text" mode with a checkmark
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

        // Option for the "Copy to Clipboard" mode with a checkmark
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
		return this.currentMode;
	}

    toggleMode(): void {
        const oldMode = this.currentMode;
        this.currentMode = this.currentMode === 'insert' ? 'clipboard' : 'insert';
        this.refresh();
        
        // Show a notification about the mode change
        const modeText = this.currentMode === 'insert' ? 'Insert Text' : 'Copy to Clipboard';
        vscode.window.showInformationMessage(`🔄 Mode switched to: ${modeText}`);
    }

    setMode(mode: RecordingMode): void {
        if (this.currentMode !== mode) {
            const oldMode = this.currentMode;
            this.currentMode = mode;
            this.refresh();
            
            // Show a notification about the mode change
            const modeText = mode === 'insert' ? 'Insert Text' : 'Copy to Clipboard';
            vscode.window.showInformationMessage(`✓ Mode set to: ${modeText}`);
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