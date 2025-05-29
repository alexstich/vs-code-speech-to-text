// vscodeMocks.ts - моки для VS Code API для тестирования

import * as sinon from 'sinon';

export class MockTextEditor {
    public document: MockTextDocument;
    public selection: MockSelection;
    public edit: sinon.SinonStub;

    constructor(languageId: string = 'javascript') {
        this.document = new MockTextDocument(languageId);
        this.selection = new MockSelection();
        this.edit = sinon.stub().resolves(true);
    }
}

export class MockTextDocument {
    public languageId: string;
    public fileName: string = 'test.js';
    public uri: any = { fsPath: '/test/test.js' };

    constructor(languageId: string = 'javascript') {
        this.languageId = languageId;
    }

    getText(range?: any): string {
        // Мок для получения текста документа
        if (range) {
            return 'selected text';
        }
        return 'document content';
    }

    lineAt(line: number): any {
        return {
            text: '    some indented text',
            firstNonWhitespaceCharacterIndex: 4
        };
    }
}

export class MockSelection {
    public active: MockPosition;
    public anchor: MockPosition;
    public isEmpty: boolean = false;

    constructor() {
        this.active = new MockPosition(0, 0);
        this.anchor = new MockPosition(0, 0);
    }
}

export class MockPosition {
    public line: number;
    public character: number;

    constructor(line: number, character: number) {
        this.line = line;
        this.character = character;
    }

    translate(deltaLine: number, deltaCharacter: number): MockPosition {
        return new MockPosition(this.line + deltaLine, this.character + deltaCharacter);
    }
}

export class MockStatusBarItem {
    public text: string = '';
    public tooltip: string = '';
    public command: string = '';
    public backgroundColor: any = undefined;
    public show: sinon.SinonStub = sinon.stub();
    public hide: sinon.SinonStub = sinon.stub();
    public dispose: sinon.SinonStub = sinon.stub();
}

export class MockWorkspaceConfiguration {
    private config: Map<string, any> = new Map();

    get<T>(key: string, defaultValue?: T): T {
        return this.config.get(key) || defaultValue;
    }

    set(key: string, value: any): void {
        this.config.set(key, value);
    }

    has(key: string): boolean {
        return this.config.has(key);
    }
}

export class MockExtensionContext {
    public subscriptions: any[] = [];
    public workspaceState: any = {
        get: sinon.stub(),
        update: sinon.stub()
    };
    public globalState: any = {
        get: sinon.stub(),
        update: sinon.stub()
    };
}

export class MockThemeColor {
    public id: string;

    constructor(id: string) {
        this.id = id;
    }
}

// Основной объект для мокирования VS Code API
export const mockVscode = {
    StatusBarAlignment: {
        Left: 1,
        Right: 2
    },
    
    ThemeColor: MockThemeColor,
    
    Selection: class {
        constructor(public anchor: any, public active: any) {}
    },

    Position: MockPosition,

    window: {
        activeTextEditor: null as MockTextEditor | null,
        activeTerminal: null as any,
        showInformationMessage: sinon.stub(),
        showWarningMessage: sinon.stub(),
        showErrorMessage: sinon.stub(),
        createStatusBarItem: sinon.stub().returns(new MockStatusBarItem())
    },

    workspace: {
        getConfiguration: sinon.stub().returns(new MockWorkspaceConfiguration())
    },

    commands: {
        registerCommand: sinon.stub().returns({ dispose: sinon.stub() }),
        executeCommand: sinon.stub()
    },

    env: {
        clipboard: {
            writeText: sinon.stub()
        }
    }
};

export function setupVSCodeMocks(): void {
    // Мокируем активный редактор
    mockVscode.window.activeTextEditor = new MockTextEditor();
    
    // Сброс всех стабов
    resetVSCodeMocks();
}

export function resetVSCodeMocks(): void {
    // Сброс стабов в window
    (mockVscode.window.showInformationMessage as sinon.SinonStub).resetHistory();
    (mockVscode.window.showWarningMessage as sinon.SinonStub).resetHistory();
    (mockVscode.window.showErrorMessage as sinon.SinonStub).resetHistory();
    (mockVscode.window.createStatusBarItem as sinon.SinonStub).resetHistory();

    // Сброс стабов в workspace
    (mockVscode.workspace.getConfiguration as sinon.SinonStub).resetHistory();

    // Сброс стабов в commands
    (mockVscode.commands.registerCommand as sinon.SinonStub).resetHistory();
    (mockVscode.commands.executeCommand as sinon.SinonStub).resetHistory();

    // Сброс стабов в clipboard
    (mockVscode.env.clipboard.writeText as sinon.SinonStub).resetHistory();
}

export function setActiveEditor(languageId: string = 'javascript'): MockTextEditor {
    const editor = new MockTextEditor(languageId);
    mockVscode.window.activeTextEditor = editor;
    return editor;
}

export function clearActiveEditor(): void {
    mockVscode.window.activeTextEditor = null;
}

export function setConfiguration(config: Record<string, any>): void {
    const mockConfig = new MockWorkspaceConfiguration();
    Object.entries(config).forEach(([key, value]) => {
        mockConfig.set(key, value);
    });
    mockVscode.workspace.getConfiguration = sinon.stub().returns(mockConfig);
} 