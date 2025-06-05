/**
 * Типы и интерфейсы для истории транскрипции
 */

/**
 * Режимы записи (дублируем из extension.ts для избежания циклических зависимостей)
 */
export enum RecordingMode {
	INSERT_OR_CLIPBOARD = 'insertOrClipboard',  // Ctrl+Shift+M - вставка в курсор или буфер обмена
	NEW_CHAT = 'newChat'                        // Ctrl+Shift+N - вставка в текущий чат Cursor
}

/**
 * Запись истории транскрипции
 */
export interface TranscriptionEntry {
	/** Уникальный идентификатор записи */
	id: string;
	
	/** Полный текст транскрипции */
	text: string;
	
	/** Время создания транскрипции (ISO string) */
	timestamp: string;
	
	/** Длительность аудио записи в миллисекундах */
	duration: number;
	
	/** Язык транскрипции */
	language: string;
	
	/** Режим записи во время транскрипции */
	mode: RecordingMode;
}

/**
 * Группа записей по дате
 */
export interface TranscriptionGroup {
	/** Название группы (сегодня, вчера, текущая неделя, старше) */
	label: string;
	
	/** Записи в группе */
	entries: TranscriptionEntry[];
	
	/** Ключ для сортировки */
	sortKey: number;
}

/**
 * Структура для хранения истории транскрипции
 */
export interface TranscriptionHistory {
	/** Версия формата данных */
	version: string;
	
	/** Массив записей транскрипции (максимум 100) */
	entries: TranscriptionEntry[];
	
	/** Время последнего обновления */
	lastUpdated: string;
}

/**
 * Опции для добавления записи в историю
 */
export interface AddEntryOptions {
	/** Текст транскрипции */
	text: string;
	
	/** Длительность аудио в миллисекундах */
	duration: number;
	
	/** Язык транскрипции */
	language: string;
	
	/** Режим записи */
	mode: RecordingMode;
	
	/** Опционально - пользовательский timestamp */
	timestamp?: string;
}

/**
 * Результат операции с историей
 */
export interface HistoryOperationResult {
	/** Успешность операции */
	success: boolean;
	
	/** Сообщение об ошибке, если есть */
	error?: string;
	
	/** Дополнительные данные */
	data?: any;
}

/**
 * Категории группировки по дате
 */
export enum DateGroupCategory {
	TODAY = 'today',
	YESTERDAY = 'yesterday',
	THIS_WEEK = 'thisWeek',
	OLDER = 'older'
}

/**
 * Метаданные записи для отображения
 */
export interface TranscriptionEntryMetadata {
	/** Краткое отображение (первые 50 символов) */
	preview: string;
	
	/** Полный текст для tooltip */
	fullText: string;
	
	/** Отформатированное время */
	formattedTime: string;
	
	/** Относительное время (например, "2 часа назад") */
	relativeTime: string;
	
	/** Информация о длительности */
	durationText: string;
}

/**
 * Константы для истории транскрипции
 */
export const TRANSCRIPTION_HISTORY_CONSTANTS = {
	/** Максимальное количество записей в истории */
	MAX_ENTRIES: 100,
	
	/** Версия текущего формата данных */
	CURRENT_VERSION: '1.0.0',
	
	/** Максимальная длина preview текста */
	PREVIEW_LENGTH: 50,
	
	/** Ключ для хранения в VS Code storage */
	STORAGE_KEY: 'transcriptionHistory'
} as const; 