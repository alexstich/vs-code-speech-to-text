// webAudioMocks.ts - Mocks for Web Audio API and DOM objects for testing

import * as sinon from 'sinon';

export class MockMediaRecorder {
    public state: string = 'inactive';
    public mimeType: string;
    public ondataavailable: ((event: any) => void) | null = null;
    public onstop: (() => void) | null = null;
    public onerror: ((error: any) => void) | null = null;

    constructor(stream: any, options?: any) {
        this.mimeType = options?.mimeType || 'audio/webm';
    }

    start(timeslice?: number): void {
        this.state = 'recording';
        // Simulate recording start event
        setTimeout(() => {
            if (this.ondataavailable) {
                const mockBlob = new Blob(['mock audio data'], { type: this.mimeType });
                this.ondataavailable({ data: mockBlob, timecode: Date.now() });
            }
        }, timeslice || 100);
    }

    stop(): void {
        this.state = 'inactive';
        setTimeout(() => {
            if (this.onstop) {
                this.onstop();
            }
        }, 50);
    }

    pause(): void {
        this.state = 'paused';
    }

    resume(): void {
        this.state = 'recording';
    }

    // Static method to check MIME type support
    static isTypeSupported(mimeType: string): boolean {
        // Simulate support for basic audio formats
        const supportedTypes = [
            'audio/webm',
            'audio/webm;codecs=opus',
            'audio/mp4',
            'audio/wav',
            'audio/ogg',
            'audio/ogg;codecs=opus'
        ];
        return supportedTypes.includes(mimeType);
    }
}

export class MockMediaStream {
    private tracks: MockMediaStreamTrack[] = [];

    constructor() {
        this.tracks = [new MockMediaStreamTrack()];
    }

    getTracks(): MockMediaStreamTrack[] {
        return this.tracks;
    }

    getAudioTracks(): MockMediaStreamTrack[] {
        return this.tracks.filter(track => track.kind === 'audio');
    }

    addTrack(track: MockMediaStreamTrack): void {
        this.tracks.push(track);
    }

    removeTrack(track: MockMediaStreamTrack): void {
        const index = this.tracks.indexOf(track);
        if (index > -1) {
            this.tracks.splice(index, 1);
        }
    }
}

export class MockMediaStreamTrack {
    public kind: string = 'audio';
    public enabled: boolean = true;
    public readyState: string = 'live';

    stop(): void {
        this.readyState = 'ended';
    }
}

export class MockNavigator {
    public mediaDevices = {
        getUserMedia: sinon.stub().resolves(new MockMediaStream())
    };
}

export class MockBlob {
    public size: number;
    public type: string;
    
    constructor(blobParts?: any[], options?: any) {
        this.type = options?.type || '';
        this.size = blobParts ? blobParts.join('').length : 0;
    }
}

export class MockFormData {
    private data: Map<string, any> = new Map();
    
    append(name: string, value: any, filename?: string): void {
        this.data.set(name, value);
    }
    
    get(name: string): any {
        return this.data.get(name);
    }
    
    has(name: string): boolean {
        return this.data.has(name);
    }
    
    set(name: string, value: any, filename?: string): void {
        this.data.set(name, value);
    }
    
    delete(name: string): void {
        this.data.delete(name);
    }
    
    getAll(name: string): any[] {
        const value = this.data.get(name);
        return value ? [value] : [];
    }
    
    keys(): IterableIterator<string> {
        return this.data.keys();
    }
    
    values(): IterableIterator<any> {
        return this.data.values();
    }
    
    entries(): IterableIterator<[string, any]> {
        return this.data.entries();
    }
}

// Global mocks for testing
export function setupWebAudioMocks(): void {
    // Configure global objects for browser API
    
    // Mock MediaRecorder
    (global as any).MediaRecorder = MockMediaRecorder;
    (global as any).MediaStream = MockMediaStream;
    (global as any).Blob = MockBlob;
    (global as any).FormData = MockFormData;
    
    // Mock for AbortSignal.timeout (Node.js 16+)
    if (!(global as any).AbortSignal) {
        (global as any).AbortSignal = {
            timeout: (ms: number) => {
                const controller = new AbortController();
                setTimeout(() => controller.abort(), ms);
                return controller.signal;
            }
        };
    }
    
    // Mock AbortController
    if (!(global as any).AbortController) {
        (global as any).AbortController = class {
            signal: any = { aborted: false };
            abort() {
                this.signal.aborted = true;
            }
        };
    }
    
    // Configure navigator media API
    const mockNavigator = {
        mediaDevices: {
            getUserMedia: sinon.stub().resolves(new MockMediaStream())
        }
    };
    
    // Use Object.defineProperty instead of direct assignment
    Object.defineProperty(global, 'navigator', {
        value: mockNavigator,
        writable: true,
        configurable: true
    });
    
    // Configure fetch API
    const fetchStub = sinon.stub();
    (global as any).fetch = fetchStub;
}

export function cleanupWebAudioMocks(): void {
    // Cleanup all Sinon stubs
    sinon.restore();
    
    // Remove global mocks
    delete (global as any).MediaRecorder;
    delete (global as any).MediaStream;
    delete (global as any).Blob;
    delete (global as any).FormData;
    delete (global as any).fetch;
    
    // Cleanup navigator (if it was overridden)
    if (global.hasOwnProperty('navigator')) {
        delete (global as any).navigator;
    }
}

// Helpers for creating mock data
export function createMockAudioBlob(): Blob {
    return new Blob(['mock audio data'], { type: 'audio/webm' });
}

export function createMockApiResponse(text: string): any {
    return {
        ok: true,
        json: () => Promise.resolve({ text })
    };
}

export function createMockApiError(status: number, message: string): any {
    return {
        ok: false,
        status,
        statusText: message,
        json: () => Promise.resolve({ error: message })
    };
} 