# WebSocket API Library

This library provides WebSocket functionality for real-time communication in the Bakery Management System.

## Features

- Real-time order updates
- Live inventory notifications
- Production status broadcasting
- Staff communication channels
- System-wide notifications

## Usage

```typescript
import { WebSocketService, WebSocketEvents } from '@bakery/api/websocket';

// Initialize WebSocket service
const wsService = new WebSocketService({
  port: 3001,
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:4200',
    credentials: true
  }
});

// Listen for connections
wsService.on(WebSocketEvents.CONNECTION, (socket) => {
  console.log('Client connected:', socket.id);
});

// Broadcast events
wsService.broadcast('order.update', { orderId: 123, status: 'ready' });
```

## Events

- `order.new` - New order created
- `order.update` - Order status changed
- `inventory.low` - Low inventory alert
- `production.start` - Production batch started
- `production.complete` - Production batch completed
- `notification.new` - New notification

## Running unit tests

Run `nx test api-websocket` to execute the unit tests via [Jest](https://jestjs.io).