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
  peasant:
    {
      benefits:
        'Cheer is contagious, Your Majesty. Folk stay put instead of packing for bandit country, and the lanes fill with gossip I can actually recommend.',
      scene:
        'Cottages bounce, loaves travel hand to hand, and speech bubbles drift about like incense that learned to spell Huzzah.',
    },
  market: {
    benefits:
      'The square feels prosperous, which is half of actually being prosperous. Happiness climbs where the stalls are.',
    scene:
      'Jesters mime the orchestra, shoppers gasp on cue, and someone always has an opinion about bargains.',
  },
  harvest: {
    benefits:
      'Fields work a little harder while the revel lasts. Feed the party, and the party feeds you back.',
    scene:
      'Farmers dance between furrows and toast the granary as if it might blush.',
  },
  tavern: {
    benefits:
      'The fastest known cure for “we just got raided.” Spirits rise where cups rise.',
    scene:
      'Shoulder-to-shoulder dancing, juggling, and talk bubbling out the tavern door.',
  },
  cathedral: {
    benefits:
      'Bishop plus crown equals a realm that remembers it has a soul. The faithful steady; the dour unclench.',
    scene:
      'Bells, banners, whispered prayers, and the occasional Ooh toward the nave.',
  },
  harbor: {
    benefits:
      'Fishermen feel proud of the catch, which is excellent, because hungry fishermen invent worse hobbies.',
    scene:
      'Nets, boats, pier dances, and stew that smells like victory if victory were briny.',
  },
  joust: {
    benefits:
      'Glory for the knights, happiness for the crowd, and a barracks district that briefly becomes the center of the universe.',
    scene:
      'Two or more knights, horses, lists, a charge, a clash, a cheer — then they do it again because we are not made of stone.',
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
        'I am Merlin, Your Majesty — wizard, advisor, and the fellow who talks to the furniture when you are busy. Fairy Tale Kingdom is a realm you watch as much as you command. People wake, walk, gossip, farm, flee, marry, and occasionally get frog-marched to a dungeon while you sip questions-for-gold.',
        'You start with one keep on a suspiciously empty map. Place houses so souls have beds, a granary then fields so they eat, and a dungeon or barracks when the wilds remember you exist. Every holding you plant paints a little more of the map as yours. Camps on the fringe are already taking notes.',
        'Gold comes from Knowledge Quest — Questions on desktop, the menu on a phone — and from plunder your guards politely confiscate. Spend it on buildings and ships; train folk at the workplaces they will haunt forever. Hungry and unhappy people invent hobbies: witchcraft, theft, and walking off to join a camp.',
      ],
      entries: [
        {
          title: 'The sovereign loop',
          body: [
            'Watch first. Tap a cook, a king, a necromancer you regret spawning — the camera follows, Details tells you their job, room, thoughts, and whether they are plotting to leave you.',
            'Answer reading questions for gold. Buy stone and timber from the Marketplace. Click a building and Train whoever that roof actually employs. When a peasant dreams of promotion, Grant wish if every tick on their list is honest.',
            'Festivals, weddings, jousts, and campfires run themselves. When horns blow, soldiers and archers leave the dance for the walls; guards keep walking the streets you claimed, because someone has to tell civilians to get indoors.',
          ],
        },
        {
          title: 'Reading and gold',
          body: [
            'Your treasury is a library with better lighting. Correct answers mint coin. Learning Mode pays more, starts gentler, and sneakily applies a reading curriculum when you found a kingdom.',
            'Gold buys Marketplace wonders, training, Grant wish, ransoms, and boats. Taverns blunt theft. Guards who arrest cutpurses bring the coin home, which is my favorite kind of magic: the kind that jingles.',
          ],
        },
        {
          title: 'Train at buildings',
          body: [
            'The Marketplace sells roofs, not résumés. People appear when you click a building and Train: dungeon for guards, barracks for steel, cathedral for holy trouble, keep for crowns.',
            'Each workplace has a guest list. Inspect Who works here and Capacity before you spend. Beds matter — except royals, who sleep at the keep like civilized dragons. Unique posts (one bishop, one fairy godmother, one general) mean I will stop you from cloning the clergy.',
            'New souls pop at the door and glue themselves to that workplace. Very loyal. Slightly sticky.',
          ],
        },
        {
          title: 'Grant wish (aspirations)',
          body: [
            'Peasants and ambitious soldiers sometimes acquire a career the way moss acquires a wall: slowly, then all at once. Open them. Scroll to Aspiration. I mark each requirement with a smug little tick or a tragic cross.',
            'When the list is all ticks, Grant wish spends gold and they become the thing they dreamed — guard, knight, bishop, jester — without you shopping for a stranger.',
            'In Learning Mode, or if you let the Fairy Godmother help in Sandbox, she may poof a ready wish on her own. Peasants with dreams also loiter at the cathedral. Click them. They will confess.',
          ],
        },
        {
          title: 'Arrest, cells, and the gallows',
          body: [
            'Every person has Arrest in their inspector. If you keep a dungeon with an empty cell and a free guard who is not the accused, that guard will path to them and escort them in — same march you see for thieves and night-casters. Four cells. Full? The dungeon inspector plus a gallows and an executioner finish the story with a rope, not a funeral mix-up.',
            'This is how you delete a necromancer you no longer find charming. Also peasants you have grown tired of. I do not judge. I merely take notes.',
          ],
        },
        {
          title: 'Food first, then the castle',
          body: [
            'New peasants fill farmer slots before bakers, fishers, merchants, and finally the glittering keep jobs. Place a field early or your cooks will have nothing to cook except anxiety.',
            'Folk commute to real doors. Night is for sleep, meal hours are for eating, royals dine in the banquet hall, villagers at home. If you scatter houses to one fringe and farms to another, enjoy the walking. I do.',
          ],
        },
        {
          title: 'Kingdom borders',
          body: [
            'One keep. If it falls, so do you. The border is not a wall — it is overlapping gold circles around every standing holding: houses, fields, docks, taverns, the lot. Dirt paths, bridges, and ladders do not count. Drop a cottage on the moon (metaphorically) and it is still yours: an exclave with its own halo.',
            'Click the keep to paint the overlay. It does not block walking. Idle wandering stays claimed; hunts, weddings, fleeing, and your orders may leave it. Raiders still want the keep, but they may torch a claimed house or field they pass, because they are rude.',
            'Barracks and dungeon clicks still show a local military ring. Older saves may mutter about Loyalty. Ignore them. We do not run rival fiefs anymore. I retired that headache.',
          ],
        },
        {
          title: 'One celebration at a time',
          body: [
            'The realm is not a carnival with infinite tents. One major party — street festival or royal ball — then a rest. More venues make the rest a hair longer, which is how buildings change the calendar, not just the skyline.',
            'If nothing qualifies when the timer coughs, we wait. Raids scatter revels; Learning Mode is especially willing to cancel the dancing. Normal Mode prefers peacetime parties.',
          ],
        },
        {
          title: 'Camera & mobile',
          body: [
            'Tap a soul to follow. Pan to stop. Pinch or −/+ to zoom — those buttons hide when a full sheet is hogging the screen, which is etiquette.',
            'On phones, following starts as a slim bottom bar so you can still see the murder, the wedding, or the cow. Details expands. Hide collapses without unfollowing. Very modern. I still prefer a crystal ball.',
          ],
        },
        {
          title: 'Winning by surviving',
          body: [
            'There is no parade that declares you won. You lose when the keep is rubble. Early raids are polite-ish, never toothless.',
          ],
        },
        {
          title: 'Learning vs Normal mode',
          body: [
            'Learning Mode: longer before the first raid, softer camps, more gold per correct answer, no starter monster, undead asleep. A tutorial with better hats.',
            'Normal Mode: the wilds already have a monster, raids come sooner, gold is standard. Switch only by founding a fresh save. I cannot un-spill that milk.',
          ],
        },
        {
          title: 'Sandbox settings',
          body: [
            'Hamburger menu, Sandbox settings: raid spice, which camps and monsters may appear, sickness, undead (beta, off unless you are feeling haunted), wall HP. These knobs live in this browser. They are not packed into the kingdom save, so do not expect a different computer to remember your taste in dragons.',
          ],
        },
      ],
    },
    {
      id: 'subjects',
      label: 'Subjects',
      intro: [
        'Every soul has a name, a schedule, a workplace, a bed or a tragic lack of one, hunger, happiness, and a life log of thoughts they should not have said out loud. Click anyone. Job and Works at tell you which roof they serve. Arrest is how you introduce them to a cell.',
        'People change the map by commuting, patrolling, fleeing, marrying, healing, defecting, and dying picturesquely. Buildings change people by giving them jobs, beds, and reasons to stay. Remove the roof, and they become a problem with legs.',
      ],
      entries: [
        hireEntry('peasant', 'unit:peasant', [
          'The glue. Jobs fill food-first: farmer, baker, fisher, merchant, then castle staff. Train them at fields, bakeries, docks, markets, or the keep.',
          'They commute, flee raids, join a small festival crowd, marry, and raise children if beds exist. Homeless peasants leak happiness every hour and run to a camp faster than housed ones. Give them a house. Or Arrest them. I am flexible.',
        ]),
        {
          artKey: 'unit:child',
          title: 'Child',
          body: [
            'Born when you grant a married couple’s wish and a bed exists. They play by the keep gate, grow on the clock, and become peasants. You cannot buy one at the market, which is for the best.',
            'Unhoused children sour quickly too. A burned cottage is a family plot, not just architecture.',
          ],
        },
        hireEntry('guard', 'unit:guard', [
          'Train at the dungeon. They patrol claimed houses, fields, docks, and civic stops — cathedral, market, infirmary, tavern, bakery, granary, cemetery, gallows — even exclaves you parked on the horizon.',
          'They arrest thieves and necromancers when a cell is free, recover stolen gold, bark cordons in crises, and escort anyone you Arrest from an inspector. Soldiers hold the wall. Guards hold the gossip and the prisoners.',
        ]),
        hireEntry('soldier', 'unit:soldier', [
          'Train at the barracks. In peace they wander claimed ground. In war they abandon festivals, form the keep’s perimeter, and look heroic. Generals may borrow them for detachments, which is a fancy word for “please go set that camp on fire.”',
        ]),
        hireEntry('archer', 'unit:archer', [
          'Train at the barracks. They prefer battlements with a view of people who deserve arrows. Ladders are for our side only. Foes do not get the courtesy of climbing.',
        ]),
        hireEntry('elite_guard', 'unit:elite_guard', [
          'A guard who has been through worse. Needs king and queen and an open barracks post. Same arrest-and-patrol magic, louder clank.',
        ]),
        hireEntry('elite_archer', 'unit:elite_archer', [
          'For sieges and dragon-adjacent nonsense. Royalty must be seated first, or I pretend not to hear the request.',
        ]),
        hireEntry('knight', 'unit:knight', [
          'They path across the map to living monsters — sleeping dragons first, because even heroes like easy wins. Two knights plus a crowd plus a crown unlock jousts, which change the barracks lawn into theater.',
        ]),
        hireEntry('general', 'unit:general', [
          'One per realm. Point them at a camp, monster, or vampire castle and choose how many troops tag along. Strategy is your finger. I merely supply the sarcasm.',
        ]),
        hireEntry('physician', 'unit:physician', [
          'Train at the infirmary. When someone is injured, they walk to that person — across the map if they must — instead of loitering at the sick-house hoping the wounded will crawl in.',
          'Plague masks, house calls, and the occasional reminder that hunger and curses are medical problems dressed as plot.',
        ]),
        hireEntry('bishop', 'unit:bishop', [
          'One holy specialist. Marries couples in the cathedral — royals and peasants alike — and helps witch hunters evict ghosts from haunted cottages. No bishop, no “I do,” no tidy succession of in-laws.',
        ]),
        hireEntry('jester', 'unit:jester', [
          'Train at the tavern. They raise nearby happiness, unlock tavern revels, mime music at festivals, and juggle in the keep because gravity is optional if you work in comedy.',
        ]),
        hireEntry('dungeon_keeper', 'unit:dungeon_keeper', [
          'Watches the cells so the prisoners do not get bored enough to start a union. Pair with guards (intake) and an executioner (outtake).',
        ]),
        hireEntry('executioner', 'unit:executioner', [
          'Trains at dungeon or gallows. Leads a condemned captive to the scaffold, hangs them with appropriate theater, and frees a cell. This is how justice changes population without a funeral mix-up at the cemetery.',
        ]),
        hireEntry('witch_hunter', 'unit:witch_hunter', [
          'Cathedral steel. They hunt coven witches, join exorcisms, and ride with knights against vampire castles. Witches change people into frogs and worse; hunters change witches into regrets.',
        ]),
        hireEntry('king', 'unit:king', [
          'One, with the queen. Unlocks royal buildings, barracks careers, balls, and the feeling that the map finally has a protagonist. If he falls, succession gets creative.',
        ]),
        hireEntry('queen', 'unit:queen', [
          'One, with the king. May bear a prince. Needed for elites, manors, and jousts. Hosts feasts. Judges your wallpaper. I serve at her pleasure and the king’s, which is a lot of pleasure to juggle.',
        ]),
        {
          artKey: 'unit:prince',
          title: 'Prince',
          body: [
            'Coronet, cape, courtyard drills. Restores cursed princesses. Marries a permanent princess at the cathedral. If both monarchs fall, a married prince and princess may inherit the headache of ruling.',
          ],
        },
        {
          artKey: 'unit:princess',
          title: 'Princess',
          body: [
            'Diadem and plot armor. A ball peasant blessed by the Fairy Godmother is temporary until morning unless she weds a prince. She restores frog princes, which is a sentence I say with a straight face.',
          ],
        },
        hireEntry('duke', 'unit:duke', [
          'Leftover nobility from when we toyed with extra keeps. You cannot plant a second keep now. If an old save still has a duke, treat him as decorative worry.',
        ]),
        hireEntry('duchess', 'unit:duchess', [
          'Same story in a better dress. Older saves only. The realm has one heart, and it is the keep.',
        ]),
        hireEntry('fairy_godmother', 'unit:fairy_godmother', [
          'Unique. Train at the keep. At a royal ball she may turn a female peasant into a temporary princess. She may also auto-grant ready wishes in Learning Mode. Sparkles are a gameplay system. I have made peace with that.',
        ]),
        {
          artKey: 'unit:necromancer',
          title: 'Necromancer',
          body: [
            'A night-school graduate who loiters near cemeteries and raises zombies. They change the living into the uncooperative. Guards Arrest them into cells rather than politely debating necromancy. You may also Arrest them yourself from their inspector, which I recommend.',
          ],
        },
        {
          artKey: 'unit:zombie',
          title: 'Zombie',
          body: [
            'Bites convert. Outbreaks summon guard cordons. Soldiers pick fights with shamblers; civilians remember they have legs. Steel the walkers, jail the caster.',
          ],
        },
        {
          artKey: 'unit:vampire_wife',
          title: 'Vampire Wife',
          body: [
            'A fringe vampire castle bites a woman at night and the map gains a new nocturnal hobby. By day she may path home and the castle roof hides like any house. Knights, witch hunters, and a general’s order can end the nest.',
          ],
        },
      ],
    },
    {
      id: 'families',
      label: 'Families & weddings',
      intro: [
        'Love is a scheduling problem with better lighting. Villagers from different houses can wish to marry. Grant it when a bishop serves at the cathedral and a home has room — or gold for a new house. Married pairs may wish for a child when a bed exists somewhere. The Fairy Godmother may poof these in Learning Mode. Elders look their age. Trades wear their jobs. Very fashionable, very honest.',
      ],
      entries: [
        {
          artKey: 'prop:venueWedding',
          title: 'Weddings',
          body: [
            'Grant the wish and the realm pauses its smaller errands: couple and bishop must actually arrive. Guests gather, aisle, “I do,” cheers, then a feast handoff in the banquet hall. Nearby guests (a modest crowd, not the entire census) get happier, which is how a cathedral changes the mood of streets it does not even own.',
            'Spouses share a house when beds allow. A ball-princess who weds a prince keeps the tiara. I billed that as magic. It is paperwork with flowers.',
          ],
        },
        {
          artKey: 'unit:peasant',
          title: 'Peasant families',
          body: [
            'Children come from granted wishes, not mysterious stork accounting. Pregnancy takes a few days, then a child joins the chosen house. They play, grow, and clock in as peasants.',
            'If a house is haunted or burned, tenants flee to other beds. Fail to catch them and they become homeless: gloom by the hour, and a quicker walk toward a camp that will take them.',
          ],
        },
        {
          artKey: 'unit:king',
          title: 'Royal family',
          body: [
            'One king, one queen, one keep. They live in royal rooms. If both crowns fall, a married prince and princess may succeed. Extra keeps are a myth we no longer sell. Succession is the realm changing its face without you placing a new castle.',
          ],
        },
        {
          artKey: 'prop:carriage',
          title: 'Parades & balls',
          body: [
            'Parades roll the carriage through claimed ground so peasants remember who pays for the roads they do not have. Balls fill the courtyard with dance and toast; Fairy Godmother blessings only work then. Indoor feasts belong to the banquet hall. Balls and street festivals never stack. The calendar is a jealous creature.',
          ],
        },
      ],
    },
    {
      id: 'buildings',
      label: 'Buildings',
      intro: [
        'Buy a structure, click the dirt, and the world grows a new habit. Workplaces hire. Houses claim land and beds. Military roofs paint a local ring. Burnable things can fall in raids; peasants with hammers try to un-fall them. Step inside a dwelling or the keep and the roof politely hides so you can spy.',
      ],
      entries: [
        buildEntry('keep', 'prop:keep', [
          'The heart, the lose-condition, the overlay button. Click it to see kingdom borders. Train king, queen, and fairy godmother. Castle staff work here. See Castle life for which room is pretending to be important today.',
        ]),
        buildEntry('house', 'prop:house', [
          'Three beds and a claim circle. Peasants need these before you train more commoners. Lose a house and you may mint homeless people, which is a mood, not a strategy.',
        ]),
        buildEntry('manor', 'prop:manor', [
          'Six beds, banners, and royal snobbery. Needs king and queen. A fancier exclave if you plant it far away.',
        ]),
        buildEntry('granary', 'prop:granary', [
          'Standing granaries sweeten harvests and unlock field slots. Raiders love them the way moths love flame, except moths do not steal bread.',
        ]),
        buildEntry('field', 'prop:field', [
          'Farmers work here; the larder notices. Needs granary slots. A far field is still claimed, still patrolled, still flammable. Agriculture with drama.',
        ]),
        buildEntry('bakery', 'prop:bakery', [
          'Bakers soften hunger. Step inside while one works: roof hides, oven glows, dough is bullied into bread. Guards pause here on civic rounds because even steel likes snacks.',
        ]),
        buildEntry('market', 'prop:market', [
          'Merchants trade; market festivals gather; patrols pause. Roof hides to show stalls. Prosperity is 30% numbers and 70% people standing near fruit.',
        ]),
        buildEntry('tavern', 'prop:tavern', [
          'Blunts stolen gold, trains jesters, throws revels. Happiness has a forwarding address and it is this door.',
        ]),
        buildEntry('infirmary', 'prop:infirmary', [
          'Physicians train here, then leave to find the injured. Plague days make this roof the difference between a sick village and a ghost story.',
        ]),
        buildEntry('cathedral', 'prop:cathedral', [
          'Bishop and witch hunter school. Weddings fill the altar; idle prayer fills the nave; feast days need crown plus bishop. Patrols stop in, looking pious.',
        ]),
        buildEntry('cemetery', 'prop:cemetery', [
          'Needs a cathedral first. Funerals by day. If you enable undead in Sandbox, necromancers treat this as a pantry. I did warn you.',
        ]),
        buildEntry('dungeon', 'prop:dungeon', [
          'Four cells, guard posts, a military ring, and the start of every good Arrest. Roof hides so you can watch corridors. Full dungeon? Gallows. Empty dungeon? Your necromancer is still at large, humming.',
        ]),
        buildEntry('gallows', 'prop:gallows', [
          'Needs a dungeon. The executioner walks the condemned here. Spectacle in, cell capacity out. The cemetery does not get confused, which is more than I can say for some of us.',
        ]),
        buildEntry('barracks', 'prop:barracks', [
          'Needs royalty. Trains soldiers, archers, knights, elites, and the general. Local military ring. Jousts happen in this neighborhood when the knights get theatrical.',
        ]),
        buildEntry('wall', 'prop:wall', [
          'One purchase lays three cells; the ghost preview continues a line when it can. Raiders spend real time breaching. Connect for gates and ladders. This is the actual fence. Borders are just jewelry.',
        ]),
        buildEntry('ladder', 'prop:wallLadder', [
          'Our archers and soldiers climb. Foes do not. I wrote that twice because monarchs always ask.',
        ]),
        buildEntry('drawbridge', 'prop:drawbridge', [
          'A gate that slams when raiders RSVP. Snap it onto wall. Very satisfying. Slightly rude.',
        ]),
        buildEntry('ballista', 'prop:ballista', [
          'Auto-bolts at raiders. Needs the royal gate. The map grows teeth.',
        ]),
        buildEntry('watchtower', 'prop:watchtower', [
          'Nearby archers shoot farther. Also royal. Height is a gameplay mechanic, which would thrill a younger me.',
        ]),
        buildEntry('bridge', 'prop:bridge', [
          'Rivers are opinions until you build this. Ground units and monsters cross. Dragons do not need your timber; they have wings and contempt.',
        ]),
        buildEntry('dock', 'prop:dock', [
          'Coast only. Fishermen, boats, pirates, harbor festivals, and another claim circle for guards to visit when they fancy salt air.',
        ]),
      ],
    },
    {
      id: 'castle',
      label: 'Castle life',
      intro: [
        'The keep is a clock with rooms. When someone is inside, the roof vanishes and you may follow a cook from kneading to banquet like a very nosy ghost.',
      ],
      entries: [
        {
          artKey: 'prop:keep',
          title: 'The enlarged keep',
          body: [
            'Gate, courtyard, inner halls. Click people. Watch them change rooms, which changes what the castle is doing — court, feast, sleep, or juggling for an audience of three and a dog that may be imaginary.',
          ],
        },
        {
          title: 'Room guide',
          body: [
            'Gate and courtyard — arrivals, children, jester, prince at practice.',
            'Great hall — morning court, steward fussing, bows.',
            'Banquet hall — feasts, cupbearer, wedding dinner crashing in later.',
            'Kitchen — cooks. Hearth. The smell of not starving.',
            'Servants’ quarters — tidy, rest, repeat.',
            'Royal chambers — sleep for crowns.',
            'Solar — queen, princess, scribe ledgers.',
            'Chapel nook — quiet prayers, loud thoughts.',
            'Armory nook — prince and steel.',
          ],
        },
        {
          artKey: 'unit:peasant',
          title: 'Castle staff jobs',
          body: [
            'When farms are staffed (or you have no fields yet and a steward must improvise), peasants bind to keep posts:',
            'Cook (2) — kitchen then banquet; meals taste slightly less like despair.',
            'Servant (3) — quarters, chambers, hall, errands.',
            'Steward (1) — great hall and feast oversight.',
            'Scribe (1) — solar ink.',
            'Cupbearer (1) — pouring with political implications.',
            'Inspector: Job, Works at: The Keep, At: whichever room is currently their stage.',
          ],
        },
        {
          artKey: 'unit:king',
          title: 'A day at court',
          body: [
            'King: chambers, court, feast, a wander, banquet, bed.',
            'Queen: solar, chapel, host, garden, banquet, bed.',
            'Prince: courtyard, court, roads of grass, armory, feast.',
            'Princess: arts, feast, stroll, chapel, banquet.',
            'They are a moving weather system. Follow one and the keep explains itself.',
          ],
        },
        {
          title: 'Keep life beats',
          body: [
            'Chatter, bows, serving lines, scrubbing, kneading, juggling. Speech bubbles so you know the furniture is not the only thing talking.',
          ],
        },
      ],
    },
    {
      id: 'economy',
      label: 'Economy',
      intro: [
        'Four quiet ledgers: food, gold, beds, and happiness. Ignore one and the others file a complaint in the form of witches, thieves, or an empty throne room.',
      ],
      entries: [
        {
          title: 'Food & hunger',
          body: [
            'Fields and fishing boats stock the larder. Meal hours yank people off their schedules to eat. Empty stores breed sickness and moods that defect. Harvest festivals briefly make fields smug.',
          ],
        },
        {
          title: 'Gold',
          body: [
            'Reading questions mint it. Raiders steal it from the keep. Taverns blunt the bleeding. Arrested thieves return some. Spend it on roofs, training, wishes, ransoms, and ships. I do not accept IOUs in runes anymore.',
          ],
        },
        {
          title: 'Beds & the unhoused',
          body: [
            'Houses 3, manors 6. No free bed, no new peasants or guards. Children count. Burn, demolish, or haunt a home and folk try other beds; leftovers become homeless, lose happiness by the hour, and peasants or children may walk to a camp much sooner than their housed neighbors.',
            'New roofs auto-claim wanderers when they can. Place houses like you mean it.',
          ],
        },
        {
          title: 'Happiness',
          body: [
            'Festivals, weddings, jesters, full plates: up. Sieges, hunger, curses, homelessness, fear: down. Too low and a peasant walks — still looking like your peasant — to a bandit, thief, or gypsy camp. Soldiers will not skewer them on the road. They keep their name and life log. That is either touching or horrifying. Yes.',
          ],
        },
      ],
    },
    {
      id: 'careers',
      label: 'Careers & jobs',
      intro: [
        'Workplaces mint jobs. Dreams mint promotions. Inspect a peasant, satisfy the list, Grant wish. Or Train a stranger at the building. Same roof, different soul.',
      ],
      entries: [
        {
          title: 'Civilian jobs',
          body: [
            'Food first: farmer, baker, fisher, merchant, then castle staff. Place a new field and surplus shopkeepers may wander back to dirt, which is how a building reshuffles the census without a speech.',
            'Inspectors show Works at and, in the keep, At (the room). Follow them. The commute is the tutorial.',
          ],
        },
        {
          title: 'Grant wish promotions',
          body: [
            'Guards need dungeon posts. Barracks steel needs barracks. Bishop and witch hunter need cathedral. Jester needs tavern. Executioner needs gallows and dungeon. Physician needs infirmary. Gold, always gold.',
            'All ticks, then Grant wish. They change role in place. The map gains a new habit: another patrol, another hunt, another sermon.',
          ],
        },
        {
          title: 'Training vs promoting',
          body: [
            'Train = new person at the door. Grant wish = old person in a new hat. Building inspector for Train. Person inspector for Aspiration. Mixing them up is how you accidentally hire a second baker while your first baker weeps into dough.',
          ],
        },
        {
          title: 'Civic patrol life',
          body: [
            'Guards stitch the claimed realm together: civic roofs, houses, fields, docks, even the lonely cottage you placed as a dare. The dungeon ring is where arrests like to start, not where the job ends. Borders do not block; they only tell idle feet where home is.',
          ],
        },
      ],
    },
    {
      id: 'royalty',
      label: 'Royalty',
      intro: [
        'Court is theater with a lose-condition. Rooms, balls, blessings, marriages, a carriage. The crown changes what you may build and who will train at the barracks. No king and queen, no elites, no manor snobbery, fewer excuses for a joust.',
      ],
      entries: [
        {
          artKey: 'unit:fairy_godmother',
          title: 'Fairy Godmother & balls',
          body: [
            'Train her at the keep. During a royal ball — never stacked with a street festival — she may tiara a female peasant until morning. Cathedral marriage to a prince makes it permanent. Midnight is a game mechanic. I have also made peace with that.',
          ],
        },
        {
          artKey: 'unit:bishop',
          title: 'Court & church',
          body: [
            'The bishop marries everyone worth marrying. Cathedral feast days want bishop plus king or queen. Witch hunters clock in under the same roof. Holy buildings change the calendar and the family tree.',
          ],
        },
        {
          artKey: 'prop:keep',
          title: 'One keep, one realm',
          body: [
            'Click the keep for borders. You may not plant a second. Barracks and dungeon still show their local rings, like medals on a very large coat.',
          ],
        },
      ],
    },
    {
      id: 'enemies',
      label: 'Enemies',
      intro: [
        'Named nuisances live in camps, eat, drill, argue, then pick a night. They change your world by stealing gold, burning claimed holdings, abducting villagers, or cursing the handsome. You change theirs with walls, arrests, hunters, and generals.',
      ],
      entries: [
        {
          artKey: 'enemy:bandit',
          title: 'Bandit',
          body: [
            'Wants gold and things that burn. Camp life is sharpening and bragging. Leaders toast granary strikes. Guards plus a dungeon can Arrest the living ones. Miserable peasants may join them if you forget to be kind.',
          ],
        },
        {
          artKey: 'enemy:goblin',
          title: 'Goblin',
          body: [
            'Small, numerous, green of ear. Warchiefs wait until the roster looks like a problem, then spill at your walls in staggered waves. Numbers are their magic.',
          ],
        },
        {
          artKey: 'enemy:giant',
          title: 'Giant',
          body: [
            'Not thieves — diners. They grab villagers, stroll home, and eat. Kill the giant on the walk back to cancel dinner. Camps look like furniture made for worse proportions.',
          ],
        },
        {
          artKey: 'enemy:gypsy',
          title: 'Gypsy raider',
          body: [
            'Music by day, mischief when the leader sings for war. Arrestable like thieves when you have guards and a cell. Also a destination for defectors who prefer tambourines to taxes.',
          ],
        },
        {
          artKey: 'enemy:enemy_army',
          title: 'Siege trooper',
          body: [
            'Professionals: wagons, pavises, drill. Their general plans assaults; yours burns their camp. They breach walls the hard way. No enemy ladders. I kept the high ground for us. You are welcome.',
          ],
        },
        {
          artKey: 'unit:witch',
          title: 'Witch',
          body: [
            'Coven-born curse artists: frogs, apples, age, pigs, plague. Princesses unkink frogs; princes unkink poisoned princesses. Hunters and a cathedral are the counter-spell with a paycheck.',
          ],
        },
      ],
    },
    {
      id: 'monsters',
      label: 'Monsters',
      intro: [
        'Named beasts keep schedules and a territory ring — click them, same trick as a keep. Early on they decorate the wilderness. Later they eat. Knights hunt them. Generals can too. They do not use Arrest; they use teeth.',
      ],
      entries: [
        {
          artKey: 'monster:troll',
          title: 'Troll',
          body: [
            'Mountains by night, forests by day, paths at dusk. A roaming threat to lonely commuters and fringe cottages, not a siege engine. Still rude to bakers.',
          ],
        },
        {
          artKey: 'monster:ogre',
          title: 'Ogre',
          body: [
            'Sleeps in woods, stomps near homes at mid-day. Give it space, steel, or a knight with a calendar.',
          ],
        },
        {
          artKey: 'monster:dragon',
          title: 'Dragon',
          body: [
            'Caves for naps (knights love a sleeper). Ridges for showing off. Then a dive on the keep for gold — the one errand that lets it leave its ring. Some have two heads and twice the manners of a tax collector. Water and mountains mean nothing. Bridges mean less.',
          ],
        },
        {
          artKey: 'prop:cave',
          title: 'Dragon caves',
          body: [
            'Home point for the ring. A sleeping dragon is a quest. A waking one is why your treasury makes that noise.',
          ],
        },
        {
          title: 'Territory & hunger',
          body: [
            'Each monster owns a home (spawn, or cave for dragons) and wanders inside the sphere. Hunger climbs. Past the line, it hunts the nearest soul still in the ring — a toast warns you — and a bite buys it patience. That is how a pretty wilderness becomes a missing peasant.',
          ],
        },
        {
          artKey: 'prop:vampireCastle',
          title: 'Vampire castle',
          body: [
            'Fades in on the fringe. Day: quiet, wives may go indoors, roof hides. Night: bats, bitten women, more wives. Knights, witch hunters, or a general’s outing. Do not invite them to the ball. I am serious.',
          ],
        },
      ],
    },
    {
      id: 'encampments',
      label: 'Encampments',
      intro: [
        'Camps are towns that hate you. Click for leader, roster, supply, and a sphere. Bandit, thief, and gypsy camps field named wanderers you can inspect — and Arrest, if justice is in the budget.',
        'Miserable peasants walk to bandit, thief, or gypsy camps (never giants or goblins), keep their peasant look until they arrive, then join. Soldiers let them pass. I call it hospitality. The camp calls it recruiting.',
      ],
      entries: [
        {
          artKey: 'prop:banditCamp',
          title: 'Bandit camp',
          body: [
            'Tents, fires, living bandits in the ring. Captain strikes when the roster feels thick enough. Accepts your sad peasants. Burn it and the bragging stops. For a while.',
          ],
        },
        {
          artKey: 'prop:goblinCamp',
          title: 'Goblin camp',
          body: [
            'Spikes and skulls. They wait, they multiply, they spill. Numbers again. Always numbers.',
          ],
        },
        {
          artKey: 'prop:giantCamp',
          title: 'Giant camp',
          body: [
            'Oversized lean-tos. Few giants, loud footsteps, worse dinner parties.',
          ],
        },
        {
          artKey: 'prop:thiefDen',
          title: 'Thief den',
          body: [
            'Night specialists. Ignore them and the keep bleeds quietly. Arrests recover gold. Accepts defectors who prefer lockpicks to ploughs.',
          ],
        },
        {
          artKey: 'prop:gypsyCamp',
          title: 'Gypsy camp',
          body: [
            'Music, then raids when the leader calls. Named wanderers. Defectors welcome. Inspect before you ride; surprise is for other people.',
          ],
        },
        {
          artKey: 'prop:covenCamp',
          title: 'Coven',
          body: [
            'Witches, night rituals, curses on the agenda. Hunters and detachments. Fire is a language they understand.',
          ],
        },
        {
          artKey: 'prop:siegeCamp',
          title: 'Siege camp',
          body: [
            'Supply you can see in the world. Several may exist later, each on its own jittered clock. Kill their general and their rhythm limps. This is how a far camp changes whether your keep still has walls tomorrow.',
          ],
        },
      ],
      outro: [
        'Raids do not hold hands. Each camp keeps its own cooldown. Toasts name the leader so you can find the problem on the great map instead of shouting at me.',
      ],
    },
    {
      id: 'combat',
      label: 'Combat & camps',
      intro: [
        'Peacetime is walls, drawbridges, ballistae, and people walking claimed ground. Wartime is a general’s finger and a lot of screaming indoors.',
      ],
      entries: [
        {
          artKey: 'unit:general',
          title: 'Detachments',
          body: [
            'Select the general, pick a troop count, send them at a camp, monster, or castle. They leave patrol, do violence, come home. The map is a chessboard if chess pieces complained the whole way.',
          ],
        },
        {
          title: 'Raids & sieges',
          body: [
            'Bandits, goblins, thieves: gold and flee. Giants: takeaway villagers. Sieges: engines, fire, keep focus, battering walls. Your ladders are ours. Drawbridges slam. Peasants repair, which is hope with a hammer.',
            'Any raid yanks military off balls and festivals. Army to the threatened side of the keep. Guards still walk streets and claimed holdings, herding civilians and collecting prisoners when cells allow.',
          ],
        },
        {
          title: 'Wall placement',
          body: [
            'Buy wall, wiggle the ghost of three cells, click. Sandbox wall HP buys time for archers on ladders. Remember: claim circles are not walls. Pretty gold will not stop a club.',
          ],
        },
      ],
    },
    {
      id: 'roads',
      label: 'Bridges',
      intro: [
        'We do not sell decorative dirt paths anymore. Grass is free. Rivers are not. A bridge is how ground folk — and ground monsters — cross water without inventing religion about it.',
      ],
      entries: [
        buildEntry('bridge', 'prop:bridge', [
          'Cover water, land on both ends. R flips 0°/90° while placing. Dragons remain unimpressed.',
        ]),
      ],
    },
    {
      id: 'spheres',
      label: 'Kingdom borders',
      intro: [
        'Keep click: gold overlay of the realm. Barracks or dungeon click: a local military ring, like a smaller, angrier halo.',
      ],
      entries: [
        {
          artKey: 'prop:keep',
          title: 'How borders work',
          body: [
            'Union of padded circles around the keep and every living holding. Paths, bridges, ladders do not expand it. A far house is still yours, still patrolled, still a snack for passing raiders.',
            'Overlay is a map, not a fence. Idle wander snaps back onto claimed ground. Real jobs, physician calls, and patrols go to real doors even in exclaves. Fleeing and hunts may leave. You lose only if the keep falls — not if a cottage on the fringe has a bad night.',
          ],
        },
        {
          artKey: 'prop:dungeon',
          title: 'Guards on claimed ground',
          body: [
            'They stitch exclaves to the capital with their feet. During raids they keep walking threatened streets while the army plays wall. Arrests need cells; patrols need claims. Two different magics, same hat.',
          ],
        },
        {
          artKey: 'prop:barracks',
          title: 'Army on the perimeter',
          body: [
            'Soldiers, archers, knights, elites: threatened side of the keep, walls if you built them. After the raid, schedules resume, festivals remember they exist, and I pretend my beard was never on fire.',
          ],
        },
      ],
    },
    {
      id: 'festivals',
      label: 'Festivals',
      intro: [
        'One major celebration at a time. Then a gap. If the timer fires and nothing qualifies, we wait, magnificently.',
        'Street festivals fetch a small nearest civilian crowd. Balls fetch court plus commoners. Military stays on duty because someone has to miss the fun on purpose.',
        'Dance, paired chat, mime music, Ooh/Ahh/Huzzah, shared food. Happiness up. Harvest festivals also nudge yields. Buildings and jesters are how a party gets permission to exist.',
      ],
      entries: festivals,
    },
    {
      id: 'security',
      label: 'Security & outbreaks',
      intro: [
        'When the dead walk or the horns sound, guards become loud furniture. When you merely dislike someone, Arrest is the indoor version of the same idea.',
      ],
      entries: [
        {
          artKey: 'unit:guard',
          title: 'Cordons',
          body: [
            'Zombies, raids, sieges: hot zones, shouts (“Stay back! Quarantine!”, “Raid incoming — get indoors!”), civilians shoved toward keep and houses. Soldiers clear hostiles. Afterward: “Cordon lifted.” The streets change because someone with a helmet said so.',
          ],
        },
        {
          artKey: 'unit:dungeon_keeper',
          title: 'Your Arrest button',
          body: [
            'Inspector → Arrest. Needs dungeon, a free cell, a free guard who is not the guest of honor. They stay themselves in the cell — click them, read their thoughts, Release them out the gate, or Execute if you have a gallows and an executioner. Hangings draw a crowd. Monsters are hunted, not arrested. I have standards.',
          ],
        },
        {
          artKey: 'unit:zombie',
          title: 'Undead playbook (beta)',
          body: [
            'Off by default. Sandbox toggles for vampire, necromancer, ghost when you want the spooky layer.',
            'On: casters at cemeteries, bites, Arrest the wizard, steel the rest. Ghosts may haunt homes; tenants flee; bishop and hunter gain exorcise errands. Death can change a cottage into a vacancy with moans.',
          ],
        },
      ],
    },
    {
      id: 'oceans',
      label: 'Oceans & docks',
      intro: [
        'The coast is a second granary and a second argument. Docks claim water-edge land, feed people, invite pirates, and give guards another pretty circle to visit.',
      ],
      entries: [
        buildEntry('dock', 'prop:dock', [
          'Coastal water edges only. Harbor festivals want fishermen. No dock, no shanty worth hearing.',
        ]),
        {
          artKey: 'prop:fishingBoat',
          title: NAVAL_CATALOG[0]!.name,
          subtitle: `${NAVAL_CATALOG[0]!.cost} gold`,
          body: [
            NAVAL_CATALOG[0]!.blurb,
            'Fishermen path to the dock, board, loop, land food. The hunger ledger notices. So do harbor songs.',
          ],
        },
        {
          artKey: 'prop:warship',
          title: NAVAL_CATALOG[1]!.name,
          subtitle: `${NAVAL_CATALOG[1]!.cost} gold`,
          body: [
            NAVAL_CATALOG[1]!.blurb,
            'Pirates tint the horizon and bully docks. Warships chase; guards crew. The sea changes whether your fishermen come home smug or soggy.',
          ],
        },
      ],
    },
    {
      id: 'day',
      label: 'Day by day',
      intro: [
        'Reign longer and the wilds get louder. Early days are soft. Never safe. I checked.',
      ],
      entries: [
        {
          title: 'Pressure curve',
          body: [
            `Early pressure starts near ${Math.round(WarBalance.earlyPressureFactor(0, 0) * 100)}% and rises with days and population.`,
            `Fringe camps: up to ${WarBalance.maxCamps(0)} early → toward ${WarBalance.maxCamps(40)} later.`,
            `Siege camps: up to ${WarBalance.maxSiegeCamps(0)} early → up to ${WarBalance.maxSiegeCamps(40)} late.`,
            'Fatter home rosters raid harder once their leader feels brave. Old saves grow more monsters. Time is a difficulty setting wearing a sundial.',
          ],
        },
        {
          title: 'How to read a hard day',
          body: [
            'Toasts naming camp leaders, fatter siege supply, dragons who skipped their nap, happiness yo-yoing on whether you still throw one festival between crises. If the keep still stands at dusk, that is the victory condition wearing work clothes.',
          ],
        },
      ],
    },
  ];
}
