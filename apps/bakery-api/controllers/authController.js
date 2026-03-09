const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const { User } = require('../models')
const logger = require('../utils/logger')

const SALT_ROUNDS = 10
const JWT_EXPIRY = '24h'

// Validate JWT_SECRET is configured
if (!process.env.JWT_SECRET) {
  logger.error('FATAL: JWT_SECRET environment variable is not set')
  throw new Error('JWT_SECRET environment variable must be set')
}

const register = async (req, res) => {
  try {
    const { username, password, email, firstName, lastName } = req.body

    if (!username || !password) {
      return res.status(400).json({ error: 'All fields are required' })
    }

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS)

    const user = await User.create({
      username,
      password: hashedPassword,
      email: email || null,
      firstName: firstName || null,
      lastName: lastName || null,
    })

    return res.json({
      message: 'User created',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
    })
  } catch (error) {
    logger.error('Registration error:', error)
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({ error: 'Username or email already exists' })
    }
    return res.status(500).json({ error: 'Server error' })
  }
}

const login = async (req, res) => {
  try {
    const { username, password } = req.body

    if (!username || !password) {
      return res.status(400).json({ error: 'Invalid credentials' })
    }

    const user = await User.findOne({ where: { username } })
    if (!user) {
      return res.status(400).json({ error: 'Invalid credentials' })
    }

    const isPasswordValid = await bcrypt.compare(password, user.password)
    if (!isPasswordValid) {
      return res.status(400).json({ error: 'Invalid credentials' })
    }

    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, {
      expiresIn: JWT_EXPIRY,
    })

    return res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
    })
  } catch (error) {
    logger.error('Login error:', error)
    return res.status(500).json({ error: 'Server error' })
  }
}

module.exports = { register, login }
