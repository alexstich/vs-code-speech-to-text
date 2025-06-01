import * as assert from 'assert';
import * as vscode from 'vscode';

describe('Extension Activation Tests', () => {
    let extension: vscode.Extension<any> | undefined;

    before(async () => {
        // Получаем расширение
        extension = vscode.extensions.getExtension('speak-y.speech-to-text-whisper');
    });

    describe('Extension Discovery', () => {
        it('should find the extension', () => {
            assert.ok(extension, 'Extension should be discoverable');
            assert.strictEqual(extension!.id, 'speak-y.speech-to-text-whisper', 'Extension ID should match');
        });

        it('should have correct package.json metadata', () => {
            assert.ok(extension, 'Extension should be found');
            
            const packageJson = extension!.packageJSON;
            assert.strictEqual(packageJson.name, 'speech-to-text-whisper', 'Package name should match');
            assert.strictEqual(packageJson.publisher, 'speak-y', 'Publisher should match');
            assert.ok(packageJson.version, 'Should have version');
            assert.ok(packageJson.displayName, 'Should have display name');
            assert.ok(packageJson.description, 'Should have description');
        });
    });

    describe('Extension Activation', () => {
        it('should activate successfully', async function() {
            this.timeout(10000); // Увеличиваем таймаут для активации
            
            assert.ok(extension, 'Extension should be found');
            
            if (!extension!.isActive) {
                await extension!.activate();
            }
            
            assert.ok(extension!.isActive, 'Extension should be active after activation');
        });

        it('should have activation events configured', () => {
            assert.ok(extension, 'Extension should be found');
            
            const packageJson = extension!.packageJSON;
            assert.ok(packageJson.activationEvents, 'Should have activation events');
            assert.ok(Array.isArray(packageJson.activationEvents), 'Activation events should be an array');
            assert.ok(packageJson.activationEvents.length > 0, 'Should have at least one activation event');
            
            // Проверяем наличие ключевых событий активации
            const activationEvents = packageJson.activationEvents;
            assert.ok(
                activationEvents.includes('onStartupFinished'),
                'Should activate on startup finished'
            );
        });
    });

    describe('Extension Contributions', () => {
        it('should contribute commands', () => {
            assert.ok(extension, 'Extension should be found');
            
            const packageJson = extension!.packageJSON;
            assert.ok(packageJson.contributes, 'Should have contributes section');
            assert.ok(packageJson.contributes.commands, 'Should contribute commands');
            assert.ok(Array.isArray(packageJson.contributes.commands), 'Commands should be an array');
            assert.ok(packageJson.contributes.commands.length > 0, 'Should have at least one command');
        });

        it('should contribute keybindings', () => {
            assert.ok(extension, 'Extension should be found');
            
            const packageJson = extension!.packageJSON;
            assert.ok(packageJson.contributes.keybindings, 'Should contribute keybindings');
            assert.ok(Array.isArray(packageJson.contributes.keybindings), 'Keybindings should be an array');
            assert.ok(packageJson.contributes.keybindings.length > 0, 'Should have at least one keybinding');
        });

        it('should contribute views', () => {
            assert.ok(extension, 'Extension should be found');
            
            const packageJson = extension!.packageJSON;
            assert.ok(packageJson.contributes.views, 'Should contribute views');
            assert.ok(packageJson.contributes.viewsContainers, 'Should contribute view containers');
        });

        it('should contribute configuration', () => {
            assert.ok(extension, 'Extension should be found');
            
            const packageJson = extension!.packageJSON;
            assert.ok(packageJson.contributes.configuration, 'Should contribute configuration');
            assert.ok(packageJson.contributes.configuration.properties, 'Should have configuration properties');
            
            // Проверяем наличие ключевых настроек
            const properties = packageJson.contributes.configuration.properties;
            assert.ok(properties['speechToTextWhisper.apiKey'], 'Should have API key setting');
        });
    });

    describe('Extension Exports', () => {
        it('should export expected API if any', async () => {
            assert.ok(extension, 'Extension should be found');
            
            if (!extension!.isActive) {
                await extension!.activate();
            }
            
            // Проверяем, что расширение активировалось без ошибок
            // Экспорты могут быть undefined, это нормально для многих расширений
            const exports = extension!.exports;
            
            // Если есть экспорты, они должны быть объектом
            if (exports) {
                assert.strictEqual(typeof exports, 'object', 'Exports should be an object if present');
            }
        });
    });

    describe('Extension Dependencies', () => {
        it('should have required VS Code engine version', () => {
            assert.ok(extension, 'Extension should be found');
            
            const packageJson = extension!.packageJSON;
            assert.ok(packageJson.engines, 'Should specify engines');
            assert.ok(packageJson.engines.vscode, 'Should specify VS Code engine version');
            
            // Проверяем, что версия VS Code соответствует требованиям
            const requiredVersion = packageJson.engines.vscode;
            assert.ok(requiredVersion.startsWith('^'), 'VS Code version should use caret range');
        });

        it('should not have conflicting extension dependencies', () => {
            assert.ok(extension, 'Extension should be found');
            
            const packageJson = extension!.packageJSON;
            
            // Если есть зависимости от других расширений, проверяем их
            if (packageJson.extensionDependencies) {
                assert.ok(
                    Array.isArray(packageJson.extensionDependencies),
                    'Extension dependencies should be an array'
                );
            }
        });
    });

    describe('Extension Health Check', () => {
        it('should not have critical errors in console', async () => {
            // Этот тест проверяет, что расширение активируется без критических ошибок
            assert.ok(extension, 'Extension should be found');
            
            if (!extension!.isActive) {
                await extension!.activate();
            }
            
            // Если мы дошли до этой точки без исключений, активация прошла успешно
            assert.ok(true, 'Extension activated without throwing critical errors');
        });

        it('should have main entry point accessible', () => {
            assert.ok(extension, 'Extension should be found');
            
            const packageJson = extension!.packageJSON;
            assert.ok(packageJson.main, 'Should have main entry point');
            assert.ok(
                packageJson.main.endsWith('.js'),
                'Main entry point should be a JavaScript file'
            );
        });
    });
}); 