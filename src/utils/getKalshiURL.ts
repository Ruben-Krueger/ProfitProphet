// Slugify a string for the URL
function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/--+/g, "-");
}

// https://kalshi.com/markets/kxdebatefuenteskirk/fuentes-kirk-debate
export default function getKalshiURL(ticker: string, title: string) {
  const baseTicker = ticker.replace(/-\w+$/, "").toLowerCase();
  const titleSlug = slugify(title);
  return `https://kalshi.com/markets/${baseTicker}/${titleSlug}`;
}
