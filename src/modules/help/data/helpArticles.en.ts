/**
 * Help Center — article registry (English translation).
 *
 * Source: ./helpArticles.ts (Ukrainian original, 5 sections, 16 articles).
 * Structure mirrors the original 1:1 — same slugs/keys/icons, translated copy.
 *
 * Structure is organized BY user scenario, not by module.
 * Body = trusted HTML (our content, not user input) → rendered via v-html in HelpView.
 */

import type { HelpSection } from './helpArticles'

export const HELP_SECTIONS_EN: HelpSection[] = [
  // ─── 🚀 Get started ─────────────────────────────────────────────────────────
  {
    key: 'start',
    icon: '🚀',
    title: 'Get started',
    articles: [
      {
        slug: 'vstup',
        title: 'What M4SH is and how to start',
        summary: 'A one-minute overview: the board, lessons, students.',
        body: `
<p>M4SH is an interactive whiteboard for tutors. You prepare a lesson, invite your student via a link, and run the class live: you draw, add objects and materials, and the lesson can be recorded and reviewed later.</p>
<h3>Three steps to your first lesson</h3>
<ol>
  <li><strong>Prepare the lesson</strong> — in "Lesson Studio", open the constructor, draw and add objects and materials (or generate a lesson automatically).</li>
  <li><strong>Save as a template</strong> — click "Save as template"; the lesson appears in "My Lessons". This step is required: you can only run a lesson with a student from a saved template.</li>
  <li><strong>Run the lesson</strong> — in "My Lessons", click "Conduct", invite the student — and teach the class live.</li>
</ol>
<p>The rest of this section covers each step in more detail.</p>
`,
      },
      {
        slug: 'pershyi-urok',
        title: 'Your first lesson in 5 minutes',
        summary: 'The shortest path from sign-in to teaching.',
        body: `
<ol>
  <li>Sign in to your account.</li>
  <li>In the side menu, open <strong>"Lesson Studio"</strong>.</li>
  <li>Create a new board (or use the <strong>lesson constructor</strong> to generate a lesson from problems — see "Create a lesson").</li>
  <li>Draw a few strokes and add, for example, a graph or a 3D shape — to get a feel for the board.</li>
  <li>Invite a student via a link and start the live lesson.</li>
</ol>
<p>Tip: first play with the board on your own ("solo" mode) — you won't break anything, and the student won't see it.</p>
`,
      },
    ],
  },

  // ─── 👥 Invite a student ─────────────────────────────────────────────────────
  {
    key: 'invite',
    icon: '👥',
    title: 'Invite a student',
    articles: [
      {
        slug: 'zaprosyty-uchnya',
        title: 'Invite a student via a link',
        summary: 'The "you invite them yourself" model, with no public catalog.',
        body: `
<p>M4SH has no public catalog of tutors — you bring your own students. This is done through an invitation link.</p>
<h3>How to invite</h3>
<ol>
  <li>Open the <strong>"My Students"</strong> section.</li>
  <li>Create an invitation — you'll get a link.</li>
  <li>Send the link to the student (messenger, email — any way you like).</li>
  <li>The student follows the link, registers (or signs in) — and is linked to you.</li>
</ol>
<p>After that, the student appears in your "My Students" list, and you can run lessons with them.</p>
`,
      },
      {
        slug: 'shcho-bachyt-uchen',
        title: 'What the student sees',
        summary: "Access and privacy from the student's side.",
        body: `
<ul>
  <li>During a live lesson, the student sees your board <strong>live</strong> — everything you draw and add.</li>
  <li>By default, <strong>only you</strong> write on the board; the student watches. The student's drawing can be temporarily blocked.</li>
  <li>You control access to the lesson recording (Replay) yourself — it only appears for the student if you share the link.</li>
</ul>
`,
      },
    ],
  },

  // ─── 🎓 Run a lesson ─────────────────────────────────────────────────────────
  {
    key: 'lesson',
    icon: '🎓',
    title: 'Run a lesson',
    articles: [
      {
        slug: 'stvoryty-urok',
        title: 'Create a lesson (constructor)',
        summary: 'Automatic lesson generation from topics.',
        body: `
<p>The <strong>lesson constructor</strong> assembles a ready-made lesson in a few steps — you don't have to do everything by hand.</p>
<ol>
  <li>Open "Lesson Studio" → the <strong>"Constructor"</strong> tab.</li>
  <li>Choose the <strong>topics</strong> (problems are drawn from all the selected ones).</li>
  <li>Pick the <strong>number of problems</strong> (1–20) — you immediately see the structure of the upcoming lesson.</li>
  <li>Configure the <strong>card style</strong> and the <strong>board background</strong> (a single color or multi-colored pages).</li>
  <li>If needed — under "Advanced settings": difficulty, lesson mode (including exam mode), a theory page.</li>
  <li>Click <strong>"Generate lesson"</strong> — you'll get a multi-page lesson (theory + practice with interactive problems) on the board.</li>
</ol>
<p>The generated lesson can then be edited like any ordinary board.</p>
`,
      },
      {
        slug: 'doshka-osnovy',
        title: 'The board: drawing basics',
        summary: 'Tools, colors, pages, objects.',
        body: `
<h3>Tools</h3>
<p>Pencil, marker (semi-transparent), line, rectangle, circle, text, eraser, laser pointer, sticky notes. For the pen — 4 thicknesses and a color palette (plus a custom color).</p>
<h3>Canvas</h3>
<p>The canvas is infinite: move around (pan) and zoom. You can turn on a grid — cells, dots, a ruler, or a coordinate plane (separately for each page).</p>
<h3>Pages</h3>
<p>One board — many pages (up to 50). Add and switch between them via tabs/thumbnails.</p>
<h3>Objects</h3>
<p>Select, move, resize, rotate. Available: locking, duplication (Ctrl+D), z-order (bring to front/send to back), grouping, moving to another page. Any action can be undone (Ctrl+Z).</p>
<h3>Voice and notes on an object</h3>
<p>You can attach a <strong>voice comment</strong> to a drawn object (the student listens with a click), a text note, or a link.</p>
`,
      },
      {
        slug: 'matematychni-instrumenty',
        title: 'Math tools',
        summary: 'Graphs, trigonometry, derivative/integral, quadratics.',
        body: `
<p>This is the board's key advantage — interactive math objects. Select an object, and its parameters appear in the panel on the right.</p>
<ul>
  <li><strong>Graphing calculator</strong> — y=f(x) graphs: arbitrary expressions, several curves, live slider parameters, points on a curve.</li>
  <li><strong>Trigonometric circle</strong> — the unit circle and sin/cos/tan/cot graphs, dragging the point, angle labels, numeric values.</li>
  <li><strong>Derivative / Integral</strong> — tangent and secant lines, the f'(x) trace; Riemann sum (left/middle/right), antiderivative.</li>
  <li><strong>Quadratic function</strong> — ax²+bx+c: discriminant, roots, vertex, axis of symmetry; edit by dragging the parabola.</li>
  <li><strong>Plane geometry 2D</strong> — triangles, quadrilaterals, circles; medians, altitudes, bisectors, inscribed and circumscribed circles.</li>
  <li><strong>Helix 3D</strong> — a parametric curve with projections onto planes.</li>
</ul>
<p>The graph, circle, and helix can be <strong>expanded to the full board</strong> (the ⛶ button) — the parameters stay in the panel on the right.</p>
`,
      },
      {
        slug: 'instrumenty-3d',
        title: '3D solid geometry',
        summary: 'Over 20 ready-made solids, rotation, and drawing.',
        body: `
<p>The board includes over <strong>20 ready-made 3D solids</strong>: cube, cuboid, prisms and pyramids (including oblique and n-gonal ones), tetrahedron, cylinder, cone, truncated solids, sphere, combinations of inscribed/circumscribed solids, a cube cross-section.</p>
<h3>Two modes</h3>
<ul>
  <li><strong>Adjust</strong> — rotate the figure in 3D, drag parameters (side, height, etc.) with handles.</li>
  <li><strong>Draw</strong> — the figure is fixed, and you write over it as on a board.</li>
</ul>
<h3>Features</h3>
<p>Ready-made viewpoints (3D / isometric / front / side / top), auto-rotation, extra constructions (height, apothem, cross-sections, inscribed/circumscribed circles), a <strong>net</strong>. A solid can be expanded to the full board (⛶).</p>
`,
      },
      {
        slug: 'materialy-na-doshtsi',
        title: 'Materials on the board',
        summary: 'PDFs, images, presentations, video, YouTube.',
        body: `
<p>You can add ready-made materials to the board from the side panel or upload your own.</p>
<ul>
  <li><strong>Types:</strong> images, PDF, audio, video, presentations (PPTX), documents (DOCX/Word), YouTube, problems.</li>
  <li><strong>PDF import</strong> — a PDF is turned into board pages (up to 50 MB / 50 pages), and you write over it.</li>
  <li>For presentations and documents, you can pick the specific slides/pages you need.</li>
  <li>Files are organized in the <strong>library</strong> (folders, tags, search) — see the "Organization" section.</li>
</ul>
`,
      },
      {
        slug: 'zhyvyi-urok',
        title: 'Live lesson: controls',
        summary: 'Presence, blocking, ending.',
        body: `
<p>Once the student has joined, you run the class live.</p>
<ul>
  <li><strong>Presence</strong> — you can see who's online and the participants' cursors.</li>
  <li><strong>Who writes</strong> — by default you write; the student's drawing can be blocked/unblocked.</li>
  <li><strong>Following</strong> — the student can automatically stay on the same page as you.</li>
  <li><strong>Ending</strong> — when the lesson is over, end the session (an abandoned lesson is closed automatically by the system after a while).</li>
  <li>If the lesson was interrupted — you can always return to it without creating a new one.</li>
</ul>
`,
      },
    ],
  },

  // ─── 📦 After the lesson ─────────────────────────────────────────────────────
  {
    key: 'after',
    icon: '📦',
    title: 'After the lesson',
    articles: [
      {
        slug: 'zapys-urok',
        title: 'Lesson recording (Replay)',
        summary: 'A playback of board actions — this is not a video recording.',
        body: `
<p><strong>Replay is not a video.</strong> It's a playback of your actions on the board (strokes, objects, pages) as an animated sequence with rewind — like the "history" in Google Docs. That's why the recording is compact, and it's easy to find the moment you need in it.</p>
<h3>How to record</h3>
<ol>
  <li>During the lesson, turn on recording (start), and if needed — pause/resume.</li>
  <li>At the end — stop the recording; it will be saved.</li>
</ol>
<h3>Viewing and access</h3>
<ul>
  <li>Recordings are in the <strong>"My Replays"</strong> section; they can be organized into folders.</li>
  <li>Playback has a timeline and rewind.</li>
  <li>To share it with a student — create a <strong>public link</strong> (otherwise only you can see the recording).</li>
</ul>
`,
      },
      {
        slug: 'podilytysya-eksport',
        title: 'Sharing and export',
        summary: 'Links, PDF, PNG.',
        body: `
<h3>Sharing</h3>
<p>Create a public link to a board/recording and send it to the student (there are Telegram / WhatsApp / Viber buttons). Access can be revoked at any time.</p>
<h3>Export</h3>
<ul>
  <li><strong>PNG</strong> — an image of the page (quality + background of your choice).</li>
  <li><strong>PDF</strong> — A4/Letter, the orientation you need.</li>
  <li><strong>Annotated PDF</strong> — if you wrote over an imported PDF, your strokes/text/shapes are exported on top of it.</li>
</ul>
`,
      },
      {
        slug: 'shablony',
        title: 'Board templates',
        summary: 'Ready-made presets + saving your own.',
        body: `
<p>So you don't have to start from scratch every time:</p>
<ul>
  <li><strong>Built-in templates</strong> — blank, two columns, 2×2 grid, timeline, coordinate plane, number line, 3×3 table.</li>
  <li><strong>Save as a template</strong> — turn your board into a template and reuse it.</li>
</ul>
`,
      },
    ],
  },

  // ─── 🗂 Organization ─────────────────────────────────────────────────────────
  {
    key: 'org',
    icon: '🗂',
    title: 'Organization',
    articles: [
      {
        slug: 'biblioteka',
        title: 'Materials library',
        summary: 'Folders, tags, search, favorites.',
        body: `
<p>All your uploaded materials (PDFs, images, presentations, etc.) live in the <strong>library</strong>.</p>
<ul>
  <li>Organize them into <strong>folders</strong> (with nesting).</li>
  <li>Search by name, filter by type, add <strong>tags</strong>, and mark <strong>favorites</strong>.</li>
  <li>From the library, materials are added to the board by dragging/clicking.</li>
</ul>
`,
      },
      {
        slug: 'moi-uchni',
        title: 'My Students',
        summary: 'Student list and invitations.',
        body: `
<p>The <strong>"My Students"</strong> section holds the students you've invited via a link.</p>
<ul>
  <li>Create new invitations (see "Invite a student").</li>
  <li>You see the list of your students and can run lessons with them.</li>
</ul>
`,
      },
      {
        slug: 'kalendar',
        title: 'Calendar and slots',
        summary: 'Schedule and availability.',
        body: `
<p>In the <strong>calendar</strong> you see your availability, booked lessons, and blocked time.</p>
<ul>
  <li>Create availability slots (with a button or by dragging across the grid).</li>
  <li>Edit a slot — change its time or duration.</li>
  <li>Clicking a lesson in the calendar takes you to the corresponding board.</li>
</ul>
`,
      },
    ],
  },
]
