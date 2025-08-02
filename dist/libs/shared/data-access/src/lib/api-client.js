/**
 * Core API client for all HTTP communications
 */
var __assign =
  (this && this.__assign) ||
  function () {
    __assign =
      Object.assign ||
      function (t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
          s = arguments[i]
          for (var p in s)
            if (Object.prototype.hasOwnProperty.call(s, p)) t[p] = s[p]
        }
        return t
      }
    return __assign.apply(this, arguments)
  }
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
var _a
var ApiClient = /** @class */ (function () {
  function ApiClient(options) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '') // Remove trailing slash
    this.timeout = options.timeout || 10000 // 10 seconds default
    this.defaultHeaders = __assign(
      { 'Content-Type': 'application/json' },
      options.headers
    )
  }
  /**
   * Set authorization token
   */
  ApiClient.prototype.setAuthToken = function (token) {
    this.defaultHeaders['Authorization'] = 'Bearer '.concat(token)
  }
  /**
   * Remove authorization token
   */
  ApiClient.prototype.clearAuthToken = function () {
    delete this.defaultHeaders['Authorization']
  }
  /**
   * Generic request method
   */
  ApiClient.prototype.request = function (endpoint_1) {
    return __awaiter(this, arguments, void 0, function (endpoint, options) {
      var url,
        config,
        controller,
        timeoutId,
        response,
        data,
        contentType,
        error_1
      if (options === void 0) {
        options = {}
      }
      return __generator(this, function (_a) {
        switch (_a.label) {
          case 0:
            url = ''.concat(this.baseUrl).concat(endpoint)
            config = __assign(__assign({}, options), {
              headers: __assign(
                __assign({}, this.defaultHeaders),
                options.headers
              ),
            })
            controller = new AbortController()
            timeoutId = setTimeout(function () {
              return controller.abort()
            }, this.timeout)
            config.signal = controller.signal
            _a.label = 1
          case 1:
            _a.trys.push([1, 7, , 8])
            return [4 /*yield*/, fetch(url, config)]
          case 2:
            response = _a.sent()
            clearTimeout(timeoutId)
            data = void 0
            contentType = response.headers.get('content-type')
            if (
              !(contentType === null || contentType === void 0
                ? void 0
                : contentType.includes('application/json'))
            )
              return [3 /*break*/, 4]
            return [4 /*yield*/, response.json()]
          case 3:
            data = _a.sent()
            return [3 /*break*/, 6]
          case 4:
            return [4 /*yield*/, response.text()]
          case 5:
            data = _a.sent()
            _a.label = 6
          case 6:
            if (!response.ok) {
              throw new Error(
                (data === null || data === void 0 ? void 0 : data.message) ||
                  'HTTP '
                    .concat(response.status, ': ')
                    .concat(response.statusText)
              )
            }
            // If the response is already in ApiResponse format, return it
            if (data && typeof data === 'object' && 'success' in data) {
              return [2 /*return*/, data]
            }
            // Otherwise, wrap the data in ApiResponse format
            return [
              2 /*return*/,
              {
                success: true,
                data: data,
                message: 'Request successful',
              },
            ]
          case 7:
            error_1 = _a.sent()
            clearTimeout(timeoutId)
            if (error_1 instanceof Error) {
              if (error_1.name === 'AbortError') {
                throw new Error('Request timeout')
              }
              throw error_1
            }
            throw new Error('Unknown error occurred')
          case 8:
            return [2 /*return*/]
        }
      })
    })
  }
  /**
   * GET request
   */
  ApiClient.prototype.get = function (endpoint, params) {
    return __awaiter(this, void 0, void 0, function () {
      var url, searchParams_1
      return __generator(this, function (_a) {
        url = endpoint
        if (params) {
          searchParams_1 = new URLSearchParams()
          Object.entries(params).forEach(function (_a) {
            var key = _a[0],
              value = _a[1]
            if (value !== undefined && value !== null) {
              searchParams_1.append(key, String(value))
            }
          })
          if (searchParams_1.toString()) {
            url += '?'.concat(searchParams_1.toString())
          }
        }
        return [2 /*return*/, this.request(url, { method: 'GET' })]
      })
    })
  }
  /**
   * POST request
   */
  ApiClient.prototype.post = function (endpoint, data) {
    return __awaiter(this, void 0, void 0, function () {
      return __generator(this, function (_a) {
        return [
          2 /*return*/,
          this.request(endpoint, {
            method: 'POST',
            body: data ? JSON.stringify(data) : undefined,
          }),
        ]
      })
    })
  }
  /**
   * PUT request
   */
  ApiClient.prototype.put = function (endpoint, data) {
    return __awaiter(this, void 0, void 0, function () {
      return __generator(this, function (_a) {
        return [
          2 /*return*/,
          this.request(endpoint, {
            method: 'PUT',
            body: data ? JSON.stringify(data) : undefined,
          }),
        ]
      })
    })
  }
  /**
   * PATCH request
   */
  ApiClient.prototype.patch = function (endpoint, data) {
    return __awaiter(this, void 0, void 0, function () {
      return __generator(this, function (_a) {
        return [
          2 /*return*/,
          this.request(endpoint, {
            method: 'PATCH',
            body: data ? JSON.stringify(data) : undefined,
          }),
        ]
      })
    })
  }
  /**
   * DELETE request
   */
  ApiClient.prototype.delete = function (endpoint) {
    return __awaiter(this, void 0, void 0, function () {
      return __generator(this, function (_a) {
        return [2 /*return*/, this.request(endpoint, { method: 'DELETE' })]
      })
    })
  }
  /**
   * Upload file
   */
  ApiClient.prototype.upload = function (endpoint, file, additionalData) {
    return __awaiter(this, void 0, void 0, function () {
      var formData, headers
      return __generator(this, function (_a) {
        formData = new FormData()
        formData.append('file', file)
        if (additionalData) {
          Object.entries(additionalData).forEach(function (_a) {
            var key = _a[0],
              value = _a[1]
            formData.append(key, String(value))
          })
        }
        headers = __assign({}, this.defaultHeaders)
        delete headers['Content-Type']
        return [
          2 /*return*/,
          this.request(endpoint, {
            method: 'POST',
            body: formData,
            headers: headers,
          }),
        ]
      })
    })
  }
  return ApiClient
})()
export { ApiClient }
// Default API client instance
export var apiClient = new ApiClient({
  baseUrl:
    (typeof process !== 'undefined' &&
      ((_a = process.env) === null || _a === void 0
        ? void 0
        : _a['NEXT_PUBLIC_API_URL'])) ||
    'http://localhost:5000',
})
