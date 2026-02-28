# Cash Management API Documentation

## Overview

The Cash Management API provides endpoints for creating, reading, updating, and deleting cash entries in the bakery management system. All endpoints require authentication and users can only access their own cash entries.

## Base URL

```
http://localhost:5000/cash
```

## Authentication

All endpoints require authentication using JWT tokens. Include the token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

## Error Responses

All endpoints use standard HTTP status codes and return errors in JSON format:

```json
{
  "error": "Error message description"
}
```

### Common Error Codes

- `400 Bad Request` - Invalid request data or validation errors
- `401 Unauthorized` - Missing or invalid authentication token
- `404 Not Found` - Resource not found or access denied
- `500 Internal Server Error` - Server-side error

## Endpoints

### 1. Create Cash Entry

Creates a new cash entry for the authenticated user.

**Endpoint:** `POST /cash`

**Request Body:**

```json
{
  "amount": 425.75
}
```

**Parameters:**

- `amount` (number, required): The cash amount. Must be >= 0.

**Response:** `200 OK`

```json
{
  "message": "Cash entry saved",
  "entry": {
    "id": 1,
    "amount": 425.75,
    "date": "2024-06-10",
    "createdAt": "2024-06-10T20:30:00.000Z"
  }
}
```

**Error Responses:**

- `400 Bad Request`: Invalid amount or user validation failed
- `401 Unauthorized`: Authentication required

**Example:**

```bash
curl -X POST http://localhost:5000/cash \
  -H "Authorization: Bearer your-jwt-token" \
  -H "Content-Type: application/json" \
  -d '{"amount": 425.75}'
```

---

### 2. Get Cash Entries

Retrieves all cash entries for the authenticated user, ordered by date (newest first).

**Endpoint:** `GET /cash`

**Parameters:** None

**Response:** `200 OK`

```json
[
  {
    "id": 2,
    "amount": 380.5,
    "date": "2024-06-10",
    "createdAt": "2024-06-10T20:30:00.000Z",
    "updatedAt": "2024-06-10T20:30:00.000Z"
  },
  {
    "id": 1,
    "amount": 425.75,
    "date": "2024-06-09",
    "createdAt": "2024-06-09T19:45:00.000Z",
    "updatedAt": "2024-06-09T19:45:00.000Z"
  }
]
```

**Example:**

```bash
curl -X GET http://localhost:5000/cash \
  -H "Authorization: Bearer your-jwt-token"
```

---

### 3. Update Cash Entry

Updates an existing cash entry. Users can only update their own entries.

**Endpoint:** `PUT /cash/:id`

**Parameters:**

- `id` (path parameter): The cash entry ID

**Request Body:**

```json
{
  "amount": 500.0,
  "date": "2024-06-09"
}
```

**Body Parameters:**

- `amount` (number, optional): New amount value. Must be >= 0.
- `date` (string, optional): New date in YYYY-MM-DD format. Cannot be in the future.

**Response:** `200 OK`

```json
{
  "message": "Cash entry updated",
  "entry": {
    "id": 1,
    "amount": 500.0,
    "date": "2024-06-09",
    "updatedAt": "2024-06-10T21:00:00.000Z"
  }
}
```

**Error Responses:**

- `400 Bad Request`: Invalid amount or date format
- `404 Not Found`: Cash entry not found or not owned by user

**Example:**

```bash
curl -X PUT http://localhost:5000/cash/1 \
  -H "Authorization: Bearer your-jwt-token" \
  -H "Content-Type: application/json" \
  -d '{"amount": 500.00, "date": "2024-06-09"}'
```

---

### 4. Delete Cash Entry

Deletes a cash entry. Users can only delete their own entries.

**Endpoint:** `DELETE /cash/:id`

**Parameters:**

- `id` (path parameter): The cash entry ID

**Response:** `200 OK`

```json
{
  "message": "Cash entry deleted",
  "deletedEntry": {
    "id": 1,
    "amount": 425.75,
    "date": "2024-06-09"
  }
}
```

**Error Responses:**

- `404 Not Found`: Cash entry not found or not owned by user

**Example:**

```bash
curl -X DELETE http://localhost:5000/cash/1 \
  -H "Authorization: Bearer your-jwt-token"
```

---

### 5. Get Cash Statistics

Retrieves calculated statistics for the user's cash entries with optional date filtering.

**Endpoint:** `GET /cash/stats`

**Query Parameters:**

- `startDate` (string, optional): Start date for filtering (YYYY-MM-DD format)
- `endDate` (string, optional): End date for filtering (YYYY-MM-DD format)

**Response:** `200 OK`

```json
{
  "totalAmount": 806.25,
  "averageAmount": 403.13,
  "entryCount": 2,
  "latestEntry": {
    "amount": 380.5,
    "date": "2024-06-10"
  },
  "dateRange": {
    "startDate": "2024-06-09",
    "endDate": "2024-06-10"
  }
}
```

**Response Fields:**

- `totalAmount`: Sum of all cash entries in the date range
- `averageAmount`: Average amount per entry (rounded to 2 decimal places)
- `entryCount`: Number of entries in the date range
- `latestEntry`: Most recent entry data (or null if no entries)
- `dateRange`: Actual date range of the data

**Example:**

```bash
# Get all-time statistics
curl -X GET http://localhost:5000/cash/stats \
  -H "Authorization: Bearer your-jwt-token"

# Get statistics for a specific date range
curl -X GET "http://localhost:5000/cash/stats?startDate=2024-06-01&endDate=2024-06-30" \
  -H "Authorization: Bearer your-jwt-token"
```

## Data Models

### Cash Entry Model

```json
{
  "id": 1,
  "UserId": 3,
  "amount": 425.75,
  "date": "2024-06-10",
  "createdAt": "2024-06-10T20:30:00.000Z",
  "updatedAt": "2024-06-10T20:30:00.000Z"
}
```

**Fields:**

- `id`: Unique identifier for the cash entry
- `UserId`: ID of the user who owns this entry
- `amount`: Cash amount (decimal number, >= 0)
- `date`: Date of the cash entry (YYYY-MM-DD format)
- `createdAt`: Timestamp when the entry was created
- `updatedAt`: Timestamp when the entry was last updated

## Validation Rules

### Amount Validation

- Must be a valid number
- Must be greater than or equal to 0
- Supports up to 2 decimal places

### Date Validation

- Must be in YYYY-MM-DD format
- Cannot be in the future
- Defaults to current date when creating new entries

### Authorization

- Users can only access their own cash entries
- All operations are scoped to the authenticated user
- JWT token must be valid and not expired

## Rate Limiting

Currently, no rate limiting is implemented. Consider implementing rate limiting for production use to prevent abuse.

## Best Practices

1. **Error Handling**: Always handle both successful responses and error cases
2. **Validation**: Validate data on both client and server side
3. **Authentication**: Store JWT tokens securely and handle token expiration
4. **Date Handling**: Use consistent date formats (YYYY-MM-DD) and timezone handling
5. **Currency**: Handle currency values as numbers with appropriate precision

## Sample Integration

Here's a sample JavaScript integration:

```javascript
class CashAPI {
  constructor(baseURL, token) {
    this.baseURL = baseURL
    this.token = token
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`
    const config = {
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    }

    const response = await fetch(url, config)

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Request failed')
    }

    return response.json()
  }

  async createEntry(amount) {
    return this.request('/cash', {
      method: 'POST',
      body: JSON.stringify({ amount }),
    })
  }

  async getEntries() {
    return this.request('/cash')
  }

  async updateEntry(id, data) {
    return this.request(`/cash/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async deleteEntry(id) {
    return this.request(`/cash/${id}`, {
      method: 'DELETE',
    })
  }

  async getStats(startDate, endDate) {
    const params = new URLSearchParams()
    if (startDate) params.append('startDate', startDate)
    if (endDate) params.append('endDate', endDate)

    const query = params.toString()
    return this.request(`/cash/stats${query ? '?' + query : ''}`)
  }
}

// Usage
const api = new CashAPI('http://localhost:5000', 'your-jwt-token')

try {
  const entry = await api.createEntry(425.75)
  console.log('Entry created:', entry)
} catch (error) {
  console.error('Error:', error.message)
}
```

## Testing

Use the provided test files to verify API functionality:

```bash
# Run backend tests
cd backend
npm test

# Run specific cash API tests
npm test -- --testNamePattern="Cash"
```

The test suite covers:

- CRUD operations
- Validation scenarios
- Authentication and authorization
- Error handling
- Edge cases
