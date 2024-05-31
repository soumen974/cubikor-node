const express = require('express');
const bodyParser = require('body-parser');
const mariadb = require('mariadb');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const cors = require('cors');
const app = express();

app.use(bodyParser.json());
app.use(cors({
  origin: 'http://localhost:3000',
  optionsSuccessStatus: 200
}));

const pool = mariadb.createPool({
  host: 'localhost',
  user: 'root',
  password: '0123',
  database: 'userDB',
  connectionLimit: 5
});

async function executeQuery(query, params) {
  let conn;
  try {
    conn = await pool.getConnection();
    const rows = await conn.query(query, params);
    return rows;
  } catch (err) {
    throw err;
  } finally {
    if (conn) conn.release();
  }
}

const SECRET_KEY = 'soumen9749807435';

// User-related endpoints
// User registration
app.post('/register', [
  body('email').isEmail(),
  body('password').isLength({ min: 5 }),
  body('mobile_number').optional().isMobilePhone('any')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const user = req.body;
  const hashedPassword = await bcrypt.hash(user.password, 10);

  const checkQuery = 'SELECT COUNT(*) AS count FROM users WHERE email = ?';
  try {
    const checkResult = await executeQuery(checkQuery, [user.email]);
    if (checkResult[0].count > 0) {
      return res.status(400).json({ error: 'User already exists' });
    }
  } catch (err) {
    return res.status(500).send(`Error checking email: ${err.toString()}`);
  }

  const query = `INSERT INTO users (username, name, auth, email, password, mobile_number, date_of_birth, user_type ,country, security_question, security_answer, street, city, state, zipcode, shipping_country)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
  try {
    const result = await executeQuery(query, [
      user.username || '',
      user.name || '',
      user.auth || false,
      user.email,
      hashedPassword,
      user.mobile_number || null,
      user.date_of_birth || null,
      user.user_type || '',
      user.country || '',
      user.security_question || '',
      user.security_answer || '',
      user.shipping_address?.street || '',
      user.shipping_address?.city || '',
      user.shipping_address?.state || '',
      user.shipping_address?.zipcode || '',
      user.shipping_address?.country || ''
    ]);
    res.status(201).json({ message: 'User created successfully', id: result.insertId.toString() });
  } catch (err) {
    res.status(500).send(`Error creating user: ${err.toString()}`);
  }
});

// User login
app.post('/login', [
  body('email').isEmail(),
  body('password').isLength({ min: 5 })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { email, password } = req.body;
  const query = `SELECT * FROM users WHERE email = ?`;
  try {
    const rows = await executeQuery(query, [email]);
    if (rows.length > 0) {
      const user = rows[0];
      const match = await bcrypt.compare(password, user.password);
      if (match) {
        const token = jwt.sign({ id: user.id, email: user.email }, SECRET_KEY, { expiresIn: '1d' });
        res.status(200).json({ token, userId: user.id ,user_type: user.user_type});
      } else {
        res.status(401).json({ error: 'Invalid credentials' });
      }
    } else {
      res.status(401).json({ error: 'Invalid credentials' });
    }
  } catch (err) {
    res.status(500).send(`Error logging in: ${err.toString()}`);
  }
});

// Middleware to authenticate token
function authenticateToken(req, res, next) {
  const token = req.headers['authorization']?.split(' ')[1];
  if (token == null) return res.status(403).send('Token required');

  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) return res.status(403).send('Invalid token');
    req.user = user;
    next();
  });
}

// Get all users
app.get('/users', async (req, res) => {
  const query = `SELECT * FROM users`;
  try {
    const rows = await executeQuery(query, []);
    res.status(200).json(rows);
  } catch (err) {
    res.status(500).send(`Error retrieving users: ${err.toString()}`);
  }
});

// Get a user by ID
app.get('/users/:id', authenticateToken, async (req, res) => {
  const query = `SELECT * FROM users WHERE id = ?`;
  try {
    const rows = await executeQuery(query, [req.params.id]);
    if (rows.length === 0) {
      return res.status(404).send(`Could not find user with id ${req.params.id}`);
    }
    res.status(200).json(rows[0]);
  } catch (err) {
    res.status (500).send(`Error retrieving user: ${err.toString()}`);
  }
});

// Update a user by ID
app.put('/users/:id', authenticateToken, async (req, res) => {
  const user = req.body;
  const updates = [];
  const params = [];

  if (user.username) {
    updates.push('username = ?');
    params.push(user.username);
  }
  if (user.name) {
    updates.push('name = ?');
    params.push(user.name);
  }
  if (user.auth !== undefined) {
    updates.push('auth = ?');
    params.push(user.auth);
  }
  if (user.email) {
    updates.push('email = ?');
    params.push(user.email);
  }
  if (user.password) {
    const hashedPassword = await bcrypt.hash(user.password, 10);
    updates.push('password = ?');
    params.push(hashedPassword);
  }
  if (user.date_of_birth) {
    updates.push('date_of_birth = ?');
    params.push(user.date_of_birth);
  }
  if (user.country) {
    updates.push('country = ?');
    params.push(user.country);
  }
  if (user.security_question) {
    updates.push('security_question = ?');
    params.push(user.security_question);
  }
  if (user.security_answer) {
    updates.push('security_answer = ?');
    params.push(user.security_answer);
  }
  if (user.mobile_number) {
    updates.push('mobile_number = ?');
    params.push(user.mobile_number);
  }
  if (user.shipping_address?.street) {
    updates.push('street = ?');
    params.push(user.shipping_address.street);
  }
  if (user.shipping_address?.city) {
    updates.push('city = ?');
    params.push(user.shipping_address.city);
  }
  if (user.shipping_address?.state) {
    updates.push('state = ?');
    params.push(user.shipping_address.state);
  }
  if (user.shipping_address?.zipcode) {
    updates.push('zipcode = ?');
    params.push(user.shipping_address.zipcode);
  }
  if (user.shipping_address?.country) {
    updates.push('shipping_country = ?');
    params.push(user.shipping_address.country);
  }

  params.push(req.params.id);

  if (updates.length === 0) {
    return res.status(400).send('No valid fields to update');
  }

  const query = `UPDATE users SET ${updates.join(', ')} WHERE id = ?`;
  try {
    await executeQuery(query, params);
    res.status(200).send('User updated successfully');
  } catch (err) {
    res.status(500).send(`Error updating user: ${err.message}`);
  }
});

// Delete a user by ID
app.delete('/users/:id', authenticateToken, async (req, res) => {
  const query = `DELETE FROM users WHERE id = ?`;
  try {
    await executeQuery(query, [req.params.id]);
    res.status(200).send('User deleted successfully');
  } catch (err) {
    res.status(500).send(`Error deleting user: ${err.message}`);
  }
});

// Shopping cart operations
app.post('/users/:id/shopping_cart', authenticateToken, [
  body('CategoryId').notEmpty().withMessage('CategoryId is required'),
  body('productId').notEmpty().withMessage('productId is required'),
  body('quantity').isInt({ gt: 0 }).withMessage('Quantity must be a positive integer')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const userId = req.params.id;
  const { CategoryId, productId, quantity } = req.body;
  console.log('Request body:', req.body);

  const query = `INSERT INTO shopping_cart (user_id, CategoryId, productId, quantity) VALUES (?, ?, ?, ?)`;
  try {
    const result = await executeQuery(query, [userId, CategoryId, productId, quantity]);
    res.status(201).send({ id: result.insertId.toString() });
  } catch (err) {
    res.status(500).send(`Error adding item to shopping cart: ${err.message}`);
  }
});

app.get('/users/:id/shopping_cart', authenticateToken, async (req, res) => {
  const userId = req.params.id;
  const query = `SELECT * FROM shopping_cart WHERE user_id = ?`;
  try {
    const rows = await executeQuery(query, [userId]);
    res.status(200).json(rows);
  } catch (err) {
    res.status(500).send(`Error retrieving shopping cart: ${err.message}`);
  }
});

app.delete('/users/:id/shopping_cart/:item_id', authenticateToken, async (req, res) => {
  const userId = req.params.id;
  const itemId = req.params.item_id;
  const query = `DELETE FROM shopping_cart WHERE id = ? AND user_id = ?`;
  try {
    await executeQuery(query, [itemId, userId]);
    res.status(200).send('Item removed from shopping cart');
  } catch (err) {
    res.status(500).send(`Error removing item from shopping cart: ${err.message}`);
  }
});

// ---------PRODUCTS-------------

// Create a new category
app.post('/categories', authenticateToken, [
  body('name').notEmpty().withMessage('Name is required')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { name, href } = req.body;

  const query = `INSERT INTO categories (name, href) VALUES (?, ?)`;
  try {
    const result = await executeQuery(query, [name, href || '#']);
    res.status(201).json({ id: result.insertId.toString() });
  } catch (err) {
    res.status(500).send(`Error creating category: ${err.message}`);
  }
});

// Get all categories with products
app.get('/categories', async (req, res) => {
  const categoryQuery = `SELECT * FROM categories`;
  const productQuery = `SELECT * FROM products WHERE category_id = ?`;

  try {
    const categories = await executeQuery(categoryQuery, []);
    for (const category of categories) {
      const products = await executeQuery(productQuery, [category.id]);
      category.data = products;
    }
    res.status(200).json(categories);
  } catch (err) {
    res.status(500).send(`Error retrieving categories: ${err.message}`);
  }
});

// Get a category by ID with products
app.get('/categories/:id', async (req, res) => {
  const categoryQuery = `SELECT * FROM categories WHERE id = ?`;
  const productQuery = `SELECT * FROM products WHERE category_id = ?`;

  try {
    const categoryRows = await executeQuery(categoryQuery, [req.params.id]);
    if (categoryRows.length === 0) {
      return res.status(404).send(`Could not find category with id ${req.params.id}`);
    }
    const category = categoryRows[0];
    category.data = await executeQuery(productQuery, [category.id]);
    res.status(200).json(category);
  } catch (err) {
    res.status(500).send(`Error retrieving category: ${err.message}`);
  }
});

// Update a category by ID
app.put('/categories/:id', authenticateToken, async (req, res) => {
  const category = req.body;
  const updates = [];
  const params = [];

  if (category.name) {
    updates.push('name = ?');
    params.push(category.name);
  }
  if (category.href) {
    updates.push('href = ?');
    params.push(category.href);
  }

  params.push(req.params.id);

  if (updates.length === 0) {
    return res.status(400).send('No valid fields to update');
  }

  const query = `UPDATE categories SET ${updates.join(', ')} WHERE id = ?`;
  try {
    await executeQuery(query, params);
    res.status(200).send('Category updated successfully');
  } catch (err) {
    res.status(500).send(`Error updating category: ${err.message}`);
  }
});

// Delete a category by ID
app.delete('/categories/:id', authenticateToken, async (req, res) => {
  const query = `DELETE FROM categories WHERE id = ?`;
  try {
    await executeQuery(query, [req.params.id]);
    res.status(200).send('Category deleted successfully');
  } catch (err) {
    res.status(500).send(`Error deleting category: ${err.message}`);
  }
});

// Create a new product
app.post('/products', authenticateToken, [
  body('name').notEmpty().withMessage('Name is required'),
  body('price').notEmpty().withMessage('Price is required'),
  body('categoryId').notEmpty().withMessage('CategoryId is required')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { name, href, imageSrc, imageAlt, price, color, rating, reviewCount, description, details, highlights, categoryId } = req.body;

  const query = `INSERT INTO products (name, href, imageSrc, imageAlt, price, color, rating, reviewCount, description, details, highlights, category_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
  try {
    const result = await executeQuery(query, [name, href || '/', imageSrc, imageAlt, price, color, rating, reviewCount, description, details, highlights, categoryId]);
    res.status(201).json({ id: result.insertId.toString() });
  } catch (err) {
    res.status(500).send(`Error creating product: ${err.message}`);
  }
});

// Get all products
app.get('/products', async (req, res) => {
  const query = `SELECT * FROM products`;
  try {
    const rows = await executeQuery(query, []);
    res.status(200).json(rows);
  } catch (err) {
    res.status(500).send(`Error retrieving products: ${err.message}`);
  }
});

// Get a product by ID
app.get('/products/:id', async (req, res) => {
  const query = `SELECT * FROM products WHERE id = ?`;
  try {
    const rows = await executeQuery(query, [req.params.id]);
    if (rows.length === 0) {
      return res.status(404).send(`Could not find product with id ${req.params.id}`);
    }
    res.status(200).json(rows[0]);
  } catch (err) {
    res.status (500).send(`Error retrieving product: ${err.message}`);
  }
});

// Update a product by ID
app.put('/products/:id', authenticateToken, async (req, res) => {
  const product = req.body;
  const updates = [];
  const params = [];

  if (product.name) {
    updates.push('name = ?');
    params.push(product.name);
  }
  if (product.href) {
    updates.push('href = ?');
    params.push(product.href);
  }
  if (product.imageSrc) {
    updates.push('imageSrc = ?');
    params.push(product.imageSrc);
  }
  if (product.imageAlt) {
    updates.push('imageAlt = ?');
    params.push(product.imageAlt);
  }
  if (product.price) {
    updates.push('price = ?');
    params.push(product.price);
  }
  if (product.color) {
    updates.push('color = ?');
    params.push(product.color);
  }
  if (product.rating) {
    updates.push('rating = ?');
    params.push(product.rating);
  }
  if (product.reviewCount) {
    updates.push('reviewCount = ?');
    params.push(product.reviewCount);
  }
  if (product.description) {
    updates.push('description = ?');
    params.push(product.description);
  }
  if (product.details) {
    updates.push('details = ?');
    params.push(product.details);
  }
  if (product.highlights) {
    updates.push('highlights = ?');
    params.push(product.highlights);
  }
  if (product.categoryId) {
    updates.push('category_id = ?');
    params.push(product.categoryId);
  }

  params.push(req.params.id);

  if (updates.length === 0) {
    return res.status(400).send('No valid fields to update');
  }

  const query = `UPDATE products SET ${updates.join(', ')} WHERE id = ?`;
  try {
    await executeQuery(query, params);
    res.status(200).send('Product updated successfully');
  } catch (err) {
    res.status(500).send(`Error updating product: ${err.message}`);
  }
});

// Delete a product by ID
app.delete('/products/:id', authenticateToken, async (req, res) => {
  const query = `DELETE FROM products WHERE id = ?`;
  try {
    await executeQuery(query, [req.params.id]);
    res.status(200).send('Product deleted successfully');
  } catch (err) {
    res.status(500).send(`Error deleting product: ${err.message}`);
  }
});


// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
