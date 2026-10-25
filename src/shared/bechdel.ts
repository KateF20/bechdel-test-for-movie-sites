export type BechdelScore = 0 | 1 | 2 | 3;

export type BechdelMovie = {
  imdbId: string;
  score: BechdelScore;
  // Rated 3 although contributors disagree whether the movie really passes.
  dubious: boolean;
  path: string;
  title: string;
};

export const SCORE_DESCRIPTIONS: Record<BechdelScore, string> = {
  0: 'Fewer than two women in this movie',
  1: 'There are two or more women in this movie, but they don\'t talk to each other',
  2: 'There are two or more women in this movie, but they only talk to each other about a man',
  3: 'There are two or more women in this movie and they talk to each other about something other than a man',
};
