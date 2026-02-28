# Cash Management System - Technical Documentation

## Architecture Overview

The cash management system follows a modern full-stack architecture with clear separation of concerns:

```
Frontend (Next.js + TypeScript + Material UI)
    ↓ API Calls
Backend (Node.js + Express + Sequelize)
    ↓ Database Queries
Database (SQLite with Sequelize ORM)
```

## Technology Stack

### Backend

- **Runtime**: Node.js
- **Framework**: Express.js
- **ORM**: Sequelize
- **Database**: SQLite
- **Authentication**: JWT (JSON Web Tokens)
- **Validation**: Custom validation helpers
- **Testing**: Jest with Supertest
- **Logging**: Custom logger utility

### Frontend

- **Framework**: Next.js 13+ (App Router)
- **Language**: TypeScript
- **UI Library**: Material UI (MUI)
- **State Management**: React Context + useState/useEffect
- **HTTP Client**: Fetch API
- **Testing**: Jest + React Testing Library
- **Utilities**: Custom utility functions for cash operations

## Database Schema

### Cash Table

```sql
CREATE TABLE Cash (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  UserId INTEGER NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  date DATE NOT NULL,
  createdAt DATETIME NOT NULL,
  updatedAt DATETIME NOT NULL,
  FOREIGN KEY (UserId) REFERENCES Users(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX idx_cash_user_date ON Cash(UserId, date DESC);
CREATE INDEX idx_cash_date ON Cash(date DESC);
```

### Model Definition (Sequelize)

```javascript
// models/Cash.js
const { DataTypes } = require('sequelize')

const Cash = (sequelize) => {
  return sequelize.define('Cash', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    UserId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'Users',
        key: 'id',
      },
    },
    amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      validate: {
        min: 0,
      },
    },
    date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
  })
}
```

## Backend Architecture

### Directory Structure

```
backend/
├── controllers/
│   └── cashController.js      # CRUD operations and business logic
├── routes/
│   └── cashRoutes.js         # Route definitions
├── models/
│   ├── Cash.js               # Cash model definition
│   ├── User.js               # User model definition
│   └── index.js              # Model associations
├── middleware/
│   └── authMiddleware.js     # JWT authentication
├── utils/
│   └── logger.js             # Logging utility
└── tests/
    ├── unit/
    │   └── cashController*.test.js
    └── integration/
        └── cashAPI.test.js
```

### Controller Architecture

The cash controller is organized into several layers:

```javascript
// Validation Layer
const validators = {
  validateUser: async (userId) => {
    /* ... */
  },
  validateAmount: (amount) => {
    /* ... */
  },
  validateDateFormat: (date) => {
    /* ... */
  },
  findUserCashEntry: async (entryId, userId) => {
    /* ... */
  },
}

// Error Response Layer
const errorResponses = {
  badRequest: (res, message) => {
    /* ... */
  },
  notFound: (res, message) => {
    /* ... */
  },
  internalError: (res, message) => {
    /* ... */
  },
}

// Controller Methods
exports.addCashEntry = async (req, res) => {
  /* ... */
}
exports.getCashEntries = async (req, res) => {
  /* ... */
}
exports.updateCashEntry = async (req, res) => {
  /* ... */
}
exports.deleteCashEntry = async (req, res) => {
  /* ... */
}
exports.getCashStats = async (req, res) => {
  /* ... */
}
```

### Route Configuration

```javascript
// routes/cashRoutes.js
const express = require('express')
const router = express.Router()
const cashController = require('../controllers/cashController')
const { authenticate } = require('../middleware/authMiddleware')

// All routes require authentication
router.post('/', authenticate, cashController.addCashEntry)
router.get('/', authenticate, cashController.getCashEntries)
router.get('/stats', authenticate, cashController.getCashStats)
router.put('/:id', authenticate, cashController.updateCashEntry)
router.delete('/:id', authenticate, cashController.deleteCashEntry)
```

### Authentication Middleware

```javascript
// middleware/authMiddleware.js
const jwt = require('jsonwebtoken')
const { User } = require('../models')

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader) {
      return res.status(401).json({ error: 'No token provided' })
    }

    const token = authHeader.startsWith('Bearer ')
      ? authHeader.substring(7)
      : authHeader

    const decoded = jwt.verify(token, SECRET_KEY)
    req.userId = decoded.id
    next()
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' })
  }
}
```

## Frontend Architecture

### Directory Structure

```
website/src/
├── app/admin/cash/
│   └── page.tsx              # Main cash management page
├── components/admin/cash/
│   ├── CashEntryForm.tsx     # Form for creating entries
│   ├── CashHistoryTable.tsx  # Table with CRUD operations
│   ├── EditCashEntryModal.tsx # Modal for editing entries
│   ├── DeleteCashEntryDialog.tsx # Confirmation dialog
│   └── MonthlySummary.tsx    # Monthly statistics
├── services/
│   ├── bakeryAPI.ts          # API integration layer
│   └── types.ts              # TypeScript type definitions
├── utils/
│   └── cashUtils.ts          # Utility functions
└── __tests__/
    └── components/admin/cash/
```

### Type Definitions

```typescript
// services/types.ts
export interface CashEntry {
  id: number
  UserId: number
  amount: number
  date: string // YYYY-MM-DD format
  createdAt: string
  updatedAt: string
}

export interface CashStats {
  totalAmount: number
  averageAmount: number
  entryCount: number
  latestEntry: {
    amount: number
    date: string
  } | null
  dateRange: {
    startDate: string | null
    endDate: string | null
  }
}
```

### API Service Layer

```typescript
// services/bakeryAPI.ts
const bakeryAPI = {
  async addCashEntry(
    amount: number
  ): Promise<{ message: string; entry: CashEntry }> {
    const response = await fetch(`${API_BASE}/cash`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getAuthToken()}`,
      },
      body: JSON.stringify({ amount }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to save cash entry')
    }

    return response.json()
  },

  async getCashHistory(): Promise<CashEntry[]> {
    /* ... */
  },
  async updateCashEntry(
    id: number,
    amount: number,
    date?: string
  ): Promise<{ message: string; entry: CashEntry }> {
    /* ... */
  },
  async deleteCashEntry(
    id: number
  ): Promise<{ message: string; deletedEntry: CashEntry }> {
    /* ... */
  },
  async getCashStats(startDate?: string, endDate?: string): Promise<CashStats> {
    /* ... */
  },
}
```

### Utility Functions

The cash utilities are organized into logical groups:

```typescript
// utils/cashUtils.ts
export const currencyUtils = {
  format: (amount: number) => string,
  formatInput: (value: string) => string,
  parse: (value: string) => number
};

export const dateUtils = {
  formatDisplay: (dateString: string) => string,
  formatWeekday: (dateString: string) => string,
  formatDateTime: (dateString: string) => string,
  getCurrentDate: () => string,
  isFutureDate: (dateString: string) => boolean
};

export const cashCalculations = {
  calculateTotal: (entries: CashEntry[]) => number,
  calculateAverage: (entries: CashEntry[]) => number,
  filterByDateRange: (entries: CashEntry[], startDate?: string, endDate?: string) => CashEntry[],
  filterCurrentMonth: (entries: CashEntry[]) => CashEntry[],
  filterToday: (entries: CashEntry[]) => CashEntry[],
  getTrend: (current: number, previous?: number) => 'up' | 'down' | 'neutral'
};

export const validationUtils = {
  validateAmount: (amount: number) => { isValid: boolean; message?: string },
  validateDate: (dateString: string) => { isValid: boolean; message?: string }
};

export const exportUtils = {
  generateCSV: (entries: CashEntry[]) => string,
  downloadCSV: (csvContent: string, filename?: string) => void
};

export const errorUtils = {
  getErrorMessage: (error: unknown) => string,
  requiresAuth: (error: unknown) => boolean
};
```

### Component Architecture

#### Main Cash Page Component

```typescript
// app/admin/cash/page.tsx
const CashManagement: React.FC = () => {
  // State management
  const [cashEntries, setCashEntries] = useState<CashEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedEntry, setSelectedEntry] = useState<CashEntry | null>(null)

  // API integration
  const fetchCashHistory = async () => {
    /* ... */
  }
  const handleCashEntrySubmit = async (amount: number) => {
    /* ... */
  }
  const handleUpdateEntry = async (
    id: number,
    amount: number,
    date: string
  ) => {
    /* ... */
  }
  const handleDeleteEntry = async (id: number) => {
    /* ... */
  }

  // Calculations using utilities
  const calculateTodaysTotal = () => {
    const todaysEntries = cashCalculations.filterToday(cashEntries)
    return cashCalculations.calculateTotal(todaysEntries)
  }

  // Render logic with tabs for different views
  return (
    <Container>
      {/* Overview Cards */}
      {/* Tabs: Entry Form, History Table, Monthly Summary */}
      {/* Modals for Edit/Delete */}
    </Container>
  )
}
```

#### Cash History Table Component

```typescript
// components/admin/cash/CashHistoryTable.tsx
const CashHistoryTable: React.FC<CashHistoryTableProps> = ({
  cashEntries,
  loading,
  onRefresh,
  onEdit,
  onDelete,
}) => {
  // Sorting and filtering state
  const [sortBy, setSortBy] = useState<SortBy>('date')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')
  const [searchTerm, setSearchTerm] = useState('')
  const [dateFilter, setDateFilter] = useState({ startDate: '', endDate: '' })

  // Computed values using memoization
  const sortedEntries = useMemo(() => {
    /* sorting logic */
  }, [cashEntries, sortBy, sortOrder])
  const filteredEntries = useMemo(() => {
    /* filtering logic */
  }, [sortedEntries, searchTerm, dateFilter])

  // Event handlers
  const handleSort = (column: SortBy) => {
    /* ... */
  }
  const exportToCSV = () => {
    /* using exportUtils */
  }

  return (
    <Box>
      {/* Statistics Cards */}
      {/* Search and Filter Controls */}
      {/* Data Table with Action Buttons */}
    </Box>
  )
}
```

## Security Architecture

### Authentication Flow

```
1. User logs in → JWT token generated
2. Token stored in client (memory/localStorage)
3. Token sent with each API request in Authorization header
4. Middleware validates token and extracts user ID
5. Controller operations scoped to authenticated user
```

### Authorization Rules

- **User Isolation**: Users can only access their own cash entries
- **Role-Based**: Only authenticated users can access cash endpoints
- **Token Validation**: All requests validated server-side
- **CORS Protection**: Configured for frontend domain only

### Data Validation

#### Backend Validation

```javascript
const validators = {
  validateAmount: (amount) => {
    return typeof amount === 'number' && amount >= 0
  },
  validateDateFormat: (date) => {
    return /^\d{4}-\d{2}-\d{2}$/.test(date)
  },
}
```

#### Frontend Validation

```typescript
const validationUtils = {
  validateAmount: (amount: number) => {
    if (typeof amount !== 'number' || isNaN(amount)) {
      return { isValid: false, message: 'Betrag muss eine gültige Zahl sein' }
    }
    if (amount < 0) {
      return {
        isValid: false,
        message: 'Bitte geben Sie einen gültigen Betrag größer als 0 ein',
      }
    }
    return { isValid: true }
  },
}
```

## Testing Strategy

### Backend Testing

#### Unit Tests

```javascript
// tests/unit/cashController.test.js
describe('Cash Controller', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should create a cash entry successfully', async () => {
    // Mock setup
    const mockUser = { id: 1, username: 'testuser' }
    const mockCashEntry = {
      id: 1,
      UserId: 1,
      amount: 425.75,
      date: '2024-01-15',
    }

    User.findByPk.mockResolvedValue(mockUser)
    Cash.create.mockResolvedValue(mockCashEntry)

    // Test execution
    const response = await request(app).post('/cash').send({ amount: 425.75 })

    // Assertions
    expect(response.status).toBe(200)
    expect(response.body.message).toBe('Cash entry saved')
  })
})
```

#### Integration Tests

```javascript
// tests/integration/cashAPI.test.js
describe('Cash API Integration Tests', () => {
  let authToken
  let userId

  beforeEach(async () => {
    // Set up test user and authentication
    const registerResponse = await request(app)
      .post('/register')
      .send({ username: 'testuser', password: 'testpass123' })

    const loginResponse = await request(app)
      .post('/login')
      .send({ username: 'testuser', password: 'testpass123' })

    authToken = loginResponse.body.token
  })

  it('should create a cash entry with valid authentication', async () => {
    const response = await request(app)
      .post('/cash')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ amount: 456.78 })

    expect(response.status).toBe(200)
    expect(response.body.message).toBe('Cash entry saved')
  })
})
```

### Frontend Testing

#### Component Tests

```typescript
// __tests__/EditCashEntryModal.test.tsx
describe('EditCashEntryModal', () => {
  const mockOnUpdate = jest.fn()
  const mockOnClose = jest.fn()
  const mockCashEntry: CashEntry = {
    id: 1,
    UserId: 1,
    amount: 425.75,
    date: '2024-01-15',
    createdAt: '2024-01-15T20:30:00.000Z',
    updatedAt: '2024-01-15T20:30:00.000Z',
  }

  it('submits valid changes correctly', async () => {
    mockOnUpdate.mockResolvedValueOnce(undefined)

    render(
      <ThemeProvider theme={lightTheme}>
        <EditCashEntryModal
          open={true}
          entry={mockCashEntry}
          onClose={mockOnClose}
          onUpdate={mockOnUpdate}
        />
      </ThemeProvider>
    )

    const amountInput = screen.getByLabelText('Betrag')
    const submitButton = screen.getByRole('button', {
      name: /änderungen speichern/i,
    })

    fireEvent.change(amountInput, { target: { value: '500.00' } })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(mockOnUpdate).toHaveBeenCalledWith(1, 500.0, '2024-01-15')
    })
  })
})
```

### Test Coverage

Current test coverage includes:

- **Backend**: 85%+ coverage including all CRUD operations
- **Frontend**: 70%+ coverage for critical components
- **Integration**: Full API workflow testing
- **Validation**: All validation scenarios tested

## Performance Considerations

### Database Performance

- **Indexes**: Optimized queries with proper indexing
- **Query Optimization**: Use of Sequelize optimizations
- **Connection Pool**: Managed database connections

### Frontend Performance

- **Memoization**: React.useMemo for expensive calculations
- **Lazy Loading**: Dynamic imports for heavy components
- **Debouncing**: Search input debouncing to reduce API calls
- **Pagination**: Table pagination for large datasets

### API Performance

- **Response Optimization**: Only return necessary fields
- **Caching**: Consider Redis for frequent queries
- **Rate Limiting**: Implement for production use

## Deployment Considerations

### Environment Configuration

```javascript
// config/database.js
const config = {
  development: {
    dialect: 'sqlite',
    storage: './database.db',
    logging: console.log,
  },
  production: {
    dialect: 'postgres', // or MySQL
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    username: process.env.DB_USER,
    password: process.env.DB_PASS,
    logging: false,
  },
}
```

### Build Process

```bash
# Backend
npm run build  # If using TypeScript
npm test       # Run all tests
npm start      # Production server

# Frontend
npm run build  # Next.js build
npm start      # Production server
```

### Database Migrations

```javascript
// migrations/001-create-cash-table.js
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('Cash', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      // ... other fields
    })

    await queryInterface.addIndex('Cash', ['UserId', 'date'])
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('Cash')
  },
}
```

## Monitoring and Logging

### Backend Logging

```javascript
// utils/logger.js
const logger = {
  info: (message, meta = {}) => {
    console.log(`[INFO] [${new Date().toISOString()}] ${message}`, meta)
  },
  error: (message, error = {}) => {
    console.error(`[ERROR] [${new Date().toISOString()}] ${message}`, error)
  },
}
```

### Error Tracking

- **Backend**: Structured error logging with stack traces
- **Frontend**: Error boundaries for React components
- **API**: Comprehensive error responses with proper HTTP codes

### Health Checks

```javascript
// Basic health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version,
  })
})
```

## Future Enhancements

### Planned Features

1. **Real-time Updates**: WebSocket integration for live updates
2. **Advanced Analytics**: Charts and trend analysis
3. **Bulk Operations**: Import/export multiple entries
4. **Audit Trail**: Track all changes with timestamps
5. **Mobile App**: React Native implementation
6. **Reporting**: PDF report generation
7. **Notifications**: Email/SMS alerts for milestones

### Technical Improvements

1. **Caching**: Redis implementation for performance
2. **Database**: Migration to PostgreSQL for production
3. **API Versioning**: Versioned API endpoints
4. **GraphQL**: Consider GraphQL for flexible queries
5. **Microservices**: Split into domain-specific services
6. **Docker**: Containerization for deployment
7. **CI/CD**: Automated testing and deployment pipeline

## Contributing Guidelines

### Code Standards

- **ESLint**: Follow configured linting rules
- **Prettier**: Auto-formatting on save
- **TypeScript**: Strict type checking
- **Testing**: Minimum 80% test coverage
- **Documentation**: JSDoc for all public functions

### Git Workflow

```bash
# Feature development
git checkout -b feature/cash-feature-name
git commit -m "feat: add cash feature description"
git push origin feature/cash-feature-name

# Pull request and review
# Merge to main after approval
```

### Review Checklist

- [ ] All tests passing
- [ ] Code coverage maintained
- [ ] Documentation updated
- [ ] Security considerations reviewed
- [ ] Performance impact assessed
- [ ] Database migrations included if needed
