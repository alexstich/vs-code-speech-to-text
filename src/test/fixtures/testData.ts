// testData.ts - Test data and fixtures for unit/integration tests

export const testAudioData = {
    // Mock data for audio files
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
    // Successful API responses
    successfulTranscription: {
        text: 'Hello, this is a test audio transcription'
    },
    
    englishTranscription: {
        text: 'Hello, this is a test audio transcription'
    },
    
    codeTranscription: {
        text: 'function sayHello() { console.log("Hello World"); }'
    },
    
    // API Errors
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
    // Extension settings for testing
    default: {
        'speechToTextWhisper.apiKey': 'test-api-key',
        'speechToTextWhisper.language': 'auto',
        'speechToTextWhisper.recordingMode': 'chat'
    },
    
    withRussianLanguage: {
        'speechToTextWhisper.apiKey': 'test-api-key',
        'speechToTextWhisper.language': 'ru',
        'speechToTextWhisper.recordingMode': 'chat'
    },
    
    clipboardMode: {
        'speechToTextWhisper.apiKey': 'test-api-key',
        'speechToTextWhisper.language': 'auto',
        'speechToTextWhisper.recordingMode': 'clipboard'
    },
    
    chatMode: {
        'speechToTextWhisper.apiKey': 'test-api-key',
        'speechToTextWhisper.language': 'auto',
        'speechToTextWhisper.recordingMode': 'chat'
    },
    
    noApiKey: {
        'speechToTextWhisper.language': 'auto',
        'speechToTextWhisper.recordingMode': 'chat'
    }
};

export const testScenarios = {
    // Scenarios for integration tests
    basicChatRecordingFlow: {
        description: 'Basic scenario: recording → transcription → sending to chat',
        steps: [
            'User presses Ctrl+Shift+N',
            'Recording starts',
            'User releases Ctrl+Shift+N',
            'Recording stops',
            'Audio sent to API',
            'Text received from API',
            'Text sent to Cursor chat'
        ],
        expectedResult: 'Text should be sent to Cursor chat'
    },
    
    basicClipboardRecordingFlow: {
        description: 'Basic scenario: recording → transcription → copying to clipboard',
        steps: [
            'User presses Ctrl+Shift+V',
            'Recording starts',
            'User releases Ctrl+Shift+V',
            'Recording stops',
            'Audio sent to API',
            'Text received from API',
            'Text copied to clipboard'
        ],
        expectedResult: 'Text should be copied to clipboard'
    },
    
    recordingWithoutMicrophone: {
        description: 'Scenario without microphone access',
        steps: [
            'User presses Ctrl+Shift+N',
            'getUserMedia fails',
            'Error message shown'
        ],
        expectedResult: 'User should see microphone access error'
    },
    
    recordingWithInvalidApiKey: {
        description: 'Scenario with invalid API key',
        steps: [
            'User presses Ctrl+Shift+N',
            'Recording completes',
            'API returns 401 error',
            'Error message shown'
        ],
        expectedResult: 'User should see API key error'
    },
    
    cursorIntegrationUnavailable: {
        description: 'Scenario when Cursor integration is unavailable',
        steps: [
            'User presses Ctrl+Shift+N in VS Code',
            'Recording completes',
            'Cursor integration fails',
            'Error message shown'
        ],
        expectedResult: 'User should see Cursor integration error'
    }
};

export const testEditorStates = {
    // Various editor states for testing
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