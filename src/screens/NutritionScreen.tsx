import { useEffect, useState } from 'react';
import { Header } from '../components/navigation/Header';
import { Card, SectionHeader } from '../components/ui/Card';
import { Spinner } from '../components/ui/Spinner';
import { Button } from '../components/ui/Button';
import { ProgressRing } from '../components/ui/ProgressRing';
import { Input } from '../components/ui/Input';
import { FoodSearchModal } from '../components/nutrition/FoodSearchModal';
import { useDb } from '../contexts/DatabaseContext';
import { requestHealthKitPermission, fetchTodayWeight, fetchTodayBodyFat } from '../services/healthkitService';
import {
  getDailyNutrition,
  logMeal,
  deleteMeal,
  saveWeightEntry,
  calculateTDEE,
  getMacroRecommendation,
  getActiveNutritionGoal,
  createNutritionGoal,
  getLatestWeight,
  getWeightEntries,
} from '../services/nutritionService';
import type { MealWithFood, NutritionGoal, TDEEEstimate, MacroRecommendation, MealType, WeightEntry } from '../types';
import { WeightTrendChart } from '../components/nutrition/WeightTrendChart';
import { format } from 'date-fns';

export function NutritionScreen() {
  const db = useDb();
  const [weight, setWeight] = useState<number | null>(null);
  const [bodyFat, setBodyFat] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasPermission, setHasPermission] = useState(false);
  const [dailyNutrition, setDailyNutrition] = useState<{ calories: number; protein: number; carbs: number; fats: number; fiber: number; meals: MealWithFood[] } | null>(null);
  const [tdee, setTdee] = useState<TDEEEstimate | null>(null);
  const [macroRec, setMacroRec] = useState<MacroRecommendation | null>(null);
  const [nutritionGoal, setNutritionGoal] = useState<NutritionGoal | null>(null);
  const [foodModalOpen, setFoodModalOpen] = useState(false);
  const [selectedMealType, setSelectedMealType] = useState<MealType>('breakfast');
  const [weightEntries, setWeightEntries] = useState<WeightEntry[]>([]);
  const [showWeightInput, setShowWeightInput] = useState(false);
  const [manualWeight, setManualWeight] = useState('');

  const today = format(new Date(), 'yyyy-MM-dd');

  async function loadNutritionData() {
    if (!db) return;
    setLoading(true);
    try {
      const permission = await requestHealthKitPermission();
      setHasPermission(permission);
      
      // Check database first for today's weight
      const todayDate = new Date();
      todayDate.setHours(0, 0, 0, 0);
      const todayDateStr = todayDate.toISOString();
      const dbWeight = await getLatestWeight(db);
      if (dbWeight && dbWeight.date === today) {
        setWeight(dbWeight.weight_kg);
        setBodyFat(dbWeight.body_fat_percent);
      }

      if (permission) {
        const [weightData, bodyFatData] = await Promise.all([
          fetchTodayWeight(todayDateStr).catch(() => null),
          fetchTodayBodyFat(todayDateStr).catch(() => null),
        ]);
        
        if (weightData?.weight_kg) {
          setWeight(weightData.weight_kg);
          // Save to local database (will update if exists)
          await saveWeightEntry(db, {
            date: todayDateStr,
            weight_kg: weightData.weight_kg,
            body_fat_percent: bodyFatData?.body_fat_percent ?? undefined,
            source: 'healthkit',
          });
        }
        
        if (bodyFatData?.body_fat_percent) {
          setBodyFat(bodyFatData.body_fat_percent);
        }
      }

      // Load daily nutrition
      const nutrition = await getDailyNutrition(db, today);
      setDailyNutrition(nutrition);

      // Load TDEE and recommendations
      const [tdeeData, recData, goal, weights] = await Promise.all([
        calculateTDEE(db).catch(() => null),
        getMacroRecommendation(db, 'maintain').catch(() => null),
        getActiveNutritionGoal(db),
        getWeightEntries(db, undefined, undefined, 100),
      ]);
      
      setTdee(tdeeData);
      setMacroRec(recData);
      setNutritionGoal(goal);
      setWeightEntries(weights);
    } catch (err) {
      console.error('Failed to load nutrition data:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadNutritionData();
  }, [db]);

  async function handleAddFood(foodId: string, amountGrams: number) {
    if (!db) return;
    try {
      await logMeal(db, {
        date: today,
        meal_type: selectedMealType,
        food_id: foodId,
        amount_grams: amountGrams,
      });
      await loadNutritionData();
    } catch (err) {
      console.error('Failed to log meal:', err);
    }
  }

  async function handleDeleteMeal(mealId: string) {
    if (!db) return;
    try {
      await deleteMeal(db, mealId);
      await loadNutritionData();
    } catch (err) {
      console.error('Failed to delete meal:', err);
    }
  }

  async function handleSetGoal() {
    if (!db || !macroRec) return;
    try {
      const goal = await createNutritionGoal(db, {
        target_calories: macroRec.calories,
        target_protein_g: macroRec.protein,
        target_carbs_g: macroRec.carbs,
        target_fats_g: macroRec.fats,
        goal_type: 'maintain',
        start_date: today,
      });
      setNutritionGoal(goal);
    } catch (err) {
      console.error('Failed to set goal:', err);
    }
  }

  function openFoodModal(mealType: MealType) {
    setSelectedMealType(mealType);
    setFoodModalOpen(true);
  }

  if (!db || loading) {
    return (
      <div className="flex flex-col flex-1">
        <Header title="Nutrition" />
        <div className="flex items-center justify-center flex-1">
          <Spinner size="lg" className="text-primary-500" />
        </div>
      </div>
    );
  }

  const goal = nutritionGoal;
  const caloriesProgress = goal && goal.target_calories
    ? Math.min((dailyNutrition?.calories ?? 0) / goal.target_calories * 100, 100)
    : 0;

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Header title="Nutrition" />
      
      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-24">
        <div className="flex flex-col gap-4">
          {/* Today's Metrics */}
          <div>
            <SectionHeader title="Today's Metrics" />
            {!hasPermission ? (
              <Card className="text-center py-6">
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                  Enable HealthKit access to view weight and body composition data.
                </p>
                <Button size="sm" onClick={loadNutritionData}>
                  Request Access
                </Button>
              </Card>
            ) : (
              <Card>
                <div className="flex flex-col gap-4">
                  {weight !== null ? (
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Weight</p>
                        <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                          {(weight * 2.20462).toFixed(1)} lbs
                        </p>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                          {weight.toFixed(2)} kg
                        </p>
                      </div>
                      <div className="text-3xl">⚖️</div>
                    </div>
                  ) : showWeightInput ? (
                    <div className="flex flex-col gap-2">
                      <Input
                        label="Weight (kg)"
                        type="number"
                        value={manualWeight}
                        onChange={e => setManualWeight(e.target.value)}
                        placeholder="70.5"
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={async () => {
                            if (!db || !manualWeight) return;
                            const weightKg = parseFloat(manualWeight);
                            if (isNaN(weightKg)) return;
                            await saveWeightEntry(db, {
                              date: today,
                              weight_kg: weightKg,
                              source: 'manual',
                            });
                            setWeight(weightKg);
                            setShowWeightInput(false);
                            setManualWeight('');
                            await loadNutritionData();
                          }}
                        >
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            setShowWeightInput(false);
                            setManualWeight('');
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between py-2">
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Weight</p>
                        <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">No data today</p>
                      </div>
                      <Button size="sm" onClick={() => setShowWeightInput(true)}>
                        Log Weight
                      </Button>
                    </div>
                  )}

                  {bodyFat !== null && (
                    <div className="pt-4 border-t border-gray-100 dark:border-gray-700">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Body Fat</p>
                          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                            {bodyFat.toFixed(1)}%
                          </p>
                        </div>
                        <div className="text-3xl">📊</div>
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            )}
          </div>

          {/* Weight Trend */}
          {weightEntries.length > 0 && (
            <div>
              <SectionHeader title="Weight Trend" />
              <WeightTrendChart entries={weightEntries} days={30} />
            </div>
          )}

          {/* TDEE Estimate */}
          {tdee && (
            <div>
              <SectionHeader title="Energy Expenditure" />
              <Card>
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">TDEE</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                        {Math.round(tdee.tdee)} kcal
                      </p>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                        {tdee.confidence} confidence · {tdee.data_points} data points
                      </p>
                    </div>
                    <div className="text-3xl">🔥</div>
                  </div>
                  <div className="pt-3 border-t border-gray-100 dark:border-gray-700">
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <p className="text-gray-500 dark:text-gray-400">BMR</p>
                        <p className="font-medium text-gray-900 dark:text-gray-100 mt-0.5">
                          {Math.round(tdee.bmr)} kcal
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500 dark:text-gray-400">Activity Factor</p>
                        <p className="font-medium text-gray-900 dark:text-gray-100 mt-0.5">
                          {tdee.activity_factor.toFixed(2)}x
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          )}

          {/* Macro Recommendations */}
          {macroRec && !goal && (
            <div>
              <SectionHeader title="Recommended Targets" />
              <Card>
                <div className="flex flex-col gap-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Calories</p>
                      <p className="text-lg font-bold text-gray-900 dark:text-gray-100 mt-1">
                        {macroRec.calories}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Protein</p>
                      <p className="text-lg font-bold text-gray-900 dark:text-gray-100 mt-1">
                        {macroRec.protein}g
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Carbs</p>
                      <p className="text-lg font-bold text-gray-900 dark:text-gray-100 mt-1">
                        {macroRec.carbs}g
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Fats</p>
                      <p className="text-lg font-bold text-gray-900 dark:text-gray-100 mt-1">
                        {macroRec.fats}g
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    {macroRec.rationale}
                  </p>
                  <Button size="sm" onClick={handleSetGoal} className="mt-2">
                    Set as Goal
                  </Button>
                </div>
              </Card>
            </div>
          )}

          {/* Daily Progress */}
          <div>
            <SectionHeader title="Today's Progress" />
            <Card>
              {goal ? (
                <div className="flex flex-col gap-4">
                  <div className="flex items-center gap-4">
                    <ProgressRing value={caloriesProgress} size={64} strokeWidth={6} color="#3b82f6">
                      <span className="text-xs font-bold text-gray-700 dark:text-gray-200">
                        {Math.round(caloriesProgress)}%
                      </span>
                    </ProgressRing>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Calories</p>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                        {Math.round(dailyNutrition?.calories ?? 0)} / {goal.target_calories} kcal
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Protein</p>
                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mt-1">
                        {Math.round(dailyNutrition?.protein ?? 0)}g
                      </p>
                      {goal.target_protein_g && (
                        <p className="text-[10px] text-gray-400 dark:text-gray-500">
                          / {goal.target_protein_g}g
                        </p>
                      )}
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Carbs</p>
                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mt-1">
                        {Math.round(dailyNutrition?.carbs ?? 0)}g
                      </p>
                      {goal.target_carbs_g && (
                        <p className="text-[10px] text-gray-400 dark:text-gray-500">
                          / {goal.target_carbs_g}g
                        </p>
                      )}
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Fats</p>
                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mt-1">
                        {Math.round(dailyNutrition?.fats ?? 0)}g
                      </p>
                      {goal.target_fats_g && (
                        <p className="text-[10px] text-gray-400 dark:text-gray-500">
                          / {goal.target_fats_g}g
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 text-center">
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Calories</p>
                    <p className="text-lg font-semibold text-gray-900 dark:text-gray-100 mt-1">
                      {Math.round(dailyNutrition?.calories ?? 0)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Protein</p>
                    <p className="text-lg font-semibold text-gray-900 dark:text-gray-100 mt-1">
                      {Math.round(dailyNutrition?.protein ?? 0)}g
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Carbs</p>
                    <p className="text-lg font-semibold text-gray-900 dark:text-gray-100 mt-1">
                      {Math.round(dailyNutrition?.carbs ?? 0)}g
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Fats</p>
                    <p className="text-lg font-semibold text-gray-900 dark:text-gray-100 mt-1">
                      {Math.round(dailyNutrition?.fats ?? 0)}g
                    </p>
                  </div>
                </div>
              )}
            </Card>
          </div>

          {/* Meal Logging */}
          <div>
            <SectionHeader title="Meals" />
            <div className="flex gap-2 mb-3">
              {(['breakfast', 'lunch', 'dinner', 'snack'] as MealType[]).map(mealType => (
                <Button
                  key={mealType}
                  size="sm"
                  variant="secondary"
                  onClick={() => openFoodModal(mealType)}
                  className="flex-1 capitalize"
                >
                  + {mealType}
                </Button>
              ))}
            </div>
            {dailyNutrition && dailyNutrition.meals.length > 0 ? (
              <div className="flex flex-col gap-2">
                {(['breakfast', 'lunch', 'dinner', 'snack'] as MealType[]).map(mealType => {
                  const meals = dailyNutrition.meals.filter(m => m.meal_type === mealType);
                  if (meals.length === 0) return null;
                  return (
                    <Card key={mealType}>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
                          {mealType}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {Math.round(meals.reduce((sum, m) => sum + m.calories, 0))} kcal
                        </p>
                      </div>
                      <div className="flex flex-col gap-2">
                        {meals.map(meal => (
                          <div
                            key={meal.id}
                            className="flex items-center justify-between text-xs py-1 border-b border-gray-100 dark:border-gray-700 last:border-0"
                          >
                            <div className="flex-1">
                              <p className="font-medium text-gray-900 dark:text-gray-100">
                                {meal.food.name}
                              </p>
                              <p className="text-gray-500 dark:text-gray-400">
                                {meal.amount_grams}g · {Math.round(meal.calories)} kcal
                              </p>
                            </div>
                            <button
                              onClick={() => handleDeleteMeal(meal.id)}
                              className="text-red-500 hover:text-red-700 text-xs px-2"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <Card className="text-center py-6">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  No meals logged today. Add your first meal!
                </p>
              </Card>
            )}
          </div>
        </div>
      </div>

      {db && (
        <FoodSearchModal
          isOpen={foodModalOpen}
          onClose={() => setFoodModalOpen(false)}
          onSelect={(food, amountGrams) => handleAddFood(food.id, amountGrams)}
          db={db}
        />
      )}
    </div>
  );
}
