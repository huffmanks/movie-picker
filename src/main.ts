import { Movie, Selected, db, seedDatabase } from "./db";
import "./style.css";
import Fuse, { FuseResult } from "fuse.js";

function debounce(func: Function, delay: number) {
  let timeoutId: NodeJS.Timeout;
  return (...args: any[]) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(null, args), delay);
  };
}

document.addEventListener("DOMContentLoaded", async () => {
  await initializeDatabase();

  const { movies, fuse } = await fetchMovies();
  if (!fuse) return;

  const searchInput = document.getElementById("search") as HTMLInputElement;
  const genreFilter = document.getElementById("genreFilter") as HTMLSelectElement;
  const sortOptions = document.getElementById("sortOptions") as HTMLSelectElement;
  const bookmarkBtn = document.getElementById("bookmark-btn") as HTMLButtonElement;
  const resetBtn = document.getElementById("reset-btn") as HTMLButtonElement;
  const copyBtn = document.getElementById("copy-btn") as HTMLElement;

  searchInput.addEventListener(
    "input",
    debounce(() => filterMovies(movies, fuse, true), 100)
  );
  genreFilter.addEventListener("change", () => filterMovies(movies, fuse));
  sortOptions.addEventListener("change", () => filterMovies(movies, fuse));
  bookmarkBtn.addEventListener("click", toggleShowBookmarked);
  resetBtn.addEventListener("click", () => reset(movies));
  copyBtn.addEventListener("click", copyListText);
});

async function initializeDatabase() {
  if ((await db.movies.count()) === 0) await seedDatabase();
}

async function reset(movies: Movie[]) {
  const searchInput = document.getElementById("search") as HTMLInputElement;
  const genreFilter = document.getElementById("genreFilter") as HTMLSelectElement;
  const sortOptions = document.getElementById("sortOptions") as HTMLSelectElement;
  const bookmarkBtn = document.getElementById("bookmark-btn") as HTMLButtonElement;
  const movieCards = Array.from(document.querySelectorAll(".movie-card")) as HTMLDivElement[];

  movieCards.forEach((card) => card.classList.remove("selected"));

  searchInput.value = "";
  genreFilter.selectedIndex = 0;
  sortOptions.selectedIndex = 0;
  bookmarkBtn.disabled = true;

  await db.selected.clear();
  displayMovies(movies, []);
}

function copyListText() {
  console.log("happened");
  const listItems = Array.from(document.querySelectorAll("#selectedMoviesBox li")) as HTMLLIElement[];

  const textToCopy = Array.from(listItems)
    .map((li) => li.textContent)
    .join("\n");

  navigator.clipboard
    .writeText(textToCopy)
    .then(() => {
      console.log("Copy success");
    })
    .catch((err) => {
      console.error("Failed to copy text: ", err);
    });
}

async function fetchMovies() {
  try {
    const movies = (await db.movies.toArray()).sort((a, b) => a.title.localeCompare(b.title));
    const selectedMovies = await db.selected.toArray();
    const bookmarkBtn = document.getElementById("bookmark-btn") as HTMLButtonElement;

    bookmarkBtn.disabled = selectedMovies.length < 1;

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
  movies.map((movie) => createMovieCard(movieGrid, movie, selectedMovies));
  updateSelectedMoviesBox(selectedMovies);
}

function createMovieCard(movieGrid: HTMLDivElement, movie: Movie, selectedMovies: Selected[]) {
  const movieCard = document.createElement("div");
  movieCard.classList.add("movie-card");

  const isSelected = selectedMovies.some((selectedMovie) => selectedMovie.movieId === movie.id);
  if (isSelected) movieCard.classList.add("selected");

  movieCard.innerHTML = `<img src="${movie.image}" alt="${movie.title} poster" loading="lazy">`;
  movieCard.addEventListener("click", () => toggleMovieSelection(movieCard, movie.id, movie.title, movie.year));

  movieGrid.appendChild(movieCard);
}

async function toggleMovieSelection(movieCard: HTMLDivElement, movieId: string, movieTitle: string, movieYear: number) {
  movieCard.style.pointerEvents = "none";
  const selectedMovies = await db.selected.toArray();
  const isSelected = selectedMovies.some((selectedMovie) => selectedMovie.movieId === movieId);

  if (isSelected) {
    movieCard.classList.remove("selected");
    await db.selected.where("movieId").equals(movieId).delete();
  } else {
    movieCard.classList.add("selected");
    await db.selected.add({ movieId, title: movieTitle, year: movieYear });
  }

  updateSelectedMoviesBox(await db.selected.toArray());
  movieCard.style.pointerEvents = "auto";
}

async function updateSelectedMoviesBox(selectedMovies: Selected[]) {
  const selectedMoviesBox = document.getElementById("selectedMoviesBox") as HTMLDivElement;
  const bookmarkBtn = document.getElementById("bookmark-btn") as HTMLButtonElement;

  const isSelectedMovies = selectedMovies && selectedMovies.length > 0;

  bookmarkBtn.disabled = !isSelectedMovies;

  if (isSelectedMovies) {
    selectedMoviesBox.classList.add("show");
    selectedMoviesBox.innerHTML = `
      <div class="selected-header">
        <h3>Selected</h3>
        <button id="copy-btn">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 0 0-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 0 1-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H9.75" />
          </svg>
        </button>
      </div>
      <ul>
        ${selectedMovies.map((movie) => `<li>${movie.title} (${movie.year})</li>`).join("")}
      </ul>
    `;
  } else {
    selectedMoviesBox.classList.remove("show");
  }
}

async function toggleShowBookmarked() {
  const selectedMovies = await db.selected.toArray();
  const selectedMoviesBox = document.getElementById("selectedMoviesBox") as HTMLDivElement;
  const bookmarkBtn = document.getElementById("bookmark-btn") as HTMLButtonElement;

  bookmarkBtn.disabled = selectedMovies.length < 1;
  selectedMoviesBox.classList.toggle("show");
}

async function filterMovies(movies: Movie[], fuse: Fuse<Movie>, isSearch?: boolean) {
  const searchQuery = (document.getElementById("search") as HTMLInputElement).value.toLowerCase();
  const selectedGenre = (document.getElementById("genreFilter") as HTMLSelectElement).value;
  const sortOption = (document.getElementById("sortOptions") as HTMLSelectElement).value;

  let results: FuseResult<Movie>[] = searchQuery ? fuse.search(searchQuery) : movies.map((movie, index) => ({ item: movie, refIndex: index }));

  if (selectedGenre) {
    results = results.filter((result) => result.item.genre.includes(selectedGenre));
  }

  const sortOptionValue = isSearch ? "search" : sortOption;

  const sortedResults = sortResults(results, sortOptionValue);
  displayMovies(
    sortedResults.map((result) => result.item),
    await db.selected.toArray()
  );
}

function sortResults(results: FuseResult<Movie>[], sortOption: string): FuseResult<Movie>[] {
  return results.sort((a, b) => {
    switch (sortOption) {
      case "search":
        return a.score! - b.score!;
      case "title":
        return a.item.title.localeCompare(b.item.title);
      case "year":
        return b.item.year - a.item.year;
      case "rating":
        return b.item.rating - a.item.rating;
      default:
        return 0;
    }
  });
}
