/**
 * Price calculation utilities.
 */

/**
 * Calculate the price of a single sandwich configuration.
 * @param {string} sizeId - 'S', 'M', or 'L'
 * @param {number} optionalCount - number of optional ingredients selected
 * @returns {number}
 */
function sandwichPrice(size, optionalCount) {
  const base = size.base_price ?? 0;
  const included = size.included_ingredients ?? 0;
  const extra = Math.max(0, optionalCount - included);
  return base * (1 + 0.3 * extra);
}

/**
 * Calculate the total order price, applying discount if >= 4 sandwiches.
 * @param {Array} items - [{sizeId, optionalCount, quantity}]
 * @returns {{ subtotal: number, total: number, discount: boolean, totalQty: number }}
 */
function orderTotal(items, sizes) {
  //console.log(sizes)
  let subtotal = 0;
  let totalQty = 0;
  for (const item of items) {
    const size = sizes.find(s => s.id === item.sizeId) || {};
    const price = sandwichPrice(size, item.optionalCount ?? 0);
    subtotal += price * (item.quantity ?? 1);
    totalQty += item.quantity ?? 1;
  }
  const discount = totalQty >= 4;
  const total = discount ? subtotal * 0.8 : subtotal;
  return {
    subtotal: Math.round(subtotal * 100) / 100,
    total: Math.round(total * 100) / 100,
    discount,
    totalQty,
  };
}


export {
  sandwichPrice,
  orderTotal
}