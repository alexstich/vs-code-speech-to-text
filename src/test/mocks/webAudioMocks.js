"use strict";
// webAudioMocks.ts - моки для Web Audio API и DOM объектов для тестирования
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.MockFormData = exports.MockBlob = exports.MockNavigator = exports.MockMediaStreamTrack = exports.MockMediaStream = exports.MockMediaRecorder = void 0;
exports.setupWebAudioMocks = setupWebAudioMocks;
exports.cleanupWebAudioMocks = cleanupWebAudioMocks;
exports.createMockAudioBlob = createMockAudioBlob;
exports.createMockApiResponse = createMockApiResponse;
exports.createMockApiError = createMockApiError;
const sinon = __importStar(require("sinon"));
class MockMediaRecorder {
    state = 'inactive';
    mimeType;
    ondataavailable = null;
    onstop = null;
    onerror = null;
    constructor(stream, options) {
        this.mimeType = options?.mimeType || 'audio/webm';
    }
    start(timeslice) {
        this.state = 'recording';
        // Симулируем событие начала записи
        setTimeout(() => {
            if (this.ondataavailable) {
                const mockBlob = new Blob(['mock audio data'], { type: this.mimeType });
                this.ondataavailable({ data: mockBlob, timecode: Date.now() });
            }
        }, timeslice || 100);
    }
    stop() {
        this.state = 'inactive';
        setTimeout(() => {
            if (this.onstop) {
                this.onstop();
            }
        }, 50);
    }
    pause() {
        this.state = 'paused';
    }
    resume() {
        this.state = 'recording';
    }
    // Статический метод для проверки поддержки MIME типов
    static isTypeSupported(mimeType) {
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
exports.MockMediaRecorder = MockMediaRecorder;
class MockMediaStream {
    tracks = [];
    constructor() {
        this.tracks = [new MockMediaStreamTrack()];
    }
    getTracks() {
        return this.tracks;
    }
    getAudioTracks() {
        return this.tracks.filter(track => track.kind === 'audio');
    }
    addTrack(track) {
        this.tracks.push(track);
    }
    removeTrack(track) {
        const index = this.tracks.indexOf(track);
        if (index > -1) {
            this.tracks.splice(index, 1);
        }
    }
}
exports.MockMediaStream = MockMediaStream;
class MockMediaStreamTrack {
    kind = 'audio';
    enabled = true;
    readyState = 'live';
    stop() {
        this.readyState = 'ended';
    }
}
exports.MockMediaStreamTrack = MockMediaStreamTrack;
class MockNavigator {
    mediaDevices = {
        getUserMedia: sinon.stub().resolves(new MockMediaStream())
    };
}
exports.MockNavigator = MockNavigator;
class MockBlob {
    size;
    type;
    constructor(blobParts, options) {
        this.type = options?.type || '';
        this.size = blobParts ? blobParts.join('').length : 0;
    }
}
exports.MockBlob = MockBlob;
class MockFormData {
    data = new Map();
    append(name, value, filename) {
        this.data.set(name, value);
    }
    get(name) {
        return this.data.get(name);
    }
    has(name) {
        return this.data.has(name);
    }
    set(name, value, filename) {
        this.data.set(name, value);
    }
    delete(name) {
        this.data.delete(name);
    }
    getAll(name) {
        const value = this.data.get(name);
        return value ? [value] : [];
    }
    keys() {
        return this.data.keys();
    }
    values() {
        return this.data.values();
    }
    entries() {
        return this.data.entries();
    }
}
exports.MockFormData = MockFormData;
// Глобальные моки для тестирования
function setupWebAudioMocks() {
    // Настройка глобальных объектов для браузерного API
    // Мок MediaRecorder
    global.MediaRecorder = MockMediaRecorder;
    global.MediaStream = MockMediaStream;
    global.Blob = MockBlob;
    global.FormData = MockFormData;
    // Мок для AbortSignal.timeout (Node.js 16+)
    if (!global.AbortSignal) {
        global.AbortSignal = {
            timeout: (ms) => {
                const controller = new AbortController();
                setTimeout(() => controller.abort(), ms);
                return controller.signal;
            }
        };
    }
    // Мок AbortController
    if (!global.AbortController) {
        global.AbortController = class {
            signal = { aborted: false };
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
    global.fetch = fetchStub;
}
function cleanupWebAudioMocks() {
    // Очистка всех Sinon стабов
    sinon.restore();
    // Удаление глобальных моков
    delete global.MediaRecorder;
    delete global.MediaStream;
    delete global.Blob;
    delete global.FormData;
    delete global.fetch;
    // Очистка navigator (если он был переопределен)
    if (global.hasOwnProperty('navigator')) {
        delete global.navigator;
    }
}
// Хелперы для создания мок-данных
function createMockAudioBlob() {
    return new Blob(['mock audio data'], { type: 'audio/webm' });
}
function createMockApiResponse(text) {
    return {
        ok: true,
        json: () => Promise.resolve({ text })
    };
}
function createMockApiError(status, message) {
    return {
        ok: false,
        status,
        statusText: message,
        json: () => Promise.resolve({ error: message })
    };
}
//# sourceMappingURL=webAudioMocks.js.map