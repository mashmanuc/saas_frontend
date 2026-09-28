<template>
  <div class="wb-remote" :data-state="channel.state.value" :data-sheet="sheet ?? ''">
    <!-- A. Статус: вихід · зв'язок і назва уроку · «Підключити» / шестерня
         (пульт v2, ТЗ TZ_REMOTE_LAYOUT_V2 §2: акаунт, предмет, мова, «Відключити» — за шестернею) -->
    <header class="wb-remote__top">
      <!-- Вихід із пульта. Пульт — повноекранний режим, а на телефоні, доданому
           на головний екран, браузерної «назад» немає взагалі: без цієї кнопки
           з пульта нікуди не вийти (власник 2026-09-22). -->
      <RouterLink to="/winterboard/boards" class="wb-remote__home" :aria-label="t('winterboard.remote.exitToBoards')">
        <span aria-hidden="true">⌂</span>
      </RouterLink>
      <span class="wb-remote__status" :class="`wb-remote__status--${channel.state.value}`">
        <span class="wb-remote__dot" aria-hidden="true" />
        <span class="wb-remote__status-text">{{ statusLabel }}</span>
        <span v-if="boardName" class="wb-remote__status-board" data-testid="board-name">· {{ boardName }}</span>
      </span>
      <button v-if="!isLinked" type="button" class="wb-remote__exit wb-remote__exit--primary" @click="resolveAndConnect">
        {{ t('winterboard.remote.connect') }}
      </button>
      <button
        type="button"
        class="wb-remote__gear"
        data-testid="open-settings"
        :aria-label="t('winterboard.remote.settings')"
        @click="openSheet('settings')"
      ><span aria-hidden="true">⚙</span></button>
    </header>

    <!-- Причина, чому пульт не керує — ЗАВЖДИ словами, ніколи мовчки -->
    <div v-if="reason" class="wb-remote__block" :class="`wb-remote__block--${reason.tone}`" role="status">
      <p class="wb-remote__reason">{{ reason.text }}</p>
      <p v-if="reason.hint" class="wb-remote__hint">{{ reason.hint }}</p>
      <button type="button" class="wb-remote__refresh" @click="refreshBoard">
        {{ t('winterboard.remote.refresh') }}
      </button>
    </div>

    <!-- Після ПЕРШОГО підключення на цьому пристрої — три рядки, один раз
         (TZ_REMOTE_DESKTOP_CONNECT §2.4). -->
    <div v-if="showFirstTip" class="wb-remote__tip" role="note">
      <p class="wb-remote__tip-title">{{ t('winterboard.remote.firstTip.title') }}</p>
      <ul class="wb-remote__tip-list">
        <li>{{ t('winterboard.remote.firstTip.line1') }}</li>
        <li>{{ t('winterboard.remote.firstTip.line2') }}</li>
        <li>{{ t('winterboard.remote.firstTip.line3') }}</li>
      </ul>
      <button type="button" class="wb-remote__tip-ok" @click="dismissFirstTip">
        {{ t('winterboard.remote.firstTip.ok') }}
      </button>
    </div>

    <!-- До першого remote.state клавіатури немає: Студія на ноутбуці, дошки нема,
         інший акаунт — лише статус, причина й «Оновити» (ТЗ §2, вид А). -->
    <p v-if="!keyboard && !reason" class="wb-remote__page-wait">{{ t('winterboard.remote.waitingBoard') }}</p>

    <template v-if="keyboard">
      <!-- B. Сторінка -->
      <div class="wb-remote__page" aria-live="polite">
        <span class="wb-remote__page-cur">{{ (pageIndex ?? 0) + 1 }}</span>
        <span class="wb-remote__page-sep">/</span>
        <span class="wb-remote__page-total">{{ pageCount }}</span>
      </div>

      <!-- C. Ядро: ◀ ▶ найбільші; «Нова сторінка» й «Відмінити» удвічі менші.
           Вимкнена кнопка лишається на місці (вид Б), а тап по ній пояснює чому:
           кнопка з disabled подій не дає, тож слухає обгортка (pointer-events: none). -->
      <div class="wb-remote__grid">
        <div class="wb-remote__slot wb-remote__slot--big" data-testid="slot-prev" @click="whyDisabled('prev')">
          <button type="button" class="wb-remote__btn wb-remote__btn--big" :disabled="!canPrev" @click="goRel(-1)">
            <span class="wb-remote__btn-icon" aria-hidden="true">◀</span>
            <span class="wb-remote__btn-label">{{ t('winterboard.remote.prev') }}</span>
          </button>
        </div>
        <div class="wb-remote__slot wb-remote__slot--big" data-testid="slot-next" @click="whyDisabled('next')">
          <button type="button" class="wb-remote__btn wb-remote__btn--big" :disabled="!canNext" @click="goRel(1)">
            <span class="wb-remote__btn-icon" aria-hidden="true">▶</span>
            <span class="wb-remote__btn-label">{{ t('winterboard.remote.next') }}</span>
          </button>
        </div>
        <div class="wb-remote__slot" @click="whyDisabled('ready')">
          <button type="button" class="wb-remote__btn wb-remote__btn--small" :disabled="!isReady" @click="sendCmd('page.new')">
            <span class="wb-remote__btn-icon" aria-hidden="true">＋</span>
            <span class="wb-remote__btn-label">{{ t('winterboard.remote.newPage') }}</span>
          </button>
        </div>
        <div class="wb-remote__slot" @click="whyDisabled('ready')">
          <button type="button" class="wb-remote__btn wb-remote__btn--small" :disabled="!isReady" @click="sendCmd('undo')">
            <span class="wb-remote__btn-icon" aria-hidden="true">↶</span>
            <span class="wb-remote__btn-label">{{ t('winterboard.remote.undo') }}</span>
          </button>
        </div>
      </div>
      <p v-if="why" class="wb-remote__why" role="status" data-testid="why">{{ why }}</p>

      <!-- D. Контекст (вид В): з'являється з вмістом сторінки, ядро не зсувається.
           Картки задач: поза показом — «Задача на екран»; у показі вона МІНЯЄТЬСЯ на
           «Уся сторінка» (+ «Наступна задача», коли карток кілька), «Відповідь» і «Розбір».
           Дрібний ряд: A− A+ — завжди, коли є картки; ▲▼ — лише в показі (Б-106).
           Відео поточної сторінки — ▶/⏸. -->
      <div v-if="hasCards || videos.length" class="wb-remote__context" data-testid="context">
        <template v-if="hasCards">
          <div v-if="!isPresentingTask" class="wb-remote__row">
            <button type="button" class="wb-remote__mini wb-remote__mini--wide" :disabled="!isReady" @click="sendCmd('view.fit')">
              {{ t('winterboard.remote.fitTask') }}
            </button>
          </div>
          <template v-else>
            <div class="wb-remote__row">
              <!-- v1.10: з «Задача на екран» — назад до звичайного вигляду сторінки -->
              <button type="button" class="wb-remote__mini wb-remote__mini--wide wb-remote__page-view" :disabled="!isReady" @click="sendCmd('view.page')">
                {{ t('winterboard.remote.fitPage') }}
              </button>
              <!-- Кілька карток: той самий view.fit гортає їх по колу (власник 2026-09-27) -->
              <button v-if="(cards?.count ?? 0) > 1" type="button" class="wb-remote__mini wb-remote__mini--wide" :disabled="!isReady" @click="sendCmd('view.fit')">
                {{ t('winterboard.remote.nextTask') }}
              </button>
            </div>
            <div class="wb-remote__row">
              <button type="button" class="wb-remote__mini wb-remote__mini--wide" :class="{ 'is-on': cards?.answer }" :disabled="!isReady" @click="sendCmd('card.reveal', { what: 'answer' })">
                {{ cards?.answer ? t('winterboard.remote.hideAnswer') : t('winterboard.remote.showAnswer') }}
              </button>
              <button type="button" class="wb-remote__mini wb-remote__mini--wide" :class="{ 'is-on': cards?.solution }" :disabled="!isReady" @click="sendCmd('card.reveal', { what: 'solution' })">
                {{ cards?.solution ? t('winterboard.remote.hideSolution') : t('winterboard.remote.showSolution') }}
              </button>
            </div>
          </template>
          <!-- Б-106 (власник 2026-09-27, з планшета): A−/A+ — і поза показом. Учитель збільшує
               задачу й пише на дошці збоку, а клас бачить її великою; розгортати картку на весь
               екран заради шрифту не треба. Ноутбук робить view.zoom і без показу (картка у фокусі,
               інакше перша). ▲/▼ гортають лише розгорнуту картку — тому вони тільки в показі.
               Ряд — сітка на чотири: A− A+ стоять на тих самих місцях в обох режимах. -->
          <div class="wb-remote__row wb-remote__row--fine" data-testid="zoom-row">
            <button type="button" class="wb-remote__mini wb-remote__mini--fine" :disabled="!isReady" :aria-label="t('winterboard.remote.fontDown')" @click="sendCmd('view.zoom', { delta: -1 })">A−</button>
            <button type="button" class="wb-remote__mini wb-remote__mini--fine" :disabled="!isReady" :aria-label="t('winterboard.remote.fontUp')" @click="sendCmd('view.zoom', { delta: 1 })">A+</button>
            <template v-if="isPresentingTask">
              <button type="button" class="wb-remote__mini wb-remote__mini--fine" :disabled="!isReady" :aria-label="t('winterboard.remote.scrollUp')" @click="sendCmd('view.scroll', { dir: -1 })">▲</button>
              <button type="button" class="wb-remote__mini wb-remote__mini--fine" :disabled="!isReady" :aria-label="t('winterboard.remote.scrollDown')" @click="sendCmd('view.scroll', { dir: 1 })">▼</button>
            </template>
          </div>
        </template>

        <!-- Відео поточної сторінки: ▶/⏸ (v1.8); пошук і посилання — в аркуші «Відео» -->
        <div v-if="videos.length" class="wb-remote__video-ctl">
          <select
            v-if="videos.length > 1"
            v-model="activeVideoId"
            class="wb-remote__video-pick"
            :aria-label="t('winterboard.remote.video.pick')"
          >
            <option v-for="v in videos" :key="v.objectId" :value="v.objectId">
              {{ v.title || t('winterboard.remote.video.untitled') }}
            </option>
          </select>
          <p v-else class="wb-remote__video-name">{{ activeVideo?.title || t('winterboard.remote.video.untitled') }}</p>
          <div class="wb-remote__row">
            <button type="button" class="wb-remote__mini wb-remote__mini--wide" :disabled="!activeVideo" @click="sendCmd('video.play', { object_id: activeVideoId })">
              ▶ {{ t('winterboard.remote.video.play') }}
            </button>
            <button type="button" class="wb-remote__mini wb-remote__mini--wide" :disabled="!activeVideo" @click="sendCmd('video.pause', { object_id: activeVideoId })">
              ⏸ {{ t('winterboard.remote.video.pause') }}
            </button>
          </div>
          <p v-if="activeVideo?.state === 'blocked'" class="wb-remote__video-blocked" role="status">
            {{ t('winterboard.remote.video.blocked') }}
          </p>
          <p v-else-if="activeVideo?.state === 'error'" class="wb-remote__video-blocked" role="status">
            {{ t(`winterboard.remote.video.playerError.${activeVideo.error ?? 'playback'}`) }}
          </p>
          <p v-else-if="activeVideo" class="wb-remote__note">{{ t(`winterboard.remote.video.state.${activeVideo.state}`) }}</p>
        </div>
      </div>

      <!-- E. Додати: лише те, що ця дошка вміє (caps, LAW §9 v1.12 — вид А) -->
      <div v-if="canPhoto || canVideo" class="wb-remote__add" data-testid="add-row">
        <button v-if="canPhoto" type="button" class="wb-remote__add-btn" data-testid="open-photo" :disabled="!isReady" @click="openSheet('photo')">
          <span class="wb-remote__add-plus" aria-hidden="true">＋</span>
          <span>{{ t('winterboard.remote.addPhoto') }}</span>
          <span v-if="photoBadge" class="wb-remote__badge" :class="`wb-remote__badge--${photoBadge.tone}`" data-testid="photo-badge">{{ photoBadge.text }}</span>
        </button>
        <button v-if="canVideo" type="button" class="wb-remote__add-btn" data-testid="open-video" :disabled="!isReady" @click="openSheet('video')">
          <span class="wb-remote__add-plus" aria-hidden="true">＋</span>
          <span>{{ t('winterboard.remote.addVideo') }}</span>
        </button>
      </div>

      <!-- LAW §9 v1.15 «📋 Сценарій» (ТЗ §2.1): рядок на всю ширину під «+ Фото / + Відео».
           Лише за caps ∋ 'scenario' (вид А); N = 0 — вимкнена на місці, тап пояснює (вид Б). -->
      <template v-if="canScenario">
        <div class="wb-remote__scenario-slot" data-testid="scenario-slot" @click="whyScenario">
          <button
            type="button"
            class="wb-remote__add-btn wb-remote__scenario-btn"
            data-testid="open-scenario"
            :disabled="!isReady || scenarioCount === 0"
            @click="openSheet('scenario')"
          >
            <span aria-hidden="true">📋</span>
            <span>{{ t('winterboard.remote.scenario.button') }} · {{ scenarioCount }}</span>
          </button>
        </div>
        <p v-if="scenarioWhy" class="wb-remote__why" role="status" data-testid="scenario-why-empty">{{ scenarioWhy }}</p>
      </template>

      <!-- LAW §9 v1.14 (власник 2026-09-28, погоджено): згорнути вікно Інтегралика на
           ноутбуці — те саме, що «–» у його шапці; розмова лишається. Одразу над «Говорю». -->
      <button
        type="button"
        class="wb-remote__assistant-min"
        data-testid="assistant-minimize"
        :disabled="!isReady"
        @click="sendCmd('assistant.minimize')"
      >
        <span aria-hidden="true">–</span>
        {{ t('winterboard.remote.minimizeAssistant') }}
      </button>

      <!-- F. Говорю (тримати) — пришпилено знизу, єдина кнопка з акцентом -->
      <button
        v-if="ptt.supported"
        type="button"
        class="wb-remote__talk"
        :class="{ 'wb-remote__talk--on': ptt.listening.value }"
        :disabled="!isReady"
        @pointerdown.prevent="startRemoteVoice"
        @pointerup.prevent="ptt.release()"
        @pointercancel.prevent="ptt.release()"
        @pointerleave="ptt.release()"
        @contextmenu.prevent
      >
        <span class="wb-remote__talk-icon" aria-hidden="true">🎙</span>
        {{ ptt.listening.value ? t('winterboard.remote.listening') : t('winterboard.remote.holdToTalk') }}
      </button>
      <p v-else class="wb-remote__note">{{ t('winterboard.remote.voiceUnsupported') }}</p>

      <p v-if="lastPhrase" class="wb-remote__last">{{ lastPhrase }}</p>
    </template>

    <!-- Аркуші знизу (ТЗ §4): одночасно один; закриття — «×», затемнення, клавіша «Назад».
         Вміст тримається v-show: закритий аркуш не губить незавершене фото чи пошук. -->
    <div v-show="sheet" class="wb-remote__scrim" data-testid="sheet-scrim" @click="closeSheet" />
    <section
      v-show="sheet"
      class="wb-remote__sheet"
      :data-sheet="sheet ?? ''"
      data-testid="remote-sheet"
      role="dialog"
      aria-modal="true"
      :aria-label="sheetTitle"
    >
      <header class="wb-remote__sheet-top">
        <span class="wb-remote__sheet-title">{{ sheetTitle }}</span>
        <button type="button" class="wb-remote__sheet-close" data-testid="sheet-close" :aria-label="t('winterboard.remote.close')" @click="closeSheet">×</button>
      </header>

      <!-- v1.9 (LAW §9): фото з телефона на поточну сторінку. Змонтована, поки відома
           дошка, — коротка втрата зв'язку чи закритий аркуш не губить незавершену спробу. -->
      <RemotePhotoPanel
        v-if="pair && canPhoto"
        v-show="sheet === 'photo'"
        :ready="isReady"
        :page-index="pageIndex"
        :result="photoResult"
        :send="sendPhoto"
        :tel="tel"
        @phase="photoPhase = $event"
        @done="closeSheet"
      />

      <!-- Відео (v1.8): пошук → вибір → підтвердження → картку ставить ноутбук -->
      <div v-show="sheet === 'video'" class="wb-remote__video" data-testid="video-sheet">
        <form v-if="!videoSearchOff" class="wb-remote__video-search" @submit.prevent="runVideoSearch()">
          <input
            v-model="videoQuery"
            type="search"
            class="wb-remote__video-input"
            enterkeyhint="search"
            :placeholder="t('winterboard.remote.video.placeholder')"
            :aria-label="t('winterboard.remote.video.placeholder')"
          >
          <button type="submit" class="wb-remote__mini" :disabled="videoSearching || !videoQuery.trim()">
            {{ videoSearching ? '…' : t('winterboard.remote.video.search') }}
          </button>
        </form>
        <!-- Пошук не налаштовано (немає ключа) — на цю сесію лишаємо лише посилання -->
        <p v-else class="wb-remote__note" data-testid="video-search-off">{{ t('winterboard.remote.searchOff') }}</p>
        <button
          v-if="ptt.supported && !videoSearchOff"
          type="button"
          class="wb-remote__video-mic"
          :class="{ 'wb-remote__video-mic--on': ptt.listening.value && videoVoiceActive }"
          :disabled="!isReady || videoSearching"
          :aria-pressed="ptt.listening.value && videoVoiceActive"
          @pointerdown.prevent="startVideoVoice"
          @pointerup.prevent="ptt.release()"
          @pointercancel.prevent="ptt.release()"
          @pointerleave="ptt.release()"
          @contextmenu.prevent
        >
          <span aria-hidden="true">🎙</span>
          {{ ptt.listening.value && videoVoiceActive ? t('winterboard.remote.listening') : t('winterboard.remote.video.sayTopic') }}
        </button>
        <!-- Запасний шлях: посилання, яке вчитель знайшов сам (або вичерпано квоту пошуку) -->
        <form class="wb-remote__video-link" @submit.prevent="runVideoLookup()">
          <input
            v-model="videoLink"
            type="url"
            inputmode="url"
            class="wb-remote__video-input"
            :placeholder="t('winterboard.remote.video.linkPlaceholder')"
            :aria-label="t('winterboard.remote.video.linkPlaceholder')"
          >
          <div class="wb-remote__row">
            <button v-if="canReadClipboard" type="button" class="wb-remote__mini wb-remote__mini--wide" :disabled="videoLooking" @click="pasteVideoLink">
              {{ t('winterboard.remote.video.paste') }}
            </button>
            <button type="submit" class="wb-remote__mini wb-remote__mini--wide" :disabled="videoLooking || !videoLink.trim()">
              {{ videoLooking ? '…' : t('winterboard.remote.video.check') }}
            </button>
          </div>
        </form>

        <p v-if="videoError" class="wb-remote__note">{{ videoError }}</p>

        <div v-if="videoPick" class="wb-remote__video-confirm">
          <!-- Прев'ю перед додаванням — однакове для пошуку й посилання -->
          <div class="wb-remote__video-item wb-remote__video-item--preview">
            <span class="wb-remote__video-thumb">
              <img :src="videoPick.thumbnail" alt="" loading="lazy">
              <span v-if="videoPick.duration_s != null" class="wb-remote__video-dur">{{ fmtDuration(videoPick.duration_s) }}</span>
            </span>
            <span class="wb-remote__video-meta">
              <span class="wb-remote__video-title">{{ videoPick.title }}</span>
              <span class="wb-remote__video-channel">{{ videoPick.channel }}</span>
              <span v-if="languageBadge(videoPick)" class="wb-remote__video-lang">{{ languageBadge(videoPick) }}</span>
            </span>
          </div>
          <p class="wb-remote__video-confirm-text">{{ t('winterboard.remote.video.confirm', { title: videoPick.title }) }}</p>
          <div class="wb-remote__row">
            <button type="button" class="wb-remote__mini wb-remote__mini--wide is-on" @click="confirmVideoPick">
              {{ t('winterboard.remote.video.add') }}
            </button>
            <button type="button" class="wb-remote__mini wb-remote__mini--wide" @click="videoPick = null">
              {{ t('winterboard.remote.video.cancel') }}
            </button>
          </div>
        </div>
        <ul v-else-if="videoResults.length" class="wb-remote__video-results">
          <li v-for="r in videoResults" :key="r.ref.id">
            <button type="button" class="wb-remote__video-item" @click="videoPick = r">
              <span class="wb-remote__video-thumb">
                <img :src="r.thumbnail" alt="" loading="lazy">
                <span v-if="r.duration_s != null" class="wb-remote__video-dur">{{ fmtDuration(r.duration_s) }}</span>
              </span>
              <span class="wb-remote__video-meta">
                <span class="wb-remote__video-title">{{ r.title }}</span>
                <span class="wb-remote__video-channel">{{ r.channel }}</span>
                <span v-if="languageBadge(r)" class="wb-remote__video-lang">{{ languageBadge(r) }}</span>
              </span>
            </button>
          </li>
        </ul>
      </div>

      <!-- LAW §9 v1.15: «Сценарій» — відео, аудіо й документи дошки за сторінками -->
      <RemoteScenarioSheet
        v-if="canScenario"
        v-show="sheet === 'scenario'"
        :scenario="scenario"
        :page-index="pageIndex"
        :ready="isReady"
        :open="sheet === 'scenario'"
        @send="(cmd, args) => sendCmd(cmd as RemoteCmd, args)"
      />

      <!-- Налаштування (ТЗ §4.3): акаунт → предмет і мова → «Оновити» → адреса → «Відключити» -->
      <div v-show="sheet === 'settings'" class="wb-remote__settings" data-testid="settings-sheet">
        <p class="wb-remote__who">
          <span v-if="accountEmail">{{ t('winterboard.remote.loggedInAs') }} <strong>{{ accountEmail }}</strong></span>
          <span v-if="boardName"> · {{ t('winterboard.remote.board') }}: <strong>{{ boardName }}</strong></span>
        </p>
        <!-- Мультимедійна дошка в класі часто під ШКІЛЬНИМ акаунтом, а телефон —
             під особистим. Активна дошка шукається по акаунту, тож пульт чесно
             каже «дошок нема». Власник на уроці 2026-09-04: «треба мати
             можливість пультові швидко змінювати акаунт». -->
        <button
          v-if="accountEmail"
          type="button"
          class="wb-remote__switch"
          :disabled="switching"
          @click="switchAccount"
        >
          {{ t('winterboard.remote.switchAccount') }}
        </button>

        <!-- v1.6 (LAW §9): предмет і мова матеріалу Інтегралика — той самий селектор і той
             самий реєстр, що в палітрі на ноутбуці. Пульт шле лише намір; пише ноутбук. -->
        <CorridorSelector
          v-if="corridorRegistry && assistantView"
          class="wb-remote__corridor"
          compact
          :registry="corridorRegistry"
          :subject="assistantView.subject"
          :language="assistantView.language"
          :disabled="!isReady"
          @select-subject="onRemoteSubject"
          @select-language="onRemoteLanguage"
        />

        <button type="button" class="wb-remote__settings-refresh" data-testid="settings-refresh" @click="refreshBoard(); closeSheet()">
          {{ t('winterboard.remote.refresh') }}
        </button>

        <p v-if="remoteAddress" class="wb-remote__address">
          {{ t('winterboard.remote.remoteAddress') }}: <strong>{{ remoteAddress }}</strong>
        </p>

        <button
          v-if="isLinked"
          type="button"
          class="wb-remote__exit wb-remote__exit--danger"
          @click="disconnect"
        >{{ t('winterboard.remote.disconnect') }}</button>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
/**
 * Пульт на телефоні (LAW §9 «Remote control», CLASSROOM_REMOTE_VISION крок 5–7).
 *
 * v2 (2026-09-27, ТЗ TZ_REMOTE_LAYOUT_V2, рішення власника «Р1 приймаю»):
 *  - шість зон за частотою: статус · сторінка · ядро ◀ ▶ · контекст сторінки ·
 *    «+ Фото / + Відео» · «Говорю». Ядро без скролу на 360×640, ◀ ▶ у зоні пальця.
 *  - правило трьох станів: чого дошка не вміє (caps) — не показуємо; чого не можна
 *    зараз — вимкнена на місці, тап пояснює; що залежить від сторінки — у своїй зоні.
 *  - клавіатури немає до першого remote.state (Студія, дошки нема, інший акаунт).
 *  - фото, відео, налаштування — аркуші знизу; «Назад» Android закриває аркуш.
 *
 * v1.1 (2026-09-02, після живого тесту власника):
 *  - /remote БЕЗ id: пульт сам питає бекенд, яку дошку зараз відкрито на
 *    ноутбуці (GET /winterboard/remote/active/). Один пульт на всі уроки.
 *    /winterboard/:id/remote лишається як прямий вхід (QR старого зразка).
 *  - Код зв'язки стабільний (derivePair з id дошки) — нічого не протухає.
 *  - Ніякого мовчазного «Чекаю дошку…»: кожна причина названа словами
 *    (дошка не відкрита / інший акаунт / забагато з'єднань / стара збірка).
 *
 * Команди абсолютні: індекс рахується тут з останнього remote.state, тож
 * подвійний тап або загублене повідомлення не зсуває на дві сторінки.
 * Канал lossy — загублену команду вчитель тисне ще раз (без retry).
 */
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/modules/auth/store/authStore'
import authApi from '@/modules/auth/api/authApi'
import { trackEvent } from '@/utils/telemetryAgent'
import { winterboardApi, type VideoCandidate } from '../api/winterboardApi'
import { matchVideoSearchPhrase } from '../remote/videoSearchPhrase'
import { useRemoteChannel } from '../composables/useRemoteChannel'
import { usePushToTalk } from '../composables/usePushToTalk'
import { matchRemotePhrase } from '../remote/remoteGrammar'
import { derivePair } from '../remote/remotePair'
import { firstTipSeen, markFirstTipSeen, remoteEntryUrl } from '../remote/remoteEntry'
import CorridorSelector from '@/modules/intent/corridors/CorridorSelector.vue'
import { fetchCorridorRegistry } from '@/modules/intent/corridors/corridorApi'
import type { RemoteStateDetail, RemoteCap } from '../composables/useRemoteChannel'
import RemotePhotoPanel from '../components/remote/RemotePhotoPanel.vue'
import RemoteScenarioSheet from '../components/remote/RemoteScenarioSheet.vue'
import type { RemotePhotoResult } from '../remote/photoContract'

const props = defineProps<{ id?: string }>()
const { t, locale } = useI18n()
const authStore = useAuthStore()

const accountEmail = computed(() => authStore.user?.email ?? '')

// Швидка зміна акаунта прямо з пульта (власник на уроці 2026-09-04).
// Чому окремо, а не `authStore.logout()`: той жорстко веде на ЛЕНДІНГ
// (`/start`), а з телефона це зайвий екран — та сама причина, через яку
// маршрут пульта позначено `meta.loginDirect`. Тут ведемо одразу на вхід і
// повертаємось на пульт.
const switching = ref(false)
async function switchAccount(): Promise<void> {
  if (switching.value) return
  switching.value = true
  trackEvent('wb.remote.switch_account', {})
  try {
    await authApi.logout()
  } catch {
    // Мережа могла впасти — локальний стан однаково чистимо нижче,
    // інакше пульт лишиться з чужим токеном в пам'яті.
  }
  try {
    await authStore.forceLogout('manual_logout')
  } finally {
    window.location.href = `/auth/login?redirect=${encodeURIComponent('/remote')}`
  }
}
const clientId = (() => {
  try { return crypto.randomUUID() } catch { return `p-${Date.now().toString(36)}` }
})()

const boardId = ref<string | null>(null)
const boardName = ref('')
const pair = computed(() => (boardId.value ? derivePair(boardId.value) : ''))
/** Адреса пульта для другого телефона — та сама, що на сторінці підключення й у QR. */
const remoteAddress = computed(() => remoteEntryUrl().replace(/^https?:\/\//, ''))

const pageIndex = ref<number | null>(null)
const pageCount = ref<number | null>(null)
const lastPhrase = ref('')
/** v1.2 — картки задач на поточній сторінці (з remote.state ноутбука) */
const cards = ref<{ count: number; answer: boolean | null; solution: boolean | null; presenting?: boolean } | null>(null)
const hasCards = computed(() => !!cards.value && cards.value.count > 0)
/** У показі задачі блок карток міняє режим: «Уся сторінка», A± ▲▼ і решта. */
const isPresentingTask = computed(() => !!cards.value?.presenting)

/**
 * v1.12 (LAW §9): що ця дошка вміє понад навігацію. `null` — ноутбук поля не прислав
 * (стара збірка в кеші): показуємо все, як до v2. Порожній список — ряду «Додати» немає.
 */
const caps = ref<RemoteCap[] | null>(null)
const canPhoto = computed(() => !caps.value || caps.value.includes('photo'))
const canVideo = computed(() => !caps.value || caps.value.includes('video'))
/**
 * v1.15 «Сценарій»: лише коли ноутбук сам оголосив 'scenario' (ТЗ §2.1). На відміну від
 * фото й відео, старий ноутбук без `caps` кнопки НЕ отримує: списку він не шле.
 */
const canScenario = computed(() => caps.value?.includes('scenario') === true)
const scenario = ref<RemoteStateDetail['scenario'] | null>(null)
const scenarioCount = computed(() => scenario.value?.items.length ?? 0)
const scenarioWhy = ref('')
let scenarioWhyTimer: ReturnType<typeof setTimeout> | null = null
/** Вид Б: тап по вимкненій «📋 Сценарій» пояснює причину одним рядком під нею. */
function whyScenario(): void {
  if (isReady.value && scenarioCount.value > 0) return
  scenarioWhy.value = isReady.value ? t('winterboard.remote.scenario.empty') : t('winterboard.remote.waitingBoard')
  if (scenarioWhyTimer) clearTimeout(scenarioWhyTimer)
  scenarioWhyTimer = setTimeout(() => { scenarioWhy.value = '' }, 2500)
  tel('why', { which: 'scenario' })
}

// ── Прототип «відео з пульта» (2026-09-25) ─────────────────────────────────
/** YouTube-картки поточної сторінки ноутбука (з remote.state) */
const videos = ref<NonNullable<RemoteStateDetail['videos']>>([])
/** v1.9: результат останньої спроби «фото на дошку» від ноутбука */
const photoResult = ref<RemotePhotoResult | null>(null)
/** Фаза панелі фото — позначка на «+ Фото», поки аркуш закритий, а фото ще в дорозі */
const photoPhase = ref('idle')
const photoBadge = computed<{ text: string; tone: 'busy' | 'ok' | 'warn' } | null>(() => {
  switch (photoPhase.value) {
    case 'preparing': case 'uploading': case 'sending': return { text: '…', tone: 'busy' }
    case 'placed': return { text: '✓', tone: 'ok' }
    case 'rejected': case 'unconfirmed': case 'upload_error': case 'prepare_error': return { text: '!', tone: 'warn' }
    default: return null
  }
})
const activeVideoId = ref('')
// Кілька відео — за замовчуванням останнє (щойно додане); зникло — беремо інше
watch(videos, (list) => {
  if (!list.some((v) => v.objectId === activeVideoId.value)) activeVideoId.value = list[list.length - 1]?.objectId ?? ''
})
const activeVideo = computed(() => videos.value.find((v) => v.objectId === activeVideoId.value) ?? null)

const videoQuery = ref('')
const videoSearching = ref(false)
const videoError = ref('')
const videoResults = ref<VideoCandidate[]>([])
/** Обране, але ще не підтверджене — дошка до «Додати» не змінюється */
const videoPick = ref<VideoCandidate | null>(null)
/** Сервер сказав, що пошук не налаштовано: на цю сесію лишаємо лише посилання (ТЗ §4.2) */
const videoSearchOff = ref(false)

function fmtDuration(s: number): string {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const pad = (n: number) => String(n).padStart(2, '0')
  return h ? `${h}:${pad(m)}:${pad(s % 60)}` : `${m}:${pad(s % 60)}`
}

async function runVideoSearch(q?: string): Promise<void> {
  const query = (q ?? videoQuery.value).trim()
  if (!query || videoSearching.value) return
  videoQuery.value = query
  videoSearching.value = true
  videoError.value = ''
  videoResults.value = []
  videoPick.value = null
  tel('video_search', { len: query.length })
  try {
    const res = await winterboardApi.searchVideos(query)
    videoResults.value = res.items ?? []
    if (!videoResults.value.length) videoError.value = t('winterboard.remote.video.empty')
    tel('video_results', { n: videoResults.value.length, pool: res.pool, took: res.took_ms, dropped: res.dropped })
  } catch (e: any) {
    const code = errorCode(e)
    if (code === 'video_search_disabled') videoSearchOff.value = true
    videoError.value = code === 'video_search_quota'
      ? t('winterboard.remote.video.quota')
      : code === 'video_search_user_limit'
        ? t('winterboard.remote.video.userLimit')
        : code === 'video_search_disabled'
          ? t('winterboard.remote.video.disabled')
          : t('winterboard.remote.video.failed')
    tel('video_search_error', { code: code || 'unknown' })
  } finally {
    videoSearching.value = false
  }
}

function errorCode(e: any): string {
  const raw = e?.response?.data?.error ?? e?.data?.error ?? e?.error ?? ''
  return typeof raw === 'string' ? raw : String(raw?.code ?? '')
}

/** Мова звуку: українську не підписуємо; невідому НЕ називаємо українською. */
function languageBadge(v: VideoCandidate): string {
  if (!v.audio_language || v.audio_language === 'uk') return ''
  if (v.audio_language === 'unknown') return t('winterboard.remote.video.langUnknown')
  return v.audio_language.toUpperCase()
}

// ── Запасний шлях: «Вставити посилання» ─────────────────────────────────────
const videoLink = ref('')
const videoLooking = ref(false)
const canReadClipboard = typeof navigator !== 'undefined' && !!navigator.clipboard?.readText
const LOOKUP_ERRORS = new Set(['invalid_link', 'not_found', 'not_embeddable', 'private', 'live', 'age_restricted',
  'region_blocked', 'russian', 'user_limit', 'quota', 'disabled'])

async function runVideoLookup(): Promise<void> {
  const url = videoLink.value.trim()
  if (!url || videoLooking.value) return
  videoLooking.value = true
  videoError.value = ''
  videoResults.value = []
  videoPick.value = null
  tel('video_lookup', {})
  try {
    videoPick.value = await winterboardApi.lookupVideo(url)   // прев'ю + «Додати» — як у пошуку
    tel('video_lookup_ok', { lang: videoPick.value.audio_language })
  } catch (e: any) {
    const code = errorCode(e).replace(/^video_lookup_/, '')
    videoError.value = t(`winterboard.remote.video.lookupError.${LOOKUP_ERRORS.has(code) ? code : 'failed'}`)
    tel('video_lookup_error', { code: code || 'unknown' })
  } finally {
    videoLooking.value = false
  }
}

/** Вставити з буфера (жест кнопки; iOS ще спитає своє «Вставити») і одразу перевірити. */
async function pasteVideoLink(): Promise<void> {
  try {
    const text = (await navigator.clipboard.readText()).trim()
    if (!text) return
    videoLink.value = text
    await runVideoLookup()
  } catch {
    videoError.value = t('winterboard.remote.video.pasteDenied')
  }
}

function confirmVideoPick(): void {
  const pick = videoPick.value
  if (!pick) return
  if (sendCmd('video.add', { ref: pick.ref, title: pick.title.slice(0, 200) })) {
    videoPick.value = null
    videoResults.value = []
    videoQuery.value = ''
    videoLink.value = ''
    closeSheet()   // картку поставить ноутбук; ▶/⏸ з'являться в зоні контексту
  }
}

/** v1.6 — предмет і мова матеріалу з ноутбука; реєстр — той самий, що в палітрі. */
const assistant = ref<RemoteStateDetail['assistant'] | null>(null)
const corridorRegistry = ref<any>(null)
const assistantView = computed(() => {
  const a = assistant.value
  if (!a) return null
  return {
    subject: { mode: a.subjectMode, resolved: a.subject, locked: a.subjectMode === 'locked' ? a.subject : null, source: a.subjectSource },
    language: { mode: a.languageMode, content: a.contentLanguage, locked: a.languageMode === 'locked' ? a.contentLanguage : null, source: '' },
  }
})
function onRemoteSubject(value: string) {
  if (value === 'auto') sendCmd('subject.auto')
  else sendCmd('subject.set', { subject: value })
}
function onRemoteLanguage(value: string) {
  if (value === 'auto') sendCmd('language.auto')
  else sendCmd('language.set', { language: value })
}
onMounted(() => {
  // 404 — коридори цьому акаунту не ввімкнено: селектора на пульті немає.
  fetchCorridorRegistry(locale.value === 'en' ? 'en' : 'uk')
    .then((reg: any) => { corridorRegistry.value = reg?.enabled ? reg : null })
    .catch(() => { corridorRegistry.value = null })
})

/** Причина, чому пульт не керує (null = усе гаразд або ще шукаємо) */
type ReasonKey = 'noActiveBoard' | 'wrongAccount' | 'tooManyConnections' | 'boardNotAnswering' | 'noToken' | 'serverRejected' | 'unavailable' | 'boardFrozen'
const reasonKey = ref<ReasonKey | null>(null)
const reasonCode = ref('')

// 2026-09-03, власник: «постав телеметрію, щоб ти бачив, як я підключаюсь
// або намагаюсь». Без тексту фраз — лише події, причини, коди, довжини.
let firstStateSeen = false

/** Підказка після першого підключення — раз на пристрій (localStorage). */
const showFirstTip = ref(false)
function dismissFirstTip(): void {
  markFirstTipSeen()
  showFirstTip.value = false
}
function tel(event: string, ctx: Record<string, unknown> = {}) {
  try { trackEvent(`wb.remote.${event}`, { board: boardId.value ?? null, ...ctx }) } catch { /* noop */ }
}

/**
 * id з URL (/winterboard/:id/remote) відхилено сервером як чужий — далі
 * шукаємо дошку ноутбука по акаунту, як універсальний /remote.
 */
let routeIdRejected = false

const channel = useRemoteChannel({
  onState(s) {
    if (s.pair !== pair.value) { tel('state_foreign'); return }   // стан для іншої дошки / старої вкладки
    pageIndex.value = s.pageIndex
    pageCount.value = s.pageCount
    cards.value = s.cards ?? null
    assistant.value = s.assistant ?? null
    videos.value = s.videos ?? []
    photoResult.value = s.photo ?? null
    caps.value = s.caps ?? null
    scenario.value = s.scenario ?? null
    // Сумісність зі старим ноутбуком (до LAW v1.11 він ще шле frozen): показуємо як
    // причину, кнопки лишаємо. Нові ноутбуки поля не шлють — завершений запис дошку не блокує.
    reasonKey.value = s.frozen ? 'boardFrozen' : null
    if (s.frozen) reasonCode.value = 'REPLAY_FROZEN_NO_WRITE'
    if (!firstStateSeen) {
      firstStateSeen = true
      tel('state_first', { pages: s.pageCount, cards: s.cards?.count ?? null, caps: s.caps ?? null })
      if (!firstTipSeen()) showFirstTip.value = true
    }
    vibrate(15)
  },
  onError(code) {
    // Стара адреса з id чужої дошки (живий урок 2026-09-06: телефон тримав
    // /winterboard/<id>/remote від дошки іншого акаунта, а «Оновити» брав той
    // самий id знову і знову). Один раз — без петлі (LAW §12) — перепитуємо,
    // яка дошка відкрита на ноутбуці ПІД ЦИМ акаунтом, і йдемо туди.
    if (code === 'forbidden' && props.id && !routeIdRejected) {
      routeIdRejected = true
      tel('fallback', { from: 'route_id', code })
      channel.disconnect()
      void resolveAndConnect()
      return
    }
    reasonCode.value = code
    if (code === 'forbidden') reasonKey.value = 'wrongAccount'
    else if (code === 'ws_4008' || code === 'ws_rejected') reasonKey.value = 'tooManyConnections'
    else if (code === 'no_token' || code === 'ws_4401' || code === 'ws_4403') reasonKey.value = 'noToken'
    else reasonKey.value = 'serverRejected'
    tel('reason', { reason: reasonKey.value, code })
  },
  // LAW §9 v1.16 (Б-120): ноутбук після F5 (чи втрати мережі) пульт «забуває» і стан не шле,
  // доки не почує hello. Бачимо, що дошка нашого акаунта знову в кімнаті, — вітаємось ОДИН
  // раз на кожне приєднання: подія, а не опитування чи повтор (§12). Учень у класі — не ми.
  onBoardJoin(userId) {
    const me = String(authStore.user?.id ?? '')
    if (!pair.value || (me && userId !== me)) return
    sendCmd('hello')
    tel('hello_on_join')
  },
})

const reason = computed(() => {
  const k = reasonKey.value
  if (!k) return null
  const tone = k === 'boardNotAnswering' || k === 'noActiveBoard' || k === 'boardFrozen' ? 'warn' : 'error'
  switch (k) {
    case 'boardFrozen':
      return { tone, text: t('winterboard.remote.boardFrozen'), hint: t('winterboard.remote.boardFrozenHint') }
    case 'noActiveBoard':
      return { tone, text: t('winterboard.remote.noActiveBoard'), hint: t('winterboard.remote.noActiveBoardHint') }
    case 'wrongAccount':
      return { tone, text: t('winterboard.remote.wrongAccount'), hint: t('winterboard.remote.wrongAccountHint', { email: accountEmail.value }) }
    case 'tooManyConnections':
      return { tone, text: t('winterboard.remote.tooManyConnections'), hint: t('winterboard.remote.tooManyConnectionsHint') }
    case 'boardNotAnswering':
      return { tone, text: t('winterboard.remote.boardNotAnswering'), hint: t('winterboard.remote.boardNotAnsweringHint') }
    case 'noToken':
      return { tone, text: t('winterboard.remote.noToken'), hint: '' }
    case 'unavailable':
      return { tone, text: t('winterboard.remote.unavailable'), hint: '' }
    default:
      return { tone, text: t('winterboard.remote.serverRejected', { code: reasonCode.value }), hint: '' }
  }
})

const isOnline = computed(() => channel.state.value === 'connected')
/** Канал живий або ще встановлюється — у шапці шестерня, а не «Підключити» */
const isLinked = computed(() => ['connected', 'connecting', 'reconnecting'].includes(channel.state.value))
/** Клавіатура з'являється з першим remote.state і живе до розриву каналу (ТЗ §2) */
const keyboard = computed(() => pageIndex.value !== null)
const isReady = computed(() => isOnline.value && pageIndex.value !== null)
const canPrev = computed(() => isReady.value && (pageIndex.value ?? 0) > 0)
const canNext = computed(() =>
  isReady.value && pageIndex.value !== null && pageCount.value !== null && pageIndex.value < pageCount.value - 1,
)

const statusLabel = computed(() => {
  switch (channel.state.value) {
    case 'connected': return t('winterboard.remote.connected')
    case 'connecting':
    case 'reconnecting': return t('winterboard.remote.connecting')
    case 'unavailable': return t('winterboard.remote.unavailable')
    default: return t('winterboard.remote.disconnected')
  }
})

// ── Вид Б: вимкнена кнопка лишається на місці, тап по ній пояснює чому ──────
const why = ref('')
let whyTimer: ReturnType<typeof setTimeout> | null = null
function showWhy(text: string): void {
  why.value = text
  if (whyTimer) clearTimeout(whyTimer)
  whyTimer = setTimeout(() => { why.value = '' }, 2500)
}
function whyDisabled(which: 'prev' | 'next' | 'ready'): void {
  if (which === 'prev' && canPrev.value) return
  if (which === 'next' && canNext.value) return
  if (which === 'ready' && isReady.value) return
  if (!isReady.value) { showWhy(t('winterboard.remote.waitingBoard')); return }
  showWhy(t(which === 'prev' ? 'winterboard.remote.whyFirstPage' : 'winterboard.remote.whyLastPage'))
  tel('why', { which })
}

// ── Аркуші (ТЗ §4): один за раз; «Назад» Android закриває аркуш, а не пульт ──
type Sheet = 'photo' | 'video' | 'settings' | 'scenario'
const sheet = ref<Sheet | null>(null)
/** Ми поклали запис в історію заради «Назад» — і маємо самі його зняти при «×» */
let sheetInHistory = false
const sheetTitle = computed(() => {
  switch (sheet.value) {
    case 'photo': return t('winterboard.remote.photo.title')
    case 'video': return t('winterboard.remote.sheetVideo')
    case 'settings': return t('winterboard.remote.settings')
    case 'scenario': return t('winterboard.remote.scenario.title')
    default: return ''
  }
})
// Дошка перестала вміти «Сценарій» (інша кімната) — аркуш без вмісту не лишаємо
watch(canScenario, (can) => { if (!can && sheet.value === 'scenario') closeSheet() })
function openSheet(name: Sheet): void {
  if (sheet.value === name) return
  if (!sheet.value) {
    // Стан роутера лишаємо в записі (position тощо), лише додаємо свою позначку
    try {
      window.history.pushState({ ...(window.history.state ?? {}), wbRemoteSheet: true }, '')
      sheetInHistory = true
    } catch { sheetInHistory = false }
  }
  sheet.value = name
  tel('sheet', { name })
}
function closeSheet(): void {
  if (!sheet.value) return
  sheet.value = null
  if (sheetInHistory) {
    sheetInHistory = false
    try { window.history.back() } catch { /* noop */ }
  }
}
function onPopState(): void {
  // Клавіша «Назад» (або жест) з відкритим аркушем: закриваємо аркуш, сторінка лишається
  if (sheet.value) {
    sheetInHistory = false
    sheet.value = null
  }
}

function vibrate(ms: number) {
  try { navigator.vibrate?.(ms) } catch { /* noop */ }
}

type RemoteCmd = 'hello' | 'page.goto' | 'page.new' | 'undo' | 'phrase' | 'view.fit' | 'view.page' | 'view.zoom' | 'view.scroll' | 'card.reveal'
  | 'subject.set' | 'subject.auto' | 'language.set' | 'language.auto' | 'assistant.minimize'
  | 'video.add' | 'video.play' | 'video.pause'
  | 'photo.add'
  | 'video.volume' | 'view.focus' | 'card.minimize' | 'card.restore' | 'doc.page'
function sendCmd(cmd: RemoteCmd, args: Record<string, unknown> = {}) {
  if (!pair.value) return false
  const ok = channel.send({ type: 'remote.command', pair: pair.value, client_id: clientId, cmd, args })
  if (cmd !== 'hello') tel('cmd', { cmd, sent: ok, len: cmd === 'phrase' ? String(args.text ?? '').length : undefined })
  if (ok) vibrate(8)
  return ok
}

/** v1.9: фото вже в «Матеріалах» — лише ідентифікатори, байтів у WS немає (LAW §9). */
function sendPhoto(args: { library_asset_id: number; request_id: string; page_index: number }): boolean {
  return sendCmd('photo.add', args)
}

function goRel(delta: 1 | -1) {
  if (pageIndex.value === null || pageCount.value === null) { sendCmd('hello'); return }
  const target = pageIndex.value + delta
  if (target < 0 || target >= pageCount.value) return
  sendCmd('page.goto', { index: target })
}

// ── Голос: коротка граматика → команда; інакше → фраза Інтегралику на ноутбуці
const videoVoiceActive = ref(false)
function startVideoVoice(): void {
  if (!isReady.value || videoSearching.value || sheet.value !== 'video' || ptt.listening.value) return
  if (document.activeElement instanceof HTMLInputElement) document.activeElement.blur()
  videoVoiceActive.value = true
  ptt.press()
}
function startRemoteVoice(): void {
  videoVoiceActive.value = false
  ptt.press()
}

const ptt = usePushToTalk({
  lang: locale.value === 'en' ? 'en-US' : 'uk-UA',
  onFinal(text) {
    lastPhrase.value = `«${text}»`
    if (videoVoiceActive.value) {
      videoVoiceActive.value = false
      if (sheet.value === 'video' && canVideo.value && !videoSearchOff.value) {
        tel('ptt', { route: 'video_sheet', len: text.length })
        void runVideoSearch(matchVideoSearchPhrase(text) ?? text)
      }
      return
    }
    // «Знайди відео про …» — пошук тут, на пульті (вибір і підтвердження — теж тут)
    const videoQ = matchVideoSearchPhrase(text)
    if (videoQ) {
      tel('ptt', { route: 'video', len: text.length })
      if (canVideo.value) openSheet('video')
      void runVideoSearch(videoQ)
      return
    }
    const cmd = matchRemotePhrase(text)
    tel('ptt', { route: cmd ? 'grammar' : 'ai', grammar: cmd ?? null, len: text.length })
    if (cmd === 'page.next') return goRel(1)
    if (cmd === 'page.prev') return goRel(-1)
    if (cmd === 'page.new') return void sendCmd('page.new')
    if (cmd === 'undo') return void sendCmd('undo')
    if (cmd === 'view.fit') return void sendCmd('view.fit')
    if (cmd === 'view.zoom.in') return void sendCmd('view.zoom', { delta: 1 })
    if (cmd === 'view.zoom.out') return void sendCmd('view.zoom', { delta: -1 })
    if (cmd === 'view.scroll.up') return void sendCmd('view.scroll', { dir: -1 })
    if (cmd === 'view.scroll.down') return void sendCmd('view.scroll', { dir: 1 })
    if (cmd === 'card.answer') return void sendCmd('card.reveal', { what: 'answer' })
    if (cmd === 'card.solution') return void sendCmd('card.reveal', { what: 'solution' })
    sendCmd('phrase', { text })
  },
})

// ── Знайти дошку і підключитись ─────────────────────────────────────────
async function resolveBoard(): Promise<string | null> {
  if (props.id && !routeIdRejected) {
    boardId.value = props.id
    return props.id
  }
  try {
    const r = await winterboardApi.getActiveRemoteSession()
    boardId.value = r.session_id
    boardName.value = r.name || ''
    tel('resolve', { found: true, via: 'api', after_route_id: routeIdRejected })
    if (routeIdRejected && r.session_id !== props.id) {
      // Старий id не має пережити перезавантаження сторінки: адреса стає
      // універсальною. Без роутера — сторінка та сама, лише URL.
      try { window.history.replaceState(null, '', '/remote') } catch { /* noop */ }
    }
    return r.session_id
  } catch (err: any) {
    const status = err?.response?.status ?? err?.status
    boardId.value = null
    boardName.value = ''
    reasonKey.value = status === 404 ? 'noActiveBoard' : 'serverRejected'
    reasonCode.value = status ? `http_${status}` : 'network'
    tel('resolve', { found: false, via: 'api', status: status ?? 'network' })
    return null
  }
}

/** «Оновити» у блоці причини: на id-адресі це означає «знайди дошку ноутбука». */
function refreshBoard(): void {
  if (props.id) routeIdRejected = true
  void resolveAndConnect()
}

async function resolveAndConnect() {
  pageIndex.value = null
  pageCount.value = null
  reasonKey.value = null
  reasonCode.value = ''
  firstStateSeen = false
  const sid = await resolveBoard()
  if (!sid) return
  await channel.connect(sid)
}

function disconnect() {
  closeSheet()
  channel.disconnect()
  pageIndex.value = null
  pageCount.value = null
}

// Після підключення — привітатись; якщо дошка мовчить, назвати це словами
let helloTimer: ReturnType<typeof setInterval> | null = null
function helloUntilState() {
  if (helloTimer) clearInterval(helloTimer)
  let tries = 0
  helloTimer = setInterval(() => {
    if (pageIndex.value !== null || reasonKey.value || channel.state.value !== 'connected') {
      if (helloTimer) { clearInterval(helloTimer); helloTimer = null }
      return
    }
    tries += 1
    if (tries > 5) {
      if (helloTimer) { clearInterval(helloTimer); helloTimer = null }
      // 6 hello за ~5 с без жодного remote.state і без error від сервера:
      // ноутбук у кімнаті, але не слухає: Студія (шаблон — там пульт вимкнено,
      // рішення власника 2026-09-26), стара збірка або не власник
      reasonKey.value = 'boardNotAnswering'
      tel('reason', { reason: 'boardNotAnswering', code: 'no_state_after_hello' })
      return
    }
    sendCmd('hello')
  }, 800)
}

const stopStateWatch = watch(channel.state, (s) => {
  tel('channel', { state: s })
  if (s === 'connected') {
    pageIndex.value = null
    pageCount.value = null
    sendCmd('hello')
    helloUntilState()
  } else if (s === 'unavailable') {
    reasonKey.value = 'unavailable'
  }
})

// ── Екран телефона не засинає, поки пульт відкритий
let wakeLock: any = null
async function requestWakeLock() {
  try { wakeLock = await (navigator as any).wakeLock?.request?.('screen') } catch { wakeLock = null }
}
function onVisibility() {
  if (document.visibilityState === 'visible') {
    if (!wakeLock) void requestWakeLock()
    // повернулись у вкладку після паузи — дошка могла змінитись; перепитати
    if (channel.state.value === 'connected' && pageIndex.value === null) sendCmd('hello')
  }
}

onMounted(() => {
  document.addEventListener('visibilitychange', onVisibility)
  window.addEventListener('popstate', onPopState)
  void requestWakeLock()
  void resolveAndConnect()
})

onBeforeUnmount(() => {
  document.removeEventListener('visibilitychange', onVisibility)
  window.removeEventListener('popstate', onPopState)
  if (helloTimer) clearInterval(helloTimer)
  if (whyTimer) clearTimeout(whyTimer)
  if (scenarioWhyTimer) clearTimeout(scenarioWhyTimer)
  stopStateWatch()
  try { wakeLock?.release?.() } catch { /* noop */ }
})
</script>

<style scoped>
/* Токени (ТЗ §5): один акцент — лише «Говорю»; зелений — лише «зроблено»;
   бурштин — попередження; червоний — лише «Відключити». Решта нейтральна. */
.wb-remote {
  --bg: #0f172a; --surface: #1e293b; --surface-2: #334155; --surface-3: #0b1222;
  --text: #f8fafc; --muted: #94a3b8; --line: #334155;
  --accent: #2563eb; --success: #0f766e; --warn: #f59e0b; --danger: #dc2626;
  min-height: 100dvh; background: var(--bg); color: var(--text);
  display: flex; flex-direction: column; gap: 10px;
  padding: max(10px, env(safe-area-inset-top)) 16px max(14px, env(safe-area-inset-bottom));
  user-select: none; -webkit-user-select: none; touch-action: manipulation;
}

/* A. Статус */
.wb-remote__top { display: flex; align-items: center; gap: 10px; min-height: 44px; }
.wb-remote__home {
  flex: none; width: 40px; height: 40px; border-radius: 12px;
  display: inline-flex; align-items: center; justify-content: center;
  background: var(--surface); color: #cbd5e1; font-size: 18px; text-decoration: none;
}
.wb-remote__status { flex: 1 1 auto; min-width: 0; display: inline-flex; align-items: center; gap: 8px; font-size: 14px; color: #cbd5e1; }
.wb-remote__status-text { flex: none; white-space: nowrap; }
.wb-remote__status-board { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--text); font-weight: 600; }
.wb-remote__dot { flex: none; width: 10px; height: 10px; border-radius: 50%; background: #64748b; }
.wb-remote__status--connected .wb-remote__dot { background: #22c55e; }
.wb-remote__status--connecting .wb-remote__dot,
.wb-remote__status--reconnecting .wb-remote__dot { background: var(--warn); }
.wb-remote__status--disconnected .wb-remote__dot,
.wb-remote__status--unavailable .wb-remote__dot { background: #ef4444; }
.wb-remote__gear {
  flex: none; width: 44px; height: 44px; border-radius: 12px; border: 1px solid var(--line);
  background: transparent; color: #cbd5e1; font-size: 20px; -webkit-tap-highlight-color: transparent;
}
.wb-remote__exit { background: transparent; color: var(--muted); border: 1px solid var(--line); border-radius: 12px; padding: 8px 14px; font-size: 14px; min-height: 44px; }
.wb-remote__exit--primary { background: var(--accent); color: #fff; border-color: var(--accent); }
.wb-remote__exit--danger { color: #fff; background: var(--danger); border-color: var(--danger); min-height: 52px; font-weight: 600; }

/* Причина / підказка */
.wb-remote__tip { padding: 14px 16px; border-radius: 12px; background: #064e3b; color: #ecfdf5; font-size: 15px; line-height: 1.4; }
.wb-remote__tip-title { margin: 0 0 6px; font-weight: 700; }
.wb-remote__tip-list { margin: 0 0 10px; padding-left: 20px; list-style: disc; }
.wb-remote__tip-ok { border: 0; border-radius: 10px; padding: 8px 18px; font-size: 15px; font-weight: 600; background: #ecfdf5; color: #064e3b; cursor: pointer; }
.wb-remote__block { padding: 14px 16px; border-radius: 12px; background: var(--surface); font-size: 15px; line-height: 1.4; display: flex; flex-direction: column; gap: 8px; }
.wb-remote__block--warn { border: 1px solid var(--warn); }
.wb-remote__block--error { border: 1px solid #ef4444; }
.wb-remote__reason { margin: 0; font-weight: 600; }
.wb-remote__hint { margin: 0; font-size: 13px; color: #cbd5e1; }
.wb-remote__refresh { align-self: flex-start; background: var(--surface-2); color: var(--text); border: 0; border-radius: 10px; padding: 10px 16px; font-size: 14px; min-height: 44px; }
.wb-remote__page-wait { margin: 24px 0 0; text-align: center; font-size: 15px; color: var(--muted); }

/* B. Сторінка */
.wb-remote__page { text-align: center; min-height: 56px; display: flex; align-items: baseline; justify-content: center; }
.wb-remote__page-cur { font-size: 48px; font-weight: 800; line-height: 1; }
.wb-remote__page-sep { font-size: 26px; color: #64748b; margin: 0 8px; }
.wb-remote__page-total { font-size: 26px; color: var(--muted); }

/* C. Ядро: ◀ ▶ найбільші; вимкнена кнопка лишається на місці й не ловить тап —
   тап іде в обгортку, яка пояснює причину (вид Б). */
.wb-remote__grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.wb-remote__slot { display: flex; }
.wb-remote__btn {
  flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px;
  border: 0; border-radius: 18px; background: var(--surface); color: var(--text);
  font-size: 15px; cursor: pointer; -webkit-tap-highlight-color: transparent;
}
.wb-remote__btn--big { min-height: 96px; }
.wb-remote__btn--big .wb-remote__btn-icon { font-size: 36px; }
.wb-remote__btn--small { min-height: 56px; flex-direction: row; gap: 8px; border-radius: 14px; }
.wb-remote__btn--small .wb-remote__btn-icon { font-size: 20px; }
.wb-remote__btn:active { background: var(--surface-2); transform: scale(.98); }
.wb-remote__btn:disabled { opacity: .4; pointer-events: none; }
.wb-remote__btn-icon { line-height: 1; }
.wb-remote__btn-label { font-size: 14px; color: #cbd5e1; }
.wb-remote__why { margin: -2px 0 0; text-align: center; font-size: 13px; color: var(--warn); }

/* D. Контекст сторінки: росте з вмістом, ядро й ряд «Додати» не зсуваються;
   не влазить — гортається лише ця зона. */
.wb-remote__context { display: flex; flex-direction: column; gap: 8px; max-height: 40dvh; overflow-y: auto; }
.wb-remote__row { display: flex; gap: 8px; }
/* Б-106: сітка на чотири — A− A+ на тих самих місцях і поза показом (2 кнопки), і в показі (з ▲▼) */
.wb-remote__row--fine { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); }
.wb-remote__mini {
  flex: 1; min-height: 48px; border: 0; border-radius: 14px; background: var(--surface); color: var(--text);
  font-size: 16px; font-weight: 600; cursor: pointer; -webkit-tap-highlight-color: transparent;
}
.wb-remote__mini--wide { flex: 2; font-size: 14px; }
.wb-remote__mini--fine { min-height: 44px; font-size: 15px; }
.wb-remote__mini.is-on { background: var(--success); }
.wb-remote__mini:active { background: var(--surface-2); }
.wb-remote__mini:disabled { opacity: .4; }

/* E. Додати — лише за caps */
.wb-remote__add { display: flex; gap: 12px; }
.wb-remote__add-btn {
  flex: 1; min-height: 56px; border: 1px solid var(--line); border-radius: 14px; background: var(--surface);
  color: var(--text); font-size: 15px; font-weight: 600; display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  -webkit-tap-highlight-color: transparent; position: relative;
}
.wb-remote__add-btn:active { background: var(--surface-2); }
.wb-remote__add-btn:disabled { opacity: .4; }
.wb-remote__add-plus { font-size: 20px; line-height: 1; color: #cbd5e1; }
/* v1.15 «📋 Сценарій»: рядок на всю ширину, 56 px як ряд E. Вимкнена лишається на місці,
   а тап ловить обгортка й пояснює причину (вид Б), як у ядра. */
.wb-remote__scenario-slot { display: flex; }
.wb-remote__scenario-btn { width: 100%; }
.wb-remote__scenario-btn:disabled { pointer-events: none; }
.wb-remote__badge {
  position: absolute; top: 6px; right: 8px; min-width: 20px; height: 20px; padding: 0 6px; border-radius: 10px;
  font-size: 12px; font-weight: 700; display: inline-flex; align-items: center; justify-content: center;
}
.wb-remote__badge--busy { background: var(--surface-2); color: #cbd5e1; }
.wb-remote__badge--ok { background: var(--success); color: #fff; }
.wb-remote__badge--warn { background: var(--warn); color: #0f172a; }

/* v1.14: «– Згорнути вікно Інтегралика» — другорядна, як «🎙 Сказати тему» в аркуші «Відео»;
   пришпилена знизу разом із «Говорю», одразу над нею (auto-відступ бере вона, а не «Говорю») */
.wb-remote__assistant-min {
  margin-top: auto; width: 100%; min-height: 48px; border: 1px solid var(--line); border-radius: 12px;
  background: var(--surface-2); color: var(--text); font-size: 15px; font-weight: 600;
  display: flex; align-items: center; justify-content: center; gap: 8px;
  -webkit-tap-highlight-color: transparent;
}
.wb-remote__assistant-min:disabled { opacity: .5; }
.wb-remote__assistant-min + .wb-remote__talk { margin-top: 0; }

/* F. Говорю */
.wb-remote__talk {
  margin-top: auto; min-height: 72px; border: 0; border-radius: 20px;
  background: var(--accent); color: #fff; font-size: 18px; font-weight: 600;
  display: flex; align-items: center; justify-content: center; gap: 10px;
  -webkit-tap-highlight-color: transparent; touch-action: none;
}
.wb-remote__talk--on { background: var(--danger); }
.wb-remote__talk:disabled { opacity: .4; }
.wb-remote__talk-icon { font-size: 24px; }
.wb-remote__note, .wb-remote__last { text-align: center; color: var(--muted); font-size: 13px; margin: 0; }

/* Аркуші знизу */
.wb-remote__scrim { position: fixed; inset: 0; background: rgba(2, 6, 23, .55); z-index: 30; }
.wb-remote__sheet {
  position: fixed; left: 0; right: 0; bottom: 0; z-index: 31; max-height: 88dvh; overflow-y: auto;
  background: var(--surface); color: var(--text); border-radius: 20px 20px 0 0;
  padding: 10px 16px max(16px, env(safe-area-inset-bottom));
  display: flex; flex-direction: column; gap: 10px;
  box-shadow: 0 -8px 30px rgba(0, 0, 0, .4);
  animation: wb-remote-sheet-in .2s ease-out;
}
@keyframes wb-remote-sheet-in { from { transform: translateY(24px); opacity: .6; } to { transform: none; opacity: 1; } }
@media (prefers-reduced-motion: reduce) { .wb-remote__sheet { animation: none; } }
.wb-remote__sheet-top { display: flex; align-items: center; justify-content: space-between; gap: 10px; min-height: 40px; }
/* Власник 2026-09-28 («так»): шапка аркуша з «×» завжди вгорі, аркуш прокручується під нею —
   у «Сценарії» автопрокрутка до поточної сторінки виносила шапку за край. */
/* margin/padding −/+10 px: фон шапки доходить до самого верху аркуша (його padding-top 10 px), тож
   плитки під нею не просвічують смужкою над шапкою; у спокої вигляд той самий. */
.wb-remote__sheet-top {
  position: sticky; top: -10px; z-index: 2; background: var(--surface);
  margin-top: -10px; padding-top: 10px;
}
.wb-remote__sheet-title { font-size: 16px; font-weight: 700; }
.wb-remote__sheet-close {
  width: 40px; height: 40px; border: 0; border-radius: 12px; background: var(--surface-2); color: var(--text);
  font-size: 22px; line-height: 1; -webkit-tap-highlight-color: transparent;
}
/* Панель фото має власний заголовок — в аркуші його дає шапка */
.wb-remote__sheet :deep(.wb-remote-photo__title) { display: none; }

/* Аркуш «Відео» */
.wb-remote__video { display: flex; flex-direction: column; gap: 10px; }
.wb-remote__video-ctl { display: flex; flex-direction: column; gap: 8px; }
.wb-remote__video-name { margin: 0; font-size: 14px; font-weight: 600; text-align: center; }
.wb-remote__video-pick { min-height: 44px; border-radius: 12px; background: var(--surface); color: var(--text); border: 1px solid var(--line); padding: 0 10px; font-size: 14px; }
.wb-remote__video-blocked { margin: 0; padding: 10px 12px; border-radius: 12px; background: #b45309; color: #fff; font-weight: 600; text-align: center; }
.wb-remote__video-search { display: flex; gap: 8px; }
.wb-remote__video-mic {
  width: 100%; min-height: 48px; border: 1px solid var(--line); border-radius: 12px;
  background: var(--surface-2); color: var(--text); font-size: 15px; font-weight: 600;
  display: flex; align-items: center; justify-content: center; gap: 8px; touch-action: none;
}
.wb-remote__video-mic--on { border-color: var(--accent); background: #1e3a8a; }
.wb-remote__video-mic:disabled { opacity: .5; }
.wb-remote__video-input {
  flex: 3; min-height: 48px; border-radius: 12px; border: 1px solid var(--line); background: var(--surface-3); color: var(--text);
  padding: 0 12px; font-size: 16px; user-select: text; -webkit-user-select: text;
}
.wb-remote__video-results { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.wb-remote__video-item {
  width: 100%; display: flex; gap: 10px; align-items: flex-start; padding: 6px; border: 0; border-radius: 12px;
  background: var(--surface-2); color: var(--text); text-align: left; cursor: pointer;
}
.wb-remote__video-thumb { position: relative; flex: 0 0 128px; }
.wb-remote__video-thumb img { width: 128px; height: 72px; object-fit: cover; border-radius: 8px; display: block; }
.wb-remote__video-dur { position: absolute; right: 4px; bottom: 4px; background: rgba(0, 0, 0, .8); font-size: 11px; padding: 1px 4px; border-radius: 4px; }
.wb-remote__video-meta { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.wb-remote__video-title { font-size: 14px; line-height: 1.25; max-height: 3.75em; overflow: hidden; }
.wb-remote__video-channel { font-size: 12px; color: var(--muted); }
.wb-remote__video-confirm { padding: 12px; border-radius: 14px; background: var(--surface-2); display: flex; flex-direction: column; gap: 8px; }
.wb-remote__video-item--preview { background: var(--surface-3); cursor: default; }
.wb-remote__video-lang { align-self: flex-start; font-size: 11px; padding: 1px 6px; border-radius: 6px; background: #475569; color: var(--text); }
.wb-remote__video-link { display: flex; flex-direction: column; gap: 8px; }
.wb-remote__video-confirm-text { margin: 0; font-size: 15px; line-height: 1.35; }

/* Аркуш «Налаштування» */
.wb-remote__settings { display: flex; flex-direction: column; gap: 12px; }
.wb-remote__who { margin: 0; font-size: 13px; color: var(--muted); word-break: break-all; }
.wb-remote__who strong { color: #cbd5e1; font-weight: 600; }
/* Зміна акаунта — окремою кнопкою: палець має влучати (44px за гайдлайном тач-цілі). */
.wb-remote__switch { align-self: flex-start; background: var(--surface-2); color: var(--text); border: 0; border-radius: 10px; padding: 8px 14px; font-size: 14px; min-height: 44px; }
.wb-remote__switch:disabled { opacity: .6; }
.wb-remote__settings-refresh { align-self: flex-start; background: var(--surface-2); color: var(--text); border: 0; border-radius: 10px; padding: 10px 16px; font-size: 14px; min-height: 44px; }
.wb-remote__address { margin: 0; font-size: 13px; color: var(--muted); word-break: break-all; }
.wb-remote__address strong { color: var(--text); user-select: text; -webkit-user-select: text; }
</style>
