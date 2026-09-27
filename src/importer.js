import { createHash } from "node:crypto";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const IMAGE_HOSTS = new Set(["bilder.hemnet.se"]);
export function listingURL(value) {
  let u;
  try {
    u = new URL(value);
  } catch {
    throw new Error("Enter a complete Hemnet listing URL.");
  }
  if (
    u.protocol !== "https:" ||
    !["www.hemnet.se", "hemnet.se"].includes(u.hostname) ||
    u.username ||
    u.password ||
    u.port ||
    !/^\/bostad\/[\w%-]+\/?$/.test(u.pathname)
  )
    throw new Error("Use an https://www.hemnet.se/bostad/ listing link.");
  return `https://www.hemnet.se${u.pathname}`;
}
export function imageURL(value) {
  let u;
  try {
    u = new URL(value);
  } catch {
    return null;
  }
  if (
    u.protocol !== "https:" ||
    !IMAGE_HOSTS.has(u.hostname) ||
    u.port ||
    u.username ||
    u.password ||
    !/^\/images\//.test(u.pathname) ||
    !/\.(jpe?g|png|webp)$/i.test(u.pathname)
  )
    return null;
  u.searchParams.set("width", "2048");
  u.searchParams.set("quality", "90");
  return u.href;
}
function decode(s) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\\u002[fF]/g, "/")
    .replace(/\\u0026/g, "&")
    .replace(/\\\//g, "/");
}
export function extractListing(html, url) {
  listingURL(url);
  html = decode(html);
  const unique = new Map();
  for (const raw of html.match(
    /https:\/\/bilder\.hemnet\.se\/images\/[^\s"'<>\\]+/g,
  ) || []) {
    const valid = imageURL(raw);
    if (valid) {
      const u = new URL(valid);
      unique.set(u.pathname, valid);
    }
  }
  const meta = (name) =>
    html.match(
      new RegExp(
        `<meta[^>]+(?:property|name)=["']${name}["'][^>]+content=["']([^"']*)`,
        "i",
      ),
    )?.[1] || "";
  const title =
    meta("og:title") ||
    html.match(/<title[^>]*>([^<]+)/i)?.[1] ||
    "Imported home";
  if (!unique.size)
    throw new Error(
      "No gallery images found. The listing may require browser access. Import your downloaded photos below.",
    );
  if (unique.size > 150)
    throw new Error(
      "More than 150 images found. Import a curated photo set instead.",
    );
  return {
    url: listingURL(url),
    title: title.slice(0, 200),
    description: meta("description").slice(0, 2000),
    imageURLs: [...unique.values()],
  };
}
export async function limitedFetch(
  url,
  { kind = "image", fetcher = fetch, maxBytes = 15 * 1024 * 1024 } = {},
) {
  const valid = kind === "listing" ? listingURL(url) : imageURL(url);
  if (!valid) throw new Error("Unsupported image host.");
  const response = await fetcher(valid, {
    redirect: "manual",
    signal: AbortSignal.timeout(45000),
    headers: {
      "User-Agent": "HemnetWalkthroughStudio/0.1 (personal local import)",
      Accept:
        kind === "listing" ? "text/html" : "image/jpeg,image/png,image/webp",
    },
  });
  if (response.status >= 300 && response.status < 400) {
    const target = new URL(response.headers.get("location"), valid).href;
    if (target === valid) throw new Error("Listing redirect loop.");
    throw new Error(
      "The source redirected. Open its final Hemnet listing URL, or import downloaded photos.",
    );
  }
  if (!response.ok)
    throw new Error(
      `Hemnet returned HTTP ${response.status}. Open the listing in your browser and import photos you are allowed to use. Access restrictions are not bypassed.`,
    );
  if (Number(response.headers.get("content-length")) > maxBytes)
    throw new Error("Source exceeds the download limit.");
  let length = 0;
  const parts = [];
  for await (const part of response.body) {
    length += part.length;
    if (length > maxBytes)
      throw new Error("Source exceeds the download limit.");
    parts.push(part);
  }
  return Buffer.concat(parts);
}
export function imageType(bytes) {
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return "jpeg";
  if (
    bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    return "png";
  if (
    bytes.toString("ascii", 0, 4) === "RIFF" &&
    bytes.toString("ascii", 8, 12) === "WEBP"
  )
    return "webp";
  throw new Error("Only JPEG, PNG and WebP image files are accepted.");
}
export async function savePhoto(folder, bytes, index, sourceURL = "") {
  if (bytes.length > 15 * 1024 * 1024 || bytes.length < 12)
    throw new Error("Photo must be under 15 MB.");
  const type = imageType(bytes),
    id = String(index).padStart(3, "0"),
    file = `${id}.${type === "jpeg" ? "jpg" : type}`;
  await mkdir(path.join(folder, "photos"), { recursive: true });
  await writeFile(path.join(folder, "photos", file), bytes, { mode: 0o600 });
  return {
    id,
    file,
    type,
    sourceURL,
    bytes: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    category: "unreviewed",
    selected: true,
  };
}
export async function importListing(
  url,
  folder,
  onProgress = () => {},
  fetcher = fetch,
) {
  const html = await limitedFetch(url, {
    kind: "listing",
    fetcher,
    maxBytes: 12 * 1024 * 1024,
  });
  const listing = extractListing(html.toString(), url),
    photos = [];
  let totalBytes = 0;
  for (const [i, image] of listing.imageURLs.entries()) {
    await onProgress(
      `Downloading photo ${i + 1} of ${listing.imageURLs.length}`,
      {
        title: listing.title,
        description: listing.description,
        photos,
        expectedPhotos: listing.imageURLs.length,
      },
    );
    const bytes = await limitedFetch(image, { fetcher });
    totalBytes += bytes.length;
    if (totalBytes > 300 * 1024 * 1024)
      throw new Error(
        "Gallery exceeds 300 MB. Previously downloaded photos are retained; upload a curated set.",
      );
    photos.push(await savePhoto(folder, bytes, i + 1, image));
  }
  return { ...listing, imageURLs: undefined, photos };
}
