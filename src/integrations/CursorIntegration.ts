import * as vscode from 'vscode';

/**
 * Стратегии интеграции с Cursor чатом
 */
export enum CursorIntegrationStrategy {
    AICHAT_COMMAND = 'aichat_command',    // Через команду aichat.newfollowupaction (РЕКОМЕНДУЕТСЯ)
    CLIPBOARD = 'clipboard',           // Через буфер обмена
    COMMAND_PALETTE = 'command_palette', // Через палитру команд
    FOCUS_CHAT = 'focus_chat',         // Автоматический фокус на чат
    SEND_TO_CHAT = 'send_to_chat'      // Прямая отправка в чат
}

/**
 * Результат операции интеграции с Cursor
 */
export interface CursorIntegrationResult {
    success: boolean;
    strategy: CursorIntegrationStrategy;
    message?: string;
    error?: string;
    fallbackUsed?: boolean;
}

/**
 * Настройки для CursorIntegration
 */
export interface CursorIntegrationOptions {
    primaryStrategy: CursorIntegrationStrategy;
    fallbackStrategies: CursorIntegrationStrategy[];
    autoFocusChat: boolean;
    prefixText?: string;
    suffixText?: string;
    useMarkdownFormat: boolean;
    timeout: number;
}

/**
 * События CursorIntegration
 */
export interface CursorIntegrationEvents {
    onChatSent?: (text: string, strategy: CursorIntegrationStrategy) => void;
    onFallbackUsed?: (primaryStrategy: CursorIntegrationStrategy, fallbackStrategy: CursorIntegrationStrategy) => void;
    onError?: (error: Error, strategy: CursorIntegrationStrategy) => void;
}

/**
 * Интерфейс для vscode environment (для тестирования)
 */
export interface VSCodeEnvironment {
    env: {
        appName: string;
        uriScheme: string;
        clipboard: {
            writeText(text: string): Thenable<void>;
            readText(): Thenable<string>;
        };
    };
    window: {
        showInformationMessage(message: string): Thenable<any>;
        showWarningMessage(message: string): Thenable<any>;
        showErrorMessage(message: string): Thenable<any>;
    };
    commands: {
        executeCommand(command: string, ...args: any[]): Thenable<any>;
    };
}

/**
 * Интеграция с AI-чатом Cursor IDE
 * Реализует различные стратегии отправки транскрибированного текста в чат
 */
export class CursorIntegration {
    private options: CursorIntegrationOptions;
    private events: CursorIntegrationEvents;
    private isEnabled: boolean = false;
    private vscodeEnv: VSCodeEnvironment;

    constructor(
        options: Partial<CursorIntegrationOptions> = {}, 
        events: CursorIntegrationEvents = {},
        vscodeEnvironment?: VSCodeEnvironment
    ) {
        this.options = this.mergeDefaultOptions(options);
        this.events = events;
        
        // Безопасная инициализация vscode environment
        if (vscodeEnvironment) {
            this.vscodeEnv = vscodeEnvironment;
        } else {
            // Используем реальный vscode API если он доступен
            this.vscodeEnv = {
                env: vscode.env,
                window: vscode.window,
                commands: vscode.commands
            };
        }
        
        // Проверяем доступность интеграции
        this.checkAvailability();
        
        console.log(`🎯 CursorIntegration initialized, enabled: ${this.isEnabled}`);
    }

    /**
     * Объединение настроек по умолчанию с пользовательскими
     */
    private mergeDefaultOptions(options: Partial<CursorIntegrationOptions>): CursorIntegrationOptions {
        return {
            primaryStrategy: CursorIntegrationStrategy.AICHAT_COMMAND,
            fallbackStrategies: [
                CursorIntegrationStrategy.CLIPBOARD,
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
    private checkAvailability(): void {
        try {
            // Проверяем, что vscodeEnv и его свойства доступны
            if (!this.vscodeEnv || !this.vscodeEnv.env) {
                console.warn('⚠️ VS Code environment not available');
                this.isEnabled = false;
                return;
            }
            
            // Проверяем, что мы действительно в Cursor IDE
            const appName = this.vscodeEnv.env.appName?.toLowerCase() || '';
            const uriScheme = this.vscodeEnv.env.uriScheme || '';
            
            this.isEnabled = appName.includes('cursor') || uriScheme === 'cursor' || appName.includes('code');
            
            if (this.isEnabled) {
                console.log(`✅ IDE detected (${appName}) - integration enabled`);
            } else {
                console.log(`ℹ️ Unknown IDE (${appName}) - integration disabled`);
            }
            
        } catch (error) {
            console.error('❌ Failed to check Cursor availability:', error);
            this.isEnabled = false;
        }
    }

    /**
     * Получение состояния интеграции
     */
    public isIntegrationEnabled(): boolean {
        return this.isEnabled;
    }

    /**
     * Отправка текста в Cursor AI чат
     */
    public async sendToChat(text: string): Promise<CursorIntegrationResult> {
        console.log('🎯 [CURSOR_INTEGRATION] sendToChat method called');
        console.log('🎯 [CURSOR_INTEGRATION] Integration enabled:', this.isEnabled);
        console.log('🎯 [CURSOR_INTEGRATION] Primary strategy:', this.options.primaryStrategy);
        console.log('🎯 [CURSOR_INTEGRATION] Fallback strategies:', this.options.fallbackStrategies);
        
        if (!this.isEnabled) {
            console.log('❌ [CURSOR_INTEGRATION] Integration not available in this IDE');
            return {
                success: false,
                strategy: this.options.primaryStrategy,
                error: 'Cursor integration not available in this IDE'
            };
        }

        if (!text || text.trim().length === 0) {
            console.log('❌ [CURSOR_INTEGRATION] No text provided');
            return {
                success: false,
                strategy: this.options.primaryStrategy,
                error: 'No text provided'
            };
        }

        console.log(`🎯 [CURSOR_INTEGRATION] Sending text to Cursor chat, length: ${text.length}`);
        console.log(`🎯 [CURSOR_INTEGRATION] Text preview: "${text.substring(0, 50)}..."`);

        // Форматируем текст
        console.log('🎯 [CURSOR_INTEGRATION] Formatting text for chat...');
        const formattedText = this.formatTextForChat(text);
        console.log('🎯 [CURSOR_INTEGRATION] Text formatted, new length:', formattedText.length);

        // Пробуем основную стратегию
        try {
            console.log(`🎯 [CURSOR_INTEGRATION] Trying primary strategy: ${this.options.primaryStrategy}`);
            console.time('primary.strategy.execution');
            const result = await this.executeStrategy(this.options.primaryStrategy, formattedText);
            console.timeEnd('primary.strategy.execution');
            
            if (result.success) {
                console.log(`✅ [CURSOR_INTEGRATION] Successfully sent via ${result.strategy}`);
                
                // Уведомляем о успешной отправке
                if (this.events.onChatSent) {
                    console.log('🎯 [CURSOR_INTEGRATION] Calling onChatSent event handler');
                    this.events.onChatSent(text, result.strategy);
                }
                
                return result;
            } else {
                console.log(`❌ [CURSOR_INTEGRATION] Primary strategy failed with result:`, result);
            }
        } catch (error) {
            console.error(`❌ [CURSOR_INTEGRATION] Primary strategy ${this.options.primaryStrategy} failed:`, error);
            console.error('❌ [CURSOR_INTEGRATION] Primary strategy error details:', {
                name: (error as Error).name,
                message: (error as Error).message,
                stack: (error as Error).stack
            });
            
            // Уведомляем об ошибке
            if (this.events.onError) {
                console.log('🎯 [CURSOR_INTEGRATION] Calling onError event handler for primary strategy');
                this.events.onError(error as Error, this.options.primaryStrategy);
            }
        }

        // Пробуем fallback стратегии
        console.log(`🎯 [CURSOR_INTEGRATION] Trying ${this.options.fallbackStrategies.length} fallback strategies`);
        for (let i = 0; i < this.options.fallbackStrategies.length; i++) {
            const fallbackStrategy = this.options.fallbackStrategies[i];
            try {
                console.log(`🔄 [CURSOR_INTEGRATION] Trying fallback strategy ${i + 1}/${this.options.fallbackStrategies.length}: ${fallbackStrategy}`);
                console.time(`fallback.${i}.execution`);
                const result = await this.executeStrategy(fallbackStrategy, formattedText);
                console.timeEnd(`fallback.${i}.execution`);
                
                if (result.success) {
                    console.log(`✅ [CURSOR_INTEGRATION] Fallback successful via ${fallbackStrategy}`);
                    
                    // Уведомляем о использовании fallback
                    if (this.events.onFallbackUsed) {
                        console.log('🎯 [CURSOR_INTEGRATION] Calling onFallbackUsed event handler');
                        this.events.onFallbackUsed(this.options.primaryStrategy, fallbackStrategy);
                    }
                    
                    // Уведомляем о успешной отправке
                    if (this.events.onChatSent) {
                        console.log('🎯 [CURSOR_INTEGRATION] Calling onChatSent event handler for fallback');
                        this.events.onChatSent(text, fallbackStrategy);
                    }
                    
                    return {
                        ...result,
                        fallbackUsed: true
                    };
                } else {
                    console.log(`❌ [CURSOR_INTEGRATION] Fallback strategy ${fallbackStrategy} failed with result:`, result);
                }
                
            } catch (error) {
                console.error(`❌ [CURSOR_INTEGRATION] Fallback strategy ${fallbackStrategy} failed:`, error);
                console.error(`❌ [CURSOR_INTEGRATION] Fallback strategy ${fallbackStrategy} error details:`, {
                    name: (error as Error).name,
                    message: (error as Error).message,
                    stack: (error as Error).stack
                });
                
                // Уведомляем об ошибке fallback стратегии
                if (this.events.onError) {
                    console.log(`🎯 [CURSOR_INTEGRATION] Calling onError event handler for fallback strategy ${fallbackStrategy}`);
                    this.events.onError(error as Error, fallbackStrategy);
                }
            }
        }

        // Все стратегии провалились
        console.error('❌ [CURSOR_INTEGRATION] All integration strategies failed');
        return {
            success: false,
            strategy: this.options.primaryStrategy,
            error: 'All integration strategies failed'
        };
    }

    /**
     * Выполнение конкретной стратегии интеграции
     */
    private async executeStrategy(strategy: CursorIntegrationStrategy, text: string): Promise<CursorIntegrationResult> {
        switch (strategy) {
            case CursorIntegrationStrategy.AICHAT_COMMAND:
                return await this.useAIChatCommandStrategy(text);
            
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
     * Стратегия через команду aichat.newfollowupaction (РЕКОМЕНДУЕТСЯ для Cursor)
     * Использует проверенный рабочий метод из сообщества Cursor
     */
    private async useAIChatCommandStrategy(text: string): Promise<CursorIntegrationResult> {
        try {
            console.log('🎯 [CURSOR_INTEGRATION] Starting aichat.newfollowupaction command strategy');
            console.log('🎯 [CURSOR_INTEGRATION] Text to send length:', text.length);
            console.log('🎯 [CURSOR_INTEGRATION] Text preview:', text.substring(0, 100) + (text.length > 100 ? '...' : ''));
            
            // 1. Сохраняем оригинальный буфер обмена
            console.log('🎯 [CURSOR_INTEGRATION] Step 1: Reading original clipboard...');
            console.time('clipboard.readText');
            const originalClipboard = await this.vscodeEnv.env.clipboard.readText();
            console.timeEnd('clipboard.readText');
            console.log('🎯 [CURSOR_INTEGRATION] Step 1: Original clipboard saved, length:', originalClipboard.length);
            
            // 2. Открываем новый чат с помощью команды aichat.newfollowupaction
            console.log('🎯 [CURSOR_INTEGRATION] Step 2: Opening new chat...');
            console.time('aichat.newfollowupaction');
            await this.vscodeEnv.commands.executeCommand("aichat.newfollowupaction");
            console.timeEnd('aichat.newfollowupaction');
            console.log('🎯 [CURSOR_INTEGRATION] Step 2: aichat.newfollowupaction command executed successfully');
            
            // 3. Ждем, пока чат откроется (важно для стабильной работы)
            console.log('🎯 [CURSOR_INTEGRATION] Step 3: Waiting for chat window (500ms)...');
            console.time('chat.window.wait');
            await new Promise((resolve) => setTimeout(resolve, 500));
            console.timeEnd('chat.window.wait');
            console.log('🎯 [CURSOR_INTEGRATION] Step 3: Chat window wait completed');
            
            // 4. Копируем наш текст в буфер обмена
            console.log('🎯 [CURSOR_INTEGRATION] Step 4: Setting clipboard with transcribed text...');
            console.time('clipboard.writeText');
            await this.vscodeEnv.env.clipboard.writeText(text);
            console.timeEnd('clipboard.writeText');
            console.log('🎯 [CURSOR_INTEGRATION] Step 4: Clipboard updated with transcribed text');
            
            // 5. Вставляем содержимое в чат
            console.log('🎯 [CURSOR_INTEGRATION] Step 5: Pasting content into chat...');
            console.time('editor.action.clipboardPasteAction');
            await this.vscodeEnv.commands.executeCommand("editor.action.clipboardPasteAction");
            console.timeEnd('editor.action.clipboardPasteAction');
            console.log('🎯 [CURSOR_INTEGRATION] Step 5: Paste action completed successfully');
            
            // 6. Восстанавливаем оригинальный буфер обмена
            console.log('🎯 [CURSOR_INTEGRATION] Step 6: Restoring original clipboard...');
            console.time('clipboard.restore');
            await this.vscodeEnv.env.clipboard.writeText(originalClipboard);
            console.timeEnd('clipboard.restore');
            console.log('🎯 [CURSOR_INTEGRATION] Step 6: Original clipboard restored');
            
            console.log('✅ [CURSOR_INTEGRATION] Successfully sent to chat via aichat.newfollowupaction command');
            
            return {
                success: true,
                strategy: CursorIntegrationStrategy.AICHAT_COMMAND,
                message: 'Text sent to chat via aichat.newfollowupaction command'
            };
            
        } catch (error) {
            console.error('❌ [CURSOR_INTEGRATION] AIChatCommand strategy failed:', error);
            console.error('❌ [CURSOR_INTEGRATION] Error details:', {
                name: (error as Error).name,
                message: (error as Error).message,
                stack: (error as Error).stack
            });
            throw new Error(`AIChatCommand strategy failed: ${(error as Error).message}`);
        }
    }

    /**
     * Стратегия через буфер обмена
     */
    private async useClipboardStrategy(text: string): Promise<CursorIntegrationResult> {
        try {
            // Копируем текст в буфер обмена
            await this.vscodeEnv.env.clipboard.writeText(text);
            
            // Пытаемся сфокусироваться на чате
            if (this.options.autoFocusChat) {
                await this.focusOnChat();
            }
            
            // Показываем уведомление пользователю с таймаутом
            try {
                await Promise.race([
                    this.vscodeEnv.window.showInformationMessage(
                        `📋 Text copied to clipboard. ${this.options.autoFocusChat ? 'Chat focused - paste with Ctrl+V' : 'Paste in Cursor chat with Ctrl+V'}`
                    ),
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('showInformationMessage timed out')), 1000)
                    )
                ]);
            } catch (error) {
                console.log('Information message timed out or failed');
            }

            return {
                success: true,
                strategy: CursorIntegrationStrategy.CLIPBOARD,
                message: 'Text copied to clipboard'
            };
            
        } catch (error) {
            throw new Error(`Clipboard strategy failed: ${(error as Error).message}`);
        }
    }

    /**
     * Стратегия через палитру команд
     */
    private async useCommandPaletteStrategy(text: string): Promise<CursorIntegrationResult> {
        try {
            // Сначала копируем в буфер обмена
            await this.vscodeEnv.env.clipboard.writeText(text);
            
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
                    await this.vscodeEnv.commands.executeCommand(command);
                    
                    return {
                        success: true,
                        strategy: CursorIntegrationStrategy.COMMAND_PALETTE,
                        message: `Chat opened via ${command}`
                    };
                    
                } catch (commandError) {
                    // Команда не существует, пробуем следующую
                    console.log(`Command ${command} not available`);
                }
            }
            
            // Если специальные команды не работают, пробуем общую палитру команд
            await this.vscodeEnv.commands.executeCommand('workbench.action.showCommands');
            
            try {
                await Promise.race([
                    this.vscodeEnv.window.showInformationMessage(
                        '🎯 Command palette opened. Search for "chat" to open Cursor AI chat, then paste text.'
                    ),
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('showInformationMessage timed out')), 1000)
                    )
                ]);
            } catch (error) {
                console.log('Information message timed out or failed');
            }

            return {
                success: true,
                strategy: CursorIntegrationStrategy.COMMAND_PALETTE,
                message: 'Command palette opened'
            };
            
        } catch (error) {
            throw new Error(`Command palette strategy failed: ${(error as Error).message}`);
        }
    }

    /**
     * Стратегия фокусировки на чате
     */
    private async useFocusChatStrategy(text: string): Promise<CursorIntegrationResult> {
        try {
            // Копируем текст в буфер обмена
            await this.vscodeEnv.env.clipboard.writeText(text);
            
            // Пытаемся сфокусироваться на чате
            const focusResult = await this.focusOnChat();
            
            if (focusResult) {
                try {
                    await Promise.race([
                        this.vscodeEnv.window.showInformationMessage(
                            '💬 Chat focused and text copied. Paste with Ctrl+V to send message.'
                        ),
                        new Promise((_, reject) => 
                            setTimeout(() => reject(new Error('showInformationMessage timed out')), 1000)
                        )
                    ]);
                } catch (error) {
                    console.log('Information message timed out or failed');
                }
                
                return {
                    success: true,
                    strategy: CursorIntegrationStrategy.FOCUS_CHAT,
                    message: 'Chat focused successfully'
                };
            } else {
                throw new Error('Failed to focus on chat');
            }
            
        } catch (error) {
            throw new Error(`Focus chat strategy failed: ${(error as Error).message}`);
        }
    }

    /**
     * Стратегия прямой отправки в чат
     */
    private async useSendToChatStrategy(text: string): Promise<CursorIntegrationResult> {
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
                    await this.vscodeEnv.commands.executeCommand(command, text);
                    
                    return {
                        success: true,
                        strategy: CursorIntegrationStrategy.SEND_TO_CHAT,
                        message: `Text sent directly via ${command}`
                    };
                    
                } catch (commandError) {
                    // Команда не существует, пробуем следующую
                    console.log(`Direct send command ${command} not available`);
                }
            }
            
            // Если прямая отправка недоступна, используем clipboard как fallback
            return await this.useClipboardStrategy(text);
            
        } catch (error) {
            throw new Error(`Send to chat strategy failed: ${(error as Error).message}`);
        }
    }

    /**
     * Попытка сфокусироваться на AI чате Cursor
     */
    private async focusOnChat(): Promise<boolean> {
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
                    await this.vscodeEnv.commands.executeCommand(command);
                    console.log(`✅ Successfully focused chat via ${command}`);
                    return true;
                    
                } catch (commandError) {
                    // Команда не существует, пробуем следующую
                    console.log(`Focus command ${command} not available`);
                }
            }
            
            // Если специальные команды не работают, пробуем общие с таймаутом
            try {
                // Создаём промис с таймаутом для команд
                const executeWithTimeout = async (command: string, timeout: number = 1000): Promise<void> => {
                    return Promise.race([
                        this.vscodeEnv.commands.executeCommand(command),
                        new Promise<void>((_, reject) => 
                            setTimeout(() => reject(new Error(`Command ${command} timed out`)), timeout)
                        )
                    ]);
                };
                
                // Пытаемся открыть боковую панель или нижнюю панель с таймаутом
                try {
                    await executeWithTimeout('workbench.action.toggleSidebarVisibility', 500);
                } catch (error) {
                    console.log('Sidebar toggle timed out or failed');
                }
                
                await new Promise(resolve => setTimeout(resolve, 100));
                
                try {
                    await executeWithTimeout('workbench.action.togglePanel', 500);
                } catch (error) {
                    console.log('Panel toggle timed out or failed');
                }
                
                console.log('ℹ️ Opened panels - user needs to manually focus chat');
                return true;
                
            } catch (error) {
                console.error('❌ Failed to open panels:', error);
                return false;
            }
            
        } catch (error) {
            console.error('❌ Failed to focus on chat:', error);
            return false;
        }
    }

    /**
     * Форматирование текста для отправки в чат
     */
    private formatTextForChat(text: string): string {
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
            } else {
                // Или как цитату для обычного текста
                formattedText = '> ' + formattedText.replace(/\n/g, '\n> ');
            }
        }
        
        return formattedText;
    }

    /**
     * Проверка, похож ли текст на код
     */
    private looksLikeCode(text: string): boolean {
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
    public updateOptions(newOptions: Partial<CursorIntegrationOptions>): void {
        this.options = { ...this.options, ...newOptions };
        console.log('🔧 CursorIntegration options updated');
    }

    /**
     * Получение текущих настроек
     */
    public getOptions(): CursorIntegrationOptions {
        return { ...this.options };
    }

    /**
     * Получение доступных стратегий интеграции
     */
    public static getAvailableStrategies(): CursorIntegrationStrategy[] {
        return [
            CursorIntegrationStrategy.AICHAT_COMMAND,
            CursorIntegrationStrategy.CLIPBOARD,
            CursorIntegrationStrategy.COMMAND_PALETTE,
            CursorIntegrationStrategy.FOCUS_CHAT,
            CursorIntegrationStrategy.SEND_TO_CHAT
        ];
    }

    /**
     * Получение описания стратегии
     */
    public static getStrategyDescription(strategy: CursorIntegrationStrategy): string {
        const descriptions = {
            [CursorIntegrationStrategy.AICHAT_COMMAND]: 'Open new AI chat and paste text directly (RECOMMENDED)',
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
    dispose(): void {
        console.log('🔌 Disposing CursorIntegration resources...');
        
        // Здесь можно добавить очистку подписок, таймеров и других ресурсов
        // В данной реализации специальных ресурсов для очистки нет
        
        console.log('✅ CursorIntegration disposed successfully');
    }
} 