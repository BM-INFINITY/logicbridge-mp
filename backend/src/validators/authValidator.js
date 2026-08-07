/**
 * Validation rules for user authentication
 */
function validateRegister(body) {
  const { name, email, password } = body || {};
  if (!name || !name.trim()) return { valid: false, error: 'Name is required' };
  if (!email || !email.trim()) return { valid: false, error: 'Email is required' };
  if (!password || password.length < 6) return { valid: false, error: 'Password must be at least 6 characters' };
  return { valid: true };
}

function validateLogin(body) {
  const { email, password } = body || {};
  if (!email || !email.trim()) return { valid: false, error: 'Email is required' };
  if (!password) return { valid: false, error: 'Password is required' };
  return { valid: true };
}

module.exports = {
  validateRegister,
  validateLogin,
};
