// Scripture seeds — KJV (public domain). Curated around strength, identity,
// motherhood, rest, and love. Rotates by day-of-year.
export const VERSES = [
  { ref: "Philippians 4:13", text: "I can do all things through Christ which strengtheneth me." },
  { ref: "Isaiah 40:31",    text: "But they that wait upon the LORD shall renew their strength; they shall mount up with wings as eagles; they shall run, and not be weary; and they shall walk, and not faint." },
  { ref: "Psalm 46:10",     text: "Be still, and know that I am God." },
  { ref: "Jeremiah 29:11",  text: "For I know the thoughts that I think toward you, saith the LORD, thoughts of peace, and not of evil, to give you an expected end." },
  { ref: "Proverbs 31:25",  text: "Strength and honour are her clothing; and she shall rejoice in time to come." },
  { ref: "Psalm 139:14",    text: "I will praise thee; for I am fearfully and wonderfully made." },
  { ref: "Psalm 23:1",      text: "The LORD is my shepherd; I shall not want." },
  { ref: "Psalm 34:18",     text: "The LORD is nigh unto them that are of a broken heart; and saveth such as be of a contrite spirit." },
  { ref: "Matthew 11:28",   text: "Come unto me, all ye that labour and are heavy laden, and I will give you rest." },
  { ref: "Joshua 1:9",      text: "Be strong and of a good courage; be not afraid, neither be thou dismayed: for the LORD thy God is with thee whithersoever thou goest." },
  { ref: "Zephaniah 3:17",  text: "The LORD thy God in the midst of thee is mighty; he will save, he will rejoice over thee with joy; he will rest in his love, he will joy over thee with singing." },
  { ref: "2 Timothy 1:7",   text: "For God hath not given us the spirit of fear; but of power, and of love, and of a sound mind." },
  { ref: "Psalm 127:3",     text: "Lo, children are an heritage of the LORD: and the fruit of the womb is his reward." },
  { ref: "Isaiah 41:10",    text: "Fear thou not; for I am with thee: be not dismayed; for I am thy God: I will strengthen thee; yea, I will help thee; yea, I will uphold thee with the right hand of my righteousness." },
  { ref: "Romans 8:28",     text: "And we know that all things work together for good to them that love God, to them who are the called according to his purpose." },
  { ref: "Psalm 121:1-2",   text: "I will lift up mine eyes unto the hills, from whence cometh my help. My help cometh from the LORD, which made heaven and earth." },
  { ref: "Proverbs 3:5-6",  text: "Trust in the LORD with all thine heart; and lean not unto thine own understanding. In all thy ways acknowledge him, and he shall direct thy paths." },
  { ref: "Isaiah 43:2",     text: "When thou passest through the waters, I will be with thee; and through the rivers, they shall not overflow thee." },
  { ref: "Lamentations 3:22-23", text: "It is of the LORD's mercies that we are not consumed, because his compassions fail not. They are new every morning: great is thy faithfulness." },
  { ref: "Psalm 37:4",      text: "Delight thyself also in the LORD; and he shall give thee the desires of thine heart." },
  { ref: "Psalm 91:4",      text: "He shall cover thee with his feathers, and under his wings shalt thou trust." },
  { ref: "Isaiah 40:11",    text: "He shall feed his flock like a shepherd: he shall gather the lambs with his arm, and carry them in his bosom, and shall gently lead those that are with young." },
  { ref: "Matthew 6:34",    text: "Take therefore no thought for the morrow: for the morrow shall take thought for the things of itself. Sufficient unto the day is the evil thereof." },
  { ref: "Psalm 55:22",     text: "Cast thy burden upon the LORD, and he shall sustain thee." },
  { ref: "1 Peter 5:7",     text: "Casting all your care upon him; for he careth for you." },
  { ref: "Romans 12:12",    text: "Rejoicing in hope; patient in tribulation; continuing instant in prayer." },
  { ref: "Ephesians 3:20",  text: "Now unto him that is able to do exceeding abundantly above all that we ask or think, according to the power that worketh in us." },
  { ref: "Psalm 30:5",      text: "Weeping may endure for a night, but joy cometh in the morning." },
  { ref: "Song of Sol. 2:10", text: "Rise up, my love, my fair one, and come away." },
  { ref: "Colossians 3:23", text: "And whatsoever ye do, do it heartily, as to the Lord, and not unto men." },
  { ref: "Psalm 118:24",    text: "This is the day which the LORD hath made; we will rejoice and be glad in it." },
];

export function verseOfTheDay(date = new Date()) {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date - start;
  const dayOfYear = Math.floor(diff / 86400000);
  return VERSES[dayOfYear % VERSES.length];
}

// Hospital bag checklist — based on commonly-recommended items. Amanda can edit.
export const HOSPITAL_BAG_SEED = [
  { category: "For mom",  item: "Photo ID & insurance card" },
  { category: "For mom",  item: "Birth plan (if you have one)" },
  { category: "For mom",  item: "Robe, slippers, warm socks" },
  { category: "For mom",  item: "Nursing bras" },
  { category: "For mom",  item: "Going-home outfit (loose, comfortable)" },
  { category: "For mom",  item: "Toiletries & hair ties" },
  { category: "For mom",  item: "Lip balm" },
  { category: "For mom",  item: "Phone charger (long cable)" },
  { category: "For mom",  item: "Snacks & water bottle" },
  { category: "For baby", item: "Going-home outfit (two sizes)" },
  { category: "For baby", item: "Swaddle blanket" },
  { category: "For baby", item: "Installed car seat" },
  { category: "For baby", item: "Mittens / socks / hat" },
  { category: "For Ryan", item: "Change of clothes" },
  { category: "For Ryan", item: "Snacks, phone charger, cash" },
  { category: "For Ryan", item: "Camera" },
  { category: "Docs",     item: "Hospital pre-registration paperwork" },
  { category: "Docs",     item: "Pediatrician name & phone" },
];

// Love notes — envelopes with gentle placeholder text meant for Ryan to edit
// on his desktop. They're written to feel warm but obviously awaiting his words.
export const LOVE_NOTES_SEED = [
  {
    occasion: "Open when you feel overwhelmed",
    body:
`Amanda — breathe. You don't have to carry it all right this second.
One thing at a time. I've got you.

— Ryan
(Ryan, replace this with your own words when you're at your computer.)`,
  },
  {
    occasion: "Open when you miss me",
    body:
`I'm thinking about you. That thing you said last night? I keep smiling about it.
You're not alone in this.

— Ryan
(Ryan, replace this with your own words when you're at your computer.)`,
  },
  {
    occasion: "Open when you doubt yourself",
    body:
`You are a great mom. You are a great woman. You are exactly who this baby needs.
I see you clearly, and I'm proud of you.

— Ryan
(Ryan, replace this with your own words when you're at your computer.)`,
  },
  {
    occasion: "Open on a hard day",
    body:
`Today can be tough. You can still be gentle with yourself.
Eat something. Drink water. Text me when you can.

— Ryan
(Ryan, replace this with your own words when you're at your computer.)`,
  },
  {
    occasion: "Open when you need a laugh",
    body:
`(Ryan, put something only the two of you would find funny here.
A line from that movie. That inside joke from dinner. Something small and real.)

— Ryan`,
  },
  {
    occasion: "Open when the baby kicks",
    body:
`That's our child saying hi.
I love you both.

— Ryan
(Ryan, replace this with your own words when you're at your computer.)`,
  },
];
