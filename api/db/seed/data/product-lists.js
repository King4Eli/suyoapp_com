// pl_created has no default.
const seededAt = new Date();

export const productLists = [
  {
    plSku: "boost_7xk2mqp9vd4rfw8ntj3hc",
    plName: "Boost",
    plDescription: {
      features: [
        { d: "Be one of the top profiles in your area for 30 minutes", e: true },
      ],
    },
    category: "boost",
    plIsActive: "1",
    plCreated: seededAt,
  },
  {
    plSku: "instantmessage_wu8yyur5mmmtua",
    plName: "Direct Message",
    plDescription: {
      features: [
        { d: "Message someone before you match -- sent with a like", e: true },
      ],
    },
    category: "directmessage",
    plIsActive: "1",
    plCreated: seededAt,
  },
  {
    plSku: "plus_kywhm9u6ymw8ym3u69meno",
    plName: "plus",
    plDescription: {
      features: [
        { d: "5 roses per day", e: true },
        { d: "10 direct messages per day", e: true },
        { d: "See who liked you", e: true },
        { d: "Unlimited likes", e: true },
        { d: "Rewind missed matches", e: true },
        { d: "Weekly profile boost", e: true },
      ],
    },
    category: "mainsub",
    tier: "plus",
    plIsActive: "1",
    plCreated: seededAt,
  },
  {
    plSku: "superlikes_4pqojouyyyur5uyihgj898",
    plName: "Roses",
    plDescription: {
      features: [{ d: "Roses are spent on super likes", e: true }],
    },
    category: "superlike",
    plIsActive: "1",
    plCreated: seededAt,
  },
  {
    plSku: "vip_91n46w586u0m4eomircybdvsz",
    plName: "vip",
    plDescription: {
      features: [
        { d: "Unlimited Phone/Video calls", e: true },
        { d: "10 roses per day", e: true },
        { d: "20 direct messages per day", e: true },
        { d: "Rewind missed matches", e: true },
        { d: "Travel mode", e: true },
        { d: "Priority customer support", e: true },
      ],
    },
    category: "mainsub",
    tier: "vip",
    plIsActive: "1",
    plCreated: seededAt,
  },
];
