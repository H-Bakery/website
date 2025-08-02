const { validationResult } = require('express-validator');
const { handleValidationErrors } = require('../../middleware/validationMiddleware');

// Mock express-validator
jest.mock('express-validator');

describe('Validation Middleware', () => {
  let req, res, next;
  
  beforeEach(() => {
    req = {};
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    next = jest.fn();
  });
  
  afterEach(() => {
    jest.clearAllMocks();
  });
  
  it('should call next() when no validation errors', () => {
    validationResult.mockReturnValue({
      isEmpty: () => true,
      array: () => []
    });
    
    handleValidationErrors(req, res, next);
    
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });
  
  it('should return 422 with errors when validation fails', () => {
    const errors = [
      {
        msg: 'Username is required',
        param: 'username',
        location: 'body'
      },
      {
        msg: 'Invalid email',
        param: 'email',
        location: 'body'
      }
    ];
    
    validationResult.mockReturnValue({
      isEmpty: () => false,
      array: () => errors
    });
    
    handleValidationErrors(req, res, next);
    
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Validation failed',
      errors: [
        {
          field: 'username',
          message: 'Username is required',
          value: undefined,
          location: 'body'
        },
        {
          field: 'email',
          message: 'Invalid email',
          value: undefined,
          location: 'body'
        }
      ]
    });
  });
  
  it('should handle nested parameter errors', () => {
    const errors = [
      {
        msg: 'Must be positive',
        param: 'items[0].quantity',
        location: 'body'
      },
      {
        msg: 'Invalid ID',
        param: 'items[1].productId',
        location: 'body'
      }
    ];
    
    validationResult.mockReturnValue({
      isEmpty: () => false,
      array: () => errors
    });
    
    handleValidationErrors(req, res, next);
    
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Validation failed',
      errors: [
        {
          field: 'items[0].quantity',
          message: 'Must be positive',
          value: undefined,
          location: 'body'
        },
        {
          field: 'items[1].productId',
          message: 'Invalid ID',
          value: undefined,
          location: 'body'
        }
      ]
    });
  });
  
  it('should combine multiple errors for the same field', () => {
    const errors = [
      {
        msg: 'Password is required',
        param: 'password',
        location: 'body'
      },
      {
        msg: 'Password must be at least 8 characters',
        param: 'password',
        location: 'body'
      }
    ];
    
    validationResult.mockReturnValue({
      isEmpty: () => false,
      array: () => errors
    });
    
    handleValidationErrors(req, res, next);
    
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Validation failed',
      errors: [
        {
          field: 'password',
          message: 'Password is required',
          value: undefined,
          location: 'body'
        },
        {
          field: 'password',
          message: 'Password must be at least 8 characters',
          value: undefined,
          location: 'body'
        }
      ]
    });
  });
});