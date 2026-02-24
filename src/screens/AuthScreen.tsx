import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '../components/navigation/Header';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { useAuth } from '../contexts/AuthContext';

export function AuthScreen() {
  const { signIn, signUp, error, clearError } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [passwordMismatch, setPasswordMismatch] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    clearError();
    setPasswordMismatch(false);
    
    if (mode === 'signup' && password !== confirmPassword) {
      setPasswordMismatch(true);
      return;
    }
    
    setIsLoading(true);
    try {
      if (mode === 'signin') {
        await signIn(email, password);
        navigate('/home', { replace: true });
      } else {
        await signUp(email, password, displayName);
        setSuccess('Check your email to confirm your account!');
      }
    } catch (err) {
      console.error('Auth error:', err);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex flex-col flex-1 overflow-y-auto pb-24">
      <Header title={mode === 'signin' ? 'Sign In' : 'Sign Up'} showBack />
      
      <div className="flex flex-col items-center justify-center px-6 pt-8 flex-1">
        <div className="text-5xl mb-4">🏃</div>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
        {mode === 'signin' ? 'Welcome back' : 'Join Run With Friends'}
      </h1>
      <p className="text-gray-500 dark:text-gray-400 mb-8 text-sm">
        {mode === 'signin' ? 'Sign in to sync your runs across devices' : 'Create an account for cloud sync & social features'}
      </p>

      {success ? (
        <div className="w-full max-w-sm bg-green-50 dark:bg-green-900/20 rounded-2xl p-4 text-green-700 dark:text-green-400 text-sm text-center mb-4">
          {success}
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="w-full max-w-sm flex flex-col gap-4">
          {mode === 'signup' && (
            <Input
              label="Display Name"
              type="text"
              placeholder="Your name"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              required
            />
          )}
          <Input
            label="Email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
          />
          <Input
            label="Password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={e => {
              setPassword(e.target.value);
              setPasswordMismatch(false);
            }}
            required
            minLength={6}
          />
          {mode === 'signup' && (
            <Input
              label="Confirm Password"
              type="password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={e => {
                setConfirmPassword(e.target.value);
                setPasswordMismatch(false);
              }}
              required
              minLength={6}
            />
          )}

          {passwordMismatch && (
            <p className="text-sm text-red-500 text-center">Passwords do not match</p>
          )}
          {error && (
            <p className="text-sm text-red-500 text-center">{error}</p>
          )}

          <Button type="submit" size="lg" isLoading={isLoading} className="w-full mt-2">
            {mode === 'signin' ? 'Sign In' : 'Create Account'}
          </Button>
        </form>
      )}

      <button
        className="mt-6 text-sm text-primary-600 dark:text-primary-400"
        onClick={() => {
          setMode(m => m === 'signin' ? 'signup' : 'signin');
          clearError();
          setSuccess('');
          setPasswordMismatch(false);
          setConfirmPassword('');
        }}
      >
        {mode === 'signin' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
      </button>
      </div>
    </div>
  );
}

