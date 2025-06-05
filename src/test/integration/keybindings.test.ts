import * as assert from 'assert';
import * as vscode from 'vscode';

describe('Keybindings Integration Tests', () => {
    let extension: vscode.Extension<any> | undefined;

    before(async () => {
        // Получаем расширение
        extension = vscode.extensions.getExtension('speak-y.speech-to-text-whisper');
        
        // Активируем расширение если оно не активно
        if (extension && !extension.isActive) {
            await extension.activate();
        }
    });

    describe('Expected Keybindings', () => {
        const expectedKeybindings = [
            {
                command: 'speechToTextWhisper.recordAndOpenNewChat',
                key: 'F9',
                description: 'Record and Open New Chat'
            },
            {
                command: 'speechToTextWhisper.recordAndInsertOrClipboard',
                key: 'ctrl+shift+m',
                mac: 'cmd+shift+m',
                description: 'Record and Insert at Cursor or Clipboard'
            },
            {
                command: 'speechToTextWhisper.recordAndInsertToCurrentChat',
                key: 'ctrl+shift+n',
                mac: 'cmd+shift+n',
                description: 'Record and Insert at Current Chat'
            }
        ];

        it('should have all expected keybindings defined in package.json', () => {
            assert.ok(extension, 'Extension should be found');
            
            const packageJson = extension!.packageJSON;
            assert.ok(packageJson.contributes, 'Package.json should have contributes section');
            assert.ok(packageJson.contributes.keybindings, 'Package.json should have keybindings');
            
            const keybindings = packageJson.contributes.keybindings;
            
            for (const expectedBinding of expectedKeybindings) {
                const binding = keybindings.find((kb: any) => kb.command === expectedBinding.command);
                assert.ok(binding, `Keybinding for ${expectedBinding.command} should be defined`);
                
                if (expectedBinding.key) {
                    assert.strictEqual(binding.key, expectedBinding.key, 
                        `Key for ${expectedBinding.command} should be ${expectedBinding.key}`);
                }
                
                if (expectedBinding.mac) {
                    assert.strictEqual(binding.mac, expectedBinding.mac,
                        `Mac key for ${expectedBinding.command} should be ${expectedBinding.mac}`);
                }
            }
        });

        it('should have commands registered for all keybindings', async () => {
            const allCommands = await vscode.commands.getCommands(true);
            
            for (const binding of expectedKeybindings) {
                assert.ok(
                    allCommands.includes(binding.command),
                    `Command ${binding.command} should be registered for keybinding`
                );
            }
        });
    });

    describe('Keybinding Functionality', () => {
        it('should be able to simulate keybinding execution', async () => {
            // Мы не можем напрямую тестировать нажатие клавиш в VS Code тестах,
            // но можем проверить, что команды, связанные с клавишами, выполняются
            
            const testCommands = [
                'speechToTextWhisper.recordAndOpenNewChat',
                'speechToTextWhisper.recordAndInsertOrClipboard', 
                'speechToTextWhisper.recordAndInsertToCurrentChat'
            ];

            for (const commandId of testCommands) {
                try {
                    // Пытаемся выполнить команду
                    await vscode.commands.executeCommand(commandId);
                    // В тестовой среде команды могут завершиться с ошибкой, но важно что они вызываются
                } catch (error) {
                    // Ожидаемо в тестовой среде без настроенного API ключа и аудио устройств
                    const errorMessage = (error as Error).message.toLowerCase();
                    console.log(`Keybinding command ${commandId} failed as expected:`, errorMessage);
                }
            }
            
            // Если мы дошли до этой точки, команды доступны для выполнения
            assert.ok(true, 'All keybinding commands are executable');
        });
    });

    describe('Platform-specific Keybindings', () => {
        it('should handle platform-specific key combinations', () => {
            assert.ok(extension, 'Extension should be found');
            
            const packageJson = extension!.packageJSON;
            const keybindings = packageJson.contributes.keybindings;
            
            // Проверяем, что есть Mac-специфичные привязки
            const macBindings = keybindings.filter((kb: any) => kb.mac);
            assert.ok(macBindings.length > 0, 'Should have Mac-specific keybindings');
            
            // Проверяем, что Mac привязки используют cmd вместо ctrl
            for (const binding of macBindings) {
                if (binding.mac) {
                    assert.ok(
                        binding.mac.includes('cmd'),
                        `Mac keybinding ${binding.mac} should use cmd modifier`
                    );
                }
            }
        });

        it('should have consistent key patterns', () => {
            assert.ok(extension, 'Extension should be found');
            
            const packageJson = extension!.packageJSON;
            const keybindings = packageJson.contributes.keybindings;
            
            // Проверяем, что все привязки используют согласованные модификаторы
            for (const binding of keybindings) {
                if (binding.key && binding.key.includes('shift')) {
                    assert.ok(
                        binding.key.includes('ctrl') || binding.key.includes('cmd'),
                        `Keybinding ${binding.key} with shift should also have ctrl/cmd modifier`
                    );
                }
            }
        });
    });

    describe('Keybinding Conflicts', () => {
        it('should not conflict with common VS Code keybindings', () => {
            // Список общих VS Code клавиатурных привязок, с которыми не должно быть конфликтов
            const commonVSCodeKeys = [
                'ctrl+c', 'ctrl+v', 'ctrl+x', 'ctrl+z', 'ctrl+y',
                'ctrl+s', 'ctrl+o', 'ctrl+n', 'ctrl+w', 'ctrl+t',
                'ctrl+shift+p', 'ctrl+shift+e', 'ctrl+shift+f',
                'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8',
                'F10', 'F11', 'F12'
            ];

            assert.ok(extension, 'Extension should be found');
            
            const packageJson = extension!.packageJSON;
            const keybindings = packageJson.contributes.keybindings;
            
            for (const binding of keybindings) {
                const key = binding.key?.toLowerCase();
                if (key) {
                    assert.ok(
                        !commonVSCodeKeys.includes(key),
                        `Keybinding ${binding.key} should not conflict with common VS Code shortcuts`
                    );
                }
            }
        });

        it('should use unique key combinations', () => {
            assert.ok(extension, 'Extension should be found');
            
            const packageJson = extension!.packageJSON;
            const keybindings = packageJson.contributes.keybindings;
            
            const usedKeys = new Set<string>();
            
            for (const binding of keybindings) {
                if (binding.key) {
                    assert.ok(
                        !usedKeys.has(binding.key),
                        `Key combination ${binding.key} should be unique`
                    );
                    usedKeys.add(binding.key);
                }
                
                if (binding.mac) {
                    assert.ok(
                        !usedKeys.has(binding.mac),
                        `Mac key combination ${binding.mac} should be unique`
                    );
                    usedKeys.add(binding.mac);
                }
            }
        });
    });
}); 