/**
 * Notification service for the bakery management system
 */
var __awaiter =
  (this && this.__awaiter) ||
  function (thisArg, _arguments, P, generator) {
    function adopt(value) {
      return value instanceof P
        ? value
        : new P(function (resolve) {
            resolve(value)
          })
    }
    return new (P || (P = Promise))(function (resolve, reject) {
      function fulfilled(value) {
        try {
          step(generator.next(value))
        } catch (e) {
          reject(e)
        }
      }
      function rejected(value) {
        try {
          step(generator['throw'](value))
        } catch (e) {
          reject(e)
        }
      }
      function step(result) {
        result.done
          ? resolve(result.value)
          : adopt(result.value).then(fulfilled, rejected)
      }
      step((generator = generator.apply(thisArg, _arguments || [])).next())
    })
  }
var __generator =
  (this && this.__generator) ||
  function (thisArg, body) {
    var _ = {
        label: 0,
        sent: function () {
          if (t[0] & 1) throw t[1]
          return t[1]
        },
        trys: [],
        ops: [],
      },
      f,
      y,
      t,
      g = Object.create(
        (typeof Iterator === 'function' ? Iterator : Object).prototype
      )
    return (
      (g.next = verb(0)),
      (g['throw'] = verb(1)),
      (g['return'] = verb(2)),
      typeof Symbol === 'function' &&
        (g[Symbol.iterator] = function () {
          return this
        }),
      g
    )
    function verb(n) {
      return function (v) {
        return step([n, v])
      }
    }
    function step(op) {
      if (f) throw new TypeError('Generator is already executing.')
      while ((g && ((g = 0), op[0] && (_ = 0)), _))
        try {
          if (
            ((f = 1),
            y &&
              (t =
                op[0] & 2
                  ? y['return']
                  : op[0]
                  ? y['throw'] || ((t = y['return']) && t.call(y), 0)
                  : y.next) &&
              !(t = t.call(y, op[1])).done)
          )
            return t
          if (((y = 0), t)) op = [op[0] & 2, t.value]
          switch (op[0]) {
            case 0:
            case 1:
              t = op
              break
            case 4:
              _.label++
              return { value: op[1], done: false }
            case 5:
              _.label++
              y = op[1]
              op = [0]
              continue
            case 7:
              op = _.ops.pop()
              _.trys.pop()
              continue
            default:
              if (
                !((t = _.trys), (t = t.length > 0 && t[t.length - 1])) &&
                (op[0] === 6 || op[0] === 2)
              ) {
                _ = 0
                continue
              }
              if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) {
                _.label = op[1]
                break
              }
              if (op[0] === 6 && _.label < t[1]) {
                _.label = t[1]
                t = op
                break
              }
              if (t && _.label < t[2]) {
                _.label = t[2]
                _.ops.push(op)
                break
              }
              if (t[2]) _.ops.pop()
              _.trys.pop()
              continue
          }
          op = body.call(thisArg, _)
        } catch (e) {
          op = [6, e]
          y = 0
        } finally {
          f = t = 0
        }
      if (op[0] & 5) throw op[1]
      return { value: op[0] ? op[1] : void 0, done: true }
    }
  }
import { apiClient } from '../api-client'
var NotificationService = /** @class */ (function () {
  function NotificationService() {
    this.basePath = '/api/notifications'
  }
  /**
   * Get all notifications for the current user
   */
  NotificationService.prototype.getNotifications = function (filters) {
    return __awaiter(this, void 0, void 0, function () {
      var params, query, endpoint
      var _a, _b, _c, _d
      return __generator(this, function (_e) {
        params = new URLSearchParams()
        if (
          (_a =
            filters === null || filters === void 0
              ? void 0
              : filters.categories) === null || _a === void 0
            ? void 0
            : _a.length
        ) {
          params.append('categories', filters.categories.join(','))
        }
        if (
          (_b =
            filters === null || filters === void 0
              ? void 0
              : filters.priorities) === null || _b === void 0
            ? void 0
            : _b.length
        ) {
          params.append('priorities', filters.priorities.join(','))
        }
        if (
          (_c =
            filters === null || filters === void 0
              ? void 0
              : filters.channels) === null || _c === void 0
            ? void 0
            : _c.length
        ) {
          params.append('channels', filters.channels.join(','))
        }
        if (
          (_d =
            filters === null || filters === void 0 ? void 0 : filters.types) ===
            null || _d === void 0
            ? void 0
            : _d.length
        ) {
          params.append('types', filters.types.join(','))
        }
        if (
          typeof (filters === null || filters === void 0
            ? void 0
            : filters.read) === 'boolean'
        ) {
          params.append('read', String(filters.read))
        }
        if (
          filters === null || filters === void 0 ? void 0 : filters.dateRange
        ) {
          params.append('startDate', filters.dateRange.start.toISOString())
          params.append('endDate', filters.dateRange.end.toISOString())
        }
        query = params.toString()
        endpoint = query
          ? ''.concat(this.basePath, '?').concat(query)
          : this.basePath
        return [2 /*return*/, apiClient.get(endpoint)]
      })
    })
  }
  /**
   * Get a specific notification by ID
   */
  NotificationService.prototype.getNotification = function (id) {
    return __awaiter(this, void 0, void 0, function () {
      return __generator(this, function (_a) {
        return [
          2 /*return*/,
          apiClient.get(''.concat(this.basePath, '/').concat(id)),
        ]
      })
    })
  }
  /**
   * Create a new notification
   */
  NotificationService.prototype.createNotification = function (data) {
    return __awaiter(this, void 0, void 0, function () {
      return __generator(this, function (_a) {
        return [2 /*return*/, apiClient.post(this.basePath, data)]
      })
    })
  }
  /**
   * Update a notification
   */
  NotificationService.prototype.updateNotification = function (id, data) {
    return __awaiter(this, void 0, void 0, function () {
      return __generator(this, function (_a) {
        return [
          2 /*return*/,
          apiClient.put(''.concat(this.basePath, '/').concat(id), data),
        ]
      })
    })
  }
  /**
   * Delete a notification
   */
  NotificationService.prototype.deleteNotification = function (id) {
    return __awaiter(this, void 0, void 0, function () {
      return __generator(this, function (_a) {
        return [
          2 /*return*/,
          apiClient.delete(''.concat(this.basePath, '/').concat(id)),
        ]
      })
    })
  }
  /**
   * Mark notification as read
   */
  NotificationService.prototype.markAsRead = function (id) {
    return __awaiter(this, void 0, void 0, function () {
      return __generator(this, function (_a) {
        return [
          2 /*return*/,
          apiClient.patch(
            ''.concat(this.basePath, '/').concat(id, '/read'),
            {}
          ),
        ]
      })
    })
  }
  /**
   * Mark notification as unread
   */
  NotificationService.prototype.markAsUnread = function (id) {
    return __awaiter(this, void 0, void 0, function () {
      return __generator(this, function (_a) {
        return [
          2 /*return*/,
          apiClient.patch(
            ''.concat(this.basePath, '/').concat(id, '/unread'),
            {}
          ),
        ]
      })
    })
  }
  /**
   * Mark all notifications as read
   */
  NotificationService.prototype.markAllAsRead = function () {
    return __awaiter(this, void 0, void 0, function () {
      return __generator(this, function (_a) {
        return [
          2 /*return*/,
          apiClient.post(''.concat(this.basePath, '/mark-all-read'), {}),
        ]
      })
    })
  }
  /**
   * Get notification statistics
   */
  NotificationService.prototype.getStats = function () {
    return __awaiter(this, void 0, void 0, function () {
      return __generator(this, function (_a) {
        return [2 /*return*/, apiClient.get(''.concat(this.basePath, '/stats'))]
      })
    })
  }
  /**
   * Get unread count
   */
  NotificationService.prototype.getUnreadCount = function () {
    return __awaiter(this, void 0, void 0, function () {
      return __generator(this, function (_a) {
        return [
          2 /*return*/,
          apiClient.get(''.concat(this.basePath, '/unread-count')),
        ]
      })
    })
  }
  /**
   * Bulk operations on notifications
   */
  NotificationService.prototype.bulkOperation = function (operation) {
    return __awaiter(this, void 0, void 0, function () {
      return __generator(this, function (_a) {
        return [
          2 /*return*/,
          apiClient.post(''.concat(this.basePath, '/bulk'), operation),
        ]
      })
    })
  }
  /**
   * Get user notification preferences
   */
  NotificationService.prototype.getPreferences = function () {
    return __awaiter(this, void 0, void 0, function () {
      return __generator(this, function (_a) {
        return [
          2 /*return*/,
          apiClient.get(''.concat(this.basePath, '/preferences')),
        ]
      })
    })
  }
  /**
   * Update user notification preferences
   */
  NotificationService.prototype.updatePreferences = function (preferences) {
    return __awaiter(this, void 0, void 0, function () {
      return __generator(this, function (_a) {
        return [
          2 /*return*/,
          apiClient.put(''.concat(this.basePath, '/preferences'), preferences),
        ]
      })
    })
  }
  /**
   * Send test notification
   */
  NotificationService.prototype.sendTest = function (channel) {
    return __awaiter(this, void 0, void 0, function () {
      return __generator(this, function (_a) {
        return [
          2 /*return*/,
          apiClient.post(''.concat(this.basePath, '/test'), {
            channel: channel,
          }),
        ]
      })
    })
  }
  /**
   * Subscribe to real-time notifications (WebSocket)
   */
  NotificationService.prototype.subscribeToRealTime = function (callback) {
    // This would typically set up a WebSocket connection
    // For now, return a no-op cleanup function
    console.log('Real-time notifications subscription not implemented yet')
    return function () {
      console.log('Unsubscribing from real-time notifications')
    }
  }
  /**
   * Get notification templates (admin only)
   */
  NotificationService.prototype.getTemplates = function () {
    return __awaiter(this, void 0, void 0, function () {
      return __generator(this, function (_a) {
        return [
          2 /*return*/,
          apiClient.get(''.concat(this.basePath, '/templates')),
        ]
      })
    })
  }
  /**
   * Send broadcast notification (admin only)
   */
  NotificationService.prototype.sendBroadcast = function (data) {
    return __awaiter(this, void 0, void 0, function () {
      return __generator(this, function (_a) {
        return [
          2 /*return*/,
          apiClient.post(''.concat(this.basePath, '/broadcast'), data),
        ]
      })
    })
  }
  return NotificationService
})()
export { NotificationService }
// Export singleton instance
export var notificationService = new NotificationService()
