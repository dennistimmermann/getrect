(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.Getrekt = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({"/Users/dennis/Repositories/gesture-recognizer/index.js":[function(require,module,exports){
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
	var ret = Array(n),
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
		var _ref2$2 = _ref2[2];
		var tail = _ref2$2 === undefined ? [] : _ref2$2;

		var _ref32 = _slicedToArray(_ref3, 2);

		var cx = _ref32[0];
		var cy = _ref32[1];

		return [cx, cy, [].concat(_toConsumableArray(tail), [Math.atan2(py - cy, px - cx)])];
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
	/* 			... so we can substract it from each angle to make it rotation independent */
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
		if (neighbors.length == 0) return { deviation: cost * (path.length / _this.config.samples) / _this.config.samples, cost: cost, path: path };

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

},{}]},{},["/Users/dennis/Repositories/gesture-recognizer/index.js"])("/Users/dennis/Repositories/gesture-recognizer/index.js")
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCIvVXNlcnMvZGVubmlzL1JlcG9zaXRvcmllcy9nZXN0dXJlLXJlY29nbml6ZXIvaW5kZXguanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQSxZQUFZLENBQUM7Ozs7Ozs7Ozs7Ozs7QUFPYixJQUFJLENBQUMsR0FBRyxFQUFFLENBQUE7Ozs7Ozs7Ozs7QUFVVixDQUFDLENBQUMsTUFBTSxHQUFHLFVBQVMsR0FBRyxFQUFFLENBQUMsRUFBRTtBQUMzQixLQUFHLEdBQUcsQ0FBQyxNQUFNLElBQUksQ0FBQyxFQUFFLE9BQU8sR0FBRyxDQUFBO0FBQzlCLEtBQUksR0FBRyxHQUFHLEtBQUssQ0FBQyxDQUFDLENBQUM7S0FDakIsSUFBSSxHQUFHLENBQUMsR0FBRyxDQUFDLE1BQU0sR0FBQyxDQUFDLENBQUEsSUFBRyxDQUFDLEdBQUMsQ0FBQyxDQUFBLEFBQUMsQ0FBQTs7QUFFNUIsTUFBSSxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEVBQUUsRUFBRztBQUMzQixLQUFHLENBQUMsQ0FBQyxDQUFDLEdBQUcsR0FBRyxDQUFDLENBQUMsR0FBQyxJQUFJLEdBQUMsQ0FBQyxDQUFDLENBQUE7RUFDdEI7O0FBRUQsUUFBTyxHQUFHLENBQUE7Q0FDVixDQUFBOzs7Ozs7Ozs7QUFTRCxJQUFJLEdBQUcsR0FBRyxlQUFzQjtLQUFiLE1BQU0sZ0NBQUcsRUFBRTs7QUFDN0IsS0FBSSxDQUFDLE1BQU0sR0FBRyxFQUFFLE9BQU8sRUFBRSxNQUFNLENBQUMsT0FBTyxJQUFJLEVBQUUsRUFBRSxTQUFTLEVBQUUsTUFBTSxDQUFDLFNBQVMsSUFBSSxDQUFDLEVBQUUsQ0FBQTtBQUNqRixLQUFJLENBQUMsUUFBUSxHQUFHLEVBQUUsQ0FBQTtDQUNsQixDQUFDOzs7Ozs7Ozs7QUFTRixHQUFHLENBQUMs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b290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCJcInVzZSBzdHJpY3RcIjtcblxuLyoqXG4gKiBnZXRyZWt0IC0gZ2VzdHVyZSByZWNvZ25pemVyIGJhc2VkIG9uIGR0d1xuICogQ29weXJpZ2h0IDIwMTUgRGVubmlzIFRpbW1lcm1hbm4gPHRpbW1lcm1hbm4uZGVubmlzQGdvb2dsZW1haWwuY29tPiBMaWNlbnNlIE1JVFxuICovXG5cbnZhciBfID0ge31cblxuLyoqXG4gKiBuYWl2ZSBkb3duc2FtcGxpbmcsIGdldHMgZXZlbmx5IGRpc3RyaWJ1dGVkIHBvaW50cyBmcm9tIGFyciwgYmFzZWQgb24gaXRzIGluZGV4IGFuZCBub3Qgb24gcGF0aGxlbmd0aFxuICpcbiAqIEBwYXJhbSB7QXJyYXl9IGFyciBhcnJheSB3aXRoIHNhbXBsZXNcbiAqIEBwYXJhbSB7SW50ZWdlcn0gbiBkZXNpcmVkIG51bWJlciBvZiBzYW1wbGVzXG4gKiBAcmV0dXJuIHtBcnJheX0gZG93bnNhbXBsZWQgYXJyYXlcbiAqL1xuXG5fLnNocmluayA9IGZ1bmN0aW9uKGFyciwgbikge1xuXHRpZihhcnIubGVuZ3RoIDw9IG4pIHJldHVybiBhcnJcblx0dmFyIHJldCA9IEFycmF5KG4pLFxuXHRcdHN0ZXAgPSAoYXJyLmxlbmd0aC0xKS8obi0xKVxuXG5cdGZvcihsZXQgaSA9IDA7IGkgPCBuOyBpKysgKSB7XG5cdFx0cmV0W2ldID0gYXJyW2kqc3RlcHwwXVxuXHR9XG5cblx0cmV0dXJuIHJldFxufVxuXG4vKipcbiAqIENvbnN0cnVjdG9yIGZvciBvdXIgcmVjb2duaXplclxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSBjb25maWcgS2V5czogc2FtcGxlcyAodXBwZXIgc2FtcGxlc2l6ZSB0byBsaW1pdCBjcHUgdXNhZ2UsIGRlZmF1bHQgMzIpLCBkZXZpYXRpb24gKG1heGltYWwgdmFyaWF0aW9uIGFuIHRlbXBsYXRlLCBkZWZhdWx0IDEpXG4gKiBAcmV0dXJuIHtPYmplY3R9IG5ldyBSZWNvZ25pemVyXG4gKi9cblxudmFyIGxpYiA9IGZ1bmN0aW9uKGNvbmZpZyA9IHt9KSB7XG5cdHRoaXMuY29uZmlnID0geyBzYW1wbGVzOiBjb25maWcuc2FtcGxlcyB8fCAzMiwgZGV2aWF0aW9uOiBjb25maWcuZGV2aWF0aW9uIHx8IDEgfVxuXHR0aGlzLmdlc3R1cmVzID0gW11cbn07XG5cbi8qKlxuICogY29uZGl0aW9ucyB0aGUgaW5wdXQgYXJyYXlcbiAqXG4gKiBAcGFyYW0ge0FycmF5fSBwb2ludHMgbGlzdCBvZiBwb2ludHMsIGZvcm1hdHRlZCBhcyBbeCx5XVxuICogQHJldHVybiB7W0FycmF5LCBBcnJheV19IHJldHVybnMgdHdvIEFycmF5cywgb25lIGZpeGVkIGFuZCBvbmUgcm90YXRpb24gaW5kZXBlbmRlbnQsIHRvIGJlIGxhdGVyIGNvbXBhcmVkIHdpdGhcbiAqL1xuXG5saWIucHJvdG90eXBlLl9wcm9jZXNzID0gZnVuY3Rpb24ocG9pbnRzKSB7XG5cblx0Lyogc3RlcCAxOiBkb3duc2FtcGxpbmcgKi9cblx0dmFyIHNhbXBsZXMgPSBfLnNocmluayhwb2ludHMsIHRoaXMuY29uZmlnLnNhbXBsZXMpXG5cblx0Lyogc3RlcCAyOiBjb21wdXRlIHRoZSBhbmdsZSBvZiB0aGUgbGluZSBiZXR3ZWVuIGVhY2ggY29uc2VjdXRpdmUgcG9pbnQgKi9cblx0dmFyIGZpeGVkID0gc2FtcGxlcy5yZWR1Y2UoZnVuY3Rpb24oW3B4LCBweSwgdGFpbCA9IFtdXSwgW2N4LCBjeV0sIGksIGFycikge1xuXHRcdHJldHVybiBbY3gsIGN5LCBbLi4udGFpbCwgTWF0aC5hdGFuMihweSAtIGN5LCBweCAtIGN4KV1dXG5cdH0pWzJdXG5cblx0Lyogc3RlcCAzOiBjb21wdXRlIHRoZSBjZW50ZXIgb2YgbWFzcyAuLi4gKi9cblx0dmFyIFtheCwgYXldID0gc2FtcGxlcy5yZWR1Y2UoZnVuY3Rpb24oW3B4LCBweV0sIFtjeCwgY3ldLCBpLCBhcnIpIHtcblx0XHRyZXR1cm4gW3B4K2N4LCBweStjeV1cblx0fSlcblx0dmFyIGNlbnRlciA9IFtheC9zYW1wbGVzLmxlbmd0aCwgYXkvc2FtcGxlcy5sZW5ndGhdXG5cblx0LyogXHRcdFx0Li4uIG9yIGNlbnRlciBvZiB0aGUgYXhpcyBhbGlnbmVkIGJvdW5kaW5nIGJveCAuLi4gKi9cblx0Ly92YXJbdXAsIHJpZ2h0LCBkb3duLCBsZWZ0XSA9IHNhbXBsZXMucmVkdWNlKGZ1bmN0aW9uKFt1LCByLCBkLCBsXSwgW2N4LCBjeV0sIGksIGFycikge1xuXHQvL1x0cmV0dXJuIFtNYXRoLm1pbihjeSwgdSksIE1hdGgubWF4KGN4LCByKSwgTWF0aC5tYXgoY3ksIGQpLCBNYXRoLm1pbihjeCwgbCldXG5cdC8vfSwgW0luZmluaXR5LCAtSW5maW5pdHksIC1JbmZpbml0eSwgSW5maW5pdHldKVxuXHQvL3ZhciBjZW50ZXIgPSBbKGxlZnQrcmlnaHQpLzIsICh1cCtkb3duKS8yXVxuXG5cdC8qIFx0XHRcdC4uLiB0byBjb21wdXRlIHRoZSBhbmdsZSBiZXR3ZWVuIGl0IGFuZCB0aGUgc3RhcnRpbmcgcG9pbnQgLi4uICovXG5cdHZhciByb3RhdGlvbiA9IE1hdGguYXRhbjIoc2FtcGxlc1swXVsxXSAtIGNlbnRlclsxXSwgc2FtcGxlc1swXVswXSAtIGNlbnRlclswXSlcblx0LyogXHRcdFx0Li4uIHNvIHdlIGNhbiBzdWJzdHJhY3QgaXQgZnJvbSBlYWNoIGFuZ2xlIHRvIG1ha2UgaXQgcm90YXRpb24gaW5kZXBlbmRlbnQgKi9cblx0dmFyXHRhZGp1c3RlZCA9IGZpeGVkLm1hcCh2ID0+IHtcblx0XHRyZXR1cm4gKCh2IC0gcm90YXRpb24gKyBNYXRoLlBJKSVNYXRoLlBJKS1NYXRoLlBJXG5cdH0pXG5cdC8vIHZhciBhZGp1c3RlZCA9IFtmb3IgKHYgb2YgZml4ZWQpICgodiAtIHJvdGF0aW9uICsgTWF0aC5QSSklTWF0aC5QSSktTWF0aC5QSV1cblxuXHRyZXR1cm4gW2ZpeGVkLCBhZGp1c3RlZF1cbn1cblxuLyoqXG4gKiBhZGQgbmV3IGdlc3R1cmVzXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IG5hbWUgdGhlIG5hbWUgb2YgdGhlIGdlc3R1cmUsIHRoaXMgd2lsbCBiZSByZXR1cm5lZCBpZiB0aGUgZ2VzdHVyZSBpcyByZWNvZ25pemVkXG4gKiBAcGFyYW0ge0FycmF5fSBwb2ludHNcbiAqIEBwYXJhbSB7Qm9vbGVhbn0gcm90YXRlIHNldCB0byB0cnVlIHRvIG1ha2UgdGhlIGdlc3R1cmUgcm90YXRpb24gaW5kZXBlbmRlbnRcbiAqL1xuXG5saWIucHJvdG90eXBlLmFkZCA9IGZ1bmN0aW9uKG5hbWUsIHBvaW50cywgcm90YXRlID0gZmFsc2UpIHtcblx0dmFyIFtmaXhlZCwgYWRqdXN0ZWRdID0gdGhpcy5fcHJvY2Vzcyhwb2ludHMpXG5cdHRoaXMuZ2VzdHVyZXMucHVzaCh7bmFtZTogbmFtZSwgcm90YXRlOiByb3RhdGUsIHRlbXBsYXRlOiByb3RhdGU/YWRqdXN0ZWQ6Zml4ZWR9KVxufVxuXG4vKipcbiAqIGNvbXBhcmUgdHdvIGdlc3R1cmVzLCBiYXNlZCBvbiBkeW5hbWljIHRpbWUgd2FycGluZ1xuICpcbiAqIEBwYXJhbSB7QXJyYXl9IHRlbXBsYXRlXG4gKiBAcGFyYW0ge0FycmF5fSBjYW5kaWRhdGVcbiAqL1xuXG5saWIucHJvdG90eXBlLl9kdHcgPSBmdW5jdGlvbih0ZW1wbGF0ZSwgY2FuZGlkYXRlLCB0ID0gMCwgdGwgPSB0ZW1wbGF0ZS5sZW5ndGgsIGMgPSAwLCBjbCA9IGNhbmRpZGF0ZS5sZW5ndGgsIGNvc3QgPSAwLCBwYXRoID0gW1swLDBdXSkge1xuXG5cdC8qIF9fX3xfdDBffF90MV98X3QyX3xfdDNffF90NF98XG5cdCAqIGMwIHwgMDAgLiAgICAuICAgIC4gICAgLlxuXHQgKiBjMSB8ICAgIC4gMTEgLiAyMSAuICAgIC5cblx0ICogYzIgfCAgICAuICAgIC4gICAgLiAzMiAuXG5cdCAqIGMzIHwgICAgLiAgICAuICAgIC4gICAgLiA0M1xuXHQgKiBjNCB8ICAgIC4gICAgLiAgICAuICAgIC4gNDRcblx0ICpcblx0ICogdGhlIGlkZWEgaXMgdG8gZmluZCB0aGUgY2hlYXBlc3QgcGF0aCB0aHJvdWdoIGEgbW4tTWF0cml4IGJhc2VkIG9uIHRoZSB2YWx1ZXMgb2YgdGhlIHRlbXBsYXRlIGFuZCBjYW5kaWRhdGVcblx0ICogdGhlIGNvc3Qgb2YgZWFjaCBjZWxsIGlzdCB0aGUgZGlmZmVyZW5jZSBiZXR3ZWVuIHRoZSBjb3JyZXNwb25kaW5nIHZhbHVlcyBvZiB0ZW1wbGF0ZSBhbmQgY2FuZGlkYXRlXG5cdCAqIGEgcGVyZmVjdCBtYXRjaCB3b3VsZCBhY2N1bXVsYXRlIG5vIGNvc3QgYW5kIGl0cyBwYXRoIHdvdWxkIGJlIHRoZSBzaG9ydGVzIHBhdGggcG9zc2libGUsIGRpYWdvbmFsIHRocm91Z2ggdGhlIG1hdHJpeFxuXHQgKi9cblxuXHQvKiBzdGVwIDE6IGZpbmQgcG90ZW50aWFsIG5laWdoYm9yIGNlbGxzIHRvIGp1bXAgdG8gKi9cblx0dmFyIG5laWdoYm9ycyA9IFtbMSwxXSwgWzEsMF0sIFswLDFdXS5maWx0ZXIoZnVuY3Rpb24oW2R0LCBkY10sIGksIGFycikge1xuXHRcdHJldHVybiB0K2R0IDwgdGwgJiYgYytkYyA8IGNsXG5cdH0pXG5cblx0LyogaWYgd2UgYXJyaXZlZCBhdCB0aGUgYm90dG9tIHJpZ2h0IHRoZXJlIGEgbm8gcG9zc2libGUgbmVpZ2hib3JzIGxlZnQgYW5kIHdlIGZpbmlzaGVkICovXG5cdC8qIHRoZSBkZXZpYXRpb24gZnJvbSB0aGUgdGVtcGxhdGUgaXMgYmFzZWQgb24gdGhlIHByb2R1Y3Qgb2YgdGhlIGFjY3VtdWxhdGVkIGNvc3QgYW4gdGhlIGxlbmd0aCBvZiB0aGUgcGF0aCAqL1xuXHRpZihuZWlnaGJvcnMubGVuZ3RoID09IDApIHJldHVybiB7ZGV2aWF0aW9uOiBjb3N0KihwYXRoLmxlbmd0aC90aGlzLmNvbmZpZy5zYW1wbGVzKS90aGlzLmNvbmZpZy5zYW1wbGVzLCBjb3N0OiBjb3N0LCBwYXRoOiBwYXRofVxuXG5cdC8qIHN0ZXAgMjogY2FsY3VsYXRlIHRoZSBjb3N0IGZvciBlYWNoIHBvdGVudGlhbCBuZWlnaGJvciAqL1xuXHR2YXIgb3B0aW9ucyA9IG5laWdoYm9ycy5tYXAoIHYgPT4ge1xuXHRcdHJldHVybiBbdiwgKE1hdGguYWJzKHRlbXBsYXRlW3QrdlswXV0gLSBjYW5kaWRhdGVbYyt2WzFdXSklTWF0aC5QSSldXG5cdH0pXG5cblx0Lyogc3RlcCAzOiBnZXQgdGhlIG5laWdoYm9yIHdpdGggdGhlIGxvd2VzdCBjb3N0ICovXG5cdHZhciBbY2VsbCwgZmVlXSA9IG9wdGlvbnMuc29ydCggKGEsYikgPT4gYVsxXSAtIGJbMV0pWzBdXG5cdHZhciBbZHQsIGRjXSA9IGNlbGxcblxuXHQvKiByZXBlYXQgdGlsbCB3ZSByZWFjaGVkIHRoZSBib3R0b20gcmlnaHQgY2VsbCAqL1xuXHRyZXR1cm4gdGhpcy5fZHR3KHRlbXBsYXRlLCBjYW5kaWRhdGUsIHQrZHQsIHRsLCBjK2RjLCBjbCwgY29zdCtmZWUsIFsuLi5wYXRoLCBjZWxsXSlcbn1cblxuLyoqXG4gKiBjb21wYXJlIGEgZ2VzdHVyZSB3aXRoIGFsbCB0ZW1wbGF0ZXNcbiAqXG4gKiBAcGFyYW0ge0FycmF5fSBwb2ludHNcbiAqIEByZXR1cm4ge1N0cmluZ30gbmFtZSBvZiB0aGUgcmVjb2duaXplZCBnZXN0dXJlLCBpZiBhbnlcbiAqL1xuXG5saWIucHJvdG90eXBlLnJlY29nbml6ZSA9IGZ1bmN0aW9uKHBvaW50cykge1xuXHRpZihwb2ludHMubGVuZ3RoIDwgMikgcmV0dXJuIFtdXG5cdHZhciBbZml4ZWQsIGFkanVzdGVkXSA9IHRoaXMuX3Byb2Nlc3MocG9pbnRzKVxuXG5cdC8qIGNvbXBhcmUgdGhpcyBnZXN0dXJlIHdpdGggYWxsIHRlbXBsYXRlcywgYWNjb3VudCBmb3Igcm90YXRpb24gaW5kZXBlbmRlbmN5ICovXG5cdHZhciByZXMgPSB0aGlzLmdlc3R1cmVzLyouZmlsdGVyKHYgPT4gdi5uYW1lID09IFwiY2lyY2xlXCIpKi8ubWFwKCAoe25hbWUsIHJvdGF0ZSwgdGVtcGxhdGV9KSA9PiB7IHJldHVybiB7bmFtZSwgLi4udGhpcy5fZHR3KHRlbXBsYXRlLCByb3RhdGU/YWRqdXN0ZWQ6Zml4ZWQpfX0gKVxuXHQvLyB2YXIgcmVzID0gW2Zvcih7bmFtZSwgcm90YXRlLCB0ZW1wbGF0ZX0gb2YgdGhpcy5nZXN0dXJlcykge25hbWUsIC4uLnRoaXMuX2R0dyh0ZW1wbGF0ZSwgcm90YXRlP2FkanVzdGVkOmZpeGVkKX1dXG5cblx0Lyogc29ydCBieSBsb3dlc3QgZGV2aWF0aW9uICovXG5cdHJlcy5zb3J0KCAoYSwgYikgPT4gYS5kZXZpYXRpb24gLSBiLmRldmlhdGlvbilcblxuXHRpZih0aGlzLmNvbmZpZy5kZWJ1ZykgcmVzLmZvckVhY2goZSA9PiBjb25zb2xlLmxvZyhlKSlcblx0Ly8gaWYobGliLmNvbmZpZy5kZWJ1ZykgW2ZvciAoZSBvZiByZXMpIGNvbnNvbGUubG9nKGUpXVxuXG5cdC8qIHJldHVybiB0aGUgbW9zdCBzdWl0YWJsZSBnZXN0dXJlIGlmIGl0cyBkZXJpdmF0aW9uIGlzbid0IG91dCBvZiBib3VuZHMgKi9cblx0cmV0dXJuIHJlcy5maWx0ZXIoIGUgPT4gdGhpcy5jb25maWcuZGVidWcgfHwgZS5kZXZpYXRpb24gPCB0aGlzLmNvbmZpZy5kZXZpYXRpb24pWzBdXG5cdC8vIHJldHVybiBbZm9yKHIgb2YgcmVzKSBpZihyLmRldmlhdGlvbiA8IGxpYi5jb25maWcuZGV2aWF0aW9uKSByXVswXVxuXG59XG5cbm1vZHVsZS5leHBvcnRzID0gbGliXG4iXX0=
