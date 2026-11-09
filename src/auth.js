import { supabase, isSupabaseConfigured } from "./supabase-client.js";

const authResult = document.getElementById("authResult");
const googleNotice = document.getElementById("googleNotice");
const signOutButton = document.getElementById("signOut");
const signedInAs = document.getElementById("signedInAs");

function showAuthMessage(text, isError = false) {
  if (!authResult) return;
  authResult.style.display = "block";
  authResult.textContent = text;
  authResult.style.borderColor = isError ? "#8c4545" : "";
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
    showAuthMessage("Creating your secure artist account…");
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: window.location.origin,
          data: { artist_name: artistName }
        }
      });
      if (error) throw error;
      showAuthMessage(data.session
        ? "Account created and signed in. Your artist workspace is loading."
        : "Registration received. Check your email to confirm your account, then sign in.");
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
    showAuthMessage("Signing in securely…");
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      showAuthMessage("Signed in. Your artist workspace is loading.");
    } catch (error) {
      showAuthMessage(error.message || "Sign-in failed. Check your details and try again.", true);
    } finally {
      if (button) button.disabled = false;
    }
  });

  document.getElementById("googleSignIn")?.addEventListener("click", async () => {
    if (googleNotice) googleNotice.textContent = "Connecting to Google…";
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.origin }
      });
      if (error) throw error;
    } catch (error) {
      if (googleNotice) googleNotice.textContent = error.message || "Google sign-in could not start.";
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
    googleNotice.textContent = "Google sign-in requires the Google provider and redirect URL to be enabled in Supabase Auth settings.";
  }
}
