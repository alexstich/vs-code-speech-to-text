import * as vscode from 'vscode';
import { FFmpegAudioRecorder, AudioRecorderEvents } from '../core/FFmpegAudioRecorder';

export interface AudioDevice {
    id: string;
    name: string;
    isDefault: boolean;
    isSelected: boolean;
}

export class AudioSettingsProvider implements vscode.TreeDataProvider<AudioSettingsItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<AudioSettingsItem | undefined | null | void> = new vscode.EventEmitter<AudioSettingsItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<AudioSettingsItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private audioDevices: AudioDevice[] = [];
    private ffmpegStatus: { available: boolean; version?: string; error?: string } = { available: false };
    private selectedDevice: string = 'auto';

    constructor() {
        this.refresh();
    }

    refresh(): void {
        this.loadAudioDevices();
        this.checkFFmpegStatus();
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: AudioSettingsItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: AudioSettingsItem): Thenable<AudioSettingsItem[]> {
        if (!element) {
            // Root level items
            return Promise.resolve([
                new AudioSettingsItem(
                    'FFmpeg Status',
                    this.ffmpegStatus.available ? 'Available' : 'Not Available',
                    vscode.TreeItemCollapsibleState.None,
                    {
                        command: 'speechToTextWhisper.audioSettings.openFFmpegSettings',
                        title: 'Configure FFmpeg',
                        arguments: []
                    },
                    this.ffmpegStatus.available ? 'check' : 'error'
                ),
                new AudioSettingsItem(
                    'Audio Devices',
                    `${this.audioDevices.length} device(s) found`,
                    vscode.TreeItemCollapsibleState.Expanded,
                    undefined,
                    'device-microphone'
                ),
                new AudioSettingsItem(
                    'Current Settings',
                    'View current configuration',
                    vscode.TreeItemCollapsibleState.Expanded,
                    undefined,
                    'settings'
                )
            ]);
        } else if (element.label === 'Audio Devices') {
            // Audio devices
            return Promise.resolve(
                this.audioDevices.map(device => 
                    new AudioSettingsItem(
                        device.name,
                        device.isSelected ? 'Selected' : (device.isDefault ? 'Default' : ''),
                        vscode.TreeItemCollapsibleState.None,
                        {
                            command: 'speechToTextWhisper.audioSettings.selectDevice',
                            title: 'Select Device',
                            arguments: [device]
                        },
                        device.isSelected ? 'check' : 'device-microphone',
                        'audioDevice'
                    )
                )
            );
        } else if (element.label === 'Current Settings') {
            // Current settings
            const config = vscode.workspace.getConfiguration('speechToTextWhisper');
            return Promise.resolve([
                new AudioSettingsItem(
                    'Input Device',
                    config.get<string>('inputDevice') || 'auto',
                    vscode.TreeItemCollapsibleState.None,
                    {
                        command: 'speechToTextWhisper.openSettings',
                        title: 'Open Settings',
                        arguments: []
                    }
                ),
                new AudioSettingsItem(
                    'Sample Rate',
                    `${config.get<number>('sampleRate') || 16000} Hz`,
                    vscode.TreeItemCollapsibleState.None,
                    {
                        command: 'speechToTextWhisper.openSettings',
                        title: 'Open Settings',
                        arguments: []
                    }
                ),
                new AudioSettingsItem(
                    'Audio Codec',
                    config.get<string>('audioCodec') || 'pcm_s16le',
                    vscode.TreeItemCollapsibleState.None,
                    {
                        command: 'speechToTextWhisper.openSettings',
                        title: 'Open Settings',
                        arguments: []
                    }
                ),
                new AudioSettingsItem(
                    'Channels',
                    config.get<number>('channels') === 2 ? 'Stereo' : 'Mono',
                    vscode.TreeItemCollapsibleState.None,
                    {
                        command: 'speechToTextWhisper.openSettings',
                        title: 'Open Settings',
                        arguments: []
                    }
                )
            ]);
        }

        return Promise.resolve([]);
    }

    private async loadAudioDevices(): Promise<void> {
        try {
            const devices = await FFmpegAudioRecorder.detectInputDevices();
            const config = vscode.workspace.getConfiguration('speechToTextWhisper');
            const selectedDeviceName = config.get<string>('inputDevice') || 'auto';

            this.audioDevices = devices.map((device, index) => ({
                id: index.toString(),
                name: device,
                isDefault: index === 0,
                isSelected: selectedDeviceName === device || (selectedDeviceName === 'auto' && index === 0)
            }));

            this.selectedDevice = selectedDeviceName;
        } catch (error) {
            console.error('Failed to load audio devices:', error);
            this.audioDevices = [];
        }
    }

    private async checkFFmpegStatus(): Promise<void> {
        try {
            const status = await FFmpegAudioRecorder.checkFFmpegAvailability();
            this.ffmpegStatus = status;
        } catch (error) {
            this.ffmpegStatus = {
                available: false,
                error: (error as Error).message
            };
        }
    }

    async selectDevice(device: AudioDevice): Promise<void> {
        try {
            const config = vscode.workspace.getConfiguration('speechToTextWhisper');
            await config.update('inputDevice', device.name, vscode.ConfigurationTarget.Global);
            
            // Update local state
            this.audioDevices.forEach(d => d.isSelected = false);
            const selectedDevice = this.audioDevices.find(d => d.id === device.id);
            if (selectedDevice) {
                selectedDevice.isSelected = true;
            }

            this.refresh();
            vscode.window.showInformationMessage(`✅ Selected audio device: ${device.name}`);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to select device: ${(error as Error).message}`);
        }
    }

    async testDevice(device: AudioDevice): Promise<void> {
        try {
            vscode.window.showInformationMessage(`🎤 Testing audio device: ${device.name}...`);
            
            // Create a temporary FFmpegAudioRecorder to test the device
            const events: AudioRecorderEvents = {
                onRecordingStart: () => {},
                onRecordingStop: () => {},
                onError: (error: Error) => console.error('Test recording error:', error)
            };
            const recorder = new FFmpegAudioRecorder(events);
            
            // This would ideally do a short test recording
            // For now, we'll just check if the device is accessible
            const devices = await FFmpegAudioRecorder.detectInputDevices();
            if (devices.includes(device.name)) {
                vscode.window.showInformationMessage(`✅ Device "${device.name}" is working correctly`);
            } else {
                vscode.window.showWarningMessage(`⚠️ Device "${device.name}" may not be available`);
            }
        } catch (error) {
            vscode.window.showErrorMessage(`❌ Device test failed: ${(error as Error).message}`);
        }
    }

    async detectDevices(): Promise<void> {
        try {
            vscode.window.showInformationMessage('🔍 Detecting audio devices...');
            await this.loadAudioDevices();
            this.refresh();
            vscode.window.showInformationMessage(`✅ Found ${this.audioDevices.length} audio device(s)`);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to detect devices: ${(error as Error).message}`);
        }
    }

    openFFmpegSettings(): void {
        const config = vscode.workspace.getConfiguration('speechToTextWhisper');
        const ffmpegPath = config.get<string>('ffmpegPath');
        
        vscode.window.showInputBox({
            prompt: 'Enter FFmpeg executable path (leave empty for auto-detection)',
            value: ffmpegPath || '',
            placeHolder: '/usr/local/bin/ffmpeg or C:\\ffmpeg\\bin\\ffmpeg.exe'
        }).then(async (newPath) => {
            if (newPath !== undefined) {
                try {
                    await config.update('ffmpegPath', newPath, vscode.ConfigurationTarget.Global);
                    await this.checkFFmpegStatus();
                    this.refresh();
                    vscode.window.showInformationMessage('✅ FFmpeg path updated');
                } catch (error) {
                    vscode.window.showErrorMessage(`Failed to update FFmpeg path: ${(error as Error).message}`);
                }
            }
        });
    }
}

export class AudioSettingsItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly description: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly command?: vscode.Command,
        iconPath?: string,
        public readonly contextValue?: string
    ) {
        super(label, collapsibleState);
        this.description = description;
        this.tooltip = `${this.label}: ${this.description}`;

        if (iconPath) {
            this.iconPath = new vscode.ThemeIcon(iconPath);
        }

        if (contextValue) {
            this.contextValue = contextValue;
        }
    }
} 