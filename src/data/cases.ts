import { CASE_0 } from './case0';
import type { CaseDef } from '../types';

/** Register future cases here. The live case is chosen by SaveData.caseId. */
export const CASES: CaseDef[] = [CASE_0];

export function getCase(id: string): CaseDef {
  return CASES.find((c) => c.id === id) ?? CASES[0];
}
