/* ================= SHOPZO INTEGRATION ================= */
// Connects this storefront to the Shopzo platform (api.shopzo.be).
// Change SHOPZO_SELLER below if this store's slug in Shopzo is ever renamed.

const SHOPZO_API_BASE = 'https://api.shopzo.be';
const SHOPZO_SELLER = 'happy-paws';
const CART_STORAGE_KEY = 'shopzo_cart_happy-paws';

/* ---------- Cart (stored in the browser, per device) ---------- */

function getCart() {
  try {
    return JSON.parse(localStorage.getItem(CART_STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function saveCart(cart) {
  localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
  renderCartCount();
}

function addToCart(productId, quantity = 1) {
  const cart = getCart();
  const existing = cart.find((line) => line.product_id === productId);
  if (existing) {
    existing.quantity += quantity;
  } else {
    cart.push({ product_id: productId, quantity });
  }
  saveCart(cart);
}

function updateCartQuantity(productId, quantity) {
  let cart = getCart();
  if (quantity < 1) {
    cart = cart.filter((line) => line.product_id !== productId);
  } else {
    const line = cart.find((l) => l.product_id === productId);
    if (line) line.quantity = quantity;
  }
  saveCart(cart);
}

function removeFromCart(productId) {
  const cart = getCart().filter((line) => line.product_id !== productId);
  saveCart(cart);
}

function cartItemCount() {
  return getCart().reduce((sum, line) => sum + line.quantity, 0);
}

// Updates every .cart-count badge on the current page (header shows one on
// every template) to reflect the real number of items in the cart.
function renderCartCount() {
  const count = cartItemCount();
  document.querySelectorAll('.cart-count').forEach((el) => {
    el.textContent = count;
    el.style.display = count > 0 ? 'flex' : 'none';
  });
}

/* ---------- Talking to api.shopzo.be ---------- */

async function shopzoFetchProducts() {
  const res = await fetch(`${SHOPZO_API_BASE}/products?seller=${SHOPZO_SELLER}`);
  if (!res.ok) throw new Error('Could not load products');
  const data = await res.json();
  return data.products;
}

async function shopzoFetchProduct(productId) {
  const res = await fetch(`${SHOPZO_API_BASE}/products?seller=${SHOPZO_SELLER}&id=${productId}`);
  if (!res.ok) throw new Error('Product not found');
  const data = await res.json();
  return data.product;
}

async function shopzoCheckout({ name, email }) {
  const cart = getCart();
  if (cart.length === 0) throw new Error('Your cart is empty.');

  const res = await fetch(`${SHOPZO_API_BASE}/checkout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      seller: SHOPZO_SELLER,
      customer: { name, email },
      items: cart.map((line) => ({ product_id: line.product_id, quantity: line.quantity })),
      redirect_url: `${window.location.origin}/thankyou.html`
    })
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Checkout failed. Please try again.');
  return data; // { order_id, checkout_url }
}

/* ---------- Formatting + rendering helpers ---------- */

function formatEuro(cents) {
  return (cents / 100).toLocaleString('en-BE', { style: 'currency', currency: 'EUR' });
}

// Renders one product as the site's existing "hang-tag" card markup, so
// dynamic products look identical to the original static ones. Pass
// { linkToDetail: true } to wrap the card in a link to product.html.
function renderProductCard(product, { linkToDetail = true } = {}) {
  const onSale = !!product.sale_price_cents;
  const priceHtml = onSale
    ? `<span class="price">${formatEuro(product.sale_price_cents)}</span><span class="price-old">${formatEuro(product.price_cents)}</span>`
    : `<span class="price">${formatEuro(product.price_cents)}</span>`;

  const thumbHtml = product.image_url
    ? `<img src="${product.image_url}" alt="${escapeHtml(product.name)}" style="width:100%;height:120px;object-fit:cover;border-radius:10px;margin-bottom:14px;">`
    : `<div class="product-thumb">🛍️</div>`;

  const badge = onSale ? '<span class="badge badge-mustard">Sale</span>' : '';

  const inner = `
    <div class="string"></div>
    <div class="product-tag">
      ${badge}
      <div class="tag-hole-top"></div>
      ${thumbHtml}
      <h4>${escapeHtml(product.name)}</h4>
      <div class="price-row">${priceHtml}</div>
      <div class="approved">${escapeHtml(product.category || '')}</div>
    </div>
  `;

  if (linkToDetail) {
    return `<a class="product-card" href="product.html?id=${product.id}" style="display:block;">${inner}</a>`;
  }
  return `<div class="product-card">${inner}</div>`;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

// Runs on every page load to keep the header cart badge accurate.
document.addEventListener('DOMContentLoaded', renderCartCount);
