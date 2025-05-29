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
const assert = __importStar(require("assert"));
const sinon = __importStar(require("sinon"));
const CursorIntegration_1 = require("../../integrations/CursorIntegration");
// Mock для vscode API
const mockVSCode = {
    env: {
        appName: 'Visual Studio Code',
        uriScheme: 'vscode',
        clipboard: {
            writeText: sinon.stub().resolves(),
            readText: sinon.stub().resolves('')
        }
    },
    window: {
        showInformationMessage: sinon.stub().resolves(),
        showWarningMessage: sinon.stub().resolves(),
        showErrorMessage: sinon.stub().resolves()
    },
    commands: {
        executeCommand: sinon.stub().resolves()
    }
};
// Мокируем vscode модуль
global.vscode = mockVSCode;
suite('CursorIntegration Tests', () => {
    let cursorIntegration;
    let eventHandlers;
    let originalSetTimeout;
    setup(() => {
        // Сохраняем оригинальный setTimeout
        originalSetTimeout = global.setTimeout;
        // Мокируем setTimeout для тестов
        global.setTimeout = sinon.stub().callsFake((fn, delay) => {
            // Выполняем callback немедленно для тестов
            fn();
            return 1; // Возвращаем mock timer ID
        });
        // Сбрасываем все моки
        sinon.resetBehavior();
        sinon.resetHistory();
        // Настраиваем заглушки для событий
        eventHandlers = {
            onChatSent: sinon.stub(),
            onFallbackUsed: sinon.stub(),
            onError: sinon.stub()
        };
        // Сбрасываем vscode моки
        mockVSCode.env.clipboard.writeText.resolves();
        mockVSCode.commands.executeCommand.resolves();
        mockVSCode.window.showInformationMessage.resolves();
    });
    teardown(() => {
        // Восстанавливаем оригинальный setTimeout
        global.setTimeout = originalSetTimeout;
        if (cursorIntegration) {
            // CursorIntegration не требует dispose(), но очищаем ссылки
            cursorIntegration = null;
        }
        sinon.restore();
    });
    suite('Initialization', () => {
        test('Should initialize with default options in VS Code', () => {
            mockVSCode.env.appName = 'Visual Studio Code';
            mockVSCode.env.uriScheme = 'vscode';
            cursorIntegration = new CursorIntegration_1.CursorIntegration();
            assert.ok(!cursorIntegration.isIntegrationEnabled());
            const options = cursorIntegration.getOptions();
            assert.strictEqual(options.primaryStrategy, CursorIntegration_1.CursorIntegrationStrategy.CLIPBOARD);
            assert.strictEqual(options.autoFocusChat, true);
        });
        test('Should enable integration in Cursor IDE', () => {
            mockVSCode.env.appName = 'Cursor';
            mockVSCode.env.uriScheme = 'cursor';
            cursorIntegration = new CursorIntegration_1.CursorIntegration();
            assert.ok(cursorIntegration.isIntegrationEnabled());
        });
        test('Should initialize with custom options', () => {
            const customOptions = {
                primaryStrategy: CursorIntegration_1.CursorIntegrationStrategy.FOCUS_CHAT,
                autoFocusChat: false,
                prefixText: 'Voice input: ',
                useMarkdownFormat: true
            };
            cursorIntegration = new CursorIntegration_1.CursorIntegration(customOptions);
            const options = cursorIntegration.getOptions();
            assert.strictEqual(options.primaryStrategy, CursorIntegration_1.CursorIntegrationStrategy.FOCUS_CHAT);
            assert.strictEqual(options.autoFocusChat, false);
            assert.strictEqual(options.prefixText, 'Voice input: ');
            assert.strictEqual(options.useMarkdownFormat, true);
        });
        test('Should handle initialization errors gracefully', () => {
            // Мокируем ошибку в vscode.env
            const originalEnv = mockVSCode.env;
            mockVSCode.env = {
                get appName() {
                    throw new Error('Test initialization error');
                }
            };
            cursorIntegration = new CursorIntegration_1.CursorIntegration();
            // Должен не падать и отключить интеграцию
            assert.ok(!cursorIntegration.isIntegrationEnabled());
            // Восстанавливаем env
            mockVSCode.env = originalEnv;
        });
    });
    suite('Integration Availability', () => {
        test('Should detect Cursor by app name', () => {
            mockVSCode.env.appName = 'Cursor - Code Editor';
            mockVSCode.env.uriScheme = 'vscode';
            cursorIntegration = new CursorIntegration_1.CursorIntegration();
            assert.ok(cursorIntegration.isIntegrationEnabled());
        });
        test('Should detect Cursor by URI scheme', () => {
            mockVSCode.env.appName = 'Unknown Editor';
            mockVSCode.env.uriScheme = 'cursor';
            cursorIntegration = new CursorIntegration_1.CursorIntegration();
            assert.ok(cursorIntegration.isIntegrationEnabled());
        });
        test('Should disable integration for unknown IDE', () => {
            mockVSCode.env.appName = 'Unknown Editor';
            mockVSCode.env.uriScheme = 'unknown';
            cursorIntegration = new CursorIntegration_1.CursorIntegration();
            assert.ok(!cursorIntegration.isIntegrationEnabled());
        });
    });
    suite('Send to Chat - Integration Disabled', () => {
        setup(() => {
            // Настраиваем VS Code (интеграция отключена)
            mockVSCode.env.appName = 'Visual Studio Code';
            mockVSCode.env.uriScheme = 'vscode';
            cursorIntegration = new CursorIntegration_1.CursorIntegration(undefined, eventHandlers);
        });
        test('Should return error when integration disabled', async () => {
            const result = await cursorIntegration.sendToChat('test message');
            assert.ok(!result.success);
            assert.strictEqual(result.error, 'Cursor integration not available in this IDE');
        });
        test('Should return error for empty text', async () => {
            // Временно включаем интеграцию
            mockVSCode.env.appName = 'Cursor';
            const tempIntegration = new CursorIntegration_1.CursorIntegration();
            const result = await tempIntegration.sendToChat('');
            assert.ok(!result.success);
            assert.strictEqual(result.error, 'No text provided');
        });
    });
    suite('Send to Chat - Integration Enabled', () => {
        setup(() => {
            // Настраиваем Cursor IDE (интеграция включена)
            mockVSCode.env.appName = 'Cursor';
            mockVSCode.env.uriScheme = 'cursor';
            cursorIntegration = new CursorIntegration_1.CursorIntegration(undefined, eventHandlers);
        });
        test('Should use clipboard strategy successfully', async () => {
            const testText = 'test message for cursor chat';
            const result = await cursorIntegration.sendToChat(testText);
            assert.ok(result.success);
            assert.strictEqual(result.strategy, CursorIntegration_1.CursorIntegrationStrategy.CLIPBOARD);
            assert.ok(mockVSCode.env.clipboard.writeText.calledWith(testText));
            assert.ok(mockVSCode.window.showInformationMessage.called);
            // Проверяем событие
            assert.ok(eventHandlers.onChatSent?.calledWith(testText, CursorIntegration_1.CursorIntegrationStrategy.CLIPBOARD));
        });
        test('Should fall back to secondary strategy when primary fails', async () => {
            // Настраиваем clipboard стратегию на провал
            mockVSCode.env.clipboard.writeText.rejects(new Error('Clipboard access denied'));
            // Настраиваем command palette стратегию на успех
            mockVSCode.commands.executeCommand.resolves();
            const testText = 'test fallback message';
            const result = await cursorIntegration.sendToChat(testText);
            assert.ok(result.success);
            assert.strictEqual(result.strategy, CursorIntegration_1.CursorIntegrationStrategy.COMMAND_PALETTE);
            assert.ok(result.fallbackUsed);
            // Проверяем события
            assert.ok(eventHandlers.onError?.called);
            assert.ok(eventHandlers.onFallbackUsed?.calledWith(CursorIntegration_1.CursorIntegrationStrategy.CLIPBOARD, CursorIntegration_1.CursorIntegrationStrategy.COMMAND_PALETTE));
        });
        test('Should fail when all strategies fail', async () => {
            // Настраиваем все стратегии на провал
            mockVSCode.env.clipboard.writeText.rejects(new Error('Clipboard failed'));
            mockVSCode.commands.executeCommand.rejects(new Error('Command failed'));
            const testText = 'test fail message';
            const result = await cursorIntegration.sendToChat(testText);
            assert.ok(!result.success);
            assert.strictEqual(result.error, 'All integration strategies failed');
            // Проверяем что были попытки и ошибки зарегистрированы
            assert.ok(eventHandlers.onError?.called);
        });
    });
    suite('Strategy Execution', () => {
        setup(() => {
            mockVSCode.env.appName = 'Cursor';
            cursorIntegration = new CursorIntegration_1.CursorIntegration();
        });
        test('Should execute clipboard strategy correctly', async () => {
            const options = {
                primaryStrategy: CursorIntegration_1.CursorIntegrationStrategy.CLIPBOARD,
                autoFocusChat: false // Упрощаем тест
            };
            cursorIntegration = new CursorIntegration_1.CursorIntegration(options);
            const result = await cursorIntegration.sendToChat('clipboard test');
            assert.ok(result.success);
            assert.strictEqual(result.strategy, CursorIntegration_1.CursorIntegrationStrategy.CLIPBOARD);
            assert.ok(mockVSCode.env.clipboard.writeText.called);
        });
        test('Should execute command palette strategy', async () => {
            const options = {
                primaryStrategy: CursorIntegration_1.CursorIntegrationStrategy.COMMAND_PALETTE
            };
            cursorIntegration = new CursorIntegration_1.CursorIntegration(options);
            // Мокируем успешную команду
            mockVSCode.commands.executeCommand.onFirstCall().resolves();
            const result = await cursorIntegration.sendToChat('command palette test');
            assert.ok(result.success);
            assert.strictEqual(result.strategy, CursorIntegration_1.CursorIntegrationStrategy.COMMAND_PALETTE);
            assert.ok(mockVSCode.commands.executeCommand.called);
        });
        test('Should execute focus chat strategy', async () => {
            const options = {
                primaryStrategy: CursorIntegration_1.CursorIntegrationStrategy.FOCUS_CHAT
            };
            cursorIntegration = new CursorIntegration_1.CursorIntegration(options);
            // Мокируем успешные команды фокусировки
            mockVSCode.commands.executeCommand.resolves();
            const result = await cursorIntegration.sendToChat('focus chat test');
            assert.ok(result.success);
            assert.strictEqual(result.strategy, CursorIntegration_1.CursorIntegrationStrategy.FOCUS_CHAT);
            assert.ok(mockVSCode.env.clipboard.writeText.called);
            assert.ok(mockVSCode.commands.executeCommand.called);
        });
        test('Should execute send to chat strategy with fallback', async () => {
            const options = {
                primaryStrategy: CursorIntegration_1.CursorIntegrationStrategy.SEND_TO_CHAT
            };
            cursorIntegration = new CursorIntegration_1.CursorIntegration(options);
            // Мокируем отсутствие прямых команд отправки (fallback to clipboard)
            mockVSCode.commands.executeCommand.rejects(new Error('Command not found'));
            const result = await cursorIntegration.sendToChat('send to chat test');
            assert.ok(result.success);
            assert.strictEqual(result.strategy, CursorIntegration_1.CursorIntegrationStrategy.SEND_TO_CHAT);
            assert.ok(mockVSCode.env.clipboard.writeText.called);
        });
    });
    suite('Text Formatting', () => {
        setup(() => {
            mockVSCode.env.appName = 'Cursor';
        });
        test('Should format text with prefix and suffix', async () => {
            const options = {
                prefixText: 'Voice input: ',
                suffixText: ' (transcribed)',
                primaryStrategy: CursorIntegration_1.CursorIntegrationStrategy.CLIPBOARD
            };
            cursorIntegration = new CursorIntegration_1.CursorIntegration(options);
            await cursorIntegration.sendToChat('test message');
            assert.ok(mockVSCode.env.clipboard.writeText.calledWith('Voice input: test message (transcribed)'));
        });
        test('Should format code as markdown code block', async () => {
            const options = {
                useMarkdownFormat: true,
                primaryStrategy: CursorIntegration_1.CursorIntegrationStrategy.CLIPBOARD
            };
            cursorIntegration = new CursorIntegration_1.CursorIntegration(options);
            const codeText = 'function test() { return true; }';
            await cursorIntegration.sendToChat(codeText);
            const expectedFormatted = '```\n' + codeText + '\n```';
            assert.ok(mockVSCode.env.clipboard.writeText.calledWith(expectedFormatted));
        });
        test('Should format regular text as quote', async () => {
            const options = {
                useMarkdownFormat: true,
                primaryStrategy: CursorIntegration_1.CursorIntegrationStrategy.CLIPBOARD
            };
            cursorIntegration = new CursorIntegration_1.CursorIntegration(options);
            const regularText = 'This is just regular text';
            await cursorIntegration.sendToChat(regularText);
            const expectedFormatted = '> ' + regularText;
            assert.ok(mockVSCode.env.clipboard.writeText.calledWith(expectedFormatted));
        });
        test('Should handle multiline text in markdown format', async () => {
            const options = {
                useMarkdownFormat: true,
                primaryStrategy: CursorIntegration_1.CursorIntegrationStrategy.CLIPBOARD
            };
            cursorIntegration = new CursorIntegration_1.CursorIntegration(options);
            const multilineText = 'Line 1\nLine 2\nLine 3';
            await cursorIntegration.sendToChat(multilineText);
            const expectedFormatted = '> Line 1\n> Line 2\n> Line 3';
            assert.ok(mockVSCode.env.clipboard.writeText.calledWith(expectedFormatted));
        });
    });
    suite('Code Detection', () => {
        setup(() => {
            mockVSCode.env.appName = 'Cursor';
            const options = {
                useMarkdownFormat: true,
                primaryStrategy: CursorIntegration_1.CursorIntegrationStrategy.CLIPBOARD
            };
            cursorIntegration = new CursorIntegration_1.CursorIntegration(options);
        });
        test('Should detect JavaScript function as code', async () => {
            const jsCode = 'function test() { console.log("hello"); }';
            await cursorIntegration.sendToChat(jsCode);
            const expectedFormatted = '```\n' + jsCode + '\n```';
            assert.ok(mockVSCode.env.clipboard.writeText.calledWith(expectedFormatted));
        });
        test('Should detect class definition as code', async () => {
            const classCode = 'class MyClass { constructor() {} }';
            await cursorIntegration.sendToChat(classCode);
            const expectedFormatted = '```\n' + classCode + '\n```';
            assert.ok(mockVSCode.env.clipboard.writeText.calledWith(expectedFormatted));
        });
        test('Should detect variable declarations as code', async () => {
            const varCode = 'const myVar = "hello world";';
            await cursorIntegration.sendToChat(varCode);
            const expectedFormatted = '```\n' + varCode + '\n```';
            assert.ok(mockVSCode.env.clipboard.writeText.calledWith(expectedFormatted));
        });
        test('Should not detect regular text as code', async () => {
            const regularText = 'This is just a normal sentence about programming.';
            await cursorIntegration.sendToChat(regularText);
            const expectedFormatted = '> ' + regularText;
            assert.ok(mockVSCode.env.clipboard.writeText.calledWith(expectedFormatted));
        });
    });
    suite('Configuration Management', () => {
        test('Should update options correctly', () => {
            cursorIntegration = new CursorIntegration_1.CursorIntegration();
            const newOptions = {
                autoFocusChat: false,
                prefixText: 'Updated: ',
                timeout: 10000
            };
            cursorIntegration.updateOptions(newOptions);
            const options = cursorIntegration.getOptions();
            assert.strictEqual(options.autoFocusChat, false);
            assert.strictEqual(options.prefixText, 'Updated: ');
            assert.strictEqual(options.timeout, 10000);
            // Проверяем что другие опции остались без изменений
            assert.strictEqual(options.primaryStrategy, CursorIntegration_1.CursorIntegrationStrategy.CLIPBOARD);
        });
        test('Should preserve existing options when updating', () => {
            const initialOptions = {
                primaryStrategy: CursorIntegration_1.CursorIntegrationStrategy.FOCUS_CHAT,
                prefixText: 'Initial: '
            };
            cursorIntegration = new CursorIntegration_1.CursorIntegration(initialOptions);
            cursorIntegration.updateOptions({ autoFocusChat: false });
            const options = cursorIntegration.getOptions();
            assert.strictEqual(options.primaryStrategy, CursorIntegration_1.CursorIntegrationStrategy.FOCUS_CHAT);
            assert.strictEqual(options.prefixText, 'Initial: ');
            assert.strictEqual(options.autoFocusChat, false);
        });
    });
    suite('Static Methods', () => {
        test('Should return all available strategies', () => {
            const strategies = CursorIntegration_1.CursorIntegration.getAvailableStrategies();
            assert.strictEqual(strategies.length, 4);
            assert.ok(strategies.includes(CursorIntegration_1.CursorIntegrationStrategy.CLIPBOARD));
            assert.ok(strategies.includes(CursorIntegration_1.CursorIntegrationStrategy.COMMAND_PALETTE));
            assert.ok(strategies.includes(CursorIntegration_1.CursorIntegrationStrategy.FOCUS_CHAT));
            assert.ok(strategies.includes(CursorIntegration_1.CursorIntegrationStrategy.SEND_TO_CHAT));
        });
        test('Should return strategy descriptions', () => {
            const clipboardDesc = CursorIntegration_1.CursorIntegration.getStrategyDescription(CursorIntegration_1.CursorIntegrationStrategy.CLIPBOARD);
            const commandDesc = CursorIntegration_1.CursorIntegration.getStrategyDescription(CursorIntegration_1.CursorIntegrationStrategy.COMMAND_PALETTE);
            const focusDesc = CursorIntegration_1.CursorIntegration.getStrategyDescription(CursorIntegration_1.CursorIntegrationStrategy.FOCUS_CHAT);
            const sendDesc = CursorIntegration_1.CursorIntegration.getStrategyDescription(CursorIntegration_1.CursorIntegrationStrategy.SEND_TO_CHAT);
            assert.ok(clipboardDesc.includes('clipboard'));
            assert.ok(commandDesc.includes('command palette'));
            assert.ok(focusDesc.includes('focus'));
            assert.ok(sendDesc.includes('send'));
        });
        test('Should handle unknown strategy description', () => {
            const unknownDesc = CursorIntegration_1.CursorIntegration.getStrategyDescription('unknown');
            assert.strictEqual(unknownDesc, 'Unknown strategy');
        });
    });
    suite('Error Handling', () => {
        setup(() => {
            mockVSCode.env.appName = 'Cursor';
            cursorIntegration = new CursorIntegration_1.CursorIntegration(undefined, eventHandlers);
        });
        test('Should handle clipboard write errors', async () => {
            const clipboardError = new Error('Clipboard access denied');
            mockVSCode.env.clipboard.writeText.rejects(clipboardError);
            mockVSCode.commands.executeCommand.resolves(); // Fallback успешен
            const result = await cursorIntegration.sendToChat('test error handling');
            // Должен использовать fallback
            assert.ok(result.success);
            assert.ok(result.fallbackUsed);
            // Проверяем что ошибка была зарегистрирована
            assert.ok(eventHandlers.onError?.calledWith(clipboardError, CursorIntegration_1.CursorIntegrationStrategy.CLIPBOARD));
        });
        test('Should handle command execution errors', async () => {
            const commandError = new Error('Command not found');
            mockVSCode.commands.executeCommand.rejects(commandError);
            const options = {
                primaryStrategy: CursorIntegration_1.CursorIntegrationStrategy.COMMAND_PALETTE,
                fallbackStrategies: [] // Без fallback для тестирования
            };
            const integration = new CursorIntegration_1.CursorIntegration(options, eventHandlers);
            const result = await integration.sendToChat('test command error');
            assert.ok(!result.success);
            assert.ok(eventHandlers.onError?.calledWith(commandError, CursorIntegration_1.CursorIntegrationStrategy.COMMAND_PALETTE));
        });
    });
});
//# sourceMappingURL=CursorIntegration.test.js.map