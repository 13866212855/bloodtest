export type GlucoseUnit = 'mmol/L' | 'mg/dL';

export type MeasurementContext =
  | 'fasting'
  | 'before_breakfast'
  | 'after_breakfast'
  | 'before_lunch'
  | 'after_lunch'
  | 'before_dinner'
  | 'after_dinner'
  | 'bedtime'
  | 'random';

export type MealLevel = 'none' | 'light' | 'normal' | 'heavy';

export type ExerciseLevel = 'none' | 'light' | 'moderate' | 'intense';

export type GlucoseStatus = 'low' | 'normal' | 'elevated' | 'high';

export type DateRangeOption = '7d' | '14d' | '30d' | '90d' | 'all';

export interface UserSettings {
  uid: string;
  displayName: string;
  unit: GlucoseUnit;
  fastingLow: number;
  fastingHigh: number;
  postMealLow: number;
  postMealHigh: number;
  generalLow: number;
  generalHigh: number;
}

export interface GlucoseRecord {
  id: string;
  uid: string;
  valueMmol: number;
  context: MeasurementContext;
  measuredAtMs: number;
  note: string;
  mealLevel: MealLevel;
  exerciseLevel: ExerciseLevel;
  medicationTaken: boolean;
}

export interface GlucoseRecordInput {
  valueMmol: number;
  context: MeasurementContext;
  measuredAtMs: number;
  note: string;
  mealLevel: MealLevel;
  exerciseLevel: ExerciseLevel;
  medicationTaken: boolean;
}
