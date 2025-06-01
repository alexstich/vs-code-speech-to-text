import * as assert from 'assert';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';
// import * as myExtension from '../../extension';

// Простой тест для проверки работы тестовой среды
describe('Extension Test Suite', () => {
	vscode.window.showInformationMessage('Start all tests.');

	it('Sample test', () => {
		assert.strictEqual(-1, [1, 2, 3].indexOf(5));
		assert.strictEqual(-1, [1, 2, 3].indexOf(0));
	});

	it('Extension should be present', () => {
		assert.ok(vscode.extensions.getExtension('speak-y.speech-to-text-whisper'));
	});
});
