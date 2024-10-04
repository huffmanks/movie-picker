import { Movie, Selected, db, seedDatabase } from "./db";
import "./style.css";
import Fuse, { FuseResult } from "fuse.js";

function debounceWithBlur(func: Function, debounceDelay: number, blurDelay: number, blurElement?: HTMLInputElement) {
  let debounceTimeoutId: NodeJS.Timeout;
  let blurTimeoutId: NodeJS.Timeout;

  return (...args: any[]) => {
    clearTimeout(debounceTimeoutId);

    debounceTimeoutId = setTimeout(() => func.apply(null, args), debounceDelay);

    if (blurElement) {
      clearTimeout(blurTimeoutId);
      blurTimeoutId = setTimeout(() => blurElement.blur(), blurDelay);
    }
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
  const scrollBtn = document.getElementById("scroll-btn") as HTMLButtonElement;
  const resetBtn = document.getElementById("reset-btn") as HTMLButtonElement;

  scrollBtn.addEventListener("click", scrollToTop);
  searchInput.addEventListener("focus", scrollToTop);
  searchInput.addEventListener(
    "input",
    debounceWithBlur(() => filterMovies(movies, fuse, true), 100, 3000, searchInput)
  );
  genreFilter.addEventListener("change", () => filterMovies(movies, fuse));
  sortOptions.addEventListener("change", () => filterMovies(movies, fuse));
  bookmarkBtn.addEventListener("click", toggleShowBookmarked);
  resetBtn.addEventListener("click", () => reset(movies));
});

async function initializeDatabase() {
  if ((await db.movies.count()) === 0) await seedDatabase();
}

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function reset(movies: Movie[]) {
  const searchInput = document.getElementById("search") as HTMLInputElement;
  const genreFilter = document.getElementById("genreFilter") as HTMLSelectElement;
  const sortOptions = document.getElementById("sortOptions") as HTMLSelectElement;
  const movieCards = Array.from(document.querySelectorAll(".movie-card")) as HTMLDivElement[];

  movieCards.forEach((card) => card.classList.remove("selected"));

  searchInput.value = "";
  genreFilter.selectedIndex = 0;
  sortOptions.selectedIndex = 0;

  await db.selected.clear();
  displayMovies(movies, []);
}

function copyListText() {
  const copyBtn = document.getElementById("copy-btn") as HTMLButtonElement;
  const listItems = Array.from(document.querySelectorAll("#selectedMoviesBox li")) as HTMLLIElement[];
  copyBtn.disabled = true;

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

  copyBtn.disabled = false;
}

async function fetchMovies() {
  try {
    const movies = (await db.movies.toArray()).sort((a, b) => a.title.localeCompare(b.title));
    const selectedMovies = await db.selected.toArray();

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
  const resultCount = document.getElementById("resultCount") as HTMLDivElement;

  movieGrid.innerHTML = "";
  movies.map((movie) => createMovieCard(movieGrid, movie, selectedMovies));
  updateSelectedMoviesBox(selectedMovies);

  resultCount.textContent = `Showing ${movies.length} results`;
}

function createMovieCard(movieGrid: HTMLDivElement, movie: Movie, selectedMovies: Selected[]) {
  const movieCard = document.createElement("div");
  movieCard.classList.add("movie-card");

  const isSelected = selectedMovies.some((selectedMovie) => selectedMovie.refId === movie.id);
  if (isSelected) movieCard.classList.add("selected");

  movieCard.innerHTML = `<img src="${movie.image}" alt="${movie.title} poster" loading="lazy">`;
  movieCard.addEventListener("click", () => toggleMovieSelection(movieCard, movie.id, movie.title, movie.year));

  movieGrid.appendChild(movieCard);
}

async function toggleMovieSelection(movieCard: HTMLDivElement, movieId: string, movieTitle: string, movieYear: number) {
  movieCard.style.pointerEvents = "none";
  const selectedMovies = await db.selected.toArray();
  const isSelected = selectedMovies.some((selectedMovie) => selectedMovie.refId === movieId);

  if (isSelected) {
    movieCard.classList.remove("selected");
    await db.selected.where("refId").equals(movieId).delete();
  } else {
    movieCard.classList.add("selected");
    await db.selected.add({ refId: movieId, title: movieTitle, year: movieYear });
  }

  updateSelectedMoviesBox(await db.selected.toArray());
  movieCard.style.pointerEvents = "auto";
}

async function updateSelectedMoviesBox(selectedMovies: Selected[]) {
  const selectedMoviesBox = document.getElementById("selectedMoviesBox") as HTMLDivElement;

  const isSelectedMovies = selectedMovies && selectedMovies.length > 0;

  if (isSelectedMovies) {
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

    const copyBtn = document.getElementById("copy-btn") as HTMLButtonElement;
    copyBtn.addEventListener("click", copyListText);
  } else {
    selectedMoviesBox.innerHTML = `<h3>Nothing selected</h3>`;
  }
}

async function toggleShowBookmarked() {
  const selectedMoviesBox = document.getElementById("selectedMoviesBox") as HTMLDivElement;

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
