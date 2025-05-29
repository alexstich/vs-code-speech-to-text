# План действий для разработки MVP

## Результаты анализа

### ✅ Проанализированные технологии

1. **VS Code Extension API** - отлично подходит для нашей задачи
   - Есть все необходимые API для команд, статус-бара, вставки текста
   - Хорошо документирован и стабилен
   - Поддерживает горячие клавиши и настройки

2. **OpenAI Whisper API** - оптимальный выбор для транскрибации
   - Высокое качество (~92% точность)
   - Поддержка 95+ языков 
   - Разумная стоимость ($0.006/минута)
   - Лимиты управляемы (25 МБ на файл)

3. **Cursor IDE интеграция** - возможна через несколько подходов
   - Через буфер обмена (самый надежный)
   - Через стандартные команды VS Code
   - Через Webview для расширенной интеграции

## 🎯 Рекомендуемый план реализации

### Этап 1: Базовый MVP (1-2 недели)

#### 1.1 Настройка проекта
```bash
# Создание проекта расширения VS Code
npm install -g yo generator-code
yo code

# Настройка TypeScript, ESLint, тестов
npm install --save-dev @types/vscode
```

#### 1.2 Ключевые компоненты для MVP
1. **AudioRecorder** - запись аудио через Web Audio API
2. **WhisperClient** - интеграция с OpenAI API  
3. **TextInserter** - вставка в активный редактор
4. **StatusBarManager** - UI в статус-баре
5. **CommandManager** - регистрация команд

#### 1.3 Минимальный функционал
- ✅ Режим "нажал-держи" (F9 по умолчанию)
- ✅ Запись в формате WAV 16кГц моно
- ✅ Отправка в OpenAI Whisper API
- ✅ Вставка результата в позицию курсора
- ✅ Базовая обработка ошибок

### Этап 2: Интеграция с Cursor (1 неделя)

#### 2.1 Определение контекста
```typescript
// Автоматическое определение IDE и активного контекста
const ide = contextManager.detectIDE(); // 'cursor' | 'vscode'
const context = contextManager.detectActiveContext(); // 'editor' | 'chat'
```

#### 2.2 Интеграция с чатом
- Метод через буфер обмена (primary)
- Попытки прямой интеграции (secondary)
- Фоллбэк на Webview (fallback)

### Этап 3: Полировка UX (1 неделя)

#### 3.1 Расширенные функции
- Режим "toggle" записи
- Предварительный просмотр транскрипции
- Настройки языка и качества
- История транскрипций

#### 3.2 Оптимизация
- Кэширование для экономии API вызовов
- Сжатие аудио больших размеров
- Улучшение обработки ошибок

## 📁 Рекомендуемая структура проекта

```
voice-scribe-extension/
├── package.json                 # Манифест расширения
├── tsconfig.json               # TypeScript конфигурация
├── webpack.config.js           # Сборка
├── src/
│   ├── extension.ts            # Главный файл
│   ├── core/
│   │   ├── AudioRecorder.ts    # Запись аудио
│   │   ├── WhisperClient.ts    # OpenAI API
│   │   └── TextInserter.ts     # Вставка текста
│   ├── ui/
│   │   ├── StatusBarManager.ts # Статус-бар
│   │   └── SettingsManager.ts  # Настройки
│   ├── integrations/
│   │   ├── ContextManager.ts   # Определение контекста
│   │   └── CursorIntegration.ts # Cursor специфика
│   └── utils/
│       ├── ErrorHandler.ts     # Обработка ошибок
│       └── AudioUtils.ts       # Аудио утилиты
├── media/                      # Иконки
│   ├── microphone.svg
│   └── recording.svg
└── test/                       # Тесты
    ├── suite/
    └── runTest.ts
```

## 🚀 Первые шаги

### 1. Создание базового расширения
```bash
yo code
# Выбрать: New Extension (TypeScript)
# Название: voice-scribe-extension
# Identifier: voice-scribe
# Description: Speech-to-text extension using OpenAI Whisper
```

### 2. Настройка package.json
```json
{
    "name": "voice-scribe",
    "displayName": "VoiceScribe - Speech to Text",
    "description": "Transform speech to text using OpenAI Whisper API",
    "version": "0.1.0",
    "engines": {
        "vscode": "^1.74.0"
    },
    "categories": ["Other"],
    "activationEvents": [
        "onCommand:voiceScribe.startRecording"
    ],
    "main": "./out/extension.js",
    "contributes": {
        "commands": [
            {
                "command": "voiceScribe.startRecording",
                "title": "Start Voice Recording",
                "category": "VoiceScribe"
            }
        ],
        "keybindings": [
            {
                "command": "voiceScribe.startRecording", 
                "key": "F9",
                "when": "editorTextFocus"
            }
        ]
    }
}
```

### 3. Базовая реализация extension.ts
```typescript
import * as vscode from 'vscode';
import { AudioRecorder } from './core/AudioRecorder';
import { WhisperClient } from './core/WhisperClient';
import { TextInserter } from './core/TextInserter';

export function activate(context: vscode.ExtensionContext) {
    const audioRecorder = new AudioRecorder();
    const whisperClient = new WhisperClient();
    const textInserter = new TextInserter();
    
    const startRecordingCommand = vscode.commands.registerCommand(
        'voiceScribe.startRecording',
        async () => {
            try {
                // Проверяем API ключ
                const apiKey = vscode.workspace.getConfiguration('voiceScribe').get<string>('apiKey');
                if (!apiKey) {
                    vscode.window.showErrorMessage('Please set OpenAI API key in settings');
                    return;
                }
                
                // Начинаем запись
                vscode.window.showInformationMessage('Recording started... Press F9 again to stop');
                await audioRecorder.startRecording();
                
                // Здесь будет логика остановки при повторном нажатии
                
            } catch (error) {
                vscode.window.showErrorMessage(`Recording failed: ${error.message}`);
            }
        }
    );
    
    context.subscriptions.push(startRecordingCommand);
}
```

## 🔧 Технические решения

### Запись аудио
- **Формат**: WAV, 16 кГц, моно
- **Максимальная длительность**: 5 минут
- **Сжатие**: автоматическое при превышении лимитов API

### Интеграция с Cursor
```typescript
// Определение контекста
if (ide === 'cursor' && context === 'chat') {
    await cursorIntegration.sendToChat(transcribedText);
} else {
    await textInserter.insertAtCursor(transcribedText);
}
```

### Обработка ошибок
- Проверка доступа к микрофону
- Валидация API ключа
- Обработка лимитов API
- Фоллбэк механизмы

## 📊 Ожидаемые результаты MVP

### Функциональность
- ✅ Запись речи по нажатию F9
- ✅ Транскрибация через OpenAI Whisper
- ✅ Вставка текста в редактор
- ✅ Базовая интеграция с Cursor чатом

### Производительность
- Время запуска записи: < 200мс
- Время транскрибации: 2-5 сек/минута аудио
- Размер расширения: < 5 МБ

### UX
- Одна кнопка для записи/остановки
- Визуальная индикация состояния
- Понятные сообщения об ошибках

## 🎯 Критерии успеха MVP

1. **Работает "из коробки"** после установки API ключа
2. **Точность транскрибации** > 85% для четкой русской речи
3. **Стабильность** - нет крашей при обычном использовании  
4. **Производительность** - отзывчивый UI во время записи
5. **Совместимость** - работает в VS Code и Cursor на всех ОС

## 🔄 Итерации после MVP

### v0.2 - Расширенная функциональность
- Режим toggle записи
- Настройки языка и качества
- Предварительный просмотр результата

### v0.3 - Продвинутая интеграция  
- Прямая интеграция с Cursor API (когда станет доступна)
- Горячие клавиши для разных режимов
- История транскрипций

### v0.4 - Автоматизация
- Автоматическое определение контекста кода
- Шаблоны для комментариев
- Интеграция с Git commit messages

---

**Рекомендация**: Начать с MVP, протестировать основную функциональность, получить feedback от пользователей, затем итерировать. Фокус на простоте использования и надежности работы. 