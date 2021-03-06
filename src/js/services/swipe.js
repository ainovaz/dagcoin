

/*
 * This is a modification from https://github.com/angular/angular.js/blob/master/src/ngTouch/swipe.js
 */


angular.module('copayApp.services')
  .factory('$swipemodified', [
    function () {
    // The total distance in any direction before we make the call on swipe vs. scroll.
      const MOVE_BUFFER_RADIUS = 10;

      const POINTER_EVENTS = {
        touch: {
          start: 'touchstart',
          move: 'touchmove',
          end: 'touchend',
          cancel: 'touchcancel',
        },
      };

      function getCoordinates(event) {
        const originalEvent = event.originalEvent || event;
        const touches = originalEvent.touches && originalEvent.touches.length ? originalEvent.touches : [originalEvent];
        const e = (originalEvent.changedTouches && originalEvent.changedTouches[0]) || touches[0];

        return {
          x: e.clientX,
          y: e.clientY,
        };
      }

      function getEvents(pointerTypes, eventType) {
        const res = [];
        angular.forEach(pointerTypes, (pointerType) => {
          const eventName = POINTER_EVENTS[pointerType][eventType];
          if (eventName) {
            res.push(eventName);
          }
        });
        return res.join(' ');
      }

      return {
      /**
       * @ngdoc method
       * @name $swipe#bind
       *
       * @description
       * The main method of `$swipe`. It takes an element to be watched for swipe motions, and an
       * object containing event handlers.
       * The pointer types that should be used can be specified via the optional
       * third argument, which is an array of strings `'mouse'` and `'touch'`. By default,
       * `$swipe` will listen for `mouse` and `touch` events.
       *
       * The four events are `start`, `move`, `end`, and `cancel`. `start`, `move`, and `end`
       * receive as a parameter a coordinates object of the form `{ x: 150, y: 310 }`.
       *
       * `start` is called on either `mousedown` or `touchstart`. After this event, `$swipe` is
       * watching for `touchmove` or `mousemove` events. These events are ignored until the total
       * distance moved in either dimension exceeds a small threshold.
       *
       * Once this threshold is exceeded, either the horizontal or vertical delta is greater.
       * - If the horizontal distance is greater, this is a swipe and `move` and `end` events follow.
       * - If the vertical distance is greater, this is a scroll, and we let the browser take over.
       *   A `cancel` event is sent.
       *
       * `move` is called on `mousemove` and `touchmove` after the above logic has determined that
       * a swipe is in progress.
       *
       * `end` is called when a swipe is successfully completed with a `touchend` or `mouseup`.
       *
       * `cancel` is called either on a `touchcancel` from the browser, or when we begin scrolling
       * as described above.
       *
       */
        bind(element, eventHandlers, pointerTypes) {
        // Absolute total movement, used to control swipe vs. scroll.
          let totalX,
            totalY;
        // Coordinates of the start position.
          let startCoords;
        // Last event's position.
          let lastPos;
        // Whether a swipe is active.
          let active = false;

          pointerTypes = pointerTypes || ['touch'];
          element.on(getEvents(pointerTypes, 'start'), (event) => {
            startCoords = getCoordinates(event);
            active = true;
            totalX = 0;
            totalY = 0;
            lastPos = startCoords;
            eventHandlers.start && eventHandlers.start(startCoords, event);
          });
          const events = getEvents(pointerTypes, 'cancel');
          if (events) {
            element.on(events, (event) => {
              active = false;
              eventHandlers.cancel && eventHandlers.cancel(event);
            });
          }

          element.on(getEvents(pointerTypes, 'move'), (event) => {
            if (!active) return;

          // Android will send a touchcancel if it thinks we're starting to scroll.
          // So when the total distance (+ or - or both) exceeds 10px in either direction,
          // we either:
          // - On totalX > totalY, we send preventDefault() and treat this as a swipe.
          // - On totalY > totalX, we let the browser handle it as a scroll.

            if (!startCoords) return;
            const coords = getCoordinates(event);

            totalX += Math.abs(coords.x - lastPos.x);
            totalY += Math.abs(coords.y - lastPos.y);

            lastPos = coords;

            if (totalX < MOVE_BUFFER_RADIUS && totalY < MOVE_BUFFER_RADIUS) {
              return;
            }

          // One of totalX or totalY has exceeded the buffer, so decide on swipe vs. scroll.
            if (totalY > totalX) {
            // Allow native scrolling to take over.
              active = false;
              eventHandlers.cancel && eventHandlers.cancel(event);
            } else {
            // Prevent the browser from scrolling.
              event.preventDefault();
              eventHandlers.move && eventHandlers.move(coords, event);
            }
          });

          element.on(getEvents(pointerTypes, 'end'), (event) => {
            if (!active) return;
            active = false;
            eventHandlers.end && eventHandlers.end(getCoordinates(event), event);
          });
        },
      };
    },
  ]);

