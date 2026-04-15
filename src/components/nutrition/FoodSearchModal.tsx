import { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Spinner } from '../ui/Spinner';
import type { Food } from '../../types';
import { searchFoods, createFood } from '../../services/nutritionService';
import type Database from '@tauri-apps/plugin-sql';

interface FoodSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (food: Food, amountGrams: number) => void;
  db: Database;
}

export function FoodSearchModal({ isOpen, onClose, onSelect, db }: FoodSearchModalProps) {
  const [query, setQuery] = useState('');
  const [foods, setFoods] = useState<Food[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [selectedFood, setSelectedFood] = useState<Food | null>(null);
  const [amountGrams, setAmountGrams] = useState('100');

  // Create food form state
  const [newFood, setNewFood] = useState({
    name: '',
    brand: '',
    calories_per_100g: '',
    protein_per_100g: '',
    carbs_per_100g: '',
    fats_per_100g: '',
    fiber_per_100g: '',
  });

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setFoods([]);
      setShowCreateForm(false);
      setSelectedFood(null);
      setAmountGrams('100');
    }
  }, [isOpen]);

  useEffect(() => {
    if (query.length >= 2) {
      setLoading(true);
      searchFoods(db, query)
        .then(results => {
          setFoods(results);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    } else {
      setFoods([]);
    }
  }, [query, db]);

  async function handleCreateFood() {
    if (!newFood.name || !newFood.calories_per_100g) return;
    
    setCreating(true);
    try {
      const food = await createFood(db, {
        name: newFood.name,
        brand: newFood.brand || undefined,
        calories_per_100g: parseFloat(newFood.calories_per_100g),
        protein_per_100g: parseFloat(newFood.protein_per_100g) || 0,
        carbs_per_100g: parseFloat(newFood.carbs_per_100g) || 0,
        fats_per_100g: parseFloat(newFood.fats_per_100g) || 0,
        fiber_per_100g: parseFloat(newFood.fiber_per_100g) || 0,
      });
      
      setSelectedFood(food);
      setShowCreateForm(false);
      setNewFood({
        name: '',
        brand: '',
        calories_per_100g: '',
        protein_per_100g: '',
        carbs_per_100g: '',
        fats_per_100g: '',
        fiber_per_100g: '',
      });
    } catch (err) {
      console.error('Failed to create food:', err);
    } finally {
      setCreating(false);
    }
  }

  function handleConfirm() {
    if (selectedFood && amountGrams) {
      onSelect(selectedFood, parseFloat(amountGrams));
      onClose();
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Food">
      <div className="flex flex-col gap-4">
        {!selectedFood ? (
          <>
            <div className="flex gap-2">
              <Input
                placeholder="Search foods..."
                value={query}
                onChange={e => setQuery(e.target.value)}
                className="flex-1"
              />
              <Button onClick={() => setShowCreateForm(!showCreateForm)}>
                {showCreateForm ? 'Cancel' : 'New'}
              </Button>
            </div>

            {showCreateForm ? (
              <Card>
                <div className="flex flex-col gap-3">
                  <Input
                    label="Food Name"
                    value={newFood.name}
                    onChange={e => setNewFood({ ...newFood, name: e.target.value })}
                    placeholder="e.g., Chicken Breast"
                  />
                  <Input
                    label="Brand (optional)"
                    value={newFood.brand}
                    onChange={e => setNewFood({ ...newFood, brand: e.target.value })}
                    placeholder="e.g., Generic"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      label="Calories (per 100g)"
                      type="number"
                      value={newFood.calories_per_100g}
                      onChange={e => setNewFood({ ...newFood, calories_per_100g: e.target.value })}
                      placeholder="165"
                    />
                    <Input
                      label="Protein (g per 100g)"
                      type="number"
                      value={newFood.protein_per_100g}
                      onChange={e => setNewFood({ ...newFood, protein_per_100g: e.target.value })}
                      placeholder="31"
                    />
                    <Input
                      label="Carbs (g per 100g)"
                      type="number"
                      value={newFood.carbs_per_100g}
                      onChange={e => setNewFood({ ...newFood, carbs_per_100g: e.target.value })}
                      placeholder="0"
                    />
                    <Input
                      label="Fats (g per 100g)"
                      type="number"
                      value={newFood.fats_per_100g}
                      onChange={e => setNewFood({ ...newFood, fats_per_100g: e.target.value })}
                      placeholder="3.6"
                    />
                  </div>
                  <Button onClick={handleCreateFood} isLoading={creating}>
                    Create Food
                  </Button>
                </div>
              </Card>
            ) : (
              <div className="flex flex-col gap-2 max-h-64 overflow-y-auto">
                {loading ? (
                  <div className="flex justify-center py-4">
                    <Spinner size="sm" />
                  </div>
                ) : foods.length === 0 && query.length >= 2 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                    No foods found. Create a new one!
                  </p>
                ) : (
                  foods.map(food => (
                    <Card
                      key={food.id}
                      onClick={() => setSelectedFood(food)}
                      className="cursor-pointer"
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                            {food.name}
                          </p>
                          {food.brand && (
                            <p className="text-xs text-gray-500 dark:text-gray-400">{food.brand}</p>
                          )}
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {food.calories_per_100g} kcal · {food.protein_per_100g}g protein per 100g
                          </p>
                        </div>
                      </div>
                    </Card>
                  ))
                )}
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col gap-4">
            <Card>
              <div className="flex justify-between items-start mb-3">
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {selectedFood.name}
                  </p>
                  {selectedFood.brand && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">{selectedFood.brand}</p>
                  )}
                </div>
                <button
                  onClick={() => setSelectedFood(null)}
                  className="text-xs text-gray-400 hover:text-gray-600"
                >
                  Change
                </button>
              </div>
              <div className="grid grid-cols-4 gap-2 text-xs text-gray-600 dark:text-gray-400 mb-3">
                <div>
                  <p className="font-medium">{selectedFood.calories_per_100g} kcal</p>
                  <p className="text-[10px]">Calories</p>
                </div>
                <div>
                  <p className="font-medium">{selectedFood.protein_per_100g}g</p>
                  <p className="text-[10px]">Protein</p>
                </div>
                <div>
                  <p className="font-medium">{selectedFood.carbs_per_100g}g</p>
                  <p className="text-[10px]">Carbs</p>
                </div>
                <div>
                  <p className="font-medium">{selectedFood.fats_per_100g}g</p>
                  <p className="text-[10px]">Fats</p>
                </div>
              </div>
              <Input
                label="Amount (grams)"
                type="number"
                value={amountGrams}
                onChange={e => setAmountGrams(e.target.value)}
                placeholder="100"
              />
            </Card>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setSelectedFood(null)} className="flex-1">
                Back
              </Button>
              <Button onClick={handleConfirm} className="flex-1" disabled={!amountGrams}>
                Add
              </Button>
            </div>
          </div>
        )}
      </div>

    </Modal>
  );
}

