"use strict";
// setup.ts - Глобальная настройка тестовой среды
Object.defineProperty(exports, "__esModule", { value: true });
const vscodeMocks_1 = require("./mocks/vscodeMocks");
// Регистрируем мок для модуля vscode
const Module = require('module');
const originalRequire = Module.prototype.require;
Module.prototype.require = function (id) {
    if (id === 'vscode') {
        return vscodeMocks_1.mockVscode;
    }
    return originalRequire.apply(this, arguments);
};
// Настройка глобальных объектов для Web API
global.console.log = () => { }; // Подавляем лишние логи в тестах
global.console.warn = () => { };
global.console.error = () => { };
//# sourceMappingURL=setup.js.map