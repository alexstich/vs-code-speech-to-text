import * as vscode from 'vscode';
import { FFmpegAudioRecorder } from '../core/FFmpegAudioRecorder';

/**
 * Data provider for diagnostics
 */
export class DiagnosticsProvider implements vscode.TreeDataProvider<DiagnosticItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<DiagnosticItem | undefined | void> = new vscode.EventEmitter<DiagnosticItem | undefined | void>();
    readonly onDidChangeTreeData: vscode.Event<DiagnosticItem | undefined | void> = this._onDidChangeTreeData.event;

    constructor() {}

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: DiagnosticItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: DiagnosticItem): Promise<DiagnosticItem[]> {
        if (!element) {
            return this.getDiagnostics();
        }
        return [];
    }

    private async getDiagnostics(): Promise<DiagnosticItem[]> {
        const items: DiagnosticItem[] = [];

        // FFmpeg check
        const ffmpegCheck = await FFmpegAudioRecorder.checkFFmpegAvailability();
        const ffmpegItem = new DiagnosticItem(
            'FFmpeg',
            ffmpegCheck.available ? '✅ Available' : '❌ Not Found',
            ffmpegCheck.version || ffmpegCheck.error || 'Unknown status'
        );
        ffmpegItem.iconPath = new vscode.ThemeIcon(ffmpegCheck.available ? 'check' : 'error');
        items.push(ffmpegItem);

        // Audio devices
        try {
            const devices = await FFmpegAudioRecorder.detectInputDevices();
            const deviceNames = devices.map(device => device.name);
            const devicesItem = new DiagnosticItem(
                'Audio Devices',
                devices.length > 0 ? `✅ ${devices.length} Found` : '❌ None Found',
                devices.length > 0 ? deviceNames.slice(0, 2).join(', ') + (devices.length > 2 ? '...' : '') : 'No devices detected'
            );
            devicesItem.iconPath = new vscode.ThemeIcon(devices.length > 0 ? 'check' : 'error');
            items.push(devicesItem);
        } catch (error) {
            const devicesItem = new DiagnosticItem(
                'Audio Devices',
                '⚠️ Check Failed',
                (error as Error).message
            );
            devicesItem.iconPath = new vscode.ThemeIcon('warning');
            items.push(devicesItem);
        }

        // API key
        const config = vscode.workspace.getConfiguration('speechToTextWhisper');
        const apiKey = config.get<string>('apiKey');
        const apiItem = new DiagnosticItem(
            'OpenAI API Key',
            apiKey && apiKey.trim() ? '✅ Configured' : '❌ Missing',
            apiKey && apiKey.trim() ? 'API key is set' : 'Please configure your OpenAI API key'
        );
        apiItem.iconPath = new vscode.ThemeIcon(apiKey && apiKey.trim() ? 'check' : 'error');
        items.push(apiItem);

        return items;
    }

    async runAllDiagnostics(): Promise<void> {
        vscode.window.showInformationMessage('🔧 Running diagnostics...');
        this.refresh();
        vscode.window.showInformationMessage('✅ Diagnostics completed. Check the panel for results.');
    }
}

class DiagnosticItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly description: string,
        public readonly tooltip: string
    ) {
        super(label, vscode.TreeItemCollapsibleState.None);
        this.description = description;
        this.tooltip = tooltip;
    }
} 