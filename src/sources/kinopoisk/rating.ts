import { URLS } from '../../shared/config.ts';
import { request } from '../../shared/http.ts';

export type KinopoiskRating = { rating: number | null; votes: number | null };

export const parseRatingXml = (xmlText: string): KinopoiskRating => {
  const xml = new DOMParser().parseFromString(xmlText, 'application/xml');
  if (xml.getElementsByTagName('parsererror').length) throw new Error('Kinopoisk returned invalid XML');

  const node = xml.getElementsByTagName('kp_rating')[0];
  const rating = Number.parseFloat(node?.textContent ?? '');
  const votes = Number.parseInt(node?.getAttribute('num_vote') ?? '', 10);
  return {
    // Kinopoisk reports 0 for titles nobody has rated yet; real ratings start at 1.
    rating: Number.isFinite(rating) && rating > 0 ? rating : null,
    votes: Number.isFinite(votes) ? votes : null,
  };
};

export const fetchKinopoiskRating = async (kinopoiskId: string) => {
  const { text } = await request(`${URLS.kinopoiskRating}/${kinopoiskId}.xml`, {
    headers: { Accept: 'application/xml,text/xml' },
  });
  return parseRatingXml(text);
};
