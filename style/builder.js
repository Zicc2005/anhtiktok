const defaults = {
  songs: [
    { title: "C H Ú C", cover: "", src: "/src/sound/1.mp3" },
    { title: "V Â N", cover: "", src: "/src/sound/2.mp3" },
    { title: "L U Ô N", cover: "", src: "/src/sound/3.mp3" },
    { title: "X I N H", cover: "", src: "/src/sound/4.mp3" },
    { title: "Đ Ẹ P", cover: "", src: "/src/sound/5.mp3" }
  ]
};

const galleryList = document.getElementById("gallery-list");
const songList = document.getElementById("song-list");
const form = document.getElementById("builder-form");
const result = document.getElementById("result");
const resultLink = document.getElementById("result-link");
const openLink = document.getElementById("open-link");
const submitButton = form.querySelector('button[type="submit"]');

function escapeAttr(value) {
  return String(value || "").replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");
}

function makeId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

function readFile(input) {
  const file = input.files && input.files[0];
  if (!file) return Promise.resolve("");

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({
      name: file.name,
      type: file.type,
      dataUrl: reader.result
    });
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function addGalleryItem(src = "") {
  const card = document.createElement("div");
  card.className = "item-card";
  if (src) card.dataset.defaultSrc = src;
  card.innerHTML = `
    <div class="item-head">
      <strong>${src ? "Ảnh mặc định" : "Ảnh mới"}</strong>
      <span>${src ? "Có sẵn trong mẫu" : "Chưa chọn ảnh"}</span>
    </div>
    <label><span>Thay ảnh</span><input type="file" accept="image/*" data-role="gallery-file"></label>
    <details>
      <summary>Dùng link ảnh thay vì upload</summary>
      <input data-role="gallery-src" placeholder="https://...">
    </details>
    <button type="button" class="remove">Xóa</button>
  `;
  card.querySelector(".remove").addEventListener("click", () => card.remove());
  galleryList.appendChild(card);
}

function addSongItem(song = {}) {
  const card = document.createElement("div");
  card.className = "item-card song-card";
  if (song.cover) card.dataset.defaultCover = song.cover;
  if (song.src) card.dataset.defaultSrc = song.src;
  card.innerHTML = `
    <div class="item-head">
      <strong>${escapeAttr(song.title || "Bài mới")}</strong>
      <span>${song.src ? "Đang dùng nhạc mặc định" : "Chưa chọn mp3"}</span>
    </div>
    <label><span>Tên bài</span><input data-role="song-title" value="${escapeAttr(song.title || "")}"></label>
    <label><span>Ảnh bài nhạc</span><input type="file" accept="image/*" data-role="song-cover-file"></label>
    <label><span>File mp3</span><input type="file" accept="audio/*" data-role="song-src-file"></label>
    <details>
      <summary>Dùng link ảnh/mp3 thay vì upload</summary>
      <input data-role="song-cover" placeholder="URL ảnh cover">
      <input data-role="song-src" placeholder="URL mp3">
    </details>
    <button type="button" class="remove">Xóa</button>
  `;
  card.querySelector(".remove").addEventListener("click", () => card.remove());
  songList.appendChild(card);
}

async function collectGallery() {
  const cards = [...galleryList.querySelectorAll(".item-card")];
  const values = await Promise.all(cards.map(async (card) => {
    const uploaded = await readFile(card.querySelector('[data-role="gallery-file"]'));
    const typed = card.querySelector('[data-role="gallery-src"]').value.trim();
    return uploaded ? { file: uploaded } : { url: typed || card.dataset.defaultSrc || "" };
  }));
  return values.filter((value) => value.file || value.url);
}

async function collectSongs() {
  const cards = [...songList.querySelectorAll(".song-card")];
  const songs = await Promise.all(cards.map(async (card) => {
    const coverUpload = await readFile(card.querySelector('[data-role="song-cover-file"]'));
    const srcUpload = await readFile(card.querySelector('[data-role="song-src-file"]'));
    return {
      title: card.querySelector('[data-role="song-title"]').value.trim() || "Untitled",
      cover: coverUpload ? { file: coverUpload } : { url: card.querySelector('[data-role="song-cover"]').value.trim() || card.dataset.defaultCover || "" },
      src: srcUpload ? { file: srcUpload } : { url: card.querySelector('[data-role="song-src"]').value.trim() || card.dataset.defaultSrc || "" }
    };
  }));
  return songs.filter((song) => song.src.file || song.src.url);
}

function validateVideo(input) {
  const file = input.files && input.files[0];
  if (!file) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(video.src);
      if (video.duration > 60.5) {
        reject(new Error("Video gift dài hơn 1 phút."));
        return;
      }
      resolve();
    };
    video.onerror = () => reject(new Error("Không đọc được video gift."));
    video.src = URL.createObjectURL(file);
  });
}

const pinInput = document.getElementById("pin");
const pinError = document.getElementById("pin-error");

function validatePin(showErrorIfInvalid = true) {
  let val = pinInput.value.replace(/\D/g, "");
  if (val.length > 4) {
    val = val.slice(0, 4);
  }
  pinInput.value = val;
  if (val.length === 4) {
    pinInput.classList.remove("invalid");
    pinInput.classList.add("valid");
    pinError.textContent = "";
    pinError.style.display = "none";
  } else {
    pinInput.classList.remove("valid");
    if (showErrorIfInvalid && val.length > 0) {
      pinInput.classList.add("invalid");
      pinError.textContent = "Mật khẩu đăng nhập phải gồm đúng 4 chữ số.";
      pinError.style.display = "block";
    } else {
      pinInput.classList.remove("invalid");
      pinError.style.display = "none";
    }
  }
}

pinInput.addEventListener("input", () => validatePin(true));
validatePin(false);

document.getElementById("add-gallery").addEventListener("click", () => addGalleryItem());
document.getElementById("add-song").addEventListener("click", () => addSongItem());

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const giftVideoInput = document.getElementById("giftVideo");
  const pin = pinInput.value.trim();

  if (!/^\d{4}$/.test(pin)) {
    pinInput.classList.add("invalid");
    pinError.textContent = "Mật khẩu đăng nhập phải gồm đúng 4 chữ số.";
    pinError.style.display = "block";
    pinInput.focus();
    return;
  }

  try {
    await validateVideo(giftVideoInput);
  } catch (error) {
    alert(error.message);
    return;
  }

  const id = makeId();
  const lockImage = await readFile(document.getElementById("lockImage"));
  const giftVideo = await readFile(giftVideoInput);
  const payload = {
    id,
    title: document.getElementById("title").value.trim(),
    pin,
    hint: document.getElementById("hint").value.trim(),
    lockImage: lockImage ? { file: lockImage } : { url: "" },
    letter: document.getElementById("letter").value,
    gallery: await collectGallery(),
    songs: await collectSongs(),
    defaultSongs: defaults.songs,
    gift: {
      video: giftVideo ? { file: giftVideo } : { url: "" },
      link: document.getElementById("giftLink").value.trim()
    }
  };

  submitButton.disabled = true;
  submitButton.textContent = "Đang tạo...";

  try {
    const response = await fetch("/api/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const responseText = await response.text();
    let data = {};
    try {
      data = responseText ? JSON.parse(responseText) : {};
    } catch {
      data = { error: responseText || `HTTP ${response.status}` };
    }
    if (!response.ok) throw new Error(data.error || "Không tạo được link.");

    resultLink.value = data.url;
    openLink.href = data.url;
    result.classList.remove("hidden");
  } catch (error) {
    alert(error.message);
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Tạo link";
  }
});

document.getElementById("copy-link").addEventListener("click", async () => {
  await navigator.clipboard.writeText(resultLink.value);
});
