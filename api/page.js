const DEFAULT_OWNER = "Zicc2005";
const DEFAULT_REPO = "createquatang";
const DEFAULT_BRANCH = "main";

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

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
      json(res, 400, { error: "Missing id" });
      return;
    }

    const path = `data/pages/${id}/config.json`;
    const data = await githubRequest(`/repos/${owner}/${repo}/contents/${encodeURIComponentPath(path)}?ref=${encodeURIComponent(branch)}`);
    json(res, 200, JSON.parse(decodeContent(data.content)));
  } catch (error) {
    json(res, 404, { error: error.message || "Not found" });
  }
};
