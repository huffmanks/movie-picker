import Dexie, { type EntityTable } from "dexie";
import movieData from "./movies.json";

const movieList: Movie[] = movieData as Movie[];

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

interface Selected {
  id: string;
  movieId: string;
  title: string;
  year: number;
}

const db = new Dexie("MoviesDatabase") as Dexie & {
  movies: EntityTable<Movie, "id">;
  selected: EntityTable<Selected, "id">;
};

db.version(1).stores({
  movies: "id, title, year, description, image, runtime, premiered, genre, tag, rating, actors",
  selected: "++id, movieId, title, year",
});

const seedDatabase = async () => {
  try {
    await db.movies.bulkPut(movieList);
    console.log("Database seeded successfully");
  } catch (error) {
    console.error("Failed to seed database:", error);
  }
};

export type { Movie, Selected };
export { db, seedDatabase };
