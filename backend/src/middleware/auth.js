const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const ldap = require('ldapjs');
const { query } = require('../config/database');
require('dotenv').config();

class AuthService {
  async login(username, password) {
    // Try AD authentication first if configured
    if (process.env.AD_LDAP_URL && process.env.AD_LDAP_URL !== 'ldap://dc.digiskills.local:389') {
      try {
        const adUser = await this.authenticateAD(username, password);
        if (adUser) {
          return this.generateToken(adUser);
        }
      } catch (error) {
        console.error('AD authentication error:', error.message);
      }
    }

    // Fallback to local database
    const localUser = await this.authenticateLocal(username, password);

    if (localUser) {
      // Update last login
      await query(
        'UPDATE users SET last_login = NOW() WHERE id = $1',
        [localUser.id]
      );
      return this.generateToken(localUser);
    }

    throw new Error('Invalid credentials');
  }

  async authenticateAD(username, password) {
    return new Promise((resolve, reject) => {
      const client = ldap.createClient({
        url: process.env.AD_LDAP_URL,
        timeout: 5000,
        connectTimeout: 5000,
      });

      const userDN = `${username}@${process.env.AD_DOMAIN}`;

      client.bind(userDN, password, (err) => {
        if (err) {
          client.unbind();
          resolve(null); // AD auth failed, will try local
          return;
        }

        // Search for user details
        client.search(
          process.env.AD_BASE_DN,
          {
            filter: `(sAMAccountName=${username})`,
            scope: 'sub',
            attributes: ['mail', 'displayName', 'memberOf']
          },
          (err, res) => {
            if (err) {
              client.unbind();
              reject(err);
              return;
            }

            let user = null;

            res.on('searchEntry', (entry) => {
              const groups = entry.object.memberOf || [];
              const isAdmin = Array.isArray(groups)
                ? groups.some(g => g.includes('Domain Admins') || g.includes('IT Admins'))
                : groups.includes('Domain Admins') || groups.includes('IT Admins');

              user = {
                username: username,
                email: entry.object.mail,
                name: entry.object.displayName,
                role: isAdmin ? 'admin' : 'operator',
                source: 'ad'
              };
            });

            res.on('error', (err) => {
              client.unbind();
              reject(err);
            });

            res.on('end', () => {
              client.unbind();
              resolve(user);
            });
          }
        );
      });
    });
  }

  async authenticateLocal(username, password) {
    const result = await query(
      'SELECT id, username, email, password_hash, role FROM users WHERE username = $1 AND active = true',
      [username]
    );

    if (result.rows.length === 0) return null;

    const user = result.rows[0];
    const isValid = await bcrypt.compare(password, user.password_hash);

    if (!isValid) return null;

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      source: 'local'
    };
  }

  generateToken(user) {
    const payload = {
      id: user.id,
      username: user.username,
      role: user.role
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: '8h'
    });

    return {
      token,
      user: payload,
      expiresIn: 28800 // 8 hours in seconds
    };
  }

  verifyToken(token) {
    try {
      return jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      throw new Error('Invalid or expired token');
    }
  }
}

// Middleware to authenticate JWT tokens
function authenticateJWT(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.split(' ')[1]; // Bearer <token>

  if (!token) {
    return res.status(401).json({ error: 'Invalid authorization header format' });
  }

  try {
    const authService = new AuthService();
    const user = authService.verifyToken(token);
    req.user = user;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
}

// Middleware to require specific roles
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
}

module.exports = {
  AuthService,
  authenticateJWT,
  requireRole
};
