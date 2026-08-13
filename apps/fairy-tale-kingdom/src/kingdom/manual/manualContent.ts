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
  extra: string[]
): ManualEntry {
  const h = hireByRole[role];
  return {
    artKey,
    title: h?.name ?? role,
    subtitle: h ? `${h.cost} gold` : undefined,
    body: [h?.blurb ?? '', ...extra].filter(Boolean),
  };
}

function buildEntry(
  kind: string,
  artKey: string,
  extra: string[]
): ManualEntry {
  const b = BUILD_CATALOG.find((x) => x.kind === kind);
  return {
    artKey,
    title: b?.name ?? kind,
    subtitle: b ? `${b.cost} gold` : undefined,
    body: [b?.blurb ?? '', ...extra].filter(Boolean),
  };
}

const festivalExtra: Record<
  string,
  { benefits: string; scene: string }
> = {
  peasant: {
    benefits:
      'Raises happiness for nearby commoners, softens the urge to defect, and fills the streets with chatter you can watch.',
    scene:
      'Clustered cottages host ring dances, porch gossip, and shared loaves. Celebrants bob, pair off to talk, cheer “Huzzah!”, and pass cups — speech bubbles float above their heads.',
  },
  market: {
    benefits:
      'Merchants and peasants trade cheer for coin-flow vibes; happiness climbs around the square and the realm feels prosperous.',
    scene:
      'Stalls bustle. Jesters (if any) mime music while shoppers awe at the spectacle, sample snacks, and gossip about bargains.',
  },
  harvest: {
    benefits:
      'Boosts the festival harvest multiplier so fields work harder while the revel lasts — food pressure eases after a good yield.',
    scene:
      'Farmers dance between furrows, raise cups to the granary, and cheer the crop. Expect feast beats and “That tune lifts the heart.”',
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
        extra ? `What goes on: ${extra.scene}` : '',
        extra ? `Why it matters: ${extra.benefits}` : '',
      ].filter(Boolean),
    } satisfies ManualEntry;
  });

  return [
    {
      id: 'howto',
      label: 'How to rule',
      intro: [
        'Fairy Tale Kingdom is a watchable realm. You hire, place, and inspect — subjects live their schedules inside a living castle and across the map, fight when pressed, and celebrate when the gates are met.',
        'Gold comes from Knowledge Quest answers (Questions in the menu on mobile; Market stays on the HUD) and recovered plunder. Spend it on beds, workplaces, walls, and careers. Food and happiness keep people loyal; empty stomachs and misery birth witches, thieves, and bandits.',
        'Start with a lone keep and hire your first peasants. Place houses for beds, a granary then fields for food, roads for patrols, and a dungeon or barracks when you need order and steel. Grow outward — the map is vast, and fringe camps watch you from the wilds.',
      ],
      entries: [
        {
          title: 'Day-to-day loop',
          body: [
            'Watch castle life unfold: follow a cook through supper prep, or the king at morning court. Tap anyone to follow; open Details for job, room (“At: Banquet hall”), thoughts, and happiness.',
            'Answer Knowledge Quest questions for gold → hire workers and place buildings from Market.',
            'Promote careers from career wishes (menu on mobile) when building capacity frees up.',
            'Watch festivals, staged weddings, mounted jousts, and camp life. When raids loom, trust sphere patrols — or send a general’s detachment.',
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
            'You lose when every keep is destroyed. Extra keeps seat dukes and buy time. Soft early raids give you space to found — but never zero danger.',
          ],
        },
        {
          title: 'Sandbox settings',
          body: [
            'Open the hamburger menu → Sandbox settings. Tune raid intensity, which camps and monsters can appear, sickness, undead pressure, and wall HP. These knobs are saved in this browser only — they are not part of a kingdom save.',
          ],
        },
      ],
    },
    {
      id: 'subjects',
      label: 'Subjects',
      intro: [
        'Every subject has a name, gender, schedule, job or role, workplace, house or keep, happiness, hunger, and a life log of thoughts. Click anyone to open the inspector — Job and Works at show where they labor.',
      ],
      entries: [
        hireEntry('peasant', 'unit:peasant', [
          'The backbone of the realm. Jobs include farmer, baker, merchant, fisherman, and castle staff (cook, servant, steward, scribe, cupbearer) at the keep. They flee indoors when cordons or raids scream danger, dance at festivals, marry, and raise children when beds allow.',
        ]),
        {
          artKey: 'unit:child',
          title: 'Child',
          body: [
            'Born to married couples who share a house. Children play in the streets and by the keep gate, grow up on the clock, and become peasants ready for careers. No marketplace hire — only family.',
          ],
        },
        hireEntry('guard', 'unit:guard', [
          'Home sphere: dungeon (keep fallback). Patrols roads and posts, arrests thieves and necromancers when a dungeon exists, recovers stolen gold, and shouts cordon orders during outbreaks.',
        ]),
        hireEntry('soldier', 'unit:soldier', [
          'Home sphere: barracks. Clears zombies, joins general detachments, escorts, and holds the street when guards quarantine.',
        ]),
        hireEntry('archer', 'unit:archer', [
          'Deadlier from wall-tops and watchtower range. Barracks-bound patrol with soldiers.',
        ]),
        hireEntry('elite_guard', 'unit:elite_guard', [
          'Hardened melee for late pressure. Needs king & queen plus barracks capacity.',
        ]),
        hireEntry('elite_archer', 'unit:elite_archer', [
          'Master bowmen for sieges and dragon-adjacent chaos. Royalty + barracks.',
        ]),
        hireEntry('knight', 'unit:knight', [
          'Slays sleeping dragons in caves. Two or more unlock royal jousts when the crown and a crowd are present.',
        ]),
        hireEntry('general', 'unit:general', [
          'Issue detachment commands against camps, monsters, or vampire castles. Strategy is your hand on the frontier war.',
        ]),
        hireEntry('physician', 'unit:physician', [
          'Heals the sick from the infirmary. Plague-mask and all — keep one when curses and hunger spread disease.',
        ]),
        hireEntry('bishop', 'unit:bishop', [
          'Marries couples at the cathedral (royal and peasant). Helps exorcise haunted houses with witch hunters. Unique.',
        ]),
        hireEntry('jester', 'unit:jester', [
          'Lifts spirits near keep and tavern. Unlocks tavern revels; mime music at festivals.',
        ]),
        hireEntry('dungeon_keeper', 'unit:dungeon_keeper', [
          'Watches captives. Pair with guards and the gallows for a full justice pipeline.',
        ]),
        hireEntry('executioner', 'unit:executioner', [
          'Carries out sentences at the gallows — grim spectacle, clear dungeon beds.',
        ]),
        hireEntry('witch_hunter', 'unit:witch_hunter', [
          'Hunts coven witches, aids exorcisms, and joins knights against vampire castles. Cathedral required.',
        ]),
        hireEntry('king', 'unit:king', [
          'Sole monarch with the queen — jeweled crown, fur-trimmed robe, and scepter. Unlocks royal buildings, barracks, balls, and succession. Lives at a keep.',
        ]),
        hireEntry('queen', 'unit:queen', [
          'Rules beside the king in a full gown, crown, and veil. May bear a prince. Needed with the king for elites, manors, and jousts.',
        ]),
        {
          artKey: 'unit:prince',
          title: 'Prince',
          body: [
            'Born to the royal couple or present at court — coronet and noble cape. Can restore cursed princesses and marry a permanent princess at the cathedral. If both monarchs fall, a married prince & princess may succeed the throne.',
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
          'Regional lord for an extra keep — noble trim and shoulder cape, lesser crown than the king. Spreads influence and softens the all-keeps-must-fall lose condition.',
        ]),
        hireEntry('duchess', 'unit:duchess', [
          'Regional lady for an extra keep — noble dress without a full queen’s train. Same strategic value as a duke.',
        ]),
        hireEntry('fairy_godmother', 'unit:fairy_godmother', [
          'Starry hat, flowing gown, and sparkle wand. At a royal ball, blesses a female peasant into a temporary princess. Unique.',
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
        'Love, houses, and heirs keep the parchment interesting. Watch couples court, marry under the bishop, and fill beds with children.',
      ],
      entries: [
        {
          artKey: 'prop:venueWedding',
          title: 'Weddings',
          body: [
            'A bishop at a cathedral can marry eligible pairs (including prince + princess).',
            'Ceremony stages: guests gather → aisle procession → bishop rite (“I do!”) → cheers → feast handoff in the keep banquet hall. Nearby guests (capped) gain happiness.',
            'Married pairs share a house when beds allow; a temporary ball-princess who weds a prince stays a princess forever.',
          ],
        },
        {
          artKey: 'unit:peasant',
          title: 'Peasant families',
          body: [
            'Married commoners who live together may become pregnant (multi-day). Children play, grow, and join the workforce. If a house is haunted or burned, tenants flee to other beds — overflow can lose people.',
          ],
        },
        {
          artKey: 'unit:king',
          title: 'Royal family',
          body: [
            'One king and queen kingdom-wide. They live at keeps (royal slots per keep). Extra keeps seat dukes/duchesses, not second monarchs. Succession: if both throne holders die, a married prince and princess may become the new king and queen.',
          ],
        },
        {
          artKey: 'prop:carriage',
          title: 'Parades & balls',
          body: [
            'Royal parades roll the carriage through influence. Royal balls revel in the keep courtyard (dance, toast, chatter) — Fairy Godmother blessings only work then. Indoor feasts fill the banquet hall on the royal schedule. Jesters juggle in the great hall and courtyard. Balls are separate from street festivals.',
          ],
        },
      ],
    },
    {
      id: 'buildings',
      label: 'Buildings',
      intro: [
        'Place from the marketplace. Selecting a workplace lists Who works here. Burnable buildings can fall in raids and sieges — repair interrupts send peasants with hammers. Step inside a dwelling or the keep and the roof hides so you can see the floor plan.',
      ],
      entries: [
        buildEntry('keep', 'prop:keep', [
          'Heart of the realm — now a large multi-room castle. Influence circle; royal housing; castle staff workplaces; lose only when all keeps fall. See Castle life for the room guide.',
        ]),
        buildEntry('house', 'prop:house', [
          'Three beds. Starter homes for hires and families.',
        ]),
        buildEntry('manor', 'prop:manor', [
          'Twin-wing stone estate with slate roofs, banners, and a grand door — six beds. Needs king & queen.',
        ]),
        buildEntry('granary', 'prop:granary', [
          'Tall timber silo on stilts with grain sacks and a loading chute — not a cottage. +50% harvest while standing; unlocks 2 field slots.',
        ]),
        buildEntry('field', 'prop:field', [
          'Farmers harvest here (job capacity). Needs granary slots.',
        ]),
        buildEntry('bakery', 'prop:bakery', [
          'Shop with bread-window, striped awning, and a brick oven chimney. Bakers soften food pressure.',
        ]),
        buildEntry('market', 'prop:market', [
          'Merchants trade; market festivals gather here.',
        ]),
        buildEntry('tavern', 'prop:tavern', [
          'Cuts stolen gold; jesters; tavern revels.',
        ]),
        buildEntry('infirmary', 'prop:infirmary', [
          'Sick-house for physicians and plague days.',
        ]),
        buildEntry('cathedral', 'prop:cathedral', [
          'Weddings, witch hunters, holy feast days, funerals nearby with a cemetery.',
        ]),
        buildEntry('cemetery', 'prop:cemetery', [
          'Funerals and (alas) necromancer attention at night.',
        ]),
        buildEntry('dungeon', 'prop:dungeon', [
          'Captives, guard posts (sphere), dungeon keeper. Required to arrest.',
        ]),
        buildEntry('gallows', 'prop:gallows', [
          'Executions with an executioner — clear the dungeon the hard way.',
        ]),
        buildEntry('barracks', 'prop:barracks', [
          'Soldiers, archers, knights, general capacity and military sphere. Needs royalty.',
        ]),
        buildEntry('wall', 'prop:wall', [
          'One buy places a straight run of three fort cells (continues an existing wall when possible). Tough stone — expect raiders to spend real time breaching. Connect segments for gates and stairs.',
        ]),
        buildEntry('stairs', 'prop:stairs', [
          'Snap to walls so defenders reach the battlements.',
        ]),
        buildEntry('drawbridge', 'prop:drawbridge', [
          'Gate in the wall line — closes when raiders come.',
        ]),
        buildEntry('ballista', 'prop:ballista', [
          'Auto-bolts at raiders. Royal gate.',
        ]),
        buildEntry('watchtower', 'prop:watchtower', [
          'Extends nearby archer range. Royal gate.',
        ]),
        buildEntry('road', 'prop:road', [
          'Cheap dirt paths patrols prefer. You place them — no starter crossroads.',
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
            'Gate & courtyard — arrivals, children at play, jester juggling, prince training.',
            'Great hall — morning court, steward inventory, bows to the throne.',
            'Banquet hall — midday and evening feasts, cupbearer service, wedding feast handoff.',
            'Kitchen — cooks knead and cook; hearth glows.',
            'Servants’ quarters — staff tidy and rest between chores.',
            'Royal chambers — sleep and private retirement for the crown and dukes.',
            'Solar — queen/princess study, scribe ledgers.',
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
            'King: chambers → great hall court → midday feast → parade/paths → evening banquet → chambers.',
            'Queen: solar → chapel → feast host → garden walk → banquet → chambers.',
            'Prince: courtyard training → court → roads → armory → feast.',
            'Princess: solar arts → feast → courtyard stroll → chapel → banquet.',
            'Dukes/duchesses mirror a quieter local court at their keep.',
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
            'Earn via Knowledge Quest. Raiders steal from the keep; taverns blunt losses; guards recover plunder from arrested thieves. Spend on hires, buildings, careers, ransoms, and ships.',
          ],
        },
        {
          title: 'Beds & population',
          body: [
            'Houses hold 3, manors 6. No bed, no hire. Children need space too. Burned or haunted homes force moves.',
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
        'Peasants dream in the To-Do panel. Promote them when the building has free capacity and you can pay the career cost.',
      ],
      entries: [
        {
          title: 'Civilian jobs',
          body: [
            'Farmer → fields. Baker → bakery. Merchant → market. Fisherman → dock (boats sail short loops and return food).',
            'Castle staff → keep: cook, servant, steward, scribe, cupbearer (see Castle life).',
            'Jobs bind a workplace — inspectors show Works at (and At: room inside the keep).',
          ],
        },
        {
          title: 'Career promotions',
          body: [
            'Guards need dungeon slots; soldiers/archers/knights/elites/general need barracks; physicians need infirmary; bishop & witch hunter need cathedral; jester needs tavern; executioner needs gallows. Capacity is per building — build more posts to promote more souls.',
            'On mobile, open the hamburger menu for career wishes; Market stays on the compact HUD.',
          ],
        },
        {
          title: 'Workplace inspectors',
          body: [
            'Subject inspector: Job + Works at + At (keep room). Building inspector: Who works here (name + job). Empty workplaces wait for your next hire or promotion.',
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
            'When a royal ball fires at the keep, the FGM may transform a female peasant into a temporary princess. Unwed by morning, she returns to peasantry. Wed a prince at the cathedral to keep the tiara forever.',
          ],
        },
        {
          artKey: 'unit:bishop',
          title: 'Court & church',
          body: [
            'Bishop marries royals and commoners. Cathedral feast days need bishop plus king or queen. Witch hunters answer to the same holy roof.',
          ],
        },
        {
          artKey: 'prop:keep',
          title: 'Influence & dukes',
          body: [
            'Keeps paint influence. Barracks and dungeons paint military spheres. Extra keeps → dukes/duchesses and a wider safety net against total defeat.',
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
            'Slow power. Chieftains hold until strong, then smash. Camp naps and perimeter stomps fill the day between assaults.',
          ],
        },
        {
          artKey: 'enemy:gypsy',
          title: 'Gypsy raider',
          body: [
            'Camp music and mischief. Can be arrested like thieves/bandits when guards and a dungeon are ready. Raid parties peel off when the leader sings for war.',
          ],
        },
        {
          artKey: 'enemy:enemy_army',
          title: 'Siege trooper',
          body: [
            'Professional pressure from siege camps: supply wagons, pavises, drill. Generals on both sides matter — theirs plan assaults; yours detach to burn their camp.',
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
            'Select a general, choose troop count, and send them to destroy a camp or hunt a monster/castle. Troops leave their sphere for the order, then return to patrol when done.',
          ],
        },
        {
          title: 'Raids & sieges',
          body: [
            'Stealers grab gold and flee home. Sieges bring engines, burning, and keep focus. Drawbridges slam; peasants repair; festivals pause for fear.',
          ],
        },
      ],
    },
    {
      id: 'roads',
      label: 'Roads & bridges',
      intro: [
        'You paint the kingdom’s veins. Patrols prefer your dirt roads; rivers need your timber.',
      ],
      entries: [
        buildEntry('road', 'prop:road', [
          'Snap to grass. Link keep to fields, docks, and walls so guards actually walk where you care.',
        ]),
        buildEntry('bridge', 'prop:bridge', [
          'Must cover water with land (or road) on both ends. Press R while placing to flip 0°/90°.',
        ]),
      ],
    },
    {
      id: 'spheres',
      label: 'Military spheres',
      intro: [
        'Select barracks or dungeon to see the influence ring (keeps show theirs too).',
      ],
      entries: [
        {
          artKey: 'prop:dungeon',
          title: 'Guard sphere (dungeon)',
          body: [
            'Guards post and patrol inside. They inspect civic buildings, prefer roads, and bark “All clear on this street.” Leave only for arrests, cordons, or general orders.',
          ],
        },
        {
          artKey: 'prop:barracks',
          title: 'Army sphere (barracks)',
          body: [
            'Soldiers, archers, knights, elites. Same road-loving patrol, same return-home rule after exceptions.',
          ],
        },
      ],
    },
    {
      id: 'festivals',
      label: 'Festivals',
      intro: [
        'No generic street fair filler — if no type qualifies when the timer fires, the realm simply waits. Royal balls stay separate.',
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
            'Zombie outbreak, raid, or siege: quarantine hot zones, bark orders (“Stay back! Quarantine!”, “Raid incoming — get indoors!”), shove civilians toward safe keeps/houses in clear spheres. Soldiers clear hostiles. When quiet: “Cordon lifted. Resume patrol.”',
          ],
        },
        {
          artKey: 'unit:zombie',
          title: 'Undead playbook',
          body: [
            'Necromancers raise at cemeteries → bites spread → arrest the caster, steel the shamblers. Ghosts haunt homes on death luck — tenants flee; bishop & witch hunter schedules gain exorcise beats.',
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
            'More camp toasts naming leaders, thicker siege supply bars, dragons awake more often, and happiness swinging on whether you still throw festivals between crises.',
          ],
        },
      ],
    },
  ];
}
