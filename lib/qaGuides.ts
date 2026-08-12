/* ------------------------------------------------------------------ */
/*  "SHOW ME WHERE" — declarative visual-guide scripts for QA tasks.   */
/*                                                                     */
/*  PURE DATA. A guide step names a UI anchor (data-guide / data-tour  */
/*  attribute), the plain-language thing to do there, and when the     */
/*  step counts as reached (a path prefix or another anchor becoming   */
/*  visible). The overlay engine only ever HIGHLIGHTS — it never       */
/*  clicks, submits, fetches, or creates anything. The tester performs */
/*  every action personally; checkpoints verify the real database.     */
/*                                                                     */
/*  EVERY user-action task has an authored guide whose final step      */
/*  names a real rendered control (the target system). `kind` tells    */
/*  the engine how to behave while the user acts:                      */
/*    click — one exact control: full spotlight until it's clicked     */
/*    form  — the user works IN the area: soft highlight, no dimming   */
/*    visit — being on the page IS the action (auto-verified)          */
/*  Wording rule: instructions name what is actually on screen.        */
/* ------------------------------------------------------------------ */

export interface GuideStep {
  /** data-guide / data-tour anchor to spotlight ("" only for kind:visit) */
  target: string;
  /** short breadcrumb label — builds the "YOU WILL: A → B → C" map */
  label: string;
  /** plain instruction naming what's actually visible on screen */
  text: string;
  /** interaction mode (defaults: intermediate steps behave as "click") */
  kind?: "click" | "form" | "visit";
  /** when this step counts as reached (the guide advances):
      path = the URL now starts with this · visible = this anchor appeared.
      Omitted on the last step — the task's own checkpoint finishes it. */
  until?: { path?: string; visible?: string };
}

const nav = (target: string, label: string, path: string): GuideStep => ({
  target,
  label,
  text: `Click ${label} in the left sidebar`,
  until: { path },
});

const takeMeThere = (label: string, path: string): GuideStep => ({
  target: "",
  label,
  text: `Open the ${label} — press "Take me there" in the Test Session panel (it links straight to the exact page)`,
  until: { path },
});

/* --- shared fragments --- */
const openConvo = (handle: string, name: string): GuideStep => ({
  target: `conversation-${handle}`,
  label: name,
  text: `Open the ${name} conversation (no conversation yet? press "Take me there" — it opens one)`,
  until: { visible: `chat-with-${handle}` },
});
const composer: GuideStep = { target: "chat-composer", label: "Send", text: "Type your message in the box at the bottom and send it", kind: "form" };
const openProjectPanel = (untilAnchor: string): GuideStep => ({
  target: "chat-project",
  label: "Project",
  text: 'Click the "Project" button (briefcase icon) at the top of the chat',
  until: { visible: untilAnchor },
});

/** authored guides, keyed `${scenarioId}:${stepId}` */
export const QA_GUIDES: Record<string, GuideStep[]> = {
  /* ------------------------- booking scenario ------------------------- */
  "booking:profile": [
    { target: "search", label: "Search", text: 'Click the search bar at the top and type "Test Creator"', until: { path: "/creator/testcreator" } },
    { target: "", label: "Open profile", text: "You're on Test Creator's profile — just viewing the page completes this test", kind: "visit" },
  ],
  "booking:message": [nav("messages", "Messages", "/messages"), openConvo("testcreator", "Test Creator"), composer],
  "booking:reply": [nav("messages", "Messages", "/messages"), openConvo("testcustomer", "Test Customer"), { ...composer, text: "Type a reply in the box at the bottom and send it", label: "Reply" }],
  "booking:book": [
    nav("services", "Services", "/services"),
    { target: "qa-service-book-testcreator", label: "QA Test Session", text: 'Click Book on the "QA Test Session" service by Test Creator', until: { visible: "book-wizard" } },
    { target: "book-wizard", label: "Pick a time", text: "Pick any weekday date, choose an available time, and confirm the booking", kind: "form" },
  ],
  "booking:accept": [
    nav("calendar", "Bookings", "/calendar"),
    { target: "booking-accept", label: "Accept", text: "Click Accept here on Test Customer's pending request", kind: "click" },
  ],
  "booking:pay": [
    nav("calendar", "Bookings", "/calendar"),
    { target: "booking-card-testcreator", label: "Open booking", text: "Click the QA Test Session booking in the Upcoming list to open it", until: { visible: "booking-pay" } },
    { target: "booking-pay", label: "Pay (TEST)", text: "Click Pay here — it's a TEST payment, no real money exists in this environment", kind: "click" },
  ],
  "booking:progress": [
    nav("calendar", "Bookings", "/calendar"),
    { target: "booking-card-testcustomer", label: "Open booking", text: "Click the QA Test Session booking in the Upcoming list to open it", until: { visible: "booking-progress" } },
    { target: "booking-progress", label: "Post update", text: "In this Progress panel: pick a status and %, write a short note, then click Post update", kind: "form" },
  ],
  "booking:complete": [
    nav("calendar", "Bookings", "/calendar"),
    { target: "booking-card-testcustomer", label: "Open booking", text: "Click the QA Test Session booking in the Upcoming list to open it", until: { visible: "booking-complete" } },
    { target: "booking-complete", label: "Mark completed", text: 'Click "Mark completed — release $ to me" here', kind: "click" },
  ],

  /* ------------------------- project scenario ------------------------- */
  "project:draft": [
    nav("messages", "Messages", "/messages"),
    openConvo("testcreator", "Test Creator"),
    openProjectPanel("project-create-draft"),
    { target: "project-create-draft", label: "Create draft", text: 'Fill in the title, amount, and deadline (example values are in the briefing) — then click "Create project draft"', kind: "form" },
  ],
  "project:offer": [
    nav("messages", "Messages", "/messages"),
    openConvo("testcustomer", "Test Customer"),
    openProjectPanel("project-send-offer"),
    { target: "project-send-offer", label: "Send offer", text: 'Click "Send offer" here', kind: "click" },
  ],
  "project:start": [
    takeMeThere("project page", "/projects/"),
    { target: "project-primary", label: "Accept + pay", text: 'Click "Accept offer" here — then click the pay button that replaces it (TEST PAYMENT, no real money)', kind: "click" },
  ],
  "project:progress": [
    takeMeThere("project page", "/projects/"),
    { target: "project-progress", label: "Post update", text: 'Click "Post progress update" here, then fill the form that opens below (status, %, note) and post it', kind: "click" },
  ],
  "project:eta": [
    takeMeThere("project page", "/projects/"),
    { target: "project-eta", label: "Update ETA", text: 'Click "Update ETA" here, then pick the new date and give a reason in the form below', kind: "click" },
  ],
  "project:extension": [
    takeMeThere("project page", "/projects/"),
    { target: "project-extension", label: "Request extension", text: 'Click "Request extension" here, then choose extra days and explain why', kind: "click" },
  ],
  "project:ext-decide": [
    takeMeThere("project page", "/projects/"),
    { target: "project-ext-decide", label: "Decide", text: "Approve or decline the extension here — both are valid outcomes. Approving moves the deadline", kind: "click" },
  ],
  "project:submit": [
    takeMeThere("project page", "/projects/"),
    { target: "project-primary", label: "Submit work", text: 'Click "Submit work for review" here', kind: "click" },
  ],
  "project:finish": [
    takeMeThere("project page", "/projects/"),
    { target: "project-primary", label: "Approve + release", text: 'Click "Approve the delivery" here — then click "Release $ — complete project" (the TEST payment releases)', kind: "click" },
  ],
  "project:review": [
    nav("messages", "Messages", "/messages"),
    openConvo("testcreator", "Test Creator"),
    openProjectPanel("project-review"),
    { target: "project-review", label: "Review", text: 'Pick a star rating, write a short review, and click "Post review"', kind: "form" },
  ],

  /* ----------------------- opportunity scenario ----------------------- */
  "opportunity:post": [
    nav("opportunities", "Opportunities", "/opportunities"),
    { target: "opportunity-new", label: "Post opportunity", text: 'Click "Post opportunity" here', until: { path: "/opportunities/new" } },
    { target: "opportunity-submit", label: "Fill + post", text: 'Fill the form (the briefing has example values — or press Fill example data), then click "Post opportunity"', kind: "form" },
  ],
  "opportunity:apply": [
    takeMeThere("opportunity page", "/opportunities/"),
    { target: "opportunity-apply", label: "Apply", text: "Click Apply here, write a short message, and send the application", kind: "click" },
  ],
  "opportunity:select": [
    takeMeThere("applicants page", "/opportunities/"),
    { target: "applicant-shortlist", label: "Shortlist", text: "Click Shortlist here on Test Customer's application", until: { visible: "applicant-select" } },
    { target: "applicant-select", label: "Select", text: "Click Select here — this is the hire decision", kind: "click" },
  ],
  "opportunity:connect": [nav("messages", "Messages", "/messages"), openConvo("testcustomer", "Test Customer"), { ...composer, text: "Message your selected applicant about next steps" }],

  /* ------------------------- hiring scenario ------------------------- */
  "hiring:find": [
    { target: "search", label: "Search", text: 'Click the search bar at the top and type "Test Creator"', until: { path: "/creator/testcreator" } },
    { target: "", label: "Open profile", text: "You're on Test Creator's profile — viewing it records the check automatically", kind: "visit" },
  ],
  "hiring:message": [nav("messages", "Messages", "/messages"), openConvo("testcreator", "Test Creator"), composer],
  "hiring:post": [
    nav("opportunities", "Opportunities", "/opportunities"),
    { target: "opportunity-new", label: "Post opportunity", text: 'Click "Post opportunity" here', until: { path: "/opportunities/new" } },
    { target: "opportunity-submit", label: "Fill + post", text: 'Fill the form (example values are in the briefing), then click "Post opportunity"', kind: "form" },
  ],
  "hiring:apply": [
    takeMeThere("opportunity page", "/opportunities/"),
    { target: "opportunity-apply", label: "Apply", text: "Click Apply here, write a short pitch, and send it", kind: "click" },
  ],
  "hiring:shortlist": [
    takeMeThere("applicants page", "/opportunities/"),
    { target: "applicant-shortlist", label: "Shortlist", text: "Click Shortlist here on Test Creator's application", kind: "click" },
  ],
  "hiring:accept": [
    takeMeThere("applicants page", "/opportunities/"),
    { target: "applicant-select", label: "Select", text: "Click Select here — Test Creator gets the selection notification", kind: "click" },
  ],
  "hiring:project": [
    nav("messages", "Messages", "/messages"),
    openConvo("testcreator", "Test Creator"),
    openProjectPanel("project-create-draft"),
    { target: "project-create-draft", label: "Create draft", text: 'Fill in the title, amount, and deadline, then click "Create project draft"', kind: "form" },
  ],
  "hiring:offer": [
    nav("messages", "Messages", "/messages"),
    openConvo("testbusiness", "Test Business"),
    openProjectPanel("project-send-offer"),
    { target: "project-send-offer", label: "Send offer", text: 'Click "Send offer" here', kind: "click" },
  ],
  "hiring:fund": [
    takeMeThere("project page", "/projects/"),
    { target: "project-primary", label: "Accept + pay", text: 'Click "Accept offer" here — then the pay button that replaces it (TEST PAYMENT)', kind: "click" },
  ],
  "hiring:progress": [
    takeMeThere("project page", "/projects/"),
    { target: "project-progress", label: "Post update", text: 'Click "Post progress update" here and fill the form that opens below', kind: "click" },
  ],
  "hiring:extension": [
    takeMeThere("project page", "/projects/"),
    { target: "project-extension", label: "Request extension", text: 'Click "Request extension" here, choose days, explain why', kind: "click" },
  ],
  "hiring:ext-decide": [
    takeMeThere("project page", "/projects/"),
    { target: "project-ext-decide", label: "Decide", text: "Approve or decline the extension here", kind: "click" },
  ],
  "hiring:deliver": [
    takeMeThere("project page", "/projects/"),
    { target: "project-primary", label: "Submit work", text: 'Click "Submit work for review" here', kind: "click" },
  ],
  "hiring:release": [
    takeMeThere("project page", "/projects/"),
    { target: "project-primary", label: "Approve + release", text: 'Click "Approve the delivery" here — then "Release $ — complete project"', kind: "click" },
  ],
  "hiring:review": [
    nav("messages", "Messages", "/messages"),
    openConvo("testcreator", "Test Creator"),
    openProjectPanel("project-review"),
    { target: "project-review", label: "Review", text: 'Pick a star rating, write a line, and click "Post review"', kind: "form" },
  ],

  /* ------------------------- people scenario ------------------------- */
  "people:contact": [nav("messages", "Messages", "/messages"), openConvo("testcustomer", "Test Customer"), composer],
  "people:client-books": [
    nav("services", "Services", "/services"),
    { target: "qa-service-book-testbusiness", label: "QA Studio Rental", text: 'Click Book on the "QA Studio Rental" service by Test Business', until: { visible: "book-wizard" } },
    { target: "book-wizard", label: "Pick a time", text: "Pick a weekday date and an available time, then confirm — pay (TEST) after the business accepts", kind: "form" },
  ],
  "people:client-complete": [
    nav("calendar", "Bookings", "/calendar"),
    { target: "booking-card-testcustomer", label: "Open booking", text: "Click the QA Studio Rental booking to open it", until: { visible: "booking-complete" } },
    { target: "booking-complete", label: "Mark completed", text: 'Click "Mark completed — release $ to me" here', kind: "click" },
  ],
  "people:hire-talent": [
    nav("messages", "Messages", "/messages"),
    openConvo("testcreator", "Test Creator"),
    openProjectPanel("project-create-draft"),
    { target: "project-create-draft", label: "Create draft", text: 'Create the project draft here — then run it to completion (offer → TEST pay → deliver → approve → complete). "Do it for me" in the Test Center plays the whole chain', kind: "form" },
  ],
  "people:team-add": [
    nav("people", "People", "/people"),
    { target: "team-add-button", label: "Add team member", text: 'Click "Add team member" here', until: { visible: "team-add-save" } },
    { target: "team-add-save", label: "Save", text: 'Enter @testcreator with title "Studio Editor", then click "Add to team"', kind: "form" },
  ],
  "people:team-end": [
    nav("people", "People", "/people"),
    { target: "team-end-button", label: "End membership", text: 'Click "End" here on the team member — the record flips to inactive, history is kept', kind: "click" },
  ],

  /* -------------------------- plan lab -------------------------- */
  "plans:sim-mode": [
    { target: "demo-mode-switch", label: "Mode switch", text: "Click the DEMO MODE pill in the top-left corner", until: { visible: "demo-mode-simulation" } },
    { target: "demo-mode-simulation", label: "Simulation", text: 'Click "SIMULATION MODE" here — real enforcement turns on', kind: "click" },
  ],
  "plans:upgrade-pro": [
    takeMeThere("Plans page", "/plans"),
    { target: "plan-pro", label: "Go Pro", text: 'Click "Go Pro" here and complete the TEST checkout — no real money exists here', kind: "click" },
  ],
  "plans:use-pro": [
    takeMeThere("Profile Studio", "/profile/studio"),
    { target: "studio-save", label: "Save", text: "Change anything (accent, theme, layout), then click Save changes — the exact save that was refused on Free", kind: "form" },
  ],
  "plans:student-verify": [
    takeMeThere("Settings page", "/settings"),
    { target: "settings-demo", label: "Demo Controls", text: 'Click "Demo Controls" in the settings menu', until: { visible: "account-state-current_student" } },
    { target: "account-state-current_student", label: "Current student", text: 'Click "Current student" here — verification is identity, free, never a plan', kind: "click" },
  ],
  "plans:college-plan": [
    takeMeThere("Plans page", "/plans"),
    { target: "plan-college", label: "College+", text: 'Click "Choose College+" here and complete the TEST checkout', kind: "click" },
  ],
  "plans:alumni-rule": [
    takeMeThere("Settings page", "/settings"),
    { target: "settings-demo", label: "Demo Controls", text: 'Click "Demo Controls" in the settings menu', until: { visible: "account-state-alumni" } },
    { target: "account-state-alumni", label: "Alumni", text: 'Click "Alumni" here — College+ ends automatically, your verified identity is kept', kind: "click" },
  ],
  "plans:biz-sim": [
    { target: "demo-mode-switch", label: "Mode switch", text: "Click the DEMO MODE pill in the top-left corner", until: { visible: "demo-mode-simulation" } },
    { target: "demo-mode-simulation", label: "Simulation", text: 'Click "SIMULATION MODE" here', kind: "click" },
  ],
  "plans:biz-upgrade": [
    takeMeThere("Plans page", "/plans"),
    { target: "plan-business_pro", label: "Business Pro", text: 'Click "Upgrade to Business" here and complete the TEST checkout', kind: "click" },
  ],
};

/* ------------------- fallback for unauthored tasks ------------------- */
/* built from the task's real destination: sidebar anchor + instruction.
   A regression test enforces that every USER task has an authored guide,
   so this only ever serves brand-new steps mid-development. */

const NAV_FOR: [prefix: string, target: string, label: string][] = [
  ["/messages", "messages", "Messages"],
  ["/calendar", "calendar", "Bookings"],
  ["/services", "services", "Services"],
  ["/opportunities", "opportunities", "Opportunities"],
  ["/people", "people", "People"],
  ["/hiring", "hiring", "Hiring"],
  ["/notifications", "notifications", "Notifications"],
  ["/activity", "activity", "Activity"],
  ["/payments", "payments", "Payments"],
];

export function guideFor(scenarioId: string, stepId: string, href: string, instruction: string): GuideStep[] {
  const authored = QA_GUIDES[`${scenarioId}:${stepId}`];
  if (authored) return authored;
  const path = (href || "").split("?")[0];
  const hit = NAV_FOR.find(([prefix]) => path.startsWith(prefix));
  const doIt: GuideStep = { target: "", label: "Do the task", text: instruction, kind: "visit" };
  if (hit) return [nav(hit[1], hit[2], hit[0]), doIt];
  if (path && path !== "#") return [takeMeThere("task's page", path.startsWith("/creator/") ? "/creator/" : path), doIt];
  return [doIt];
}

/** the "YOU WILL:" mental map — A → B → C from the guide's own labels */
export function guideBreadcrumb(scenarioId: string, stepId: string, href: string, instruction: string): string {
  return guideFor(scenarioId, stepId, href, instruction)
    .map((s) => s.label)
    .join(" → ");
}
