import { Movie, TvShow, Selected, db, seedDatabase } from "./db";
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

  const contentTypeToggle = document.getElementById("content-type-toggle") as HTMLSelectElement;
  let currentContentType = "movies";

  const { movies, tvShows, movieFuse, tvShowFuse } = await fetchContent();

  let content: Movie[] | TvShow[] = movies as Movie[];
  let fuse: Fuse<Movie> | Fuse<TvShow> | null = movieFuse as Fuse<Movie>;

  const searchInput = document.getElementById("search-input") as HTMLInputElement;
  const genreFilter = document.getElementById("genre-filter") as HTMLSelectElement;
  const sortOptions = document.getElementById("sort-options") as HTMLSelectElement;
  const bookmarkBtn = document.getElementById("bookmark-btn") as HTMLButtonElement;
  const scrollBtn = document.getElementById("scroll-btn") as HTMLButtonElement;
  const resetBtn = document.getElementById("reset-btn") as HTMLButtonElement;

  scrollBtn.addEventListener("click", scrollToTop);
  searchInput.addEventListener("focus", scrollToTop);
  searchInput.addEventListener(
    "input",
    debounceWithBlur(() => filterContent(content, fuse!, true), 100, 3000, searchInput)
  );
  genreFilter.addEventListener("change", () => filterContent(content, fuse!));
  sortOptions.addEventListener("change", () => filterContent(content, fuse!));
  bookmarkBtn.addEventListener("click", toggleShowBookmarked);
  resetBtn.addEventListener("click", () => reset(content));

  contentTypeToggle.addEventListener("change", async () => {
    currentContentType = contentTypeToggle.value;
    content = currentContentType === "movies" ? movies : tvShows;
    fuse = currentContentType === "movies" ? movieFuse : tvShowFuse;

    const pickerTitle = document.getElementById("picker-title") as HTMLHeadingElement;
    pickerTitle.textContent = currentContentType === "movies" ? "Movie Picker" : "TV Show Picker";

    populateGenres(content);

    await filterContent(content, fuse!);
  });
});

async function initializeDatabase() {
  if ((await db.movies.count()) === 0) await seedDatabase();
}

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function reset(content: Movie[] | TvShow[]) {
  const searchInput = document.getElementById("search-input") as HTMLInputElement;
  const genreFilter = document.getElementById("genre-filter") as HTMLSelectElement;
  const sortOptions = document.getElementById("sort-options") as HTMLSelectElement;
  const contentCards = Array.from(document.querySelectorAll(".content-card")) as HTMLDivElement[];

  contentCards.forEach((card) => card.classList.remove("selected"));

  searchInput.value = "";
  genreFilter.selectedIndex = 0;
  sortOptions.selectedIndex = 0;

  await db.selected.clear();
  displayContent(content, []);
}

function copyListText() {
  const copyBtn = document.getElementById("copy-btn") as HTMLButtonElement;
  const listItems = Array.from(document.querySelectorAll("#selected-box li")) as HTMLLIElement[];
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

async function fetchContent() {
  try {
    const movies = (await db.movies.toArray()).sort((a, b) => a.title.localeCompare(b.title));
    const tvShows = (await db.tvShows.toArray()).sort((a, b) => a.title.localeCompare(b.title));
    const selectedContent = await db.selected.toArray();

    const movieFuse = initFuse(movies);
    const tvShowFuse = initFuse(tvShows);

    populateGenres(movies);
    displayContent(movies, selectedContent);

    return { movies, tvShows, movieFuse, tvShowFuse };
  } catch (error) {
    console.error("Error fetching", error);
    return { movies: [], tvShows: [], movieFuse: null, tvShowFuse: null };
  }
}

function initFuse(content: Movie[] | TvShow[]) {
  const fuseOptions = {
    keys: [
      { name: "title", weight: 0.7 },
      { name: "description", weight: 0.2 },
      { name: "actors", weight: 0.1 },
      { name: "genre", weight: 0.1 },
    ],
    threshold: 0.3,
  };
  return new Fuse(content, fuseOptions);
}

function populateGenres(content: Movie[] | TvShow[]) {
  const genreFilter = document.getElementById("genre-filter") as HTMLSelectElement;
  const genres = [...new Set(content.flatMap((item) => item.genre))].sort();

  genreFilter.innerHTML = `<option value="">All Genres</option>`;

  genres.forEach((genre) => {
    const option = document.createElement("option");
    option.value = genre;
    option.textContent = genre;
    genreFilter.appendChild(option);
  });
}

async function displayContent(content: Movie[] | TvShow[], selectedContent: Selected[]) {
  const contentGrid = document.getElementById("content-grid") as HTMLDivElement;
  const resultCount = document.getElementById("result-count") as HTMLDivElement;

  contentGrid.innerHTML = "";
  content.map((content) => createContentCard(contentGrid, content, selectedContent));
  updateSelectedBox(selectedContent);

  resultCount.textContent = `Showing ${content.length} results`;
}

function createContentCard(contentGrid: HTMLDivElement, content: Movie | TvShow, selectedContent: Selected[]) {
  const contentCard = document.createElement("div");
  contentCard.classList.add("content-card");

  const isSelected = selectedContent.some((selectedItem) => selectedItem.refId === content.id);
  if (isSelected) contentCard.classList.add("selected");

  contentCard.innerHTML = `<img src="${content.image}" alt="${content.title} poster" loading="lazy">`;
  contentCard.addEventListener("click", () => toggleContentSelection(contentCard, content.id, content.title, content.year));

  contentGrid.appendChild(contentCard);
}

async function toggleContentSelection(contentCard: HTMLDivElement, contentId: string, contentTitle: string, contentYear: number) {
  contentCard.style.pointerEvents = "none";
  const selectedContent = await db.selected.toArray();
  const isSelected = selectedContent.some((selectedItem) => selectedItem.refId === contentId);

  if (isSelected) {
    contentCard.classList.remove("selected");
    await db.selected.where("refId").equals(contentId).delete();
  } else {
    contentCard.classList.add("selected");
    await db.selected.add({ refId: contentId, title: contentTitle, year: contentYear });
  }

  updateSelectedBox(await db.selected.toArray());
  contentCard.style.pointerEvents = "auto";
}

async function updateSelectedBox(selectedContent: Selected[]) {
  const selectedBox = document.getElementById("selected-box") as HTMLDivElement;

  const isSelectedContent = selectedContent && selectedContent.length > 0;

  if (isSelectedContent) {
    selectedBox.innerHTML = `
      <div class="selected-header">
        <h3>Selected</h3>
        <button id="copy-btn">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 0 0-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 0 1-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H9.75" />
          </svg>
        </button>
      </div>
      <ul>
        ${selectedContent.map((content) => `<li>${content.title} (${content.year})</li>`).join("")}
      </ul>
    `;

    const copyBtn = document.getElementById("copy-btn") as HTMLButtonElement;
    copyBtn.addEventListener("click", copyListText);
  } else {
    selectedBox.innerHTML = `<h3>Nothing selected</h3>`;
  }
}

async function toggleShowBookmarked() {
  const selectedBox = document.getElementById("selected-box") as HTMLDivElement;

  selectedBox.classList.toggle("show");
}

async function filterContent(content: Movie[] | TvShow[], fuse: Fuse<Movie | TvShow>, isSearch?: boolean) {
  const searchQuery = (document.getElementById("search-input") as HTMLInputElement).value.toLowerCase();
  const selectedGenre = (document.getElementById("genre-filter") as HTMLSelectElement).value;
  const sortOption = (document.getElementById("sort-options") as HTMLSelectElement).value;

  let results: FuseResult<Movie | TvShow>[] = searchQuery ? fuse.search(searchQuery) : content.map((item, index) => ({ item, refIndex: index }));

  if (selectedGenre) {
    results = results.filter((result) => result.item.genre.includes(selectedGenre));
  }

  const sortOptionValue = isSearch ? "search" : sortOption;

  const sortedResults = sortResults(results, sortOptionValue);
  displayContent(
    sortedResults.map((result) => result.item),
    await db.selected.toArray()
  );
}

function sortResults(results: FuseResult<Movie>[] | FuseResult<TvShow>[], sortOption: string): FuseResult<Movie>[] | FuseResult<TvShow>[] {
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
