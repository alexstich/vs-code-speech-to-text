import { defineConfig } from '@vscode/test-cli';

export default defineConfig({
	files: 'out/test/**/*.test.js',
	extensionDevelopmentPath: '.',
	extensionTestsPath: './out/test/index.js',
	mocha: {
		ui: 'bdd',
		timeout: 10000,
		reporter: 'spec'
	}
});
