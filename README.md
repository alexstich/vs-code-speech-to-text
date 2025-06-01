# 🎤 Speech to Text with Whisper

> Превратите свой голос в код! Профессиональное расширение для голосового ввода в VS Code и Cursor IDE с интеграцией OpenAI Whisper API.

[![VS Code](https://img.shields.io/badge/VS%20Code-1.74.0+-blue.svg)](https://code.visualstudio.com/)
[![Cursor IDE](https://img.shields.io/badge/Cursor%20IDE-Supported-green.svg)](https://cursor.sh/)
[![OpenAI Whisper](https://img.shields.io/badge/OpenAI-Whisper%20API-orange.svg)](https://openai.com/research/whisper)
[![FFmpeg](https://img.shields.io/badge/FFmpeg-Required-red.svg)](https://ffmpeg.org/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## ✨ Основные возможности

### 🎙️ **Профессиональная запись аудио**
- **Высококачественная запись** с использованием FFmpeg
- **Кроссплатформенная поддержка**: Windows, macOS, Linux
- **Множественные форматы**: WAV (без сжатия), MP3, WebM, Opus
- **Настраиваемое качество**: от 16kHz до 48kHz
- **Автоматическое определение устройств**: микрофоны, линейные входы

### 🤖 **ИИ-транскрибация**
- **OpenAI Whisper API**: самая точная модель распознавания речи
- **Автоопределение языка**: поддержка 40+ языков
- **Контекстные подсказки**: улучшение точности для технических терминов
- **Настраиваемая температура**: от детерминированного до креативного распознавания

### 🎯 **Умная вставка текста**
- **Вставка в позицию курсора**: точно там, где вы работаете
- **Комментарии**: автоматическое форматирование для любого языка программирования
- **Замена выделения**: обновление существующего кода голосом
- **Буфер обмена**: копирование для использования в других приложениях

### 💬 **Интеграция с Cursor IDE** ⭐ *НОВОЕ*
- **Прямая отправка в AI чат**: голосовое общение с ИИ-ассистентом
- **Множественные стратегии**: автоматический fallback при сбоях
- **Контекстное определение**: автоматическая отправка в чат или редактор
- **Сохранение буфера обмена**: не нарушает ваш рабочий процесс

### ⚡ **Быстрый и эффективный**
- **Мгновенная обратная связь**: индикаторы в статус-баре
- **Toggle режим записи**: нажмите F9 для старт/стоп
- **Автоматическое определение тишины**: умная остановка записи
- **Retry-механизмы**: автоматические повторы при сбоях сети

## 🚀 Быстрый старт

### 1️⃣ Установка FFmpeg (обязательно)

<details>
<summary><strong>🪟 Windows</strong></summary>

```bash
# Используя winget (рекомендуется)
winget install FFmpeg

# Или скачайте с https://ffmpeg.org/download.html
# Добавьте FFmpeg в переменную PATH
```
</details>

<details>
<summary><strong>🍎 macOS</strong></summary>

```bash
# Используя Homebrew (рекомендуется)
brew install ffmpeg

# Используя MacPorts
sudo port install ffmpeg
```
</details>

<details>
<summary><strong>🐧 Linux</strong></summary>

```bash
# Ubuntu/Debian
sudo apt update && sudo apt install ffmpeg

# Fedora/RHEL
sudo dnf install ffmpeg

# Arch Linux
sudo pacman -S ffmpeg
```
</details>

### 2️⃣ Установка расширения

1. Откройте VS Code или Cursor IDE
2. Перейдите в Extensions (`Ctrl+Shift+X`)
3. Найдите "Speech to Text with Whisper"
4. Нажмите **Install**

### 3️⃣ Настройка API ключа

1. Получите API ключ на [platform.openai.com](https://platform.openai.com/api-keys)
2. Откройте настройки (`Ctrl+,` / `Cmd+,`)
3. Найдите "Speech to Text with Whisper"
4. Введите ваш OpenAI API ключ

### 4️⃣ Первая запись

1. Нажмите **F9** для начала записи
2. Говорите четко в микрофон
3. Нажмите **F9** снова для завершения
4. Текст автоматически вставится в редактор!

## ⌨️ Горячие клавиши

| Комбинация | Действие | Режим |
|------------|----------|-------|
| **F9** | Record and Insert Text | Записать и вставить в редактор |
| **Ctrl+Shift+M** | Record to Clipboard | Записать и скопировать в буфер |

## 🎛️ Настройки

### 🔧 Основные настройки

| Параметр | Описание | По умолчанию |
|----------|----------|--------------|
| **API Key** | Ключ OpenAI для Whisper | *Обязательно* |
| **Language** | Язык распознавания | Auto-detect |
| **Insert Mode** | Способ вставки текста | At cursor |
| **Audio Quality** | Качество записи | Standard (16kHz) |

### 🔊 Аудио настройки

| Параметр | Варианты | Описание |
|----------|----------|----------|
| **Sample Rate** | 16kHz, 22kHz, 44.1kHz, 48kHz | Качество записи |
| **Audio Format** | WAV, MP3, WebM, Opus | Формат файла |
| **Channels** | Mono, Stereo | Mono для речи |
| **Input Device** | Auto, Specific | Выбор микрофона |

## 🌍 Поддерживаемые языки

### Основные языки
- 🇺🇸 **English** - Английский
- 🇷🇺 **Russian** - Русский  
- 🇪🇸 **Spanish** - Испанский
- 🇫🇷 **French** - Французский
- 🇩🇪 **German** - Немецкий
- 🇮🇹 **Italian** - Итальянский
- 🇵🇹 **Portuguese** - Португальский

### Азиатские языки
- 🇨🇳 **Chinese** - Китайский
- 🇯🇵 **Japanese** - Японский
- 🇰🇷 **Korean** - Корейский
- 🇮🇳 **Hindi** - Хинди
- 🇹🇭 **Thai** - Тайский

### Другие языки
- 🇦🇪 **Arabic** - Арабский
- 🇳🇱 **Dutch** - Голландский
- 🇸🇪 **Swedish** - Шведский
- 🇳🇴 **Norwegian** - Норвежский
- И еще 25+ языков!

## 📋 Команды

Доступ через Command Palette (`Ctrl+Shift+P`):

### 🎤 Запись
- `Speech to Text: Record and Insert Text`
- `Speech to Text: Record to Clipboard`

### 🔧 Диагностика
- `Speech to Text: Run Diagnostics`
- `Speech to Text: Open Settings`
- `Speech to Text: Toggle Recording Mode`

## 🎯 Сценарии использования

### 👨‍💻 **Разработка кода**
```javascript
// Скажите: "Создать функцию для валидации email адреса"
function validateEmail(email) {
    // Ваш голос превратится в код
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
```

### 📝 **Быстрая вставка текста**
1. Нажмите **F9** для начала записи
2. Скажите что нужно вставить: "console.log hello world"
3. Нажмите **F9** снова для завершения записи
4. Текст автоматически вставится в позицию курсора

### 📋 **Работа с буфером обмена**
1. Нажмите **Ctrl+Shift+M** для записи в буфер
2. Скажите текст, который нужно скопировать
3. Используйте **Ctrl+V** для вставки в любом приложении

### 🌐 **Многоязычная разработка**
- Говорите на русском - получайте текст на русском
- Переключитесь на английский для технических терминов
- Автоопределение языка работает в реальном времени

## 🔧 Системные требования

### 💻 Минимальные требования
- **VS Code**: 1.74.0 или новее
- **FFmpeg**: Установлен в системе
- **OpenAI API**: Ключ с доступом к Whisper
- **Микрофон**: Любое аудио устройство ввода

### 🖥️ Поддержка платформ

| Платформа | Аудио система | Статус |
|-----------|---------------|--------|
| **Windows 10/11** | DirectShow | ✅ Полная поддержка |
| **macOS** | AVFoundation | ✅ Полная поддержка |
| **Linux** | PulseAudio/ALSA | ✅ Полная поддержка |

## 🐛 Решение проблем

### ❌ Частые проблемы и решения

<details>
<summary><strong>🔴 "FFmpeg not found"</strong></summary>

**Проблема**: FFmpeg не найден в системе

**Решения**:
1. Проверьте установку: `ffmpeg -version`
2. Windows: добавьте FFmpeg в PATH
3. Используйте команду "Run Diagnostics"
4. Укажите путь в настройках `ffmpegPath`
</details>

<details>
<summary><strong>🔴 "Recording is already in progress"</strong></summary>

**Проблема**: Множественные попытки записи

**Решения**:
1. Подождите завершения текущей записи
2. Не нажимайте F9 слишком часто (защита 200ms)
3. Проверьте статус в Status Bar
4. Перезапустите расширение при зависании
</details>

<details>
<summary><strong>🔴 "No audio input devices"</strong></summary>

**Проблема**: Не найдены аудио устройства

**Решения**:
- **Windows**: Проверьте DirectShow устройства
- **macOS**: Разрешите доступ к микрофону в Privacy & Security
- **Linux**: Добавьте пользователя в группу `audio`
- Проверьте подключение микрофона
</details>

<details>
<summary><strong>🔴 "API key invalid"</strong></summary>

**Проблема**: Проблемы с OpenAI API

**Решения**:
1. Проверьте формат ключа (начинается с `sk-`)
2. Убедитесь в наличии кредитов на аккаунте
3. Проверьте доступ к Whisper API
4. Используйте команду "Test API Key"
</details>

### 🛠️ Диагностика

Используйте встроенную диагностику для автоматической проверки:

1. Откройте Command Palette (`Ctrl+Shift+P`)
2. Выполните `Speech to Text: Run Diagnostics`
3. Просмотрите подробный отчет о системе
4. Следуйте рекомендациям для исправления проблем

## 📊 Технические детали

### 🎵 **Аудио запись**
- **Движок**: FFmpeg с нативными драйверами
- **Форматы**: WAV (PCM), MP3 (128kbps), WebM (Opus), Opus
- **Частоты**: 16kHz (речь), 22kHz, 44.1kHz (CD), 48kHz (профи)
- **Каналы**: Mono (оптимально для речи), Stereo
- **Кодеки**: PCM, AAC, MP3, Opus

### 🤖 **ИИ обработка**
- **Модель**: OpenAI Whisper-1 (самая точная)
- **Форматы ответа**: Text, JSON, Verbose JSON
- **Температура**: 0.0 (детерминированно) - 1.0 (креативно)
- **Таймауты**: Настраиваемые (5-120 секунд)
- **Retry**: Автоматические повторы с экспоненциальной задержкой

### 🔒 **Безопасность и приватность**
- **Шифрование**: HTTPS для всех API запросов
- **Хранение**: API ключ только в настройках VS Code
- **Временные файлы**: Автоматическое удаление после обработки
- **Данные**: Аудио отправляется только в OpenAI Whisper API
- **Разрешения**: Минимальные системные права для FFmpeg

## 🎯 Продвинутые возможности


### 🎛️ **Профили качества**

#### Быстрая речь (по умолчанию)
- Sample Rate: 16kHz
- Format: WAV
- Codec: PCM
- Channels: Mono

#### Высокое качество
- Sample Rate: 44.1kHz
- Format: WAV
- Codec: PCM
- Channels: Mono

#### Сжатие для медленного интернета
- Sample Rate: 16kHz
- Format: MP3
- Codec: MP3
- Bitrate: 64kbps

## 🤝 Сообщество и поддержка

### 📞 **Получить помощь**
- 🐛 [GitHub Issues](https://github.com/speak-y/vs-code-speech-to-text/issues) - Сообщить о проблеме
- 💡 [Feature Requests](https://github.com/speak-y/vs-code-speech-to-text/discussions) - Предложить улучшение


### 🛠️ **Разработка**

#### Настройка окружения
```bash
git clone https://github.com/speak-y/vs-code-speech-to-text.git
cd vs-code-speech-to-text
npm install
npm run compile
```

#### Запуск тестов
```bash
npm run test:unit      # Юнит тесты
npm run test:integration # Интеграционные тесты
npm run test:cursor    # Тесты Cursor интеграции
```