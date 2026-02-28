# Production WebSocket Integration

This document describes the WebSocket integration for real-time production updates in the bakery system.

## Overview

The production planning system now supports real-time updates via WebSocket connections, replacing the need for polling-based updates. This provides instant updates when production batches, steps, or schedules change.

## Architecture

### Backend Components

1. **Socket Service** (`backend/services/socketService.js`)

   - Extended to support production-specific rooms and events
   - Room types:
     - `production-schedule-{date}` - Updates for specific production date
     - `production-batch-{batchId}` - Updates for specific batch
     - `production-status` - General production status updates

2. **Production Controller** (`backend/controllers/productionController.js`)
   - Emits WebSocket events on all data changes
   - Events emitted:
     - Batch creation, update, start, pause, resume, deletion
     - Step progress updates and completion
     - Quality checks and issue reporting
     - Schedule modifications

### Frontend Components

1. **Production Socket Service** (`website/src/services/productionSocketService.ts`)

   - Manages WebSocket connection for production updates
   - Handles automatic reconnection
   - Provides typed event handlers

2. **useProductionSocket Hook** (`website/src/hooks/useProductionSocket.ts`)

   - React hook for WebSocket integration
   - Automatically updates React Query cache
   - Manages subscriptions based on component lifecycle

3. **Updated Components**
   - `ProductionStatusPanel` - Real-time dashboard updates
   - `BatchDetailsPanel` - Live batch and step progress

## WebSocket Events

### Client -> Server Events

- `production:subscribe:schedule` - Subscribe to schedule updates
- `production:unsubscribe:schedule` - Unsubscribe from schedule
- `production:subscribe:batch` - Subscribe to batch updates
- `production:unsubscribe:batch` - Unsubscribe from batch
- `production:subscribe:status` - Subscribe to status updates
- `production:unsubscribe:status` - Unsubscribe from status

### Server -> Client Events

- `production:batch:update` - Batch data changed

  ```typescript
  {
    batchId: number
    status?: string
    progress?: number
    actualStartTime?: string
    actualEndTime?: string
    // ... other batch fields
  }
  ```

- `production:step:update` - Step progress/status changed

  ```typescript
  {
    batchId: number
    stepId: number
    status?: string
    progress?: number
    // ... other step fields
  }
  ```

- `production:schedule:update` - Schedule modified

  ```typescript
  {
    date: string
    // ... schedule update fields
  }
  ```

- `production:status:update` - General status update

  ```typescript
  {
    type: string
    batchId?: number
    batchName?: string
    timestamp: string
    // ... other status fields
  }
  ```

- `production:issue:reported` - New issue reported

  ```typescript
  {
    batchId: number
    issue: {
      type: string
      severity: string
      description: string
      // ... other issue fields
    }
  }
  ```

- `production:quality:check` - Quality check performed
  ```typescript
  {
    batchId: number
    stepId: number
    qualityData: {
      checks: Array<QualityCheck>
      notes?: string
      // ... other quality fields
    }
  }
  ```

## Usage Examples

### Basic Component Integration

```typescript
import { useProductionSocket } from '@/hooks/useProductionSocket'

export const MyProductionComponent = () => {
  const { isConnected } = useProductionSocket({
    scheduleDate: '2025-08-01',
    subscribeToStatus: true,
  })

  return <div>{isConnected ? 'Real-time updates active' : 'Connecting...'}</div>
}
```

### Custom Event Handlers

```typescript
const { isConnected } = useProductionSocket(
  {
    batchId: 123,
    autoConnect: true,
  },
  {
    onBatchUpdate: (data) => {
      console.log('Batch updated:', data)
      // Custom handling
    },
    onStepUpdate: (data) => {
      console.log('Step updated:', data)
      // Custom handling
    },
  }
)
```

### Fallback to Polling

```typescript
// Disable WebSocket and use polling
<ProductionStatusPanel
  selectedDate={date}
  useWebSocket={false}
  refreshInterval={30000} // Poll every 30 seconds
/>
```

## Testing

### Manual Testing

1. Start the backend server
2. Run the test script:
   ```bash
   node test-production-websocket.js
   ```
3. Perform production actions via the UI or API
4. Observe real-time updates in the console

### Integration Testing

The WebSocket integration is automatically tested by React Query's cache updates. When events are received:

1. The hook updates the React Query cache
2. Components using the same queries automatically re-render
3. UI updates without manual refetching

## Performance Considerations

1. **Room-based Broadcasting**

   - Events are only sent to relevant subscribers
   - Reduces unnecessary network traffic

2. **Automatic Cleanup**

   - Components unsubscribe when unmounting
   - Prevents memory leaks

3. **Fallback Support**
   - Polling remains available when WebSocket fails
   - Graceful degradation for network issues

## Security

1. **JWT Authentication**

   - All WebSocket connections require valid JWT token
   - Same authentication as REST API

2. **Role-based Access**
   - Production updates require appropriate permissions
   - Enforced at both REST and WebSocket levels

## Troubleshooting

### Connection Issues

1. Check backend WebSocket server is running
2. Verify JWT token is valid
3. Check CORS configuration
4. Monitor browser console for errors

### Missing Updates

1. Verify subscription to correct room
2. Check event emission in backend
3. Monitor WebSocket frames in browser DevTools
4. Review React Query cache updates

### Performance Issues

1. Reduce update frequency if needed
2. Batch multiple updates together
3. Use room-specific subscriptions
4. Monitor server-side event emission rate
