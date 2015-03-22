(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.Getrect = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({"/Users/dennis/Repositories/getrect/index.js":[function(require,module,exports){
"use strict";

var _slicedToArray = function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { var _arr = []; for (var _iterator = arr[Symbol.iterator](), _step; !(_step = _iterator.next()).done;) { _arr.push(_step.value); if (i && _arr.length === i) break; } return _arr; } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } };

var _toConsumableArray = function (arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) arr2[i] = arr[i]; return arr2; } else { return Array.from(arr); } };

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

/**
 * getrekt - gesture recognizer based on dtw
 * Copyright 2015 Dennis Timmermann <timmermann.dennis@googlemail.com> License MIT
 */

var _ = {};

/**
 * naive downsampling, gets evenly distributed points from arr, based on its index and not on pathlength
 *
 * @param {Array} arr array with samples
 * @param {Integer} n desired number of samples
 * @return {Array} downsampled array
 */

_.shrink = function (arr, n) {
	if (arr.length <= n) return arr;
	var ret = new Array(n),
	    step = (arr.length - 1) / (n - 1);

	for (var i = 0; i < n; i++) {
		ret[i] = arr[i * step | 0];
	}

	return ret;
};

/**
 * Constructor for our recognizer
 *
 * @param {Object} config Keys: samples (upper samplesize to limit cpu usage, default 32), deviation (maximal variation an template, default 1)
 * @return {Object} new Recognizer
 */

var lib = function lib() {
	var config = arguments[0] === undefined ? {} : arguments[0];

	this.config = { samples: config.samples || 32, deviation: config.deviation || 1 };
	this.gestures = [];
};

/**
 * conditions the input array
 *
 * @param {Array} points list of points, formatted as [x,y]
 * @return {[Array, Array]} returns two Arrays, one fixed and one rotation independent, to be later compared with
 */

lib.prototype._process = function (points) {

	/* step 1: downsampling */
	var samples = _.shrink(points, this.config.samples);

	/* step 2: compute the angle of the line between each consecutive point */
	var fixed = samples.reduce(function (_ref, _ref3, i, arr) {
		var _ref2 = _slicedToArray(_ref, 3);

		var px = _ref2[0];
		var py = _ref2[1];
		var tail = _ref2[2];

		var _ref32 = _slicedToArray(_ref3, 2);

		var cx = _ref32[0];
		var cy = _ref32[1];

		return [cx, cy, [].concat(_toConsumableArray(tail || []), [Math.atan2(py - cy, px - cx)])];
	})[2];

	/* step 3: compute the center of mass ... */

	var _samples$reduce = samples.reduce(function (_ref, _ref3, i, arr) {
		var _ref2 = _slicedToArray(_ref, 2);

		var px = _ref2[0];
		var py = _ref2[1];

		var _ref32 = _slicedToArray(_ref3, 2);

		var cx = _ref32[0];
		var cy = _ref32[1];

		return [px + cx, py + cy];
	});

	var _samples$reduce2 = _slicedToArray(_samples$reduce, 2);

	var ax = _samples$reduce2[0];
	var ay = _samples$reduce2[1];

	var center = [ax / samples.length, ay / samples.length];

	/* 			... or center of the axis aligned bounding box ... */
	//var[up, right, down, left] = samples.reduce(function([u, r, d, l], [cx, cy], i, arr) {
	//	return [Math.min(cy, u), Math.max(cx, r), Math.max(cy, d), Math.min(cx, l)]
	//}, [Infinity, -Infinity, -Infinity, Infinity])
	//var center = [(left+right)/2, (up+down)/2]

	/* 			... to compute the angle between it and the starting point ... */
	var rotation = Math.atan2(samples[0][1] - center[1], samples[0][0] - center[0]);
	/* 			... so we can substract it from each angle to make the gesture rotation independent */

	var adjusted = fixed.map(function (v) {
		return (v - rotation + Math.PI) % Math.PI - Math.PI;
	});
	// var adjusted = [for (v of fixed) ((v - rotation + Math.PI)%Math.PI)-Math.PI]

	return [fixed, adjusted];
};

/**
 * add new gestures
 *
 * @param {String} name the name of the gesture, this will be returned if the gesture is recognized
 * @param {Array} points
 * @param {Boolean} rotate set to true to make the gesture rotation independent
 */

lib.prototype.add = function (name, points) {
	var rotate = arguments[2] === undefined ? false : arguments[2];

	var _process = this._process(points);

	var _process2 = _slicedToArray(_process, 2);

	var fixed = _process2[0];
	var adjusted = _process2[1];

	this.gestures.push({ name: name, rotate: rotate, template: rotate ? adjusted : fixed });
};

/**
 * compare two gestures, based on dynamic time warping
 *
 * @param {Array} template
 * @param {Array} candidate
 */

lib.prototype._dtw = function (template, candidate) {
	var _this = this;

	var t = arguments[2] === undefined ? 0 : arguments[2];
	var tl = arguments[3] === undefined ? template.length : arguments[3];
	var c = arguments[4] === undefined ? 0 : arguments[4];
	var cl = arguments[5] === undefined ? candidate.length : arguments[5];
	var cost = arguments[6] === undefined ? 0 : arguments[6];
	var path = arguments[7] === undefined ? [[0, 0]] : arguments[7];
	return (function () {

		/* ___|_t0_|_t1_|_t2_|_t3_|_t4_|
   * c0 | 00 .    .    .    .
   * c1 |    . 11 . 21 .    .
   * c2 |    .    .    . 32 .
   * c3 |    .    .    .    . 43
   * c4 |    .    .    .    . 44
   *
   * the idea is to find the cheapest path through a mn-Matrix based on the values of the template and candidate
   * the cost of each cell ist the difference between the corresponding values of template and candidate
   * a perfect match would accumulate no cost and its path would be the shortes path possible, diagonal through the matrix
   */

		/* step 1: find potential neighbor cells to jump to */
		var neighbors = [[1, 1], [1, 0], [0, 1]].filter(function (_ref, i, arr) {
			var _ref2 = _slicedToArray(_ref, 2);

			var dt = _ref2[0];
			var dc = _ref2[1];

			return t + dt < tl && c + dc < cl;
		});

		/* if we arrived at the bottom right there a no possible neighbors left and we finished */
		/* the deviation from the template is based on the product of the accumulated cost an the length of the path */
		if (neighbors.length === 0) return { deviation: cost * (path.length / _this.config.samples) / _this.config.samples, cost: cost, path: path };

		/* step 2: calculate the cost for each potential neighbor */
		var options = neighbors.map(function (v) {
			return [v, Math.abs(template[t + v[0]] - candidate[c + v[1]]) % Math.PI];
		});

		/* step 3: get the neighbor with the lowest cost */

		var _options$sort$0 = _slicedToArray(options.sort(function (a, b) {
			return a[1] - b[1];
		})[0], 2);

		var cell = _options$sort$0[0];
		var fee = _options$sort$0[1];

		var _cell = _slicedToArray(cell, 2);

		var dt = _cell[0];
		var dc = _cell[1];

		/* repeat till we reached the bottom right cell */
		return _this._dtw(template, candidate, t + dt, tl, c + dc, cl, cost + fee, [].concat(_toConsumableArray(path), [cell]));
	})();
};

/**
 * compare a gesture with all templates
 *
 * @param {Array} points
 * @return {String} name of the recognized gesture, if any
 */

lib.prototype.recognize = function (points) {
	var _this = this;

	if (points.length < 2) return [];

	var _process = this._process(points);

	var _process2 = _slicedToArray(_process, 2);

	var fixed = _process2[0];
	var adjusted = _process2[1];

	/* compare this gesture with all templates, account for rotation independency */
	var res = this.gestures /*.filter(v => v.name == "circle")*/.map(function (_ref) {
		var name = _ref.name;
		var rotate = _ref.rotate;
		var template = _ref.template;
		return _extends({ name: name }, _this._dtw(template, rotate ? adjusted : fixed));
	});
	// var res = [for({name, rotate, template} of this.gestures) {name, ...this._dtw(template, rotate?adjusted:fixed)}]

	/* sort by lowest deviation */
	res.sort(function (a, b) {
		return a.deviation - b.deviation;
	});

	if (this.config.debug) res.forEach(function (e) {
		return console.log(e);
	});
	// if(lib.config.debug) [for (e of res) console.log(e)]

	/* return the most suitable gesture if its derivation isn't out of bounds */
	return res.filter(function (e) {
		return _this.config.debug || e.deviation < _this.config.deviation;
	})[0]
	// return [for(r of res) if(r.deviation < lib.config.deviation) r][0]

	;
};

module.exports = lib;

},{}]},{},["/Users/dennis/Repositories/getrect/index.js"])("/Users/dennis/Repositories/getrect/index.js")
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCIvVXNlcnMvZGVubmlzL1JlcG9zaXRvcmllcy9nZXRyZWN0L2luZGV4LmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUEsWUFBWSxDQUFDOzs7Ozs7Ozs7Ozs7O0FBT2IsSUFBSSxDQUFDLEdBQUcsRUFBRSxDQUFBOzs7Ozs7Ozs7O0FBVVYsQ0FBQyxDQUFDLE1BQU0sR0FBRyxVQUFTLEdBQUcsRUFBRSxDQUFDLEVBQUU7QUFDM0IsS0FBSSxHQUFHLENBQUMsTUFBTSxJQUFJLENBQUMsRUFBRSxPQUFPLEdBQUcsQ0FBQTtBQUMvQixLQUFJLEdBQUcsR0FBRyxJQUFJLEtBQUssQ0FBQyxDQUFDLENBQUM7S0FDckIsSUFBSSxHQUFHLENBQUMsR0FBRyxDQUFDLE1BQU0sR0FBQyxDQUFDLENBQUEsSUFBRyxDQUFDLEdBQUMsQ0FBQyxDQUFBLEFBQUMsQ0FBQTs7QUFFNUIsTUFBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEVBQUUsRUFBRztBQUM1QixLQUFHLENBQUMsQ0FBQyxDQUFDLEdBQUcsR0FBRyxDQUFDLENBQUMsR0FBQyxJQUFJLEdBQUMsQ0FBQyxDQUFDLENBQUE7RUFDdEI7O0FBRUQsUUFBTyxHQUFHLENBQUE7Q0FDVixDQUFBOzs7Ozs7Ozs7QUFTRCxJQUFJLEdBQUcsR0FBRyxlQUFzQjtLQUFiLE1BQU0sZ0NBQUcsRUFBRTs7QUFDN0IsS0FBSSxDQUFDLE1BQU0sR0FBRyxFQUFFLE9BQU8sRUFBRSxNQUFNLENBQUMsT0FBTyxJQUFJLEVBQUUsRUFBRSxTQUFTLEVBQUUsTUFBTSxDQUFDLFNBQVMsSUFBSSxDQUFDLEVBQUUsQ0FBQTtBQUNqRixLQUFJLENBQUMsUUFBUSxHQUFHLEVBQUUsQ0FBQTtDQUNsQixDQUFDOzs7Ozs7Ozs7QUFTRixHQUFHLENBQUMsU0FBUyxD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InNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiXCJ1c2Ugc3RyaWN0XCI7XG5cbi8qKlxuICogZ2V0cmVrdCAtIGdlc3R1cmUgcmVjb2duaXplciBiYXNlZCBvbiBkdHdcbiAqIENvcHlyaWdodCAyMDE1IERlbm5pcyBUaW1tZXJtYW5uIDx0aW1tZXJtYW5uLmRlbm5pc0Bnb29nbGVtYWlsLmNvbT4gTGljZW5zZSBNSVRcbiAqL1xuXG52YXIgXyA9IHt9XG5cbi8qKlxuICogbmFpdmUgZG93bnNhbXBsaW5nLCBnZXRzIGV2ZW5seSBkaXN0cmlidXRlZCBwb2ludHMgZnJvbSBhcnIsIGJhc2VkIG9uIGl0cyBpbmRleCBhbmQgbm90IG9uIHBhdGhsZW5ndGhcbiAqXG4gKiBAcGFyYW0ge0FycmF5fSBhcnIgYXJyYXkgd2l0aCBzYW1wbGVzXG4gKiBAcGFyYW0ge0ludGVnZXJ9IG4gZGVzaXJlZCBudW1iZXIgb2Ygc2FtcGxlc1xuICogQHJldHVybiB7QXJyYXl9IGRvd25zYW1wbGVkIGFycmF5XG4gKi9cblxuXy5zaHJpbmsgPSBmdW5jdGlvbihhcnIsIG4pIHtcblx0aWYgKGFyci5sZW5ndGggPD0gbikgcmV0dXJuIGFyclxuXHR2YXIgcmV0ID0gbmV3IEFycmF5KG4pLFxuXHRcdHN0ZXAgPSAoYXJyLmxlbmd0aC0xKS8obi0xKVxuXG5cdGZvciAobGV0IGkgPSAwOyBpIDwgbjsgaSsrICkge1xuXHRcdHJldFtpXSA9IGFycltpKnN0ZXB8MF1cblx0fVxuXG5cdHJldHVybiByZXRcbn1cblxuLyoqXG4gKiBDb25zdHJ1Y3RvciBmb3Igb3VyIHJlY29nbml6ZXJcbiAqXG4gKiBAcGFyYW0ge09iamVjdH0gY29uZmlnIEtleXM6IHNhbXBsZXMgKHVwcGVyIHNhbXBsZXNpemUgdG8gbGltaXQgY3B1IHVzYWdlLCBkZWZhdWx0IDMyKSwgZGV2aWF0aW9uIChtYXhpbWFsIHZhcmlhdGlvbiBhbiB0ZW1wbGF0ZSwgZGVmYXVsdCAxKVxuICogQHJldHVybiB7T2JqZWN0fSBuZXcgUmVjb2duaXplclxuICovXG5cbnZhciBsaWIgPSBmdW5jdGlvbihjb25maWcgPSB7fSkge1xuXHR0aGlzLmNvbmZpZyA9IHsgc2FtcGxlczogY29uZmlnLnNhbXBsZXMgfHwgMzIsIGRldmlhdGlvbjogY29uZmlnLmRldmlhdGlvbiB8fCAxIH1cblx0dGhpcy5nZXN0dXJlcyA9IFtdXG59O1xuXG4vKipcbiAqIGNvbmRpdGlvbnMgdGhlIGlucHV0IGFycmF5XG4gKlxuICogQHBhcmFtIHtBcnJheX0gcG9pbnRzIGxpc3Qgb2YgcG9pbnRzLCBmb3JtYXR0ZWQgYXMgW3gseV1cbiAqIEByZXR1cm4ge1tBcnJheSwgQXJyYXldfSByZXR1cm5zIHR3byBBcnJheXMsIG9uZSBmaXhlZCBhbmQgb25lIHJvdGF0aW9uIGluZGVwZW5kZW50LCB0byBiZSBsYXRlciBjb21wYXJlZCB3aXRoXG4gKi9cblxubGliLnByb3RvdHlwZS5fcHJvY2VzcyA9IGZ1bmN0aW9uKHBvaW50cykge1xuXG5cdC8qIHN0ZXAgMTogZG93bnNhbXBsaW5nICovXG5cdHZhciBzYW1wbGVzID0gXy5zaHJpbmsocG9pbnRzLCB0aGlzLmNvbmZpZy5zYW1wbGVzKVxuXG5cdC8qIHN0ZXAgMjogY29tcHV0ZSB0aGUgYW5nbGUgb2YgdGhlIGxpbmUgYmV0d2VlbiBlYWNoIGNvbnNlY3V0aXZlIHBvaW50ICovXG5cdHZhciBmaXhlZCA9IHNhbXBsZXMucmVkdWNlKCAoW3B4LCBweSwgdGFpbF0sIFtjeCwgY3ldLCBpLCBhcnIpID0+IHtcblx0XHRyZXR1cm4gW2N4LCBjeSwgWy4uLnRhaWwgfHwgW10sIE1hdGguYXRhbjIocHkgLSBjeSwgcHggLSBjeCldXVxuXHR9KVsyXVxuXG5cdC8qIHN0ZXAgMzogY29tcHV0ZSB0aGUgY2VudGVyIG9mIG1hc3MgLi4uICovXG5cdHZhciBbYXgsIGF5XSA9IHNhbXBsZXMucmVkdWNlKCAoW3B4LCBweV0sIFtjeCwgY3ldLCBpLCBhcnIpID0+IHtcblx0XHRyZXR1cm4gW3B4K2N4LCBweStjeV1cblx0fSlcblx0dmFyIGNlbnRlciA9IFtheC9zYW1wbGVzLmxlbmd0aCwgYXkvc2FtcGxlcy5sZW5ndGhdXG5cblx0LyogXHRcdFx0Li4uIG9yIGNlbnRlciBvZiB0aGUgYXhpcyBhbGlnbmVkIGJvdW5kaW5nIGJveCAuLi4gKi9cblx0Ly92YXJbdXAsIHJpZ2h0LCBkb3duLCBsZWZ0XSA9IHNhbXBsZXMucmVkdWNlKGZ1bmN0aW9uKFt1LCByLCBkLCBsXSwgW2N4LCBjeV0sIGksIGFycikge1xuXHQvL1x0cmV0dXJuIFtNYXRoLm1pbihjeSwgdSksIE1hdGgubWF4KGN4LCByKSwgTWF0aC5tYXgoY3ksIGQpLCBNYXRoLm1pbihjeCwgbCldXG5cdC8vfSwgW0luZmluaXR5LCAtSW5maW5pdHksIC1JbmZpbml0eSwgSW5maW5pdHldKVxuXHQvL3ZhciBjZW50ZXIgPSBbKGxlZnQrcmlnaHQpLzIsICh1cCtkb3duKS8yXVxuXG5cdC8qIFx0XHRcdC4uLiB0byBjb21wdXRlIHRoZSBhbmdsZSBiZXR3ZWVuIGl0IGFuZCB0aGUgc3RhcnRpbmcgcG9pbnQgLi4uICovXG5cdHZhciByb3RhdGlvbiA9IE1hdGguYXRhbjIoc2FtcGxlc1swXVsxXSAtIGNlbnRlclsxXSwgc2FtcGxlc1swXVswXSAtIGNlbnRlclswXSlcblx0LyogXHRcdFx0Li4uIHNvIHdlIGNhbiBzdWJzdHJhY3QgaXQgZnJvbSBlYWNoIGFuZ2xlIHRvIG1ha2UgdGhlIGdlc3R1cmUgcm90YXRpb24gaW5kZXBlbmRlbnQgKi9cblxuXHR2YXJcdGFkanVzdGVkID0gZml4ZWQubWFwKHYgPT4ge1xuXHRcdHJldHVybiAoKHYgLSByb3RhdGlvbiArIE1hdGguUEkpJU1hdGguUEkpLU1hdGguUElcblx0fSlcblx0Ly8gdmFyIGFkanVzdGVkID0gW2ZvciAodiBvZiBmaXhlZCkgKCh2IC0gcm90YXRpb24gKyBNYXRoLlBJKSVNYXRoLlBJKS1NYXRoLlBJXVxuXG5cdHJldHVybiBbZml4ZWQsIGFkanVzdGVkXVxufVxuXG4vKipcbiAqIGFkZCBuZXcgZ2VzdHVyZXNcbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gbmFtZSB0aGUgbmFtZSBvZiB0aGUgZ2VzdHVyZSwgdGhpcyB3aWxsIGJlIHJldHVybmVkIGlmIHRoZSBnZXN0dXJlIGlzIHJlY29nbml6ZWRcbiAqIEBwYXJhbSB7QXJyYXl9IHBvaW50c1xuICogQHBhcmFtIHtCb29sZWFufSByb3RhdGUgc2V0IHRvIHRydWUgdG8gbWFrZSB0aGUgZ2VzdHVyZSByb3RhdGlvbiBpbmRlcGVuZGVudFxuICovXG5cbmxpYi5wcm90b3R5cGUuYWRkID0gZnVuY3Rpb24obmFtZSwgcG9pbnRzLCByb3RhdGUgPSBmYWxzZSkge1xuXHR2YXIgW2ZpeGVkLCBhZGp1c3RlZF0gPSB0aGlzLl9wcm9jZXNzKHBvaW50cylcblx0dGhpcy5nZXN0dXJlcy5wdXNoKHtuYW1lOiBuYW1lLCByb3RhdGU6IHJvdGF0ZSwgdGVtcGxhdGU6IHJvdGF0ZT9hZGp1c3RlZDpmaXhlZH0pXG59XG5cbi8qKlxuICogY29tcGFyZSB0d28gZ2VzdHVyZXMsIGJhc2VkIG9uIGR5bmFtaWMgdGltZSB3YXJwaW5nXG4gKlxuICogQHBhcmFtIHtBcnJheX0gdGVtcGxhdGVcbiAqIEBwYXJhbSB7QXJyYXl9IGNhbmRpZGF0ZVxuICovXG5cbmxpYi5wcm90b3R5cGUuX2R0dyA9IGZ1bmN0aW9uKHRlbXBsYXRlLCBjYW5kaWRhdGUsIHQgPSAwLCB0bCA9IHRlbXBsYXRlLmxlbmd0aCwgYyA9IDAsIGNsID0gY2FuZGlkYXRlLmxlbmd0aCwgY29zdCA9IDAsIHBhdGggPSBbWzAsIDBdXSkge1xuXG5cdC8qIF9fX3xfdDBffF90MV98X3QyX3xfdDNffF90NF98XG5cdCAqIGMwIHwgMDAgLiAgICAuICAgIC4gICAgLlxuXHQgKiBjMSB8ICAgIC4gMTEgLiAyMSAuICAgIC5cblx0ICogYzIgfCAgICAuICAgIC4gICAgLiAzMiAuXG5cdCAqIGMzIHwgICAgLiAgICAuICAgIC4gICAgLiA0M1xuXHQgKiBjNCB8ICAgIC4gICAgLiAgICAuICAgIC4gNDRcblx0ICpcblx0ICogdGhlIGlkZWEgaXMgdG8gZmluZCB0aGUgY2hlYXBlc3QgcGF0aCB0aHJvdWdoIGEgbW4tTWF0cml4IGJhc2VkIG9uIHRoZSB2YWx1ZXMgb2YgdGhlIHRlbXBsYXRlIGFuZCBjYW5kaWRhdGVcblx0ICogdGhlIGNvc3Qgb2YgZWFjaCBjZWxsIGlzdCB0aGUgZGlmZmVyZW5jZSBiZXR3ZWVuIHRoZSBjb3JyZXNwb25kaW5nIHZhbHVlcyBvZiB0ZW1wbGF0ZSBhbmQgY2FuZGlkYXRlXG5cdCAqIGEgcGVyZmVjdCBtYXRjaCB3b3VsZCBhY2N1bXVsYXRlIG5vIGNvc3QgYW5kIGl0cyBwYXRoIHdvdWxkIGJlIHRoZSBzaG9ydGVzIHBhdGggcG9zc2libGUsIGRpYWdvbmFsIHRocm91Z2ggdGhlIG1hdHJpeFxuXHQgKi9cblxuXHQvKiBzdGVwIDE6IGZpbmQgcG90ZW50aWFsIG5laWdoYm9yIGNlbGxzIHRvIGp1bXAgdG8gKi9cblx0dmFyIG5laWdoYm9ycyA9IFtbMSwgMV0sIFsxLCAwXSwgWzAsIDFdXS5maWx0ZXIoIChbZHQsIGRjXSwgaSwgYXJyKSA9PiB7XG5cdFx0cmV0dXJuIHQrZHQgPCB0bCAmJiBjK2RjIDwgY2xcblx0fSlcblxuXHQvKiBpZiB3ZSBhcnJpdmVkIGF0IHRoZSBib3R0b20gcmlnaHQgdGhlcmUgYSBubyBwb3NzaWJsZSBuZWlnaGJvcnMgbGVmdCBhbmQgd2UgZmluaXNoZWQgKi9cblx0LyogdGhlIGRldmlhdGlvbiBmcm9tIHRoZSB0ZW1wbGF0ZSBpcyBiYXNlZCBvbiB0aGUgcHJvZHVjdCBvZiB0aGUgYWNjdW11bGF0ZWQgY29zdCBhbiB0aGUgbGVuZ3RoIG9mIHRoZSBwYXRoICovXG5cdGlmIChuZWlnaGJvcnMubGVuZ3RoID09PSAwKSByZXR1cm4ge2RldmlhdGlvbjogY29zdCoocGF0aC5sZW5ndGgvdGhpcy5jb25maWcuc2FtcGxlcykvdGhpcy5jb25maWcuc2FtcGxlcywgY29zdDogY29zdCwgcGF0aDogcGF0aH1cblxuXHQvKiBzdGVwIDI6IGNhbGN1bGF0ZSB0aGUgY29zdCBmb3IgZWFjaCBwb3RlbnRpYWwgbmVpZ2hib3IgKi9cblx0dmFyIG9wdGlvbnMgPSBuZWlnaGJvcnMubWFwKCB2ID0+IHtcblx0XHRyZXR1cm4gW3YsIChNYXRoLmFicyh0ZW1wbGF0ZVt0K3ZbMF1dIC0gY2FuZGlkYXRlW2MrdlsxXV0pJU1hdGguUEkpXVxuXHR9KVxuXG5cdC8qIHN0ZXAgMzogZ2V0IHRoZSBuZWlnaGJvciB3aXRoIHRoZSBsb3dlc3QgY29zdCAqL1xuXHR2YXIgW2NlbGwsIGZlZV0gPSBvcHRpb25zLnNvcnQoIChhLCBiKSA9PiBhWzFdIC0gYlsxXSlbMF1cblx0dmFyIFtkdCwgZGNdID0gY2VsbFxuXG5cdC8qIHJlcGVhdCB0aWxsIHdlIHJlYWNoZWQgdGhlIGJvdHRvbSByaWdodCBjZWxsICovXG5cdHJldHVybiB0aGlzLl9kdHcodGVtcGxhdGUsIGNhbmRpZGF0ZSwgdCtkdCwgdGwsIGMrZGMsIGNsLCBjb3N0K2ZlZSwgWy4uLnBhdGgsIGNlbGxdKVxufVxuXG4vKipcbiAqIGNvbXBhcmUgYSBnZXN0dXJlIHdpdGggYWxsIHRlbXBsYXRlc1xuICpcbiAqIEBwYXJhbSB7QXJyYXl9IHBvaW50c1xuICogQHJldHVybiB7U3RyaW5nfSBuYW1lIG9mIHRoZSByZWNvZ25pemVkIGdlc3R1cmUsIGlmIGFueVxuICovXG5cbmxpYi5wcm90b3R5cGUucmVjb2duaXplID0gZnVuY3Rpb24ocG9pbnRzKSB7XG5cdGlmIChwb2ludHMubGVuZ3RoIDwgMikgcmV0dXJuIFtdXG5cdHZhciBbZml4ZWQsIGFkanVzdGVkXSA9IHRoaXMuX3Byb2Nlc3MocG9pbnRzKVxuXG5cdC8qIGNvbXBhcmUgdGhpcyBnZXN0dXJlIHdpdGggYWxsIHRlbXBsYXRlcywgYWNjb3VudCBmb3Igcm90YXRpb24gaW5kZXBlbmRlbmN5ICovXG5cdHZhciByZXMgPSB0aGlzLmdlc3R1cmVzLyouZmlsdGVyKHYgPT4gdi5uYW1lID09IFwiY2lyY2xlXCIpKi8ubWFwKCAoe25hbWUsIHJvdGF0ZSwgdGVtcGxhdGV9KSA9PiB7IHJldHVybiB7bmFtZSwgLi4udGhpcy5fZHR3KHRlbXBsYXRlLCByb3RhdGU/YWRqdXN0ZWQ6Zml4ZWQpfX0gKVxuXHQvLyB2YXIgcmVzID0gW2Zvcih7bmFtZSwgcm90YXRlLCB0ZW1wbGF0ZX0gb2YgdGhpcy5nZXN0dXJlcykge25hbWUsIC4uLnRoaXMuX2R0dyh0ZW1wbGF0ZSwgcm90YXRlP2FkanVzdGVkOmZpeGVkKX1dXG5cblx0Lyogc29ydCBieSBsb3dlc3QgZGV2aWF0aW9uICovXG5cdHJlcy5zb3J0KCAoYSwgYikgPT4gYS5kZXZpYXRpb24gLSBiLmRldmlhdGlvbilcblxuXHRpZiAodGhpcy5jb25maWcuZGVidWcpIHJlcy5mb3JFYWNoKGUgPT4gY29uc29sZS5sb2coZSkpXG5cdC8vIGlmKGxpYi5jb25maWcuZGVidWcpIFtmb3IgKGUgb2YgcmVzKSBjb25zb2xlLmxvZyhlKV1cblxuXHQvKiByZXR1cm4gdGhlIG1vc3Qgc3VpdGFibGUgZ2VzdHVyZSBpZiBpdHMgZGVyaXZhdGlvbiBpc24ndCBvdXQgb2YgYm91bmRzICovXG5cdHJldHVybiByZXMuZmlsdGVyKCBlID0+IHRoaXMuY29uZmlnLmRlYnVnIHx8IGUuZGV2aWF0aW9uIDwgdGhpcy5jb25maWcuZGV2aWF0aW9uKVswXVxuXHQvLyByZXR1cm4gW2ZvcihyIG9mIHJlcykgaWYoci5kZXZpYXRpb24gPCBsaWIuY29uZmlnLmRldmlhdGlvbikgcl1bMF1cblxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGxpYlxuIl19
