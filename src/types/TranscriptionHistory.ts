/**
 * Types and interfaces for the transcription history
 */

/**
 * Recording modes (duplicated from extension.ts to avoid circular dependencies)
 */
export enum RecordingMode {
	INSERT_OR_CLIPBOARD = 'insertOrClipboard',  // Ctrl+Shift+M - insert into cursor or clipboard
	INSERT_AT_CURRENT_CHAT = 'insertAtCurrentChat'                        // Ctrl+Shift+N - insert into the current chat Cursor
}

/**
 * Transcription history entry
 */
export interface TranscriptionEntry {
	/** Unique identifier of the entry */
	id: string;
	
	/** Full transcription text (final version) */
	text: string;
	
	/** Creation time of the transcription (ISO string) */
	timestamp: string;
	
	/** Duration of the audio recording in milliseconds */
	duration: number;
	
	/** Language of the transcription */
	language: string;
	
	/** Recording mode during transcription */
	mode: RecordingMode;
	
	/** Post-processing related fields */
	/** Original text from Whisper before post-processing */
	originalText?: string;
	
	/** Whether post-processing was applied */
	isPostProcessed?: boolean;
	
	/** AI model used for post-processing */
	postProcessingModel?: string;
}

/**
 * Group of entries by date
 */
export interface TranscriptionGroup {
	/** Group name (today, yesterday, current week, older) */
	label: string;
	
	/** Entries in the group */
	entries: TranscriptionEntry[];
	
	/** Sorting key */
	sortKey: number;
}

/**
 * Structure for storing the transcription history
 */
export interface TranscriptionHistory {
	/** Version of the data format */
	version: string;
	
	/** Array of transcription entries (maximum 100) */
	entries: TranscriptionEntry[];
	
	/** Time of the last update */
	lastUpdated: string;
}

/**
 * Options for adding an entry to the history
 */
export interface AddEntryOptions {
	/** Final transcription text */
	text: string;
	
	/** Duration of the audio in milliseconds */
	duration: number;
	
	/** Language of the transcription */
	language: string;
	
	/** Recording mode */
	mode: RecordingMode;
	
	/** Optional - user timestamp */
	timestamp?: string;
	
	/** Post-processing related fields */
	/** Original text from Whisper before post-processing */
	originalText?: string;
	
	/** Whether post-processing was applied */
	isPostProcessed?: boolean;
	
	/** AI model used for post-processing */
	postProcessingModel?: string;
}

/**
 * Result of the history operation
 */
export interface HistoryOperationResult {
	/** Success of the operation */
	success: boolean;
	
	/** Error message, if any */
	error?: string;
	
	/** Additional data */
	data?: any;
}

/**
 * Categories of grouping by date
 */
export enum DateGroupCategory {
	TODAY = 'today',
	YESTERDAY = 'yesterday',
	THIS_WEEK = 'thisWeek',
	OLDER = 'older'
}

/**
 * Metadata for display of the entry
 */
export interface TranscriptionEntryMetadata {
	/** Short display (first 50 characters) */
	preview: string;
	
	/** Full text for tooltip */
	fullText: string;
	
	/** Formatted time */
	formattedTime: string;
	
	/** Relative time (e.g., "2 hours ago") */
	relativeTime: string;
	
	/** Information about the duration */
	durationText: string;
}

/**
 * Constants for the transcription history
 */
export const TRANSCRIPTION_HISTORY_CONSTANTS = {
	/** Maximum number of entries in the history */
	MAX_ENTRIES: 100,
	
	/** Version of the current data format */
	CURRENT_VERSION: '1.0.0',
	
	/** Maximum length of the preview text */
	PREVIEW_LENGTH: 50,
	
	/** Key for storing in VS Code storage */
	STORAGE_KEY: 'transcriptionHistory'
} as const; 