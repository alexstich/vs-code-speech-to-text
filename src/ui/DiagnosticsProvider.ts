import * as vscode from 'vscode';
import { FFmpegAudioRecorder, AudioDevice } from '../core/FFmpegAudioRecorder';

/**
 * Провайдер данных для управления аудио устройствами
 */
export class DeviceManagerProvider implements vscode.TreeDataProvider<DeviceItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<DeviceItem | undefined | void> = new vscode.EventEmitter<DeviceItem | undefined | void>();
    readonly onDidChangeTreeData: vscode.Event<DeviceItem | undefined | void> = this._onDidChangeTreeData.event;

    constructor() {}

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: DeviceItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: DeviceItem): Promise<DeviceItem[]> {
        if (!element) {
            return this.getAudioDevices();
        }
        return [];
    }

    private async getAudioDevices(): Promise<DeviceItem[]> {
        const config = vscode.workspace.getConfiguration('speechToTextWhisper');
        const selectedDeviceId = config.get<string>('inputDevice') || 'auto';
        
        try {
            const devices = await FFmpegAudioRecorder.detectInputDevices();
            const items: DeviceItem[] = [];

            devices.forEach((device, index) => {
                const isSelected = selectedDeviceId === device.id || (selectedDeviceId === 'auto' && device.isDefault);
                const statusText = isSelected ? '✅ Selected' : (device.isDefault ? '⭐ Default' : '');
                
                const deviceItem = new DeviceItem(
                    device.name,
                    statusText,
                    vscode.TreeItemCollapsibleState.None
                );
                deviceItem.iconPath = new vscode.ThemeIcon(isSelected ? 'check' : 'device-microphone');
                deviceItem.contextValue = 'audioDevice';
                deviceItem.command = {
                    command: 'speechToTextWhisper.audioSettings.selectDevice',
                    title: 'Select Device',
                    arguments: [device.id]
                };
                deviceItem.tooltip = `${device.name} (ID: ${device.id})${device.isDefault ? ' - Default' : ''}`;
                items.push(deviceItem);
            });

            return items;
        } catch (error) {
            const errorItem = new DeviceItem(
                '❌ Device Detection Failed',
                (error as Error).message,
                vscode.TreeItemCollapsibleState.None
            );
            errorItem.iconPath = new vscode.ThemeIcon('error');
            return [errorItem];
        }
    }

    async selectDevice(deviceId: string): Promise<void> {
        try {
            const config = vscode.workspace.getConfiguration('speechToTextWhisper');
            await config.update('inputDevice', deviceId, vscode.ConfigurationTarget.Global);
            
            const devices = await FFmpegAudioRecorder.detectInputDevices();
            const selectedDevice = devices.find(device => device.id === deviceId);
            const deviceName = selectedDevice?.name || deviceId;
            
            this.refresh();
            vscode.window.showInformationMessage(`✅ Selected audio device: ${deviceName}`);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to select device: ${(error as Error).message}`);
        }
    }

    async testDevice(deviceId: string): Promise<void> {
        try {
            const devices = await FFmpegAudioRecorder.detectInputDevices();
            const device = devices.find(d => d.id === deviceId);
            const deviceName = device?.name || deviceId;
            
            vscode.window.showInformationMessage(`🎤 Testing device: ${deviceName}...`);
            
            if (device) {
                vscode.window.showInformationMessage(`✅ Device "${deviceName}" is available`);
            } else {
                vscode.window.showWarningMessage(`⚠️ Device "${deviceName}" not found`);
            }
        } catch (error) {
            vscode.window.showErrorMessage(`❌ Device test failed: ${(error as Error).message}`);
        }
    }
}

/**
 * Провайдер данных для диагностики
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

        // FFmpeg проверка
        const ffmpegCheck = await FFmpegAudioRecorder.checkFFmpegAvailability();
        const ffmpegItem = new DiagnosticItem(
            'FFmpeg',
            ffmpegCheck.available ? '✅ Available' : '❌ Not Found',
            ffmpegCheck.version || ffmpegCheck.error || 'Unknown status'
        );
        ffmpegItem.iconPath = new vscode.ThemeIcon(ffmpegCheck.available ? 'check' : 'error');
        items.push(ffmpegItem);

        // Аудио устройства
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

        // API ключ
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

class DeviceItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly description: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState
    ) {
        super(label, collapsibleState);
        this.description = description;
        this.tooltip = `${label}: ${description}`;
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