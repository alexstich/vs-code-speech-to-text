# Упрощение режимов работы Speech to Text with Whisper

## Выполненные изменения

### 1. Упрощение команд и горячих клавиш

**Было:**
- Множество команд записи (startRecording, stopRecording, toggleRecording, startHoldToRecord, stopHoldToRecord)
- Множество команд вставки (insertAtCursor, insertAsComment, replaceSelection, copyToClipboard, sendToChat)
- Сложная система режимов (hold, toggle)
- Множество горячих клавиш

**Стало:**
- Только 2 основные команды:
  1. `recordAndSendToChat` (F9) - запись с автоматической отправкой в Cursor чат
  2. `recordToClipboard` (Ctrl+Shift+V) - запись с копированием в буфер обмена
- 2 служебные команды: `openSettings`, `runDiagnostics`

### 2. Упрощение конфигурации

**Удалено:**
- `insertMode` (cursor, comment, replace) - больше не нужен
- Режимы `hold` и `toggle` в `recordingMode`

**Изменено:**
- `recordingMode` теперь имеет только 2 значения: `chat` и `clipboard`
- По умолчанию: `chat`

### 3. Упрощение логики

**Удалено:**
- Переменные `isHoldToRecordActive`, `holdToRecordDisposable`, `holdToRecordDebounceTimer`
- Функции `startHoldToRecord`, `stopHoldToRecord`, `toggleRecording`
- Сложная логика определения контекста для автоматической отправки в чат

**Добавлено:**
- Переменная `currentRecordingMode` для отслеживания текущего режима записи
- Простая логика: режим устанавливается при вызове команды и определяет действие после транскрипции

### 4. Обновление package.json

**Команды:**
```json
"commands": [
  {
    "command": "speechToTextWhisper.recordAndSendToChat",
    "title": "Record and Send to Chat",
    "category": "Speech to Text with Whisper",
    "icon": "$(comment-discussion)"
  },
  {
    "command": "speechToTextWhisper.recordToClipboard", 
    "title": "Record to Clipboard",
    "category": "Speech to Text with Whisper",
    "icon": "$(clippy)"
  },
  {
    "command": "speechToTextWhisper.openSettings",
    "title": "Open Settings",
    "category": "Speech to Text with Whisper", 
    "icon": "$(settings-gear)"
  },
  {
    "command": "speechToTextWhisper.runDiagnostics",
    "title": "Run Diagnostics",
    "category": "Speech to Text with Whisper",
    "icon": "$(debug)"
  }
]
```

**Горячие клавиши:**
```json
"keybindings": [
  {
    "command": "speechToTextWhisper.recordAndSendToChat",
    "key": "F9",
    "when": "true"
  },
  {
    "command": "speechToTextWhisper.recordToClipboard",
    "key": "ctrl+shift+v",
    "mac": "cmd+shift+v", 
    "when": "true"
  }
]
```

**Конфигурация:**
```json
"speechToTextWhisper.recordingMode": {
  "type": "string",
  "enum": ["chat", "clipboard"],
  "default": "chat",
  "description": "Recording mode: send to chat or copy to clipboard",
  "order": 3
}
```

### 5. Обновление тестов

**Обновлены файлы:**
- `src/test/unit/ToggleRecording.test.ts` - полностью переписан для новой логики
- `src/test/integration/extension.test.ts` - обновлен тест конфигурации
- `src/test/fixtures/testData.ts` - обновлены тестовые данные и сценарии

**Новые тестовые сценарии:**
- Тестирование команды `recordAndSendToChat`
- Тестирование команды `recordToClipboard`
- Тестирование переключения между режимами
- Тестирование обработки ошибок

### 6. Упрощение логики обработки

**Новый алгоритм:**
1. Пользователь нажимает F9 → устанавливается `currentRecordingMode = 'chat'`
2. Пользователь нажимает Ctrl+Shift+V → устанавливается `currentRecordingMode = 'clipboard'`
3. После транскрипции проверяется `currentRecordingMode`:
   - `'chat'` → отправка в Cursor чат
   - `'clipboard'` → копирование в буфер обмена
   - `null` → использование настроек по умолчанию (для обратной совместимости)

## Преимущества упрощения

1. **Простота использования:** Только 2 горячие клавиши вместо множества команд
2. **Понятность:** Четкое разделение функций - F9 для чата, Ctrl+Shift+V для буфера
3. **Меньше ошибок:** Убрана сложная логика определения контекста
4. **Легче поддерживать:** Меньше кода, меньше состояний, меньше переменных
5. **Лучше UX:** Пользователю не нужно выбирать режимы - действие определяется нажатой клавишей

## Обратная совместимость

- Старые настройки `insertMode` игнорируются
- Если `currentRecordingMode` не установлен, используется логика по умолчанию
- API ключ и другие основные настройки остаются без изменений