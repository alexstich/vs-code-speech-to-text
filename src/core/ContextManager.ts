import * as vscode from 'vscode';

/**
 * Типы IDE, поддерживаемые VoiceScribe
 */
export enum IDEType {
    VSCODE = 'vscode',
    CURSOR = 'cursor',
    UNKNOWN = 'unknown'
}

/**
 * Типы активного контекста в IDE
 */
export enum ContextType {
    EDITOR = 'editor',           // Редактор кода
    TERMINAL = 'terminal',       // Терминал
    CHAT = 'chat',              // AI чат (Cursor)
    OUTPUT = 'output',          // Панель вывода
    DEBUGGER = 'debugger',      // Отладчик
    SEARCH = 'search',          // Поиск
    EXPLORER = 'explorer',      // Проводник файлов
    UNKNOWN = 'unknown'         // Неизвестный контекст
}

/**
 * Информация о языке программирования
 */
export interface LanguageInfo {
    id: string;
    name: string;
    commentStyle: 'line' | 'block' | 'both';
    lineComment?: string;
    blockComment?: { start: string; end: string };
}

/**
 * Информация о контексте IDE
 */
export interface IDEContext {
    ideType: IDEType;
    contextType: ContextType;
    activeEditor?: {
        fileName: string;
        language: LanguageInfo;
        selection: vscode.Selection | null;
        lineNumber: number;
        columnNumber: number;
    };
    terminal?: {
        isActive: boolean;
        name: string;
    };
    debugger?: {
        isActive: boolean;
        sessionName?: string;
    };
    workspace?: {
        name: string;
        folders: string[];
    };
}

/**
 * События ContextManager
 */
export interface ContextManagerEvents {
    onContextChange?: (context: IDEContext) => void;
    onIDETypeDetected?: (ideType: IDEType) => void;
    onLanguageChange?: (language: LanguageInfo) => void;
}

/**
 * Менеджер контекста IDE для адаптации поведения VoiceScribe
 */
export class ContextManager {
    private ideType: IDEType = IDEType.UNKNOWN;
    private currentContext: IDEContext;
    private events: ContextManagerEvents;
    private disposables: vscode.Disposable[] = [];
    
    // Кэш языковых настроек
    private languageCache = new Map<string, LanguageInfo>();

    constructor(events: ContextManagerEvents = {}) {
        this.events = events;
        
        // Инициализируем базовый контекст
        this.currentContext = {
            ideType: IDEType.UNKNOWN,
            contextType: ContextType.UNKNOWN
        };

        // Определяем тип IDE при инициализации
        this.detectIDEType();
        
        // Получаем текущий контекст
        this.updateContext();
        
        // Подписываемся на события изменения контекста
        this.setupEventListeners();
        
        console.log(`🔍 ContextManager initialized for ${this.ideType}`);
    }

    /**
     * Определение типа IDE
     */
    private detectIDEType(): void {
        try {
            const appName = vscode.env.appName.toLowerCase();
            const uriScheme = vscode.env.uriScheme;
            
            console.log(`🔍 Detecting IDE: appName="${appName}", uriScheme="${uriScheme}"`);
            
            // Определяем тип IDE по названию приложения
            if (appName.includes('cursor')) {
                this.ideType = IDEType.CURSOR;
            } else if (appName.includes('visual studio code') || appName.includes('vscode')) {
                this.ideType = IDEType.VSCODE;
            } else {
                // Дополнительная проверка по схеме URI
                if (uriScheme === 'cursor') {
                    this.ideType = IDEType.CURSOR;
                } else if (uriScheme === 'vscode' || uriScheme === 'vscode-insiders') {
                    this.ideType = IDEType.VSCODE;
                } else {
                    this.ideType = IDEType.UNKNOWN;
                    console.warn(`⚠️ Unknown IDE detected: ${appName}`);
                }
            }
            
            console.log(`✅ IDE Type detected: ${this.ideType}`);
            
            // Уведомляем об определении типа IDE
            if (this.events.onIDETypeDetected) {
                this.events.onIDETypeDetected(this.ideType);
            }
            
        } catch (error) {
            console.error('❌ Failed to detect IDE type:', error);
            this.ideType = IDEType.UNKNOWN;
        }
    }

    /**
     * Настройка слушателей событий
     */
    private setupEventListeners(): void {
        // Слушаем изменения активного редактора
        this.disposables.push(
            vscode.window.onDidChangeActiveTextEditor((editor) => {
                console.log('🔄 Active editor changed');
                this.updateContext();
            })
        );

        // Слушаем изменения выделения в редакторе
        this.disposables.push(
            vscode.window.onDidChangeTextEditorSelection((event) => {
                this.updateContext();
            })
        );

        // Слушаем изменения активного терминала
        this.disposables.push(
            vscode.window.onDidChangeActiveTerminal((terminal) => {
                console.log('🔄 Active terminal changed');
                this.updateContext();
            })
        );

        // Слушаем изменения состояния отладчика
        this.disposables.push(
            vscode.debug.onDidStartDebugSession((session) => {
                console.log('🔄 Debug session started');
                this.updateContext();
            })
        );

        this.disposables.push(
            vscode.debug.onDidTerminateDebugSession((session) => {
                console.log('🔄 Debug session terminated');
                this.updateContext();
            })
        );

        // Слушаем изменения воркспейса
        this.disposables.push(
            vscode.workspace.onDidChangeWorkspaceFolders(() => {
                console.log('🔄 Workspace folders changed');
                this.updateContext();
            })
        );
    }

    /**
     * Обновление текущего контекста
     */
    private updateContext(): void {
        const previousContext = { ...this.currentContext };
        
        try {
            // Определяем тип контекста
            const contextType = this.detectContextType();
            
            // Собираем информацию об активном редакторе
            const activeEditor = this.getActiveEditorInfo();
            
            // Информация о терминале
            const terminal = this.getTerminalInfo();
            
            // Информация об отладчике
            const debuggerInfo = this.getDebuggerInfo();
            
            // Информация о воркспейсе
            const workspace = this.getWorkspaceInfo();
            
            // Обновляем контекст
            this.currentContext = {
                ideType: this.ideType,
                contextType,
                activeEditor,
                terminal,
                debugger: debuggerInfo,
                workspace
            };
            
            // Проверяем изменения и уведомляем
            if (this.hasContextChanged(previousContext, this.currentContext)) {
                console.log(`🔄 Context changed to: ${contextType}`);
                
                if (this.events.onContextChange) {
                    this.events.onContextChange(this.currentContext);
                }
                
                // Если изменился язык программирования
                if (activeEditor && 
                    (!previousContext.activeEditor || 
                     previousContext.activeEditor.language.id !== activeEditor.language.id)) {
                    
                    if (this.events.onLanguageChange) {
                        this.events.onLanguageChange(activeEditor.language);
                    }
                }
            }
            
        } catch (error) {
            console.error('❌ Failed to update context:', error);
        }
    }

    /**
     * Определение типа контекста
     */
    private detectContextType(): ContextType {
        // Проверяем активность отладчика
        if (vscode.debug.activeDebugSession) {
            return ContextType.DEBUGGER;
        }
        
        // Проверяем активный терминал
        if (vscode.window.activeTerminal) {
            return ContextType.TERMINAL;
        }
        
        // Проверяем активный редактор
        if (vscode.window.activeTextEditor) {
            return ContextType.EDITOR;
        }
        
        // Для Cursor - попытка определить AI чат
        if (this.ideType === IDEType.CURSOR) {
            // В Cursor пока нет прямого API для определения чата
            // Используем эвристику: если нет активного редактора или терминала,
            // но есть фокус в IDE - возможно это чат
            if (vscode.window.state.focused) {
                return ContextType.CHAT;
            }
        }
        
        return ContextType.UNKNOWN;
    }

    /**
     * Получение информации об активном редакторе
     */
    private getActiveEditorInfo() {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return undefined;
        }
        
        const language = this.getLanguageInfo(editor.document.languageId);
        
        return {
            fileName: editor.document.fileName,
            language,
            selection: editor.selection,
            lineNumber: editor.selection.active.line + 1,
            columnNumber: editor.selection.active.character + 1
        };
    }

    /**
     * Получение информации о языке программирования
     */
    private getLanguageInfo(languageId: string): LanguageInfo {
        // Проверяем кэш
        if (this.languageCache.has(languageId)) {
            return this.languageCache.get(languageId)!;
        }
        
        // Определяем информацию о языке
        const languageInfo = this.createLanguageInfo(languageId);
        
        // Кэшируем результат
        this.languageCache.set(languageId, languageInfo);
        
        return languageInfo;
    }

    /**
     * Создание информации о языке программирования
     */
    private createLanguageInfo(languageId: string): LanguageInfo {
        const languageMap: Record<string, Partial<LanguageInfo>> = {
            // Web технологии
            'javascript': { name: 'JavaScript', commentStyle: 'both', lineComment: '//', blockComment: { start: '/*', end: '*/' } },
            'typescript': { name: 'TypeScript', commentStyle: 'both', lineComment: '//', blockComment: { start: '/*', end: '*/' } },
            'html': { name: 'HTML', commentStyle: 'block', blockComment: { start: '<!--', end: '-->' } },
            'css': { name: 'CSS', commentStyle: 'both', lineComment: '//', blockComment: { start: '/*', end: '*/' } },
            'scss': { name: 'SCSS', commentStyle: 'both', lineComment: '//', blockComment: { start: '/*', end: '*/' } },
            'less': { name: 'Less', commentStyle: 'both', lineComment: '//', blockComment: { start: '/*', end: '*/' } },
            
            // Системные языки
            'c': { name: 'C', commentStyle: 'both', lineComment: '//', blockComment: { start: '/*', end: '*/' } },
            'cpp': { name: 'C++', commentStyle: 'both', lineComment: '//', blockComment: { start: '/*', end: '*/' } },
            'csharp': { name: 'C#', commentStyle: 'both', lineComment: '//', blockComment: { start: '/*', end: '*/' } },
            'java': { name: 'Java', commentStyle: 'both', lineComment: '//', blockComment: { start: '/*', end: '*/' } },
            'rust': { name: 'Rust', commentStyle: 'both', lineComment: '//', blockComment: { start: '/*', end: '*/' } },
            'go': { name: 'Go', commentStyle: 'both', lineComment: '//', blockComment: { start: '/*', end: '*/' } },
            
            // Скриптовые языки
            'python': { name: 'Python', commentStyle: 'line', lineComment: '#' },
            'ruby': { name: 'Ruby', commentStyle: 'line', lineComment: '#' },
            'php': { name: 'PHP', commentStyle: 'both', lineComment: '//', blockComment: { start: '/*', end: '*/' } },
            'perl': { name: 'Perl', commentStyle: 'line', lineComment: '#' },
            'bash': { name: 'Bash', commentStyle: 'line', lineComment: '#' },
            'powershell': { name: 'PowerShell', commentStyle: 'both', lineComment: '#', blockComment: { start: '<#', end: '#>' } },
            
            // Функциональные языки
            'haskell': { name: 'Haskell', commentStyle: 'both', lineComment: '--', blockComment: { start: '{-', end: '-}' } },
            'scala': { name: 'Scala', commentStyle: 'both', lineComment: '//', blockComment: { start: '/*', end: '*/' } },
            'clojure': { name: 'Clojure', commentStyle: 'line', lineComment: ';' },
            
            // Конфигурационные файлы
            'json': { name: 'JSON', commentStyle: 'line', lineComment: '//' },
            'yaml': { name: 'YAML', commentStyle: 'line', lineComment: '#' },
            'toml': { name: 'TOML', commentStyle: 'line', lineComment: '#' },
            'xml': { name: 'XML', commentStyle: 'block', blockComment: { start: '<!--', end: '-->' } },
            
            // Разметка и документация
            'markdown': { name: 'Markdown', commentStyle: 'block', blockComment: { start: '<!--', end: '-->' } },
            'latex': { name: 'LaTeX', commentStyle: 'line', lineComment: '%' },
            
            // Базы данных
            'sql': { name: 'SQL', commentStyle: 'both', lineComment: '--', blockComment: { start: '/*', end: '*/' } },
            
            // Остальные
            'plaintext': { name: 'Plain Text', commentStyle: 'line', lineComment: '#' }
        };
        
        const langConfig = languageMap[languageId] || {};
        
        return {
            id: languageId,
            name: langConfig.name || languageId.toUpperCase(),
            commentStyle: langConfig.commentStyle || 'line',
            lineComment: langConfig.lineComment,
            blockComment: langConfig.blockComment,
            ...langConfig
        };
    }

    /**
     * Получение информации о терминале
     */
    private getTerminalInfo() {
        const activeTerminal = vscode.window.activeTerminal;
        if (!activeTerminal) {
            return undefined;
        }
        
        return {
            isActive: true,
            name: activeTerminal.name
        };
    }

    /**
     * Получение информации об отладчике
     */
    private getDebuggerInfo() {
        const activeSession = vscode.debug.activeDebugSession;
        
        return {
            isActive: !!activeSession,
            sessionName: activeSession?.name
        };
    }

    /**
     * Получение информации о воркспейсе
     */
    private getWorkspaceInfo() {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        const workspaceName = vscode.workspace.name;
        
        return {
            name: workspaceName || 'Untitled',
            folders: workspaceFolders?.map(folder => folder.uri.fsPath) || []
        };
    }

    /**
     * Проверка изменения контекста
     */
    private hasContextChanged(previous: IDEContext, current: IDEContext): boolean {
        return (
            previous.contextType !== current.contextType ||
            previous.activeEditor?.fileName !== current.activeEditor?.fileName ||
            previous.activeEditor?.language.id !== current.activeEditor?.language.id ||
            previous.terminal?.isActive !== current.terminal?.isActive ||
            previous.debugger?.isActive !== current.debugger?.isActive
        );
    }

    /**
     * Публичные методы для получения информации о контексте
     */

    /**
     * Получение текущего контекста
     */
    getContext(): IDEContext {
        return { ...this.currentContext };
    }

    /**
     * Получение типа IDE
     */
    getIDEType(): IDEType {
        return this.ideType;
    }

    /**
     * Получение типа текущего контекста
     */
    getContextType(): ContextType {
        return this.currentContext.contextType;
    }

    /**
     * Проверка, является ли IDE типом Cursor
     */
    isCursor(): boolean {
        return this.ideType === IDEType.CURSOR;
    }

    /**
     * Проверка, является ли IDE типом VS Code
     */
    isVSCode(): boolean {
        return this.ideType === IDEType.VSCODE;
    }

    /**
     * Проверка активности редактора
     */
    isEditorActive(): boolean {
        return this.currentContext.contextType === ContextType.EDITOR;
    }

    /**
     * Проверка активности терминала
     */
    isTerminalActive(): boolean {
        return this.currentContext.contextType === ContextType.TERMINAL;
    }

    /**
     * Проверка активности чата (для Cursor)
     */
    isChatActive(): boolean {
        return this.currentContext.contextType === ContextType.CHAT;
    }

    /**
     * Получение информации о языке текущего файла
     */
    getCurrentLanguage(): LanguageInfo | null {
        return this.currentContext.activeEditor?.language || null;
    }

    /**
     * Проверка поддержки определенного типа комментариев
     */
    supportsComments(type: 'line' | 'block'): boolean {
        const language = this.getCurrentLanguage();
        if (!language) {
            return false;
        }
        
        return language.commentStyle === 'both' || language.commentStyle === type;
    }

    /**
     * Получение подходящего стиля комментария для текущего языка
     */
    getPreferredCommentStyle(): 'line' | 'block' | null {
        const language = this.getCurrentLanguage();
        if (!language) {
            return null;
        }
        
        if (language.commentStyle === 'both') {
            return 'line'; // Предпочитаем line комментарии
        }
        
        return language.commentStyle === 'line' || language.commentStyle === 'block' 
            ? language.commentStyle 
            : null;
    }

    /**
     * Форсированное обновление контекста
     */
    refreshContext(): void {
        this.updateContext();
    }

    /**
     * Освобождение ресурсов
     */
    dispose(): void {
        console.log('🔌 Disposing ContextManager...');
        
        this.disposables.forEach(disposable => {
            try {
                disposable.dispose();
            } catch (error) {
                console.error('❌ Error disposing context manager resource:', error);
            }
        });
        
        this.disposables = [];
        this.languageCache.clear();
    }
} 