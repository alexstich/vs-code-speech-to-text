// testData.ts - тестовые данные и fixtures для unit/integration тестов

export const testAudioData = {
    // Мок данные для аудио файлов
    validAudioBlob: {
        type: 'audio/webm',
        size: 1024,
        data: 'mock audio data for testing'
    },
    
    validWavBlob: {
        type: 'audio/wav',
        size: 2048,
        data: 'mock wav audio data'
    },
    
    emptyAudioBlob: {
        type: 'audio/webm',
        size: 0,
        data: ''
    }
};

export const testApiResponses = {
    // Успешные ответы API
    successfulTranscription: {
        text: 'Привет, это тестовая транскрипция аудио'
    },
    
    englishTranscription: {
        text: 'Hello, this is a test audio transcription'
    },
    
    codeTranscription: {
        text: 'function sayHello() { console.log("Hello World"); }'
    },
    
    // Ошибки API
    invalidApiKeyError: {
        error: {
            message: 'Invalid API key provided',
            type: 'invalid_request_error'
        }
    },
    
    quotaExceededError: {
        error: {
            message: 'You exceeded your current quota',
            type: 'insufficient_quota'
        }
    },
    
    fileTooBigError: {
        error: {
            message: 'File size too large',
            type: 'invalid_request_error'
        }
    }
};

export const testLanguageConfigs = {
    javascript: {
        languageId: 'javascript',
        fileName: 'test.js',
        singleLineComment: '//',
        multiLineComment: { start: '/*', end: '*/' },
        extension: '.js'
    },
    
    python: {
        languageId: 'python',
        fileName: 'test.py',
        singleLineComment: '#',
        multiLineComment: { start: '"""', end: '"""' },
        extension: '.py'
    },
    
    typescript: {
        languageId: 'typescript',
        fileName: 'test.ts',
        singleLineComment: '//',
        multiLineComment: { start: '/*', end: '*/' },
        extension: '.ts'
    },
    
    html: {
        languageId: 'html',
        fileName: 'test.html',
        singleLineComment: '<!-- -->',
        multiLineComment: { start: '<!--', end: '-->' },
        extension: '.html'
    },
    
    css: {
        languageId: 'css',
        fileName: 'test.css',
        singleLineComment: '/* */',
        multiLineComment: { start: '/*', end: '*/' },
        extension: '.css'
    }
};

export const testUserSettings = {
    // Настройки расширения для тестирования
    default: {
        'speechToTextWhisper.apiKey': 'test-api-key',
        'speechToTextWhisper.language': 'auto',
        'speechToTextWhisper.recordingMode': 'hold',
        'speechToTextWhisper.insertMode': 'cursor'
    },
    
    withRussianLanguage: {
        'speechToTextWhisper.apiKey': 'test-api-key',
        'speechToTextWhisper.language': 'ru',
        'speechToTextWhisper.recordingMode': 'hold',
        'speechToTextWhisper.insertMode': 'cursor'
    },
    
    toggleMode: {
        'speechToTextWhisper.apiKey': 'test-api-key',
        'speechToTextWhisper.language': 'auto',
        'speechToTextWhisper.recordingMode': 'toggle',
        'speechToTextWhisper.insertMode': 'cursor'
    },
    
    commentMode: {
        'speechToTextWhisper.apiKey': 'test-api-key',
        'speechToTextWhisper.language': 'auto',
        'speechToTextWhisper.recordingMode': 'hold',
        'speechToTextWhisper.insertMode': 'comment'
    },
    
    noApiKey: {
        'speechToTextWhisper.language': 'auto',
        'speechToTextWhisper.recordingMode': 'hold',
        'speechToTextWhisper.insertMode': 'cursor'
    }
};

export const testScenarios = {
    // Сценарии для integration тестов
    basicRecordingFlow: {
        description: 'Базовый сценарий: запись → транскрипция → вставка',
        steps: [
            'User presses F9',
            'Recording starts',
            'User releases F9',
            'Recording stops',
            'Audio sent to API',
            'Text received from API',
            'Text inserted at cursor'
        ],
        expectedResult: 'Text should be inserted at cursor position'
    },
    
    recordingWithoutMicrophone: {
        description: 'Сценарий без доступа к микрофону',
        steps: [
            'User presses F9',
            'getUserMedia fails',
            'Error message shown'
        ],
        expectedResult: 'User should see microphone access error'
    },
    
    recordingWithInvalidApiKey: {
        description: 'Сценарий с неверным API ключом',
        steps: [
            'User presses F9',
            'Recording completes',
            'API returns 401 error',
            'Error message shown'
        ],
        expectedResult: 'User should see API key error'
    },
    
    insertAsComment: {
        description: 'Вставка как комментарий в код',
        steps: [
            'User opens JS file',
            'User presses F9',
            'Recording completes',
            'Text inserted as comment'
        ],
        expectedResult: 'Text should be inserted as // comment'
    }
};

export const testEditorStates = {
    // Различные состояния редактора для тестирования
    emptyFile: {
        content: '',
        cursorPosition: { line: 0, character: 0 },
        selection: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } }
    },
    
    fileWithContent: {
        content: 'function test() {\n  console.log("test");\n}',
        cursorPosition: { line: 1, character: 2 },
        selection: { start: { line: 1, character: 2 }, end: { line: 1, character: 2 } }
    },
    
    selectedText: {
        content: 'const message = "old text";',
        cursorPosition: { line: 0, character: 16 },
        selection: { start: { line: 0, character: 16 }, end: { line: 0, character: 26 } }
    },
    
    multilineSelection: {
        content: 'line 1\nline 2\nline 3',
        cursorPosition: { line: 0, character: 0 },
        selection: { start: { line: 0, character: 0 }, end: { line: 2, character: 6 } }
    }
};

export function createMockBlob(data: any): Blob {
    return new (global as any).Blob([data.data], { type: data.type });
}

export function createMockResponse(data: any, status: number = 200): Response {
    const mockResponse = {
        ok: status >= 200 && status < 300,
        status,
        statusText: status === 200 ? 'OK' : 'Error',
        json: () => Promise.resolve(data),
        text: () => Promise.resolve(JSON.stringify(data))
    };
    return mockResponse as Response;
} 