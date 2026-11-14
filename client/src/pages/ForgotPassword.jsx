import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { AlertCircle, MailCheck } from 'lucide-react';
import { AuthLayout } from '../components/AuthLayout.jsx';
import { Input } from '../components/ui/Input.jsx';
import { Button } from '../components/ui/Button.jsx';
import { forgotPasswordSchema } from '../lib/validation.js';
import { zodResolver } from '../lib/zodResolver.js';
import { api, ApiError } from '../lib/api.js';

/** /forgot-password — D21. The response is always generic (no enumeration). */
export default function ForgotPassword() {
  const navigate = useNavigate();
  const [sent, setSent] = useState(false);
  const [formError, setFormError] = useState(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  async function onSubmit(values) {
    setFormError(null);
    try {
      await api('/auth/forgot-password', { method: 'POST', body: values });
      setSent(true);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Something went wrong on our side.');
    }
  }

  if (sent) {
    return (
      <AuthLayout>
        <MailCheck size={40} aria-hidden="true" className="text-matcha" />
        <h1 className="mt-4 font-display text-3xl font-medium text-ink-primary">
          Check your inbox
        </h1>
        <p className="mt-2 text-sm text-ink-secondary">
          If an account exists for that email, a reset link is on its way. It expires in 30 minutes
          and can be used once.
        </p>
        <p className="mt-2 text-sm text-ink-muted">
          Nothing after a minute? Check spam, or try again with a different address.
        </p>
        <Button size="block" className="mt-8" onClick={() => navigate('/login')}>
          Back to sign in
        </Button>
        <button
          type="button"
          onClick={() => setSent(false)}
          className="mt-4 w-full text-center text-xs font-medium text-vermillion transition-colors duration-fast ease-out hover:text-vermillion-hover"
        >
          Use a different email
        </button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <h1 className="font-display text-3xl font-medium text-ink-primary">Forgot your password?</h1>
      <p className="mt-1 text-sm text-ink-secondary">
        Enter the email you signed up with and we&apos;ll send a reset link.
      </p>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-8 flex flex-col gap-5">
        <Input
          label="Email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          error={errors.email?.message}
          {...register('email')}
        />

        {formError ? (
          <p role="alert" className="flex items-center gap-1.5 text-sm text-crimson">
            <AlertCircle size={16} aria-hidden="true" />
            {formError}
          </p>
        ) : null}

        <Button type="submit" size="block" disabled={isSubmitting}>
          {isSubmitting ? 'Sending…' : 'Send reset link'}
        </Button>
      </form>

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
