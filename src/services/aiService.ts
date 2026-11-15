import { Event } from '../types';
import { fetchRecommendedEventIds } from '../lib/api';

export const getEventRecommendations = async (
  userInterests: string[] = [],
  allEvents: Event[] = []
): Promise<string[]> => {
  if (!allEvents.length) return [];

  try {
    const remoteIds = await fetchRecommendedEventIds(
      userInterests,
      allEvents.map((e) => ({
        id: e.id,
        title: e.title,
        category: e.category,
        registeredCount: e.registeredCount,
      }))
    );
    if (remoteIds) return remoteIds;
  } catch {
    // Clean client-side scoring fallback for GitHub Pages / offline mode
  }

  return [...allEvents]
    .sort((a, b) => {
      const aScore = (userInterests.includes(a.category) ? 10 : 0) + (a.registeredCount || 0) * 0.05;
      const bScore = (userInterests.includes(b.category) ? 10 : 0) + (b.registeredCount || 0) * 0.05;
      return bScore - aScore;
    })
    .slice(0, 3)
    .map((e) => e.id);
};
