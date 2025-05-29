# 🚀 Быстрый тест SpeechToTextWhisper

## ⚡ Установка и первый запуск

### 1. Установите пакет
```bash
code --install-extension speech-to-text-whisper-0.1.0.vsix
```

### 2. Настройте API ключ
1. `Ctrl+,` → Найдите "Speech to Text with Whisper"
2. Введите ваш OpenAI API ключ

### 3. Быстрый тест
1. Нажмите `Ctrl+Shift+P`
2. Выполните `Speech to Text with Whisper: Run Diagnostics`
3. **Ожидается**: ✅ для всех проверок

## 🎤 Основные функции для тестирования

### F9 - Hold to Record (главная функция)
1. **Держите F9** и говорите
2. **Отпустите F9** 
3. ✅ Текст должен появиться в редакторе

### Альтернативные команды
- `Ctrl+Shift+V` - Toggle recording
- `Ctrl+Shift+P` → "Start Recording" / "Stop Recording"

## 🔧 Отладка

### Если F9 не работает:
1. Проверьте status bar внизу справа - должна быть иконка 🎤
2. `Ctrl+Shift+P` → "Run Diagnostics"
3. Откройте Developer Tools (`Help > Toggle Developer Tools`) для логов

### Если нет status bar:
- `Ctrl+Shift+P` → "Toggle Status Bar"

### Если проблемы с API:
- `Ctrl+Shift+P` → "Test OpenAI API Key"

---

**Основные проблемы исправлены:**
✅ F9 теперь работает (исправлены имена команд)  
✅ Context variables настроены правильно  
✅ Status bar отображается  
✅ Уведомления работают  
✅ Диагностика доступна  

**Готово к тестированию!** 🎉 