import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { AlertCircle } from 'lucide-react';
import { AuthLayout } from '../components/AuthLayout.jsx';
import { Input } from '../components/ui/Input.jsx';
import { Button } from '../components/ui/Button.jsx';
import { useAuth } from '../stores/auth.js';
import { registerSchema, passwordStrength } from '../lib/validation.js';
import { zodResolver } from '../lib/zodResolver.js';
import { cn } from '../lib/cn.js';
import { ApiError } from '../lib/api.js';

const STRENGTH_COLORS = ['bg-crimson', 'bg-persimmon', 'bg-matcha'];

function PasswordStrength({ value }) {
  const score = passwordStrength(value);
  if (!value) return null;
  return (
    <div className="mt-1.5 flex items-center gap-2">
      <div className="flex flex-1 gap-1" aria-hidden="true">
        {[0, 1, 2].map((index) => (
          <span
            key={index}
            className={cn(
              'h-1 flex-1 rounded-full',
              index < score ? STRENGTH_COLORS[score - 1] : 'bg-subtle'
            )}
          />
        ))}
      </div>
      <span className="sr-only">Password strength: {score} of 3</span>
    </div>
  );
}

/** /register — prompt.md §7.11. */
export default function Register() {
  const navigate = useNavigate();
  const registerAccount = useAuth((s) => s.register);
  const [formError, setFormError] = useState(null);
  const {
    register,
    handleSubmit,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(registerSchema),
    defaultValues: { email: '', password: '', displayName: '' },
  });
  const passwordValue = watch('password');

  async function onSubmit(values) {
    setFormError(null);
    try {
      await registerAccount(values);
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
      <h1 className="font-display text-3xl font-medium text-ink-primary">Create an account</h1>
      <p className="mt-1 text-sm text-ink-secondary">Start your garden.</p>

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
          <Input
            label="Password"
            type="password"
            autoComplete="new-password"
            hint="At least 8 characters, including a number."
            error={errors.password?.message}
            {...register('password')}
          />
          <PasswordStrength value={passwordValue} />
        </div>

        <Input
          label="Display name"
          type="text"
          autoComplete="nickname"
          placeholder="Rina"
          error={errors.displayName?.message}
          {...register('displayName')}
        />

        {formError ? (
          <p role="alert" className="flex items-center gap-1.5 text-sm text-crimson">
            <AlertCircle size={16} aria-hidden="true" />
            {formError}
          </p>
        ) : null}

        <Button type="submit" size="block" disabled={isSubmitting}>
          Create account
        </Button>
      </form>

      <p className="mt-6 text-sm text-ink-secondary">
        Already have an account?{' '}
        <Link
          to="/login"
          className="font-medium text-vermillion transition-colors duration-fast ease-out hover:text-vermillion-hover"
        >
          Sign in.
        </Link>
      </p>
    </AuthLayout>
  );
}
