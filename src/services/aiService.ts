import axios from 'axios';
import { Event } from '../types';

export const getEventRecommendations = async (
  userInterests: string[] = [],
  allEvents: Event[] = []
): Promise<string[]> => {
  if (!allEvents.length) return [];

  try {
    const response = await axios.post('/api/recommendations', {
      userInterests,
      allEvents: allEvents.map((e) => ({
        id: e.id,
        title: e.title,
        category: e.category,
        registeredCount: e.registeredCount,
      })),
    });
    const recs = response.data?.recommendations || [];
    return recs.slice(0, 3).map((e: any) => e.id);
  } catch {
    // Clean client-side scoring fallback
    return [...allEvents]
      .sort((a, b) => {
        const aScore = (userInterests.includes(a.category) ? 10 : 0) + (a.registeredCount || 0) * 0.05;
        const bScore = (userInterests.includes(b.category) ? 10 : 0) + (b.registeredCount || 0) * 0.05;
        return bScore - aScore;
      })
      .slice(0, 3)
      .map((e) => e.id);
  }
};
