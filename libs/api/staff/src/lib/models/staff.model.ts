/**
 * Staff domain models and types
 */

// Base interface
export interface BaseEntity {
  id: number;
  createdAt: string;
  updatedAt: string;
}

// Staff roles specific to bakery operations
export type StaffRole = 'manager' | 'baker' | 'assistant' | 'cashier' | 'delivery';

// Schedule interface for staff working hours
export interface StaffSchedule {
  monday?: { start: string; end: string; };
  tuesday?: { start: string; end: string; };
  wednesday?: { start: string; end: string; };
  thursday?: { start: string; end: string; };
  friday?: { start: string; end: string; };
  saturday?: { start: string; end: string; };
  sunday?: { start: string; end: string; };
}

// Staff member interface
export interface StaffMember extends BaseEntity {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: StaffRole;
  schedule?: StaffSchedule;
  isActive: boolean;
  username?: string; // For compatibility with legacy system
  fullName?: string; // Computed field
}

// Create staff member input
export interface CreateStaffMemberInput {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: StaffRole;
  schedule?: StaffSchedule;
  isActive?: boolean;
  password?: string; // For initial account setup
}

// Update staff member input
export interface UpdateStaffMemberInput {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  role?: StaffRole;
  schedule?: StaffSchedule;
  isActive?: boolean;
  password?: string; // For password changes
}

// Staff member filters for querying
export interface StaffMemberFilters {
  search?: string; // Search by name, email, or username
  role?: StaffRole;
  isActive?: boolean;
  page?: number;
  limit?: number;
}

// Pagination response
export interface PaginatedStaffResponse {
  users: StaffMember[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    itemsPerPage: number;
  };
}

// Staff statistics
export interface StaffStatistics {
  totalStaff: number;
  activeStaff: number;
  inactiveStaff: number;
  roleBreakdown: Record<StaffRole, number>;
  averageExperienceMonths: number;
}

// Staff availability for scheduling
export interface StaffAvailability {
  staffId: number;
  date: string;
  isAvailable: boolean;
  workingHours?: {
    start: string;
    end: string;
  };
  notes?: string;
}

// Constants
export const STAFF_CONSTANTS = {
  MAX_NAME_LENGTH: 50,
  MIN_NAME_LENGTH: 1,
  MAX_PHONE_LENGTH: 20,
  MIN_PHONE_LENGTH: 7,
  DEFAULT_PAGE_SIZE: 10,
  MAX_PAGE_SIZE: 100,
  VALID_ROLES: ['manager', 'baker', 'assistant', 'cashier', 'delivery'] as const,
  PASSWORD_MIN_LENGTH: 6
} as const;

// Error messages
export const STAFF_ERROR_MESSAGES = {
  FIRST_NAME_REQUIRED: "First name is required",
  LAST_NAME_REQUIRED: "Last name is required",
  EMAIL_REQUIRED: "Email is required",
  PHONE_REQUIRED: "Phone number is required",
  ROLE_REQUIRED: "Role is required",
  INVALID_ROLE: "Invalid role specified",
  INVALID_EMAIL: "Please provide a valid email address",
  INVALID_PHONE: "Invalid phone number format",
  NAME_TOO_LONG: `Name cannot exceed ${STAFF_CONSTANTS.MAX_NAME_LENGTH} characters`,
  NAME_TOO_SHORT: `Name must be at least ${STAFF_CONSTANTS.MIN_NAME_LENGTH} character`,
  PHONE_TOO_LONG: `Phone number cannot exceed ${STAFF_CONSTANTS.MAX_PHONE_LENGTH} characters`,
  PHONE_TOO_SHORT: `Phone number must be at least ${STAFF_CONSTANTS.MIN_PHONE_LENGTH} characters`,
  EMAIL_EXISTS: "Email address already exists",
  PHONE_EXISTS: "Phone number already exists",
  STAFF_NOT_FOUND: "Staff member not found",
  CANNOT_DELETE_SELF: "You cannot delete your own account",
  CANNOT_DEACTIVATE_SELF: "You cannot deactivate your own account",
  CANNOT_CHANGE_OWN_ROLE: "You cannot change your own role",
  UNAUTHORIZED: "Authentication required",
  FORBIDDEN: "Insufficient permissions",
  DATABASE_ERROR: "Database error occurred",
  INVALID_SCHEDULE: "Invalid schedule format",
  PASSWORD_TOO_SHORT: `Password must be at least ${STAFF_CONSTANTS.PASSWORD_MIN_LENGTH} characters`
} as const;

// Role descriptions for UI
export const ROLE_DESCRIPTIONS: Record<StaffRole, string> = {
  manager: "Oversees bakery operations and staff management",
  baker: "Responsible for bread and pastry production",
  assistant: "Assists with general bakery operations and preparation",
  cashier: "Handles customer transactions and front-of-house operations",
  delivery: "Manages product delivery and logistics"
};

// Default schedules by role
export const DEFAULT_SCHEDULES: Record<StaffRole, StaffSchedule> = {
  manager: {
    monday: { start: "06:00", end: "16:00" },
    tuesday: { start: "06:00", end: "16:00" },
    wednesday: { start: "06:00", end: "16:00" },
    thursday: { start: "06:00", end: "16:00" },
    friday: { start: "06:00", end: "16:00" },
    saturday: { start: "07:00", end: "15:00" }
  },
  baker: {
    monday: { start: "04:00", end: "12:00" },
    tuesday: { start: "04:00", end: "12:00" },
    wednesday: { start: "04:00", end: "12:00" },
    thursday: { start: "04:00", end: "12:00" },
    friday: { start: "04:00", end: "12:00" },
    saturday: { start: "04:00", end: "12:00" }
  },
  assistant: {
    monday: { start: "08:00", end: "16:00" },
    tuesday: { start: "08:00", end: "16:00" },
    wednesday: { start: "08:00", end: "16:00" },
    thursday: { start: "08:00", end: "16:00" },
    friday: { start: "08:00", end: "16:00" }
  },
  cashier: {
    monday: { start: "08:00", end: "18:00" },
    tuesday: { start: "08:00", end: "18:00" },
    wednesday: { start: "08:00", end: "18:00" },
    thursday: { start: "08:00", end: "18:00" },
    friday: { start: "08:00", end: "18:00" },
    saturday: { start: "08:00", end: "17:00" }
  },
  delivery: {
    monday: { start: "10:00", end: "18:00" },
    tuesday: { start: "10:00", end: "18:00" },
    wednesday: { start: "10:00", end: "18:00" },
    thursday: { start: "10:00", end: "18:00" },
    friday: { start: "10:00", end: "18:00" },
    saturday: { start: "10:00", end: "16:00" }
  }
};