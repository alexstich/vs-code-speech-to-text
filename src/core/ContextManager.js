"use strict";
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
exports.ContextManager = exports.ContextType = exports.IDEType = void 0;
const vscode = __importStar(require("vscode"));
/**
 * Типы IDE, поддерживаемые VoiceScribe
 */
var IDEType;
(function (IDEType) {
    IDEType["VSCODE"] = "vscode";
    IDEType["CURSOR"] = "cursor";
    IDEType["UNKNOWN"] = "unknown";
})(IDEType || (exports.IDEType = IDEType = {}));
/**
 * Типы активного контекста в IDE
 */
var ContextType;
(function (ContextType) {
    ContextType["EDITOR"] = "editor";
    ContextType["TERMINAL"] = "terminal";
    ContextType["CHAT"] = "chat";
    ContextType["OUTPUT"] = "output";
    ContextType["DEBUGGER"] = "debugger";
    ContextType["SEARCH"] = "search";
    ContextType["EXPLORER"] = "explorer";
    ContextType["UNKNOWN"] = "unknown"; // Неизвестный контекст
})(ContextType || (exports.ContextType = ContextType = {}));
/**
 * Менеджер контекста IDE для адаптации поведения VoiceScribe
 */
class ContextManager {
    ideType = IDEType.UNKNOWN;
    currentContext;
    events;
    disposables = [];
    // Кэш языковых настроек
    languageCache = new Map();
    constructor(events = {}) {
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
    detectIDEType() {
        try {
            const appName = vscode.env.appName.toLowerCase();
            const uriScheme = vscode.env.uriScheme;
            console.log(`🔍 Detecting IDE: appName="${appName}", uriScheme="${uriScheme}"`);
            // Определяем тип IDE по названию приложения
            if (appName.includes('cursor')) {
                this.ideType = IDEType.CURSOR;
            }
            else if (appName.includes('visual studio code') || appName.includes('vscode')) {
                this.ideType = IDEType.VSCODE;
            }
            else {
                // Дополнительная проверка по схеме URI
                if (uriScheme === 'cursor') {
                    this.ideType = IDEType.CURSOR;
                }
                else if (uriScheme === 'vscode' || uriScheme === 'vscode-insiders') {
                    this.ideType = IDEType.VSCODE;
                }
                else {
                    this.ideType = IDEType.UNKNOWN;
                    console.warn(`⚠️ Unknown IDE detected: ${appName}`);
                }
            }
            console.log(`✅ IDE Type detected: ${this.ideType}`);
            // Уведомляем об определении типа IDE
            if (this.events.onIDETypeDetected) {
                this.events.onIDETypeDetected(this.ideType);
            }
        }
        catch (error) {
            console.error('❌ Failed to detect IDE type:', error);
            this.ideType = IDEType.UNKNOWN;
        }
    }
    /**
     * Настройка слушателей событий
     */
    setupEventListeners() {
        // Слушаем изменения активного редактора
        this.disposables.push(vscode.window.onDidChangeActiveTextEditor((editor) => {
            console.log('🔄 Active editor changed');
            this.updateContext();
        }));
        // Слушаем изменения выделения в редакторе
        this.disposables.push(vscode.window.onDidChangeTextEditorSelection((event) => {
            this.updateContext();
        }));
        // Слушаем изменения активного терминала
        this.disposables.push(vscode.window.onDidChangeActiveTerminal((terminal) => {
            console.log('🔄 Active terminal changed');
            this.updateContext();
        }));
        // Слушаем изменения состояния отладчика
        this.disposables.push(vscode.debug.onDidStartDebugSession((session) => {
            console.log('🔄 Debug session started');
            this.updateContext();
        }));
        this.disposables.push(vscode.debug.onDidTerminateDebugSession((session) => {
            console.log('🔄 Debug session terminated');
            this.updateContext();
        }));
        // Слушаем изменения воркспейса
        this.disposables.push(vscode.workspace.onDidChangeWorkspaceFolders(() => {
            console.log('🔄 Workspace folders changed');
            this.updateContext();
        }));
    }
    /**
     * Обновление текущего контекста
     */
    updateContext() {
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
        }
        catch (error) {
            console.error('❌ Failed to update context:', error);
        }
    }
    /**
     * Определение типа контекста
     */
    detectContextType() {
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
    getActiveEditorInfo() {
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
    getLanguageInfo(languageId) {
        // Проверяем кэш
        if (this.languageCache.has(languageId)) {
            return this.languageCache.get(languageId);
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
    createLanguageInfo(languageId) {
        const languageMap = {
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
    getTerminalInfo() {
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
    getDebuggerInfo() {
        const activeSession = vscode.debug.activeDebugSession;
        return {
            isActive: !!activeSession,
            sessionName: activeSession?.name
        };
    }
    /**
     * Получение информации о воркспейсе
     */
    getWorkspaceInfo() {
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
    hasContextChanged(previous, current) {
        return (previous.contextType !== current.contextType ||
            previous.activeEditor?.fileName !== current.activeEditor?.fileName ||
            previous.activeEditor?.language.id !== current.activeEditor?.language.id ||
            previous.terminal?.isActive !== current.terminal?.isActive ||
            previous.debugger?.isActive !== current.debugger?.isActive);
    }
    /**
     * Публичные методы для получения информации о контексте
     */
    /**
     * Получение текущего контекста
     */
    getContext() {
        return { ...this.currentContext };
    }
    /**
     * Получение типа IDE
     */
    getIDEType() {
        return this.ideType;
    }
    /**
     * Получение типа текущего контекста
     */
    getContextType() {
        return this.currentContext.contextType;
    }
    /**
     * Проверка, является ли IDE типом Cursor
     */
    isCursor() {
        return this.ideType === IDEType.CURSOR;
    }
    /**
     * Проверка, является ли IDE типом VS Code
     */
    isVSCode() {
        return this.ideType === IDEType.VSCODE;
    }
    /**
     * Проверка активности редактора
     */
    isEditorActive() {
        return this.currentContext.contextType === ContextType.EDITOR;
    }
    /**
     * Проверка активности терминала
     */
    isTerminalActive() {
        return this.currentContext.contextType === ContextType.TERMINAL;
    }
    /**
     * Проверка активности чата (для Cursor)
     */
    isChatActive() {
        return this.currentContext.contextType === ContextType.CHAT;
    }
    /**
     * Получение информации о языке текущего файла
     */
    getCurrentLanguage() {
        return this.currentContext.activeEditor?.language || null;
    }
    /**
     * Проверка поддержки определенного типа комментариев
     */
    supportsComments(type) {
        const language = this.getCurrentLanguage();
        if (!language) {
            return false;
        }
        return language.commentStyle === 'both' || language.commentStyle === type;
    }
    /**
     * Получение подходящего стиля комментария для текущего языка
     */
    getPreferredCommentStyle() {
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
    refreshContext() {
        this.updateContext();
    }
    /**
     * Освобождение ресурсов
     */
    dispose() {
        console.log('🔌 Disposing ContextManager...');
        this.disposables.forEach(disposable => {
            try {
                disposable.dispose();
            }
            catch (error) {
                console.error('❌ Error disposing context manager resource:', error);
            }
        });
        this.disposables = [];
        this.languageCache.clear();
    }
}
exports.ContextManager = ContextManager;
//# sourceMappingURL=ContextManager.js.map