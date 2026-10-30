// =====================================================================
// DEPARTMENT OF MANAGEMENT OPERATIONS — event log approval bot
// A Cloudflare Worker (free, nothing to keep running).
//
//   /event log  -> a private panel with everything to fill in:
//       📝 Event details (event, date, notes)  — required
//       📎 Proof screenshot (upload box)        — required
//       Host (member search)                   — required
//       Attendees (member search, up to 25; ✏️ for anyone not in the
//       server)                                 — at least one
//       Co-hosts, Supervisor (member search)    — optional
//     every person is matched to their roster name, then Submit
//     -> #approval-logs with the proof, Approve / Deny, a roster check,
//        and the roster's Approvals page
//   Approve / Deny -> ONLY on the roster's Approvals page (the proof is
//              saved to Google Drive and shown there). On approval the
//              OFFICIAL log + proof is posted in #event-logs and the
//              roster gives the points; on denial the submitter is DM'd.
//   /lookup -> the Find/Edit profile: rank, ID, former tag, events,
//              quota, LOA, departments, awards, rank + LOA history
//              (punishments too, for approvers)
//   /roster update, /awardrequest, /loa -> a short form, posted in
//              the requests channel in the department's own formats. Names,
//              ranks and awards come from the roster as you type; LOA is MR+ only.
//              Roster + LOA requests can be approved or denied right here too
//              (reviewers), or on the roster's Approvals page.
//   /event schedule|cancel|list, /profile, /leaderboard, /mystats, /link,
//   /roster start|submit -> see "COMMUNITY FEATURES" further down.
//   Every 5 minutes (Cron Trigger "*/5 * * * *"): event announcements and
//   reminders, promotion posts, announcement mirror, Monday digest,
//   approvals reminder. Roles change on /link and when a roster or award
//   request is approved.
//
// Nothing is given out before approval.
// =====================================================================

const CONFIG = {
  APP_ID: "1554671679039606874",
  PUBLIC_KEY: "3cb6b887519da6962dca0a4d91bb678131e42a59484f2ee2a6d7a8f10fbad3e2",

  APPROVER_ROLE_ID: "1525337433892458618",   // only PINGED (12-hour reminder); who may approve comes from /link + DMO on the roster
  EVENT_LOG_CHANNEL_ID: "1488306262490742895",
  APPROVAL_CHANNEL_ID: "1496166593779073115",
  // Where requests are posted. Leave a type "" to use REQUEST_CHANNEL_ID,
  // and leave that "" to use the approval-logs channel until you have one.
  REQUEST_CHANNEL_ID: "",
  REQUEST_CHANNELS: { roster: "1492261816321966291", award: "1511822488936644648", loa: "1488310011443679413" },
  // The @Department of Management Operations role (the "Ping:" line on award requests).
  DMO_ROLE_ID: "1525337433892458618",


  // Ping the host, co-hosts and attendees (their Discord accounts):
  PING_IN_APPROVAL_LOG: true,   // when the log is posted for approval
  PING_IN_EVENT_LOG: true,      // again when it's approved and posted in #event-logs

  // ---- Community features (leave "" to switch a feature off) ----
  GUILD_ID: "1488260188413624511",                 // your server's ID (role sync + links in score notes)
  ROLE_AUTO_SYNC: true,                            // every 5 min: roles for linked members whose roster details changed
  HQ_URL: "",                   // the HQ site's public API, e.g. https://rna-hq.pages.dev/api/public (reads ?api=events, profile, hqroster, home, market)
  HQ_PROFILE_URL: "",           // someone's HQ profile page; {emp} = their employee #, e.g. "https://…/exec?page=profile&emp={emp}"
  EVENTS_CHANNEL_ID: "",        // event announcements + reminders
  SELFTEST_CHANNEL_ID: "1565825275533730042",   // weekly self-test report ("" = only post when something is wrong, in the approval-logs channel)
  MARKET_LOG_CHANNEL_ID: "1525333050471481454",
  MARKET_TICKET_CHANNEL_ID: "1488308159935418479",   // #support-line: Market items that need approval ask buyers to open a Misc ticket here    // where /market purchase requests are posted for approval ("" = the request / approval-logs channel)
  // Market perks that are just a Discord role: bought instantly (points taken, role given straight away, and taken
  // off again when the perk runs out). Matched to the shop item and the server role by name ("Perms" = "Permission").
  // Everything else in the shop is sent to DMO for approval.
  // A perk with more than one name (shop item and role named differently): put the names in a list.
  MARKET_AUTO_ROLES: ["Temp VC Access", "Soundboard Permission", "GIF Perms", ["Cornelius Fudge DJ Perms", "DJ"], "Image Perms"],
  EVENT_PING_ROLE_ID: "",       // role pinged on event announcements/reminders ("" = no ping)
  ANNOUNCE_CHANNEL_ID: "",      // promotion posts + the HQ announcement mirror
  DIGEST_CHANNEL_ID: "",        // Monday digest ("" = ANNOUNCE_CHANNEL_ID)
  APPROVAL_REMINDER_HOURS: 12,  // ping reviewers about anything waiting longer than this
  ROLE_CHANGES_PER_RUN: 20,     // role sync spreads big changes over several 5-minute runs
  // Discord roles the bot keeps in step with the roster (only these are ever touched; nobody is kicked).
  // Roles named after a rank ("03 - Operator", "Operator"), a tier (LR, MR, HR, EX, Leadership) or
  // DMO / CPM are found BY NAME automatically, so these IDs are optional.
  ROLES: { LR: "", MR: "", HR: "", EX: "", Leadership: "", DMO: "", CPM: "" },
  // Any OTHER roles that come with a tier, a rank number or a department, by role NAME
  // (exactly as in Server Settings > Roles). Swapped like the rest when someone's rank changes.
  // e.g. EXTRA_ROLES: { LR: ["Workers", "Trainee Staff"], MR: ["Management"], "06": ["New Manager"], DMO: ["DMO Staff"] }
  // Divider roles like "-----[EX]-----" match however many dashes they have.
  EXTRA_ROLES: { LR: ["[LR]"], MR: ["Middle Management", "[MR]"], HR: ["Upper Management", "[HR]"],
                 EX: ["Executive Management", "[EX]"], Leadership: ["[WC]"], DMO: ["[DMO]"], CPM: ["[CPM]"] },
  // Roles the bot GIVES but never takes away (for roles other people share, e.g. a divider).
  KEEP_ROLES: ["[WC]"],

  NAME: "Department of Management Operations",
  TIME_ZONE: "Europe/London",
  COLOURS: { draft: 0x5865F2, pending: 0xF0B232, approved: 0x23A55A, denied: 0xDA373C, info: 0x5865F2 }
};
// Secrets (Worker > Settings > Variables and Secrets, type "Secret"):
//   BOT_TOKEN, REGISTER_KEY, SHEETS_URL (the HQ site's /api/bot), SHEETS_SECRET (= the roster's APPROVAL_SECRET)
// Optional: HQ_URL (instead of CONFIG.HQ_URL).
// KV namespace bound as BOT_KV (Worker > Settings > Bindings) — needed for the
// 5-minute jobs (so nothing is posted twice) and for /roster start codes.

const API = "https://discord.com/api/v10";
const T = { PING: 1, COMMAND: 2, COMPONENT: 3, AUTOCOMPLETE: 4, MODAL_SUBMIT: 5 };
const R = { PONG: 1, MESSAGE: 4, DEFER_MESSAGE: 5, DEFER_UPDATE: 6, UPDATE: 7, AUTOCOMPLETE: 8, MODAL: 9 };
const EPHEMERAL = 64;
const NO_PINGS = { parse: [] };

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/register") {
      if (!env.REGISTER_KEY || url.searchParams.get("key") !== env.REGISTER_KEY) return new Response("Wrong key", { status: 403 });
      return registerCommands(env);
    }

    // Run the 5-minute jobs by hand and see what they did: /cron?key=REGISTER_KEY
    if (request.method === "GET" && url.pathname === "/cron") {
      if (!env.REGISTER_KEY || url.searchParams.get("key") !== env.REGISTER_KEY) return new Response("Wrong key", { status: 403 });
      const log = await runCron(env, Date.now());
      return new Response(log.length ? log.join("\n") : "Ran. Nothing to do.");
    }

    // The self-test, now: /selftest?key=REGISTER_KEY (add &post=1 to post the report as well)
    if (request.method === "GET" && url.pathname === "/selftest") {
      if (!env.REGISTER_KEY || url.searchParams.get("key") !== env.REGISTER_KEY) return new Response("Wrong key", { status: 403 });
      const r = await selfTest(env);
      if (url.searchParams.get("post") === "1") await postSelfTest(env, r, true);
      return new Response(selfTestText(r), { headers: { "Content-Type": "text/plain; charset=utf-8" } });
    }

    // "Use my device's time zone": a page that reads the browser's time zone and saves it for that Discord user.
    if (url.pathname === "/tz") return deviceTzPage(env, request, url);

    // What the HQ API sends back (field names), for checking: /diag?key=REGISTER_KEY
    if (request.method === "GET" && url.pathname === "/diag") {
      if (!env.REGISTER_KEY || url.searchParams.get("key") !== env.REGISTER_KEY) return new Response("Wrong key", { status: 403 });
      return json(await diagnose(env));
    }

    // The roster tells the bot something changed: {secret, type:"rank", emp, discordId?} | {type:"event"}
    if (request.method === "POST" && url.pathname === "/notify") {
      const body = await request.json().catch(() => ({}));
      if (!env.SHEETS_SECRET || body.secret !== env.SHEETS_SECRET) return new Response("Not allowed", { status: 403 });
      try {
        if (body.type === "event") return json({ ok: true, result: await cronEvents(env, Date.now()) });
        if (body.type === "rank") {
          let discordId = String(body.discordId || "");
          if (!discordId && body.emp) {
            const l = await bridge(env, { action: "links", emp: String(body.emp) });
            discordId = l.ok && l.links && l.links[0] ? l.links[0].discordId : "";
          }
          if (!discordId) return json({ ok: true, result: "not linked" });
          return json(Object.assign({ ok: true }, await syncRolesFor(env, discordId, body.emp || "", "auto")));
        }
        return json({ ok: false, error: "Unknown notice" });
      } catch (e) { return json({ ok: false, error: e.message }); }
    }

    if (request.method === "POST" && url.pathname === "/sync") {
      const body = await request.json().catch(() => ({}));
      if (!env.SHEETS_SECRET || body.secret !== env.SHEETS_SECRET) return new Response("Not allowed", { status: 403 });
      if (body.type === "selftest") return json({ ok: true, pong: String(body.nonce || "") });   // the site's self-test ping
      // Answered straight away: the roster only waits 5 seconds, and editing the message, giving roles
      // and sending the DM can take longer — the work carries on after the answer (waitUntil).
      const work = (async () => {
        if (body.type === "score") await syncScore(env, body);
        else if (/^(award|roster|loa|market)-/.test(String(body.id || ""))) await syncRequest(env, body);
        else await syncFromRoster(env, body);
      })().catch(e => console.error("sync " + (body.id || "") + ": " + (e && e.stack || e)));
      ctx.waitUntil(work);
      return json({ ok: true });
    }

    // The roster's Approvals page asks for a log's proof screenshot (the
    // image on its #approval-logs message) when the Drive copy isn't available.
    if (request.method === "POST" && url.pathname === "/proof") {
      const body = await request.json().catch(() => ({}));
      if (!env.SHEETS_SECRET || body.secret !== env.SHEETS_SECRET) return new Response("Not allowed", { status: 403 });
      try {
        const rk = (String(body.id || "").match(/^(award|roster|loa)-/) || [])[1];
        const message = await discord(env, "GET", `/channels/${rk ? requestChannel(rk) : CONFIG.APPROVAL_CHANNEL_ID}/messages/${String(body.id).replace(/\D/g, "")}`);
        const src = proofSource(message);
        if (!src) return json({ ok: false, error: "the #approval-logs message has no screenshot" });
        const file = await download(src.url, src.name);
        return json({ ok: true, type: file.type, data: base64(file.data) });
      } catch (e) {
        return json({ ok: false, error: /404/.test(e.message) ? "the Discord message was deleted" : e.message });
      }
    }

    // Screenshots on the roster's Approvals page: a signed link made by the roster
    // (same shared secret), redirected to the image on Discord's servers.
    if (request.method === "GET" && url.pathname === "/img") {
      const id = url.searchParams.get("id") || "", sig = url.searchParams.get("sig") || "";
      if (!env.SHEETS_SECRET || !(await hmacOk(env.SHEETS_SECRET, id, sig))) return new Response("Not allowed", { status: 403 });
      try {
        const rk = (id.match(/^(award|roster|loa)-/) || [])[1];
        const message = await discord(env, "GET", `/channels/${rk ? requestChannel(rk) : CONFIG.APPROVAL_CHANNEL_ID}/messages/${id.replace(/\D/g, "")}`);
        const src = proofSource(message);
        if (!src) return new Response("No screenshot", { status: 404 });
        const w = Math.min(Number(url.searchParams.get("w")) || 0, 2000);
        let target = src.url;
        if (w && src.proxy) target = src.proxy + (src.proxy.indexOf("?") === -1 ? "?" : "&") + "width=" + w + "&format=webp";
        return new Response(null, { status: 302, headers: { "Location": target, "Cache-Control": "private, max-age=3000" } });
      } catch (e) {
        return new Response("Couldn't load the screenshot", { status: 502 });
      }
    }

    if (request.method !== "POST") return new Response("DMO event log bot is running.");

    const body = await request.text();
    if (!(await verify(request, body))) return new Response("Bad signature", { status: 401 });

    const i = JSON.parse(body);
    Object.defineProperty(i, "__request", { value: request, enumerable: false });   // the bot's own address, for links
    try {
      return json(await handle(i, env, ctx));
    } catch (e) {
      console.error(e && e.stack || e);
      if (i.type === T.AUTOCOMPLETE) return json({ type: R.AUTOCOMPLETE, data: { choices: [] } });
      return json(reply("Error: " + (e && e.message || e)));
    }
  },

  // Cron Trigger (Worker > Settings > Triggers > Cron: */5 * * * *)
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runCron(env, event.scheduledTime || Date.now()).then(log => { if (log.length) console.log(log.join("\n")); }));
  }
};

// What each HQ API call sends back: the top-level fields and the first item's fields.
async function diagnose(env) {
  const out = { hqUrl: hqBase(env) ? "set" : "MISSING", kv: env.BOT_KV ? "bound" : "MISSING (BOT_KV)", bridge: linked(env) ? "set" : "MISSING",
    recentRoles: await kvGet(env, "state:lastroles", []) };
  const shape = (v) => Array.isArray(v) ? { list: v.length, first: v[0] && typeof v[0] === "object" ? Object.keys(v[0]) : v[0] }
    : v && typeof v === "object" ? Object.keys(v).reduce((m, k) => (m[k] = Array.isArray(v[k]) ? { list: v[k].length, first: v[k][0] && typeof v[k][0] === "object" ? Object.keys(v[k][0]) : v[k][0] } : typeof v[k] === "object" && v[k] ? Object.keys(v[k]) : typeof v[k], m), {}) : typeof v;
  for (const api of ["events", "home", "hqroster", "market"]) {
    try { out[api] = shape(await hq(env, api, null, true)); } catch (e) { out[api] = "ERROR: " + e.message; }
  }
  try {
    const roster = await loadRoster(env);
    const someone = roster && roster.list.find(p => p.e);
    out.profile = someone ? shape(await hq(env, "profile", { emp: someone.e }, true)) : "no employee numbers in the roster's names list";
  } catch (e) { out.profile = "ERROR: " + e.message; }
  // Which server roles role sync will manage (matched by name to the roster).
  if (CONFIG.GUILD_ID) {
    try {
      const byEmp = await hqRosterByEmp(env, true).catch(() => ({}));
      const plan = await rolePlan(env, byEmp, true);
      const ranks = {};
      Object.keys(byEmp).forEach(e => { const r = String(pick(byEmp[e], ["rank"], "")); if (r) ranks[r + " → " + (tierOf(byEmp[e]) || "?")] = true; });
      const links = await bridge(env, { action: "links" }).catch(() => null);
      const linked = ((links && links.links) || []).map(l => ({ discordId: l.discordId, emp: l.emp,
        onRoster: !!byEmp[normEmp(l.emp)], rank: byEmp[normEmp(l.emp)] ? String(pick(byEmp[normEmp(l.emp)], ["rank"], "")) : "",
        awards: byEmp[normEmp(l.emp)] ? byEmp[normEmp(l.emp)].awards || "none read" : "" }));
      out.roles = { source: ROLE_SOURCE, awardsOnRoster: AWARD_NAMES.length ? AWARD_NAMES : "none (the roster sent no awards)", linked: linked.slice(0, 15), managed: Object.keys(plan.managed).map(id => plan.managed[id].name),
        aboveTheBot: plan.tooHigh, sameNameIgnored: plan.duplicates, botRole: plan.botRole, botFound: plan.botFound, serverRoles: plan.serverRoles,
        rosterRanks: Object.keys(ranks).sort() };
    } catch (e) { out.roles = "ERROR: " + e.message; }
  } else out.roles = "GUILD_ID not set";
  for (const action of ["links", "pending", "leaderboard"]) {
    try { const r = await bridge(env, { action: action }); out["bridge:" + action] = r.ok ? "ok" : "ERROR: " + r.error; } catch (e) { out["bridge:" + action] = "ERROR: " + e.message; }
  }
  return out;
}

const linked = (env) => !!(env.SHEETS_URL && env.SHEETS_SECRET);

// ---------------------------------------------------------------------
// Roster names, kept in memory for 5 minutes (for suggestions/matching)
// ---------------------------------------------------------------------
let ROSTER = null; // { at, list: [{d, r, k}], by: { lowername: person } }
let ROSTER_LOADING = null;

// The roster's names, kept for a minute (the database answers quickly). maxAge 0 = fetch now.
function loadRoster(env, maxAge) {
  if (!linked(env)) return Promise.resolve(null);
  if (ROSTER && Date.now() - ROSTER.at < (maxAge === undefined ? 60 * 1000 : maxAge)) return Promise.resolve(ROSTER);
  if (!ROSTER_LOADING) {
    ROSTER_LOADING = bridge(env, { action: "names" }).then(res => {
      ROSTER_LOADING = null;
      if (!res.ok) throw new Error(res.error);
      const by = {};
      res.people.forEach(p => [p.d, p.r].forEach(n => { if (n && !by[n.toLowerCase()]) by[n.toLowerCase()] = p; }));
      ROSTER = { at: Date.now(), list: res.people, by: by };
      return ROSTER;
    }).catch(e => { ROSTER_LOADING = null; throw e; });
  }
  return ROSTER_LOADING;
}

// Someone not found in the kept copy may have just been added: fetch the names again (at most every 10 s).
async function rosterLookup(env, name) {
  const key = String(name || "").trim().replace(/^@/, "").toLowerCase();
  let roster = await loadRoster(env).catch(() => null);
  if (roster && key && !roster.by[key]) roster = await loadRoster(env, 10 * 1000).catch(() => roster);
  return { roster, p: roster && key ? roster.by[key] || null : null };
}

// Roster suggestions for what's been typed so far (up to 25).
function suggest(roster, typed) {
  const q = String(typed || "").trim().toLowerCase();
  const scored = [];
  roster.list.forEach(p => {
    const names = [p.d, p.r].filter(Boolean);
    let best = 99;
    names.forEach(n => {
      const l = n.toLowerCase();
      if (!q) best = Math.min(best, 3);
      else if (l === q) best = 0;
      else if (l.startsWith(q)) best = Math.min(best, 1);
      else if (l.includes(q)) best = Math.min(best, 2);
    });
    if (best < 99) scored.push([best, p]);
  });
  scored.sort((a, b) => a[0] - b[0] || String(a[1].r || a[1].d).localeCompare(String(b[1].r || b[1].d)));
  return scored.slice(0, 25).map(([, p]) => {
    const value = p.r || p.d;
    const label = [p.d && p.r && p.d !== p.r ? `${p.d} (${p.r})` : value, p.k].filter(Boolean).join(" · ");
    return { name: label.slice(0, 100), value: value.slice(0, 100) };
  });
}

// For comma lists ("bobRbx, car"): suggests the name being typed and keeps
// the ones before it. Discord only allows 100 characters per suggestion,
// so once a list is longer than that, keep typing (or add them in the panel).
function suggestList(roster, typed) {
  const parts = String(typed || "").split(",");
  const last = parts.pop().trim();
  const before = parts.map(x => x.trim()).filter(Boolean);
  const already = before.map(x => x.toLowerCase());
  const prefix = before.length ? before.join(", ") + ", " : "";
  return suggest(roster, last)
    .filter(c => already.indexOf(c.value.toLowerCase()) === -1)
    .map(c => ({ name: (prefix + c.value).length <= 100 ? (prefix ? "…" + c.name : c.name).slice(0, 100) : c.name, value: prefix + c.value }))
    .filter(c => c.value.length <= 100)
    .slice(0, 25);
}

// A Discord member -> their roster name (or their display name, flagged).
function rosterNameFor(roster, user, member) {
  const tries = [user && user.username, member && member.nick, user && user.global_name].filter(Boolean);
  for (const t of tries) {
    const p = roster && roster.by[String(t).toLowerCase()];
    if (p) return { name: p.r || p.d, found: true };
  }
  return { name: (member && member.nick) || (user && (user.global_name || user.username)) || "Unknown", found: false };
}

// ---------------------------------------------------------------------
// Interactions
// ---------------------------------------------------------------------
async function handle(i, env, ctx) {
  if (i.type === T.PING) return { type: R.PONG };
  const community = await handleCommunity(i, env, ctx);
  if (community) return community;
  const who = user(i);
  const name = i.data && i.data.name;

  // Suggestions while typing /event log host:… or /lookup name:…
  if (i.type === T.AUTOCOMPLETE) {
    const focused = (i.data.options || []).find(o => o.focused);
    if (name && Object.keys(REQUESTS).some(k => REQUESTS[k].command === name)) {
      return { type: R.AUTOCOMPLETE, data: { choices: await requestSuggest(env, ctx, focused) } };
    }
    let roster = null;
    try {
      roster = await Promise.race([loadRoster(env), new Promise(r => setTimeout(() => r(null), 2200))]);
    } catch (e) { roster = null; }
    if (!roster) { ctx.waitUntil(loadRoster(env).catch(() => {})); return { type: R.AUTOCOMPLETE, data: { choices: [] } }; }
    const typed = focused ? String(focused.value || "") : "";
    if (focused && (focused.name === "attendees" || focused.name === "cohosts")) {
      return { type: R.AUTOCOMPLETE, data: { choices: suggestList(roster, typed) } };
    }
    return { type: R.AUTOCOMPLETE, data: { choices: suggest(roster, typed) } };
  }

  // /event log: opens the private panel where everything is filled in.


  // ---- Requests ----
  // /awardrequest and /roster update open a private panel (like /event log) with
  // dropdowns filled from the roster; "Add proof & send" opens the last form.
  // /loa is a single form (MR+ only).
  const reqType = name ? Object.keys(REQUESTS).find(k => REQUESTS[k].command === name) : undefined;
  if (i.type === T.COMMAND && (reqType === "award" || reqType === "roster")) {
    const opts = {};
    (i.data.options || []).forEach(o => { opts[o.name] = o.value; });
    ctx.waitUntil(openRequestPanel(env, i, reqType, opts));
    return { type: R.DEFER_MESSAGE, data: { flags: EPHEMERAL } };
  }
  // /loa: start / end dates, reason, type, notes (checked: MR+, real dates).
  if (i.type === T.COMMAND && reqType === "loa") {
    const opts = {};
    (i.data.options || []).forEach(o => { opts[o.name] = o.value; });
    ctx.waitUntil(loaCommand(env, i, opts));
    return { type: R.DEFER_MESSAGE, data: { flags: EPHEMERAL } };
  }

  // Panel dropdowns and buttons (award: "aw:…", roster: "ro:…").
  if (i.type === T.COMPONENT && /^(aw|ro):/.test(i.data.custom_id)) {
    return requestPanelAction(env, ctx, i);
  }

  // The last form of a panel (names + proof), and the LOA form.
  if (i.type === T.MODAL_SUBMIT && /^(aw|ro):send$/.test(i.data.custom_id)) {
    const type = i.data.custom_id.startsWith("aw") ? "award" : "roster";
    const v = modalValues(i);
    const att = ((i.data.resolved || {}).attachments || {})[(v.proof || [])[0]];
    const st = readPanel(i.message);
    const update = type === "roster" && st.mode === "update";
    if (!att && !update) return reply("No proof was attached. Press **Add proof & send** again and attach a screenshot.");
    if (att && !isAllowedImage(att)) return reply(IMAGE_RULE);
    Object.keys(v).forEach(k => { if (k !== "proof") st[k] = k === "notes" ? String(v[k] || "").trim().slice(0, 300) : cleanLine(v[k], 100); });
    ctx.waitUntil(sendRequest(env, i, type, st, att));
    return { type: R.DEFER_UPDATE };
  }

  if (i.type === T.COMMAND && name === "lookup") {
    if (!linked(env)) return reply("The roster isn't linked yet.");
    const o = (i.data.options || []).find(x => x.name === "name");
    ctx.waitUntil(lookup(env, i, o ? o.value : ""));
    return { type: R.DEFER_MESSAGE, data: { flags: EPHEMERAL } };
  }

  // ---- The panel (private to the person logging) ----
  if (i.type === T.COMPONENT && i.data.custom_id.startsWith("d:")) {
    const action = i.data.custom_id.slice(2);
    const draft = readDraft(i.message);

    if (action === "cancel") return { type: R.UPDATE, data: { content: "", embeds: [{ color: CONFIG.COLOURS.denied, description: "Event log cancelled. Nothing was sent." }], components: [] } };

    if (action === "host" || action === "sup" || action === "co" || action === "att") {
      ctx.waitUntil(pickMembers(env, i, draft, action));
      return { type: R.DEFER_UPDATE };
    }

    if (action === "details") {
      return { type: R.MODAL, data: {
        custom_id: "d:details", title: "Event details",
        components: [
          row(input("date", "Date", 1, true, 40, "e.g. 28/09/2026", draft.date || today())),
          row(input("notes", "Notes", 2, true, 500, "Anything the approvers should know", draft.notes))
        ]
      } };
    }

    if (action === "proof") {
      return { type: R.MODAL, data: {
        custom_id: "d:proof", title: "Proof screenshot",
        components: [{ type: 18, label: "Screenshot of the event", description: "PNG, JPG or WebP. Shared with Google for an automated check; staff make the decision.",
          component: { type: 19, custom_id: "file", min_values: 1, max_values: 1, required: true } }]
      } };
    }

    if (action === "submit") {
      const missing = missingParts(draft);
      if (missing.length) return reply("Still needed: " + missing.join(", ") + ".");
      ctx.waitUntil(submit(env, i, draft, who));
      return { type: R.DEFER_UPDATE };
    }
  }

  if (i.type === T.MODAL_SUBMIT && i.data.custom_id === "d:details") {
    const draft = readDraft(i.message);
    const v = modalValues(i);
    draft.date = cleanLine(v.date, 40);
    draft.notes = String(v.notes || "").trim().slice(0, 500);
    ctx.waitUntil(refreshPanel(env, i, draft));
    return { type: R.DEFER_UPDATE };
  }

  if (i.type === T.MODAL_SUBMIT && i.data.custom_id === "d:proof") {
    const draft = readDraft(i.message);
    const idList = modalValues(i).file || [];
    const att = ((i.data.resolved || {}).attachments || {})[idList[0]];
    if (!att) return reply("No file was attached. Try again.");
    if (!isAllowedImage(att)) return reply(IMAGE_RULE);
    draft.proof = att.url;
    draft.proofName = safeName(att.filename);
    ctx.waitUntil(refreshPanel(env, i, draft));
    return { type: R.DEFER_UPDATE };
  }


  // Buttons on older #approval-logs messages: approvals now happen on the roster.
  if (i.type === T.COMPONENT && /^(approve|deny):/.test(i.data.custom_id)) {
    return reply("This message is out of date. Approve or deny it on the roster's Approvals page.");
  }

  return reply("Unknown action.");
}


// ---------------------------------------------------------------------
// Requests: the formats they're posted in (one line per entry in `format`).
//   "discord" = Discord Username   "roblox" = Roblox Username
//   "proof"   = "Proof:" with the screenshot attached under the message
//   "ping"    = "Ping: @Department of Management Operations"
// ---------------------------------------------------------------------
const AWARD_GROUPS = [
  { key: "SPCL", title: "Special Awards" },
  { key: "EXP", title: "Game Experience Awards" },
  { key: "EVNT", title: "Event-based Awards" },
  { key: "EXEC", title: "Executive-granted Awards" },
  { key: "OTHER", title: "Other Awards" }
];
// Which award groups can be requested (remove a key to leave that group out of /awardrequest).
// Executive-granted awards (EXEC) are given by executives, not requested.
const AWARD_GROUPS_REQUESTABLE = ["SPCL", "EXP", "EVNT", "OTHER"];

const REQUESTS = {
  roster: {
    command: "", description: "", title: "Role & Roster Request", icon: "🧾",   // opened by /roster update
    updateTitle: "Role & Roster Update",
    labels: { tz: "Timezone (UTC)", rank: "Rank", ref: "Referred by", notes: "Notes" },
    format: ["discord", "roblox", "tz", "rank", "ref", "proof"]
  },
  award: {
    command: "awardrequest", description: "Request an award", title: "Award Request", icon: "🏅",
    labels: { award: "Award Requested" },
    format: ["roblox", "discord", "award", "proof", "ping"]
  },
  loa: {
    command: "loa", description: "Request a leave of absence (Management+ only)", title: "LOA Request", icon: "🏖️",
    options: [
      { type: 3, name: "start", description: "First day of the LOA (DD/MM/YYYY)", required: true, min_length: 8, max_length: 10 },
      { type: 3, name: "end", description: "Last day of the LOA (DD/MM/YYYY)", required: true, min_length: 8, max_length: 10 },
      { type: 3, name: "reason", description: "Why you need the LOA", required: true, max_length: 300 },
      { type: 3, name: "type", description: "Away from Discord, the game, or both (default: both)", required: false,
        choices: [{ name: "Both", value: "Both" }, { name: "Discord", value: "Discord" }, { name: "Game", value: "Game" }] },
      { type: 3, name: "notes", description: "Anything else", required: false, max_length: 300 }],
    labels: { time: "Time", reason: "Reason", kind: "LOA", notes: "Notes" },
    format: ["discord", "roblox", "time", "reason", "kind", "notes"]
  }
};

// ---- The panels (state lives in the panel's own embed fields, like /event log) ----
const PANEL_FIELDS = { "Roblox Username": "roblox", "Discord Username": "discord", "Award Requested": "award",
  "Rank": "rank", "Referred by": "ref", "Timezone (UTC)": "tz" };
const NOT_SET = ["Not chosen yet", "Not on the roster. Enter it when you send.", "None", "Not found on the roster — add it when you send"];   // last: older panels

function readPanel(message) {
  const st = {};
  const e = ((message || {}).embeds || [])[0] || {};
  (e.fields || []).forEach(f => {
    const k = PANEL_FIELDS[f.name];
    if (k) st[k] = NOT_SET.indexOf(f.value) !== -1 || f.value === "—" ? "" : String(f.value).replace(/^\*\*|\*\*$/g, "");
  });
  if (/Update/.test(e.title || "")) st.mode = "update";      // someone already on the roster
  return st;
}

function selectRow(id, placeholder, options, chosen, minZero) {
  return { type: 1, components: [{ type: 3, custom_id: id, placeholder: placeholder.slice(0, 150),
    min_values: minZero ? 0 : 1, max_values: 1,
    options: options.slice(0, 25).map(o => Object.assign({ label: String(o.label).slice(0, 100), value: String(o.value).slice(0, 100) },
      o.description ? { description: String(o.description).slice(0, 100) } : {},
      chosen && o.value === chosen ? { default: true } : {})) }] };
}

// Award lists: one dropdown per group (25 per list; a big group is split).
function awardLists(meta) {
  const list = (meta && meta.awards || []).map(a => typeof a === "string" ? { label: a, group: "OTHER" } : a)
    .filter(a => AWARD_GROUPS_REQUESTABLE.indexOf(a.group) !== -1);
  const out = [];
  AWARD_GROUPS.forEach(g => {
    const items = list.filter(a => a.group === g.key);
    for (let k = 0; k < items.length; k += 25) {
      const part = items.length > 25 ? ` (${k / 25 + 1}/${Math.ceil(items.length / 25)})` : "";
      out.push({ title: g.title + part, items: items.slice(k, k + 25) });
    }
  });
  return out;
}

function awardPanel(st, meta) {
  const lists = awardLists(meta).slice(0, 4);           // 4 dropdowns + the button row
  const rows = lists.map((l, n) => selectRow("aw:pick:" + n, l.title + ": choose one",
    l.items.map(a => ({ label: a.label, value: a.label, description: a.description })), st.award, true));
  rows.push({ type: 1, components: [
    { type: 2, style: 3, label: "Add proof & send", custom_id: "aw:send", emoji: { name: "📎" }, disabled: !st.award },
    { type: 2, style: 2, label: "Cancel", custom_id: "aw:cancel" }] });
  return { content: "", embeds: [{
    author: { name: CONFIG.NAME }, color: CONFIG.COLOURS.draft, title: "Award Request",
    description: lists.length
      ? "Choose the award you're requesting from the lists below, then press **Add proof & send**."
      : "Couldn't load the award list from the roster" + (st.metaError ? " (" + String(st.metaError).slice(0, 150) + ")" : "") + ". Press **Add proof & send** and type the award name.",
    fields: [
      { name: "Roblox Username", value: st.roblox || NOT_SET[1], inline: true },
      { name: "Discord Username", value: st.discord || "—", inline: true },
      { name: "Award Requested", value: st.award ? "**" + st.award + "**" : NOT_SET[0], inline: false }],
    footer: { text: "Only you can see this" } }], components: lists.length ? rows : [rows[rows.length - 1]] };
}

function mrList(roster) {
  return roster ? roster.list.filter(isMrPlus).sort((a, b) => String(a.r || a.d).localeCompare(String(b.r || b.d))) : [];
}

// Ranks someone already on the roster can ask to move to: Worker ranks + Management
// ranks up to 13 (14/15 are Leadership, appointed from Admin). Their own rank is kept in.
function updateRanks(meta, me) {
  const out = [], seen = {};
  [].concat(meta && meta.ranks || [], meta && meta.mgmtRanks || []).forEach(r => {
    const n = rankNumber(r);
    if (!r || n >= 14 || seen[n || r]) return;
    seen[n || r] = true; out.push(r);
  });
  if (me && me.k && !out.some(r => r === me.k || (rankNumber(r) && rankNumber(r) === rankNumber(me.k)))) out.push(me.k);
  return out.sort((a, b) => (rankNumber(a) - rankNumber(b)) || a.localeCompare(b));
}

// Already on the roster: change rank / Roblox username / timezone (goes to Approvals).
function rosterUpdatePanel(st, meta, me) {
  const rows = [];
  const ranks = updateRanks(meta, me);
  if (ranks.length) rows.push(selectRow("ro:rank", "Rank: keep yours or choose your new rank",
    ranks.slice(0, 25).map(r => ({ label: r, value: r, description: r === me.k ? "Your current rank" : undefined })), st.rank, false));
  rows.push({ type: 1, components: [
    { type: 2, style: 3, label: "Changes & proof", custom_id: "ro:send", emoji: { name: "📎" } },
    { type: 2, style: 2, label: "Cancel", custom_id: "ro:cancel" }] });
  return { content: "", embeds: [{
    author: { name: CONFIG.NAME }, color: CONFIG.COLOURS.draft, title: REQUESTS.roster.updateTitle,
    description: `You're already on the roster as **${me.r || me.d}** (${me.k || "no rank"}${me.s ? ", " + me.s : ""}).\n` +
      "Choose a new **rank** if it's changing, then press **Changes & proof** to change your Roblox username or timezone. " +
      "Staff approve it on the roster before anything changes.",
    fields: [
      { name: "Discord Username", value: st.discord || "—", inline: true },
      { name: "Roblox Username", value: st.roblox || "—", inline: true },
      { name: "Timezone (UTC)", value: st.tz || "—", inline: true },
      { name: "Rank", value: st.rank ? "**" + st.rank + "**" : NOT_SET[0], inline: true }],
    footer: { text: "Only you can see this" } }], components: rows.slice(0, 5) };
}

function rosterPanel(st, meta, roster) {
  const rows = [];
  const ranks = meta && meta.ranks || [];
  if (ranks.length) rows.push(selectRow("ro:rank", "Rank you're applying for",
    ranks.slice(0, 25).map(r => ({ label: r, value: r })), st.rank, false));
  // Referred by: MR+ only (they get Market points). Up to 3 lists of 25, else a member search.
  const mr = mrList(roster);
  const opts = [{ label: "None (nobody referred me)", value: "__none__" }].concat(
    mr.map(p => ({ label: p.r || p.d, value: p.r || p.d, description: p.k })));
  if (mr.length && opts.length <= 75) {
    for (let k = 0; k < opts.length; k += 25) {
      const part = opts.length > 25 ? ` (${k / 25 + 1}/${Math.ceil(opts.length / 25)})` : "";
      rows.push(selectRow("ro:ref:" + (k / 25), "Referred by" + part + " (MR members only)", opts.slice(k, k + 25), st.ref || (st.refNone ? "__none__" : ""), true));
    }
  } else {
    rows.push({ type: 1, components: [{ type: 5, custom_id: "ro:refuser", placeholder: "Referred by: search for the MR member, or leave empty", min_values: 0, max_values: 1 }] });
  }
  rows.push({ type: 1, components: [
    { type: 2, style: 3, label: "Details & proof", custom_id: "ro:send", emoji: { name: "📎" }, disabled: ranks.length > 0 && !st.rank },
    { type: 2, style: 2, label: "Cancel", custom_id: "ro:cancel" }] });
  return { content: "", embeds: [{
    author: { name: CONFIG.NAME }, color: CONFIG.COLOURS.draft, title: "Role & Roster Request",
    description: "Choose your rank and who referred you (MR members only; they receive Market points), then press **Details & proof**.",
    fields: [
      { name: "Discord Username", value: st.discord || "—", inline: true },
      { name: "Rank", value: st.rank ? "**" + st.rank + "**" : NOT_SET[0], inline: true },
      { name: "Referred by", value: st.ref ? "**" + st.ref + "**" : "None", inline: true }],
    footer: { text: "Only you can see this" } }], components: rows.slice(0, 5) };
}

async function openRequestPanel(env, i, type, opts) {
  try {
    const u = (i.member && i.member.user) || i.user || {};
    let metaError = "";
    const [roster, meta] = await Promise.all([loadRoster(env).catch(() => null),
      loadMeta(env).catch(e => { metaError = String(e && e.message || e); return null; })]);
    const me = roster ? findPerson(roster, i) : null;
    if (type === "roster" && me && me.s === "Leadership") {
      return editReply(env, i, `You're in **Department Leadership** (${me.k}). Leadership details are changed from the roster's Admin page, not by request.`);
    }
    if (type === "roster" && opts && opts.updateOnly && !me) {
      return editReply(env, i, roster
        ? `You aren't on the roster under your Discord name (**${u.username}**). New members apply with **/roster start**, then **/roster submit**.`
        : "Couldn't reach the roster. Try again in a minute.");
    }
    const st = { discord: u.username || "", roblox: me ? (me.r || me.d) : "" };
    if (type === "roster" && me) {
      st.rank = me.k || ""; st.tz = me.z || "";
      await editOriginal(env, i, Object.assign(rosterUpdatePanel(st, meta, me), { allowed_mentions: NO_PINGS }));
      return;
    }
    if (!metaError && meta && type === "award" && !awardLists(meta).length) metaError = "the roster sent back no awards";
    st.metaError = metaError;
    await editOriginal(env, i, Object.assign(type === "award" ? awardPanel(st, meta) : rosterPanel(st, meta, roster), { allowed_mentions: NO_PINGS }));
  } catch (e) {
    await editReply(env, i, "Couldn't open the request: " + e.message).catch(() => {});
  }
}

function requestPanelAction(env, ctx, i) {
  const id = i.data.custom_id;
  const type = id.startsWith("aw") ? "award" : "roster";
  const st = readPanel(i.message);
  if (/:cancel$/.test(id)) return { type: R.UPDATE, data: { content: "", embeds: [{ color: CONFIG.COLOURS.denied, description: REQUESTS[type].title + " cancelled. Nothing was sent." }], components: [] } };

  // "Add proof & send" / "Details & proof": the last form, names filled in.
  if (/:send$/.test(id)) {
    const box = (cid, label, value, max, placeholder, required) => ({ type: 18, label: label, component: Object.assign(
      { type: 4, custom_id: cid, style: 1, required: required !== false, max_length: max, placeholder: placeholder },
      value ? { value: String(value).slice(0, max) } : {}) });
    const proof = (desc) => ({ type: 18, label: "Proof", description: (desc + " Shared with Google for an automated check.").slice(0, 100), component: { type: 19, custom_id: "proof", min_values: 1, max_values: 1, required: true } });
    const update = type === "roster" && st.mode === "update";
    const hasRank = i.message.components.some(r => (r.components || []).some(c => c.custom_id === "ro:rank"));
    if (update) {
      const long = (cid, label, max, placeholder) => ({ type: 18, label: label, component: { type: 4, custom_id: cid, style: 2, required: false, max_length: max, placeholder: placeholder } });
      const comps = [box("roblox", "Roblox Username", st.roblox, 40, "Change it here if your Roblox username changed"),
        box("tz", "Timezone (UTC)", st.tz, 12, "e.g. UTC+1")]
        .concat(hasRank ? [] : [box("rank", "Rank", st.rank, 60, "The rank you're moving to (or your current one)")])
        .concat([long("notes", "Notes", 300, "Optional: why it's changing, e.g. promoted in game"),
          { type: 18, label: "Proof", description: "Screenshot for a rank change (optional for name / timezone changes)", component: { type: 19, custom_id: "proof", min_values: 0, max_values: 1, required: false } }]);
      return { type: R.MODAL, data: { custom_id: "ro:send", title: REQUESTS.roster.updateTitle, components: comps } };
    }
    const comps = type === "award"
      ? [box("roblox", "Roblox Username", st.roblox, 40, "Your Roblox username"),
         box("discord", "Discord Username", st.discord, 40, "Your Discord username")]
        .concat(st.award ? [] : [box("award", "Award Requested", "", 100, "The award you're requesting")])
        .concat([proof("Screenshot showing you've earned it (PNG, JPG or WebP)")])
      : [box("roblox", "Roblox Username", st.roblox, 40, "Your Roblox username"),
         box("tz", "Timezone (UTC)", st.tz, 12, "e.g. UTC+1")]
        .concat(i.message.components.some(r => (r.components || []).some(c => c.custom_id === "ro:rank")) ? [] : [box("rank", "Rank", st.rank, 60, "The rank you're requesting")])
        .concat([proof("Screenshot as proof (PNG, JPG or WebP)")]);
    return { type: R.MODAL, data: { custom_id: (type === "award" ? "aw" : "ro") + ":send", title: REQUESTS[type].title, components: comps } };
  }

  // A dropdown choice: redraw the panel straight from its own message.
  const v = (i.data.values || [])[0] || "";
  if (/^aw:pick:/.test(id)) st.award = v;
  if (id === "ro:rank") st.rank = v;
  if (/^ro:ref:/.test(id)) st.ref = v === "__none__" ? "" : v;
  if (id === "ro:refuser") {
    const u = ((i.data.resolved || {}).users || {})[v] || {};
    st.ref = v ? (u.username || "") : "";
  }
  const comps = i.message.components.map(r => ({ type: 1, components: (r.components || []).map(c => {
    const out = Object.assign({}, c);
    if (c.type === 3) {
      const chosen = /^aw:pick:/.test(c.custom_id) ? st.award : c.custom_id === "ro:rank" ? st.rank : /^ro:ref:/.test(c.custom_id) ? (st.ref || (v === "__none__" ? "__none__" : "")) : "";
      out.options = (c.options || []).map(o => { const x = Object.assign({}, o); delete x.default; if (chosen && o.value === chosen) x.default = true; return x; });
    }
    if (c.type === 2 && /:send$/.test(c.custom_id)) out.disabled = type === "award" ? !st.award : (i.message.components.some(rr => (rr.components || []).some(cc => cc.custom_id === "ro:rank")) && !st.rank);
    return out;
  }) }));
  const e = Object.assign({}, (i.message.embeds || [])[0]);
  e.fields = (e.fields || []).map(f => {
    const k = PANEL_FIELDS[f.name];
    if (k === "award") return Object.assign({}, f, { value: st.award ? "**" + st.award + "**" : NOT_SET[0] });
    if (k === "rank") return Object.assign({}, f, { value: st.rank ? "**" + st.rank + "**" : NOT_SET[0] });
    if (k === "ref") return Object.assign({}, f, { value: st.ref ? "**" + st.ref + "**" : "None" });
    return f;
  });
  return { type: R.UPDATE, data: { embeds: [e], components: comps } };
}

// ---- Posting ----
// The request in the department's format.
function requestText(type, st, submitter) {
  const t = REQUESTS[type];
  if (type === "roster" && st.mode === "update") return updateText(st, submitter);
  const lines = [`**${t.title}**`];
  const show = (v, empty) => cleanLine(Array.isArray(v) ? v.join(", ") : v, 300) || empty || "—";
  t.format.forEach(key => {
    if (key === "discord") {
      const typed = cleanLine(st.discord, 40) || submitter.username;
      lines.push(`Discord Username: ${typed}` + (typed.toLowerCase() === String(submitter.username).toLowerCase() ? ` (<@${submitter.id}>)` : ""));
    }
    else if (key === "roblox") lines.push(`Roblox Username: ${show(st.roblox)}`);
    else if (key === "proof") {
      if (st.code) lines.push(`Verification code: ${st.code}` + (st.codeAlt ? ` (or ${st.codeAlt} if it was made yesterday)` : "") +
        (st.robloxChecked ? " · Roblox account verified" : ""));
      lines.push("Proof:");
    }
    else if (key === "ping") lines.push(`Ping: <@&${CONFIG.DMO_ROLE_ID}>`);
    else if (key === "tz") lines.push(`${t.labels.tz}: ${show(cleanTimezone(cleanLine(st.tz, 12)))}`);
    else lines.push(`${t.labels[key]}: ${show(st[key], key === "ref" || key === "notes" ? "None" : "—")}`);
  });
  const typedDiscord = cleanLine(st.discord, 40);
  if (typedDiscord && typedDiscord.toLowerCase() !== String(submitter.username).toLowerCase()) lines.push(`-# Sent by ${submitter.username} (<@${submitter.id}>)`);
  if (submitter.warning) lines.push("-# ⚠️ " + submitter.warning);
  return lines.join("\n");
}

// An update from someone already on the roster: the same lines, with "old → new" on whatever changes.
function updateText(st, submitter) {
  const t = REQUESTS.roster, ch = st.changes || {}, cur = st.current || {};
  const val = (c, now) => c ? `~~${c.from || "—"}~~ → **${c.to}**` : (now || "—");
  const lines = [`**${t.updateTitle}**`,
    `Discord Username: ${submitter.username} (<@${submitter.id}>)`,
    `Roblox Username: ${val(ch.roblox, cur.roblox)}`,
    `${t.labels.tz}: ${val(ch.tz, cur.tz)}`,
    `Rank: ${val(ch.rank, cur.rank)}`];
  if (st.notes) lines.push(`Notes: ${cleanLine(st.notes, 300)}`);
  lines.push("Proof:" + (st.hasProof ? "" : " None"));
  if (submitter.warning) lines.push("-# ⚠️ " + submitter.warning);
  return lines.join("\n");
}

async function sendRequest(env, i, type, st, att) {
  const t = REQUESTS[type];
  const channel = requestChannel(type);
  const fromPanel = type !== "loa";
  const finish = (embed) => editOriginal(env, i, { content: "", embeds: [embed], components: [], allowed_mentions: NO_PINGS });
  try {
    const u = (i.member && i.member.user) || i.user || {};
    const check = await checkRequest(env, i, type, st);       // also tidies names to their roster spelling
    if (check.problems.length) {
      const embed = { color: CONFIG.COLOURS.denied, author: { name: CONFIG.NAME }, title: t.title + " not sent",
        description: check.problems.map(p => "• " + p).join("\n").slice(0, 3800) + "\n\nRun **" + (st.code ? "/roster submit" : "/" + t.command) + "** again." };
      if (fromPanel) await finish(embed); else await editOriginal(env, i, { embeds: [embed], allowed_mentions: NO_PINGS });
      return;
    }
    const title = type === "roster" && st.mode === "update" ? t.updateTitle : t.title;
    st.hasProof = !!att;
    const content = requestText(type, st, { id: u.id, username: u.username || "unknown", warning: check.warning }).slice(0, 2000);
    const pings = t.format.indexOf("ping") !== -1 && CONFIG.DMO_ROLE_ID ? { parse: [], roles: [CONFIG.DMO_ROLE_ID] } : NO_PINGS;
    let msg, proof = null;
    const status = linked(env) ? [decisionRow(type, env)] : [];
    if (att) {
      proof = await download(att.url, att.filename);
      msg = await discordFiles(env, "POST", `/channels/${channel}/messages`,
        { content: content, allowed_mentions: pings, components: status, attachments: [{ id: 0, filename: proof.name }] }, [proof]);
    } else {
      msg = await discord(env, "POST", `/channels/${channel}/messages`, { content: content, allowed_mentions: pings, components: status });
    }

    // Onto the roster's Approvals page (approving it there adds it to the roster).
    let note = "";
    if (linked(env)) {
      const details = requestDetails(type, st, u);
      const q = await bridge(env, Object.assign({
        action: "request", id: type + "-" + msg.id, title: title, details: details,
        submittedBy: (i.member && i.member.nick) || u.global_name || u.username, submittedById: u.id,
        proof: `https://discord.com/channels/${i.guild_id}/${channel}/${msg.id}`
      }, proof ? { proofName: proof.name, proofType: proof.type, proofData: base64(proof.data) } : {})).catch(e => ({ ok: false, error: e.message }));
      note = q.ok ? "\nYou'll get a DM when it has been decided."
                  : `\nIt couldn't be added to the roster's Approvals page (${q.error}). Please let a staff member know.`;
    }
    const done = { color: CONFIG.COLOURS.approved, author: { name: CONFIG.NAME }, title: title + " sent",
      description: `It's in <#${channel}> for staff to review. [Open it](https://discord.com/channels/${i.guild_id}/${channel}/${msg.id})` + note,
      timestamp: new Date().toISOString() };
    if (fromPanel) await finish(done); else await editOriginal(env, i, { embeds: [done], allowed_mentions: NO_PINGS });
  } catch (e) {
    await editOriginal(env, i, { content: "Couldn't send your " + t.title + ": " + e.message, allowed_mentions: NO_PINGS }).catch(() => {});
  }
}

function requestChannel(type) {
  return (CONFIG.REQUEST_CHANNELS || {})[type] || (type === "market" && CONFIG.MARKET_LOG_CHANNEL_ID) || CONFIG.REQUEST_CHANNEL_ID || CONFIG.APPROVAL_CHANNEL_ID;
}

// What the roster needs to carry the request out when it's approved.
function requestDetails(type, st, u) {
  const discord = cleanLine(st.discord, 40) || u.username || "";
  if (type === "award") return { roblox: st.roblox, discord: discord, award: st.award };
  if (type === "roster" && st.mode === "update") return { mode: "update", discord: u.username || discord,
    roblox: st.changes && st.changes.roblox ? st.changes.roblox.to : (st.current || {}).roblox || "",
    tz: st.changes && st.changes.tz ? st.changes.tz.to : (st.current || {}).tz || "",
    rank: st.changes && st.changes.rank ? st.changes.rank.to : (st.current || {}).rank || "",
    current: st.current || {}, changes: st.changes || {}, notes: String(st.notes || "").trim().slice(0, 300) };
  if (type === "roster") return Object.assign({ discord: u.username || discord, roblox: cleanLine(st.roblox, 40), tz: cleanTimezone(cleanLine(st.tz, 12)),
    rank: st.rank, ref: st.ref || "", refDiscord: st.refDiscord || "" },
    st.code ? { code: st.code, codeAlt: st.codeAlt || "", robloxId: st.robloxId || "" } : {});
  return Object.assign({ discord: discord, roblox: st.roblox || "", time: cleanLine(st.time, 100), reason: String(st.reason || "").trim().slice(0, 300),
    kind: firstValue(st.kind), notes: String(st.notes || "").trim().slice(0, 300) }, st.start ? { start: st.start, end: st.end } : {});
}

// Decisions on the roster's Approvals page -> the request message + a DM.
async function syncRequest(env, b) {
  const type = String(b.id).split("-")[0];
  const t = REQUESTS[type] || { title: type === "market" ? "Market Purchase" : "Request" };
  const path = `/channels/${requestChannel(type)}/messages/${String(b.id).replace(/\D/g, "")}`;
  const who = String(b.by || "a roster editor").replace(/@.*$/, "");
  let row = null, dmText = null, colour = CONFIG.COLOURS.approved;
  if (b.status === "Claimed") row = type === "award" ? websiteRow(env, `Claimed by ${b.by || "someone"} (website)`) : claimedRow(type, "web", `${b.by || "someone"} (roster)`);
  if (b.status === "Released") row = decisionRow(type, env);
  if (b.status === "Approved") row = statusRow(`Approved by ${who}. Adding to the roster…`, "⏳");
  if (b.status === "Done") {
    row = statusRow(`Approved by ${who}`, "✅");
    dmText = `Your ${t.title} was approved by ${who}.` + (b.note ? `\n-# ${String(b.note).slice(0, 300)}` : "");
  }
  if (b.status === "Error") row = statusRow(type === "market" ? `Approved, but the purchase failed (${String(b.note || "error").slice(0, 34)})`
    : `Approved, but not added to the roster yet (${String(b.note || "error").slice(0, 30)})`, "⚠️");
  if (b.status === "Denied") {
    row = statusRow(`Denied by ${who}`, "✖️");
    colour = CONFIG.COLOURS.denied;
    dmText = `Your ${t.title} was denied by ${who}.\n**Reason:** ${String(b.reason || "No reason given").slice(0, 900)}`;
    // An application: their code stays valid (48 hours from now), so they can fix it and send it again.
    if (type === "roster" && b.submittedById && env.BOT_KV) {
      const c = await kvGet(env, "code:" + b.submittedById, null);
      if (c && c.code) {
        c.at = Date.now();                               // counted from now
        await kvPut(env, "code:" + b.submittedById, c, 48 * 3600);
        dmText += `\n\nYour code **${c.code}** is valid for another 48 hours. Make the changes needed and run **/roster submit** again; you don't need a new code.`;
      }
    }
  }
  const rolesToo = b.status === "Done" && (type === "roster" || type === "award") && CONFIG.GUILD_ID;
  if (row && !rolesToo) await discord(env, "PATCH", path, { components: [row], allowed_mentions: NO_PINGS }).catch(() => {});
  // Approved roster / award request: give that person their roles straight away.
  if (rolesToo) {
    // Straight to the person who sent it, through their link (the roster links a new member just before
    // it says "Done"); else worked out from the request message.
    let r = null;
    // Sent along by the roster: no need to ask it (asking back while it's calling us can be blocked).
    if (b.submittedById && b.roleInfo && b.roleInfo.e) {
      ROSTER = null;
      r = await syncRolesFor(env, String(b.submittedById), b.roleInfo.e, "link", null, { person: b.roleInfo, awardNames: b.awardNames || [] }).catch(e => ({ error: e.message }));
    }
    if ((!r || r.error) && b.submittedById) {
      const l = await bridge(env, { action: "links", discordId: String(b.submittedById) }).catch(() => null);
      const emp = l && l.ok && (l.links || [])[0] && l.links[0].emp;
      if (emp) { ROSTER = null; r = await syncRolesFor(env, String(b.submittedById), emp, "link").catch(e => ({ error: e.message })); }
    }
    if (!r || r.error) r = await rolesAfterRequest(env, path, b).catch(e => ({ error: e.message }));
    if (r && !r.error && ((r.added || []).length || (r.removed || []).length)) dmText += "\nYour Discord roles have been updated.";
    if (r && !r.error) await markRequestRoles(env, b.id, "done");
    await noteRoles(env, b.id + " (approved)", b.submittedById, r);
    if (r && r.error) console.warn("Roles after " + b.id + ": " + r.error);
    // The message says how the roles went, so staff can see it without /diag.
    const failed = r && !r.error && (r.failed || []).length;
    row = r && !r.error
      ? statusRow(`Approved by ${who} · roles given` + (failed ? ` (${failed} blocked: the bot's role is too low)` : ""), failed ? "⚠️" : "✅")
      : statusRow(`Approved by ${who} · roles not given: ${String((r && r.error) || "unknown").slice(0, 40)}`, "⚠️");
    await discord(env, "PATCH", path, { components: [row], allowed_mentions: NO_PINGS }).catch(() => {});
  }
  if (dmText && b.submittedById) await dm(env, b.submittedById, { embeds: [{ author: { name: CONFIG.NAME }, color: colour, description: dmText, timestamp: new Date().toISOString() }] });
}

// Who a request was for, from its message ("Discord Username: name (<@id>)",
// "Roblox Username: name" or "~~old~~ → **new**"), then their roles from the roster.
async function rolesAfterRequest(env, path, b) {
  const msg = await discord(env, "GET", path);
  const text = String(msg.content || "");
  const line = (label) => (text.match(new RegExp("^" + label + ": (.*)$", "m")) || [])[1] || "";
  const dLine = line("Discord Username"), rLine = line("Roblox Username");
  const discordName = dLine.replace(/\s*\(<@!?\d+>\)\s*$/, "").replace(/^@/, "").trim();
  const roblox = ((rLine.match(/→\s*\*\*(.+?)\*\*/) || [])[1] || rLine.replace(/[~*]/g, "")).trim();
  let userId = (dLine.match(/<@!?(\d+)>/) || [])[1] || "";
  if (!userId && discordName) {
    const found = await discord(env, "GET", `/guilds/${CONFIG.GUILD_ID}/members/search?query=${encodeURIComponent(discordName)}&limit=10`).catch(() => []);
    const hit = (found || []).find(m => m.user && String(m.user.username).toLowerCase() === discordName.toLowerCase());
    userId = hit ? hit.user.id : "";
  }
  if (!userId && b.submittedById && (!discordName || discordName.toLowerCase() === "—")) userId = b.submittedById;
  if (!userId) return { error: `couldn't find ${discordName || "them"} in the server` };
  ROSTER = null;                                    // the roster just changed
  const r = await syncRolesFor(env, userId, "", "link", { discord: discordName === "—" ? "" : discordName, roblox: roblox === "—" ? "" : roblox });
  // A new member: link their Discord account to the roster entry just made, so later rank / award
  // changes reach their roles too (only when the Discord name on the roster is theirs).
  if (/^roster-/.test(String(b.id || "")) && discordName && discordName !== "—") {
    const one = await bridge(env, { action: "roleinfoName", discord: discordName, roblox: "" }).catch(() => null);
    const emp = one && one.ok && one.person && one.person.e;
    if (emp) {
      const l = await bridge(env, { action: "linkDiscord", emp: emp, discordId: userId, by: "self", targetName: discordName }).catch(() => null);
      if (l && l.ok && r && !r.error) r.linked = emp;
    }
  }
  return r;
}

// ---- Roster data for requests ----
let META = null, META_LOADING = null;   // { at, awards: [{label, group, description}], ranks: [] }, 10 minutes
function loadMeta(env) {
  if (!linked(env)) return Promise.resolve(null);
  if (META && Date.now() - META.at < 10 * 60 * 1000) return Promise.resolve(META);
  if (!META_LOADING) {
    META_LOADING = bridge(env, { action: "meta" }).then(res => {
      META_LOADING = null;
      if (!res.ok) throw new Error(res.error);
      META = { at: Date.now(), awards: res.awards || [], ranks: res.ranks || [], mgmtRanks: res.mgmtRanks || [] };
      return META;
    }).catch(e => { META_LOADING = null; throw e; });
  }
  return META_LOADING;
}
function awardLabels(meta) { return [].concat.apply([], awardLists(meta).map(l => l.items.map(a => a.label))); }

const TIMEZONES = (() => {
  const out = [];
  for (let h = -12; h <= 14; h++) out.push("UTC" + (h < 0 ? "-" : "+") + Math.abs(h));
  return out.concat(["UTC+3:30", "UTC+4:30", "UTC+5:30", "UTC+5:45", "UTC+9:30"]);
})();

function pickFrom(list, typed) {
  const q = String(typed || "").trim().toLowerCase();
  const scored = list.map(x => {
    const l = x.toLowerCase();
    return [!q ? 3 : l === q ? 0 : l.startsWith(q) ? 1 : l.includes(q) ? 2 : 99, x];
  }).filter(x => x[0] < 99);
  scored.sort((a, b) => a[0] - b[0]);
  return scored.slice(0, 25).map(([, x]) => ({ name: x.slice(0, 100), value: x.slice(0, 100) }));
}

// Suggestions while typing /roster update timezone:…
async function requestSuggest(env, ctx, focused) {
  const typed = focused ? String(focused.value || "") : "";
  if (focused && focused.name === "timezone") {
    const tz = cleanTimezone(typed);
    const list = pickFrom(TIMEZONES, /^UTC[+-]/.test(tz) ? tz : typed.replace(/^utc/i, "UTC"));
    if (/^UTC[+-]\d/.test(tz) && !list.some(c => c.value === tz)) list.unshift({ name: tz, value: tz });
    return list.slice(0, 25);
  }
  return [];
}

// The person running a command, found on the roster by their Discord name.
function findPerson(roster, i) {
  const u = (i.member && i.member.user) || i.user || {};
  const tries = [u.username, i.member && i.member.nick, u.global_name].filter(Boolean);
  for (const t of tries) { const p = roster.by[String(t).toLowerCase()]; if (p) return p; }
  return null;
}
// Who's logging: their roster entry by Discord name first (no extra request), else by a /link.
// The entry ({ d, r, k, s, e }), false = not on the roster, null = the roster couldn't be reached.
async function loggerOf(env, roster, i) {
  let p = roster && findPerson(roster, i);
  if (p) return p;
  const fresh = await loadRoster(env, 10 * 1000).catch(() => null);
  if (fresh) { roster = fresh; p = findPerson(roster, i); if (p) return p; }
  const u = caller(i);
  const l = await bridge(env, { action: "links", discordId: String(u.id || "") }).catch(() => null);
  if (l && l.ok) {
    const emp = ((l.links || [])[0] || {}).emp;
    if (!emp) return false;
    const hit = roster && roster.list.find(x => normEmp(x.e) === normEmp(emp));
    return hit || { e: emp, k: "", s: "" };          // linked, rank unknown here: the roster checks again
  }
  return roster ? false : null;
}
// Event logs: Middle Management (rank 06) and above only. Text for refusing, or "" when they may.
function cantLog(p) {
  if (p === false) return "Only Middle Management and above can log events, and you aren't on the roster under your Discord name. If your roster entry has a different Discord name, ask DMO to correct it, then run **/link**.";
  if (p && (p.s || p.k) && !isMrPlus(p)) return `Only Middle Management and above (rank 06+) can log events. Your rank is ${p.k || p.s}.`;
  return "";
}
function rankNumber(rank) { const m = String(rank || "").match(/^\s*(\d+)/); return m ? Number(m[1]) : 0; }
// MR+ = Management sheet (MR, HR, EX) or Department Leadership — rank 06 and above.
function isMrPlus(p) { return p.s === "Management" || p.s === "Leadership" || rankNumber(p.k) >= 6; }
function firstValue(v) { return Array.isArray(v) ? String(v[0] || "") : String(v || ""); }

// Checks a request against the roster before it's posted, and tidies names
// to how the roster spells them. Returns { problems: [], warning }.
async function checkRequest(env, i, type, st) {
  const out = { problems: [], warning: "" };
  const roster = await loadRoster(env).catch(() => null);
  const meta = type === "loa" ? null : await loadMeta(env).catch(() => null);
  const onRoster = (name) => roster && roster.by[String(name || "").trim().replace(/^@/, "").toLowerCase()];
  const me = roster ? findPerson(roster, i) : null;
  if (type === "loa") { st.discord = ""; st.roblox = me ? (me.r || me.d) : ""; }

  if (!roster && type === "roster" && st.mode === "update") {
    out.problems.push("Couldn't reach the roster to check your changes. Try again in a minute.");
    return out;
  }
  if (!roster) {
    out.warning = "Couldn't reach the roster to check this request" + (type === "loa" ? ". Please confirm they're MR+." : ".");
    return out;
  }

  if (type === "award") {
    const p = onRoster(st.roblox) || onRoster(st.discord);
    if (p) st.roblox = p.r || p.d;
    else out.problems.push(`**Roblox Username:** "${cleanLine(st.roblox, 40) || "(blank)"}" isn't on the roster.`);
    const labels = awardLabels(meta);
    const typed = cleanLine(st.award, 100).toLowerCase();
    if (!typed) out.problems.push("**Award Requested:** choose an award.");
    else if (labels.length) {
      const exact = labels.find(a => a.toLowerCase() === typed);
      const close = exact ? [exact] : labels.filter(a => a.toLowerCase().includes(typed) || typed.includes(a.toLowerCase()));
      if (close.length === 1) st.award = close[0];
      else out.problems.push(`**Award Requested:** "${st.award}" isn't an award on the roster.` + (close.length ? ` Did you mean: ${close.slice(0, 8).join(", ")}?` : ""));
    }
  }

  if (type === "roster" && me) {
    // Already on the roster: an UPDATE. Work out exactly what changes.
    st.mode = "update";
    if (me.s === "Leadership") out.problems.push("Department Leadership details are changed from the roster's Admin page, not by request.");
    st.current = { discord: me.d || "", roblox: me.r || "", tz: me.z || "", rank: me.k || "", sheet: me.s || "" };
    const changes = {};
    const roblox = cleanLine(st.roblox, 40).replace(/^@/, "");
    if (!roblox) out.problems.push("**Roblox Username:** fill it in.");
    else if (roblox !== st.current.roblox) {
      const other = onRoster(roblox);
      if (other && other !== me) out.problems.push(`The Roblox username **${roblox}** already belongs to someone else on the roster.`);
      else changes.roblox = { from: st.current.roblox, to: roblox };
    }
    const tz = cleanTimezone(cleanLine(st.tz, 12));
    if (tz && tz !== st.current.tz && cleanTimezone(st.current.tz) !== tz) {
      if (!/^UTC[+-]\d{1,2}(:\d{2})?$/.test(tz)) out.problems.push(`**Timezone (UTC):** "${tz}" isn't a timezone like UTC+1 or UTC-5.`);
      else changes.tz = { from: st.current.tz, to: tz };
    }
    const typed = cleanLine(st.rank, 60);
    if (typed && typed !== st.current.rank) {
      const list = updateRanks(meta, me), n = rankNumber(typed);
      const hit = list.find(r => r.toLowerCase() === typed.toLowerCase()) || (n ? list.find(r => rankNumber(r) === n) : null);
      if (n >= 14) out.problems.push("**Rank:** ranks 14 and 15 are Department Leadership positions, which are appointed rather than requested.");
      else if (!list.length) changes.rank = { from: st.current.rank, to: typed };
      else if (!hit) out.problems.push(`**Rank:** "${typed}" isn't a rank on the roster. Choose one of: ${list.join(", ")}.`);
      else if (hit !== st.current.rank) changes.rank = { from: st.current.rank, to: hit };
    }
    st.changes = changes;
    if (!out.problems.length && !Object.keys(changes).length) {
      out.problems.push(`Nothing has changed: you're already on the roster as **${me.r || me.d}**, ${me.k || "no rank"}` +
        (me.z ? `, ${me.z}` : "") + ". Choose a different rank, or change your Roblox username or timezone.");
    }
  }

  if (type === "roster" && !me) {
    if (!cleanLine(st.roblox, 40)) out.problems.push("**Roblox Username:** fill it in.");
    else if (onRoster(st.roblox)) out.problems.push(`The Roblox username **${cleanLine(st.roblox, 40)}** is already on the roster.`);
    if (st.ref) {
      const p = onRoster(st.ref);
      if (!p) out.problems.push(`**Referred by:** ${st.ref} isn't on the roster. Only MR members can be put as a referrer.`);
      else if (!isMrPlus(p)) out.problems.push(`**Referred by:** ${p.r || p.d} is **${p.k}**. Only MR members can be referrers.`);
      else { st.ref = p.r || p.d; st.refDiscord = p.d || ""; }
    }
    if (meta && meta.ranks.length) {
      const typed = cleanLine(st.rank, 60), n = rankNumber(typed);
      const hit = meta.ranks.find(r => r.toLowerCase() === typed.toLowerCase()) || (n ? meta.ranks.find(r => rankNumber(r) === n) : null);
      if (hit) st.rank = hit;
      else out.problems.push(`**Rank:** "${typed || "(none)"}" isn't a rank you can be rostered at. Choose one of: ${meta.ranks.join(", ")}.`);
    }
  }

  if (type === "loa") {
    if (!me) out.problems.push("LOA requests are for MR+ only, and you aren't on the roster under your Discord name.");
    else if (!isMrPlus(me)) out.problems.push(`LOA requests are for MR+ only. Your rank is ${me.k}.`);
  }
  return out;
}

// "+1", "UTC+1", "gmt -5", "UTC+5:30", "0" -> "UTC+1" etc. Anything else is kept as typed.
function cleanTimezone(s) {
  const m = String(s || "").trim().match(/^(?:utc|gmt)?\s*([+\-−])?\s*(\d{1,2})(?::?(\d{2}))?$/i);
  if (/^(utc|gmt)$/i.test(String(s).trim())) return "UTC+0";
  if (!m) return s;
  const h = Number(m[2]);
  if (h > 14) return s;
  const sign = m[1] === "-" || m[1] === "−" ? "-" : "+";
  return "UTC" + sign + h + (m[3] && m[3] !== "00" ? ":" + m[3] : "");
}

// /event log: opens the private panel where everything is filled in.
async function eventLogStart(env, ctx, opts, i) {
  const type = EVENT_TYPES.indexOf(opts.type) !== -1 ? opts.type : "";
  if (!type) return reply("Choose an event type: run **/event log** again and pick one.");
  const other = cleanLine(opts.other || "", EVENT_OTHER_MAX);
  if (type === "Other" && !other) return reply("For Other, describe the event in the **other** box (up to " + EVENT_OTHER_MAX + " characters), then run **/event log** again.");
  // Turned off in the roster's Settings ▸ Events? (checked again when it's sent)
  // The roster is loaded at the same time, to fill in the host as the person logging.
  const within = (p) => Promise.race([p.catch(() => null), new Promise(r => setTimeout(() => r(null), 1500))]);
  const [types, roster] = await Promise.all([within(eventTypes(env)), within(loadRoster(env))]);
  if (!types) ctx.waitUntil(eventTypes(env).catch(() => {}));
  if (!roster) ctx.waitUntil(loadRoster(env).catch(() => {}));
  if (types && types[type] && !types[type].enabled) return reply(`${type} events are currently turned off.`);
  if (linked(env) && roster) {
    // Kept short: Discord needs the answer within 3 seconds (Submit checks again properly).
    const who = findPerson(roster, i) || await Promise.race([loggerOf(env, roster, i).catch(() => null), new Promise(r => setTimeout(() => r(null), 900))]);
    const no = cantLog(who);
    if (no) return reply(no);
  }
  const draft = blankDraft();
  draft.event = eventLabel(type, other);
  draft.doubleAP = opts.double_ap === true;
  // Host = you, to start with (change it in the Host menu).
  const me = (i && i.member && i.member.user) || (i && i.user) || null;
  if (me && me.id) { draft.host = rosterNameFor(roster, me, i.member).name; draft.hostIds = [me.id]; }
  return { type: R.MESSAGE, data: Object.assign(panel(draft, roster), { flags: EPHEMERAL }) };
}

// ---------------------------------------------------------------------
// Event types. The roster keeps which are turned on (and what each role
// gets) on its hidden "Event Types" sheet; the bridge reads it ("eventTypes").
// The queue's Event column (CK) gets the exact label: "Patrol" … or
// "Other: <what it was>".
// ---------------------------------------------------------------------
const EVENT_TYPES = ["Patrol", "SS Qualification", "CO Qualification", "Gamenight", "Training", "Other"];
const EVENT_OTHER_MAX = 60;
function eventLabel(type, other) { return type === "Other" ? "Other: " + other : type; }
// "Patrol" -> {type:"Patrol"}, "Other: Mining trip" -> {type:"Other", other:"Mining trip"}, else null.
function parseEventType(label) {
  const s = String(label || "").trim();
  const m = s.match(/^Other\s*:\s*(.+)$/i);
  if (m) return { type: "Other", other: m[1].trim().slice(0, EVENT_OTHER_MAX) };
  const t = EVENT_TYPES.find(x => x.toLowerCase() === s.toLowerCase() && x !== "Other");
  return t ? { type: t, other: "" } : null;
}
// { Patrol: { enabled, counts:{host,cohost,supervisor,attendee}, market:{…} }, … } — cached 5 minutes.
let EVENT_TYPES_CACHE = null;
async function eventTypes(env, fresh) {
  if (!fresh && EVENT_TYPES_CACHE && Date.now() - EVENT_TYPES_CACHE.at < 5 * 60000) return EVENT_TYPES_CACHE.types;
  if (!linked(env)) return null;
  const res = await bridge(env, { action: "eventTypes" });
  if (!res.ok) throw new Error(res.error || "Couldn't read the event types");
  const types = {};
  (res.types || []).forEach(t => { types[t.type] = t; });
  EVENT_TYPES_CACHE = { at: Date.now(), types: types };
  return types;
}

// ---------------------------------------------------------------------
// The panel. Its state lives in the panel message itself (no database):
// the embed's fields and the member pickers' selections.
// ---------------------------------------------------------------------
function blankDraft() {
  return { event: "", doubleAP: false, date: today(), notes: "", host: "", hostIds: [], supervisor: "", supIds: [],
           cohosts: [], coIds: [], picked: [], pickedIds: [], manual: [], proof: "", proofName: "" };
}

function draftLog(d) {
  const attendees = uniq(d.picked.concat(d.manual));
  return { event: d.event, doubleAP: !!d.doubleAP, date: d.date, host: d.host, supervisor: d.supervisor || "", cohosts: d.cohosts, attendees: attendees, notes: d.notes };
}

function missingParts(d) {
  const m = [];
  if (!parseEventType(d.event)) m.push("event type (run /event log again and pick a type)");
  if (!d.date || !d.notes) m.push("event details (date, notes)");
  if (!d.proof) m.push("proof screenshot");
  if (!d.host) m.push("host");
  if (!d.picked.length && !d.manual.length) m.push("at least one attendee");
  return m;
}

const P = {
  event: "Type", dap: "Double AP", date: "Date", host: "Host", sup: "Supervisor", co: "Co-hosts",
  picked: "Attendees (picked)", manual: "Not in the server", notes: "Notes"
};

function panel(d, roster) {
  const log = draftLog(d);
  const flag = (n) => roster && n && !roster.by[n.toLowerCase()] ? `${n} ⚠️` : n;
  const detailsDone = !!(d.date && d.notes);
  const steps = [
    [detailsDone, "Event details", "**Event details**"],
    [!!d.proof, "Proof", "**Proof**"],
    [!!d.host, "Host", "the **Host** menu"],
    [log.attendees.length > 0, "Attendees", "the **Attendees** menu"]
  ];
  const done = steps.filter(x => x[0]).length;
  const bar = "▰".repeat(done) + "▱".repeat(steps.length - done);
  const next = steps.find(x => !x[0]);
  const warn = roster && [d.host, d.supervisor].concat(d.cohosts, log.attendees).some(n => n && !roster.by[n.toLowerCase()]);

  const description = [
    `${bar}  **${done} of ${steps.length} required steps done**`,
    steps.map(x => `${x[0] ? "✅" : "⬜"} ${x[1]}`).join("   "),
    next ? `\n**Next:** use ${next[2]}.` : "\n**Ready.** Press **Submit** to send it for approval.",
    warn ? "⚠️ marks names not on the roster. They won't receive points." : ""
  ].filter(Boolean).join("\n");

  const fields = [
    { name: P.event, value: d.event || "—", inline: true }
  ].concat(d.doubleAP ? [{ name: P.dap, value: "Yes (attendees get double)", inline: true }] : [], [
    { name: P.date, value: d.date || "—", inline: true },
    { name: P.host, value: d.host ? flag(d.host) : "—", inline: true },
    { name: P.sup, value: d.supervisor ? flag(d.supervisor) : "—", inline: true }
  ]).concat(
    nameFields(`${P.co} (${d.cohosts.length})`, d.cohosts.map(flag)),
    nameFields(`${P.picked} (${d.picked.length})`, d.picked.map(flag)),
    [{ name: P.notes, value: (d.notes || "—").slice(0, 1024), inline: false }]
  );

  const sel = (id, placeholder, max, ids) => ({ type: 1, components: [{
    type: 5, custom_id: id, placeholder: placeholder, min_values: 0, max_values: max,
    default_values: ids.map(x => ({ id: x, type: "user" }))
  }] });

  return {
    content: "",
    embeds: [Object.assign({
      author: { name: CONFIG.NAME },
      title: d.event || "New event log",
      description: description,
      color: done === steps.length ? CONFIG.COLOURS.approved : CONFIG.COLOURS.draft,
      fields: fields,
      footer: { text: `Only you can see this · ${log.attendees.length} attendee${log.attendees.length === 1 ? "" : "s"} · proof: ${d.proof ? d.proofName : "none yet"}` }
    }, d.proof ? { image: { url: d.proof } } : {})],
    components: [
      sel("d:host", "Host (required): type a name", 1, d.hostIds),
      sel("d:att", "Attendees (required): type a name, up to 25", 25, d.pickedIds),
      sel("d:co", "Co-hosts (optional)", 10, d.coIds),
      sel("d:sup", "Supervisor (optional)", 1, d.supIds),
      { type: 1, components: [
        { type: 2, style: detailsDone ? 2 : 1, label: detailsDone ? "Edit details" : "Event details", custom_id: "d:details", emoji: { name: "📝" } },
        { type: 2, style: d.proof ? 2 : 1, label: d.proof ? "Change proof" : "Add proof", custom_id: "d:proof", emoji: { name: "📎" } },
        { type: 2, style: 3, label: "Submit", custom_id: "d:submit", emoji: { name: "📨" }, disabled: done !== steps.length },
        { type: 2, style: 4, label: "Cancel", custom_id: "d:cancel" }
      ] }
    ],
    allowed_mentions: NO_PINGS
  };
}

// Field names compared without any leading emoji, so older messages (labels with emoji) still read.
const plainName = (s) => String(s || "").replace(/^[^A-Za-z0-9]+/, "").trim();
const sameField = (name, label) => plainName(name).startsWith(plainName(label));

function readDraft(message) {
  const e = (message.embeds || [])[0] || {};
  const f = (prefix) => (e.fields || []).filter(y => sameField(y.name, prefix)).map(y => y.value).filter(v => v !== "—").join(", ");
  const one = (prefix) => f(prefix).replace(/ ⚠️$/, "");
  const list = (v) => !v ? [] : v.split(",").map(s => s.replace(/ ⚠️$/, "").trim()).filter(Boolean);
  const ids = (cid) => {
    for (const r of message.components || []) for (const c of r.components || []) {
      if (c.custom_id === cid) return (c.default_values || []).map(v => v.id);
    }
    return [];
  };
  const foot = String((e.footer && e.footer.text) || "");
  const hasProof = !!(e.image && e.image.url);
  return {
    event: f(P.event) || f("Event"), doubleAP: !!f(P.dap), date: f(P.date), notes: (e.fields || []).filter(y => plainName(y.name) === plainName(P.notes)).map(y => y.value).filter(v => v !== "—").join(""),
    host: one(P.host), hostIds: ids("d:host"),
    supervisor: one(P.sup), supIds: ids("d:sup"),
    cohosts: list(f(P.co)), coIds: ids("d:co"),
    picked: list(f(P.picked)), pickedIds: ids("d:att"),
    manual: [],                                   // everyone is picked from the server now
    proof: hasProof ? e.image.url : "",
    proofName: hasProof ? ((foot.match(/proof: (.+)$/) || [, "proof.png"])[1]) : ""
  };
}

async function refreshPanel(env, i, draft) {
  let roster = null;
  try { roster = await loadRoster(env); } catch (e) {}
  await editOriginal(env, i, panel(draft, roster));
}

async function pickMembers(env, i, draft, which) {
  try {
    let roster = null;
    try { roster = await loadRoster(env); } catch (e) {}
    const res = i.data.resolved || {};
    const ids = i.data.values || [];
    const names = ids.map(id => rosterNameFor(roster, (res.users || {})[id], (res.members || {})[id]).name);
    if (which === "host") { draft.host = names[0] || ""; draft.hostIds = ids; }
    else if (which === "sup") { draft.supervisor = names[0] || ""; draft.supIds = ids; }
    else if (which === "co") { draft.cohosts = uniq(names); draft.coIds = ids; }
    else { draft.picked = uniq(names); draft.pickedIds = ids; }
    await editOriginal(env, i, panel(draft, roster));
  } catch (e) {
    await followup(env, i, "Couldn't update the panel: " + e.message);
  }
}

// ---------------------------------------------------------------------
// Submit: proof + log to #approval-logs, queue on the roster
// ---------------------------------------------------------------------
async function submit(env, i, draft, who) {
  const log = draftLog(draft);
  try {
    const t = parseEventType(log.event);
    if (!t) throw new Error("This log has no event type. Cancel it and run /event log again, picking a type.");
    if (linked(env)) {
      const types = await eventTypes(env, true).catch(() => null);
      if (types && types[t.type] && !types[t.type].enabled) throw new Error(`${t.type} events are turned off right now.`);
    }
    if (linked(env)) {
      const no = cantLog(await loggerOf(env, await loadRoster(env).catch(() => null), i));
      if (no) throw new Error(no.replace(/^🚫 /, ""));
    }
    await editOriginal(env, i, { content: "Sending your event log…", components: [] });

    let check = null;
    if (linked(env)) {
      const res = await bridge(env, { action: "check", names: [log.host, log.supervisor].filter(Boolean).concat(log.cohosts, log.attendees) })
        .catch(e => ({ ok: false, error: e.message }));
      check = res.ok ? res.results : { error: res.error };
    }

    const proof = await download(draft.proof, draft.proofName);
    const ids = await resolveIds(env, i.guild_id, draft, log);
    const embed = card(log, "pending", { submitterId: who.id, submittedAt: Date.now(), check: rosterCheck(log, check), proofImage: "attachment://" + proof.name });
    const content = fitContent(subtextLog(mentionLog(log, ids)), log);
    const msg = await discordFiles(env, "POST", `/channels/${CONFIG.APPROVAL_CHANNEL_ID}/messages`, {
      content: content, embeds: [embed], components: linked(env) ? [decisionRow("event", env)] : [pendingRow()],
      allowed_mentions: CONFIG.PING_IN_APPROVAL_LOG ? pingsIn(content) : NO_PINGS,
      attachments: [{ id: 0, filename: proof.name }]
    }, [proof]);

    let note = "";
    if (linked(env)) {
      const q = await bridge(env, {
        action: "submit", id: msg.id, submittedBy: who.name, submittedById: who.id, byName: caller(i).username || "", log: log,
        proof: `https://discord.com/channels/${i.guild_id}/${CONFIG.APPROVAL_CHANNEL_ID}/${msg.id}`,
        proofName: proof.name, proofType: proof.type, proofData: base64(proof.data)
      }).catch(e => ({ ok: false, error: e.message }));
      note = q.ok ? "It's also on the roster's **Approvals** page." : `It couldn't be added to the roster's Approvals page (${q.error}).`;
    }
    await editOriginal(env, i, {
      content: "",
      embeds: [{
        author: { name: CONFIG.NAME }, color: CONFIG.COLOURS.approved,
        title: "Sent for approval",
        description: `**${log.event}** is waiting in <#${CONFIG.APPROVAL_CHANNEL_ID}>.\n` +
          `[Open it](https://discord.com/channels/${i.guild_id}/${CONFIG.APPROVAL_CHANNEL_ID}/${msg.id}) · ${log.attendees.length} attendee${log.attendees.length === 1 ? "" : "s"}\n\n` +
          `DMO will review it in Discord or on the roster's Approvals page. Points are added once it's approved, and the official log is posted in <#${CONFIG.EVENT_LOG_CHANNEL_ID}>. You'll get a DM if it's denied.` + (note && !/^It's also/.test(note) ? "\n" + note : ""),
        timestamp: new Date().toISOString()
      }],
      components: []
    });
  } catch (e) {
    await editOriginal(env, i, Object.assign(panel(draft), { content: "Couldn't send it: " + e.message + "\nFix the problem and press **Submit** again." }))
      .catch(() => followup(env, i, "Couldn't send it: " + e.message));
  }
}

function rosterCheck(log, check) {
  if (!check) return null;
  if (check.error) return { name: UI.check, value: "Couldn't reach the roster: " + String(check.error).slice(0, 200), inline: false };
  const all = uniq([log.host, log.supervisor].filter(Boolean).concat(log.cohosts, log.attendees));
  const missing = all.filter(n => !check[n.toLowerCase()]);
  const hostInfo = check[(log.host || "").toLowerCase()];
  const lines = [];
  if (hostInfo) lines.push(`Host rank: **${hostInfo.rank}** (${hostInfo.sheet})`);
  lines.push(missing.length
    ? `**${missing.length} not on the roster** (no points): ${missing.join(", ")}`.slice(0, 900)
    : `All ${all.length} people are on the roster`);
  return { name: UI.check, value: lines.join("\n"), inline: false };
}

// Decisions made on the roster's Approvals page, and point results.
async function syncFromRoster(env, b) {
  const path = `/channels/${CONFIG.APPROVAL_CHANNEL_ID}/messages/${b.id}`;
  if (b.status === "Claimed" || b.status === "Released") {     // claimed / released on the roster's Approvals page
    await discord(env, "PATCH", path, { components: [b.status === "Claimed" ? claimedRow("event", "web", `${b.by || "someone"} (roster)`) : decisionRow("event", env)],
      allowed_mentions: NO_PINGS }).catch(() => {});
    return;
  }
  const message = await discord(env, "GET", path);
  const log = parseLog(message);
  const who = String(b.by || "a roster editor").replace(/@.*$/, "");

  if (b.status === "Approved" || b.status === "Denied") {
    const approved = b.status === "Approved";
    await discord(env, "PATCH", path, finalMessage(message, log, approved ? "approved" : "denied",
      `**${who}** (${b.where || "roster page"})`, b.reason, approved ? "Adding points to the roster…" : null,
      (approved ? "Approved by " : "Denied by ") + who));
    if (approved) await postEventLog(env, log, message, `**${who}** (${b.where || "roster page"})`, b.proofUrl);
    else if (b.submittedById) await dm(env, b.submittedById, denialDm(log, who, b.reason));
  } else if (b.status === "Done" || b.status === "Error") {
    const e = Object.assign({}, (message.embeds || [])[0]);
    const points = b.status === "Done" ? "Points added to the roster" : "Points not added: " + String(b.note || "").slice(0, 300);
    e.fields = (e.fields || []).filter(f => plainName(f.name) !== plainName(UI.points)).concat([{ name: UI.points, value: points, inline: false }]);
    const kp = keepProof(message);
    if (kp.image) e.image = { url: kp.image };
    await discord(env, "PATCH", path, { embeds: [e], components: message.components || [], attachments: kp.attachments, allowed_mentions: NO_PINGS });
    if (b.status === "Done") {
      // Tell the person who logged it (once).
      const submitter = cardState(message).submitterId;
      const once = env.BOT_KV ? await kvGet(env, "dm:done:" + b.id, null) : null;
      if (submitter && !once) {
        await dm(env, submitter, approvalDm(log, message));
        if (env.BOT_KV) await kvPut(env, "dm:done:" + b.id, 1, 30 * 86400).catch(() => {});
      }
    }
    if (b.status === "Error") {
      await discord(env, "POST", `/channels/${CONFIG.APPROVAL_CHANNEL_ID}/messages`, {
        embeds: [{ color: CONFIG.COLOURS.denied, title: "Points not added",
          description: `**${log.event}** was approved, but the roster couldn't add the points.\n${String(b.note || "").slice(0, 500)}\n\nFix the issue and press **Retry** on the roster's Approvals page.` }],
        message_reference: { message_id: b.id }, allowed_mentions: NO_PINGS
      });
    }
  }
}

// #event-logs: just the official log text (with pings) and the proof image
// underneath it. No embed.
async function postEventLog(env, log, approvalMessage, approvedBy, driveUrl) {
  try {
    const raw = String(approvalMessage.content || "").split("\n").map(l => l.replace(/^-# /, "")).join("\n");
    const content = fitContent(/^Event: /m.test(raw) ? raw : formatLog(log), log);
    // Proof sources, in order: the screenshot on the #approval-logs message
    // (fetched fresh, in case its link expired), then the Drive copy.
    const file = await proofFile(env, approvalMessage, driveUrl);
    const payload = { content: content, allowed_mentions: CONFIG.PING_IN_EVENT_LOG ? pingsIn(content) : NO_PINGS };
    if (file) {
      payload.attachments = [{ id: 0, filename: file.name }];
      await discordFiles(env, "POST", `/channels/${CONFIG.EVENT_LOG_CHANNEL_ID}/messages`, payload, [file]);
    } else {
      // Only if the image really can't be found: say so in small text.
      payload.content = fitContent(content + "\n-# The proof screenshot couldn't be attached; it's available on the roster's Approvals page.", log);
      await discord(env, "POST", `/channels/${CONFIG.EVENT_LOG_CHANNEL_ID}/messages`, payload);
    }
  } catch (e) {
    await discord(env, "POST", `/channels/${CONFIG.APPROVAL_CHANNEL_ID}/messages`, {
      content: `**${log.event}** was approved but couldn't be posted to <#${CONFIG.EVENT_LOG_CHANNEL_ID}> (${e.message}).`,
      allowed_mentions: NO_PINGS
    }).catch(() => {});
  }
}

// ---- Pings: the event log with <@mentions> for everyone we can find ----
// Picked members already have their Discord IDs; the host and names added
// by hand are looked up in the server by their roster Discord name.
async function resolveIds(env, guildId, draft, log) {
  const ids = {};
  const pair = (names, list) => { if (names.length === list.length) names.forEach((n, k) => { ids[n.toLowerCase()] = list[k]; }); };
  pair(draft.picked, draft.pickedIds);
  pair(draft.cohosts, draft.coIds);
  pair(draft.host ? [draft.host] : [], draft.hostIds || []);
  pair(draft.supervisor ? [draft.supervisor] : [], draft.supIds || []);
  let roster = null;
  try { roster = await loadRoster(env); } catch (e) {}
  const todo = uniq([log.host, log.supervisor].filter(Boolean).concat(log.cohosts, log.attendees)).filter(n => !ids[n.toLowerCase()]).slice(0, 40);
  for (const n of todo) {
    const p = roster && roster.by[n.toLowerCase()];
    const tries = uniq([p && p.d, n, p && p.r].filter(Boolean));
    let stop = false;
    for (const q of tries) {
      try {
        const list = await discord(env, "GET", `/guilds/${guildId}/members/search?query=${encodeURIComponent(q)}&limit=10`);
        const hit = (list || []).find(m => [m.user && m.user.username, m.nick, m.user && m.user.global_name]
          .some(x => x && String(x).toLowerCase() === q.toLowerCase()));
        if (hit) { ids[n.toLowerCase()] = hit.user.id; break; }
      } catch (e) { stop = true; break; }   // member search not allowed: just don't ping them
    }
    if (stop) break;
  }
  return ids;
}

function mentionLog(log, ids) {
  const m = (n) => ids[String(n).toLowerCase()] ? `<@${ids[String(n).toLowerCase()]}>` : n;
  return [
    `Event Type: ${log.event}`,
    log.doubleAP ? "Double AP: Yes" : null,
    `Date: ${log.date}`,
    `Host: ${m(log.host)}`,
    `Co-Host: ${log.cohosts.length ? log.cohosts.map(m).join(", ") : "None"}`,
    log.supervisor ? `Supervisor: ${m(log.supervisor)}` : null,
    `Attendees: ${log.attendees.map(m).join(", ")}`,
    `Notes: ${log.notes || "None"}`
  ].filter(x => x !== null).join("\n");
}

// Message text is limited to 2000 characters; very long logs fall back to names.
function fitContent(text, log) {
  if (text.length <= 2000) return text;
  const plain = formatLog(log);
  return plain.length <= 2000 ? plain : plain.slice(0, 1990) + "…";
}

function pingsIn(content) {
  const users = uniq((String(content).match(/<@!?(\d+)>/g) || []).map(x => x.replace(/\D/g, ""))).slice(0, 100);
  return { parse: [], users: users };
}

// ---- /lookup: the Find/Edit profile ----
async function lookup(env, i, name) {
  try {
    const approver = !!(await reviewerCheck(env, caller(i)).catch(() => ({}))).ok;      // DMO (linked) see punishments
    const res = await bridge(env, { action: "profile", query: name, includePunishments: approver });
    if (!res.ok) return editReply(env, i, "Couldn't reach the roster: " + res.error);
    if (!res.person) {
      return editReply(env, i, `**${cleanLine(name, 60)}** isn't on the roster.` +
        (res.suggestions && res.suggestions.length ? ` Did you mean: ${res.suggestions.join(", ")}?` : ""));
    }
    const avatar = await robloxHeadshot(res.person.roblox).catch(() => "");
    await editReply(env, i, "", [profileEmbed(res, avatar, approver)]);
  } catch (e) {
    await editReply(env, i, "Couldn't reach the roster: " + e.message);
  }
}

function profileEmbed(res, avatar, approver) {
  const p = res.person, mgmt = p.sheet === "Management";
  const clr = String(p.clearance || "").toUpperCase();
  const colour = { EX: 0x1F6B42, HR: 0x6B3FA0, MR: 0xC9A227, LR: 0x7A4A12 }[clr.split(/[^A-Z]/)[0]] || CONFIG.COLOURS.info;
  const d = (iso) => { if (!/^\d{4}-\d{2}-\d{2}$/.test(iso || "")) return iso || "—"; const [y, m, dd] = iso.split("-"); return `${+dd} ${["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][+m - 1]} ${y}`; };
  const since = (iso) => { const t = Date.parse(iso + "T00:00:00Z"); if (isNaN(t)) return ""; const days = Math.floor((Date.now() - t) / 86400000); return days >= 365 ? ` (${(days / 365).toFixed(1)} yrs)` : ` (${days} days)`; };

  // Chips line, like the Find/Edit header
  const chips = [clr && `\`${clr}\``, `**${p.rank || "No rank"}**`, mgmt ? "Management" : "Worker"];
  if (res.formerTag) chips.push(res.formerTag);
  if (p.strikes) chips.push(`${p.strikes} strike${p.strikes > 1 ? "s" : ""}`);
  if (mgmt && p.loa === "ACTIVE") chips.push("On LOA");
  const dept = [];
  if (res.departments && res.departments.dmo) dept.push(`DMO · ${res.departments.dmo}`);
  if (res.departments && res.departments.cpm) dept.push(`CPM · ${res.departments.cpm}`);

  const desc = [chips.filter(Boolean).join("  ·  ")];
  if (dept.length) desc.push(dept.join("  ·  "));
  if (p.discord && p.roblox) desc.push(`Discord: **${p.discord}**`);

  const fields = [
    { name: "Attended", value: String(p.attended || 0), inline: true },
    { name: "Co-hosted", value: String(p.cohosted || 0), inline: true }
  ];
  if (mgmt) fields.push({ name: "Hosted", value: String(p.hosted || 0), inline: true }, { name: "Supervised", value: String(p.supervised || 0), inline: true });
  fields.push({ name: "Total events", value: String(p.total || 0), inline: true });
  if (mgmt) fields.push({ name: "Quota", value: `${p.quota || "—"}${p.quotaTick ? " · met this week" : " · not met this week"}`, inline: true });
  else fields.push({ name: "Activity", value: `${p.status || "—"}${p.lastActive ? "\nLast active " + d(p.lastActive) : ""}`, inline: true });

  const m = res.thisMonth || {};
  fields.push({ name: "This month", value: `Attended ${m.Attended || 0} · Hosted ${m.Hosted || 0} · Co-hosted ${m["Co-Hosted"] || 0} · Supervised ${m.Supervised || 0}`, inline: false });

  fields.push({ name: "Joined", value: d(p.joined) + since(p.joined), inline: true },
              { name: "Timezone", value: p.timezone || "—", inline: true });
  if (res.inRank) {
    const e = res.inRankEvents || {};
    fields.push({ name: "At this rank", value: `${res.inRank.known ? "Since" : "Before"} ${res.inRank.since} · ${res.inRank.days} days` +
      `\n${e.Attended || 0} attended · ${e.Hosted || 0} hosted · ${e["Co-Hosted"] || 0} co-hosted`, inline: true });
  }

  if (res.stints && res.stints.length) {
    fields.push({ name: `Rank history (${res.stintCount})`, value: res.stints.map(s =>
      `• ${s.rank}: ${s.known ? s.start : "before " + s.start}${s.end ? " to " + s.end : " to now"}`).join("\n").slice(0, 1024), inline: false });
  }

  const l = res.loas || { count: 0 };
  fields.push({ name: `LOA history (${l.count})`, value: l.count
    ? `${l.days} days in total\n` + l.recent.map(x => `${x.start} – ${x.end} (${x.days}d) · ${x.status}`).join("\n")
    : "No LOAs recorded", inline: false });

  const aw = res.awards || [];
  const groups = { SPCL: "Special", EXP: "Game Experience", EVNT: "Event-based", EXEC: "Executive-granted", OTHER: "Other" };
  fields.push({ name: `Awards (${aw.length})`, value: aw.length
    ? Object.keys(groups).map(g => { const x = aw.filter(a => a.group === g); return x.length ? `**${groups[g]}:** ${x.map(a => a.label).join(", ")}` : ""; }).filter(Boolean).join("\n").slice(0, 1024)
    : "No awards yet", inline: false });

  if (approver && res.punishments) {
    fields.push({ name: `Punishments (approvers only)`, value: res.punishments.length
      ? res.punishments.map(x => `• **${x.punishment}** · ${x.issued}${x.ends ? " → " + x.ends : ""}${x.reason ? "\n  " + x.reason.slice(0, 120) : ""}`).join("\n").slice(0, 1024)
      : "None on record", inline: false });
  }

  const embed = {
    author: { name: CONFIG.NAME },
    title: p.roblox || p.discord,
    description: desc.join("\n"),
    color: colour,
    fields: fields,
    footer: { text: `Employee ID #${p.emp || "—"} · ${p.sheet} roster · ${CONFIG.NAME}` },
    timestamp: new Date().toISOString()
  };
  if (avatar) embed.thumbnail = { url: avatar };
  return embed;
}

// Roblox headshot (same public API the Find/Edit page uses).
async function robloxHeadshot(username) {
  if (!username) return "";
  const u = await fetch("https://users.roblox.com/v1/usernames/users", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ usernames: [username], excludeBannedUsers: false })
  }).then(r => r.ok ? r.json() : null);
  const id = u && u.data && u.data[0] && u.data[0].id;
  if (!id) return "";
  const t = await fetch(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${id}&size=150x150&format=Png&isCircular=false`)
    .then(r => r.ok ? r.json() : null);
  const x = t && t.data && t.data[0];
  return x && x.state === "Completed" && x.imageUrl ? x.imageUrl : "";
}

// =====================================================================
// COMMUNITY FEATURES (spec 2026-10-09)
//   /event schedule | cancel | list     events on the HQ (Management+ to change)
//   /profile [member]                   public profile card
//   /leaderboard                        this month's top hosts + attendees
//   /mystats                            your month: events by type, quota, LOA, Market points
//   /link                               link a Discord account to its roster entry
//   /roster start | submit              code-checked roster applications
//   Approve / Deny on roster + LOA requests in Discord (reviewers)
//   Every 5 minutes (Cron Trigger): event announcements + reminders,
//   promotion posts, announcement mirror, Monday digest, approvals
//   reminder.
//
// Reads come from the public HQ API (CONFIG.HQ_URL, ?api=...), writes go
// through the DMO Bridge (shared secret). Nothing private is posted in
// public channels: strikes, LOA, quota and activity never appear here.
// =====================================================================

// ---- Small helpers ----
function flatOptions(i) {
  const out = { sub: "", opts: {}, focused: null };
  const walk = (list) => (list || []).forEach(o => {
    if (o.type === 1 || o.type === 2) { out.sub = out.sub ? out.sub + " " + o.name : o.name; walk(o.options); return; }
    out.opts[o.name] = o.value;
    if (o.focused) out.focused = o;
  });
  walk(i.data && i.data.options);
  return out;
}
function pick(o, keys, dflt) {
  if (!o || typeof o !== "object") return dflt;
  for (const k of keys) if (o[k] !== undefined && o[k] !== null && o[k] !== "") return o[k];
  return dflt;
}
function toMs(v) {
  if (typeof v === "number") return v < 1e11 ? v * 1000 : v;
  if (/^\d{10,13}$/.test(String(v || ""))) return toMs(Number(v));
  const t = Date.parse(v);
  return isNaN(t) ? 0 : t;
}
function normEmp(s) { return String(s || "").replace(/\D/g, "").replace(/^0+/, ""); }
function truthy(v) {
  if (v === true) return true;
  if (v === false || v == null) return false;
  if (typeof v === "number") return v !== 0;
  const s = String(v).trim();
  return !!s && !/^(no|false|n|0|none|-|—)$/i.test(s);
}
function fmtMins(n) { n = Number(n) || 0; const h = Math.floor(n / 60), m = n % 60; return h ? `${h}h${m ? " " + m + "m" : ""}` : `${m}m`; }
function caller(i) { return (i.member && i.member.user) || i.user || {}; }
function callerName(i) { const u = caller(i); return (i.member && i.member.nick) || u.global_name || u.username || "Unknown"; }
// Reviewers = people whose Discord account is linked (/link) to a roster entry
// that's in the DMO department on the roster's Departments tab. No Discord role
// is involved; the bridge checks again before anything is recorded.
const REVIEWERS = {};                                   // userId -> { at, ok, linked, name, reason }
// user: Discord user object ({id, username}) or just an id.
async function reviewerCheck(env, user, fresh) {
  const userId = typeof user === "object" && user ? user.id : user;
  const userName = typeof user === "object" && user ? user.username || "" : "";
  const hit = REVIEWERS[userId];
  if (!fresh && hit && Date.now() - hit.at < 10 * 60000) return hit;
  if (!fresh) {
    const kv = await kvGet(env, "rev2:" + userId, null);
    if (kv && Date.now() - kv.at < 10 * 60000) { REVIEWERS[userId] = kv; return kv; }
  }
  const res = await bridge(env, { action: "reviewer", discordId: userId, name: userName }).catch(e => ({ ok: false, error: e.message }));
  if (!res.ok) return { ok: false, unknown: true, reason: "Couldn't reach the roster to check you're DMO (" + res.error + ")." };
  const r = { at: Date.now(), ok: !!res.dmo, cpm: !!res.cpm, linked: !!res.linked, name: res.name || "",
    cpmReason: !res.cpm ? `Only CPM members can decide LOA requests. Your Discord name${userName ? ` (**${userName}**)` : ""} doesn't have a CPM title on the roster.` : "",
    reason: !res.dmo ? `Only DMO members can do that. Your Discord name${userName ? ` (**${userName}**)` : ""} doesn't have a DMO title on the roster.` : "" };
  REVIEWERS[userId] = r;
  await kvPut(env, "rev2:" + userId, r, 600).catch(() => {});
  return r;
}
// LOA requests are decided by CPM, everything else by DMO (same split as the roster).
function mayDecide(rv, kind) { return kind === "loa" ? !!rv.cpm : !!rv.ok; }
function decideReason(rv, kind) { return kind === "loa" ? rv.cpmReason || rv.reason : rv.reason; }
function cachedReviewer(userId) { const h = REVIEWERS[userId]; return h && Date.now() - h.at < 10 * 60000 ? h : null; }
async function forgetReviewer(env, userId) { delete REVIEWERS[userId]; if (env.BOT_KV) await env.BOT_KV.delete("rev2:" + userId).catch(() => {}); }
function isAllowedImage(att) { return /^image\/(png|jpe?g|webp)$/i.test((att && att.content_type) || ""); }
const IMAGE_RULE = "The screenshot has to be a PNG, JPG or WebP image.";
function shareFlags(o) { return o && o.share ? 0 : EPHEMERAL; }
function deferred(o) { return { type: R.DEFER_MESSAGE, data: { flags: shareFlags(o) } }; }

// ---- KV (Workers KV namespace bound as BOT_KV) ----
async function kvGet(env, key, dflt) {
  if (!env.BOT_KV) return dflt;
  try { const v = await env.BOT_KV.get(key, "json"); return v == null ? dflt : v; } catch (e) { return dflt; }
}
async function kvPut(env, key, value, ttl) {
  if (!env.BOT_KV) return;
  await env.BOT_KV.put(key, JSON.stringify(value), ttl ? { expirationTtl: Math.max(60, ttl) } : undefined);
}

// ---- The public HQ API (read-only, cached here for a minute) ----
const HQ_CACHE = {};
function hqBase(env) { return env.HQ_URL || CONFIG.HQ_URL || ""; }
async function hq(env, api, params, fresh) {
  const base = hqBase(env);
  if (!base) throw new Error("the HQ link isn't set up yet (HQ_URL)");
  const q = new URLSearchParams(Object.assign({ api: api }, params || {})).toString();
  const hit = HQ_CACHE[q];
  if (!fresh && hit && Date.now() - hit.at < 60000) return hit.data;
  const res = await rosterFetch(env, base + (base.indexOf("?") === -1 ? "?" : "&") + q, { redirect: "follow" });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch (e) { throw new Error("the HQ link didn't send back JSON (is HQ_URL the site's /api/public link?)"); }
  if (data && data.ok === false) throw new Error(data.error || "the HQ refused the request");
  HQ_CACHE[q] = { at: Date.now(), data: data };
  return data;
}
function hqList(data, keys) {
  if (Array.isArray(data)) return data;
  for (const k of keys) { const v = data && data[k]; if (Array.isArray(v)) return v; }
  return [];
}

// ---- Events ----
function hqEvents(data) {
  return hqList(data, ["upcoming", "events"]).map(e => ({
    start: toMs(pick(e, ["start", "starts", "startMs", "time"], 0)),
    minutes: Number(pick(e, ["minutes", "length", "duration"], 0)) || 0,
    title: String(pick(e, ["title", "name"], "Event")),
    host: String(pick(e, ["host", "hostName"], "")),
    hostEmp: String(pick(e, ["hostEmp", "emp"], "")),
    description: String(pick(e, ["description", "desc", "details"], ""))
  })).filter(e => e.start).sort((a, b) => a.start - b.start);
}
const evKey = (e) => e.start + "|" + String(e.title).toLowerCase();

function eventEmbed(e, heading, colour) {
  const s = ts(e.start);
  const fields = [
    { name: "Host", value: e.host || "—", inline: true },
    { name: "Length", value: e.minutes ? fmtMins(e.minutes) : "—", inline: true },
    { name: "Starts", value: `<t:${s}:F>\n<t:${s}:R>`, inline: true }
  ];
  if (e.description) fields.push({ name: "Details", value: e.description.slice(0, 1024), inline: false });
  return { author: { name: CONFIG.NAME }, color: colour || CONFIG.COLOURS.info, title: e.title,
    description: heading || "", fields: fields, footer: { text: "Times show in your own timezone" } };
}

async function postEventMessage(env, e, kind, replyTo) {
  if (!CONFIG.EVENTS_CHANNEL_ID) return null;
  const heading = { new: "**New event scheduled**", r30: "**Starts in 30 minutes**", r0: "**Starting now**",
                    cancel: "**Cancelled**" }[kind] || "";
  const ping = CONFIG.EVENT_PING_ROLE_ID && kind !== "cancel" ? `<@&${CONFIG.EVENT_PING_ROLE_ID}>` : "";
  const body = { content: ping, embeds: [eventEmbed(e, heading, kind === "cancel" ? CONFIG.COLOURS.denied : null)],
    allowed_mentions: ping ? { parse: [], roles: [CONFIG.EVENT_PING_ROLE_ID] } : NO_PINGS };
  if (replyTo) body.message_reference = { message_id: replyTo, fail_if_not_exists: false };
  return discord(env, "POST", `/channels/${CONFIG.EVENTS_CHANNEL_ID}/messages`, body);
}

// "2026-10-11" / "11/10/2026" / "today" / "tomorrow" + "19:30" / "7pm" + "UTC+1" or "Europe/London" -> UTC ms
function parseWhen(dateText, timeText, tzText) {
  const d = String(dateText || "").trim().toLowerCase();
  const fixed = tzOffsetMinutes(tzText), zone = fixed === null ? validZone(tzText) : "";
  if (fixed === null && !zone) return { error: `"${tzText}" isn't a timezone like UTC+1 or UTC-5.` };
  const offsetAt = ms => fixed !== null ? fixed : zoneOffset(zone, ms);   // minutes ahead of UTC at that moment
  let y, mo, day;
  const local = new Date(Date.now() + offsetAt(Date.now()) * 60000);   // "today" in that timezone
  if (d === "today" || d === "tomorrow") {
    const t = new Date(local.getTime() + (d === "tomorrow" ? 86400000 : 0));
    y = t.getUTCFullYear(); mo = t.getUTCMonth() + 1; day = t.getUTCDate();
  } else {
    let m = d.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (m) { y = +m[1]; mo = +m[2]; day = +m[3]; }
    else if ((m = d.match(/^(\d{1,2})[\/.-](\d{1,2})(?:[\/.-](\d{2,4}))?$/))) {
      day = +m[1]; mo = +m[2]; y = m[3] ? +(m[3].length === 2 ? "20" + m[3] : m[3]) : local.getUTCFullYear();
    } else return { error: `"${dateText}" isn't a date. Use DD/MM/YYYY (UK order), YYYY-MM-DD, today or tomorrow.` };
  }
  const t = String(timeText || "").trim().toLowerCase().replace(/\s+/g, "");
  const tm = t.match(/^(\d{1,2})(?:[:.](\d{2}))?(am|pm)?$/);
  if (!tm) return { error: `"${timeText}" isn't a time. Use 24-hour HH:MM, e.g. 19:30.` };
  let h = +tm[1]; const mi = +(tm[2] || 0);
  if (tm[3] === "pm" && h < 12) h += 12;
  if (tm[3] === "am" && h === 12) h = 0;
  if (h > 23 || mi > 59) return { error: `"${timeText}" isn't a real time.` };
  const wall = Date.UTC(y, mo - 1, day, h, mi);
  let ms = wall - offsetAt(wall) * 60000;
  ms = wall - offsetAt(ms) * 60000;                                   // the offset on that date (summer time)
  const check = new Date(Date.UTC(y, mo - 1, day));
  if (isNaN(ms) || check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== day) return { error: `"${dateText}" isn't a real date.` };
  return { ms: ms };
}
function tzOffsetMinutes(tz) {
  const s = cleanTimezone(cleanLine(tz || "UTC+0", 12));
  const m = String(s).match(/^UTC([+-])(\d{1,2})(?::(\d{2}))?$/);
  if (!m) return null;
  const v = (+m[2]) * 60 + (+(m[3] || 0));
  return v > 14 * 60 ? null : (m[1] === "-" ? -v : v);
}
/** "Europe/London" -> "Europe/London" if it's a real time zone, else "". */
function validZone(z) {
  z = String(z || "").trim();
  if (!/^[A-Za-z_]+(\/[A-Za-z0-9_+-]+){1,2}$/.test(z)) return "";
  try { new Intl.DateTimeFormat("en-GB", { timeZone: z }); return z; } catch (e) { return ""; }
}
/** Minutes a time zone is ahead of UTC at a given moment (summer time included). */
function zoneOffset(zone, ms) {
  const p = {};
  new Intl.DateTimeFormat("en-US", { timeZone: zone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })
    .formatToParts(new Date(ms)).forEach(x => { p[x.type] = x.value; });
  return Math.round((Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second) - Math.floor(ms / 1000) * 1000) / 60000);
}
/** "Europe/London (UTC+1)" style label for a time zone right now. */
function zoneLabel(z) {
  const zone = validZone(z);
  if (!zone) return cleanTimezone(z);
  const o = zoneOffset(zone, Date.now()), a = Math.abs(o);
  return zone.replace(/_/g, " ") + " (UTC" + (o < 0 ? "-" : "+") + Math.floor(a / 60) + (a % 60 ? ":" + String(a % 60).padStart(2, "0") : "") + ")";
}

// ---- Device time zone: Discord doesn't tell bots a user's time zone, so a one-time link reads it from their browser ----
async function tzSign(env, text) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode("devtz|" + env.SHEETS_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(text)));
  let bin = ""; mac.forEach(b => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
/** A link (valid 1 hour) that lets this Discord user save their device's time zone. */
async function deviceTzLink(env, request, userId) {
  if (!env.BOT_KV || !env.SHEETS_SECRET || !request) return "";
  const exp = Date.now() + 3600000, id = userId + "." + exp;
  return new URL(request.url).origin + "/tz?u=" + encodeURIComponent(id) + "&s=" + await tzSign(env, id);
}
async function deviceTz(env, userId) { return env.BOT_KV ? validZone(await env.BOT_KV.get("devtz:" + userId).catch(() => "")) : ""; }
async function deviceTzPage(env, request, url) {
  const id = String(url.searchParams.get("u") || ""), sig = String(url.searchParams.get("s") || "");
  const [uid, exp] = id.split(".");
  const html = (body, status) => new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Time zone · ${CONFIG.NAME}</title>
<style>:root{color-scheme:light dark;--bg:#f5f3ee;--fg:#1d1d1b;--mut:#6b6a66;--bd:#d8d5cc;--ac:#2f5d3a}@media(prefers-color-scheme:dark){:root{--bg:#1b1c1a;--fg:#eceae4;--mut:#a3a19a;--bd:#3a3b37;--ac:#6fae7f}}
body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif;display:grid;place-items:center;min-height:100vh;padding:16px;box-sizing:border-box}
main{max-width:420px;width:100%;box-sizing:border-box;border:1px solid var(--bd);border-radius:10px;padding:24px}h1{font-size:20px;margin:0 0 8px}p{margin:8px 0;color:var(--mut)}b{color:var(--fg)}
.z{font-size:22px;font-weight:600;color:var(--fg);margin:16px 0}button{font:inherit;font-weight:600;background:var(--ac);color:#fff;border:0;border-radius:6px;padding:10px 18px;cursor:pointer}button[disabled]{opacity:.6}</style></head>
<body><main>${body}</main></body></html>`, { status: status || 200, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Referrer-Policy": "no-referrer", "X-Frame-Options": "DENY" } });
  const valid = /^\d{5,25}$/.test(uid || "") && Number(exp) > Date.now() && env.SHEETS_SECRET && sig === await tzSign(env, id);
  if (!valid) return html("<h1>This link has expired</h1><p>Run the command in Discord again to get a new one.</p>", 403);
  if (request.method === "POST") {
    const zone = validZone((await request.json().catch(() => ({}))).zone);
    if (!zone) return json({ ok: false, error: "That time zone wasn't recognised." });
    await env.BOT_KV.put("devtz:" + uid, zone);
    return json({ ok: true, label: zoneLabel(zone) });
  }
  return html(`<h1>Use your device's time zone</h1><p>When you schedule events with the bot, times you type will be read in this time zone:</p>
<div class="z" id="z">Checking…</div><button id="go" disabled>Use this time zone</button><p id="msg" role="status"></p>
<p>It changes automatically for summer time. You can still type a different time zone in the command.</p>
<script>
var z = ""; try { z = Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch (e) {}
var el = document.getElementById("z"), go = document.getElementById("go"), msg = document.getElementById("msg");
if (z) { el.textContent = z.replace(/_/g, " "); go.disabled = false; } else { el.textContent = "Couldn't read it"; }
go.onclick = function () {
  go.disabled = true; msg.textContent = "Saving…";
  fetch(location.href, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ zone: z }) })
    .then(function (r) { return r.json(); })
    .then(function (r) { msg.innerHTML = r.ok ? "<b>Saved.</b> You can close this page and go back to Discord." : (r.error || "Couldn't save it."); if (!r.ok) go.disabled = false; })
    .catch(function () { msg.textContent = "Couldn't save it. Try again."; go.disabled = false; });
};
</script>`);
}

async function canManage(env, i) {
  if ((await reviewerCheck(env, caller(i)).catch(() => ({}))).ok) return { ok: true };
  const roster = await loadRoster(env).catch(() => null);
  if (!roster) return { ok: false, error: "Couldn't reach the roster to check your rank. Try again in a minute." };
  const me = findPerson(roster, i);
  if (me && isMrPlus(me)) return { ok: true, me: me };
  return { ok: false, error: "That's for Management+ only" + (me ? `. Your rank is ${me.k || "below Management"}.` : ", and you aren't on the roster under your Discord name.") };
}

async function eventSchedule(env, i, o) {
  try {
    const gate = await canManage(env, i);
    if (!gate.ok) return editReply(env, i, gate.error);
    const roster = await loadRoster(env).catch(() => null);
    const me = gate.me || (roster ? findPerson(roster, i) : null);
    // The time zone the time was typed in: the one typed in the command, else their device's (saved with the
    // link below), else the one on the roster, else UTC.
    const u0 = caller(i), dev = o.timezone ? "" : await deviceTz(env, u0.id);
    const useRoster = o.__tz === "roster";
    const tz = o.timezone || dev || (me && me.z) || "UTC+0";
    const from = o.timezone ? "as typed" : dev ? "your device" : me && me.z ? "your roster time zone" : "no time zone saved";
    const tzLink = await deviceTzLink(env, i.__request, u0.id).catch(() => "");
    const tzRow = tzLink ? [{ type: 1, components: [{ type: 2, style: 5, label: dev ? "Change my time zone" : "Use my device's time zone", url: tzLink }] }] : [];
    // No time zone typed or saved yet: set it first (one click), so the time isn't read in the wrong zone.
    if (!o.timezone && !dev && !useRoster && tzLink) {
      const keep = {}; ["title", "date", "time", "length", "host", "description"].forEach(k => { if (o[k] !== undefined) keep[k] = o[k]; });
      await kvPut(env, "evs:" + u0.id, keep, 3600);
      const rz = me && me.z ? cleanTimezone(me.z) : "";
      return editOriginal(env, i, { allowed_mentions: NO_PINGS, content: [
        "**Set your time zone first.** Discord doesn't tell the bot your time zone, so it needs one click to read it from your device.",
        "1. Press **Set my time zone** and confirm on the page that opens.",
        "2. Come back here and press **Schedule event**.",
        "-# You only do this once. Your event details are kept for an hour."].join("\n"),
        components: [{ type: 1, components: [
          { type: 2, style: 5, label: "Set my time zone", url: tzLink },
          { type: 2, style: 1, label: "Schedule event", custom_id: "evs:go" }].concat(rz ? [
          { type: 2, style: 2, label: ("Use my roster time zone (" + rz + ")").slice(0, 80), custom_id: "evs:roster" }] : []) }] });
    }
    const when = parseWhen(o.date, o.time, tz);
    if (when.error) return editOriginal(env, i, { content: when.error, components: tzRow, allowed_mentions: NO_PINGS });
    if (when.ms < Date.now() + 60000) return editOriginal(env, i, { content: `That's in the past (<t:${ts(when.ms)}:F>). Check the date, time and time zone (${zoneLabel(tz)}, ${from}).`, components: tzRow, allowed_mentions: NO_PINGS });
    const minutes = Math.round(Number(o.length) || 0);
    if (minutes < 5 || minutes > 720) return editReply(env, i, "The length must be between 5 and 720 minutes.");
    let host = cleanLine(o.host, 60) || (me ? (me.r || me.d) : callerName(i));
    const hp = roster && roster.by[host.replace(/^@/, "").toLowerCase()];
    if (o.host && roster && !hp) return editReply(env, i, `**Host:** ${host} isn't on the roster.`);
    if (hp) host = hp.r || hp.d;
    const e = { start: when.ms, minutes: minutes, title: cleanLine(o.title, 100), host: host, hostEmp: hp ? (hp.e || "") : "",
                description: String(o.description || "").trim().slice(0, 1000) };
    const u = caller(i);
    const res = await bridge(env, { action: "scheduleEvent", id: "ev-" + i.id, event: e, byId: u.id, byName: u.username || "" })
      .catch(err => ({ ok: false, error: err.message }));
    if (!res.ok) return editReply(env, i, "Couldn't add it to the HQ events: " + res.error);

    // Announce it now (the 5-minute check won't announce it again).
    let note = "";
    try {
      const msg = await postEventMessage(env, e, "new");
      const st = await kvGet(env, "state:events", null);
      if (st) { st.seen[evKey(e)] = Date.now(); if (msg) st.msg[evKey(e)] = msg.id; await kvPut(env, "state:events", st); }
      if (msg) note = `\nAnnounced in <#${CONFIG.EVENTS_CHANNEL_ID}>.`;
    } catch (err) { note = `\nNot announced (${err.message}).`; }
    const tzNote = `\n-# Time read in ${zoneLabel(tz)} (${from}).` + (!dev && !o.timezone && tzLink ? " Press the button to use your device's time zone from now on." : "");
    await editOriginal(env, i, { content: "Event scheduled on the HQ." + note + tzNote, embeds: [eventEmbed(e, "")], components: tzRow, allowed_mentions: NO_PINGS });
  } catch (err) {
    await editReply(env, i, "Couldn't schedule it: " + err.message).catch(() => {});
  }
}

// The "Set your time zone first" buttons: schedule the kept event with the saved device time zone (or the roster one).
function eventScheduleButton(env, ctx, i) {
  const u = caller(i), roster = i.data.custom_id === "evs:roster";
  ctx.waitUntil((async () => {
    const o = await kvGet(env, "evs:" + u.id, null);
    if (!o) return editOriginal(env, i, { content: "Those event details have expired. Run **/event schedule** again.", components: [], allowed_mentions: NO_PINGS });
    if (!roster && !(await deviceTz(env, u.id))) return followup(env, i, "Your time zone isn't saved yet. Press **Set my time zone**, confirm on the page, then press **Schedule event** again.");
    await env.BOT_KV.delete("evs:" + u.id).catch(() => {});
    return eventSchedule(env, i, Object.assign({}, o, roster ? { __tz: "roster" } : {}));
  })().catch(err => followup(env, i, "Couldn't schedule it: " + err.message)));
  return { type: R.DEFER_UPDATE };
}

async function eventCancel(env, i, o) {
  try {
    const gate = await canManage(env, i);
    if (!gate.ok) return editReply(env, i, gate.error);
    const [startText, ...rest] = String(o.event || "").split("|");
    const start = Number(startText), title = rest.join("|");
    if (!start || !title) return editReply(env, i, "Pick the event from the list as you type.");
    const u = caller(i);
    const res = await bridge(env, { action: "cancelEvent", id: "evc-" + i.id, start: start, title: title, byId: u.id, byName: u.username || "" })
      .catch(err => ({ ok: false, error: err.message }));
    if (!res.ok) return editReply(env, i, "Couldn't cancel it: " + res.error);
    const e = { start: start, minutes: Number(res.minutes) || 0, title: res.title || title, host: res.host || "", description: "" };
    let note = "";
    try {
      const st = await kvGet(env, "state:events", null);
      const k = evKey(e);
      const msg = await postEventMessage(env, e, "cancel", st && st.msg[k]);
      if (st) { st.cancelled = st.cancelled || {}; st.cancelled[k] = Date.now(); await kvPut(env, "state:events", st); }
      if (msg) note = ` Posted in <#${CONFIG.EVENTS_CHANNEL_ID}>.`;
    } catch (err) { /* the HQ change is what matters */ }
    await editReply(env, i, `**${e.title}** (<t:${ts(start)}:F>) has been cancelled and removed from the HQ.` + note);
  } catch (err) {
    await editReply(env, i, "Couldn't cancel it: " + err.message).catch(() => {});
  }
}

async function eventList(env, i) {
  try {
    const events = hqEvents(await hq(env, "events")).filter(e => e.start + Math.max(e.minutes, 30) * 60000 > Date.now()).slice(0, 10);
    if (!events.length) return editReply(env, i, "No upcoming events on the HQ right now.");
    const lines = events.map(e => `**${e.title}**, <t:${ts(e.start)}:F> (<t:${ts(e.start)}:R>)` +
      `\n-# Host: ${e.host || "—"}${e.minutes ? " · Length: " + fmtMins(e.minutes) : ""}`);
    await editReply(env, i, "", [{ author: { name: CONFIG.NAME }, color: CONFIG.COLOURS.info, title: "Upcoming events",
      description: lines.join("\n\n").slice(0, 4000), footer: { text: "Times show in your own timezone" } }]);
  } catch (err) {
    await editReply(env, i, "Couldn't load the events: " + err.message).catch(() => {});
  }
}

async function suggestEvents(env, typed) {
  const q = String(typed || "").toLowerCase();
  const list = hqEvents(await hq(env, "events")).filter(e => e.start > Date.now() - 3600000);
  const fmt = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  return list.filter(e => !q || e.title.toLowerCase().includes(q)).slice(0, 25).map(e => {
    const value = (e.start + "|" + e.title).slice(0, 100);
    return { name: `${fmt.format(new Date(e.start))} UTC · ${e.title}`.slice(0, 100), value: value };
  });
}

// ---- /profile (public data only) ----
async function profileCommand(env, i, o) {
  try {
    const roster = await loadRoster(env).catch(() => null);
    let emp = "", name = cleanLine(o.name, 60);
    if (o.member) {
      const link = await bridge(env, { action: "links", discordId: o.member }).catch(() => null);
      const l = link && link.ok && (link.links || [])[0];
      if (l) emp = l.emp;
      else {
        const u = ((i.data.resolved || {}).users || {})[o.member] || {};
        const p = roster && roster.by[String(u.username || "").toLowerCase()];
        if (p) { emp = p.e || ""; name = p.r || p.d; }
        else return editReply(env, i, `<@${o.member}> isn't linked to a roster entry yet (they can use **/link**).`);
      }
    } else if (!name) {
      const me = roster ? findPerson(roster, i) : null;
      if (!me) return editReply(env, i, "Pick someone (or link yourself with **/link**).");
      emp = me.e || ""; name = me.r || me.d;
    } else if (roster && roster.by[name.toLowerCase()]) {
      const p = roster.by[name.toLowerCase()];
      emp = p.e || ""; name = p.r || p.d;
    }

    let card = null;
    if (hqBase(env)) {
      const data = await hq(env, "profile", emp ? { emp: emp } : { name: name }).catch(err => ({ __error: err.message }));
      if (!data.__error) card = publicProfileEmbed(data, emp);
    }
    if (!card) {                                         // no HQ link: the bridge's profile, public parts only
      const res = await bridge(env, { action: "profile", query: name || emp, includePunishments: false });
      if (!res.ok) return editReply(env, i, "Couldn't reach the roster: " + res.error);
      if (!res.person) return editReply(env, i, `**${name || emp}** isn't on the roster.`);
      card = publicProfileEmbed({ profile: { name: res.person.roblox || res.person.discord, rank: res.person.rank,
        emp: res.person.emp, totalEvents: res.person.total, joined: res.person.joined, clearance: res.person.clearance },
        thisMonth: res.thisMonth, awards: res.awards }, res.person.emp);
    }
    const avatar = await robloxHeadshot(card.title).catch(() => "");
    if (avatar) card.thumbnail = { url: avatar };
    await editReply(env, i, "", [card]);
  } catch (err) {
    await editReply(env, i, "Couldn't load that profile: " + err.message).catch(() => {});
  }
}

function publicProfileEmbed(data, empHint) {
  const p = data.profile || data.person || data;
  const name = String(pick(p, ["name", "roblox", "robloxName", "discord"], "Unknown"));
  const rank = String(pick(p, ["rank"], "—"));
  const emp = String(pick(p, ["emp", "employeeNo", "employee", "empNo"], empHint || ""));
  const clr = String(pick(p, ["clearance", "tier"], "")).toUpperCase();
  const joined = pick(p, ["joined", "dateJoined", "joinedAt", "since"], "");
  let total = pick(p, ["totalEvents", "total"], null);
  if (total === null && data.totals && typeof data.totals === "object") {
    total = Object.keys(data.totals).reduce((t, k) => t + (Number(data.totals[k]) || 0), 0);
  }
  if (total === null && typeof p.events === "number") total = p.events;
  const fields = [{ name: "Rank", value: rank, inline: true }, { name: "Employee #", value: emp ? "#" + emp : "—", inline: true }];
  if (total !== null && typeof total !== "object") fields.push({ name: "Events (all time)", value: String(total), inline: true });
  if (data.totals && typeof data.totals === "object") {
    const t = describeCounts(data.totals);
    if (t) fields.push({ name: "All-time breakdown", value: t, inline: false });
  }

  // This month: from the profile's monthly events (any of the usual shapes).
  const month = data.thisMonth || pick(data, ["monthly", "months", "monthlyEvents"], null) || pick(p, ["monthly", "thisMonth"], null);
  let monthText = "";
  if (month && !Array.isArray(month) && typeof month === "object") {
    const keys = Object.keys(month);
    if (keys.every(k => /^\d{4}-\d{2}$/.test(k))) { const last = keys.sort().pop(); monthText = describeCounts(month[last]); }
    else monthText = describeCounts(month);
  } else if (Array.isArray(month) && month.length) {
    // [{month, events}] in any order: this month's entry, else the newest.
    const now = new Date(Date.now() - 6 * 3600000), key = now.toISOString().slice(0, 7);
    const sorted = month.slice().sort((a, b) => String(pick(b, ["month"], "")).localeCompare(String(pick(a, ["month"], ""))));
    const cur = sorted.find(m => String(pick(m, ["month"], "")).slice(0, 7) === key) || null;
    if (cur) {
      const ev = pick(cur, ["events", "counts"], null);
      monthText = ev && typeof ev === "object" ? describeCounts(ev) : (ev !== null ? `${ev} event${Number(ev) === 1 ? "" : "s"}` : describeCounts(cur));
    } else monthText = "No events yet this month";
  }
  if (monthText) fields.push({ name: "This month", value: monthText, inline: false });

  const jMs = toMs(joined);
  if (jMs) {
    const days = Math.floor((Date.now() - jMs) / 86400000);
    fields.push({ name: "Time in the department", value: `${days >= 365 ? (days / 365).toFixed(1) + " years" : days + " days"} · joined <t:${ts(jMs)}:D>`, inline: false });
  }
  const timeline = hqList(data, ["rankTimeline", "timeline", "ranks"]);
  if (timeline.length) {
    const ordered = timeline.slice().sort((a, b) => toMs(pick(b, ["start", "since", "at", "date"], 0)) - toMs(pick(a, ["start", "since", "at", "date"], 0)));
    fields.push({ name: "Rank timeline", value: ordered.slice(0, 5).map(r => {
      const at = toMs(pick(r, ["start", "since", "at", "date"], 0));
      return `• ${pick(r, ["rank", "name"], "—")}${at ? ", since <t:" + ts(at) + ":D>" : ""}`;
    }).join("\n").slice(0, 1024), inline: false });
  }
  const awards = hqList(data, ["awards"]).map(a => typeof a === "string" ? a : pick(a, ["label", "name", "title"], "")).filter(Boolean);
  if (awards.length) fields.push({ name: `Awards (${awards.length})`, value: awards.join(", ").slice(0, 1024), inline: false });
  const tags = hqList(data, ["tags", "publicTags"]).map(t => typeof t === "string" ? t : pick(t, ["label", "name"], "")).filter(Boolean);

  const link = emp && CONFIG.HQ_PROFILE_URL ? CONFIG.HQ_PROFILE_URL.replace("{emp}", encodeURIComponent(emp)) : "";
  const colour = { EX: 0x1F6B42, HR: 0x6B3FA0, MR: 0xC9A227, LR: 0x7A4A12 }[clr.split(/[^A-Z]/)[0]] || CONFIG.COLOURS.info;
  const embed = { author: { name: CONFIG.NAME }, title: name, color: colour, fields: fields,
    description: [clr ? "`" + clr + "`" : "", tags.length ? tags.join(", ") : "", link ? `[Open HQ profile](${link})` : ""].filter(Boolean).join("  ·  "),
    footer: { text: "Public profile · " + CONFIG.NAME } };
  if (link) embed.url = link;
  return embed;
}
function describeCounts(c) {
  if (c == null) return "";
  if (typeof c !== "object") return String(c) + " events";
  const label = { Attended: "attended", Hosted: "hosted", "Co-Hosted": "co-hosted", Supervised: "supervised" };
  const parts = Object.keys(c).filter(k => typeof c[k] === "number" || /^\d+$/.test(String(c[k])))
    .filter(k => !/^(month|year)$/i.test(k)).map(k => `${c[k]} ${label[k] || k.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase()}`);
  return parts.join(" · ");
}

// ---- /leaderboard ----
async function leaderboardCommand(env, i) {
  try {
    const res = await bridge(env, { action: "leaderboard" });
    if (!res.ok) return editReply(env, i, "Couldn't reach the roster: " + res.error);
    const medal = (k) => `**${k + 1}.**`;
    const list = (rows, unit) => rows.length ? rows.map((r, k) => `${medal(k)} ${r.name}: ${r.n} ${unit}${r.n === 1 ? "" : "s"}`).join("\n") : "Nobody yet";
    await editReply(env, i, "", [{ author: { name: CONFIG.NAME }, color: CONFIG.COLOURS.info, title: `Leaderboard: ${res.month}`,
      fields: [{ name: "Top hosts", value: list(res.hosts || [], "event").slice(0, 1024), inline: true },
               { name: "Top attendees", value: list(res.attendees || [], "event").slice(0, 1024), inline: true }],
      footer: { text: "Months run from the 1st at 06:00 UTC" } }]);
  } catch (err) {
    await editReply(env, i, "Couldn't load the leaderboard: " + err.message).catch(() => {});
  }
}

// ---- /mystats: the caller's own stats, privately ----
// With a button to their profile on the website.
const STAT_LABEL = { attended: "Attended", cohosted: "Co-hosted", hosted: "Hosted", supervised: "Supervised" };
function siteBase(env) { try { return new URL(hqBase(env)).origin; } catch (e) { return ""; } }
function profileUrl(env, emp) {
  if (!emp) return "";
  if (CONFIG.HQ_PROFILE_URL) return CONFIG.HQ_PROFILE_URL.replace("{emp}", encodeURIComponent(emp));
  const base = siteBase(env);
  return base ? base + "/p/" + encodeURIComponent(emp) : "";
}
/** A text progress bar: ██████░░░░ */
function progressBar(have, need, width) {
  const k = need > 0 ? Math.max(0, Math.min(width, Math.round(have / need * width))) : width;
  return "█".repeat(k) + "░".repeat(width - k);
}
function promotionText(pr) {
  if (!pr) return "";
  if (pr.merit) return "Promotion to **" + pr.next + "** is merit-based: there's no event minimum. Leadership decides.";
  if (!pr.lines.length) return "";                                // no minimums set for this rank: nothing to show
  const met = pr.lines.filter(l => l.have >= l.need).length;
  const w = Math.max(...pr.lines.map(l => STAT_LABEL[l.f].length));
  const rows = pr.lines.map(l => STAT_LABEL[l.f].padEnd(w) + "  " + progressBar(l.have, l.need, 12) + "  " + (l.have + " / " + l.need).padStart(7) + (l.have >= l.need ? "  ✓" : ""));
  const head = pr.eligible ? "✅ **Eligible for promotion.** You meet every event requirement; promotions are still decided by leadership."
    : "**" + met + " of " + pr.lines.length + "** requirements met.";
  return (head + "\n```\n" + rows.join("\n") + "\n```").slice(0, 1024);
}
function typeTable(byType, isWorker) {
  const n = x => Number(x) || 0;
  const types = Object.keys(byType || {}).sort((a, b) => {
    const ia = EVENT_TYPES.indexOf(a), ib = EVENT_TYPES.indexOf(b);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib) || a.localeCompare(b);
  });
  if (!types.length) return "";
  const cols = isWorker ? [["Co-host", "Co-host"], ["Att.", "Attendee"]] : [["Host", "Host"], ["Co-host", "Co-host"], ["Sup.", "Supervisor"], ["Att.", "Attendee"]];
  const name = t => t.length > 16 ? t.slice(0, 15) + "…" : t;
  const w = Math.max(4, ...types.map(t => name(t).length));
  const line = (label, vals) => label.padEnd(w) + vals.map((v, k) => String(v).padStart(cols[k][0].length + 2)).join("");
  return ("```\n" + [line("Type", cols.map(c => c[0])), ...types.map(t => line(name(t), cols.map(c => n(byType[t][c[1]]))))].join("\n") + "\n```").slice(0, 1024);
}
async function myStatsCommand(env, i) {
  try {
    if (!linked(env)) return editReply(env, i, "The roster isn't linked yet.");
    const u = caller(i);
    const r = await bridge(env, { action: "mystats", byId: u.id, byName: u.username || "" });
    if (!r.ok) throw new Error(r.error || "the roster didn't answer");
    if (!r.person) return editReply(env, i, `You aren't on the roster under your Discord name (**${u.username}**). Use **/link** to connect your account, or ask to have your roster entry updated.`);
    const n = x => Number(x) || 0, P = r.person, m = r.month || {}, w = r.week || {}, t = r.totals || null;
    const isWorker = P.sheet === "Worker";
    const link = profileUrl(env, P.emp);

    // Who: rank, roster, employee number, clearance, time at rank.
    const since = r.rankSince && r.rankSince.at ? Date.parse(r.rankSince.at) : 0;
    const days = since ? Math.floor((Date.now() - since) / 86400000) : null;
    const desc = ["**" + (P.rank || "No rank") + "**" + (P.sheet ? " · " + P.sheet : ""),
      [P.emp ? "Employee No. " + P.emp : "", P.clearance ? "Clearance " + P.clearance : "",
       since ? (r.rankSince.known === 0 ? "At this rank since at least " : "At this rank since ") + `<t:${ts(since)}:D> (${days === 1 ? "1 day" : days + " days"})` : ""].filter(Boolean).join(" · ")];
    if (r.loa === "ACTIVE") desc.push("🟦 On leave of absence");

    // This month, as stat tiles.
    const tile = (name, v) => ({ name, value: "**" + v + "**", inline: true });
    const fields = [tile("Events · " + r.monthLabel, n(r.events))];
    if (!isWorker) fields.push(tile("Hosted", n(m.Host)));
    fields.push(tile("Co-hosted", n(m["Co-host"])));
    if (!isWorker) fields.push(tile("Supervised", n(m.Supervisor)));
    fields.push(tile("Attended", n(m.Attendee)));
    if (r.market) fields.push(tile("Market points", r.market.infinite ? "∞" : n(r.market.points).toLocaleString("en-GB")));
    while (fields.length % 3) fields.push({ name: "​", value: "​", inline: true });

    // Weekly quota (Management).
    if (r.quota) {
      const now = new Date(), d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 6));
      d.setUTCDate(d.getUTCDate() + ((8 - d.getUTCDay()) % 7 || (now >= d ? 7 : 0)));
      const done = [n(w.Host) && n(w.Host) + " hosted", n(w["Co-host"]) && n(w["Co-host"]) + " co-hosted", n(w.Supervisor) && n(w.Supervisor) + " supervised"].filter(Boolean);
      let q;
      if (r.quota.exempt) q = "⚪ **Exempt this week**" + (r.loa === "ACTIVE" ? " (on LOA)" : "");
      else if (r.quota.tick || done.length) q = "✅ **Met** · " + (done.join(", ") || "recorded on the roster");
      else q = `⚠️ **Not met yet.** Host, co-host or supervise an event before <t:${ts(d.getTime())}:F> (<t:${ts(d.getTime())}:R>).`;
      if (r.quota.status) q += "\nLast week: **" + r.quota.status.charAt(0) + r.quota.status.slice(1).toLowerCase() + "**";
      fields.push({ name: "Weekly quota", value: q.slice(0, 1024), inline: false });
    }
    // Next rank.
    const pr = promotionText(r.promotion);
    if (pr) fields.push({ name: "Promotion progress · next rank: " + r.promotion.next, value: pr, inline: false });
    // This month by event type.
    const tt = typeTable(r.byType, isWorker);
    fields.push({ name: "This month by event type", value: tt || "Nothing logged yet this month.", inline: false });
    // All time.
    if (t) fields.push({ name: "All-time record", value: ["attended", "cohosted"].concat(isWorker ? [] : ["hosted", "supervised"])
      .map(f => "**" + n(t[f]).toLocaleString("en-GB") + "** " + STAT_LABEL[f].toLowerCase()).join(" · "), inline: false });

    const avatar = await robloxHeadshot(P.roblox || P.name).catch(() => "");
    const embed = {
      author: { name: CONFIG.NAME + " · Personal statistics" },
      title: P.name, url: link || undefined, description: desc.join("\n"),
      color: r.promotion && r.promotion.eligible ? CONFIG.COLOURS.approved : (CONFIG.COLOURS.info || CONFIG.COLOURS.approved),
      thumbnail: avatar ? { url: avatar } : undefined, fields,
      footer: { text: "Only you can see this · Months start on the 1st and weeks on Monday, 06:00 UTC" },
      timestamp: new Date().toISOString()
    };
    const components = link ? [{ type: 1, components: [{ type: 2, style: 5, label: "Open full profile", url: link }] }] : [];
    await editOriginal(env, i, { content: "", embeds: [embed], components, allowed_mentions: NO_PINGS });

  } catch (err) {
    await editReply(env, i, "Couldn't load your stats: " + err.message).catch(() => {});
  }
}

// ---- /link ----
async function linkCommand(env, i, o) {
  try {
    const u = caller(i);
    // Your own account only — nobody (staff, admins or owners) can link someone else's.
    if (o.member && o.member !== u.id) return editReply(env, i, "**/link** only works on your own Discord account. Ask them to run **/link** themselves.");
    o.member = "";
    const roster = await loadRoster(env).catch(() => null);
    if (!roster) return editReply(env, i, "Couldn't reach the roster. Try again in a minute.");
    if (!o.name) {
      const res = await bridge(env, { action: "links", discordId: o.member || u.id });
      const l = res.ok && (res.links || [])[0];
      if (!l) return editReply(env, i, (o.member ? `<@${o.member}> isn't` : "You aren't") + " linked to a roster entry yet. Use **/link name:** and pick the roster name.");
      const p = roster.list.find(x => normEmp(x.e) === normEmp(l.emp)) || ((await loadRoster(env, 10 * 1000).catch(() => roster)) || roster).list.find(x => normEmp(x.e) === normEmp(l.emp));
      // Already linked: refresh their roles from the roster.
      const r = CONFIG.GUILD_ID ? await syncRolesFor(env, o.member || u.id, l.emp).catch(err => ({ error: err.message })) : null;
      return editReply(env, i, `${o.member ? `<@${o.member}> is` : "You're"} linked to **${p ? (p.r || p.d) : "#" + l.emp}** (employee #${l.emp})` +
        (l.at ? ` since <t:${ts(toMs(l.at))}:D>` : "") + "." + (r ? "\n\n" + roleSummary(r) : ""));
    }
    const p = roster.by[cleanLine(o.name, 60).replace(/^@/, "").toLowerCase()] || (await rosterLookup(env, cleanLine(o.name, 60))).p;
    if (!p) return editReply(env, i, `**${cleanLine(o.name, 60)}** isn't on the roster.`);
    if (!p.e) return editReply(env, i, `**${p.r || p.d}** has no employee number on the roster yet, so they can't be linked.`);
    const target = o.member || u.id;
    const targetUser = o.member ? (((i.data.resolved || {}).users || {})[o.member] || {}) : u;
    const self = target === u.id && p.d && String(p.d).replace(/^@/, "").toLowerCase() === String(u.username || "").toLowerCase();
    if (!self) {
      return editReply(env, i, `You can only link to the roster entry with your own Discord name (**${u.username}**). ` +
        `**${p.r || p.d}**'s entry has the Discord name **${p.d || "(none)"}**.\n` +
        "If that entry is you and your Discord name changed, ask DMO to correct the Discord name on the roster (or send **/roster update**), then run **/link** again.");
    }
    const res = await bridge(env, { action: "linkDiscord", id: "link-" + i.id, emp: p.e, discordId: target,
      targetName: targetUser.username || "", by: self ? "self" : u.id, byId: u.id, byName: u.username || "" })
      .catch(err => ({ ok: false, error: err.message }));
    if (!res.ok) return editReply(env, i, "Couldn't link: " + res.error);
    await forgetReviewer(env, target);
    let roles = "";
    if (CONFIG.GUILD_ID) {
      const r = await syncRolesFor(env, target, p.e).catch(err => ({ error: err.message }));
      roles = "\n\n" + roleSummary(r);
    }
    await editReply(env, i, `${target === u.id ? "You're" : `<@${target}> is`} now linked to **${p.r || p.d}** (employee #${p.e}).` +
      (res.moved ? `\n-# This Discord account was previously linked to #${res.moved}.` : "") + roles);
  } catch (err) {
    await editReply(env, i, "Couldn't link: " + err.message).catch(() => {});
  }
}

// ---- /loa (Management+): start, end, reason -> the LOA request flow ----
// Posted in the LOA request format; reviewers approve in Discord (dates already
// filled in) or on the roster's Approvals page -> addManagementLOA.
async function loaCommand(env, i, o) {
  try {
    const roster = await loadRoster(env).catch(() => null);
    if (!roster) return editReply(env, i, "Couldn't reach the roster to check your rank. Nothing was sent; try again in a minute.");
    const me = findPerson(roster, i);
    if (!me) return editReply(env, i, "LOA requests are for Management+ only, and you aren't on the roster under your Discord name.");
    if (!isMrPlus(me)) return editReply(env, i, `LOA requests are for Management+ only. Your rank is ${me.k || "below Management"}.`);
    const s = ukToIso(o.start), e = ukToIso(o.end);
    if (!s || !e) return editReply(env, i, "Use DD/MM/YYYY for both dates, e.g. 07/10/2026.");
    if (e < s) return editReply(env, i, "The end date can't be before the start date.");
    const todayIso = new Date().toISOString().slice(0, 10);
    if (e < todayIso) return editReply(env, i, "That LOA has already ended.");
    const days = Math.round((Date.parse(e) - Date.parse(s)) / 86400000) + 1;
    if (days > 120) return editReply(env, i, "LOAs can be at most 120 days. Speak to Leadership about a longer one.");
    const st = { time: `${isoToUk(s)} – ${isoToUk(e)} (${days} day${days === 1 ? "" : "s"})`, reason: String(o.reason || "").trim().slice(0, 300),
      kind: o.type || "Both", notes: String(o.notes || "").trim().slice(0, 300), start: s, end: e };
    await sendRequest(env, i, "loa", st, null);
  } catch (err) {
    await editReply(env, i, "Couldn't send your LOA: " + err.message).catch(() => {});
  }
}

// ---- /roster start | submit (codes) ----
async function rosterCode(env, userId, issue) {
  if (env.BOT_KV) {
    const key = "code:" + userId;
    let c = await kvGet(env, key, null);
    if (!c && issue) {
      c = { code: "RA-" + String(1000 + (crypto.getRandomValues(new Uint32Array(1))[0] % 9000)), at: Date.now() };
      await kvPut(env, key, c, 48 * 3600);
    }
    return c ? { codes: [c.code], at: c.at } : null;
  }
  // No KV: a daily code (UTC), worked out from the shared secret. Yesterday's still counts.
  const day = Math.floor(Date.now() / 86400000);
  const make = async (d) => {
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(env.SHEETS_SECRET || "dmo"), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(userId + ":" + d)));
    return "RA-" + String(1000 + ((mac[0] << 8 | mac[1]) % 9000));
  };
  return { codes: [await make(day), await make(day - 1)], at: day * 86400000 };
}

// Answered after a "thinking…" reply: loading the roster can take longer than Discord's 3 seconds.
async function rosterStart(env, i) {
  try {
  const u = caller(i);
  const roster = await loadRoster(env).catch(() => null);
  const me = roster ? findPerson(roster, i) : null;
  if (me) return editReply(env, i, `You're already on the roster as **${me.r || me.d}** (${me.k}). To change your rank or details, use **/roster update**.`);
  const had = await rosterCode(env, u.id, false);
  const c = had || await rosterCode(env, u.id, true);
  if (had && env.BOT_KV) return editReply(env, i, `You already have a code: **${c.codes[0]}**. It's valid until <t:${Math.floor((c.at + 48 * 3600000) / 1000)}:f>. ` +
    "Use it in your screenshot and run **/roster submit**.");
  return editReply(env, i, `Your code is **${c.codes[0]}**\n\n1. In game, type **${c.codes[0]}** in the chat.\n2. Take a screenshot showing the code **next to your name**.\n` +
    `3. Run **/roster submit** with your Roblox username, timezone, rank and the screenshot.\n\n-# The code lasts ${env.BOT_KV ? "48 hours" : "until midnight UTC tomorrow"}. ` +
    "Screenshots are shared with Google for an automated check; staff make the decision.");
  } catch (err) {
    await editReply(env, i, "Couldn't make your code: " + err.message).catch(() => {});
  }
}

async function rosterSubmit(env, i, o) {
  try {
    const u = caller(i);
    const att = ((i.data.resolved || {}).attachments || {})[o.screenshot];
    if (!att) return editReply(env, i, "No screenshot was attached. Run **/roster submit** again with one attached.");
    if (!isAllowedImage(att)) return editReply(env, i, IMAGE_RULE);
    const roster = await loadRoster(env).catch(() => null);
    if (!roster) return editReply(env, i, "Couldn't reach the roster to check your application. Nothing was sent; try again in a minute.");
    const me = findPerson(roster, i);
    if (me) return editReply(env, i, `You're already on the roster as **${me.r || me.d}** (${me.k}). To change your rank or details, use **/roster update**.`);
    // One application at a time: wait for the last one to be approved or denied.
    const open = await bridge(env, { action: "pendingApplication", discordId: String(u.id || "") }).catch(() => null);
    if (open && open.ok && open.pending) return editReply(env, i, "You already have a roster application waiting" +
      (open.pending.at ? ` (sent <t:${Math.floor(open.pending.at / 1000)}:R>)` : "") +
      ". You can send another once it has been approved or denied. You'll get a DM when that happens.");
    const c = await rosterCode(env, u.id, false);
    if (!c) return editReply(env, i, "Run **/roster start** first to get your code, then put it in your screenshot.");
    const rb = await robloxUser(cleanLine(o.roblox, 40).replace(/^@/, "")).catch(() => ({ unknown: true }));
    if (rb && rb.missing) return editReply(env, i, `**${cleanLine(o.roblox, 40)}** isn't a Roblox username. Check the spelling.`);
    const st = { discord: u.username || "", roblox: rb && rb.name ? rb.name : cleanLine(o.roblox, 40), tz: cleanLine(o.timezone, 12),
      rank: cleanLine(o.rank, 60), ref: cleanLine(o.referrer, 60), code: c.codes[0], codeAlt: c.codes[1] || "",
      robloxId: rb && rb.id ? String(rb.id) : "", robloxChecked: !(rb && rb.unknown) };
    await sendRequest(env, i, "roster", st, att);
  } catch (err) {
    await editReply(env, i, "Couldn't send your application: " + err.message).catch(() => {});
  }
}

// Roblox: does this username exist? -> { id, name } | { missing: true }
async function robloxUser(username) {
  if (!username) return { missing: true };
  const res = await fetch("https://users.roblox.com/v1/usernames/users", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ usernames: [username], excludeBannedUsers: true })
  });
  if (!res.ok) return { unknown: true };
  const j = await res.json();
  const x = j && j.data && j.data[0];
  return x ? { id: x.id, name: x.name } : { missing: true };
}

// ---- Approve / Deny in Discord: event logs + award / roster / LOA requests (DMO, linked) ----
// Step 1: someone (DMO) has to Claim it. Approve / Deny only appear once it's
// claimed, and only the claimer can use them (claims last 30 minutes).
// Award requests are decided by admins on the website's Approvals page only: their message gets a link there.
const AWARD_WEBSITE_ONLY = "Award requests can only be approved or denied by admins, on the website's Approvals page.";
function websiteRow(env, label) {
  const base = siteBase(env);
  return { type: 1, components: [
    base ? { type: 2, style: 5, label: "Open the Approvals page", url: base + "/edit/approvals" }
         : { type: 2, style: 2, label: "Decided on the website", custom_id: "status-web", disabled: true },
    { type: 2, style: 2, label: (label || "Admins decide this on the website").slice(0, 80), custom_id: "status", disabled: true, emoji: { name: "🔒" } }] };
}
function decisionRow(type, env) {
  if (type === "award") return websiteRow(env);
  return { type: 1, components: [
    { type: 2, style: 1, label: "Claim", custom_id: "rq:claim:" + type, emoji: { name: "🙋" } },
    { type: 2, style: 2, label: "Claim before approving or denying", custom_id: "status", disabled: true }] };
}
// Step 2: claimed. claimerId = their Discord ID ("web" when claimed on the roster's Approvals page).
function claimedRow(type, claimerId, name) {
  const who = String(name || "someone").slice(0, 40);
  return { type: 1, components: [
    { type: 2, style: 3, label: "Approve", custom_id: `rq:yes:${type}:${claimerId}`, emoji: { name: "✅" } },
    { type: 2, style: 4, label: "Deny", custom_id: `rq:no:${type}:${claimerId}`, emoji: { name: "✖️" } },
    { type: 2, style: 2, label: "Release", custom_id: `rq:release:${type}:${claimerId}`, emoji: { name: "↩️" } },
    { type: 2, style: 2, label: `Claimed by ${who}`.slice(0, 80), custom_id: "status", disabled: true, emoji: { name: "🔒" } }] };
}
function queueId(kind, message) { return kind === "event" ? message.id : kind + "-" + message.id; }

// Claim / Release buttons.
async function claimAction(env, i, kind, release) {
  const u = caller(i);
  try {
    const rv = await reviewerCheck(env, u);
    if (!mayDecide(rv, kind) && !rv.unknown) return followup(env, i, decideReason(rv, kind));
    const res = await bridge(env, { action: "claim", id: queueId(kind, i.message), release: !!release,
      byId: u.id, byName: u.username || "" }).catch(e => ({ ok: false, error: e.message }));
    if (!res.ok) {
      if (res.already) {
        await discord(env, "PATCH", `/channels/${i.channel_id}/messages/${i.message.id}`, { components: [statusRow(`${res.status} by ${String(res.by || "someone").replace(/^Discord: /, "")}`, res.status === "Denied" ? "✖️" : "✅")], allowed_mentions: NO_PINGS }).catch(() => {});
        return followup(env, i, `It was already **${String(res.status).toLowerCase()}**.`);
      }
      return followup(env, i, res.error || "Couldn't claim it.");
    }
    await discord(env, "PATCH", `/channels/${i.channel_id}/messages/${i.message.id}`, {
      components: [release ? decisionRow(kind, env) : claimedRow(kind, u.id, callerName(i))], allowed_mentions: NO_PINGS });
  } catch (e) {
    await followup(env, i, "Couldn't do that: " + e.message);
  }
}

function requestDecisionAction(env, ctx, i) {
  const [, act, kind, claimer] = i.data.custom_id.split(":");
  if (!REQUESTS[kind] && kind !== "event" && kind !== "market") return reply("Unknown request type.");
  if (kind === "award") {                     // an older message: swap its buttons for the website link
    ctx.waitUntil(discord(env, "PATCH", `/channels/${i.channel_id}/messages/${i.message.id}`, { components: [websiteRow(env)], allowed_mentions: NO_PINGS }).catch(() => {}));
    return reply(AWARD_WEBSITE_ONLY);
  }
  // Known not allowed -> say so now. Unknown -> carry on; it's checked before anything is recorded.
  const known = cachedReviewer(caller(i).id);
  if (known && !mayDecide(known, kind)) return reply(decideReason(known, kind));
  if (!known) ctx.waitUntil(reviewerCheck(env, caller(i)).catch(() => {}));
  if (act === "claim" || act === "release") {
    ctx.waitUntil(claimAction(env, i, kind, act === "release"));
    return { type: R.DEFER_UPDATE };
  }
  // Older messages (Approve / Deny without a claim): switch them to the Claim step.
  if (!claimer) return { type: R.UPDATE, data: { components: [decisionRow(kind, env)] } };
  if (claimer === "web") return reply("This was claimed on the roster's Approvals page. It must be decided there, or released first.");
  if (claimer !== caller(i).id) return reply(`Claimed by <@${claimer}>. Only they can approve or deny it. Claims expire after 30 minutes; you can then press **Release** and claim it yourself.`);
  const title = kind === "event" ? "event log" : kind === "market" ? "Market purchase" : REQUESTS[kind].title;
  const box = (id, label, style, max, placeholder, value, required) => ({ type: 18, label: label, component: Object.assign(
    { type: 4, custom_id: id, style: style, max_length: max, required: required !== false, placeholder: placeholder }, value ? { value: value } : {}) });
  if (act === "no") {
    return { type: R.MODAL, data: { custom_id: "rq:noform:" + kind, title: ("Deny " + title).slice(0, 45),
      components: [box("reason", "Reason (sent to them in a DM)", 2, 500, "Why it's denied")] } };
  }
  if (kind === "loa") {
    const timeLine = (String(i.message.content || "").match(/^Time: (.*)$/m) || [])[1] || "";
    const g = guessDates(timeLine);
    return { type: R.MODAL, data: { custom_id: "rq:loaform", title: "Approve LOA: dates", components: [
      box("start", "LOA starts (DD/MM/YYYY)", 1, 10, "e.g. 07/10/2026", g[0] ? isoToUk(g[0]) : ""),
      box("end", "LOA ends (DD/MM/YYYY)", 1, 10, "e.g. 14/10/2026", g[1] || g[0] ? isoToUk(g[1] || g[0]) : "")] } };
  }
  ctx.waitUntil(decideRequest(env, i, kind, "approve", {}));
  return { type: R.DEFER_UPDATE };
}

function requestDecisionSubmit(env, ctx, i) {
  const v = modalValues(i);
  if (i.data.custom_id === "rq:loaform") {
    const s = ukToIso(v.start), e = ukToIso(v.end);
    if (!s || !e) return reply("Use DD/MM/YYYY for both dates.");
    if (e < s) return reply("The end date can't be before the start date.");
    ctx.waitUntil(decideRequest(env, i, "loa", "approve", { start: s, end: e }));
    return { type: R.DEFER_UPDATE };
  }
  const kind = i.data.custom_id.split(":")[2];
  const reason = String(v.reason || "").trim().slice(0, 500);
  if (!reason) return reply("Give a reason for denying it.");
  ctx.waitUntil(decideRequest(env, i, kind, "deny", { reason: reason }));
  return { type: R.DEFER_UPDATE };
}

async function decideRequest(env, i, kind, decision, extra) {
  const id = kind === "event" ? i.message.id : kind + "-" + i.message.id;
  const u = caller(i), who = callerName(i);
  const rv = await reviewerCheck(env, u);
  if (!mayDecide(rv, kind) && !rv.unknown) return followup(env, i, decideReason(rv, kind));
  const res = await bridge(env, Object.assign({ action: "decideRequest", id: id, decision: decision, by: who, byId: u.id, byName: u.username || "" }, extra))
    .catch(err => ({ ok: false, error: err.message }));
  if (!res.ok) {
    if (res.already) {
      await discord(env, "PATCH", `/channels/${i.channel_id}/messages/${i.message.id}`, { components: [statusRow(`${res.status} by ${String(res.by || "someone").replace(/^Discord: /, "")}`, res.status === "Denied" ? "✖️" : "✅")], allowed_mentions: NO_PINGS }).catch(() => {});
      return followup(env, i, `It was already **${String(res.status).toLowerCase()}** by ${String(res.by || "someone").replace(/^Discord: /, "")}.`);
    }
    if (res.needClaim || res.claimedBy) {
      // Claim missing / taken: put the Claim step back so it's clear.
      await discord(env, "PATCH", `/channels/${i.channel_id}/messages/${i.message.id}`, { components: [decisionRow(kind, env)], allowed_mentions: NO_PINGS }).catch(() => {});
      return followup(env, i, res.error);
    }
    return followup(env, i, "Couldn't record that on the roster: " + res.error + ". Nothing was changed.");
  }
  if (kind === "event") {
    // Same as a decision on the roster page: card updated, official log posted / submitter DM'd.
    // The roster's approvalsProcess adds the points within a minute.
    return syncFromRoster(env, { id: id, status: decision === "approve" ? "Approved" : "Denied", by: who, reason: extra.reason || "",
      submittedById: res.submittedById || "", where: "Discord" });
  }
  if (decision === "approve") {
    // Already carried out by the roster (the usual case now): its "Done" / "Error" has updated the message
    // and given the roles, so it's left as that says.
    if (res.status === "Done" || res.status === "Error") return;
    const what = kind === "loa" ? `LOA ${isoToUk(extra.start)} – ${isoToUk(extra.end)} · ` : "";
    await discord(env, "PATCH", `/channels/${i.channel_id}/messages/${i.message.id}`,
      { components: [statusRow(`${what}Approved by ${who}. Adding to the roster…`, "⏳")], allowed_mentions: NO_PINGS }).catch(() => {});
  } else {
    await syncRequest(env, { id: id, status: "Denied", by: who, reason: extra.reason, submittedById: res.submittedById || "" });
  }
}

function guessDates(text) {
  const out = [];
  String(text || "").replace(/(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})/g, (m, d, mo, y) => {
    if (y.length === 2) y = "20" + y;
    out.push(`${y}-${("0" + mo).slice(-2)}-${("0" + d).slice(-2)}`);
  });
  return out;
}
function ukToIso(s) {
  const m = String(s || "").trim().match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})$/) || String(s || "").trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return "";
  const iso = m[1].length === 4 ? `${m[1]}-${m[2]}-${m[3]}` : `${m[3].length === 2 ? "20" + m[3] : m[3]}-${("0" + m[2]).slice(-2)}-${("0" + m[1]).slice(-2)}`;
  const d = new Date(iso + "T00:00:00Z");
  return isNaN(d) || d.toISOString().slice(0, 10) !== iso ? "" : iso;
}
function isoToUk(iso) { const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})$/); return m ? `${m[3]}/${m[2]}/${m[1]}` : String(iso || ""); }

// Shadow-mode screenshot score from the bridge (POST /sync {type:"score"}): shown to reviewers, decides nothing.
async function syncScore(env, b) {
  const id = String(b.id || "");
  const score = Math.round(Number(b.score));
  const verdict = String(b.verdict || "").toLowerCase();
  const icon = { pass: "🟢", review: "🟡", fail: "🔴", error: "⚪" }[verdict] || "⚪";
  const text = verdict === "error" ? "couldn't be scored; check it manually" : `${isNaN(score) ? "?" : score}/100 · ${verdict || "?"}`;
  const label = `${icon} Screenshot check: ${text}`;
  const rk = (id.match(/^(award|roster|loa)-/) || [])[1];
  const msgId = id.replace(/\D/g, "");
  if (!rk) {                                         // an event-log card (reviewers' channel): add a field
    const path = `/channels/${CONFIG.APPROVAL_CHANNEL_ID}/messages/${msgId}`;
    const message = await discord(env, "GET", path);
    const e = Object.assign({}, (message.embeds || [])[0]);
    e.fields = (e.fields || []).filter(f => !/^🤖 Screenshot check/.test(f.name));
    e.fields.push({ name: "🤖 Screenshot check (advisory only)", value: label.slice(0, 1024), inline: false });
    const out = { embeds: [e], allowed_mentions: NO_PINGS };
    const kp = keepProof(message);
    if (kp.attachments) out.attachments = kp.attachments;
    if (kp.image) e.image = { url: kp.image };
    await discord(env, "PATCH", path, out);
    return;
  }
  const channel = requestChannel(rk);
  const link = `https://discord.com/channels/${CONFIG.GUILD_ID || "@me"}/${channel}/${msgId}`;
  if (channel === CONFIG.APPROVAL_CHANNEL_ID) {
    const path = `/channels/${channel}/messages/${msgId}`;
    const message = await discord(env, "GET", path);
    const content = String(message.content || "").replace(/\n-# 🤖 Screenshot check:.*$/m, "") + `\n-# 🤖 ${label.replace(/^\S+ /, "")} (advisory only)`;
    await discord(env, "PATCH", path, { content: content.slice(0, 2000), allowed_mentions: NO_PINGS });
  } else {
    // The request channel may be public: the score goes to the reviewers' channel instead.
    await discord(env, "POST", `/channels/${CONFIG.APPROVAL_CHANNEL_ID}/messages`,
      { content: `${label} for [this ${REQUESTS[rk].title}](${link}) · advisory only`, allowed_mentions: NO_PINGS });
  }
}

// ---------------------------------------------------------------------
// Scheduled jobs (Cron Trigger: */5 * * * *)
// ---------------------------------------------------------------------
async function runCron(env, now) {
  now = now || Date.now();
  const log = [];
  const step = async (name, fn) => {
    try { const r = await fn(); if (r) log.push(name + ": " + r); }
    catch (e) { log.push(name + " failed: " + e.message); console.error(name, e && e.stack || e); }
  };
  await step("events", () => cronEvents(env, now));
  await step("home", () => cronHome(env, now));
  await step("approvals", () => cronApprovalReminders(env, now));
  // Roles: linked members whose rank, roster, DMO / CPM or awards changed on the roster since the last run
  // (promotions on the website, approved requests, awards …). Turn off with CONFIG.ROLE_AUTO_SYNC = false.
  if (CONFIG.ROLE_AUTO_SYNC !== false) await step("roles", () => cronRoleChanges(env, now));
  if (CONFIG.ROLE_AUTO_SYNC !== false) await step("request roles", () => cronRequestRoles(env, now));
  await step("market perks", () => cronPerks(env, now));
  await step("self-test", () => cronSelfTest(env, now));
  return log;
}

// Compares each linked member's roster details with the last run; only those that changed get a role sync
// (at most 8 a run — the rest are picked up next time). The first run only remembers.
async function cronRoleChanges(env, now) {
  if (!CONFIG.GUILD_ID || !env.BOT_KV || !linked(env)) return "";
  const [info, links] = await Promise.all([bridge(env, { action: "roleinfo" }), bridge(env, { action: "links" })]);
  if (!info.ok || !links.ok) throw new Error((info.error || links.error || "roster unreachable"));
  const byEmp = {};
  (info.people || []).forEach(p => { byEmp[normEmp(p.e)] = p; });
  const sigOf = p => p ? JSON.stringify([p.k || "", p.s || "", p.dmo || "", p.cpm || "", (p.aw || []).slice().sort()]) : "gone";
  const saved = await kvGet(env, "state:rolesig", null);
  const next = Object.assign({}, saved || {});
  const changed = [];
  (links.links || []).forEach(l => {
    const sig = sigOf(byEmp[normEmp(l.emp)]);
    if (!saved || saved[l.discordId] === undefined) next[l.discordId] = sig;          // new link: /link already synced them
    else if (saved[l.discordId] !== sig) changed.push({ id: l.discordId, emp: l.emp, sig });
  });
  const out = [];
  for (const c of changed.slice(0, 8)) {
    if (c.sig === "gone") { next[c.id] = c.sig; continue; }                               // left the roster: roles left alone
    const r = await syncRolesFor(env, c.id, c.emp, "auto").catch(e => ({ error: e.message }));
    next[c.id] = c.sig;
    out.push("#" + c.emp + (r.error ? " (" + r.error + ")" : " +" + (r.added || []).length + "/-" + (r.removed || []).length));
  }
  await kvPut(env, "state:rolesig", next);
  if (!saved) return "remembered " + Object.keys(next).length + " linked members";
  return out.length ? "synced " + out.join(", ") + (changed.length > 8 ? " (+" + (changed.length - 8) + " next run)" : "") : "";
}

// Approved roster / award requests whose roles weren't given yet (if the roster's "Done" message didn't get
// through): links new members, then gives the roles. Each request is tried up to 3 times.
// The last 15 role attempts after approvals (shown in /diag as recentRoles).
async function noteRoles(env, what, userId, r) {
  if (!env.BOT_KV) return;
  const list = await kvGet(env, "state:lastroles", []) || [];
  list.unshift({ at: new Date().toISOString(), what, user: String(userId || ""),
    result: !r ? "nothing done" : r.error ? "ERROR: " + r.error : "added " + (r.added || []).length + ", removed " + (r.removed || []).length + ((r.failed || []).length ? ", " + r.failed.length + " not allowed" : "") });
  await kvPut(env, "state:lastroles", list.slice(0, 15));
}
async function markRequestRoles(env, id, how) {
  const st = await kvGet(env, "state:reqroles", {}) || {};
  st[id] = how; await kvPut(env, "state:reqroles", st, 4 * 86400);
}
async function cronRequestRoles(env, now) {
  if (!CONFIG.GUILD_ID || !env.BOT_KV || !linked(env)) return "";
  const res = await bridge(env, { action: "doneRequests", since: now - 3 * 86400000 });
  if (!res.ok) throw new Error(res.error);
  const st = await kvGet(env, "state:reqroles", {}) || {};
  const out = [];
  let n = 0;
  for (const x of res.items || []) {
    const s = st[x.id];
    if (s === "done" || s === "gave up" || n >= 5) continue;
    if (!x.discordId || !x.emp) { st[x.id] = "gave up"; out.push(x.id + ": not found on the roster"); continue; }
    n++;
    if (/^roster-/.test(x.id) && !x.linkedTo) {
      const l = await bridge(env, { action: "linkDiscord", emp: x.emp, discordId: x.discordId, by: "self", targetName: x.discord }).catch(e => ({ ok: false, error: e.message }));
      if (l.ok) out.push(x.id + ": linked to #" + x.emp);
    }
    const r = await syncRolesFor(env, x.discordId, x.linkedTo || x.emp, "link").catch(e => ({ error: e.message }));
    const tries = (typeof s === "number" ? s : 0) + 1;
    if (!r.error || r.error === "not in the server") st[x.id] = "done";
    else st[x.id] = tries >= 3 ? "gave up" : tries;
    out.push(x.id + ": " + (r.error ? r.error : "roles +" + (r.added || []).length + "/-" + (r.removed || []).length));
    await noteRoles(env, x.id + " (5-minute check)", x.discordId, r);
  }
  await kvPut(env, "state:reqroles", st, 4 * 86400);
  return out.join(", ");
}

async function cronEvents(env, now) {
  if (!CONFIG.EVENTS_CHANNEL_ID || !hqBase(env)) return "off (set EVENTS_CHANNEL_ID and HQ_URL)";
  if (!env.BOT_KV) return "off (bind a KV namespace as BOT_KV)";
  const events = hqEvents(await hq(env, "events", null, true));
  const saved = await kvGet(env, "state:events", null);
  const st = saved || { seen: {}, r30: {}, r0: {}, msg: {}, cancelled: {} };
  st.cancelled = st.cancelled || {};
  let changed = !saved, posts = 0;
  const out = [];
  if (!saved) events.forEach(e => { st.seen[evKey(e)] = now; });     // first run: no flood of old events
  for (const e of events) {
    const k = evKey(e);
    if (st.cancelled[k] || e.start + Math.max(e.minutes, 15) * 60000 < now || posts >= 6) continue;
    if (!st.seen[k]) {
      const m = await postEventMessage(env, e, "new");
      st.seen[k] = now; if (m) st.msg[k] = m.id; changed = true; posts++; out.push("announced " + e.title);
    }
    if (!st.r30[k] && now >= e.start - 30 * 60000 && now < e.start - 5 * 60000) {
      await postEventMessage(env, e, "r30", st.msg[k]); st.r30[k] = now; changed = true; posts++; out.push("30-min reminder " + e.title);
    }
    if (!st.r0[k] && now >= e.start && now < e.start + 15 * 60000) {
      await postEventMessage(env, e, "r0", st.msg[k]); st.r0[k] = now; st.r30[k] = st.r30[k] || now; changed = true; posts++; out.push("start reminder " + e.title);
    }
  }
  // Forget events that finished over two days ago.
  ["seen", "r30", "r0", "msg", "cancelled"].forEach(b => Object.keys(st[b]).forEach(k => {
    if (Number(k.split("|")[0]) < now - 2 * 86400000) { delete st[b][k]; changed = true; }
  }));
  if (changed) await kvPut(env, "state:events", st);
  return out.join(", ") || (saved ? "" : "first run: " + events.length + " existing events noted, not announced");
}

async function cronHome(env, now) {
  if (!hqBase(env)) return "off (set HQ_URL)";
  if (!env.BOT_KV) return "off (bind a KV namespace as BOT_KV)";
  const home = await hq(env, "home", null, true);
  const saved = await kvGet(env, "state:home", null);
  const st = saved || { promos: {}, ann: "", digest: "" };
  const out = [];
  let changed = !saved;

  // 9. Promotions
  const promos = hqList(home, ["promotions", "recentPromotions"]).map(p => ({
    name: String(pick(p, ["name", "roblox", "who", "user"], "")), to: String(pick(p, ["to", "rank", "newRank"], "")),
    from: String(pick(p, ["from", "oldRank", "previous"], "")), at: toMs(pick(p, ["at", "date", "when"], 0)) }))
    .filter(p => p.name && p.to);
  const pkey = (p) => (p.name + "|" + p.to + "|" + (p.at || "")).toLowerCase();
  if (!saved) promos.forEach(p => { st.promos[pkey(p)] = now; });
  else if (CONFIG.ANNOUNCE_CHANNEL_ID) {
    let n = 0;
    for (const p of promos) {
      if (st.promos[pkey(p)] || n >= 5) continue;
      await discord(env, "POST", `/channels/${CONFIG.ANNOUNCE_CHANNEL_ID}/messages`, { embeds: [{ author: { name: CONFIG.NAME }, color: CONFIG.COLOURS.approved,
        description: `**${p.name}** has been promoted to **${p.to}**${p.from ? ` (from ${p.from})` : ""}. Congratulations.` }], allowed_mentions: NO_PINGS });
      st.promos[pkey(p)] = now; n++; changed = true; out.push("promotion " + p.name);
    }
  }
  Object.keys(st.promos).forEach(k => { if (st.promos[k] < now - 60 * 86400000) { delete st.promos[k]; changed = true; } });

  // 10. Announcement mirror
  const a = pick(home, ["notice", "announcement", "publicAnnouncement"], null);
  const aText = typeof a === "string" ? a : String(pick(a, ["text", "message", "body"], ""));
  const aTitle = a && typeof a === "object" ? String(pick(a, ["title", "heading"], "")) : "";
  const aKey = aText ? await sha(aTitle + "\n" + aText) : "";
  if (aKey !== st.ann) {
    if (aKey && saved && CONFIG.ANNOUNCE_CHANNEL_ID) {
      await discord(env, "POST", `/channels/${CONFIG.ANNOUNCE_CHANNEL_ID}/messages`, { embeds: [{ author: { name: CONFIG.NAME },
        color: CONFIG.COLOURS.info, title: aTitle || "Announcement", description: aText.slice(0, 4000) }], allowed_mentions: NO_PINGS });
      out.push("announcement");
    }
    st.ann = aKey; changed = true;
  }

  // 11. Monday digest (after the 06:00 UTC rollover)
  const d = new Date(now);
  const week = mondayKey(now);
  if (d.getUTCDay() === 1 && (d.getUTCHours() * 60 + d.getUTCMinutes()) >= 6 * 60 + 30 && st.digest !== week) {
    const ch = CONFIG.DIGEST_CHANNEL_ID || CONFIG.ANNOUNCE_CHANNEL_ID;
    if (ch && saved) { await discord(env, "POST", `/channels/${ch}/messages`, { embeds: [digestEmbed(home, promos, now)], allowed_mentions: NO_PINGS }); out.push("weekly digest"); }
    st.digest = week; changed = true;
  }

  if (changed) await kvPut(env, "state:home", st);
  return out.join(", ") || (saved ? "" : "first run: current promotions and announcement noted, not posted");
}

function digestEmbed(home, promos, now) {
  let weekly = pick(home, ["weekly", "week", "weeklyActivity", "activity"], {}) || {};
  if (Array.isArray(weekly)) {
    // A list of weeks: the newest one that started before this Monday (i.e. last week).
    const thisMonday = Date.parse(mondayKey(now) + "T00:00:00Z");
    const weeks = weekly.map(w => ({ w: w, at: toMs(pick(w, ["week", "start", "date"], 0)) })).sort((a, b) => b.at - a.at);
    const last = weeks.find(x => x.at && x.at < thisMonday) || weeks[0];
    weekly = last ? Object.assign({}, last.w) : {};
    delete weekly.week; delete weekly.partial;
  }
  const lines = [];
  if (weekly && typeof weekly === "object" && !Array.isArray(weekly)) {
    Object.keys(weekly).forEach(k => {
      const v = weekly[k];
      const label = k.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, c => c.toUpperCase());
      if (typeof v === "number" || /^\d+$/.test(String(v))) lines.push(`**${label}:** ${v}`);
      else if (Array.isArray(v)) lines.push(`**${label}:** ${v.length}`);
    });
  }
  const recent = promos.filter(p => !p.at || p.at > now - 7 * 86400000);
  const fields = [];
  if (recent.length) fields.push({ name: `Promotions (${recent.length})`, value: recent.slice(0, 15).map(p => `• ${p.name} → ${p.to}`).join("\n").slice(0, 1024), inline: false });
  const newbies = hqList(weekly, ["newMembers", "joined"]).map(x => typeof x === "string" ? x : pick(x, ["name", "roblox"], "")).filter(Boolean);
  if (newbies.length) fields.push({ name: `New members (${newbies.length})`, value: newbies.slice(0, 30).join(", ").slice(0, 1024), inline: false });
  const next = pick(home, ["nextEvent"], null);
  if (next) { const ev = hqEvents([next])[0]; if (ev) fields.push({ name: "Next event", value: `**${ev.title}**, <t:${ts(ev.start)}:F>`, inline: false }); }
  return { author: { name: CONFIG.NAME }, color: CONFIG.COLOURS.info, title: "Last week in the department",
    description: lines.join("\n") || "Summary of last week.", fields: fields, footer: { text: "Week ending " + new Date(now - 86400000).toISOString().slice(0, 10) } };
}
function mondayKey(now) { const d = new Date(now); const back = (d.getUTCDay() + 6) % 7; return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - back)).toISOString().slice(0, 10); }
async function sha(s) {
  const h = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)));
  return Array.from(h.slice(0, 12)).map(b => b.toString(16).padStart(2, "0")).join("");
}

// 12. Reviewers are pinged once a day about anything waiting more than 12 hours.
async function cronApprovalReminders(env, now) {
  if (!linked(env)) return "off (bridge not linked)";
  if (!env.BOT_KV) return "off (bind a KV namespace as BOT_KV)";
  const res = await bridge(env, { action: "pending" });
  if (!res.ok) throw new Error(res.error);
  const st = await kvGet(env, "state:approvals", {}) || {};
  const limit = (CONFIG.APPROVAL_REMINDER_HOURS || 12) * 3600000;
  const old = (res.items || []).filter(x => x.at && now - x.at > limit && (!st[x.id] || now - st[x.id] > 24 * 3600000));
  const pendingIds = {};
  (res.items || []).forEach(x => { pendingIds[x.id] = true; });
  Object.keys(st).forEach(k => { if (!pendingIds[k]) delete st[k]; });
  if (old.length) {
    const lines = old.slice(0, 15).map(x => `• **${x.title || "Event log"}** from ${x.by || "someone"}, waiting since <t:${ts(x.at)}:R>`);
    await discord(env, "POST", `/channels/${CONFIG.APPROVAL_CHANNEL_ID}/messages`, {
      content: `<@&${CONFIG.APPROVER_ROLE_ID}> **${old.length} waiting for more than ${CONFIG.APPROVAL_REMINDER_HOURS || 12} hours.** Please review them here or on the roster's Approvals page:\n` +
        lines.join("\n") + (old.length > 15 ? `\n…and ${old.length - 15} more.` : ""),
      allowed_mentions: { parse: [], roles: [CONFIG.APPROVER_ROLE_ID] } });
    old.forEach(x => { st[x.id] = now; });
  }
  await kvPut(env, "state:approvals", st);
  return old.length ? "pinged about " + old.length : "";
}

// ---------------------------------------------------------------------
// 13. Role sync: Discord roles follow the roster.
// The bot matches roles in your server BY NAME to what the roster says:
//   rank      "03 - Operator" -> a role called "03 - Operator", "Operator",
//             "[03] Operator", "03 | Operator" …
//   tier      LR / MR / HR / EX / Leadership (or "Low Rank", "Middle Rank",
//             "High Rank", "Executive", "Department Leadership")
//   dept      DMO (or "Department of Management Operations"), CPM
// Any IDs filled in CONFIG.ROLES count too. Only roles that match one of
// those names are ever touched: a role is added when the roster says so and
// taken off when it no longer does (rank / tier swaps). Nobody is kicked and
// nicknames aren't changed. Runs on /link, hourly, and on /notify {type:"rank"}.
// ---------------------------------------------------------------------
const TIER_NAMES = {
  LR: ["lr", "low rank", "low ranks", "low-rank"],
  MR: ["mr", "middle rank", "middle ranks", "mid rank", "middle-rank"],
  HR: ["hr", "high rank", "high ranks", "high-rank"],
  EX: ["ex", "executive", "executives", "exec"],
  Leadership: ["leadership", "department leadership", "dept leadership"]
};
// Department ranks (Departments tab, column B) -> Discord roles of the same name.
const DEPT_RANKS = {
  DMO: ["Head of Management Operations", "Deputy Head of Management Operations",
        "Senior Data Operator", "Data Operator", "Junior Data Operator"],
  CPM: ["Head of Compliance", "Deputy Head of Compliance", "Senior Compliance Officer",
        "Compliance Officer", "Junior Compliance Officer", "Trainee Compliance Officer"]
};
const DEPT_NAMES = {
  DMO: ["dmo", "department of management operations"],
  CPM: ["cpm", "compliance & personnel management", "compliance and personnel management"]
};
// "03 - Operator", "[03] Operator", "03 | Operator" -> "operator"; plain names lower-cased.
function roleKey(name) {
  return String(name || "").toLowerCase().replace(/[\u{1F000}-\u{1FFFF}⌀-⏿☀-➿⬀-⯿️‍]/gu, "")
    .replace(/^[\s\[\(]*\d{1,2}[\s\]\)]*[-–|:.]?\s*/, "").replace(/[-–—_]+/g, " ").replace(/\s+/g, " ").trim();
}
// Looser match for award names: "O.B.’s Favorite Technician" = "O.B. Favourite Technician",
// "Timeline Stabilizer" = "Timeline Stabiliser", emoji and punctuation ignored.
function looseKey(name) {
  return roleKey(name).replace(/['’`]s\b/g, "").replace(/[^a-z0-9 ]+/g, "")
    .replace(/our\b/g, "or").replace(/our(?=[a-z])/g, "or").replace(/is(e|ed|er|ing|ation)\b/g, "iz$1")
    .replace(/\s+/g, " ").trim();
}
function tierOf(entry) {
  const rank = String(pick(entry, ["rank"], ""));
  const clr = String(pick(entry, ["clearance", "tier"], "")).toUpperCase();
  const sheet = String(pick(entry, ["sheet", "group"], ""));
  if (rankNumber(rank) >= 14 || /LEADER/.test(clr) || /leader/i.test(sheet)) return "Leadership";
  const m = clr.match(/\b(LR|MR|HR|EX)\b/);
  if (m) return m[1];
  const byName = RANK_TIERS[roleKey(rank)];
  if (byName) return byName;
  const n = rankNumber(rank);
  return !n ? "" : n <= 5 ? "LR" : n <= 9 ? "MR" : n <= 11 ? "HR" : n <= 13 ? "EX" : "Leadership";
}
// Given to everyone on the roster (either spelling).
const STAFF_ROLES = ["R&A Staff", "RNA Staff"];
// Award roles are named like the Awards tab and follow it both ways (ticked = has the
// role, unticked = role removed); this divider comes with having any.
const AWARDS_DIVIDER = "[Awards]";
// The roster's ranks by tier, lowest first. Names are matched loosely.
const RANK_LIST = {
  LR: ["Apprentice Operator", "Junior Operator", "Plant Operator", "Senior Operator", "Commissioned Operator"],
  MR: ["System Supervisor", "System Inspector", "System Custodian", "System Overseer"],
  HR: ["Engineering Director", "Senior Engineering Director"],
  EX: ["Branch Regent", "Branch Executive"],
  Leadership: ["Deputy-Chief Engineer", "Chief Engineer"]
};
const RANK_TIERS = (() => {
  const out = {};
  Object.keys(RANK_LIST).forEach(k => RANK_LIST[k].forEach(n => { out[roleKey(n)] = k; }));
  return out;
})();
// What the roster says this person should have: a set of role keys + config IDs.
function wantedFor(entry) {
  const keys = [], ids = [];
  const rank = String(pick(entry, ["rank"], ""));
  if (rank) keys.push(roleKey(rank));
  const extra = (k) => ((CONFIG.EXTRA_ROLES || {})[k] || []).forEach(n => keys.push(String(n).toLowerCase().trim(), roleKey(n)));
  const rn = rankNumber(rank);
  if (rn) { extra(String(rn).padStart(2, "0")); extra(String(rn)); }
  const t = tierOf(entry);
  if (t) extra(t);
  if (t) { keys.push.apply(keys, TIER_NAMES[t]); if (CONFIG.ROLES[t]) ids.push(CONFIG.ROLES[t]); }
  ["DMO", "CPM"].forEach(d => {
    if (truthy(pick(entry, [d.toLowerCase(), d, "is" + d, d.toLowerCase() + "Rank"], false))) {
      keys.push.apply(keys, DEPT_NAMES[d]);
      extra(d);
      const deptRank = pick(entry, [d.toLowerCase()], "");
      if (typeof deptRank === "string" && deptRank.trim()) keys.push(roleKey(deptRank));
      if (CONFIG.ROLES[d]) ids.push(CONFIG.ROLES[d]);
    }
  });
  const awards = Array.isArray(entry.awards) ? entry.awards : [];
  awards.forEach(a => keys.push(roleKey(a), String(a).toLowerCase().trim(), "~" + looseKey(a)));
  if (awards.length) keys.push(roleKey(AWARDS_DIVIDER));
  STAFF_ROLES.forEach(n => keys.push(roleKey(n), n.toLowerCase()));
  return { keys: keys.filter(Boolean), ids: ids };
}

// The plan: which of the server's roles the bot manages, and their keys.
let ROLE_PLAN = null;
async function rolePlan(env, byEmp, fresh) {
  if (!fresh && ROLE_PLAN && Date.now() - ROLE_PLAN.at < 10 * 60000) return ROLE_PLAN;
  const roles = await discord(env, "GET", `/guilds/${CONFIG.GUILD_ID}/roles`);
  const me = await discord(env, "GET", `/guilds/${CONFIG.GUILD_ID}/members/${CONFIG.APP_ID}`).catch(() => null);
  const pos = {};
  roles.forEach(r => { pos[r.id] = r.position; });
  const botTop = me && Array.isArray(me.roles) && me.roles.length ? Math.max.apply(null, me.roles.map(id => pos[id] || 0)) : Infinity;

  // Every name the roster could ask for: all ranks in use + the bot's rank lists + tiers + departments.
  const universe = {};
  const addKey = (k) => { if (k) universe[k] = true; };
  Object.keys(byEmp || {}).forEach(e => { const r = String(pick(byEmp[e], ["rank"], "")); addKey(roleKey(r)); addKey(r.toLowerCase().trim()); });
  const meta = await loadMeta(env).catch(() => null);
  [].concat((meta && meta.ranks) || [], (meta && meta.mgmtRanks) || []).forEach(r => { addKey(roleKey(r)); addKey(String(r).toLowerCase().trim()); });
  Object.keys(TIER_NAMES).forEach(t => TIER_NAMES[t].forEach(addKey));
  Object.keys(DEPT_NAMES).forEach(d => DEPT_NAMES[d].forEach(addKey));
  Object.keys(DEPT_RANKS).forEach(d => DEPT_RANKS[d].forEach(n => addKey(roleKey(n))));
  Object.keys(RANK_LIST).forEach(t => RANK_LIST[t].forEach(n => addKey(roleKey(n))));
  AWARD_NAMES.concat([AWARDS_DIVIDER], STAFF_ROLES).forEach(n => { addKey(roleKey(n)); addKey(String(n).toLowerCase().trim()); });
  AWARD_NAMES.forEach(n => addKey("~" + looseKey(n)));
  Object.keys(byEmp || {}).forEach(e => ["dmo", "cpm"].forEach(d => { const v = byEmp[e][d]; if (typeof v === "string") addKey(roleKey(v)); }));
  Object.keys(CONFIG.EXTRA_ROLES || {}).forEach(k => (CONFIG.EXTRA_ROLES[k] || []).forEach(n => { addKey(String(n).toLowerCase().trim()); addKey(roleKey(n)); }));
  const configIds = Object.keys(CONFIG.ROLES).map(k => CONFIG.ROLES[k]).filter(Boolean);

  // Group / divider roles ("Middle Management", "[MR]", "[DMO]" …) and which group they follow.
  const groupOf = {};
  const addGroup = (n, g) => { groupOf[roleKey(n)] = g; groupOf[String(n).toLowerCase().trim()] = g; };
  Object.keys(TIER_NAMES).forEach(t => TIER_NAMES[t].forEach(n => addGroup(n, "tier")));
  Object.keys(DEPT_NAMES).forEach(d => DEPT_NAMES[d].forEach(n => addGroup(n, d)));
  Object.keys(CONFIG.EXTRA_ROLES || {}).forEach(k => (CONFIG.EXTRA_ROLES[k] || []).forEach(n => addGroup(n, DEPT_NAMES[k] ? k : "tier")));
  const keep = {};
  (CONFIG.KEEP_ROLES || []).forEach(n => { keep[roleKey(n)] = true; keep[String(n).toLowerCase().trim()] = true; });
  const managed = {}, tooHigh = [], duplicates = [], byKey = {};
  // Two roles with the same name (e.g. two "[EX]" dividers): only the lowest one is used.
  roles.slice().sort((a, b) => a.position - b.position).forEach(r => {
    const k = roleKey(r.name);
    if (byKey[k]) { duplicates.push(r.name); r._skip = true; } else byKey[k] = r.id;
  });
  roles.forEach(r => {
    if (r._skip) return;
    if (r.managed || r.id === CONFIG.GUILD_ID) return;             // bot / booster / @everyone roles
    const k1 = roleKey(r.name), k2 = String(r.name).toLowerCase().trim(), k3 = "~" + looseKey(r.name);
    if (!(universe[k1] || universe[k2] || universe[k3] || configIds.indexOf(r.id) !== -1)) return;
    if (r.position >= botTop) { tooHigh.push(r.name); return; }   // Discord won't let the bot change these
    managed[r.id] = { name: r.name, keys: [k1, k2, k3], keep: !!(keep[k1] || keep[k2]), group: groupOf[k1] || groupOf[k2] || "" };
  });
  const matched = Object.keys(managed).length + tooHigh.length;
  const botRole = me ? roles.filter(r => (me.roles || []).indexOf(r.id) !== -1).sort((a, b) => b.position - a.position)[0] : null;
  ROLE_PLAN = { at: Date.now(), awardSig: AWARD_NAMES.join("|"), managed: managed, tooHigh: tooHigh, duplicates: duplicates, botFound: !!me, matched: matched,
                botRole: botRole ? botRole.name : "", serverRoles: roles.length };
  return ROLE_PLAN;
}
// allow: which group roles may change — undefined = all (/link), else {tier, DMO, CPM}.
function roleDiff(entry, currentRoles, plan, allow) {
  // A blank rank (row mid-edit, bad read) means "don't know", not "remove everything".
  if (!String(pick(entry, ["rank"], "")).trim()) return { add: [], remove: [] };
  const want = wantedFor(entry), wantKeys = {};
  want.keys.forEach(k => { wantKeys[k] = true; });
  const ok = (id) => !allow || !plan.managed[id].group || allow[plan.managed[id].group];
  const desired = Object.keys(plan.managed).filter(id => want.ids.indexOf(id) !== -1 || plan.managed[id].keys.some(k => wantKeys[k]));
  const have = (currentRoles || []).filter(id => plan.managed[id]);
  const out = {
    add: desired.filter(id => have.indexOf(id) === -1 && ok(id)),
    remove: have.filter(id => desired.indexOf(id) === -1 && !plan.managed[id].keep && ok(id)) };
  return out;
}
// Group roles only move when someone changes tier (LR/MR/HR/EX/WC) or joins/leaves
// DMO or CPM. Last-known state per Discord account is kept in KV.
function inDept(entry, d) { return truthy(pick(entry, [d.toLowerCase(), d, "is" + d, d.toLowerCase() + "Rank"], false)); }
function groupState(entry) { return { t: tierOf(entry), DMO: inDept(entry, "DMO"), CPM: inDept(entry, "CPM") }; }
function groupAllow(prev, cur) {
  if (!prev) return { tier: false, DMO: false, CPM: false };    // first time seen: just remember
  return { tier: prev.t !== cur.t, DMO: prev.DMO !== cur.DMO, CPM: prev.CPM !== cur.CPM };
}
// Everyone's rank / sheet / DMO / CPM by employee number. Read from the live
// roster through the bridge ("roleinfo"); the HQ list only fills gaps (or is
// used on its own if the bridge hasn't been updated yet).
let ROLE_SOURCE = "";
let AWARD_NAMES = [];   // every award on the roster's Awards tab (from the bridge)
async function hqRosterByEmp(env, fresh) {
  const by = {};
  const fromBridge = await bridge(env, { action: "roleinfo" }).catch(e => ({ ok: false, error: String(e.message || e) }));
  if (fromBridge.ok) {
    (fromBridge.people || []).forEach(p => {
      const e = normEmp(p.e);
      if (e) by[e] = { rank: p.k, sheet: p.s, name: p.n, dmo: p.dmo, cpm: p.cpm, employeeNo: p.e, awards: p.aw || [] };
    });
    AWARD_NAMES = fromBridge.awardNames || [];
  }
  let hqCount = 0;
  try {
    const list = hqList(await hq(env, "hqroster", null, fresh), ["roster", "people", "members", "rows"]);
    list.forEach(x => {
      const e = normEmp(pick(x, ["emp", "employeeNo", "employee", "empNo"], ""));
      if (!e) return;
      hqCount++;
      if (!by[e]) by[e] = x;
      else if (!by[e].clearance) by[e].clearance = pick(x, ["clearance"], "");
    });
  } catch (e) { /* HQ down: the bridge data is enough */ }
  ROLE_SOURCE = (fromBridge.ok ? `roster via bridge (${(fromBridge.people || []).length})` : `bridge: ${fromBridge.error}`) + ` · HQ list (${hqCount})`;
  return by;
}
async function roleOp(env, method, userId, roleId) {
  const res = await fetch(`${API}/guilds/${CONFIG.GUILD_ID}/members/${userId}/roles/${roleId}`, {
    method: method, headers: { "Authorization": "Bot " + env.BOT_TOKEN, "X-Audit-Log-Reason": "Roster role sync" } });
  if (res.status === 429) { const j = await res.json().catch(() => ({})); return { retry: Number(j.retry_after) || 2 }; }
  if (res.status === 404) return { gone: true };                         // left the server
  if (res.status === 403) return { denied: true };                       // role above the bot / no Manage Roles
  if (!res.ok) throw new Error(`Discord ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return {};
}
// One person, right now (after /link, or /notify). Returns what changed.
// mode "link": everything, group roles included. "auto": group roles only on a tier / department change.
// names: {discord, roblox} to find them by name instead (after an approved request).
async function syncRolesFor(env, userId, emp, mode, names, given) {
  if (!CONFIG.GUILD_ID) return { changes: 0, added: [], removed: [], error: "GUILD_ID isn't set" };
  // Quick path: just this person — sent by the roster with "Done" (given), else asked for
  // (bridge "roleinfoOne" / "roleinfoName").
  let byEmp = null, entry = null;
  const one = given && given.person ? { ok: true, person: given.person, awardNames: given.awardNames } : await bridge(env, names
    ? { action: "roleinfoName", discord: String(names.discord || ""), roblox: String(names.roblox || "") }
    : { action: "roleinfoOne", emp: String(emp || "") }).catch(e => ({ ok: false, error: e.message }));
  if (one.ok) {
    AWARD_NAMES = one.awardNames || AWARD_NAMES;
    const p = one.person;
    if (p) {
      entry = { rank: p.k, sheet: p.s, name: p.n, dmo: p.dmo, cpm: p.cpm, employeeNo: p.e, awards: p.aw || [] };
      byEmp = {}; byEmp[normEmp(p.e)] = entry;
    }
  }
  if (!entry && emp) {                             // older bridge, or not found: the full list
    byEmp = await hqRosterByEmp(env, true);
    entry = byEmp[normEmp(emp)];
  }
  if (!entry && !one.ok) return { error: "couldn't reach the roster (" + String(one.error || "no answer").slice(0, 60) + ")" };
  if (!entry) return { error: names ? `${names.discord || names.roblox} isn't on the roster yet`
    : `employee #${emp || "?"} wasn't found on the roster (${ROLE_SOURCE || "roster via bridge"})` };
  const member = await discord(env, "GET", `/guilds/${CONFIG.GUILD_ID}/members/${userId}`).catch(() => null);
  if (!member) return { error: "not in the server" };
  const plan = await rolePlan(env, byEmp, !ROLE_PLAN || ROLE_PLAN.awardSig !== AWARD_NAMES.join("|"));
  let allow;
  if (String(pick(entry, ["rank"], "")).trim() && tierOf(entry) && env.BOT_KV) {
    const states = await kvGet(env, "state:groups", {}) || {};
    const cur = groupState(entry);
    if (mode === "auto") allow = groupAllow(states[userId], cur);
    states[userId] = cur;
    await kvPut(env, "state:groups", states);
  }
  const d = roleDiff(entry, member.roles, plan, allow);
  let added = [], removed = [], failed = [];
  if (d.add.length || d.remove.length) {
    // One request for all changes (one-by-one hits Discord's rate limit after ~10).
    const next = member.roles.filter(id => d.remove.indexOf(id) === -1).concat(d.add);
    let res = null;
    for (let tries = 0; tries < 3; tries++) {
      res = await fetch(`${API}/guilds/${CONFIG.GUILD_ID}/members/${userId}`, { method: "PATCH",
        headers: { "Authorization": "Bot " + env.BOT_TOKEN, "Content-Type": "application/json", "X-Audit-Log-Reason": "Roster role sync (/link)" },
        body: JSON.stringify({ roles: next }) });
      if (res.status !== 429) break;
      const j = await res.json().catch(() => ({}));
      await new Promise(ok => setTimeout(ok, Math.min(5000, (Number(j.retry_after) || 1) * 1000)));
    }
    if (res.ok) { added = d.add; removed = d.remove; }
    else if (res.status === 403) {
      // Something in the list is above the bot: try each on its own to find out which.
      const tryOne = async (method, r, okList) => {
        for (let t = 0; t < 3; t++) {
          const x = await roleOp(env, method, userId, r);
          if (x.retry) { await new Promise(ok => setTimeout(ok, Math.min(5000, x.retry * 1000))); continue; }
          (x.denied ? failed : okList).push(r); return;
        }
        failed.push(r);
      };
      for (const r of d.add) await tryOne("PUT", r, added);
      for (const r of d.remove) await tryOne("DELETE", r, removed);
    } else throw new Error(`Discord ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  // Which part of /link each role belongs to, for the reply.
  const awardKeys = {}, deptKeys = {};
  AWARD_NAMES.concat([AWARDS_DIVIDER]).forEach(n => { awardKeys["~" + looseKey(n)] = true; awardKeys[roleKey(n)] = true; });
  Object.keys(DEPT_RANKS).forEach(d => DEPT_RANKS[d].forEach(n => { deptKeys[roleKey(n)] = true; }));
  ["dmo", "cpm"].forEach(d => { if (typeof entry[d] === "string" && entry[d]) deptKeys[roleKey(entry[d])] = true; });
  const kindOf = (id) => {
    const m = plan.managed[id];
    if (!m) return "rank";
    if (STAFF_ROLES.some(n => m.keys.indexOf(roleKey(n)) !== -1)) return "staff";
    if (m.keys.some(k => awardKeys[k])) return "award";
    if (m.group === "DMO" || m.group === "CPM" || m.keys.some(k => deptKeys[k])) return "dept";
    if (m.group === "tier") return "group";
    return "rank";
  };
  const awards = Array.isArray(entry.awards) ? entry.awards : [];
  return { changes: added.length + removed.length, added: added, removed: removed, failed: failed, kindOf: kindOf,
           rank: String(pick(entry, ["rank"], "")), tier: tierOf(entry), dmo: typeof entry.dmo === "string" ? entry.dmo : "",
           cpm: typeof entry.cpm === "string" ? entry.cpm : "", awards: awards,
           noRoles: !Object.keys(plan.managed).length, tooHigh: plan.tooHigh };
}
// "Added @A, @B · removed @C" for replies.
// The /link reply: what the roster says, then what changed, part by part.
const TIER_LABEL = { LR: "Low Rank", MR: "Middle Rank", HR: "High Rank", EX: "Executive", Leadership: "War Council" };
function roleSummary(r) {
  if (!r) return "";
  if (r.error) return `Roles not updated (${r.error}).`;
  if (r.noRoles) return r.tooHigh && r.tooHigh.length
    ? `No roles changed: the matching roles (${r.tooHigh.slice(0, 5).join(", ")}${r.tooHigh.length > 5 ? "…" : ""}) are above the bot's role. Move the bot's role above them in Server Settings → Roles.`
    : "No roles in the server match the roster's ranks, tiers or DMO/CPM, so nothing was changed.";
  const lines = ["**On the roster**",
    `> **Rank:** ${r.rank || "—"}${r.tier ? ` (${TIER_LABEL[r.tier] || r.tier})` : ""}`,
    `> **Departments:** ${[r.dmo && "DMO – " + r.dmo, r.cpm && "CPM – " + r.cpm].filter(Boolean).join(" · ") || "none"}`,
    `> **Awards:** ${r.awards && r.awards.length ? r.awards.join(", ") : "none"}`];
  if (!r.added.length && !r.removed.length && !(r.failed || []).length) {
    lines.push("", "Your Discord roles already match the roster.");
    return lines.join("\n");
  }
  const parts = [["rank", "Rank"], ["group", "Rank group"], ["dept", "Department"], ["award", "Awards"], ["staff", "Staff"]];
  lines.push("", "**Discord roles updated**");
  parts.forEach(([k, label]) => {
    const add = r.added.filter(id => r.kindOf(id) === k), rem = r.removed.filter(id => r.kindOf(id) === k);
    if (!add.length && !rem.length) return;
    const bits = [];
    if (add.length) bits.push("added " + add.map(id => `<@&${id}>`).join(" "));
    if (rem.length) bits.push("removed " + rem.map(id => `<@&${id}>`).join(" "));
    lines.push(`> **${label}:** ${bits.join(" · ")}`);
  });
  if (r.failed && r.failed.length) lines.push(`The bot couldn't change ${r.failed.map(id => `<@&${id}>`).join(" ")}. Its role must be above ${r.failed.length === 1 ? "it" : "them"} and have Manage Roles.`);
  return lines.join("\n");
}

async function cronRoles(env, now) {
  if (!CONFIG.GUILD_ID) return "off (set GUILD_ID)";
  if (!env.BOT_KV) return "off (bind a KV namespace as BOT_KV)";
  let q = await kvGet(env, "state:rolequeue", null);
  const out = [];
  if (!q || (!q.items.length && now - q.at > 55 * 60000)) {
    // Plan a full pass: linked accounts x roster x current Discord roles.
    const links = await bridge(env, { action: "links" });
    if (!links.ok) throw new Error(links.error);
    const byEmp = await hqRosterByEmp(env, true);
    const plan = await rolePlan(env, byEmp, true);
    if (!Object.keys(plan.managed).length) {
      await kvPut(env, "state:rolequeue", { at: now, items: [] });
      return plan.tooHigh.length
        ? `${plan.tooHigh.length} roles match the roster but are above the bot's role ("${plan.botRole || "?"}"), so it can't give them: ` +
          plan.tooHigh.slice(0, 20).join(", ") + ". Drag the bot's role above them in Server Settings > Roles."
        : `none of the server's ${plan.serverRoles} roles match the roster's rank names (open /diag to compare)`;
    }
    const members = {};
    let after = "0";
    for (let page = 0; page < 5; page++) {
      const batch = await discord(env, "GET", `/guilds/${CONFIG.GUILD_ID}/members?limit=1000&after=${after}`);
      batch.forEach(m => { members[m.user.id] = m.roles || []; });
      if (batch.length < 1000) break;
      after = batch[batch.length - 1].user.id;
    }
    const items = [];
    const states = await kvGet(env, "state:groups", {}) || {};
    (links.links || []).forEach(l => {
      const entry = byEmp[normEmp(l.emp)], roles = members[l.discordId];
      if (!entry || !roles) return;
      let allow = { tier: false, DMO: false, CPM: false };
      if (String(pick(entry, ["rank"], "")).trim() && tierOf(entry)) {
        const cur = groupState(entry);
        allow = groupAllow(states[l.discordId], cur);
        states[l.discordId] = cur;
      }
      const d = roleDiff(entry, roles, plan, allow);
      d.add.forEach(r => items.push([l.discordId, "PUT", r]));
      d.remove.forEach(r => items.push([l.discordId, "DELETE", r]));
    });
    await kvPut(env, "state:groups", states);
    q = { at: now, items: items };
    out.push(`planned ${items.length} change${items.length === 1 ? "" : "s"} for ${(links.links || []).length} linked, ${Object.keys(plan.managed).length} roles managed`);
  }
  let done = 0;
  while (q.items.length && done < (CONFIG.ROLE_CHANGES_PER_RUN || 20)) {
    const [u, method, r] = q.items[0];
    const res = await roleOp(env, method, u, r);
    if (res.retry) break;                    // rate limited: carry on next run
    q.items.shift(); done++;
  }
  if (done) out.push(`made ${done}, ${q.items.length} left`);
  await kvPut(env, "state:rolequeue", q);
  return out.join(", ");
}

// ---------------------------------------------------------------------
// Routing for the commands above (called first from handle()).
// Returns a response, or null for anything that isn't one of these.
// ---------------------------------------------------------------------
async function handleCommunity(i, env, ctx) {
  const name = i.data && i.data.name;
  const f = flatOptions(i);
  const o = f.opts;

  if (i.type === T.AUTOCOMPLETE && ["event", "profile", "link", "roster"].indexOf(name) !== -1) {
    const focused = f.focused || {};
    const typed = String(focused.value || "");
    let choices = [];
    try {
      if (focused.name === "event") choices = await Promise.race([suggestEvents(env, typed), new Promise(r => setTimeout(() => r([]), 2500))]);
      else if (focused.name === "timezone") choices = await requestSuggest(env, ctx, focused);
      else if (focused.name === "rank") {
        const meta = await Promise.race([loadMeta(env), new Promise(r => setTimeout(() => r(null), 2200))]).catch(() => null);
        choices = pickFrom((meta && meta.ranks) || [], typed);
      } else {
        const roster = await Promise.race([loadRoster(env), new Promise(r => setTimeout(() => r(null), 2200))]).catch(() => null);
        if (roster) {
          choices = suggest(roster, typed);
          if (focused.name === "referrer") {
            const ok = {};
            mrList(roster).forEach(p => { ok[String(p.r || p.d).toLowerCase()] = true; });
            choices = choices.filter(c => ok[c.value.toLowerCase()]);
          }
        } else ctx.waitUntil(loadRoster(env).catch(() => {}));
      }
    } catch (e) { choices = []; }
    return { type: R.AUTOCOMPLETE, data: { choices: choices.slice(0, 25) } };
  }

  if (i.type === T.COMMAND) {
    const needsRoster = ["event", "profile", "leaderboard", "mystats", "link", "roster"].indexOf(name) !== -1;
    if (needsRoster && !linked(env) && !(name === "event" && (f.sub === "list" || f.sub === "log"))) return reply("The roster isn't linked yet.");
    if (name === "event" && f.sub === "schedule") { ctx.waitUntil(eventSchedule(env, i, o)); return deferred(); }
    if (name === "event" && f.sub === "cancel") { ctx.waitUntil(eventCancel(env, i, o)); return deferred(); }
    if (name === "event" && f.sub === "list") { ctx.waitUntil(eventList(env, i)); return deferred(o); }
    if (name === "event" && f.sub === "log") return eventLogStart(env, ctx, o, i);
    if (name === "profile") { ctx.waitUntil(profileCommand(env, i, o)); return deferred(o); }
    if (name === "leaderboard") { ctx.waitUntil(leaderboardCommand(env, i)); return deferred(o); }
    if (name === "mystats") { ctx.waitUntil(myStatsCommand(env, i)); return deferred(); }
    if (name === "market") { ctx.waitUntil(marketCommand(env, i)); return deferred(); }
    if (name === "link") { ctx.waitUntil(linkCommand(env, i, o)); return deferred(); }
    if (name === "roster" && f.sub === "start") { ctx.waitUntil(rosterStart(env, i)); return deferred(); }
    if (name === "roster" && f.sub === "update") { ctx.waitUntil(openRequestPanel(env, i, "roster", { updateOnly: true })); return deferred(); }
    if (name === "roster" && f.sub === "submit") { ctx.waitUntil(rosterSubmit(env, i, o)); return deferred(); }
  }

  if (i.type === T.COMPONENT && /^rq:(yes|no|claim|release):/.test(i.data.custom_id)) return requestDecisionAction(env, ctx, i);
  if (i.type === T.COMPONENT && /^mk:/.test(i.data.custom_id)) { ctx.waitUntil(marketComponent(env, i)); return { type: R.DEFER_UPDATE }; }
  if (i.type === T.COMPONENT && /^evs:(go|roster)$/.test(i.data.custom_id)) return eventScheduleButton(env, ctx, i);
  if (i.type === T.MODAL_SUBMIT && /^rq:(noform:|loaform$)/.test(i.data.custom_id)) return requestDecisionSubmit(env, ctx, i);
  return null;
}

// The new slash commands (added to the list in registerCommands).
const COMMUNITY_COMMANDS = [
  { name: "market", description: "See the Market and request a purchase with your points (Management+)", dm_permission: false },
  { name: "event", description: "Events: log one for approval, or schedule, cancel and list HQ events", dm_permission: false, options: [
    { type: 1, name: "schedule", description: "Schedule an event (Management+)", options: [
      { type: 3, name: "title", description: "Event name", required: true, max_length: 100 },
      { type: 3, name: "date", description: "DD/MM/YYYY, YYYY-MM-DD, today or tomorrow", required: true, max_length: 12 },
      { type: 3, name: "time", description: "Start time, 24-hour HH:MM (e.g. 19:30)", required: true, max_length: 8 },
      { type: 4, name: "length", description: "Length in minutes", required: true, min_value: 5, max_value: 720 },
      { type: 3, name: "timezone", description: "The time zone you typed the time in (default: your device's, else your roster one)", required: false, autocomplete: true, max_length: 40 },
      { type: 3, name: "host", description: "Host (default: you)", required: false, autocomplete: true, max_length: 60 },
      { type: 3, name: "description", description: "What it's about", required: false, max_length: 1000 }] },
    { type: 1, name: "cancel", description: "Cancel an upcoming event (Management+)", options: [
      { type: 3, name: "event", description: "Start typing the event's name", required: true, autocomplete: true }] },
    { type: 1, name: "log", description: "Log an event for approval", options: [
        { type: 3, name: "type", description: "What kind of event it was", required: true,
          choices: EVENT_TYPES.map(t => ({ name: t, value: t })) },
        { type: 3, name: "other", description: "Only for Other: what the event was (up to 60 characters)", required: false, max_length: 60 },
        { type: 5, name: "double_ap", description: "Double AP event? Attendees get double (default: no)", required: false }] },
    { type: 1, name: "list", description: "Upcoming events, in your own time", options: [
      { type: 5, name: "share", description: "Post it in the channel for everyone (default: only you see it)", required: false }] }] },
  { name: "profile", description: "Someone's public profile", dm_permission: false, options: [
    { type: 3, name: "name", description: "Start typing a Discord or Roblox name (default: you)", required: false, autocomplete: true, max_length: 60 },
    { type: 6, name: "member", description: "Or pick a server member", required: false },
    { type: 5, name: "share", description: "Post it in the channel (default: only you see it)", required: false }] },
  { name: "leaderboard", description: "This month's top hosts and attendees", dm_permission: false, options: [
    { type: 5, name: "share", description: "Post it in the channel (default: only you see it)", required: false }] },
  { name: "mystats", description: "Your stats: this month, weekly quota and promotion progress (only you see it)", dm_permission: false },
  { name: "link", description: "Link to your roster entry and get your rank, department, award and staff roles", dm_permission: false, options: [
    { type: 3, name: "name", description: "First time: pick your roster name. Already linked: leave empty to update your roles", required: false, autocomplete: true, max_length: 60 }] },
  { name: "roster", description: "Apply to be rostered, or update your rank / details", dm_permission: false, options: [
    { type: 1, name: "start", description: "New members, step 1: get your code to type in the in-game chat" },
    { type: 1, name: "update", description: "Already on the roster: request a rank or details change" },
    { type: 1, name: "submit", description: "New members, step 2: send your application with a screenshot of the code", options: [
      { type: 3, name: "roblox", description: "Your Roblox username", required: true, max_length: 40 },
      { type: 3, name: "timezone", description: "Your timezone, e.g. UTC+1", required: true, autocomplete: true, max_length: 12 },
      { type: 3, name: "rank", description: "The rank you're applying for", required: true, autocomplete: true, max_length: 60 },
      { type: 11, name: "screenshot", description: "Screenshot with your code next to your name (PNG, JPG or WebP)", required: true },
      { type: 3, name: "referrer", description: "Who referred you (MR members only)", required: false, autocomplete: true, max_length: 60 }] }] }
];

// ---------------------------------------------------------------------
// Messages — one consistent "event card" used everywhere
// ---------------------------------------------------------------------
const UI = {
  type: "Type", date: "Date", host: "Host", sup: "Supervisor", co: "Co-hosts", att: "Attendees",
  notes: "Notes", check: "Roster check", points: "Roster", reason: "Reason"
};

// The official text format (used for #event-logs, with pings).
function formatLog(log) {
  return [
    `Event Type: ${log.event}`,
    log.doubleAP ? "Double AP: Yes" : null,
    `Date: ${log.date}`,
    `Host: ${log.host}`,
    `Co-Host: ${log.cohosts.length ? log.cohosts.join(", ") : "None"}`,
    log.supervisor ? `Supervisor: ${log.supervisor}` : null,
    `Attendees: ${log.attendees.join(", ")}`,
    `Notes: ${log.notes || "None"}`
  ].filter(x => x !== null).join("\n");
}

// Names as one tidy line each field, split over more fields if very long.
function nameFields(title, names) {
  if (!names.length) return [{ name: title, value: "—", inline: false }];
  const out = [];
  let cur = "";
  names.forEach(n => {
    const next = cur ? cur + ", " + n : n;
    if (next.length > 1000) { out.push(cur); cur = n; } else cur = next;
  });
  if (cur) out.push(cur);
  return out.slice(0, 6).map((v, k) => ({ name: k ? title.replace(/ \(\d+\)$/, "") + " (cont.)" : title, value: v, inline: false }));
}

function cardFields(log) {
  return [
    { name: UI.type, value: (log.event || "—") + (log.doubleAP ? " · Double AP" : ""), inline: false },
    { name: UI.date, value: log.date || "—", inline: true },
    { name: UI.host, value: log.host || "—", inline: true },
    { name: UI.sup, value: log.supervisor || "—", inline: true }
  ].concat(
    nameFields(`${UI.co} (${log.cohosts.length})`, log.cohosts),
    nameFields(`${UI.att} (${log.attendees.length})`, log.attendees),
    [{ name: UI.notes, value: (log.notes || "—").slice(0, 1024), inline: false }]
  );
}

const ts = (ms) => Math.floor((ms || Date.now()) / 1000);

// state: pending | approved | denied.  o: { submitterId, submittedAt, by, reason, check, points, proofImage }
function card(log, state, o) {
  const sub = o.submitterId ? `<@${o.submitterId}>` : "unknown";
  const head = {
    pending:  `**Awaiting approval** on the roster's Approvals page\nSubmitted by ${sub} · <t:${ts(o.submittedAt)}:R>`,
    approved: `**Approved** by ${o.by} · <t:${ts()}:f>\nSubmitted by ${sub} · <t:${ts(o.submittedAt)}:f>\nThe official log is in <#${CONFIG.EVENT_LOG_CHANNEL_ID}>.`,
    denied:   `**Denied** by ${o.by} · <t:${ts()}:f>\nSubmitted by ${sub} · <t:${ts(o.submittedAt)}:f>`
  }[state];
  const fields = cardFields(log);
  if (o.check) fields.push(o.check);
  if (state === "denied") fields.push({ name: UI.reason, value: (o.reason || "No reason given").slice(0, 1024), inline: false });
  if (o.points) fields.push({ name: UI.points, value: o.points, inline: false });
  const embed = {
    author: { name: CONFIG.NAME },
    title: log.event || "Event log",
    description: head,
    color: CONFIG.COLOURS[state],
    fields: fields,
    footer: { text: "Event log · " + CONFIG.NAME },
    timestamp: new Date(o.submittedAt || Date.now()).toISOString()
  };
  if (o.proofImage) embed.image = { url: o.proofImage };
  return embed;
}

// Small grey text above the card: the log with pings.
function subtextLog(text) {
  return text.split("\n").map(l => "-# " + l).join("\n");
}

function statusRow(label, emoji) {
  return { type: 1, components: [{ type: 2, style: 2, label: label.slice(0, 80), custom_id: "status", disabled: true, emoji: { name: emoji } }] };
}

// Keeps the uploaded proof on the message when it's edited.
// A screenshot shown inside the embed isn't in message.attachments, so its
// own link is reused; leaving `attachments` out keeps the file on the message.
function keepProof(message) {
  const a = (message.attachments || [])[0];
  if (a) return { image: "attachment://" + a.filename, attachments: [{ id: a.id }] };
  const src = proofSource(message);
  return { image: src ? src.url : "", attachments: undefined };
}

// What we need from an existing card to redraw it.
function cardState(message) {
  const e = (message.embeds || [])[0] || {};
  const m = String(e.description || "").match(/Submitted by <@(\d+)>/);
  return {
    submitterId: m ? m[1] : "",
    submittedAt: e.timestamp ? Date.parse(e.timestamp) : Date.now(),
    check: (e.fields || []).find(f => plainName(f.name) === plainName(UI.check)) || null,
    fields: e.fields || []
  };
}

function finalMessage(message, log, state, by, reason, points, statusLabel) {
  const st = cardState(message);
  const kp = keepProof(message);
  const embed = card(log, state, { submitterId: st.submitterId, submittedAt: st.submittedAt, by: by, reason: reason,
                                   check: st.check, points: points, proofImage: kp.image });
  const out = { embeds: [embed], components: [statusRow(statusLabel, state === "approved" ? "✅" : "✖️")], allowed_mentions: NO_PINGS };
  if (kp.attachments) out.attachments = kp.attachments;
  return out;
}

function parseLog(message) {
  const e = (message.embeds || [])[0] || {};
  const text = String(e.description || "");
  if (/^```/.test(text)) {                     // older cards (code-block format)
    const t = text.replace(/^```\n?|\n?```$/g, "");
    const get = (label) => { const m = t.match(new RegExp("^" + label + ": ?(.*)$", "m")); return m ? m[1].trim() : ""; };
    const at = t.search(/^Notes: ?/m);
    const notes = at === -1 ? "" : t.slice(at).replace(/^Notes: ?/, "").trim();
    const list = (s) => (s && s !== "None") ? s.split(",").map(x => x.trim()).filter(Boolean) : [];
    return { event: get("Event"), date: get("Date"), host: get("Host"), supervisor: get("Supervisor"),
             cohosts: list(get("Co-Host")), attendees: list(get("Attendees")), notes: notes === "None" ? "" : notes };
  }
  const f = (label) => (e.fields || []).filter(x => sameField(x.name, label)).map(x => x.value).filter(v => v !== "—").join(", ");
  const list = (s) => s ? s.split(",").map(x => x.trim()).filter(Boolean) : [];
  return {
    event: String(e.title || "").replace(/^📋\s*/, ""),
    doubleAP: /Double AP/.test(f(UI.type)),
    date: f(UI.date), host: f(UI.host), supervisor: f(UI.sup),
    cohosts: list(f(UI.co)), attendees: list(f(UI.att)), notes: f(UI.notes)
  };
}

// Shown on pending logs instead of buttons: approvals happen on the roster.
function pendingRow() {
  return { type: 1, components: [{ type: 2, style: 2, label: "Waiting for approval on the roster", custom_id: "status", disabled: true, emoji: { name: "⏳" } }] };
}

// Denial DM, as a card.
function approvalDm(log, message) {
  const by = ((String(((message.embeds || [])[0] || {}).description || "").match(/Approved\*\* by ([^·\n]+)/) || [])[1] || "").trim();
  const link = `https://discord.com/channels/${CONFIG.GUILD_ID || "@me"}/${CONFIG.APPROVAL_CHANNEL_ID}/${message.id}`;
  return { embeds: [{
    author: { name: CONFIG.NAME }, color: CONFIG.COLOURS.approved,
    title: "Your event log was approved",
    description: `**${log.event}**${log.doubleAP ? " · Double AP" : ""} · ${log.date}` + (by ? `\nApproved by ${by}` : "") +
      `\nThe points have been added to the roster. [View the log](${link})`,
    footer: { text: `${log.attendees.length} attendee${log.attendees.length === 1 ? "" : "s"}` },
    timestamp: new Date().toISOString()
  }] };
}

function denialDm(log, by, reason) {
  return { embeds: [{
    author: { name: CONFIG.NAME }, color: CONFIG.COLOURS.denied,
    title: "Your event log was denied",
    description: `**${log.event}** · ${log.date}\nDenied by ${by}`,
    fields: [{ name: UI.reason, value: (reason || "No reason given").slice(0, 1024) }],
    footer: { text: "Fix it and log it again with /event log" },
    timestamp: new Date().toISOString()
  }] };
}

function row(c) { return { type: 1, components: [c] }; }
function input(id, label, style, required, max, placeholder, value) {
  const c = { type: 4, custom_id: id, label: label, style: style, required: required, max_length: max };
  if (placeholder) c.placeholder = placeholder;
  if (value) c.value = String(value).slice(0, max);
  return c;
}
function modalValues(i) {
  const out = {};
  const take = (c) => { if (c && c.custom_id) out[c.custom_id] = c.values !== undefined ? c.values : c.value; };
  (i.data.components || []).forEach(r => { (r.components || []).forEach(take); take(r.component); });
  return out;
}
function reply(text) { return { type: R.MESSAGE, data: { content: text, flags: EPHEMERAL, allowed_mentions: NO_PINGS } }; }
function user(i) {
  const u = (i.member && i.member.user) || i.user || {};
  return { id: u.id, name: (i.member && i.member.nick) || u.global_name || u.username || "Unknown" };
}
function listValue(names) { const v = names.join("\n"); return (v || "—").slice(0, 1024); }
// A long list split over several fields (each field holds 1024 characters).
function listFields(title, names) {
  const out = [];
  let cur = [];
  names.forEach(n => {
    if ((cur.concat([n]).join("\n")).length > 1000) { out.push(cur); cur = []; }
    cur.push(n);
  });
  if (cur.length || !out.length) out.push(cur);
  return out.slice(0, 6).map((chunk, k) => ({ name: k ? title.replace(/ \(\d+\)$/, "") + " (cont.)" : title, value: listValue(chunk), inline: false }));
}
function uniq(list) {
  const seen = {};
  return list.filter(x => { const k = String(x).toLowerCase(); if (!x || seen[k]) return false; return (seen[k] = true); });
}
function safeName(n) {
  const m = String(n || "").match(/\.(png|jpe?g|gif|webp)$/i);
  return "proof." + (m ? m[1].toLowerCase() : "png");
}

function editReply(env, i, content, embeds) {
  return discord(env, "PATCH", `/webhooks/${CONFIG.APP_ID}/${i.token}/messages/@original`,
    { content: content, embeds: embeds || [], allowed_mentions: NO_PINGS });
}
function editOriginal(env, i, data) {
  return discord(env, "PATCH", `/webhooks/${CONFIG.APP_ID}/${i.token}/messages/@original`, data);
}
function followup(env, i, text) {
  return discord(env, "POST", `/webhooks/${CONFIG.APP_ID}/${i.token}`, { content: text, flags: EPHEMERAL, allowed_mentions: NO_PINGS }).catch(() => {});
}

// ---------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------
// Reaches the roster: through a service binding named ROSTER when there is one
// (needed when the roster is another Worker on this account), else over the internet.
function rosterFetch(env, url, init) {
  let same = false;
  try { same = !!env.ROSTER && new URL(url).host === new URL(env.SHEETS_URL).host; } catch (e) {}
  return same ? env.ROSTER.fetch(new Request(url, init)) : fetch(url, init);
}
async function bridge(env, payload) {
  const res = await rosterFetch(env, env.SHEETS_URL, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(Object.assign({ secret: env.SHEETS_SECRET }, payload)), redirect: "follow"
  });
  const text = await res.text();
  try { return JSON.parse(text); }
  catch (e) { throw new Error("the roster link replied with something unexpected (is SHEETS_URL the site's /api/bot link?)"); }
}

async function download(url, name) {
  let res = null;
  for (let attempt = 0; attempt < 2; attempt++) {           // one retry for a CDN hiccup
    res = await fetch(url, { redirect: "follow" });
    if (res.ok) break;
  }
  if (!res.ok) throw new Error("couldn't read the proof image (" + res.status + ")");
  const type = (res.headers.get("content-type") || "image/png").split(";")[0];
  return { name: safeName(name), type: type, data: await res.arrayBuffer() };
}

// Where the screenshot on an #approval-logs message lives. A file shown
// inside an embed (attachment://) is NOT listed in message.attachments —
// Discord moves it into the embed — so the embed image is checked too.
// Both links are freshly signed every time the message is fetched.
function proofSource(message) {
  const a = (message.attachments || []).find(x => /^image\//.test(x.content_type || "")) || (message.attachments || [])[0];
  if (a) return { url: a.url, name: a.filename, proxy: a.proxy_url || "" };
  for (const e of (message.embeds || [])) {
    const img = e && e.image;
    const url = img && (img.url && /^https:/.test(img.url) ? img.url : img.proxy_url);
    if (url && /^https:/.test(url)) return { url: url, name: (url.split("?")[0].split("/").pop() || "proof.png"),
      proxy: img.proxy_url && /^https:\/\/media\.discordapp\.net\//.test(img.proxy_url) ? img.proxy_url : "" };
  }
  return null;
}

// Checks a roster-made image link (HMAC-SHA256 of the ID with the shared secret).
async function hmacOk(secret, id, sig) {
  if (!id || !sig) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(id)));
  let bin = ""; mac.forEach(b => { bin += String.fromCharCode(b); });
  const want = btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  if (want.length !== sig.length) return false;
  let diff = 0;
  for (let k = 0; k < want.length; k++) diff |= want.charCodeAt(k) ^ sig.charCodeAt(k);
  return diff === 0;
}

// The proof screenshot as a file, for re-uploading. null if none can be found.
async function proofFile(env, message, driveUrl) {
  const src = proofSource(message);
  if (src) {
    try { return await download(src.url, src.name); } catch (e) { /* try Drive */ }
  }
  if (driveUrl) {
    try {
      const f = await download(driveUrl, src ? src.name : "proof.png");
      if (/^image\//.test(f.type)) return f;
    } catch (e) { /* none */ }
  }
  return null;
}

async function discordFiles(env, method, path, payload, files) {
  const form = new FormData();
  form.append("payload_json", JSON.stringify(payload));
  files.forEach((f, k) => form.append(`files[${k}]`, new Blob([f.data], { type: f.type }), f.name));
  const res = await fetch(API + path, { method: method, headers: { "Authorization": "Bot " + env.BOT_TOKEN }, body: form });
  if (!res.ok) throw new Error(`Discord ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

async function discord(env, method, path, body) {
  const res = await fetch(API + path, {
    method: method,
    headers: { "Authorization": "Bot " + env.BOT_TOKEN, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined
  });
  if (!res.ok) throw new Error(`Discord ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res.status === 204 ? null : res.json();
}

async function dm(env, userId, message) {
  try {
    if (!userId) return;
    const ch = await discord(env, "POST", "/users/@me/channels", { recipient_id: userId });
    const body = typeof message === "string" ? { content: message } : message;
    await discord(env, "POST", `/channels/${ch.id}/messages`, Object.assign({ allowed_mentions: NO_PINGS }, body));
  } catch (e) { /* DMs closed: ignore */ }
}

function splitMessage(text, max) {
  const parts = [];
  while (text.length > max) {
    let cut = text.lastIndexOf("\n", max);
    if (cut < max * 0.6) { const c = text.lastIndexOf(", ", max); if (c > 0) cut = c + 1; }
    if (cut <= 0) cut = max;
    parts.push(text.slice(0, cut).trimEnd());
    text = text.slice(cut).replace(/^\s+/, "");
  }
  if (text) parts.push(text);
  return parts;
}
function base64(buf) {
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let k = 0; k < bytes.length; k += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(k, k + 0x8000));
  return btoa(bin);
}
function cleanLine(s, max) { return String(s || "").replace(/\s+/g, " ").trim().slice(0, max); }
function cleanList(s) {
  return uniq(String(s || "").split(/[\n,]+/).map(x => x.trim().replace(/^@/, "").trim()).filter(Boolean)).slice(0, 150);
}
function today() {
  return new Intl.DateTimeFormat("en-GB", { timeZone: CONFIG.TIME_ZONE, day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date());
}
function nowText() {
  return new Intl.DateTimeFormat("en-GB", { timeZone: CONFIG.TIME_ZONE, day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date());
}
function json(obj) { return new Response(JSON.stringify(obj), { headers: { "Content-Type": "application/json" } }); }

async function verify(request, body) {
  const sig = request.headers.get("X-Signature-Ed25519");
  const time = request.headers.get("X-Signature-Timestamp");
  if (!sig || !time) return false;
  const hex = (h) => new Uint8Array(h.match(/.{2}/g).map(b => parseInt(b, 16)));
  const data = new TextEncoder().encode(time + body);
  try {
    const key = await crypto.subtle.importKey("raw", hex(CONFIG.PUBLIC_KEY), { name: "Ed25519" }, false, ["verify"]);
    return await crypto.subtle.verify({ name: "Ed25519" }, key, hex(sig), data);
  } catch (e) {
    const key = await crypto.subtle.importKey("raw", hex(CONFIG.PUBLIC_KEY), { name: "NODE-ED25519", namedCurve: "NODE-ED25519" }, false, ["verify"]);
    return await crypto.subtle.verify({ name: "NODE-ED25519" }, key, hex(sig), data);
  }
}

async function registerCommands(env) {
  const res = await fetch(`${API}/applications/${CONFIG.APP_ID}/commands`, {
    method: "PUT",
    headers: { "Authorization": "Bot " + env.BOT_TOKEN, "Content-Type": "application/json" },
    body: JSON.stringify([
      { name: "lookup", description: "Look someone up on the roster", dm_permission: false,
        options: [{ type: 3, name: "name", description: "Start typing a Discord or Roblox name", required: true, autocomplete: true, max_length: 60 }] }
    ].concat(Object.keys(REQUESTS).filter(k => REQUESTS[k].command).map(k => Object.assign({ name: REQUESTS[k].command, description: REQUESTS[k].description, dm_permission: false },
      REQUESTS[k].options ? { options: REQUESTS[k].options } : {})), COMMUNITY_COMMANDS))
  });
  return new Response(res.ok ? "Done. /lookup, " + Object.keys(REQUESTS).filter(k => REQUESTS[k].command).map(k => "/" + REQUESTS[k].command).join(", ") +
    ", " + COMMUNITY_COMMANDS.map(c => "/" + c.name).join(", ") + " are registered. They can take a minute to appear in Discord." : "Failed: " + (await res.text()), { status: res.ok ? 200 : 500 });
}

// ---------------------------------------------------------------------
// /market: the shop, your points and purchases; buy with a confirm step.
// The roster checks everything again when buying (stock, points, cooldown, Management+, edit freeze).
// ---------------------------------------------------------------------
const mkPoints = (r) => r.infinite ? "∞" : String(r.points || 0);
function marketView(r) {
  const lines = [];
  if (!r.eligible) lines.push(r.reason);
  else lines.push(`You have **${mkPoints(r)}** point${r.points === 1 && !r.infinite ? "" : "s"}` + (r.waitingCost && !r.infinite ? `, ${r.waitingCost} of them in requests waiting for approval.` : "."));
  if (r.frozen) lines.push("Purchases are paused while the roster is frozen for changes.");
  lines.push("");
  (r.items || []).forEach(x => {
    const notes = [];
    if (!x.available) notes.push("unavailable");
    else if (x.cooldownUntil) notes.push(`you can buy again <t:${ts(Date.parse(x.cooldownUntil))}:D>`);
    else if (x.requested) notes.push("request waiting");
    lines.push(`**${x.name}** · ${x.cost} points · ${x.lasts}${x.cooldown ? " · cooldown " + x.cooldown : ""}${isAutoPerk(x.name) ? " · instant" : ""}${notes.length ? ` (${notes.join(", ")})` : ""}` +
      (x.description ? `\n-# ${cleanLine(x.description, 180)}` : ""));
  });
  if (!(r.items || []).length) lines.push("The shop is empty.");
  const fields = [];
  if ((r.waiting || []).length) fields.push({ name: "Waiting for approval", inline: false, value: r.waiting.map(w => `• ${w.item}, ${w.cost} points`).join("\n").slice(0, 1024) });
  if ((r.mine || []).length) fields.push({ name: "Your purchases", inline: false, value: r.mine.map(m =>
    `• ${m.item}, bought <t:${ts(Date.parse(m.bought))}:D>` + (m.ends ? ` · active until <t:${ts(Date.parse(m.ends))}:D>` : "") +
    (m.cooldownEnds ? ` · cooldown until <t:${ts(Date.parse(m.cooldownEnds))}:D>` : "")).join("\n").slice(0, 1024) });
  const canBuy = r.eligible && !r.frozen ? (r.items || []).filter(x => x.available && !x.cooldownUntil && !x.requested && (r.infinite || (r.points || 0) - (r.waitingCost || 0) >= x.cost)) : [];
  const components = canBuy.length ? [{ type: 1, components: [{ type: 3, custom_id: "mk:pick", placeholder: "Choose an item to request",
    options: canBuy.slice(0, 25).map(x => ({ label: x.name.slice(0, 100), value: x.name.slice(0, 100), description: (x.cost + " points · " + x.lasts + (isAutoPerk(x.name) ? " · instant" : " · needs approval")).slice(0, 100) })) }] }] : [];
  if (r.eligible && !r.frozen && !canBuy.length && (r.items || []).length) lines.push("", "-# Nothing you can request right now: not enough points, unavailable, on cooldown or already requested.");
  if ((r.items || []).some(x => isAutoPerk(x.name))) lines.push("", "-# **Instant** perks are Discord roles: you get them straight away. Everything else is approved by DMO first, and points are only taken once it's approved.");
  return { content: "", embeds: [{ author: { name: CONFIG.NAME }, color: CONFIG.COLOURS.info, title: "Market", description: lines.join("\n").slice(0, 4000),
    fields, footer: { text: "Only you can see this" } }], components, allowed_mentions: NO_PINGS };
}
async function marketInfoFor(env, i) {
  const u = caller(i);
  return bridge(env, { action: "marketInfo", byId: u.id, byName: u.username || "" });
}
async function marketCommand(env, i) {
  try {
    if (!linked(env)) return editReply(env, i, "The roster isn't linked yet.");
    const r = await marketInfoFor(env, i);
    if (!r.ok) throw new Error(r.error || "the roster didn't answer");
    if (!r.person) return editReply(env, i, r.error || "You aren't on the roster under your Discord name.");
    await editOriginal(env, i, marketView(r));
  } catch (err) {
    await editReply(env, i, "Couldn't open the Market: " + err.message).catch(() => {});
  }
}
// ---- Instant Market perks (CONFIG.MARKET_AUTO_ROLES): a Discord role, given straight away ----
const perkKey = n => String(n || "").toLowerCase().replace(/permissions?|perms?\b/g, "perm").replace(/[^a-z0-9]/g, "");
const perkNames = e => [].concat(e).map(String);                       // a perk's names (one, or a list)
const perkHas = (e, name) => { const k = perkKey(name); return !!k && perkNames(e).some(n => perkKey(n) === k); };
function isAutoPerk(itemName) { return (CONFIG.MARKET_AUTO_ROLES || []).some(e => perkHas(e, itemName)); }
/** The server role for an instant perk → { role } or { error }. */
async function perkRole(env, itemName) {
  const want = (CONFIG.MARKET_AUTO_ROLES || []).find(e => perkHas(e, itemName));
  if (!want || !CONFIG.GUILD_ID) return { error: "not an instant perk" };
  const roles = await discord(env, "GET", `/guilds/${CONFIG.GUILD_ID}/roles`);
  const role = roles.find(r => perkHas(want, r.name));
  if (!role) return { error: `There's no **${perkNames(want).join("** or **")}** role in the server.` };
  const me = await discord(env, "GET", `/guilds/${CONFIG.GUILD_ID}/members/${CONFIG.APP_ID}`).catch(() => null);
  const pos = {}; roles.forEach(r => { pos[r.id] = r.position; });
  const top = me && me.roles && me.roles.length ? Math.max(...me.roles.map(id => pos[id] || 0)) : Infinity;
  if (role.position >= top) return { error: `The **${role.name}** role is above the bot's role, so the bot can't give it.` };
  return { role };
}
async function marketInstant(env, i, u, chk, fail) {
  const staffNote = " Nothing was taken. Let DMO know.";
  const pr = await perkRole(env, chk.item).catch(e => ({ error: e.message }));
  if (pr.error) return fail(pr.error + staffNote);
  const member = await discord(env, "GET", `/guilds/${CONFIG.GUILD_ID}/members/${u.id}`).catch(() => null);
  if (!member) return fail("You need to be in the server to get this perk.");
  // Already have it (given by hand, or bought earlier): buying it wouldn't add anything, and its end date would take the role away.
  if ((member.roles || []).includes(pr.role.id)) return fail(`You already have the **${pr.role.name}** role, so there's nothing to buy.`);
  const reason = encodeURIComponent(`Market purchase: ${chk.item}`);
  const roleUrl = `/guilds/${CONFIG.GUILD_ID}/members/${u.id}/roles/${pr.role.id}`;
  const give = await fetch(API + roleUrl, { method: "PUT", headers: { Authorization: "Bot " + env.BOT_TOKEN, "X-Audit-Log-Reason": reason } });
  if (!give.ok) return fail(`Couldn't give you the **${pr.role.name}** role (Discord ${give.status}).` + staffNote);
  const res = await bridge(env, { action: "marketBuy", auto: true, item: chk.item, byId: u.id, byName: u.username || "" }).catch(e => ({ ok: false, error: e.message }));
  if (!res.ok) {                                           // not recorded: take the role back, nothing was spent
    await fetch(API + roleUrl, { method: "DELETE", headers: { Authorization: "Bot " + env.BOT_TOKEN, "X-Audit-Log-Reason": encodeURIComponent("Market purchase failed") } }).catch(() => {});
    return fail(res.error);
  }
  if (res.ends) {                                          // taken off again by the 5-minute job when it runs out
    const list = await kvGet(env, "state:perks", []) || [];
    list.push({ uid: u.id, rid: pr.role.id, item: res.item, ends: res.ends });
    await kvPut(env, "state:perks", list);
  }
  // A record in the Market channel, like the requests (no buttons: nothing to decide).
  const content = ["**Market Purchase** (instant)", `Discord Username: ${u.username} (<@${u.id}>)`, `Roblox Username: ${chk.roblox || "—"}`,
    `Item: ${res.item}`, `Cost: ${res.cost} points` + (res.infinite ? "" : ` (${res.after} left)`), `Lasts: ${chk.lasts}` + (res.ends ? ` · until <t:${ts(Date.parse(res.ends))}:D>` : "")].join("\n");
  await discord(env, "POST", `/channels/${requestChannel("market")}/messages`, { content, allowed_mentions: NO_PINGS,
    components: [statusRow(`Bought · ${pr.role.name} role given`, "✅")] }).catch(() => {});
  return editOriginal(env, i, { content: "", allowed_mentions: NO_PINGS, embeds: [{ author: { name: CONFIG.NAME }, color: CONFIG.COLOURS.approved,
    title: "Perk bought", description: `You now have the **${pr.role.name}** role.` + (res.ends ? ` It lasts until <t:${ts(Date.parse(res.ends))}:F>.` : " It's permanent."),
    fields: [{ name: "Cost", value: res.cost + " points", inline: true }, { name: "Points left", value: res.infinite ? "∞" : String(res.after), inline: true }]
      .concat(res.cooldownEnds ? [{ name: "Buy again from", value: `<t:${ts(Date.parse(res.cooldownEnds))}:D>`, inline: true }] : []),
    footer: { text: "Only you can see this" } }],
    components: [{ type: 1, components: [{ type: 2, style: 2, label: "Back to the Market", custom_id: "mk:back" }] }] });
}
/** 5-minute job: take instant-perk roles off once they've run out. */
async function cronPerks(env, now) {
  const list = await kvGet(env, "state:perks", []) || [];
  if (!list.length) return "";
  const keep = [], done = [];
  for (const p of list) {
    if (Date.parse(p.ends) > now) { keep.push(p); continue; }
    const res = await fetch(API + `/guilds/${CONFIG.GUILD_ID}/members/${p.uid}/roles/${p.rid}`, { method: "DELETE",
      headers: { Authorization: "Bot " + env.BOT_TOKEN, "X-Audit-Log-Reason": encodeURIComponent(`Market perk ended: ${p.item}`) } }).catch(() => null);
    if (res && (res.ok || res.status === 404)) done.push(p.item);     // 404: they left the server or the role's gone
    else keep.push(p);                                                  // try again next time
  }
  if (done.length) { await kvPut(env, "state:perks", keep); return "removed " + done.length + " ended perk role(s)"; }
  return "";
}

async function marketComponent(env, i) {
  const id = i.data.custom_id;
  try {
    if (id === "mk:back") {
      const r = await marketInfoFor(env, i);
      if (!r.ok || !r.person) throw new Error(r.error || "the roster didn't answer");
      return editOriginal(env, i, marketView(r));
    }
    if (id === "mk:pick") {
      const name = ((i.data.values || [])[0] || "").trim();
      const r = await marketInfoFor(env, i);
      if (!r.ok || !r.person) throw new Error(r.error || "the roster didn't answer");
      const x = (r.items || []).find(it => it.name.slice(0, 100) === name);
      if (!x) return editOriginal(env, i, Object.assign(marketView(r), { content: "That item isn't in the shop any more." }));
      const after = r.infinite ? "∞" : String((r.points || 0) - (r.waitingCost || 0) - x.cost);
      const instant = isAutoPerk(x.name);
      return editOriginal(env, i, { content: "", allowed_mentions: NO_PINGS, embeds: [{ author: { name: CONFIG.NAME }, color: CONFIG.COLOURS.draft, title: instant ? "Buy this perk?" : "Request this purchase?",
        description: x.description ? cleanLine(x.description, 1000) : "",
        fields: [{ name: "Item", value: x.name, inline: true }, { name: "Cost", value: x.cost + " points", inline: true },
          { name: instant ? "Points after" : "Points after approval", value: after, inline: true }, { name: "Lasts", value: x.lasts, inline: true },
          { name: "Cooldown", value: x.cooldown || "None", inline: true }],
        footer: { text: instant ? "Instant: the points are taken and you get the role straight away." : "Needs DMO approval: after requesting, open a Misc ticket in #support-line. Points are only taken once it's approved." } }],
        components: [{ type: 1, components: [{ type: 2, style: 3, label: instant ? "Buy now" : "Request purchase", custom_id: "mk:buy" }, { type: 2, style: 2, label: "Back", custom_id: "mk:back" }] }] });
    }
    if (id === "mk:buy") {
      // Sent for approval: nothing is taken until DMO approve it (here or on the roster's Approvals page).
      const e = (i.message.embeds || [])[0] || {};
      const item = ((e.fields || []).find(f => f.name === "Item") || {}).value || "";
      const u = caller(i);
      const fail = (msg) => editOriginal(env, i, { content: "", allowed_mentions: NO_PINGS, embeds: [{ author: { name: CONFIG.NAME }, color: CONFIG.COLOURS.denied,
        title: isAutoPerk(item) ? "Not bought" : "Request not sent", description: msg || "The roster didn't answer." }],
        components: [{ type: 1, components: [{ type: 2, style: 2, label: "Back to the Market", custom_id: "mk:back" }] }] });
      const chk = await bridge(env, { action: "marketCheck", byId: u.id, byName: u.username || "", item });
      if (!chk.ok) return fail(chk.error);
      if (isAutoPerk(chk.item)) return marketInstant(env, i, u, chk, fail);
      const content = ["**Market Purchase**", `Discord Username: ${u.username} (<@${u.id}>)`, `Roblox Username: ${chk.roblox || "—"}`,
        `Item: ${chk.item}`, `Cost: ${chk.cost} points`, `Points: ${chk.infinite ? "∞" : chk.points + (chk.spoken ? ` (${chk.spoken} already requested)` : "")}`,
        `Lasts: ${chk.lasts}` + (chk.cooldown ? ` · Cooldown: ${chk.cooldown}` : "")].join("\n");
      const msg = await discord(env, "POST", `/channels/${requestChannel("market")}/messages`, { content, allowed_mentions: NO_PINGS, components: [decisionRow("market", env)] });
      const q = await bridge(env, { action: "request", id: "market-" + msg.id, title: "Market Purchase", details: { item: chk.item },
        submittedBy: callerName(i), submittedById: u.id, byName: u.username || "" }).catch(err => ({ ok: false, error: err.message }));
      if (!q.ok) {
        await discord(env, "DELETE", `/channels/${requestChannel("market")}/messages/${msg.id}`).catch(() => {});
        return fail(q.error);
      }
      return editOriginal(env, i, { content: "", allowed_mentions: NO_PINGS, embeds: [{ author: { name: CONFIG.NAME }, color: CONFIG.COLOURS.approved,
        title: "Purchase requested", description: `**${chk.item}** for ${chk.cost} points.\n\n` +
          (CONFIG.MARKET_TICKET_CHANNEL_ID ? `**Next step:** open a **Misc** ticket in <#${CONFIG.MARKET_TICKET_CHANNEL_ID}> so DMO can sort out your purchase.\n\n` : "") +
          "Points are only taken once it's approved, and you'll get a DM with the outcome.", footer: { text: "Only you can see this" } }], components: [] });
    }
  } catch (err) {
    await followup(env, i, "Couldn't do that: " + err.message);
  }
}

// ---------------------------------------------------------------------
// Weekly self-test (Sundays 18:00 UTC, from the 5-minute job). Checks every link the bot depends on without
// changing real data, and posts a report: every week in SELFTEST_CHANNEL_ID if set, otherwise only when
// something is wrong (in the approval-logs channel). Run it any time: /selftest?key=REGISTER_KEY.
// ---------------------------------------------------------------------
async function selfTest(env) {
  const checks = [], facts = [];
  const add = (name, state, detail, fix) => checks.push({ name, state, detail: String(detail || ""), fix: fix || "" });   // state: ok | warn | fail
  const tryStep = async (name, fn) => { try { await fn(); } catch (e) { add(name, "fail", e.message || e); } };
  const ago = iso => iso ? Math.round((Date.now() - Date.parse(iso)) / 60000) : null;

  // 1. settings
  const missing = ["BOT_TOKEN", "SHEETS_SECRET", "SHEETS_URL", "HQ_URL", "REGISTER_KEY"].filter(k => !env[k]);
  if (!env.BOT_KV) missing.push("BOT_KV (KV binding)");
  if (!CONFIG.GUILD_ID) missing.push("GUILD_ID");
  add("Bot settings", missing.length ? "fail" : "ok", missing.length ? "missing: " + missing.join(", ") : "all set");

  // 2. bot → website (+ shared secret)
  let names = 0;
  await tryStep("Bot to website", async () => {
    const r = await bridge(env, { action: "names" });
    if (!r.ok) throw new Error(/Not allowed/i.test(r.error || "") ? "the website refused the shared secret (SHEETS_SECRET)" : r.error);
    names = (r.people || []).length;
    add("Bot to website", names ? "ok" : "warn", names ? names + (names === 1 ? " person" : " people") + " on the roster" : "the roster came back empty");
    if (names) facts.push("Roster: " + names);
  });
  await tryStep("Public HQ pages", async () => {
    const ev = await hq(env, "events", null, true);
    { const n = hqEvents(ev).length; add("Public HQ pages", "ok", n + " upcoming event" + (n === 1 ? "" : "s")); }
  });

  // 3. website: database, approvals, jobs, and website → bot
  let site = null;
  await tryStep("Website self-check", async () => {
    site = await bridge(env, { action: "selfTest", nonce: String(Date.now()) });
    if (!site.ok) throw new Error(site.error || "no answer");
  });
  if (site && site.ok) {
    add("Database", site.db && site.db.ok ? "ok" : "fail", site.db && site.db.ok ? "read and write work" : (site.db && site.db.error) || "write check failed");
    const p = site.botPing || {};
    add("Website to bot", p.ok ? "ok" : "fail", p.ok ? "reached in " + p.ms + " ms (" + p.via + ")" : (p.error || "no answer"));
    if (p.ok) facts.push("Website response: " + p.ms + " ms");
    const q = site.queue || {};
    const qProblems = [];
    const reqs = k => k + (k === 1 ? " request has" : " requests have");
    if (q.stuck) qProblems.push(reqs(q.stuck) + " been stuck in Processing for over 10 minutes");
    if (q.approvedWaiting) qProblems.push(reqs(q.approvedWaiting) + " been approved but not carried out after 15 minutes");
    if (q.errors) qProblems.push(q.errors + (q.errors === 1 ? " request is" : " requests are") + " in Error");
    if (q.pendingOld) qProblems.push(reqs(q.pendingOld) + " been waiting more than 24 hours");
    add("Approvals queue", q.stuck || q.approvedWaiting ? "fail" : qProblems.length ? "warn" : "ok", qProblems.length ? qProblems.join("; ") : (q.pending || 0) + " waiting, nothing stuck",
      [q.stuck || q.approvedWaiting || q.errors ? "On the website's Approvals page, open the requests in Processing or Error and press Retry, and check approvals aren't paused in Settings" : "",
       q.pendingOld ? "Decide the requests waiting longest on the Approvals page" : ""].filter(Boolean).join(". "));
    facts.push("Awaiting approval: " + (q.pending || 0));
    const st = site.settings || {};
    if (st.approvalsPaused || st.frozen) add("Roster settings", "warn", [st.approvalsPaused && "approvals are paused", st.frozen && "the roster is frozen for changes"].filter(Boolean).join("; "));
    const j = site.jobs || {}, aj = ago(j.approvals), dj = ago(j.daily);
    add("Website background jobs", aj === null || aj > 120 || dj === null || dj > 26 * 60 ? "warn" : "ok",
      `approvals job ${aj === null ? "never ran" : aj + " min ago"}, daily job ${dj === null ? "never ran" : Math.round(dj / 60) + " h ago"}`);
  }

  // 4. Discord: channels, roles, commands
  const chans = [["approval-logs", CONFIG.APPROVAL_CHANNEL_ID], ["event logs", CONFIG.EVENT_LOG_CHANNEL_ID], ["events", CONFIG.EVENTS_CHANNEL_ID],
    ["requests", CONFIG.REQUEST_CHANNEL_ID], ["Market requests", CONFIG.MARKET_LOG_CHANNEL_ID], ["self-test", CONFIG.SELFTEST_CHANNEL_ID]]
    .concat(Object.keys(CONFIG.REQUEST_CHANNELS || {}).map(k => [k + " requests", CONFIG.REQUEST_CHANNELS[k]])).filter(([, id]) => id);
  const badChans = [];
  for (const [label, id] of chans) { try { await discord(env, "GET", `/channels/${id}`); } catch (e) { badChans.push(label + " (" + (/403|404/.exec(e.message) || ["error"])[0] + ")"); } }
  add("Discord channels", badChans.length ? "fail" : "ok", badChans.length ? "can't reach: " + badChans.join(", ") : chans.length + " channels reachable");
  if (CONFIG.GUILD_ID) await tryStep("Discord roles", async () => {
    const plan = await rolePlan(env, await hqRosterByEmp(env, true).catch(() => ({})), true);
    const n = Object.keys(plan.managed).length;
    if (plan.tooHigh.length) add("Discord roles", "fail", plan.tooHigh.length + " roles are above the bot's role, so it can't give them: " + plan.tooHigh.slice(0, 8).join(", "));
    else add("Discord roles", n ? "ok" : "warn", n ? n + " roles managed, none above the bot" : "no server roles match the roster");
    if (n) facts.push("Roles managed: " + n);
  });
  if (CONFIG.GUILD_ID && (CONFIG.MARKET_AUTO_ROLES || []).length) await tryStep("Instant Market perks", async () => {
    const shop = await hq(env, "market", null, true).catch(() => null);
    const items = ((shop && (shop.shop || shop.items)) || []).map(x => x.name || "");
    const bad = [];
    for (const e of CONFIG.MARKET_AUTO_ROLES) {
      const n = perkNames(e)[0];
      const pr = await perkRole(env, n).catch(e => ({ error: e.message }));
      if (pr.error) bad.push(pr.error.replace(/\*\*/g, "").replace(/\.$/, ""));
      if (items.length && !items.some(x => perkHas(e, x))) bad.push(`no shop item called ${perkNames(e).join(" or ")}`);
    }
    add("Instant Market perks", bad.length ? "warn" : "ok", bad.length ? bad.join("; ") : CONFIG.MARKET_AUTO_ROLES.length + " perks matched to roles");
  });
  await tryStep("Slash commands", async () => {
    const want = ["lookup"].concat(Object.keys(REQUESTS).filter(k => REQUESTS[k].command).map(k => REQUESTS[k].command), COMMUNITY_COMMANDS.map(c => c.name));
    const have = (await discord(env, "GET", `/applications/${CONFIG.APP_ID}/commands`)).map(c => c.name);
    const gone = want.filter(n => have.indexOf(n) === -1);
    add("Slash commands", gone.length ? "warn" : "ok", gone.length ? "not registered: /" + gone.join(", /") : want.length + " registered");
  });

  // 5. role updates over the last week
  // Newest first; only failures since the last successful update count (older ones have been fixed since).
  const recent = (await kvGet(env, "state:lastroles", []) || []).filter(x => Date.now() - Date.parse(x.at) < 7 * 86400000);
  const lastOk = recent.findIndex(x => !/^ERROR/.test(x.result));
  const errs = (lastOk === -1 ? recent : recent.slice(0, lastOk)).filter(x => /^ERROR/.test(x.result));
  add("Role updates", errs.length ? "warn" : "ok", errs.length
    ? errs.length + (errs.length === 1 ? " failure" : " failures") + " since the last successful update, latest: " + errs[0].result.replace(/^ERROR: /, "")
    : recent.length ? "working; the latest update succeeded" : "none this week");

  return { at: new Date().toISOString(), checks, facts, fails: checks.filter(c => c.state === "fail").length, warns: checks.filter(c => c.state === "warn").length };
}
const sentence = s => { s = String(s || "").trim(); return s ? s.charAt(0).toUpperCase() + s.slice(1) + (/[.!?]$/.test(s) ? "" : ".") : ""; };
// What each check covers: its group in the report, what breaks when it fails, and the usual fix.
const SELFTEST_GUIDE = {
  "Bot settings":            ["Connections", "The bot can't start parts of its work without these.", "Add the missing values in Cloudflare: dmo-bot ▸ Settings ▸ Variables and secrets (KV and IDs in wrangler.toml / CONFIG)."],
  "Bot to website":          ["Connections", "Lookups, logs and requests made in Discord fail.", "Check SHEETS_URL in wrangler.toml is https://<site>/api/bot, and that SHEETS_SECRET matches the website's APPROVAL_SECRET."],
  "Public HQ pages":         ["Connections", "/events and HQ-based lookups fail.", "Check HQ_URL in wrangler.toml is https://<site>/api/public and that the site's latest deployment succeeded."],
  "Website self-check":      ["Connections", "The database, approvals and website jobs couldn't be checked.", "Check the latest deployment and its logs on the Pages project (rna-hq)."],
  "Website to bot":          ["Connections", "Decisions made on the website don't update Discord, give roles or send DMs.", "On the Pages project, check the BOT_URL variable and the BOT service binding, then retry the latest deployment."],
  "Database":                ["Website", "Nothing can be saved to the roster.", "Check the DB binding on the Pages project and the D1 database \"hq\" in Cloudflare."],
  "Roster settings":         ["Website", "Approved requests aren't carried out while this is on.", "Turn it off in the website's Settings when ready."],
  "Website background jobs": ["Website", "Approved requests and daily updates are delayed.", "Jobs run when the site gets traffic: open the site and the Approvals page. If this stays, check the Pages logs."],
  "Approvals queue":         ["Approvals and roles", "Members are left waiting for points, awards, LOAs or roster changes.", "Decide the oldest requests on the website's Approvals page."],
  "Role updates":            ["Approvals and roles", "Some members may have missing or out-of-date roles.", "Check the error shown. Most often the member isn't linked yet or a role sits above the bot's role."],
  "Discord channels":        ["Discord", "Logs, requests or reports can't be posted there.", "Give the bot View Channel and Send Messages in those channels, or correct the channel IDs in CONFIG."],
  "Discord roles":           ["Discord", "Those roles can't be given or removed.", "Server Settings ▸ Roles: drag the bot's role above them."],
  "Instant Market perks":    ["Discord", "Those perks can't be bought instantly; purchases fail until fixed.", "Make the shop item and the server role names match the bot's list (MARKET_AUTO_ROLES), and keep the roles below the bot's role."],
  "Slash commands":          ["Discord", "Members can't use the missing commands.", "Open /register?key=REGISTER_KEY on the bot once."],
};
const SELFTEST_GROUPS = ["Connections", "Website", "Approvals and roles", "Discord"];
const SELFTEST_STATE = { fail: ["🔴", "Critical", "Not working"], warn: ["🟡", "Warning", "Needs attention"], ok: ["🟢", "OK", "Operational"] };
function selfTestOverall(r) {
  const n = (k, w) => k + " " + w + (k === 1 ? "" : "s");
  if (r.fails) return { icon: "🔴", line: "Service disruption", sub: n(r.fails, "critical issue") + (r.warns ? " and " + n(r.warns, "warning") : "") };
  if (r.warns) return { icon: "🟡", line: "Operational, with warnings", sub: n(r.warns, "item") + " to review" };
  return { icon: "🟢", line: "All systems operational", sub: "No action needed" };
}
function selfTestSummary(r) { const o = selfTestOverall(r); return o.line + ": " + o.sub + "."; }
/** Problems first (critical, then warnings), each with what it affects and how to fix it. */
function selfTestActions(r) {
  return r.checks.filter(c => c.state !== "ok").sort((a, b) => (a.state === "fail" ? 0 : 1) - (b.state === "fail" ? 0 : 1))
    .map(c => { const g = SELFTEST_GUIDE[c.name] || []; return { name: c.name, state: c.state, issue: sentence(c.detail), impact: g[1] || "", fix: sentence(c.fix || g[2] || "") }; });
}
function selfTestGroups(r) {
  const groups = SELFTEST_GROUPS.map(g => ({ name: g, checks: [] })), other = { name: "Other", checks: [] };
  r.checks.forEach(c => { const g = groups.find(x => x.name === (SELFTEST_GUIDE[c.name] || [])[0]) || other; g.checks.push(c); });
  return groups.concat(other).filter(g => g.checks.length);
}
function nextSelfTest(iso) {
  const d = new Date(iso); d.setUTCHours(18, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + ((7 - d.getUTCDay()) % 7 || (Date.parse(iso) >= d.getTime() ? 7 : 0)));
  return d;
}
const fmtDay = d => d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
function selfTestText(r) {
  const o = selfTestOverall(r), acts = selfTestActions(r), L = [];
  L.push("SYSTEM HEALTH REPORT", fmtDay(new Date(r.at)) + ", " + r.at.slice(11, 16) + " UTC", "",
    "Overall status: " + o.line + " (" + o.sub + ")", r.checks.length + " checks: " + (r.checks.length - r.fails - r.warns) + " OK, " + r.warns + " warning, " + r.fails + " critical", "");
  if (acts.length) {
    L.push("ACTION REQUIRED");
    acts.forEach((a, i) => L.push((i + 1) + ". [" + SELFTEST_STATE[a.state][1] + "] " + a.name, "   Issue:  " + a.issue, "   Impact: " + a.impact, "   Fix:    " + a.fix, ""));
  }
  L.push("COMPONENT STATUS");
  selfTestGroups(r).forEach(g => { L.push(g.name); g.checks.forEach(c => L.push("  " + SELFTEST_STATE[c.state][2].padEnd(16) + c.name + (c.state === "ok" ? " — " + c.detail : ""))); });
  if ((r.facts || []).length) L.push("", "KEY FIGURES", r.facts.join(" · "));
  L.push("", "Next scheduled check: " + fmtDay(nextSelfTest(r.at)) + ", 18:00 UTC");
  return L.join("\n");
}
async function postSelfTest(env, r, always) {
  const channel = CONFIG.SELFTEST_CHANNEL_ID || ((r.fails || r.warns) ? CONFIG.APPROVAL_CHANNEL_ID : "");
  if (!channel || (!always && !CONFIG.SELFTEST_CHANNEL_ID && !r.fails && !r.warns)) return;
  const o = selfTestOverall(r), acts = selfTestActions(r), cut = (t, n) => t.length > n ? t.slice(0, n - 1) + "…" : t;
  const desc = ["## " + o.icon + " " + o.line, o.sub + " · " + r.checks.length + " checks run", ""];
  if (acts.length) {
    desc.push("### Action required");
    acts.forEach((a, i) => desc.push("**" + (i + 1) + ". " + a.name + "** · " + SELFTEST_STATE[a.state][0] + " " + SELFTEST_STATE[a.state][1],
      "> **Issue:** " + a.issue, "> **Impact:** " + a.impact, "> **Fix:** " + a.fix, ""));
  }
  desc.push("### Component status");
  const fields = selfTestGroups(r).map(g => ({ name: g.name, inline: true,
    value: cut(g.checks.map(c => SELFTEST_STATE[c.state][0] + " " + c.name).join("\n"), 1024) }));
  // Two columns: a blank field after every second group.
  const laid = [];
  fields.forEach((f, i) => { laid.push(f); if (i % 2 === 1 && i < fields.length - 1) laid.push({ name: "​", value: "​", inline: false }); });
  if ((r.facts || []).length) laid.push({ name: "Key figures", value: cut(r.facts.join(" · "), 1024), inline: false });
  await discord(env, "POST", `/channels/${channel}/messages`, { allowed_mentions: NO_PINGS, embeds: [{
    author: { name: CONFIG.NAME + " · Automated monitoring" }, color: r.fails ? CONFIG.COLOURS.denied : r.warns ? CONFIG.COLOURS.pending : CONFIG.COLOURS.approved,
    title: "Weekly System Health Report", description: cut(desc.join("\n").trim(), 4000), fields: laid.slice(0, 25),
    footer: { text: "🟢 Operational  🟡 Warning  🔴 Critical · Next check " + fmtDay(nextSelfTest(r.at)) + ", 18:00 UTC" }, timestamp: r.at }] });
}
async function cronSelfTest(env, now) {
  const d = new Date(now);
  if (d.getUTCDay() !== 0 || d.getUTCHours() < 18 || !env.BOT_KV) return "";
  const last = await kvGet(env, "state:selftest", 0);
  if (now - (Number(last) || 0) < 5 * 86400000) return "";
  await kvPut(env, "state:selftest", now);
  const r = await selfTest(env);
  await postSelfTest(env, r, false);
  return selfTestSummary(r);
}
