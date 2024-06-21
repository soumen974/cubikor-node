const express = require('express');
const bodyParser = require('body-parser');
const { MongoClient, ObjectId } = require('mongodb');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const cors = require('cors');
const app = express();

const multer = require('multer');
const fs = require('fs');

app.use(bodyParser.json());
app.use(cors({
  origin: 'http://localhost:3000',
  optionsSuccessStatus: 200
}));

// Replace <password> with your actual MongoDB Atlas password
const uri = 'mongodb+srv://mesoumenbhunia:UcknqJFlBYpCECmD@cubukor.dtuzfbb.mongodb.net/';
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

let db;

client.connect()
  .then(() => {
    db = client.db('userDB');
    console.log('Connected to MongoDB Atlas');
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });

const SECRET_KEY = 'soumen9749807435';

// Helper function to execute MongoDB queries
async function executeQuery(collection, query, operation, options = {}) {
  try {
    const coll = db.collection(collection);
    let result;

    switch (operation) {
      case 'find':
        result = await coll.find(query, options).toArray();
        break;
      case 'findOne':
        result = await coll.findOne(query, options);
        break;
      case 'insertOne':
        result = await coll.insertOne(query);
        break;
      case 'insertMany':
        result = await coll.insertMany(query);
        break;
      case 'updateOne':
        result = await coll.updateOne(query, options.update, { upsert: options.upsert || false });
        break;
      case 'updateMany':
        result = await coll.updateMany(query, options.update, { upsert: options.upsert || false });
        break;
      case 'deleteOne':
        result = await coll.deleteOne(query);
        break;
      case 'deleteMany':
        result = await coll.deleteMany(query);
        break;
      default:
        throw new Error('Unsupported operation');
    }

    return result;
  } catch (err) {
    throw err;
  }
}

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

  try {
    const existingUser = await executeQuery('users', { email: user.email }, 'findOne');
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    const newUser = {
      username: user.username || '',
      name: user.name || '',
      auth: user.auth || false,
      email: user.email,
      password: hashedPassword,
      mobile_number: user.mobile_number || null,
      date_of_birth: user.date_of_birth || null,
      user_type: user.user_type || '',
      country: user.country || '',
      security_question: user.security_question || '',
      security_answer: user.security_answer || '',
      street: user.shipping_address?.street || '',
      city: user.shipping_address?.city || '',
      state: user.shipping_address?.state || '',
      zipcode: user.shipping_address?.zipcode || '',
      shipping_country: user.shipping_address?.country || ''
    };

    const result = await executeQuery('users', newUser, 'insertOne');
    res.status(201).json({ message: 'User created successfully', id: result.insertedId.toString() });
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

  try {
    const user = await executeQuery('users', { email: email }, 'findOne');
    if (user) {
      const match = await bcrypt.compare(password, user.password);
      if (match) {
        const token = jwt.sign({ id: user._id, email: user.email }, SECRET_KEY, { expiresIn: '1d' });
        res.status(200).json({ token, userId: user._id, user_type: user.user_type });
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
  try {
    const users = await executeQuery('users', {}, 'find');
    res.status(200).json(users);
  } catch (err) {
    res.status(500).send(`Error retrieving users: ${err.toString()}`);
  }
});

// Get a user by ID
app.get('/users/:id', authenticateToken, async (req, res) => {
    try {
      const user = await collection.findOne({ _id: ObjectId(req.params.id) });
  
      if (!user) {
        return res.status(404).send(`Could not find user with id ${req.params.id}`);
      }
  
      res.status(200).json(user);
    } catch (err) {
      res.status(500).send(`Error retrieving user: ${err.toString()}`);
    }
  });

  
// Additional endpoints for other collections like `shops`, `shopping_cart`, `prd`, `catg`, `SellerOrders`, and `CustomerOrders` can be added similarly

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
