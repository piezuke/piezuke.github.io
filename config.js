const CONFIG = {
  /* ------------------------------ SITE ------------------------------ */
  site: {
    brand: "PIEzuke", // navbar logo text, also used as avatar alt text
    name: "piezuke", // short name shown in tab titles
    language: "en", // <html lang>
    description: "CTF writeups, projects, notes, etc...", // meta + social cards
    titleTemplate: "{page} — {site}", // tab title for inner pages
    avatar: { webp: "media/pfp.webp", jpg: "media/pfp.jpg" }, // profile picture
    favicon: "media/pfp.webp",
    ogImage: "media/pfp.jpg", // social share image
    themeColors: { dark: "#050505", light: "#f6f6f6" }, // mobile browser bar colour
  },

  /* ------------------- ROUTES  (URL slugs of each page) ------------------- */
  routes: {
    home: "/",
    writeups: "/writeups",
    projects: "/projects",
    notes: "/notes",
    timeline: "/timeline",
    about: "/me",
    // old addresses that should keep working:  { "old-slug": "page key" }
    redirects: { story: "timeline", about: "about" },
  },

  /* ------------------------------- NAV ------------------------------- */
  nav: {
    homeLabel: "Home", // screen-reader label of the logo link
    menuTitle: "Menu", // hamburger button (phones)
    menuLabel: "Toggle navigation menu",
    links: [
      { label: "Home", page: "home" },
      { label: "CTF Writeups", page: "writeups" },
      { label: "Projects", page: "projects" },
      { label: "Notes", page: "notes" },
      { label: "Timeline", page: "timeline" },
      { label: "Me", page: "about" },
    ],
  },

  /* -------------------------- SHARED UI LABELS -------------------------- */
  ui: {
    arrow: "↗",
    renderError: "Render Error",

    search: {
      key: "⌘",
      buttonText: "search everything",
      buttonTitle: "Command palette (Ctrl/⌘ K)",
      buttonLabel: "Search everything",
      dialogLabel: "Command palette",
      placeholder: "Search writeups, projects, notes...",
      empty: 'No matches for "{query}"',
      hintNavigate: "navigate",
      hintOpen: "open",
      hintClose: "close",
      tags: {
        page: "page",
        writeup: "writeup",
        project: "project",
        note: "note",
      },
    },

    loader: {
      initial: "Connecting to PIE's Archives...",
      labels: [
        "bluh bluh bluh bluh....",
        "buh buh buh buh....",
        "fweh fweh fweh fweh....",
        "pluh{0MG_pr0ud_0f_y0u_wh0ever_y0ur}",
      ],
    },

    theme: {
      label: "Dark mode",
      title: "Toggle theme",
      toLight: "Switch to light mode",
      toDark: "Switch to dark mode",
    },

    rain: {
      title: "Toggle storm",
      label: "Toggle weather",
      on: "Rain: on",
      off: "Rain: off",
    },

    backToTop: {
      top: "Back to top [Shamelessly copied from meen]",
      bottom: "Scroll to bottom [Shamelessly copied from meen]",
      label: "Scroll to top or bottom",
    },

    code: { copy: "copy", copied: "copied ✓", label: "Copy code to clipboard" },

    miniPlayer: {
      label: "Audio player",
      linkTitle: "View in playlist",
      idleTitle: "Track 01",
      playTitle: "Play / Pause",
      playLabel: "Play or pause audio",
      nextTitle: "Skip to next track",
      nextLabel: "Skip to next track",
    },
  },

  /* ------------------------------ FOOTER ------------------------------ */
  footer: {
    quip: "Coffee Waaaay better than tea. Ainnobody tellin me otherwise.",
    text: "© {year} piezuke. All rights reserved.",
  },

  /* ------------------------------ PAGES ------------------------------ */
  pages: {
    /* ---- HOME ---- */
    home: {
      title: "pieBlog",
      hero: {
        status: "",
        title: "PIEzuke",
        avatarAlt: "PIEzuke",
        roles: [
          "Exploiting binaries",
          "I use Arch btw",
          "CTF player @ teambi0s",
          "Music composition",
        ],
        subtitle:
          "CS student who likes making binaries misbehave. CTF writeups, projects and half-organised notes live here.",
        chips: [], // floating badges around the avatar (max 3)
      },
      // style: "solid" | "outline" | "ghost".  Use `page` or `url`.
      buttons: [
        { label: "Read writeups →", page: "writeups", style: "outline" },
        { label: "View projects →", page: "projects", style: "outline" },
        { label: "About me", page: "about", style: "solid" },
      ],
      explore: {
        heading: "Explore",
        cards: [
          {
            page: "writeups",
            title: "CTF Writeups",
            text: "Some writeups for various interesting CTF challs",
            count: "{n} entries",
            countOne: "{n} entry",
          },
          {
            page: "projects",
            title: "My Creations",
            text: "Some of the stuff I made",
            count: "{n} entries",
            countOne: "{n} entry",
          },
          {
            page: "notes",
            title: "Notes",
            text: "My notes. Mainly on PWN.",
            count: "{n} notes",
            countOne: "{n} note",
          },
          {
            page: "timeline",
            title: "Timeline",
            text: "My history, My story, Mystory, Mystery, Iam the Mystery. sry not sry.",
            count: "{n} entries",
            countOne: "{n} entry",
          },
        ],
      },
      latest: {
        count: 3, // how many recent items to show per block
        writeups: {
          show: true,
          heading: "Latest Writeups",
          viewAll: "view all →",
          empty: [
            {
              title: "nothing here yet",
              text: "the first writeup is still in my imaginations",
            },
            {
              title: "coming soon",
              text: "check back later, or peek at the notes in the meantime, which is also prolly empty",
            },
          ],
        },
        projects: {
          show: true,
          heading: "Latest Projects",
          viewAll: "view all →",
          empty: [
            {
              title: "nothing here yet",
              text: "the first project hasnt been pushed js yet :b",
            },
            {
              title: "coming soon",
              text: "check back later maybeb",
            },
          ],
        },
      },
    },

    /* ---- WRITEUPS (list page) ---- */
    writeups: {
      title: "pieBlog - Writeups",
      heading: "Latest Writeups",
      subtitle:
        "Some CTF challenges or problems I solved which felt worth documenting.",
      entries: "{n} entries",
      entriesOne: "{n} entry",
      filterAll: "all",
      noMatch: "Nothing matches that tag.",
      empty: "No writeups published yet. Check back soon.",
      backLabel: "← back to writeups",
    },

    /* ---- PROJECTS (list page) ---- */
    projects: {
      title: "Projects",
      heading: "Latest Projects",
      subtitle: "Some stuff i built on a whim and not on a whim too ig",
      entries: "{n} entries",
      entriesOne: "{n} entry",
      filterAll: "all",
      noMatch: "Nothing matches that tag.",
      empty: "No projects published yet. Check back soon.",
      backLabel: "← back to projects",
    },

    /* ---- SINGLE WRITEUP / PROJECT PAGE ---- */
    post: {
      readTime: "{n} min read",
      outlineTitle: "on this page",
      suggestedTitle: "suggested reads",
      author: {
        name: "PIEzuke",
        tagline: "A bit about myself",
      },
    },

    /* ---- NOTES VAULT ---- */
    notes: {
      title: "Notes",
      vaultTitle: "VAULT / NOTES",
      expandAll: "Expand all folders",
      collapseAll: "Collapse all folders",
      expandIcon: "⊞",
      collapseIcon: "⊟",
      status: "VAULT / {n} NOTES",
      badge: "READY",
      outlineTitle: "ON THIS PAGE",
      resizerTitle: "Drag to resize sidebar (Double-click to reset)",
      emptyBody: "# Select a note\n\nPick something from the sidebar.", // markdown
      unnamedFolder: "folder",
      icons: { note: "📄", folderOpen: "📂", folderClosed: "📁" },
    },

    /* ---- TIMELINE ---- */
    timeline: {
      title: "Timeline",
      eyebrow: "journey log",
      heading: "Some of the stuff that happened",
      subtitle: "A chronological record of my existence",
      items: [
        {
          date: "2025 June",
          title: "Started of with my CS degree",
          body: "Learnt a bit of linux and started off with CTFs",
        },
        {
          date: "2025 November",
          title: "Joined Bi0s and got started with violating binaries",
          body: "Did my first buffer overflow, assembly and memory got fun, Started off playin CTFs as team",
        },
        {
          date: "2026",
          title: "Present day",
          body: "Welp, Im surviving. Sort off.",
        },
      ],
    },

    /* ---- ABOUT ---- */
    about: {
      title: "About",
      eyebrow: "From the author",
      heading: "A bit about myself",
      bio: "Hello. Myself PIE. I go by pie-zuke cus some guy(s) have already claimed the name 'PIE' in most platforms. So I can't be niche no more, but feel free to js use PIE. Also its 'zyuk', NOT ZU-KEH. Anyway, Im a CS student at Amrita, and a part of teambi0s under the Binary Exploitation category. Buy me coffee if u see me(unlikely cus I hate touching grass). I occationally take on random side projects which may or maynot include building a wholeahh operating system(I wish I had the motivation). Feel free to try out that music player on the on the left or on top if ur on phone, except idk if it will be working by the time I post this. Plus I still haven't finished composing even a single tune at the time of writing this. Bluh",
      interestsHeading: "Interests",
      skills: [
        "Binary Exploitation",
        "Reversing (still starting out)",
        "OS dev (Yes da Me Ambitious)",
        "Game dev (Yas da Me Very Ambitious) ",
        "Music Composition (Yazz da Me Super Ambitious)",
        "Larping",
        "etc",
        "etc",
        "etc",
      ],
      socialsHeading: "FIND ME AROUND",
      // icon: github | twitter | email | ctftime | discord | link   (or iconSvg: "<svg…>")
      // `handle` is the text shown under the label. Add `copy: "text"` to make a
      // click-to-copy tile (e.g. Discord) instead of a link. `wide: true` = full row.
      contacts: [
        {
          label: "GitHub",
          url: "https://github.com/piezuke",
          icon: "github",
          handle: "@piezuke",
        },
        {
          label: "Twitter / X",
          url: "https://twitter.com/piezuke",
          icon: "twitter",
          handle: "@piezuke",
        },
        {
          label: "Email",
          url: "mailto:piezuke@gmail.com",
          icon: "email",
          handle: "piezuke@gmail.com",
        },
        {
          label: "CTFtime",
          url: "https://ctftime.org/user/251840",
          icon: "ctftime",
          handle: "user #251840",
        },
        {
          label: "Discord",
          copy: "piezuke",
          icon: "discord",
          handle: "piezuke",
          hint: "click to copy",
          copiedText: "copied ✓",
          wide: true,
        },
      ],
    },

    /* ---- 404 ---- */
    notFound: {
      title: "404 Not found",
      heading: "404 How does one even get here",
      text: "Nothing here. Turn back buddy.",
    },
  },

  /* ------------------------------ MUSIC ------------------------------ */
  music: {
    heading: "Music I Madeeee",
    emoji: "🎵",
    emptyText: "tracks dropping soon… maybe",
    tracklistHeading: "TRACKLIST",
    noTrack: "No Track",
    unknownArtist: "Unknown",
    status: {
      idle: "IDLE",
      ready: "READY",
      playing: "PLAYING",
      paused: "PAUSED",
    },
    controls: {
      prev: "Previous Track",
      prevTitle: "Previous",
      playPause: "Play / Pause",
      playTitle: "Play",
      next: "Next Track",
      nextTitle: "Next",
    },
    // { title: "Track 01", artist: "Artist", src: "media/track01.mp3" }
    playlist: [],
  },

  /* ------------------------------ CURSOR ------------------------------ */
  cursor: "on", // "on" = custom ring cursor, "off" = normal system cursor
};
