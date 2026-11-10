import { supabase, isSupabaseConfigured } from "./supabase-client.js";

window.artistFrequencyBackendActive = true;

// Keep all task and opportunity links inside one reusable popup window.
// The opener is detached immediately to prevent reverse-tab navigation.
document.addEventListener("click", event => {
  const anchor = event.target.closest("a[href]");
  if (!anchor) return;
  const raw = anchor.getAttribute("href") || "";
  if (!raw || raw.startsWith("#") || raw.startsWith("mailto:") || raw.startsWith("tel:")) return;
  const isNewWindow = anchor.target === "_blank" || anchor.target === "artistFrequencyPopup";
  if (!isNewWindow) return;
  let destination;
  try { destination = new URL(raw, window.location.href); } catch { return; }
  if (!["http:", "https:"].includes(destination.protocol)) return;
  event.preventDefault();
  const popup = window.open(destination.href, "ArtistFrequencyPopup", "popup=yes,width=1180,height=850,resizable=yes,scrollbars=yes");
  if (popup) {
    try { popup.opener = null; popup.focus(); } catch {}
  } else {
    window.location.href = destination.href;
  }
}, true);

const byId = id => document.getElementById(id);
let currentUser = null;
let currentRole = "artist";
let directoryRecords = [];
let adminDirectoryRecords = [];
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
        : id === "adminDirectoryForm" ? "directoryResult"
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
    if (filter === "curator") return item.category === "curator";
    if (filter === "blogger") return item.category === "blogger";
    if (filter === "platform") return item.category === "platform";
    if (filter === "contact") return item.category === "contact";
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
    const description = escapeHtml(item.description || (item.accepts_free_submissions
      ? "Free submission route. Review the official criteria before sending."
      : "Official submission route. Check fees, eligibility and terms before submitting."));
    const location = escapeHtml(item.country || "International");
    const genres = Array.isArray(item.genres) ? item.genres : [];
    const tagValues = [location, ...genres];
    if (item.accepts_free_submissions) tagValues.push("Free submissions");
    if (item.follower_count !== null && item.follower_count !== undefined) tagValues.push(Number(item.follower_count).toLocaleString() + " followers");
    if (item.approval_rate !== null && item.approval_rate !== undefined) tagValues.push("Measured approval " + Number(item.approval_rate).toFixed(1) + "%");
    if (item.response_rate !== null && item.response_rate !== undefined) tagValues.push("Measured response " + Number(item.response_rate).toFixed(1) + "%");
    if (item.curator_interaction_score !== null && item.curator_interaction_score !== undefined) tagValues.push("Measured interaction " + Number(item.curator_interaction_score).toFixed(1) + "/100");
    const tags = tagValues.map(tag => '<span class="tag">' + escapeHtml(tag) + '</span>').join("");
    const link = safeHttpUrl(item.submission_url || item.website_url);
    const submissionStatus = item.is_integrated && item.accepts_submissions
      ? "In-platform submissions open"
      : "External directory listing · in-platform submissions not enabled";
    const curatorProfile = safeHttpUrl(item.curator_profile_url);
    const curatorLabel = escapeHtml(item.curator_name || "Independent curator");
    const curatorHtml = '<p class="form-note">Curator: ' + (curatorProfile
      ? '<a rel="noopener noreferrer" target="_blank" href="' + escapeHtml(curatorProfile) + '">' + curatorLabel + ' ↗</a>'
      : curatorLabel) + '</p>';
    const spotifyPlaylist = item.category === "playlist" ? safeHttpUrl(item.website_url) : null;
    const spotifyLinkHtml = spotifyPlaylist
      ? '<p style="margin-top:12px"><a class="btn" rel="noopener noreferrer" target="_blank" href="' + escapeHtml(spotifyPlaylist) + '">Open Spotify playlist ↗</a></p>'
      : "";
    const linkLabel = item.category === "playlist" ? "Submit track ↗" : "View destination ↗";
    const linkHtml = link ? '<p style="margin-top:12px"><a class="btn" rel="noopener noreferrer" target="_blank" href="' + escapeHtml(link) + '">' + linkLabel + '</a></p>' : "";
    const email = String(item.contact_email || "").trim();
    const emailHtml = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
      ? '<p class="form-note">Verified contact: <a href="mailto:' + escapeHtml(email) + '">' + escapeHtml(email) + '</a></p>' : "";
    return '<article class="opportunity"><div class="award"><span class="award-mark">🏆</span> VERIFIED & APPROVED</div><div class="eyebrow">' + category + '</div><h3>' + title + '</h3><p>' + description + '</p>' + tags + curatorHtml + emailHtml + '<p class="form-note">' + escapeHtml(submissionStatus) + '</p>' + spotifyLinkHtml + linkHtml + '</article>';
  }).join("");
}

function populateSubmissionTargets() {
  const typeSelect = byId("submissionType");
  const targetSelect = byId("submissionTarget");
  if (!typeSelect || !targetSelect) return;
  const category = ({
    playlist: "playlist",
    radio: "radio_station",
    website: "website",
    curator: "curator",
    platform: "platform",
    contact: "contact"
  })[typeSelect.value];
  const available = directoryRecords.filter(item => item.category === category && item.is_integrated && item.accepts_submissions);
  targetSelect.innerHTML = '<option value="">Choose an integrated destination</option>' +
    available.map(item => '<option value="' + escapeHtml(item.id) + '">' +
      escapeHtml(item.name) + (item.country ? " — " + escapeHtml(item.country) : "") +
      '</option>').join("");
  targetSelect.disabled = available.length === 0;
  if (!available.length) {
    targetSelect.innerHTML = '<option value="">No integrated destinations are currently accepting submissions</option>';
  }
}

async function updateOpportunityStats() {
  const categories = {
    publicPlaylists: "playlist",
    publicCurators: "curator",
    publicRadio: "radio_station",
    publicBloggers: "blogger",
    publicPlatforms: "platform",
    publicWebsites: "website",
    publicContacts: "contact"
  };
  const baseCount = () => supabase.from("opportunity_directories")
    .select("id", { count: "exact", head: true })
    .eq("is_public", true).eq("is_active", true).eq("is_verified", true);
  const requests = Object.entries(categories).map(async ([id, category]) => {
    const { count, error } = await baseCount().eq("category", category);
    if (error) throw error;
    return [id, count || 0];
  });
  requests.push((async () => {
    const { count, error } = await baseCount();
    if (error) throw error;
    return ["publicOpportunityTotal", count || 0];
  })());
  const values = await Promise.all(requests);
  values.forEach(([id, value]) => {
    const element = byId(id);
    if (element) element.textContent = Number(value).toLocaleString() + (Number(value) > 0 ? "+" : "");
  });
}
async function loadDirectory() {
  if (!supabase) return;
  const { data, error } = await supabase
    .from("opportunity_directories")
    .select("id,category,name,country,website_url,submission_url,contact_email,curator_name,curator_profile_url,genres,is_integrated,accepts_submissions,accepts_free_submissions,activity_status,follower_count,approval_rate,response_rate,curator_interaction_score,last_checked_at,source_url,source_evidence_url,data_confidence")
    .eq("is_public", true)
    .eq("is_active", true)
    .eq("is_verified", true)
    .order("name", { ascending: true });
  if (error) throw error;
  directoryRecords = data || [];

  renderOpportunityCards(currentOpportunityFilter);
  populateSubmissionTargets();
  updateOpportunityStats().catch(error => {
    console.error("Could not refresh verified opportunity totals:", error);
    const status = byId("publicStatsStatus");
    if (status) status.textContent = "Verified opportunity totals could not be refreshed. Please retry shortly.";
  });
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
    publicArtists: data.registered_artists
  };
  Object.entries(values).forEach(([id, value]) => {
    const element = byId(id);
    if (element) element.textContent = Number(value ?? 0).toLocaleString() + (Number(value ?? 0) > 0 ? "+" : "");
  });
  const status = byId("publicStatsStatus");
  if (status) status.textContent = "Artist total from the public artist register; opportunity totals count verified, active and public directory records only.";
}

async function loadMarketplacePublic() {
  if (!supabase) return;
  const topPromise = supabase.from("public_marketplace_top5")
    .select("rank,id,track_title,artist_display_name,track_url,artwork_url,genre,country,published_at")
    .order("rank", { ascending: true });
  const pageSize = 500;
  const allTracks = [];
  for (let offset = 0; ; offset += pageSize) {
    const page = await supabase.from("public_marketplace_tracks")
      .select("id,track_title,artist_display_name,track_url,artwork_url,genre,country,description,published_at,is_promoted")
      .order("published_at", { ascending: false })
      .range(offset, offset + pageSize - 1);
    if (page.error) throw page.error;
    allTracks.push(...(page.data || []));
    if (!page.data || page.data.length < pageSize) break;
  }
  const topResult = await topPromise;
  if (topResult.error) throw topResult.error;
  renderTopFive(topResult.data || []);
  renderPublishedMarketplace(allTracks);
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
  const adminDashboardTile = byId("adminDashboardTile");
  if (adminDashboardTile) adminDashboardTile.hidden = currentRole !== "admin";
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
  updateOpportunityStats().catch(error => {
    console.error("Could not refresh verified opportunity totals:", error);
    const status = byId("publicStatsStatus");
    if (status) status.textContent = "Verified opportunity totals could not be refreshed. Please retry shortly.";
  });
  setMessage("formResult", "Submission request recorded. One credit was charged only because this destination has an enabled delivery integration.");
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

function clearAdminDirectoryForm() {
  const form = byId("adminDirectoryForm");
  if (!form) return;
  form.reset();
  if (byId("directoryId")) byId("directoryId").value = "";
  if (byId("directoryActive")) byId("directoryActive").checked = true;
  if (byId("directoryResult")) {
    byId("directoryResult").style.display = "none";
    byId("directoryResult").textContent = "";
  }
}

function renderAdminDirectoryRecords() {
  const root = byId("adminDirectoryList");
  if (!root) return;
  if (!adminDirectoryRecords.length) {
    root.className = "empty";
    root.textContent = "No directory records yet. Add a record above and verify it against its official source.";
    return;
  }
  root.className = "";
  root.innerHTML = adminDirectoryRecords.map(item => {
    const tags = [
      item.is_verified ? "Verified" : "Not verified",
      item.is_public ? "Public" : "Private",
      item.is_active ? "Active" : "Inactive",
      item.is_integrated ? "Integration connected" : "Not integrated",
      item.accepts_submissions ? "Accepting submissions" : "Submissions locked"
    ].map(tag => '<span class="tag">' + escapeHtml(tag) + '</span>').join(" ");
    const link = safeHttpUrl(item.submission_url || item.website_url);
    const linkHtml = link ? '<a rel="noopener noreferrer" target="_blank" href="' + escapeHtml(link) + '">Official link ↗</a>' : "";
    return '<div class="track"><div><b>' + escapeHtml(item.name) + '</b><br><span class="muted">' +
      escapeHtml(item.category.replaceAll("_", " ")) + ' · ' + escapeHtml(item.country || "Country not set") +
      '</span><div style="margin-top:8px">' + tags + '</div><div style="margin-top:6px">' + linkHtml +
      '</div></div><button type="button" class="btn" data-directory-edit="' + escapeHtml(item.id) + '">Edit</button></div>';
  }).join("");
}

async function loadAdminDirectory() {
  if (!supabase || !currentUser || currentRole !== "admin") return;
  const root = byId("adminDirectoryList");
  if (root) root.textContent = "Loading directory records…";
  const { data, error } = await supabase
    .from("opportunity_directories")
    .select("id,category,name,country,website_url,submission_url,contact_email,genres,is_verified,is_active,is_public,verification_evidence_url,is_integrated,accepts_submissions,verified_at,updated_at")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  adminDirectoryRecords = data || [];
  renderAdminDirectoryRecords();
}


let adminDiscoveryCandidates = [];

function renderAdminCandidates() {
  const root = byId("candidateReviewList");
  if (!root) return;
  if (!adminDiscoveryCandidates.length) {
    root.className = "empty";
    root.textContent = "No pending Google Search candidates. New discoveries will appear here for review.";
    return;
  }
  root.className = "";
  root.innerHTML = adminDiscoveryCandidates.map(item => {
    const submissionLink = safeHttpUrl(item.submission_url);
    const websiteLink = safeHttpUrl(item.website_url);
    const sourceLink = safeHttpUrl(item.source_url);
    const evidenceLink = safeHttpUrl(item.evidence_url);
    const hasRoute = Boolean(submissionLink || (item.contact_email && /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(String(item.contact_email).trim())));
    const canApprove = Boolean(sourceLink && evidenceLink && hasRoute);
    const linkHtml = submissionLink ? '<a rel="noopener noreferrer" target="_blank" href="' + escapeHtml(submissionLink) + '">Open submission route ↗</a>' : (websiteLink ? '<a rel="noopener noreferrer" target="_blank" href="' + escapeHtml(websiteLink) + '">Open official website ↗</a>' : "");
    const evidenceHtml = evidenceLink ? '<a rel="noopener noreferrer" target="_blank" href="' + escapeHtml(evidenceLink) + '">Open evidence ↗</a>' : '<span class="muted">Evidence URL missing</span>';
    const reasonHtml = item.verification_reason ? '<p class="form-note"><b>Review notes:</b> ' + escapeHtml(item.verification_reason) + '</p>' : "";
    const email = String(item.contact_email || "").trim();
    const emailHtml = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
      ? '<p class="form-note">Contact: <a href="mailto:' + escapeHtml(email) + '">' + escapeHtml(email) + '</a></p>' : "";
    const tags = [item.country || "Global", ...(item.genres || []), item.submission_method || "route unknown",
      item.activity_status || "activity unknown", item.accepts_free_submissions ? "Free route stated" : "Fee not confirmed"].map(x => '<span class="tag">' + escapeHtml(x) + '</span>').join(" ");
    return '<article class="track" style="align-items:flex-start"><div style="flex:1"><b>' + escapeHtml(item.name) + '</b><br><span class="muted">' +
      escapeHtml(String(item.category || "").replaceAll("_"," ")) + ' · ' + escapeHtml(item.source_name || "Google Search") +
      '</span><div style="margin:8px 0">' + tags + '</div>' + emailHtml +
      '<p class="form-note">' + linkHtml + (item.source_url ? ' · <a rel="noopener noreferrer" target="_blank" href="' + escapeHtml(item.source_url) + '">Source ↗</a>' : "") + '</p>' +
      '</div><div class="auth-actions"><button type="button" class="btn primary" data-candidate-review="accept" data-candidate-id="' + escapeHtml(item.id) + '">Approve & publish</button>' +
      '<button type="button" class="btn" data-candidate-review="reject" data-candidate-id="' + escapeHtml(item.id) + '">Reject</button></div></article>';
  }).join("");
}

async function loadAdminCandidates() {
  if (!supabase || !currentUser || currentRole !== "admin") return;
  const root = byId("candidateReviewList");
  if (root) root.textContent = "Loading pending Google Search candidates…";
  const { data, error } = await supabase.from("opportunity_discovery_candidates")
    .select("id,category,name,country,dsp_name,genres,website_url,submission_url,contact_email,submission_method,accepts_free_submissions,activity_status,source_name,source_url,evidence_url,verification_reason,review_status,created_at")
    .eq("review_status","pending").order("created_at",{ascending:false}).limit(100);
  if (error) throw error;
  adminDiscoveryCandidates = data || [];
  renderAdminCandidates();
}

async function publishAllPendingCandidates() {
  if (currentRole !== "admin") throw new Error("Administrator access is required.");
  const { data, error } = await supabase.rpc("admin_publish_all_pending_opportunity_candidates");
  if (error) throw error;
  const result = data || {};
  const published = Number(result.published || 0);
  const duplicates = Number(result.duplicates || 0);
  const skipped = Number(result.skipped || 0);
  setMessage("candidateReviewResult",
    "Bulk publication complete: " + published + " published, " + duplicates +
    " matched existing listings, " + skipped + " left pending because source evidence or a submission route needs attention. All published listings remain external-only; in-platform delivery is disabled.");
  await Promise.all([loadAdminCandidates(), loadAdminDirectory(), loadDirectory()]);
}

async function reviewAdminCandidate(id, decision) {
  if (currentRole !== "admin") throw new Error("Administrator access is required.");
  const { data, error } = await supabase.rpc("admin_review_opportunity_candidate", {
    p_candidate_id: id,
    p_decision: decision
  });
  if (error) throw error;
  setMessage("candidateReviewResult", decision === "accept"
    ? "Candidate approved and published as a public listing. In-platform delivery remains disabled."
    : "Candidate rejected and kept out of the public directory.");
  await Promise.all([loadAdminCandidates(), loadAdminDirectory(), loadDirectory()]);
}

function editAdminDirectoryRecord(id) {
  if (currentRole !== "admin") return;
  const item = adminDirectoryRecords.find(record => record.id === id);
  if (!item) return;
  byId("directoryId").value = item.id;
  byId("directoryCategory").value = item.category;
  byId("directoryName").value = item.name || "";
  byId("directoryCountry").value = item.country || "";
  byId("directoryGenres").value = (item.genres || []).join(", ");
  byId("directoryWebsite").value = item.website_url || "";
  byId("directorySubmission").value = item.submission_url || "";
  byId("directoryEmail").value = item.contact_email || "";
  byId("directoryEvidence").value = item.verification_evidence_url || "";
  byId("directoryVerified").checked = Boolean(item.is_verified);
  byId("directoryActive").checked = Boolean(item.is_active);
  byId("directoryPublic").checked = Boolean(item.is_public);
  setMessage("directoryResult", "Editing " + item.name + ". Save to apply changes.");
  byId("directoryName")?.focus();
}

async function saveAdminDirectoryRecord() {
  if (currentRole !== "admin") throw new Error("Administrator access is required.");
  const name = byId("directoryName").value.trim();
  if (!name) throw new Error("A directory listing name is required.");
  const websiteRaw = byId("directoryWebsite").value.trim();
  const submissionRaw = byId("directorySubmission").value.trim();
  const evidenceRaw = byId("directoryEvidence").value.trim();
  const website = safeHttpUrl(websiteRaw);
  const submission = safeHttpUrl(submissionRaw);
  const evidence = safeHttpUrl(evidenceRaw);
  if (websiteRaw && !website) throw new Error("Official website must be a valid http:// or https:// URL.");
  if (submissionRaw && !submission) throw new Error("Submission page must be a valid http:// or https:// URL.");
  if (byId("directoryVerified").checked && !evidence) {
    throw new Error("Provide a public verification evidence URL before marking this listing verified.");
  }
  if (evidenceRaw && !evidence) throw new Error("Verification evidence must be a valid http:// or https:// URL.");
  const { error } = await supabase.rpc("admin_upsert_opportunity_directory", {
    p_category: byId("directoryCategory").value,
    p_name: name,
    p_country: byId("directoryCountry").value.trim() || null,
    p_website_url: website,
    p_submission_url: submission,
    p_contact_email: byId("directoryEmail").value.trim() || null,
    p_genres: splitList(byId("directoryGenres").value, 20),
    p_is_verified: byId("directoryVerified").checked,
    p_is_active: byId("directoryActive").checked,
    p_is_public: byId("directoryPublic").checked,
    p_verification_evidence_url: evidence,
    p_id: byId("directoryId").value || null
  });
  if (error) throw error;
  clearAdminDirectoryForm();
  setMessage("directoryResult", "Directory listing saved. Integration and credit-charged submissions remain locked until the delivery adapter is deployed.");
  await Promise.all([loadAdminDirectory(), loadDirectory()]);
}

function formatZar(minor) {
  return new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR" }).format(Number(minor || 0) / 100);
}

async function loadArtistInvoices() {
  const root = byId("artistInvoices");
  if (!root || !supabase || !currentUser) return;
  root.className = "empty";
  root.textContent = "Loading your invoices…";
  const { data, error } = await supabase.from("artist_invoices")
    .select("id,invoice_number,total_minor,currency,status,created_at,due_at")
    .eq("artist_id", currentUser.id).order("created_at", { ascending: false });
  if (error) { root.className = "empty"; root.textContent = "Invoice service is not available yet. Please check again after billing is enabled."; return; }
  if (!data?.length) {
    root.className = "empty";
    root.textContent = "No invoices have been issued to this artist account yet.";
    return;
  }
  root.className = "";
  root.innerHTML = data.map(invoice => {
    const payable = ["open", "pending_payment"].includes(invoice.status);
    const due = invoice.due_at ? new Date(invoice.due_at).toLocaleDateString("en-ZA") : "No due date";
    return '<div class="track"><div><b>' + escapeHtml(invoice.invoice_number) + '</b><br><span class="muted">' +
      escapeHtml(formatZar(invoice.total_minor)) + ' · ' + escapeHtml(invoice.status.replaceAll("_", " ")) +
      ' · ' + escapeHtml(due) + '</span></div><div>' + (payable
        ? '<button class="btn primary" type="button" data-pay-invoice="' + escapeHtml(invoice.id) + '">Pay securely</button>'
        : '<span class="status ' + (invoice.status === "paid" ? "approved" : "pending") + '">' + escapeHtml(invoice.status.toUpperCase()) + '</span>') +
      '</div></div>';
  }).join("");
}

async function startInvoiceCheckout(invoiceId, button) {
  requireUser();
  if (button) { button.disabled = true; button.textContent = "Preparing checkout…"; }
  try {
    const { data, error } = await supabase.functions.invoke("create-paystack-checkout", { body: { invoice_id: invoiceId } });
    if (error) throw error;
    const checkout = safeHttpUrl(data?.checkout_url);
    if (!checkout || new URL(checkout).hostname !== "checkout.paystack.com") {
      throw new Error(data?.error || "The provider did not return a recognised secure checkout link.");
    }
    window.location.assign(checkout);
  } catch (error) {
    setMessage("authResult", error.message || "Secure checkout could not be started.", true);
    if (button) { button.disabled = false; button.textContent = "Pay securely"; }
  }
}

async function refreshAdminPaymentStatus() {
  if (currentRole !== "admin" || !supabase) return;
  const status = byId("paymentProviderStatus");
  const payout = byId("paymentPayoutStatus");
  const message = byId("paymentProviderMessage");
  if (status) status.textContent = "Checking…";
  if (message) message.textContent = "Verifying the server-side Paystack credential with the provider…";
  const { data, error } = await supabase.functions.invoke("payment-admin-status", { body: {} });
  if (error) throw error;
  if (status) status.textContent = data?.connection_status === "connected"
    ? "API verified · " + String(data.environment || "unknown").toUpperCase()
    : String(data?.connection_status || "not connected").replaceAll("_", " ");
  if (payout) payout.textContent = data?.payouts_ready ? "Enabled" : "Not enabled / provider approval required";
  if (message) message.textContent = data?.message || data?.error || "No provider status returned.";
}

async function loadAdminInvoiceArtists() {
  if (currentRole !== "admin" || !supabase) return;
  const select = byId("invoiceArtist");
  if (!select) return;
  const { data, error } = await supabase.rpc("admin_list_invoice_artists");
  if (error) throw error;
  select.innerHTML = '<option value="">Choose an artist account</option>' + (data || []).map(artist =>
    '<option value="' + escapeHtml(artist.id) + '">' + escapeHtml(artist.artist_name || "Unnamed artist") +
    (artist.country ? ' · ' + escapeHtml(artist.country) : "") + '</option>'
  ).join("");
}

async function loadAdminInvoices() {
  if (currentRole !== "admin" || !supabase) return;
  const root = byId("adminInvoiceList");
  if (!root) return;
  const { data, error } = await supabase.from("artist_invoices")
    .select("id,invoice_number,artist_id,total_minor,status,created_at")
    .order("created_at", { ascending: false }).limit(30);
  if (error) throw error;
  if (!data?.length) { root.className = "empty"; root.textContent = "No invoices created yet."; return; }
  root.className = "";
  root.innerHTML = data.map(invoice => '<div class="track"><div><b>' + escapeHtml(invoice.invoice_number) +
    '</b><br><span class="muted">Artist ID: ' + escapeHtml(invoice.artist_id) + ' · ' +
    escapeHtml(formatZar(invoice.total_minor)) + ' · ' + escapeHtml(invoice.status.replaceAll("_", " ")) +
    '</span></div></div>').join("");
}

async function createAdminInvoice(event) {
  if (currentRole !== "admin") throw new Error("Administrator access is required.");
  const artistId = byId("invoiceArtist")?.value;
  const description = byId("invoiceDescription")?.value.trim();
  const quantity = Number(byId("invoiceQuantity")?.value || 1);
  const amount = Number(byId("invoiceUnitAmount")?.value);
  const credits = Number(byId("invoiceCredits")?.value || 0);
  const amountMinor = Math.round(amount * 100);
  if (!artistId || !description) throw new Error("Choose an artist and enter the service description.");
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 1000) throw new Error("Quantity must be between 1 and 1,000.");
  if (!Number.isFinite(amount) || amount <= 0 || Math.abs(amount * 100 - amountMinor) > 0.0001) throw new Error("Enter a valid ZAR amount with no more than two decimal places.");
  if (!Number.isInteger(credits) || credits < 0 || credits > 100000) throw new Error("Credit quantity must be a whole number from 0 to 100,000.");
  const dueValue = byId("invoiceDue")?.value;
  const dueAt = dueValue ? new Date(dueValue + "T23:59:59+02:00").toISOString() : null;
  const { data, error } = await supabase.rpc("admin_create_artist_invoice", {
    p_artist_id: artistId,
    p_items: [{ description, quantity, unit_amount_minor: amountMinor, credit_quantity: credits }],
    p_tax_minor: 0,
    p_notes: byId("invoiceNotes")?.value.trim() || "",
    p_due_at: dueAt
  });
  if (error) throw error;
  byId("adminInvoiceForm").reset();
  if (byId("invoiceQuantity")) byId("invoiceQuantity").value = "1";
  if (byId("invoiceCredits")) byId("invoiceCredits").value = "0";
  setMessage("adminInvoiceResult", "Invoice created: " + String(data) + ". The artist can now view it in Invoices & payments.");
  await Promise.all([loadAdminInvoices(), loadArtistInvoices()]);
}
async function loadArtistWorkspace() {
  if (!supabase || !currentUser) return;
  try {
    const profile = await loadArtistProfile();
    if (!profile) throw new Error("Your artist profile has not been created yet. Please refresh after confirming your email.");
    await Promise.all([loadArtistSubmissions(), loadCreditBalance(), loadMarketplaceShares(), loadCampaigns(), loadArtistInvoices()]);
    if (currentRole === "admin") {
      const adminLoads = await Promise.allSettled([
        loadAdminMarketplaceQueue(), loadAdminDirectory(), loadAdminCandidates(), refreshAdminPaymentStatus(),
        loadAdminInvoiceArtists(), loadAdminInvoices()
      ]);
      const failures = adminLoads.filter(result => result.status === "rejected");
      if (failures.length && byId("paymentProviderMessage")) {
        byId("paymentProviderMessage").textContent = failures.map(result => result.reason?.message || "An admin finance service is not deployed yet.").join(" · ");
      }
    }
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
    if (byId("adminDashboardTile")) byId("adminDashboardTile").hidden = true;
    if (byId("artistInvoices")) { byId("artistInvoices").className = "empty"; byId("artistInvoices").textContent = "Sign in to view your invoices."; }
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

byId("publishAllCandidates")?.addEventListener("click", async event => {
  const button = event.currentTarget;
  if (currentRole !== "admin") {
    setMessage("candidateReviewResult", "Administrator access is required.", true);
    return;
  }
  if (!window.confirm("Publish every eligible pending submission candidate to the public directory? Listings remain external-only; no artist submissions or credits will be dispatched.")) return;
  button.disabled = true;
  try {
    await publishAllPendingCandidates();
  } catch (error) {
    setMessage("candidateReviewResult", error?.message || "Bulk candidate publication failed.", true);
  } finally {
    button.disabled = false;
  }
});
byId("candidateReviewList")?.addEventListener("click", async event => {
  const button = event.target.closest("button[data-candidate-review][data-candidate-id]");
  if (!button) return;
  button.disabled = true;
  try {
    await reviewAdminCandidate(button.dataset.candidateId, button.dataset.candidateReview);
  } catch (error) {
    setMessage("candidateReviewResult", error?.message || "Candidate review failed.", true);
  } finally {
    button.disabled = false;
  }
});
byId("adminDirectoryList")?.addEventListener("click", event => {
  const button = event.target.closest("button[data-directory-edit]");
  if (button) editAdminDirectoryRecord(button.dataset.directoryEdit);
});
byId("directoryClear")?.addEventListener("click", clearAdminDirectoryForm);
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
attachBackendForm("adminDirectoryForm", saveAdminDirectoryRecord);

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
