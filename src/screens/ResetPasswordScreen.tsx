import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '../components/navigation/Header';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { useAuth } from '../contexts/AuthContext';

export function ResetPasswordScreen() {
  const { updatePassword, clearPasswordRecovery } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [mismatch, setMismatch] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (password !== confirmPassword) {
      setMismatch(true);
      return;
    }
    setIsLoading(true);
    try {
      await updatePassword(password);
      clearPasswordRecovery();
      navigate('/home', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update password');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex flex-col flex-1 overflow-y-auto pb-24">
      <Header title="New password" />
      <div className="flex flex-col px-6 pt-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">Choose a new password</h1>
        <p className="text-gray-500 dark:text-gray-400 mb-8 text-sm">
          This replaces the password on your account.
        </p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 max-w-sm">
          <Input
            label="New password"
            type="password"
            value={password}
            onChange={e => { setPassword(e.target.value); setMismatch(false); }}
            required
            minLength={6}
            autoComplete="new-password"
          />
          <Input
            label="Confirm password"
            type="password"
            value={confirmPassword}
            onChange={e => { setConfirmPassword(e.target.value); setMismatch(false); }}
            required
            minLength={6}
            autoComplete="new-password"
          />
          {mismatch && <p className="text-sm text-red-500 text-center">Passwords do not match</p>}
          {error && <p className="text-sm text-red-500 text-center">{error}</p>}
          <Button type="submit" size="lg" isLoading={isLoading} className="w-full mt-2">
            Save password
          </Button>
        </form>
      </div>
    </div>
  );
}
