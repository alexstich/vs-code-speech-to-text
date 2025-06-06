// setup.ts - Global test environment setup

import { mockVscode } from './mocks/vscodeMocks';

// Register mock for vscode module
const Module = require('module');
const originalRequire = Module.prototype.require;

Module.prototype.require = function (id: string) {
    if (id === 'vscode') {
        return mockVscode;
    }
    return originalRequire.apply(this, arguments);
};

// Configure global objects for Web API
global.console.log = () => {}; // Suppress unnecessary logs in tests
global.console.warn = () => {};
global.console.error = () => {}; 