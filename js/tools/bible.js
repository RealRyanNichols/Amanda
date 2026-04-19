// Bible reader — uses bible-api.com (CORS-enabled, free, KJV public domain)
// for chapter text on first fetch, then caches locally for full offline use.
// Long-term plan: bundle the entire KJV JSON inside the app for true ownership.
// See DESKTOP_HANDOFF.md.

import { state, save, uid } from "../store.js";
import { h, toast, confirmAction, todayISO } from "../util.js";

const BOOKS = [
  { name: "Genesis",       chapters: 50, ot: true },
  { name: "Exodus",        chapters: 40, ot: true },
  { name: "Leviticus",     chapters: 27, ot: true },
  { name: "Numbers",       chapters: 36, ot: true },
  { name: "Deuteronomy",   chapters: 34, ot: true },
  { name: "Joshua",        chapters: 24, ot: true },
  { name: "Judges",        chapters: 21, ot: true },
  { name: "Ruth",          chapters: 4,  ot: true },
  { name: "1 Samuel",      chapters: 31, ot: true },
  { name: "2 Samuel",      chapters: 24, ot: true },
  { name: "1 Kings",       chapters: 22, ot: true },
  { name: "2 Kings",       chapters: 25, ot: true },
  { name: "1 Chronicles",  chapters: 29, ot: true },
  { name: "2 Chronicles",  chapters: 36, ot: true },
  { name: "Ezra",          chapters: 10, ot: true },
  { name: "Nehemiah",      chapters: 13, ot: true },
  { name: "Esther",        chapters: 10, ot: true },
  { name: "Job",           chapters: 42, ot: true },
  { name: "Psalms",        chapters: 150, ot: true },
  { name: "Proverbs",      chapters: 31, ot: true },
  { name: "Ecclesiastes",  chapters: 12, ot: true },
  { name: "Song of Solomon", chapters: 8, ot: true },
  { name: "Isaiah",        chapters: 66, ot: true },
  { name: "Jeremiah",      chapters: 52, ot: true },
  { name: "Lamentations",  chapters: 5,  ot: true },
  { name: "Ezekiel",       chapters: 48, ot: true },
  { name: "Daniel",        chapters: 12, ot: true },
  { name: "Hosea",         chapters: 14, ot: true },
  { name: "Joel",          chapters: 3,  ot: true },
  { name: "Amos",          chapters: 9,  ot: true },
  { name: "Obadiah",       chapters: 1,  ot: true },
  { name: "Jonah",         chapters: 4,  ot: true },
  { name: "Micah",         chapters: 7,  ot: true },
  { name: "Nahum",         chapters: 3,  ot: true },
  { name: "Habakkuk",      chapters: 3,  ot: true },
  { name: "Zephaniah",     chapters: 3,  ot: true },
  { name: "Haggai",        chapters: 2,  ot: true },
  { name: "Zechariah",     chapters: 14, ot: true },
  { name: "Malachi",       chapters: 4,  ot: true },
  { name: "Matthew",       chapters: 28, ot: false },
  { name: "Mark",          chapters: 16, ot: false },
  { name: "Luke",          chapters: 24, ot: false },
  { name: "John",          chapters: 21, ot: false },
  { name: "Acts",          chapters: 28, ot: false },
  { name: "Romans",        chapters: 16, ot: false },
  { name: "1 Corinthians", chapters: 16, ot: false },
  { name: "2 Corinthians", chapters: 13, ot: false },
  { name: "Galatians",     chapters: 6,  ot: false },
  { name: "Ephesians",     chapters: 6,  ot: false },
  { name: "Philippians",   chapters: 4,  ot: false },
  { name: "Colossians",    chapters: 4,  ot: false },
  { name: "1 Thessalonians", chapters: 5, ot: false },
  { name: "2 Thessalonians", chapters: 3, ot: false },
  { name: "1 Timothy",     chapters: 6,  ot: false },
  { name: "2 Timothy",     chapters: 4,  ot: false },
  { name: "Titus",         chapters: 3,  ot: false },
  { name: "Philemon",      chapters: 1,  ot: false },
  { name: "Hebrews",       chapters: 13, ot: false },
  { name: "James",         chapters: 5,  ot: false },
  { name: "1 Peter",       chapters: 5,  ot: false },
  { name: "2 Peter",       chapters: 3,  ot: false },
  { name: "1 John",        chapters: 5,  ot: false },
  { name: "2 John",        chapters: 1,  ot: false },
  { name: "3 John",        chapters: 1,  ot: false },
  { name: "Jude",          chapters: 1,  ot: false },
  { name: "Revelation",    chapters: 22, ot: false },
];

function bibleState() {
  if (!state.bible) {
    state.bible = {
      currentBook: "John",
      currentChapter: 3,
      bookmarks: [],
      highlights: {},        // key: "book:chapter:verse" → "yellow"|"pink"|"blue"
      readingHistory: {},    // key: "book:chapter" → ISO timestamp
      cache: {},             // key: "book:chapter" → { verses: [{number, text}] }
      view: "browse",        // browse | book | chapter
      activeBook: "John",
      fontScale: 1,
    };
    save();
  }
  return state.bible;
}

async function loadChapter(book, chapter) {
  const b = bibleState();
  const k = `${book}:${chapter}`;
  if (b.cache[k]) return b.cache[k];
  const url = `https://bible-api.com/${encodeURIComponent(book + " " + chapter)}?translation=kjv`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Couldn't load this chapter — check your connection.");
  const data = await res.json();
  const out = {
    reference: data.reference,
    verses: (data.verses || []).map((v) => ({ number: v.verse, text: v.text.trim() })),
  };
  b.cache[k] = out;
  // keep cache size in check — last 30 chapters
  const keys = Object.keys(b.cache);
  if (keys.length > 30) {
    const sorted = keys.slice(0, keys.length - 30);
    sorted.forEach((kk) => delete b.cache[kk]);
  }
  save();
  return out;
}

/* ---------- Browse view ---------- */

function renderBrowse(rerender) {
  const b = bibleState();
  const wrap = h("div");

  // Continue reading card (if there's a recent location)
  const lastBook = b.currentBook;
  const lastCh = b.currentChapter;
  if (lastBook) {
    wrap.append(h("section", { class: "card bible-continue" }, [
      h("div", { class: "sub" }, "Continue reading"),
      h("h2", { style: "margin:4px 0 10px" }, `${lastBook} ${lastCh}`),
      h("div", { class: "btn-row" }, [
        h("button", {
          class: "btn",
          onclick: () => { b.view = "chapter"; save(); rerender(); },
        }, "Open"),
      ]),
    ]));
  }

  // Bookmarks
  if (b.bookmarks.length) {
    const card = h("section", { class: "card" }, [
      h("h2", {}, "Your bookmarks"),
    ]);
    const list = h("div", { class: "list" });
    b.bookmarks.forEach((bk) => {
      list.append(h("div", { class: "item" }, [
        h("div", {}, [
          h("div", { class: "title" }, `${bk.book} ${bk.chapter}${bk.verse ? ":" + bk.verse : ""}`),
          bk.note && h("div", { class: "meta" }, bk.note),
        ]),
        h("div", { class: "actions" }, [
          h("button", {
            class: "btn small",
            onclick: () => { b.currentBook = bk.book; b.currentChapter = bk.chapter; b.view = "chapter"; save(); rerender(); },
          }, "Open"),
          h("button", {
            class: "btn small danger",
            onclick: () => {
              if (!confirmAction("Remove bookmark?")) return;
              b.bookmarks = b.bookmarks.filter((x) => x.id !== bk.id);
              save(); rerender();
            },
          }, "×"),
        ]),
      ]));
    });
    card.append(list);
    wrap.append(card);
  }

  // Books grid: OT then NT
  ["Old Testament", "New Testament"].forEach((section, idx) => {
    const card = h("section", { class: "card" }, [h("h2", {}, section)]);
    const grid = h("div", { class: "bible-books" });
    BOOKS.filter((book) => book.ot === (idx === 0)).forEach((book) => {
      grid.append(h("button", {
        class: "bible-book-btn",
        onclick: () => { b.activeBook = book.name; b.view = "book"; save(); rerender(); },
      }, book.name));
    });
    card.append(grid);
    wrap.append(card);
  });

  return wrap;
}

/* ---------- Book view (chapter picker) ---------- */

function renderBookView(rerender) {
  const b = bibleState();
  const book = BOOKS.find((x) => x.name === b.activeBook);
  if (!book) return renderBrowse(rerender);

  const wrap = h("div");
  wrap.append(h("section", { class: "card" }, [
    h("div", { class: "btn-row", style: "margin-bottom:12px" }, [
      h("button", {
        class: "btn small secondary",
        onclick: () => { b.view = "browse"; save(); rerender(); },
      }, "← All books"),
    ]),
    h("h2", {}, book.name),
    h("div", { class: "sub" }, `${book.chapters} chapter${book.chapters > 1 ? "s" : ""} — pick one`),
  ]));

  const grid = h("div", { class: "bible-chapters" });
  for (let i = 1; i <= book.chapters; i++) {
    const isRead = !!b.readingHistory[`${book.name}:${i}`];
    grid.append(h("button", {
      class: "bible-chapter-btn" + (isRead ? " read" : ""),
      onclick: () => {
        b.currentBook = book.name;
        b.currentChapter = i;
        b.view = "chapter";
        save();
        rerender();
      },
    }, i));
  }
  wrap.append(h("section", { class: "card" }, [grid]));
  return wrap;
}

/* ---------- Chapter view (the actual reading screen) ---------- */

function renderChapterView(rerender) {
  const b = bibleState();
  const wrap = h("div", { class: "bible-reader", style: `font-size: ${b.fontScale}em` });

  // Top toolbar
  wrap.append(h("section", { class: "card bible-toolbar" }, [
    h("div", { class: "btn-row", style: "justify-content:space-between; gap:8px" }, [
      h("button", {
        class: "btn small secondary",
        onclick: () => { b.view = "browse"; save(); rerender(); },
      }, "← Books"),
      h("div", { class: "btn-row" }, [
        h("button", {
          class: "btn small secondary",
          onclick: () => { b.fontScale = Math.max(0.8, (b.fontScale || 1) - 0.1); save(); rerender(); },
        }, "A−"),
        h("button", {
          class: "btn small secondary",
          onclick: () => { b.fontScale = Math.min(1.6, (b.fontScale || 1) + 0.1); save(); rerender(); },
        }, "A+"),
      ]),
    ]),
    h("h2", { style: "margin:12px 0 0" }, `${b.currentBook} ${b.currentChapter}`),
  ]));

  // Chapter content
  const content = h("section", { class: "card bible-content" });
  content.append(h("div", { class: "bible-loading" }, "Loading…"));
  wrap.append(content);

  loadChapter(b.currentBook, b.currentChapter).then((chap) => {
    content.innerHTML = "";
    chap.verses.forEach((v) => {
      const k = `${b.currentBook}:${b.currentChapter}:${v.number}`;
      const highlight = b.highlights[k];
      content.append(h("p", {
        class: "bible-verse" + (highlight ? " highlight-" + highlight : ""),
        onclick: () => verseTapped(v, b.currentBook, b.currentChapter, rerender),
      }, [
        h("sup", { class: "bible-vnum" }, v.number),
        " ",
        h("span", {}, v.text),
      ]));
    });

    // Mark this chapter as read
    b.readingHistory[`${b.currentBook}:${b.currentChapter}`] = new Date().toISOString();
    save();
  }).catch((err) => {
    content.innerHTML = "";
    content.append(h("div", { class: "alert bad" },
      err.message + " (Tap below to try again, or pick a different chapter.)"));
    content.append(h("button", { class: "btn", onclick: rerender }, "Retry"));
  });

  // Bottom nav: prev/next chapter
  const book = BOOKS.find((x) => x.name === b.currentBook);
  const hasPrev = b.currentChapter > 1;
  const hasNext = book && b.currentChapter < book.chapters;

  wrap.append(h("section", { class: "card" }, [
    h("div", { class: "btn-row", style: "justify-content:space-between" }, [
      h("button", {
        class: "btn" + (hasPrev ? "" : " secondary"),
        disabled: !hasPrev,
        onclick: () => { if (hasPrev) { b.currentChapter--; save(); rerender(); } },
      }, "← Previous"),
      h("button", {
        class: "btn small secondary",
        onclick: () => { b.view = "book"; b.activeBook = b.currentBook; save(); rerender(); },
      }, "Pick chapter"),
      h("button", {
        class: "btn" + (hasNext ? "" : " secondary"),
        disabled: !hasNext,
        onclick: () => { if (hasNext) { b.currentChapter++; save(); rerender(); } },
      }, "Next →"),
    ]),
    h("div", { class: "btn-row", style: "margin-top:10px" }, [
      h("button", {
        class: "btn secondary",
        onclick: () => addBookmark(b, rerender),
      }, "🔖 Bookmark this"),
    ]),
  ]));

  return wrap;
}

function addBookmark(b, rerender) {
  const note = prompt(`Bookmark ${b.currentBook} ${b.currentChapter}? (Optional note)`, "");
  if (note === null) return;
  b.bookmarks.unshift({
    id: uid(),
    book: b.currentBook,
    chapter: b.currentChapter,
    verse: null,
    note: (note || "").trim(),
    at: Date.now(),
  });
  save();
  toast("Bookmarked");
  rerender();
}

function verseTapped(v, book, chapter, rerender) {
  const k = `${book}:${chapter}:${v.number}`;
  const b = bibleState();
  const colors = ["", "yellow", "pink", "blue"];
  const current = b.highlights[k] || "";
  const idx = colors.indexOf(current);
  const next = colors[(idx + 1) % colors.length];
  if (next) b.highlights[k] = next; else delete b.highlights[k];
  save();
  rerender();
}

/* ---------- Main render ---------- */

export function renderBible(mount, { rerender }) {
  const b = bibleState();
  if (b.view === "chapter") mount.append(renderChapterView(rerender));
  else if (b.view === "book") mount.append(renderBookView(rerender));
  else mount.append(renderBrowse(rerender));
}
