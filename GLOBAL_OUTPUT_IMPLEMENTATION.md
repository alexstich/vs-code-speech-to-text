# Глобальная система логирования VS Code Speech-to-Text

## Обзор

В проекте была внедрена единая система логирования, заменяющая разрозненные `console.log` вызовы на централизованный `GlobalOutput`.

## Компоненты системы

### 1. GlobalOutput.ts - Основной модуль
- **Расположение**: `src/utils/GlobalOutput.ts`
- **Назначение**: Центральный модуль для всего логирования в расширении
- **Функции**:
  - Инициализация глобального outputChannel
  - Единый API для логирования с разными уровнями
  - Автоматическое отображение критических ошибок
  - Форматирование сообщений с временными метками

### 2. Уровни логирования
```typescript
export enum LogLevel {
    DEBUG = '🔍',    // Отладочная информация
    INFO = 'ℹ️',     // Общая информация
    WARN = '⚠️',     // Предупреждения
    ERROR = '❌',    // Ошибки
    CRITICAL = '🚨'  // Критические ошибки
}
```

### 3. Специализированные логгеры для компонентов

Каждый основной компонент имеет свой именованный логгер:

```typescript
// Примеры использования
AudioQualityManagerLog.info('Audio quality preset applied');
ErrorHandlerLog.error('Failed to handle error', error);
CursorIntegrationLog.debug('Integration step completed');
FFmpegAudioRecorderLog.warn('Recording quality issues detected');
```

## Обновленные файлы

### Заменены console.log на GlobalOutput:
1. ✅ **src/utils/AudioQualityManager.ts**
   - `AudioQualityManagerLog.info()` для успешных операций
   
2. ✅ **src/utils/RecoveryActionHandler.ts**
   - `RecoveryActionHandlerLog.info()` для действий восстановления
   - `RecoveryActionHandlerLog.error()` для ошибок
   
3. ✅ **src/utils/ErrorHandler.ts**
   - `ErrorHandlerLog.info()` для статус-бара
   - `ErrorHandlerLog.error()` для критических ошибок
   - `ErrorHandlerLog.warn()` для предупреждений
   
4. ✅ **src/utils/RetryManager.ts**
   - `RetryManagerLog.info()` для попыток
   - `RetryManagerLog.warn()` для неудачных попыток
   - `RetryManagerLog.error()` для финальных ошибок
   
5. ✅ **src/integrations/CursorIntegration.ts**
   - `CursorIntegrationLog.debug()` для отладочной информации
   - `CursorIntegrationLog.info()` для основных операций
   - `CursorIntegrationLog.warn()` для предупреждений
   - `CursorIntegrationLog.error()` для ошибок

6. ✅ **src/extension.ts**
   - Инициализация `initializeGlobalOutput(outputChannel)`
   - `ExtensionLog.info()` для событий активации/деактивации

## Преимущества новой системы

### 1. **Единое место вывода**
- Все логи теперь отображаются в VS Code Output Panel "Speech to Text Whisper"
- Пользователи видят все события в одном месте

### 2. **Структурированное логирование**
- Временные метки для всех сообщений
- Уровни важности с эмодзи-индикаторами
- Компонентная группировка логов

### 3. **Автоматическое отображение критических ошибок**
- Критические ошибки автоматически показывают Output Panel
- Улучшенная диагностика проблем

### 4. **Консистентность**
- Единый стиль форматирования
- Централизованное управление логированием
- Легкость отладки

## Пример использования

```typescript
// Было:
console.log('Audio quality settings imported successfully');
console.error('Recovery action failed:', error);

// Стало:
AudioQualityManagerLog.info('Audio quality settings imported successfully');
RecoveryActionHandlerLog.error('Recovery action failed', error);
```

## Результат форматирования

В Output Panel теперь отображается:
```
2024-12-06T10:30:15.123Z ℹ️ [AudioQualityManager] Audio quality settings imported successfully
2024-12-06T10:30:16.456Z ❌ [RecoveryActionHandler] Recovery action failed
    Error: Network connection timeout
    Stack: at RecoveryActionHandler.execute...
```

## Инициализация

Глобальная система логирования инициализируется в `src/extension.ts`:

```typescript
// Создание outputChannel
outputChannel = vscode.window.createOutputChannel('Speech to Text Whisper');

// Инициализация глобального логирования
initializeGlobalOutput(outputChannel);

// Использование
ExtensionLog.info('SpeechToTextWhisper extension activation started!');
```

## Освобождение ресурсов

При деактивации расширения:

```typescript
export function deactivate() {
    // Освобождение ресурсов глобального логирования
    disposeGlobalOutput();
    ExtensionLog.info('Extension deactivated');
}
```

---

**Статус**: ✅ Внедрение завершено  
**Все console.log заменены**: ✅ Да  
**Тестирование**: Требуется проверка в VS Code 