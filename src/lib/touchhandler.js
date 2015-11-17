(function() {
  "use strict";

  var debug = false;
  var MAX_TAP_THRESHOLD = 2;

  /**
   * A timed logging function for tracing touch calls during debug
   */
  function timedLog(msg) {
    console.log(Date.now() + ":" + window.performance.now() + ": " + msg);
  }

  function copy(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function resetTransform() {
    return {
      modified: false,
      x1: false,
      y1: false,
      x2: false,
      y2: false,
      distance: 0,
      angle: 0
    };
  }

  function generator(positionable) {
    var transform = resetTransform();
    var tapStart;
    var tapDiff = 0;
    var mark = copy(positionable.state);
    var handlers = {
      /**
       * mark the first touch event so we can perform computation
       * relative to that coordinate.
       */
      startmark: function(evt) {
        evt.preventDefault();
        evt.stopPropagation();

        // Calculate actual height of element so we can calculate bounds properly
        positionable.rect = positionable.refs.styleWrapper.getBoundingClientRect();

        if (debug) { timedLog("startmark"); }
        if(!evt.touches || evt.touches.length === 1) {
          if (debug) { timedLog("startmark - continued"); }
          mark = copy(positionable.state);
          transform.x1 = evt.clientX || evt.touches[0].pageX;
          transform.y1 = evt.clientY || evt.touches[0].pageY;
          positionable.setState({ touchactive: true });
        } else { handlers.secondFinger(evt); }
      },

      /**
       * pan/move functionality relies on a single touch event being active.
       */
      panmove: function(evt) {
        evt.preventDefault();
        evt.stopPropagation();
        if (debug) { timedLog("panmove"); }
        if (!transform.x1 && !transform.y1) {
          return;
        }
        if (evt.touches && evt.touches.length > 1) {
          return handlers.handleTouchRepositioning(evt);
        }
        if (debug) { timedLog("panmove - continued"); }

        var x = evt.clientX || evt.touches[0].pageX,
          y = evt.clientY || evt.touches[0].pageY;

        transform.modified = true;
        positionable.handleTranslation(x - transform.x1 + mark.x, y - transform.y1 + mark.y);
      },

      /**
       * When all fingers are off the device, stop being in "touch mode"
       */
      endmark: function(evt) {
        if (debug) { timedLog("endmark"); }
        if(evt.touches && evt.touches.length > 0) {
          if (handlers.endSecondFinger(evt)) {
            return;
          }
        }
        if (debug) { timedLog("endmark - continued"); }
        mark = copy(positionable.state);
        var modified = transform.modified;
        transform = resetTransform();
        positionable.setState({ touchactive: false }, function() {
          if (positionable.onTouchEnd) {
            positionable.onTouchEnd(modified);
          }
        });
      },

      /**
       * A second finger means we need to start tracking another
       * event coordinate, which may lead to rotation and scaling
       * updates for the element we're working for.
       */
      secondFinger: function(evt) {
        evt.preventDefault();
        evt.stopPropagation();
        if (debug) { timedLog("secondFinger"); }
        if (evt.touches.length < 2) {
          return;
        }
        // we need to rebind finger 1, because it may have moved!
        transform.x1 = evt.touches[0].pageX;
        transform.y1 = evt.touches[0].pageY;
        transform.x2 = evt.touches[1].pageX;
        transform.y2 = evt.touches[1].pageY;

        var x1 = transform.x1,
          y1 = transform.y1,
          x2 = transform.x2,
          y2 = transform.y2,
          dx = x2 - x1,
          dy = y2 - y1,
          d = Math.sqrt(dx*dx + dy*dy),
          a = Math.atan2(dy,dx);

        transform.distance = d;
        transform.angle = a;
      },

      /**
       * Processing coordinates for rotation/scaling
       */
      handleTouchRepositioning: function(evt) {
        evt.preventDefault();
        evt.stopPropagation();
        if (debug) { timedLog("handleTouchRepositioning"); }
        if (evt.touches.length < 2) {
          return;
        }
        if (debug) { timedLog("handleTouchRepositioning - continued"); }
        var x1 = evt.touches[0].pageX,
          y1 = evt.touches[0].pageY,
          x2 = evt.touches[1].pageX,
          y2 = evt.touches[1].pageY,
          dx = x2 - x1,
          dy = y2 - y1,
          d = Math.sqrt(dx*dx + dy*dy),
          a = Math.atan2(dy,dx),
          da = a - transform.angle + mark.angle,
          s = d/transform.distance * mark.scale;

        transform.modified = true;
        positionable.handleRotationAndScale(da, s);
      },

      /**
       * When the second touch event ends, we might still need to
       * keep processing plain single touch updates.
       */
      endSecondFinger: function(evt) {
        evt.preventDefault();
        evt.stopPropagation();
        if (debug) { timedLog("endSecondFinger"); }
        if (evt.touches.length > 1) {
          if (debug) { timedLog("endSecondFinger - capped"); }
          return true;
        }
        if (debug) { timedLog("endSecondFinger - continued"); }
        handlers.startmark(evt);
        // If there are no fingers left on the screen,
        // we have not finished the handling
        return evt.touches.length !== 0;
      },

      tapStart: function (evt) {

        tapStart = {
          x1: evt.touches[0].pageX,
          y1: evt.touches[0].pageY
        };

      },

      tapMove: function (evt) {
        var {x1, y1} = tapStart;
        var x2 = evt.touches[0].pageX;
        var y2 = evt.touches[0].pageY;
        var dx = x2 - x1;
        var dy = y2 - y1;
        tapDiff = Math.sqrt(dx * dx + dy * dy);
      },

      tapEnd: function (evt) {

        // Don't do anything for second touches
        if (evt.touches.length) {
          return;
        }

        // Only fire a tap if it's under the threshold
        if (tapDiff < MAX_TAP_THRESHOLD && positionable.onTap) {
          positionable.onTap();
        }

        // Reset
        tapStart = null;
        tapDiff = 0;

      }
    };

    return handlers;
  }

  module.exports = generator;
}());
