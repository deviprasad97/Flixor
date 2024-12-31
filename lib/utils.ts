import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function uuidv4() {
  const length = 24;
  let result = "";
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const charactersLength = characters.length;
  let counter = 0;
  while (counter < length) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
    counter += 1;
  }
  return result;
}

export function getFormatedTime(time: number) {
  const hours = Math.floor(time / 3600);
  const minutes = Math.floor((time % 3600) / 60);
  const seconds = Math.floor(time % 60);

  // only show hours if there are any
  if (hours > 0)
    return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds
      .toString()
      .padStart(2, "0")}`;

  return `${minutes.toString().padStart(2, "0")}:${seconds
    .toString()
    .padStart(2, "0")}`;
}

export function durationToText(duration: number): string {
  const hours = Math.floor(duration / 1000 / 60 / 60);
  const minutes = (duration / 1000 / 60 / 60 - hours) * 60;

  return (
    (hours > 0 ? `${hours}h` : "") +
    (Math.floor(minutes) > 0 ? ` ${Math.floor(minutes)}m` : "")
  );
}

export function uuid() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0,
      v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Helper function to extract IMDB ID from Guid array
export const findImdbId = (guid?: Array<{ id: string }>): string | undefined => {
  if (!guid) return undefined;
  const imdbGuid = guid.find(g => g.id.startsWith('imdb://'));
  return imdbGuid ? imdbGuid.id.replace('imdb://', '') : undefined;
};

// Helper function to get backdrop from TMDB
export const getTmdbBackdrop = async (imdbId: string): Promise<string | undefined> => {
  const url = `https://api.themoviedb.org/3/find/${imdbId}?external_source=imdb_id`;
  const options = {
    method: 'GET',
    headers: {
      accept: 'application/json',
      Authorization: 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiI4NDUzN2ZiN2U0N2VlMDI2Y2VhMTMwN2NmZTc2MzkzOSIsIm5iZiI6MTcwMzI5NzIzNy45MjEsInN1YiI6IjY1ODY0MGQ1NWFiYTMyNjc1OWI5MDQwNiIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.LfkrBQFZDbQNF4AN-F1Z2o9YKLA9jRn4D42L9ooKcE4'
    }
  };

  try {
    const response = await fetch(url, options);
    const data = await response.json() as { movie_results?: Array<{ backdrop_path?: string }>; tv_results?: Array<{ backdrop_path?: string }> };
    const backdropPath = data.movie_results?.[0]?.backdrop_path || data.tv_results?.[0]?.backdrop_path;
    return backdropPath ? `https://image.tmdb.org/t/p/original${backdropPath}` : undefined;
  } catch (error) {
    console.error('Error fetching TMDB backdrop:', error);
    return undefined;
  }
};

// Helper function to get backdrop URL with fallback to TMDB
export const getBackdropUrl = async (item: { art?: string; Guid?: Array<{ id: string }> }): Promise<string | undefined> => {
  console.log("item from getBackdropUrl in utils:", item);
  if (item.art) return item.art;
    console.log(item.Guid);

  if (item.Guid) {
    const imdbId = findImdbId(item.Guid);
    if (imdbId) {
      return await getTmdbBackdrop(imdbId);
    }
  }
  
  return undefined;
};
