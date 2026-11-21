// avatar-section.js - Separate module for Left Drawer Avatar management

(function () {
  const STORAGE_BUCKET = "avatars";
  let fileInputEl = null;

  function ensureFileInput() {
    if (fileInputEl) return fileInputEl;
    fileInputEl = document.createElement("input");
    fileInputEl.type = "file";
    fileInputEl.accept = "image/png, image/jpeg, image/webp, image/gif";
    fileInputEl.style.display = "none";
    fileInputEl.addEventListener("change", handleAvatarSelected);
    document.body.appendChild(fileInputEl);
    return fileInputEl;
  }

  function renderAvatarImage(url) {
    const container = document.getElementById("drawerAvatarBox");
    if (!container || !url) return;

    let img = container.querySelector("img.nexus-avatar-img");
    if (!img) {
      img = document.createElement("img");
      img.className = "nexus-avatar-img";
      img.alt = "User Avatar";
      img.style.width = "100%";
      img.style.height = "100%";
      img.style.objectFit = "cover";
      img.style.borderRadius = "50%";
      container.prepend(img);
    }
    img.src = url;

    const defaultSvg = container.querySelector("svg.default-avatar-svg");
    if (defaultSvg) {
      defaultSvg.style.display = "none";
    }
  }

  function getLocalAvatarKey(userId) {
    return `nexus_avatar_${userId || "guest"}`;
  }

  async function handleAvatarSelected(event) {
    const file = event.target.files && event.target.files[0];
    event.target.value = "";
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      if (typeof showToast === "function") {
        showToast("Image size 2MB se kam rakhein", "error");
      }
      return;
    }

    const userId =
      (typeof currentAuthUserId !== "undefined" && currentAuthUserId) ||
      (typeof currentUserProfile !== "undefined" && currentUserProfile?.id) ||
      "guest";

    const reader = new FileReader();
    reader.onload = async () => {
      const base64Data = reader.result;
      renderAvatarImage(base64Data);

      try {
        localStorage.setItem(getLocalAvatarKey(userId), base64Data);
      } catch (e) {}

      // Agar Supabase client aur user logged in hain to Storage/Profile mein save karne ki koshish
      if (
        typeof supabaseClient !== "undefined" &&
        userId !== "guest"
      ) {
        try {
          const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
          const filePath = `${userId}/avatar.${ext}`;

          const { error: uploadError } = await supabaseClient.storage
            .from(STORAGE_BUCKET)
            .upload(filePath, file, { upsert: true });

          if (!uploadError) {
            const { data: pubData } = supabaseClient.storage
              .from(STORAGE_BUCKET)
              .getPublicUrl(filePath);

            const publicUrl = pubData?.publicUrl;
            if (publicUrl) {
              const cacheBustedUrl = `${publicUrl}?t=${Date.now()}`;
              await supabaseClient
                .from("profiles")
                .update({ avatar_url: publicUrl })
                .eq("id", userId);

              if (typeof currentUserProfile === "object" && currentUserProfile) {
                currentUserProfile.avatar_url = publicUrl;
              }
              renderAvatarImage(cacheBustedUrl);
              try {
                localStorage.setItem(getLocalAvatarKey(userId), cacheBustedUrl);
              } catch (e) {}
            }
          }
        } catch (err) {
          console.warn("Avatar cloud sync skipped/fallback:", err);
        }
      }

      if (typeof showToast === "function") {
        showToast("Avatar updated!", "success");
      }
    };
    reader.readAsDataURL(file);
  }

  window.NexusAvatarSection = {
    openPicker: function () {
      ensureFileInput().click();
    },
    syncFromProfile: function (profile, userId) {
      const uid = userId || profile?.id || "guest";
      const savedUrl =
        profile?.avatar_url ||
        profile?.avatar ||
        (() => {
          try {
            return localStorage.getItem(getLocalAvatarKey(uid));
          } catch (e) {
            return null;
          }
        })();

      if (savedUrl) {
        renderAvatarImage(savedUrl);
      }
    }
  };
})();
