// What each stage teaches about being a real astronaut.
//   facts  short, sourced "Astronaut fact" lines Zeus Jr. drops during play (and the loading screen shows)
//   skill  the real astronaut skill the stage practises (shown when you finish)
//   tip    what real astronauts do, shown on the Sim over card
//   quiz   the mission debrief question after the stage
// Every fact must come from a real source. Never invent one.

const SRC = {
  nbl: { source: 'NASA Neutral Buoyancy Lab', url: 'https://www.nasa.gov/johnson/neutral-buoyancy-laboratory/' },
  diving: { source: 'NASA "Diving Down Deep"', url: 'https://nasa.gov/pdf/739540main_AP_ST_Chem_DivingDownDeep.pdf' },
  divers: { source: 'NASA podcast: underwater training', url: 'https://www.nasa.gov/podcasts/small-steps-giant-leaps/small-steps-giant-leaps-episode-108-underwater-training-for-astronauts/' },
  evaOps: { source: 'NASA Spacewalk Operations 101', url: 'https://ntrs.nasa.gov/api/citations/20240005248/downloads/EVA%20Ops%20101%20for%20Artemis%203%20External%20Teams.pdf' },
  parabolic: { source: 'NASA Parabolic Flight', url: 'https://www.nasa.gov/mission/parabolic-flight' },
  esaParabolic: { source: 'ESA Parabolic flights', url: 'https://www.esa.int/Education/Fly_Your_Thesis/Parabolic_flight' },
  arm: { source: 'Canadian Space Agency: Canadarm2', url: 'https://www.asc-csa.gc.ca/eng/iss/canadarm2/data-sheet.asp' },
  armTraining: { source: 'Canadian Space Agency: robotics training', url: 'https://www.asc-csa.gc.ca/eng/iss/robotics/robotics-training-centre.asp' },
  capture: { source: 'NASA Space Station blog', url: 'https://www.nasa.gov/blogs/spacestation/2026/04/13/canadarm2-reaches-out-and-captures-cygnus-xl-cargo-craft/' },
  orbit: { source: 'NASA Spot the Station FAQ', url: 'https://www.nasa.gov/missions/station/spot-the-station-frequently-asked-questions/' },
  flare: { source: 'NASA Solar Flares FAQ', url: 'https://science.nasa.gov/blogs/solar-cycle-25/2022/06/10/solar-flares-faqs/' },
  particles: { source: 'NASA Space Radiation Analysis Group', url: 'https://srag.jsc.nasa.gov/SpaceRadiation/What/What.cfm' },
  shelter: { source: 'NASA Orion radiation plan', url: 'https://www.nasa.gov/missions/artemis/orion/scientists-and-engineers-evaluate-orion-radiation-protection-plan/' },
  heraSensor: { source: 'NASA: protecting Artemis II astronauts', url: 'https://science.nasa.gov/missions/artemis/artemis-2/to-protect-artemis-ii-astronauts-nasa-experts-keep-eyes-on-sun/' },
  simulator: { source: 'NASA: Artemis II training', url: 'https://www.nasa.gov/centers-and-facilities/johnson/preparing-for-artemis-ii-training-for-a-mission-around-the-moon/' },
  lightFlash: { source: 'NASA: Apollo light flash investigations', url: 'https://ntrs.nasa.gov/citations/19760005597' },
  limit: { source: 'NASA radiation protection brief', url: 'https://www.nasa.gov/wp-content/uploads/2023/03/radiation-protection-technical-brief-ochmo.pdf' },
  moon: { source: 'NASA Moon facts', url: 'https://science.nasa.gov/moon/facts/' },
  lunarNight: { source: 'NASA Fission Surface Power', url: 'https://www.nasa.gov/centers-and-facilities/glenn/nasas-fission-surface-power-project-energizes-lunar-exploration/' },
  southPole: { source: "NASA: the Moon's south pole", url: 'https://www.nasa.gov/humans-in-space/moons-south-pole-is-full-of-mystery-science-intrigue/' },
  oxygen: { source: 'NASA Marshall: life support', url: 'https://www.nasa.gov/centers-and-facilities/marshall/the-bare-necessities-surviving-the-rigors-of-space-travel/' },
  marsDelay: { source: 'NASA Space Communications', url: 'https://www.nasa.gov/centers-and-facilities/goddard/space-communications-7-things-you-need-to-know/' },
};

const fact = (text, src) => ({ text, ...SRC[src] });

export const LESSONS = {
  hermes: {
    skill: 'Spacewalk training: planning your air and working in a heavy suit',
    tip: 'Real spacewalkers watch their air the whole time and head back with plenty to spare.',
    facts: [
      fact("NASA's training pool is 12 metres (40 feet) deep, big enough for a space station mock-up.", 'nbl'),
      fact('Astronauts practise about 7 hours in the pool for every 1 hour of a real spacewalk.', 'diving'),
      fact('Each astronaut in the pool gets 4 divers: 2 for safety, 1 to bring tools, 1 to film.', 'divers'),
      fact('Spacewalkers always go out in pairs, so they can check on and help each other.', 'evaOps'),
      fact('A pool training session can last up to 6 hours, all inside a heavy suit!', 'diving'),
    ],
    quiz: {
      question: 'Why do astronauts practise spacewalks in a giant pool?',
      options: [
        { text: 'Floating in water feels a lot like floating in space', correct: true },
        { text: 'Spacesuits only work underwater' },
        { text: 'Space is full of water' },
      ],
      explain: 'Divers add weights and floats so the astronaut neither sinks nor floats up. That is called *neutral buoyancy*, and it feels a lot like weightlessness.',
    },
  },
  odysseus: {
    skill: 'Weightless training: moving, catching and working while you float',
    tip: 'Real crews keep the air machine running first, then use what power is left for everything else.',
    facts: [
      fact('Each hill of a zero-G flight gives about 20 seconds of floating.', 'parabolic'),
      fact('One zero-G flight flies about 15 to 30 hills in a row.', 'parabolic'),
      fact('Climbing up each hill, you feel about 1.8 times heavier than normal.', 'esaParabolic'),
      fact('Astronauts float in orbit for the same reason you float on the plane: they are falling around Earth.', 'parabolic'),
    ],
    quiz: {
      question: 'Why do you float on a zero-G plane?',
      options: [
        { text: 'You and the plane are falling together', correct: true },
        { text: 'The plane flies above all the air' },
        { text: 'Magnets in the floor push you up' },
      ],
      explain: 'Over the top of each hill, you and the plane fall at the same speed, so you float. Astronauts in orbit are falling around Earth all the time, so they float too!',
    },
  },
  dioscuri: {
    skill: 'Robotics: steering the station\'s robot arm, and sharing power with science',
    tip: 'Real crews never switch off life support to run an experiment. Air always comes first.',
    facts: [
      fact("The station's robot arm, Canadarm2, is about 17 metres long, as long as 4 cars.", 'arm'),
      fact('Canadarm2 has 7 joints: three at the shoulder, one elbow and three at the wrist.', 'arm'),
      fact('Arm pilots use two hand controllers, one to move and one to turn, and watch camera screens.', 'armTraining'),
      fact("To catch a cargo ship, it waits about 10 metres away until the team says 'Go!'", 'capture'),
      fact('The station circles Earth every 90 minutes, so the crew sees 16 sunrises a day.', 'orbit'),
    ],
    quiz: {
      question: "What do astronauts use the station's robot arm for?",
      options: [
        { text: 'Catching cargo ships and moving experiments', correct: true },
        { text: "Cooking the crew's dinner" },
        { text: 'Pushing the station to go faster' },
      ],
      explain: 'Canadarm2 catches visiting cargo ships, moves big experiments, and even gives spacewalkers a ride!',
    },
  },
  hera: {
    skill: 'Piloting and space weather: flying the ship and sheltering from solar storms',
    tip: 'Real crews build their storm shelter as soon as the radiation alarm says to, and stay inside until it is safe.',
    facts: [
      fact('Light from a solar flare reaches us in about 8 minutes.', 'flare'),
      fact('The fastest flare particles can arrive in 15 to 30 minutes. Slower ones take hours or days.', 'particles'),
      fact("Orion's crew has about 1 hour to build their storm shelter out of supply bags.", 'shelter'),
      fact("Orion's radiation alarm, HERA, has sensors in six places around the cabin.", 'heraSensor'),
      fact('The Artemis II crew practised every part of their Moon flight in a simulator, even emergencies.', 'simulator'),
      fact('Apollo astronauts saw tiny flashes of light in the dark: space particles passing through their eyes.', 'lightFlash'),
      fact('NASA keeps a limit on how much radiation an astronaut may get in a whole career.', 'limit'),
    ],
    quiz: {
      question: 'A solar flare just flashed. What should a crew do?',
      options: [
        { text: 'Build the storm shelter before the particles arrive', correct: true },
        { text: 'Open a window to get a better look' },
        { text: 'Nothing: flares cannot hurt you' },
      ],
      explain: 'The flash of light comes first. The dangerous particles arrive minutes to hours later, so the flash is the crew\'s warning to build their shelter.',
    },
  },
  apollo: {
    skill: 'Running a Moon base: sharing power, making air and water, growing food and staying safe',
    tip: 'Real Moon crews plan for the long lunar night: only the machines that keep them alive get the batteries.',
    facts: [
      fact('Gravity on the Moon is one-sixth of Earth\'s, so you can hop really high.', 'moon'),
      fact('A lunar night lasts about 14 and a half Earth days, with no sunlight for solar panels.', 'lunarNight'),
      fact('At night the Moon gets down to about -173 °C (-280 °F).', 'moon'),
      fact('Some craters near the Moon\'s poles have not seen sunlight in billions of years.', 'southPole'),
      fact('NASA has found ice in the always-dark craters at the Moon\'s poles.', 'moon'),
      fact('The space station makes oxygen by running electricity through water.', 'oxygen'),
      fact('A radio message from Mars takes 4 to 24 minutes to reach Earth.', 'marsDelay'),
    ],
    quiz: {
      question: 'The Sun sets and you only have 2 battery plugs. What do you plug in?',
      options: [
        { text: 'The air machine and the heater', correct: true },
        { text: 'The big lights and the radio' },
        { text: 'The grow lights and the big lights' },
      ],
      explain: 'Air and warmth keep the crew alive. Everything else can wait for the Sun to come back and power the solar panels again.',
    },
  },
};

export function lessonFor(stageId) {
  return LESSONS[stageId] ?? null;
}

export function allFacts() {
  return Object.values(LESSONS).flatMap((l) => l.facts);
}

// Same answers in a new order, so the right one isn't always first.
export function shuffleQuiz(quiz, random = Math.random) {
  const options = quiz.options.map((o) => ({ ...o }));
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }
  return { ...quiz, options };
}
