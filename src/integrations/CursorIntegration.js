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
exports.CursorIntegration = exports.CursorIntegrationStrategy = void 0;
const vscode = __importStar(require("vscode"));
/**
 * Стратегии интеграции с Cursor чатом
 */
var CursorIntegrationStrategy;
(function (CursorIntegrationStrategy) {
    CursorIntegrationStrategy["CLIPBOARD"] = "clipboard";
    CursorIntegrationStrategy["COMMAND_PALETTE"] = "command_palette";
    CursorIntegrationStrategy["FOCUS_CHAT"] = "focus_chat";
    CursorIntegrationStrategy["SEND_TO_CHAT"] = "send_to_chat"; // Прямая отправка в чат
})(CursorIntegrationStrategy || (exports.CursorIntegrationStrategy = CursorIntegrationStrategy = {}));
/**
 * Интеграция с AI-чатом Cursor IDE
 * Реализует различные стратегии отправки транскрибированного текста в чат
 */
class CursorIntegration {
    options;
    events;
    isEnabled = false;
    constructor(options = {}, events = {}) {
        this.options = this.mergeDefaultOptions(options);
        this.events = events;
        // Проверяем доступность интеграции
        this.checkAvailability();
        console.log(`🎯 CursorIntegration initialized, enabled: ${this.isEnabled}`);
    }
    /**
     * Объединение настроек по умолчанию с пользовательскими
     */
    mergeDefaultOptions(options) {
        return {
            primaryStrategy: CursorIntegrationStrategy.CLIPBOARD,
            fallbackStrategies: [
                CursorIntegrationStrategy.COMMAND_PALETTE,
                CursorIntegrationStrategy.FOCUS_CHAT
            ],
            autoFocusChat: true,
            prefixText: '',
            suffixText: '',
            useMarkdownFormat: false,
            timeout: 5000,
            ...options
        };
    }
    /**
     * Проверка доступности интеграции с Cursor
     */
    checkAvailability() {
        try {
            // Проверяем, что мы действительно в Cursor IDE
            const appName = vscode.env.appName.toLowerCase();
            const uriScheme = vscode.env.uriScheme;
            this.isEnabled = appName.includes('cursor') || uriScheme === 'cursor';
            if (this.isEnabled) {
                console.log('✅ Cursor IDE detected - integration enabled');
            }
            else {
                console.log('ℹ️ Not in Cursor IDE - integration disabled');
            }
        }
        catch (error) {
            console.error('❌ Failed to check Cursor availability:', error);
            this.isEnabled = false;
        }
    }
    /**
     * Получение состояния интеграции
     */
    isIntegrationEnabled() {
        return this.isEnabled;
    }
    /**
     * Отправка текста в Cursor AI чат
     */
    async sendToChat(text) {
        if (!this.isEnabled) {
            return {
                success: false,
                strategy: this.options.primaryStrategy,
                error: 'Cursor integration not available in this IDE'
            };
        }
        if (!text || text.trim().length === 0) {
            return {
                success: false,
                strategy: this.options.primaryStrategy,
                error: 'No text provided'
            };
        }
        console.log(`🎯 Sending text to Cursor chat: "${text.substring(0, 50)}..."`);
        // Форматируем текст
        const formattedText = this.formatTextForChat(text);
        // Пробуем основную стратегию
        try {
            const result = await this.executeStrategy(this.options.primaryStrategy, formattedText);
            if (result.success) {
                console.log(`✅ Successfully sent via ${result.strategy}`);
                // Уведомляем о успешной отправке
                if (this.events.onChatSent) {
                    this.events.onChatSent(text, result.strategy);
                }
                return result;
            }
        }
        catch (error) {
            console.error(`❌ Primary strategy ${this.options.primaryStrategy} failed:`, error);
            // Уведомляем об ошибке
            if (this.events.onError) {
                this.events.onError(error, this.options.primaryStrategy);
            }
        }
        // Пробуем fallback стратегии
        for (const fallbackStrategy of this.options.fallbackStrategies) {
            try {
                console.log(`🔄 Trying fallback strategy: ${fallbackStrategy}`);
                const result = await this.executeStrategy(fallbackStrategy, formattedText);
                if (result.success) {
                    console.log(`✅ Fallback successful via ${fallbackStrategy}`);
                    // Уведомляем о использовании fallback
                    if (this.events.onFallbackUsed) {
                        this.events.onFallbackUsed(this.options.primaryStrategy, fallbackStrategy);
                    }
                    // Уведомляем о успешной отправке
                    if (this.events.onChatSent) {
                        this.events.onChatSent(text, fallbackStrategy);
                    }
                    return {
                        ...result,
                        fallbackUsed: true
                    };
                }
            }
            catch (error) {
                console.error(`❌ Fallback strategy ${fallbackStrategy} failed:`, error);
                // Уведомляем об ошибке fallback стратегии
                if (this.events.onError) {
                    this.events.onError(error, fallbackStrategy);
                }
            }
        }
        // Все стратегии провалились
        return {
            success: false,
            strategy: this.options.primaryStrategy,
            error: 'All integration strategies failed'
        };
    }
    /**
     * Выполнение конкретной стратегии интеграции
     */
    async executeStrategy(strategy, text) {
        switch (strategy) {
            case CursorIntegrationStrategy.CLIPBOARD:
                return await this.useClipboardStrategy(text);
            case CursorIntegrationStrategy.COMMAND_PALETTE:
                return await this.useCommandPaletteStrategy(text);
            case CursorIntegrationStrategy.FOCUS_CHAT:
                return await this.useFocusChatStrategy(text);
            case CursorIntegrationStrategy.SEND_TO_CHAT:
                return await this.useSendToChatStrategy(text);
            default:
                throw new Error(`Unknown integration strategy: ${strategy}`);
        }
    }
    /**
     * Стратегия через буфер обмена
     */
    async useClipboardStrategy(text) {
        try {
            // Копируем текст в буфер обмена
            await vscode.env.clipboard.writeText(text);
            // Пытаемся сфокусироваться на чате
            if (this.options.autoFocusChat) {
                await this.focusOnChat();
            }
            // Показываем уведомление пользователю
            vscode.window.showInformationMessage(`📋 Text copied to clipboard. ${this.options.autoFocusChat ? 'Chat focused - paste with Ctrl+V' : 'Paste in Cursor chat with Ctrl+V'}`);
            return {
                success: true,
                strategy: CursorIntegrationStrategy.CLIPBOARD,
                message: 'Text copied to clipboard'
            };
        }
        catch (error) {
            throw new Error(`Clipboard strategy failed: ${error.message}`);
        }
    }
    /**
     * Стратегия через палитру команд
     */
    async useCommandPaletteStrategy(text) {
        try {
            // Сначала копируем в буфер обмена
            await vscode.env.clipboard.writeText(text);
            // Пытаемся открыть палитру команд Cursor для чата
            // Cursor может иметь специальные команды для AI чата
            const cursorChatCommands = [
                'cursor.chat.open',
                'cursor.ai.chat',
                'workbench.action.chat.open',
                'workbench.panel.chat.view.copilot.focus'
            ];
            for (const command of cursorChatCommands) {
                try {
                    await vscode.commands.executeCommand(command);
                    return {
                        success: true,
                        strategy: CursorIntegrationStrategy.COMMAND_PALETTE,
                        message: `Chat opened via ${command}`
                    };
                }
                catch (commandError) {
                    // Команда не существует, пробуем следующую
                    console.log(`Command ${command} not available`);
                }
            }
            // Если специальные команды не работают, пробуем общую палитру команд
            await vscode.commands.executeCommand('workbench.action.showCommands');
            vscode.window.showInformationMessage('🎯 Command palette opened. Search for "chat" to open Cursor AI chat, then paste text.');
            return {
                success: true,
                strategy: CursorIntegrationStrategy.COMMAND_PALETTE,
                message: 'Command palette opened'
            };
        }
        catch (error) {
            throw new Error(`Command palette strategy failed: ${error.message}`);
        }
    }
    /**
     * Стратегия фокусировки на чате
     */
    async useFocusChatStrategy(text) {
        try {
            // Копируем текст в буфер обмена
            await vscode.env.clipboard.writeText(text);
            // Пытаемся сфокусироваться на чате
            const focusResult = await this.focusOnChat();
            if (focusResult) {
                vscode.window.showInformationMessage('💬 Chat focused and text copied. Paste with Ctrl+V to send message.');
                return {
                    success: true,
                    strategy: CursorIntegrationStrategy.FOCUS_CHAT,
                    message: 'Chat focused successfully'
                };
            }
            else {
                throw new Error('Failed to focus on chat');
            }
        }
        catch (error) {
            throw new Error(`Focus chat strategy failed: ${error.message}`);
        }
    }
    /**
     * Стратегия прямой отправки в чат
     */
    async useSendToChatStrategy(text) {
        try {
            // Это наиболее продвинутая стратегия, которая требует прямого API Cursor
            // Пока Cursor не предоставляет публичного API для этого, используем fallback
            // Пытаемся найти и использовать возможные команды Cursor для отправки в чат
            const cursorSendCommands = [
                'cursor.chat.sendMessage',
                'cursor.ai.sendToChat',
                'workbench.action.chat.sendMessage'
            ];
            for (const command of cursorSendCommands) {
                try {
                    await vscode.commands.executeCommand(command, text);
                    return {
                        success: true,
                        strategy: CursorIntegrationStrategy.SEND_TO_CHAT,
                        message: `Text sent directly via ${command}`
                    };
                }
                catch (commandError) {
                    // Команда не существует, пробуем следующую
                    console.log(`Direct send command ${command} not available`);
                }
            }
            // Если прямая отправка недоступна, используем clipboard как fallback
            return await this.useClipboardStrategy(text);
        }
        catch (error) {
            throw new Error(`Send to chat strategy failed: ${error.message}`);
        }
    }
    /**
     * Попытка сфокусироваться на AI чате Cursor
     */
    async focusOnChat() {
        try {
            // Список возможных команд для фокусировки на чате в Cursor
            const focusCommands = [
                'cursor.chat.focus',
                'cursor.ai.focus',
                'workbench.panel.chat.focus',
                'workbench.view.chat',
                'workbench.action.chat.focus'
            ];
            for (const command of focusCommands) {
                try {
                    await vscode.commands.executeCommand(command);
                    console.log(`✅ Successfully focused chat via ${command}`);
                    return true;
                }
                catch (commandError) {
                    // Команда не существует, пробуем следующую
                    console.log(`Focus command ${command} not available`);
                }
            }
            // Если специальные команды не работают, пробуем общие
            try {
                // Пытаемся открыть боковую панель или нижнюю панель
                await vscode.commands.executeCommand('workbench.action.toggleSidebarVisibility');
                await new Promise(resolve => setTimeout(resolve, 100));
                await vscode.commands.executeCommand('workbench.action.togglePanel');
                console.log('ℹ️ Opened panels - user needs to manually focus chat');
                return true;
            }
            catch (error) {
                console.error('❌ Failed to open panels:', error);
                return false;
            }
        }
        catch (error) {
            console.error('❌ Failed to focus on chat:', error);
            return false;
        }
    }
    /**
     * Форматирование текста для отправки в чат
     */
    formatTextForChat(text) {
        let formattedText = text.trim();
        // Добавляем префикс
        if (this.options.prefixText) {
            formattedText = this.options.prefixText + formattedText;
        }
        // Добавляем суффикс
        if (this.options.suffixText) {
            formattedText = formattedText + this.options.suffixText;
        }
        // Форматируем как Markdown если включено
        if (this.options.useMarkdownFormat) {
            // Обрамляем в code block если это похоже на код
            if (this.looksLikeCode(formattedText)) {
                formattedText = '```\n' + formattedText + '\n```';
            }
            else {
                // Или как цитату для обычного текста
                formattedText = '> ' + formattedText.replace(/\n/g, '\n> ');
            }
        }
        return formattedText;
    }
    /**
     * Проверка, похож ли текст на код
     */
    looksLikeCode(text) {
        const codeIndicators = [
            /function\s+\w+\s*\(/,
            /class\s+\w+/,
            /import\s+.+from/,
            /const\s+\w+\s*=/,
            /let\s+\w+\s*=/,
            /var\s+\w+\s*=/,
            /if\s*\(/,
            /for\s*\(/,
            /while\s*\(/,
            /\{[\s\S]*\}/,
            /\[\s*\d+\s*\]/,
            /console\.log\(/,
            /return\s+/
        ];
        return codeIndicators.some(pattern => pattern.test(text));
    }
    /**
     * Обновление настроек интеграции
     */
    updateOptions(newOptions) {
        this.options = { ...this.options, ...newOptions };
        console.log('🔧 CursorIntegration options updated');
    }
    /**
     * Получение текущих настроек
     */
    getOptions() {
        return { ...this.options };
    }
    /**
     * Получение доступных стратегий интеграции
     */
    static getAvailableStrategies() {
        return [
            CursorIntegrationStrategy.CLIPBOARD,
            CursorIntegrationStrategy.COMMAND_PALETTE,
            CursorIntegrationStrategy.FOCUS_CHAT,
            CursorIntegrationStrategy.SEND_TO_CHAT
        ];
    }
    /**
     * Получение описания стратегии
     */
    static getStrategyDescription(strategy) {
        const descriptions = {
            [CursorIntegrationStrategy.CLIPBOARD]: 'Copy text to clipboard and optionally focus chat',
            [CursorIntegrationStrategy.COMMAND_PALETTE]: 'Open command palette to access chat commands',
            [CursorIntegrationStrategy.FOCUS_CHAT]: 'Automatically focus on AI chat panel',
            [CursorIntegrationStrategy.SEND_TO_CHAT]: 'Directly send text to chat (if API available)'
        };
        return descriptions[strategy] || 'Unknown strategy';
    }
    /**
     * Освобождение ресурсов
     */
    dispose() {
        console.log('🔌 Disposing CursorIntegration resources...');
        // Здесь можно добавить очистку подписок, таймеров и других ресурсов
        // В данной реализации специальных ресурсов для очистки нет
        console.log('✅ CursorIntegration disposed successfully');
    }
}
exports.CursorIntegration = CursorIntegration;
//# sourceMappingURL=CursorIntegration.js.map