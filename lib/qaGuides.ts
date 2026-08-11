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
/*  Wording rule: every instruction names something the user can SEE   */
/*  on screen — real button labels, real sidebar items. No jargon.     */
/* ------------------------------------------------------------------ */

export interface GuideStep {
  /** data-guide / data-tour anchor to spotlight ("" = no spotlight, message only) */
  target: string;
  /** short breadcrumb label — builds the "YOU WILL: A → B → C" map */
  label: string;
  /** plain instruction naming what's actually visible on screen */
  text: string;
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
  text: `Open the ${label} — press "Take me there" in the Test Session bar (it links straight to the exact page)`,
  until: { path },
});

/** authored guides, keyed `${scenarioId}:${stepId}` */
export const QA_GUIDES: Record<string, GuideStep[]> = {
  /* ------------------------- booking scenario ------------------------- */
  "booking:profile": [
    { target: "search", label: "Search", text: 'Click the search bar at the top and type "Test Creator"', until: { path: "/creator/testcreator" } },
    { target: "", label: "Open profile", text: "Open Test Creator's profile from the results — just viewing the page completes this test" },
  ],
  "booking:message": [
    nav("messages", "Messages", "/messages"),
    { target: "conversation-testcreator", label: "Test Creator", text: "Open the Test Creator conversation (no conversation yet? press \"Take me there\" — it opens one)", until: { visible: "chat-with-testcreator" } },
    { target: "chat-composer", label: "Send a message", text: "Type a message in the box at the bottom and send it" },
  ],
  "booking:reply": [
    nav("messages", "Messages", "/messages"),
    { target: "conversation-testcustomer", label: "Test Customer", text: "Open the Test Customer conversation", until: { visible: "chat-with-testcustomer" } },
    { target: "chat-composer", label: "Reply", text: "Type a reply in the box at the bottom and send it" },
  ],
  "booking:book": [
    nav("services", "Services", "/services"),
    { target: "qa-service-book", label: "QA Test Session", text: 'Find the "QA Test Session" service by Test Creator and click Book', until: { visible: "book-wizard" } },
    { target: "book-wizard", label: "Pick a time", text: "Pick any weekday date, choose an available time, and confirm the booking" },
  ],
  "booking:accept": [
    nav("calendar", "Bookings", "/calendar"),
    { target: "booking-accept", label: "Accept", text: 'Find the pending "QA Test Session" request from Test Customer and click Accept' },
  ],
  "booking:pay": [
    nav("calendar", "Bookings", "/calendar"),
    { target: "booking-card-testcreator", label: "Open booking", text: "Click the QA Test Session booking in the Upcoming list to open it", until: { visible: "booking-pay" } },
    { target: "booking-pay", label: "Pay (TEST)", text: "Click the Pay button — it's a TEST payment, no real money exists here" },
  ],
  "booking:progress": [
    nav("calendar", "Bookings", "/calendar"),
    { target: "booking-card-testcustomer", label: "Open booking", text: "Click the QA Test Session booking in the Upcoming list to open it", until: { visible: "booking-progress" } },
    { target: "booking-progress", label: "Post update", text: "In the Progress panel: pick a status and %, write a short note, then click Post update" },
  ],
  "booking:complete": [
    nav("calendar", "Bookings", "/calendar"),
    { target: "booking-card-testcustomer", label: "Open booking", text: "Click the QA Test Session booking in the Upcoming list to open it", until: { visible: "booking-complete" } },
    { target: "booking-complete", label: "Mark completed", text: 'Click "Mark completed — release $ to me"' },
  ],

  /* ------------------------- project scenario ------------------------- */
  "project:draft": [
    nav("messages", "Messages", "/messages"),
    { target: "conversation-testcreator", label: "Test Creator", text: "Open the Test Creator conversation", until: { visible: "chat-with-testcreator" } },
    { target: "chat-project", label: "Project", text: 'Click the "Project" button (briefcase icon) at the top of the chat', until: { visible: "project-create-draft" } },
    { target: "project-create-draft", label: "Create draft", text: 'Fill in a title, an amount, and a deadline — then click "Create project draft"' },
  ],
  "project:offer": [
    nav("messages", "Messages", "/messages"),
    { target: "conversation-testcustomer", label: "Test Customer", text: "Open the Test Customer conversation", until: { visible: "chat-with-testcustomer" } },
    { target: "chat-project", label: "Project", text: 'Click the "Project" button at the top of the chat', until: { visible: "project-send-offer" } },
    { target: "project-send-offer", label: "Send offer", text: 'Click "Send offer"' },
  ],
  "project:start": [
    takeMeThere("project page", "/projects/"),
    { target: "project-primary", label: "Accept + pay", text: 'Click "Accept offer" — then click the pay button that replaces it (TEST PAYMENT, no real money)' },
  ],
  "project:progress": [
    takeMeThere("project page", "/projects/"),
    { target: "project-progress", label: "Post update", text: "Post a progress update — pick a status, set the %, write what you're working on" },
  ],
  "project:eta": [
    takeMeThere("project page", "/projects/"),
    { target: "project-eta", label: "Update ETA", text: 'Click "Update ETA", pick the new date and give a reason' },
  ],
  "project:extension": [
    takeMeThere("project page", "/projects/"),
    { target: "project-extension", label: "Request extension", text: 'Click "Request extension", choose extra days, and explain why' },
  ],
  "project:ext-decide": [
    takeMeThere("project page", "/projects/"),
    { target: "project-ext-decide", label: "Decide", text: "Approve or decline the extension — both are valid outcomes. Approving moves the deadline" },
  ],
  "project:submit": [
    takeMeThere("project page", "/projects/"),
    { target: "project-primary", label: "Submit work", text: 'Click "Submit work for review"' },
  ],
  "project:finish": [
    takeMeThere("project page", "/projects/"),
    { target: "project-primary", label: "Approve + release", text: 'Click "Approve the delivery" — then click "Release $ — complete project" (TEST payment releases)' },
  ],
  "project:review": [
    nav("messages", "Messages", "/messages"),
    { target: "conversation-testcreator", label: "Test Creator", text: "Open the Test Creator conversation", until: { visible: "chat-with-testcreator" } },
    { target: "chat-project", label: "Project", text: 'Click the "Project" button at the top of the chat', until: { visible: "project-review" } },
    { target: "project-review", label: "Review", text: 'Pick a star rating, write a short review, and click "Post review"' },
  ],
};

/* ------------------- fallback for unauthored tasks ------------------- */
/* built from the task's real destination: sidebar anchor + instruction */

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
  const doIt: GuideStep = { target: "", label: "Do the task", text: instruction };
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
