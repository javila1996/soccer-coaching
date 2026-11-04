/* ===========================================================
   1. EDIT THESE
   - SUPABASE_URL and SUPABASE_ANON_KEY: Supabase dashboard,
     Project Settings, API. The anon key is meant to be public;
     the database rules in supabase-setup.sql protect the data.
   - EVENT: fill in what you know. Empty lines are hidden.
   =========================================================== */
const CONFIG = {
  SUPABASE_URL: "https://atwlllkelhvoumhuihyn.supabase.co/rest/v1/",
  SUPABASE_ANON_KEY: "sb_publishable_SmCVeJ_k6nzZGpV1fQPccw_zn9XwJnn",
  EVENT: { date: "Nov 29 2026", time: "6:30 pm", place: "TBD" }
};

const TEAMS = {
  u11: {
    label: "Thunder U11 Avila",
    players: ["Ari De La Rosa","Brewer Spencer","Carson Rudolph","Christopher Lopez","Fabian Boscan","Grey Williams","Harvey Sorenson","Jose Orozco","Kalyan Ohene-Opare","Khuslen Munkhtulga","Michael Garcia","Tommy Betteridge","Troy Varella"]
  },
  u19: {
    label: "Thunder U19 Avila",
    players: ["Andres Fuentes","Chris Hoskins","Emmanuel Medrano","Jack Hunsaker","Jeremiah Jones","Jon Hoskins","Kenyon Hughes","Maxon Jorgensen","Mckinley Fernandez","Nash Mugge","Nate Jones","Noah Stubbs","Sam Olsen","Sammy Molina","Santi Mazal","Will Bunker","Zack Braithwaite"]
  }
};

/* ---------- helpers ---------- */
const $ = (id) => document.getElementById(id);
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const keyOf = (team, name) => team + "-" + slug(name);
const esc = (s) => { const d = document.createElement("div"); d.textContent = s == null ? "" : String(s); return d.innerHTML; };
const plural = (n) => (n === 1 ? "person" : "people");
function say(el, text, kind) { el.textContent = text; el.className = "msg" + (kind ? " " + kind : ""); }

const configured = /^https:\/\//.test(CONFIG.SUPABASE_URL) && !CONFIG.SUPABASE_ANON_KEY.startsWith("PASTE");
const sb = configured && window.supabase
  ? window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY)
  : null;

let taken = new Set();
let rows = [];
let busy = false;

/* ---------- event details (hidden when empty) ---------- */
(function details() {
  const items = [["Date", CONFIG.EVENT.date], ["Time", CONFIG.EVENT.time], ["Where", CONFIG.EVENT.place]].filter((i) => i[1]);
  if (!items.length) return;
  $("details").innerHTML = items.map((i) => "<dt>" + esc(i[0]) + "</dt><dd>" + esc(i[1]) + "</dd>").join("");
  $("details").hidden = false;
})();

if (!sb) {
  $("banner").hidden = false;
  $("banner").textContent = "Setup needed: add your Supabase URL and key in app.js so RSVPs can be saved.";
}

/* ---------- picker ---------- */
function fillPlayers() {
  const t = $("team").value, sel = $("player");
  $("taken").hidden = true;
  $("submit").disabled = false;
  if (!t) {
    sel.innerHTML = '<option value="">Select a team first</option>';
    sel.disabled = true;
    return;
  }
  sel.disabled = false;
  sel.innerHTML = '<option value="">Select your player</option>' +
    TEAMS[t].players.map((p) => '<option value="' + esc(p) + '">' + esc(p) + "</option>").join("");
}
function checkTaken() {
  const t = $("team").value, p = $("player").value;
  const isTaken = !!(t && p && taken.has(keyOf(t, p)));
  $("taken").hidden = !isTaken;
  $("submit").disabled = isTaken;
}
async function loadTaken() {
  if (!sb) return;
  const { data, error } = await sb.from("taken_players").select("player_key");
  if (!error && data) { taken = new Set(data.map((r) => r.player_key)); checkTaken(); }
}

$("team").addEventListener("change", () => { fillPlayers(); say($("msg"), ""); });
$("player").addEventListener("change", () => { checkTaken(); say($("msg"), ""); });

/* ---------- attending / stepper ---------- */
function syncStatus() {
  const yes = $("yes").checked;
  $("extra-box").hidden = !yes;
  if (!yes) $("extra").value = 0;
}
document.querySelectorAll('input[name="status"]').forEach((r) => r.addEventListener("change", syncStatus));
function bump(d) {
  const v = Math.max(0, Math.min(20, (parseInt($("extra").value, 10) || 0) + d));
  $("extra").value = v;
}
$("minus").addEventListener("click", () => bump(-1));
$("plus").addEventListener("click", () => bump(1));
$("extra").addEventListener("change", () => bump(0));

/* ---------- submit ---------- */
$("form").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (busy) return;
  const msg = $("msg"), team = $("team").value, player = $("player").value;
  if (!sb) return say(msg, "RSVPs are not connected yet. Please contact Coach Josue.", "e");
  if (!team) return say(msg, "Please select a team.", "e");
  if (!player) return say(msg, "Please select your player.", "e");
  if (taken.has(keyOf(team, player))) return checkTaken();

  const yes = $("yes").checked;
  const extra = yes ? Math.max(0, Math.min(20, parseInt($("extra").value, 10) || 0)) : 0;
  busy = true; $("submit").disabled = true; say(msg, "Saving…");

  const { error } = await sb.from("rsvps").insert({
    player_key: keyOf(team, player),
    team: team,
    player: player,
    status: yes ? "yes" : "no",
    extra: extra,
    note: $("note").value.trim().slice(0, 200) || null
  });
  busy = false; $("submit").disabled = false;

  if (error) {
    if (error.code === "23505") {
      await loadTaken();
      $("taken").hidden = false;
      $("submit").disabled = true;
      return say(msg, "", "");
    }
    return say(msg, "Sorry, that did not save. Check your connection and try again.", "e");
  }
  taken.add(keyOf(team, player));
  $("form").hidden = true;
  $("done").hidden = false;
  $("done-h").textContent = yes ? "Thank you! See you there." : "Thanks for letting us know.";
  $("done-p").textContent = yes
    ? player + " plus " + extra + " additional " + plural(extra) + " (" + (extra + 1) + " total)."
    : player + " is marked as not attending.";
  say(msg, "");
});

$("another").addEventListener("click", () => {
  $("done").hidden = true; $("form").hidden = false;
  $("player").value = ""; $("note").value = ""; $("yes").checked = true; $("extra").value = 0;
  syncStatus(); checkTaken(); loadTaken();
});

/* ---------- coach / manager ---------- */
async function showCoach() {
  $("coach").hidden = false;
  $("coach").scrollIntoView({ behavior: "smooth" });
  if (!sb) return;
  const { data } = await sb.auth.getSession();
  data && data.session ? openDash() : closeDash();
}
function closeDash() {
  $("login").hidden = false; $("dash").hidden = true;
  $("refresh").hidden = true; $("logout").hidden = true;
}
async function openDash() {
  $("login").hidden = true; $("dash").hidden = false;
  $("refresh").hidden = false; $("logout").hidden = false;
  await loadRows();
}
$("coach-link").addEventListener("click", showCoach);
$("refresh").addEventListener("click", loadRows);
$("logout").addEventListener("click", async () => { await sb.auth.signOut(); rows = []; closeDash(); });

$("login").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (error) return say($("login-msg"), "Login failed: " + error.message, "e");
  const { error } = await sb.auth.signInWithPassword({ email: $("email").value.trim(), password: $("pw").value });
  if (error) return say($("login-msg"), "That email or password did not work.", "e");
  $("pw").value = ""; say($("login-msg"), "");
  openDash();
});

async function loadRows() {
  const { data, error } = await sb.from("rsvps").select("*");
  if (error) { $("dash").innerHTML = '<p class="msg e">Could not load RSVPs. Try logging in again.</p>'; return; }
  rows = data || [];
  renderDash();
}

function renderDash() {
  const sorted = rows.slice().sort((a, b) => (a.team + a.player).localeCompare(b.team + b.player));
  const yes = sorted.filter((r) => r.status === "yes");
  const extras = yes.reduce((s, r) => s + (r.extra || 0), 0);
  const teamTotal = (t) => { const y = yes.filter((r) => r.team === t); return y.length + y.reduce((s, r) => s + (r.extra || 0), 0); };

  let h = '<div class="tot"><div><b>' + (yes.length + extras) + "</b><span>Total people</span></div>" +
    "<div><b>" + yes.length + "</b><span>Players</span></div>" +
    "<div><b>" + extras + "</b><span>Additional</span></div></div>" +
    "<p>" + esc(TEAMS.u11.label) + ": " + teamTotal("u11") + " people. " + esc(TEAMS.u19.label) + ": " + teamTotal("u19") + " people. " + sorted.length + " RSVPs in.</p>";

  h += '<div class="tablewrap"><table><thead><tr><th>Player</th><th>Team</th><th>Status</th><th>Extra</th><th>Note</th><th></th></tr></thead><tbody>';
  if (!sorted.length) h += '<tr><td colspan="6">No RSVPs yet.</td></tr>';
  sorted.forEach((r) => {
    h += "<tr><td>" + esc(r.player) + "</td><td>" + esc(r.team === "u11" ? "U11" : "U19") + "</td>" +
      '<td class="' + (r.status === "yes" ? "" : "no") + '">' + (r.status === "yes" ? "Coming" : "Can’t make it") + "</td>" +
      "<td>" + (r.status === "yes" ? r.extra : "–") + "</td><td>" + esc(r.note || "") + "</td>" +
      '<td><button class="act" data-edit="' + esc(r.player_key) + '">Edit</button>' +
      '<button class="act del" data-del="' + esc(r.player_key) + '">Remove</button></td></tr>';
  });
  h += "</tbody></table></div>";

  const have = new Set(sorted.map((r) => r.player_key));
  let pend = "";
  Object.keys(TEAMS).forEach((t) => {
    const m = TEAMS[t].players.filter((p) => !have.has(keyOf(t, p)));
    if (m.length) pend += "<p><b>" + esc(TEAMS[t].label) + " (" + m.length + "):</b> " + m.map(esc).join(", ") + "</p>";
  });
  h += '<div class="pending"><h3>Not yet responded</h3>' + (pend || "<p>Everyone has responded.</p>") + "</div>";
  $("dash").innerHTML = h;
}

$("dash").addEventListener("click", async (e) => {
  const b = e.target.closest("button"); if (!b) return;
  if (b.dataset.edit) {
    const r = rows.find((x) => x.player_key === b.dataset.edit); if (!r) return;
    $("edit").dataset.key = r.player_key;
    $("edit-h").textContent = "Edit RSVP: " + r.player;
    $("e-status").value = r.status; $("e-extra").value = r.extra || 0; $("e-note").value = r.note || "";
    say($("e-msg"), ""); $("edit").showModal();
  } else if (b.dataset.del) {
    const r = rows.find((x) => x.player_key === b.dataset.del);
    if (r && confirm("Remove the RSVP for " + r.player + "? This lets the family submit again.")) {
      const { error } = await sb.from("rsvps").delete().eq("player_key", r.player_key);
      if (error) alert("Could not remove it."); else { await loadRows(); loadTaken(); }
    }
  }
});

$("e-save").addEventListener("click", async () => {
  const key = $("edit").dataset.key, yes = $("e-status").value === "yes";
  const extra = yes ? Math.max(0, Math.min(20, parseInt($("e-extra").value, 10) || 0)) : 0;
  say($("e-msg"), "Saving…");
  const { error } = await sb.from("rsvps").update({ status: $("e-status").value, extra: extra, note: $("e-note").value.trim().slice(0, 200) || null }).eq("player_key", key);
  if (error) return say($("e-msg"), "Could not save that change.", "e");
  $("edit").close(); loadRows();
});

/* ---------- start ---------- */
syncStatus();
loadTaken();
