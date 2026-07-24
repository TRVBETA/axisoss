// The Wanderer — object hit-test rects, computed per canvas size
// The caller passes the current canvas W,H. We return a list of
// {x, y, w, h, key, response} rects positioned in canvas-local coords.

const HORIZON_RATIO = 0.62; // 62% from top — matches the design intent

export function getObjectRects(zone, W, H) {
  W = W || 640;
  H = H || 360;
  const HORIZON = H * HORIZON_RATIO;
  // Each object is anchored relative to canvas size.
  if (zone === 'Road') {
    return [
      { key: 'bird',     x: W * 0.20, y: HORIZON - H * 0.20, w: W * 0.04, h: H * 0.04, response: 'bird_flies'   },
      { key: 'door',     x: W * 0.74, y: HORIZON - H * 0.08, w: W * 0.03, h: H * 0.10, response: 'door_opens'  },
      { key: 'cassette', x: W * 0.55, y: H * 0.83,           w: W * 0.04, h: H * 0.03, response: 'cassette_held' },
      { key: 'post',     x: W * 0.12, y: HORIZON + H * 0.04, w: W * 0.025, h: H * 0.20, response: 'post_pulse' },
      { key: 'sign',     x: W * 0.85, y: HORIZON + H * 0.08, w: W * 0.04, h: H * 0.08, response: 'sign_look'  }
    ];
  }
  if (zone === 'Room') {
    return [
      { key: 'notebook', x: W * 0.62, y: H * 0.62, w: W * 0.06, h: H * 0.05, response: 'notebook_poem' },
      { key: 'window',   x: W * 0.12, y: H * 0.16, w: W * 0.18, h: H * 0.32, response: 'window_shift'  },
      { key: 'planet',   x: W * 0.87, y: H * 0.28, w: W * 0.03, h: H * 0.05, response: 'planet_glow'   },
      { key: 'lamp',     x: W * 0.05, y: H * 0.68, w: W * 0.04, h: H * 0.15, response: 'lamp_toggle'   },
      { key: 'chair',    x: W * 0.32, y: H * 0.68, w: W * 0.04, h: H * 0.10, response: 'chair_sit'     }
    ];
  }
  if (zone === 'Field') {
    return [
      { key: 'roads',   x: W * 0.05, y: H * 0.82, w: W * 0.90, h: H * 0.15, response: 'roads_choose'    },
      { key: 'fire',    x: W * 0.18, y: HORIZON - H * 0.05, w: W * 0.05, h: H * 0.05, response: 'fire_approach' },
      { key: 'grass',   x: W * 0.05, y: H * 0.65, w: W * 0.40, h: H * 0.20, response: 'grass_ripple'   },
      { key: 'horizon', x: W * 0.85, y: HORIZON - H * 0.06, w: W * 0.03, h: H * 0.08, response: 'horizon_shimmer' },
      { key: 'stone',   x: W * 0.46, y: H * 0.80, w: W * 0.02, h: H * 0.03, response: 'stone_move'     }
    ];
  }
  return [];
}
