export interface CalculatorStepState {
  technique: string;
  shape: string;
  length: string;
}

/**
 * Determines whether a step in the calculator is accessible based on completion of preceding steps.
 * Step 0: Base Technique (always accessible)
 * Step 1: Shape & Length (requires technique)
 * Step 2: Designs & Effects (requires technique + shape)
 * Step 3: Extras & Spa (requires technique + shape + length)
 */
export function isStepUnlocked(stepIndex: number, state: CalculatorStepState): boolean {
  if (stepIndex === 0) return true;
  if (stepIndex === 1) return Boolean(state.technique && state.technique.trim() !== '');
  if (stepIndex === 2) {
    return Boolean(
      state.technique &&
      state.technique.trim() !== '' &&
      state.shape &&
      state.shape.trim() !== ''
    );
  }
  if (stepIndex === 3) {
    return Boolean(
      state.technique &&
      state.technique.trim() !== '' &&
      state.shape &&
      state.shape.trim() !== '' &&
      state.length &&
      state.length.trim() !== ''
    );
  }
  return false;
}

/**
 * Determines whether a step has been satisfied/completed so it can display a checkmark.
 */
export function isStepCompleted(stepIndex: number, state: CalculatorStepState): boolean {
  if (stepIndex === 0) return Boolean(state.technique && state.technique.trim() !== '');
  if (stepIndex === 1) {
    return Boolean(
      state.technique &&
      state.technique.trim() !== '' &&
      state.shape &&
      state.shape.trim() !== ''
    );
  }
  if (stepIndex === 2) {
    return Boolean(
      state.technique &&
      state.technique.trim() !== '' &&
      state.shape &&
      state.shape.trim() !== '' &&
      state.length &&
      state.length.trim() !== ''
    );
  }
  if (stepIndex === 3) {
    return Boolean(
      state.technique &&
      state.technique.trim() !== '' &&
      state.shape &&
      state.shape.trim() !== '' &&
      state.length &&
      state.length.trim() !== ''
    );
  }
  return false;
}
