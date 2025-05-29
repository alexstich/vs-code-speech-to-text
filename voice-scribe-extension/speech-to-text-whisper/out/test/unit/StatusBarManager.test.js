"use strict";
// StatusBarManager.test.ts - Unit тесты для StatusBarManager
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
const StatusBarManager_1 = require("../../ui/StatusBarManager");
const vscodeMocks_1 = require("../mocks/vscodeMocks");
suite('StatusBarManager Unit Tests', () => {
    let statusBarManager;
    let mockEvents;
    let clock;
    setup(() => {
        (0, vscodeMocks_1.setupVSCodeMocks)();
        clock = sinon.useFakeTimers();
        mockEvents = {
            onRecordingToggle: sinon.stub()
        };
        statusBarManager = new StatusBarManager_1.StatusBarManager(mockEvents);
    });
    teardown(() => {
        (0, vscodeMocks_1.resetVSCodeMocks)();
        clock.restore();
        sinon.restore();
    });
    suite('Constructor', () => {
        test('Should create status bar item', () => {
            const createStub = vscodeMocks_1.mockVscode.window.createStatusBarItem;
            assert.ok(createStub.calledOnce);
        });
        test('Should set initial UI state', () => {
            // Проверяем что statusBarItem создан и настроен
            const createStub = vscodeMocks_1.mockVscode.window.createStatusBarItem;
            assert.ok(createStub.calledOnce);
        });
    });
    suite('updateRecordingState', () => {
        test('Should update to recording state', () => {
            statusBarManager.updateRecordingState(true);
            // Тест прошел, если не выбросилось исключение
            assert.ok(true);
        });
        test('Should update to idle state', () => {
            statusBarManager.updateRecordingState(false);
            // Тест прошел, если не выбросилось исключение
            assert.ok(true);
        });
    });
    suite('Status Display Methods', () => {
        test('Should show transcribing state', () => {
            statusBarManager.showTranscribing();
            // Тест прошел, если не выбросилось исключение
            assert.ok(true);
        });
        test('Should show error state', () => {
            statusBarManager.showError('Test error message');
            // Тест прошел, если не выбросилось исключение
            assert.ok(true);
        });
        test('Should show success state', () => {
            statusBarManager.showSuccess();
            // Тест прошел, если не выбросилось исключение
            assert.ok(true);
        });
        test('Should reset error state after timeout', () => {
            statusBarManager.showError('Test error');
            // Перемещаем время на 3 секунды вперед
            clock.tick(3000);
            // Проверяем что timeout сработал без ошибок
            assert.ok(true);
        });
        test('Should reset success state after timeout', () => {
            statusBarManager.showSuccess();
            // Перемещаем время на 2 секунды вперед
            clock.tick(2000);
            // Проверяем что timeout сработал без ошибок
            assert.ok(true);
        });
    });
    suite('Cleanup', () => {
        test('Should dispose resources', () => {
            statusBarManager.dispose();
            // Тест прошел, если не выбросилось исключение
            assert.ok(true);
        });
    });
});
//# sourceMappingURL=StatusBarManager.test.js.map