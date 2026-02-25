import { useNavigate } from 'react-router-dom';
import { Header } from '../components/navigation/Header';
import { Card } from '../components/ui/Card';

export function LogEntryScreen() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col flex-1 overflow-y-auto pb-24">
      <Header title="Log a Run" showBack />

      <div className="px-4 pt-4 flex flex-col gap-4">
        <Card onClick={() => navigate('/log/manual')}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
              <span className="text-xl">✏️</span>
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-50">
                Log manual run
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Enter distance, time, and details for a run you already completed.
              </p>
            </div>
          </div>
        </Card>

        <Card onClick={() => navigate('/log/live')}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
              <span className="text-xl">📍</span>
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-50">
                Live run
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Track a run in real time using your phone&apos;s GPS and save it when you&apos;re done.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}


