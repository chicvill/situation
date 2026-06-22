export interface PhysiognomyResult {
  animalType: string;
  animalDescription: string;
  overallScore: number;
  personality: string;
  wealthLuck: string;
  careerLuck: string;
  loveLuck: string;
  advice: string;
}

export interface SheetConfig {
  scriptUrl: string;
}

export enum AppState {
  HOME,
  CAMERA,
  ANALYZING,
  RESULT,
  ERROR
}