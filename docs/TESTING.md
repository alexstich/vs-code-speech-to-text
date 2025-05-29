# 🧪 Инструкция по тестированию SpeechToTextWhisper

## 📦 Подготовка к тестированию

### 1. Сборка расширения
```bash
# Установка зависимостей
npm install

# Сборка проекта
npm run compile

# Создание VSIX пакета
npx vsce package
```

### 2. Установка в VS Code
```bash
# Установка через командную строку
code --install-extension speech-to-text-whisper-0.1.0.vsix

# Или через VS Code: Extensions > ... > Install from VSIX
```

## ⚙️ Первоначальная настройка

### 1. Настройка API ключа
1. Откройте `Settings` (`Ctrl+,` / `Cmd+,`)
2. Найдите `Speech to Text with Whisper`
3. Введите ваш OpenAI API ключ в поле `API Key`

### 2. Базовые настройки
- **Language**: `auto` (автоопределение) или выберите конкретный язык
- **Recording Mode**: `hold` (по умолчанию) или `toggle`
- **Insert Mode**: `cursor` (в позицию курсора)

## 🔧 Основные тесты

### ✅ Тест 1: Проверка активации расширения
1. Откройте Command Palette (`Ctrl+Shift+P`)
2. Найдите команды `Speech to Text with Whisper`
3. **Ожидается**: Список команд расширения должен появиться

### ✅ Тест 2: Диагностика системы
1. Выполните команду `Speech to Text with Whisper: Run Diagnostics`
2. **Ожидается**: Отчет с состоянием:
   - ✅ Extension activated
   - ✅ API key configured (если настроен)
   - ✅ Browser compatibility OK
   - ✅ Microphone permission granted

### ✅ Тест 3: Status Bar
1. После активации расширения найдите иконку микрофона в status bar (внизу справа)
2. **Ожидается**: Иконка микрофона с tooltip "SpeechToTextWhisper"
3. Нажмите на иконку
4. **Ожидается**: Контекстное меню с опциями

### ✅ Тест 4: Проверка микрофона
1. Выполните команду `Speech to Text with Whisper: Check Microphone`
2. **Ожидается**: 
   - Запрос разрешения на микрофон (если не дан)
   - Сообщение "✅ Microphone is working correctly"

### ✅ Тест 5: Тест API ключа
1. Выполните команду `Speech to Text with Whisper: Test OpenAI API Key`
2. **Ожидается**: Сообщение "✅ OpenAI API key is working correctly"

## 🎤 Тесты записи

### ✅ Тест 6: F9 Hold-to-Record
1. Убедитесь что `Recording Mode` = `hold`
2. Нажмите и **держите** клавишу `F9`
3. **Ожидается**: 
   - Status bar показывает состояние записи
   - Уведомление "🎤 Recording started..."
4. Говорите несколько секунд
5. Отпустите `F9`
6. **Ожидается**:
   - Уведомление "🔄 Transcribing audio..."
   - После транскрибации: "✅ Transcribed and inserted: [текст]"
   - Текст появляется в редакторе

### ✅ Тест 7: Toggle Recording Mode
1. Измените `Recording Mode` на `toggle`
2. Нажмите `F9` один раз
3. **Ожидается**: Запись начинается
4. Говорите несколько секунд
5. Нажмите `F9` еще раз
6. **Ожидается**: Запись останавливается и начинается транскрибация

### ✅ Тест 8: Keyboard Shortcuts
- `Ctrl+Shift+V` (`Cmd+Shift+V` на Mac): Toggle recording
- `Ctrl+Shift+Alt+V`: Record and send to AI chat
- `Ctrl+Shift+C`: Insert as comment

## 📝 Тесты вставки текста

### ✅ Тест 9: Различные режимы вставки
1. Запишите аудио
2. Используйте команды:
   - `Insert Last Transcription at Cursor`
   - `Insert Last Transcription as Comment`
   - `Replace Selection with Last Transcription`
   - `Copy Last Transcription to Clipboard`

### ✅ Тест 10: Контекстное меню
1. Щелкните правой кнопкой в редакторе
2. **Ожидается**: Пункты меню SpeechToTextWhisper

## 🔍 Отладка и логи

### Просмотр логов
1. Откройте `Developer Tools` (`Help > Toggle Developer Tools`)
2. Перейдите на вкладку `Console`
3. Отфильтруйте по "SpeechToTextWhisper" или "🎤"

### Полезные команды для отладки
- `Speech to Text with Whisper: Show Status`
- `Speech to Text with Whisper: Show Context Information`
- `Speech to Text with Whisper: Run Diagnostics`

## ❗ Типичные проблемы

### F9 не работает
- Проверьте что расширение активировано
- Убедитесь что `Recording Mode` настроен правильно
- Проверьте permissions микрофона

### Нет Status Bar
- Выполните `Speech to Text with Whisper: Toggle Status Bar`
- Перезагрузите VS Code

### API ошибки
- Проверьте API ключ
- Убедитесь что у вас есть доступ к Whisper API
- Проверьте интернет соединение

### Нет уведомлений
- В hold-to-record режиме уведомления минимальные (это нормально)
- В toggle режиме должны быть полные уведомления

## 🎯 Продвинутые тесты

### Тест в разных контекстах
- Тестируйте в разных типах файлов (.js, .py, .md)
- Проверьте как работают комментарии в разных языках
- Тестируйте в терминале VS Code

### Тест производительности
- Записывайте длинные фрагменты (до 25 секунд)
- Тестируйте с плохим интернетом
- Проверьте retry механизм

### Интеграция с Cursor
- Если используете Cursor IDE, тестируйте отправку в AI chat
- Команда `Record and Send to AI Chat`

---

**Если что-то не работает:**
1. Проверьте Developer Console на ошибки
2. Выполните диагностику (`Run Diagnostics`)
3. Перезагрузите VS Code
4. Переустановите расширение 