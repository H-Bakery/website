# Bakery Backend Middleware Directory

This directory contains Express middleware functions used throughout the bakery application to handle cross-cutting concerns.

## Key Middleware

- `authMiddleware.js` - Authentication and authorization middleware that verifies JWT tokens
- `loggerMiddleware.js` - Request logging middleware that logs incoming HTTP requests

## Authentication Middleware

The authentication middleware:
1. Extracts the JWT token from the Authorization header
2. Verifies the token's validity
3. Attaches the user information to the request object if authenticated
4. Restricts access to protected routes for unauthenticated users

## Logger Middleware

The logger middleware:
1. Logs details about incoming HTTP requests (method, path, IP)
2. Records request timestamps
3. Can track response times
4. Uses the application's logger utility for consistent logging

## Middleware Usage

Middleware can be applied:
- Globally to all routes
- To specific route groups
- To individual routes

## Flow of Middleware

```
Client Request → [Logger Middleware] → [Auth Middleware] → Controller → Response
```

## Code Style

- No semicolons
- Express middleware pattern (req, res, next)
- Async/await for authentication verification
- Clear error messages for authentication failures

## Usage Example

```javascript
// Global middleware in index.js
app.use(loggerMiddleware);

// Protected routes
router.get('/protected', authMiddleware, protectedController.someMethod);
```

This directory could be expanded to include other middleware such as:
- Request validation
- Rate limiting
- CORS configuration
- Error handling