'use client';

import React from 'react';
import Image from 'next/image';

type RiskLevel = 'Coastal sailing' | 'Offshore sailing' | 'Extreme sailing';

type RiskLevelSelectorProps = {
  value: RiskLevel[];
  onChange: (value: RiskLevel[]) => void;
  onInfoClick?: (title: string, content: React.ReactNode) => void;
  onClose?: () => void;
};

const getRiskLevelInfo = (level: RiskLevel): { title: string; content: React.ReactNode } => {
  switch (level) {
    case 'Coastal sailing':
      return {
        title: 'Coastal sailing',
        content: (
          <div className="space-y-4">
            <div>
              <p className="mb-2">Coastal sailing is one of the most accessible and enjoyable ways to experience sailing. It typically involves cruising along shorelines, bays, inlets, islands, or large lakes/seas, staying relatively close to land—often within sight of the coast or just a few hours from safe harbors, anchorages, or marinas. Trips are usually day sails, weekend overnights, or multi-day hops between ports, covering 20–150 miles over a week or so, with frequent stops for exploration, swimming, meals ashore, or sightseeing.</p>
              <p className="mb-2">Unlike true offshore or ocean passages (where you're days or weeks from help), coastal sailing offers a mix of protected waters (e.g., bays, sounds, archipelagos like the San Juan Islands, Chesapeake Bay, Florida Keys, or Maine coast) and occasional short open-water crossings between islands or headlands. It's more about relaxed exploration, discovering new harbors, beaches, towns, and anchorages than enduring long isolation or extreme conditions. Weather can be planned around more easily (using short-term forecasts), and you can duck into shelter if things turn rough. Many people describe it as the "sweet spot" for family cruising, learning, or casual adventure—plenty of sailing fun without the full commitment of bluewater voyages.</p>
            </div>
            
            <div>
              <h4 className="font-semibold mb-2">Typical Experience</h4>
              <ul className="space-y-1 list-none">
                <li><strong>Daily rhythm</strong> — Sail or motor during daylight (often 4–8 hours), anchor or dock in the evening for relaxation, dinners, or short hikes. Nights are usually calm in protected spots, with gentle rocking rather than constant motion.</li>
                <li><strong>Variety</strong> — Mix of upwind/downwind sailing, tacking through channels, dodging traffic in busy areas, and enjoying scenery/wildlife. Social aspects shine: cooking together, games on board, or evenings in marinas.</li>
                <li><strong>Comfort</strong> — Easier access to fresh food, showers, Wi-Fi, and resupply. Less need for heavy provisioning or self-sufficiency.</li>
                <li><strong>Vibe</strong> — Adventurous yet forgiving—great for building confidence, as you can always head back to safety quickly.</li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-2">Main Risks Involved</h4>
              <p className="mb-2">While generally safer and less demanding than offshore sailing (due to proximity to help and milder conditions), coastal sailing still carries real hazards—especially in busy or variable waters. Risks are often more about local surprises than prolonged extremes.</p>
              <ul className="space-y-1 list-none">
                <li><strong>Weather and sea conditions</strong> — Sudden squalls, strong afternoon sea breezes, fog, or choppy short-period waves in shallow areas (e.g., pounding in places like the Great Lakes or certain bays). Thunderstorms or fronts can arrive quickly.</li>
                <li><strong>Navigation hazards</strong> — Running aground on sandbars, rocks, shoals, or unmarked obstacles; strong tides/currents in channels or inlets; busy shipping lanes or ferry traffic leading to collisions.</li>
                <li><strong>Man overboard (MOB)</strong> — More common during docking, anchoring, or in gusty winds; quick recovery is possible near shore, but cold water or currents add urgency.</li>
                <li><strong>Equipment failure</strong> — Engine issues when motoring in no wind, rigging problems during maneuvers, or battery drain in confined spaces.</li>
                <li><strong>Human factors</strong> — Fatigue from long days, alcohol (a major contributor to boating accidents), poor judgment in changing conditions, or inexperience with docking in tight marinas/wind.</li>
                <li><strong>Environmental</strong> — Cold/wet weather leading to hypothermia (especially in spring/fall), or minor injuries from winches, booms, or slips on deck.</li>
                <li><strong>Other</strong> — Grounding is common but rarely catastrophic if tides allow refloating; collisions with debris or other boats in crowded areas.</li>
              </ul>
              <p className="mt-2">Overall, coastal risks are manageable with good planning—many are preventable through preparation, and help (tow services, rescue) is usually hours away at most.</p>
            </div>

            <div>
              <h4 className="font-semibold mb-2">Skills Needed</h4>
              <p className="mb-2">Coastal sailing rewards solid foundational skills plus local awareness. You don't need extreme expertise, but competence builds safety and enjoyment. Many sailors start with basic certifications (e.g., ASA 103 Coastal Cruising or RYA Day Skipper/Coastal Skipper) and gain experience through practice.</p>
              <ul className="space-y-1 list-none">
                <li><strong>Basic boat handling</strong> — Steering under sail/power, tacking/jibing, reefing sails, trimming for efficiency, and controlling speed in varying winds (up to ~20 knots moderate conditions).</li>
                <li><strong>Docking and mooring</strong> — Approaching docks/moorings in wind/current, using lines/fenders, picking up buoys, and anchoring securely (including scope, setting, and weighing anchor).</li>
                <li><strong>Navigation and piloting</strong> — Reading charts, using GPS/chartplotter, dead reckoning, understanding buoys/lights, pilotage (eyeball navigation by landmarks), and basic tides/currents awareness.</li>
                <li><strong>Weather interpretation</strong> — Checking forecasts, recognizing local effects (e.g., wind acceleration around headlands, sea breezes), and deciding when to go/not go.</li>
                <li><strong>Safety basics</strong> — MOB recovery techniques, wearing lifejackets/harnesses when needed, knowing rules of the road (collision avoidance), basic first aid, and emergency procedures (e.g., VHF use, flares).</li>
                <li><strong>Seamanship</strong> — Knot tying (bowline, clove hitch, etc.), basic maintenance (engine checks, sail care), and good crew communication/watch habits for multi-day trips.</li>
                <li><strong>Situational awareness</strong> — Adapting to traffic, shallow draft awareness, and flexible planning (coastal often means changing routes on the fly).</li>
              </ul>
              <p className="mt-2">For longer coastal trips, add provisioning, night sailing basics (if involved), and confidence in confined waters. A trial day sail or short course quickly reveals what you need to work on—many skippers say coastal experience is the best teacher for progressing safely.</p>
              <p className="mt-2 italic">In short, coastal sailing is rewarding, scenic, and approachable—offering adventure with a safety net. With preparation and respect for the water, the risks stay low, and the fun stays high!</p>
            </div>
          </div>
        ),
      };
    case 'Offshore sailing':
      return {
        title: 'Offshore sailing',
        content: (
          <div className="space-y-4">
            <div>
              <p className="mb-2">Offshore sailing (also called bluewater or ocean sailing) involves passages where you're well away from land—typically out of sight of the coast for extended periods, often days to weeks or even months on ocean crossings (e.g., Atlantic trade-wind routes like the ARC, Pacific passages, or longer voyages). You're days or more from any safe harbor, rescue, or resupply, making self-sufficiency essential. Unlike coastal sailing's short hops with frequent land access, offshore means committing to the open ocean, dealing with whatever weather and conditions arise without quick escape options.</p>
              <p className="mb-2">It's often described as a profound, immersive experience: the vast emptiness of the sea, constant motion, night watches under stars, the rhythm of trade winds, and the satisfaction of covering hundreds or thousands of miles under sail. Many find it meditative and exhilarating—freedom from daily life, deep crew bonds from shared watches and challenges, and the thrill of arriving after a long passage. But it's also demanding: fatigue from irregular sleep, physical wear from constant boat motion, and the mental strain of isolation and unpredictability. Passages can feel monotonous (long days of similar conditions) or intense (sudden gales, squalls, or gear failures).</p>
            </div>

            <div>
              <h4 className="font-semibold mb-2">Typical Experience</h4>
              <ul className="space-y-1 list-none">
                <li><strong>Daily rhythm</strong> — Structured watch system (e.g., 3–4 hours on, 6–8 off), constant sail trimming, navigation checks, meal prep in a heeling galley, and managing boat systems. Days blend together at sea; landfall brings huge relief and joy.</li>
                <li><strong>Conditions</strong> — Steady ocean swells (often 2–5m or more), downwind/reaching sailing dominant (unlike coastal upwind work), potential for heavy weather (30–50+ knot gales, big seas), and variable wind patterns far offshore.</li>
                <li><strong>Comfort</strong> — Limited: smaller water/fuel tanks, no fresh food after a week, constant motion (cooking, sleeping, moving around is harder), shared tight quarters, and no easy shore breaks.</li>
                <li><strong>Vibe</strong> — Adventurous and committed—more about endurance, teamwork, and self-reliance than casual exploration. Great for skill-building, but it tests patience and resilience.</li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-2">Main Risks Involved</h4>
              <p className="mb-2">Offshore risks are higher due to remoteness, prolonged exposure, and limited help. While modern boats/gear make it safer than in the past, incidents still happen (e.g., steering failures, knockdowns, or medical emergencies leading to abandonments).</p>
              <ul className="space-y-1 list-none">
                <li><strong>Heavy weather and seas</strong> — Gales, squalls, rogue waves, or prolonged storms causing knockdowns, dismasting, or capsize risk; fatigue amplifies errors.</li>
                <li><strong>Equipment failure</strong> — Steering/rigging breakage (a top cause of abandonments), engine issues (critical if becalmed or in danger), electrical/battery problems, or water ingress.</li>
                <li><strong>Man overboard (MOB)</strong> — Much harder to recover in big seas/darkness; hypothermia risk in cold waters.</li>
                <li><strong>Medical emergencies</strong> — Appendicitis, injuries, or illnesses with no quick evacuation; delayed SAR (search and rescue) can take days.</li>
                <li><strong>Navigation/collision</strong> — Debris (containers, whales, logs), shipping traffic in lanes, or poor visibility (fog, night); fatigue leads to watchkeeping lapses.</li>
                <li><strong>Isolation and human factors</strong> — Sleep deprivation causing mistakes, crew conflicts from confinement, or psychological strain (cabin fever, fear in bad weather).</li>
                <li><strong>Other</strong> — Fire/flooding, grounding on uncharted hazards near landfall, or running out of supplies if delayed.</li>
              </ul>
              <p className="mt-2">Many risks are mitigated by preparation, but the core difference from coastal is that help is far away—self-rescue or endurance is often the only option.</p>
            </div>

            <div>
              <h4 className="font-semibold mb-2">Skills Needed</h4>
              <p className="mb-2">Offshore requires solid coastal foundations plus advanced seamanship, self-reliance, and heavy-weather competence. Certifications like RYA Yachtmaster Offshore, ASA 108 Offshore Passagemaking, or World Sailing Offshore Safety help, but real miles and drills matter most.</p>
              <ul className="space-y-1 list-none">
                <li><strong>Advanced boat handling</strong> — Steering in big following seas/downwind, heavy-weather tactics (heaving-to, running off, drogues), reefing early/deep, and sail changes in rough conditions.</li>
                <li><strong>Navigation and passage planning</strong> — Celestial basics (as backup), weather routing/GRIB interpretation, long-range passage strategy, dead reckoning, and understanding currents/ocean phenomena.</li>
                <li><strong>Watchkeeping and fatigue management</strong> — Standing solo or shared watches reliably, collision avoidance at night (lights, radar/AIS), logging positions, and staying alert despite sleep disruption.</li>
                <li><strong>Heavy-weather and survival</strong> — Storm tactics, damage control (patching hull, jury rigging), life raft/EPIRB use, cold-water immersion awareness, and practicing MOB in realistic conditions.</li>
                <li><strong>Maintenance and repairs</strong> — Troubleshooting engine/electrical/plumbing, basic rigging/sail fixes, spare parts management, and improvising solutions far from help.</li>
                <li><strong>Safety and emergency</strong> — Full safety gear familiarity (harnesses, jacklines, immersion suits), first aid/medical kits for remote scenarios, VHF/Sat comms, and crew coordination in crises.</li>
                <li><strong>Seamanship extras</strong> — Provisioning for weeks, water/fuel conservation, galley management in motion, and mental resilience for isolation.</li>
              </ul>
              <p className="mt-2 italic">Offshore sailing is rewarding for those who prepare thoroughly—many start with shorter passages to build experience. A good skipper often requires trial sails, references, and proven skills before long legs. With respect for the ocean, the right boat/crew, and smart decisions, it's an achievable, life-changing adventure!</p>
            </div>
          </div>
        ),
      };
    case 'Extreme sailing':
      return {
        title: 'Extreme sailing',
        content: (
          <div className="space-y-4">
            <div>
              <p className="mb-2">Expedition or high/low latitude extreme sailing (often called polar, high-latitude, or ice-bound expedition sailing) takes place in the planet's most remote and hostile marine environments: the Arctic (e.g., Svalbard, Greenland, Alaska, Northwest Passage) and Antarctic regions (e.g., Antarctic Peninsula, Drake Passage, or Southern Ocean approaches like Cape Horn). These voyages combine true offshore/ocean sailing with specialized challenges from ice, extreme cold, prolonged daylight/darkness, and near-total isolation.</p>
              <p className="mb-2">It's an extraordinary, often life-changing experience: sailing among towering icebergs, glaciers calving into the sea, wildlife like polar bears (Arctic), penguins/whales (Antarctic), midnight sun or polar night, and pristine wilderness untouched by most humans. The focus is on exploration—reaching remote fjords, scientific sites, or historic routes—rather than speed or leisure. Expect constant vigilance for ice, weather changes, and boat integrity; the environment dictates everything, with days of calm beauty interrupted by sudden gales, fog, or ice pressure. It's physically and mentally taxing: heavy layers of clothing, deck work in freezing winds, disrupted sleep from watches or 24-hour light, and the profound sense of being far from civilization. Many describe it as addictive—the raw beauty and sense of achievement outweigh the discomfort—but it's not for casual sailors; it's expeditionary, with high commitment to safety, teamwork, and environmental respect (e.g., strict biosecurity rules in Antarctica).</p>
            </div>

            <div>
              <h4 className="font-semibold mb-2">Typical Experience</h4>
              <ul className="space-y-1 list-none">
                <li><strong>Daily rhythm</strong> — Intensive watchkeeping (often in teams due to hazards), ice navigation (spotting/avoiding growlers, pack ice), Zodiac/boat ops for shore landings, wildlife observation, and maintenance in extreme conditions. Summer seasons (May–September Arctic; November–March Antarctic) offer 24-hour daylight for navigation but bring variable ice melt; winter ops are rare and extreme.</li>
                <li><strong>Conditions</strong> — Temperatures from near-freezing to -30°C/-22°F or lower, high winds (gales common), fog/snow reducing visibility, variable ice (pack, bergy bits, growlers), and big Southern Ocean swells near Cape Horn/Drake Passage.</li>
                <li><strong>Comfort</strong> — Minimal: insulated boats with heating, but constant cold, wet decks, bulky gear restricting movement, dehydrated/freeze-dried food, and tight quarters for weeks/months.</li>
                <li><strong>Vibe</strong> — Purpose-driven adventure: exploration, science support, or personal challenge in one of Earth's last frontiers. Team cohesion is critical—cabin fever in bad weather or shared triumphs in stunning scenery define the trip.</li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-2">Main Risks Involved</h4>
              <p className="mb-2">These environments amplify offshore risks due to remoteness (SAR response can take days/weeks), cold (hypothermia/frostbite fast), and ice (structural damage possible). Modern Polar Code regulations help, but incidents still occur (e.g., groundings, ice entrapment).</p>
              <ul className="space-y-1 list-none">
                <li><strong>Ice hazards</strong> — Collisions with icebergs/growlers causing hull/rudder damage; pack ice pressure trapping or crushing the boat; uncharted shallows under ice.</li>
                <li><strong>Extreme weather</strong> — Gales (50–100+ knots), rogue waves, polar lows (sudden violent storms), fog/snow/blizzards reducing visibility, and unpredictable shifts.</li>
                <li><strong>Cold-related</strong> — Hypothermia from immersion (water near 0°C/-freezing), frostbite, or cold shock; heavy gear increases fatigue/injury risk.</li>
                <li><strong>Navigation/grounding</strong> — Poor/inaccurate charts, magnetic anomalies near poles, strong currents/tides, and limited visibility leading to groundings or hazards.</li>
                <li><strong>Isolation/medical</strong> — Weeks from help; injuries, appendicitis, or illnesses become life-threatening without evacuation options.</li>
                <li><strong>Wildlife/environmental</strong> — Polar bear attacks (Arctic), strict no-trace rules (Antarctica), or biosecurity breaches introducing invasives.</li>
                <li><strong>Human factors</strong> — Extreme fatigue, sleep disruption (perpetual light/dark), psychological strain (isolation, fear), or crew conflicts in confined spaces.</li>
                <li><strong>Other</strong> — Fire/flooding in remote areas, fuel/engine issues with no resupply, or vessel instability from ice buildup.</li>
              </ul>
              <p className="mt-2">Risks are mitigated by specialized boats (often metal/ice-strengthened), rigorous planning, and experience—but the margin for error is tiny.</p>
            </div>

            <div>
              <h4 className="font-semibold mb-2">Skills Needed</h4>
              <p className="mb-2">Beyond offshore foundations, these demand proven polar/high-latitude expertise, specialized training, and resilience. Many expeditions require verifiable experience, medical clearance, and sometimes Polar Code-related quals.</p>
              <ul className="space-y-1 list-none">
                <li><strong>Ice navigation and pilotage</strong> — Interpreting ice charts/satellite data, spotting/avoiding ice types (growlers, bergy bits, pack), navigating leads/channels, and using radar for ice detection.</li>
                <li><strong>Heavy-weather and survival in cold</strong> — Advanced storm tactics in big seas/ice, cold-water immersion drills, hypothermia prevention/treatment, and survival suit/immersion gear use.</li>
                <li><strong>Specialized boat handling</strong> — Deck work in bulky cold-weather gear, clearing ice buildup for stability, Zodiac driving in ice/wind/waves, and handling lines/anchors in freezing conditions.</li>
                <li><strong>Navigation extremes</strong> — Radar/AIS for traffic/ice, dealing with compass deviation/magnetic issues near poles, poor charting, and 24-hour light/dark routines.</li>
                <li><strong>Maintenance/self-reliance</strong> — Repairs in sub-zero temps (engine, rigging, hull patches), jury-rigging, and managing systems (heating, de-icing) with limited spares.</li>
                <li><strong>Safety/emergency</strong> — Polar-specific training (e.g., cold-water survival, firearms for bear defense in Arctic, advanced first aid/medical in remote settings), damage control, and EPIRB/Sat comms use.</li>
                <li><strong>Expedition/soft skills</strong> — Wildlife observation protocols (distances, biosecurity), environmental compliance (e.g., IAATO in Antarctica), team leadership in isolation, and mental endurance for prolonged stress.</li>
                <li><strong>Physical/mental fitness</strong> — High stamina for demanding tasks in cold, resilience to fatigue/confinement, and quick adaptation to changing plans.</li>
              </ul>
              <p className="mt-2 italic">For true expeditions, skippers often demand prior high-latitude miles, references from polar voyages, and trial in cold/wet conditions. Specialized boats (e.g., aluminum/steel hulls) and gear are essential. With thorough preparation, respect for the environment, and experienced leadership, these voyages offer unparalleled adventure—but safety and team fit are absolutely non-negotiable in these unforgiving frontiers!</p>
            </div>
          </div>
        ),
      };
  }
};

export function RiskLevelSelector({ value, onChange, onInfoClick, onClose }: RiskLevelSelectorProps) {
  const handleClick = (level: RiskLevel) => {
    const newValue: RiskLevel[] = value.includes(level)
      ? value.filter((v): v is RiskLevel => v !== level)
      : [...value, level];
    onChange(newValue);
    
    // Show info for all selected risk levels, or close if none selected
    if (onInfoClick) {
      if (newValue.length > 0) {
        const allInfo = newValue.map(level => getRiskLevelInfo(level));
        const combinedTitle = newValue.length === 1 
          ? allInfo[0].title 
          : allInfo[0].title; // Use first title instead of "Selected Risk Levels"
        const combinedContent = (
          <div className="space-y-4">
            {allInfo.map((info, index) => (
              <div key={index}>
                <h4 className="font-semibold mb-2">{info.title}</h4>
                {info.content}
              </div>
            ))}
          </div>
        );
        onInfoClick(combinedTitle, combinedContent);
      } else if (onClose) {
        onClose();
      }
    }
  };

  return (
    <div className="md:col-span-2">
      <label className="block text-sm font-medium text-foreground mb-3">
        Risk Level
      </label>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Coastal sailing */}
        <button
          type="button"
          onClick={() => handleClick('Coastal sailing')}
          className={`relative p-3 border-2 rounded-lg bg-card transition-all aspect-square flex flex-col ${
            value.includes('Coastal sailing')
              ? 'border-primary bg-primary/5'
              : 'border-border hover:border-primary/50'
          }`}
        >
          <div className="flex items-center justify-center mb-2 flex-shrink-0">
            <h3 className="font-semibold text-card-foreground text-sm text-center">Coastal sailing</h3>
          </div>
          <div className="w-full flex-1 flex items-center justify-center relative min-h-0">
            <Image
              src="/coastal_sailing2.png"
              alt="Coastal sailing"
              fill
              className="object-contain"
            />
          </div>
        </button>

        {/* Offshore sailing */}
        <button
          type="button"
          onClick={() => handleClick('Offshore sailing')}
          className={`relative p-3 border-2 rounded-lg bg-card transition-all aspect-square flex flex-col ${
            value.includes('Offshore sailing')
              ? 'border-primary bg-primary/5'
              : 'border-border hover:border-primary/50'
          }`}
        >
          <div className="flex items-center justify-center mb-2 flex-shrink-0">
            <h3 className="font-semibold text-card-foreground text-sm text-center">Offshore sailing</h3>
          </div>
          <div className="w-full flex-1 flex items-center justify-center relative min-h-0">
            <Image
              src="/offshore_sailing2.png"
              alt="Offshore sailing"
              fill
              className="object-contain"
            />
          </div>
        </button>

        {/* Extreme sailing */}
        <button
          type="button"
          onClick={() => handleClick('Extreme sailing')}
          className={`relative p-3 border-2 rounded-lg bg-card transition-all aspect-square flex flex-col ${
            value.includes('Extreme sailing')
              ? 'border-primary bg-primary/5'
              : 'border-border hover:border-primary/50'
          }`}
        >
          <div className="flex items-center justify-center mb-2 flex-shrink-0">
            <h3 className="font-semibold text-card-foreground text-sm text-center">Extreme sailing</h3>
          </div>
          <div className="w-full flex-1 flex items-center justify-center relative min-h-0">
            <Image
              src="/extreme_sailing2.png"
              alt="Extreme sailing"
              fill
              className="object-contain"
            />
          </div>
        </button>
      </div>
    </div>
  );
}
