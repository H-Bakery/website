# Bakery Backend API Testing Guide

This document provides curl commands to test the various endpoints of the bakery backend API.

## Base URL

All commands assume the API is running at `http://localhost:5000`

## Authentication

### Register a new user

```bash
curl -X POST http://localhost:5000/register \
  -H "Content-Type: application/json" \
  -d '{"username": "testuser", "password": "testpassword"}'
```

**Expected Response:**

```json
{ "message": "User created" }
```

### Login

```bash
curl -X POST http://localhost:5000/login \
  -H "Content-Type: application/json" \
  -d '{"username": "testuser", "password": "testpassword"}'
```

**Expected Response:**

```json
{ "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." }
```

_Save this token for authenticated requests_

## Cash Management

### Add Cash Entry

```bash
curl -X POST http://localhost:5000/cash \
  -H "Content-Type: application/json" \
  -H "Authorization: YOUR_TOKEN_HERE" \
  -d '{"amount": 100.50}'
```

### Get Cash Entries

```bash
curl -X GET http://localhost:5000/cash \
  -H "Authorization: YOUR_TOKEN_HERE"
```

## Chat System

### Get Chat Messages

```bash
curl -X GET http://localhost:5000/chat \
  -H "Authorization: YOUR_TOKEN_HERE"
```

### Add Chat Message

```bash
curl -X POST http://localhost:5000/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: YOUR_TOKEN_HERE" \
  -d '{"message": "Hello team!"}'
```

## Products

### Get All Products

```bash
curl -X GET http://localhost:5000/products
```

### Get Product by ID

```bash
curl -X GET http://localhost:5000/products/1
```

## Orders

### Get All Orders

```bash
curl -X GET http://localhost:5000/orders
```

### Get Order by ID

```bash
curl -X GET http://localhost:5000/orders/1
```

### Create Order

```bash
curl -X POST http://localhost:5000/orders \
  -H "Content-Type: application/json" \
  -d '{
    "customerName": "Jane Smith",
    "customerPhone": "555-987-6543",
    "customerEmail": "jane@example.com",
    "pickupDate": "2023-07-03T15:00:00.000Z",
    "status": "Pending",
    "notes": "Gluten-free options",
    "totalPrice": 15.75,
    "items": [
      {
        "productId": "2",
        "productName": "Croissant",
        "quantity": 5,
        "unitPrice": 2.5
      },
      {
        "productId": "3",
        "productName": "Chocolate Muffin",
        "quantity": 2,
        "unitPrice": 3.25
      }
    ]
  }'
```

### Update Order

```bash
curl -X PUT http://localhost:5000/orders/1 \
  -H "Content-Type: application/json" \
  -d '{
    "customerName": "Jane Smith",
    "customerPhone": "555-987-6543",
    "customerEmail": "jane@example.com",
    "pickupDate": "2023-07-03T16:00:00.000Z",
    "status": "Confirmed",
    "notes": "Gluten-free options required",
    "totalPrice": 18.25,
    "items": [
      {
        "productId": "2",
        "productName": "Croissant",
        "quantity": 6,
        "unitPrice": 2.5
      },
      {
        "productId": "3",
        "productName": "Chocolate Muffin",
        "quantity": 2,
        "unitPrice": 3.25
      }
    ]
  }'
```

### Delete Order

```bash
curl -X DELETE http://localhost:5000/orders/1
```

## Baking List

### Get Baking List (for today)

```bash
curl -X GET http://localhost:5000/baking-list
```

### Get Baking List (for a specific date)

```bash
curl -X GET http://localhost:5000/baking-list?date=2023-07-03
```

## Testing Workflow Examples

### Complete Order Process

1. Register and login to get a token
2. Check available products
3. Create a new order
4. Check the baking list to see if your order appears
5. Update the order to change quantities
6. Delete the order when done

### Cash Management Workflow

1. Login to get a token
2. Add daily cash entries
3. Retrieve all cash entries to verify
