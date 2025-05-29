"use strict";
// TextInserter.ts - компонент для вставки транскрибированного текста в редактор
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
exports.TextInserter = void 0;
const vscode = __importStar(require("vscode"));
class TextInserter {
    async insertAtCursor(text) {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            throw new Error('No active editor found');
        }
        const position = editor.selection.active;
        await editor.edit(editBuilder => {
            editBuilder.insert(position, text);
        });
    }
    async insertAsComment(text) {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            throw new Error('No active editor found');
        }
        const languageId = editor.document.languageId;
        const commentPrefix = this.getCommentPrefix(languageId);
        const commentedText = `${commentPrefix} ${text}`;
        await this.insertAtCursor(commentedText + '\n');
    }
    async replaceSelection(text) {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            throw new Error('No active editor found');
        }
        const selection = editor.selection;
        await editor.edit(editBuilder => {
            editBuilder.replace(selection, text);
        });
    }
    getCommentPrefix(languageId) {
        const commentMap = {
            'javascript': '//',
            'typescript': '//',
            'python': '#',
            'rust': '//',
            'go': '//',
            'java': '//',
            'csharp': '//',
            'cpp': '//',
            'c': '//',
            'php': '//',
            'ruby': '#',
            'swift': '//',
            'kotlin': '//',
            'scala': '//',
            'html': '<!--',
            'css': '/*',
            'scss': '//',
            'sass': '//',
            'less': '//',
            'sql': '--',
            'bash': '#',
            'sh': '#',
            'zsh': '#',
            'fish': '#'
        };
        return commentMap[languageId] || '//';
    }
    async copyToClipboard(text) {
        await vscode.env.clipboard.writeText(text);
    }
    getActiveContext() {
        const editor = vscode.window.activeTextEditor;
        return editor ? 'editor' : 'unknown';
    }
}
exports.TextInserter = TextInserter;
//# sourceMappingURL=TextInserter.js.map