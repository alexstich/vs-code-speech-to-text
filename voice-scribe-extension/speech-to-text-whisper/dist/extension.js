"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/extension.ts
var extension_exports = {};
__export(extension_exports, {
  activate: () => activate,
  deactivate: () => deactivate
});
module.exports = __toCommonJS(extension_exports);
var vscode3 = __toESM(require("vscode"));

// src/core/AudioRecorder.ts
var AudioRecorder = class _AudioRecorder {
  constructor(events, options = {}) {
    this.events = events;
    this.options = options;
    this.detectSupportedFormats();
  }
  mediaRecorder = null;
  audioChunks = [];
  stream = null;
  isRecording = false;
  recordingStartTime = 0;
  maxDurationTimer = null;
  supportedMimeTypes = [];
  /**
   * Определяет поддерживаемые аудио форматы
   */
  detectSupportedFormats() {
    const formats = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/mp4",
      "audio/wav",
      "audio/ogg;codecs=opus",
      "audio/ogg"
    ];
    this.supportedMimeTypes = formats.filter(
      (format) => MediaRecorder.isTypeSupported(format)
    );
  }
  /**
   * Получает оптимальный MIME тип для записи
   */
  getBestMimeType() {
    const preferred = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/mp4",
      "audio/wav",
      "audio/ogg;codecs=opus",
      "audio/ogg"
    ];
    for (const type of preferred) {
      if (this.supportedMimeTypes.includes(type)) {
        return type;
      }
    }
    throw new Error("\u0411\u0440\u0430\u0443\u0437\u0435\u0440 \u043D\u0435 \u043F\u043E\u0434\u0434\u0435\u0440\u0436\u0438\u0432\u0430\u0435\u0442 \u0437\u0430\u043F\u0438\u0441\u044C \u0430\u0443\u0434\u0438\u043E");
  }
  /**
   * Проверяет совместимость браузера с API записи
   */
  static checkBrowserCompatibility() {
    const missing = [];
    if (!navigator?.mediaDevices?.getUserMedia) {
      missing.push("getUserMedia API");
    }
    if (typeof MediaRecorder === "undefined") {
      missing.push("MediaRecorder API");
    }
    return {
      supported: missing.length === 0,
      missing
    };
  }
  /**
   * Начинает запись аудио
   */
  async startRecording() {
    if (this.isRecording) {
      const error = new Error("\u0417\u0430\u043F\u0438\u0441\u044C \u0443\u0436\u0435 \u0438\u0434\u0435\u0442");
      this.events.onError(error);
      return;
    }
    const compatibility = _AudioRecorder.checkBrowserCompatibility();
    if (!compatibility.supported) {
      const error = new Error(
        `\u0411\u0440\u0430\u0443\u0437\u0435\u0440 \u043D\u0435 \u043F\u043E\u0434\u0434\u0435\u0440\u0436\u0438\u0432\u0430\u0435\u0442 \u0437\u0430\u043F\u0438\u0441\u044C \u0430\u0443\u0434\u0438\u043E. \u041E\u0442\u0441\u0443\u0442\u0441\u0442\u0432\u0443\u044E\u0442: ${compatibility.missing.join(", ")}`
      );
      this.events.onError(error);
      return;
    }
    try {
      const audioConstraints = this.getAudioConstraints();
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: audioConstraints
      });
      const mimeType = this.getBestMimeType();
      const recorderOptions = {
        mimeType,
        audioBitsPerSecond: this.getAudioBitrate()
      };
      this.mediaRecorder = new MediaRecorder(this.stream, recorderOptions);
      this.audioChunks = [];
      this.isRecording = true;
      this.recordingStartTime = Date.now();
      this.setupMediaRecorderEvents();
      this.setupMaxDurationTimer();
      this.mediaRecorder.start(100);
      this.events.onRecordingStart();
    } catch (error) {
      this.cleanup();
      this.events.onError(error);
    }
  }
  /**
   * Останавливает запись аудио
   */
  stopRecording() {
    if (!this.isRecording || !this.mediaRecorder) {
      return;
    }
    try {
      this.mediaRecorder.stop();
      this.isRecording = false;
      this.clearMaxDurationTimer();
    } catch (error) {
      this.events.onError(error);
    }
  }
  /**
   * Получает настройки аудио потока
   */
  getAudioConstraints() {
    const quality = this.options.quality || "standard";
    return {
      sampleRate: this.options.sampleRate || 16e3,
      // Оптимально для Whisper
      channelCount: this.options.channelCount || 1,
      // Моно
      echoCancellation: this.options.echoCancellation !== false,
      noiseSuppression: this.options.noiseSuppression !== false,
      autoGainControl: this.options.autoGainControl !== false,
      ...quality === "high" ? {
        sampleRate: 44100,
        sampleSize: 16
      } : {}
    };
  }
  /**
   * Получает битрейт для аудио
   */
  getAudioBitrate() {
    const quality = this.options.quality || "standard";
    return quality === "high" ? 128e3 : 64e3;
  }
  /**
   * Настраивает обработчики событий MediaRecorder
   */
  setupMediaRecorderEvents() {
    if (!this.mediaRecorder) {
      return;
    }
    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        this.audioChunks.push(event.data);
        this.events.onDataAvailable?.(event.data);
      }
    };
    this.mediaRecorder.onstop = () => {
      try {
        const audioBlob = this.createAudioBlob();
        this.events.onRecordingStop(audioBlob);
      } catch (error) {
        this.events.onError(error);
      } finally {
        this.cleanup();
      }
    };
    this.mediaRecorder.onerror = (event) => {
      this.events.onError(new Error(`\u041E\u0448\u0438\u0431\u043A\u0430 MediaRecorder: ${event}`));
      this.cleanup();
    };
  }
  /**
   * Создает финальный аудио blob
   */
  createAudioBlob() {
    if (this.audioChunks.length === 0) {
      throw new Error("\u041D\u0435\u0442 \u0437\u0430\u043F\u0438\u0441\u0430\u043D\u043D\u044B\u0445 \u0430\u0443\u0434\u0438\u043E \u0434\u0430\u043D\u043D\u044B\u0445");
    }
    const mimeType = this.mediaRecorder?.mimeType || "audio/webm";
    return new Blob(this.audioChunks, { type: mimeType });
  }
  /**
   * Настраивает таймер максимальной длительности
   */
  setupMaxDurationTimer() {
    const maxDuration = this.options.maxDuration;
    if (maxDuration && maxDuration > 0) {
      this.maxDurationTimer = setTimeout(() => {
        if (this.isRecording) {
          this.stopRecording();
        }
      }, maxDuration * 1e3);
    }
  }
  /**
   * Очищает таймер максимальной длительности
   */
  clearMaxDurationTimer() {
    if (this.maxDurationTimer) {
      clearTimeout(this.maxDurationTimer);
      this.maxDurationTimer = null;
    }
  }
  /**
   * Очищает ресурсы
   */
  cleanup() {
    this.clearMaxDurationTimer();
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.isRecording = false;
    this.recordingStartTime = 0;
  }
  /**
   * Возвращает текущее состояние записи
   */
  getIsRecording() {
    return this.isRecording;
  }
  /**
   * Возвращает длительность текущей записи в миллисекундах
   */
  getRecordingDuration() {
    if (!this.isRecording) {
      return 0;
    }
    return Date.now() - this.recordingStartTime;
  }
  /**
   * Возвращает поддерживаемые MIME типы
   */
  getSupportedMimeTypes() {
    return [...this.supportedMimeTypes];
  }
  /**
   * Проверяет, доступен ли микрофон
   */
  static async checkMicrophonePermission() {
    try {
      if (!navigator?.permissions) {
        return { state: "unknown", available: false };
      }
      const permission = await navigator.permissions.query({ name: "microphone" });
      const available = permission.state === "granted";
      return {
        state: permission.state,
        available
      };
    } catch (error) {
      return { state: "unknown", available: false };
    }
  }
};

// src/core/WhisperClient.ts
var WhisperClient = class {
  apiKey;
  baseURL;
  timeout;
  maxRetries;
  retryDelay;
  // Поддерживаемые форматы аудио
  supportedFormats = [
    "flac",
    "mp3",
    "mp4",
    "mpeg",
    "mpga",
    "m4a",
    "ogg",
    "wav",
    "webm"
  ];
  // Максимальный размер файла (25MB)
  maxFileSize = 25 * 1024 * 1024;
  constructor(config) {
    this.apiKey = config.apiKey;
    this.baseURL = config.baseURL || "https://api.openai.com/v1";
    this.timeout = config.timeout || 3e4;
    this.maxRetries = config.maxRetries || 3;
    this.retryDelay = config.retryDelay || 1e3;
  }
  /**
   * Транскрибация аудио файла
   */
  async transcribe(audioBlob, options = {}) {
    this.validateAudioBlob(audioBlob);
    const formData = this.prepareFormData(audioBlob, options);
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await this.makeRequest("/audio/transcriptions", formData);
        return this.processTranscriptionResponse(response, options);
      } catch (error) {
        if (attempt === this.maxRetries || !this.isRetryableError(error)) {
          throw this.enhanceError(error);
        }
        await this.delay(this.retryDelay * attempt);
      }
    }
    throw new Error("\u0412\u0441\u0435 \u043F\u043E\u043F\u044B\u0442\u043A\u0438 \u0442\u0440\u0430\u043D\u0441\u043A\u0440\u0438\u0431\u0430\u0446\u0438\u0438 \u0438\u0441\u0447\u0435\u0440\u043F\u0430\u043D\u044B");
  }
  /**
   * Проверка валидности API ключа
   */
  async checkApiKey() {
    try {
      const response = await fetch(`${this.baseURL}/models`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
          "User-Agent": "VoiceScribe-Extension/1.0"
        },
        signal: AbortSignal.timeout(this.timeout)
      });
      return response.ok;
    } catch {
      return false;
    }
  }
  /**
   * Получение информации об использовании API
   */
  async getUsage() {
    try {
      const response = await fetch(`${this.baseURL}/usage`, {
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
          "User-Agent": "VoiceScribe-Extension/1.0"
        },
        signal: AbortSignal.timeout(this.timeout)
      });
      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      throw this.enhanceError(error);
    }
  }
  /**
   * Валидация аудио blob
   */
  validateAudioBlob(audioBlob) {
    if (!audioBlob || audioBlob.size === 0) {
      throw this.createError("\u0410\u0443\u0434\u0438\u043E \u0444\u0430\u0439\u043B \u043F\u0443\u0441\u0442", "EMPTY_AUDIO");
    }
    if (audioBlob.size > this.maxFileSize) {
      throw this.createError(
        `\u0420\u0430\u0437\u043C\u0435\u0440 \u0444\u0430\u0439\u043B\u0430 \u043F\u0440\u0435\u0432\u044B\u0448\u0430\u0435\u0442 \u043B\u0438\u043C\u0438\u0442 \u0432 ${this.maxFileSize / (1024 * 1024)}MB`,
        "FILE_TOO_LARGE"
      );
    }
    const mimeType = audioBlob.type;
    if (mimeType && !this.isSupportedFormat(mimeType)) {
      console.warn(`\u041D\u0435\u043F\u043E\u0434\u0434\u0435\u0440\u0436\u0438\u0432\u0430\u0435\u043C\u044B\u0439 MIME \u0442\u0438\u043F: ${mimeType}. \u041F\u0440\u043E\u0434\u043E\u043B\u0436\u0430\u0435\u043C...`);
    }
  }
  /**
   * Проверка поддерживаемости формата
   */
  isSupportedFormat(mimeType) {
    return this.supportedFormats.some(
      (format) => mimeType.includes(format) || mimeType.includes(`audio/${format}`)
    );
  }
  /**
   * Подготовка FormData для запроса
   */
  prepareFormData(audioBlob, options) {
    const formData = new FormData();
    const extension = this.getFileExtension(audioBlob.type);
    formData.append("file", audioBlob, `audio.${extension}`);
    formData.append("model", "whisper-1");
    if (options.language && options.language !== "auto") {
      formData.append("language", options.language);
    }
    if (options.prompt) {
      formData.append("prompt", options.prompt);
    }
    const temperature = options.temperature ?? 0;
    formData.append("temperature", temperature.toString());
    const responseFormat = options.response_format || "json";
    formData.append("response_format", responseFormat);
    if (options.timestamp_granularities) {
      formData.append("timestamp_granularities[]", options.timestamp_granularities.join(","));
    }
    return formData;
  }
  /**
   * Получение расширения файла по MIME типу
   */
  getFileExtension(mimeType) {
    const mimeToExtension = {
      "audio/webm": "webm",
      "audio/wav": "wav",
      "audio/mp3": "mp3",
      "audio/mp4": "mp4",
      "audio/ogg": "ogg",
      "audio/flac": "flac",
      "audio/m4a": "m4a"
    };
    return mimeToExtension[mimeType] || "webm";
  }
  /**
   * Выполнение HTTP запроса
   */
  async makeRequest(endpoint, formData) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);
    try {
      const response = await fetch(`${this.baseURL}${endpoint}`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
          "User-Agent": "VoiceScribe-Extension/1.0"
        },
        body: formData,
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (!response.ok) {
        const errorData = await this.parseErrorResponse(response);
        throw this.createApiError(response.status, response.statusText, errorData);
      }
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }
  /**
   * Обработка ответа транскрибации
   */
  async processTranscriptionResponse(response, options) {
    const responseFormat = options.response_format || "json";
    if (responseFormat === "text") {
      return await response.text();
    }
    const result = await response.json();
    return result.text;
  }
  /**
   * Парсинг ошибок API
   */
  async parseErrorResponse(response) {
    try {
      return await response.json();
    } catch {
      return { message: response.statusText };
    }
  }
  /**
   * Создание API ошибки
   */
  createApiError(status, statusText, errorData) {
    let message = `OpenAI API Error: ${status} ${statusText}`;
    let code = "API_ERROR";
    if (errorData?.error) {
      message = errorData.error.message || message;
      code = errorData.error.code || code;
    }
    switch (status) {
      case 401:
        message = "\u041D\u0435\u0432\u0435\u0440\u043D\u044B\u0439 API \u043A\u043B\u044E\u0447 OpenAI";
        code = "INVALID_API_KEY";
        break;
      case 429:
        message = "\u041F\u0440\u0435\u0432\u044B\u0448\u0435\u043D \u043B\u0438\u043C\u0438\u0442 \u0437\u0430\u043F\u0440\u043E\u0441\u043E\u0432 API. \u041F\u043E\u043F\u0440\u043E\u0431\u0443\u0439\u0442\u0435 \u043F\u043E\u0437\u0436\u0435";
        code = "RATE_LIMIT_EXCEEDED";
        break;
      case 413:
        message = "\u0424\u0430\u0439\u043B \u0441\u043B\u0438\u0448\u043A\u043E\u043C \u0431\u043E\u043B\u044C\u0448\u043E\u0439 \u0434\u043B\u044F \u043E\u0431\u0440\u0430\u0431\u043E\u0442\u043A\u0438";
        code = "FILE_TOO_LARGE";
        break;
      case 400:
        if (errorData?.error?.message?.includes("audio")) {
          message = "\u041D\u0435\u043F\u043E\u0434\u0434\u0435\u0440\u0436\u0438\u0432\u0430\u0435\u043C\u044B\u0439 \u0444\u043E\u0440\u043C\u0430\u0442 \u0430\u0443\u0434\u0438\u043E";
          code = "UNSUPPORTED_FORMAT";
        }
        break;
    }
    return this.createError(message, code, status, errorData);
  }
  /**
   * Создание расширенной ошибки
   */
  createError(message, code, statusCode, details) {
    const error = new Error(message);
    error.code = code;
    error.statusCode = statusCode;
    error.details = details;
    return error;
  }
  /**
   * Улучшение существующей ошибки
   */
  enhanceError(error) {
    if (error.name === "AbortError") {
      return this.createError("\u041F\u0440\u0435\u0432\u044B\u0448\u0435\u043D\u043E \u0432\u0440\u0435\u043C\u044F \u043E\u0436\u0438\u0434\u0430\u043D\u0438\u044F \u043E\u0442\u0432\u0435\u0442\u0430 API", "TIMEOUT");
    }
    if (error.message.includes("fetch")) {
      return this.createError("\u041E\u0448\u0438\u0431\u043A\u0430 \u0441\u0435\u0442\u0438 \u043F\u0440\u0438 \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u0438 \u043A API", "NETWORK_ERROR");
    }
    return error;
  }
  /**
   * Проверка возможности повтора запроса
   */
  isRetryableError(error) {
    if (error.code === "TIMEOUT" || error.code === "NETWORK_ERROR") {
      return true;
    }
    const retryableStatuses = [429, 500, 502, 503, 504];
    return retryableStatuses.includes(error.statusCode);
  }
  /**
   * Задержка для повторных попыток
   */
  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
  /**
   * Статическая валидация API ключа
   */
  static validateApiKey(apiKey) {
    if (!apiKey || typeof apiKey !== "string") {
      return false;
    }
    return apiKey.startsWith("sk-") && apiKey.length >= 48;
  }
  /**
   * Получение поддерживаемых форматов
   */
  static getSupportedFormats() {
    return [
      "flac",
      "mp3",
      "mp4",
      "mpeg",
      "mpga",
      "m4a",
      "ogg",
      "wav",
      "webm"
    ];
  }
  /**
   * Получение максимального размера файла
   */
  static getMaxFileSize() {
    return 25 * 1024 * 1024;
  }
};

// src/ui/TextInserter.ts
var vscode = __toESM(require("vscode"));
var TextInserter = class _TextInserter {
  // Расширенная карта языков программирования
  languageMap = {
    // Web Technologies
    "javascript": {
      singleLineComment: "//",
      multiLineCommentStart: "/*",
      multiLineCommentEnd: "*/",
      fileExtensions: [".js", ".mjs", ".jsx"],
      indentationChar: " ",
      hasBlockComments: true
    },
    "typescript": {
      singleLineComment: "//",
      multiLineCommentStart: "/*",
      multiLineCommentEnd: "*/",
      fileExtensions: [".ts", ".tsx"],
      indentationChar: " ",
      hasBlockComments: true
    },
    "html": {
      singleLineComment: "<!--",
      multiLineCommentStart: "<!--",
      multiLineCommentEnd: "-->",
      fileExtensions: [".html", ".htm"],
      indentationChar: " ",
      hasBlockComments: true
    },
    "css": {
      singleLineComment: "/*",
      multiLineCommentStart: "/*",
      multiLineCommentEnd: "*/",
      fileExtensions: [".css"],
      indentationChar: " ",
      hasBlockComments: true
    },
    "scss": {
      singleLineComment: "//",
      multiLineCommentStart: "/*",
      multiLineCommentEnd: "*/",
      fileExtensions: [".scss"],
      indentationChar: " ",
      hasBlockComments: true
    },
    "sass": {
      singleLineComment: "//",
      fileExtensions: [".sass"],
      indentationChar: " ",
      hasBlockComments: false
    },
    "less": {
      singleLineComment: "//",
      multiLineCommentStart: "/*",
      multiLineCommentEnd: "*/",
      fileExtensions: [".less"],
      indentationChar: " ",
      hasBlockComments: true
    },
    // System Languages
    "c": {
      singleLineComment: "//",
      multiLineCommentStart: "/*",
      multiLineCommentEnd: "*/",
      fileExtensions: [".c", ".h"],
      indentationChar: " ",
      hasBlockComments: true
    },
    "cpp": {
      singleLineComment: "//",
      multiLineCommentStart: "/*",
      multiLineCommentEnd: "*/",
      fileExtensions: [".cpp", ".cxx", ".cc", ".hpp"],
      indentationChar: " ",
      hasBlockComments: true
    },
    "csharp": {
      singleLineComment: "//",
      multiLineCommentStart: "/*",
      multiLineCommentEnd: "*/",
      fileExtensions: [".cs"],
      indentationChar: " ",
      hasBlockComments: true
    },
    "rust": {
      singleLineComment: "//",
      multiLineCommentStart: "/*",
      multiLineCommentEnd: "*/",
      fileExtensions: [".rs"],
      indentationChar: " ",
      hasBlockComments: true
    },
    "go": {
      singleLineComment: "//",
      multiLineCommentStart: "/*",
      multiLineCommentEnd: "*/",
      fileExtensions: [".go"],
      indentationChar: "	",
      hasBlockComments: true
    },
    // JVM Languages
    "java": {
      singleLineComment: "//",
      multiLineCommentStart: "/*",
      multiLineCommentEnd: "*/",
      fileExtensions: [".java"],
      indentationChar: " ",
      hasBlockComments: true
    },
    "kotlin": {
      singleLineComment: "//",
      multiLineCommentStart: "/*",
      multiLineCommentEnd: "*/",
      fileExtensions: [".kt", ".kts"],
      indentationChar: " ",
      hasBlockComments: true
    },
    "scala": {
      singleLineComment: "//",
      multiLineCommentStart: "/*",
      multiLineCommentEnd: "*/",
      fileExtensions: [".scala", ".sc"],
      indentationChar: " ",
      hasBlockComments: true
    },
    // Scripting Languages
    "python": {
      singleLineComment: "#",
      multiLineCommentStart: '"""',
      multiLineCommentEnd: '"""',
      fileExtensions: [".py", ".pyw"],
      indentationChar: " ",
      hasBlockComments: true
    },
    "ruby": {
      singleLineComment: "#",
      multiLineCommentStart: "=begin",
      multiLineCommentEnd: "=end",
      fileExtensions: [".rb", ".erb"],
      indentationChar: " ",
      hasBlockComments: true
    },
    "php": {
      singleLineComment: "//",
      multiLineCommentStart: "/*",
      multiLineCommentEnd: "*/",
      fileExtensions: [".php", ".phtml"],
      indentationChar: " ",
      hasBlockComments: true
    },
    "perl": {
      singleLineComment: "#",
      multiLineCommentStart: "=pod",
      multiLineCommentEnd: "=cut",
      fileExtensions: [".pl", ".pm"],
      indentationChar: " ",
      hasBlockComments: true
    },
    // Shell Scripts
    "bash": {
      singleLineComment: "#",
      fileExtensions: [".sh", ".bash"],
      indentationChar: " ",
      hasBlockComments: false
    },
    "zsh": {
      singleLineComment: "#",
      fileExtensions: [".zsh"],
      indentationChar: " ",
      hasBlockComments: false
    },
    "fish": {
      singleLineComment: "#",
      fileExtensions: [".fish"],
      indentationChar: " ",
      hasBlockComments: false
    },
    "powershell": {
      singleLineComment: "#",
      multiLineCommentStart: "<#",
      multiLineCommentEnd: "#>",
      fileExtensions: [".ps1", ".psm1"],
      indentationChar: " ",
      hasBlockComments: true
    },
    // Mobile
    "swift": {
      singleLineComment: "//",
      multiLineCommentStart: "/*",
      multiLineCommentEnd: "*/",
      fileExtensions: [".swift"],
      indentationChar: " ",
      hasBlockComments: true
    },
    "dart": {
      singleLineComment: "//",
      multiLineCommentStart: "/*",
      multiLineCommentEnd: "*/",
      fileExtensions: [".dart"],
      indentationChar: " ",
      hasBlockComments: true
    },
    // Data & Config
    "sql": {
      singleLineComment: "--",
      multiLineCommentStart: "/*",
      multiLineCommentEnd: "*/",
      fileExtensions: [".sql"],
      indentationChar: " ",
      hasBlockComments: true
    },
    "yaml": {
      singleLineComment: "#",
      fileExtensions: [".yml", ".yaml"],
      indentationChar: " ",
      hasBlockComments: false
    },
    "toml": {
      singleLineComment: "#",
      fileExtensions: [".toml"],
      indentationChar: " ",
      hasBlockComments: false
    },
    "ini": {
      singleLineComment: ";",
      fileExtensions: [".ini", ".cfg"],
      indentationChar: " ",
      hasBlockComments: false
    },
    // Other Languages
    "lua": {
      singleLineComment: "--",
      multiLineCommentStart: "--[[",
      multiLineCommentEnd: "]]",
      fileExtensions: [".lua"],
      indentationChar: " ",
      hasBlockComments: true
    },
    "r": {
      singleLineComment: "#",
      fileExtensions: [".r", ".R"],
      indentationChar: " ",
      hasBlockComments: false
    },
    "matlab": {
      singleLineComment: "%",
      multiLineCommentStart: "%{",
      multiLineCommentEnd: "%}",
      fileExtensions: [".m"],
      indentationChar: " ",
      hasBlockComments: true
    }
  };
  /**
   * Вставляет текст в позицию курсора
   */
  async insertAtCursor(text, options = {}) {
    const editor = this.getActiveEditor();
    const formattedText = this.formatText(text, options);
    const position = editor.selection.active;
    const indentedText = options.indentToSelection ? this.addIndentation(formattedText, editor, position) : formattedText;
    await editor.edit((editBuilder) => {
      editBuilder.insert(position, indentedText);
    });
    const newPosition = position.translate(0, indentedText.length);
    editor.selection = new vscode.Selection(newPosition, newPosition);
  }
  /**
   * Вставляет текст как комментарий
   */
  async insertAsComment(text, options = {}) {
    const editor = this.getActiveEditor();
    const languageInfo = this.getLanguageInfo(editor.document.languageId);
    let commentedText;
    if (this.shouldUseMultilineComment(text, options, languageInfo)) {
      commentedText = this.createMultilineComment(text, languageInfo);
    } else {
      commentedText = this.createSingleLineComment(text, languageInfo);
    }
    const finalText = options.addNewLine !== false ? commentedText + "\n" : commentedText;
    await this.insertAtCursor(finalText, {
      ...options,
      formatText: false,
      // Уже отформатировали как комментарий
      addNewLine: false
      // Уже добавили новую строку если нужно
    });
  }
  /**
   * Заменяет выделенный текст
   */
  async replaceSelection(text, options = {}) {
    const editor = this.getActiveEditor();
    const selection = editor.selection;
    if (selection.isEmpty) {
      throw this.createError(
        "\u041D\u0435\u0442 \u0432\u044B\u0434\u0435\u043B\u0435\u043D\u043D\u043E\u0433\u043E \u0442\u0435\u043A\u0441\u0442\u0430 \u0434\u043B\u044F \u0437\u0430\u043C\u0435\u043D\u044B",
        "NO_SELECTION",
        "replace"
      );
    }
    const formattedText = this.formatText(text, options);
    await editor.edit((editBuilder) => {
      editBuilder.replace(selection, formattedText);
    });
  }
  /**
   * Вставляет текст на новую строку
   */
  async insertOnNewLine(text, options = {}) {
    const editor = this.getActiveEditor();
    const position = editor.selection.active;
    const lineEndPosition = new vscode.Position(position.line, editor.document.lineAt(position.line).text.length);
    const newLineText = "\n" + this.formatText(text, options);
    await editor.edit((editBuilder) => {
      editBuilder.insert(lineEndPosition, newLineText);
    });
  }
  /**
   * Копирует текст в буфер обмена
   */
  async copyToClipboard(text, options = {}) {
    const formattedText = this.formatText(text, options);
    await vscode.env.clipboard.writeText(formattedText);
    vscode.window.showInformationMessage(
      `\u0421\u043A\u043E\u043F\u0438\u0440\u043E\u0432\u0430\u043D\u043E \u0432 \u0431\u0443\u0444\u0435\u0440: "${formattedText.substring(0, 50)}${formattedText.length > 50 ? "..." : ""}"`
    );
  }
  /**
   * Универсальный метод вставки текста
   */
  async insertText(text, options = {}) {
    const mode = options.mode || "cursor";
    switch (mode) {
      case "cursor":
        await this.insertAtCursor(text, options);
        break;
      case "comment":
        await this.insertAsComment(text, options);
        break;
      case "replace":
        await this.replaceSelection(text, options);
        break;
      case "newLine":
        await this.insertOnNewLine(text, options);
        break;
      case "clipboard":
        await this.copyToClipboard(text, options);
        break;
      default:
        throw this.createError(`\u041D\u0435\u043F\u043E\u0434\u0434\u0435\u0440\u0436\u0438\u0432\u0430\u0435\u043C\u044B\u0439 \u0440\u0435\u0436\u0438\u043C \u0432\u0441\u0442\u0430\u0432\u043A\u0438: ${mode}`, "INVALID_MODE", mode);
    }
  }
  /**
   * Получает информацию о текущем контексте
   */
  getActiveContext() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      const terminal = vscode.window.activeTerminal;
      return {
        type: terminal ? "terminal" : "unknown",
        hasSelection: false
      };
    }
    const selection = editor.selection;
    const hasSelection = !selection.isEmpty;
    return {
      type: "editor",
      language: editor.document.languageId,
      hasSelection,
      selectionText: hasSelection ? editor.document.getText(selection) : void 0,
      cursorPosition: editor.selection.active
    };
  }
  /**
   * Получает информацию о языке программирования
   */
  getLanguageInfo(languageId) {
    return this.languageMap[languageId] || {
      singleLineComment: "//",
      fileExtensions: [],
      indentationChar: " ",
      hasBlockComments: false
    };
  }
  /**
   * Определяет нужно ли использовать многострочный комментарий
   */
  shouldUseMultilineComment(text, options, languageInfo) {
    if (options.forceMultilineComment) {
      return languageInfo.hasBlockComments;
    }
    return text.includes("\n") && languageInfo.hasBlockComments;
  }
  /**
   * Создает однострочный комментарий
   */
  createSingleLineComment(text, languageInfo) {
    const lines = text.split("\n");
    const commentPrefix = languageInfo.singleLineComment;
    return lines.map((line) => line.trim() ? `${commentPrefix} ${line}` : commentPrefix).join("\n");
  }
  /**
   * Создает многострочный комментарий
   */
  createMultilineComment(text, languageInfo) {
    if (!languageInfo.multiLineCommentStart || !languageInfo.multiLineCommentEnd) {
      return this.createSingleLineComment(text, languageInfo);
    }
    const start = languageInfo.multiLineCommentStart;
    const end = languageInfo.multiLineCommentEnd;
    if (start === "<!--") {
      return `${start} ${text} ${end}`;
    }
    if (start === "/*") {
      return `${start}
${text}
${end}`;
    }
    return `${start}
${text}
${end}`;
  }
  /**
   * Форматирует текст согласно опциям
   */
  formatText(text, options) {
    if (!options.formatText) {
      return text;
    }
    let formatted = text.trim();
    if (options.addNewLine) {
      formatted += "\n";
    }
    return formatted;
  }
  /**
   * Добавляет отступы к тексту согласно текущему положению курсора
   */
  addIndentation(text, editor, position) {
    const currentLine = editor.document.lineAt(position.line);
    const indentation = currentLine.text.substring(0, currentLine.firstNonWhitespaceCharacterIndex);
    const lines = text.split("\n");
    return lines.map((line, index) => index === 0 ? line : indentation + line).join("\n");
  }
  /**
   * Получает активный редактор или выбрасывает ошибку
   */
  getActiveEditor() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      throw this.createError(
        "\u041D\u0435\u0442 \u0430\u043A\u0442\u0438\u0432\u043D\u043E\u0433\u043E \u0440\u0435\u0434\u0430\u043A\u0442\u043E\u0440\u0430. \u041E\u0442\u043A\u0440\u043E\u0439\u0442\u0435 \u0444\u0430\u0439\u043B \u0434\u043B\u044F \u0440\u0435\u0434\u0430\u043A\u0442\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u044F.",
        "NO_ACTIVE_EDITOR",
        "editor"
      );
    }
    return editor;
  }
  /**
   * Создает типизированную ошибку
   */
  createError(message, code, context) {
    const error = new Error(message);
    error.code = code;
    error.context = context;
    return error;
  }
  /**
   * Получает поддерживаемые языки
   */
  static getSupportedLanguages() {
    return Object.keys(new _TextInserter().languageMap);
  }
  /**
   * Проверяет поддерживается ли язык
   */
  static isLanguageSupported(languageId) {
    return languageId in new _TextInserter().languageMap;
  }
};

// src/ui/StatusBarManager.ts
var vscode2 = __toESM(require("vscode"));
var StatusBarManager = class {
  constructor(events) {
    this.events = events;
    this.statusBarItem = vscode2.window.createStatusBarItem(
      vscode2.StatusBarAlignment.Right,
      100
    );
    this.statusBarItem.command = "voiceScribe.toggleRecording";
    this.updateUI();
    this.statusBarItem.show();
  }
  statusBarItem;
  isRecording = false;
  updateRecordingState(isRecording) {
    this.isRecording = isRecording;
    this.updateUI();
  }
  updateUI() {
    if (this.isRecording) {
      this.statusBarItem.text = "$(record) Recording...";
      this.statusBarItem.tooltip = "Click to stop recording (or press F9)";
      this.statusBarItem.backgroundColor = new vscode2.ThemeColor("statusBarItem.warningBackground");
    } else {
      this.statusBarItem.text = "$(mic) Voice";
      this.statusBarItem.tooltip = "Click to start voice recording (or press F9)";
      this.statusBarItem.backgroundColor = void 0;
    }
  }
  showTranscribing() {
    this.statusBarItem.text = "$(sync~spin) Transcribing...";
    this.statusBarItem.tooltip = "Processing audio...";
    this.statusBarItem.backgroundColor = new vscode2.ThemeColor("statusBarItem.prominentBackground");
  }
  showError(message) {
    this.statusBarItem.text = "$(error) Voice Error";
    this.statusBarItem.tooltip = `Error: ${message}`;
    this.statusBarItem.backgroundColor = new vscode2.ThemeColor("statusBarItem.errorBackground");
    setTimeout(() => {
      this.updateUI();
    }, 3e3);
  }
  showSuccess() {
    const originalText = this.statusBarItem.text;
    this.statusBarItem.text = "$(check) Voice Done";
    this.statusBarItem.tooltip = "Text successfully inserted";
    this.statusBarItem.backgroundColor = new vscode2.ThemeColor("statusBarItem.prominentBackground");
    setTimeout(() => {
      this.updateUI();
    }, 2e3);
  }
  dispose() {
    this.statusBarItem.dispose();
  }
};

// src/extension.ts
var audioRecorder;
var whisperClient;
var textInserter;
var statusBarManager;
function activate(context) {
  console.log("VoiceScribe extension is now active!");
  textInserter = new TextInserter();
  const audioRecorderEvents = {
    onRecordingStart: () => {
      statusBarManager.updateRecordingState(true);
      vscode3.window.showInformationMessage("Recording started...");
    },
    onRecordingStop: async (audioBlob) => {
      statusBarManager.updateRecordingState(false);
      await handleTranscription(audioBlob);
    },
    onError: (error) => {
      statusBarManager.showError(error.message);
      vscode3.window.showErrorMessage(`Recording error: ${error.message}`);
    }
  };
  const statusBarEvents = {
    onRecordingToggle: () => {
      toggleRecording();
    }
  };
  audioRecorder = new AudioRecorder(audioRecorderEvents);
  statusBarManager = new StatusBarManager(statusBarEvents);
  const startRecordingCommand = vscode3.commands.registerCommand(
    "voiceScribe.startRecording",
    startRecording
  );
  const stopRecordingCommand = vscode3.commands.registerCommand(
    "voiceScribe.stopRecording",
    stopRecording
  );
  const toggleRecordingCommand = vscode3.commands.registerCommand(
    "voiceScribe.toggleRecording",
    toggleRecording
  );
  context.subscriptions.push(
    startRecordingCommand,
    stopRecordingCommand,
    toggleRecordingCommand,
    statusBarManager
  );
  initializeWhisperClient();
}
async function startRecording() {
  try {
    await audioRecorder.startRecording();
  } catch (error) {
    vscode3.window.showErrorMessage(`Failed to start recording: ${error.message}`);
  }
}
function stopRecording() {
  try {
    audioRecorder.stopRecording();
  } catch (error) {
    vscode3.window.showErrorMessage(`Failed to stop recording: ${error.message}`);
  }
}
function toggleRecording() {
  if (audioRecorder.getIsRecording()) {
    stopRecording();
  } else {
    startRecording();
  }
}
async function handleTranscription(audioBlob) {
  try {
    statusBarManager.showTranscribing();
    if (!whisperClient) {
      initializeWhisperClient();
      if (!whisperClient) {
        throw new Error("API key not configured");
      }
    }
    const config = vscode3.workspace.getConfiguration("voiceScribe");
    const language = config.get("language");
    const insertMode = config.get("insertMode", "cursor");
    const transcriptionOptions = {
      language: language === "auto" ? void 0 : language
    };
    const transcribedText = await whisperClient.transcribe(audioBlob, transcriptionOptions);
    if (transcribedText.trim()) {
      await insertTranscribedText(transcribedText.trim(), insertMode);
      statusBarManager.showSuccess();
      vscode3.window.showInformationMessage(`Transcribed: "${transcribedText.substring(0, 50)}${transcribedText.length > 50 ? "..." : ""}"`);
    } else {
      throw new Error("No speech detected");
    }
  } catch (error) {
    const errorMessage = error.message;
    statusBarManager.showError(errorMessage);
    vscode3.window.showErrorMessage(`Transcription failed: ${errorMessage}`);
  }
}
async function insertTranscribedText(text, mode) {
  try {
    const config = vscode3.workspace.getConfiguration("voiceScribe");
    const formatText = config.get("formatText", true);
    const addNewLine = config.get("addNewLine", true);
    const indentToSelection = config.get("indentToSelection", false);
    await textInserter.insertText(text, {
      mode,
      formatText,
      addNewLine,
      indentToSelection
    });
  } catch (error) {
    const errorMessage = error.message || "Unknown error";
    vscode3.window.showErrorMessage(`Text insertion failed: ${errorMessage}`);
    throw error;
  }
}
function initializeWhisperClient() {
  const config = vscode3.workspace.getConfiguration("voiceScribe");
  const apiKey = config.get("apiKey");
  if (!apiKey) {
    vscode3.window.showWarningMessage(
      "OpenAI API key not configured. Please set it in Settings.",
      "Open Settings"
    ).then((selection) => {
      if (selection === "Open Settings") {
        vscode3.commands.executeCommand("workbench.action.openSettings", "voiceScribe.apiKey");
      }
    });
    return;
  }
  if (!WhisperClient.validateApiKey(apiKey)) {
    vscode3.window.showErrorMessage("Invalid OpenAI API key format.");
    return;
  }
  whisperClient = new WhisperClient({
    apiKey,
    timeout: 3e4,
    maxRetries: 3,
    retryDelay: 1e3
  });
}
function deactivate() {
  if (audioRecorder && audioRecorder.getIsRecording()) {
    audioRecorder.stopRecording();
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  activate,
  deactivate
});
//# sourceMappingURL=extension.js.map
