const { AuthService } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');

const authService = new AuthService();

// Login validation rules
const loginValidation = [
  body('username')
    .trim()
    .notEmpty()
    .withMessage('Username is required')
    .isLength({ min: 3, max: 100 })
    .withMessage('Username must be between 3 and 100 characters'),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters')
];

// Login handler
async function login(req, res) {
  try {
    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { username, password } = req.body;

    // Attempt authentication
    const result = await authService.login(username, password);

    res.json({
      success: true,
      message: 'Login successful',
      ...result
    });

  } catch (error) {
    console.error('Login error:', error);

    if (error.message === 'Invalid credentials') {
      return res.status(401).json({
        error: 'Invalid username or password'
      });
    }

    res.status(500).json({
      error: 'An error occurred during login'
    });
  }
}

// Verify token handler
async function verifyToken(req, res) {
  try {
    // Token already verified by authenticateJWT middleware
    res.json({
      success: true,
      user: req.user
    });
  } catch (error) {
    res.status(500).json({
      error: 'Token verification failed'
    });
  }
}

// Get current user profile
async function getProfile(req, res) {
  try {
    res.json({
      success: true,
      user: {
        id: req.user.id,
        username: req.user.username,
        role: req.user.role
      }
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to retrieve profile'
    });
  }
}

// Logout handler (mainly for logging purposes)
async function logout(req, res) {
  try {
    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    res.status(500).json({
      error: 'Logout failed'
    });
  }
}

module.exports = {
  login,
  verifyToken,
  getProfile,
  logout,
  loginValidation
};
