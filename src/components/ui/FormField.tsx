import { ReactNode } from 'react';
import './FormField.css';

interface FormFieldProps {
  // ✅ Aceita string ou JSX (para ações como "Fixar" ao lado do label)
  label?: ReactNode;
  required?: boolean;
  error?: string;
  children: ReactNode;
  fullWidth?: boolean;
}

function FormField({ label, required, error, children, fullWidth }: FormFieldProps) {
  return (
    <div className={`form-field ${fullWidth ? 'form-field-full' : ''}`}>
      <label className="field-label">
        {label}
        {required && <span className="required-asterisk">*</span>}
      </label>
      {children}
      {error && <span className="form-error">{error}</span>}
    </div>
  );
}

export default FormField;
