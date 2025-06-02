it('should get platform commands for detected platform', () => {
    const commands = FFmpegAudioRecorder.getPlatformCommands();
    
    assert.ok(commands.platform, 'Platform should be detected');
    assert.ok(commands.audioInput, 'Audio input command should be provided');
    assert.ok(commands.defaultDevice, 'Default device should be provided');
    
    // Проверяем что команды соответствуют платформе
    if (commands.platform === 'macos') {
        assert.ok(commands.audioInput.includes('avfoundation'), 'macOS should use avfoundation');
    } else if (commands.platform === 'windows') {
        assert.ok(commands.audioInput.includes('dshow'), 'Windows should use dshow');
    } else if (commands.platform === 'linux') {
        assert.ok(commands.audioInput.includes('pulse'), 'Linux should use pulse');
    }
}); 