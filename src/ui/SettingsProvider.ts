import * as vscode from 'vscode';

/**
 * Data provider for settings
 */
export class SettingsProvider implements vscode.TreeDataProvider<SettingsItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<SettingsItem | undefined | void> = new vscode.EventEmitter<SettingsItem | undefined | void>();
    readonly onDidChangeTreeData: vscode.Event<SettingsItem | undefined | void> = this._onDidChangeTreeData.event;

    constructor() {}

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: SettingsItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: SettingsItem): Promise<SettingsItem[]> {
        if (!element) {
            return this.getSettingsItems();
        }
        return [];
    }

    private async getSettingsItems(): Promise<SettingsItem[]> {
        const items: SettingsItem[] = [];

        // Button to open settings
        const openSettingsItem = new SettingsItem(
            'Open Extension Settings',
            'Configure Speech to Text settings',
            vscode.TreeItemCollapsibleState.None
        );
        openSettingsItem.iconPath = new vscode.ThemeIcon('settings-gear');
        openSettingsItem.command = {
            command: 'speechToTextWhisper.openSettings',
            title: 'Open Settings'
        };
        items.push(openSettingsItem);

        return items;
    }

    async openSettings(): Promise<void> {
        await vscode.commands.executeCommand('workbench.action.openSettings', 'speechToTextWhisper');
    }
}

class SettingsItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly tooltip: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState
    ) {
        super(label, collapsibleState);
        this.tooltip = tooltip;
    }
} 