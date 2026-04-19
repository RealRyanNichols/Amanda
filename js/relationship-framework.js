// Relationship framework — a compassionate companion for where she actually is.
//
// Design brief from Ryan: "If she's single along this we don't wanna shame her.
// We wanna ask her if she's looking for a man or if the man that maybe she
// knows the father who or her child, maybe she does doesn't. Maybe she's
// looking for a man. Maybe she's not. ... let's walk her towards making a
// decision on if it's the right man per the standards of the bible."
//
// Rules of engagement (non-negotiable):
//   1. Never shame single motherhood. She is doing sacred work.
//   2. Never assume a partner is the goal. Contentment is a full answer.
//   3. Never tell her to stay or leave. Offer questions and Scripture, not verdicts.
//   4. Biblical wisdom is available, not imposed. We surface it when she asks.
//   5. "Prompt him without pushing him away" — questions, not ultimatums.
//   6. The only opinions we hold strongly are about safety (abuse, coercion,
//      manipulation). There we point to hotlines and professional help.

// ----------------------------------------------------------------------------
// Relationship status — her pick, and only her pick.
// ----------------------------------------------------------------------------

export const HEART_STATUSES = [
  {
    key: "peace",
    label: "Solo, and at peace",
    intake: "You and your baby are enough. Let's make sure the rest of the app reflects that.",
  },
  {
    key: "open",
    label: "Solo, and open if the right one comes",
    intake: "You're not hunting — you're building a life. If someone shows up who can keep up, great.",
  },
  {
    key: "getting-to-know",
    label: "Getting to know someone",
    intake: "Early days. We'll help you see clearly without rushing.",
  },
  {
    key: "together",
    label: "In a relationship",
    intake: "You two are the team. We'll help you strengthen where it's strong and name what's hard.",
  },
  {
    key: "complicated",
    label: "It's complicated",
    intake: "Some of the hardest love lives inside the word 'complicated'. We'll sit with you here.",
  },
  {
    key: "private",
    label: "I'd rather not say",
    intake: "Got it. We'll leave this tab low-key. Everything else still works.",
  },
];

// ----------------------------------------------------------------------------
// Biblical character framework for a man.
// Not a checklist for scoring him — a mirror for her to recognize traits that
// Scripture consistently holds up. Each trait is paired with the verses it
// comes from so she can go read them herself.
// ----------------------------------------------------------------------------

export const MAN_TRAITS = [
  {
    key: "integrity",
    label: "Integrity — he is the same in public and private",
    scripture: ["Proverbs 10:9", "Proverbs 11:3", "Proverbs 20:7"],
    one_liner: "Does his private behavior match his public reputation?",
  },
  {
    key: "faithful",
    label: "Faithful — in word, body, and eye",
    scripture: ["Malachi 2:14-16", "Matthew 5:28", "Hebrews 13:4"],
    one_liner: "When he's away from you, is he still yours?",
  },
  {
    key: "love-as-service",
    label: "Loves you like Christ loved the church — by serving you",
    scripture: ["Ephesians 5:25-29", "1 Peter 3:7", "John 13:14-15"],
    one_liner: "Does he make your life easier, not just fuller?",
  },
  {
    key: "leads-without-domination",
    label: "Leads without domineering",
    scripture: ["Matthew 20:25-28", "Ephesians 5:23-25", "1 Peter 5:3"],
    one_liner: "When you disagree, does he listen or just win?",
  },
  {
    key: "provider",
    label: "Provides — for his own, faithfully",
    scripture: ["1 Timothy 5:8", "Proverbs 13:22", "Proverbs 31:11"],
    one_liner: "Is he steady with money, work, and follow-through?",
  },
  {
    key: "peaceable",
    label: "Slow to anger",
    scripture: ["James 1:19-20", "Proverbs 22:24-25", "Ephesians 4:26-27"],
    one_liner: "When he's frustrated, can you stay close without fear?",
  },
  {
    key: "teachable",
    label: "Teachable — can admit a wrong",
    scripture: ["Proverbs 12:1", "Proverbs 9:9", "James 1:5"],
    one_liner: "When he messes up, does he own it — or spin it?",
  },
  {
    key: "self-control",
    label: "Self-controlled — alcohol, porn, rage, spending",
    scripture: ["Galatians 5:22-23", "Titus 1:8", "1 Corinthians 9:25"],
    one_liner: "Is there one area where he has no 'off' switch?",
  },
  {
    key: "honest",
    label: "Honest even when it costs him",
    scripture: ["Proverbs 12:22", "Ephesians 4:25", "Colossians 3:9"],
    one_liner: "Does he tell the small true thing, or the big smooth thing?",
  },
  {
    key: "not-given-to-anger",
    label: "Never raises a hand, never weaponizes silence",
    scripture: ["Ephesians 4:31-32", "Proverbs 15:1", "Colossians 3:19"],
    one_liner: "Have you ever been afraid of him — even for a second?",
    safety_flag: true,
  },
  {
    key: "fatherly",
    label: "Fatherly — gentle with kids, yours or future",
    scripture: ["Ephesians 6:4", "Colossians 3:21", "Psalm 103:13"],
    one_liner: "How does he treat kids when no one's watching?",
  },
  {
    key: "honors-his-mother",
    label: "Honors his mother and family",
    scripture: ["Exodus 20:12", "Mark 7:10-13", "1 Timothy 5:8"],
    one_liner: "How does he talk about his mom? Women who raised him?",
  },
  {
    key: "spiritual-seeker",
    label: "Seeks wisdom higher than himself",
    scripture: ["Matthew 6:33", "James 1:5-7", "Proverbs 3:5-6"],
    one_liner: "When life is hard, where does he go for answers?",
  },
];

// ----------------------------------------------------------------------------
// Tracks — content for each status. All copy written with warmth first,
// biblical framing second.
// ----------------------------------------------------------------------------

export const TRACKS = {
  peace: {
    heading: "You, and the life you're building",
    encouragement: [
      "Ruth was a widow. Hannah prayed for years alone. Mary raised Jesus with Joseph's help but alone through most of it. Scripture honors single mothers more than it shames them.",
      "Nothing about you is incomplete.",
      "You're not on pause. You're on the verse you're on.",
    ],
    scripture: [
      { ref: "Psalm 68:5", text: "A father of the fatherless, and a judge of the widows, is God in his holy habitation." },
      { ref: "Isaiah 54:5", text: "For thy Maker is thine husband; the LORD of hosts is his name." },
      { ref: "Psalm 27:10", text: "When my father and my mother forsake me, then the LORD will take me up." },
    ],
    prompts: [
      "What's something you've done on your own that you're proud of?",
      "Who's in your village — even one name? Text them today.",
      "What does a good day for just you + your baby actually look like?",
    ],
  },

  open: {
    heading: "Open, not hunting",
    encouragement: [
      "You don't need a man. You might choose one. Those are different things, and only the second one leads somewhere good.",
      "A healthy relationship will fit in alongside your life. It won't require you to shrink to let it in.",
    ],
    scripture: [
      { ref: "Proverbs 31:10-12", text: "Who can find a virtuous woman? for her price is far above rubies. The heart of her husband doth safely trust in her, so that he shall have no need of spoil. She will do him good and not evil all the days of her life." },
      { ref: "Philippians 4:11-12", text: "I have learned, in whatsoever state I am, therewith to be content." },
    ],
    prompts: [
      "If someone walked into your life next month, what three things about your life wouldn't change for them?",
      "What's a non-negotiable you learned the hard way last time?",
      "Who's someone whose marriage you'd want a version of? What actually makes it work?",
    ],
  },

  "getting-to-know": {
    heading: "Early. Curious. Paying attention.",
    encouragement: [
      "Early love feels big. Early chemistry isn't the same thing as character. Give it time to show you the second one.",
      "Watch what he does when it's inconvenient. That's where the real man lives.",
    ],
    scripture: [
      { ref: "Proverbs 4:23", text: "Keep thy heart with all diligence; for out of it are the issues of life." },
      { ref: "Song of Solomon 2:7", text: "I charge you... that ye stir not up, nor awake my love, till he please." },
      { ref: "1 John 4:1", text: "Beloved, believe not every spirit, but try the spirits whether they are of God." },
    ],
    prompts: [
      "What does he do when he's tired or stressed? That's who he'll be at year five.",
      "Who are his closest friends? What are they like?",
      "Has he ever said 'I was wrong' to you and meant it?",
      "Does he ask about you, or mostly talk about himself?",
    ],
  },

  together: {
    heading: "You two",
    encouragement: [
      "Long relationships get strong through maintenance, not magic.",
      "The gap between 'he does that thing I hate' and 'we've talked about the thing' is the whole relationship.",
    ],
    scripture: [
      { ref: "Ephesians 4:26", text: "Be ye angry, and sin not: let not the sun go down upon your wrath." },
      { ref: "1 Corinthians 13:4-7", text: "Charity suffereth long, and is kind; charity envieth not; charity vaunteth not itself, is not puffed up, doth not behave itself unseemly, seeketh not her own, is not easily provoked, thinketh no evil." },
      { ref: "Ecclesiastes 4:9-10", text: "Two are better than one... for if they fall, the one will lift up his fellow." },
    ],
    prompts: [
      "What's one thing he's done in the last month that you haven't thanked him for?",
      "What's one thing that used to bother you that you've just... stopped saying? Is it still there?",
      "If he were reading a card from you tonight, what would you want it to say?",
      "Name one area where he's growing. Say it out loud to him this week.",
    ],
  },

  complicated: {
    heading: "Here, in the hard middle",
    encouragement: [
      "Sometimes clarity comes. Sometimes it doesn't come — yet. Both are allowed.",
      "You're not being weak for staying while you figure it out. You're not failing for leaving when you need to. You are the expert on your own life.",
      "Safety comes before clarity. If you've ever been hurt or threatened, please get somewhere safe first, then sort out the rest.",
    ],
    scripture: [
      { ref: "Psalm 34:18", text: "The LORD is nigh unto them that are of a broken heart; and saveth such as be of a contrite spirit." },
      { ref: "Isaiah 43:2", text: "When thou passest through the waters, I will be with thee; and through the rivers, they shall not overflow thee." },
      { ref: "Psalm 46:1", text: "God is our refuge and strength, a very present help in trouble." },
    ],
    prompts: [
      "What's the truest sentence you haven't written down yet?",
      "Name one person who loves you who could hear all of this without flinching.",
      "If your best friend told you what's happening to you, what would you say to her?",
    ],
    safety_resources: true,
  },

  private: {
    heading: "Your business",
    encouragement: ["We'll stay out of this part. Everything else in the app still works for you."],
    scripture: [],
    prompts: [],
  },
};

// ----------------------------------------------------------------------------
// Shared question bank — "questions worth asking him" that she can send to
// him via text / share sheet / (eventually) the connected-partner inbox.
// These work for "getting-to-know" and "together" equally.
// ----------------------------------------------------------------------------

export const QUESTIONS_FOR_HIM = [
  { tier: "warm",   text: "What's one thing you loved about your dad? What's one thing you swore you'd do differently?" },
  { tier: "warm",   text: "When was the last time someone told you they were proud of you?" },
  { tier: "warm",   text: "What's a story about your mom you want our kid to know someday?" },
  { tier: "warm",   text: "If we had one weekend with nothing scheduled, what do you actually want to do?" },
  { tier: "medium", text: "Where do you feel most out of your depth right now — with me, the baby, work, or something else?" },
  { tier: "medium", text: "What's one thing you've wanted to say to me but haven't?" },
  { tier: "medium", text: "What do you want our kid to say about you when they're 30?" },
  { tier: "medium", text: "When did you last feel close to God? I'm not asking for a full answer — just whenever." },
  { tier: "deep",   text: "Is there a fear about being a dad that you haven't told anyone?" },
  { tier: "deep",   text: "What's one thing your parents did that you're still carrying?" },
  { tier: "deep",   text: "If something happened to me tomorrow, what do you want to have already said?" },
];

// ----------------------------------------------------------------------------
// Safety flags — phrases that, if she writes them in reflections, prompt us
// to gently surface crisis resources. We do NOT auto-report, we do NOT tell
// anyone. We just make sure she sees the 988/hotline number alongside.
// ----------------------------------------------------------------------------

export const SAFETY_FLAGS = [
  "hit me", "hits me", "he hit", "punched", "slapped",
  "afraid of him", "scared of him", "threatens", "threatened",
  "won't let me", "won't let me leave", "takes my phone",
  "isolates me", "tracks me", "controls my money",
  "forced me", "pressured me into",
];

export function checkSafetyFlags(text) {
  if (!text) return [];
  const lower = text.toLowerCase();
  return SAFETY_FLAGS.filter((p) => lower.includes(p));
}
