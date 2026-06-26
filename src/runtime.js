const defaults = {
  title: "Happy International Women's Day",
  pin: "2005",
  hint: "Sự giống nhau của chúng ta 🎂",
  lockImage: "",
  letter: `Happy 8/3 muộn nha ✨

Chúc cho lúc nào cũng vui vẻ, xinh xắn và tràn đầy năng lượng tích cực
Lúc nào cũng cười nhiều một chút, vì nụ cười của Vân làm mọi thứ dễ thương hơn hẳn 😆

Cứ là chính mình thôi,
miễn là luôn hạnh phúc, học tốt và tận hưởng từng ngày thật vui nha 🌸`,
  gallery: [],
  songs: [
    { title: "C H Ú C", cover: "", src: "sound/1.mp3" },
    { title: "V Â N", cover: "", src: "sound/2.mp3" },
    { title: "L U Ô N", cover: "", src: "sound/3.mp3" },
    { title: "X I N H", cover: "", src: "sound/4.mp3" },
    { title: "Đ Ẹ P", cover: "", src: "sound/5.mp3" }
  ],
  gift: { video: "gift/gift.mp4", link: "" }
};

const id = new URLSearchParams(location.search).get("id");
let config = window.GIFT_CONFIG ? { ...window.GIFT_CONFIG } : (id ? {} : { ...defaults });

let enteredPin = "";
let songIndex = 0;
let isPlaying = false;
let typingTimer = null;
let paragraphIndex = 0;
let charIndex = 0;
let letterText = [];
let wasPlayingBeforeGift = false;

const lockScreen = document.getElementById("lock-screen");
const mainContent = document.getElementById("main-content");
const passDots = document.getElementById("pass-dots");
const numpad = document.getElementById("numpad");
const letterOverlay = document.getElementById("letter-overlay");
const letterBody = document.getElementById("letter-body");
const musicOverlay = document.getElementById("music-overlay");
const audioPlayer = document.getElementById("audio-player");
const playPauseBtn = document.getElementById("play-pause-btn");
const progressBar = document.getElementById("progress-bar");
const progress = document.getElementById("progress");
const currentTimeEl = document.getElementById("current-time");
const durationEl = document.getElementById("duration");
const songTitle = document.getElementById("song-title");
const songArtist = document.getElementById("song-artist");
const albumArt = document.querySelector("#album-art img");
const songListContainer = document.getElementById("song-list");
const imageOverlay = document.getElementById("image-overlay");
const galleryTop = document.getElementById("gallery-top");
const galleryBottom = document.getElementById("gallery-bottom");
const lightboxOverlay = document.getElementById("lightbox-overlay");
const lightboxImg = document.getElementById("lightbox-img");
const giftOverlay = document.getElementById("gift-overlay");
const giftIframe = document.querySelector(".gift-iframe");
const giftDirect = document.getElementById("gift-direct");
const giftDirectLink = document.getElementById("gift-direct-link");
const giftModalElement = document.getElementById("gift-modal-element");
const fullscreenGiftBtn = document.getElementById("fullscreen-gift");
const popSound = document.getElementById("pop-sound");

async function loadConfig() {
  if (window.GIFT_CONFIG) return;
  if (!id) return;
  const url = `/api/page?id=${encodeURIComponent(id)}`;
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const response = await fetch(`${url}&t=${Date.now()}`, { cache: "no-store" });
    if (response.ok) {
      config = await response.json();
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 900));
  }
  throw new Error("Không tải được dữ liệu trang quà từ GitHub. Thử refresh lại sau vài giây.");
}

function normalizeConfig() {
  if (!Array.isArray(config.gallery)) config.gallery = id ? [] : defaults.gallery;
  if (!Array.isArray(config.songs)) config.songs = id ? [] : defaults.songs;
  if (!config.gift) config.gift = id ? { video: "", link: "" } : defaults.gift;
  config.lockImage = normalizeAssetUrl(config.lockImage || (id ? "" : defaults.lockImage));
  config.gallery = config.gallery.map(normalizeAssetUrl).filter(Boolean);
  config.songs = config.songs.map((song) => ({
    ...song,
    cover: normalizeAssetUrl(song.cover),
    src: normalizeAssetUrl(song.src)
  })).filter((song) => song.src);
  config.gift = {
    ...config.gift,
    video: normalizeAssetUrl(config.gift.video)
  };
  letterText = String(config.letter || defaults.letter).split(/\n\s*\n/).map((part) => part.trim()).filter(Boolean);
  document.title = config.title || defaults.title;
  const lockPhoto = document.getElementById("lock-photo");
  if (config.lockImage) lockPhoto.src = config.lockImage;
  else lockPhoto.removeAttribute("src");
  document.getElementById("hint-text").textContent = config.hint || "";
}

function normalizeAssetUrl(value) {
  const url = String(value || "");
  const marker = "/createquatang/main/";
  if (url.includes("raw.githubusercontent.com/Zicc2005/createquatang/main/")) {
    const path = decodeURIComponent(url.slice(url.indexOf(marker) + marker.length));
    return `/api/file?path=${encodeURIComponent(path)}&v=${encodeURIComponent(id || Date.now())}`;
  }
  if (url.startsWith("/api/file?") && id && !new URL(url, location.href).searchParams.has("v")) {
    return `${url}&v=${encodeURIComponent(id)}`;
  }
  return url;
}

function buildNumpad() {
  passDots.innerHTML = "";
  for (let index = 0; index < String(config.pin).length; index += 1) {
    const dot = document.createElement("div");
    dot.className = "dot";
    passDots.appendChild(dot);
  }

  ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "delete"].forEach((value) => {
    const button = document.createElement("button");
    button.className = value ? "num-btn" : "num-btn blank";
    button.type = "button";
    if (value === "delete") {
      button.classList.add("delete-btn");
      button.innerHTML = '<i class="fa-solid fa-delete-left"></i>';
      button.addEventListener("click", deleteLastDigit);
    } else if (value) {
      button.dataset.value = value;
      button.textContent = value;
      button.addEventListener("click", () => handleInput(value));
    }
    numpad.appendChild(button);
  });
}

function updateDots() {
  [...passDots.children].forEach((dot, index) => {
    dot.classList.toggle("active", index < enteredPin.length);
  });
}

function handleInput(value) {
  if (lockScreen.classList.contains("unlocked")) return;
  if (enteredPin.length >= String(config.pin).length) return;
  enteredPin += value;
  updateDots();
  if (enteredPin.length === String(config.pin).length) setTimeout(checkPin, 280);
}

function checkPin() {
  if (enteredPin === String(config.pin)) unlock();
  else fail();
}

function unlock() {
  lockScreen.classList.add("unlocked");
  mainContent.classList.remove("main-content-hidden");
  mainContent.classList.add("main-content-visible");
  enteredPin = "";
  updateDots();
}

function fail() {
  const lockContent = document.querySelector(".lock-content");
  lockContent.classList.add("shake");
  if (navigator.vibrate) navigator.vibrate(200);
  setTimeout(() => {
    lockContent.classList.remove("shake");
    enteredPin = "";
    updateDots();
  }, 500);
}

function deleteLastDigit() {
  enteredPin = enteredPin.slice(0, -1);
  updateDots();
}

function createHeart() {
  const heart = document.createElement("div");
  heart.className = "heart";
  if (Math.random() > 0.55) {
    const img = document.createElement("img");
    img.src = [
      "https://i.pinimg.com/originals/88/23/82/882382f97862c72e60fc06822e36eb55.gif",
      "https://i.pinimg.com/originals/b9/67/4f/b9674f3f995aba177250894d57f42bbf.gif",
      "https://i.pinimg.com/originals/b6/6b/1b/b66b1bfe70a9ad4f69dea3b620011222.gif"
    ][Math.floor(Math.random() * 3)];
    img.style.width = `${30 + Math.random() * 30}px`;
    img.style.height = "auto";
    heart.appendChild(img);
  } else {
    heart.textContent = ["❤", "💖", "💗", "💓", "💕", "🌸"][Math.floor(Math.random() * 6)];
    heart.style.fontSize = `${12 + Math.random() * 22}px`;
  }
  heart.style.left = `${Math.random() * 100}%`;
  heart.style.animationDuration = `${3 + Math.random() * 3}s`;
  heart.style.opacity = `${0.5 + Math.random() * 0.5}`;
  document.body.appendChild(heart);
  setTimeout(() => heart.remove(), 6200);
}

function typeWriter() {
  if (paragraphIndex >= letterText.length) return;
  let paragraph = letterBody.lastElementChild;
  if (!paragraph || charIndex === 0) {
    paragraph = document.createElement("p");
    if (paragraphIndex === letterText.length - 1) paragraph.classList.add("letter-footer");
    letterBody.appendChild(paragraph);
  }
  paragraph.textContent += letterText[paragraphIndex][charIndex] || "";
  charIndex += 1;
  letterBody.scrollTop = letterBody.scrollHeight;
  if (charIndex < letterText[paragraphIndex].length) typingTimer = setTimeout(typeWriter, 30);
  else {
    paragraphIndex += 1;
    charIndex = 0;
    typingTimer = setTimeout(typeWriter, 500);
  }
}

function resetLetter(onlyIfUnfinished = true) {
  clearTimeout(typingTimer);
  if (!onlyIfUnfinished || paragraphIndex < letterText.length) {
    paragraphIndex = 0;
    charIndex = 0;
    letterBody.innerHTML = "";
  }
}

function loadSong(song) {
  if (!song) return;
  audioPlayer.src = song.src;
  if (song.cover) albumArt.src = song.cover;
  else albumArt.removeAttribute("src");
  songTitle.textContent = song.title;
  songArtist.textContent = "For you";
  updateSongListUI();
}

function renderSongList() {
  songListContainer.innerHTML = "";
  config.songs.forEach((song, index) => {
    const item = document.createElement("div");
    item.className = "song-item";
    item.innerHTML = `
      <img src="${song.cover}" alt="">
      <div class="song-item-info">
        <span class="song-item-title"></span>
        <span class="song-item-artist">For you</span>
      </div>
    `;
    item.querySelector(".song-item-title").textContent = song.title;
    item.addEventListener("click", () => {
      songIndex = index;
      loadSong(config.songs[songIndex]);
      playSong();
    });
    songListContainer.appendChild(item);
  });
}

function updateSongListUI() {
  [...songListContainer.children].forEach((item, index) => {
    item.classList.toggle("active", index === songIndex);
  });
}

function playSong() {
  if (!audioPlayer.src) return;
  isPlaying = true;
  playPauseBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';
  audioPlayer.play().catch(() => {});
}

function pauseSong() {
  isPlaying = false;
  playPauseBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
  audioPlayer.pause();
}

function prevSong() {
  if (!config.songs.length) return;
  songIndex = (songIndex - 1 + config.songs.length) % config.songs.length;
  loadSong(config.songs[songIndex]);
  playSong();
}

function nextSong() {
  if (!config.songs.length) return;
  songIndex = (songIndex + 1) % config.songs.length;
  loadSong(config.songs[songIndex]);
  playSong();
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return "0:00";
  const minutes = Math.floor(seconds / 60);
  const rest = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${rest}`;
}

function updateProgress() {
  const percent = audioPlayer.duration ? (audioPlayer.currentTime / audioPlayer.duration) * 100 : 0;
  progress.style.width = `${percent}%`;
  currentTimeEl.textContent = formatTime(audioPlayer.currentTime);
  durationEl.textContent = formatTime(audioPlayer.duration);
}

function setProgress(event) {
  const width = progressBar.clientWidth;
  const clickX = event.offsetX;
  if (audioPlayer.duration) audioPlayer.currentTime = (clickX / width) * audioPlayer.duration;
}

function populateGallery() {
  galleryTop.innerHTML = "";
  galleryBottom.innerHTML = "";
  const splitAt = Math.ceil(config.gallery.length * 0.64);
  const top = config.gallery.slice(0, splitAt);
  const bottom = config.gallery.slice(splitAt);

  [...top, ...top].forEach((src) => galleryTop.appendChild(createGalleryImage(src)));
  [...bottom, ...bottom].forEach((src) => galleryBottom.appendChild(createGalleryImage(src)));
}

function createGalleryImage(src) {
  const wrapper = document.createElement("div");
  wrapper.className = "gallery-img-wrap";
  const img = document.createElement("img");
  img.src = src;
  img.loading = "eager";
  wrapper.appendChild(img);
  wrapper.addEventListener("click", (event) => {
    event.preventDefault();
    openLightbox(src);
  });
  return wrapper;
}

function openLightbox(src) {
  lightboxImg.src = src;
  lightboxOverlay.classList.add("active");
}

function normalizeUrl(value) {
  const trimmed = String(value || "").trim();
  if (/^(https?:)?\/\//i.test(trimmed) || /^(mailto|tel):/i.test(trimmed)) return trimmed;
  return new URL(trimmed, window.location.href).toString();
}

function openGift() {
  if (config.gift.link) {
    window.open(normalizeUrl(config.gift.link), "_blank", "noopener,noreferrer");
    return;
  }

  giftOverlay.classList.add("active");
  if (!audioPlayer.paused) {
    wasPlayingBeforeGift = true;
    audioPlayer.pause();
  }

  giftDirect.hidden = true;
  giftIframe.hidden = false;
  const video = config.gift.video || defaults.gift.video;
  giftIframe.src = video === defaults.gift.video ? "gift/gift.html" : video;
}

function closeGiftCleanup() {
  giftOverlay.classList.remove("active");
  giftIframe.src = "";
  if (wasPlayingBeforeGift) {
    audioPlayer.play().catch(() => {});
    wasPlayingBeforeGift = false;
  }
}

document.getElementById("btn-letter").addEventListener("click", () => {
  letterOverlay.classList.add("active");
  if (paragraphIndex === 0 && charIndex === 0 && !letterBody.textContent) typingTimer = setTimeout(typeWriter, 500);
});
document.getElementById("close-letter").addEventListener("click", () => {
  letterOverlay.classList.remove("active");
  resetLetter(true);
});

document.getElementById("btn-music").addEventListener("click", () => musicOverlay.classList.add("active"));
document.getElementById("close-music").addEventListener("click", () => musicOverlay.classList.remove("active"));
playPauseBtn.addEventListener("click", () => (isPlaying ? pauseSong() : playSong()));
document.getElementById("prev-btn").addEventListener("click", prevSong);
document.getElementById("next-btn").addEventListener("click", nextSong);
audioPlayer.addEventListener("timeupdate", updateProgress);
audioPlayer.addEventListener("ended", nextSong);
progressBar.addEventListener("click", setProgress);

document.getElementById("btn-image").addEventListener("click", () => {
  populateGallery();
  imageOverlay.classList.add("active");
});
document.getElementById("close-image").addEventListener("click", () => imageOverlay.classList.remove("active"));
document.getElementById("close-lightbox").addEventListener("click", () => lightboxOverlay.classList.remove("active"));
lightboxOverlay.addEventListener("click", (event) => {
  if (event.target === lightboxOverlay) lightboxOverlay.classList.remove("active");
});

document.getElementById("btn-gift").addEventListener("click", openGift);
document.getElementById("close-gift").addEventListener("click", closeGiftCleanup);
giftOverlay.addEventListener("click", (event) => {
  if (event.target === giftOverlay) closeGiftCleanup();
});
fullscreenGiftBtn.addEventListener("click", () => {
  if (!document.fullscreenElement) giftModalElement.requestFullscreen?.();
  else document.exitFullscreen?.();
});

window.addEventListener("click", () => {
  if (!popSound) return;
  const clone = popSound.cloneNode();
  clone.play().catch(() => {});
}, true);

document.addEventListener("keydown", (event) => {
  if (lockScreen.classList.contains("unlocked")) return;
  if (event.key >= "0" && event.key <= "9") handleInput(event.key);
  if (event.key === "Backspace") deleteLastDigit();
});

document.getElementById("btn-reset-lock").addEventListener("click", () => location.reload());

async function init() {
  try {
    await loadConfig();
    normalizeConfig();
    buildNumpad();
    renderSongList();
    loadSong(config.songs[songIndex]);
    for (let index = 0; index < 10; index += 1) setTimeout(createHeart, Math.random() * 3000);
    setInterval(createHeart, 400);
  } catch (error) {
    document.body.innerHTML = `<main style="padding:32px;font-family:Arial,sans-serif;color:#ad1457;text-align:center">
      <h1>Chưa tải được dữ liệu</h1>
      <p>${error.message}</p>
      <button onclick="location.reload()" style="padding:12px 18px;border:0;border-radius:8px;background:#d81b60;color:white;font-weight:700">Tải lại</button>
    </main>`;
  }
}

init();
