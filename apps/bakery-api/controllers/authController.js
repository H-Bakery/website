const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const { User } = require('../models')
const logger = require('../utils/logger')

const SALT_ROUNDS = 10

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

    if (!username) {
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

    const token = jwt.sign(
      { id: user.id, iat: Math.floor(Date.now() / 1000), r: Math.random() },
      process.env.JWT_SECRET
    )

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
