# Changelog

## [Unreleased]

### Fixed
- Fixed status bar display during post-processing - now shows "AI Processing" animation
- Added detailed logging for debugging silence detection and maximum recording duration issues
- Added logging of stopRecording() call source for diagnosing automatic recording stop issues
- Improved silence detection sensitivity - default threshold changed from 20 to 50 (-50dB more sensitive)
- Increased minimum recording time from 5 to 10 seconds before silence detection activates
- Enhanced volume detection logging to better track audio activity vs silence
- Added comprehensive request/response logging for Whisper API calls
- Added comprehensive request/response logging for OpenAI post-processing API calls
- Fixed status bar not showing animation during post-processing phase
- Fixed recording automatically stopping after 507 seconds due to silence detection issues (added extensive debugging)
- Fixed "No active editor" error after post-processing by implementing proper fallback to clipboard when no editor is available

### Changed
- Removed diff view function between original and improved text
- Added 4 new functions for working with transcription history:
  - Copy original text (Whisper)
  - Copy improved text (AI)
  - Insert original text
  - Insert improved text
- Updated transcription history context menu with new commands

### Technical
- Updated commands in package.json for new copy/paste functions
- Added private method insertTextDirectly() for direct text insertion at cursor
- Improved silence detection logging and max duration timer logging
- Added post-processing state to animated status bar states
- Enhanced error tracking with call stack logging in stopRecording()

## Previous versions
<!-- Add previous changelog entries here --> 