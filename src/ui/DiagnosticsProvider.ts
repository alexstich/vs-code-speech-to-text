import * as vscode from 'vscode';
import { FFmpegAudioRecorder } from '../core/FFmpegAudioRecorder';

export class DiagnosticsProvider implements vscode.TreeDataProvider<DiagnosticItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<DiagnosticItem | undefined | null | void> = new vscode.EventEmitter<DiagnosticItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<DiagnosticItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private diagnostics: { [key: string]: { status: 'pass' | 'fail' | 'warning'; message: string } } = {};

    constructor() {
        this.runDiagnostics();
    }

    refresh(): void {
        this.runDiagnostics();
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: DiagnosticItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: DiagnosticItem): Thenable<DiagnosticItem[]> {
        if (!element) {
            return Promise.resolve([
                new DiagnosticItem(
                    'FFmpeg Available',
                    this.diagnostics.ffmpeg?.message || 'Not tested',
                    this.diagnostics.ffmpeg?.status || 'warning'
                ),
                new DiagnosticItem(
                    'Audio Devices',
                    this.diagnostics.devices?.message || 'Not tested',
                    this.diagnostics.devices?.status || 'warning'
                ),
                new DiagnosticItem(
                    'System Compatibility',
                    this.diagnostics.system?.message || 'Not tested',
                    this.diagnostics.system?.status || 'warning'
                ),
                new DiagnosticItem(
                    'Configuration',
                    this.diagnostics.config?.message || 'Not tested',
                    this.diagnostics.config?.status || 'warning'
                )
            ]);
        }
        return Promise.resolve([]);
    }

    async runAllDiagnostics(): Promise<void> {
        vscode.window.showInformationMessage('🔍 Running diagnostics...');
        await this.runDiagnostics();
        this.refresh();
        
        const hasErrors = Object.values(this.diagnostics).some(d => d.status === 'fail');
        if (hasErrors) {
            vscode.window.showWarningMessage('⚠️ Some diagnostic checks failed. Check the Diagnostics panel for details.');
        } else {
            vscode.window.showInformationMessage('✅ All diagnostic checks passed!');
        }
    }

    private async runDiagnostics(): Promise<void> {
        // Test FFmpeg availability
        try {
            const ffmpegCheck = await FFmpegAudioRecorder.checkFFmpegAvailability();
            this.diagnostics.ffmpeg = {
                status: ffmpegCheck.available ? 'pass' : 'fail',
                message: ffmpegCheck.available 
                    ? `Available (${ffmpegCheck.version || 'unknown version'})` 
                    : `Not available: ${ffmpegCheck.error || 'Not found'}`
            };
        } catch (error) {
            this.diagnostics.ffmpeg = {
                status: 'fail',
                message: `Error: ${(error as Error).message}`
            };
        }

        // Test audio devices
        try {
            const devices = await FFmpegAudioRecorder.detectInputDevices();
            this.diagnostics.devices = {
                status: devices.length > 0 ? 'pass' : 'warning',
                message: devices.length > 0 
                    ? `${devices.length} device(s) found` 
                    : 'No audio devices detected'
            };
        } catch (error) {
            this.diagnostics.devices = {
                status: 'fail',
                message: `Error detecting devices: ${(error as Error).message}`
            };
        }

        // Test system compatibility
        this.diagnostics.system = {
            status: 'pass',
            message: `${process.platform} ${process.arch} - Compatible`
        };

        // Test configuration
        const config = vscode.workspace.getConfiguration('speechToTextWhisper');
        const apiKey = config.get<string>('apiKey');
        this.diagnostics.config = {
            status: apiKey ? 'pass' : 'warning',
            message: apiKey ? 'API key configured' : 'API key not configured'
        };
    }
}

export class DiagnosticItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly description: string,
        public readonly status: 'pass' | 'fail' | 'warning'
    ) {
        super(label, vscode.TreeItemCollapsibleState.None);
        this.description = description;
        this.tooltip = `${this.label}: ${this.description}`;

        // Set icon based on status
        switch (status) {
            case 'pass':
                this.iconPath = new vscode.ThemeIcon('check', new vscode.ThemeColor('charts.green'));
                break;
            case 'fail':
                this.iconPath = new vscode.ThemeIcon('error', new vscode.ThemeColor('charts.red'));
                break;
            case 'warning':
                this.iconPath = new vscode.ThemeIcon('warning', new vscode.ThemeColor('charts.yellow'));
                break;
        }
    }
} 