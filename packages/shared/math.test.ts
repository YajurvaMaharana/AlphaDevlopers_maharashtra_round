import { describe, it, expect } from 'vitest';
import { calculateGini, calculateSpearman } from './math';

describe('Math functions', () => {
  describe('calculateGini', () => {
    it('returns 0 for perfectly equal distribution', () => {
      expect(calculateGini([1, 1, 1, 1])).toBeCloseTo(0);
      expect(calculateGini([5, 5, 5])).toBeCloseTo(0);
    });

    it('returns a high value for highly unequal distribution', () => {
      // 9 people have 0, 1 person has 10. Gini = 0.9
      expect(calculateGini([0, 0, 0, 0, 0, 0, 0, 0, 0, 10])).toBeCloseTo(0.9);
    });

    it('calculates hand-checked example correctly', () => {
      // Example: [1, 2, 3, 4, 5]
      // Mean = 3. Sum = 15. n = 5
      // Absolute differences sum = 40
      // Gini = 40 / (2 * 25 * 3) = 40 / 150 = 0.2666...
      expect(calculateGini([1, 2, 3, 4, 5])).toBeCloseTo(0.266666, 5);
    });

    it('handles empty arrays', () => {
      expect(calculateGini([])).toBe(0);
    });

    it('handles all zeros', () => {
      expect(calculateGini([0, 0, 0])).toBe(0);
    });
  });

  describe('calculateSpearman', () => {
    it('returns 1 for perfect positive correlation', () => {
      expect(calculateSpearman([1, 2, 3, 4], [10, 20, 30, 40])).toBeCloseTo(1);
    });

    it('returns -1 for perfect negative correlation (first-come-first-serve limit case)', () => {
      expect(calculateSpearman([1, 2, 3, 4], [40, 30, 20, 10])).toBeCloseTo(-1);
    });

    it('returns 0 for no correlation', () => {
      // Hand-calculated zero correlation case.
      // n = 4. x ranks = [1, 2, 3, 4], y ranks = [2, 4, 1, 3]
      // differences (d) = [-1, -2, 2, 1]
      // sum(d^2) = 1 + 4 + 4 + 1 = 10
      // rs = 1 - (6 * 10) / (4 * (16 - 1)) = 1 - 60 / 60 = 0
      expect(calculateSpearman([1, 2, 3, 4], [2, 4, 1, 3])).toBeCloseTo(0);
    });

    it('handles ties in data correctly', () => {
      // x: [1, 2, 2, 4] -> ranks: [1, 2.5, 2.5, 4]
      // y: [10, 20, 20, 40] -> ranks: [1, 2.5, 2.5, 4]
      expect(calculateSpearman([1, 2, 2, 4], [10, 20, 20, 40])).toBeCloseTo(1);
    });

    it('handles small arrays', () => {
      expect(calculateSpearman([1], [2])).toBe(0);
      expect(calculateSpearman([], [])).toBe(0);
    });
  });
});
