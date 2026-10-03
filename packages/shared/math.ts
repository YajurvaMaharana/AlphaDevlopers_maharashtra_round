// Gini coefficient calculation
export function calculateGini(values: number[]): number {
  if (values.length === 0) return 0;
  
  // Sort values in ascending order
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  
  let sumOfAbsoluteDifferences = 0;
  let sum = 0;
  
  for (let i = 0; i < n; i++) {
    sum += sorted[i];
    for (let j = 0; j < n; j++) {
      sumOfAbsoluteDifferences += Math.abs(sorted[i] - sorted[j]);
    }
  }
  
  if (sum === 0) return 0; // Avoid division by zero if all values are 0
  
  const mean = sum / n;
  // Gini = sum(|x_i - x_j|) / (2 * n^2 * mean)
  return sumOfAbsoluteDifferences / (2 * n * n * mean);
}

// Spearman rank correlation calculation
// 0 = no correlation, -1 = negative correlation (first-come-first-served)
export function calculateSpearman(x: number[], y: number[]): number {
  if (x.length !== y.length || x.length <= 1) return 0;
  
  const n = x.length;
  
  // Helper to calculate ranks (handling ties by averaging ranks)
  const getRanks = (arr: number[]) => {
    const sorted = arr.map((val, idx) => ({ val, idx })).sort((a, b) => a.val - b.val);
    const ranks = new Array(n);
    
    let i = 0;
    while (i < n) {
      let j = i;
      while (j < n - 1 && sorted[j].val === sorted[j + 1].val) {
        j++;
      }
      // Average rank for ties
      const rank = (i + j + 2) / 2;
      for (let k = i; k <= j; k++) {
        ranks[sorted[k].idx] = rank;
      }
      i = j + 1;
    }
    return ranks;
  };

  const rankX = getRanks(x);
  const rankY = getRanks(y);

  let dSquaredSum = 0;
  for (let i = 0; i < n; i++) {
    const d = rankX[i] - rankY[i];
    dSquaredSum += d * d;
  }

  return 1 - (6 * dSquaredSum) / (n * (n * n - 1));
}
