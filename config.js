const CONFIG = {
  /* ------------------------------ SITE ------------------------------ */
  site: {
    brand: "PIEzuke", // navbar logo text, also used as avatar alt text
    name: "piezuke", // short name shown in tab titles
    language: "en", // <html lang>
    // Your site's public address, no trailing slash. For GitHub Pages:
    //   user/org site     https://piezuke.github.io
    //   project site      https://piezuke.github.io/my-repo     (include the repo name!)
    //   custom domain     https://piezuke.dev
    // With it set, `node manage.js sync` also builds a page for every writeup/project
    // (its own title, description and share image for Google and Discord/Twitter
    // previews), plus sitemap.xml and feed.xml. Leave "" to switch all of that off.
    url: "",
    author: "PIEzuke", // author name used in the RSS feed and for search engines
    feed: { enabled: true, title: "", description: "" }, // feed.xml ("" = use site name / description)
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

    // Cover picture shown on cards, the home-page tiles and at the top of
    // articles. Put your own image or GIF in media/ and point `image` at it.
    //   image    : path or full URL to any image (.webp .png .jpg .gif). "" = no covers at all.
    //   position : which part stays visible when the picture is cropped,
    //              e.g. "center", "top", "left 30%".
    // A single post can use its own picture: add  image: media/my-pic.gif
    // to that post's front-matter and it replaces this default for that post.
    covers: {
      image: "media/cover.webp",
      position: "center",
    },

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
      tagsLabel: "tags", // shown above the clickable tag chips ("#pwn" filters by tag)
      tags: {
        page: "page",
        writeup: "writeup",
        project: "project",
        note: "note",
      },
    },

    loader: {
      // Minimum time (milliseconds) the loading screen stays up when the site first
      // opens. 700 = 0.7 seconds. 0 = as short as possible.
      minDuration: 700,
      // ...and when you click to another page. 0 = swap instantly (fastest).
      pageChangeDuration: 500,
      // The loading screen also waits for the web fonts and the pictures that are on
      // screen (on first load and on every page change), so nothing pops in late.
      waitForImages: true,
      // ...but never longer than this, even if something is still loading.
      maxDuration: 6000,
      // If the loading screen is still up after this long, its text changes to `slow`.
      slowAfter: 3500,
      slow: "Taking longer than usual... still on it.",
      // Browser Back / Forward buttons skip the loading screen entirely.
      skipOnBackForward: true,
      initial: "Connecting to PIE's Archives...",
      // one of these is picked at random on every page change
      labels: [
        "bluh bluh bluh bluh....",
        "buh buh buh buh....",
        "fweh fweh fweh fweh....",
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

    code: {
      copy: "copy",
      copied: "copied ✓",
      label: "Copy code to clipboard",
      highlight: true, // syntax highlighting in code blocks
      languageLabel: true, // small language name in the corner of each block
    },

    // screen-reader / keyboard help
    a11y: {
      skipLink: "Skip to content",
      navigated: "Navigated to {page}", // announced after each page change
      loading: "Loading",
      navLabel: "Primary",
    },

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

    // Big call-to-action at the top of the footer. The button opens the first
    // contact (in pages.about.contacts) whose icon is "email"; no email = no button.
    ctaHeading: "Say hi.",
    ctaText: "Questions, collabs, or a CTF that needs another teammate? My inbox is open.",
    ctaButton: "Send an email",

    // Column headings (the columns are built from your nav, latest writeups and contacts)
    navHeading: "Explore",
    latestHeading: "Latest writeups",
    socialsHeading: "Elsewhere",

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
          "CTF writeups, projects and half-organised notes live here. Beware of the ones whose names shall not be uttered",
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
      // Extra frontmatter fields (ctf, category, points, difficulty, ...) are shown in
      // the post header. `labels` renames them; anything not listed shows as written.
      meta: {
        labels: {
          ctf: "CTF",
          event: "Event",
          category: "Category",
          points: "Points",
          difficulty: "Difficulty",
          solves: "Solves",
        },
      },
      copyLink: {
        label: "copy link",
        copied: "link copied ✓",
        title: "Copy a shareable link to this post",
      },
      sectionLink: { title: "Copy link to this section", copied: "copied ✓" },
      // Flags in writeups ( bi0s{...} ) are blurred until clicked, so readers can
      // try the challenge first.
      flags: {
        enabled: true,
        hint: "click to reveal",
        prefixes: ["flag", "ctf", "bi0s", "teambi0s", "pico", "picoctf", "htb", "thm"],
        generic: true, // also blur anything shaped like  word{something-long}
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
  // "ring"        = the ring cursor that follows your mouse (default)
  // "native-ring" = the same ring drawn AS the system cursor (no hidden-cursor tricks)
  // "off"         = normal system cursor
  // You can also test a mode without editing this file:  yoursite/?cursor=native-ring
  cursor: "ring",
};
