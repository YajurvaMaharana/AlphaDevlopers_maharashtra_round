import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Analytics Isolation (Ground Truth)', () => {
  it('should ensure x-sim-cohort is NEVER used outside of the metrics collector', () => {
    // We scan the entire src directory (except metrics collector and this test)
    // to ensure no one is reading 'x-sim-cohort' or calling 'getSimCohort' to make defense decisions.
    
    function scanDirectory(dir: string, forbiddenStrings: string[]): string[] {
      let violations: string[] = [];
      const files = fs.readdirSync(dir);
      
      for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          violations = violations.concat(scanDirectory(fullPath, forbiddenStrings));
        } else if (stat.isFile() && fullPath.endsWith('.ts')) {
          // Whitelist the metricsCollector and the tests itself
          if (fullPath.includes('metricsCollector.ts') || fullPath.includes('noCohortInDefense.test.ts')) {
            continue;
          }
          
          const content = fs.readFileSync(fullPath, 'utf8').toLowerCase();
          for (const str of forbiddenStrings) {
            if (content.includes(str.toLowerCase())) {
              violations.push(`${fullPath} contains forbidden string: ${str}`);
            }
          }
        }
      }
      
      return violations;
    }

    const srcDir = path.resolve(__dirname, '../');
    const violations = scanDirectory(srcDir, ['x-sim-cohort', 'getSimCohort']);
    
    expect(violations).toEqual([]);
  });
});
