// Mock implementation for vscode module

// Declare jest for TypeScript
declare const jest: {
    fn: () => any;
};

export namespace vscode {
    export interface ConfigurationTarget {
        Global: number;
        Workspace: number;
        WorkspaceFolder: number;
    }

    export interface WorkspaceConfiguration {
        get<T>(section: string): T | undefined;
        get<T>(section: string, defaultValue: T): T;
        has(section: string): boolean;
        inspect<T>(section: string): {
            key: string;
            defaultValue?: T;
            globalValue?: T;
            workspaceValue?: T;
            workspaceFolderValue?: T;
        } | undefined;
        update(section: string, value: any, configurationTarget?: ConfigurationTarget | boolean): Thenable<void>;
    }

    export interface Disposable {
        dispose(): any;
    }

    export interface Event<T> {
        (listener: (e: T) => any, thisArgs?: any, disposables?: Disposable[]): Disposable;
    }

    export interface ConfigurationChangeEvent {
        affectsConfiguration(section: string, scope?: any): boolean;
    }

    export interface StatusBarItem {
        alignment: StatusBarAlignment;
        priority?: number;
        text: string;
        tooltip?: string;
        color?: string;
        command?: string;
        show(): void;
        hide(): void;
        dispose(): void;
    }

    export enum StatusBarAlignment {
        Left = 1,
        Right = 2
    }

    export interface WorkspaceFolder {
        uri: any;
        name: string;
        index: number;
    }

    export interface Extension<T> {
        id: string;
        extensionUri: any;
        extensionPath: string;
        isActive: boolean;
        packageJSON: any;
        exports: T;
        activate(): Thenable<T>;
    }

    export interface Extensions {
        getExtension<T>(extensionId: string): Extension<T> | undefined;
        getExtension<T>(extensionId: string): Extension<T> | undefined;
        all: Extension<any>[];
        onDidChange: Event<void>;
    }

    export interface Workspace {
        getConfiguration(section?: string, scope?: any): WorkspaceConfiguration;
        onDidChangeConfiguration: Event<ConfigurationChangeEvent>;
        workspaceFolders?: WorkspaceFolder[];
        name?: string;
        rootPath?: string;
    }

    export interface Window {
        createStatusBarItem(alignment?: StatusBarAlignment, priority?: number): StatusBarItem;
        createStatusBarItem(id: string, alignment?: StatusBarAlignment, priority?: number): StatusBarItem;
        showInformationMessage<T extends string>(message: string, ...items: T[]): Thenable<T | undefined>;
        showErrorMessage<T extends string>(message: string, ...items: T[]): Thenable<T | undefined>;
        showWarningMessage<T extends string>(message: string, ...items: T[]): Thenable<T | undefined>;
    }

    export interface Commands {
        executeCommand<T = unknown>(command: string, ...rest: any[]): Thenable<T>;
        registerCommand(command: string, callback: (...args: any[]) => any, thisArg?: any): Disposable;
        registerTextEditorCommand(command: string, callback: (textEditor: any, edit: any, ...args: any[]) => void, thisArg?: any): Disposable;
    }
}

// Create simple mock functions
function createMockFunction() {
    const fn = (...args: any[]) => undefined;
    fn.mockReturnValue = (value: any) => fn;
    fn.mockResolvedValue = (value: any) => fn;
    fn.mockImplementation = (impl: any) => fn;
    fn.mockReset = () => fn;
    fn.mockClear = () => fn;
    return fn;
}

// Create mock objects with mock functions
const mockConfig = {
    get: createMockFunction(),
    has: createMockFunction(),
    inspect: createMockFunction(),
    update: createMockFunction(),
};

const mockStatusBarItem = {
    text: '',
    tooltip: '',
    color: '',
    command: '',
    show: createMockFunction(),
    hide: createMockFunction(),
    dispose: createMockFunction(),
    alignment: vscode.StatusBarAlignment.Left,
};

const mockWorkspace = {
    getConfiguration: createMockFunction(),
    onDidChangeConfiguration: createMockFunction(),
    workspaceFolders: [],
    name: undefined,
    rootPath: undefined,
};

const mockWindow = {
    createStatusBarItem: createMockFunction(),
    showInformationMessage: createMockFunction(),
    showErrorMessage: createMockFunction(),
    showWarningMessage: createMockFunction(),
};

const mockCommands = {
    executeCommand: createMockFunction(),
    registerCommand: createMockFunction(),
    registerTextEditorCommand: createMockFunction(),
};

const mockExtension = {
    id: 'test-extension',
    extensionUri: {},
    extensionPath: '/test/path',
    isActive: true,
    packageJSON: {},
    exports: {},
    activate: createMockFunction(),
};

const mockExtensions = {
    getExtension: createMockFunction(),
    all: [mockExtension],
    onDidChange: createMockFunction(),
};

// Set up default return values
mockWorkspace.getConfiguration.mockReturnValue(mockConfig);
mockWindow.createStatusBarItem.mockReturnValue(mockStatusBarItem);
mockWindow.showInformationMessage.mockResolvedValue(undefined);
mockWindow.showErrorMessage.mockResolvedValue(undefined);
mockWindow.showWarningMessage.mockResolvedValue(undefined);
mockCommands.executeCommand.mockResolvedValue(undefined);
mockCommands.registerCommand.mockReturnValue({ dispose: createMockFunction() });
mockCommands.registerTextEditorCommand.mockReturnValue({ dispose: createMockFunction() });
mockExtensions.getExtension.mockReturnValue(mockExtension);

// Export the mocked vscode API
export const workspace = mockWorkspace;
export const window = mockWindow;
export const commands = mockCommands;
export const extensions = mockExtensions;

export const ConfigurationTarget = {
    Global: 1,
    Workspace: 2,
    WorkspaceFolder: 3,
};

export const StatusBarAlignment = vscode.StatusBarAlignment;

// Export internal mocks for test access
export const __mocks__ = {
    mockConfig,
    mockStatusBarItem,
    mockWorkspace,
    mockWindow,
    mockCommands,
    mockExtension,
    mockExtensions,
};

// Default export for compatibility
export default {
    workspace: mockWorkspace,
    window: mockWindow,
    commands: mockCommands,
    extensions: mockExtensions,
    ConfigurationTarget,
    StatusBarAlignment,
    __mocks__,
}; 