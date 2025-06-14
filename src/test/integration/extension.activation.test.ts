import * as assert from 'assert';
import * as vscode from 'vscode';

describe('Extension Activation Tests', () => {
    let extension: vscode.Extension<any> | undefined;

    before(async () => {
        // Get the extension
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
            this.timeout(10000); // Increase timeout for activation
            
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
            
            // Check for key activation events
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
            
            // Check for key settings
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
            
            // Check that the extension activated without errors
            // Exports can be undefined, which is normal for many extensions
            const exports = extension!.exports;
            
            // If there are exports, they should be an object
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
            
            // Check that the VS Code version meets the requirements
            const requiredVersion = packageJson.engines.vscode;
            assert.ok(requiredVersion.startsWith('^'), 'VS Code version should use caret range');
        });

        it('should not have conflicting extension dependencies', () => {
            assert.ok(extension, 'Extension should be found');
            
            const packageJson = extension!.packageJSON;
            
            // If there are dependencies on other extensions, check them
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
            // This test checks that the extension activates without critical errors
            assert.ok(extension, 'Extension should be found');
            
            if (!extension!.isActive) {
                await extension!.activate();
            }
            
            // If we reached this point without exceptions, activation was successful
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