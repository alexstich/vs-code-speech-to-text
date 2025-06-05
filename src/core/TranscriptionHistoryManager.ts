/**
 * Менеджер истории транскрипции
 * Управляет сохранением, загрузкой и миграцией данных истории транскрипции
 */

import * as vscode from 'vscode';
import { 
	TranscriptionEntry, 
	TranscriptionHistory, 
	AddEntryOptions, 
	HistoryOperationResult,
	TRANSCRIPTION_HISTORY_CONSTANTS,
	RecordingMode
} from '../types/TranscriptionHistory';
import { ExtensionLog } from '../utils/GlobalOutput';
import { ErrorHandler, ErrorType, ErrorContext } from '../utils/ErrorHandler';

/**
 * Класс для управления историей транскрипций
 */
export class TranscriptionHistoryManager {
	private context: vscode.ExtensionContext;
	private errorHandler: ErrorHandler;
	private _history: TranscriptionHistory | null = null;

	constructor(context: vscode.ExtensionContext, errorHandler: ErrorHandler) {
		this.context = context;
		this.errorHandler = errorHandler;
		
		ExtensionLog.info('TranscriptionHistoryManager initialized');
	}

	/**
	 * Инициализация менеджера - загрузка истории из storage
	 */
	public async initialize(): Promise<HistoryOperationResult> {
		try {
			const result = await this.loadHistory();
			if (result.success) {
				ExtensionLog.info(`History loaded successfully. Entries count: ${this._history?.entries.length || 0}`);
			}
			return result;
		} catch (error) {
			const errorMsg = `Failed to initialize TranscriptionHistoryManager: ${error instanceof Error ? error.message : String(error)}`;
			ExtensionLog.error(errorMsg);
			
			// Создаем новую пустую историю при ошибке инициализации
			this._history = this.createEmptyHistory();
			
			return {
				success: false,
				error: errorMsg,
				data: { fallbackUsed: true }
			};
		}
	}

	/**
	 * Добавление новой записи в историю
	 */
	public async addEntry(options: AddEntryOptions): Promise<HistoryOperationResult> {
		try {
			if (!this._history) {
				await this.initialize();
			}

			// Создаем новую запись
			const entry: TranscriptionEntry = {
				id: this.generateEntryId(),
				text: options.text.trim(),
				timestamp: options.timestamp || new Date().toISOString(),
				duration: options.duration,
				language: options.language,
				mode: options.mode
			};

			// Добавляем в начало массива (новые записи сверху)
			this._history!.entries.unshift(entry);

			// Применяем лимит на количество записей
			this.enforceMaxEntries();

			// Обновляем время последнего изменения
			this._history!.lastUpdated = new Date().toISOString();

			// Сохраняем в storage
			const saveResult = await this.saveHistory();
			if (saveResult.success) {
				ExtensionLog.info(`Transcription entry added. ID: ${entry.id}, Length: ${entry.text.length} chars`);
				return {
					success: true,
					data: { entry, totalEntries: this._history!.entries.length }
				};
			}

			return saveResult;
		} catch (error) {
			const errorContext: ErrorContext = {
				operation: 'addEntry',
				timestamp: new Date(),
				additionalData: { optionsReceived: !!options }
			};

			return this.handleError(error, errorContext);
		}
	}

	/**
	 * Удаление записи по ID
	 */
	public async removeEntry(entryId: string): Promise<HistoryOperationResult> {
		try {
			if (!this._history) {
				await this.initialize();
			}

			const initialCount = this._history!.entries.length;
			this._history!.entries = this._history!.entries.filter(entry => entry.id !== entryId);
			
			const removed = this._history!.entries.length < initialCount;
			
			if (removed) {
				this._history!.lastUpdated = new Date().toISOString();
				const saveResult = await this.saveHistory();
				
				if (saveResult.success) {
					ExtensionLog.info(`Transcription entry removed. ID: ${entryId}`);
					return {
						success: true,
						data: { entryId, remainingEntries: this._history!.entries.length }
					};
				}
				
				return saveResult;
			}

			return {
				success: false,
				error: `Entry with ID ${entryId} not found`
			};
		} catch (error) {
			const errorContext: ErrorContext = {
				operation: 'removeEntry',
				timestamp: new Date(),
				additionalData: { entryId }
			};

			return this.handleError(error, errorContext);
		}
	}

	/**
	 * Очистка всей истории
	 */
	public async clearHistory(): Promise<HistoryOperationResult> {
		try {
			this._history = this.createEmptyHistory();
			const saveResult = await this.saveHistory();
			
			if (saveResult.success) {
				ExtensionLog.info('Transcription history cleared');
			}
			
			return saveResult;
		} catch (error) {
			const errorContext: ErrorContext = {
				operation: 'clearHistory',
				timestamp: new Date()
			};

			return this.handleError(error, errorContext);
		}
	}

	/**
	 * Получение всей истории
	 */
	public async getHistory(): Promise<TranscriptionHistory> {
		if (!this._history) {
			await this.initialize();
		}
		
		return this._history || this.createEmptyHistory();
	}

	/**
	 * Получение записи по ID
	 */
	public async getEntry(entryId: string): Promise<TranscriptionEntry | null> {
		const history = await this.getHistory();
		return history.entries.find(entry => entry.id === entryId) || null;
	}

	/**
	 * Получение количества записей
	 */
	public async getEntriesCount(): Promise<number> {
		const history = await this.getHistory();
		return history.entries.length;
	}

	/**
	 * Загрузка истории из VS Code storage
	 */
	private async loadHistory(): Promise<HistoryOperationResult> {
		try {
			const savedData = this.context.globalState.get<any>(TRANSCRIPTION_HISTORY_CONSTANTS.STORAGE_KEY);
			
			if (!savedData) {
				ExtensionLog.info('No existing transcription history found, creating new');
				this._history = this.createEmptyHistory();
				return { success: true, data: { newHistory: true } };
			}

			// Попытка миграции данных при необходимости
			const migrationResult = this.migrateData(savedData);
			this._history = migrationResult.data;

			ExtensionLog.info(`History loaded. Version: ${this._history.version}, Entries: ${this._history.entries.length}`);
			
			return {
				success: true,
				data: { 
					entriesLoaded: this._history.entries.length, 
					migrated: migrationResult.migrated 
				}
			};
		} catch (error) {
			const errorMsg = `Failed to load history: ${error instanceof Error ? error.message : String(error)}`;
			ExtensionLog.error(errorMsg);
			
			// Fallback к пустой истории
			this._history = this.createEmptyHistory();
			
			return {
				success: false,
				error: errorMsg,
				data: { fallbackUsed: true }
			};
		}
	}

	/**
	 * Сохранение истории в VS Code storage
	 */
	private async saveHistory(): Promise<HistoryOperationResult> {
		try {
			if (!this._history) {
				return { success: false, error: 'No history to save' };
			}

			await this.context.globalState.update(TRANSCRIPTION_HISTORY_CONSTANTS.STORAGE_KEY, this._history);
			
			ExtensionLog.info(`History saved. Entries: ${this._history.entries.length}`);
			
			return { success: true };
		} catch (error) {
			const errorMsg = `Failed to save history: ${error instanceof Error ? error.message : String(error)}`;
			ExtensionLog.error(errorMsg);
			
			return {
				success: false,
				error: errorMsg
			};
		}
	}

	/**
	 * Миграция данных из старых форматов
	 */
	private migrateData(savedData: any): { data: TranscriptionHistory; migrated: boolean } {
		// Если данные уже в текущем формате
		if (savedData.version === TRANSCRIPTION_HISTORY_CONSTANTS.CURRENT_VERSION) {
			return { data: savedData as TranscriptionHistory, migrated: false };
		}

		ExtensionLog.info(`Migrating history data from version ${savedData.version || 'unknown'} to ${TRANSCRIPTION_HISTORY_CONSTANTS.CURRENT_VERSION}`);

		// Миграция из старого формата (если есть просто массив записей)
		if (Array.isArray(savedData)) {
			const migratedHistory: TranscriptionHistory = {
				version: TRANSCRIPTION_HISTORY_CONSTANTS.CURRENT_VERSION,
				entries: savedData.map((entry: any, index: number) => ({
					id: entry.id || `migrated_${Date.now()}_${index}`,
					text: entry.text || '',
					timestamp: entry.timestamp || new Date().toISOString(),
					duration: entry.duration || 0,
					language: entry.language || 'auto',
					mode: entry.mode || RecordingMode.INSERT_OR_CLIPBOARD
				})),
				lastUpdated: new Date().toISOString()
			};

			return { data: migratedHistory, migrated: true };
		}

		// Миграция из формата без версии
		if (savedData.entries && !savedData.version) {
			const migratedHistory: TranscriptionHistory = {
				version: TRANSCRIPTION_HISTORY_CONSTANTS.CURRENT_VERSION,
				entries: savedData.entries.map((entry: any, index: number) => ({
					id: entry.id || `migrated_${Date.now()}_${index}`,
					text: entry.text || '',
					timestamp: entry.timestamp || new Date().toISOString(),
					duration: entry.duration || 0,
					language: entry.language || 'auto',
					mode: entry.mode || RecordingMode.INSERT_OR_CLIPBOARD
				})),
				lastUpdated: savedData.lastUpdated || new Date().toISOString()
			};

			return { data: migratedHistory, migrated: true };
		}

		// Если формат неизвестен, создаем пустую историю
		ExtensionLog.warn('Unknown data format during migration, creating empty history');
		return { data: this.createEmptyHistory(), migrated: true };
	}

	/**
	 * Создание пустой истории
	 */
	private createEmptyHistory(): TranscriptionHistory {
		return {
			version: TRANSCRIPTION_HISTORY_CONSTANTS.CURRENT_VERSION,
			entries: [],
			lastUpdated: new Date().toISOString()
		};
	}

	/**
	 * Применение лимита максимального количества записей
	 */
	private enforceMaxEntries(): void {
		if (!this._history) {
			return;
		}

		const maxEntries = TRANSCRIPTION_HISTORY_CONSTANTS.MAX_ENTRIES;
		if (this._history.entries.length > maxEntries) {
			const removedCount = this._history.entries.length - maxEntries;
			this._history.entries = this._history.entries.slice(0, maxEntries);
			
			ExtensionLog.info(`Trimmed history: removed ${removedCount} oldest entries. Current count: ${this._history.entries.length}`);
		}
	}

	/**
	 * Генерация уникального ID для записи
	 */
	private generateEntryId(): string {
		return `entry_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
	}

	/**
	 * Обработка ошибок
	 */
	private handleError(error: any, context: ErrorContext): HistoryOperationResult {
		const errorMsg = error instanceof Error ? error.message : String(error);
		
		this.errorHandler.handleError(
			ErrorType.UNKNOWN_ERROR,
			context,
			error instanceof Error ? error : new Error(errorMsg)
		);

		return {
			success: false,
			error: errorMsg
		};
	}
} 