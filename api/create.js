const DEFAULT_OWNER = "Zicc2005";
const DEFAULT_REPO = "createquatang";
const DEFAULT_BRANCH = "main";

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

function sanitizeName(value, fallback) {
  return String(value || fallback)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 90);
}

function extensionFrom(file, fallback) {
  const cleanName = sanitizeName(file && file.name, "");
  const match = cleanName.match(/\.([a-zA-Z0-9]+)$/);
  if (match) return match[1].toLowerCase();
  if (file && file.type) {
    const ext = file.type.split("/")[1];
    if (ext) return ext.replace("mpeg", "mp3").replace("jpeg", "jpg");
  }
  return fallback;
}

function parseDataUrl(file) {
  if (!file || !file.dataUrl) return null;
  const match = String(file.dataUrl).match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  return {
    mime: match[1],
    base64: match[2]
  };
}

async function githubRequest(path, options = {}) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error("Missing GITHUB_TOKEN env.");

  const response = await fetch(`https://api.github.com${path}`, {
    ...options,
    headers: {
      "Accept": "application/vnd.github+json",
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
      "User-Agent": "createquatang-vercel-api",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(options.headers || {})
    }
  });

  if (response.status === 404 && options.allowNotFound) return null;
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const message = data && data.message ? data.message : `GitHub API ${response.status}`;
    const hint = response.status === 404
      ? "GitHub trả 404. Kiểm tra GITHUB_TOKEN có quyền Contents Read and write với repo, GITHUB_OWNER/GITHUB_REPO đúng, và đã redeploy sau khi thêm env."
      : "";
    throw new Error([message, hint].filter(Boolean).join(" "));
  }
  return data;
}

async function getSha(owner, repo, path, branch) {
  const data = await githubRequest(`/repos/${owner}/${repo}/contents/${encodeURIComponentPath(path)}?ref=${encodeURIComponent(branch)}`, {
    method: "GET",
    allowNotFound: true
  });
  return data && data.sha;
}

async function putFile(owner, repo, branch, path, contentBase64, message) {
  const sha = await getSha(owner, repo, path, branch);
  const body = {
    message,
    content: contentBase64,
    branch
  };
  if (sha) body.sha = sha;

  await githubRequest(`/repos/${owner}/${repo}/contents/${encodeURIComponentPath(path)}`, {
    method: "PUT",
    body: JSON.stringify(body)
  });
}

function encodeURIComponentPath(path) {
  return path.split("/").map(encodeURIComponent).join("/");
}

function rawUrl(owner, repo, branch, path) {
  return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`;
}

async function storeUpload({ owner, repo, branch, id, folder, index, file, fallbackExt }) {
  const parsed = parseDataUrl(file);
  if (!parsed) return "";
  const ext = extensionFrom(file, fallbackExt);
  const filename = `${folder}-${String(index).padStart(2, "0")}.${ext}`;
  const path = `data/pages/${id}/assets/${filename}`;
  await putFile(owner, repo, branch, path, parsed.base64, `Add asset ${id}/${filename}`);
  return rawUrl(owner, repo, branch, path);
}

async function resolveAsset(context, value, folder, index, fallbackExt) {
  if (!value) return "";
  if (value.url) return value.url;
  if (value.file) {
    return storeUpload({
      ...context,
      folder,
      index,
      file: value.file,
      fallbackExt
    });
  }
  return "";
}

module.exports = async function handler(req, res) {
  if (req.method === "GET") {
    const owner = process.env.GITHUB_OWNER || DEFAULT_OWNER;
    const repo = process.env.GITHUB_REPO || DEFAULT_REPO;
    const branch = process.env.GITHUB_BRANCH || DEFAULT_BRANCH;
    json(res, 200, {
      ok: true,
      owner,
      repo,
      branch,
      hasGithubToken: Boolean(process.env.GITHUB_TOKEN),
      publicSiteUrl: process.env.PUBLIC_SITE_URL || null
    });
    return;
  }

  if (req.method !== "POST") {
    json(res, 405, { error: "Method not allowed" });
    return;
  }

  try {
    const owner = process.env.GITHUB_OWNER || DEFAULT_OWNER;
    const repo = process.env.GITHUB_REPO || DEFAULT_REPO;
    const branch = process.env.GITHUB_BRANCH || DEFAULT_BRANCH;
    const origin = process.env.PUBLIC_SITE_URL || `https://${req.headers.host}`;
    const input = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const id = sanitizeName(input.id, `gift-${Date.now()}`);
    const context = { owner, repo, branch, id };

    const gallery = [];
    for (let index = 0; index < (input.gallery || []).length; index += 1) {
      const url = await resolveAsset(context, input.gallery[index], "gallery", index + 1, "jpg");
      if (url) gallery.push(url);
    }

    const songs = [];
    for (let index = 0; index < (input.songs || []).length; index += 1) {
      const song = input.songs[index];
      const cover = await resolveAsset(context, song.cover, "song-cover", index + 1, "jpg");
      const src = await resolveAsset(context, song.src, "song", index + 1, "mp3");
      if (src) songs.push({ title: song.title || "Untitled", cover, src });
    }

    const giftVideo = await resolveAsset(context, input.gift && input.gift.video, "gift", 1, "mp4");
    const lockImage = await resolveAsset(context, input.lockImage, "pass", 1, "jpg");

    const config = {
      id,
      title: input.title || "Happy International Women's Day",
      pin: input.pin || "2005",
      hint: input.hint || "",
      lockImage: lockImage || "img/Anh Pass.jpg",
      letter: input.letter || "",
      gallery,
      songs,
      gift: {
        video: giftVideo,
        link: input.gift && input.gift.link ? input.gift.link : ""
      }
    };

    const configPath = `data/pages/${id}/config.json`;
    await putFile(
      owner,
      repo,
      branch,
      configPath,
      Buffer.from(JSON.stringify(config, null, 2), "utf8").toString("base64"),
      `Create gift page ${id}`
    );

    const url = `${origin.replace(/\/$/, "")}/src/index.html?id=${encodeURIComponent(id)}`;
    json(res, 200, {
      id,
      url,
      configUrl: rawUrl(owner, repo, branch, configPath)
    });
  } catch (error) {
    json(res, 500, { error: error.message || "Create failed" });
  }
};
