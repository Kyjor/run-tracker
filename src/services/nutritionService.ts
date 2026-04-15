import type Database from '@tauri-apps/plugin-sql';
import type { Food, Meal, MealWithFood, WeightEntry, NutritionGoal, DailyNutrition, TDEEEstimate, MacroRecommendation, NutritionGoalType } from '../types';
import { generateId } from '../utils/generateId';
import { format, parseISO, subDays, differenceInDays } from 'date-fns';

// ---------------------------------------------------------------------------
// Food Database
// ---------------------------------------------------------------------------

export async function createFood(
  db: Database,
  input: {
    name: string;
    brand?: string;
    calories_per_100g: number;
    protein_per_100g?: number;
    carbs_per_100g?: number;
    fats_per_100g?: number;
    fiber_per_100g?: number;
  },
): Promise<Food> {
  const id = generateId();
  const now = new Date().toISOString();
  
  const food: Food = {
    id,
    name: input.name,
    brand: input.brand ?? null,
    calories_per_100g: input.calories_per_100g,
    protein_per_100g: input.protein_per_100g ?? 0,
    carbs_per_100g: input.carbs_per_100g ?? 0,
    fats_per_100g: input.fats_per_100g ?? 0,
    fiber_per_100g: input.fiber_per_100g ?? 0,
    is_custom: 1,
    created_at: now,
    updated_at: now,
    sync_status: 'local',
  };

  await db.execute(
    `INSERT INTO foods (id, name, brand, calories_per_100g, protein_per_100g, carbs_per_100g, fats_per_100g, fiber_per_100g, is_custom, created_at, updated_at, sync_status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
    [food.id, food.name, food.brand, food.calories_per_100g, food.protein_per_100g, food.carbs_per_100g, food.fats_per_100g, food.fiber_per_100g, food.is_custom, food.created_at, food.updated_at, food.sync_status],
  );

  return food;
}

export async function searchFoods(db: Database, query: string, limit = 20): Promise<Food[]> {
  const searchTerm = `%${query.toLowerCase()}%`;
  return db.select<Food[]>(
    `SELECT * FROM foods 
     WHERE LOWER(name) LIKE $1 OR (brand IS NOT NULL AND LOWER(brand) LIKE $1)
     ORDER BY is_custom ASC, name ASC
     LIMIT $2`,
    [searchTerm, limit],
  );
}

export async function getFoodById(db: Database, id: string): Promise<Food | null> {
  const rows = await db.select<Food[]>('SELECT * FROM foods WHERE id = $1', [id]);
  return rows[0] ?? null;
}

export async function getAllFoods(db: Database): Promise<Food[]> {
  return db.select<Food[]>('SELECT * FROM foods ORDER BY name ASC');
}

// ---------------------------------------------------------------------------
// Barcode Lookup
// ---------------------------------------------------------------------------

/**
 * Look up food information from Open Food Facts API using a barcode
 * Open Food Facts is free, open-source, and doesn't require an API key
 * Documentation: https://world.openfoodfacts.org/data
 */
export async function lookupFoodByBarcode(barcode: string): Promise<{
  name: string;
  brand?: string;
  calories_per_100g: number;
  protein_per_100g: number;
  carbs_per_100g: number;
  fats_per_100g: number;
  fiber_per_100g: number;
} | null> {
  try {
    // Primary: Open Food Facts (free, no API key required)
    const response = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`, {
      headers: {
        'User-Agent': 'RunWithFriends/1.0 (Nutrition App)',
      },
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.status !== 1 || !data.product) {
      return null;
    }

    const product = data.product;
    
    // Extract nutrition data (per 100g)
    const nutriments = product.nutriments || {};
    const calories = nutriments['energy-kcal_100g'] || nutriments['energy-kcal'] || 0;
    const protein = nutriments['proteins_100g'] || nutriments['proteins'] || 0;
    const carbs = nutriments['carbohydrates_100g'] || nutriments['carbohydrates'] || 0;
    const fats = nutriments['fat_100g'] || nutriments['fat'] || 0;
    const fiber = nutriments['fiber_100g'] || nutriments['fiber'] || 0;

    // If calories are in kJ, convert to kcal (1 kcal = 4.184 kJ)
    let caloriesKcal = calories;
    if (nutriments['energy-kj_100g'] && !calories) {
      caloriesKcal = (nutriments['energy-kj_100g'] || nutriments['energy-kj'] || 0) / 4.184;
    }

    // Validate we have at least some nutrition data
    if (caloriesKcal === 0 && protein === 0 && carbs === 0 && fats === 0) {
      return null; // Product exists but has no nutrition data
    }

    return {
      name: product.product_name || product.product_name_en || product.product_name_fr || 'Unknown Product',
      brand: product.brands || product.brand || undefined,
      calories_per_100g: Math.round(caloriesKcal),
      protein_per_100g: Math.round((protein || 0) * 100) / 100,
      carbs_per_100g: Math.round((carbs || 0) * 100) / 100,
      fats_per_100g: Math.round((fats || 0) * 100) / 100,
      fiber_per_100g: Math.round((fiber || 0) * 100) / 100,
    };
  } catch (error) {
    console.error('Failed to lookup food by barcode:', error);
    return null;
  }
}

/**
 * Free Barcode Lookup APIs (for reference):
 * 
 * 1. Open Food Facts (currently used)
 *    - URL: https://world.openfoodfacts.org/api/v0/product/{barcode}.json
 *    - Free: Yes, completely free
 *    - API Key: Not required
 *    - Rate Limits: None (but be respectful)
 *    - Coverage: Global, user-contributed database
 *    - Best for: Food products with nutrition data
 * 
 * 2. UPCitemdb (alternative)
 *    - URL: https://api.upcitemdb.com/prod/trial/lookup?upc={barcode}
 *    - Free: Yes, with rate limits
 *    - API Key: Not required for basic usage
 *    - Rate Limits: ~100 requests/day (trial), unlimited with API key
 *    - Coverage: General products (may not have nutrition data)
 *    - Best for: Product names and basic info
 * 
 * 3. Barcodable (alternative)
 *    - URL: https://api.barcodable.com/api/v1/upc/{barcode}
 *    - Free: Limited free tier
 *    - API Key: Required (free signup)
 *    - Rate Limits: Varies by tier
 *    - Coverage: General products
 * 
 * Note: Open Food Facts is the best choice for nutrition apps as it includes
 * detailed nutrition information per 100g, which matches our data model.
 */

// ---------------------------------------------------------------------------
// Meal Logging
// ---------------------------------------------------------------------------

export async function logMeal(
  db: Database,
  input: {
    date: string;
    meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack';
    food_id: string;
    amount_grams: number;
  },
): Promise<Meal> {
  const id = generateId();
  const now = new Date().toISOString();
  
  const meal: Meal = {
    id,
    date: input.date,
    meal_type: input.meal_type,
    food_id: input.food_id,
    amount_grams: input.amount_grams,
    created_at: now,
    sync_status: 'local',
  };

  await db.execute(
    `INSERT INTO meals (id, date, meal_type, food_id, amount_grams, created_at, sync_status)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [meal.id, meal.date, meal.meal_type, meal.food_id, meal.amount_grams, meal.created_at, meal.sync_status],
  );

  return meal;
}

export async function deleteMeal(db: Database, mealId: string): Promise<void> {
  await db.execute('DELETE FROM meals WHERE id = $1', [mealId]);
}

export async function getMealsForDate(db: Database, date: string): Promise<MealWithFood[]> {
  const dateStr = date.length === 10 ? date : date.split('T')[0];
  const meals = await db.select<Meal[]>(
    "SELECT * FROM meals WHERE substr(date, 1, 10) = $1 ORDER BY created_at ASC",
    [dateStr],
  );

  const mealsWithFood: MealWithFood[] = [];
  for (const meal of meals) {
    const food = await getFoodById(db, meal.food_id);
    if (!food) continue;

    const multiplier = meal.amount_grams / 100;
    mealsWithFood.push({
      ...meal,
      food,
      calories: food.calories_per_100g * multiplier,
      protein: food.protein_per_100g * multiplier,
      carbs: food.carbs_per_100g * multiplier,
      fats: food.fats_per_100g * multiplier,
      fiber: food.fiber_per_100g * multiplier,
    });
  }

  return mealsWithFood;
}

export async function getDailyNutrition(db: Database, date: string): Promise<DailyNutrition> {
  const meals = await getMealsForDate(db, date);
  
  const totals = meals.reduce(
    (acc, meal) => ({
      calories: acc.calories + meal.calories,
      protein: acc.protein + meal.protein,
      carbs: acc.carbs + meal.carbs,
      fats: acc.fats + meal.fats,
      fiber: acc.fiber + meal.fiber,
    }),
    { calories: 0, protein: 0, carbs: 0, fats: 0, fiber: 0 },
  );

  return {
    date,
    ...totals,
    meals,
  };
}

// ---------------------------------------------------------------------------
// Weight Tracking
// ---------------------------------------------------------------------------

export async function saveWeightEntry(
  db: Database,
  input: {
    date: string;
    weight_kg: number;
    body_fat_percent?: number;
    source?: 'manual' | 'healthkit';
  },
): Promise<WeightEntry> {
  const id = generateId();
  const now = new Date().toISOString();
  const dateStr = input.date.length === 10 ? input.date : input.date.split('T')[0];
  
  // Check if entry exists for this date and source
  const existing = await db.select<WeightEntry[]>(
    "SELECT * FROM weight_entries WHERE substr(date, 1, 10) = $1 AND source = $2",
    [dateStr, input.source ?? 'manual'],
  );

  if (existing.length > 0) {
    // Update existing entry
    await db.execute(
      'UPDATE weight_entries SET weight_kg = $1, body_fat_percent = $2 WHERE id = $3',
      [input.weight_kg, input.body_fat_percent ?? null, existing[0].id],
    );
    return { ...existing[0], weight_kg: input.weight_kg, body_fat_percent: input.body_fat_percent ?? null };
  }

  const entry: WeightEntry = {
    id,
    date: dateStr,
    weight_kg: input.weight_kg,
    body_fat_percent: input.body_fat_percent ?? null,
    source: input.source ?? 'manual',
    created_at: now,
    sync_status: 'local',
  };

  await db.execute(
    `INSERT INTO weight_entries (id, date, weight_kg, body_fat_percent, source, created_at, sync_status)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [entry.id, entry.date, entry.weight_kg, entry.body_fat_percent, entry.source, entry.created_at, entry.sync_status],
  );

  return entry;
}

export async function getWeightEntries(
  db: Database,
  startDate?: string,
  endDate?: string,
  limit = 100,
): Promise<WeightEntry[]> {
  let query = 'SELECT * FROM weight_entries';
  const params: string[] = [];
  
  if (startDate && endDate) {
    query += " WHERE substr(date, 1, 10) >= $1 AND substr(date, 1, 10) <= $2";
    params.push(startDate.length === 10 ? startDate : startDate.split('T')[0], endDate.length === 10 ? endDate : endDate.split('T')[0]);
  } else if (startDate) {
    query += " WHERE substr(date, 1, 10) >= $1";
    params.push(startDate.length === 10 ? startDate : startDate.split('T')[0]);
  }
  
  query += ' ORDER BY date DESC LIMIT $' + (params.length + 1);
  params.push(String(limit));
  
  return db.select<WeightEntry[]>(query, params);
}

export async function getLatestWeight(db: Database): Promise<WeightEntry | null> {
  const rows = await db.select<WeightEntry[]>('SELECT * FROM weight_entries ORDER BY date DESC LIMIT 1');
  return rows[0] ?? null;
}

// ---------------------------------------------------------------------------
// TDEE Calculation (MacroFactor-style)
// ---------------------------------------------------------------------------

/**
 * Calculate TDEE using weight trend and calorie intake data.
 * Uses a rolling window approach similar to MacroFactor.
 */
export async function calculateTDEE(
  db: Database,
  days = 14,
): Promise<TDEEEstimate | null> {
  const endDate = new Date();
  const startDate = subDays(endDate, days);
  
  // Get weight entries for the period
  const weightEntries = await getWeightEntries(
    db,
    format(startDate, 'yyyy-MM-dd'),
    format(endDate, 'yyyy-MM-dd'),
  );
  
  if (weightEntries.length < 3) {
    return null; // Need at least 3 data points
  }

  // Get daily nutrition for the period
  const nutritionData: { date: string; calories: number }[] = [];
  for (let i = 0; i < days; i++) {
    const date = format(subDays(endDate, i), 'yyyy-MM-dd');
    const nutrition = await getDailyNutrition(db, date);
    if (nutrition.calories > 0) {
      nutritionData.push({ date, calories: nutrition.calories });
    }
  }

  if (nutritionData.length < 3) {
    return null; // Need nutrition data too
  }

  // Sort weight entries by date
  const sortedWeights = weightEntries
    .map(w => ({ date: w.date, weight: w.weight_kg }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Calculate weight change rate (kg per day)
  const firstWeight = sortedWeights[0];
  const lastWeight = sortedWeights[sortedWeights.length - 1];
  const daysDiff = differenceInDays(parseISO(lastWeight.date), parseISO(firstWeight.date));
  const weightChangeKg = lastWeight.weight - firstWeight.weight;
  const weightChangeRate = daysDiff > 0 ? weightChangeKg / daysDiff : 0;

  // Average daily calories
  const avgCalories = nutritionData.reduce((sum, d) => sum + d.calories, 0) / nutritionData.length;

  // Estimate BMR using Mifflin-St Jeor equation (simplified - would need height, age, gender)
  // For now, use a rough estimate: BMR ≈ weight_kg * 22 (rough average)
  const avgWeight = sortedWeights.reduce((sum, w) => sum + w.weight, 0) / sortedWeights.length;
  const estimatedBMR = avgWeight * 22; // Rough estimate

  // Calculate TDEE
  // Weight change (kg/day) * 7700 kcal/kg = energy balance (kcal/day)
  // TDEE = avg_calories - (weight_change_rate * 7700)
  const energyBalance = weightChangeRate * 7700; // 1 kg fat ≈ 7700 kcal
  const tdee = avgCalories - energyBalance;

  // Activity factor = TDEE / BMR
  const activityFactor = tdee / estimatedBMR;

  // Confidence based on data quality
  let confidence: 'low' | 'medium' | 'high' = 'low';
  if (sortedWeights.length >= 7 && nutritionData.length >= 7) {
    confidence = 'medium';
  }
  if (sortedWeights.length >= 14 && nutritionData.length >= 14) {
    confidence = 'high';
  }

  return {
    tdee: Math.max(estimatedBMR, tdee), // Don't go below BMR
    bmr: estimatedBMR,
    activity_factor: activityFactor,
    confidence,
    data_points: Math.min(sortedWeights.length, nutritionData.length),
    date_range: {
      start: format(startDate, 'yyyy-MM-dd'),
      end: format(endDate, 'yyyy-MM-dd'),
    },
  };
}

// ---------------------------------------------------------------------------
// Macro Recommendations
// ---------------------------------------------------------------------------

export async function getMacroRecommendation(
  db: Database,
  goalType: NutritionGoalType,
  targetWeightChangeKgPerWeek = 0.5,
): Promise<MacroRecommendation | null> {
  const tdee = await calculateTDEE(db);
  if (!tdee) {
    // Fallback: use a simple estimate
    const latestWeight = await getLatestWeight(db);
    if (!latestWeight) return null;
    
    const estimatedBMR = latestWeight.weight_kg * 22;
    const estimatedTDEE = estimatedBMR * 1.5; // Sedentary multiplier
    
    return calculateMacros(db, estimatedTDEE, goalType, targetWeightChangeKgPerWeek);
  }

  return calculateMacros(db, tdee.tdee, goalType, targetWeightChangeKgPerWeek);
}

async function calculateMacros(
  db: Database,
  tdee: number,
  goalType: NutritionGoalType,
  targetWeightChangeKgPerWeek: number,
): Promise<MacroRecommendation> {
  let targetCalories = tdee;
  
  if (goalType === 'lose') {
    // Deficit: 500 kcal/day ≈ 0.5 kg/week
    targetCalories = tdee - (targetWeightChangeKgPerWeek * 500);
  } else if (goalType === 'gain') {
    // Surplus: 500 kcal/day ≈ 0.5 kg/week
    targetCalories = tdee + (targetWeightChangeKgPerWeek * 500);
  }

  // Protein: 1.6-2.2 g/kg body weight (use 2.0 g/kg as default)
  const latestWeight = await getLatestWeight(db);
  const weightKg = latestWeight?.weight_kg ?? 70; // Fallback to 70kg if no weight data
  const protein = weightKg * 2.0;

  // Fats: 20-35% of calories (use 25%)
  const fats = (targetCalories * 0.25) / 9; // 9 kcal per gram

  // Carbs: Remaining calories
  const carbs = (targetCalories - (protein * 4) - (fats * 9)) / 4; // 4 kcal per gram

  const rationale = goalType === 'lose'
    ? `Based on your TDEE of ${Math.round(tdee)} kcal, a ${Math.round(tdee - targetCalories)} kcal deficit supports ${targetWeightChangeKgPerWeek} kg/week weight loss.`
    : goalType === 'gain'
      ? `Based on your TDEE of ${Math.round(tdee)} kcal, a ${Math.round(targetCalories - tdee)} kcal surplus supports ${targetWeightChangeKgPerWeek} kg/week weight gain.`
      : `Based on your TDEE of ${Math.round(tdee)} kcal, maintaining current intake supports weight maintenance.`;

  return {
    calories: Math.round(targetCalories),
    protein: Math.round(protein),
    carbs: Math.round(carbs),
    fats: Math.round(fats),
    rationale,
  };
}

// ---------------------------------------------------------------------------
// Nutrition Goals
// ---------------------------------------------------------------------------

export async function createNutritionGoal(
  db: Database,
  input: {
    target_calories?: number;
    target_protein_g?: number;
    target_carbs_g?: number;
    target_fats_g?: number;
    goal_type: NutritionGoalType;
    start_date: string;
    end_date?: string;
  },
): Promise<NutritionGoal> {
  // Deactivate existing goals
  await db.execute('UPDATE nutrition_goals SET is_active = 0 WHERE is_active = 1');

  const id = generateId();
  const now = new Date().toISOString();
  
  const goal: NutritionGoal = {
    id,
    target_calories: input.target_calories ?? null,
    target_protein_g: input.target_protein_g ?? null,
    target_carbs_g: input.target_carbs_g ?? null,
    target_fats_g: input.target_fats_g ?? null,
    goal_type: input.goal_type,
    start_date: input.start_date,
    end_date: input.end_date ?? null,
    is_active: 1,
    created_at: now,
    updated_at: now,
    sync_status: 'local',
  };

  await db.execute(
    `INSERT INTO nutrition_goals (id, target_calories, target_protein_g, target_carbs_g, target_fats_g, goal_type, start_date, end_date, is_active, created_at, updated_at, sync_status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
    [goal.id, goal.target_calories, goal.target_protein_g, goal.target_carbs_g, goal.target_fats_g, goal.goal_type, goal.start_date, goal.end_date, goal.is_active, goal.created_at, goal.updated_at, goal.sync_status],
  );

  return goal;
}

export async function getActiveNutritionGoal(db: Database): Promise<NutritionGoal | null> {
  const rows = await db.select<NutritionGoal[]>('SELECT * FROM nutrition_goals WHERE is_active = 1 LIMIT 1');
  return rows[0] ?? null;
}

export async function updateNutritionGoal(
  db: Database,
  id: string,
  updates: Partial<{
    target_calories: number;
    target_protein_g: number;
    target_carbs_g: number;
    target_fats_g: number;
    goal_type: NutritionGoalType;
    end_date: string | null;
  }>,
): Promise<void> {
  const setClauses: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  if (updates.target_calories !== undefined) {
    setClauses.push(`target_calories = $${paramIndex++}`);
    values.push(updates.target_calories);
  }
  if (updates.target_protein_g !== undefined) {
    setClauses.push(`target_protein_g = $${paramIndex++}`);
    values.push(updates.target_protein_g);
  }
  if (updates.target_carbs_g !== undefined) {
    setClauses.push(`target_carbs_g = $${paramIndex++}`);
    values.push(updates.target_carbs_g);
  }
  if (updates.target_fats_g !== undefined) {
    setClauses.push(`target_fats_g = $${paramIndex++}`);
    values.push(updates.target_fats_g);
  }
  if (updates.goal_type !== undefined) {
    setClauses.push(`goal_type = $${paramIndex++}`);
    values.push(updates.goal_type);
  }
  if (updates.end_date !== undefined) {
    setClauses.push(`end_date = $${paramIndex++}`);
    values.push(updates.end_date);
  }

  if (setClauses.length === 0) return;

  setClauses.push(`updated_at = $${paramIndex++}`);
  values.push(new Date().toISOString());
  values.push(id);

  await db.execute(
    `UPDATE nutrition_goals SET ${setClauses.join(', ')} WHERE id = $${paramIndex}`,
    values,
  );
}

