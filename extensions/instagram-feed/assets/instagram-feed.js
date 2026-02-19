(function () {
  const PROXY_CANDIDATES = ["/apps/instagram-feed-track", "/a/instagram-feed-track"];
  const PROXY_STORAGE_KEY = "wallify_proxy_path";

  function toInt(value, fallback) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }

  function readSessionStorage(key) {
    try {
      return sessionStorage.getItem(key);
    } catch (error) {
      return null;
    }
  }

  function writeSessionStorage(key, value) {
    try {
      sessionStorage.setItem(key, value);
    } catch (error) {
      // ignore storage failures in private mode
    }
  }

  function scheduleIdle(callback) {
    if (typeof window.requestIdleCallback === "function") {
      window.requestIdleCallback(callback, { timeout: 1000 });
      return;
    }

    window.setTimeout(callback, 0);
  }

  function createTracker(wrapper) {
    const shopDomain = wrapper.dataset.shopDomain || "";
    const directTrackingUrl = wrapper.dataset.directTrackingUrl || "";

    return async function track(data) {
      const params = new URLSearchParams();
      Object.entries(data || {}).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
          params.set(key, String(value));
        }
      });

      if (directTrackingUrl) {
        const directParams = new URLSearchParams(params);
        directParams.set("shop", shopDomain);
        const separator = directTrackingUrl.includes("?") ? "&" : "?";
        const directUrl = `${directTrackingUrl}${separator}${directParams.toString()}`;

        try {
          await fetch(directUrl, { method: "GET", mode: "no-cors", keepalive: true });
          return;
        } catch (directError) {
          console.debug("Direct tracking failed, falling back to proxy:", directError);
        }
      }

      const preferredProxy = readSessionStorage(PROXY_STORAGE_KEY);
      const endpointCandidates = preferredProxy
        ? [preferredProxy, ...PROXY_CANDIDATES.filter((path) => path !== preferredProxy)]
        : PROXY_CANDIDATES;

      for (const endpoint of endpointCandidates) {
        const fallbackUrl = `${endpoint}?${params.toString()}`;

        try {
          const response = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
            keepalive: true,
          });

          if (response.ok) {
            writeSessionStorage(PROXY_STORAGE_KEY, endpoint);
            return;
          }

          const getResponse = await fetch(fallbackUrl, { method: "GET", keepalive: true });
          if (getResponse.ok) {
            writeSessionStorage(PROXY_STORAGE_KEY, endpoint);
            return;
          }
        } catch (error) {
          console.debug(`Tracking proxy failed on ${endpoint}:`, error);
        }
      }
    };
  }

  function setupPreviewVideos(wrapper) {
    const videos = wrapper.querySelectorAll(".instagram-feed-item > video");
    if (!videos.length) return;

    videos.forEach((video) => {
      video.muted = true;
      video.defaultMuted = true;
      video.playsInline = true;
      video.setAttribute("muted", "");
      video.setAttribute("playsinline", "");
      video.setAttribute("preload", "none");
    });

    if (!("IntersectionObserver" in window)) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const video = entry.target;
          if (entry.isIntersecting) {
            const playPromise = video.play();
            if (playPromise && typeof playPromise.catch === "function") {
              playPromise.catch(() => {});
            }
            return;
          }

          video.pause();
        });
      },
      { root: null, rootMargin: "120px 0px", threshold: 0.45 },
    );

    videos.forEach((video) => observer.observe(video));
  }

  function setupSlider(wrapper) {
    const feedType = wrapper.dataset.feedType;
    if (feedType !== "slider") return;

    const sliderWrapper = wrapper.querySelector(".instagram-slider-wrapper");
    if (!sliderWrapper) return;

    const sliderTrack = sliderWrapper.querySelector(".instagram-slider-track");
    if (!sliderTrack) return;

    const prevBtn = sliderWrapper.querySelector(".instagram-slider-prev");
    const nextBtn = sliderWrapper.querySelector(".instagram-slider-next");
    const slides = sliderTrack.querySelectorAll(".instagram-slide");

    let currentIndex = 0;
    const desktopCols = toInt(wrapper.dataset.desktopCols, 4);
    const mobileCols = toInt(wrapper.dataset.mobileCols, 2);
    let slidesToShow = window.innerWidth <= 768 ? mobileCols : desktopCols;
    const totalSlides = slides.length;

    function getMaxIndex() {
      return Math.max(0, totalSlides - slidesToShow);
    }

    function updateSlider() {
      if (!slides.length) return;
      const slideEl = slides[0];
      const slideWidth = slideEl.offsetWidth;
      const gap = Number.parseFloat(getComputedStyle(sliderTrack).gap) || 0;
      const offset = currentIndex * (slideWidth + gap);
      sliderTrack.style.transform = `translateX(-${offset}px)`;

      if (prevBtn) prevBtn.disabled = currentIndex === 0;
      if (nextBtn) nextBtn.disabled = currentIndex >= getMaxIndex();
    }

    if (prevBtn) {
      prevBtn.addEventListener("click", () => {
        if (currentIndex > 0) {
          currentIndex = Math.max(0, currentIndex - 1);
          updateSlider();
        }
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener("click", () => {
        const maxIdx = getMaxIndex();
        if (currentIndex < maxIdx) {
          currentIndex = Math.min(maxIdx, currentIndex + 1);
          updateSlider();
        }
      });
    }

    updateSlider();

    let touchStartX = 0;
    let touchEndX = 0;
    let isSwiping = false;

    sliderTrack.addEventListener(
      "touchstart",
      (event) => {
        touchStartX = event.touches[0].clientX;
        isSwiping = true;
        sliderTrack.style.transition = "none";
      },
      { passive: true },
    );

    sliderTrack.addEventListener(
      "touchmove",
      (event) => {
        if (!isSwiping) return;
        touchEndX = event.touches[0].clientX;
        const diff = touchEndX - touchStartX;
        if (!slides.length) return;
        const slideWidth = slides[0].offsetWidth;
        const gap = Number.parseFloat(getComputedStyle(sliderTrack).gap) || 0;
        const baseOffset = currentIndex * (slideWidth + gap);
        sliderTrack.style.transform = `translateX(${-baseOffset + diff}px)`;
      },
      { passive: true },
    );

    sliderTrack.addEventListener("touchend", () => {
      if (!isSwiping) return;
      isSwiping = false;
      sliderTrack.style.transition = "transform 0.3s ease";
      const diff = touchEndX - touchStartX;
      const threshold = 50;

      if (diff < -threshold && currentIndex < getMaxIndex()) {
        currentIndex += 1;
      } else if (diff > threshold && currentIndex > 0) {
        currentIndex -= 1;
      }

      touchStartX = 0;
      touchEndX = 0;
      updateSlider();
    });

    let resizeTimer;
    window.addEventListener("resize", () => {
      clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        const newSlidesToShow = window.innerWidth <= 768 ? mobileCols : desktopCols;
        if (newSlidesToShow !== slidesToShow) {
          slidesToShow = newSlidesToShow;
          const maxIdx = getMaxIndex();
          if (currentIndex > maxIdx) currentIndex = maxIdx;
        }
        updateSlider();
      }, 150);
    });
  }

  function setupPopup(wrapper, onClick, track) {
    const feedId = wrapper.dataset.feedId;
    if (!feedId) return;

    const modal = document.getElementById(`instagram-popup-${feedId}`);
    if (!modal) return;

    const closeBtn = modal.querySelector(".instagram-popup-close");
    const overlay = modal.querySelector(".instagram-popup-overlay");

    function openPopup(item) {
      const mediaUrl = item.dataset.mediaUrl;
      const permalink = item.dataset.permalink;
      const caption = item.dataset.caption || "";
      const username = item.dataset.username || "Instagram";
      let products = [];
      let children = [];

      try {
        products = JSON.parse(item.dataset.products || "[]");
      } catch (error) {
        products = [];
      }

      try {
        children = JSON.parse(item.dataset.children || "[]");
      } catch (error) {
        children = [];
      }

      const popupUsername = modal.querySelector(".instagram-popup-username");
      const popupUsernameClean = modal.querySelector(".instagram-popup-username-clean");
      const popupCaption = modal.querySelector(".instagram-popup-caption");
      const popupLink = modal.querySelector(".instagram-popup-link");
      const popupLinkClean = modal.querySelector(".instagram-popup-link-clean");
      const productsContainer = modal.querySelector(".instagram-popup-products");

      if (popupUsername) popupUsername.textContent = `@${username}`;
      if (popupUsernameClean) popupUsernameClean.textContent = `@${username}`;
      if (popupCaption) popupCaption.textContent = caption;
      if (popupLink) popupLink.href = permalink || "https://instagram.com";
      if (popupLinkClean) popupLinkClean.href = permalink || "https://instagram.com";

      if (productsContainer) {
        if (products && products.length > 0) {
          productsContainer.innerHTML =
            "<h4>Tagged Products</h4>" +
            products
              .map((product) => `<a href="/products/${product.handle}" class="popup-product-tag">${product.title}</a>`)
              .join("");
          productsContainer.style.display = "block";
        } else {
          productsContainer.style.display = "none";
        }
      }

      const singleImage = modal.querySelector(".popup-single-image");
      const singleVideo = modal.querySelector(".popup-single-video");
      const carouselContainer = modal.querySelector(".popup-carousel-container");
      const mediaType = item.dataset.mediaType || "";
      const videoUrl = item.dataset.videoUrl || "";
      const isVideo = mediaType === "VIDEO" || mediaType === "REEL";

      if (children && children.length > 0) {
        singleImage.style.display = "none";
        singleVideo.style.display = "none";
        singleVideo.pause();
        carouselContainer.style.display = "block";

        const trackEl = carouselContainer.querySelector(".popup-carousel-track");
        const dotsContainer = carouselContainer.querySelector(".popup-carousel-dots");

        trackEl.innerHTML = children
          .map((child) => {
            const childIsVideo = child.media_type === "VIDEO";
            if (childIsVideo) {
              return `<div class="popup-carousel-slide"><video src="${child.media_url}" poster="${child.thumbnail_url || ""}" autoplay muted loop playsinline style="width:100%;height:100%;object-fit:contain;"></video></div>`;
            }
            return `<div class="popup-carousel-slide"><img src="${child.thumbnail_url || child.media_url}" alt="${caption}"></div>`;
          })
          .join("");

        dotsContainer.innerHTML = children
          .map((_, index) => `<span class="popup-carousel-dot ${index === 0 ? "active" : ""}"></span>`)
          .join("");

        let currentSlide = 0;
        const slides = trackEl.querySelectorAll(".popup-carousel-slide");
        const dots = dotsContainer.querySelectorAll(".popup-carousel-dot");

        function updatePopupCarousel() {
          trackEl.style.transform = `translateX(-${currentSlide * 100}%)`;
          dots.forEach((dot, index) => {
            dot.classList.toggle("active", index === currentSlide);
          });
        }

        const prevBtn = carouselContainer.querySelector(".popup-carousel-prev");
        const nextBtn = carouselContainer.querySelector(".popup-carousel-next");

        prevBtn.onclick = (event) => {
          event.stopPropagation();
          currentSlide = Math.max(0, currentSlide - 1);
          updatePopupCarousel();
        };

        nextBtn.onclick = (event) => {
          event.stopPropagation();
          currentSlide = Math.min(slides.length - 1, currentSlide + 1);
          updatePopupCarousel();
        };

        dots.forEach((dot, index) => {
          dot.onclick = (event) => {
            event.stopPropagation();
            currentSlide = index;
            updatePopupCarousel();
          };
        });

        updatePopupCarousel();
      } else if (isVideo && videoUrl) {
        singleImage.style.display = "none";
        singleVideo.style.display = "block";
        carouselContainer.style.display = "none";
        singleVideo.src = videoUrl;
        const playPromise = singleVideo.play();
        if (playPromise && typeof playPromise.catch === "function") {
          playPromise.catch(() => {});
        }
      } else {
        singleImage.style.display = "block";
        singleVideo.style.display = "none";
        singleVideo.pause();
        carouselContainer.style.display = "none";
        singleImage.src = mediaUrl;
      }

      modal.style.display = "flex";
      document.body.style.overflow = "hidden";
    }

    function closePopup() {
      const video = modal.querySelector(".popup-single-video");
      if (video) video.pause();
      modal.style.display = "none";
      document.body.style.overflow = "";
    }

    if (closeBtn) closeBtn.addEventListener("click", closePopup);
    if (overlay) overlay.addEventListener("click", closePopup);

    wrapper.querySelectorAll(".instagram-carousel-container").forEach((container) => {
      const trackEl = container.querySelector(".instagram-carousel-track");
      const slides = container.querySelectorAll(".instagram-carousel-slide");
      const dots = container.querySelectorAll(".instagram-carousel-dot");
      const prevBtn = container.querySelector(".instagram-carousel-prev");
      const nextBtn = container.querySelector(".instagram-carousel-next");

      if (!trackEl || slides.length === 0) return;

      let currentSlide = 0;

      function updateCarousel() {
        trackEl.style.transform = `translateX(-${currentSlide * 100}%)`;
        dots.forEach((dot, index) => {
          dot.classList.toggle("active", index === currentSlide);
        });
      }

      if (prevBtn) {
        prevBtn.addEventListener("click", (event) => {
          event.stopPropagation();
          currentSlide = Math.max(0, currentSlide - 1);
          updateCarousel();
        });
      }

      if (nextBtn) {
        nextBtn.addEventListener("click", (event) => {
          event.stopPropagation();
          currentSlide = Math.min(slides.length - 1, currentSlide + 1);
          updateCarousel();
        });
      }

      dots.forEach((dot, index) => {
        dot.addEventListener("click", (event) => {
          event.stopPropagation();
          currentSlide = index;
          updateCarousel();
        });
      });

      updateCarousel();
    });

    wrapper.querySelectorAll(".instagram-feed-item").forEach((item) => {
      item.style.cursor = "pointer";
      item.addEventListener("click", function handleClick(event) {
        event.preventDefault();

        track({
          type: "click",
          mediaId: this.dataset.mediaId,
          mediaUrl: this.dataset.mediaUrl,
          permalink: this.dataset.permalink,
        });

        if (onClick === "popup") {
          openPopup(this);
        } else {
          window.open(this.dataset.permalink, "_blank");
        }
      });
    });
  }

  function initWrapper(wrapper) {
    if (!wrapper || wrapper.dataset.wallifyInitialized === "true") return;
    wrapper.dataset.wallifyInitialized = "true";

    const track = createTracker(wrapper);
    const onClick = wrapper.dataset.onClick || "popup";

    scheduleIdle(() => {
      track({ type: "view" });
    });

    setupPreviewVideos(wrapper);
    setupSlider(wrapper);
    setupPopup(wrapper, onClick, track);
  }

  function initAll(root) {
    const scope = root || document;
    scope.querySelectorAll(".instagram-feed-wrapper").forEach(initWrapper);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => initAll(document));
  } else {
    initAll(document);
  }

  document.addEventListener("shopify:section:load", (event) => {
    initAll(event.target);
  });
})();
