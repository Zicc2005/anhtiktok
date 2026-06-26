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
  return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${encodeURIComponentPath(path)}`;
}

function publicFileUrl(path) {
  return `/api/file?path=${encodeURIComponent(path)}`;
}

function versionedFileUrl(id, path) {
  return `${publicFileUrl(path)}&v=${encodeURIComponent(id)}`;
}

async function storeUpload({ owner, repo, branch, id, folder, index, file, fallbackExt, filename, origin }) {
  const parsed = parseDataUrl(file);
  if (!parsed) return "";
  const ext = extensionFrom(file, fallbackExt);
  const resolvedFilename = filename ? filename(ext) : `${folder}-${String(index).padStart(2, "0")}.${ext}`;
  const path = `data/pages/${id}/assets/${folder}/${resolvedFilename}`;
  await putFile(owner, repo, branch, path, parsed.base64, `Add asset ${id}/${folder}/${resolvedFilename}`);
  return versionedFileUrl(id, path);
}

async function resolveAsset(context, value, folder, index, fallbackExt, filename) {
  if (!value) return "";
  if (value.url) return value.url;
  if (value.file) {
    return storeUpload({
      ...context,
      folder,
      index,
      file: value.file,
      fallbackExt,
      filename,
      origin: context.origin
    });
  }
  return "";
}

function pageHtml(config) {
  const safeConfig = JSON.stringify(config).replace(/</g, "\\u003c");
  return `<!doctype html>
<html lang="vi">

<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(config.title || "Happy International Women's Day")}</title>
  <link rel="icon" type="image/png" href="https://i.postimg.cc/qvjz8QFW/Logo.png" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link
    href="https://fonts.googleapis.com/css2?family=Dancing+Script:wght@400..700&family=Playfair+Display:ital,wght@0,400..900;1,400..900&display=swap"
    rel="stylesheet" />
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css" />
  <link rel="stylesheet" href="/src/style.css" />
</head>

<body>
  <div class="lock-screen" id="lock-screen">
    <div class="lock-content">
      <div class="lock-image">
          <img id="lock-photo" alt="">
      </div>
      <div class="lock-form">
        <div class="lock-icon">
          <i class="fa-solid fa-heart"></i>
        </div>
        <div class="pass-dots" id="pass-dots"></div>
        <div class="numpad" id="numpad"></div>
        <div class="hint-box" id="hint-box">
          <span class="hint-icon">💡</span>
          <span class="hint-text" id="hint-text">...</span>
        </div>
      </div>
    </div>
  </div>

  <div class="container main-content-hidden" id="main-content">
    <div class="menu">
      <button class="menu-item" id="btn-music"><span class="icon"><img src="/src/img/asset/music.png" alt="Music" /></span><span>Music</span></button>
      <button class="menu-item" id="btn-letter"><span class="icon"><img src="/src/img/asset/letter.png" alt="Letter" /></span><span>Letter</span></button>
      <button class="menu-item" id="btn-image"><span class="icon"><img src="/src/img/asset/image.png" alt="Image" /></span><span>Image</span></button>
      <button class="menu-item" id="btn-gift"><span class="icon"><img src="/src/img/asset/gift.png" alt="Gift" /></span><span>Gift</span></button>
    </div>
  </div>

  <button class="reset-lock-btn" id="btn-reset-lock"><i class="fa-solid fa-lock"></i></button>

  <div class="overlay" id="letter-overlay">
    <div class="letter-modal">
      <button class="close-btn" id="close-letter"><i class="fa-solid fa-xmark"></i></button>
      <div class="letter-content"><div class="letter-body" id="letter-body"></div></div>
      <img src="https://i.pinimg.com/originals/4e/89/d3/4e89d3e4ec4b1f59b1664e880a875c65.gif" alt="Decoration" class="letter-gif" />
    </div>
  </div>

  <div class="overlay" id="music-overlay">
    <div class="music-modal">
      <button class="close-btn" id="close-music"><i class="fa-solid fa-xmark"></i></button>
      <div class="spotify-player">
        <div class="player-header"><img src="/src/img/asset/music.png" alt="Spotify" class="spotify-logo" /><span>Music Player</span></div>
        <div class="now-playing">
          <div class="song-info"><div class="album-art" id="album-art"><img src="" alt="Album Art" /></div><div class="song-details"><h3 id="song-title">Select a song</h3><p id="song-artist">Artist name</p></div></div>
          <div class="player-controls"><div class="progress-container"><span id="current-time">0:00</span><div class="progress-bar" id="progress-bar"><div class="progress" id="progress"></div></div><span id="duration">0:00</span></div><div class="control-buttons"><button class="ctrl-btn" id="prev-btn"><i class="fa-solid fa-backward-step"></i></button><button class="ctrl-btn play-pause" id="play-pause-btn"><i class="fa-solid fa-play"></i></button><button class="ctrl-btn" id="next-btn"><i class="fa-solid fa-forward-step"></i></button></div></div>
        </div>
        <div class="song-list" id="song-list"></div>
      </div>
    </div>
  </div>

  <div class="overlay" id="image-overlay">
    <div class="image-modal">
      <button class="close-btn" id="close-image"><i class="fa-solid fa-xmark"></i></button>
      <div class="gallery-container"><div class="gallery-row row-top" id="gallery-top"></div><div class="gallery-row row-bottom" id="gallery-bottom"></div></div>
      <div class="gallery-gif-wrapper top"><img src="https://i.pinimg.com/originals/3f/4e/d3/3f4ed3cb1539cb42dc93b78020a3ef55.gif" alt="Decoration" class="gallery-gif" /><div class="flying-text text-right">HAPPY INTERNATIONAL WOMEN'S DAY</div></div>
      <div class="gallery-gif-wrapper bottom"><div class="flying-text text-left">HAPPY INTERNATIONAL WOMEN'S DAY</div><img src="https://i.pinimg.com/originals/0f/f7/ac/0ff7acbadeffd1e41be9811d67e1697e.gif" alt="Decoration" class="gallery-gif" /></div>
    </div>
  </div>

  <div class="overlay" id="lightbox-overlay" style="z-index: 2000"><div class="lightbox-content"><button class="close-btn" id="close-lightbox"><i class="fa-solid fa-xmark"></i></button><img src="" alt="Full View" id="lightbox-img" /></div></div>
  <div class="overlay" id="gift-overlay"><div class="gift-modal" id="gift-modal-element"><button class="close-btn" id="close-gift"><i class="fa-solid fa-xmark"></i></button><button class="fullscreen-btn" id="fullscreen-gift"><i class="fa-solid fa-expand"></i></button><iframe src="" frameborder="0" class="gift-iframe"></iframe><div class="gift-direct" id="gift-direct" hidden><h2>Gift đã sẵn sàng</h2><p>Link này mở trực tiếp để tránh website bên ngoài chặn iframe.</p><a id="gift-direct-link" target="_blank" rel="noreferrer">Mở gift</a></div></div></div>

  <audio id="audio-player"></audio>
  <audio id="pop-sound" src="/src/pop.mp3"></audio>
  <script>window.GIFT_CONFIG = ${safeConfig};</script>
  <script src="/src/runtime.js"></script>
</body>

</html>
`;
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

module.exports = async function handler(req, res) {
  if (req.method === "GET") {
    const owner = process.env.GITHUB_OWNER || DEFAULT_OWNER;
    const repo = process.env.GITHUB_REPO || DEFAULT_REPO;
    const branch = process.env.GITHUB_BRANCH || DEFAULT_BRANCH;
    const check = req.query && req.query.check;

    if (check === "github" || check === "write") {
      const result = {
        ok: true,
        owner,
        repo,
        branch,
        hasGithubToken: Boolean(process.env.GITHUB_TOKEN),
        repoRead: false,
        branchRead: false,
        contentsWrite: false
      };

      try {
        await githubRequest(`/repos/${owner}/${repo}`, { method: "GET" });
        result.repoRead = true;
      } catch (error) {
        result.ok = false;
        result.repoReadError = error.message;
      }

      try {
        await githubRequest(`/repos/${owner}/${repo}/branches/${encodeURIComponent(branch)}`, { method: "GET" });
        result.branchRead = true;
      } catch (error) {
        result.ok = false;
        result.branchReadError = error.message;
      }

      if (check === "write") {
        try {
          await putFile(
            owner,
            repo,
            branch,
            "data/_healthcheck.json",
            Buffer.from(JSON.stringify({ checkedAt: new Date().toISOString() }), "utf8").toString("base64"),
            "Verify createquatang API write access"
          );
          result.contentsWrite = true;
        } catch (error) {
          result.ok = false;
          result.contentsWriteError = error.message;
        }
      }

      json(res, result.ok ? 200 : 500, result);
      return;
    }

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
    const pin = String(input.pin || "").trim();
    if (!/^\d{4}$/.test(pin)) {
      json(res, 400, { error: "Pass đăng nhập phải đúng 4 số." });
      return;
    }
    const context = { owner, repo, branch, id, origin };

    const gallery = [];
    for (let index = 0; index < (input.gallery || []).length; index += 1) {
      const url = await resolveAsset(
        context,
        input.gallery[index],
        "img",
        index + 1,
        "jpg",
        (ext) => `Anh (${index + 1}).${ext}`
      );
      if (url) gallery.push(url);
    }

    const songs = [];
    for (let index = 0; index < (input.songs || []).length; index += 1) {
      const song = input.songs[index];
      const cover = await resolveAsset(
        context,
        song.cover,
        "sound",
        index + 1,
        "jpg",
        (ext) => `Anh (${index + 1}).${ext}`
      );
      const src = await resolveAsset(
        context,
        song.src,
        "sound",
        index + 1,
        "mp3",
        (ext) => `${index + 1}.${ext}`
      );
      if (src) songs.push({ title: song.title || "Untitled", cover, src });
    }
    if (!songs.length && Array.isArray(input.defaultSongs)) {
      input.defaultSongs.forEach((song) => {
        if (song && song.src) songs.push({
          title: song.title || "Untitled",
          cover: song.cover || "",
          src: song.src
        });
      });
    }

    const giftVideo = await resolveAsset(
      context,
      input.gift && input.gift.video,
      "gift",
      1,
      "mp4",
      (ext) => `gift.${ext}`
    );
    const lockImage = await resolveAsset(
      context,
      input.lockImage,
      "img",
      0,
      "jpg",
      (ext) => `Anh Pass.${ext}`
    );

    const config = {
      id,
      title: input.title || "Happy International Women's Day",
      pin,
      hint: input.hint || "",
      lockImage: lockImage || "",
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

    const pagePath = `data/pages/${id}/index.html`;
    await putFile(
      owner,
      repo,
      branch,
      pagePath,
      Buffer.from(pageHtml(config), "utf8").toString("base64"),
      `Create static gift page ${id}`
    );

    const url = `${origin.replace(/\/$/, "")}/api/view?id=${encodeURIComponent(id)}&v=${Date.now()}`;
    json(res, 200, {
      id,
      url,
      configUrl: rawUrl(owner, repo, branch, configPath),
      pageUrl: rawUrl(owner, repo, branch, pagePath)
    });
  } catch (error) {
    json(res, 500, { error: error.message || "Create failed" });
  }
};
