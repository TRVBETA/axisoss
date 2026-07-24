// The Wanderer — object hit-test definitions
// Each zone has 5 objects. Each object is a hit-test rect and a response
// animation key. The frontend uses these to hit-test pointer events on
// the world canvas, and the zone draw functions read the response state
// to play their animation.

const HORIZON = 360 * 0.62; // 223.2 — must be defined BEFORE ZONE_OBJECTS

export const ZONE_OBJECTS = {
  Road: [
    { key: 'bird',    x: 124, y: 122, w: 18, h: 12, response: 'bird_flies'   },
    { key: 'door',    x: 478, y: HORIZON - 30, w: 16, h: 30, response: 'door_opens'  },
    { key: 'cassette',x: 0,   y: 0,   w: 0,  h: 0,  response: 'cassette_held' }, // computed at draw time
    { key: 'post',    x: 78,  y: HORIZON + 18, w: 12, h: 64, response: 'post_pulse'  },
    { key: 'sign',    x: 530, y: HORIZON + 30, w: 22, h: 28, response: 'sign_look'   }
  ],
  Room: [
    { key: 'notebook',x: 408, y: 218, w: 34, h: 16, response: 'notebook_poem' },
    { key: 'window',  x: 78,  y: 58,  w: 104,h: 114,response: 'window_shift'  },
    { key: 'planet',  x: 564, y: 104, w: 16, h: 16, response: 'planet_glow'   },
    { key: 'lamp',    x: 38,  y: 246, w: 24, h: 50, response: 'lamp_toggle'   },
    { key: 'chair',   x: 208, y: 244, w: 24, h: 32, response: 'chair_sit'     }
  ],
  Field: [
    { key: 'roads',    x: 0,   y: 0,   w: 0,  h: 0,  response: 'roads_choose'  }, // full-width
    { key: 'fire',     x: 106, y: HORIZON - 16, w: 28, h: 16, response: 'fire_approach' },
    { key: 'grass',    x: 60,  y: 244, w: 200, h: 70, response: 'grass_ripple'  },
    { key: 'horizon',  x: 555, y: HORIZON - 22, w: 14, h: 26, response: 'horizon_shimmer' },
    { key: 'stone',    x: 0,   y: 0,   w: 0,  h: 0,  response: 'stone_move'    } // computed at draw time
  ]
};

// Patch dynamic rects (cassette, stone, roads) with computed positions.
export function getObjectRects(zone) {
  const list = ZONE_OBJECTS[zone] || [];
  if (zone === 'Road') {
    return list.map(o => {
      if (o.key === 'cassette') {
        return { ...o, x: 360, y: 296, w: 18, h: 10 };
      }
      return o;
    });
  }
  if (zone === 'Field') {
    return list.map(o => {
      if (o.key === 'roads') {
        return { ...o, x: 40, y: 296, w: 560, h: 50 };
      }
      if (o.key === 'stone') {
        return { ...o, x: 305, y: 290, w: 10, h: 8 };
      }
      return o;
    });
  }
  return list;
}
