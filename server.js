const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({
  connectionString: connectionString,
  ssl: connectionString ? { rejectUnauthorized: false } : false
});

async function initDB() {
  const query = `
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      real_balance NUMERIC DEFAULT 0.00,
      demo_balance NUMERIC DEFAULT 10000.00,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS trades (
      id SERIAL PRIMARY KEY,
      user_email VARCHAR(255) REFERENCES users(email),
      account_type VARCHAR(10),
      pair VARCHAR(50),
      direction VARCHAR(10),
      amount NUMERIC,
      entry_price NUMERIC,
      exit_price NUMERIC,
      result VARCHAR(10),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;
  try {
    await pool.query(query);
    console.log('✅ Database Connected & Tables Ready');
  } catch (err) {
    console.error('❌ Database error:', err);
  }
}
initDB();

app.post('/api/register', async (req, res) => {
  const { email, password } = req.body;
  try {
    const userExists = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (userExists.rows.length > 0) return res.status(400).json({ error: 'Account already exists' });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    await pool.query(
      'INSERT INTO users (email, password, real_balance, demo_balance) VALUES ($1, $2, 0.00, 10000.00)',
      [email, hashedPassword]
    );
    res.json({ message: 'Account created successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) return res.status(401).json({ error: 'Invalid credentials' });

    const user = result.rows[0];
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ error: 'Invalid credentials' });

    const trades = await pool.query('SELECT * FROM trades WHERE user_email = $1 ORDER BY created_at DESC LIMIT 20', [email]);
    
    res.json({
      email: user.email,
      realBalance: parseFloat(user.real_balance),
      demoBalance: parseFloat(user.demo_balance),
      history: trades.rows
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/trade', async (req, res) => {
  const { email, accountType, amount, pair, direction, entryPrice, exitPrice, result } = req.body;
  try {
    const userRes = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (userRes.rows.length === 0) return res.status(404).json({ error: 'User not found' });

    const user = userRes.rows[0];
    const balanceColumn = accountType === 'real' ? 'real_balance' : 'demo_balance';
    let currentBalance = parseFloat(user[balanceColumn]);

    let payout = 0;
    if (result === 'WIN') payout = amount * 1.85; 
    else if (result === 'DRAW') payout = amount; 
    
    const newBalance = currentBalance - amount + payout;

    await pool.query(`UPDATE users SET ${balanceColumn} = $1 WHERE email = $2`, [newBalance, email]);
    await pool.query(
      'INSERT INTO trades (user_email, account_type, pair, direction, amount, entry_price, exit_price, result) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
      [email, accountType, pair, direction, amount, entryPrice, exitPrice, result]
    );

    res.json({ message: 'Trade recorded', newBalance: newBalance });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 SignalForge AI running on port ${PORT}`);
});
