const DEFAULT_OWNER = "Zicc2005";
const DEFAULT_REPO = "createquatang";
const DEFAULT_BRANCH = "main";

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

function decodeContent(content) {
  return Buffer.from(String(content || "").replace(/\n/g, ""), "base64").toString("utf8");
}

module.exports = async function handler(req, res) {
  try {
    const owner = process.env.GITHUB_OWNER || DEFAULT_OWNER;
    const repo = process.env.GITHUB_REPO || DEFAULT_REPO;
    const branch = process.env.GITHUB_BRANCH || DEFAULT_BRANCH;
    const id = String(req.query.id || "").replace(/[^a-zA-Z0-9._-]/g, "");
    if (!id) {
      res.statusCode = 400;
      res.end("Missing id");
      return;
    }

    const path = `data/pages/${id}/index.html`;
    const data = await githubRequest(`/repos/${owner}/${repo}/contents/${encodeURIComponentPath(path)}?ref=${encodeURIComponent(branch)}`);
    res.statusCode = 200;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-store, max-age=0");
    res.end(decodeContent(data.content));
  } catch (error) {
    res.statusCode = 404;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.end(error.message || "Not found");
  }
};
