export interface AnswerResult<Answer> {
  correct: boolean;
  // All positions that would be accepted as correct. When the algorithm
  // produces a unique closest position this has length 1; ties produce >1.
  correctAnswers: Answer[];
  elapsedMs: number;
  // True when this answer completes the prompt. Single-answer exercises (Root
  // Notes) are always true; multi-click exercises are false until the last
  // required click.
  promptComplete: boolean;
}

export interface Exercise<Config, Prompt, Answer, Report> {
  start(config: Config): void;
  getNextPrompt(): Prompt;
  submitAnswer(answer: Answer): AnswerResult<Answer>;
  getReport(): Report;
}
