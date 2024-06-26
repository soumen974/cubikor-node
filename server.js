const express = require('express');
const bodyParser = require('body-parser');
const mariadb = require('mariadb');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const cors = require('cors');
const multer = require('multer'); // Import multer
const fs = require('fs');
const path = require('path'); // Import path module

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

    // Convert any BigInt values to string before returning
    return JSON.parse(JSON.stringify(rows, (key, value) =>
      typeof value === 'bigint' ? value.toString() : value
    ));
  } catch (err) {
    throw err;
  } finally {
    if (conn) conn.release();
  }
}

app.use('/uploads', express.static('uploads'));

app.use((req, res, next) => {
  const originalJson = res.json;
  res.json = function (data) {
    return originalJson.call(this, JSON.parse(JSON.stringify(data, (key, value) =>
      typeof value === 'bigint' ? value.toString() : value
    )));
  };
  next();
});

const SECRET_KEY = 'soumen9749807435';

// Multer configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, './uploads'); // Ensure this path matches your server setup
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});


const uploads = multer({ storage: storage });

// Routes for demo user operations
app.get('/api/users-demo', async (req, res) => {
  try {
    const users = await pool.query('SELECT * FROM demo_user');
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/users-demo', uploads.fields([{ name: 'image', maxCount: 1 }, { name: 'resume', maxCount: 1 }]), async (req, res) => {
  const { name, email } = req.body;
  const image = req.files['image'][0].path;
  const resume = req.files['resume'][0].path;

  try {
    const result = await pool.query('INSERT INTO demo_user (name, email, image, resume) VALUES (?, ?, ?, ?)', [name, email, image, resume]);
    res.json({ id: result.insertId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/users-demo/:id', uploads.fields([{ name: 'image', maxCount: 1 }, { name: 'resume', maxCount: 1 }]), async (req, res) => {
  const { id } = req.params;
  const { name, email } = req.body;
  const image = req.files['image'] ? req.files['image'][0].path : null;
  const resume = req.files['resume'] ? req.files['resume'][0].path : null;

  try {
    const user = await pool.query('SELECT * FROM demo_user WHERE id = ?', [id]);

    if (user.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const updatedUser = {
      name: name || user[0].name,
      email: email || user[0].email,
      image: image || user[0].image,
      resume: resume || user[0].resume
    };

    if (image && user[0].image) {
      fs.unlinkSync(user[0].image);
    }
    if (resume && user[0].resume) {
      fs.unlinkSync(user[0].resume);
    }

    await pool.query('UPDATE demo_user SET name = ?, email = ?, image = ?, resume = ? WHERE id = ?', [updatedUser.name, updatedUser.email, updatedUser.image, updatedUser.resume, id]);
    res.json(updatedUser);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/users-demo/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const user = await pool.query('SELECT * FROM demo_user WHERE id = ?', [id]);

    if (user.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user[0].image) {
      fs.unlinkSync(user[0].image);
    }
    if (user[0].resume) {
      fs.unlinkSync(user[0].resume);
    }

    await pool.query('DELETE FROM demo_user WHERE id = ?', [id]);
    res.json({ message: 'User deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});





// ----------------DEMO-----------------


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
  const query = `SELECT * FROM users WHERE email = ? ` ;
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
  body('quantity').isInt({ gt: 0 }).withMessage('Quantity must be a positive integer'),
  body('shopId').notEmpty().withMessage('shopId is required')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const userId = req.params.id;
  const { CategoryId, productId, quantity, shopId } = req.body;

  // Check if the product is already in the cart
  const checkQuery = `SELECT * FROM shopping_cart WHERE user_id = ? AND productId = ?`;
  try {
    const existingItem = await executeQuery(checkQuery, [userId, productId]);
    if (existingItem.length > 0) {
      return res.status(400).json({ message: 'This product is already in the cart' });
    }

    // Insert the new item into the cart
    const query = `INSERT INTO shopping_cart (user_id, CategoryId, productId, quantity, shopId) VALUES (?, ?, ?, ?, ?)`;
    const result = await executeQuery(query, [userId, CategoryId, productId, quantity, shopId]);
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

app.put('/users/:id/shopping_cart/:productId', authenticateToken, [
  body('quantity').isInt({ gt: 0 }).withMessage('Quantity must be a positive integer')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const userId = req.params.id;
  const productId = req.params.productId;
  const { quantity } = req.body;

  const query = `UPDATE shopping_cart SET quantity = ? WHERE user_id = ? AND productId = ?`;
  const params = [quantity, userId, productId];

  try {
    

    const result = await executeQuery(query, params);

    if (result.affectedRows === 0) {
      return res.status(404).send('Item not found in shopping cart');
    }

    res.status(200).send('Item updated successfully');
  } catch (err) {
    console.error('Error executing query:', err);
    res.status(500).send(`Error updating item in shopping cart: ${err.message}`);
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
// -------Shop--PRODUCTS-------------

// Register a new shop
app.post('/shops/register', [
  body('email').isEmail(),
  body('password').isLength({ min: 5 })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const shopOwner = req.body;

  try {
    const hashedPassword = await bcrypt.hash(shopOwner.password, 10);

    const checkQuery = 'SELECT COUNT(*) AS count FROM shops WHERE email = ?';
    const checkResult = await executeQuery(checkQuery, [shopOwner.email]);
    if (checkResult[0].count > 0) {
      return res.status(400).json({ error: 'User already exists' });
    }

    const query = `INSERT INTO shops (name, email, mobile, address, password) VALUES (?, ?, ?, ?, ?)`;
    const result = await executeQuery(query, [
      shopOwner.name ,
      shopOwner.email,
      shopOwner.mobile || '',
      shopOwner.address || '',
      hashedPassword
    ]);

    res.status(201).json({ message: 'User created successfully', id: result.insertId.toString() });
  } catch (err) {
    res.status(500).send(`Error creating user: ${err.toString()}`);
  }
});

// Login a shop
app.post('/shops/login', [
  body('email').isEmail(),
  body('password').isLength({ min: 5 })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  const { email, password } = req.body;
  const query = `SELECT * FROM shops WHERE email = ? ` ;
  try {
    const rows = await executeQuery(query, [email]);
    if (rows.length > 0) {
      const user = rows[0];
      const match = await bcrypt.compare(password, user.password);
      if (match) {
        const token = jwt.sign({ id: user.id, email: user.email }, SECRET_KEY, { expiresIn: '7d' });
        res.status(200).json({ token, userId: user.id });
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

// all shop
app.get('/shops', async (req, res) => {
  const query = `SELECT * FROM shops`;
  try {
    const shops = await executeQuery(query, []);
    res.status(200).json(shops);
  } catch (err) {
    res.status(500).send(`Error retrieving shops: ${err.message}`);
  }
});

// shop with id

app.get('/shops/:id', async (req, res) => {
  const shopId = req.params.id;
  
  // Query to fetch the shop by its ID
  const query = `SELECT * FROM shops WHERE id = ?`;
  
  try {
    const shopRows = await executeQuery(query, [shopId]);
    if (shopRows.length === 0) {
      return res.status(404).send(`Could not find shop with id ${shopId}`);
    }
    
    // Return the shop details as JSON
    const shop = shopRows[0];
    res.status(200).json(shop);
  } catch (err) {
    res.status(500).send(`Error retrieving shop: ${err.message}`);
  }
});

//  update a shop
app.put('/shops/:id',authenticateToken, async (req, res) => {
  const shopId = req.params.id;
  const { name, email, mobile, address, password } = req.body;

  // Check if shop exists
  const shopQuery = `SELECT * FROM shops WHERE id = ?`;
  try {
    const shopRows = await executeQuery(shopQuery, [shopId]);
    if (shopRows.length === 0) {
      return res.status(404).send(`Could not find shop with id ${shopId}`);
    }

    // Update shop
    const hashedPassword = await bcrypt.hash(password, 10);
    const updateQuery = `UPDATE shops SET name = ?, email = ?, mobile = ?, address = ?, password = ? WHERE id = ?`;
    const params = [name, email, mobile, address, hashedPassword, shopId];
    await executeQuery(updateQuery, params);

    res.status(200).send('Shop updated successfully');
  } catch (err) {
    res.status(500).send(`Error updating shop: ${err.message}`);
  }
});

// delete a shop

app.delete('/shops/:id',authenticateToken, async (req, res) => {
  const shopId = req.params.id;

  // Check if shop exists
  const shopQuery = `SELECT * FROM shops WHERE id = ?`;
  try {
    const shopRows = await executeQuery(shopQuery, [shopId]);
    if (shopRows.length === 0) {
      return res.status(404).send(`Could not find shop with id ${shopId}`);
    }

    // Delete shop
    const deleteQuery = `DELETE FROM shops WHERE id = ?`;
    await executeQuery(deleteQuery, [shopId]);

    res.status(200).send('Shop deleted successfully');
  } catch (err) {
    res.status(500).send(`Error deleting shop: ${err.message}`);
  }
});


// shop data entry----------------

// Create a new category for a shop
app.post('/shops/:shopId/categories', authenticateToken, async (req, res) => {
  const shopId = req.params.shopId;
  const { name } = req.body;

  // Insert the new category into the database
  const insertQuery = `INSERT INTO catg (name, shop_id) VALUES (?, ?)`;
  
  try {
    const result = await executeQuery(insertQuery, [name, shopId]);
    res.status(201).json({ id: result.insertId.toString() });
  } catch (err) {
    res.status(500).send(`Error creating category: ${err.message}`);
  }
});



// Get all categories with products for a shop
app.get('/shops/:shopId/categories', async (req, res) => {
  const shopId = req.params.shopId;
  const categoryQuery = `SELECT * FROM catg WHERE shop_id = ?`;
  const productQuery = `SELECT * FROM prd WHERE category_id = ? AND shop_id = ?`;

  try {
    const categories = await executeQuery(categoryQuery, [shopId]);
    for (const category of categories) {
      const products = await executeQuery(productQuery, [category.id, shopId]);
      category.data = products;
    }
    res.status(200).json(categories);
  } catch (err) {
    res.status(500).send(`Error retrieving categories: ${err.message}`);
  }
});

// Get a category by ID with products for a shop
app.get('/shops/:shopId/categories/:id', authenticateToken, async (req, res) => {
  const shopId = req.params.shopId;
  const categoryId = req.params.id;
  const categoryQuery = `SELECT * FROM catg WHERE id = ? AND shop_id = ?`;
  const productQuery = `SELECT * FROM prd WHERE category_id = ? AND shop_id = ?`;

  try {
    const categoryRows = await executeQuery(categoryQuery, [categoryId, shopId]);
    if (categoryRows.length === 0) {
      return res.status(404).send(`Could not find category with id ${categoryId}`);
    }
    const category = categoryRows[0];
    category.data = await executeQuery(productQuery, [category.id, shopId]);
    res.status(200).json(category);
  } catch (err) {
    res.status(500).send(`Error retrieving category: ${err.message}`);
  }
});

// Update a category by ID for a shop
app.put('/shops/:shopId/categories/:id', authenticateToken, async (req, res) => {
  const shopId = req.params.shopId;
  const categoryId = req.params.id;
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

  params.push(categoryId);
  params.push(shopId);

  if (updates.length === 0) {
    return res.status(400).send('No valid fields to update');
  }

  const query = `UPDATE catg SET ${updates.join(', ')} WHERE id = ? AND shop_id = ?`;
  try {
    await executeQuery(query, params);
    res.status(200).send('Category updated successfully');
  } catch (err) {
    res.status(500).send(`Error updating category: ${err.message}`);
  }
});

// Delete a category by ID for a shop
app.delete('/shops/:shopId/categories/:id', authenticateToken, async (req, res) => {
  const shopId = req.params.shopId;
  const categoryId = req.params.id;
  const query = `DELETE FROM catg WHERE id = ? AND shop_id = ?`;
  try {
    await executeQuery(query, [categoryId, shopId]);
    res.status(200).send('Category deleted successfully');
  } catch (err) {
    res.status(500).send(`Error deleting category: ${err.message}`);
  }
});




// Create a new product for a shop
app.post('/shops/:shopId/products', authenticateToken, uploads.single('product_image'), [
  body('name').notEmpty().withMessage('Name is required'),
  body('price').notEmpty().withMessage('Price is required'),
  body('categoryId').notEmpty().withMessage('CategoryId is required')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { name, href, imageSrc, imageAlt, price, color, rating, reviewCount, description, details, highlights, categoryId } = req.body;
  const shopId = req.params.shopId;
  const product_image = req.file ? req.file.path : ''; // Get the uploaded file path

  const query = `INSERT INTO prd (name, href, imageSrc, imageAlt, price, color, rating, reviewCount, description, details, highlights, category_id, shop_id, product_image) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
  
  try {
    // Check if the category exists
    const categoryCheckQuery = 'SELECT id FROM catg WHERE id = ?';
    const categoryCheck = await executeQuery(categoryCheckQuery, [categoryId]);
    if (categoryCheck.length === 0) {
      return res.status(400).json({ error: 'Invalid categoryId' });
    }

    // Check if the shop exists
    const shopCheckQuery = 'SELECT id FROM shops WHERE id = ?';
    const shopCheck = await executeQuery(shopCheckQuery, [shopId]);
    if (shopCheck.length === 0) {
      return res.status(400).json({ error: 'Invalid shopId' });
    }

    // Insert the new product
    const result = await executeQuery(query, [name, href || '/', imageSrc, imageAlt, price, color, rating, reviewCount, description, details, highlights, categoryId, shopId, product_image]);
    res.status(201).json({ id: result.insertId.toString() });
  } catch (err) {
    console.error('Error creating product:', err);
    res.status(500).send(`Error creating product: ${err.message}`);
  }
});


// Get all products for a shop
app.get('/shops/:shopId/products', async (req, res) => {
  const shopId = req.params.shopId;
  const query = `SELECT * FROM prd WHERE shop_id = ?`;
  try {
    const rows = await executeQuery(query, [shopId]);
    res.status(200).json(rows);
  } catch (err) {
    res.status(500).send(`Error retrieving products: ${err.message}`);
  }
});

// Get a product by ID for a shop
app.get('/shops/:shopId/products/:id', async (req, res) => {
  const shopId = req.params.shopId;
  const productId = req.params.id;
  const query = `SELECT * FROM prd WHERE id = ? AND shop_id = ?`;
  try {
    const rows = await executeQuery(query, [productId, shopId]);
    if (rows.length === 0) return res.status(404).send(`Could not find product with id ${productId}`);
    res.status(200).json(rows[0]);
  } catch (err) {
    res.status(500).send(`Error retrieving product: ${err.message}`);
  }
});

// Get product details by product ID
app.get('/products/:id', authenticateToken, async (req, res) => {
  const productId = req.params.id;
  const query = `SELECT * FROM prd WHERE id = ?`;
  try {
    const rows = await executeQuery(query, [productId]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.status(200).json(rows[0]);
  } catch (err) {
    res.status(500).send(`Error retrieving product: ${err.message}`);
  }
});

// Update a product by ID for a shop
app.put('/shops/:shopId/products/:id', authenticateToken, async (req, res) => {
  const shopId = req.params.shopId;
  const productId = req.params.id;
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

  params.push(productId);
  params.push(shopId);

  if (updates.length === 0) {
    return res.status(400).send('No valid fields to update');
  }

  const query = `UPDATE prd SET ${updates.join(', ')} WHERE id = ? AND shop_id = ?`;
  try {
    await executeQuery(query, params);
    res.status(200).send('Product updated successfully');
  } catch (err) {
    res.status(500).send(`Error updating product: ${err.message}`);
  }
});

// Delete a product by ID for a shop
app.delete('/shops/:shopId/products/:id', authenticateToken, async (req, res) => {
  const shopId = req.params.shopId;
  const productId = req.params.id;
  const query = `DELETE FROM prd WHERE id = ? AND shop_id = ?`;
  try {
    await executeQuery(query, [productId, shopId]);
    res.status(200).send('Product deleted successfully');
  } catch (err) {
    res.status(500).send(`Error deleting product: ${err.message}`);
  }
});

// fetch products from all shops.
app.get('/products/all', authenticateToken, async (req, res) => {
  const query = 'SELECT * FROM prd';
  try {
    const rows = await executeQuery(query);
    res.status(200).json(rows);
  } catch (err) {
    console.error('Error retrieving products:', err);
    res.status(500).json({ error: 'Error retrieving products', message: err.message });
  }
});


// Search endpoint
// GET /products - Search products by keyword and return only IDs
app.get('/products', async (req, res) => {
  const { q } = req.query; // q is the search query parameter
  const searchQuery = `
    SELECT id
    FROM prd 
    WHERE name LIKE ? 
       OR description LIKE ? 
       OR details LIKE ? 
       OR highlights LIKE ?
  `;
  const queryParams = Array(4).fill(`%${q}%`);

  try {
    const rows = await executeQuery(searchQuery, queryParams);
    // Extracting only the IDs from the rows
    const productIds = rows.map(row => row.id);
    res.status(200).json(productIds);
  } catch (err) {
    res.status(500).send(`Error searching products: ${err.message}`);
  }
});



// ------image-uploder

const upload = multer({ dest: 'uploads/' });

app.post('/upload', upload.single('image'), async (req, res) => {
  try {
    const conn = await pool.getConnection();
    const fileContent = fs.readFileSync(req.file.path);
    await conn.query("INSERT INTO images (data) VALUES (?)", [fileContent]);
    fs.unlinkSync(req.file.path); // delete the file after uploading to database
    res.status(200).send('Image uploaded and stored in database successfully.');
  } catch (err) {
    
    res.status(500).send(`Server error: ${err.message}`);
  }
});


app.get('/images', async (req, res) => {
  try {
    const conn = await pool.getConnection();
    const [results] = await conn.query("SELECT * FROM images");
    res.status(200).json(results);
  } catch (err) {
    
    res.status(500).send(`Server error: ${err.message}`);
  }
});


app.get('/images/:id', async (req, res) => {
  try {
    const conn = await pool.getConnection();
    const [results] = await conn.query("SELECT * FROM images WHERE id = ?", [req.params.id]);
    if (results.length === 0) {
      return res.status(404).send('Image not found');
    }
    res.status(200).json(results[0]);
  } catch (err) {
    res.status(500).send(`Server error: ${err.message}`);
  }
});


app.put('/images/:id', upload.single('image'), async (req, res) => {
  try {
    const conn = await pool.getConnection();
    const fileContent = fs.readFileSync(req.file.path);
    await conn.query("UPDATE images SET data = ? WHERE id = ?", [fileContent, req.params.id]);
    fs.unlinkSync(req.file.path); // delete the file after uploading to database
    res.status(200).send('Image updated successfully.');
  } catch (err) {
    res.status(500).send(`Server error: ${err.message}`);
  }
});


app.delete('/images/:id', async (req, res) => {
  try {
    const conn = await pool.getConnection();
    await conn.query("DELETE FROM images WHERE id = ?", [req.params.id]);
    res.status(200).send('Image deleted successfully.');
  } catch (err) {
    res.status(500).send(`Server error: ${err.message}`);
  }
});

//----------- seller to buyer order --------------------------------//

// Place a new order
// Order placing endpoint
app.post('/place-order', async (req, res) => {
  const {
    customerId, productId, sellerId, quantity, userAddress,
    productName, productImageSrc, productPrice, userName, userMobileNumber
  } = req.body;


  // Input validation
  if (!customerId || !productId || !sellerId || !quantity || !userAddress ||
      !productName || !productImageSrc || !productPrice || !userName || !userMobileNumber) {
    return res.status(400).json({ message: 'Missing required fields' });
  }

  try {
    await executeQuery('START TRANSACTION');

    // Insert into CustomerOrders
    const customerOrderResult = await executeQuery(
      `INSERT INTO CustomerOrders (customer_id, product_id, seller_id, quantity, Product_name, product_imageSrc, product_price)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [customerId, productId, sellerId, quantity, productName, productImageSrc, productPrice]
    );

    const orderId = customerOrderResult.insertId;

    // Insert into SellerOrders with all required fields
    const sellerOrderQuery = `INSERT INTO SellerOrders
      (order_id, seller_id, customer_id, product_id, quantity, user_address, Product_name, product_imageSrc, product_price, user_name, user_mobileNumber, order_date, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, current_timestamp(), 'Order Placed')`;

    await executeQuery(sellerOrderQuery, [orderId, sellerId, customerId, productId, quantity, userAddress, productName, productImageSrc, productPrice, userName, userMobileNumber]);

    // Remove the product from the shopping cart
    const deleteQuery = `DELETE FROM shopping_cart WHERE user_id = ? AND productId = ?`;
    console.log(`Executing delete query: ${deleteQuery} with parameters: ${customerId}, ${productId}`); // Log the query and parameters
    const deleteResult = await executeQuery(deleteQuery, [customerId, productId]);
    console.log('Deleted from shopping cart:', deleteResult); // Log the deletion result

    // Commit transaction
    await executeQuery('COMMIT');

    res.status(201).json({ message: 'Order placed successfully', orderId });
  } catch (error) {
    await executeQuery('ROLLBACK');
    res.status(500).json({ message: 'Error placing order', error: error.message });
  }
});

// Route to get all items from SellerOrders by sellerId
app.get('/seller-orders/:sellerId', async (req, res) => {
  const { sellerId } = req.params;

  if (!sellerId) {
    return res.status(400).json({ message: 'Seller ID is required' });
  }

  try {
    const query = 'SELECT * FROM SellerOrders WHERE seller_id = ?';
    const sellerOrders = await executeQuery(query, [sellerId]);

    if (sellerOrders.length === 0) {
      return res.status(404).json({ message: 'No orders found for this seller' });
    }

    res.status(200).json({ orders: sellerOrders });
  } catch (error) {
    console.error('Error fetching seller orders:', error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
});

// Route to get all items from CustomerOrders by customerId
app.get('/customer-orders/:customerId', async (req, res) => {
  const { customerId } = req.params;

  if (!customerId) {
    return res.status(400).json({ message: 'Customer ID is required' });
  }

  try {
    const query = 'SELECT * FROM CustomerOrders WHERE customer_id = ?';
    const customerOrders = await executeQuery(query, [customerId]);

    if (customerOrders.length === 0) {
      return res.status(404).json({ message: 'No orders found for this customer' });
    }

    res.status(200).json({ orders: customerOrders });
  } catch (error) {
    console.error('Error fetching customer orders:', error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
});

// PUT method to update the status for both CustomerOrders and SellerOrders
app.put('/update-order-status/:orderId', async (req, res) => {
  const orderId = req.params.orderId;
  const { status } = req.body;

  // Input validation
  if (!status) {
    return res.status(400).json({ message: 'Missing required fields' });
  }

  try {
    await executeQuery('START TRANSACTION');

    // Update status in CustomerOrders
    const updateCustomerOrderQuery = `
      UPDATE CustomerOrders
      SET status = ?
      WHERE order_id = ?
    `;
    await executeQuery(updateCustomerOrderQuery, [status, orderId]);

    // Update status in SellerOrders
    const updateSellerOrderQuery = `
      UPDATE SellerOrders
      SET status = ?
      WHERE order_id = ?
    `;
    await executeQuery(updateSellerOrderQuery, [status, orderId]);

    // Commit transaction
    await executeQuery('COMMIT');

    res.status(200).json({ message: 'Order status updated successfully' });
  } catch (error) {
    await executeQuery('ROLLBACK');
    console.error('Error updating order status:', error);
    res.status(500).json({ message: 'Error updating order status', error: error.message });
  }
});










// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
