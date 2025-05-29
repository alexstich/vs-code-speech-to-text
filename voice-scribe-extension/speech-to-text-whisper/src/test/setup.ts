// setup.ts - Глобальная настройка тестовой среды

import { mockVscode } from './mocks/vscodeMocks';

// Регистрируем мок для модуля vscode
const Module = require('module');
const originalRequire = Module.prototype.require;

Module.prototype.require = function (id: string) {
    if (id === 'vscode') {
        return mockVscode;
    }
    return originalRequire.apply(this, arguments);
};

// Настройка глобальных объектов для Web API
global.console.log = () => {}; // Подавляем лишние логи в тестах
global.console.warn = () => {};
global.console.error = () => {}; 