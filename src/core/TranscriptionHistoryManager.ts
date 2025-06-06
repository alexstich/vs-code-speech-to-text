/**
 * Transcription history manager
 * Manages saving, loading, and migrating transcription history data
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
 * Class for managing transcription history
 */
export class TranscriptionHistoryManager {
	private context: vscode.ExtensionContext;
	private errorHandler: ErrorHandler;
	private _history: TranscriptionHistory | null = null;

	constructor(context: vscode.ExtensionContext, errorHandler: ErrorHandler) {
		this.context = context;
		this.errorHandler = errorHandler;
	}

	/**
	 * Initialization of the manager - loading history from storage
	 */
	public async initialize(): Promise<HistoryOperationResult> {
		try {
			const result = await this.loadHistory();
			return result;
		} catch (error) {
			const errorMsg = `Failed to initialize TranscriptionHistoryManager: ${error instanceof Error ? error.message : String(error)}`;
			ExtensionLog.error(errorMsg);
			
			// Create a new empty history on initialization error
			this._history = this.createEmptyHistory();
			
			return {
				success: false,
				error: errorMsg,
				data: { fallbackUsed: true }
			};
		}
	}

	/**
	 * Adding a new entry to the history
	 */
	public async addEntry(options: AddEntryOptions): Promise<HistoryOperationResult> {
		try {
			if (!this._history) {
				await this.initialize();
			}

			// Create a new entry
			const entry: TranscriptionEntry = {
				id: this.generateEntryId(),
				text: options.text.trim(),
				timestamp: options.timestamp || new Date().toISOString(),
				duration: options.duration,
				language: options.language,
				mode: options.mode
			};

			// Add to the beginning of the array (new entries on top)
			this._history!.entries.unshift(entry);

			// Apply the limit on the number of entries
			this.enforceMaxEntries();

			// Update the time of the last change
			this._history!.lastUpdated = new Date().toISOString();

			// Save to storage
			const saveResult = await this.saveHistory();
			if (saveResult.success) {
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
	 * Deleting an entry by ID
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
	 * Clearing all history
	 */
	public async clearHistory(): Promise<HistoryOperationResult> {
		try {
			this._history = this.createEmptyHistory();
			const saveResult = await this.saveHistory();
			
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
	 * Getting all history
	 */
	public async getHistory(): Promise<TranscriptionHistory> {
		if (!this._history) {
			await this.initialize();
		}
		
		return this._history || this.createEmptyHistory();
	}

	/**
	 * Getting an entry by ID
	 */
	public async getEntry(entryId: string): Promise<TranscriptionEntry | null> {
		const history = await this.getHistory();
		return history.entries.find(entry => entry.id === entryId) || null;
	}

	/**
	 * Getting the number of entries
	 */
	public async getEntriesCount(): Promise<number> {
		const history = await this.getHistory();
		return history.entries.length;
	}

	/**
	 * Loading history from VS Code storage
	 */
	private async loadHistory(): Promise<HistoryOperationResult> {
		try {
			const savedData = this.context.globalState.get<any>(TRANSCRIPTION_HISTORY_CONSTANTS.STORAGE_KEY);
			
			if (!savedData) {
				this._history = this.createEmptyHistory();
				return { success: true, data: { newHistory: true } };
			}

			// Attempt to migrate data if necessary
			const migrationResult = this.migrateData(savedData);
			this._history = migrationResult.data;
			
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
			
			// Fallback to an empty history
			this._history = this.createEmptyHistory();
			
			return {
				success: false,
				error: errorMsg,
				data: { fallbackUsed: true }
			};
		}
	}

	/**
	 * Saving history to VS Code storage
	 */
	private async saveHistory(): Promise<HistoryOperationResult> {
		try {
			if (!this._history) {
				return { success: false, error: 'No history to save' };
			}

			await this.context.globalState.update(TRANSCRIPTION_HISTORY_CONSTANTS.STORAGE_KEY, this._history);
			
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
	 * Migration of data from old formats
	 */
	private migrateData(savedData: any): { data: TranscriptionHistory; migrated: boolean } {
		// If the data is already in the current format
		if (savedData.version === TRANSCRIPTION_HISTORY_CONSTANTS.CURRENT_VERSION) {
			return { data: savedData as TranscriptionHistory, migrated: false };
		}



		// Migration from the old format (if there is just an array of entries)
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

		// Migration from the format without a version
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

		// If the format is unknown, create an empty history
		ExtensionLog.warn('Unknown data format during migration, creating empty history');
		return { data: this.createEmptyHistory(), migrated: true };
	}

	/**
	 * Creating an empty history
	 */
	private createEmptyHistory(): TranscriptionHistory {
		return {
			version: TRANSCRIPTION_HISTORY_CONSTANTS.CURRENT_VERSION,
			entries: [],
			lastUpdated: new Date().toISOString()
		};
	}

	/**
	 * Applying the limit on the maximum number of entries
	 */
	private enforceMaxEntries(): void {
		if (!this._history) {
			return;
		}

		const maxEntries = TRANSCRIPTION_HISTORY_CONSTANTS.MAX_ENTRIES;
		if (this._history.entries.length > maxEntries) {
			const removedCount = this._history.entries.length - maxEntries;
			this._history.entries = this._history.entries.slice(0, maxEntries);
			

		}
	}

	/**
	 * Generating a unique ID for an entry
	 */
	private generateEntryId(): string {
		return `entry_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
	}

	/**
	 * Handling errors
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