import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import xml2js from "xml2js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const nfosDir = path.join(__dirname, "public", "tv-nfos");
const outputJsonPath = path.join(__dirname, "src", "tv-shows.json");
const logFilePath = path.join(__dirname, "failed_downloads.txt");

interface TvShow {
  id: string;
  title: string;
  year: number;
  description: string;
  image: string;
  runtime: number;
  premiered: string;
  genre: string[];
  tag: string[] | null;
  rating: number;
  actors: string[];
}

interface JsonData {
  tvshow: {
    imdbid: string[];
    title: string[];
    year: string[];
    plot: string[];
    thumb: [
      {
        _: string;
      }
    ];
    runtime: string[];
    premiered: string[];
    genre: string[];
    tag?: string[];
    ratings: {
      rating: {
        value: string[];
      }[];
    }[];
    actor: {
      name: string[];
    }[];
  };
}

const parseXmlToJson = (xml: string) => {
  return new Promise((resolve, reject) => {
    const parser = new xml2js.Parser();
    parser.parseString(xml, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const logFailedDownload = (title: string, year: number, errorMessage: string) => {
  const logMessage = `${title} (${year}) - ${errorMessage})\n`;
  fs.appendFileSync(logFilePath, logMessage, "utf-8");
};

const sanitizeTitle = (title: string): string => {
  // Normalize the title to decompose accented characters into their base characters
  const normalizedTitle = title.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  // Replace forward slashes (/) and colons (:) with hyphens (-)
  const replacedTitle = normalizedTitle.replace(/[/:]/g, "-");

  // Remove any characters that are not alphanumeric, spaces, hyphens, or underscores
  const sanitizedTitle = replacedTitle.replace(/[^\w\s-_]/g, "");

  return sanitizedTitle;
};

const replaceImageUrl = (url: string): string => {
  return url.replace("/original/", "/w220_and_h330_face/");
};

const downloadImage = async (url: string, outputPath: string, title: string, year: number) => {
  try {
    const response = await fetch(url);
    const contentType = response.headers.get("content-type");

    if (!contentType || !contentType.startsWith("image/jpeg")) {
      throw new Error(`Content is not an image. Content-Type: ${contentType}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    fs.writeFileSync(outputPath, buffer);
  } catch (error) {
    console.error(`ERROR: ${title} (${year}) - ${error.message}`);
    logFailedDownload(title, year, error.message);
  }
};

const processNfoFiles = async () => {
  const tvShows: TvShow[] = [];

  const nfoFiles = fs.readdirSync(nfosDir).filter((file) => file.endsWith(".nfo"));

  for (const nfoFile of nfoFiles) {
    const filePath = path.join(nfosDir, nfoFile);

    const xmlData = fs.readFileSync(filePath, "utf-8");
    const jsonData = (await parseXmlToJson(xmlData)) as JsonData;

    console.log(jsonData.tvshow.title[0]);

    const id = jsonData.tvshow.imdbid[0];
    const title = jsonData.tvshow.title[0];
    const safeTitle = sanitizeTitle(title);
    const year = Number(jsonData.tvshow.year[0]);
    const description = jsonData.tvshow.plot[0];
    const runtime = Number(jsonData.tvshow.runtime[0]);
    const premiered = jsonData.tvshow.premiered[0];
    const genre = jsonData.tvshow.genre;
    const tag = jsonData.tvshow.tag || null;
    const rating = Number(jsonData.tvshow.ratings[0].rating[0].value[0]);
    const actors = jsonData.tvshow.actor?.map((item) => item.name[0]);

    const imageName = `${safeTitle} (${year}).jpg`;
    const imagePath = path.join(__dirname, "public", "images", "tv-shows", imageName);

    const imageUrl = replaceImageUrl(jsonData.tvshow.thumb[0]._);

    await downloadImage(imageUrl, imagePath, safeTitle, year);

    await sleep(50);

    const tvShowData = {
      id,
      title,
      year,
      description,
      image: `/images/tv-shows/${imageName}`,
      runtime,
      premiered,
      genre,
      tag,
      rating,
      actors,
    };

    tvShows.push(tvShowData);
  }

  fs.writeFileSync(outputJsonPath, JSON.stringify(tvShows, null, 2));

  console.log("TV Shows JSON generated successfully!");
};

await processNfoFiles();
