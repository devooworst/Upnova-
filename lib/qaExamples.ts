/* ------------------------------------------------------------------ */
/*  GUIDED INPUTS — example data for every form-based QA task.         */
/*                                                                     */
/*  PURE DATA. The briefing shows these as copyable values ("enter     */
/*  THIS, here"), and where a form supports it, "Fill example data"    */
/*  dispatches a mavyn:qa-fill event that populates the REAL form      */
/*  fields — it NEVER submits. The tester reviews and presses the      */
/*  actual button; the checkpoint still verifies only the database.    */
/*  All values are safe, realistic QA/demo data.                       */
/* ------------------------------------------------------------------ */

export interface ExampleField {
  label: string; // exactly as the field is labeled on screen
  value: string; // what to type/select — copyable
}
export interface TaskExamples {
  fields: ExampleField[];
  /** a form that supports one-click populate (never submit) */
  fill?: { form: string; values: Record<string, unknown> };
}

const in3d = (days: number) => {
  const t = new Date(Date.now() + days * 86400_000);
  return t.toISOString().slice(0, 10);
};

export const QA_EXAMPLES: Record<string, TaskExamples> = {
  /* ---------------- live ---------------- */
  "live:golive": {
    fields: [
      { label: "Title", value: "Making a beat from scratch" },
      { label: "Category", value: "Music" },
      { label: "Audience", value: "Everyone" },
    ],
  },
  "live:chat": {
    fields: [{ label: "Message", value: "This chat updates in real time — hello from the Test Center" }],
  },
  "live:guest": {
    fields: [{ label: "Guest username", value: "@testcustomer" }],
  },
  /* ------------------------- booking scenario ------------------------- */
  "booking:message": {
    fields: [{ label: "Message", value: "Hi! I'd like to book your QA Test Session — is Thursday morning open?" }],
  },
  "booking:book": {
    fields: [
      { label: "Date", value: "any weekday next week" },
      { label: "Time", value: "any slot shown as available" },
      { label: "Note (optional)", value: "First session — testing the booking flow end to end." },
    ],
  },
  "booking:reply": {
    fields: [{ label: "Reply", value: "Happy to help — any weekday slot works. Book whichever time suits you." }],
  },
  "booking:progress": {
    fields: [
      { label: "Current status", value: "In progress" },
      { label: "Progress %", value: "50" },
      { label: "What are you currently working on?", value: "Halfway through the session prep — materials are ready." },
    ],
  },

  /* ------------------------- project scenario ------------------------- */
  "project:draft": {
    fields: [
      { label: "Project title", value: "Logo refresh for my music page" },
      { label: "Amount", value: "150" },
      { label: "Brief", value: "Refresh my current logo: cleaner lines, two color variants, files for web and print." },
      { label: "Deadline", value: in3d(7) },
    ],
    fill: {
      form: "project-draft",
      values: { title: "Logo refresh for my music page", amount: "150", brief: "Refresh my current logo: cleaner lines, two color variants, files for web and print.", deadline: in3d(7) },
    },
  },
  "project:progress": {
    fields: [
      { label: "Current status", value: "In progress" },
      { label: "Progress %", value: "40" },
      { label: "What are you currently working on?", value: "First draft of the mark is done — refining the letterforms next." },
      { label: "Estimated completion", value: `${in3d(3)} · 6:00 PM` },
    ],
  },
  "project:eta": {
    fields: [
      { label: "New estimated completion", value: in3d(4) },
      { label: "Reason", value: "Revisions on the color variants are taking longer than planned." },
    ],
  },
  "project:extension": {
    fields: [
      { label: "Extra days", value: "2" },
      { label: "Reason", value: "Need two more days to finalize the print-ready files." },
    ],
  },
  "project:review": {
    fields: [
      { label: "Rating", value: "5 stars" },
      { label: "Review", value: "Clean process — clear updates the whole way and the final files were exactly right." },
    ],
  },

  /* ----------------------- opportunity scenario ----------------------- */
  "opportunity:post": {
    fields: [
      { label: "Title", value: "Mavyn Website QA Tester" },
      { label: "What's the work?", value: "Help test the Mavyn platform, identify bugs, and provide feedback on the user experience." },
      { label: "Type", value: "Paid" },
      { label: "Max budget", value: "250" },
      { label: "Location", value: "Bowie, MD" },
      { label: "Remote", value: "ON" },
      { label: "When", value: in3d(35) },
      { label: "Apply by", value: in3d(25) },
      { label: "Student-friendly", value: "ON" },
      { label: "Who can apply", value: "Anyone on Mavyn" },
      { label: "+ Add application question", value: "Are you available September 15?" },
      { label: "Answer type", value: "Yes / No" },
      { label: "Required", value: "ON" },
    ],
    fill: {
      form: "opportunity",
      values: {
        title: "Mavyn Website QA Tester",
        description: "Help test the Mavyn platform, identify bugs, and provide feedback on the user experience.",
        paid: true,
        budget: "250",
        location: "Bowie, MD",
        remote: true,
        eventDate: in3d(35),
        applyBy: in3d(25),
        studentFriendly: true,
        eligibility: "anyone",
        questions: [{ id: "q-sept15", label: "Are you available September 15?", type: "yesno", required: true }],
      },
    },
  },
  "opportunity:apply": {
    fields: [
      { label: "Why are you a good fit?", value: "I use Mavyn daily and love finding edge cases — I'd be a thorough QA tester for this." },
      { label: "Are you available September 15?", value: "Yes" },
    ],
  },
  "opportunity:connect": {
    fields: [{ label: "Message", value: "You're selected! Let's plan the first testing session — what days work for you?" }],
  },

  /* ------------------------- hiring scenario ------------------------- */
  "hiring:message": {
    fields: [{ label: "Message", value: "We have a campaign coming up — keep an eye out, our opportunity posts this week." }],
  },
  "hiring:post": {
    fields: [
      { label: "Title", value: "Campaign content creator — fall launch" },
      { label: "What's the work?", value: "Create three short-form videos for our fall campaign: one teaser, one product feature, one testimonial-style." },
      { label: "Type", value: "Paid" },
      { label: "Max budget", value: "300" },
      { label: "Location", value: "Baltimore, MD" },
      { label: "Remote", value: "ON" },
    ],
    fill: {
      form: "opportunity",
      values: {
        title: "Campaign content creator — fall launch",
        description: "Create three short-form videos for our fall campaign: one teaser, one product feature, one testimonial-style.",
        paid: true,
        budget: "300",
        location: "Baltimore, MD",
        remote: true,
      },
    },
  },
  "hiring:apply": {
    fields: [{ label: "Application message", value: "Short-form content is exactly my lane — here to make your fall launch pop." }],
  },
  "hiring:project": {
    fields: [
      { label: "Project title", value: "Fall campaign content package" },
      { label: "Amount", value: "300" },
      { label: "Brief", value: "Three deliverables for the fall campaign: teaser, product feature, testimonial-style video." },
      { label: "Deadline", value: in3d(10) },
    ],
    fill: {
      form: "project-draft",
      values: { title: "Fall campaign content package", amount: "300", brief: "Three deliverables for the fall campaign: teaser, product feature, testimonial-style video.", deadline: in3d(10) },
    },
  },
  "hiring:progress": {
    fields: [
      { label: "Current status", value: "In progress" },
      { label: "Progress %", value: "40" },
      { label: "What are you currently working on?", value: "Teaser video is in draft — the product feature shoots tomorrow." },
    ],
  },
  "hiring:extension": {
    fields: [
      { label: "Extra days", value: "2" },
      { label: "Reason", value: "The location reshoot needs two more days." },
    ],
  },
  "hiring:review": {
    fields: [
      { label: "Rating", value: "5 stars" },
      { label: "Review", value: "Professional and on schedule — we'd hire again for the next campaign." },
    ],
  },

  /* ------------------------- people scenario ------------------------- */
  "people:contact": {
    fields: [{ label: "Message", value: "Thanks for your interest — our studio calendar is open if you'd like to book time." }],
  },
  "people:client-books": {
    fields: [
      { label: "Date", value: "any weekday next week" },
      { label: "Time", value: "any available slot (e.g. 1:00 PM)" },
    ],
  },
  "people:hire-draft": {
    fields: [
      { label: "Project title", value: "Cut grass — studio front lot" },
      { label: "Amount", value: "90" },
      { label: "Brief", value: "One deliverable: trim and edge the front lot before the weekend shoot." },
      { label: "Deadline", value: in3d(5) },
    ],
    fill: {
      form: "project-draft",
      values: { title: "Cut grass — studio front lot", amount: "90", brief: "One deliverable: trim and edge the front lot before the weekend shoot.", deadline: in3d(5) },
    },
  },
  "people:team-add": {
    fields: [
      { label: "Handle", value: "testcreator" },
      { label: "Title", value: "Studio Editor" },
      { label: "Compensation", value: "Contract day-rate (QA test entry)" },
    ],
  },
};

export function examplesFor(scenarioId: string, stepId: string): TaskExamples | null {
  return QA_EXAMPLES[`${scenarioId}:${stepId}`] ?? null;
}
