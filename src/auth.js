import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "../supabase-config.js";

const configured =
  /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(SUPABASE_URL) &&
  SUPABASE_ANON_KEY.length > 20 &&
  !SUPABASE_URL.includes("YOUR-PROJECT") &&
  !SUPABASE_ANON_KEY.includes("YOUR_SUPABASE");

const authResult = document.getElementById("authResult");
const googleNotice = document.getElementById("googleNotice");
const message = (text) => {
  if (!authResult) return;
  authResult.style.display = "block";
  authResult.textContent = text;
};
const client = configured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    })
  : null;

window.artistFrequencySupabase = client;

if (!client) {
  message("Supabase is not configured yet. Add your Project URL and publishable/anon key to supabase-config.js. No credentials were sent.");
  if (googleNotice) googleNotice.textContent = "Google sign-in will activate after Supabase credentials and Google OAuth provider settings are configured.";
} else {
  const { data: { session } } = await client.auth.getSession();
  if (session?.user) message(`Signed in as ${session.user.email}. Your artist workspace is connected.`);

  client.auth.onAuthStateChange((_event, sessionNow) => {
    if (sessionNow?.user) message(`Signed in as ${sessionNow.user.email}. Your artist workspace is connected.`);
  });

  document.getElementById("authPreviewForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = document.getElementById("authEmail").value.trim();
    const password = document.getElementById("authPassword").value;
    const artistName = document.getElementById("profileArtistName")?.value.trim() || "";
    const button = event.submitter;
    if (button) button.disabled = true;
    message("Creating your secure account…");
    try {
      const { data, error } = await client.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: window.location.origin,
          data: { artist_name: artistName }
        }
      });
      if (error) throw error;
      message(data.session
        ? "Account created and signed in. Complete your artist profile next."
        : "Registration received. Check your email to confirm your account before signing in.");
    } catch (error) {
      message(error.message || "Registration failed. Please try again.");
    } finally {
      if (button) button.disabled = false;
    }
  });

  document.getElementById("emailSignIn")?.addEventListener("click", async () => {
    const email = document.getElementById("authEmail").value.trim();
    const password = document.getElementById("authPassword").value;
    message("Signing in securely…");
    try {
      const { error } = await client.auth.signInWithPassword({ email, password });
      if (error) throw error;
      message("Signed in successfully. Your artist workspace is ready.");
    } catch (error) {
      message(error.message || "Sign-in failed. Check your details and try again.");
    }
  });

  document.getElementById("googleSignIn")?.addEventListener("click", async () => {
    if (googleNotice) googleNotice.textContent = "Connecting to Google…";
    const { error } = await client.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin }
    });
    if (error && googleNotice) googleNotice.textContent = error.message;
  });
}
