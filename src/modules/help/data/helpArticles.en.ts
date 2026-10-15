/**
 * Help Center — article registry (English translation).
 *
 * Source: ./helpArticles.ts (Ukrainian original, 5 sections, 23 articles; updated 2026-10-15).
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
<h3>What's where in the menu</h3>
<dl class="help-menu-map">
  <dt><a href="/tutor/schedule">Schedule</a></dt><dd>this is where I keep my lesson schedule</dd>
  <dt><a href="/knowledge/my-lessons">My Lessons</a></dt><dd>this is where I run lessons and events</dd>
  <dt><a href="/winterboard/boards">Lesson Studio</a></dt><dd>this is where I prepare for lessons</dd>
  <dt><a href="/winterboard/replays">My Replays</a></dt><dd>this is where I keep my lesson recordings — they appear when I turn on “Record lesson” during a lesson</dd>
  <dt><a href="/winterboard/library">Materials</a></dt><dd>this is where I add and store materials</dd>
  <dt><a href="/remote">Phone remote</a></dt><dd>I open it on my phone to control the lesson — the remote works in a lesson, not in the Studio</dd>
  <dt><a href="/tutor/students">My Students</a></dt><dd>this is where I invite students and talk with them</dd>
</dl>
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
<p><strong>The board is meant for a computer or a tablet.</strong> A phone screen is too narrow for it, so in M4SH the phone is a <a href="/help/pult">remote</a> for the board open on your computer.</p>
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
  <li>The student does not see Integralyk — only what appears on the board.</li>
  <li>The student sees lesson recordings in their account ("My lessons") — those you set to <strong>"👤 Visible to the student"</strong>.</li>
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
        slug: 'integralyk',
        title: 'Integralyk — your assistant on the board',
        summary: 'Your assistant on the board: graphs, inequalities, references.',
        body: `
<p><strong>Integralyk</strong> is the teacher's assistant on the board: you say what you need — it adds it to the board. Students don't see it.</p>
<ul>
  <li><strong>Open</strong> — the character button on the board, or Ctrl+K.</li>
  <li><strong>Ask</strong> — in plain words: "plot y = x² − 4", "x² − 4 ≥ 0 by the interval method", "a Wikipedia reference about Shevchenko".</li>
  <li><strong>About the selection</strong> — select a card, a problem or a picture and ask about it.</li>
  <li><strong>"What Integralyk read"</strong> — a button on a selected picture: what it recognized; you can correct it.</li>
</ul>
<p>The look (Integralyk or Integralka) and switching off — in <a href="/help/nalashtuvannia">settings</a>. Integralyk can make mistakes — double-check important facts.</p>
`,
      },
      {
        slug: 'matematychni-instrumenty',
        title: 'Math tools',
        summary: 'Graphs, number line, trigonometry, derivative/integral, quadratics.',
        body: `
<p>This is the board's key advantage — interactive math objects. Select an object, and its parameters appear in the panel on the right.</p>
<ul>
  <li><strong>Graphing calculator</strong> — y=f(x) graphs: arbitrary expressions, several curves, live slider parameters, points on a curve. The ▶ button runs a parameter from the minimum to the maximum by itself.</li>
  <li><strong>Number line</strong> — type an inequality in one line and click "Apply": the answer appears on the line, by the interval method when needed.</li>
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
<p>Ready-made viewpoints (3D / isometric / front / side / top), auto-rotation, extra constructions (height, apothem, cross-sections, inscribed/circumscribed circles), a <strong>net</strong>. All extra constructions turn on together with the <strong>"show all"</strong> button in the extra constructions header. A solid can be expanded to the full board (⛶).</p>
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
  <li><strong>Photo as page background</strong> — select a picture and click "Set as page background": you can write on it as on a board.</li>
  <li>A single problem from a document can be placed on the board as a picture — see "A problem from a document onto the board".</li>
  <li>YouTube and your own video files — see "Video on the board".</li>
  <li>Files are organized in <strong>"Materials"</strong> (folders, tags, search) — see the "Organization" section.</li>
</ul>
`,
      },
      {
        slug: 'vyrizka-fragmenta',
        title: 'A problem from a document onto the board',
        summary: 'A problem from a PDF, Word or PowerPoint file — as a separate picture.',
        body: `
<p>A problem from a PDF, Word or PowerPoint file open on the board can be placed as a separate picture.</p>
<ol>
  <li>In the document window, click <strong>"Cut a fragment"</strong> (✂️).</li>
  <li>Click the problem — the frame fits itself (or draw around what you need).</li>
  <li>Click <strong>"Add to board"</strong>.</li>
</ol>
<p>Even faster — "⚡ Quick fragment cut": click the problem and it is already on the board.</p>
`,
      },
      {
        slug: 'video-na-doshtsi',
        title: 'Video on the board',
        summary: 'YouTube, "My videos" and your own video files.',
        body: `
<ul>
  <li><strong>YouTube</strong> — the YouTube button on the toolbar: find a video (by voice too) or paste a link and click "Add".</li>
  <li><strong>"My videos"</strong> — in the same window: videos you've already put on a board.</li>
  <li><strong>Your own video files</strong> — upload to "Materials" ("Videos" tab) and place them on the board from the right panel.</li>
  <li>A video expands to full screen and can be minimized.</li>
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
  <li><strong>Fullscreen (⛶)</strong> — the board fills the screen, as on a projector.</li>
  <li><strong>Ending</strong> — when the lesson is over, end the session (an abandoned lesson is closed automatically by the system after a while).</li>
  <li>If the lesson was interrupted — you can always return to it without creating a new one.</li>
</ul>
`,
      },
      {
        slug: 'pult',
        title: 'Phone remote',
        summary: 'Control the lesson from your phone.',
        body: `
<p>Your phone as a remote for the board open on your computer — in a lesson run from "My Lessons" → "Conduct".</p>
<ol>
  <li>On the board, click <strong>"Phone remote"</strong> (📱).</li>
  <li>Scan the QR code with the phone — it must use the same account.</li>
</ol>
<p>From the remote: flip pages, send photos from the phone to the board, YouTube videos, "📋 Scenario" (all the lesson's materials), Integralyk by voice, <a href="/help/dzerkalo">Mirror</a>.</p>
`,
      },
      {
        slug: 'dzerkalo',
        title: 'Mirror: the classroom board on screen',
        summary: 'An ordinary classroom board — on screen and in the recording.',
        body: `
<p>For a lesson with an ordinary classroom board: a phone on a stand photographs the board, and the shots land on the pages by themselves.</p>
<ol>
  <li>On the <a href="/help/pult">remote</a>: "Photo" → <strong>"🪞 Board mirror"</strong>.</li>
  <li>"Find board" — the phone finds the corners itself.</li>
  <li><strong>"Start"</strong>; at the end — "Stop".</li>
</ol>
<p>In a lesson run with "Conduct", Mirror records the lesson by itself — it appears in "My Replays".</p>
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
        summary: 'A playback of board actions; who sees the recording.',
        body: `
<p><strong>Replay is not a video.</strong> It's a playback of your actions on the board (strokes, objects, pages) as an animated sequence with rewind — like the "history" in Google Docs. That's why the recording is compact, and it's easy to find the moment you need in it.</p>
<h3>How to record</h3>
<ol>
  <li>Open the lesson via "My Lessons" → "Conduct" and click <strong>"Record lesson"</strong>.</li>
  <li>If needed — "Pause" / "Resume".</li>
  <li>At the end — <strong>"Finalize"</strong>; the recording appears in "My Replays".</li>
</ol>
<h3>Who sees it</h3>
<p>After recording, choose: <strong>"🔒 Private"</strong>, <strong>"👤 Visible to the student"</strong> (the student sees it in their account) or <strong>"🔗 Anyone with the link"</strong>. To change it later — in "My Replays": ⋯ → "👤 Show to a student…".</p>
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
  <li><strong>"Save as a new template"</strong> — in a conducted lesson, saves the board as a separate template.</li>
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
        summary: 'Tabs, folders, tags, search.',
        body: `
<p>All your materials (PDFs, images, presentations, videos, etc.) live in the <strong>"Materials"</strong> section.</p>
<ul>
  <li>Tabs by type, including <strong>"Videos"</strong>.</li>
  <li>Organize them into <strong>folders</strong> (with nesting), search by name, add <strong>tags</strong>, and mark <strong>"Favorites"</strong>.</li>
  <li>From "Materials", items are added to the board by dragging/clicking.</li>
</ul>
`,
      },
      {
        slug: 'moi-uroky',
        title: '"My Lessons": conducting and folders',
        summary: 'Conduct a lesson, conducted lessons, folders.',
        body: `
<ul>
  <li><strong>"My Lessons"</strong> — your saved lessons.</li>
  <li><strong>"Conduct"</strong> — opens the lesson: recording and the remote work here.</li>
  <li><strong>"Conducted lessons"</strong> — lessons you've already run.</li>
  <li><strong>Folders</strong> — "Create folder"; "Move selected" moves several lessons.</li>
</ul>
`,
      },
      {
        slug: 'moi-uchni',
        title: 'My Students',
        summary: 'Student list, invitations, students without an account.',
        body: `
<p>The <strong>"My Students"</strong> section holds your students.</p>
<ul>
  <li>Create new invitations (see "Invite a student").</li>
  <li><strong>"➕ Student without an account"</strong> — to schedule lessons for a student who doesn't use M4SH; nothing is sent to them.</li>
  <li>You see the list of your students and can run lessons with them.</li>
</ul>
`,
      },
      {
        slug: 'kalendar',
        title: 'Lesson schedule',
        summary: 'Your week and your lesson link.',
        body: `
<p>The <strong>Schedule</strong> page shows your week: planned lessons and blocked time.</p>
<ul>
  <li><strong>Click an empty cell</strong> to open "Create lesson" — pick the time, duration and student.</li>
  <li><strong>Click a lesson</strong> to open its card, and from there its board.</li>
  <li>The ‹ › arrows move between weeks; "?" on the right explains the grid colours.</li>
  <li>Above the grid is <strong>your lesson link</strong> (Zoom, Meet or your own); "Edit" takes you where to change it.</li>
</ul>
<p>Students do not see your schedule: you schedule the lesson yourself and invite the student with a link.</p>
`,
      },
      {
        slug: 'nalashtuvannia',
        title: 'Settings: theme and assistant',
        summary: 'Theme and assistant.',
        body: `
<ul>
  <li><strong>Theme</strong> — in the menu under your avatar: "Light", "Dark", "Classic".</li>
  <li><strong>Assistant</strong> — "Settings" → "General": turn it on or off, choose Integralyk or Integralka.</li>
</ul>
`,
      },
    ],
  },
]
