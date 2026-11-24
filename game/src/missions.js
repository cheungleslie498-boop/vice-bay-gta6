// Story missions for Vice Bay. Each mission is stages with a target, a check and a reward.
// The game object (g) exposes: pos, inCar, wanted, distTo(x,z), setWanted(n), addCash(n), phone(from,msg), toast(msg).
export const MISSIONS = [
  {
    id: 1, name: 'HOT WHEELS', from: 'MAMA ROSA',
    intro: "Danny, baby — you're back! You need wheels. Steal any car and bring it to my garage, west side. Don't scratch it... much.",
    stages: [
      { text: 'Steal a car and drive it to Rosa\'s garage', target: { x: -180, z: -252 }, radius: 10,
        check: (g) => g.inCar && g.distTo(-180, -252) < 10 },
    ],
    reward: 500,
    complete: "That's my boy! The garage is yours whenever you need a paint job.",
  },
  {
    id: 2, name: 'PACKAGE RUN', from: 'MAMA ROSA',
    intro: "A package is waiting on the docks, east side. Pick it up, take it to the Vice Bay Hotel. Fast — the client pays for speed.",
    stages: [
      { text: 'Pick up the package on the docks', target: { x: 356, z: -108 }, radius: 8,
        check: (g) => g.distTo(356, -108) < 8,
        onEnter: (g) => { g.phone('MAMA ROSA', 'Got it! Now the hotel — 90 seconds, go go go!'); } },
      { text: 'Deliver the package to the Vice Bay Hotel', target: { x: 252, z: 88 }, radius: 10, timeLimit: 90,
        check: (g) => g.distTo(252, 88) < 10,
        onTimeout: (g) => { g.phone('MAMA ROSA', 'Too slow, baby! The client walked. Grab the package again.'); } },
    ],
    reward: 800,
    complete: 'Clean delivery. The client is happy, and happy clients pay.',
  },
  {
    id: 3, name: 'HEAT', from: 'MAMA ROSA',
    intro: "The Vice Bay PD is onto you, Danny. Three stars! Lay low, break line of sight, and let the heat die down.",
    onStart: (g) => { g.setWanted(3); },
    stages: [
      { text: 'Lose the cops — get your wanted level to zero', target: null, radius: 0,
        check: (g) => g.wanted === 0 },
    ],
    reward: 1000,
    complete: 'Heat\'s off. You drive like a ghost, baby.',
  },
  {
    id: 4, name: 'THE BIG SCORE', from: 'MAMA ROSA',
    intro: "One last job, Danny. The Vice Bay Bank. Walk in, grab the cash, and get out. Then lose the cops and meet me at the safehouse.",
    stages: [
      { text: 'Get to the Vice Bay Bank on foot', target: { x: 36, z: 158 }, radius: 9,
        needsFoot: true,
        check: (g) => !g.inCar && g.distTo(36, 158) < 9,
        onEnter: (g) => { g.phone('MAMA ROSA', 'Inside! Grab the cash — stay by the vault!'); } },
      { text: 'Grab the cash — stay at the bank', target: { x: 36, z: 158 }, radius: 11, holdSeconds: 3,
        check: (g) => g.holdTimer >= 3,
        onEnter: (g) => { g.setWanted(4); g.phone('MAMA ROSA', 'ALARM! Four stars! Get to the safehouse, NOW!'); } },
      { text: 'Escape to the safehouse', target: { x: -252, z: 252 }, radius: 10,
        check: (g) => g.distTo(-252, 252) < 10 },
    ],
    reward: 2500,
    complete: 'WE DID IT! The whole city is talking about you, Danny. Vice Bay is yours.',
  },
];

export const STORY_COMPLETE_BONUS = 5000;
