import {
  BUILD_CATALOG,
  HIRE_CATALOG,
  NAVAL_CATALOG,
} from '../../marketplace/catalog';
import { festivalManualEntries } from '../../game/events/festivalRequirements';
import { WarBalance } from '../../game/war/WarBalance';

export interface ManualEntry {
  artKey?: string;
  title: string;
  subtitle?: string;
  body: string[];
}

export interface ManualSection {
  id: string;
  label: string;
  intro: string[];
  entries?: ManualEntry[];
  /** Extra freeform paragraphs after entries */
  outro?: string[];
}

const hireByRole = Object.fromEntries(
  HIRE_CATALOG.map((h) => [h.role, h])
);

function hireEntry(
  role: string,
  artKey: string,
  body: string[]
): ManualEntry {
  const h = hireByRole[role];
  return {
    artKey,
    title: h?.name ?? role,
    subtitle: h ? `${h.cost} gold to train` : undefined,
    body,
  };
}

function buildEntry(
  kind: string,
  artKey: string,
  body: string[]
): ManualEntry {
  const b = BUILD_CATALOG.find((x) => x.kind === kind);
  return {
    artKey,
    title: b?.name ?? kind,
    subtitle: b ? `${b.cost} gold` : undefined,
    body,
  };
}

const festivalExtra: Record<
  string,
  { benefits: string; scene: string }
> = {
  peasant: {
    benefits:
      'Your Majesty, nearby commoners feel lighter of heart — defection softens, and the lanes fill with chatter worth watching.',
    scene:
      'Cottages ring with dance, porch gossip, and shared loaves. Celebrants bob, pair off to talk, cheer “Huzzah!”, and pass cups — speech bubbles drift above their heads like incense.',
  },
  market: {
    benefits:
      'Merchants and peasants trade cheer for the feeling of prosperity; happiness climbs around the square.',
    scene:
      'Stalls bustle. Jesters mime music while shoppers awe at the spectacle, sample snacks, and gossip about bargains.',
  },
  harvest: {
    benefits:
      'The harvest multiplier rises while the revel lasts — food pressure eases after a good yield.',
    scene:
      'Farmers dance between furrows, raise cups toward the granary, and cheer the crop. Expect feast beats and “That tune lifts the heart.”',
  },
  tavern: {
    benefits:
      'A jester-led revel lifts spirits fast — the best antidote when raids have left folk dour.',
    scene:
      'Cups rise, jesters juggle, commoners dance shoulder-to-shoulder. Talk and cheer lines spill in bubbles over the tavern door.',
  },
  cathedral: {
    benefits:
      'A holy feast day under royal blessing steadies the realm — bishop and crown together reassure the faithful.',
    scene:
      'Bells, banners, and solemn awe mixed with cheer. Royals and bishop draw eyes; peasants whisper prayers and “Ooh!” toward the nave.',
  },
  harbor: {
    benefits:
      'Dockside songs celebrate the catch — fishermen feel proud, and the coastal quarter looks lively and fed.',
    scene:
      'Nets dry, boats rock, sailors and fishers dance on the pier with harbor cheers and shared fish stews.',
  },
  joust: {
    benefits:
      'Knights clash for glory under royal banners; crowd happiness soars and the barracks district becomes the place to be.',
    scene:
      'Lists open by the barracks when two or more knights serve. Knights mount horses, charge the lists, clash lances, and the crowd cheers the winner. Expect mount → charge → clash → cheer loops while the joust lasts.',
  },
};

export function buildManualSections(): ManualSection[] {
  const festivals = festivalManualEntries().map((f) => {
    const extra = festivalExtra[f.kind];
    return {
      artKey: f.kind === 'joust' ? 'prop:venueJoust' : 'prop:venueFestival',
      title: f.title,
      subtitle: `Requires: ${f.buildings} · ${f.units}`,
      body: [
        f.blurb,
        extra ? `What you will see: ${extra.scene}` : '',
        extra ? `Why it matters: ${extra.benefits}` : '',
      ].filter(Boolean),
    } satisfies ManualEntry;
  });

  return [
    {
      id: 'howto',
      label: 'How to rule',
      intro: [
        'I am Merlin, Your Majesty — wizard advisor to the crown. Fairy Tale Kingdom is a watchable realm: you inspect, you spend, you place stone and timber, and your subjects live their days inside a castle that breathes.',
        'Gold flows from Knowledge Quest — open Questions on desktop, or the menu on mobile — and from plunder recovered by your guards. Spend it in the Marketplace on buildings and ships; train folk at the workplaces where they will serve. Food and happiness keep people loyal; empty bellies and misery birth witches, thieves, and bandits.',
        'You begin with a lone keep on an empty map. Place houses for beds, a granary then fields for food, and a dungeon or barracks when order and steel are needed. Each holding you place expands the realm’s claim. The wilds are vast, and fringe camps already watch you.',
      ],
      entries: [
        {
          title: 'The sovereign loop',
          body: [
            'Watch life unfold: follow a cook through supper prep, or the king at morning court. Tap anyone to follow; open Details for job, room (“At: Banquet hall”), thoughts, and happiness.',
            'Answer reading questions for gold → buy buildings and boats from the Marketplace → click a building and Train the roles it supports.',
            'When a subject dreams of promotion, select them and read their Aspiration in the inspector. If every requirement is met, press Grant wish to promote them.',
            'Festivals, weddings, jousts, and camp life play out on their own. When raids loom, soldiers and archers leave the revel to hold the keep’s perimeter; guards keep patrolling claimed streets and holdings.',
          ],
        },
        {
          title: 'Reading and gold',
          body: [
            'Your treasury grows when you answer Knowledge Quest questions correctly. Learning Mode pays more gold per correct answer than Normal Mode, and automatically applies a gentle reading curriculum when you found a new kingdom.',
            'Learning Mode also grants a longer grace before the first raid, softer camp pressure, and fewer monsters at the start — time to learn the map before the horns blow.',
            'Gold funds Marketplace purchases and training costs at buildings. Promotions through Grant wish cost gold as well. Tavern losses from theft hurt less; guards return stolen coin when they arrest raiders.',
          ],
        },
        {
          title: 'Train at buildings',
          body: [
            'The Marketplace sells structures and ships — not people. To recruit, select a building and use its Train list: barracks for soldiers, dungeon for guards, cathedral for bishop and witch hunter, keep for royalty, and so on.',
            'Each building has role capacity — inspect Who works here and Capacity before you spend. Training checks beds (except royals, who live at keeps), royal gates, and unique slots such as one bishop or one fairy godmother.',
            'New subjects spawn at the building entrance and bind to that workplace.',
          ],
        },
        {
          title: 'Grant wish (aspirations)',
          body: [
            'Peasants and soldiers on the guard track sometimes set a career goal. Select them and scroll to Aspiration in the inspector.',
            'Merlin lists each requirement — dungeon built, barracks open, post capacity, gold on hand — with a ✓ or ✗ beside it. When all are satisfied, press Grant wish to promote them in place.',
            'In Learning Mode (or Sandbox → Fairy Godmother helps), the Fairy Godmother may auto-grant wishes with a poof when every requirement is met and she walks the realm.',
            'Peasants with dreams sometimes pray at the cathedral — click them to read their aspiration.',
            'This is how a peasant becomes a guard, soldier, knight, bishop, jester, or other career without hiring from the Marketplace.',
          ],
        },
        {
          title: 'Food first, then the castle',
          body: [
            'New peasants fill field farmer slots before bakeries, docks, markets, and finally castle staff. Place a field early so the realm eats — cooks and servants appear once farms are staffed (or a single steward if you have no fields yet).',
            'Subjects commute between real sites: houses on one fringe, fields and docks on another. Night sleep, meal hours, and work sites stick to buildings — royals sleep in chambers; villagers eat at home; court and castle staff dine in the banquet hall.',
          ],
        },
        {
          title: 'Kingdom borders',
          body: [
            'There is one keep. You lose if it falls. The realm’s border is not a wall — it is a gold overlay of overlapping circles around every standing holding (keep, houses, fields, docks, taverns, barracks, and the rest). Dirt paths, bridges, and ladders do not count. Place a house far away and it is still yours: an exclave with its own circle.',
            'Click the keep to paint that overlay. Subjects path through grass and doors as usual; the border does not block walking. Idle wander and random commute targets stay on claimed ground. Guards and soldiers on patrol visit claimed civic posts, houses, fields, and docks — including those exclaves. Fleeing, hunting, weddings, and orders you give can take people outside the claim.',
            'Raiders still march on the keep for gold and siege, but they may burn a claimed house or field they pass. Barracks and dungeon clicks still show a local military ring. Older saves may list Loyalty on inspectors — it no longer splits the map into rival fiefs.',
          ],
        },
        {
          title: 'One celebration at a time',
          body: [
            'The realm schedules a single major celebration at a time — a street festival or a royal ball, never both at once. After one ends, a cooldown passes before the next can begin; more eligible venues lengthen the gap slightly.',
            'If no festival type qualifies when the timer fires, the realm simply waits. Royal balls stay separate from street festivals. When a raid begins, active revels scatter — in Learning Mode this happens readily; in Normal Mode celebrations defer until peacetime returns.',
          ],
        },
        {
          title: 'Camera & mobile',
          body: [
            'Tap a person to follow the camera; pan the map to stop following. Pinch or use the −/+ buttons to zoom (hidden while a full sheet is open).',
            'On phones, following starts with a compact bottom bar so the map stays visible — Details expands the inspector; Hide collapses it again without unfollow.',
          ],
        },
        {
          title: 'Winning by surviving',
          body: [
            'You lose when the keep is destroyed. Soft early raids give you space to found — but never zero danger.',
          ],
        },
        {
          title: 'Learning vs Normal mode',
          body: [
            'When you start a new kingdom, choose Learning Mode for a calmer first week: longer raid grace, softer camp pressure, more gold per correct answer, no starter monsters, and undead off by default.',
            'Normal Mode is standard pressure — sooner raids, default gold per answer, and the wilds begin with a monster abroad. Switch modes only by starting a fresh kingdom save.',
          ],
        },
        {
          title: 'Sandbox settings',
          body: [
            'Open the hamburger menu → Sandbox settings. Tune raid intensity, which camps and monsters can appear, sickness, undead (beta — all off by default), and wall HP. These knobs live in this browser only — they are not part of a kingdom save.',
          ],
        },
      ],
    },
    {
      id: 'subjects',
      label: 'Subjects',
      intro: [
        'Every soul has a name, gender, schedule, job or role, workplace, house or keep, happiness, hunger, and a life log of thoughts. Click anyone to open the inspector — Job and Works at show where they labor.',
      ],
      entries: [
        hireEntry('peasant', 'unit:peasant', [
          'The backbone of the realm. Jobs fill food-first: farmer → baker → fisherman → merchant, then castle staff (cook, servant, steward, scribe, cupbearer). Train peasants at fields, bakeries, docks, markets, or the keep.',
          'They commute to real workplaces, flee when raids scream danger, join capped festival crowds (military stays on duty), marry, and raise children when beds allow.',
        ]),
        {
          artKey: 'unit:child',
          title: 'Child',
          body: [
            'Born to married couples who share a house. Children play in the streets and by the keep gate, grow up on the clock, and become peasants ready for careers. No training purchase — only family.',
          ],
        },
        hireEntry('guard', 'unit:guard', [
          'Train at the dungeon. Patrol claimed houses, fields, docks, and civic posts — pausing at cathedral, market, infirmary, tavern, bakery, granary, cemetery, and gallows on their rounds, including holdings far from the keep.',
          'Arrest thieves and necromancers when a dungeon exists, recover stolen gold, and keep walking threatened streets while soldiers hold the perimeter.',
        ]),
        hireEntry('soldier', 'unit:soldier', [
          'Train at the barracks. Defend the keep’s perimeter when any raid or siege hits. Peacetime they patrol claimed holdings; wartime they leave festivals and form the wall line. Join general detachments when ordered.',
        ]),
        hireEntry('archer', 'unit:archer', [
          'Train at the barracks. Prefer battlements with line-of-sight toward raiders. Climb ladders in a raid; otherwise patrol claimed holdings with the army.',
        ]),
        hireEntry('elite_guard', 'unit:elite_guard', [
          'Hardened melee for late pressure. Train at the barracks once king and queen reign and posts remain open.',
        ]),
        hireEntry('elite_archer', 'unit:elite_archer', [
          'Master bowmen for sieges and dragon-adjacent chaos. Train at the barracks with royalty seated.',
        ]),
        hireEntry('knight', 'unit:knight', [
          'Train at the barracks. Hunt schedule pathfinds to living monsters across the map (sleeping dragons first). Two or more unlock royal jousts when the crown and a civilian crowd are present.',
        ]),
        hireEntry('general', 'unit:general', [
          'Train at the barracks — one per realm. Issue detachment commands against camps, monsters, or vampire castles. Strategy is your hand on the frontier war.',
        ]),
        hireEntry('physician', 'unit:physician', [
          'Train at the infirmary. Plague-mask and all — keep one when curses and hunger spread disease.',
        ]),
        hireEntry('bishop', 'unit:bishop', [
          'Train at the cathedral once it stands. Marries couples (royal and peasant). Helps exorcise haunted houses with witch hunters. Unique.',
        ]),
        hireEntry('jester', 'unit:jester', [
          'Train at the tavern. Lifts spirits near keep and tavern. Unlocks tavern revels; mime music at festivals.',
        ]),
        hireEntry('dungeon_keeper', 'unit:dungeon_keeper', [
          'Train at the dungeon. Watches captives. Pair with guards and the gallows for a full justice pipeline.',
        ]),
        hireEntry('executioner', 'unit:executioner', [
          'Train at the dungeon or gallows. Carries out sentences — grim spectacle, clear dungeon beds.',
        ]),
        hireEntry('witch_hunter', 'unit:witch_hunter', [
          'Train at the cathedral. Hunts coven witches, aids exorcisms, and joins knights against vampire castles.',
        ]),
        hireEntry('king', 'unit:king', [
          'Train at the keep — sole monarch with the queen. Jeweled crown, fur-trimmed robe, and scepter. Unlocks royal buildings, barracks, balls, and succession.',
        ]),
        hireEntry('queen', 'unit:queen', [
          'Train at the keep beside the king. Full gown, crown, and veil. May bear a prince. Needed with the king for elites, manors, and jousts.',
        ]),
        {
          artKey: 'unit:prince',
          title: 'Prince',
          body: [
            'Born to the royal couple or present at court — coronet and noble cape. Can restore cursed princesses and marry a permanent princess at the cathedral. If both monarchs fall, a married prince and princess may succeed the throne.',
          ],
        },
        {
          artKey: 'unit:princess',
          title: 'Princess',
          body: [
            'Gown and diadem. Permanent after cathedral marriage to a prince. Temporary princesses come from Fairy Godmother blessings at balls (female peasants) and revert at morning if unwed. Restores frog princes.',
          ],
        },
        hireEntry('duke', 'unit:duke', [
          'Regional lord — noble trim and shoulder cape, lesser crown than the king. A second keep is no longer placeable; dukes remain in the roster for older saves.',
        ]),
        hireEntry('duchess', 'unit:duchess', [
          'Regional lady — noble dress without a full queen’s train. Same as a duke: leftover for older saves, not a second-keep unlock.',
        ]),
        hireEntry('fairy_godmother', 'unit:fairy_godmother', [
          'Train at the keep. Starry hat, flowing gown, and sparkle wand. At a royal ball, blesses a female peasant into a temporary princess. Unique.',
        ]),
        {
          artKey: 'unit:necromancer',
          title: 'Necromancer',
          body: [
            'Hostile night caster near cemeteries. Raises zombies. Guards arrest (not kill) them when a dungeon stands — same captive path as thieves.',
          ],
        },
        {
          artKey: 'unit:zombie',
          title: 'Zombie',
          body: [
            'Bite converts living subjects — outbreaks trigger guard quarantine. Soldiers aggro zombies in and near their sphere; civilians flee cordons.',
          ],
        },
        {
          artKey: 'unit:vampire_wife',
          title: 'Vampire Wife',
          body: [
            'Created when a vampire from a fringe castle bites a female subject at night. Knights and witch hunters hunt the castle; generals can target it like a camp.',
          ],
        },
      ],
    },
    {
      id: 'families',
      label: 'Families & weddings',
      intro: [
        'Villagers from different houses can fall in love and wish to marry. Open the inspector and grant marriage when the cathedral, bishop, and a home with room (or gold for a new house) are ready. Married couples may wish for a child — grant when a bed is free somewhere in the village. The Fairy Godmother may poof these wishes automatically in Learning Mode. Elders at 55+ look different; trades wear job clothes.',
      ],
      entries: [
        {
          artKey: 'prop:venueWedding',
          title: 'Weddings',
          body: [
            'Cross-household couples earn mutual marry aspirations. Grant the wish when a bishop serves at the cathedral and housing is ready — the full ceremony runs in the square, then spouses share a home.',
            'Ceremony stages: guests gather → aisle procession → bishop rite (“I do!”) → cheers → feast handoff in the keep banquet hall. Nearby guests (capped) gain happiness.',
            'Married pairs share a house when beds allow; a temporary ball-princess who weds a prince stays a princess forever.',
          ],
        },
        {
          artKey: 'unit:peasant',
          title: 'Peasant families',
          body: [
            'Married commoners may wish for a child — grant only when a free bed exists (yours or elsewhere in the village). Pregnancy lasts several days, then a child is born into the chosen house.',
            'Children play, grow, and join the workforce. No passive daily pregnancy rolls — children come from granted wishes. If a house is haunted or burned, tenants flee to other beds.',
          ],
        },
        {
          artKey: 'unit:king',
          title: 'Royal family',
          body: [
            'One king and queen kingdom-wide. They live at keeps (royal slots per keep). Extra keeps seat dukes and duchesses, not second monarchs. Succession: if both throne holders die, a married prince and princess may become the new king and queen.',
          ],
        },
        {
          artKey: 'prop:carriage',
          title: 'Parades & balls',
          body: [
            'Royal parades roll the carriage through influence. Royal balls revel in the keep courtyard (dance, toast, chatter) — Fairy Godmother blessings only work then. Indoor feasts fill the banquet hall on the royal schedule. Jesters juggle in the great hall and courtyard. Balls are separate from street festivals and obey the one-celebration-at-a-time rule.',
          ],
        },
      ],
    },
    {
      id: 'buildings',
      label: 'Buildings',
      intro: [
        'Buy structures from the Marketplace, then click the map to place them. Selecting a workplace lists Who works here and offers Train buttons. Burnable buildings can fall in raids and sieges — repair interrupts send peasants with hammers. Step inside a dwelling or the keep and the roof hides so you can see the floor plan.',
      ],
      entries: [
        buildEntry('keep', 'prop:keep', [
          'Heart of the realm — a large multi-room castle. Click it to see kingdom borders: a gold overlay around every claimed holding. Royal housing; castle staff workplaces; lose if this keep falls. Train king, queen, and fairy godmother here. See Castle life for the room guide.',
        ]),
        buildEntry('house', 'prop:house', [
          'Three beds. Starter homes for families — peasants need beds before you can train more commoners.',
        ]),
        buildEntry('manor', 'prop:manor', [
          'Twin-wing stone estate with slate roofs, banners, and a grand door — six beds. Needs king and queen.',
        ]),
        buildEntry('granary', 'prop:granary', [
          'Tall timber silo on stilts with grain sacks and a loading chute. +50% harvest while standing; unlocks 2 field slots.',
        ]),
        buildEntry('field', 'prop:field', [
          'Farmers harvest here (job capacity). Needs granary slots. Train peasants at the field.',
        ]),
        buildEntry('bakery', 'prop:bakery', [
          'Shop with bread-window, striped awning, and a brick oven chimney. Bakers soften food pressure. Step inside while a baker works — the roof hides to show the oven, counter, and kneading animation.',
        ]),
        buildEntry('market', 'prop:market', [
          'Merchants trade; market festivals gather here. Guards pause here on civic patrol. The roof hides to reveal stalls and weighing gestures while merchants work.',
        ]),
        buildEntry('tavern', 'prop:tavern', [
          'Cuts stolen gold; jesters train here; tavern revels lift spirits.',
        ]),
        buildEntry('infirmary', 'prop:infirmary', [
          'Sick-house for physicians and plague days. Train physicians here.',
        ]),
        buildEntry('cathedral', 'prop:cathedral', [
          'Holy hall — train bishop and witch hunter. Interior weddings gather at the altar with pews for guests; idle prayer fills the nave between ceremonies. Guards pause here on patrol.',
        ]),
        buildEntry('cemetery', 'prop:cemetery', [
          'Requires cathedral first. Funerals and (alas) necromancer attention at night when undead is enabled in Sandbox.',
        ]),
        buildEntry('dungeon', 'prop:dungeon', [
          'Prison with guard posts and military sphere. The roof hides to show cells and corridors. Guards escort arrested raiders, thieves, and necromancers here — you can watch the march. Four cells; when full, use the gallows.',
        ]),
        buildEntry('gallows', 'prop:gallows', [
          'Requires dungeon first. The executioner leads condemned captives here — hang VFX, no funeral confusion.',
        ]),
        buildEntry('barracks', 'prop:barracks', [
          'Train soldiers, archers, knights, elites, and general. Military sphere. Needs royalty.',
        ]),
        buildEntry('wall', 'prop:wall', [
          'One purchase places a straight run of three fort cells — the ghost preview follows your cursor and continues an existing wall when possible. Tough stone; raiders spend real time breaching. Connect segments for gates and ladders.',
        ]),
        buildEntry('ladder', 'prop:wallLadder', [
          'Snap to walls so your archers and soldiers reach the battlements. Foes do not climb them — only your defenders use the ladder.',
        ]),
        buildEntry('drawbridge', 'prop:drawbridge', [
          'Gate in the wall line — closes when raiders come. Snap onto an existing wall segment.',
        ]),
        buildEntry('ballista', 'prop:ballista', [
          'Auto-bolts at raiders. Royal gate.',
        ]),
        buildEntry('watchtower', 'prop:watchtower', [
          'Extends nearby archer range. Royal gate.',
        ]),
        buildEntry('bridge', 'prop:bridge', [
          'Span rivers (R to rotate). Ground units and monsters cross; dragons never needed one.',
        ]),
        buildEntry('dock', 'prop:dock', [
          'Coastal only (water-adjacent). Fishermen, boats, pirates, and harbor festivals.',
        ]),
      ],
    },
    {
      id: 'castle',
      label: 'Castle life',
      intro: [
        'The keep is a Stronghold-style machine with named rooms. When someone stands inside, the roof hides and you see kitchens, halls, and chambers. Follow staff and royals to watch the day unfold.',
      ],
      entries: [
        {
          artKey: 'prop:keep',
          title: 'The enlarged keep',
          body: [
            'A wide bailey with gate, courtyard, and an inner hall block. Click people inside to follow them room to room. Interior underlay shows distinct floors for each room.',
          ],
        },
        {
          title: 'Room guide',
          body: [
            'Gate and courtyard — arrivals, children at play, jester juggling, prince training.',
            'Great hall — morning court, steward inventory, bows to the throne.',
            'Banquet hall — midday and evening feasts, cupbearer service, wedding feast handoff.',
            'Kitchen — cooks knead and cook; hearth glows.',
            'Servants’ quarters — staff tidy and rest between chores.',
            'Royal chambers — sleep and private retirement for the crown and dukes.',
            'Solar — queen and princess study, scribe ledgers.',
            'Chapel nook — quiet prayers.',
            'Armory nook — prince gear and steel.',
          ],
        },
        {
          artKey: 'unit:peasant',
          title: 'Castle staff jobs',
          body: [
            'Peasants bind to open keep posts when capacity allows (alongside fields and shops):',
            'Cook (2) — kitchen prep → banquet service → scour. On-duty cooks slightly raise meal happiness.',
            'Servant (3) — quarters → chambers → hall → errands.',
            'Steward (1) — great hall prep and feast oversight.',
            'Scribe (1) — solar ledgers and court records.',
            'Cupbearer (1) — banquet and court service.',
            'Inspector shows Job + Works at: The Keep + At: <room>.',
          ],
        },
        {
          artKey: 'unit:king',
          title: 'A day at court',
          body: [
            'King: chambers → great hall court → midday feast → parade and paths → evening banquet → chambers.',
            'Queen: solar → chapel → feast host → garden walk → banquet → chambers.',
            'Prince: courtyard training → court → roads → armory → feast.',
            'Princess: solar arts → feast → courtyard stroll → chapel → banquet.',
            'Dukes and duchesses mirror a quieter local court at their keep.',
          ],
        },
        {
          title: 'Keep life beats',
          body: [
            'While folk occupy keep rooms you will see chatter, bows, serving lines, scrubbing, kneading, and juggling — speech bubbles and thoughts update so following feels alive.',
          ],
        },
      ],
    },
    {
      id: 'economy',
      label: 'Economy',
      intro: [
        'Food, gold, beds, and happiness are the four quiet ledgers behind every festival and mutiny.',
      ],
      entries: [
        {
          title: 'Food & hunger',
          body: [
            'Fields (and fishing boats) stock the larder. Meals interrupt schedules to eat. Empty stores breed sickness and foul moods.',
          ],
        },
        {
          title: 'Gold',
          body: [
            'Earn via Knowledge Quest reading questions — Learning Mode pays more per correct answer. Raiders steal from the keep; taverns blunt losses; guards recover plunder from arrested thieves.',
            'Spend on Marketplace buildings and ships, training at workplaces, Grant wish promotions, ransoms, and naval craft.',
          ],
        },
        {
          title: 'Beds & population',
          body: [
            'Houses hold 3, manors 6. No free bed, no training peasants or guards. Children need space too. Burned or haunted homes force moves.',
          ],
        },
        {
          title: 'Happiness',
          body: [
            'Festivals, weddings, jesters, and full bellies raise it. Sieges, hunger, curses, and fear lower it. Too low: peasants walk to a bandit, thief, or gypsy camp and only turn when they arrive — soldiers leave them alone until then. They keep their name and life log.',
          ],
        },
      ],
    },
    {
      id: 'careers',
      label: 'Careers & jobs',
      intro: [
        'Peasants dream of advancement. Inspect them to read their Aspiration, satisfy the listed requirements, and press Grant wish. Train fresh roles at the building that employs them.',
      ],
      entries: [
        {
          title: 'Civilian jobs',
          body: [
            'Food-first hiring order: Farmer → fields, then Baker → bakery, Fisherman → dock, Merchant → market, then Castle staff → keep (cook, servant, steward, scribe, cupbearer). Surplus staff rebalance onto new fields when you place them.',
            'Jobs bind a workplace near the subject when possible. Inspectors show Works at and At (keep room).',
          ],
        },
        {
          title: 'Grant wish promotions',
          body: [
            'Select a subject with a career goal. Aspiration lists every gate — eligible role, required buildings, open post capacity, and gold.',
            'Guards need dungeon slots; soldiers, archers, knights, and elites need barracks; bishop and witch hunter need cathedral; jester needs tavern; executioner needs gallows and dungeon; physician needs infirmary.',
            'When every line shows ✓, Grant wish spends gold and promotes them through the GameCommand channel into their new role.',
          ],
        },
        {
          title: 'Training vs promoting',
          body: [
            'Training at a building spawns a new subject into an open post. Grant wish promotes an existing subject who earned the dream.',
            'Building inspector: Who works here, Capacity, and Train buttons. Subject inspector: Job, Aspiration, and Grant wish.',
          ],
        },
        {
          title: 'Civic patrol life',
          body: [
            'Guards cycle claimed civic buildings — market, cathedral, infirmary, tavern, bakery, granary, cemetery, and gallows — and also visit houses, fields, docks, and manors, even when those sit far from the keep.',
            'The dungeon ring marks where arrests can begin; the cathedral hosts bishop schedules and weddings. Kingdom borders themselves are not a wall — they only decide where idle patrols and wander go.',
          ],
        },
      ],
    },
    {
      id: 'royalty',
      label: 'Royalty',
      intro: [
        'Court life is theater with stakes: room-by-room schedules in the keep, balls in the courtyard, banquet feasts, blessings, marriages, and the carriage on parade.',
      ],
      entries: [
        {
          artKey: 'unit:fairy_godmother',
          title: 'Fairy Godmother & balls',
          body: [
            'Train her at the keep. When a royal ball fires — one celebration at a time — the Fairy Godmother may transform a female peasant into a temporary princess. Unwed by morning, she returns to peasantry. Wed a prince at the cathedral to keep the tiara forever.',
          ],
        },
        {
          artKey: 'unit:bishop',
          title: 'Court & church',
          body: [
            'Train the bishop at the cathedral. He marries royals and commoners. Cathedral feast days need bishop plus king or queen. Witch hunters answer to the same holy roof.',
          ],
        },
        {
          artKey: 'prop:keep',
          title: 'One keep, one realm',
          body: [
            'Click the keep to see kingdom borders. Extra keeps are no longer placeable. Barracks and dungeon clicks still show a local military ring.',
          ],
        },
      ],
    },
    {
      id: 'enemies',
      label: 'Enemies',
      intro: [
        'Named foes live in camps, dens, and siege lines. They eat, drill, argue by the fire — then their leader picks a night to march.',
      ],
      entries: [
        {
          artKey: 'enemy:bandit',
          title: 'Bandit',
          body: [
            'Goal: gold and easy burnables. Camp life: sharpen blades, boast by the fire, sneak toward fields. Leaders toast granary strikes. Arrestable near dungeon guards.',
          ],
        },
        {
          artKey: 'enemy:goblin',
          title: 'Goblin',
          body: [
            'Small, mean, many. Warchiefs wait until the roster is thick, then spill toward walls in staggered raids. Distinct green ears and crude knives — easy to spot on the big map.',
          ],
        },
        {
          artKey: 'enemy:giant',
          title: 'Giant',
          body: [
            'Massive club brutes. They do not steal gold — they grab villagers, carry them to camp, and eat them. Kill the giant mid-retreat to free the captive. Camps show oversized lean-tos and propped clubs between stomps.',
          ],
        },
        {
          artKey: 'enemy:gypsy',
          title: 'Gypsy raider',
          body: [
            'Camp music and mischief. Can be arrested like thieves and bandits when guards and a dungeon are ready. Raid parties peel off when the leader sings for war.',
          ],
        },
        {
          artKey: 'enemy:enemy_army',
          title: 'Siege trooper',
          body: [
            'Professional pressure from siege camps: supply wagons, pavises, drill. Generals on both sides matter — theirs plan assaults; yours detach to burn their camp. No siege ladders — they breach walls and gates the hard way.',
          ],
        },
        {
          artKey: 'unit:witch',
          title: 'Witch',
          body: [
            'Coven-born. Goals: revenge curses — frogs, poison apples, aged limbs, pigs, sickness. Princesses restore frogs; princes restore poisoned princesses. Witch hunters and cathedrals answer them.',
          ],
        },
      ],
    },
    {
      id: 'monsters',
      label: 'Monsters',
      intro: [
        'Wild named beasts keep schedules. Early game they decorate the wilderness; later they pressure harder. Click to inspect, follow, and see its territory ring on the map.',
      ],
      entries: [
        {
          artKey: 'monster:troll',
          title: 'Troll',
          body: [
            'Hides in mountains by night, lurks forests by day, stalks paths at dusk. Not a siege engine — a roaming threat to lonely travelers and fringe builds.',
          ],
        },
        {
          artKey: 'monster:ogre',
          title: 'Ogre',
          body: [
            'Sleeps in woods, stomps roads, smashes near homes mid-day. Give it space or steel.',
          ],
        },
        {
          artKey: 'monster:dragon',
          title: 'Dragon',
          body: [
            'Sleeps in caves (knights can slay them asleep). Soars ridges, then dives on the keep to steal gold — the one errand that lets it fly outside its territory. Some are two-headed and greedier. Flies over water and mountains — bridges mean nothing to wyrms. Generals can hunt them.',
          ],
        },
        {
          artKey: 'prop:cave',
          title: 'Dragon caves',
          body: [
            'Nest markers on the fringe — and a dragon’s home for territory purposes. A sleeping dragon is a knight’s quest; a waking one is a treasury problem.',
          ],
        },
        {
          title: 'Territory & hunger',
          body: [
            'Every monster claims a home point (its spawn spot, or its cave for dragons) with a roaming sphere around it — click the monster to draw the ring, same as a keep or barracks influence circle. Wandering stays inside that ring.',
            'Hunger climbs the longer a monster goes without a meal. Past the threshold it abandons idle roaming and actively hunts the nearest subject still inside its sphere — a toast announces the hunt starting, and a successful bite quiets the hunger for a while.',
          ],
        },
        {
          artKey: 'prop:vampireCastle',
          title: 'Vampire castle',
          body: [
            'Appears and fades on the fringe. By day the castle sits quiet — any vampire wife born from it paths home and the roof hides to reveal a gloomy interior once she is inside, same as a house or keep. At night bats seek women to turn into vampire wives, and turned wives head back out to prowl and bite. Knights, witch hunters, and general orders can end the nest.',
          ],
        },
      ],
    },
    {
      id: 'encampments',
      label: 'Encampments',
      intro: [
        'Camps are places to watch. Click the camp for leader, roster (home vs away), supply (siege), and an influence sphere. Bandit, thief, and gypsy camps field real wandering named units inside that ring — click a person for their inspector. Leaders demoralize when slain until a successor rises.',
        'Miserable peasants flee on foot to the nearest bandit, thief, or gypsy camp (never giants or goblins). They stay peasant-looking until they arrive, then reskin and join the garrison. Soldiers will not attack them mid-journey.',
      ],
      entries: [
        {
          artKey: 'prop:banditCamp',
          title: 'Bandit camp',
          body: [
            'Tents, cookfires, crude fences — and living bandits pacing the sphere. Captain picks soft targets when the roster hits threshold. Accepts defectors.',
          ],
        },
        {
          artKey: 'prop:goblinCamp',
          title: 'Goblin camp',
          body: [
            'Spiked palisades and skull totems. Warchiefs love numbers — wait, recruit, then spill.',
          ],
        },
        {
          artKey: 'prop:giantCamp',
          title: 'Giant camp',
          body: [
            'Oversized lean-tos and log seats. Few giants still shake the ground when they march.',
          ],
        },
        {
          artKey: 'prop:thiefDen',
          title: 'Thief den',
          body: [
            'Night specialists with living cutpurses in the sphere. Arrests recover gold; ignore them and the keep bleeds quietly. Accepts defectors.',
          ],
        },
        {
          artKey: 'prop:gypsyCamp',
          title: 'Gypsy camp',
          body: [
            'Music by day, raids when the leader calls. Named wanderers in the sphere; accepts defectors. Inspect the roster before you ride out.',
          ],
        },
        {
          artKey: 'prop:covenCamp',
          title: 'Coven',
          body: [
            'Witch encampment. Rituals at night, curses by agenda. Burn it with hunters and detachments.',
          ],
        },
        {
          artKey: 'prop:siegeCamp',
          title: 'Siege camp',
          body: [
            'Supply-backed army camp with world-space supply. Multiple siege camps can exist late-game; each raids on its own jittered clock. Kill the siege general to blunt their rhythm.',
          ],
        },
      ],
      outro: [
        'Raids never sync across every camp — each keeps its own cooldown and leader decision. Toasts name the leader so you can find them on the great map.',
      ],
    },
    {
      id: 'combat',
      label: 'Combat & camps',
      intro: [
        'Walls, drawbridges, ballistae, and sphere patrols are your peacetime posture. Generals are your wartime finger.',
      ],
      entries: [
        {
          artKey: 'unit:general',
          title: 'Detachments',
          body: [
            'Select a general, choose troop count, and send them to destroy a camp or hunt a monster or castle. Troops leave peacetime patrol for the order, then return when done.',
          ],
        },
        {
          title: 'Raids & sieges',
          body: [
            'Bandits, goblins, and thieves steal gold and flee. Giants abduct villagers to eat at camp. Sieges bring engines, burning, and keep focus — they batter walls and gates; your ladders serve defenders only. Drawbridges slam; peasants repair.',
            'Any raid kicks military off balls and festivals: soldiers and archers hold the keep’s perimeter or walls; guards keep patrolling threatened streets and claimed holdings.',
          ],
        },
        {
          title: 'Wall placement',
          body: [
            'Buy a wall from the Marketplace, then move the cursor — a ghost preview of three connected cells follows, continuing any existing wall line when it can. Click to commit the run.',
            'Higher wall HP (tunable in Sandbox) buys time while archers on ladders answer from the battlements.',
          ],
        },
      ],
    },
    {
      id: 'roads',
      label: 'Bridges',
      intro: [
        'Rivers need timber. Subjects walk open grass; a bridge is how they (and ground monsters) cross water.',
      ],
      entries: [
        buildEntry('bridge', 'prop:bridge', [
          'Must cover water with land on both ends. Press R while placing to flip 0°/90°.',
        ]),
      ],
    },
    {
      id: 'spheres',
      label: 'Kingdom borders',
      intro: [
        'Select the keep to see the realm’s claim — overlapping gold circles around every standing holding. Barracks and dungeon still show a local military ring when you click them.',
      ],
      entries: [
        {
          artKey: 'prop:keep',
          title: 'How borders work',
          body: [
            'The border is the union of padded circles (~100 paces) around the keep and each living building: houses, manors, fields, docks, taverns, granaries, barracks, and so on. Paths, bridges, and ladders do not expand it. A far house or field is still claimed — an exclave — and still yours to patrol and still a target raiders may burn on the way to the keep.',
            'The overlay is a map, not a fence. Units walk through it. Idle wander snaps back onto claimed ground. Commutes, patrols, and physician house-calls go to real buildings even when those sit outside the keep’s old inner ring. Fleeing, hunts, and orders can leave the claim. You lose only if the keep falls.',
          ],
        },
        {
          artKey: 'prop:dungeon',
          title: 'Guards on claimed ground',
          body: [
            'Guards patrol houses, fields, docks, and civic posts across the claimed realm — not only the dungeon circle. During raids they keep walking threatened streets while the army holds the wall.',
          ],
        },
        {
          artKey: 'prop:barracks',
          title: 'Army on the perimeter',
          body: [
            'Soldiers, archers, knights, and elites muster to their keep’s threatened side (walls when available). After the raid, schedules resume.',
          ],
        },
      ],
    },
    {
      id: 'festivals',
      label: 'Festivals',
      intro: [
        'One major celebration at a time — festival or ball, never both. After it ends, a global gap must pass before the next begins.',
        'If no type qualifies when the timer fires, the realm simply waits. Royal balls stay separate from street festivals.',
        'Festivals invite a small nearest civilian crowd (about ten); balls about a dozen including court. Soldiers, archers, guards, and knights stay on duty. Joust crowds clear when the spectacle ends.',
        'While a festival runs, celebrants dance, talk (paired chat bubbles), mime music, cheer “Ooh! / Ahh! / Huzzah!”, and share feasts. Happiness rises; harvest festivals also nudge field yields.',
      ],
      entries: festivals,
    },
    {
      id: 'security',
      label: 'Security & outbreaks',
      intro: [
        'When the dead walk or the horns sound, guards take the city back with words and cordons.',
      ],
      entries: [
        {
          artKey: 'unit:guard',
          title: 'Cordons',
          body: [
            'Zombie outbreak, raid, or siege: quarantine hot zones, bark orders (“Stay back! Quarantine!”, “Raid incoming — get indoors!”), shove civilians toward the keep and houses. Soldiers clear hostiles. When quiet: “Cordon lifted. Resume patrol.”',
          ],
        },
        {
          artKey: 'unit:zombie',
          title: 'Undead playbook (beta)',
          body: [
            'Undead is experimental and off by default in both Learning and Normal mode — enable vampire, necromancer, or ghost toggles in Sandbox settings when you want the spooky layer.',
            'When on: necromancers raise at cemeteries → bites spread → arrest the caster, steel the shamblers. Ghosts haunt homes on death luck — tenants flee; bishop and witch hunter schedules gain exorcise beats.',
          ],
        },
      ],
    },
    {
      id: 'oceans',
      label: 'Oceans & docks',
      intro: [
        'The coast is a second granary — and a second battlefield.',
      ],
      entries: [
        buildEntry('dock', 'prop:dock', [
          'Place on coastal water edges. Starts a fishing presence; harbor festivals need fishermen.',
        ]),
        {
          artKey: 'prop:fishingBoat',
          title: NAVAL_CATALOG[0]!.name,
          subtitle: `${NAVAL_CATALOG[0]!.cost} gold`,
          body: [
            NAVAL_CATALOG[0]!.blurb,
            'Fishermen path to the dock, board, sail a short loop, and land food for the hunger ledger.',
          ],
        },
        {
          artKey: 'prop:warship',
          title: NAVAL_CATALOG[1]!.name,
          subtitle: `${NAVAL_CATALOG[1]!.cost} gold`,
          body: [
            NAVAL_CATALOG[1]!.blurb,
            'Pirates tint the horizon and strike docks — warships chase them off while guards crew the decks.',
          ],
        },
      ],
    },
    {
      id: 'day',
      label: 'Day by day',
      intro: [
        'The longer you reign, the louder the wilds become. Early days are soft but never safe.',
      ],
      entries: [
        {
          title: 'Pressure curve',
          body: [
            `Early pressure starts near ${Math.round(WarBalance.earlyPressureFactor(0, 0) * 100)}% and rises with days and population.`,
            `Fringe camps: up to ${WarBalance.maxCamps(0)} early → toward ${WarBalance.maxCamps(40)} later.`,
            `Siege camps: up to ${WarBalance.maxSiegeCamps(0)} early → up to ${WarBalance.maxSiegeCamps(40)} late.`,
            'Stronger home rosters raid larger parties more often once past their leader’s threshold. Monsters spawn more on older saves.',
          ],
        },
        {
          title: 'How to read a hard day',
          body: [
            'More camp toasts naming leaders, thicker siege supply bars, dragons awake more often, and happiness swinging on whether you still throw festivals between crises — remembering only one celebration runs at a time.',
          ],
        },
      ],
    },
  ];
}
