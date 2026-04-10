/**
 * Form validators
 */

export function validateEmail(email) {
  if (!email) return 'El email es requerido';
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!re.test(email)) return 'El email no es válido';
  return null;
}

export function validatePassword(password) {
  if (!password) return 'La contraseña es requerida';
  if (password.length < 8) return 'La contraseña debe tener al menos 8 caracteres';
  if (!/[A-Z]/.test(password)) return 'La contraseña debe tener al menos una mayúscula';
  if (!/[0-9]/.test(password)) return 'La contraseña debe tener al menos un número';
  return null;
}

export function validateUsername(username) {
  if (!username) return 'El nombre de usuario es requerido';
  if (username.length < 3) return 'El nombre de usuario debe tener al menos 3 caracteres';
  if (username.length > 20) return 'El nombre de usuario no puede tener más de 20 caracteres';
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    return 'El nombre de usuario solo puede contener letras, números y guiones bajos';
  }
  return null;
}

export function validateRequired(value, fieldName = 'Este campo') {
  if (!value || (typeof value === 'string' && !value.trim())) {
    return `${fieldName} es requerido`;
  }
  return null;
}
