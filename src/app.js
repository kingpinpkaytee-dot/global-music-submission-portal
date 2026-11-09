import { supabase, isSupabaseConfigured } from "./supabase-client.js";

window.artistFrequencyBackendActive = true;

const byId = id => document.getElementById(id);
let currentUser = null;
let currentRole = "artist";
let directoryRecords = [];
let currentOpportunityFilter = "all";

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[char]));
}

function safeHttpUrl(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
}

function setMessage(id, message, isError = false) {
  const element = byId(id);
  if (!element) return;
  element.style.display = "block";
  element.textContent = message;
  element.style.borderColor = isError ? "#8c4545" : "";
}

function splitList(value, max = 20) {
  return String(value || "")
    .split(/[,;\n]/)
    .map(item => item.trim())
    .filter(Boolean)
    .slice(0, max);
}

function requireUser() {
  if (!currentUser) throw new Error("Please sign in to use your artist workspace.");
  return currentUser;
}

function attachBackendForm(id, handler) {
  const form = byId(id);
  if (!form) return;
  form.addEventListener("submit", async event => {
    event.preventDefault();
    event.stopImmediatePropagation();
    try {
      if (!isSupabaseConfigured || !supabase) {
        throw new Error("The Supabase connection is not configured. Please contact the platform administrator.");
      }
      await handler(event);
    } catch (error) {
      const target = id === "submissionForm" ? "formResult"
        : id === "shareMusicForm" ? "shareResult"
        : id === "campaignForm" ? "campaignResult"
        : "profileResult";
      setMessage(target, error?.message || "The request could not be completed.", true);
    }
  }, true);
}

function renderOpportunityCards(filter = currentOpportunityFilter) {
  const root = byId("opportunities");
  if (!root) return;
  currentOpportunityFilter = filter;
  const matches = directoryRecords.filter(item => {
    if (filter === "local") return (item.country || "").toLowerCase() === "south africa";
    if (filter === "playlist") return item.category === "playlist";
    if (filter === "radio") return item.category === "radio_station";
    return true;
  });

  if (!matches.length) {
    root.className = "opps";
    root.innerHTML = '<div class="empty" style="grid-column:1/-1">No verified public opportunities are listed in this category yet. Check back as the directory grows.</div>';
    return;
  }

  root.className = "opps";
  root.innerHTML = matches.map(item => {
    const title = escapeHtml(item.name);
    const category = escapeHtml(String(item.category || "").replaceAll("_", " ").toUpperCase());
    const description = escapeHtml(item.description || "Verified opportunity listing.");
    const location = escapeHtml(item.country || "International");
    const genres = Array.isArray(item.genres) ? item.genres : [];
    const tags = [location, ...genres].map(tag => '<span class="tag">' + escapeHtml(tag) + '</span>').join("");
    const link = safeHttpUrl(item.submission_url || item.website_url);
    const linkHtml = link ? '<p style="margin-top:12px"><a class="btn" rel="noopener noreferrer" target="_blank" href="' + escapeHtml(link) + '">View destination ↗</a></p>' : "";
    return '<article class="opportunity"><div class="eyebrow">' + category + '</div><h3>' + title + '</h3><p>' + description + '</p>' + tags + linkHtml + '</article>';
  }).join("");
}

function populateSubmissionTargets() {
  const typeSelect = byId("submissionType");
  const targetSelect = byId("submissionTarget");
  if (!typeSelect || !targetSelect) return;
  const category = ({
    playlist: "playlist",
    radio: "radio_station",
    website: "website"
  })[typeSelect.value];
  const available = directoryRecords.filter(item => item.category === category);
  targetSelect.innerHTML = '<option value="">Choose a verified destination</option>' +
    available.map(item => '<option value="' + escapeHtml(item.id) + '">' +
      escapeHtml(item.name) + (item.country ? " — " + escapeHtml(item.country) : "") +
      '</option>').join("");
  targetSelect.disabled = available.length === 0;
  if (!available.length) {
    targetSelect.innerHTML = '<option value="">No verified destinations available</option>';
  }
}

async function loadDirectory() {
  if (!supabase) return;
  const { data, error } = await supabase
    .from("opportunity_directories")
    .select("id,category,name,country,website_url,submission_url,genres")
    .eq("is_public", true)
    .eq("is_active", true)
    .eq("is_verified", true)
    .order("name", { ascending: true });
  if (error) throw error;
  directoryRecords = data || [];
  renderOpportunityCards(currentOpportunityFilter);
  populateSubmissionTargets();
}

async function loadPublicStats() {
  if (!supabase) return;
  const { data, error } = await supabase
    .from("public_platform_statistics")
    .select("registered_artists,platforms,curators,radio_stations,bloggers")
    .maybeSingle();
  if (error) throw error;
  if (!data) return;
  const values = {
    publicArtists: data.registered_artists,
    publicPlatforms: data.platforms,
    publicCurators: data.curators,
    publicRadio: data.radio_stations,
    publicBloggers: data.bloggers
  };
  Object.entries(values).forEach(([id, value]) => {
    const element = byId(id);
    if (element) element.textContent = Number(value ?? 0).toLocaleString();
  });
  const status = byId("publicStatsStatus");
  if (status) status.textContent = "Live counts from the Artist Frequency database.";
}

async function loadMarketplacePublic() {
  if (!supabase) return;
  const [topResult, tracksResult] = await Promise.all([
    supabase.from("public_marketplace_top5")
      .select("rank,id,track_title,artist_display_name,track_url,artwork_url,genre,country,published_at")
      .order("rank", { ascending: true }),
    supabase.from("public_marketplace_tracks")
      .select("id,track_title,artist_display_name,track_url,artwork_url,genre,country,description,published_at,is_promoted")
      .order("published_at", { ascending: false })
      .limit(30)
  ]);
  if (topResult.error) throw topResult.error;
  if (tracksResult.error) throw tracksResult.error;
  renderTopFive(topResult.data || []);
  renderPublishedMarketplace(tracksResult.data || []);
}

function renderTopFive(items) {
  const root = byId("weeklyTopFive");
  if (!root) return;
  if (!items.length) {
    root.innerHTML = [1,2,3,4,5].map(rank =>
      '<article class="feature"><div class="rank">#' + rank + '</div><h3>Awaiting weekly selection</h3><p>The editorial team has not selected a track for this position yet.</p></article>'
    ).join("");
    return;
  }
  root.innerHTML = items.map(item => {
    const url = safeHttpUrl(item.track_url);
    const link = url ? '<p><a class="btn" rel="noopener noreferrer" target="_blank" href="' + escapeHtml(url) + '">Listen ↗</a></p>' : "";
    const artwork = safeHttpUrl(item.artwork_url);
    const image = artwork ? '<img src="' + escapeHtml(artwork) + '" alt="" loading="lazy" style="width:100%;aspect-ratio:1;object-fit:cover;border-radius:12px;margin:8px 0">' : "";
    return '<article class="feature"><div class="rank">#' + Number(item.rank) + '</div>' + image +
      '<h3>' + escapeHtml(item.track_title) + '</h3><p>' + escapeHtml(item.artist_display_name) +
      '<br><span class="muted">' + escapeHtml(item.genre || "") + '</span></p>' + link + '</article>';
  }).join("");
}

function renderPublishedMarketplace(items) {
  const root = byId("marketplaceTracks");
  if (!root) return;
  if (!items.length) {
    root.innerHTML = '<div class="empty" style="grid-column:1/-1">No published Marketplace tracks yet. New releases appear after admin approval and the 24-hour publication delay.</div>';
    return;
  }
  root.innerHTML = items.map(item => {
    const url = safeHttpUrl(item.track_url);
    const art = safeHttpUrl(item.artwork_url);
    const image = art ? '<img src="' + escapeHtml(art) + '" alt="" loading="lazy" style="width:100%;aspect-ratio:1;object-fit:cover;border-radius:12px;margin-bottom:12px">' : "";
    const link = url ? '<p><a class="btn" rel="noopener noreferrer" target="_blank" href="' + escapeHtml(url) + '">Listen ↗</a></p>' : "";
    const meta = [item.genre, item.country].filter(Boolean).join(" · ");
    return '<article class="opportunity">' + image + '<div class="eyebrow">' +
      (item.is_promoted ? "FEATURED MARKETPLACE RELEASE" : "MARKETPLACE RELEASE") +
      '</div><h3>' + escapeHtml(item.track_title) + '</h3><p>' +
      escapeHtml(item.artist_display_name) + '</p><p class="muted">' + escapeHtml(meta) +
      '</p><p>' + escapeHtml(item.description || "") + '</p>' + link + '</article>';
  }).join("");
}

async function loadArtistProfile() {
  if (!supabase || !currentUser) return null;
  const { data, error } = await supabase
    .from("artist_profiles")
    .select("artist_name,country,biography,website_url,social_links,spotify_artist_url,spotify_popularity,popularity_score,is_verified,genres,press_kit_url,role")
    .eq("id", currentUser.id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  if (byId("profileArtistName")) byId("profileArtistName").value = data.artist_name || "";
  if (byId("profileCountry")) byId("profileCountry").value = data.country || "";
  if (byId("profileBio")) byId("profileBio").value = data.biography || "";
  if (byId("profileWebsite")) byId("profileWebsite").value = data.website_url || "";
  if (byId("profilePressKit")) byId("profilePressKit").value = data.press_kit_url || "";
  if (byId("spotifyArtist")) byId("spotifyArtist").value = data.spotify_artist_url || "";
  if (byId("profileGenres")) byId("profileGenres").value = (data.genres || []).join(", ");
  const social = data.social_links && Array.isArray(data.social_links.links) ? data.social_links.links : [];
  if (byId("profileLinks")) byId("profileLinks").value = social.join("\n");

  const popularity = data.spotify_popularity;
  if (byId("spotifyPopularity")) byId("spotifyPopularity").textContent =
    popularity === null || popularity === undefined ? "Not available" : String(popularity);
  if (byId("verificationStatus")) {
    byId("verificationStatus").textContent = data.is_verified ? "Verified" : "Not verified";
  }

  currentRole = data.role || "artist";
  const adminArea = byId("adminArea");
  if (adminArea) adminArea.hidden = currentRole !== "admin";
  return data;
}

async function saveArtistProfile() {
  const user = requireUser();
  const spotify = safeHttpUrl(byId("spotifyArtist").value);
  const website = safeHttpUrl(byId("profileWebsite").value);
  const pressKit = safeHttpUrl(byId("profilePressKit").value);
  const socialLinks = String(byId("profileLinks").value || "")
    .split(/\r?\n/)
    .map(link => link.trim())
    .filter(Boolean)
    .map(link => {
      const safe = safeHttpUrl(link);
      if (!safe) throw new Error("Each social link must be a valid http:// or https:// URL.");
      return safe;
    });
  const genres = splitList(byId("profileGenres").value, 20);
  const payload = {
    artist_name: byId("profileArtistName").value.trim(),
    country: byId("profileCountry").value.trim(),
    biography: byId("profileBio").value.trim(),
    website_url: website,
    social_links: { links: socialLinks },
    spotify_artist_url: spotify,
    genres,
    press_kit_url: pressKit
  };
  if (byId("spotifyArtist").value.trim() && !spotify) throw new Error("Enter a valid Spotify Artist URL.");
  if (byId("profileWebsite").value.trim() && !website) throw new Error("Enter a valid website URL.");
  if (byId("profilePressKit").value.trim() && !pressKit) throw new Error("Enter a valid press-kit URL.");
  if (!payload.artist_name || !payload.country) throw new Error("Artist name and country are required.");
  const { error } = await supabase.from("artist_profiles").update(payload).eq("id", user.id);
  if (error) throw error;
  setMessage("profileResult", "Your artist profile has been saved to your account.");
  await loadArtistProfile();
}

async function loadArtistSubmissions() {
  if (!supabase || !currentUser) return;
  const { data, error } = await supabase
    .from("artist_submissions")
    .select("id,track_title,artist_name,track_url,genre,country,status,curator_feedback,created_at")
    .order("created_at", { ascending: false });
  if (error) throw error;
  const tracks = data || [];
  if (byId("trackCount")) byId("trackCount").textContent = String(tracks.length);
  ["pending", "approved", "declined"].forEach(status => {
    const counter = byId(status + "Count");
    if (counter) counter.textContent = String(tracks.filter(item => String(item.status).toLowerCase() === status).length);
  });
  const root = byId("trackList");
  if (!root) return;
  if (!tracks.length) {
    root.className = "empty";
    root.textContent = "No submissions have been sent to a directory destination yet.";
    return;
  }
  root.className = "";
  root.innerHTML = tracks.map(item => {
    const status = String(item.status || "pending").toLowerCase();
    const feedback = item.curator_feedback ? '<p class="muted" style="margin:6px 0 0">' + escapeHtml(item.curator_feedback) + '</p>' : "";
    const url = safeHttpUrl(item.track_url);
    const link = url ? '<a target="_blank" rel="noopener noreferrer" href="' + escapeHtml(url) + '">Track link ↗</a>' : "";
    return '<div class="track"><div><b>' + escapeHtml(item.track_title) + '</b><br><span class="muted">' +
      escapeHtml(item.artist_name) + ' · ' + escapeHtml(item.genre) + ' · ' + escapeHtml(item.country) +
      '</span><br>' + link + feedback + '</div><span class="status ' + escapeHtml(status) + '">' +
      escapeHtml(status) + '</span></div>';
  }).join("");
}

async function loadCreditBalance() {
  if (!supabase || !currentUser) return;
  if (currentRole === "admin") {
    if (byId("creditBalance")) byId("creditBalance").textContent = "Unlimited";
    return;
  }
  const { data, error } = await supabase
    .from("artist_credit_balances")
    .select("credit_balance")
    .eq("artist_id", currentUser.id)
    .maybeSingle();
  if (error) throw error;
  if (byId("creditBalance")) {
    byId("creditBalance").textContent = data ? Number(data.credit_balance).toLocaleString() : "0";
  }
}

async function submitDirectoryOpportunity() {
  const user = requireUser();
  const trackUrl = safeHttpUrl(byId("trackUrl").value);
  if (!trackUrl) throw new Error("Enter a valid public track link.");
  const targetId = byId("submissionTarget").value;
  if (!targetId) throw new Error("There are no verified active destinations available for this submission type yet.");
  const args = {
    p_track_title: byId("trackTitle").value.trim(),
    p_artist_name: byId("artistName").value.trim(),
    p_track_url: trackUrl,
    p_genre: byId("genre").value,
    p_country: byId("country").value,
    p_opportunity_type: byId("submissionType").value,
    p_target_id: targetId,
    p_notes: byId("notes").value.trim()
  };
  const { error } = await supabase.rpc("submit_artist_opportunity", args);
  if (error) throw error;
  byId("submissionForm").reset();
  populateSubmissionTargets();
  setMessage("formResult", "Submission received. One credit was charged for the verified destination.");
  await Promise.all([loadArtistSubmissions(), loadCreditBalance()]);
}

async function loadMarketplaceShares() {
  if (!supabase || !currentUser) return;
  const { data, error } = await supabase
    .from("marketplace_tracks")
    .select("id,track_title,artist_display_name,genre,moderation_status,submitted_at,published_at")
    .order("submitted_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  const items = data || [];
  const root = byId("sharedTrackList");
  if (!root) return;
  if (!items.length) {
    root.className = "empty";
    root.textContent = "You have not shared a release to the Marketplace yet.";
    return;
  }
  root.className = "";
  root.innerHTML = items.map(item => {
    const status = String(item.moderation_status || "pending").toLowerCase();
    return '<div class="track"><div><b>' + escapeHtml(item.track_title) + '</b><br><span class="muted">' +
      escapeHtml(item.artist_display_name) + ' · ' + escapeHtml(item.genre) +
      '</span></div><span class="status ' + escapeHtml(status) + '">' + escapeHtml(status) + '</span></div>';
  }).join("");
}

async function shareMarketplaceTrack() {
  const user = requireUser();
  const trackUrl = safeHttpUrl(byId("shareUrl").value);
  if (!trackUrl) throw new Error("Enter a valid public DSP track URL.");
  const payload = {
    artist_id: user.id,
    track_title: byId("shareTitle").value.trim(),
    artist_display_name: byId("shareArtist").value.trim(),
    track_url: trackUrl,
    genre: byId("shareGenre").value.trim(),
    country: byId("shareCountry").value.trim() || null,
    description: byId("shareDescription").value.trim(),
    moderation_status: "pending"
  };
  const { error } = await supabase.from("marketplace_tracks").insert(payload);
  if (error) throw error;
  byId("shareMusicForm").reset();
  setMessage("shareResult", "Your track was added to the live Marketplace moderation queue.");
  await loadMarketplaceShares();
}

async function loadCampaigns() {
  if (!supabase || !currentUser) return;
  const { data, error } = await supabase
    .from("artist_campaigns")
    .select("id,title,campaign_goal,preferred_channels,target_countries,target_genres,status,created_at")
    .order("created_at", { ascending: false });
  if (error) throw error;
  const items = data || [];
  const root = byId("campaignList");
  if (!root) return;
  if (!items.length) {
    root.className = "empty";
    root.textContent = "No campaign requests yet.";
    return;
  }
  root.className = "";
  root.innerHTML = items.map(item =>
    '<div class="track"><div><b>' + escapeHtml(item.title) + '</b><br><span class="muted">' +
    escapeHtml(item.campaign_goal) + ' · ' + escapeHtml((item.target_countries || []).join(", ")) +
    '</span></div><span class="status ' + escapeHtml(item.status) + '">' +
    escapeHtml(item.status.replaceAll("_", " ")) + '</span></div>'
  ).join("");
}

async function submitCampaign() {
  const user = requireUser();
  const channels = Array.from(document.querySelectorAll('input[name="campaignChannel"]:checked')).map(input => input.value);
  const payload = {
    artist_id: user.id,
    title: byId("campaignTitle").value.trim(),
    campaign_goal: byId("campaignGoal").value,
    preferred_channels: channels,
    target_countries: splitList(byId("campaignCountry").value, 20),
    target_genres: splitList(byId("campaignGenres").value, 20),
    budget_note: "Free platform credits only",
    campaign_brief: byId("campaignBrief").value.trim(),
    status: "submitted"
  };
  const { error } = await supabase.from("artist_campaigns").insert(payload);
  if (error) throw error;
  byId("campaignForm").reset();
  setMessage("campaignResult", "Your campaign request has been submitted for review.");
  await loadCampaigns();
}

async function loadAdminMarketplaceQueue() {
  const root = byId("adminMarketplaceQueue");
  const adminArea = byId("adminArea");
  if (!root || !adminArea || currentRole !== "admin" || !supabase) return;
  adminArea.hidden = false;
  const { data, error } = await supabase
    .from("marketplace_tracks")
    .select("id,track_title,artist_display_name,track_url,genre,country,submitted_at")
    .eq("moderation_status", "pending")
    .order("submitted_at", { ascending: true });
  if (error) throw error;
  const items = data || [];
  if (!items.length) {
    root.className = "empty";
    root.textContent = "No pending Marketplace tracks.";
    return;
  }
  root.className = "";
  root.innerHTML = items.map(item => {
    const url = safeHttpUrl(item.track_url);
    const link = url ? '<a rel="noopener noreferrer" target="_blank" href="' + escapeHtml(url) + '">Open DSP link ↗</a>' : "";
    return '<div class="track"><div><b>' + escapeHtml(item.track_title) + '</b><br><span class="muted">' +
      escapeHtml(item.artist_display_name) + ' · ' + escapeHtml(item.genre) + ' · ' + escapeHtml(item.country || "") +
      '</span><br>' + link + '</div><div style="display:flex;gap:8px"><button class="btn primary" data-review="approved" data-track="' +
      escapeHtml(item.id) + '">Approve</button><button class="btn" data-review="declined" data-track="' +
      escapeHtml(item.id) + '">Decline</button></div></div>';
  }).join("");
}

async function reviewMarketplaceTrack(trackId, decision) {
  if (currentRole !== "admin") throw new Error("Administrator access is required.");
  const { error } = await supabase.rpc("admin_review_marketplace_track", {
    p_track_id: trackId,
    p_decision: decision
  });
  if (error) throw error;
  await Promise.all([loadAdminMarketplaceQueue(), loadMarketplacePublic(), loadMarketplaceShares()]);
}

async function loadArtistWorkspace() {
  if (!supabase || !currentUser) return;
  try {
    const profile = await loadArtistProfile();
    if (!profile) throw new Error("Your artist profile has not been created yet. Please refresh after confirming your email.");
    await Promise.all([
      loadArtistSubmissions(),
      loadCreditBalance(),
      loadMarketplaceShares(),
      loadCampaigns(),
      currentRole === "admin" ? loadAdminMarketplaceQueue() : Promise.resolve()
    ]);
  } catch (error) {
    setMessage("authResult", error.message || "Your artist workspace could not be loaded.", true);
  }
}

async function updateSessionUser(user) {
  const wasSameUser = currentUser?.id && currentUser.id === user?.id;
  currentUser = user || null;
  if (!currentUser) {
    currentRole = "artist";
    if (byId("adminArea")) byId("adminArea").hidden = true;
    if (byId("trackList")) {
      byId("trackList").className = "empty";
      byId("trackList").textContent = "Sign in to view your submissions.";
    }
    if (byId("creditBalance")) byId("creditBalance").textContent = "—";
    ["profileArtistName", "profileCountry", "profileBio", "profileWebsite", "profilePressKit", "spotifyArtist", "profileGenres", "profileLinks"].forEach(id => { if (byId(id)) byId(id).value = ""; });
    if (byId("spotifyPopularity")) byId("spotifyPopularity").textContent = "—";
    if (byId("verificationStatus")) byId("verificationStatus").textContent = "Not verified";
    if (byId("trackCount")) byId("trackCount").textContent = "0";
    ["pendingCount", "approvedCount", "declinedCount"].forEach(id => { if (byId(id)) byId(id).textContent = "0"; });
    if (byId("sharedTrackList")) {
      byId("sharedTrackList").className = "empty";
      byId("sharedTrackList").textContent = "Sign in to view your Marketplace shares.";
    }
    if (byId("campaignList")) {
      byId("campaignList").className = "empty";
      byId("campaignList").textContent = "Sign in to view your campaign requests.";
    }
    return;
  }
  if (!wasSameUser) await loadArtistWorkspace();
}

document.getElementById("filters")?.addEventListener("click", event => {
  const button = event.target.closest("button[data-filter]");
  if (button) renderOpportunityCards(button.dataset.filter);
});
byId("submissionType")?.addEventListener("change", populateSubmissionTargets);
byId("adminMarketplaceQueue")?.addEventListener("click", async event => {
  const button = event.target.closest("button[data-review][data-track]");
  if (!button) return;
  button.disabled = true;
  try {
    await reviewMarketplaceTrack(button.dataset.track, button.dataset.review);
  } catch (error) {
    setMessage("authResult", error.message || "Marketplace review failed.", true);
  } finally {
    button.disabled = false;
  }
});

attachBackendForm("submissionForm", submitDirectoryOpportunity);
attachBackendForm("shareMusicForm", shareMarketplaceTrack);
attachBackendForm("campaignForm", submitCampaign);
attachBackendForm("artistProfileForm", saveArtistProfile);

async function initialise() {
  if (!supabase || !isSupabaseConfigured) {
    const status = byId("publicStatsStatus");
    if (status) status.textContent = "Live database connection is not configured.";
    setMessage("formResult", "The secure backend is not configured.", true);
    if (byId("marketplaceTracks")) byId("marketplaceTracks").innerHTML = '<div class="empty">Marketplace is currently unavailable.</div>';
    return;
  }

  const publicLoads = await Promise.allSettled([
    loadPublicStats(),
    loadDirectory(),
    loadMarketplacePublic()
  ]);
  publicLoads.forEach((result, index) => {
    if (result.status === "rejected") {
      const messages = ["Public statistics unavailable.", "Directory listings unavailable.", "Marketplace listings unavailable."];
      const status = byId("publicStatsStatus");
      if (index === 0 && status) status.textContent = result.reason?.message || messages[index];
      if (index === 1 && byId("opportunities")) byId("opportunities").innerHTML = '<div class="empty">' + escapeHtml(messages[index]) + '</div>';
      if (index === 2 && byId("marketplaceTracks")) byId("marketplaceTracks").innerHTML = '<div class="empty">' + escapeHtml(messages[index]) + '</div>';
    }
  });

  const { data, error } = await supabase.auth.getSession();
  if (error) {
    setMessage("authResult", error.message || "Could not restore your session.", true);
  } else {
    await updateSessionUser(data.session?.user || null);
  }
}

window.addEventListener("artistfrequency:auth", event => {
  updateSessionUser(event.detail?.user || null);
});

initialise().catch(error => {
  setMessage("authResult", error.message || "Artist Frequency could not initialise.", true);
});
