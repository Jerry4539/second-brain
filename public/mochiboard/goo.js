// Interactive Page Mascot (cap-directions.webp & cap-reactions.webp from page-mascot)
// Replaces the legacy pixel blob with the 3x3 sprite-sheet mascot that tracks the pointer and reacts to clicks/events.

window.MOCHI_WARDROBE = {
  hat: {
    party: ['Party hat', 3, -7, ['...y...']],
    crown: ['Crown', 3, -5, ['Y.....Y']],
    witch: ['Witch hat', -1, -7, ['.........VV....']],
    beanie: ['Beanie', 2, -6, ['....W....']],
    bow: ['Big bow', 7, -3, ['PP...PP']],
    daisy: ['Daisy', 8, -3, ['..W..']],
    chef: ['Chef hat', 2, -7, ['.WW.WWW..']],
    frog: ['Froggy', 1, -3, ['..GGG...GGG..']],
  },
  face: {
    round: ['Round glasses', 0, 4, ['..XXX...XXX..']],
    hearts: ['Heart shades', 0, 4, ['.KK.KK.KK.KK.']],
    star: ['Star shades', 1, 4, ['..Y.....Y..']],
    stache: ['Mustache', 2, 8, ['K.......K']],
    cheeks: ['Heart cheeks', 1, 7, ['R.R.....R.R']],
  },
  neck: {
    bowtie: ['Bow tie', 4, 8, ['R...R']],
    scarf: ['Cozy scarf', -1, 8, ['RRRRRRRRRRRRRRR']],
    pearls: ['Pearls', 1, 8, ['W.........W']],
    bell: ['Kitty bell', 3, 8, ['RRRRRRR']],
  },
  held: {
    balloon: ['Balloon', 13, -8, ['.RRR.']],
    wand: ['Magic wand', -4, 1, ['..Y...']],
    boba: ['Boba tea', 13, 1, ['....P.']],
    heart: ['Love note', -3, 4, ['RR.RR']],
  },
};

window.MOCHI_PAL = {
  K: '#081f3d', W: '#ffffff', X: '#3d3640', a: '#f1edf5', A: '#cfc8d8',
  R: '#ff5a7a', r: '#ffa3b8', Q: '#d63a62', P: '#ff8fc2', p: '#ffd3e6', M: '#e0559a',
  Y: '#ffd84d', y: '#fff2a8', O: '#f0a52a', G: '#5fdba0', E: '#2fae73',
  L: '#b89bff', V: '#8a6cf0', C: '#ff8a5c', c: '#ffc7ab', F: '#e0603a', n: '#ebbd92', T: '#7fd3ff',
};

window.mochiWearing = () => Object.assign({}, window.MochiOutfit || {}, window.MochiPreview || {});

(() => {
  const DIRECTIONS = [
    'up-left',
    'up',
    'up-right',
    'left',
    'center',
    'right',
    'down-left',
    'down',
    'down-right',
  ];

  const REACTIONS = [
    'blink',
    'heart',
    'sparkle',
    'surprised',
    'wink',
    'bashful',
    'sleepy',
    'dizzy',
    'delighted',
  ];

  const SECTOR_TO_DIRECTION = [
    'right',
    'down-right',
    'down',
    'down-left',
    'left',
    'up-left',
    'up',
    'up-right',
  ];

  const CLICK_REACTIONS = ['heart', 'sparkle', 'delighted', 'wink', 'bashful'];
  const DEAD_ZONE = 26;
  const HYSTERESIS = 0.12;

  const DIR_URL = '/mascots/cap-directions.webp';
  const REACT_URL = '/mascots/cap-reactions.webp';

  // Preload sprite sheets once
  const preloadDir = new Image();
  preloadDir.src = DIR_URL;
  const preloadReact = new Image();
  preloadReact.src = REACT_URL;

  // Inject page-mascot boop keyframe & styling once
  if (typeof document !== 'undefined' && !document.getElementById('pm-mascot-styles')) {
    const st = document.createElement('style');
    st.id = 'pm-mascot-styles';
    st.textContent = `
      @keyframes pm-boop {
        0%   { transform: scale(1, 1) translateY(0); }
        20%  { transform: scale(1.14, 0.86) translateY(4%); }
        48%  { transform: scale(0.93, 1.08) translateY(-6%); }
        74%  { transform: scale(1.03, 0.98) translateY(1%); }
        100% { transform: scale(1, 1) translateY(0); }
      }
      @keyframes pm-think {
        0%, 100% { transform: translateY(0) rotate(0deg); }
        25% { transform: translateY(-2px) rotate(-4deg); }
        75% { transform: translateY(-2px) rotate(4deg); }
      }
      canvas.pm-mascot-cv {
        image-rendering: auto !important;
        background-size: 300% 300% !important;
        background-repeat: no-repeat !important;
        transform-origin: 50% 85% !important;
        will-change: background-position, transform;
      }
      .brand canvas.pm-mascot-cv {
        width: 34px !important;
        height: 34px !important;
        margin-top: -1px !important;
      }
      .mc-head canvas.pm-mascot-cv {
        width: 32px !important;
        height: 32px !important;
        margin-top: -1px !important;
      }
      canvas.pm-mascot-cv.pm-booping {
        animation: pm-boop 380ms cubic-bezier(.2,.9,.3,1.2) !important;
      }
      canvas.pm-mascot-cv.pm-thinking {
        animation: pm-think 680ms ease-in-out infinite !important;
      }
    `;
    document.head.appendChild(st);
  }

  function sheetPosition(index) {
    const col = index % 3;
    const row = Math.floor(index / 3);
    return `${col * 50}% ${row * 50}%`;
  }

  const instances = new Set();
  let lastPointerX = typeof window !== 'undefined' ? window.innerWidth / 2 : 0;
  let lastPointerY = typeof window !== 'undefined' ? window.innerHeight / 2 : 0;
  let rafId = 0;

  function updateAllDirections() {
    rafId = 0;
    instances.forEach((inst) => inst.updatePointer(lastPointerX, lastPointerY));
  }

  if (typeof window !== 'undefined') {
    window.addEventListener(
      'pointermove',
      (e) => {
        lastPointerX = e.clientX;
        lastPointerY = e.clientY;
        if (!rafId) rafId = window.requestAnimationFrame(updateAllDirections);
      },
      { passive: true }
    );

    window.addEventListener('blur', () => {
      instances.forEach((inst) => inst.resetCenter());
    });
  }

  window.Goo = (canvas, opts = {}) => {
    if (!canvas) {
      return { hop() {}, think() {}, setColors() {}, draw() {} };
    }

    const ctx = canvas.getContext && canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    canvas.classList.add('pm-mascot-cv');

    let direction = 'center';
    let reaction = null;
    let sector = null;
    let clickCount = 0;
    let timers = [];
    let thinking = false;
    let thinkInterval = null;

    function render() {
      let mascotChoice = 'cap';
      try {
        mascotChoice = localStorage.getItem('second-brain-mascot-choice') || 'cap';
      } catch {}

      if (mascotChoice === 'mochi') {
        canvas.style.backgroundImage = 'url("/mochiboard/stamps/mochi-happy.png")';
        canvas.style.backgroundSize = 'contain';
        canvas.style.backgroundPosition = 'center';
        canvas.style.backgroundRepeat = 'no-repeat';
        return;
      }
      if (mascotChoice === 'bot') {
        canvas.style.backgroundImage = 'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 40 40\'><rect width=\'40\' height=\'40\' rx=\'12\' fill=\'%2318181b\'/><circle cx=\'14\' cy=\'20\' r=\'4\' fill=\'%2306b6d4\'/><circle cx=\'26\' cy=\'20\' r=\'4\' fill=\'%2306b6d4\'/><path d=\'M14 28 h12\' stroke=\'%2306b6d4\' stroke-width=\'2\' stroke-linecap=\'round\'/><circle cx=\'20\' cy=\'8\' r=\'2.5\' fill=\'%23a1a1aa\'/></svg>")';
        canvas.style.backgroundSize = 'contain';
        canvas.style.backgroundPosition = 'center';
        canvas.style.backgroundRepeat = 'no-repeat';
        return;
      }
      if (mascotChoice === 'fox') {
        canvas.style.backgroundImage = 'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 40 40\'><rect width=\'40\' height=\'40\' rx=\'12\' fill=\'%23ea580c\'/><polygon points=\'8,8 14,22 6,20\' fill=\'%23ffffff\'/><polygon points=\'32,8 26,22 34,20\' fill=\'%23ffffff\'/><circle cx=\'14\' cy=\'22\' r=\'2.5\' fill=\'%2318181b\'/><circle cx=\'26\' cy=\'22\' r=\'2.5\' fill=\'%2318181b\'/><polygon points=\'20,25 17,29 23,29\' fill=\'%2318181b\'/></svg>")';
        canvas.style.backgroundSize = 'contain';
        canvas.style.backgroundPosition = 'center';
        canvas.style.backgroundRepeat = 'no-repeat';
        return;
      }
      if (mascotChoice === 'cat') {
        canvas.style.backgroundImage = 'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 40 40\'><rect width=\'40\' height=\'40\' rx=\'12\' fill=\'%238b5cf6\'/><polygon points=\'8,8 14,20 6,18\' fill=\'%23c4b5fd\'/><polygon points=\'32,8 26,20 34,18\' fill=\'%23c4b5fd\'/><ellipse cx=\'14\' cy=\'21\' rx=\'2.5\' ry=\'3\' fill=\'%23fde047\'/><ellipse cx=\'26\' cy=\'21\' rx=\'2.5\' ry=\'3\' fill=\'%23fde047\'/><circle cx=\'14\' cy=\'21\' r=\'1.2\' fill=\'%2318181b\'/><circle cx=\'26\' cy=\'21\' r=\'1.2\' fill=\'%2318181b\'/><path d=\'M17 26 q3 2 6 0\' stroke=\'%23ffffff\' stroke-width=\'1.5\' fill=\'none\' stroke-linecap=\'round\'/></svg>")';
        canvas.style.backgroundSize = 'contain';
        canvas.style.backgroundPosition = 'center';
        canvas.style.backgroundRepeat = 'no-repeat';
        return;
      }

      // Default 'cap' sprite sheet
      canvas.style.backgroundSize = '300% 300%';
      canvas.style.backgroundRepeat = 'no-repeat';
      const showingReaction = reaction !== null;
      const sheet = showingReaction ? REACT_URL : DIR_URL;
      const frameIndex = showingReaction
        ? Math.max(0, REACTIONS.indexOf(reaction))
        : Math.max(0, DIRECTIONS.indexOf(direction));

      canvas.style.backgroundImage = `url("${sheet}")`;
      canvas.style.backgroundPosition = sheetPosition(frameIndex);
    }

    window.addEventListener('second-brain-mascot-change', () => render());
    window.addEventListener('storage', (e) => {
      if (e.key === 'second-brain-mascot-choice' || e.key === 'mochiboard:settings') render();
    });

    function clearTimers() {
      timers.forEach((t) => clearTimeout(t));
      timers = [];
    }

    function triggerBoop(customReaction) {
      clearTimers();
      canvas.classList.remove('pm-booping');
      // Force reflow so rapid clicks restart keyframe
      void canvas.offsetWidth;
      canvas.classList.add('pm-booping');

      const pick =
        customReaction || CLICK_REACTIONS[clickCount % CLICK_REACTIONS.length];
      clickCount += 1;

      reaction = 'blink';
      render();

      timers.push(
        setTimeout(() => {
          reaction = pick;
          render();
        }, 85),
        setTimeout(() => {
          if (!thinking) {
            reaction = null;
            render();
          }
          canvas.classList.remove('pm-booping');
        }, 1450)
      );
    }

    function updatePointer(px, py) {
      if (window.mochiCalm) {
        if (direction !== 'center') {
          direction = 'center';
          render();
        }
        return;
      }
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) return;
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = px - cx;
      const dy = py - cy;
      const dist = Math.hypot(dx, dy);

      if (dist < DEAD_ZONE) {
        if (direction !== 'center') {
          sector = null;
          direction = 'center';
          if (!reaction) render();
        }
        return;
      }

      const angle = (Math.atan2(dy, dx) + Math.PI * 2) % (Math.PI * 2);
      const sectorSize = Math.PI / 4;

      if (sector !== null) {
        const prevCenter = sector * sectorSize;
        let diff = Math.abs(angle - prevCenter);
        if (diff > Math.PI) diff = Math.PI * 2 - diff;
        if (diff < sectorSize / 2 + HYSTERESIS) return;
      }

      const next = Math.floor((angle + sectorSize / 2) / sectorSize) % 8;
      sector = next;
      const nextDir = SECTOR_TO_DIRECTION[next];
      if (nextDir !== direction) {
        direction = nextDir;
        if (!reaction) render();
      }
    }

    function resetCenter() {
      sector = null;
      direction = 'center';
      if (!reaction) render();
    }

    // Boop when clicking the mascot or its brand/pill container
    canvas.addEventListener('click', () => triggerBoop());

    // Periodic subtle natural blink
    const blinkTimer = setInterval(() => {
      if (!reaction && !thinking && Math.random() < 0.45) {
        reaction = 'blink';
        render();
        setTimeout(() => {
          if (reaction === 'blink' && !thinking) {
            reaction = null;
            render();
          }
        }, 130);
      }
    }, 4200);

    const inst = { updatePointer, resetCenter, blinkTimer };
    if (!opts.manual) {
      instances.add(inst);
    }

    render();

    return {
      hop() {
        triggerBoop('delighted');
      },
      think(on) {
        thinking = Boolean(on);
        if (thinkInterval) {
          clearInterval(thinkInterval);
          thinkInterval = null;
        }
        if (thinking) {
          canvas.classList.add('pm-thinking');
          const thinkFrames = ['sparkle', 'surprised', 'wink'];
          let idx = 0;
          reaction = thinkFrames[0];
          render();
          thinkInterval = setInterval(() => {
            idx = (idx + 1) % thinkFrames.length;
            reaction = thinkFrames[idx];
            render();
          }, 520);
        } else {
          canvas.classList.remove('pm-thinking');
          triggerBoop('sparkle');
        }
      },
      setColors() {
        render();
      },
      draw() {
        render();
      },
    };
  };
})();
