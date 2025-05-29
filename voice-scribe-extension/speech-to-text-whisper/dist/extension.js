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
var vscode5 = __toESM(require("vscode"));

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
  constructor(events, config = {}) {
    this.events = events;
    this.config = {
      position: config.position || "right",
      priority: config.priority || 100,
      showTooltips: config.showTooltips !== false,
      autoHideOnSuccess: config.autoHideOnSuccess !== false,
      successDisplayDuration: config.successDisplayDuration || 2e3,
      errorDisplayDuration: config.errorDisplayDuration || 3e3,
      enableAnimations: config.enableAnimations !== false,
      showProgress: config.showProgress !== false
    };
    this.createStatusBarItem();
    this.updateUI();
    this.show();
  }
  statusBarItem;
  currentState = "idle";
  isRecording = false;
  lastError = null;
  successTimer = null;
  errorTimer = null;
  progressInterval = null;
  progressStep = 0;
  config;
  // Конфигурация для различных состояний
  stateConfig = {
    idle: {
      text: "$(mic)",
      tooltip: "Click to start voice recording",
      icon: "mic",
      command: "voiceScribe.toggleRecording"
    },
    recording: {
      text: "$(record)",
      tooltip: "Recording... Click to stop",
      icon: "record",
      backgroundColor: new vscode2.ThemeColor("statusBarItem.warningBackground"),
      command: "voiceScribe.toggleRecording"
    },
    processing: {
      text: "$(loading~spin)",
      tooltip: "Processing audio data...",
      icon: "loading",
      backgroundColor: new vscode2.ThemeColor("statusBarItem.prominentBackground")
    },
    transcribing: {
      text: "$(sync~spin)",
      tooltip: "Transcribing speech to text...",
      icon: "sync",
      backgroundColor: new vscode2.ThemeColor("statusBarItem.prominentBackground")
    },
    inserting: {
      text: "$(edit)",
      tooltip: "Inserting transcribed text...",
      icon: "edit",
      backgroundColor: new vscode2.ThemeColor("statusBarItem.prominentBackground")
    },
    success: {
      text: "$(check)",
      tooltip: "Text successfully inserted!",
      icon: "check",
      backgroundColor: new vscode2.ThemeColor("statusBarItem.prominentBackground"),
      color: new vscode2.ThemeColor("statusBarItem.prominentForeground")
    },
    error: {
      text: "$(error)",
      tooltip: "Voice recording error occurred",
      icon: "error",
      backgroundColor: new vscode2.ThemeColor("statusBarItem.errorBackground"),
      color: new vscode2.ThemeColor("statusBarItem.errorForeground")
    },
    warning: {
      text: "$(warning)",
      tooltip: "Voice recording warning",
      icon: "warning",
      backgroundColor: new vscode2.ThemeColor("statusBarItem.warningBackground"),
      color: new vscode2.ThemeColor("statusBarItem.warningForeground")
    }
  };
  /**
   * Создает элемент статус-бара
   */
  createStatusBarItem() {
    const alignment = this.config.position === "left" ? vscode2.StatusBarAlignment.Left : vscode2.StatusBarAlignment.Right;
    this.statusBarItem = vscode2.window.createStatusBarItem(
      alignment,
      this.config.priority
    );
  }
  /**
   * Обновляет состояние записи
   */
  updateRecordingState(isRecording) {
    this.isRecording = isRecording;
    this.setState(isRecording ? "recording" : "idle");
  }
  /**
   * Показывает состояние обработки аудио
   */
  showProcessing() {
    this.setState("processing");
    this.startProgressAnimation();
  }
  /**
   * Показывает состояние транскрибации
   */
  showTranscribing() {
    this.setState("transcribing");
    this.startProgressAnimation();
  }
  /**
   * Показывает состояние вставки текста
   */
  showInserting() {
    this.setState("inserting");
  }
  /**
   * Показывает состояние успеха
   */
  showSuccess(message) {
    this.clearTimers();
    this.setState("success");
    if (message) {
      this.updateTooltip(`Success: ${message}`);
    }
    if (this.config.autoHideOnSuccess) {
      this.successTimer = setTimeout(() => {
        this.setState("idle");
      }, this.config.successDisplayDuration);
    }
  }
  /**
   * Показывает состояние ошибки
   */
  showError(message, severity = "error") {
    this.clearTimers();
    this.lastError = message;
    const state = severity === "warning" ? "warning" : "error";
    this.setState(state);
    this.updateTooltip(`${this.capitalizeFirst(severity)}: ${message}`);
    this.errorTimer = setTimeout(() => {
      this.setState("idle");
      this.lastError = null;
    }, this.config.errorDisplayDuration);
  }
  /**
   * Показывает предупреждение
   */
  showWarning(message) {
    this.showError(message, "warning");
  }
  /**
   * Обновляет прогресс операции
   */
  updateProgress(percentage, message) {
    if (!this.config.showProgress) {
      return;
    }
    const progressBar = this.createProgressBar(percentage);
    const currentConfig = this.stateConfig[this.currentState];
    this.statusBarItem.text = `${currentConfig.icon} ${progressBar}`;
    if (message && this.config.showTooltips) {
      this.updateTooltip(`${currentConfig.tooltip} (${Math.round(percentage)}%) - ${message}`);
    }
  }
  /**
   * Получает информацию о текущем состоянии
   */
  getStatus() {
    return {
      state: this.currentState,
      isRecording: this.isRecording,
      isVisible: this.statusBarItem ? true : false,
      lastError: this.lastError,
      configuration: this.config
    };
  }
  /**
   * Обновляет конфигурацию
   */
  updateConfiguration(newConfig) {
    Object.assign(this.config, newConfig);
    if (newConfig.position || newConfig.priority !== void 0) {
      const wasVisible = this.statusBarItem ? true : false;
      this.dispose();
      this.createStatusBarItem();
      if (wasVisible) {
        this.show();
      }
    }
    this.updateUI();
  }
  /**
   * Показывает элемент статус-бара
   */
  show() {
    if (this.statusBarItem) {
      this.statusBarItem.show();
    }
  }
  /**
   * Скрывает элемент статус-бара
   */
  hide() {
    if (this.statusBarItem) {
      this.statusBarItem.hide();
    }
  }
  /**
   * Переключает видимость элемента
   */
  toggle() {
    if (this.statusBarItem) {
      this.show();
    }
  }
  /**
   * Устанавливает новое состояние
   */
  setState(newState) {
    if (this.currentState === newState) {
      return;
    }
    this.currentState = newState;
    this.updateUI();
  }
  /**
   * Обновляет UI элемента
   */
  updateUI() {
    if (!this.statusBarItem) {
      return;
    }
    const config = this.stateConfig[this.currentState];
    if (this.config.enableAnimations && this.isAnimatedState()) {
      this.statusBarItem.text = this.getAnimatedText(config);
    } else {
      this.statusBarItem.text = config.text;
    }
    if (this.config.showTooltips) {
      this.statusBarItem.tooltip = this.buildTooltip(config);
    }
    this.statusBarItem.backgroundColor = config.backgroundColor;
    this.statusBarItem.color = config.color;
    this.statusBarItem.command = config.command;
  }
  /**
   * Обновляет tooltip
   */
  updateTooltip(tooltip) {
    if (this.config.showTooltips && this.statusBarItem) {
      this.statusBarItem.tooltip = tooltip;
    }
  }
  /**
   * Создает строку прогресса
   */
  createProgressBar(percentage) {
    const totalBlocks = 10;
    const filledBlocks = Math.round(percentage / 100 * totalBlocks);
    const emptyBlocks = totalBlocks - filledBlocks;
    return "\u2588".repeat(filledBlocks) + "\u2591".repeat(emptyBlocks);
  }
  /**
   * Проверяет является ли состояние анимированным
   */
  isAnimatedState() {
    return ["recording", "processing", "transcribing"].includes(this.currentState);
  }
  /**
   * Получает анимированный текст
   */
  getAnimatedText(config) {
    if (this.currentState === "recording") {
      const dots = ".".repeat(this.progressStep % 3 + 1);
      return `${config.text} Recording${dots}`;
    }
    return config.text;
  }
  /**
   * Строит полный tooltip
   */
  buildTooltip(config) {
    let tooltip = config.tooltip;
    switch (this.currentState) {
      case "idle":
        tooltip += "\n\nHotkey: F9 (hold to record)";
        tooltip += "\nRight-click for settings";
        break;
      case "recording":
        tooltip += "\n\nHotkey: F9 (release to stop)";
        break;
      case "error":
        if (this.lastError) {
          tooltip += `

Last error: ${this.lastError}`;
        }
        tooltip += "\n\nClick to retry";
        break;
    }
    return tooltip;
  }
  /**
   * Запускает анимацию прогресса
   */
  startProgressAnimation() {
    if (!this.config.enableAnimations) {
      return;
    }
    this.clearProgressAnimation();
    this.progressStep = 0;
    this.progressInterval = setInterval(() => {
      this.progressStep++;
      this.updateUI();
    }, 500);
  }
  /**
   * Останавливает анимацию прогресса
   */
  clearProgressAnimation() {
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
    }
  }
  /**
   * Очищает все таймеры
   */
  clearTimers() {
    if (this.successTimer) {
      clearTimeout(this.successTimer);
      this.successTimer = null;
    }
    if (this.errorTimer) {
      clearTimeout(this.errorTimer);
      this.errorTimer = null;
    }
    this.clearProgressAnimation();
  }
  /**
   * Делает первую букву заглавной
   */
  capitalizeFirst(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
  /**
   * Освобождает ресурсы
   */
  dispose() {
    this.clearTimers();
    if (this.statusBarItem) {
      this.statusBarItem.dispose();
    }
  }
  /**
   * Статические методы для создания стандартных конфигураций
   */
  /**
   * Создает минимальную конфигурацию
   */
  static createMinimalConfig() {
    return {
      showTooltips: false,
      enableAnimations: false,
      showProgress: false
    };
  }
  /**
   * Создает полную конфигурацию
   */
  static createFullConfig() {
    return {
      position: "right",
      priority: 100,
      showTooltips: true,
      autoHideOnSuccess: true,
      successDisplayDuration: 2e3,
      errorDisplayDuration: 5e3,
      enableAnimations: true,
      showProgress: true
    };
  }
  /**
   * Создает конфигурацию для разработки
   */
  static createDebugConfig() {
    return {
      position: "left",
      priority: 1e3,
      showTooltips: true,
      autoHideOnSuccess: false,
      successDisplayDuration: 5e3,
      errorDisplayDuration: 1e4,
      enableAnimations: true,
      showProgress: true
    };
  }
};

// src/utils/ErrorHandler.ts
var vscode3 = __toESM(require("vscode"));
var VSCodeErrorDisplayHandler = class {
  async showError(message, severity, actions) {
    if (severity === "critical" /* CRITICAL */) {
      return await vscode3.window.showErrorMessage(`\u274C ${message}`, ...actions || []);
    } else {
      return await vscode3.window.showErrorMessage(`\u274C ${message}`, ...actions || []);
    }
  }
  async showWarning(message, actions) {
    return await vscode3.window.showWarningMessage(`\u26A0\uFE0F ${message}`, ...actions || []);
  }
  async showInformation(message, actions) {
    return await vscode3.window.showInformationMessage(`\u2139\uFE0F ${message}`, ...actions || []);
  }
  updateStatusBar(message, severity) {
    console.log(`[StatusBar] ${severity.toUpperCase()}: ${message}`);
  }
};
var ErrorHandler = class {
  displayHandler;
  statusBarManager;
  // Интеграция с StatusBarManager
  // Конфигурации для разных типов ошибок
  errorConfigs = /* @__PURE__ */ new Map([
    ["microphone_access" /* MICROPHONE_ACCESS */, {
      type: "microphone_access" /* MICROPHONE_ACCESS */,
      severity: "error" /* ERROR */,
      displayStrategy: "popup" /* POPUP */,
      recoveryAction: "enable_microphone" /* ENABLE_MICROPHONE */,
      message: "Cannot access microphone. Please check your microphone settings.",
      userActionRequired: true
    }],
    ["microphone_permission" /* MICROPHONE_PERMISSION */, {
      type: "microphone_permission" /* MICROPHONE_PERMISSION */,
      severity: "error" /* ERROR */,
      displayStrategy: "popup" /* POPUP */,
      recoveryAction: "enable_microphone" /* ENABLE_MICROPHONE */,
      message: "Microphone permission denied. Please allow microphone access.",
      userActionRequired: true
    }],
    ["microphone_compatibility" /* MICROPHONE_COMPATIBILITY */, {
      type: "microphone_compatibility" /* MICROPHONE_COMPATIBILITY */,
      severity: "critical" /* CRITICAL */,
      displayStrategy: "popup" /* POPUP */,
      recoveryAction: "none" /* NONE */,
      message: "Your browser/environment does not support audio recording.",
      userActionRequired: false
    }],
    ["api_key_missing" /* API_KEY_MISSING */, {
      type: "api_key_missing" /* API_KEY_MISSING */,
      severity: "critical" /* CRITICAL */,
      displayStrategy: "popup" /* POPUP */,
      recoveryAction: "configure_api_key" /* CONFIGURE_API_KEY */,
      message: "OpenAI API key not configured. Please configure it in settings.",
      userActionRequired: true
    }],
    ["api_key_invalid" /* API_KEY_INVALID */, {
      type: "api_key_invalid" /* API_KEY_INVALID */,
      severity: "critical" /* CRITICAL */,
      displayStrategy: "popup" /* POPUP */,
      recoveryAction: "configure_api_key" /* CONFIGURE_API_KEY */,
      message: "Invalid OpenAI API key format. Please check your API key.",
      userActionRequired: true
    }],
    ["api_rate_limit" /* API_RATE_LIMIT */, {
      type: "api_rate_limit" /* API_RATE_LIMIT */,
      severity: "critical" /* CRITICAL */,
      displayStrategy: "popup" /* POPUP */,
      recoveryAction: "retry" /* RETRY */,
      message: "API rate limit exceeded. Please wait and try again.",
      retryable: true
    }],
    ["api_quota_exceeded" /* API_QUOTA_EXCEEDED */, {
      type: "api_quota_exceeded" /* API_QUOTA_EXCEEDED */,
      severity: "critical" /* CRITICAL */,
      displayStrategy: "popup" /* POPUP */,
      recoveryAction: "configure_api_key" /* CONFIGURE_API_KEY */,
      message: "API quota exceeded. Please check your OpenAI account.",
      userActionRequired: true
    }],
    ["network_error" /* NETWORK_ERROR */, {
      type: "network_error" /* NETWORK_ERROR */,
      severity: "error" /* ERROR */,
      displayStrategy: "popup" /* POPUP */,
      recoveryAction: "check_network" /* CHECK_NETWORK */,
      message: "Network error. Please check your internet connection.",
      retryable: true
    }],
    ["transcription_empty" /* TRANSCRIPTION_EMPTY */, {
      type: "transcription_empty" /* TRANSCRIPTION_EMPTY */,
      severity: "warning" /* WARNING */,
      displayStrategy: "status_bar" /* STATUS_BAR */,
      recoveryAction: "retry" /* RETRY */,
      message: "No speech detected in the audio. Try speaking louder or closer to the microphone.",
      retryable: true
    }],
    ["transcription_failed" /* TRANSCRIPTION_FAILED */, {
      type: "transcription_failed" /* TRANSCRIPTION_FAILED */,
      severity: "error" /* ERROR */,
      displayStrategy: "popup" /* POPUP */,
      recoveryAction: "retry" /* RETRY */,
      message: "Transcription failed. Please try again.",
      retryable: true
    }],
    ["text_insertion_failed" /* TEXT_INSERTION_FAILED */, {
      type: "text_insertion_failed" /* TEXT_INSERTION_FAILED */,
      severity: "error" /* ERROR */,
      displayStrategy: "popup" /* POPUP */,
      recoveryAction: "retry" /* RETRY */,
      message: "Failed to insert text. Please try again.",
      retryable: true
    }],
    ["audio_recording_failed" /* AUDIO_RECORDING_FAILED */, {
      type: "audio_recording_failed" /* AUDIO_RECORDING_FAILED */,
      severity: "error" /* ERROR */,
      displayStrategy: "popup" /* POPUP */,
      recoveryAction: "enable_microphone" /* ENABLE_MICROPHONE */,
      message: "Audio recording failed. Please check your microphone.",
      retryable: true
    }],
    ["configuration_error" /* CONFIGURATION_ERROR */, {
      type: "configuration_error" /* CONFIGURATION_ERROR */,
      severity: "error" /* ERROR */,
      displayStrategy: "popup" /* POPUP */,
      recoveryAction: "open_settings" /* OPEN_SETTINGS */,
      message: "Configuration error. Please check your settings.",
      userActionRequired: true
    }],
    ["unknown_error" /* UNKNOWN_ERROR */, {
      type: "unknown_error" /* UNKNOWN_ERROR */,
      severity: "error" /* ERROR */,
      displayStrategy: "popup" /* POPUP */,
      recoveryAction: "retry" /* RETRY */,
      message: "An unexpected error occurred. Please try again.",
      retryable: true
    }]
  ]);
  constructor(displayHandler, statusBarManager2) {
    this.displayHandler = displayHandler || new VSCodeErrorDisplayHandler();
    this.statusBarManager = statusBarManager2;
  }
  /**
   * Обработка ошибки по типу
   */
  async handleError(errorType, context, originalError) {
    const config = this.errorConfigs.get(errorType);
    if (!config) {
      return await this.handleError("unknown_error" /* UNKNOWN_ERROR */, context, originalError);
    }
    this.logError(config, context, originalError);
    if (this.statusBarManager) {
      this.statusBarManager.showError(config.message, config.severity);
    } else {
      this.displayHandler.updateStatusBar(config.message, config.severity);
    }
    return await this.displayError(config, context);
  }
  /**
   * Обработка ошибки из исключения
   */
  async handleErrorFromException(error, context) {
    const errorType = this.classifyError(error);
    return await this.handleError(errorType, context, error);
  }
  /**
   * Классификация ошибки по сообщению
   */
  classifyError(error) {
    const message = error.message.toLowerCase();
    if (message.includes("api key") && message.includes("not configured")) {
      return "api_key_missing" /* API_KEY_MISSING */;
    }
    if (message.includes("invalid") && message.includes("api key")) {
      return "api_key_invalid" /* API_KEY_INVALID */;
    }
    if (message.includes("rate limit") || message.includes("too many requests")) {
      return "api_rate_limit" /* API_RATE_LIMIT */;
    }
    if (message.includes("quota") || message.includes("insufficient funds")) {
      return "api_quota_exceeded" /* API_QUOTA_EXCEEDED */;
    }
    if (message.includes("permission") && message.includes("microphone")) {
      return "microphone_permission" /* MICROPHONE_PERMISSION */;
    }
    if (message.includes("microphone") || message.includes("media")) {
      return "microphone_access" /* MICROPHONE_ACCESS */;
    }
    if (message.includes("incompatible") || message.includes("not supported")) {
      return "microphone_compatibility" /* MICROPHONE_COMPATIBILITY */;
    }
    if (message.includes("no speech detected") || message.includes("empty audio")) {
      return "transcription_empty" /* TRANSCRIPTION_EMPTY */;
    }
    if (message.includes("transcription") || message.includes("whisper")) {
      return "transcription_failed" /* TRANSCRIPTION_FAILED */;
    }
    if (message.includes("network") || message.includes("connection") || message.includes("timeout") || message.includes("fetch")) {
      return "network_error" /* NETWORK_ERROR */;
    }
    if (message.includes("insert") || message.includes("text insertion")) {
      return "text_insertion_failed" /* TEXT_INSERTION_FAILED */;
    }
    if (message.includes("recording") || message.includes("audio")) {
      return "audio_recording_failed" /* AUDIO_RECORDING_FAILED */;
    }
    return "unknown_error" /* UNKNOWN_ERROR */;
  }
  /**
   * Отображение ошибки согласно стратегии
   */
  async displayError(config, context) {
    const { displayStrategy, severity, recoveryAction } = config;
    if (context.isHoldToRecordMode && severity !== "critical" /* CRITICAL */) {
      return;
    }
    const actions = this.getRecoveryActions(recoveryAction);
    switch (displayStrategy) {
      case "popup" /* POPUP */:
        if (severity === "warning" /* WARNING */) {
          return await this.displayHandler.showWarning(config.message, actions);
        } else {
          return await this.displayHandler.showError(config.message, severity, actions);
        }
      case "status_bar" /* STATUS_BAR */:
        this.displayHandler.updateStatusBar(config.message, severity);
        return;
      case "console" /* CONSOLE */:
        console.error(`[VoiceScribe] ${config.message}`);
        return;
      case "silent" /* SILENT */:
        return;
      default:
        return await this.displayHandler.showError(config.message, severity, actions);
    }
  }
  /**
   * Получение действий восстановления
   */
  getRecoveryActions(recoveryAction) {
    switch (recoveryAction) {
      case "configure_api_key" /* CONFIGURE_API_KEY */:
        return ["Open Settings"];
      case "enable_microphone" /* ENABLE_MICROPHONE */:
        return ["Check Microphone", "Open Settings"];
      case "check_network" /* CHECK_NETWORK */:
        return ["Retry", "Check Network"];
      case "retry" /* RETRY */:
        return ["Retry"];
      case "open_settings" /* OPEN_SETTINGS */:
        return ["Open Settings"];
      case "refresh_extension" /* REFRESH_EXTENSION */:
        return ["Reload Extension"];
      default:
        return [];
    }
  }
  /**
   * Логирование ошибки
   */
  logError(config, context, originalError) {
    const logPrefix = `[VoiceScribe][${config.severity.toUpperCase()}]`;
    const logMessage = `${logPrefix} ${config.type}: ${config.message}`;
    const contextInfo = `Operation: ${context.operation}, Timestamp: ${context.timestamp.toISOString()}`;
    console.error(logMessage);
    console.error(`Context: ${contextInfo}`);
    if (originalError) {
      console.error("Original error:", originalError);
      if (config.technicalDetails) {
        console.error("Technical details:", config.technicalDetails);
      }
    }
    if (context.additionalData) {
      console.error("Additional data:", context.additionalData);
    }
  }
  /**
   * Проверка, можно ли повторить операцию
   */
  isRetryable(errorType) {
    const config = this.errorConfigs.get(errorType);
    return config?.retryable || false;
  }
  /**
   * Получение конфигурации ошибки
   */
  getErrorConfig(errorType) {
    return this.errorConfigs.get(errorType);
  }
  /**
   * Установка StatusBarManager для интеграции
   */
  setStatusBarManager(statusBarManager2) {
    this.statusBarManager = statusBarManager2;
  }
};
var globalErrorHandler = new ErrorHandler();

// src/utils/RetryManager.ts
var RetryManager = class _RetryManager {
  defaultConfig = {
    maxAttempts: 3,
    strategy: "exponential_backoff" /* EXPONENTIAL_BACKOFF */,
    baseDelay: 1e3,
    maxDelay: 1e4,
    multiplier: 2,
    jitter: true
  };
  errorHandler;
  constructor(errorHandler2) {
    this.errorHandler = errorHandler2;
  }
  /**
   * Выполнение операции с повторными попытками
   */
  async retry(operation, operationName, config, errorContext) {
    const finalConfig = { ...this.defaultConfig, ...config };
    const startTime = Date.now();
    let lastError;
    for (let attempt = 1; attempt <= finalConfig.maxAttempts; attempt++) {
      try {
        console.log(`\u{1F504} Attempting ${operationName} (${attempt}/${finalConfig.maxAttempts})`);
        const result = await operation();
        const totalTime2 = Date.now() - startTime;
        console.log(`\u2705 ${operationName} succeeded on attempt ${attempt} (${totalTime2}ms)`);
        return {
          success: true,
          result,
          attempts: attempt,
          totalTime: totalTime2
        };
      } catch (error) {
        lastError = error;
        console.log(`\u274C ${operationName} failed on attempt ${attempt}: ${lastError.message}`);
        if (attempt === finalConfig.maxAttempts) {
          break;
        }
        const errorType = this.classifyError(lastError);
        if (!this.errorHandler.isRetryable(errorType)) {
          console.log(`\u{1F6AB} Error type ${errorType} is not retryable, stopping attempts`);
          break;
        }
        const delay = this.calculateDelay(attempt, finalConfig);
        console.log(`\u23F3 Waiting ${delay}ms before next attempt...`);
        await this.sleep(delay);
      }
    }
    const totalTime = Date.now() - startTime;
    console.log(`\u{1F4A5} ${operationName} failed after ${finalConfig.maxAttempts} attempts (${totalTime}ms)`);
    return {
      success: false,
      lastError,
      attempts: finalConfig.maxAttempts,
      totalTime
    };
  }
  /**
   * Retry специально для API запросов с детектированием сетевых ошибок
   */
  async retryApiRequest(operation, operationName, config) {
    const apiConfig = {
      maxAttempts: 3,
      strategy: "exponential_backoff" /* EXPONENTIAL_BACKOFF */,
      baseDelay: 1e3,
      maxDelay: 8e3,
      multiplier: 2,
      jitter: true,
      ...config
    };
    return await this.retry(operation, operationName, apiConfig, {
      type: "api_request"
    });
  }
  /**
   * Retry для операций с микрофоном
   */
  async retryMicrophoneOperation(operation, operationName, config) {
    const micConfig = {
      maxAttempts: 2,
      strategy: "fixed_delay" /* FIXED_DELAY */,
      baseDelay: 500,
      maxDelay: 1e3,
      multiplier: 1,
      jitter: false,
      ...config
    };
    return await this.retry(operation, operationName, micConfig, {
      type: "microphone_operation"
    });
  }
  /**
   * Классификация ошибки (упрощенная версия)
   */
  classifyError(error) {
    const message = error.message.toLowerCase();
    if (message.includes("network") || message.includes("timeout") || message.includes("fetch") || message.includes("connection")) {
      return "network_error" /* NETWORK_ERROR */;
    }
    if (message.includes("rate limit")) {
      return "api_rate_limit" /* API_RATE_LIMIT */;
    }
    if (message.includes("api key")) {
      return "api_key_invalid" /* API_KEY_INVALID */;
    }
    if (message.includes("microphone") || message.includes("permission")) {
      return "microphone_access" /* MICROPHONE_ACCESS */;
    }
    return "unknown_error" /* UNKNOWN_ERROR */;
  }
  /**
   * Вычисление задержки на основе стратегии
   */
  calculateDelay(attempt, config) {
    let delay;
    switch (config.strategy) {
      case "exponential_backoff" /* EXPONENTIAL_BACKOFF */:
        delay = Math.min(
          config.baseDelay * Math.pow(config.multiplier, attempt - 1),
          config.maxDelay
        );
        break;
      case "linear_backoff" /* LINEAR_BACKOFF */:
        delay = Math.min(
          config.baseDelay * attempt,
          config.maxDelay
        );
        break;
      case "fixed_delay" /* FIXED_DELAY */:
        delay = config.baseDelay;
        break;
      case "immediate" /* IMMEDIATE */:
        delay = 0;
        break;
      default:
        delay = config.baseDelay;
    }
    if (config.jitter) {
      const jitterAmount = delay * 0.1;
      const randomJitter = (Math.random() - 0.5) * 2 * jitterAmount;
      delay = Math.max(0, delay + randomJitter);
    }
    return Math.round(delay);
  }
  /**
   * Утилита для ожидания
   */
  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
  /**
   * Создание предконфигурированного RetryManager для разных типов операций
   */
  static createForApiOperations(errorHandler2) {
    const manager = new _RetryManager(errorHandler2);
    return manager;
  }
  static createForMicrophoneOperations(errorHandler2) {
    const manager = new _RetryManager(errorHandler2);
    return manager;
  }
};

// src/utils/RecoveryActionHandler.ts
var vscode4 = __toESM(require("vscode"));
var RecoveryActionHandler = class {
  dependencies;
  constructor(dependencies = {}) {
    this.dependencies = dependencies;
  }
  /**
   * Выполнение recovery action
   */
  async executeRecoveryAction(action, context) {
    console.log(`\u{1F527} Executing recovery action: ${action}`);
    try {
      switch (action) {
        case "configure_api_key" /* CONFIGURE_API_KEY */:
          return await this.configureApiKey();
        case "enable_microphone" /* ENABLE_MICROPHONE */:
          return await this.enableMicrophone();
        case "check_network" /* CHECK_NETWORK */:
          return await this.checkNetwork();
        case "retry" /* RETRY */:
          return await this.retryOperation();
        case "open_settings" /* OPEN_SETTINGS */:
          return this.openSettings();
        case "refresh_extension" /* REFRESH_EXTENSION */:
          return this.refreshExtension();
        case "none" /* NONE */:
          return { success: true, message: "No recovery action required" };
        default:
          return {
            success: false,
            message: `Unknown recovery action: ${action}`
          };
      }
    } catch (error) {
      const errorMessage = error.message;
      console.error(`\u274C Recovery action ${action} failed:`, errorMessage);
      return {
        success: false,
        message: `Recovery action failed: ${errorMessage}`
      };
    }
  }
  /**
   * Настройка API ключа
   */
  async configureApiKey() {
    this.openSettingsInternal();
    const instruction = `
Please configure your OpenAI API Key:

1. Get your API key from: https://platform.openai.com/api-keys
2. Copy the key (starts with 'sk-')
3. Paste it in the 'Voice Scribe: Api Key' setting below
4. Save the settings

After setting the API key, try using VoiceScribe again.
        `;
    await vscode4.window.showInformationMessage(
      instruction,
      { modal: true },
      "Got it"
    );
    return {
      success: true,
      message: "Settings opened for API key configuration",
      requiresRestart: false
    };
  }
  /**
   * Включение микрофона
   */
  async enableMicrophone() {
    if (this.dependencies.checkMicrophone) {
      try {
        const isWorking = await this.dependencies.checkMicrophone();
        if (isWorking) {
          return {
            success: true,
            message: "Microphone is already working"
          };
        }
      } catch (error) {
        console.log("Microphone check failed:", error);
      }
    }
    const instruction = `
Microphone Setup Instructions:

1. **Check Physical Connection:**
   - Ensure your microphone is properly connected
   - Try unplugging and reconnecting USB microphones

2. **Browser Permissions:**
   - Click on the lock icon in the address bar
   - Allow microphone access for VS Code
   - Refresh VS Code if needed

3. **System Permissions:**
   - macOS: System Preferences \u2192 Security & Privacy \u2192 Privacy \u2192 Microphone
   - Windows: Settings \u2192 Privacy \u2192 Microphone
   - Linux: Check audio system settings

4. **Test Microphone:**
   - Use the "Check Microphone" command in VoiceScribe
   - Or try recording in another application

After fixing the microphone, try VoiceScribe again.
        `;
    const action = await vscode4.window.showWarningMessage(
      "Microphone access is required for VoiceScribe to work.",
      { modal: true },
      "Show Instructions",
      "Check Microphone",
      "Open Settings"
    );
    if (action === "Show Instructions") {
      await vscode4.window.showInformationMessage(instruction, { modal: true });
    } else if (action === "Check Microphone" && this.dependencies.checkMicrophone) {
      try {
        const isWorking = await this.dependencies.checkMicrophone();
        if (isWorking) {
          vscode4.window.showInformationMessage("\u2705 Microphone is working correctly!");
          return { success: true, message: "Microphone verified" };
        } else {
          vscode4.window.showErrorMessage("\u274C Microphone is still not accessible.");
        }
      } catch (error) {
        vscode4.window.showErrorMessage(`\u274C Microphone check failed: ${error.message}`);
      }
    } else if (action === "Open Settings") {
      this.openSettingsInternal();
    }
    return {
      success: true,
      message: "Microphone instructions provided"
    };
  }
  /**
   * Проверка сети
   */
  async checkNetwork() {
    try {
      console.log("\u{1F310} Checking network connectivity...");
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5e3);
      const response = await fetch("https://api.openai.com/v1/models", {
        method: "HEAD",
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (response.ok || response.status === 401) {
        return {
          success: true,
          message: "Network connection is working"
        };
      } else {
        throw new Error(`API returned status: ${response.status}`);
      }
    } catch (error) {
      const errorMessage = error.message;
      if (errorMessage.includes("abort")) {
        return {
          success: false,
          message: "Network connection is slow or unavailable"
        };
      }
      console.error("Network check failed:", error);
      const action = await vscode4.window.showWarningMessage(
        "Network connectivity issue detected. Please check your internet connection.",
        "Retry",
        "Troubleshoot"
      );
      if (action === "Retry") {
        return await this.checkNetwork();
      } else if (action === "Troubleshoot") {
        const troubleshootInfo = `
Network Troubleshooting:

1. **Check Internet Connection:**
   - Try opening a website in your browser
   - Ping google.com from terminal/command prompt

2. **Firewall/Proxy:**
   - Check if your firewall blocks VS Code
   - Configure proxy settings if needed
   - Contact IT admin if on corporate network

3. **OpenAI API Access:**
   - Verify api.openai.com is accessible
   - Check if your country/region has access

4. **DNS Issues:**
   - Try using different DNS servers (8.8.8.8, 1.1.1.1)
   - Flush DNS cache

Try again after resolving network issues.
                `;
        await vscode4.window.showInformationMessage(troubleshootInfo, { modal: true });
      }
      return {
        success: false,
        message: `Network issue: ${errorMessage}`
      };
    }
  }
  /**
   * Повторная попытка операции
   */
  async retryOperation() {
    if (this.dependencies.retryLastOperation) {
      try {
        await this.dependencies.retryLastOperation();
        return {
          success: true,
          message: "Operation retried successfully"
        };
      } catch (error) {
        return {
          success: false,
          message: `Retry failed: ${error.message}`
        };
      }
    }
    return {
      success: true,
      message: "Please try the operation again manually"
    };
  }
  /**
   * Открытие настроек
   */
  openSettings() {
    this.openSettingsInternal();
    return {
      success: true,
      message: "Settings opened"
    };
  }
  /**
   * Перезагрузка расширения
   */
  refreshExtension() {
    if (this.dependencies.reloadExtension) {
      this.dependencies.reloadExtension();
      return {
        success: true,
        message: "Extension reloaded",
        requiresRestart: true
      };
    }
    vscode4.window.showInformationMessage(
      "Please reload VS Code to refresh the VoiceScribe extension.",
      "Reload Window"
    ).then((action) => {
      if (action === "Reload Window") {
        vscode4.commands.executeCommand("workbench.action.reloadWindow");
      }
    });
    return {
      success: true,
      message: "Reload requested"
    };
  }
  /**
   * Внутренняя функция для открытия настроек
   */
  openSettingsInternal() {
    if (this.dependencies.openSettings) {
      this.dependencies.openSettings();
    } else {
      vscode4.commands.executeCommand("workbench.action.openSettings", "voiceScribe");
    }
  }
  /**
   * Установка зависимостей
   */
  setDependencies(dependencies) {
    this.dependencies = { ...this.dependencies, ...dependencies };
  }
};
var globalRecoveryHandler = new RecoveryActionHandler();

// src/extension.ts
var audioRecorder;
var whisperClient;
var textInserter;
var statusBarManager;
var errorHandler;
var retryManager;
var recoveryHandler;
var isHoldToRecordActive = false;
var holdToRecordDisposable = null;
var extensionContext;
var lastTranscribedText = null;
function activate(context) {
  console.log("\u{1F3A4} VoiceScribe extension is now active!");
  extensionContext = context;
  try {
    initializeErrorHandling();
    initializeComponents();
    registerCommands(context);
    setupKeyBindings(context);
    initializeWhisperClient();
    showWelcomeMessage();
    console.log("\u2705 VoiceScribe extension successfully activated");
  } catch (error) {
    const errorMessage = `Failed to activate VoiceScribe: ${error.message}`;
    console.error(errorMessage);
    vscode5.window.showErrorMessage(errorMessage);
  }
}
function initializeErrorHandling() {
  console.log("\u{1F527} Initializing error handling system...");
  errorHandler = new ErrorHandler(new VSCodeErrorDisplayHandler());
  retryManager = new RetryManager(errorHandler);
  const recoveryDependencies = {
    checkMicrophone: async () => {
      const compatibility = AudioRecorder.checkBrowserCompatibility();
      const permission = await AudioRecorder.checkMicrophonePermission();
      return compatibility && permission.state === "granted";
    },
    testApiKey: async () => {
      if (!whisperClient) {
        return false;
      }
      try {
        const testBlob = new Blob(["test"], { type: "audio/wav" });
        await whisperClient.transcribe(testBlob);
        return true;
      } catch (error) {
        const errorMessage = error.message.toLowerCase();
        return !errorMessage.includes("api key") && !errorMessage.includes("unauthorized");
      }
    },
    openSettings: () => {
      vscode5.commands.executeCommand("workbench.action.openSettings", "voiceScribe");
    },
    reloadExtension: () => {
      vscode5.commands.executeCommand("workbench.action.reloadWindow");
    },
    retryLastOperation: async () => {
      throw new Error("No operation to retry");
    }
  };
  recoveryHandler = new RecoveryActionHandler(recoveryDependencies);
  console.log("\u2705 Error handling system initialized");
}
function initializeComponents() {
  console.log("\u{1F527} Initializing VoiceScribe components...");
  textInserter = new TextInserter();
  const audioRecorderEvents = {
    onRecordingStart: () => {
      console.log("\u{1F3A4} Recording started");
      statusBarManager.updateRecordingState(true);
      if (!isHoldToRecordActive) {
        vscode5.window.showInformationMessage("\u{1F3A4} Recording started...");
      }
    },
    onRecordingStop: async (audioBlob) => {
      console.log("\u23F9\uFE0F Recording stopped");
      statusBarManager.updateRecordingState(false);
      await handleTranscription(audioBlob);
    },
    onError: async (error) => {
      console.error("\u274C Recording error:", error);
      const context = {
        operation: "audio_recording",
        isHoldToRecordMode: isHoldToRecordActive,
        timestamp: /* @__PURE__ */ new Date()
      };
      const userAction = await errorHandler.handleErrorFromException(error, context);
      if (userAction) {
        await handleUserRecoveryAction(userAction, context);
      }
    }
  };
  const statusBarEvents = {
    onRecordingToggle: () => {
      toggleRecording();
    },
    onSettings: () => {
      openSettings();
    },
    onHelp: () => {
      showHelp();
    }
  };
  audioRecorder = new AudioRecorder(audioRecorderEvents);
  const config = vscode5.workspace.getConfiguration("voiceScribe");
  const statusBarConfig = {
    position: config.get("statusBarPosition", "right"),
    showTooltips: config.get("showTooltips", true),
    enableAnimations: config.get("enableAnimations", true),
    autoHideOnSuccess: config.get("autoHideSuccess", true),
    successDisplayDuration: config.get("successDuration", 2e3),
    errorDisplayDuration: config.get("errorDuration", 3e3)
  };
  statusBarManager = new StatusBarManager(statusBarEvents, statusBarConfig);
  errorHandler.setStatusBarManager(statusBarManager);
  console.log("\u2705 Components initialized successfully");
}
function registerCommands(context) {
  console.log("\u{1F4DD} Registering commands...");
  const commands3 = [
    // Основные команды записи
    vscode5.commands.registerCommand("voiceScribe.startRecording", startRecording),
    vscode5.commands.registerCommand("voiceScribe.stopRecording", stopRecording),
    vscode5.commands.registerCommand("voiceScribe.toggleRecording", toggleRecording),
    // Hold-to-record команды
    vscode5.commands.registerCommand("voiceScribe.startHoldToRecord", startHoldToRecord),
    vscode5.commands.registerCommand("voiceScribe.stopHoldToRecord", stopHoldToRecord),
    // Команды режимов вставки
    vscode5.commands.registerCommand("voiceScribe.insertAtCursor", () => insertLastTranscription("cursor")),
    vscode5.commands.registerCommand("voiceScribe.insertAsComment", () => insertLastTranscription("comment")),
    vscode5.commands.registerCommand("voiceScribe.replaceSelection", () => insertLastTranscription("replace")),
    vscode5.commands.registerCommand("voiceScribe.copyToClipboard", () => insertLastTranscription("clipboard")),
    // Утилитные команды
    vscode5.commands.registerCommand("voiceScribe.openSettings", openSettings),
    vscode5.commands.registerCommand("voiceScribe.showHelp", showHelp),
    vscode5.commands.registerCommand("voiceScribe.showStatus", showStatus),
    vscode5.commands.registerCommand("voiceScribe.checkMicrophone", checkMicrophone),
    vscode5.commands.registerCommand("voiceScribe.testApiKey", testApiKey),
    // Команды управления
    vscode5.commands.registerCommand("voiceScribe.resetConfiguration", resetConfiguration),
    vscode5.commands.registerCommand("voiceScribe.toggleStatusBar", toggleStatusBar)
  ];
  context.subscriptions.push(...commands3, statusBarManager);
  console.log(`\u2705 Registered ${commands3.length} commands`);
}
function setupKeyBindings(context) {
  console.log("\u2328\uFE0F Setting up key bindings...");
  const keyDownCommand = vscode5.commands.registerCommand("voiceScribe.keyDown", () => {
    if (!isHoldToRecordActive) {
      startHoldToRecord();
    }
  });
  const keyUpCommand = vscode5.commands.registerCommand("voiceScribe.keyUp", () => {
    if (isHoldToRecordActive) {
      stopHoldToRecord();
    }
  });
  context.subscriptions.push(keyDownCommand, keyUpCommand);
  console.log("\u2705 Key bindings configured");
}
async function startRecording() {
  const context = {
    operation: "start_recording",
    isHoldToRecordMode: isHoldToRecordActive,
    timestamp: /* @__PURE__ */ new Date()
  };
  try {
    console.log("\u25B6\uFE0F Starting recording...");
    const microphoneResult = await retryManager.retryMicrophoneOperation(
      async () => {
        const hasPermission = await AudioRecorder.checkMicrophonePermission();
        if (hasPermission.state !== "granted") {
          throw new Error("Microphone permission not granted");
        }
        return hasPermission;
      },
      "microphone_permission_check"
    );
    if (!microphoneResult.success) {
      const error = microphoneResult.lastError || new Error("Microphone access failed");
      const userAction = await errorHandler.handleErrorFromException(error, context);
      if (userAction) {
        await handleUserRecoveryAction(userAction, context);
      }
      return;
    }
    await audioRecorder.startRecording();
  } catch (error) {
    console.error("\u274C Failed to start recording:", error);
    const userAction = await errorHandler.handleErrorFromException(error, context);
    if (userAction) {
      await handleUserRecoveryAction(userAction, context);
    }
  }
}
function stopRecording() {
  const context = {
    operation: "stop_recording",
    isHoldToRecordMode: isHoldToRecordActive,
    timestamp: /* @__PURE__ */ new Date()
  };
  try {
    console.log("\u23F9\uFE0F Stopping recording...");
    audioRecorder.stopRecording();
  } catch (error) {
    console.error("\u274C Failed to stop recording:", error);
    errorHandler.handleErrorFromException(error, context);
  }
}
function toggleRecording() {
  if (audioRecorder.getIsRecording()) {
    stopRecording();
  } else {
    startRecording();
  }
}
async function startHoldToRecord() {
  if (isHoldToRecordActive) {
    return;
  }
  console.log("\u{1F3AF} Starting hold-to-record mode");
  isHoldToRecordActive = true;
  try {
    await startRecording();
  } catch (error) {
    isHoldToRecordActive = false;
    throw error;
  }
}
function stopHoldToRecord() {
  if (!isHoldToRecordActive) {
    return;
  }
  console.log("\u{1F3AF} Stopping hold-to-record mode");
  isHoldToRecordActive = false;
  if (audioRecorder.getIsRecording()) {
    stopRecording();
  }
}
async function handleTranscription(audioBlob) {
  const context = {
    operation: "transcription",
    isHoldToRecordMode: isHoldToRecordActive,
    timestamp: /* @__PURE__ */ new Date(),
    additionalData: { audioBlobSize: audioBlob.size }
  };
  try {
    console.log("\u{1F504} Starting transcription process...");
    statusBarManager.showProcessing();
    if (!whisperClient) {
      initializeWhisperClient();
      if (!whisperClient) {
        await errorHandler.handleError("api_key_missing" /* API_KEY_MISSING */, context);
        return;
      }
    }
    statusBarManager.showTranscribing();
    const config = vscode5.workspace.getConfiguration("voiceScribe");
    const language = config.get("language", "auto");
    const insertMode = config.get("insertMode", "cursor");
    const prompt = config.get("prompt", "");
    const transcriptionOptions = {
      language: language === "auto" ? void 0 : language,
      prompt: prompt || void 0,
      temperature: config.get("temperature", 0.1)
    };
    console.log("\u{1F3AF} Sending audio to Whisper API...");
    const transcriptionResult = await retryManager.retryApiRequest(
      () => whisperClient.transcribe(audioBlob, transcriptionOptions),
      "whisper_transcription",
      {
        maxAttempts: config.get("maxRetries", 3),
        baseDelay: config.get("retryDelay", 1e3)
      }
    );
    if (!transcriptionResult.success) {
      const error = transcriptionResult.lastError || new Error("Transcription failed after retries");
      const userAction = await errorHandler.handleErrorFromException(error, context);
      if (userAction) {
        await handleUserRecoveryAction(userAction, context);
      }
      return;
    }
    const transcribedText = transcriptionResult.result;
    if (transcribedText && transcribedText.trim()) {
      console.log("\u2705 Transcription successful:", transcribedText.substring(0, 100));
      lastTranscribedText = transcribedText.trim();
      statusBarManager.showInserting();
      await insertTranscribedTextWithErrorHandling(lastTranscribedText, insertMode, context);
      const truncatedText = lastTranscribedText.substring(0, 50) + (lastTranscribedText.length > 50 ? "..." : "");
      statusBarManager.showSuccess(`Inserted: "${truncatedText}"`);
      if (!isHoldToRecordActive) {
        vscode5.window.showInformationMessage(`\u2705 Transcribed: "${truncatedText}"`);
      }
    } else {
      const userAction = await errorHandler.handleError("transcription_empty" /* TRANSCRIPTION_EMPTY */, context);
      if (userAction) {
        await handleUserRecoveryAction(userAction, context);
      }
    }
  } catch (error) {
    console.error("\u274C Transcription process failed:", error);
    const userAction = await errorHandler.handleErrorFromException(error, context);
    if (userAction) {
      await handleUserRecoveryAction(userAction, context);
    }
  }
}
async function insertTranscribedTextWithErrorHandling(text, mode, parentContext) {
  const context = {
    operation: "text_insertion",
    isHoldToRecordMode: parentContext.isHoldToRecordMode,
    timestamp: /* @__PURE__ */ new Date(),
    additionalData: {
      textLength: text.length,
      insertMode: mode,
      parentOperation: parentContext.operation
    }
  };
  try {
    console.log(`\u{1F4DD} Inserting text in ${mode} mode...`);
    const config = vscode5.workspace.getConfiguration("voiceScribe");
    const formatText = config.get("formatText", true);
    const addNewLine = config.get("addNewLine", true);
    const indentToSelection = config.get("indentToSelection", false);
    const insertResult = await retryManager.retry(
      () => textInserter.insertText(text, {
        mode,
        formatText,
        addNewLine,
        indentToSelection
      }),
      "text_insertion",
      { maxAttempts: 2, strategy: "fixed_delay", baseDelay: 500 }
    );
    if (!insertResult.success) {
      const error = insertResult.lastError || new Error("Text insertion failed after retries");
      const userAction = await errorHandler.handleErrorFromException(error, context);
      if (userAction) {
        await handleUserRecoveryAction(userAction, context);
      }
      throw error;
    }
    console.log("\u2705 Text inserted successfully");
  } catch (error) {
    console.error("\u274C Text insertion failed:", error);
    if (!error.handled) {
      const userAction = await errorHandler.handleErrorFromException(error, context);
      if (userAction) {
        await handleUserRecoveryAction(userAction, context);
      }
    }
    throw error;
  }
}
async function insertLastTranscription(mode) {
  if (!lastTranscribedText) {
    vscode5.window.showWarningMessage("No transcribed text available. Please record something first.");
    return;
  }
  try {
    await insertTranscribedTextWithErrorHandling(lastTranscribedText, mode, {
      operation: "text_insertion",
      isHoldToRecordMode: isHoldToRecordActive,
      timestamp: /* @__PURE__ */ new Date(),
      additionalData: {
        textLength: lastTranscribedText.length,
        insertMode: mode,
        parentOperation: "transcription"
      }
    });
    vscode5.window.showInformationMessage(`Text inserted in ${mode} mode`);
  } catch (error) {
  }
}
function initializeWhisperClient() {
  console.log("\u{1F527} Initializing Whisper client...");
  const config = vscode5.workspace.getConfiguration("voiceScribe");
  const apiKey = config.get("apiKey");
  if (!apiKey) {
    console.warn("\u26A0\uFE0F OpenAI API key not configured");
    statusBarManager.showWarning("API key not configured");
    return;
  }
  if (!WhisperClient.validateApiKey(apiKey)) {
    console.error("\u274C Invalid OpenAI API key format");
    statusBarManager.showError("Invalid API key format", "critical");
    return;
  }
  try {
    whisperClient = new WhisperClient({
      apiKey,
      timeout: config.get("timeout", 3e4),
      maxRetries: config.get("maxRetries", 3),
      retryDelay: config.get("retryDelay", 1e3),
      baseURL: config.get("baseURL") || void 0
    });
    console.log("\u2705 Whisper client initialized successfully");
  } catch (error) {
    const errorMessage = `Failed to initialize Whisper client: ${error.message}`;
    console.error(errorMessage);
    statusBarManager.showError(errorMessage, "critical");
  }
}
function openSettings() {
  vscode5.commands.executeCommand("workbench.action.openSettings", "voiceScribe");
}
function showHelp() {
  const helpText = `
\u{1F3A4} **VoiceScribe Help**

**Recording:**
\u2022 F9 (hold): Hold to record, release to stop
\u2022 Toggle recording: Ctrl+Shift+V (or use command palette)

**Commands:**
\u2022 Voice Scribe: Start Recording
\u2022 Voice Scribe: Stop Recording  
\u2022 Voice Scribe: Toggle Recording
\u2022 Voice Scribe: Insert as Comment
\u2022 Voice Scribe: Replace Selection

**Settings:**
\u2022 OpenAI API Key (required)
\u2022 Language (auto-detect or specific)
\u2022 Insert Mode (cursor/comment/replace)
\u2022 Audio Quality settings

**Troubleshooting:**
\u2022 Check microphone permissions
\u2022 Verify API key is valid
\u2022 Test microphone access
`;
  vscode5.window.showInformationMessage(helpText, { modal: true });
}
function showStatus() {
  const status = statusBarManager.getStatus();
  const context = textInserter.getActiveContext();
  const statusText = `
**VoiceScribe Status:**

\u{1F3A4} Recording: ${status.isRecording ? "Active" : "Inactive"}
\u{1F4CA} State: ${status.state}
\u{1F527} API Client: ${whisperClient ? "Ready" : "Not configured"}
\u{1F4DD} Context: ${context.type} (${context.language || "unknown"})
\u{1F4BE} Last Error: ${status.lastError || "None"}
\u{1F4CB} Last Transcription: ${lastTranscribedText ? "Available" : "None"}
`;
  vscode5.window.showInformationMessage(statusText, { modal: true });
}
async function checkMicrophone() {
  try {
    statusBarManager.showProcessing();
    const compatibility = AudioRecorder.checkBrowserCompatibility();
    const permission = await AudioRecorder.checkMicrophonePermission();
    if (compatibility && permission) {
      statusBarManager.showSuccess("Microphone ready");
      vscode5.window.showInformationMessage("\u2705 Microphone is working correctly");
    } else {
      throw new Error(`Microphone check failed: ${!compatibility ? "Incompatible browser" : "Permission denied"}`);
    }
  } catch (error) {
    const errorMessage = error.message;
    statusBarManager.showError(errorMessage, "error");
    vscode5.window.showErrorMessage(`\u274C ${errorMessage}`);
  }
}
async function testApiKey() {
  if (!whisperClient) {
    vscode5.window.showWarningMessage("Please configure your OpenAI API key first");
    return;
  }
  try {
    statusBarManager.showProcessing();
    const testBlob = new Blob(["test"], { type: "audio/wav" });
    try {
      await whisperClient.transcribe(testBlob);
      statusBarManager.showSuccess("API key validated");
      vscode5.window.showInformationMessage("\u2705 OpenAI API key is working correctly");
    } catch (error) {
      const errorMessage = error.message;
      if (errorMessage.includes("audio") || errorMessage.includes("format")) {
        statusBarManager.showSuccess("API key validated");
        vscode5.window.showInformationMessage("\u2705 OpenAI API key is working correctly");
      } else {
        throw error;
      }
    }
  } catch (error) {
    const errorMessage = error.message;
    statusBarManager.showError(errorMessage, "critical");
    vscode5.window.showErrorMessage(`\u274C API key test failed: ${errorMessage}`);
  }
}
function resetConfiguration() {
  vscode5.window.showWarningMessage(
    "This will reset all VoiceScribe settings to defaults. Continue?",
    "Yes",
    "No"
  ).then((selection) => {
    if (selection === "Yes") {
      const config = vscode5.workspace.getConfiguration("voiceScribe");
      config.update("language", "auto", vscode5.ConfigurationTarget.Global);
      config.update("insertMode", "cursor", vscode5.ConfigurationTarget.Global);
      config.update("formatText", true, vscode5.ConfigurationTarget.Global);
      vscode5.window.showInformationMessage("\u2705 Configuration reset to defaults");
    }
  });
}
function toggleStatusBar() {
  const status = statusBarManager.getStatus();
  if (status.isVisible) {
    statusBarManager.hide();
    vscode5.window.showInformationMessage("Status bar hidden");
  } else {
    statusBarManager.show();
    vscode5.window.showInformationMessage("Status bar shown");
  }
}
function showWelcomeMessage() {
  const config = vscode5.workspace.getConfiguration("voiceScribe");
  const hasApiKey = config.get("apiKey");
  if (!hasApiKey) {
    vscode5.window.showInformationMessage(
      "\u{1F3A4} Welcome to VoiceScribe! Please configure your OpenAI API key to get started.",
      "Open Settings"
    ).then((selection) => {
      if (selection === "Open Settings") {
        openSettings();
      }
    });
  }
}
function deactivate() {
  console.log("\u{1F50C} Deactivating VoiceScribe extension...");
  try {
    if (audioRecorder && audioRecorder.getIsRecording()) {
      console.log("\u23F9\uFE0F Stopping active recording...");
      audioRecorder.stopRecording();
    }
    if (isHoldToRecordActive) {
      isHoldToRecordActive = false;
    }
    if (holdToRecordDisposable) {
      holdToRecordDisposable.dispose();
    }
    console.log("\u2705 VoiceScribe extension deactivated successfully");
  } catch (error) {
    console.error("\u274C Error during deactivation:", error);
  }
}
async function handleUserRecoveryAction(userAction, context) {
  console.log(`\u{1F527} Handling user recovery action: ${userAction}`);
  try {
    if (userAction === "Open Settings") {
      await recoveryHandler.executeRecoveryAction("open_settings");
    } else if (userAction === "Check Microphone") {
      await recoveryHandler.executeRecoveryAction("enable_microphone");
    } else if (userAction === "Retry") {
      await recoveryHandler.executeRecoveryAction("retry");
    } else if (userAction === "Check Network") {
      await recoveryHandler.executeRecoveryAction("check_network");
    } else if (userAction === "Reload Extension") {
      await recoveryHandler.executeRecoveryAction("refresh_extension");
    }
  } catch (error) {
    console.error("\u274C Recovery action failed:", error);
    vscode5.window.showErrorMessage(`Recovery action failed: ${error.message}`);
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  activate,
  deactivate
});
//# sourceMappingURL=extension.js.map
