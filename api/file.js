const DEFAULT_OWNER = "Zicc2005";
const DEFAULT_REPO = "createquatang";
const DEFAULT_BRANCH = "main";

const TYPES = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  mp3: "audio/mpeg",
  mp4: "video/mp4",
  webm: "video/webm"
};

function encodeURIComponentPath(path) {
  return path.split("/").map(encodeURIComponent).join("/");
}

async function githubRequest(path) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error("Missing GITHUB_TOKEN env.");

  const response = await fetch(`https://api.github.com${path}`, {
    headers: {
      "Accept": "application/vnd.github+json",
      "Authorization": `Bearer ${token}`,
      "User-Agent": "createquatang-vercel-api",
      "X-GitHub-Api-Version": "2022-11-28"
    }
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(data && data.message ? data.message : `GitHub API ${response.status}`);
  return data;
}

module.exports = async function handler(req, res) {
  try {
    const owner = process.env.GITHUB_OWNER || DEFAULT_OWNER;
    const repo = process.env.GITHUB_REPO || DEFAULT_REPO;
    const branch = process.env.GITHUB_BRANCH || DEFAULT_BRANCH;
    const path = String(req.query.path || "");
    if (!path.startsWith("data/pages/")) {
      res.statusCode = 400;
      res.end("Bad path");
      return;
    }

    const data = await githubRequest(`/repos/${owner}/${repo}/contents/${encodeURIComponentPath(path)}?ref=${encodeURIComponent(branch)}`);
    const ext = path.split(".").pop().toLowerCase();
    const buffer = Buffer.from(String(data.content || "").replace(/\n/g, ""), "base64");
    res.statusCode = 200;
    res.setHeader("Content-Type", TYPES[ext] || "application/octet-stream");
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.end(buffer);
  } catch (error) {
    res.statusCode = 404;
    res.end(error.message || "Not found");
  }
};
