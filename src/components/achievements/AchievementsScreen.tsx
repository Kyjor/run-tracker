import { useEffect, useState } from 'react';
import { Header } from '../navigation/Header';
import { Card, SectionHeader } from '../ui/Card';
import { AchievementBadge } from '../ui/AchievementBadge';
import { Celebration } from '../ui/Celebration';
import { Spinner } from '../ui/Spinner';
import { useDb } from '../../contexts/DatabaseContext';
import { getAchievements } from '../../services/achievementService';
import { ACHIEVEMENT_DEFINITIONS } from '../../types/achievements';
import type { Achievement } from '../../types/achievements';

export function AchievementsScreen() {
  const db = useDb();
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebratedAchievement, setCelebratedAchievement] = useState<Achievement | null>(null);

  useEffect(() => {
    if (!db) return;
    loadAchievements();
  }, [db]);

  async function loadAchievements() {
    if (!db) return;
    setLoading(true);
    try {
      const all = await getAchievements(db);
      setAchievements(all);

      // Check for newly unlocked achievements
      const newlyUnlocked = all.filter(a => a.unlocked_at && new Date(a.unlocked_at).getTime() > Date.now() - 5000);
      if (newlyUnlocked.length > 0) {
        setCelebratedAchievement(newlyUnlocked[0]);
        setShowCelebration(true);
      }
    } catch (err) {
      console.error('Failed to load achievements:', err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col flex-1">
        <Header title="Achievements" />
        <div className="flex items-center justify-center flex-1">
          <Spinner size="lg" className="text-primary-500" />
        </div>
      </div>
    );
  }

  const unlocked = achievements.filter(a => a.unlocked_at);
  const locked = Object.values(ACHIEVEMENT_DEFINITIONS)
    .filter(def => !achievements.find(a => a.achievement_key === def.key))
    .map(def => ({
      id: '',
      achievement_key: def.key,
      unlocked_at: null,
      progress: 0,
      max_progress: def.maxProgress,
      created_at: '',
      updated_at: '',
    }));

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Header title="Achievements" />
      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-24">
        <div className="flex flex-col gap-6">
          {/* Stats */}
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Unlocked</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {unlocked.length} / {Object.keys(ACHIEVEMENT_DEFINITIONS).length}
                </p>
              </div>
              <div className="text-4xl">🏆</div>
            </div>
          </Card>

          {/* Unlocked Achievements */}
          {unlocked.length > 0 && (
            <div>
              <SectionHeader title="Unlocked" />
              <div className="flex flex-col gap-2">
                {unlocked.map(ach => {
                  const def = ACHIEVEMENT_DEFINITIONS[ach.achievement_key];
                  return (
                    <AchievementBadge
                      key={ach.id}
                      title={def.title}
                      description={def.description}
                      emoji={def.emoji}
                      unlocked={true}
                      progress={ach.progress}
                      maxProgress={ach.max_progress}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* Locked Achievements */}
          {locked.length > 0 && (
            <div>
              <SectionHeader title="Locked" />
              <div className="flex flex-col gap-2">
                {locked.map(ach => {
                  const def = ACHIEVEMENT_DEFINITIONS[ach.achievement_key];
                  return (
                    <AchievementBadge
                      key={ach.achievement_key}
                      title={def.title}
                      description={def.description}
                      emoji={def.emoji}
                      unlocked={false}
                      progress={ach.progress}
                      maxProgress={ach.max_progress}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {celebratedAchievement && (
        <Celebration
          show={showCelebration}
          message={`Achievement Unlocked: ${ACHIEVEMENT_DEFINITIONS[celebratedAchievement.achievement_key].title}!`}
          emoji={ACHIEVEMENT_DEFINITIONS[celebratedAchievement.achievement_key].emoji}
          onComplete={() => {
            setShowCelebration(false);
            setCelebratedAchievement(null);
          }}
        />
      )}
    </div>
  );
}

