// Account tab — sign up / sign in / magic link / sign out, all built on
// supabase.js. Inactive (shows "not configured") until SUPABASE_ANON_KEY
// is pasted into supabase-config.js. Lights up automatically once it is.
//
// Auth modes:
//   - Email + password (primary)
//   - Magic link (passwordless email — frictionless)
//   - Google OAuth (one-tap on phone)
//   - Apple Sign-In comes in a follow-up migration (requires Apple Dev account)

import { state, save } from "../store.js";
import { h, toast } from "../util.js";
import {
  isSupabaseConfigured,
  signUpWithEmail,
  signInWithEmail,
  signInWithGoogle,
  sendMagicLink,
  signOut,
  currentUser,
} from "../supabase.js";

function renderNotConfigured() {
  return h("section", { class: "card" }, [
    h("h2", {}, "Account · backend coming soon"),
    h("div", { class: "sub" },
      "Right now your data lives on this device only. Once we connect the backend (Supabase, already half-wired), you'll be able to sign up here so your data syncs across phones, your computer, your tablet — and so we can wire up partner accounts, family plans, and proper subscriptions."),
    h("div", { class: "alert", style: "margin-top:10px" },
      "Status: Supabase project is connected at the URL committed in code. Awaiting the anon key. When that lands and you reload, this tab becomes a real sign-up form."),
  ]);
}

export function renderAccount(mount, { rerender }) {
  if (!isSupabaseConfigured()) {
    mount.append(renderNotConfigured());
    return;
  }

  // Active account UI — kicks in once the anon key lands
  const card = h("section", { class: "card" }, [
    h("h2", {}, "Sign in to sync your data"),
    h("div", { class: "sub" }, "Your data lives in your account, encrypted on the server, restorable on any device. Sign in once."),
  ]);

  // Live-fetch the current user; render either the sign-in form or the signed-in view
  const formContainer = h("div");
  card.append(formContainer);
  mount.append(card);

  currentUser().then((user) => {
    if (user) renderSignedIn(formContainer, user, rerender);
    else renderSignInForm(formContainer, rerender);
  });
}

function renderSignInForm(container, rerender) {
  container.innerHTML = "";

  let mode = "signin"; // 'signin' | 'signup' | 'magic'

  function paint() {
    container.innerHTML = "";

    // Mode toggle
    container.append(h("div", { class: "chip-row", style: "margin-bottom:12px" }, [
      h("button", { class: "chip" + (mode === "signin" ? " active" : ""), onclick: () => { mode = "signin"; paint(); } }, "Sign in"),
      h("button", { class: "chip" + (mode === "signup" ? " active" : ""), onclick: () => { mode = "signup"; paint(); } }, "Create account"),
      h("button", { class: "chip" + (mode === "magic" ? " active" : ""), onclick: () => { mode = "magic"; paint(); } }, "Email me a link"),
    ]));

    // One-tap Google button — works in all three modes
    container.append(h("button", {
      class: "btn secondary",
      style: "width:100%; margin-bottom:14px",
      onclick: async () => {
        try { await signInWithGoogle(); }
        catch (e) { toast(e.message || "Couldn't start Google sign-in"); }
      },
    }, "🔵 Continue with Google"));

    if (mode === "magic") {
      const form = h("form", { class: "form-row", onsubmit: async (e) => {
        e.preventDefault();
        const email = new FormData(e.target).get("email").toString().trim();
        if (!email) return;
        try {
          const { error } = await sendMagicLink(email);
          if (error) throw error;
          toast("Check your email for the link");
        } catch (err) {
          toast(err.message || "Couldn't send link");
        }
      } }, [
        h("label", { class: "field" }, [
          "Your email",
          h("input", { type: "email", name: "email", required: true, placeholder: "you@example.com" }),
        ]),
        h("button", { class: "btn", type: "submit" }, "Send magic link"),
      ]);
      container.append(form);
      return;
    }

    // signin / signup share fields
    const form = h("form", { class: "form-row", onsubmit: async (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      const email = (f.get("email") || "").toString().trim();
      const password = (f.get("password") || "").toString();
      if (!email || !password) return;
      try {
        const { data, error } = mode === "signup"
          ? await signUpWithEmail(email, password)
          : await signInWithEmail(email, password);
        if (error) throw error;
        if (mode === "signup" && data?.user && !data?.session) {
          toast("Check your email to confirm your account");
        } else {
          toast("Signed in");
        }
        rerender();
      } catch (err) {
        toast(err.message || (mode === "signup" ? "Couldn't create account" : "Sign-in failed"));
      }
    } }, [
      h("label", { class: "field" }, [
        "Email",
        h("input", { type: "email", name: "email", required: true, placeholder: "you@example.com" }),
      ]),
      h("label", { class: "field" }, [
        "Password",
        h("input", { type: "password", name: "password", required: true, minlength: 8, placeholder: mode === "signup" ? "Pick a strong one (8+ chars)" : "Your password" }),
      ]),
      h("button", { class: "btn", type: "submit" }, mode === "signup" ? "Create account" : "Sign in"),
    ]);
    container.append(form);

    container.append(h("div", { class: "pda-contact", style: "margin-top:12px" },
      "Privacy: your password is never stored — Supabase hashes it server-side. Your data lives in your account with row-level security; nobody else can read it."));
  }

  paint();
}

function renderSignedIn(container, user, rerender) {
  container.innerHTML = "";
  container.append(h("div", { class: "alert ok" },
    `Signed in as ${user.email}`));
  container.append(h("div", { class: "btn-row", style: "margin-top:10px" }, [
    h("button", {
      class: "btn secondary",
      onclick: async () => {
        await signOut();
        toast("Signed out");
        rerender();
      },
    }, "Sign out"),
  ]));
  container.append(h("div", { class: "pda-contact", style: "margin-top:14px" },
    "Sync layer wires next — once you're signed in everywhere your data follows you."));
}
