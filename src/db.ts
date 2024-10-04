import Dexie, { type EntityTable } from "dexie";
import movieData from "./movies.json";
import tvShowData from "./tv-shows.json";

const movieList: Movie[] = movieData as Movie[];
const tvShowList: TvShow[] = tvShowData as TvShow[];

interface Movie {
  id: string;
  title: string;
  year: number;
  description: string;
  image: string | null;
  runtime: number;
  premiered: string;
  genre: string[];
  tag: string[] | null;
  rating: number;
  actors: string[];
}

interface TvShow {
  id: string;
  title: string;
  year: number;
  description: string;
  image: string | null;
  runtime: number;
  premiered: string;
  genre: string[];
  tag: string[] | null;
  rating: number;
  actors: string[];
}

interface Selected {
  id: string;
  refId: string;
  title: string;
  year: number;
}

const db = new Dexie("MoviesDatabase") as Dexie & {
  movies: EntityTable<Movie, "id">;
  tvShows: EntityTable<TvShow, "id">;
  selected: EntityTable<Selected, "id">;
};

db.version(3).stores({
  movies: "id, title, year, description, image, runtime, premiered, genre, tag, rating, actors",
  tvShows: "id, title, year, description, image, runtime, premiered, genre, tag, rating, actors",
  selected: "++id, refId, title, year",
});

const seedMoviesDatabase = async () => {
  try {
    await db.movies.bulkPut(movieList);
    console.log("Movies seeded successfully");
  } catch (error) {
    console.error("Failed to seed movies to database:", error);
  }
};

const seedTvShowsDatabase = async () => {
  try {
    await db.tvShows.bulkPut(tvShowList);
    console.log("TV Shows seeded successfully");
  } catch (error) {
    console.error("Failed to seed TV Shows to database:", error);
  }
};

export type { Movie, TvShow, Selected };
export { db, seedMoviesDatabase, seedTvShowsDatabase };
