import * as assert from 'assert';
import * as sinon from 'sinon';

// Теперь импортируем модуль
import {
    CursorIntegration,
    CursorIntegrationStrategy,
    CursorIntegrationOptions,
    CursorIntegrationEvents,
    CursorIntegrationResult,
    VSCodeEnvironment
} from '../../integrations/CursorIntegration';

suite('CursorIntegration Tests', () => {
    let cursorIntegration: CursorIntegration | null;
    let eventHandlers: CursorIntegrationEvents;
    let originalSetTimeout: typeof setTimeout;
    let mockEnvironment: VSCodeEnvironment;

    setup(() => {
        // Сохраняем оригинальный setTimeout
        originalSetTimeout = global.setTimeout;
        
        // Мокируем setTimeout для тестов
        (global as any).setTimeout = sinon.stub().callsFake((fn: Function, delay: number) => {
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

        // Создаём свежий mock environment для каждого теста
        // Используем объект с изменяемыми свойствами
        const mockEnvData = {
            appName: 'Visual Studio Code',
            uriScheme: 'vscode'
        };

        mockEnvironment = {
            env: {
                get appName(): string {
                    return mockEnvData.appName;
                },
                set appName(value: string) {
                    mockEnvData.appName = value;
                },
                get uriScheme(): string {
                    return mockEnvData.uriScheme;
                },
                set uriScheme(value: string) {
                    mockEnvData.uriScheme = value;
                },
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
            // Настраиваем environment для VS Code
            mockEnvironment.env.appName = 'Visual Studio Code';
            mockEnvironment.env.uriScheme = 'vscode';
            
            cursorIntegration = new CursorIntegration(undefined, undefined, mockEnvironment);
            
            assert.ok(!cursorIntegration.isIntegrationEnabled());
            
            const options = cursorIntegration.getOptions();
            assert.strictEqual(options.primaryStrategy, CursorIntegrationStrategy.CLIPBOARD);
            assert.strictEqual(options.autoFocusChat, true);
        });

        test('Should enable integration in Cursor IDE', () => {
            // Настраиваем environment для Cursor
            mockEnvironment.env.appName = 'Cursor';
            mockEnvironment.env.uriScheme = 'cursor';
            
            cursorIntegration = new CursorIntegration(undefined, undefined, mockEnvironment);
            
            assert.ok(cursorIntegration.isIntegrationEnabled());
        });

        test('Should initialize with custom options', () => {
            const customOptions = {
                primaryStrategy: CursorIntegrationStrategy.FOCUS_CHAT,
                autoFocusChat: false,
                prefixText: 'Voice input: ',
                useMarkdownFormat: true
            };

            cursorIntegration = new CursorIntegration(customOptions, undefined, mockEnvironment);
            
            const options = cursorIntegration.getOptions();
            assert.strictEqual(options.primaryStrategy, CursorIntegrationStrategy.FOCUS_CHAT);
            assert.strictEqual(options.autoFocusChat, false);
            assert.strictEqual(options.prefixText, 'Voice input: ');
            assert.strictEqual(options.useMarkdownFormat, true);
        });

        test('Should handle initialization errors gracefully', () => {
            // Мокируем ошибку в environment - используем специальную функцию
            const errorEnvironment: VSCodeEnvironment = {
                ...mockEnvironment,
                env: {
                    ...mockEnvironment.env,
                    get appName(): string {
                        throw new Error('Test initialization error');
                    }
                }
            };

            cursorIntegration = new CursorIntegration(undefined, undefined, errorEnvironment);
            
            // Должен не падать и отключить интеграцию
            assert.ok(!cursorIntegration.isIntegrationEnabled());
        });
    });

    suite('Integration Availability', () => {
        test('Should detect Cursor by app name', () => {
            // Настраиваем environment для Cursor
            mockEnvironment.env.appName = 'Cursor - Code Editor';
            mockEnvironment.env.uriScheme = 'vscode';
            
            cursorIntegration = new CursorIntegration(undefined, undefined, mockEnvironment);
            
            assert.ok(cursorIntegration.isIntegrationEnabled());
        });

        test('Should detect Cursor by URI scheme', () => {
            // Настраиваем environment для Cursor
            mockEnvironment.env.appName = 'Unknown Editor';
            mockEnvironment.env.uriScheme = 'cursor';
            
            cursorIntegration = new CursorIntegration(undefined, undefined, mockEnvironment);
            
            assert.ok(cursorIntegration.isIntegrationEnabled());
        });

        test('Should disable integration for unknown IDE', () => {
            // Настраиваем environment для неизвестного IDE
            mockEnvironment.env.appName = 'Unknown Editor';
            mockEnvironment.env.uriScheme = 'unknown';
            
            cursorIntegration = new CursorIntegration(undefined, undefined, mockEnvironment);
            
            assert.ok(!cursorIntegration.isIntegrationEnabled());
        });
    });

    suite('Send to Chat - Integration Disabled', () => {
        setup(() => {
            // Настраиваем VS Code (интеграция отключена)
            mockEnvironment.env.appName = 'Visual Studio Code';
            mockEnvironment.env.uriScheme = 'vscode';
            cursorIntegration = new CursorIntegration(undefined, eventHandlers, mockEnvironment);
        });

        test('Should return error when integration disabled', async () => {
            const result = await cursorIntegration!.sendToChat('test message');
            
            assert.ok(!result.success);
            assert.strictEqual(result.error, 'Cursor integration not available in this IDE');
        });
    });

    suite('Send to Chat - Integration Enabled', () => {
        setup(() => {
            // Настраиваем Cursor (интеграция включена)
            mockEnvironment.env.appName = 'Cursor';
            mockEnvironment.env.uriScheme = 'cursor';
            cursorIntegration = new CursorIntegration(undefined, eventHandlers, mockEnvironment);
        });

        test('Should return error for empty text when integration enabled', async () => {
            const result = await cursorIntegration!.sendToChat('');
            
            assert.ok(!result.success);
            assert.strictEqual(result.error, 'No text provided');
        });

        test('Should use clipboard strategy successfully', async () => {
            const result = await cursorIntegration!.sendToChat('test message');
            
            assert.ok(result.success);
            assert.strictEqual(result.strategy, CursorIntegrationStrategy.CLIPBOARD);
        });

        test('Should fall back to secondary strategy when primary fails', async () => {
            // Реализуем мок который падает только для первого вызова clipboard
            let clipboardCallCount = 0;
            (mockEnvironment.env.clipboard.writeText as sinon.SinonStub).callsFake(async (text: string) => {
                clipboardCallCount++;
                if (clipboardCallCount === 1) {
                    // Первый вызов (clipboard стратегия) - падает
                    throw new Error('Primary failed');
                } else {
                    // Последующие вызовы (fallback стратегии) - работают
                    return Promise.resolve();
                }
            });
            
            // Делаем fallback стратегию рабочей
            (mockEnvironment.commands.executeCommand as sinon.SinonStub).resolves(true);
            
            await cursorIntegration!.sendToChat('test message');
            
            assert.ok((eventHandlers.onFallbackUsed as sinon.SinonStub)?.called);
        });

        test('Should fail when all strategies fail', async () => {
            (mockEnvironment.env.clipboard.writeText as sinon.SinonStub).rejects(new Error('Clipboard error'));
            (mockEnvironment.commands.executeCommand as sinon.SinonStub).rejects(new Error('Command error'));
            
            const result = await cursorIntegration!.sendToChat('test message');
            
            assert.ok(!result.success);
            assert.strictEqual(result.error, 'All integration strategies failed');
        });
    });

    suite('Strategy Execution', () => {
        setup(() => {
            mockEnvironment.env.appName = 'Cursor';
            mockEnvironment.env.uriScheme = 'cursor';
            cursorIntegration = new CursorIntegration(undefined, eventHandlers, mockEnvironment);
        });

        test('Should execute clipboard strategy correctly', async () => {
            // Настраиваем только clipboard стратегию
            cursorIntegration!.updateOptions({
                primaryStrategy: CursorIntegrationStrategy.CLIPBOARD,
                fallbackStrategies: []
            });
            
            const result = await cursorIntegration!.sendToChat('test message');
            
            assert.ok(result.success);
            assert.strictEqual(result.strategy, CursorIntegrationStrategy.CLIPBOARD);
            assert.ok((mockEnvironment.env.clipboard.writeText as sinon.SinonStub).called);
        });

        test('Should execute command palette strategy', async () => {
            // Настраиваем только command palette стратегию
            cursorIntegration!.updateOptions({
                primaryStrategy: CursorIntegrationStrategy.COMMAND_PALETTE,
                fallbackStrategies: []
            });
            
            const result = await cursorIntegration!.sendToChat('test message');
            
            assert.ok(result.success);
            assert.strictEqual(result.strategy, CursorIntegrationStrategy.COMMAND_PALETTE);
            assert.ok((mockEnvironment.commands.executeCommand as sinon.SinonStub).called);
        });

        test('Should execute focus chat strategy', async () => {
            // Настраиваем только focus chat стратегию
            cursorIntegration!.updateOptions({
                primaryStrategy: CursorIntegrationStrategy.FOCUS_CHAT,
                fallbackStrategies: []
            });
            
            const result = await cursorIntegration!.sendToChat('test message');
            
            assert.ok(result.success);
            assert.strictEqual(result.strategy, CursorIntegrationStrategy.FOCUS_CHAT);
            assert.ok((mockEnvironment.env.clipboard.writeText as sinon.SinonStub).called);
        });

        test('Should execute send to chat strategy with fallback', async () => {
            // Настраиваем send to chat стратегию
            cursorIntegration!.updateOptions({
                primaryStrategy: CursorIntegrationStrategy.SEND_TO_CHAT,
                fallbackStrategies: []
            });
            
            const result = await cursorIntegration!.sendToChat('test message');
            
            assert.ok(result.success);
            // Send to chat should fallback to clipboard strategy
            assert.strictEqual(result.strategy, CursorIntegrationStrategy.SEND_TO_CHAT);
        });
    });

    suite('Text Formatting', () => {
        setup(() => {
            mockEnvironment.env.appName = 'Cursor';
            mockEnvironment.env.uriScheme = 'cursor';
        });

        test('Should format text with prefix and suffix', async () => {
            const options = {
                prefixText: 'Voice input: ',
                suffixText: ' (transcribed)'
            };

            cursorIntegration = new CursorIntegration(options, undefined, mockEnvironment);
            
            await cursorIntegration.sendToChat('test message');
            
            assert.ok((mockEnvironment.env.clipboard.writeText as sinon.SinonStub).calledWith('Voice input: test message (transcribed)'));
        });

        test('Should format code as markdown code block', async () => {
            const options = {
                useMarkdownFormat: true
            };

            cursorIntegration = new CursorIntegration(options, undefined, mockEnvironment);
            
            const codeText = 'function test() { return true; }';
            await cursorIntegration.sendToChat(codeText);
            
            const expectedFormatted = '```\nfunction test() { return true; }\n```';
            assert.ok((mockEnvironment.env.clipboard.writeText as sinon.SinonStub).calledWith(expectedFormatted));
        });

        test('Should format regular text as quote', async () => {
            const options = {
                useMarkdownFormat: true
            };

            cursorIntegration = new CursorIntegration(options, undefined, mockEnvironment);
            
            const regularText = 'This is a regular message';
            await cursorIntegration.sendToChat(regularText);
            
            const expectedFormatted = '> This is a regular message';
            assert.ok((mockEnvironment.env.clipboard.writeText as sinon.SinonStub).calledWith(expectedFormatted));
        });

        test('Should handle multiline text in markdown format', async () => {
            const options = {
                useMarkdownFormat: true
            };

            cursorIntegration = new CursorIntegration(options, undefined, mockEnvironment);
            
            const multilineText = 'Line 1\nLine 2\nLine 3';
            await cursorIntegration.sendToChat(multilineText);
            
            const expectedFormatted = '> Line 1\n> Line 2\n> Line 3';
            assert.ok((mockEnvironment.env.clipboard.writeText as sinon.SinonStub).calledWith(expectedFormatted));
        });
    });

    suite('Code Detection', () => {
        setup(() => {
            mockEnvironment.env.appName = 'Cursor';
            mockEnvironment.env.uriScheme = 'cursor';
            cursorIntegration = new CursorIntegration({
                useMarkdownFormat: true
            }, undefined, mockEnvironment);
        });

        test('Should detect JavaScript function as code', async () => {
            const jsCode = 'function hello() { console.log("world"); }';
            await cursorIntegration!.sendToChat(jsCode);
            
            const expectedFormatted = '```\nfunction hello() { console.log("world"); }\n```';
            assert.ok((mockEnvironment.env.clipboard.writeText as sinon.SinonStub).calledWith(expectedFormatted));
        });

        test('Should detect class definition as code', async () => {
            const classCode = 'class MyClass { constructor() {} }';
            await cursorIntegration!.sendToChat(classCode);
            
            const expectedFormatted = '```\nclass MyClass { constructor() {} }\n```';
            assert.ok((mockEnvironment.env.clipboard.writeText as sinon.SinonStub).calledWith(expectedFormatted));
        });

        test('Should detect variable declarations as code', async () => {
            const varCode = 'const myVar = "test";';
            await cursorIntegration!.sendToChat(varCode);
            
            const expectedFormatted = '```\nconst myVar = "test";\n```';
            assert.ok((mockEnvironment.env.clipboard.writeText as sinon.SinonStub).calledWith(expectedFormatted));
        });

        test('Should not detect regular text as code', async () => {
            const regularText = 'This is just a regular sentence';
            await cursorIntegration!.sendToChat(regularText);
            
            const expectedFormatted = '> This is just a regular sentence';
            assert.ok((mockEnvironment.env.clipboard.writeText as sinon.SinonStub).calledWith(expectedFormatted));
        });
    });

    suite('Event Handling', () => {
        setup(() => {
            mockEnvironment.env.appName = 'Cursor';
            mockEnvironment.env.uriScheme = 'cursor';
            cursorIntegration = new CursorIntegration(undefined, eventHandlers, mockEnvironment);
        });

        test('Should trigger onChatSent when message sent successfully', async () => {
            await cursorIntegration!.sendToChat('test message');
            
            assert.ok((eventHandlers.onChatSent as sinon.SinonStub)?.called);
            
            const callArgs = (eventHandlers.onChatSent as sinon.SinonStub).firstCall.args;
            assert.strictEqual(callArgs[0], 'test message');
            assert.strictEqual(callArgs[1], CursorIntegrationStrategy.CLIPBOARD);
        });

        test('Should trigger onFallbackUsed when primary strategy fails', async () => {
            // Реализуем мок который падает только для первого вызова clipboard
            let clipboardCallCount = 0;
            (mockEnvironment.env.clipboard.writeText as sinon.SinonStub).callsFake(async (text: string) => {
                clipboardCallCount++;
                if (clipboardCallCount === 1) {
                    // Первый вызов (clipboard стратегия) - падает
                    throw new Error('Primary failed');
                } else {
                    // Последующие вызовы (fallback стратегии) - работают
                    return Promise.resolve();
                }
            });
            
            // Делаем fallback стратегию рабочей
            (mockEnvironment.commands.executeCommand as sinon.SinonStub).resolves(true);
            
            await cursorIntegration!.sendToChat('test message');
            
            assert.ok((eventHandlers.onFallbackUsed as sinon.SinonStub)?.called);
        });

        test('Should trigger onError when strategies fail', async () => {
            // Мокируем ошибки во всех стратегиях
            (mockEnvironment.env.clipboard.writeText as sinon.SinonStub).rejects(new Error('All failed'));
            (mockEnvironment.commands.executeCommand as sinon.SinonStub).rejects(new Error('All failed'));
            
            await cursorIntegration!.sendToChat('test message');
            
            assert.ok((eventHandlers.onError as sinon.SinonStub)?.called);
        });
    });

    suite('Options Management', () => {
        test('Should update options correctly', () => {
            cursorIntegration = new CursorIntegration(undefined, undefined, mockEnvironment);
            
            const newOptions = {
                primaryStrategy: CursorIntegrationStrategy.COMMAND_PALETTE,
                useMarkdownFormat: true,
                prefixText: 'Updated: '
            };
            
            cursorIntegration.updateOptions(newOptions);
            const currentOptions = cursorIntegration.getOptions();
            
            assert.strictEqual(currentOptions.primaryStrategy, CursorIntegrationStrategy.COMMAND_PALETTE);
            assert.strictEqual(currentOptions.useMarkdownFormat, true);
            assert.strictEqual(currentOptions.prefixText, 'Updated: ');
        });

        test('Should return available strategies', () => {
            const strategies = CursorIntegration.getAvailableStrategies();
            
            assert.ok(Array.isArray(strategies));
            assert.ok(strategies.length > 0);
            assert.ok(strategies.includes(CursorIntegrationStrategy.CLIPBOARD));
        });

        test('Should return strategy descriptions', () => {
            const description = CursorIntegration.getStrategyDescription(CursorIntegrationStrategy.CLIPBOARD);
            
            assert.ok(typeof description === 'string');
            assert.ok(description.length > 0);
        });
    });

    suite('Error Handling', () => {
        setup(() => {
            mockEnvironment.env.appName = 'Cursor';
            mockEnvironment.env.uriScheme = 'cursor';
            cursorIntegration = new CursorIntegration(undefined, eventHandlers, mockEnvironment);
        });

        test('Should handle clipboard write errors', async () => {
            // Реализуем мок который падает только для первого вызова clipboard
            let clipboardCallCount = 0;
            (mockEnvironment.env.clipboard.writeText as sinon.SinonStub).callsFake(async (text: string) => {
                clipboardCallCount++;
                if (clipboardCallCount === 1) {
                    // Первый вызов (clipboard стратегия) - падает
                    throw new Error('Clipboard write failed');
                } else {
                    // Последующие вызовы (fallback стратегии) - работают
                    return Promise.resolve();
                }
            });
            
            // Делаем fallback рабочим
            (mockEnvironment.commands.executeCommand as sinon.SinonStub).resolves(true);
            
            // Should fallback to another strategy
            const result = await cursorIntegration!.sendToChat('test message');
            
            assert.ok(result.success); // Should succeed with fallback
            assert.ok((eventHandlers.onFallbackUsed as sinon.SinonStub)?.called);
        });

        test('Should handle command execution errors', async () => {
            const commandError = new Error('Command execution failed');
            (mockEnvironment.commands.executeCommand as sinon.SinonStub).rejects(commandError);
            
            // Настраиваем только command palette стратегию без fallback
            cursorIntegration!.updateOptions({
                primaryStrategy: CursorIntegrationStrategy.COMMAND_PALETTE,
                fallbackStrategies: []
            });
            
            const result = await cursorIntegration!.sendToChat('test message');
            
            assert.ok(!result.success);
            // Проверяем что onError был вызван с правильными параметрами
            const errorCalls = (eventHandlers.onError as sinon.SinonStub).getCalls();
            assert.ok(errorCalls.length > 0);
            
            // Ищем вызов с COMMAND_PALETTE стратегией
            const commandPaletteErrorCall = errorCalls.find(call => 
                call.args[1] === CursorIntegrationStrategy.COMMAND_PALETTE
            );
            assert.ok(commandPaletteErrorCall, 'onError should be called with COMMAND_PALETTE strategy');
        });

        test('Should handle unexpected errors during strategy execution', async () => {
            // Мокируем неожиданную ошибку
            const mockError = new Error('Unexpected error');
            (mockEnvironment.env.clipboard.writeText as sinon.SinonStub).throws(mockError);
            
            const result = await cursorIntegration!.sendToChat('test message');
            
            // Ошибка должна привести к fallback или полному провалу
            assert.ok((eventHandlers.onError as sinon.SinonStub)?.called);
        });
    });

    suite('Performance', () => {
        setup(() => {
            mockEnvironment.env.appName = 'Cursor';
            mockEnvironment.env.uriScheme = 'cursor';
            cursorIntegration = new CursorIntegration(undefined, eventHandlers, mockEnvironment);
        });

        test('Should execute strategies within reasonable time', async () => {
            const startTime = Date.now();
            
            await cursorIntegration!.sendToChat('test message');
            
            const endTime = Date.now();
            const executionTime = endTime - startTime;
            
            // Должно выполниться быстро (менее 100мс в тестах)
            assert.ok(executionTime < 100, `Execution took ${executionTime}ms, expected < 100ms`);
        });

        test('Should handle multiple concurrent requests', async () => {
            const promises = [
                cursorIntegration!.sendToChat('message 1'),
                cursorIntegration!.sendToChat('message 2'),
                cursorIntegration!.sendToChat('message 3')
            ];
            
            const results = await Promise.all(promises);
            
            // Все должны завершиться успешно
            results.forEach(result => {
                assert.ok(result.success);
            });
        });
    });
}); 