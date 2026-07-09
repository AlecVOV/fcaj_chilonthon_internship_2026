<template>
  <div>
    <!-- ═══════════════════════════════════════════
         HERO — Author intro with image
         ═══════════════════════════════════════════ -->
    <section class="py-16 md:py-24 px-4">
      <div class="max-w-4xl mx-auto flex flex-col md:flex-row items-center gap-10 md:gap-16">
        <!-- Author image -->
        <div class="flex-shrink-0">
          <div class="w-40 h-40 md:w-52 md:h-52 rounded-xl bg-canvas-card dark:bg-surface-dark-elevated border border-hairline dark:border-hairline-dark overflow-hidden flex items-center justify-center">
            <!-- Replace this div with <img> tag when you have your photo -->
            <span class="font-display text-5xl md:text-6xl text-ink-muted dark:text-on-dark-soft select-none">CLT</span>
          </div>
        </div>

        <!-- Author info -->
        <div class="text-center md:text-left">
          <p class="text-xs font-medium uppercase tracking-widest text-ink-muted dark:text-on-dark-soft mb-3">
            About the creator
          </p>
          <h1 class="font-display text-display-md md:text-display-lg text-ink dark:text-on-dark mb-4">
            Hi, I'm <span class="text-primary">Chi Lon Thon</span>
          </h1>
          <p class="text-ink-body dark:text-on-dark-soft leading-relaxed text-base max-w-lg">
            A passionate developer and productivity enthusiast. I built FCAJ Worklog
            to solve my own problem — staying focused during deep work sessions while
            keeping a meaningful record of everything I accomplish. This tool is the
            result of countless late-night coding sessions and a genuine belief that
            <span class="text-ink dark:text-on-dark font-medium">better tools create better work</span>.
          </p>
        </div>
      </div>
    </section>

    <!-- ═══════════════════════════════════════════
         4 REASONS — Dark navy showcase
         ═══════════════════════════════════════════ -->
    <section class="bg-surface-white py-16 md:py-24 px-4">
      <div class="max-w-4xl mx-auto">
        <p class="text-xs font-medium uppercase tracking-widest text-on-dark-soft text-center mb-3">
          Why I built this
        </p>
        <h2 class="font-display text-display-md text-on-gray text-center mb-14">
          Four reasons
        </h2>

        <div class="grid gap-6 md:grid-cols-2">
          <!-- Reason 1 -->
          <div class="bg-surface-dark-elevated border border-hairline-dark rounded-lg p-6">
            <div class="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/20 text-primary mb-4 font-display text-lg font-medium">01</div>
            <h3 class="font-display text-lg text-on-dark mb-2">Focus is hard to measure</h3>
            <p class="text-sm text-on-dark-soft leading-relaxed">
              Most productivity tools track tasks, not attention. I wanted something
              that measured <span class="text-on-dark">actual deep-work minutes</span> —
              the raw input that leads to meaningful output. You can't improve what you
              don't measure.
            </p>
          </div>

          <!-- Reason 2 -->
          <div class="bg-surface-dark-elevated border border-hairline-dark rounded-lg p-6">
            <div class="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-teal/20 text-accent-teal mb-4 font-display text-lg font-medium">02</div>
            <h3 class="font-display text-lg text-on-dark mb-2">AI should assist, not replace</h3>
            <p class="text-sm text-on-dark-soft leading-relaxed">
              I believe AI works best as a <span class="text-on-dark">thinking partner</span>,
              not a replacement for human judgment. The task agent helps break down
              complex work but always asks clarifying questions — you stay in control.
            </p>
          </div>

          <!-- Reason 3 -->
          <div class="bg-surface-dark-elevated border border-hairline-dark rounded-lg p-6">
            <div class="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-amber/20 text-accent-amber mb-4 font-display text-lg font-medium">03</div>
            <h3 class="font-display text-lg text-on-dark mb-2">Emotions matter at work</h3>
            <p class="text-sm text-on-dark-soft leading-relaxed">
              Your mood affects your output more than any productivity hack. By
              journaling after each session, you build <span class="text-on-dark">emotional awareness</span>
              — understanding when you work best and what drains you.
            </p>
          </div>

          <!-- Reason 4 -->
          <div class="bg-surface-dark-elevated border border-hairline-dark rounded-lg p-6">
            <div class="flex h-10 w-10 items-center justify-center rounded-lg bg-success/20 text-success mb-4 font-display text-lg font-medium">04</div>
            <h3 class="font-display text-lg text-on-dark mb-2">Worklogs should write themselves</h3>
            <p class="text-sm text-on-dark-soft leading-relaxed">
              As an intern, I was tired of manually writing worklog reports. This app
              <span class="text-on-dark">auto-generates professional PDFs</span> from
              your actual session data — tasks completed, focus minutes, mood trends.
              No more Sunday-night report panic.
            </p>
          </div>
        </div>
      </div>
    </section>

    <!-- ═══════════════════════════════════════════
         SOCIAL + SUPPORT — Cream canvas
         ═══════════════════════════════════════════ -->
    <section class="py-16 md:py-24 px-4">
      <div class="max-w-2xl mx-auto text-center">
        <p class="text-xs font-medium uppercase tracking-widest text-ink-muted dark:text-on-dark-soft mb-3">
          Let's connect
        </p>
        <h2 class="font-display text-display-md text-ink dark:text-on-dark mb-10">
          Find me around the web
        </h2>

        <!-- Social media links -->
        <div class="flex flex-wrap justify-center gap-4 mb-12">
          <!-- GitHub -->
          <a href="https://github.com/AlecVOV" target="_blank" rel="noopener"
             class="flex items-center gap-2 rounded-lg border border-hairline dark:border-hairline-dark px-5 py-3 text-sm font-medium text-ink dark:text-on-dark hover:bg-canvas-card dark:hover:bg-surface-dark-elevated transition-colors">
            <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
            GitHub
          </a>

          <!-- LinkedIn -->
          <a href="https://linkedin.com/in/lehoangtrietthong" target="_blank" rel="noopener"
             class="flex items-center gap-2 rounded-lg border border-hairline dark:border-hairline-dark px-5 py-3 text-sm font-medium text-ink dark:text-on-dark hover:bg-canvas-card dark:hover:bg-surface-dark-elevated transition-colors">
            <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
            LinkedIn
          </a>

          <!-- X / Twitter -->
          <!-- <a href="https://x.com/yourusername" target="_blank" rel="noopener"
             class="flex items-center gap-2 rounded-lg border border-hairline dark:border-hairline-dark px-5 py-3 text-sm font-medium text-ink dark:text-on-dark hover:bg-canvas-card dark:hover:bg-surface-dark-elevated transition-colors">
            <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
            X / Twitter
          </a> -->
        </div>

        <!-- Buy Me a Coffee -->
        <div class="card text-center max-w-md mx-auto">
          <p class="text-sm text-ink-body dark:text-on-dark-soft mb-4 leading-relaxed italic">
            "Hello, help me pls. Me wan moni to buy nubs tee. Thank you and be chilled!!!<br />
            From Chi Lon Thon with luv"
          </p>

          <!-- Nub GIF -->
          <img src="/nub.gif" alt="Nub" class="w-full rounded-lg mb-4" />

          <!-- Banking account -->
          <p class="text-2xs font-medium uppercase tracking-wider text-ink-muted dark:text-on-dark-soft mb-3">
            Banking account
          </p>
          <img src="/me_bank.jpg" alt="Banking account" class="w-full rounded-lg" />
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
// Public author page — no auth required
</script>
