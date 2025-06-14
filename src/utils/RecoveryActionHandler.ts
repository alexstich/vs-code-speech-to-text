import * as vscode from 'vscode';
import { RecoveryAction } from './ErrorHandler';
import { RecoveryActionHandlerLog } from './GlobalOutput';

/**
 * Result of executing recovery action
 */
export interface RecoveryResult {
    success: boolean;
    message?: string;
    requiresRestart?: boolean;
}

/**
 * Interface for dependency injection of external components
 */
export interface RecoveryDependencies {
    checkMicrophone?: () => Promise<boolean>;
    testApiKey?: () => Promise<boolean>;
    openSettings?: () => void;
    reloadExtension?: () => void;
    retryLastOperation?: () => Promise<void>;
}

/**
 * Recovery action handler
 */
export class RecoveryActionHandler {
    private dependencies: RecoveryDependencies;

    constructor(dependencies: RecoveryDependencies = {}) {
        this.dependencies = dependencies;
    }

    /**
     * Executing recovery action
     */
    async executeRecoveryAction(action: RecoveryAction, context?: any): Promise<RecoveryResult> {
        RecoveryActionHandlerLog.info(`🔧 Executing recovery action: ${action}`);

        try {
            switch (action) {
                case RecoveryAction.CONFIGURE_API_KEY:
                    return await this.configureApiKey();

                case RecoveryAction.ENABLE_MICROPHONE:
                    return await this.enableMicrophone();

                case RecoveryAction.CHECK_NETWORK:
                    return await this.checkNetwork();

                case RecoveryAction.RETRY:
                    return await this.retryOperation();

                case RecoveryAction.OPEN_SETTINGS:
                    return this.openSettings();

                case RecoveryAction.REFRESH_EXTENSION:
                    return this.refreshExtension();

                case RecoveryAction.NONE:
                    return { success: true, message: 'No recovery action required' };

                default:
                    return { 
                        success: false, 
                        message: `Unknown recovery action: ${action}` 
                    };
            }
        } catch (error) {
            const errorMessage = (error as Error).message;
            RecoveryActionHandlerLog.error(`❌ Recovery action ${action} failed: ${errorMessage}`);
            return {
                success: false,
                message: `Recovery action failed: ${errorMessage}`
            };
        }
    }

    /**
     * API key configuration
     */
    private async configureApiKey(): Promise<RecoveryResult> {
        // Opening settings
        this.openSettingsInternal();

        // Showing instructions to the user
        const instruction = `
Please configure your OpenAI API Key:

1. Get your API key from: https://platform.openai.com/api-keys
2. Copy the key (starts with 'sk-')
3. Paste it in the 'Voice Scribe: Api Key' setting below
4. Save the settings

After setting the API key, try using SpeechToTextWhisper again.
        `;

        await vscode.window.showInformationMessage(
            instruction,
            { modal: true },
            'Got it'
        );

        return {
            success: true,
            message: 'Settings opened for API key configuration',
            requiresRestart: false
        };
    }

    /**
     * Enabling microphone
     */
    private async enableMicrophone(): Promise<RecoveryResult> {
        // Checking the current state of the microphone
        if (this.dependencies.checkMicrophone) {
            try {
                const isWorking = await this.dependencies.checkMicrophone();
                if (isWorking) {
                    return {
                        success: true,
                        message: 'Microphone is already working'
                    };
                }
            } catch (error) {
                RecoveryActionHandlerLog.warn(`Microphone check failed: ${(error as Error).message}`);
            }
        }

        // Showing instructions for microphone setup
        const instruction = `
Microphone Setup Instructions:

1. **Check Physical Connection:**
   - Ensure your microphone is properly connected
   - Try unplugging and reconnecting USB microphones

2. **Browser Permissions:**
   - Click on the lock icon in the address bar
   - Allow microphone access for VS Code
   - Refresh VS Code if needed

3. **System Permissions:**
   - macOS: System Preferences → Security & Privacy → Privacy → Microphone
   - Windows: Settings → Privacy → Microphone
   - Linux: Check audio system settings

4. **Test Microphone:**
   - Use the "Check Microphone" command in SpeechToTextWhisper
   - Or try recording in another application

After fixing the microphone, try SpeechToTextWhisper again.
        `;

        const action = await vscode.window.showWarningMessage(
            'Microphone access is required for SpeechToTextWhisper to work.',
            { modal: true },
            'Show Instructions',
            'Check Microphone',
            'Open Settings'
        );

        if (action === 'Show Instructions') {
            await vscode.window.showInformationMessage(instruction, { modal: true });
        } else if (action === 'Check Microphone' && this.dependencies.checkMicrophone) {
            try {
                const isWorking = await this.dependencies.checkMicrophone();
                if (isWorking) {
                    vscode.window.showInformationMessage('✅ Microphone is working correctly!');
                    return { success: true, message: 'Microphone verified' };
                } else {
                    vscode.window.showErrorMessage('❌ Microphone is still not accessible.');
                }
            } catch (error) {
                vscode.window.showErrorMessage(`❌ Microphone check failed: ${(error as Error).message}`);
            }
        } else if (action === 'Open Settings') {
            this.openSettingsInternal();
        }

        return {
            success: true,
            message: 'Microphone instructions provided'
        };
    }

    /**
     * Network check
     */
    private async checkNetwork(): Promise<RecoveryResult> {
        // Simple check of internet connection
        try {
            RecoveryActionHandlerLog.info('🌐 Checking network connectivity...');
            
            // Checking the availability of the OpenAI API
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);
            
            const response = await fetch('https://api.openai.com/v1/models', {
                method: 'HEAD',
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (response.ok || response.status === 401) {
                // 401 means that the API is available, but authorization is needed - this is normal
                return {
                    success: true,
                    message: 'Network connection is working'
                };
            } else {
                throw new Error(`API returned status: ${response.status}`);
            }
            
        } catch (error) {
            const errorMessage = (error as Error).message;
            
            if (errorMessage.includes('abort')) {
                return {
                    success: false,
                    message: 'Network connection is slow or unavailable'
                };
            }
            
            RecoveryActionHandlerLog.error('Network check failed:', error as Error);
            
            const action = await vscode.window.showWarningMessage(
                'Network connectivity issue detected. Please check your internet connection.',
                'Retry',
                'Troubleshoot'
            );

            if (action === 'Retry') {
                // Repeated check
                return await this.checkNetwork();
            } else if (action === 'Troubleshoot') {
                const troubleshootInfo = `
Network Troubleshooting:

1. **Check Internet Connection:**
   - Try opening a website in your browser
   - Ping google.com from terminal/command prompt

2. **Firewall/Proxy:**
   - Check if your firewall blocks VS Code
   - Configure proxy settings if needed
   - Contact IT admin if on corporate network

3. **OpenAI API Access:**
   - Verify api.openai.com is accessible
   - Check if your country/region has access

4. **DNS Issues:**
   - Try using different DNS servers (8.8.8.8, 1.1.1.1)
   - Flush DNS cache

Try again after resolving network issues.
                `;
                
                await vscode.window.showInformationMessage(troubleshootInfo, { modal: true });
            }

            return {
                success: false,
                message: `Network issue: ${errorMessage}`
            };
        }
    }

    /**
     * Retry operation
     */
    private async retryOperation(): Promise<RecoveryResult> {
        if (this.dependencies.retryLastOperation) {
            try {
                await this.dependencies.retryLastOperation();
                return {
                    success: true,
                    message: 'Operation retried successfully'
                };
            } catch (error) {
                return {
                    success: false,
                    message: `Retry failed: ${(error as Error).message}`
                };
            }
        }

        return {
            success: true,
            message: 'Please try the operation again manually'
        };
    }

    /**
     * Opening settings
     */
    private openSettings(): RecoveryResult {
        this.openSettingsInternal();
        return {
            success: true,
            message: 'Settings opened'
        };
    }

    /**
     * Reloading the extension
     */
    private refreshExtension(): RecoveryResult {
        if (this.dependencies.reloadExtension) {
            this.dependencies.reloadExtension();
            return {
                success: true,
                message: 'Extension reloaded',
                requiresRestart: true
            };
        }

        // Suggesting to the user to reload manually
        vscode.window.showInformationMessage(
            'Please reload VS Code to refresh the SpeechToTextWhisper extension.',
            'Reload Window'
        ).then(action => {
            if (action === 'Reload Window') {
                vscode.commands.executeCommand('workbench.action.reloadWindow');
            }
        });

        return {
            success: true,
            message: 'Reload requested'
        };
    }

    /**
     * Internal function for opening settings
     */
    private openSettingsInternal(): void {
        if (this.dependencies.openSettings) {
            this.dependencies.openSettings();
        } else {
            vscode.commands.executeCommand('workbench.action.openSettings', 'speechToTextWhisper');
        }
    }

    /**
     * Setting dependencies
     */
    setDependencies(dependencies: Partial<RecoveryDependencies>): void {
        this.dependencies = { ...this.dependencies, ...dependencies };
    }
}

/**
 * Global instance of recovery handler
 */
export const globalRecoveryHandler = new RecoveryActionHandler(); 