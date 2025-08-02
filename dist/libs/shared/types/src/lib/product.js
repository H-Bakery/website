/**
 * Product-related type definitions for the bakery system
 */
// Product categories
export var ProductCategory
;(function (ProductCategory) {
  ProductCategory['Bread'] = 'Brot'
  ProductCategory['Buns'] = 'Br\u00F6tchen'
  ProductCategory['Pastries'] = 'Teilchen'
  ProductCategory['Cakes'] = 'Kuchen'
  ProductCategory['SpecialCakes'] = 'Torten'
  ProductCategory['Snacks'] = 'Snacks'
  ProductCategory['Beverages'] = 'Getr\u00E4nke'
})(ProductCategory || (ProductCategory = {}))
// Product types for better categorization
export var ProductType
;(function (ProductType) {
  ProductType['Fresh'] = 'fresh'
  ProductType['Frozen'] = 'frozen'
  ProductType['Packaged'] = 'packaged'
  ProductType['Seasonal'] = 'seasonal'
})(ProductType || (ProductType = {}))
// Product status
export var ProductStatus
;(function (ProductStatus) {
  ProductStatus['Available'] = 'available'
  ProductStatus['OutOfStock'] = 'out_of_stock'
  ProductStatus['Discontinued'] = 'discontinued'
  ProductStatus['Seasonal'] = 'seasonal'
})(ProductStatus || (ProductStatus = {}))
// Type guards
export function isProductCategory(category) {
  return Object.values(ProductCategory).includes(category)
}
export function isProductType(type) {
  return Object.values(ProductType).includes(type)
}
export function isProductStatus(status) {
  return Object.values(ProductStatus).includes(status)
}
