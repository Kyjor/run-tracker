import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { RaceType, PlanDay, DistanceUnit } from '../types';
import { RACE_TYPE_LABELS, RACE_TYPE_DISTANCES, DIFFICULTY_LABELS } from '../types';
import { getAllPlans, getPlanDays, setActivePlan } from '../services/planService';
import { Button } from '../components/ui/Button';
import { PlanPreview } from '../components/plan/PlanPreview';
import { useSettings } from '../contexts/SettingsContext';
import { useDb } from '../contexts/DatabaseContext';
import { useToast } from '../contexts/ToastContext';
import { format } from 'date-fns';

type Step = 'welcome' | 'units' | 'browse' | 'preview' | 'start_date' | 'done';

const RACE_OPTIONS: { type: RaceType; emoji: string; description: string }[] = [
  { type: '5k', emoji: '🏅', description: 'A great first goal. You can do this.' },
  { type: '10k', emoji: '🥈', description: 'Double the challenge, double the reward.' },
  { type: 'half_marathon', emoji: '🥇', description: '13.1 miles of glory.' },
  { type: 'full_marathon', emoji: '🏆', description: 'The ultimate distance.' },
];

function groupByWeek(days: PlanDay[]): PlanDay[][] {
  const weeks: PlanDay[][] = [];
  for (const day of days) {
    const wi = day.week_number - 1;
    if (!weeks[wi]) weeks[wi] = [];
    weeks[wi][day.day_of_week] = day;
  }
  return weeks;
}

export function OnboardingScreen() {
  const navigate = useNavigate();
  const db = useDb();
  const { settings, updateSettings } = useSettings();
  const { showToast } = useToast();

  const [step, setStep] = useState<Step>('welcome');
  const [units, setUnits] = useState<DistanceUnit>(settings.units);
  const [raceType, setRaceType] = useState<RaceType | null>(null);
  const [plans, setPlans] = useState<Awaited<ReturnType<typeof getAllPlans>>>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [previewDays, setPreviewDays] = useState<PlanDay[]>([]);
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [isLoading, setIsLoading] = useState(false);

  async function goToBrowse(rt: RaceType) {
    setRaceType(rt);
    const all = await getAllPlans(db);
    setPlans(all.filter(p => p.race_type === rt));
    setStep('browse');
  }

  async function selectPlan(planId: string) {
    setSelectedPlanId(planId);
    const days = await getPlanDays(db, planId);
    setPreviewDays(days);
    setStep('preview');
  }

  async function finish() {
    if (!selectedPlanId) return;
    setIsLoading(true);
    try {
      await updateSettings({ units, onboarding_complete: true });
      await setActivePlan(db, selectedPlanId, startDate);
      showToast('Plan activated! Let\'s run. 🏃', 'success');
      navigate('/home', { replace: true });
    } catch (e) {
      showToast('Something went wrong. Please try again.', 'error');
    } finally {
      setIsLoading(false);
    }
  }

  async function skipPlan() {
    await updateSettings({ units, onboarding_complete: true });
    navigate('/home', { replace: true });
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 flex flex-col">
      {/* Progress dots */}
      {step !== 'welcome' && step !== 'done' && (
        <div className="flex justify-center gap-1.5 pt-safe-top pt-4">
          {(['units', 'browse', 'preview', 'start_date'] as Step[]).map(s => (
            <div
              key={s}
              className={`w-2 h-2 rounded-full transition-colors ${s === step ? 'bg-primary-500' : 'bg-gray-200 dark:bg-gray-700'}`}
            />
          ))}
        </div>
      )}

      <div className="flex-1 flex flex-col px-6 pb-10">
        {/* WELCOME */}
        {step === 'welcome' && (
          <div className="flex flex-col items-center justify-center flex-1 text-center">
            <div className="text-7xl mb-6">🏃‍♂️</div>
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-3">
              Run With Friends
            </h1>
            <p className="text-gray-500 dark:text-gray-400 text-lg mb-12 max-w-xs">
              Train smarter, run farther, and bring your friends along.
            </p>
            <Button size="lg" className="w-full" onClick={() => setStep('units')}>
              Get Started
            </Button>
            <button
              className="mt-4 text-sm text-gray-400 dark:text-gray-500"
              onClick={skipPlan}
            >
              Skip setup
            </button>
          </div>
        )}

        {/* UNITS */}
        {step === 'units' && (
          <div className="flex flex-col flex-1 pt-12">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Distance Units</h2>
            <p className="text-gray-500 dark:text-gray-400 mb-8">
              You can change this anytime in Settings.
            </p>
            <div className="flex flex-col gap-3 mb-auto">
              {(['mi', 'km'] as DistanceUnit[]).map(u => (
                <button
                  key={u}
                  onClick={() => setUnits(u)}
                  className={[
                    'flex items-center gap-4 p-4 rounded-2xl border-2 transition-colors',
                    units === u
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30'
                      : 'border-gray-200 dark:border-gray-700',
                  ].join(' ')}
                >
                  <span className="text-2xl">{u === 'mi' ? '🇺🇸' : '🌍'}</span>
                  <div className="text-left">
                    <p className="font-semibold text-gray-900 dark:text-white">{u === 'mi' ? 'Miles' : 'Kilometers'}</p>
                    <p className="text-sm text-gray-500">{u === 'mi' ? 'Used in the US' : 'Used internationally'}</p>
                  </div>
                  {units === u && <span className="ml-auto text-primary-500">✓</span>}
                </button>
              ))}
            </div>
            <Button size="lg" className="w-full mt-8" onClick={() => setStep('browse')}>
              Pick a Goal
            </Button>
          </div>
        )}

        {/* BROWSE RACE TYPES */}
        {step === 'browse' && !raceType && (
          <div className="flex flex-col flex-1 pt-12">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Choose Your Goal</h2>
            <p className="text-gray-500 dark:text-gray-400 mb-8">What race are you training for?</p>
            <div className="flex flex-col gap-3">
              {RACE_OPTIONS.map(({ type, emoji, description }) => (
                <button
                  key={type}
                  onClick={() => goToBrowse(type)}
                  className="flex items-center gap-4 p-4 rounded-2xl border-2 border-gray-200 dark:border-gray-700 active:bg-gray-50 dark:active:bg-gray-800 transition-colors text-left"
                >
                  <span className="text-3xl">{emoji}</span>
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white">
                      {RACE_TYPE_LABELS[type]} <span className="text-gray-400 font-normal text-sm">· {RACE_TYPE_DISTANCES[type]}</span>
                    </p>
                    <p className="text-sm text-gray-500">{description}</p>
                  </div>
                </button>
              ))}
            </div>
            <button className="mt-6 text-sm text-gray-400 text-center" onClick={skipPlan}>
              I'll choose a plan later
            </button>
          </div>
        )}

        {/* PLAN LIST */}
        {step === 'browse' && raceType && (
          <div className="flex flex-col flex-1 pt-12">
            <button
              className="flex items-center gap-1 text-primary-600 dark:text-primary-400 mb-6 text-sm"
              onClick={() => setRaceType(null)}
            >
              ← Back
            </button>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
              {RACE_TYPE_LABELS[raceType]} Plans
            </h2>
            <p className="text-gray-500 dark:text-gray-400 mb-6">Pick a plan that matches your current fitness.</p>
            <div className="flex flex-col gap-3">
              {plans.map(plan => (
                <button
                  key={plan.id}
                  onClick={() => selectPlan(plan.id)}
                  className="flex items-center gap-4 p-4 rounded-2xl border-2 border-gray-200 dark:border-gray-700 active:bg-gray-50 dark:active:bg-gray-800 transition-colors text-left"
                >
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900 dark:text-white">{plan.name}</p>
                    <p className="text-xs text-gray-500">{DIFFICULTY_LABELS[plan.difficulty]} · {plan.duration_weeks} weeks</p>
                    <p className="text-xs text-gray-400 mt-0.5">{plan.description}</p>
                  </div>
                  <span className="text-gray-300">›</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* PREVIEW */}
        {step === 'preview' && (
          <div className="flex flex-col flex-1 pt-10">
            <button
              className="flex items-center gap-1 text-primary-600 dark:text-primary-400 mb-4 text-sm"
              onClick={() => setStep('browse')}
            >
              ← Back
            </button>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">Plan Preview</h2>
            <p className="text-gray-500 dark:text-gray-400 mb-4 text-sm">
              Here's what your training will look like.
            </p>
            <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-4 mb-6">
              <PlanPreview weeks={groupByWeek(previewDays)} maxWeeks={4} />
            </div>
            <Button size="lg" className="w-full" onClick={() => setStep('start_date')}>
              Choose Start Date
            </Button>
          </div>
        )}

        {/* START DATE */}
        {step === 'start_date' && (
          <div className="flex flex-col flex-1 pt-12">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">When do you start?</h2>
            <p className="text-gray-500 dark:text-gray-400 mb-8">
              Today is great. Or pick a Monday to start fresh.
            </p>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="w-full rounded-2xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-4 py-3 text-lg mb-auto focus:outline-none focus:border-primary-500"
            />
            <Button size="lg" className="w-full mt-8" isLoading={isLoading} onClick={finish}>
              Start Training 🚀
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

