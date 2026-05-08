// Global state
let cart = [];
let products = [];
let currentUser = null;

const API_BASE = 'http://localhost:3000/api';

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
  loadProducts();
  loadCart();
  checkAuthStatus();
});

// Page navigation
function showPage(pageName) {
  const pages = document.querySelectorAll('.page');
  pages.forEach(page => page.classList.remove('active'));
  document.getElementById(pageName).classList.add('active');
  
  if (pageName === 'shop') {
    loadProducts();
  }
  if (pageName === 'cart') {
    displayCart();
  }
}

// Product functions
async function loadProducts() {
  try {
    const response = await fetch(`${API_BASE}/products`);
    products = await response.json();
    displayProducts(products);
  } catch (error) {
    console.error('Error loading products:', error);
    // Load demo products
    loadDemoProducts();
  }
}

function loadDemoProducts() {
  products = [
    { id: 1, name: 'Miniature Robot', category: 'prints', price: 15.99, image: '🤖' },
    { id: 2, name: 'Phone Stand', category: 'prints', price: 12.99, image: '📱' },
    { id: 3, name: 'Vase Design', category: 'prints', price: 8.99, image: '🏺' },
    { id: 4, name: 'Low Poly Bust', category: 'models', price: 4.99, image: '👤' },
    { id: 5, name: 'Character Model', category: 'models', price: 6.99, image: '🎮' },
    { id: 6, name: 'Arduino Kit', category: 'electronics', price: 29.99, image: '⚙️' },
    { id: 7, name: 'LED Strips', category: 'electronics', price: 19.99, image: '💡' },
    { id: 8, name: 'Mechanical Keyboard Parts', category: 'electronics', price: 45.99, image: '⌨️' }
  ];
  displayProducts(products);
}

function displayProducts(productsToShow) {
  const container = document.getElementById('products');
  container.innerHTML = '';
  
  productsToShow.forEach(product => {
    const card = document.createElement('div');
    card.className = 'product-card';
    card.innerHTML = `
      <div class="product-image">${product.image || '📦'}</div>
      <div class="product-info">
        <h3>${product.name}</h3>
        <div class="product-category">${product.category}</div>
        <div class="product-price">$${product.price.toFixed(2)}</div>
        <button class="btn" onclick="addToCart(${product.id}, '${product.name}', ${product.price})">
          Add to Cart
        </button>
      </div>
    `;
    container.appendChild(card);
  });
}

function filterProducts(category) {
  // Update active filter button
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  event.target.classList.add('active');
  
  if (category === 'all') {
    displayProducts(products);
  } else {
    const filtered = products.filter(p => p.category === category);
    displayProducts(filtered);
  }
}

// Cart functions
function addToCart(productId, productName, price) {
  const existingItem = cart.find(item => item.id === productId);
  
  if (existingItem) {
    existingItem.quantity += 1;
  } else {
    cart.push({ id: productId, name: productName, price: price, quantity: 1 });
  }
  
  saveCart();
  updateCartCount();
  alert(`${productName} added to cart!`);
}

function removeFromCart(productId) {
  cart = cart.filter(item => item.id !== productId);
  saveCart();
  displayCart();
  updateCartCount();
}

function updateQuantity(productId, quantity) {
  const item = cart.find(item => item.id === productId);
  if (item) {
    item.quantity = parseInt(quantity);
    if (item.quantity <= 0) {
      removeFromCart(productId);
    } else {
      saveCart();
      displayCart();
    }
  }
}

function displayCart() {
  const container = document.getElementById('cart-items');
  container.innerHTML = '';
  
  if (cart.length === 0) {
    container.innerHTML = '<p>Your cart is empty</p>';
    document.getElementById('cart-total').textContent = '0.00';
    return;
  }
  
  let total = 0;
  cart.forEach(item => {
    const itemTotal = item.price * item.quantity;
    total += itemTotal;
    
    const itemDiv = document.createElement('div');
    itemDiv.className = 'cart-item';
    itemDiv.innerHTML = `
      <div>
        <h4>${item.name}</h4>
        <p>$${item.price.toFixed(2)} x 
          <input type="number" min="1" value="${item.quantity}" 
                 onchange="updateQuantity(${item.id}, this.value)" style="width: 50px;">
        </p>
      </div>
      <div>
        <p>$${itemTotal.toFixed(2)}</p>
        <button class="btn" onclick="removeFromCart(${item.id})">Remove</button>
      </div>
    `;
    container.appendChild(itemDiv);
  });
  
  document.getElementById('cart-total').textContent = total.toFixed(2);
}

function saveCart() {
  localStorage.setItem('cart', JSON.stringify(cart));
}

function loadCart() {
  const saved = localStorage.getItem('cart');
  if (saved) {
    cart = JSON.parse(saved);
    updateCartCount();
  }
}

function updateCartCount() {
  const count = cart.reduce((sum, item) => sum + item.quantity, 0);
  document.getElementById('cart-count').textContent = count;
}

// Authentication functions
async function login() {
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;
  
  try {
    const response = await fetch(`${API_BASE}/users/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    
    const data = await response.json();
    if (data.token) {
      localStorage.setItem('token', data.token);
      currentUser = data.user;
      updateAuthUI();
    }
  } catch (error) {
    alert('Login failed');
  }
}

async function signup() {
  const username = document.getElementById('signup-username').value;
  const email = document.getElementById('signup-email').value;
  const password = document.getElementById('signup-password').value;
  
  try {
    const response = await fetch(`${API_BASE}/users/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password })
    });
    
    const data = await response.json();
    if (data.token) {
      localStorage.setItem('token', data.token);
      currentUser = data.user;
      updateAuthUI();
    }
  } catch (error) {
    alert('Signup failed');
  }
}

function logout() {
  localStorage.removeItem('token');
  currentUser = null;
  updateAuthUI();
}

function toggleSignup() {
  document.getElementById('login-form').style.display = 
    document.getElementById('login-form').style.display === 'none' ? 'block' : 'none';
  document.getElementById('signup-form').style.display = 
    document.getElementById('signup-form').style.display === 'none' ? 'block' : 'none';
}

function checkAuthStatus() {
  const token = localStorage.getItem('token');
  if (token) {
    updateAuthUI();
  }
}

function updateAuthUI() {
  const loginForm = document.getElementById('login-form');
  const signupForm = document.getElementById('signup-form');
  const userDashboard = document.getElementById('user-dashboard');
  
  if (currentUser) {
    loginForm.style.display = 'none';
    signupForm.style.display = 'none';
    userDashboard.style.display = 'block';
  } else {
    loginForm.style.display = 'block';
    signupForm.style.display = 'none';
    userDashboard.style.display = 'none';
  }
}

// Payment processing
async function processPayment() {
  const token = localStorage.getItem('token');
  if (!token) {
    alert('Please login first');
    return;
  }
  
  if (cart.length === 0) {
    alert('Your cart is empty');
    return;
  }
  
  try {
    const response = await fetch(`${API_BASE}/payments/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        items: cart,
        total: cart.reduce((sum, item) => sum + (item.price * item.quantity), 0)
      })
    });
    
    const data = await response.json();
    if (data.success) {
      alert('Order placed successfully!');
      cart = [];
      saveCart();
      updateCartCount();
      showPage('home');
    }
  } catch (error) {
    alert('Payment failed: ' + error.message);
  }
}
