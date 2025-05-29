# Change Log

All notable changes to the "speech-to-text-whisper" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [Unreleased]

- Initial release

## [0.1.0] - 2024-12-20

### Исправления в UI и записи аудио

#### ActivityBar исправления
- **Исправлена иконка Activity Bar**: Изменена с `$(mic)` на `$(device-microphone)` для корректного отображения
- **Добавлена боковая панель**: Панель "Speech to Text" теперь должна корректно отображаться в Activity Bar

#### Исправления записи аудио FFmpeg
- **Улучшена обработка кодов завершения**: FFmpeg на macOS может завершаться с кодом 255 при SIGTERM - это теперь считается нормальным
- **Добавлено детальное логирование**: Все выводы FFmpeg (stdout/stderr) теперь логируются для отладки
- **Улучшен парсинг аудио устройств**: Исправлен регексп для macOS AVFoundation устройств
- **Добавлена проверка размера файла**: Проверяем что записанный файл не пустой
- **Расширенная диагностика**: Больше информации о процессе записи

#### Технические улучшения
- **Лучшие сообщения об ошибках**: Более информативные сообщения при проблемах с записью
- **Robust error handling**: Более устойчивая обработка исключительных ситуаций
- **Improved device detection**: Улучшенное определение аудио устройств на macOS

### Тестирование
- **Создан скрипт тестирования**: `scripts/test-extension.js` для быстрой проверки функциональности
- **Обнаружено 7 аудио устройств** на тестовой системе macOS
- **Успешная компиляция**: 0 ошибок, 212 предупреждений стиля (не критично)

### Установка
```bash
# Установка VSIX файла
code --install-extension speech-to-text-whisper-0.1.0.vsix

# Или через VS Code UI:
# Command Palette -> Extensions: Install from VSIX...
```

---

## [0.0.8] - 2024-12-17