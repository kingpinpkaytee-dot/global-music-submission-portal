import { supabase, isSupabaseConfigured } from "./supabase-client.js";

const authResult = document.getElementById("authResult");
const googleNotice = document.getElementById("googleNotice");
const spotifyNotice = document.getElementById("spotifyNotice");
const signOutButton = document.getElementById("signOut");
const signedInAs = document.getElementById("signedInAs");

function showAuthMessage(text, isError = false) {
  if (!authResult) return;
  authResult.style.display = "block";
  authResult.textContent = text;
  authResult.style.borderColor = isError ? "#8c4545" : "";
}

function postAuthRoute() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("authRequired") === "submission") return "/?view=submissions";
  const view = params.get("view");
  if (view && view !== "account") return "/?view=" + encodeURIComponent(view);
  return "/?view=dashboard";
}

function prepareAuthReturn() {
  const route = postAuthRoute();
  try {
    localStorage.setItem("artistFrequencyPostAuthRoute", route);
    sessionStorage.setItem("artistFrequencyPostAuthRoute", route);
  } catch {}
  return route;
}

function callbackUrl() {
  return window.location.origin + "/?view=account&authCallback=1";
}

function publishSession(session) {
  const email = session?.user?.email || "";
  if (signedInAs) signedInAs.textContent = email ? `Signed in as ${email}` : "Not signed in";
  if (signOutButton) signOutButton.hidden = !session?.user;
  window.dispatchEvent(new CustomEvent("artistfrequency:auth", {
    detail: { session, user: session?.user || null }
  }));
}

window.artistFrequencySupabase = supabase;

if (!isSupabaseConfigured || !supabase) {
  showAuthMessage("The secure sign-in service is not configured. Please contact the platform administrator.", true);
  if (googleNotice) googleNotice.textContent = "Google sign-in is unavailable until the Supabase client is configured.";
  document.getElementById("authPreviewForm")?.addEventListener("submit", event => event.preventDefault());
  document.getElementById("emailSignIn")?.addEventListener("click", () => showAuthMessage("Sign-in is not configured.", true));
  document.getElementById("googleSignIn")?.addEventListener("click", () => {
    if (googleNotice) googleNotice.textContent = "Sign-in is not configured.";
  });
} else {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    publishSession(data.session);
  } catch (error) {
    showAuthMessage(error.message || "Could not restore your sign-in session.", true);
  }

  supabase.auth.onAuthStateChange((_event, session) => publishSession(session));

  document.getElementById("authPreviewForm")?.addEventListener("submit", async event => {
    event.preventDefault();
    const email = document.getElementById("authEmail")?.value.trim();
    const password = document.getElementById("authPassword")?.value || "";
    const artistName = document.getElementById("profileArtistName")?.value.trim() || "";
    const button = event.submitter;
    if (!email || password.length < 8) {
      showAuthMessage("Enter a valid email address and a password of at least 8 characters.", true);
      return;
    }
    if (button) button.disabled = true;
    prepareAuthReturn();
    showAuthMessage("Creating your secure artist account…");
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: callbackUrl(),
          data: { artist_name: artistName }
        }
      });
      if (error) throw error;
      showAuthMessage(data.session
        ? "Account created and signed in. Your artist workspace is loading."
        : "Registration received. Check your email to confirm your account. The confirmation link will return you to Artist Frequency.");
    } catch (error) {
      showAuthMessage(error.message || "Registration failed. Please try again.", true);
    } finally {
      if (button) button.disabled = false;
    }
  });

  document.getElementById("emailSignIn")?.addEventListener("click", async () => {
    const email = document.getElementById("authEmail")?.value.trim();
    const password = document.getElementById("authPassword")?.value || "";
    if (!email || !password) {
      showAuthMessage("Enter your email address and password.", true);
      return;
    }
    const button = document.getElementById("emailSignIn");
    if (button) button.disabled = true;
    prepareAuthReturn();
    showAuthMessage("Signing in securely…");
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      showAuthMessage("Signed in. Returning you to your Artist Frequency workspace…");
    } catch (error) {
      showAuthMessage(error.message || "Sign-in failed. Check your details and try again.", true);
    } finally {
      if (button) button.disabled = false;
    }
  });

  document.getElementById("googleSignIn")?.addEventListener("click", async () => {
    if (googleNotice) googleNotice.textContent = "Connecting to Google…";
    prepareAuthReturn();
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: callbackUrl() }
      });
      if (error) throw error;
    } catch (error) {
      if (googleNotice) googleNotice.textContent = error.message || "Google sign-in could not start.";
    }
  });

  document.getElementById("spotifySignIn")?.addEventListener("click", async () => {
    if (spotifyNotice) spotifyNotice.textContent = "Connecting to Spotify…";
    prepareAuthReturn();
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "spotify",
        options: {
          redirectTo: callbackUrl(),
          scopes: "user-read-email"
        }
      });
      if (error) throw error;
    } catch (error) {
      if (spotifyNotice) spotifyNotice.textContent = error.message || "Spotify sign-in could not start.";
    }
  });

  signOutButton?.addEventListener("click", async () => {
    signOutButton.disabled = true;
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      showAuthMessage("You have signed out.");
    } catch (error) {
      showAuthMessage(error.message || "Sign-out failed.", true);
    } finally {
      signOutButton.disabled = false;
    }
  });

  if (googleNotice) {
    googleNotice.textContent = "Google sign-in returns to Artist Frequency after authorisation.";
  }
  if (spotifyNotice) {
    spotifyNotice.textContent = "Spotify sign-in returns to Artist Frequency after authorisation; your Spotify identity remains the selected sign-in provider.";
  }
}
