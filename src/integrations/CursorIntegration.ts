import * as vscode from 'vscode';
import { CursorIntegrationLog } from '../utils/GlobalOutput';

/**
 * Integration strategies with Cursor chat
 */
export enum CursorIntegrationStrategy {
    AICHAT_COMMAND = 'aichat_command',    // Through the aichat.newfollowupaction command (RECOMMENDED)
    CLIPBOARD = 'clipboard',           // Through the clipboard
    COMMAND_PALETTE = 'command_palette', // Through the command palette
    FOCUS_CHAT = 'focus_chat',         // Automatic focus on the chat
    SEND_TO_CHAT = 'send_to_chat'      // Direct sending to the chat
}

/**
 * Result of the integration operation with Cursor
 */
export interface CursorIntegrationResult {
    success: boolean;
    strategy: CursorIntegrationStrategy;
    message?: string;
    error?: string;
    fallbackUsed?: boolean;
}

/**
 * Settings for CursorIntegration
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
 * Events for CursorIntegration
 */
export interface CursorIntegrationEvents {
    onChatSent?: (text: string, strategy: CursorIntegrationStrategy) => void;
    onFallbackUsed?: (primaryStrategy: CursorIntegrationStrategy, fallbackStrategy: CursorIntegrationStrategy) => void;
    onError?: (error: Error, strategy: CursorIntegrationStrategy) => void;
}

/**
 * Interface for vscode environment (for testing)
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
 * Integration with Cursor AI chat
 * Implements different strategies for sending transcribed text to the chat
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
        
        // Safe initialization of vscode environment
        if (vscodeEnvironment) {
            this.vscodeEnv = vscodeEnvironment;
        } else {
            // Use the real vscode API if it is available
            this.vscodeEnv = {
                env: vscode.env,
                window: vscode.window,
                commands: vscode.commands
            };
        }
        
        // Check the availability of integration
        this.checkAvailability();
        
        CursorIntegrationLog.info(`🎯 CursorIntegration initialized, enabled: ${this.isEnabled}`);
    }

    /**
     * Merging default settings with user settings
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
     * Checking the availability of integration with Cursor
     */
    private checkAvailability(): void {
        try {
            // Check that vscodeEnv and its properties are available
            if (!this.vscodeEnv || !this.vscodeEnv.env) {
                CursorIntegrationLog.warn('⚠️ VS Code environment not available');
                this.isEnabled = false;
                return;
            }
            
            // Check that we are really in Cursor IDE
            const appName = this.vscodeEnv.env.appName?.toLowerCase() || '';
            const uriScheme = this.vscodeEnv.env.uriScheme || '';
            
            this.isEnabled = appName.includes('cursor') || uriScheme === 'cursor' || appName.includes('code');
            
            if (this.isEnabled) {
                CursorIntegrationLog.info(`✅ IDE detected (${appName}) - integration enabled`);
            } else {
                CursorIntegrationLog.info(`ℹ️ Unknown IDE (${appName}) - integration disabled`);
            }
            
        } catch (error) {
            CursorIntegrationLog.error('❌ Failed to check Cursor availability:', error as Error);
            this.isEnabled = false;
        }
    }

    /**
     * Getting the state of integration
     */
    public isIntegrationEnabled(): boolean {
        return this.isEnabled;
    }

    /**
     * Sending text to Cursor AI chat
     */
    public async sendToChat(text: string): Promise<CursorIntegrationResult> {
        CursorIntegrationLog.info('🎯 [CURSOR_INTEGRATION] sendToChat method called');
        CursorIntegrationLog.info(`🎯 [CURSOR_INTEGRATION] Integration enabled: ${this.isEnabled}`);
        CursorIntegrationLog.info(`🎯 [CURSOR_INTEGRATION] Primary strategy: ${this.options.primaryStrategy}`);
        CursorIntegrationLog.info(`🎯 [CURSOR_INTEGRATION] Fallback strategies: ${JSON.stringify(this.options.fallbackStrategies)}`);
        
        if (!this.isEnabled) {
            CursorIntegrationLog.info('❌ [CURSOR_INTEGRATION] Integration not available in this IDE');
            return {
                success: false,
                strategy: this.options.primaryStrategy,
                error: 'Cursor integration not available in this IDE'
            };
        }

        if (!text || text.trim().length === 0) {
            CursorIntegrationLog.info('❌ [CURSOR_INTEGRATION] No text provided');
            return {
                success: false,
                strategy: this.options.primaryStrategy,
                error: 'No text provided'
            };
        }

        CursorIntegrationLog.info(`🎯 [CURSOR_INTEGRATION] Sending text to Cursor chat, length: ${text.length}`);
        CursorIntegrationLog.info(`🎯 [CURSOR_INTEGRATION] Text preview: "${text.substring(0, 50)}..."`);

        // Format the text
        CursorIntegrationLog.info('🎯 [CURSOR_INTEGRATION] Formatting text for chat...');
        const formattedText = this.formatTextForChat(text);
        CursorIntegrationLog.info(`🎯 [CURSOR_INTEGRATION] Text formatted, new length: ${formattedText.length}`);

        // Try the main strategy
        try {
            CursorIntegrationLog.info(`🎯 [CURSOR_INTEGRATION] Trying primary strategy: ${this.options.primaryStrategy}`);
            const result = await this.executeStrategy(this.options.primaryStrategy, formattedText);
            
            if (result.success) {
                CursorIntegrationLog.info(`✅ [CURSOR_INTEGRATION] Successfully sent via ${result.strategy}`);
                
                // Notify about the successful sending
                if (this.events.onChatSent) {
                    CursorIntegrationLog.info(`🎯 [CURSOR_INTEGRATION] Calling onChatSent event handler`);
                    this.events.onChatSent(text, result.strategy);
                }
                
                return result;
            } else {
                CursorIntegrationLog.warn(`❌ [CURSOR_INTEGRATION] Primary strategy failed with result: ${JSON.stringify(result)}`);
            }
        } catch (error) {
            CursorIntegrationLog.error(`❌ [CURSOR_INTEGRATION] Primary strategy ${this.options.primaryStrategy} failed:`, error as Error);
            CursorIntegrationLog.warn(`❌ [CURSOR_INTEGRATION] Error name: ${(error as Error).name}, message: ${(error as Error).message}`);
            
            // Notify about the error
            if (this.events.onError) {
                CursorIntegrationLog.info(`🎯 [CURSOR_INTEGRATION] Calling onError event handler for primary strategy`);
                this.events.onError(error as Error, this.options.primaryStrategy);
            }
        }

        // Try the fallback strategies
        CursorIntegrationLog.info(`🎯 [CURSOR_INTEGRATION] Trying ${this.options.fallbackStrategies.length} fallback strategies`);
        for (let i = 0; i < this.options.fallbackStrategies.length; i++) {
            const fallbackStrategy = this.options.fallbackStrategies[i];
            try {
                CursorIntegrationLog.info(`🔄 [CURSOR_INTEGRATION] Trying fallback strategy ${i + 1}/${this.options.fallbackStrategies.length}: ${fallbackStrategy}`);
                const result = await this.executeStrategy(fallbackStrategy, formattedText);
                
                if (result.success) {
                    CursorIntegrationLog.info(`✅ [CURSOR_INTEGRATION] Fallback successful via ${fallbackStrategy}`);
                    
                    // Notify about the use of fallback
                    if (this.events.onFallbackUsed) {
                        CursorIntegrationLog.info(`🎯 [CURSOR_INTEGRATION] Calling onFallbackUsed event handler`);
                        this.events.onFallbackUsed(this.options.primaryStrategy, fallbackStrategy);
                    }
                    
                    // Notify about the successful sending
                    if (this.events.onChatSent) {
                        CursorIntegrationLog.info(`🎯 [CURSOR_INTEGRATION] Calling onChatSent event handler for fallback`);
                        this.events.onChatSent(text, fallbackStrategy);
                    }
                    
                    return {
                        ...result,
                        fallbackUsed: true
                    };
                } else {
                    CursorIntegrationLog.warn(`❌ [CURSOR_INTEGRATION] Fallback strategy ${fallbackStrategy} failed with result: ${JSON.stringify(result)}`);
                }
                
            } catch (error) {
                CursorIntegrationLog.error(`❌ [CURSOR_INTEGRATION] Fallback strategy ${fallbackStrategy} failed:`, error as Error);
                CursorIntegrationLog.warn(`❌ [CURSOR_INTEGRATION] Error name: ${(error as Error).name}, message: ${(error as Error).message}`);
                
                // Notify about the error of fallback strategy
                if (this.events.onError) {
                    CursorIntegrationLog.info(`🎯 [CURSOR_INTEGRATION] Calling onError event handler for fallback strategy ${fallbackStrategy}`);
                    this.events.onError(error as Error, fallbackStrategy);
                }
            }
        }

        // All strategies failed
        CursorIntegrationLog.error('❌ [CURSOR_INTEGRATION] All integration strategies failed');
        return {
            success: false,
            strategy: this.options.primaryStrategy,
            error: 'All integration strategies failed'
        };
    }

    /**
     * Execution of a specific integration strategy
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
     * Strategy through the aichat.newfollowupaction command (RECOMMENDED for Cursor)
     * Uses a proven working method from the Cursor community
     */
    private async useAIChatCommandStrategy(text: string): Promise<CursorIntegrationResult> {
        try {
            CursorIntegrationLog.info('🎯 [CURSOR_INTEGRATION] Starting aichat.newfollowupaction command strategy');
            CursorIntegrationLog.info(`🎯 [CURSOR_INTEGRATION] Text to send length: ${text.length}`);
            CursorIntegrationLog.info(`🎯 [CURSOR_INTEGRATION] Text preview: ${text.substring(0, 100) + (text.length > 100 ? '...' : '')}`);
            
            // 1. Save the original clipboard
            CursorIntegrationLog.info('🎯 [CURSOR_INTEGRATION] Step 1: Reading original clipboard...');
            const originalClipboard = await this.vscodeEnv.env.clipboard.readText();
            CursorIntegrationLog.info(`🎯 [CURSOR_INTEGRATION] Step 1: Original clipboard saved, length: ${originalClipboard.length}`);
            
            // 2. Open a current chat using the aichat.newfollowupaction command
            CursorIntegrationLog.info('🎯 [CURSOR_INTEGRATION] Step 2: Opening current chat...');
            await this.vscodeEnv.commands.executeCommand("aichat.newfollowupaction");
            CursorIntegrationLog.info('🎯 [CURSOR_INTEGRATION] Step 2: aichat.newfollowupaction command executed successfully');
            
            // 3. Wait for the chat to open (important for stable operation)
            CursorIntegrationLog.info('🎯 [CURSOR_INTEGRATION] Step 3: Waiting for chat window (500ms)...');
            await new Promise((resolve) => setTimeout(resolve, 500));
            CursorIntegrationLog.info('🎯 [CURSOR_INTEGRATION] Step 3: Chat window wait completed');
            
            // 4. Copy our text to the clipboard
            CursorIntegrationLog.info('🎯 [CURSOR_INTEGRATION] Step 4: Setting clipboard with transcribed text...');
            await this.vscodeEnv.env.clipboard.writeText(text);
            CursorIntegrationLog.info('🎯 [CURSOR_INTEGRATION] Step 4: Clipboard updated with transcribed text');
            
            // 5. Paste the content into the chat
            CursorIntegrationLog.info('🎯 [CURSOR_INTEGRATION] Step 5: Pasting content into chat...');
            await this.vscodeEnv.commands.executeCommand("editor.action.clipboardPasteAction");
            CursorIntegrationLog.info('🎯 [CURSOR_INTEGRATION] Step 5: Paste action completed successfully');
            
            // 6. Restore the original clipboard
            CursorIntegrationLog.info('🎯 [CURSOR_INTEGRATION] Step 6: Restoring original clipboard...');
            await this.vscodeEnv.env.clipboard.writeText(originalClipboard);
            CursorIntegrationLog.info('🎯 [CURSOR_INTEGRATION] Step 6: Original clipboard restored');
            
            CursorIntegrationLog.info('✅ [CURSOR_INTEGRATION] Successfully sent to chat via aichat.newfollowupaction command');
            
            return {
                success: true,
                strategy: CursorIntegrationStrategy.AICHAT_COMMAND,
                message: 'Text sent to chat via aichat.newfollowupaction command'
            };
            
        } catch (error) {
            CursorIntegrationLog.error('❌ [CURSOR_INTEGRATION] AIChatCommand strategy failed:', error as Error);
            CursorIntegrationLog.warn(`❌ [CURSOR_INTEGRATION] Error name: ${(error as Error).name}, message: ${(error as Error).message}`);
            throw new Error(`AIChatCommand strategy failed: ${(error as Error).message}`);
        }
    }

    /**
     * Strategy through the clipboard
     */
    private async useClipboardStrategy(text: string): Promise<CursorIntegrationResult> {
        try {
            // Copy the text to the clipboard
            await this.vscodeEnv.env.clipboard.writeText(text);
            
            // Try to focus on the chat
            if (this.options.autoFocusChat) {
                await this.focusOnChat();
            }
            
            // Show a notification to the user with a timeout
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
                CursorIntegrationLog.info('Information message timed out or failed');
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
     * Strategy through the command palette
     */
    private async useCommandPaletteStrategy(text: string): Promise<CursorIntegrationResult> {
        try {
            // First copy the text to the clipboard
            await this.vscodeEnv.env.clipboard.writeText(text);
            
            // Try to open the Cursor command palette for the chat
            // Cursor may have special commands for the AI chat
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
                    // The command does not exist, try the next one
                    CursorIntegrationLog.info(`Command ${command} not available`);
                }
            }
            
            // If special commands do not work, try the general command palette
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
                CursorIntegrationLog.info('Information message timed out or failed');
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
     * Strategy of focusing on the chat
     */
    private async useFocusChatStrategy(text: string): Promise<CursorIntegrationResult> {
        try {
            // Copy the text to the clipboard
            await this.vscodeEnv.env.clipboard.writeText(text);
            
            // Try to focus on the chat
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
                    CursorIntegrationLog.info('Information message timed out or failed');
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
     * Strategy of direct sending to the chat
     */
    private async useSendToChatStrategy(text: string): Promise<CursorIntegrationResult> {
        try {
            // This is the most advanced strategy that requires a direct Cursor API
            // Until Cursor does not provide a public API for this, we use fallback
            
            // Try to find and use possible Cursor commands for sending to the chat
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
                    // The command does not exist, try the next one
                    CursorIntegrationLog.info(`Direct send command ${command} not available`);
                }
            }
            
            // If direct sending is not available, use clipboard as fallback
            return await this.useClipboardStrategy(text);
            
        } catch (error) {
            throw new Error(`Send to chat strategy failed: ${(error as Error).message}`);
        }
    }

    /**
     * Try to focus on the AI chat in Cursor
     */
    private async focusOnChat(): Promise<boolean> {
        try {
            // List of possible commands to focus on the chat in Cursor
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
                    CursorIntegrationLog.info(`✅ Successfully focused chat via ${command}`);
                    return true;
                    
                } catch (commandError) {
                    // The command does not exist, try the next one
                    CursorIntegrationLog.info(`Focus command ${command} not available`);
                }
            }
            
            // If special commands do not work, try the general with timeout
            try {
                // Create a promise with timeout for commands
                const executeWithTimeout = async (command: string, timeout: number = 1000): Promise<void> => {
                    return Promise.race([
                        this.vscodeEnv.commands.executeCommand(command),
                        new Promise<void>((_, reject) => 
                            setTimeout(() => reject(new Error(`Command ${command} timed out`)), timeout)
                        )
                    ]);
                };
                
                // Try to open the sidebar or bottom panel with timeout
                try {
                    await executeWithTimeout('workbench.action.toggleSidebarVisibility', 500);
                } catch (error) {
                    CursorIntegrationLog.warn('Sidebar toggle timed out or failed');
                }
                
                await new Promise(resolve => setTimeout(resolve, 100));
                
                try {
                    await executeWithTimeout('workbench.action.togglePanel', 500);
                } catch (error) {
                    CursorIntegrationLog.warn('Panel toggle timed out or failed');
                }
                
                CursorIntegrationLog.info('ℹ️ Opened panels - user needs to manually focus chat');
                return true;
                
            } catch (error) {
                CursorIntegrationLog.error('❌ Failed to open panels:', error as Error);
                return false;
            }
            
        } catch (error) {
            CursorIntegrationLog.error('❌ Failed to focus on chat:', error as Error);
            return false;
        }
    }

    /**
     * Formatting text for sending to the chat
     */
    private formatTextForChat(text: string): string {
        let formattedText = text.trim();
        
        // Add prefix
        if (this.options.prefixText) {
            formattedText = this.options.prefixText + formattedText;
        }
        
        // Add suffix
        if (this.options.suffixText) {
            formattedText = formattedText + this.options.suffixText;
        }
        
        // Format as Markdown if enabled
        if (this.options.useMarkdownFormat) {
            // Wrap in code block if it looks like code
            if (this.looksLikeCode(formattedText)) {
                formattedText = '```\n' + formattedText + '\n```';
            } else {
                // Or as a quote for normal text
                formattedText = '> ' + formattedText.replace(/\n/g, '\n> ');
            }
        }
        
        return formattedText;
    }

    /**
     * Checking if the text looks like code
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
     * Updating integration settings
     */
    public updateOptions(newOptions: Partial<CursorIntegrationOptions>): void {
        this.options = { ...this.options, ...newOptions };
        CursorIntegrationLog.info('🔧 CursorIntegration options updated');
    }

    /**
     * Getting current settings
     */
    public getOptions(): CursorIntegrationOptions {
        return { ...this.options };
    }

    /**
     * Getting available integration strategies
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
     * Getting the description of the strategy
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
     * Releasing resources
     */
    dispose(): void {
        CursorIntegrationLog.info('🔌 Disposing CursorIntegration resources...');
        
        // Here you can add cleanup of subscriptions, timers, and other resources
        // In this implementation, there are no special resources for cleanup
        
        CursorIntegrationLog.info('✅ CursorIntegration disposed successfully');
    }
} 