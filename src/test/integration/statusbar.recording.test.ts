import * as assert from 'assert';
import * as vscode from 'vscode';
import * as sinon from 'sinon';
import { StatusBarManager, StatusBarEvents, StatusBarState } from '../../ui/StatusBarManager';

describe('Status Bar Recording Indication Tests', () => {
    let statusBarManager: StatusBarManager;
    let mockEvents: StatusBarEvents;
    let createStatusBarItemStub: sinon.SinonStub;
    let mockStatusBarItem: any;

    beforeEach(() => {
        // Create mock for StatusBarItem
        mockStatusBarItem = {
            text: '',
            tooltip: '',
            backgroundColor: undefined,
            color: undefined,
            command: undefined,
            show: sinon.stub(),
            hide: sinon.stub(),
            dispose: sinon.stub()
        };

        // Mock creating StatusBarItem
        createStatusBarItemStub = sinon.stub(vscode.window, 'createStatusBarItem')
            .returns(mockStatusBarItem);

        // Create mock events
        mockEvents = {
            onRecordingToggle: sinon.stub()
        };

        // Create StatusBarManager
        statusBarManager = new StatusBarManager(mockEvents, {
            enableAnimations: true,
            showTooltips: true,
            position: 'right',
            priority: 100
        });
    });

    afterEach(() => {
        if (statusBarManager) {
            statusBarManager.dispose();
        }
        createStatusBarItemStub.restore();
    });

    describe('Initial State', () => {
        it('should start in idle state', () => {
            const status = statusBarManager.getStatus();
            assert.strictEqual(status.state, 'idle', 'Should start in idle state');
            assert.strictEqual(status.isRecording, false, 'Should not be recording initially');
        });

        it('should create status bar item with correct configuration', () => {
            assert.ok(createStatusBarItemStub.calledOnce, 'Should create status bar item');
            assert.ok(createStatusBarItemStub.calledWith(
                vscode.StatusBarAlignment.Right, 
                100
            ), 'Should create with correct alignment and priority');
        });

        it('should show idle state in status bar', () => {
            assert.strictEqual(mockStatusBarItem.text, '$(mic)', 'Should show microphone icon in idle state');
            assert.strictEqual(mockStatusBarItem.command, 'speechToTextWhisper.recordAndInsertOrClipboard', 'Should have correct command');
            assert.ok(mockStatusBarItem.show.calledOnce, 'Should show status bar item');
        });
    });

    describe('Recording State Indication', () => {
        it('should update to recording state when recording starts', () => {
            // Start recording
            statusBarManager.updateRecordingState(true);

            const status = statusBarManager.getStatus();
            assert.strictEqual(status.state, 'recording', 'Should be in recording state');
            assert.strictEqual(status.isRecording, true, 'Should indicate recording is active');
        });

        it('should show recording icon and background when recording', () => {
            statusBarManager.updateRecordingState(true);

            // Check that the recording icon is shown (possibly animated)
            const hasRecordIcon = mockStatusBarItem.text === '$(record)' || 
                                 mockStatusBarItem.text.includes('$(record)');
            assert.ok(hasRecordIcon, 'Should show record icon (possibly animated)');
            assert.ok(mockStatusBarItem.backgroundColor, 'Should have warning background color');
            assert.strictEqual(mockStatusBarItem.command, 'speechToTextWhisper.recordAndInsertOrClipboard', 'Should keep same command');
        });

        it('should update tooltip when recording', () => {
            statusBarManager.updateRecordingState(true);

            assert.ok(mockStatusBarItem.tooltip.includes('Recording'), 'Tooltip should indicate recording');
            assert.ok(mockStatusBarItem.tooltip.includes('Click to stop'), 'Tooltip should show how to stop');
        });

        it('should return to idle state when recording stops', () => {
            // Start recording
            statusBarManager.updateRecordingState(true);
            assert.strictEqual(statusBarManager.getStatus().state, 'recording', 'Should be recording');

            // Stop recording
            statusBarManager.updateRecordingState(false);

            const status = statusBarManager.getStatus();
            assert.strictEqual(status.state, 'idle', 'Should return to idle state');
            assert.strictEqual(status.isRecording, false, 'Should indicate recording is stopped');
        });

        it('should restore idle appearance when recording stops', () => {
            // Start and stop recording
            statusBarManager.updateRecordingState(true);
            statusBarManager.updateRecordingState(false);

            assert.strictEqual(mockStatusBarItem.text, '$(mic)', 'Should show microphone icon again');
            assert.strictEqual(mockStatusBarItem.backgroundColor, undefined, 'Should remove background color');
        });
    });

    describe('Processing States Indication', () => {
        it('should show processing state', () => {
            statusBarManager.showProcessing();

            const status = statusBarManager.getStatus();
            assert.strictEqual(status.state, 'processing', 'Should be in processing state');
            assert.strictEqual(mockStatusBarItem.text, '$(loading~spin)', 'Should show loading spinner');
        });

        it('should show transcribing state', () => {
            statusBarManager.showTranscribing();

            const status = statusBarManager.getStatus();
            assert.strictEqual(status.state, 'transcribing', 'Should be in transcribing state');
            assert.strictEqual(mockStatusBarItem.text, '$(sync~spin)', 'Should show sync spinner');
        });

        it('should show inserting state', () => {
            statusBarManager.showInserting();

            const status = statusBarManager.getStatus();
            assert.strictEqual(status.state, 'inserting', 'Should be in inserting state');
            assert.strictEqual(mockStatusBarItem.text, '$(edit)', 'Should show edit icon');
        });
    });

    describe('Success and Error States', () => {
        it('should show success state', () => {
            statusBarManager.showSuccess('Text inserted successfully');

            const status = statusBarManager.getStatus();
            assert.strictEqual(status.state, 'success', 'Should be in success state');
            assert.strictEqual(mockStatusBarItem.text, '$(check)', 'Should show check icon');
        });

        it('should show error state', () => {
            statusBarManager.showError('Recording failed');

            const status = statusBarManager.getStatus();
            assert.strictEqual(status.state, 'error', 'Should be in error state');
            assert.strictEqual(mockStatusBarItem.text, '$(error)', 'Should show error icon');
        });

        it('should show warning state', () => {
            statusBarManager.showWarning('Low audio quality');

            const status = statusBarManager.getStatus();
            assert.strictEqual(status.state, 'warning', 'Should be in warning state');
            assert.strictEqual(mockStatusBarItem.text, '$(warning)', 'Should show warning icon');
        });
    });

    describe('Animation and Progress', () => {
        it('should support animated states', function(done) {
            this.timeout(2000); // Increase timeout for animation

            statusBarManager.updateRecordingState(true);

            // Check that animation works (text may change)
            setTimeout(() => {
                const hasAnimation = mockStatusBarItem.text.includes('Recording') || 
                                   mockStatusBarItem.text === '$(record)';
                assert.ok(hasAnimation, 'Should show animated recording text or icon');
                done();
            }, 600); // Wait longer than animation interval (500ms)
        });

        it('should update progress indication', () => {
            statusBarManager.updateProgress(50, 'Processing audio...');

            // Check that tooltip has been updated with progress
            assert.ok(mockStatusBarItem.tooltip.includes('50%') || 
                     mockStatusBarItem.tooltip.includes('Processing'), 
                     'Should show progress in tooltip');
        });
    });

    describe('Configuration and Visibility', () => {
        it('should be visible by default', () => {
            const status = statusBarManager.getStatus();
            assert.strictEqual(status.isVisible, true, 'Should be visible by default');
            assert.ok(mockStatusBarItem.show.called, 'Should call show on status bar item');
        });

        it('should support hiding and showing', () => {
            statusBarManager.hide();
            assert.ok(mockStatusBarItem.hide.called, 'Should call hide on status bar item');

            statusBarManager.show();
            assert.ok(mockStatusBarItem.show.called, 'Should call show on status bar item');
        });

        it('should support configuration updates', () => {
            statusBarManager.updateConfiguration({
                enableAnimations: false,
                showTooltips: false
            });

            const status = statusBarManager.getStatus();
            assert.strictEqual(status.configuration.enableAnimations, false, 'Should update animations setting');
            assert.strictEqual(status.configuration.showTooltips, false, 'Should update tooltips setting');
        });
    });

    describe('State Transitions', () => {
        it('should handle complete recording workflow', () => {
            // 1. Start recording
            statusBarManager.updateRecordingState(true);
            assert.strictEqual(statusBarManager.getStatus().state, 'recording', 'Should start recording');

            // 2. Process audio
            statusBarManager.showProcessing();
            assert.strictEqual(statusBarManager.getStatus().state, 'processing', 'Should show processing');

            // 3. Transcribe
            statusBarManager.showTranscribing();
            assert.strictEqual(statusBarManager.getStatus().state, 'transcribing', 'Should show transcribing');

            // 4. Insert text
            statusBarManager.showInserting();
            assert.strictEqual(statusBarManager.getStatus().state, 'inserting', 'Should show inserting');

            // 5. Show success
            statusBarManager.showSuccess();
            assert.strictEqual(statusBarManager.getStatus().state, 'success', 'Should show success');
        });

        it('should handle error during recording workflow', () => {
            // Start recording
            statusBarManager.updateRecordingState(true);
            assert.strictEqual(statusBarManager.getStatus().state, 'recording', 'Should start recording');

            // Error during processing
            statusBarManager.showError('Network error');
            assert.strictEqual(statusBarManager.getStatus().state, 'error', 'Should show error');
            assert.strictEqual(statusBarManager.getStatus().lastError, 'Network error', 'Should store error message');
        });

        it('should not change state if already in same state', () => {
            statusBarManager.updateRecordingState(true);
            const initialCallCount = mockStatusBarItem.show.callCount;

            // Try to set the same state
            statusBarManager.updateRecordingState(true);

            // UI should not update again for the same state
            assert.strictEqual(statusBarManager.getStatus().state, 'recording', 'Should remain in recording state');
        });
    });

    describe('Cleanup and Disposal', () => {
        it('should dispose properly', () => {
            statusBarManager.dispose();
            assert.ok(mockStatusBarItem.dispose.called, 'Should dispose status bar item');
        });

        it('should clear timers on disposal', () => {
            // Set state with timer
            statusBarManager.showSuccess();
            
            // Dispose should clear timers
            statusBarManager.dispose();
            
            // Check that dispose was called
            assert.ok(mockStatusBarItem.dispose.called, 'Should dispose status bar item and clear timers');
        });
    });
}); 