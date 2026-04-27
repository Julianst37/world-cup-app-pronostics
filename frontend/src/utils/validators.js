/**
 * Form validators
 */

export const FIELD_MAX_LENGTHS = {
  displayName: 50,
  username: 20,
  email: 100,
  password: 64,
  tournamentName: 50,
  tournamentDescription: 250,
};

export function validateTournamentName(name) {
  if (!name || !name.trim()) return 'El nombre del torneo es requerido';
  if (name.trim().length < 3) return 'El nombre debe tener al menos 3 caracteres';
  if (name.trim().length > FIELD_MAX_LENGTHS.tournamentName) {
    return `El nombre no puede exceder ${FIELD_MAX_LENGTHS.tournamentName} caracteres`;
  }
  return null;
}

export function validateTournamentDescription(description) {
  if (!description) return null;
  if (description.trim().length > FIELD_MAX_LENGTHS.tournamentDescription) {
    return `La descripción no puede exceder ${FIELD_MAX_LENGTHS.tournamentDescription} caracteres`;
  }
  return null;
}

export function validateDisplayName(displayName) {
  if (!displayName || !displayName.trim()) return 'El nombre completo es requerido';
  if (displayName.trim().length > FIELD_MAX_LENGTHS.displayName) {
    return `El nombre completo no puede tener más de ${FIELD_MAX_LENGTHS.displayName} caracteres`;
  }
  if (!/^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s]+$/.test(displayName.trim())) {
    return 'El nombre completo solo puede contener letras y espacios';
  }
  return null;
}

export function validateEmail(email) {
  if (!email) return 'El email es requerido';
  if (email.length > FIELD_MAX_LENGTHS.email) {
    return `El email no puede tener más de ${FIELD_MAX_LENGTHS.email} caracteres`;
  }
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!re.test(email)) return 'El email no es válido';
  return null;
}

export function validatePassword(password) {
  if (!password) return 'La contraseña es requerida';
  if (password.length > FIELD_MAX_LENGTHS.password) {
    return `La contraseña no puede tener más de ${FIELD_MAX_LENGTHS.password} caracteres`;
  }
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
