// webAudioMocks.ts - моки для Web Audio API и DOM объектов для тестирования

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
        // Симулируем событие начала записи
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

    // Статический метод для проверки поддержки MIME типов
    static isTypeSupported(mimeType: string): boolean {
        // Симулируем поддержку основных аудио форматов
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

// Глобальные моки для тестирования
export function setupWebAudioMocks(): void {
    // Настройка глобальных объектов для браузерного API
    
    // Мок MediaRecorder
    (global as any).MediaRecorder = MockMediaRecorder;
    (global as any).MediaStream = MockMediaStream;
    (global as any).Blob = MockBlob;
    (global as any).FormData = MockFormData;
    
    // Мок для AbortSignal.timeout (Node.js 16+)
    if (!(global as any).AbortSignal) {
        (global as any).AbortSignal = {
            timeout: (ms: number) => {
                const controller = new AbortController();
                setTimeout(() => controller.abort(), ms);
                return controller.signal;
            }
        };
    }
    
    // Мок AbortController
    if (!(global as any).AbortController) {
        (global as any).AbortController = class {
            signal: any = { aborted: false };
            abort() {
                this.signal.aborted = true;
            }
        };
    }
    
    // Настройка navigator медиа API
    const mockNavigator = {
        mediaDevices: {
            getUserMedia: sinon.stub().resolves(new MockMediaStream())
        }
    };
    
    // Используем Object.defineProperty вместо прямого присваивания
    Object.defineProperty(global, 'navigator', {
        value: mockNavigator,
        writable: true,
        configurable: true
    });
    
    // Настройка fetch API
    const fetchStub = sinon.stub();
    (global as any).fetch = fetchStub;
}

export function cleanupWebAudioMocks(): void {
    // Очистка всех Sinon стабов
    sinon.restore();
    
    // Удаление глобальных моков
    delete (global as any).MediaRecorder;
    delete (global as any).MediaStream;
    delete (global as any).Blob;
    delete (global as any).FormData;
    delete (global as any).fetch;
    
    // Очистка navigator (если он был переопределен)
    if (global.hasOwnProperty('navigator')) {
        delete (global as any).navigator;
    }
}

// Хелперы для создания мок-данных
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