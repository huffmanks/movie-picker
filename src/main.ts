import { Movie, Selected, db, seedDatabase } from "./db";
import "./style.css";
import Fuse, { FuseResult } from "fuse.js";

function debounce(func: Function, delay: number) {
  let timeoutId: NodeJS.Timeout;
  return (...args: any[]) => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      func.apply(null, args);
    }, delay);
  };
}

document.addEventListener("DOMContentLoaded", async () => {
  await initializeDatabase();

  const { movies, fuse } = await fetchMovies();

  if (!fuse) return;

  (document.getElementById("search") as HTMLInputElement).addEventListener(
    "input",
    debounce(() => filterMovies(movies, fuse), 100)
  );
  (document.getElementById("genreFilter") as HTMLSelectElement).addEventListener("change", () => filterMovies(movies, fuse));
  (document.getElementById("sortOptions") as HTMLSelectElement).addEventListener("change", () => filterMovies(movies, fuse));

  (document.getElementById("bookmark-btn") as HTMLButtonElement).addEventListener("click", toggleShowBookmarked);
  (document.getElementById("reset-btn") as HTMLButtonElement).addEventListener("click", () => reset(movies));
});

async function initializeDatabase() {
  const moviesCount = await db.movies.count();
  if (moviesCount === 0) {
    await seedDatabase();
  }
}

async function reset(movies: Movie[]) {
  const searchInput = document.getElementById("search") as HTMLInputElement;
  const genreFilter = document.getElementById("genreFilter") as HTMLSelectElement;
  const sortOptions = document.getElementById("sortOptions") as HTMLSelectElement;
  const boomarkBtn = document.getElementById("bookmark-btn") as HTMLButtonElement;

  searchInput.value = "";
  genreFilter.selectedIndex = 0;
  sortOptions.selectedIndex = 0;
  boomarkBtn.disabled = true;

  await db.selected.clear();

  displayMovies(movies, []);
}

async function fetchMovies() {
  try {
    const movies = (await db.movies.toArray()).sort((a, b) => a.title.localeCompare(b.title));
    const selectedMovies = await db.selected.toArray();

    if (!selectedMovies || selectedMovies.length < 1) {
      const boomarkBtn = document.getElementById("bookmark-btn") as HTMLButtonElement;
      boomarkBtn.disabled = true;
    }

    const fuse = initFuse(movies);
    populateGenres(movies);
    displayMovies(movies, selectedMovies);

    return { movies, selectedMovies, fuse };
  } catch (error) {
    console.error("Error fetching movies:", error);
    return { movies: [], selectedMovies: [], fuse: null };
  }
}

function initFuse(movies: Movie[]) {
  const fuseOptions = {
    keys: [
      { name: "title", weight: 0.7 },
      { name: "description", weight: 0.2 },
      { name: "actors", weight: 0.1 },
      { name: "genre", weight: 0.1 },
    ],
    threshold: 0.3,
  };
  return new Fuse(movies, fuseOptions);
}

function populateGenres(movies: Movie[]) {
  const genreFilter = document.getElementById("genreFilter") as HTMLSelectElement;
  const genres = [...new Set(movies.flatMap((movie) => movie.genre))].sort();

  genres.forEach((genre) => {
    const option = document.createElement("option");
    option.value = genre;
    option.textContent = genre;
    genreFilter.appendChild(option);
  });
}

async function displayMovies(movies: Movie[], selectedMovies: Selected[]) {
  const movieGrid = document.getElementById("movieGrid") as HTMLDivElement;
  movieGrid.innerHTML = "";

  movies.forEach((movie) => {
    const movieCard = document.createElement("div");
    movieCard.classList.add("movie-card");

    const isSelected = selectedMovies.some((selectedMovie) => selectedMovie.movieId === movie.id);
    if (isSelected) movieCard.classList.add("selected");

    movieCard.innerHTML = `<img src="${movie.image}" alt="${movie.title} poster">`;
    movieCard.addEventListener("click", () => toggleMovieSelection(movieCard, movie));

    movieGrid.appendChild(movieCard);
  });

  updateSelectedMoviesBox(selectedMovies);
}

async function toggleMovieSelection(movieCard: HTMLDivElement, movie: Movie) {
  const selectedMovies = await db.selected.toArray();
  const isSelected = selectedMovies.some((selectedMovie) => selectedMovie.movieId === movie.id);

  if (isSelected) {
    movieCard.classList.remove("selected");
    await db.selected.where("movieId").equals(movie.id).delete();
  } else {
    movieCard.classList.add("selected");
    await db.selected.add({ movieId: movie.id, title: movie.title });
  }

  const updatedSelectedMovies = await db.selected.toArray();

  if (!updatedSelectedMovies || updatedSelectedMovies.length < 1) {
    const boomarkBtn = document.getElementById("bookmark-btn") as HTMLButtonElement;
    boomarkBtn.disabled = true;
  }
  updateSelectedMoviesBox(updatedSelectedMovies);
}

async function updateSelectedMoviesBox(selectedMovies: Selected[]) {
  const selectedMoviesBox = document.getElementById("selectedMoviesBox") as HTMLDivElement;

  if (selectedMovies.length > 0) {
    selectedMoviesBox.classList.add("show");
    selectedMoviesBox.innerHTML = `
      <h3>Selected Movies:</h3>
      <ul>
        ${selectedMovies.map((movie) => `<li>${movie.title}</li>`).join("")}
      </ul>
    `;
  } else {
    selectedMoviesBox.classList.remove("show");
  }
}

async function toggleShowBookmarked() {
  const selectedMovies = await db.selected.toArray();
  const selectedMoviesBox = document.getElementById("selectedMoviesBox") as HTMLDivElement;
  const boomarkBtn = document.getElementById("bookmark-btn") as HTMLButtonElement;

  if (selectedMovies.length > 0) {
    boomarkBtn.disabled = false;
    selectedMoviesBox.classList.toggle("show");
  } else {
    boomarkBtn.disabled = true;
    selectedMoviesBox.classList.remove("show");
  }
}

async function filterMovies(movies: Movie[], fuse: Fuse<Movie>) {
  const searchQuery = (document.getElementById("search") as HTMLInputElement).value.toLowerCase();
  const selectedGenre = (document.getElementById("genreFilter") as HTMLSelectElement).value;
  const sortOption = (document.getElementById("sortOptions") as HTMLSelectElement).value;

  let results: FuseResult<Movie>[] = [];

  // Step 1: Search Filtering
  if (searchQuery) {
    results = fuse.search(searchQuery);
  }

  // Step 2: If no search query, just return all movies (optional)
  if (results.length === 0 && !searchQuery) {
    results = movies.map((movie, index) => ({ item: movie, refIndex: index })); // Wrap movies in FuseResult format
  }

  // Step 3: Genre Filtering
  if (selectedGenre) {
    results = results.filter((result) => result.item.genre.includes(selectedGenre));
  }

  // Step 4: Sort based on Fuse ranking
  if (searchQuery) {
    results.sort((a, b) => a.score! - b.score!);
  } else {
    results = sortResults(
      results.map((result) => result.item),
      sortOption
    ).map((movie, index) => ({
      item: movie,
      refIndex: index,
    }));
  }

  displayMovies(
    results.map((result) => result.item),
    await db.selected.toArray()
  );
}

function sortResults(movies: Movie[], sortOption: string): Movie[] {
  switch (sortOption) {
    case "title":
      return movies.sort((a, b) => a.title.localeCompare(b.title));
    case "year":
      return movies.sort((a, b) => b.year - a.year);
    case "rating":
      return movies.sort((a, b) => b.rating - a.rating);
    default:
      return movies;
  }
}

// async function filterMovies(movies: Movie[], fuse: Fuse<Movie>) {
//   const searchQuery = (document.getElementById("search") as HTMLInputElement).value.toLowerCase();
//   const selectedGenre = (document.getElementById("genreFilter") as HTMLSelectElement).value;
//   const sortOption = (document.getElementById("sortOptions") as HTMLSelectElement).value;

//   let results = [...movies];

//   if (searchQuery) {
//     const fuseResults = fuse.search(searchQuery);
//     results = fuseResults.map((result) => result.item);
//   }

//   if (selectedGenre) {
//     results = results.filter((movie) => movie.genre.includes(selectedGenre));
//   }

//   if (sortOption === "title") {
//     results.sort((a, b) => a.title.localeCompare(b.title));
//   } else if (sortOption === "year") {
//     results.sort((a, b) => b.year - a.year);
//   } else if (sortOption === "rating") {
//     results.sort((a, b) => b.rating - a.rating);
//   }

//   displayMovies(results, await db.selected.toArray());
// }
