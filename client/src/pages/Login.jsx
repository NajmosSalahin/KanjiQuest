import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { AlertCircle } from 'lucide-react';
import { AuthLayout } from '../components/AuthLayout.jsx';
import { Input } from '../components/ui/Input.jsx';
import { Button } from '../components/ui/Button.jsx';
import { useAuth } from '../stores/auth.js';
import { loginSchema } from '../lib/validation.js';
import { zodResolver } from '../lib/zodResolver.js';
import { ApiError } from '../lib/api.js';

/** /login — prompt.md §7.11. Google button removed per D2 (no button, no "or"). */
export default function Login() {
  const navigate = useNavigate();
  const login = useAuth((s) => s.login);
  const [formError, setFormError] = useState(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  async function onSubmit(values) {
    setFormError(null);
    try {
      await login(values.email, values.password);
      navigate('/', { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.fields) {
        for (const [field, messages] of Object.entries(err.fields)) {
          setError(field, { type: 'server', message: messages[0] });
        }
      } else if (err instanceof ApiError) {
        setFormError(err.message);
      } else {
        setFormError('Something went wrong on our side.');
      }
    }
  }

  return (
    <AuthLayout>
      <h1 className="font-display text-3xl font-medium text-ink-primary">Sign in</h1>
      <p className="mt-1 text-sm text-ink-secondary">Continue your garden.</p>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-8 flex flex-col gap-5">
        <Input
          label="Email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          error={errors.email?.message}
          {...register('email')}
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
              autoComplete="current-password"
              error={errors.password?.message}
              {...register('password')}
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
