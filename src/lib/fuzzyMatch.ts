/**
 * Fuzzy matching utilities for linking tracks across platforms
 */

/**
 * Normalize a string for comparison
 * - Lowercase
 * - Remove special characters
 * - Remove common suffixes like (Official Video), [Remaster], etc.
 */
export function normalizeString(str: string): string {
  if (!str) return '';
  
  return str
    .toLowerCase()
    // Remove text in parentheses/brackets that are common additions
    .replace(/\s*[\(\[][^\)\]]*(?:official|video|audio|lyrics|remaster|remix|live|feat|ft\.|featuring|explicit|clean|radio edit|extended|acoustic|instrumental|version|ver\.|prod\.)[\)\]]/gi, '')
    // Remove remaining parentheses/brackets content if short
    .replace(/\s*[\(\[][^\)\]]{1,10}[\)\]]/g, '')
    // Remove special characters
    .replace(/[^\w\s]/g, ' ')
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Calculate similarity score between two strings (0-1)
 * Uses a combination of Levenshtein distance and word matching
 */
export function calculateSimilarity(str1: string, str2: string): number {
  const norm1 = normalizeString(str1);
  const norm2 = normalizeString(str2);
  
  if (norm1 === norm2) return 1;
  if (!norm1 || !norm2) return 0;
  
  // Word-based matching
  const words1 = new Set(norm1.split(' ').filter(w => w.length > 1));
  const words2 = new Set(norm2.split(' ').filter(w => w.length > 1));
  
  if (words1.size === 0 || words2.size === 0) return 0;
  
  // Count matching words
  let matchingWords = 0;
  for (const word of words1) {
    if (words2.has(word)) {
      matchingWords++;
    }
  }
  
  // Jaccard similarity
  const unionSize = new Set([...words1, ...words2]).size;
  const wordSimilarity = matchingWords / unionSize;
  
  // Also check if one contains the other (for abbreviated names)
  const containsBonus = 
    (norm1.includes(norm2) || norm2.includes(norm1)) ? 0.2 : 0;
  
  return Math.min(1, wordSimilarity + containsBonus);
}

/**
 * Check if two tracks are likely the same song
 */
export function isMatchingTrack(
  track1: { title: string; artist: string | null },
  track2: { title: string; artist: string | null },
  threshold: number = 0.7
): boolean {
  // Calculate title similarity
  const titleSimilarity = calculateSimilarity(track1.title, track2.title);
  
  // If titles are very similar, it's likely a match even without artist
  if (titleSimilarity >= 0.9) return true;
  
  // If both have artists, require both to match
  if (track1.artist && track2.artist) {
    const artistSimilarity = calculateSimilarity(track1.artist, track2.artist);
    
    // Both title and artist should be similar
    const combinedScore = (titleSimilarity * 0.6) + (artistSimilarity * 0.4);
    return combinedScore >= threshold;
  }
  
  // One or both missing artist - require higher title similarity
  return titleSimilarity >= 0.85;
}

/**
 * Find the best matching track from a list
 */
export function findBestMatch<T extends { title: string; artist: string | null }>(
  target: { title: string; artist: string | null },
  candidates: T[],
  threshold: number = 0.7
): { match: T | null; score: number } {
  let bestMatch: T | null = null;
  let bestScore = 0;
  
  for (const candidate of candidates) {
    const titleSimilarity = calculateSimilarity(target.title, candidate.title);
    const artistSimilarity = target.artist && candidate.artist 
      ? calculateSimilarity(target.artist, candidate.artist)
      : 0.5; // Neutral if one is missing
    
    const score = (titleSimilarity * 0.6) + (artistSimilarity * 0.4);
    
    if (score > bestScore && score >= threshold) {
      bestScore = score;
      bestMatch = candidate;
    }
  }
  
  return { match: bestMatch, score: bestScore };
}

/**
 * Group tracks by similarity into master tracks
 */
export function groupTracksByMaster<T extends { id: string; title: string; artist: string | null; source: string }>(
  tracks: T[]
): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  const assigned = new Set<string>();
  
  for (const track of tracks) {
    if (assigned.has(track.id)) continue;
    
    // Find all matching tracks
    const matches: T[] = [track];
    assigned.add(track.id);
    
    for (const candidate of tracks) {
      if (assigned.has(candidate.id)) continue;
      if (candidate.source === track.source) continue; // Different source required
      
      if (isMatchingTrack(track, candidate)) {
        matches.push(candidate);
        assigned.add(candidate.id);
      }
    }
    
    // Create canonical key from the "best" version
    // Prefer Spotify > YouTube > SoundCloud > Local for canonical info
    const priority = ['spotify', 'youtube', 'soundcloud', 'local'];
    matches.sort((a, b) => priority.indexOf(a.source) - priority.indexOf(b.source));
    
    const canonical = matches[0];
    const key = `${normalizeString(canonical.title)}|${normalizeString(canonical.artist || '')}`;
    
    groups.set(key, matches);
  }
  
  return groups;
}

/**
 * Create a canonical title/artist from a group of tracks
 */
export function getCanonicalInfo(tracks: { title: string; artist: string | null; source: string }[]): {
  title: string;
  artist: string | null;
} {
  // Priority: Spotify > YouTube > SoundCloud > Local
  const priority = ['spotify', 'youtube', 'soundcloud', 'local'];
  const sorted = [...tracks].sort((a, b) => 
    priority.indexOf(a.source) - priority.indexOf(b.source)
  );
  
  return {
    title: sorted[0].title,
    artist: sorted[0].artist,
  };
}
