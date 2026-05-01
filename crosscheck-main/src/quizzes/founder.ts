import type { Quiz } from "./types";

/**
 * Founder strategic-alignment quiz.
 *
 * For Aditya's cofounder (typed A320 pilot + trainer). Questions cover vision,
 * customer, product priorities, go-to-market, competition, business model,
 * team, and risks — NOT technical simulator details. Answers feed the next
 * iteration of the MVP and the next cofounder sync.
 */

export const founderQuiz: Quiz = {
  slug: "founder",
  title: "Crosscheck — founder alignment",
  intro:
    "28 questions about vision, customer, product priorities, GTM, business model, team, and risks. Your answers anchor the next iteration of the MVP and our cofounder sync. ~8 minutes. Drafts auto-save in this browser.",
  estimatedMinutes: 8,
  audience: "Cofounder",
  sections: [
    { id: "vision", title: "Vision & belief", description: "The 'why' and what success looks like." },
    { id: "customer", title: "Customer & positioning", description: "Who we're for, who we're not for." },
    { id: "product", title: "Product priorities", description: "What the MVP must nail and what we'd cut." },
    { id: "gtm", title: "Go-to-market", description: "How we get the first 100 customers and the first airline." },
    { id: "moat", title: "Competition & moat", description: "Who we worry about, what makes us hard to copy." },
    { id: "business", title: "Business model", description: "Pricing posture, revenue mix, capital strategy." },
    { id: "team", title: "Team & cadence", description: "Cofounder split, first hire, how we operate." },
    { id: "risk", title: "Risks", description: "What kills us if we're not careful." },
    { id: "open", title: "Open", description: "Things the MCQ couldn't capture." },
  ],
  questions: [
    // ─── Vision ──────────────────────────────────────────────────────────────
    {
      id: "twelve_month_outcome",
      type: "single",
      section: "vision",
      prompt: "12 months from now, the success of Crosscheck looks most like:",
      options: [
        { value: "1k_solo", label: "1,000 paying solo pilots" },
        { value: "first_airline", label: "Our first signed airline contract" },
        { value: "sme_endorsement", label: "100+ type-rated pilots vouching for us publicly" },
        { value: "industry_press", label: "Featured at aviation safety conferences / industry press" },
        { value: "investor_round", label: "A closed seed round at a strong valuation" },
      ],
    },
    {
      id: "deepest_why",
      type: "single",
      section: "vision",
      prompt: "The deepest 'why' behind Crosscheck:",
      options: [
        { value: "abnormal_gap", label: "Pilots don't get enough abnormal-procedure practice between sims" },
        { value: "sim_gatekept", label: "Sim time is too expensive and gatekept" },
        { value: "decisions_kill", label: "Decisions kill people, and decision-training is underdone" },
        { value: "training_outdated", label: "Aviation training hasn't innovated in decades" },
        { value: "ai_unlock", label: "AI finally lets us coach pilots at scale, 1-on-1" },
      ],
    },
    {
      id: "one_big_bet",
      type: "single",
      section: "vision",
      prompt: "The 'one big bet' we're making is:",
      options: [
        { value: "ai_coaching", label: "AI-personalized coaching is the future of training" },
        { value: "decision_over_procedure", label: "Decision training matters more than procedure training" },
        { value: "pilots_pay_individually", label: "Pilots will pay individually for high-quality training" },
        { value: "airlines_license", label: "Airlines will license per-pilot at scale" },
        { value: "real_incidents_are_moat", label: "A real-incident dataset is the moat — content trumps tech" },
      ],
    },

    // ─── Customer & positioning ──────────────────────────────────────────────
    {
      id: "primary_customer",
      type: "single",
      section: "customer",
      prompt: "Primary customer for the first 12 months:",
      options: [
        { value: "line_pilots", label: "Type-rated A320 line pilots (recurrent prep)" },
        { value: "type_rating_students", label: "Type-rating students (new to A320)" },
        { value: "atos", label: "ATOs / training schools" },
        { value: "airlines", label: "Airlines (B2B per-pilot license)" },
        { value: "examiners", label: "Examiners / instructors" },
      ],
    },
    {
      id: "geographic_priority",
      type: "single",
      section: "customer",
      prompt: "Geographic priority for the first 12 months:",
      options: [
        { value: "europe", label: "Europe — most A320 ops, regulator alignment with EASA" },
        { value: "north_america", label: "North America — paying capacity, fewer A320s" },
        { value: "asia_pacific", label: "Asia-Pacific — volume, lots of growth" },
        { value: "middle_east", label: "Middle East — Emirates / Etihad / Qatar fleet" },
        { value: "india", label: "India — IndiGo + Akasa A320 fleet, fast-growing" },
        { value: "global_d1", label: "Global from day one — internet-first product" },
      ],
    },
    {
      id: "not_for",
      type: "single",
      section: "customer",
      prompt: "Crosscheck is explicitly NOT for:",
      options: [
        { value: "ga", label: "General aviation / GA pilots" },
        { value: "non_a320", label: "Commercial pilots on non-A320 types" },
        { value: "sim_replacement", label: "Replacing a real sim instructor" },
        { value: "pre_license", label: "Pre-license / ab-initio students" },
        { value: "anyone_who_wants_it", label: "Anyone who wants it — we shouldn't say no early" },
      ],
    },
    {
      id: "one_sentence_position",
      type: "single",
      section: "customer",
      prompt: "Closest one-sentence positioning of Crosscheck:",
      options: [
        { value: "duolingo_pilots", label: "Duolingo for pilot abnormals" },
        { value: "ai_examiner", label: "An AI examiner that runs LOFTs in your browser" },
        { value: "decision_gym", label: "A decision gym for type-rated pilots" },
        { value: "between_sims", label: "What pilots do between sim sessions" },
        { value: "sim_companion", label: "The companion app to your full-flight sim" },
      ],
    },

    // ─── Product priorities ──────────────────────────────────────────────────
    {
      id: "mvp_must_nail",
      type: "single",
      section: "product",
      prompt: "The single biggest thing the MVP must nail:",
      options: [
        { value: "procedure_realism", label: "Procedure realism — right ECAM, right timing" },
        { value: "ai_debrief", label: "AI debrief quality" },
        { value: "speed", label: "Speed — frictionless, a session runs in 5 min" },
        { value: "fidelity", label: "Cockpit fidelity — looks and feels like A320" },
        { value: "unique_scenarios", label: "Unique scenarios you can't get elsewhere" },
      ],
    },
    {
      id: "first_to_cut",
      type: "single",
      section: "product",
      prompt: "If we had to launch in 4 weeks, the first thing I'd cut is:",
      options: [
        { value: "photoreal", label: "Photoreal cockpit" },
        { value: "voice", label: "Voice callouts" },
        { value: "multi_scenario", label: "Multi-scenario library — ship with 1" },
        { value: "dashboard", label: "Dashboard / session history" },
        { value: "ai_debrief", label: "Real AI debrief — mock it for v1" },
      ],
    },
    {
      id: "wow_moment",
      type: "single",
      section: "product",
      prompt: "The 'wow' moment for a first-time pilot user:",
      options: [
        { value: "fire_in_realtime", label: "The fire warning hitting in real time" },
        { value: "debrief_quality", label: "The depth and specificity of the AI debrief" },
        { value: "decision_counts", label: "Realising decisions count, not just clicks" },
        { value: "score_humbling", label: "Their first score being lower than they expected" },
        { value: "ecam_authenticity", label: "Recognising the ECAM looks correct" },
      ],
    },
    {
      id: "next_horizon",
      type: "single",
      section: "product",
      prompt: "Next-horizon product investment after the loop is solid:",
      options: [
        { value: "real_incident_replays", label: "Real-incident replays (fly QF32, US1549)" },
        { value: "rag_grounded_debrief", label: "RAG-grounded AI debriefs (cite real ASRS reports)" },
        { value: "examiner_mode", label: "Examiner mode — dynamic pressure & curveballs" },
        { value: "crew_mode", label: "Crew mode (PF + PM)" },
        { value: "second_aircraft", label: "Second aircraft type (737 / A330)" },
      ],
    },

    // ─── Go-to-market ────────────────────────────────────────────────────────
    {
      id: "first_100",
      type: "single",
      section: "gtm",
      prompt: "First 100 paying customers most likely come from:",
      options: [
        { value: "linkedin_twitter", label: "LinkedIn / Twitter — typed pilots discovering us" },
        { value: "forums", label: "Aviation forums — PPRuNe, Reddit r/airbus" },
        { value: "champion_airline", label: "One champion airline doing a pilot programme" },
        { value: "ato_partnership", label: "An ATO partnership feeding cohort users" },
        { value: "word_of_mouth", label: "Word-of-mouth from your SME network" },
        { value: "youtube", label: "Aviation YouTubers (Mentour Pilot, 74 Gear, etc.)" },
      ],
    },
    {
      id: "primary_channel",
      type: "single",
      section: "gtm",
      prompt: "Primary GTM channel for the first 6 months:",
      options: [
        { value: "direct_sales", label: "Direct sales to airlines" },
        { value: "bottom_up", label: "Bottom-up via individual pilots" },
        { value: "atos", label: "ATO partnerships" },
        { value: "content_marketing", label: "Content marketing — YouTube, blog, podcast" },
        { value: "conferences", label: "Aviation conferences / trade shows" },
      ],
    },
    {
      id: "first_airline_target",
      type: "single",
      section: "gtm",
      prompt: "First airline we want as a customer:",
      options: [
        { value: "fast_regional", label: "Fast-moving regional (easyJet, Wizz, Vueling)" },
        { value: "flag_carrier", label: "Flag carrier with brand value (Lufthansa, BA, Air France)" },
        { value: "budget_scale", label: "Budget carrier with scale (Ryanair, IndiGo, Akasa)" },
        { value: "safety_progressive", label: "Safety-progressive carrier (Singapore, Qantas)" },
        { value: "ato_first", label: "An ATO before any airline (CAE, FlightSafety)" },
      ],
    },
    {
      id: "founder_role_in_sales",
      type: "single",
      section: "gtm",
      prompt: "Founders' role in sales for the first year:",
      options: [
        { value: "equal_split", label: "Both equally — 50/50" },
        { value: "you_lead", label: "You lead sales (the pilot face), I support" },
        { value: "i_lead", label: "I lead sales (the operator face), you support" },
        { value: "hire_lead", label: "Hire a sales lead in month 6" },
        { value: "no_sales_yet", label: "No sales — focus on product until traction" },
      ],
    },

    // ─── Competition & moat ──────────────────────────────────────────────────
    {
      id: "biggest_competitor",
      type: "single",
      section: "moat",
      prompt: "The competitor I worry about most:",
      options: [
        { value: "incumbents", label: "CAE / FlightSafety building this themselves" },
        { value: "msfs", label: "Microsoft Flight Simulator + a plugin ecosystem" },
        { value: "ai_labs", label: "An OpenAI / Anthropic-built training agent" },
        { value: "pilot_clone", label: "A pilot duo cloning us with airline connections" },
        { value: "no_one", label: "No one — incumbents move too slowly" },
      ],
    },
    {
      id: "deepest_moat",
      type: "single",
      section: "moat",
      prompt: "Our deepest moat 24 months from now:",
      options: [
        { value: "incident_dataset", label: "Real-incident dataset (ASRS + AVherald + curated)" },
        { value: "sme_network", label: "SME network — line-pilot reviewers per scenario" },
        { value: "airline_contracts", label: "Sticky airline contracts" },
        { value: "brand_community", label: "Brand + community of typed pilots" },
        { value: "ai_quality", label: "AI quality — our prompts, scoring, retrieval tuning" },
      ],
    },
    {
      id: "irrelevance_risk",
      type: "single",
      section: "moat",
      prompt: "What would make Crosscheck irrelevant fastest:",
      options: [
        { value: "airbus_builds_it", label: "Airbus releases their own training app" },
        { value: "open_source", label: "An open-source clone goes viral" },
        { value: "regulator_rejects", label: "Regulators say 'this doesn't count toward currency'" },
        { value: "pilots_reject_ai", label: "Pilots collectively reject AI feedback" },
        { value: "we_run_out", label: "We run out of money before traction" },
      ],
    },

    // ─── Business model ──────────────────────────────────────────────────────
    {
      id: "pricing_posture",
      type: "single",
      section: "business",
      prompt: "Pricing posture for the first year:",
      options: [
        { value: "premium", label: "Premium — $79+/mo solo; $300+/pilot/yr airline" },
        { value: "mid", label: "Mid-tier — $29-49/mo; $100-200/pilot/yr" },
        { value: "freemium", label: "Freemium with paid upgrade" },
        { value: "free_beta", label: "Free during beta, paid v1" },
        { value: "enterprise_only", label: "Custom enterprise only — no consumer SKU" },
      ],
    },
    {
      id: "revenue_mix_y1",
      type: "single",
      section: "business",
      prompt: "Revenue mix you want by month 12:",
      options: [
        { value: "90_solo", label: "90% individual subscriptions, 10% airline" },
        { value: "50_50", label: "50/50 individual / airline" },
        { value: "90_airline", label: "90% airline, 10% individual" },
        { value: "100_airline", label: "100% airline — don't sell to consumers" },
        { value: "100_solo", label: "100% individual — defer airline B2B for year 2" },
      ],
    },
    {
      id: "raise_timing",
      type: "single",
      section: "business",
      prompt: "When do we raise outside capital?",
      options: [
        { value: "now", label: "Now / already raising" },
        { value: "after_100_users", label: "After 100 paying users" },
        { value: "after_loi", label: "After first airline LOI" },
        { value: "after_revenue", label: "After 12 months of recurring revenue" },
        { value: "bootstrap", label: "Bootstrap all the way — no outside capital" },
      ],
    },

    // ─── Team & cadence ──────────────────────────────────────────────────────
    {
      id: "cofounder_split",
      type: "single",
      section: "team",
      prompt: "Cofounder split of focus:",
      options: [
        { value: "tech_vs_aviation", label: "I'm 100% product/tech; you're 100% sales/aviation" },
        { value: "tech_gtm_vs_aviation_product", label: "I'm tech + GTM ops; you're aviation + product accuracy" },
        { value: "shared_eng_lead", label: "Both do everything — I lead engineering" },
        { value: "shared_biz_lead", label: "Both do everything — you lead business" },
        { value: "tbd", label: "TBD — we should agree on this in the next sync" },
      ],
    },
    {
      id: "first_hire",
      type: "single",
      section: "team",
      prompt: "First hire after the two of us:",
      options: [
        { value: "engineer", label: "Engineer" },
        { value: "sme_content", label: "Pilot SME / content authoring" },
        { value: "bizdev", label: "Sales / business development" },
        { value: "designer", label: "Designer" },
        { value: "marketing", label: "Marketing" },
        { value: "no_hire_yet", label: "Don't hire until we cross $X revenue" },
      ],
    },
    {
      id: "operating_cadence",
      type: "single",
      section: "team",
      prompt: "How we operate week-to-week:",
      options: [
        { value: "daily_standup", label: "Daily 15-min standup, async otherwise" },
        { value: "weekly_sync", label: "Weekly sync, async otherwise" },
        { value: "all_async", label: "All async — Notion / Slack / Linear" },
        { value: "monthly_strategic", label: "Monthly strategic + ad-hoc as needed" },
        { value: "tbd_cadence", label: "TBD — should agree this sync" },
      ],
    },

    // ─── Risk ────────────────────────────────────────────────────────────────
    {
      id: "biggest_risk_30d",
      type: "single",
      section: "risk",
      prompt: "Biggest existential risk to Crosscheck right now:",
      options: [
        { value: "wrong_product", label: "Building the wrong product (no PMF)" },
        { value: "sme_credibility", label: "SME credibility — pilots reject our content" },
        { value: "no_business_model", label: "No business model that scales" },
        { value: "cofounder_misalign", label: "Cofounder misalignment" },
        { value: "money_runs_out", label: "Money runs out before traction" },
        { value: "regulator_rejection", label: "Regulators / aviation gatekeepers reject us" },
      ],
    },
    {
      id: "next_30d_decision",
      type: "single",
      section: "risk",
      prompt: "Single biggest decision we need to make in the next 30 days:",
      options: [
        { value: "domain_brand", label: "Custom domain + brand finalization" },
        { value: "airline_outreach", label: "First airline target + outreach plan" },
        { value: "pricing", label: "Pricing structure" },
        { value: "raise_or_not", label: "Whether to raise pre-seed now" },
        { value: "sme_advisors", label: "SME advisor contracts (equity vs. cash)" },
        { value: "first_hire_timing", label: "First hire — when and what role" },
      ],
    },

    // ─── Open ────────────────────────────────────────────────────────────────
    {
      id: "bar_pitch",
      type: "text",
      section: "open",
      prompt:
        "One sentence — how do you describe Crosscheck to a typed A320 captain at a bar?",
      placeholder: "No buzzwords. Pretend they have 30 seconds.",
      rows: 3,
    },
    {
      id: "what_aditya_does_differently",
      type: "text",
      section: "open",
      prompt:
        "What does Aditya (the technical cofounder) most need to do differently?",
      placeholder: "Be specific. Be honest.",
      rows: 3,
    },
    {
      id: "anything_else",
      type: "text",
      section: "open",
      prompt:
        "Anything else — blockers, frustrations, hidden concerns, or excitement we haven't talked about?",
      placeholder: "Open mic.",
      rows: 4,
    },
  ],
};
