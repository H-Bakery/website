/**
 * Sanity test to verify that the Jest testing framework is working correctly
 */

describe('Sanity check', () => {
  test('Jest is working', () => {
    expect(1 + 1).toBe(2);
  });

  test('Async/await works', async () => {
    const asyncFn = () => Promise.resolve(42);
    const result = await asyncFn();
    expect(result).toBe(42);
  });

  test('Mocks work', () => {
    const mockFn = jest.fn().mockReturnValue('mocked');
    expect(mockFn()).toBe('mocked');
    expect(mockFn).toHaveBeenCalled();
  });

  test('ES6 features work', () => {
    // Arrow function
    const add = (a, b) => a + b;
    expect(add(2, 3)).toBe(5);
    
    // Template literals
    const name = 'Jest';
    expect(`Hello ${name}`).toBe('Hello Jest');
    
    // Destructuring
    const obj = { a: 1, b: 2 };
    const { a, b } = obj;
    expect(a).toBe(1);
    expect(b).toBe(2);
  });
});