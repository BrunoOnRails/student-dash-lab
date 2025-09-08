export interface PasswordValidation {
  isValid: boolean;
  errors: string[];
}

export const validatePassword = (password: string): PasswordValidation => {
  const errors: string[] = [];
  
  if (password.length < 8) {
    errors.push('A senha deve ter pelo menos 8 caracteres');
  }
  
  if (!/\d/.test(password)) {
    errors.push('A senha deve conter pelo menos 1 número');
  }
  
  if (!/[a-zA-Z]/.test(password)) {
    errors.push('A senha deve conter pelo menos 1 letra');
  }
  
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('A senha deve conter pelo menos 1 símbolo especial');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};