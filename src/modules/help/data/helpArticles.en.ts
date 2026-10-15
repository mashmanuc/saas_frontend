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
  <li>The student does not see Integralyk — it is the teacher's assistant; the student only sees what appears on the board.</li>
  <li>The student sees lesson recordings in their own account, in the <strong>"My lessons"</strong> section — only those you set to <strong>"👤 Visible to the student"</strong>. Other recordings they can only see if you share the link. More in "Lesson recording (Replay)".</li>
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
        summary: 'Graphs, inequalities, reference cards — just say what you need.',
        body: `
<p><strong>Integralyk</strong> is the teacher's assistant on the board. You type or say in plain words what you need — and it adds it to the board. Students don't see Integralyk, only the result.</p>
<h3>How to open it</h3>
<ul>
  <li>Click the character button on the board (you can drag it wherever is convenient).</li>
  <li>Or press <strong>Ctrl+Shift+K</strong> (or <strong>Ctrl/⌘+K</strong>).</li>
</ul>
<h3>What you can ask for</h3>
<ul>
  <li>A graph: "plot y = x² − 4x + 3", "add the tangent at x = 1".</li>
  <li>An inequality on a number line: "x² − 4 ≥ 0 by the interval method".</li>
  <li>A figure: "a triangle with its medians".</li>
  <li>A Wikipedia reference — a card with a picture and a "Source" button.</li>
  <li>A card with theory or formulas for the lesson topic.</li>
</ul>
<h3>Ask about the selection</h3>
<p>Select a card, a problem, a picture or a number line on the board and ask about it: Integralyk sees exactly what is selected (the full problem text, answer options, the card's caption and sources).</p>
<h3>"What Integralyk read"</h3>
<p>Select a picture with formulas or text and a <strong>"What Integralyk read"</strong> button appears. It shows what the assistant recognized. Click a formula or text to correct it: once saved, Integralyk works with the corrected version.</p>
<h3>Look and switching off</h3>
<p>In <a href="/help/nalashtuvannia">settings</a> you can choose the assistant's look — <strong>Integralyk</strong> or <strong>Integralka</strong> (the same assistant, a different name and look) — or switch it off. From a phone, you ask Integralyk through the <a href="/help/pult">remote</a>.</p>
<p>Integralyk can make mistakes — double-check important facts.</p>
`,
      },
      {
        slug: 'matematychni-instrumenty',
        title: 'Math tools',
        summary: 'Graphs, number line, trigonometry, derivative/integral, quadratics.',
        body: `
<p>This is the board's key advantage — interactive math objects. Select an object, and its parameters appear in the panel on the right.</p>
<ul>
  <li><strong>Graphing calculator</strong> — y=f(x) graphs: arbitrary expressions, several curves, live slider parameters, points on a curve. Formulas go in rows, as in Desmos: <strong>Enter</strong> — a new row, <strong>↑/↓</strong> — the neighbouring row; you can paste several formulas at once (each becomes its own row), and an error is shown under its row. The <strong>▶</strong> button next to a parameter runs it from the minimum to the maximum by itself. The axes have separate scales, and the graph window fits itself.</li>
  <li><strong>Number line</strong> — type an inequality in one line ("x &gt; 3", "−3 &lt; x ≤ 5", "x² − 4 ≥ 0") and click "Apply": the board picks the method itself — an interval, roots, or the <strong>"Interval method"</strong> with signs on the intervals — and shows the answer and the domain. "+ condition" combines several inequalities into a system ("and") or a union ("or").</li>
  <li><strong>Trigonometric circle</strong> — the unit circle and sin/cos/tan/cot graphs, dragging the point, angle labels, numeric values.</li>
  <li><strong>Derivative / Integral</strong> — tangent and secant lines, the f'(x) trace; Riemann sum (left/middle/right), antiderivative.</li>
  <li><strong>Quadratic function</strong> — ax²+bx+c: discriminant, roots, vertex, axis of symmetry; edit by dragging the parabola.</li>
  <li><strong>Plane geometry 2D</strong> — triangles, quadrilaterals, circles; medians, altitudes, bisectors, inscribed and circumscribed circles.</li>
  <li><strong>Helix 3D</strong> — a parametric curve with projections onto planes.</li>
</ul>
<p>The graph, circle, and helix can be <strong>expanded to the full board</strong> (the ⛶ button) — the parameters stay in the panel on the right. <a href="/help/integralyk">Integralyk</a> can add a graph or a number line for you too.</p>
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
        summary: 'Cut a problem out of a PDF, Word or PowerPoint file with one click.',
        body: `
<p>When a document (PDF, Word or PowerPoint) is open on the board, you can put a single problem from it onto the board as a picture — and write next to it or over it.</p>
<h3>"Cut a fragment"</h3>
<ol>
  <li>In the document window, click <strong>"Cut a fragment"</strong> (✂️).</li>
  <li><strong>Click the problem</strong> — the frame fits around it by itself. Or draw a frame around what you need with the mouse, a finger or a pen.</li>
  <li>Adjust the frame if needed and click <strong>"Add to board"</strong>. You can cut several problems in a row and click "Done" at the end.</li>
</ol>
<h3>"⚡ Quick fragment cut"</h3>
<p>When the document window is wide enough, there is a faster way: "⚡ Quick fragment cut" — click the problem or draw a frame right on the document window, and the fragment lands on the board at once. Esc — cancel.</p>
<p>Cut fragments are saved in "Materials".</p>
`,
      },
      {
        slug: 'video-na-doshtsi',
        title: 'Video on the board',
        summary: 'YouTube with search, "My videos" and your own video files.',
        body: `
<h3>YouTube</h3>
<ol>
  <li>Click the <strong>YouTube</strong> button on the toolbar.</li>
  <li>Type a topic in <strong>"Search YouTube"</strong> or click "Search by voice" and say it. "Show more" — the next results.</li>
  <li>Or paste a link to the video.</li>
  <li>Pick a video and confirm "Add" — it goes onto the current page.</li>
</ol>
<p>The <strong>"My videos"</strong> tab in the same window lists the videos you've already put on a board or added to "Materials".</p>
<h3>Your own video files</h3>
<p>Upload a file to "Materials" — it appears on the <strong>"Videos"</strong> tab. A video file is placed on the board from the "Materials" panel on the right.</p>
<h3>During the lesson</h3>
<ul>
  <li>A video can be expanded to <strong>full screen</strong>, like a presentation.</li>
  <li>Video and audio <strong>can be minimized</strong>; a minimized player stays silent.</li>
  <li>From the <a href="/help/pult">remote</a> you can find and play videos from your phone.</li>
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
  <li><strong>Fullscreen (⛶)</strong> — the board fills the screen, as on a projector: after 5 seconds without activity everything except the board hides, and any movement or touch brings the panels back. The screen does not go to sleep meanwhile.</li>
  <li><strong>Remote</strong> — pages, photos, videos and Integralyk from your phone, see "Phone remote".</li>
  <li><strong>Ending</strong> — when the lesson is over, end the session (an abandoned lesson is closed automatically by the system after a while).</li>
  <li>If the lesson was interrupted — you can always return to it without creating a new one.</li>
</ul>
`,
      },
      {
        slug: 'pult',
        title: 'Phone remote',
        summary: 'Control the lesson from your phone: pages, photos, videos, Integralyk.',
        body: `
<p>The remote turns your phone into a remote control for the board open on your computer (for example, on a classroom projector). It controls the lesson you run from "My Lessons" → "Conduct"; photos from the remote only go into such a lesson, not into a template in the Studio.</p>
<h3>How to connect</h3>
<ol>
  <li>Open the lesson board on your computer and click the <strong>"Phone remote"</strong> button (📱) at the top.</li>
  <li>Scan the QR code with your phone's camera or type <strong>m4sh.org/remote</strong> on the phone.</li>
  <li>The phone must use <strong>the same account</strong> as the computer. The remote finds the open board by itself.</li>
</ol>
<p>One remote works for all lessons — it's handy to add it to your phone's home screen. The "Phone remote" menu item opened on a computer shows how to connect a phone.</p>
<h3>What the remote can do</h3>
<ul>
  <li><strong>Pages</strong> — "Back", "Next", "New page", "Undo"; "Task on screen", "Next task", "Whole page".</li>
  <li><strong>Photo</strong> — take a photo of a notebook or textbook (or pick one from the gallery) and add it to the board page or "Set as page background".</li>
  <li><strong>Video</strong> — find a YouTube video by text or voice ("Say a topic"), add it to the board and control it: play, pause, volume.</li>
  <li><strong>📋 Scenario</strong> — all the lesson's videos, audio, documents, cards and pictures by page: open, full screen, minimize, flip document pages.</li>
  <li><strong>Integralyk</strong> — ask the assistant by text or voice ("Talk", hold the button): it adds new material on the next page.</li>
  <li><strong>Answer and solution</strong> for problem cards — show or hide them from the phone.</li>
  <li><strong>🪞 Board mirror</strong> — in the "Photo" section, see "Mirror".</li>
</ul>
<p>Once the remote has connected, the computer offers <strong>"Full screen for the lesson"</strong> — so that videos from the remote fill the whole monitor.</p>
`,
      },
      {
        slug: 'dzerkalo',
        title: 'Mirror: the classroom board on screen',
        summary: 'The phone photographs an ordinary board and places the shots on the pages itself.',
        body: `
<p>Mirror is for a classroom lesson with an ordinary (chalk or marker) board. A phone on a stand looks at the board and sends its photos to M4SH by itself: each shot becomes the background of the current page. Students see what's written on the screen, and the lesson stays in the recording.</p>
<h3>How to turn it on</h3>
<ol>
  <li>Connect the <a href="/help/pult">remote</a>, open the <strong>"Photo"</strong> section and tap <strong>"🪞 Board mirror"</strong>.</li>
  <li>Place the phone so the whole board is in the frame and tap <strong>"Find board"</strong> — the phone finds the corners itself (or set them by hand). "This is what the laptop will see" shows what goes to the screen.</li>
  <li>Tap <strong>"Start"</strong>.</li>
</ol>
<h3>How it works</h3>
<ul>
  <li>A shot is sent when something new is written on the board and nobody stands in front of it. If the phone moves, the corners are set again automatically.</li>
  <li>"Save now" — send a shot by hand; "Pause" / "Resume"; "Stop" — finish.</li>
  <li>Keep the phone screen on: if it goes dark, the shots stop.</li>
</ul>
<h3>Lesson recording</h3>
<p>In a lesson you run from "My Lessons" → "Conduct", Mirror starts the recording on "Start" and finishes it on "Stop" — the lesson appears in "My Replays". On other boards the shots still go, but nothing is recorded.</p>
<h3>Shots in "Materials"</h3>
<p>Shots are kept in "Materials", grouped by each run. The <strong>"Clear unused"</strong> button (🧹) moves shots that are not used anywhere (not on boards, in recordings or in templates) to the Archive; you can restore them from there within 90 days.</p>
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
        summary: 'A playback of board actions; who sees it, "👤 Visible to the student".',
        body: `
<p><strong>Replay is not a video.</strong> It's a playback of your actions on the board (strokes, objects, pages) as an animated sequence with rewind — like the "history" in Google Docs. That's why the recording is compact, and it's easy to find the moment you need in it.</p>
<h3>How to record</h3>
<ol>
  <li>Recording works in a lesson opened from <strong>"My Lessons" → "Conduct"</strong>: there is a <strong>"Record lesson"</strong> button at the top of the board.</li>
  <li>While recording — "Pause" and "Resume" (the same recording).</li>
  <li>At the end — <strong>"Finalize"</strong>. If nothing changed on the board between start and end, the recording is not saved.</li>
  <li>After finishing, the board keeps working; "Record lesson" again starts a new recording from what is already on the board.</li>
</ol>
<p>A classroom lesson with <a href="/help/dzerkalo">Mirror</a> is recorded automatically.</p>
<h3>Who sees the recording</h3>
<p>Right after finishing, choose the visibility — the link is copied automatically:</p>
<ul>
  <li><strong>🔒 Private</strong> — only you.</li>
  <li><strong>👤 Visible to the student</strong> — the student sees the recording in their account, in "My lessons"; it does not open by link. This option appears when the lesson was run with a student.</li>
  <li><strong>🔗 Anyone with the link</strong> — anyone with the link can watch it, without signing in.</li>
  <li><strong>🌍 Make open for everyone</strong> — the recording can be found and shared.</li>
</ul>
<p>You can change the visibility later: in "My Replays", the ⋯ menu on a recording card → <strong>"👤 Show to a student…"</strong> (also for older recordings and for a new student).</p>
<h3>Viewing</h3>
<ul>
  <li>Recordings are in the <strong>"My Replays"</strong> section; they can be organized into folders.</li>
  <li>Playback has a timeline and rewind.</li>
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
  <li><strong>"Save as a new template"</strong> — in a conducted lesson (opened from "My Lessons") saves the current state of the board as a separate template; the lesson you started from does not change.</li>
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
        summary: 'Tabs, folders, tags, search, favorites.',
        body: `
<p>All your materials (PDFs, images, presentations, videos, etc.) live in the <strong>"Materials"</strong> section.</p>
<ul>
  <li>Tabs by type — including <strong>"Videos"</strong> (YouTube and your own video files), file preview, groups by date.</li>
  <li>Organize them into <strong>folders</strong> (with nesting), search by name, filter by type, add <strong>tags</strong>, and mark <strong>"Favorites"</strong>.</li>
  <li>From "Materials", items are added to the board by dragging/clicking; when there are many files, the board's side panel has "Show more".</li>
  <li><a href="/help/dzerkalo">Mirror</a> shots are grouped by run; "Clear unused" (🧹) moves unused ones to the Archive.</li>
</ul>
`,
      },
      {
        slug: 'moi-uroky',
        title: '"My Lessons": conducting and folders',
        summary: 'Lesson templates, "Conduct", conducted lessons, folders.',
        body: `
<p>The <strong>"My Lessons"</strong> section holds your saved lesson templates. Lessons are run from here.</p>
<ul>
  <li><strong>"Conduct"</strong> on a lesson card opens the lesson board: this is where "Record lesson" and the remote work. The template itself does not change.</li>
  <li>Conducted lessons appear on the <strong>"Conducted lessons"</strong> tab.</li>
  <li><strong>Folders</strong> — "Create folder", subfolders; "All lessons" shows everything together. To move several lessons, select them and click <strong>"Move selected (N)"</strong>.</li>
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
  <li>Create new invitations (see "Invite a student") — a student with an account sees your recordings marked "👤 Visible to the student".</li>
  <li><strong>"➕ Student without an account"</strong> — to schedule lessons for a student who doesn't use M4SH (for example, from another platform). Nothing is sent to them. "Where the student comes from" — "My student" or "From a platform": the label shows in the student list and when choosing a student for a lesson.</li>
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
        summary: 'Light, dark or classic theme; Integralyk or Integralka.',
        body: `
<ul>
  <li><strong>Theme</strong> — in the menu under your avatar: "Light", "Dark" or "Classic" (white with neutral grey).</li>
  <li><strong>Assistant</strong> — <a href="/settings">"Settings"</a> → "General": turn the assistant on the board on or off and choose its look — "Integralyk" or "Integralka".</li>
  <li>Language and time zone are there too.</li>
</ul>
`,
      },
    ],
  },
]
