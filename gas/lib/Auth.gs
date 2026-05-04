/**
 * Auth.gs - Authentication System
 * Login with email/password + session tokens
 */

const SESSION_EXPIRY_HOURS = 24;

/**
 * Hash a password using SHA-256
 */
function hashPassword(password) {
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, password);
  return digest.map(function(byte) {
    return ('0' + (byte & 0xFF).toString(16)).slice(-2);
  }).join('');
}

/**
 * Verify a password against a hash
 */
function verifyPassword(password, hash) {
  return hashPassword(password) === hash;
}

/**
 * Generate a session token
 */
function generateToken() {
  return Utilities.getUuid();
}

/**
 * API: Login with email and password
 */
function login(email, password) {
  if (!email || !password) {
    return { success: false, error: 'Email and password required' };
  }

  if (!CONFIG.isConfigured()) {
    return { success: false, error: 'System not configured' };
  }

  try {
    const ss = CONFIG.getSpreadsheet();
    const sheet = ss.getSheetByName('USERS');
    if (!sheet) return { success: false, error: 'Users sheet not found' };

    const data = sheet.getDataRange().getValues();
    const emailLower = email.toLowerCase().trim();

    for (let i = 1; i < data.length; i++) {
      const rowEmail = (data[i][1] || '').toString().toLowerCase().trim();
      const rowHash = (data[i][2] || '').toString();
      const rowActive = data[i][7];

      if (rowEmail === emailLower) {
        // Check if active
        if (rowActive !== true && rowActive !== 'TRUE') {
          return { success: false, error: 'Account is deactivated' };
        }

        // Verify password
        if (!verifyPassword(password, rowHash)) {
          return { success: false, error: 'Invalid credentials' };
        }

        // Generate session token
        const token = generateToken();
        const expiry = new Date(Date.now() + SESSION_EXPIRY_HOURS * 60 * 60 * 1000);
        
        // Save token to script properties
        PROPS.setProperty('SESSION_' + token, JSON.stringify({
          userId: data[i][0],
          email: rowEmail,
          role: data[i][3],
          displayName: data[i][4],
          skills: data[i][5],
          expiry: expiry.toISOString(),
        }));

        // Update last login
        sheet.getRange(i + 1, 9).setValue(new Date());

        // Log login action
        logAuditAction('', rowEmail, 'LOGIN', 'User logged in: ' + rowEmail);

        return {
          success: true,
          token: token,
          user: {
            userId: data[i][0],
            email: data[i][1],
            role: data[i][3],
            displayName: data[i][4],
            skills: parseSkills(data[i][5]),
          },
        };
      }
    }

    return { success: false, error: 'Invalid credentials' };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/**
 * API: Logout - invalidate token
 */
function logout(token) {
  if (token) {
    const session = getSession(token);
    if (session.authenticated) {
      logAuditAction('', session.email, 'LOGOUT', 'User logged out: ' + session.email);
    }
    PROPS.deleteProperty('SESSION_' + token);
  }
  return { success: true };
}

/**
 * API: Get session from token
 */
function getSession(token) {
  if (!token) return { authenticated: false, error: 'No token' };

  try {
    const sessionData = PROPS.getProperty('SESSION_' + token);
    if (!sessionData) return { authenticated: false, error: 'Session not found' };

    const session = JSON.parse(sessionData);
    const expiry = new Date(session.expiry);

    if (new Date() > expiry) {
      PROPS.deleteProperty('SESSION_' + token);
      return { authenticated: false, error: 'Session expired' };
    }

    return {
      authenticated: true,
      userId: session.userId,
      email: session.email,
      role: session.role,
      displayName: session.displayName,
      skills: parseSkills(session.skills),
    };
  } catch (e) {
    return { authenticated: false, error: e.message };
  }
}

/**
 * Parse skills from CSV or array
 */
function parseSkills(skills) {
  if (!skills) return [];
  if (Array.isArray(skills)) return skills;
  return skills.toString().split(',').map(function(s) { return s.trim(); }).filter(function(s) { return s; });
}

/**
 * API: Check if current user has role
 */
function hasRole(token, requiredRoles) {
  const session = getSession(token);
  if (!session.authenticated) return false;

  if (!Array.isArray(requiredRoles)) {
    requiredRoles = [requiredRoles];
  }

  const userRole = String(session.role || '').toLowerCase();
  return requiredRoles.some(function(r) {
    return String(r || '').toLowerCase() === userRole;
  });
}

/**
 * API: Change password
 */
function changePassword(token, oldPassword, newPassword) {
  const session = getSession(token);
  if (!session.authenticated) {
    return { success: false, error: 'Not authenticated' };
  }

  try {
    const ss = CONFIG.getSpreadsheet();
    const sheet = ss.getSheetByName('USERS');
    const data = sheet.getDataRange().getValues();

    for (let i = 1; i < data.length; i++) {
      if ((data[i][1] || '').toString().toLowerCase() === session.email.toLowerCase()) {
        const currentHash = (data[i][2] || '').toString();
        
        if (!verifyPassword(oldPassword, currentHash)) {
          return { success: false, error: 'Current password is incorrect' };
        }

        sheet.getRange(i + 1, 3).setValue(hashPassword(newPassword));
        return { success: true, message: 'Password changed successfully' };
      }
    }

    return { success: false, error: 'User not found' };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/**
 * API: Get all users (Admin only)
 */
function getAllUsers(token) {
  try {
    const session = getSession(token);
    if (!session.authenticated) {
      return { success: false, error: session.error || 'Not authenticated' };
    }
    if (!hasRole(token, ['Admin', 'SuperApprover'])) {
      return { success: false, error: 'Access denied - Admin or SuperApprover role required' };
    }

    const ss = CONFIG.getSpreadsheet();
    const sheet = ss.getSheetByName('USERS');
    if (!sheet) return { success: true, users: [] };

    const data = sheet.getDataRange().getValues();
    const users = [];

    for (let i = 1; i < data.length; i++) {
      if (data[i][0]) {
        users.push({
          userId: data[i][0],
          email: data[i][1],
          role: data[i][3],
          displayName: data[i][4],
          skills: parseSkills(data[i][5]),
          isActive: data[i][7] === true || data[i][7] === 'TRUE',
          createdAt: data[i][6] instanceof Date ? data[i][6].toISOString() : (data[i][6] || '').toString(),
          lastLogin: data[i][8] instanceof Date ? data[i][8].toISOString() : (data[i][8] || '').toString(),
        });
      }
    }

    return { success: true, users: users };
  } catch (e) {
    return { success: false, error: 'getAllUsers error: ' + e.message };
  }
}

/**
 * API: Update user (Admin only)
 */
function updateUser(token, userId, updates) {
  if (!hasRole(token, 'Admin')) {
    return { success: false, error: 'Access denied' };
  }

  try {
    const ss = CONFIG.getSpreadsheet();
    const sheet = ss.getSheetByName('USERS');
    const data = sheet.getDataRange().getValues();

    for (let i = 1; i < data.length; i++) {
      if ((data[i][0] || '').toString() === userId.toString()) {
        if (updates.email) sheet.getRange(i + 1, 2).setValue(updates.email);
        if (updates.role) sheet.getRange(i + 1, 4).setValue(updates.role);
        if (updates.displayName) sheet.getRange(i + 1, 5).setValue(updates.displayName);
        if (updates.skills !== undefined) sheet.getRange(i + 1, 6).setValue(updates.skills);
        if (updates.isActive !== undefined) sheet.getRange(i + 1, 8).setValue(updates.isActive);
        return { success: true, message: 'User updated' };
      }
    }

    return { success: false, error: 'User not found' };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/**
 * API: Create new user (Admin only)
 */
function createUser(token, email, password, role, displayName) {
  if (!hasRole(token, 'Admin')) {
    return { success: false, error: 'Access denied' };
  }

  try {
    const ss = CONFIG.getSpreadsheet();
    const sheet = ss.getSheetByName('USERS');
    const data = sheet.getDataRange().getValues();

    // Check if email already exists
    for (let i = 1; i < data.length; i++) {
      if ((data[i][1] || '').toString().toLowerCase() === email.toLowerCase()) {
        return { success: false, error: 'Email already exists' };
      }
    }

    // Add new user
    const userId = Utilities.getUuid();
    sheet.appendRow([
      userId,
      email,
      hashPassword(password),
      role || 'Operator',
      displayName || email,
      '', // skills
      new Date().toISOString(),
      true, // isActive
      '', // lastLogin
      '', // Notes
    ]);

    logAuditAction('', email, 'USER_CREATED', 'User created: ' + email);

    return { success: true, message: 'User created' };
  } catch (e) {
    return { success: false, error: e.message };
  }
}