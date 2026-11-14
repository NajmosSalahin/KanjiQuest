import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { AlertCircle, CheckCircle2, Link2Off } from 'lucide-react';
import { AuthLayout } from '../components/AuthLayout.jsx';
import { Input } from '../components/ui/Input.jsx';
import { Button } from '../components/ui/Button.jsx';
import { resetPasswordSchema } from '../lib/validation.js';
import { zodResolver } from '../lib/zodResolver.js';
import { api, ApiError } from '../lib/api.js';

/** /reset-password?token=… — D21. Single-use, 30-minute link. */
export default function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [done, setDone] = useState(false);
  const [formError, setFormError] = useState(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  async function onSubmit(values) {
    setFormError(null);
    try {
      await api('/auth/reset-password', {
        method: 'POST',
        body: { token, password: values.password },
      });
      setDone(true);
    } catch (err) {
      if (err instanceof ApiError && err.fields) {
        for (const [field, messages] of Object.entries(err.fields)) {
          if (field === 'password') {
            setError('password', { type: 'server', message: messages[0] });
          }
        }
      } else if (err instanceof ApiError) {
        setFormError(err.message);
      } else {
        setFormError('Something went wrong on our side.');
      }
    }
  }

  if (!token) {
    return (
      <AuthLayout>
        <Link2Off size={40} aria-hidden="true" className="text-crimson" />
        <h1 className="mt-4 font-display text-3xl font-medium text-ink-primary">
          This link is incomplete
        </h1>
        <p className="mt-2 text-sm text-ink-secondary">
          The reset token is missing. Request a fresh link and use the newest email.
        </p>
        <Button size="block" className="mt-8" onClick={() => navigate('/forgot-password')}>
          Request a new link
        </Button>
        <p className="mt-6 text-center text-sm text-ink-secondary">
          <Link
            to="/login"
            className="font-medium text-vermillion transition-colors duration-fast ease-out hover:text-vermillion-hover"
          >
            Back to sign in
          </Link>
        </p>
      </AuthLayout>
    );
  }

  if (done) {
    return (
      <AuthLayout>
        <CheckCircle2 size={40} aria-hidden="true" className="text-matcha" />
        <h1 className="mt-4 font-display text-3xl font-medium text-ink-primary">
          Password updated
        </h1>
        <p className="mt-2 text-sm text-ink-secondary">
          Every other session was signed out. Use your new password to continue.
        </p>
        <Button size="block" className="mt-8" onClick={() => navigate('/login')}>
          Sign in
        </Button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <h1 className="font-display text-3xl font-medium text-ink-primary">Choose a new password</h1>
      <p className="mt-1 text-sm text-ink-secondary">
        This link works once and expires 30 minutes after it was sent.
      </p>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-8 flex flex-col gap-5">
        <Input
          label="New password"
          type="password"
          autoComplete="new-password"
          hint="At least 8 characters, including a number."
          error={errors.password?.message}
          {...register('password')}
        />
        <Input
          label="Confirm new password"
          type="password"
          autoComplete="new-password"
          error={errors.confirmPassword?.message}
          {...register('confirmPassword')}
        />

        {formError ? (
          <p role="alert" className="flex items-center gap-1.5 text-sm text-crimson">
            <AlertCircle size={16} aria-hidden="true" />
            {formError}
          </p>
        ) : null}

        <Button type="submit" size="block" disabled={isSubmitting}>
          {isSubmitting ? 'Updating…' : 'Update password'}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-ink-secondary">
        Need a fresh link?{' '}
        <Link
          to="/forgot-password"
          className="font-medium text-vermillion transition-colors duration-fast ease-out hover:text-vermillion-hover"
        >
          Request another
        </Link>
      </p>
    </AuthLayout>
  );
}
