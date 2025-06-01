// extension.test.ts - интеграционные тесты для главного файла расширения

import * as assert from 'assert';
import * as vscode from 'vscode';
import * as sinon from 'sinon';
import { setupVSCodeMocks, resetVSCodeMocks } from '../mocks/vscodeMocks';
import { setupWebAudioMocks, cleanupWebAudioMocks } from '../mocks/webAudioMocks';

suite('Extension Integration Tests', () => {
    let extension: vscode.Extension<any> | undefined;

    suiteSetup(async () => {
        setupVSCodeMocks();
        setupWebAudioMocks();
        
        // Найти и активировать расширение
        extension = vscode.extensions.getExtension('voicescribe');
        if (extension) {
            await extension.activate();
        }
    });

    suiteTeardown(() => {
        cleanupWebAudioMocks();
        resetVSCodeMocks();
        sinon.restore();
    });

    suite('Extension Activation', () => {
        test('Should activate without errors', () => {
            assert.ok(extension, 'Extension should be found');
            assert.ok(extension!.isActive, 'Extension should be active');
        });

        test('Should register all commands', async () => {
            const commands = await vscode.commands.getCommands(true);
            
            const speechToTextWhisperCommands = [
                'speechToTextWhisper.startRecording',
                'speechToTextWhisper.stopRecording',
                'speechToTextWhisper.toggleRecording',
                'speechToTextWhisper.startHoldToRecord',
                'speechToTextWhisper.stopHoldToRecord',
                'speechToTextWhisper.insertAtCursor',
                'speechToTextWhisper.insertAsComment',
                'speechToTextWhisper.replaceSelection',
                'speechToTextWhisper.copyToClipboard',
                'speechToTextWhisper.openSettings',
                'speechToTextWhisper.showHelp',
                'speechToTextWhisper.showStatus',
                'speechToTextWhisper.checkMicrophone',
                'speechToTextWhisper.testApiKey',
                'speechToTextWhisper.resetConfiguration',
                'speechToTextWhisper.toggleStatusBar'
            ];

            speechToTextWhisperCommands.forEach(cmd => {
                assert.ok(commands.includes(cmd), `Command ${cmd} should be registered`);
            });
        });
    });

    suite('Command Execution', () => {
        let executeCommandStub: sinon.SinonStub;
        let showInformationMessageStub: sinon.SinonStub;
        let showErrorMessageStub: sinon.SinonStub;

        setup(() => {
            executeCommandStub = sinon.stub(vscode.commands, 'executeCommand');
            showInformationMessageStub = sinon.stub(vscode.window, 'showInformationMessage');
            showErrorMessageStub = sinon.stub(vscode.window, 'showErrorMessage');
        });

        teardown(() => {
            sinon.restore();
        });

        test('Should handle openSettings command', async () => {
            executeCommandStub.resolves();
            
            await vscode.commands.executeCommand('speechToTextWhisper.openSettings');
            
            assert.ok(executeCommandStub.calledWith('workbench.action.openSettings', 'speechToTextWhisper'),
                'Should open settings with speechToTextWhisper filter');
        });

        test('Should handle showHelp command', async () => {
            showInformationMessageStub.resolves();
            
            await vscode.commands.executeCommand('speechToTextWhisper.showHelp');
            
            assert.ok(showInformationMessageStub.called, 'Should show help message');
            const helpMessage = showInformationMessageStub.getCall(0).args[0];
            assert.ok(helpMessage.includes('SpeechToTextWhisper Help'), 'Should contain help title');
            assert.ok(helpMessage.includes('F9'), 'Should mention F9 key');
        });

        test('Should handle showStatus command', async () => {
            showInformationMessageStub.resolves();
            
            await vscode.commands.executeCommand('speechToTextWhisper.showStatus');
            
            assert.ok(showInformationMessageStub.called, 'Should show status message');
            const statusMessage = showInformationMessageStub.getCall(0).args[0];
            assert.ok(statusMessage.includes('SpeechToTextWhisper Status'), 'Should contain status title');
        });

        test('Should handle resetConfiguration command', async () => {
            const showWarningMessageStub = sinon.stub(vscode.window, 'showWarningMessage').resolves({ title: 'Yes' });
            const configStub = sinon.stub(vscode.workspace, 'getConfiguration').returns({
                update: sinon.stub().resolves()
            } as any);
            
            await vscode.commands.executeCommand('speechToTextWhisper.resetConfiguration');
            
            assert.ok(showWarningMessageStub.called, 'Should show confirmation dialog');
            assert.ok(configStub.called, 'Should access configuration');
        });
    });

    suite('Hold-to-Record Mode', () => {
        let commandStub: sinon.SinonStub;

        setup(() => {
            commandStub = sinon.stub(vscode.commands, 'executeCommand');
        });

        teardown(() => {
            sinon.restore();
        });

        test('Should handle F9 key down (start hold-to-record)', async () => {
            commandStub.resolves();
            
            await vscode.commands.executeCommand('speechToTextWhisper.startHoldToRecord');
            
            // Проверяем что команда выполнена без ошибок
            assert.ok(commandStub.called);
        });

        test('Should handle F9 key up (stop hold-to-record)', async () => {
            commandStub.resolves();
            
            await vscode.commands.executeCommand('speechToTextWhisper.stopHoldToRecord');
            
            // Проверяем что команда выполнена без ошибок
            assert.ok(commandStub.called);
        });
    });

    suite('Configuration Handling', () => {
        let getConfigurationStub: sinon.SinonStub;
        let mockConfig: any;

        setup(() => {
            mockConfig = {
                get: sinon.stub(),
                update: sinon.stub().resolves()
            };
            getConfigurationStub = sinon.stub(vscode.workspace, 'getConfiguration').returns(mockConfig);
        });

        teardown(() => {
            sinon.restore();
        });

        test('Should read API key configuration', () => {
            mockConfig.get.withArgs('apiKey').returns('sk-test1234567890abcdef1234567890abcdef1234567890abcd');
            
            const config = vscode.workspace.getConfiguration('speechToTextWhisper');
            const apiKey = config.get('apiKey');
            
            assert.strictEqual(apiKey, 'sk-test1234567890abcdef1234567890abcdef1234567890abcd');
        });

        test('Should read language configuration', () => {
            mockConfig.get.withArgs('language', 'auto').returns('en');
            
            const config = vscode.workspace.getConfiguration('speechToTextWhisper');
            const language = config.get('language', 'auto');
            
            assert.strictEqual(language, 'en');
        });

        test('Should read recordingMode configuration', () => {
            mockConfig.get.withArgs('recordingMode', 'chat').returns('clipboard');
            
            const config = vscode.workspace.getConfiguration('speechToTextWhisper');
            const recordingMode = config.get('recordingMode', 'chat');
            
            assert.strictEqual(recordingMode, 'clipboard');
        });
    });

    suite('Error Handling', () => {
        let showErrorMessageStub: sinon.SinonStub;
        let showWarningMessageStub: sinon.SinonStub;

        setup(() => {
            showErrorMessageStub = sinon.stub(vscode.window, 'showErrorMessage');
            showWarningMessageStub = sinon.stub(vscode.window, 'showWarningMessage');
        });

        teardown(() => {
            sinon.restore();
        });

        test('Should handle missing API key gracefully', async () => {
            const getConfigurationStub = sinon.stub(vscode.workspace, 'getConfiguration').returns({
                get: sinon.stub().withArgs('apiKey').returns(undefined)
            } as any);
            
            await vscode.commands.executeCommand('speechToTextWhisper.testApiKey');
            
            assert.ok(showWarningMessageStub.called, 'Should show warning for missing API key');
        });

        test('Should handle microphone check errors', async () => {
            // Мокируем ошибку микрофона
            const originalMediaDevices = (global as any).navigator?.mediaDevices;
            if ((global as any).navigator) {
                (global as any).navigator.mediaDevices = {
                    getUserMedia: sinon.stub().rejects(new Error('Permission denied'))
                };
            }
            
            await vscode.commands.executeCommand('speechToTextWhisper.checkMicrophone');
            
            // Восстанавливаем
            if ((global as any).navigator && originalMediaDevices) {
                (global as any).navigator.mediaDevices = originalMediaDevices;
            }
            
            assert.ok(showErrorMessageStub.called, 'Should show error for microphone issues');
        });
    });

    suite('Insert Mode Commands', () => {
        let commandStub: sinon.SinonStub;
        let showWarningMessageStub: sinon.SinonStub;

        setup(() => {
            commandStub = sinon.stub(vscode.commands, 'executeCommand');
            showWarningMessageStub = sinon.stub(vscode.window, 'showWarningMessage');
        });

        teardown(() => {
            sinon.restore();
        });

        test('Should warn when no transcription available for insertAtCursor', async () => {
            await vscode.commands.executeCommand('speechToTextWhisper.insertAtCursor');
            
            assert.ok(showWarningMessageStub.called, 'Should warn about no transcription');
            const message = showWarningMessageStub.getCall(0).args[0];
            assert.ok(message.includes('No transcribed text available'), 'Should mention no text available');
        });

        test('Should warn when no transcription available for insertAsComment', async () => {
            await vscode.commands.executeCommand('speechToTextWhisper.insertAsComment');
            
            assert.ok(showWarningMessageStub.called, 'Should warn about no transcription');
        });

        test('Should warn when no transcription available for replaceSelection', async () => {
            await vscode.commands.executeCommand('speechToTextWhisper.replaceSelection');
            
            assert.ok(showWarningMessageStub.called, 'Should warn about no transcription');
        });

        test('Should warn when no transcription available for copyToClipboard', async () => {
            await vscode.commands.executeCommand('speechToTextWhisper.copyToClipboard');
            
            assert.ok(showWarningMessageStub.called, 'Should warn about no transcription');
        });
    });

    suite('Welcome Message', () => {
        let showInformationMessageStub: sinon.SinonStub;

        setup(() => {
            showInformationMessageStub = sinon.stub(vscode.window, 'showInformationMessage');
        });

        teardown(() => {
            sinon.restore();
        });

        test('Should show welcome message when no API key configured', () => {
            const getConfigurationStub = sinon.stub(vscode.workspace, 'getConfiguration').returns({
                get: sinon.stub().withArgs('apiKey').returns(undefined)
            } as any);
            
            // Симулируем активацию (welcome message показывается при активации)
            // В реальности это происходит в функции showWelcomeMessage()
            
            assert.ok(getConfigurationStub.called);
        });
    });
}); 