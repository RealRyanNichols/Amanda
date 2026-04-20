// Partner-side faith journey — gentler for the men.
//
// Context from Ryan: "sometimes it's the women that attract the men and
// help them become Christians. So if this man gets in here and he's brought
// over by a woman, we need to know... is he a Christian, how long has he
// been going to church... certain verses, certain things, prompting him
// with certain things that are not too overboard not too pushy, but letting
// him know he's not forgotten. Even Jesus had said have two swords... the
// biggest warrior had to let that go with the feet of the cross."
//
// The design here is intentionally:
//   - Never pushy. One verse at a time, and only if she flagged nudges_ok.
//   - Never "you should believe" or "come to Jesus" language. Just men in
//     scripture facing real things. He draws his own line.
//   - Questions > declarations. "Did you think about X this week?" is
//     warmer than "Remember to pray!"
//   - Fatherhood, strength, protecting, providing — his existing identity,
//     not a rebuild of it.
//   - A way out. Every prompt has "mute these" one-tap, no explanation.

export const MASCULINE_VERSES = [
  {
    ref: "Joshua 1:9",
    text: "Be strong and of a good courage; be not afraid, neither be thou dismayed: for the LORD thy God is with thee whithersoever thou goest.",
    theme: "strength",
  },
  {
    ref: "1 Corinthians 16:13",
    text: "Watch ye, stand fast in the faith, quit you like men, be strong.",
    theme: "strength",
  },
  {
    ref: "Ephesians 5:25",
    text: "Husbands, love your wives, even as Christ also loved the church, and gave himself for it.",
    theme: "love",
  },
  {
    ref: "Proverbs 27:17",
    text: "Iron sharpeneth iron; so a man sharpeneth the countenance of his friend.",
    theme: "brotherhood",
  },
  {
    ref: "Psalm 112:1-2",
    text: "Blessed is the man that feareth the LORD, that delighteth greatly in his commandments. His seed shall be mighty upon earth.",
    theme: "fatherhood",
  },
  {
    ref: "Proverbs 22:6",
    text: "Train up a child in the way he should go: and when he is old, he will not depart from it.",
    theme: "fatherhood",
  },
  {
    ref: "Deuteronomy 31:6",
    text: "Be strong and of a good courage, fear not, nor be afraid of them: for the LORD thy God, he it is that doth go with thee.",
    theme: "strength",
  },
  {
    ref: "Psalm 127:3-5",
    text: "Lo, children are an heritage of the LORD: and the fruit of the womb is his reward. As arrows are in the hand of a mighty man; so are children of the youth.",
    theme: "fatherhood",
  },
  {
    ref: "Luke 22:38",
    text: "And they said, Lord, behold, here are two swords. And he said unto them, It is enough.",
    theme: "readiness",
  },
  {
    ref: "1 Timothy 5:8",
    text: "But if any provide not for his own, and specially for those of his own house, he hath denied the faith.",
    theme: "providing",
  },
  {
    ref: "Joshua 24:15",
    text: "Choose you this day whom ye will serve... but as for me and my house, we will serve the LORD.",
    theme: "leadership",
  },
  {
    ref: "Philippians 4:13",
    text: "I can do all things through Christ which strengtheneth me.",
    theme: "strength",
  },
];

// Gentle, non-pushy questions. Offered once a week on his dashboard.
// None of these require a faith commitment to answer honestly.
export const MEN_PROMPTS = [
  {
    tier: "easy",
    text: "What's one thing your wife is carrying right now that you could carry instead?",
  },
  {
    tier: "easy",
    text: "Name something your kid (or the baby on the way) will be grateful you did when they're 20.",
  },
  {
    tier: "easy",
    text: "What's weighing on you that you haven't said out loud this week?",
  },
  {
    tier: "medium",
    text: "If you had one quiet moment today, what would you want to think about?",
  },
  {
    tier: "medium",
    text: "Who's the last person who told you they were proud of you?",
  },
  {
    tier: "medium",
    text: "What does 'being the man of the house' actually mean to you — not the cliché version?",
  },
  {
    tier: "deep",
    text: "If you prayed right now, what would it be about? You don't have to say it out loud. Just think it.",
  },
  {
    tier: "deep",
    text: "When you imagine your child older, what kind of man do you hope they see in you?",
  },
  {
    tier: "deep",
    text: "Is there someone you used to pray with — or alongside — who's no longer in your life?",
  },
];

// Pick the right verse for this partner given what she shared about him
// when she invited. Bias towards strength/fatherhood for "unknown" or
// "not" — those themes resonate without requiring a faith commitment.
export function verseForPartner({ faithStatus = "unknown", pregnancyWeek = null } = {}) {
  // Late pregnancy + fatherhood angle.
  if (pregnancyWeek != null && pregnancyWeek >= 28) {
    const fatherhoodVerses = MASCULINE_VERSES.filter((v) => v.theme === "fatherhood");
    if (fatherhoodVerses.length) return pickByDay(fatherhoodVerses);
  }
  // Lapsed or exploring — lean on strength + providing, less "religious" feel.
  if (faithStatus === "lapsed" || faithStatus === "exploring" || faithStatus === "not" || faithStatus === "unknown") {
    const wide = MASCULINE_VERSES.filter((v) => ["strength", "providing", "fatherhood", "brotherhood"].includes(v.theme));
    return pickByDay(wide);
  }
  // Believer — full rotation.
  return pickByDay(MASCULINE_VERSES);
}

export function promptForPartner({ faithStatus = "unknown" } = {}) {
  const tier = (faithStatus === "believer") ? "deep"
             : (faithStatus === "lapsed" || faithStatus === "exploring") ? "medium"
             : "easy";
  const pool = MEN_PROMPTS.filter((p) => p.tier === tier);
  return pickByDay(pool.length ? pool : MEN_PROMPTS);
}

function pickByDay(arr) {
  const d = Math.floor(Date.now() / 86400000);
  return arr[d % arr.length];
}
