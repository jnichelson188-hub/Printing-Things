const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Database setup
const db = new sqlite3.Database('./database.db');

// Create tables
db.serialize(() => {
  // Products table
  db.run(`CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    price REAL NOT NULL,
    category TEXT NOT NULL,
    image TEXT,
    stock INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Users table
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Orders table
  db.run(`CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    total REAL NOT NULL,
    status TEXT DEFAULT 'pending',
    payment_method TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`);

  // Order items table
  db.run(`CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    price REAL NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id),
    FOREIGN KEY (product_id) REFERENCES products(id)
  )`);
});

// ===== PRODUCTS ROUTES =====

// Get all products
app.get('/api/products', (req, res) => {
  db.all('SELECT * FROM products', [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows || []);
  });
});

// Get single product
app.get('/api/products/:id', (req, res) => {
  db.get('SELECT * FROM products WHERE id = ?', [req.params.id], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(row);
  });
});

// Add new product (Admin)
app.post('/api/products', (req, res) => {
  const { name, description, price, category, image, stock } = req.body;
  
  db.run(
    'INSERT INTO products (name, description, price, category, image, stock) VALUES (?, ?, ?, ?, ?, ?)',
    [name, description, price, category, image, stock],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ id: this.lastID, message: 'Product added successfully' });
    }
  );
});

// Update product
app.put('/api/products/:id', (req, res) => {
  const { name, description, price, category, image, stock } = req.body;
  
  db.run(
    'UPDATE products SET name=?, description=?, price=?, category=?, image=?, stock=? WHERE id=?',
    [name, description, price, category, image, stock, req.params.id],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ message: 'Product updated successfully' });
    }
  );
});

// Delete product
app.delete('/api/products/:id', (req, res) => {
  db.run('DELETE FROM products WHERE id = ?', [req.params.id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ message: 'Product deleted successfully' });
  });
});

// ===== USER ROUTES =====

// Register
app.post('/api/users/register', (req, res) => {
  const { username, email, password } = req.body;
  
  const hashedPassword = bcrypt.hashSync(password, 10);
  
  db.run(
    'INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
    [username, email, hashedPassword],
    function(err) {
      if (err) {
        res.status(400).json({ error: 'User already exists' });
        return;
      }
      
      const token = jwt.sign({ id: this.lastID, email }, JWT_SECRET, { expiresIn: '7d' });
      res.json({ 
        token, 
        user: { id: this.lastID, username, email },
        message: 'Registration successful' 
      });
    }
  );
});

// Login
app.post('/api/users/login', (req, res) => {
  const { email, password } = req.body;
  
  db.get('SELECT * FROM users WHERE email = ?', [email], (err, user) => {
    if (err || !user) {
      res.status(401).json({ error: 'User not found' });
      return;
    }
    
    if (!bcrypt.compareSync(password, user.password)) {
      res.status(401).json({ error: 'Invalid password' });
      return;
    }
    
    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ 
      token, 
      user: { id: user.id, username: user.username, email: user.email },
      message: 'Login successful' 
    });
  });
});

// ===== ORDERS ROUTES =====

// Create order
app.post('/api/orders', (req, res) => {
  const { user_id, items, total, payment_method } = req.body;
  
  db.run(
    'INSERT INTO orders (user_id, total, payment_method, status) VALUES (?, ?, ?, ?)',
    [user_id, total, payment_method, 'completed'],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      
      const orderId = this.lastID;
      
      // Add order items
      items.forEach(item => {
        db.run(
          'INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)',
          [orderId, item.id, item.quantity, item.price]
        );
      });
      
      res.json({ id: orderId, message: 'Order created successfully' });
    }
  );
});

// Get user orders
app.get('/api/orders/user/:user_id', (req, res) => {
  db.all('SELECT * FROM orders WHERE user_id = ?', [req.params.user_id], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows || []);
  });
});

// ===== PAYMENT ROUTES =====

// Process payment
app.post('/api/payments/create', (req, res) => {
  const { items, total } = req.body;
  const userId = 1; // Would get from auth token in production
  
  // Simulate payment processing
  db.run(
    'INSERT INTO orders (user_id, total, payment_method, status) VALUES (?, ?, ?, ?)',
    [userId, total, 'card', 'completed'],
    function(err) {
      if (err) {
        res.status(500).json({ success: false, error: err.message });
        return;
      }
      
      res.json({ 
        success: true, 
        orderId: this.lastID,
        message: 'Payment processed successfully' 
      });
    }
  );
});

// ===== ADMIN PANEL =====

// Get all users (Admin)
app.get('/api/admin/users', (req, res) => {
  db.all('SELECT id, username, email, created_at FROM users', [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows || []);
  });
});

// Get all orders (Admin)
app.get('/api/admin/orders', (req, res) => {
  db.all('SELECT * FROM orders ORDER BY created_at DESC', [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows || []);
  });
});

// ===== START SERVER =====

app.listen(PORT, () => {
  console.log(`🚀 Printing Things server running on http://localhost:${PORT}`);
  console.log(`📦 API available at http://localhost:${PORT}/api`);
  console.log(`🏪 Visit http://localhost:${PORT} in your browser`);
});
