/**
 * Order and order item type definitions
 */
// Order status enum
export var OrderStatus
;(function (OrderStatus) {
  OrderStatus['Pending'] = 'pending'
  OrderStatus['Confirmed'] = 'confirmed'
  OrderStatus['InProgress'] = 'in_progress'
  OrderStatus['Ready'] = 'ready'
  OrderStatus['Completed'] = 'completed'
  OrderStatus['Cancelled'] = 'cancelled'
})(OrderStatus || (OrderStatus = {}))
// Payment status enum
export var PaymentStatus
;(function (PaymentStatus) {
  PaymentStatus['Pending'] = 'pending'
  PaymentStatus['Paid'] = 'paid'
  PaymentStatus['Failed'] = 'failed'
  PaymentStatus['Refunded'] = 'refunded'
})(PaymentStatus || (PaymentStatus = {}))
// Payment method enum
export var PaymentMethod
;(function (PaymentMethod) {
  PaymentMethod['Cash'] = 'cash'
  PaymentMethod['Card'] = 'card'
  PaymentMethod['BankTransfer'] = 'bank_transfer'
  PaymentMethod['PayPal'] = 'paypal'
})(PaymentMethod || (PaymentMethod = {}))
// Type guards
export function isOrderStatus(status) {
  return Object.values(OrderStatus).includes(status)
}
export function isPaymentStatus(status) {
  return Object.values(PaymentStatus).includes(status)
}
export function isPaymentMethod(method) {
  return Object.values(PaymentMethod).includes(method)
}
