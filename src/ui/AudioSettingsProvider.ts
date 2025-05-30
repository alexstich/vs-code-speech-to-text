import * as vscode from 'vscode';
import { FFmpegAudioRecorder } from '../core/FFmpegAudioRecorder';

/**
 * Провайдер данных для FFmpeg настроек
 */
export class AudioSettingsProvider implements vscode.TreeDataProvider<AudioSettingsItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<AudioSettingsItem | undefined | void> = new vscode.EventEmitter<AudioSettingsItem | undefined | void>();
    readonly onDidChangeTreeData: vscode.Event<AudioSettingsItem | undefined | void> = this._onDidChangeTreeData.event;

    constructor() {}

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: AudioSettingsItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: AudioSettingsItem): Promise<AudioSettingsItem[]> {
        if (!element) {
            // Корневые элементы
            return this.getFFmpegSettings();
        }
        return [];
    }

    private async getFFmpegSettings(): Promise<AudioSettingsItem[]> {
        const config = vscode.workspace.getConfiguration('speechToTextWhisper');
        const items: AudioSettingsItem[] = [];

        // Проверка FFmpeg
        const ffmpegCheck = await FFmpegAudioRecorder.checkFFmpegAvailability();
        
        const ffmpegStatusItem = new AudioSettingsItem(
            ffmpegCheck.available ? '✅ FFmpeg Available' : '❌ FFmpeg Not Found',
            ffmpegCheck.version ? `Version: ${ffmpegCheck.version}` : (ffmpegCheck.error || 'Not available'),
            ffmpegCheck.available ? vscode.TreeItemCollapsibleState.None : vscode.TreeItemCollapsibleState.None
        );
        ffmpegStatusItem.iconPath = new vscode.ThemeIcon(ffmpegCheck.available ? 'check' : 'error');
        items.push(ffmpegStatusItem);

        // Путь к FFmpeg
        const ffmpegPath = config.get<string>('ffmpegPath') || 'auto-detect';
        const pathItem = new AudioSettingsItem(
            'FFmpeg Path',
            ffmpegPath,
            vscode.TreeItemCollapsibleState.None
        );
        pathItem.iconPath = new vscode.ThemeIcon('folder');
        pathItem.command = {
            command: 'speechToTextWhisper.audioSettings.openFFmpegSettings',
            title: 'Configure FFmpeg Path'
        };
        items.push(pathItem);

        return items;
    }

    async configureFFmpegPath(): Promise<void> {
        const currentPath = vscode.workspace.getConfiguration('speechToTextWhisper').get<string>('ffmpegPath') || '';
        
        const newPath = await vscode.window.showInputBox({
            prompt: 'Enter path to FFmpeg executable (leave empty for auto-detection)',
            value: currentPath,
            placeHolder: '/usr/local/bin/ffmpeg or C:\\ffmpeg\\bin\\ffmpeg.exe'
        });

        if (newPath !== undefined) {
            await vscode.workspace.getConfiguration('speechToTextWhisper').update('ffmpegPath', newPath || '', vscode.ConfigurationTarget.Global);
            this.refresh();
            vscode.window.showInformationMessage('FFmpeg path updated. Please restart the extension to apply changes.');
        }
    }
}

class AudioSettingsItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly tooltip: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState
    ) {
        super(label, collapsibleState);
        this.tooltip = tooltip;
    }
} 