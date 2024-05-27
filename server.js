const express = require('express');
const bodyParser = require('body-parser');
const mariadb = require('mariadb');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const cors = require('cors');
const app = express();

app.use(bodyParser.json());
app.use(cors());

// Enable CORS for a specific origin
app.use(cors({
  origin: 'http://localhost:3000',
  optionsSuccessStatus: 200 // some legacy browsers (IE11, various SmartTVs) choke on 204
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

// User registration
app.post('/register', [
  body('email').isEmail(),
  body('password').isLength({ min: 5 }),
  // Validate the mobile number (optional)
  body('mobile_number').optional().isMobilePhone('any')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const user = req.body;
  const hashedPassword = await bcrypt.hash(user.password, 10);
  
  // Check if the email already exists
  const checkQuery = 'SELECT COUNT(*) AS count FROM users WHERE email = ?';
  try {
    const checkResult = await executeQuery(checkQuery, [user.email]);
    if (checkResult[0].count > 0) {
      return res.status(400).json({ error: 'User already exists' });
    }
  } catch (err) {
    return res.status(500).send(err.toString());
  }

  const query = `INSERT INTO users (username, name, auth, email, password, mobile_number, date_of_birth, country, security_question, security_answer, street, city, state, zipcode, shipping_country)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
  try {
    const result = await executeQuery(query, [
      user.username || '',
      user.name || '',
      user.auth || false,
      user.email,
      hashedPassword,
      user.mobile_number || null, // Include mobile_number field
      user.date_of_birth || null,
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
    res.status(500).send(err.toString());
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
        const token = jwt.sign({ id: user.id, email: user.email }, SECRET_KEY, { expiresIn: '1h' });
        res.status(200).json({ token, userId: user.id }); // Include userId in the response
      } else {
        res.status(401).json({ error: 'Invalid credentials' });
      }
    } else {
      res.status(401).json({ error: 'Invalid credentials' });
    }
  } catch (err) {
    res.status(500).send(err.toString());
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
    res.status(500).send(err.toString());
  }
});
// Get a user by ID
app.get('/users/:id', authenticateToken, async (req, res) => {
  const query = `SELECT * FROM users WHERE id = ?`;
  try {
    const rows = await executeQuery(query, [req.params.id]);
    if (rows.length === 0) {
      return res.status(404).send('Could not find user with id ' + req.params.id);
    }
    res.status(200).json(rows[0]);
  } catch (err) {
    res.status(500).send('Error retrieving user: ' + err.toString());
  }
});


// Get a user by ID
app.get('/users/:id', authenticateToken, async (req, res) => {
  const query = `SELECT * FROM users WHERE id = ?`;
  try {
    const rows = await executeQuery(query, [req.params.id]);
    res.status(200).json(rows[0]);
  } catch (err) {
    res.status(500).send('could not find user with id ' + req.params.id);
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
    updates.push('mobile_number = ?'); // Include mobile_number field
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
    res.status(500).send(err.toString());
  }
});


// Delete a user by ID
app.delete('/users/:id',  async (req, res) => {
  const query = `DELETE FROM users WHERE id = ?`;
  try {
    await executeQuery(query, [req.params.id]);
    res.status(200).send('User deleted successfully');
  } catch (err) {
    res.status(500).send(err.toString());
  }
});

// Shopping bag operations
app.post('/users/:id/shopping_bag', authenticateToken, async (req, res) => {
  const item = req.body;
  const query = `INSERT INTO shopping_bag (user_id, category_id, product_id, quantity) VALUES (?, ?, ?, ?)`;
  try {
    const result = await executeQuery(query, [req.params.id, item.category_id, item.product_id, item.quantity]);
    res.status(201).send({ id: result.insertId.toString() });
  } catch (err) {
    res.status(500).send(err.toString());
  }
});

app.get('/users/:id/shopping_bag', authenticateToken, async (req, res) => {
  const query = `SELECT * FROM shopping_bag WHERE user_id = ?`;
  try {
    const rows = await executeQuery(query, [req.params.id]);
    res.status(200).json(rows);
  } catch (err) {
    res.status(500).send(err.toString());
  }
});

app.delete('/users/:id/shopping_bag/:item_id', authenticateToken, async (req, res) => {
  const query = `DELETE FROM shopping_bag WHERE id = ? AND user_id = ?`;
  try {
    await executeQuery(query, [req.params.item_id, req.params.id]);
    res.status(200).send('Item removed from shopping bag');
  } catch (err) {
    res.status(500).send(err.toString());
  }
});

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port http://localhost:${PORT}`);
});
