/* ===========================================================
   1. EDIT THESE THREE THINGS
   - SUPABASE_URL and SUPABASE_ANON_KEY: Supabase dashboard,
     Project Settings, API. The anon key is meant to be public;
     the database rules in supabase-setup.sql protect the data.
   - EVENT: fill in what you know. Empty lines stay hidden.
   =========================================================== */
const CONFIG = {
  SUPABASE_URL: "https://atwlllkelhvoumhuihyn.supabase.co/rest/v1/",
  SUPABASE_ANON_KEY: "sb_publishable_SmCVeJ_k6nzZGpV1fQPccw_zn9XwJnn",
  EVENT: { date: "Nov 19 2026", time: "6:30 pm", place: "TBD" }
};

/* ===========================================================
   2. ROSTERS (edit names here if they change)
   =========================================================== */
const TEAMS = {
  u11: {
    label: "Thunder U11 Avila",
    players: [
      "Ari De La Rosa", "Brewer Spencer", "Carson Rudolph", "Christopher Lopez",
      "Fabian Boscan", "Grey Williams", "Harvey Sorenson", "Jose Orozco",
      "Kalyan Ohene-Opare", "Khuslen Munkhtulga", "Michael Garcia",
      "Tommy Betteridge", "Troy Varella"
    ]
  },
  u19: {
    label: "Thunder U19 Avila",
    players: [
      "Andres Fuentes", "Chris Hoskins", "Emmanuel Medrano", "Jack Hunsaker",
      "Jeremiah Jones", "Jon Hoskins", "Kenyon Hughes", "Maxon Jorgensen",
      "Mckinley Fernandez", "Nash Mugge", "Nate Jones", "Noah Stubbs",
      "Sam Olsen", "Sammy Molina", "Santi Mazal", "Will Bunker", "Zack Braithwaite"
    ]
  }
};

/* ===========================================================
   3. HELPERS
   =========================================================== */
function $(id) { return document.getElementById(id); }

function slug(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
function keyOf(team, name) { return team + "-" + slug(name); }

function esc(s) {
  var d = document.createElement("div");
  d.textContent = s == null ? "" : String(s);
  return d.innerHTML;
}
function plural(n) { return n === 1 ? "person" : "people"; }

function say(el, text, kind) {
  el.textContent = text;
  el.className = "msg" + (kind ? " " + kind : "");
}
function showBanner(text) {
  var b = $("banner");
  b.textContent = text;
  b.hidden = !text;
}

var configured = /^https:\/\//.test(CONFIG.SUPABASE_URL) && CONFIG.SUPABASE_ANON_KEY.indexOf("PASTE") !== 0;
var sb = null;
if (configured && window.supabase) {
  sb = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
}

var taken = new Set();
var rows = [];
var busy = false;

if (!configured) {
  showBanner("Setup needed: add your Supabase URL and key at the top of app.js so RSVPs can be saved.");
} else if (!sb) {
  showBanner("The Supabase library did not load. Check the script tag near the bottom of index.html.");
}

/* ===========================================================
   4. EVENT DETAILS (hidden when empty)
   =========================================================== */
(function showDetails() {
  var items = [
    ["Date", CONFIG.EVENT.date],
    ["Time", CONFIG.EVENT.time],
    ["Where", CONFIG.EVENT.place]
  ].filter(function (i) { return i[1]; });
  if (!items.length) return;
  $("details").innerHTML = items.map(function (i) {
    return "<dt>" + esc(i[0]) + "</dt><dd>" + esc(i[1]) + "</dd>";
  }).join("");
  $("details").hidden = false;
})();

/* ===========================================================
   5. PLAYER PICKER
   =========================================================== */
function fillPlayers() {
  var t = $("team").value;
  var sel = $("player");
  $("taken").hidden = true;
  $("submit").disabled = false;
  if (!t) {
    sel.innerHTML = '<option value="">Select a team first</option>';
    sel.disabled = true;
    return;
  }
  sel.disabled = false;
  sel.innerHTML = '<option value="">Select your player</option>' +
    TEAMS[t].players.map(function (p) {
      return '<option value="' + esc(p) + '">' + esc(p) + "</option>";
    }).join("");
}

function checkTaken() {
  var t = $("team").value;
  var p = $("player").value;
  var isTaken = !!(t && p && taken.has(keyOf(t, p)));
  $("taken").hidden = !isTaken;
  $("submit").disabled = isTaken;
}

async function loadTaken() {
  if (!sb) return;
  var res = await sb.from("taken_players").select("player_key");
  if (res.error) {
    console.error("taken_players error:", res.error);
    showBanner("Could not check for existing entries. Please contact Coach Josue.");
    return;
  }
  showBanner("");
  taken = new Set((res.data || []).map(function (r) { return r.player_key; }));
  checkTaken();
}

$("team").addEventListener("change", function () {
  fillPlayers();
  say($("msg"), "");
});
$("player").addEventListener("change", function () {
  checkTaken();
  say($("msg"), "");
});

/* ===========================================================
   6. ATTENDING + ADDITIONAL PEOPLE
   =========================================================== */
function syncStatus() {
  var yes = $("yes").checked;
  $("extra-box").hidden = !yes;
  if (!yes) $("extra").value = 0;
}
document.querySelectorAll('input[name="status"]').forEach(function (r) {
  r.addEventListener("change", syncStatus);
});

function bump(d) {
  var v = (parseInt($("extra").value, 10) || 0) + d;
  $("extra").value = Math.max(0, Math.min(20, v));
}
$("minus").addEventListener("click", function () { bump(-1); });
$("plus").addEventListener("click", function () { bump(1); });
$("extra").addEventListener("change", function () { bump(0); });

/* ===========================================================
   7. SUBMIT AN RSVP
   =========================================================== */
$("form").addEventListener("submit", async function (e) {
  e.preventDefault();
  if (busy) return;

  var msg = $("msg");
  var team = $("team").value;
  var player = $("player").value;

  if (!sb) { say(msg, "RSVPs are not connected yet. Please contact Coach Josue.", "e"); return; }
  if (!team) { say(msg, "Please select a team.", "e"); return; }
  if (!player) { say(msg, "Please select your player.", "e"); return; }
  if (taken.has(keyOf(team, player))) { checkTaken(); return; }

  var yes = $("yes").checked;
  var extra = yes ? Math.max(0, Math.min(20, parseInt($("extra").value, 10) || 0)) : 0;
  var note = $("note").value.trim().slice(0, 200);

  busy = true;
  $("submit").disabled = true;
  say(msg, "Saving…");

  var res;
  try {
    res = await sb.from("rsvps").insert({
      player_key: keyOf(team, player),
      team: team,
      player: player,
      status: yes ? "yes" : "no",
      extra: extra,
      note: note || null
    });
  } catch (err) {
    res = { error: { message: String(err) } };
  }

  busy = false;
  $("submit").disabled = false;

  if (res.error) {
    console.error("insert error:", res.error);
    if (res.error.code === "23505") {
      // Someone else submitted this player a moment ago.
      await loadTaken();
      $("taken").hidden = false;
      $("submit").disabled = true;
      say(msg, "");
      return;
    }
    say(msg, "Sorry, that did not save. Check your connection and try again.", "e");
    return;
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

$("another").addEventListener("click", function () {
  $("done").hidden = true;
  $("form").hidden = false;
  $("player").value = "";
  $("note").value = "";
  $("yes").checked = true;
  $("extra").value = 0;
  syncStatus();
  checkTaken();
  loadTaken();
});

/* ===========================================================
   8. COACH / MANAGER LOGIN
   =========================================================== */
function closeDash() {
  $("login").hidden = false;
  $("dash").hidden = true;
  $("refresh").hidden = true;
  $("logout").hidden = true;
}

async function openDash() {
  $("login").hidden = true;
  $("dash").hidden = false;
  $("refresh").hidden = false;
  $("logout").hidden = false;
  await loadRows();
}

async function showCoach() {
  $("coach").hidden = false;
  $("coach").scrollIntoView({ behavior: "smooth" });
  if (!sb) return;
  var res = await sb.auth.getSession();
  if (res.data && res.data.session) { openDash(); } else { closeDash(); }
}

$("coach-link").addEventListener("click", showCoach);
$("refresh").addEventListener("click", function () { loadRows(); });
$("logout").addEventListener("click", async function () {
  if (sb) await sb.auth.signOut();
  rows = [];
  closeDash();
});

$("login").addEventListener("submit", async function (e) {
  e.preventDefault();
  var out = $("login-msg");

  if (!sb) { say(out, "Not connected yet. Check the Supabase URL and key in app.js.", "e"); return; }

  say(out, "Signing in…");
  var result;
  try {
    result = await sb.auth.signInWithPassword({
      email: $("email").value.trim(),
      password: $("pw").value
    });
  } catch (err) {
    say(out, "Login failed: " + String(err), "e");
    return;
  }

  if (result.error) {
    console.error("login error:", result.error);
    say(out, "Login failed: " + result.error.message, "e");
    return;
  }

  $("pw").value = "";
  say(out, "");
  openDash();
});

/* ===========================================================
   9. COACH DASHBOARD
   =========================================================== */
async function loadRows() {
  var res = await sb.from("rsvps").select("*");
  if (res.error) {
    console.error("load rows error:", res.error);
    $("dash").innerHTML = '<p class="msg e">Could not load RSVPs: ' + esc(res.error.message) + "</p>";
    return;
  }
  rows = res.data || [];
  renderDash();
}

function renderDash() {
  var sorted = rows.slice().sort(function (a, b) {
    return (a.team + a.player).localeCompare(b.team + b.player);
  });
  var yes = sorted.filter(function (r) { return r.status === "yes"; });
  var extras = yes.reduce(function (s, r) { return s + (r.extra || 0); }, 0);

  function teamTotal(t) {
    var y = yes.filter(function (r) { return r.team === t; });
    return y.length + y.reduce(function (s, r) { return s + (r.extra || 0); }, 0);
  }

  var h = '<div class="tot">' +
    "<div><b>" + (yes.length + extras) + "</b><span>Total people</span></div>" +
    "<div><b>" + yes.length + "</b><span>Players</span></div>" +
    "<div><b>" + extras + "</b><span>Additional</span></div></div>" +
    "<p>" + esc(TEAMS.u11.label) + ": " + teamTotal("u11") + " people. " +
    esc(TEAMS.u19.label) + ": " + teamTotal("u19") + " people. " +
    sorted.length + " RSVPs in.</p>";

  h += '<div class="tablewrap"><table><thead><tr>' +
    "<th>Player</th><th>Team</th><th>Status</th><th>Extra</th><th>Note</th><th></th>" +
    "</tr></thead><tbody>";

  if (!sorted.length) h += '<tr><td colspan="6">No RSVPs yet.</td></tr>';

  sorted.forEach(function (r) {
    var coming = r.status === "yes";
    h += "<tr>" +
      "<td>" + esc(r.player) + "</td>" +
      "<td>" + (r.team === "u11" ? "U11" : "U19") + "</td>" +
      '<td class="' + (coming ? "" : "no") + '">' + (coming ? "Coming" : "Can’t make it") + "</td>" +
      "<td>" + (coming ? r.extra : "–") + "</td>" +
      "<td>" + esc(r.note || "") + "</td>" +
      '<td><button class="act" data-edit="' + esc(r.player_key) + '">Edit</button>' +
      '<button class="act del" data-del="' + esc(r.player_key) + '">Remove</button></td>' +
      "</tr>";
  });
  h += "</tbody></table></div>";

  var have = new Set(sorted.map(function (r) { return r.player_key; }));
  var pending = "";
  Object.keys(TEAMS).forEach(function (t) {
    var missing = TEAMS[t].players.filter(function (p) { return !have.has(keyOf(t, p)); });
    if (missing.length) {
      pending += "<p><b>" + esc(TEAMS[t].label) + " (" + missing.length + "):</b> " +
        missing.map(esc).join(", ") + "</p>";
    }
  });
  h += '<div class="pending"><h3>Not yet responded</h3>' +
    (pending || "<p>Everyone has responded.</p>") + "</div>";

  $("dash").innerHTML = h;
}

$("dash").addEventListener("click", async function (e) {
  var b = e.target.closest("button");
  if (!b) return;

  if (b.dataset.edit) {
    var r = rows.find(function (x) { return x.player_key === b.dataset.edit; });
    if (!r) return;
    $("edit").dataset.key = r.player_key;
    $("edit-h").textContent = "Edit RSVP: " + r.player;
    $("e-status").value = r.status;
    $("e-extra").value = r.extra || 0;
    $("e-note").value = r.note || "";
    say($("e-msg"), "");
    $("edit").showModal();
    return;
  }

  if (b.dataset.del) {
    var target = rows.find(function (x) { return x.player_key === b.dataset.del; });
    if (!target) return;
    if (!confirm("Remove the RSVP for " + target.player + "? This lets the family submit again.")) return;
    var res = await sb.from("rsvps").delete().eq("player_key", target.player_key);
    if (res.error) { alert("Could not remove it: " + res.error.message); return; }
    await loadRows();
    loadTaken();
  }
});

$("e-save").addEventListener("click", async function () {
  var key = $("edit").dataset.key;
  var yes = $("e-status").value === "yes";
  var extra = yes ? Math.max(0, Math.min(20, parseInt($("e-extra").value, 10) || 0)) : 0;

  say($("e-msg"), "Saving…");
  var res = await sb.from("rsvps").update({
    status: $("e-status").value,
    extra: extra,
    note: $("e-note").value.trim().slice(0, 200) || null
  }).eq("player_key", key);

  if (res.error) {
    console.error("update error:", res.error);
    say($("e-msg"), "Could not save that change: " + res.error.message, "e");
    return;
  }
  $("edit").close();
  loadRows();
});

/* ===========================================================
   10. START
   =========================================================== */
syncStatus();
loadTaken();
