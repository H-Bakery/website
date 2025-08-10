import { EventBusService, eventBus } from './event-bus.service';

describe('EventBusService', () => {
  let service: EventBusService;

  beforeEach(() => {
    service = EventBusService.getInstance();
  });

  afterEach(() => {
    // Clean up listeners after each test
    service.removeAllListeners();
  });

  it('should be a singleton', () => {
    const instance1 = EventBusService.getInstance();
    const instance2 = EventBusService.getInstance();
    
    expect(instance1).toBe(instance2);
    expect(instance1).toBe(eventBus);
  });

  it('should emit and listen to events', (done) => {
    const testEvent = 'test.event';
    const testPayload = { message: 'Hello World', timestamp: Date.now() };

    service.safeOn(testEvent, (payload) => {
      expect(payload).toEqual(testPayload);
      done();
    });

    service.safeEmit(testEvent, testPayload);
  });

  it('should handle multiple listeners for the same event', () => {
    const testEvent = 'test.multiple';
    const testPayload = { value: 42 };
    const handlers = [jest.fn(), jest.fn(), jest.fn()];

    // Add multiple listeners
    handlers.forEach(handler => {
      service.safeOn(testEvent, handler);
    });

    // Emit event
    service.safeEmit(testEvent, testPayload);

    // All handlers should have been called
    handlers.forEach(handler => {
      expect(handler).toHaveBeenCalledWith(testPayload);
      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  it('should handle errors in event handlers gracefully', () => {
    const testEvent = 'test.error';
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

    // Add a handler that throws an error
    service.safeOn(testEvent, () => {
      throw new Error('Test error');
    });

    // This should not throw
    expect(() => {
      service.safeEmit(testEvent, { data: 'test' });
    }).not.toThrow();

    // Error should be logged
    expect(consoleErrorSpy).toHaveBeenCalled();
    
    consoleErrorSpy.mockRestore();
  });

  it('should handle once listeners correctly', () => {
    const testEvent = 'test.once';
    const testPayload = { count: 1 };
    const handler = jest.fn();

    service.safeOnce(testEvent, handler);

    // Emit event twice
    service.safeEmit(testEvent, testPayload);
    service.safeEmit(testEvent, testPayload);

    // Handler should only be called once
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(testPayload);
  });

  it('should provide diagnostic information', () => {
    const diagnostics = service.getDiagnostics();

    expect(diagnostics).toHaveProperty('listenerCount');
    expect(diagnostics).toHaveProperty('eventNames');
    expect(diagnostics).toHaveProperty('maxListeners');
    expect(Array.isArray(diagnostics.eventNames)).toBe(true);
  });

  it('should handle event emission errors gracefully', () => {
    const testEvent = 'test.emit.error';
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

    // Mock emit to throw an error
    const originalEmit = service.emit;
    service.emit = jest.fn().mockImplementation(() => {
      throw new Error('Emit error');
    });

    const result = service.safeEmit(testEvent, { data: 'test' });

    expect(result).toBe(false);
    expect(consoleErrorSpy).toHaveBeenCalled();

    // Restore original method
    service.emit = originalEmit;
    consoleErrorSpy.mockRestore();
  });
});