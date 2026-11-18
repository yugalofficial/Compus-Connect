import campusHeroImg from '../assets/images/campus_hero_banner_1794679146693.jpg';
import ogCampusImg from '../assets/images/og_campus_connect_v3_1794967363609.jpg';
import techCoverImg from '../assets/images/event_tech_default_1794679147074.jpg';
import culturalCoverImg from '../assets/images/event_cultural_default_1794679147344.jpg';
import workshopCoverImg from '../assets/images/event_workshop_default_1794679147359.jpg';
import sportsCoverImg from '../assets/images/event_sports_default_1794679146814.jpg';

export const HERO_BANNER_IMAGE = ogCampusImg || campusHeroImg;
export const CAMPUS_PLAZA_IMAGE = campusHeroImg;

export const CATEGORY_COVERS: Record<string, string> = {
  Tech: techCoverImg,
  Cultural: culturalCoverImg,
  Workshop: workshopCoverImg,
  Sports: sportsCoverImg,
  Academic: campusHeroImg,
};

export function getEventCover(posterUrl?: string, category?: string): string {
  if (posterUrl && posterUrl.trim().length > 0 && !posterUrl.includes('picsum.photos')) {
    return posterUrl;
  }
  return (category && CATEGORY_COVERS[category]) || HERO_BANNER_IMAGE;
}

export function getInitials(name?: string): string {
  if (!name) return 'CC';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export async function compressImageToDataUrl(file: File, maxWidth = 960, quality = 0.75): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Invalid image format'));
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context unavailable'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}
