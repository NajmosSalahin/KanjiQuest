import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import { AuthLayout } from '../components/AuthLayout.jsx';
import { Input } from '../components/ui/Input.jsx';
import { Button } from '../components/ui/Button.jsx';
import { useAuth } from '../stores/auth.js';
import { ApiError } from '../lib/api.js';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** /login — prompt.md §7.11. Google button removed per D2 (no button, no "or").
 *  D28: this route stays free of react-hook-form/Zod; two fields do not justify
 *  downloading the 13 kB-gzip form stack before first paint. Rules and copy
 *  mirror the shared login schema. */
export default function Login() {
  const navigate = useNavigate();
  const login = useAuth((s) => s.login);
  const [values, setValues] = useState({ email: '', password: '' });
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function updateField(field) {
    return (event) => {
      const { value } = event.target;
      setValues((current) => ({ ...current, [field]: value }));
      setFieldErrors((current) => (current[field] ? { ...current, [field]: undefined } : current));
    };
  }

  function validate() {
    const next = {};
    if (!EMAIL_PATTERN.test(values.email.trim())) {
      next.email = 'Enter a valid email address.';
    }
    if (!values.password) {
      next.password = 'Enter your password.';
    }
    return next;
  }

  async function onSubmit(event) {
    event.preventDefault();
    const next = validate();
    setFieldErrors(next);
    if (Object.keys(next).length > 0) return;

    setFormError(null);
    setIsSubmitting(true);
    try {
      await login(values.email.trim().toLowerCase(), values.password);
      navigate('/', { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.fields) {
        const serverErrors = {};
        for (const [field, messages] of Object.entries(err.fields)) {
          serverErrors[field] = messages[0];
        }
        setFieldErrors(serverErrors);
      } else if (err instanceof ApiError) {
        setFormError(err.message);
      } else {
        setFormError('Something went wrong on our side.');
      }
      setIsSubmitting(false);
    }
  }

  return (
    <AuthLayout>
      <h1 className="font-display text-3xl font-medium text-ink-primary">Sign in</h1>
      <p className="mt-1 text-sm text-ink-secondary">Continue your garden.</p>

      <form onSubmit={onSubmit} noValidate className="mt-8 flex flex-col gap-5">
        <Input
          label="Email"
          type="email"
          name="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={values.email}
          onChange={updateField('email')}
          error={fieldErrors.email}
        />

        <div>
          <div className="flex justify-end">
            <Link
              to="/forgot-password"
              className="text-xs font-medium text-vermillion transition-colors duration-fast ease-out hover:text-vermillion-hover"
            >
              Forgot password?
            </Link>
          </div>
          <div className="mt-1.5">
            <Input
              label="Password"
              type="password"
              name="password"
              autoComplete="current-password"
              value={values.password}
              onChange={updateField('password')}
              error={fieldErrors.password}
            />
          </div>
        </div>

        {formError ? (
          <p role="alert" className="flex items-center gap-1.5 text-sm text-crimson">
            <AlertCircle size={16} aria-hidden="true" />
            {formError}
          </p>
        ) : null}

        <Button type="submit" size="block" disabled={isSubmitting}>
          Sign in
        </Button>
      </form>

      <p className="mt-6 text-sm text-ink-secondary">
        New here?{' '}
        <Link
          to="/register"
          className="font-medium text-vermillion transition-colors duration-fast ease-out hover:text-vermillion-hover"
        >
          Create an account.
        </Link>
      </p>
    </AuthLayout>
  );
}
