# Лучшие практики тестирования для VS Code Speech-to-Text

## 📋 Содержание
- [Принципы эффективного тестирования](#принципы-эффективного-тестирования)
- [Паттерны тестирования](#паттерны-тестирования)
- [Обнаружение скрытых ошибок](#обнаружение-скрытых-ошибок)
- [Примеры из практики](#примеры-из-практики)

## 🎯 Принципы эффективного тестирования

### 1. Тестируйте поведение, а не реализацию
```typescript
// ❌ Плохо: тестируем только конфигурацию
it('should set silenceDetection to false', () => {
  const config = { silenceDetection: false };
  expect(config.silenceDetection).to.be.false;
});

// ✅ Хорошо: тестируем поведение
it('should not call clearSilenceTimer when silenceDetection is disabled', () => {
  const recorder = new FFmpegAudioRecorder(config);
  const spy = sinon.spy(recorder, 'clearSilenceTimer');
  
  recorder.startRecording();
  recorder.stopRecording();
  
  expect(spy).to.not.have.been.called;
});
```

### 2. Используйте spy для критических методов
```typescript
// Отслеживание вызовов приватных методов
const clearSilenceTimerSpy = sinon.spy(recorder, 'clearSilenceTimer');
const clearMaxDurationTimerSpy = sinon.spy(recorder, 'clearMaxDurationTimer');
```

### 3. Тестируйте полный жизненный цикл
```typescript
it('should handle complete recording lifecycle', async () => {
  // 1. Инициализация
  const recorder = new FFmpegAudioRecorder(config);
  
  // 2. Запуск
  await recorder.startRecording();
  expect(onRecordingStartSpy).to.have.been.called;
  
  // 3. Остановка
  await recorder.stopRecording();
  expect(onRecordingStopSpy).to.have.been.called;
  
  // 4. Очистка ресурсов
  expect(clearTimersSpy).to.have.been.called;
});
```

## 🔍 Паттерны тестирования

### Spy Pattern для приватных методов
```typescript
class TestableRecorder extends FFmpegAudioRecorder {
  // Делаем приватные методы доступными для тестирования
  public clearSilenceTimer() {
    return super.clearSilenceTimer();
  }
  
  public clearMaxDurationTimer() {
    return super.clearMaxDurationTimer();
  }
}
```

### Event-driven Testing
```typescript
it('should emit events in correct order', (done) => {
  const events: string[] = [];
  
  recorder.on('recordingStart', () => events.push('start'));
  recorder.on('recordingStop', () => events.push('stop'));
  recorder.on('recordingComplete', () => {
    expect(events).to.deep.equal(['start', 'stop']);
    done();
  });
  
  recorder.startRecording();
  recorder.stopRecording();
});
```

### Regression Testing
```typescript
describe('Regression Tests', () => {
  it('should fix silenceDetection timer cleanup bug', () => {
    // Специфический тест для конкретной ошибки
    const config = { silenceDetection: false };
    const recorder = new FFmpegAudioRecorder(config);
    const spy = sinon.spy(recorder, 'clearSilenceTimer');
    
    recorder.startRecording();
    recorder.stopRecording();
    
    // Этот тест должен пройти после исправления
    expect(spy).to.have.been.called;
  });
});
```

## 🐛 Обнаружение скрытых ошибок

### Проблемы существующих тестов
1. **Ограниченная область покрытия**
   - Тестировали только конфигурацию
   - Игнорировали внутреннюю логику
   - Не проверяли побочные эффекты

2. **Отсутствие проверки состояния**
   - Не отслеживали вызовы методов очистки
   - Не проверяли корректность событий
   - Не симулировали реальные сценарии

### Решение через comprehensive тесты
```typescript
describe('Comprehensive Timer Management', () => {
  let recorder: FFmpegAudioRecorder;
  let clearSilenceTimerSpy: sinon.SinonSpy;
  let clearMaxDurationTimerSpy: sinon.SinonSpy;
  
  beforeEach(() => {
    recorder = new FFmpegAudioRecorder(config);
    clearSilenceTimerSpy = sinon.spy(recorder, 'clearSilenceTimer');
    clearMaxDurationTimerSpy = sinon.spy(recorder, 'clearMaxDurationTimer');
  });
  
  it('should clean up all timers on stop', async () => {
    await recorder.startRecording();
    await recorder.stopRecording();
    
    expect(clearSilenceTimerSpy).to.have.been.called;
    expect(clearMaxDurationTimerSpy).to.have.been.called;
  });
});
```

## 📚 Примеры из практики

### Случай: FFmpegAudioRecorder Timer Bug

**Проблема:** При `silenceDetection: false` таймеры не очищались, что приводило к утечкам памяти.

**Почему не обнаружили ранее:**
```typescript
// Старый тест - проверял только конфигурацию
it('should handle silenceDetection config', () => {
  const config = { silenceDetection: false };
  const recorder = new FFmpegAudioRecorder(config);
  expect(recorder.config.silenceDetection).to.be.false;
});
```

**Новый подход:**
```typescript
// Comprehensive тест - проверяет поведение
it('should clean timers regardless of silenceDetection setting', () => {
  const config = { silenceDetection: false };
  const recorder = new FFmpegAudioRecorder(config);
  const spy = sinon.spy(recorder, 'clearSilenceTimer');
  
  recorder.startRecording();
  recorder.stopRecording();
  
  expect(spy).to.have.been.called; // Этот тест выявил ошибку!
});
```

**Результат:** Тест выявил 2 failing случая, что привело к исправлению бага.

## 🎓 Ключевые уроки

1. **Spy важнее Mock** - для отслеживания вызовов методов
2. **События важнее состояния** - для проверки flow
3. **Lifecycle важнее unit** - для comprehensive покрытия
4. **Regression важнее feature** - для предотвращения возврата багов
5. **Behavior важнее config** - для реального тестирования

## 🔧 Инструменты и библиотеки

- **Sinon.js** - для spy и stub
- **Mocha** - для структуры тестов  
- **Chai** - для assertions
- **TypeScript** - для типизации тестов

## 📈 Метрики качества тестов

### Хорошие показатели:
- ✅ Покрытие поведения > 80%
- ✅ Время выполнения < 5 сек на тест
- ✅ 0 flaky тестов
- ✅ Регулярные regression тесты

### Плохие показатели:
- ❌ Только config тесты
- ❌ Игнорирование приватных методов
- ❌ Отсутствие lifecycle тестов
- ❌ Нет spy на критические операции

---

*Этот документ основан на реальном опыте обнаружения и исправления скрытых ошибок в VS Code Speech-to-Text extension.* 