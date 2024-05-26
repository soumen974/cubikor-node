const express = require('express');
const bodyParser = require('body-parser');
const mariadb = require('mariadb');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');

const app = express();
app.use(bodyParser.json());

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

const SECRET_KEY = 'your_secret_key'; // Use a strong secret key in production

// User registration
app.post('/register', [
  body('username').isLength({ min: 3 }),
  body('email').isEmail(),
  body('password').isLength({ min: 5 })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const user = req.body;
  const hashedPassword = await bcrypt.hash(user.password, 10);
  const query = `INSERT INTO users (username, name, auth, email, password, date_of_birth, country, security_question, security_answer, street, city, state, zipcode, shipping_country)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
  try {
    const result = await executeQuery(query, [user.username, user.name, user.auth, user.email, hashedPassword, user.date_of_birth, user.country, user.security_question, user.security_answer, user.shipping_address.street, user.shipping_address.city, user.shipping_address.state, user.shipping_address.zipcode, user.shipping_address.country]);
    res.status(201).send({ id: result.insertId });
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
        res.status(200).json({ token });
      } else {
        res.status(401).send('Invalid credentials');
      }
    } else {
      res.status(401).send('Invalid credentials');
    }
  } catch (err) {
    res.status(500).send(err.toString());
  }
});

// Middleware to authenticate token
function authenticateToken(req, res, next) {
  const token = req.headers['authorization'];
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

  

// Protect user routes with the middleware
app.get('/users/:id', authenticateToken, async (req, res) => {
  const query = `SELECT * FROM users WHERE id = ?`;
  try {
    const rows = await executeQuery(query, [req.params.id]);
    res.status(200).json(rows[0]);
  } catch (err) {
    res.status(500).send(err.toString());
  }
});

app.put('/users/:id', authenticateToken, async (req, res) => {
  const user = req.body;
  const query = `UPDATE users SET username = ?, name = ?, auth = ?, email = ?, password = ?, date_of_birth = ?, country = ?, security_question = ?, security_answer = ?, street = ?, city = ?, state = ?, zipcode = ?, shipping_country = ? WHERE id = ?`;
  try {
    await executeQuery(query, [user.username, user.name, user.auth, user.email, user.password, user.date_of_birth, user.country, user.security_question, user.security_answer, user.shipping_address.street, user.shipping_address.city, user.shipping_address.state, user.shipping_address.zipcode, user.shipping_address.country, req.params.id]);
    res.status(200).send('User updated successfully');
  } catch (err) {
    res.status(500).send(err.toString());
  }
});

app.delete('/users/:id', authenticateToken, async (req, res) => {
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
    res.status(201).send({ id: result.insertId });
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
