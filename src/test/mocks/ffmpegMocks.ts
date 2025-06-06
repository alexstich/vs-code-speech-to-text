// ffmpegMocks.ts - FFmpeg and related module mocks for testing

import * as sinon from 'sinon';
import { ChildProcess } from 'child_process';
import { EventEmitter } from 'events';

export interface MockFFmpegProcess extends EventEmitter {
    stdin: { write: sinon.SinonStub; end: sinon.SinonStub; };
    stdout: { on: sinon.SinonStub; };
    stderr: { on: sinon.SinonStub; };
    kill: sinon.SinonStub;
    pid: number;
    exitCode: number | null;
}

export class MockChildProcess extends EventEmitter implements MockFFmpegProcess {
    public stdin = {
        write: sinon.stub(),
        end: sinon.stub()
    };
    public stdout = {
        on: sinon.stub()
    };
    public stderr = {
        on: sinon.stub()
    };
    public kill = sinon.stub();
    public pid = 12345;
    public exitCode: number | null = null;

    constructor() {
        super();
        // Simulate successful process completion by default
        setTimeout(() => {
            this.exitCode = 0;
            this.emit('exit', 0, null);
        }, 100);
    }

    simulateError(errorCode: number, signal?: string): void {
        this.exitCode = errorCode;
        this.emit('exit', errorCode, signal);
    }

    simulateFFmpegOutput(data: string): void {
        this.stderr.on.callsArgWith(1, Buffer.from(data));
    }
}

export class MockTempFile {
    public path: string;
    public fd: number;
    public removeCallback: sinon.SinonStub;

    constructor(path: string = '/tmp/mock-audio-12345.wav') {
        this.path = path;
        this.fd = 3;
        this.removeCallback = sinon.stub();
    }
}

// Mock for 'which' module
export const mockWhich = {
    sync: sinon.stub()
};

// Mock for 'tmp' module
export const mockTmp = {
    file: sinon.stub(),
    setGracefulCleanup: sinon.stub()
};

// Mock for 'child_process' module
export const mockChildProcess = {
    spawn: sinon.stub()
};

// Mock for 'fs' module
export const mockFs = {
    createReadStream: sinon.stub(),
    createWriteStream: sinon.stub(),
    existsSync: sinon.stub(),
    readFileSync: sinon.stub(),
    writeFileSync: sinon.stub(),
    unlinkSync: sinon.stub(),
    promises: {
        access: sinon.stub(),
        unlink: sinon.stub(),
        readFile: sinon.stub(),
        writeFile: sinon.stub()
    }
};

// Mock for 'path' module
export const mockPath = {
    join: sinon.stub(),
    resolve: sinon.stub(),
    dirname: sinon.stub(),
    basename: sinon.stub(),
    extname: sinon.stub()
};

// Mock for Node.js Blob (if available)
export class MockBlob {
    public size: number;
    public type: string;
    private _data: any[];

    constructor(blobParts?: any[], options?: any) {
        this.type = options?.type || 'audio/wav';
        this._data = blobParts || [];
        this.size = this._data.join('').length;
    }

    async arrayBuffer(): Promise<ArrayBuffer> {
        const data = this._data.join('');
        const buffer = new ArrayBuffer(data.length);
        const view = new Uint8Array(buffer);
        for (let i = 0; i < data.length; i++) {
            view[i] = data.charCodeAt(i);
        }
        return buffer;
    }

    stream(): ReadableStream {
        const data = this._data;
        return new ReadableStream({
            start(controller) {
                controller.enqueue(new Uint8Array(Buffer.from(data.join(''))));
                controller.close();
            }
        });
    }

    slice(start?: number, end?: number, contentType?: string): Blob {
        const slicedData = this._data.join('').slice(start, end);
        return new MockBlob([slicedData], { type: contentType || this.type });
    }

    async text(): Promise<string> {
        return this._data.join('');
    }

    async bytes(): Promise<Uint8Array> {
        const data = this._data.join('');
        const buffer = new Uint8Array(data.length);
        for (let i = 0; i < data.length; i++) {
            buffer[i] = data.charCodeAt(i);
        }
        return buffer;
    }
}

// Mock for platform-specific commands
export const mockPlatformCommands = {
    win32: {
        ffmpeg: 'ffmpeg.exe',
        listDevices: ['-f', 'dshow', '-list_devices', 'true', '-i', 'dummy'],
        recordCommand: ['-f', 'dshow', '-i', 'audio="Microphone"']
    },
    darwin: {
        ffmpeg: 'ffmpeg',
        listDevices: ['-f', 'avfoundation', '-list_devices', 'true', '-i', '""'],
        recordCommand: ['-f', 'avfoundation', '-i', ':0']
    },
    linux: {
        ffmpeg: 'ffmpeg',
        listDevices: ['-f', 'pulse', '-list_devices', 'true', '-i', 'dummy'],
        recordCommand: ['-f', 'pulse', '-i', 'default']
    }
};

// Mock for list_devices command output
export const mockDeviceListOutput = {
    win32: `[dshow @ 0x12345] DirectShow video devices
[dshow @ 0x12345]  "Integrated Camera"
[dshow @ 0x12345] DirectShow audio devices
[dshow @ 0x12345]  "Microphone (High Definition Audio Device)"
[dshow @ 0x12345]  "Line In (High Definition Audio Device)"`,
    
    darwin: `[AVFoundation indev @ 0x12345] AVFoundation video devices:
[AVFoundation indev @ 0x12345] [0] FaceTime HD Camera
[AVFoundation indev @ 0x12345] AVFoundation audio devices:
[AVFoundation indev @ 0x12345] [0] MacBook Pro Microphone
[AVFoundation indev @ 0x12345] [1] External Microphone`,
    
    linux: `[pulse @ 0x12345] PulseAudio audio devices:
[pulse @ 0x12345]  "default" (PulseAudio default)
[pulse @ 0x12345]  "alsa_input.pci-0000_00_1f.3.analog-stereo" (Built-in Audio Analog Stereo)`
};

// Global mocks for testing
export function setupFFmpegMocks(): void {
    // Mock which - determines FFmpeg availability
    mockWhich.sync.withArgs('ffmpeg').returns('/usr/local/bin/ffmpeg');
    mockWhich.sync.withArgs('ffmpeg.exe').returns('C:\\ffmpeg\\bin\\ffmpeg.exe');
    
    // Mock tmp - creating temporary files
    const mockTempFile = new MockTempFile();
    mockTmp.file.callsArgWith(1, null, mockTempFile.path, mockTempFile.fd, mockTempFile.removeCallback);
    
    // Mock child_process.spawn - starting FFmpeg
    const mockProcess = new MockChildProcess();
    mockChildProcess.spawn.returns(mockProcess);
    
    // Mock fs operations
    mockFs.existsSync.returns(true);
    mockFs.createReadStream.returns({
        on: sinon.stub(),
        pipe: sinon.stub(),
        destroy: sinon.stub()
    });
    mockFs.createWriteStream.returns({
        write: sinon.stub(),
        end: sinon.stub(),
        on: sinon.stub()
    });
    
    // Mock path operations
    mockPath.join.callsFake((...args) => args.join('/'));
    mockPath.resolve.callsFake((...args) => '/' + args.join('/'));
    mockPath.dirname.returns('/tmp');
    mockPath.basename.returns('mock-audio.wav');
    mockPath.extname.returns('.wav');
    
    // Setup Node.js Blob if available
    if (!(global as any).Blob) {
        (global as any).Blob = MockBlob;
    }
    
    // Mock for process.platform
    Object.defineProperty(process, 'platform', {
        value: 'darwin', // default macOS for tests
        writable: true,
        configurable: true
    });
}

export function cleanupFFmpegMocks(): void {
    // Clear all stubs
    sinon.restore();
    
    // Reset mocks to initial state
    mockWhich.sync.reset();
    mockTmp.file.reset();
    mockChildProcess.spawn.reset();
    mockFs.existsSync.reset();
    mockFs.createReadStream.reset();
    mockFs.createWriteStream.reset();
    mockPath.join.reset();
    mockPath.resolve.reset();
    mockPath.dirname.reset();
    mockPath.basename.reset();
    mockPath.extname.reset();
}

export function createMockAudioBlob(size: number = 1024): MockBlob {
    const audioData = new Array(size).fill('0').join('');
    return new MockBlob([audioData], { type: 'audio/wav' });
}

export function createMockFFmpegError(message: string, code: string = 'ENOENT'): Error {
    const error = new Error(message) as any;
    error.code = code;
    error.syscall = 'spawn ffmpeg';
    error.path = 'ffmpeg';
    return error;
}

export function createMockDeviceList(platform: string = 'darwin'): string[] {
    switch (platform) {
        case 'win32':
            return ['Microphone (High Definition Audio Device)', 'Line In (High Definition Audio Device)'];
        case 'darwin':
            return ['MacBook Pro Microphone', 'External Microphone'];
        case 'linux':
            return ['default', 'alsa_input.pci-0000_00_1f.3.analog-stereo'];
        default:
            return ['Default Microphone'];
    }
}

export function simulateFFmpegVersion(): string {
    return `ffmpeg version 4.4.0 Copyright (c) 2000-2021 the FFmpeg developers
built with Apple clang version 12.0.0
configuration: --enable-gpl --enable-version3`;
}

export function simulatePlatformSpecificBehavior(platform: string): void {
    Object.defineProperty(process, 'platform', {
        value: platform,
        writable: true,
        configurable: true
    });
    
    // Setup platform-specific mocks
    const commands = mockPlatformCommands[platform as keyof typeof mockPlatformCommands];
    if (commands) {
        mockWhich.sync.withArgs(commands.ffmpeg).returns(`/usr/local/bin/${commands.ffmpeg}`);
    }
}

// Utilities for testing various scenarios
export const FFmpegTestScenarios = {
    // Successful recording
    successfulRecording: () => {
        const process = new MockChildProcess();
        mockChildProcess.spawn.returns(process);
        return process;
    },
    
    // FFmpeg not found
    ffmpegNotFound: () => {
        mockWhich.sync.throws(createMockFFmpegError('FFmpeg not found', 'ENOENT'));
    },
    
    // Recording error
    recordingError: () => {
        const process = new MockChildProcess();
        setTimeout(() => process.simulateError(1, 'SIGTERM'), 50);
        mockChildProcess.spawn.returns(process);
        return process;
    },
    
    // No audio devices
    noAudioDevices: () => {
        const process = new MockChildProcess();
        process.simulateFFmpegOutput('No audio devices found');
        mockChildProcess.spawn.returns(process);
        return process;
    },
    
    // Temporary file cannot be created
    tempFileError: () => {
        mockTmp.file.callsArgWith(1, new Error('Cannot create temp file'), null, null, null);
    }
}; 