(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.Getrect = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({"/Users/dennis/Repositories/getrect/index.js":[function(require,module,exports){
"use strict";

var _slicedToArray = function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { var _arr = []; for (var _iterator = arr[Symbol.iterator](), _step; !(_step = _iterator.next()).done;) { _arr.push(_step.value); if (i && _arr.length === i) break; } return _arr; } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } };

var _toConsumableArray = function (arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) arr2[i] = arr[i]; return arr2; } else { return Array.from(arr); } };

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

_.distance = function (a, b) {
	return Math.sqrt(Math.pow(a[0] - b[0], 2) + Math.pow(a[1] - b[1], 2));
};

/**
 * Constructor for our recognizer
 *
 * @param {Object} config Keys: samples (upper samplesize to limit cpu usage, default 32), deviation (maximal variation an template, default 1)
 * @return {Object} new Recognizer
 */

var lib = function lib() {
	var config = arguments[0] === undefined ? {} : arguments[0];

	this.config = { samples: config.samples || 32, confidence: config.confidence || 0.7 };
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

	/* step 2: compute the center of mass ... */
	// var [ax, ay] = samples.reduce( ([px, py], [cx, cy], i, arr) => {
	// 	return [px+cx, py+cy]
	// })
	// var center = [ax/samples.length, ay/samples.length]

	/* 			... or center of the axis aligned bounding box ... */

	var _samples$reduce = samples.reduce(function (_ref, _ref3, i, arr) {
		var _ref2 = _slicedToArray(_ref, 4);

		var u = _ref2[0];
		var r = _ref2[1];
		var d = _ref2[2];
		var l = _ref2[3];

		var _ref32 = _slicedToArray(_ref3, 2);

		var cx = _ref32[0];
		var cy = _ref32[1];

		return [Math.min(cy, u), Math.max(cx, r), Math.max(cy, d), Math.min(cx, l)];
	}, [Infinity, -Infinity, -Infinity, Infinity]);

	var _samples$reduce2 = _slicedToArray(_samples$reduce, 4);

	var up = _samples$reduce2[0];
	var right = _samples$reduce2[1];
	var down = _samples$reduce2[2];
	var left = _samples$reduce2[3];

	var center = [(left + right) / 2, (up + down) / 2];
	var start = samples[0];

	/* step 3: get the diameter of the gesture so we can scale it without stretching */
	var radius = samples.reduce(function (prev, cur, i, arr) {
		return Math.max(prev, _.distance(center, cur));
	}, 0);

	/* step 4: compute the normalized coordinates */
	var coordinates = samples.map(function (_ref) {
		var _ref2 = _slicedToArray(_ref, 2);

		var x = _ref2[0];
		var y = _ref2[1];

		return [(x - start[0]) / radius, (y - start[1]) / radius];
	});

	return coordinates;
};

/**
 * add new gestures
 *
 * @param {String} name the name of the gesture, this will be returned if the gesture is recognized
 * @param {Array} points
 */

lib.prototype.add = function (name, points) {
	this.gestures.push({ name: name, template: this._process(points) });
};

/**
 * compare two gestures, based on dynamic time warping
 *
 * @param {Array} template
 * @param {Array} candidate
 */

lib.prototype._rcdtw = function (template, candidate, _x, _x2, cache) {
	var _this = this;

	var i = arguments[2] === undefined ? template.length - 1 : arguments[2];
	var j = arguments[3] === undefined ? candidate.length - 1 : arguments[3];
	return (function () {
		cache = cache || template.map(function () {
			return new Array(candidate.length);
		});

		/* ___|_t0_|_t1_|_t2_|_t3_|_t4_|
   * c0 | 00 .    .    .    .
   * c1 |    . 11 . 21 .    .
   * c2 |    .    .    . 32 .
   * c3 |    .    .    .    . 43
   * c4 |    .    .    .    . 44
   *
   * the idea is to find the cheapest path through a mn-Matrix based on the values of the template and candidate
   * the cost of each cell ist the difference between the corresponding values of template and candidate plus the cost of its cheapest former neighbor
   * a perfect match would accumulate no cost and its path would be the shortes path possible, diagonal through the matrix
   */

		/* check if neighbors are within bounds */
		var coords = [[i, j - 1], [i - 1, j], [i - 1, j - 1]].filter(function (_ref) {
			var _ref2 = _slicedToArray(_ref, 2);

			var ii = _ref2[0];
			var ij = _ref2[1];

			return ii >= 0 && ij >= 0;
		});

		/* get the cost of each neighbor */
		var neighbors = coords.map(function (_ref, i, arr) {
			var _ref2 = _slicedToArray(_ref, 2);

			var ii = _ref2[0];
			var ij = _ref2[1];

			/* recursively get the cost of each cell and cache is */
			return cache[ii][ij] || _this._rcdtw(template, candidate, ii, ij, cache);
		});

		/* get the cheapest. If the are no neighbors, its the [0, 0] cell */

		var _ref = neighbors.sort(function (a, b) {
			return a[0] - b[0];
		})[0] || [0, [[0, 0]]];

		var _ref2 = _slicedToArray(_ref, 2);

		var fee = _ref2[0];
		var cell = _ref2[1];

		/* return the full cost and the path until this point */
		return cache[i][j] = [_.distance(template[i], candidate[j]) + fee, [].concat(_toConsumableArray(cell), [[i, j]])];
	})();
};

/**
 * compare a gesture with all templates
 *
 * @param {Array} points
 * @return {String} name of the recognized gesture, if any
 */

lib.prototype.recognize = function (points, callback) {
	var _this = this;

	if (points.length < 2) return [];
	var candidate = this._process(points);

	/* compare this gesture with all templates, account for rotation independency */
	var res = this.gestures /*.filter(v => v.name == "circle")*/.map(function (_ref) {
		var name = _ref.name;
		var template = _ref.template;

		var _rcdtw = _this._rcdtw(template, candidate);

		var _rcdtw2 = _slicedToArray(_rcdtw, 2);

		var cost = _rcdtw2[0];
		var path = _rcdtw2[1];

		var confidence = Math.pow(1 + cost, -0.1 * (path.length / _this.config.samples));
		return { name: name, cost: cost, confidence: confidence };
	}).filter(function (e) {
		return _this.config.debug || e.confidence > _this.config.confidence;
	});

	if (this.config.debug) res.forEach(function (e) {
		return console.log(e);
	});

	/* sort by lowest deviation */
	var gesture = res.sort(function (a, b) {
		return b.confidence - a.confidence;
	})[0];

	if (gesture) callback(null, gesture);else callback(new Error("no gesture recognized"));
};

module.exports = lib;

},{}]},{},["/Users/dennis/Repositories/getrect/index.js"])("/Users/dennis/Repositories/getrect/index.js")
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCIvVXNlcnMvZGVubmlzL1JlcG9zaXRvcmllcy9nZXRyZWN0L2luZGV4LmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUEsWUFBWSxDQUFDOzs7Ozs7Ozs7OztBQU9iLElBQUksQ0FBQyxHQUFHLEVBQUUsQ0FBQTs7Ozs7Ozs7OztBQVVWLENBQUMsQ0FBQyxNQUFNLEdBQUcsVUFBUyxHQUFHLEVBQUUsQ0FBQyxFQUFFO0FBQzNCLEtBQUksR0FBRyxDQUFDLE1BQU0sSUFBSSxDQUFDLEVBQUUsT0FBTyxHQUFHLENBQUE7QUFDL0IsS0FBSSxHQUFHLEdBQUcsSUFBSSxLQUFLLENBQUMsQ0FBQyxDQUFDO0tBQ3JCLElBQUksR0FBRyxDQUFDLEdBQUcsQ0FBQyxNQUFNLEdBQUMsQ0FBQyxDQUFBLElBQUcsQ0FBQyxHQUFDLENBQUMsQ0FBQSxBQUFDLENBQUE7O0FBRTVCLE1BQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxFQUFFLEVBQUc7QUFDNUIsS0FBRyxDQUFDLENBQUMsQ0FBQyxHQUFHLEdBQUcsQ0FBQyxDQUFDLEdBQUMsSUFBSSxHQUFDLENBQUMsQ0FBQyxDQUFBO0VBQ3RCOztBQUVELFFBQU8sR0FBRyxDQUFBO0NBQ1YsQ0FBQTs7QUFFRCxDQUFDLENBQUMsUUFBUSxHQUFHLFVBQVMsQ0FBQyxFQUFFLENBQUMsRUFBRTtBQUMzQixRQUFPLElBQUksQ0FBQyxJQUFJLENBQUUsU0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFHLENBQUMsYUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFHLENBQUMsQ0FBQSxDQUFDLENBQUE7Q0FDdEQsQ0FBQTs7Ozs7Ozs7O0FBU0QsSUFBSSxHQUFH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QTs7O0FBR3ZELEtBQUksT0FBTyxHQUFHLEdBQUcsQ0FBQyxJQUFJLENBQUUsVUFBQyxDQUFDLEVBQUUsQ0FBQztTQUFLLENBQUMsQ0FBQyxVQUFVLEdBQUcsQ0FBQyxDQUFDLFVBQVU7RUFBQSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUE7O0FBRWpFLEtBQUksT0FBTyxFQUFFLFFBQVEsQ0FBQyxJQUFJLEVBQUUsT0FBTyxDQUFDLENBQUEsS0FDL0IsUUFBUSxDQUFDLElBQUksS0FBSyxDQUFDLHVCQUF1QixDQUFDLENBQUMsQ0FBQTtDQUNqRCxDQUFBOztBQUVELE1BQU0sQ0FBQyxPQUFPLEdBQUcsR0FBRyxDQUFBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIlwidXNlIHN0cmljdFwiO1xuXG4vKipcbiAqIGdldHJla3QgLSBnZXN0dXJlIHJlY29nbml6ZXIgYmFzZWQgb24gZHR3XG4gKiBDb3B5cmlnaHQgMjAxNSBEZW5uaXMgVGltbWVybWFubiA8dGltbWVybWFubi5kZW5uaXNAZ29vZ2xlbWFpbC5jb20+IExpY2Vuc2UgTUlUXG4gKi9cblxudmFyIF8gPSB7fVxuXG4vKipcbiAqIG5haXZlIGRvd25zYW1wbGluZywgZ2V0cyBldmVubHkgZGlzdHJpYnV0ZWQgcG9pbnRzIGZyb20gYXJyLCBiYXNlZCBvbiBpdHMgaW5kZXggYW5kIG5vdCBvbiBwYXRobGVuZ3RoXG4gKlxuICogQHBhcmFtIHtBcnJheX0gYXJyIGFycmF5IHdpdGggc2FtcGxlc1xuICogQHBhcmFtIHtJbnRlZ2VyfSBuIGRlc2lyZWQgbnVtYmVyIG9mIHNhbXBsZXNcbiAqIEByZXR1cm4ge0FycmF5fSBkb3duc2FtcGxlZCBhcnJheVxuICovXG5cbl8uc2hyaW5rID0gZnVuY3Rpb24oYXJyLCBuKSB7XG5cdGlmIChhcnIubGVuZ3RoIDw9IG4pIHJldHVybiBhcnJcblx0dmFyIHJldCA9IG5ldyBBcnJheShuKSxcblx0XHRzdGVwID0gKGFyci5sZW5ndGgtMSkvKG4tMSlcblxuXHRmb3IgKGxldCBpID0gMDsgaSA8IG47IGkrKyApIHtcblx0XHRyZXRbaV0gPSBhcnJbaSpzdGVwfDBdXG5cdH1cblxuXHRyZXR1cm4gcmV0XG59XG5cbl8uZGlzdGFuY2UgPSBmdW5jdGlvbihhLCBiKSB7XG5cdHJldHVybiBNYXRoLnNxcnQoIChhWzBdIC0gYlswXSkqKjIgKyAoYVsxXSAtIGJbMV0pKioyKVxufVxuXG4vKipcbiAqIENvbnN0cnVjdG9yIGZvciBvdXIgcmVjb2duaXplclxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSBjb25maWcgS2V5czogc2FtcGxlcyAodXBwZXIgc2FtcGxlc2l6ZSB0byBsaW1pdCBjcHUgdXNhZ2UsIGRlZmF1bHQgMzIpLCBkZXZpYXRpb24gKG1heGltYWwgdmFyaWF0aW9uIGFuIHRlbXBsYXRlLCBkZWZhdWx0IDEpXG4gKiBAcmV0dXJuIHtPYmplY3R9IG5ldyBSZWNvZ25pemVyXG4gKi9cblxudmFyIGxpYiA9IGZ1bmN0aW9uKGNvbmZpZyA9IHt9KSB7XG5cdHRoaXMuY29uZmlnID0geyBzYW1wbGVzOiBjb25maWcuc2FtcGxlcyB8fCAzMiwgY29uZmlkZW5jZTogY29uZmlnLmNvbmZpZGVuY2UgfHwgMC43MCB9XG5cdHRoaXMuZ2VzdHVyZXMgPSBbXVxufTtcblxuLyoqXG4gKiBjb25kaXRpb25zIHRoZSBpbnB1dCBhcnJheVxuICpcbiAqIEBwYXJhbSB7QXJyYXl9IHBvaW50cyBsaXN0IG9mIHBvaW50cywgZm9ybWF0dGVkIGFzIFt4LHldXG4gKiBAcmV0dXJuIHtbQXJyYXksIEFycmF5XX0gcmV0dXJucyB0d28gQXJyYXlzLCBvbmUgZml4ZWQgYW5kIG9uZSByb3RhdGlvbiBpbmRlcGVuZGVudCwgdG8gYmUgbGF0ZXIgY29tcGFyZWQgd2l0aFxuICovXG5cbmxpYi5wcm90b3R5cGUuX3Byb2Nlc3MgPSBmdW5jdGlvbihwb2ludHMpIHtcblxuXHQvKiBzdGVwIDE6IGRvd25zYW1wbGluZyAqL1xuXHR2YXIgc2FtcGxlcyA9IF8uc2hyaW5rKHBvaW50cywgdGhpcy5jb25maWcuc2FtcGxlcylcblxuXHQvKiBzdGVwIDI6IGNvbXB1dGUgdGhlIGNlbnRlciBvZiBtYXNzIC4uLiAqL1xuXHQvLyB2YXIgW2F4LCBheV0gPSBzYW1wbGVzLnJlZHVjZSggKFtweCwgcHldLCBbY3gsIGN5XSwgaSwgYXJyKSA9PiB7XG5cdC8vIFx0cmV0dXJuIFtweCtjeCwgcHkrY3ldXG5cdC8vIH0pXG5cdC8vIHZhciBjZW50ZXIgPSBbYXgvc2FtcGxlcy5sZW5ndGgsIGF5L3NhbXBsZXMubGVuZ3RoXVxuXG5cdC8qIFx0XHRcdC4uLiBvciBjZW50ZXIgb2YgdGhlIGF4aXMgYWxpZ25lZCBib3VuZGluZyBib3ggLi4uICovXG5cdHZhclt1cCwgcmlnaHQsIGRvd24sIGxlZnRdID0gc2FtcGxlcy5yZWR1Y2UoIChbdSwgciwgZCwgbF0sIFtjeCwgY3ldLCBpLCBhcnIpID0+IHtcblx0XHRyZXR1cm4gW01hdGgubWluKGN5LCB1KSwgTWF0aC5tYXgoY3gsIHIpLCBNYXRoLm1heChjeSwgZCksIE1hdGgubWluKGN4LCBsKV1cblx0fSwgW0luZmluaXR5LCAtSW5maW5pdHksIC1JbmZpbml0eSwgSW5maW5pdHldKVxuXG5cdHZhciBjZW50ZXIgPSBbKGxlZnQrcmlnaHQpLzIsICh1cCtkb3duKS8yXVxuXHR2YXIgc3RhcnQgPSBzYW1wbGVzWzBdXG5cblx0Lyogc3RlcCAzOiBnZXQgdGhlIGRpYW1ldGVyIG9mIHRoZSBnZXN0dXJlIHNvIHdlIGNhbiBzY2FsZSBpdCB3aXRob3V0IHN0cmV0Y2hpbmcgKi9cblx0dmFyIHJhZGl1cyA9IHNhbXBsZXMucmVkdWNlKCAocHJldiwgY3VyLCBpLCBhcnIpID0+IHtcblx0XHRyZXR1cm4gTWF0aC5tYXgocHJldiwgXy5kaXN0YW5jZShjZW50ZXIsIGN1cikpXG5cdH0sIDApXG5cblx0Lyogc3RlcCA0OiBjb21wdXRlIHRoZSBub3JtYWxpemVkIGNvb3JkaW5hdGVzICovXG5cdHZhciBjb29yZGluYXRlcyA9IHNhbXBsZXMubWFwKCAoW3gsIHldKSA9PiB7XG5cdFx0cmV0dXJuIFsoeC1zdGFydFswXSkvcmFkaXVzLCAoeS1zdGFydFsxXSkvcmFkaXVzXVxuXHR9KVxuXG5cdHJldHVybiBjb29yZGluYXRlc1xufVxuXG4vKipcbiAqIGFkZCBuZXcgZ2VzdHVyZXNcbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gbmFtZSB0aGUgbmFtZSBvZiB0aGUgZ2VzdHVyZSwgdGhpcyB3aWxsIGJlIHJldHVybmVkIGlmIHRoZSBnZXN0dXJlIGlzIHJlY29nbml6ZWRcbiAqIEBwYXJhbSB7QXJyYXl9IHBvaW50c1xuICovXG5cbmxpYi5wcm90b3R5cGUuYWRkID0gZnVuY3Rpb24obmFtZSwgcG9pbnRzKSB7XG5cdHRoaXMuZ2VzdHVyZXMucHVzaCh7bmFtZTogbmFtZSwgdGVtcGxhdGU6IHRoaXMuX3Byb2Nlc3MocG9pbnRzKX0pXG59XG5cbi8qKlxuICogY29tcGFyZSB0d28gZ2VzdHVyZXMsIGJhc2VkIG9uIGR5bmFtaWMgdGltZSB3YXJwaW5nXG4gKlxuICogQHBhcmFtIHtBcnJheX0gdGVtcGxhdGVcbiAqIEBwYXJhbSB7QXJyYXl9IGNhbmRpZGF0ZVxuICovXG5cbmxpYi5wcm90b3R5cGUuX3JjZHR3ID0gZnVuY3Rpb24odGVtcGxhdGUsIGNhbmRpZGF0ZSwgaSA9IHRlbXBsYXRlLmxlbmd0aC0xLCBqID0gY2FuZGlkYXRlLmxlbmd0aC0xLCBjYWNoZSkge1xuXHRjYWNoZSA9IGNhY2hlIHx8IHRlbXBsYXRlLm1hcCgoKT0+IG5ldyBBcnJheShjYW5kaWRhdGUubGVuZ3RoKSlcblxuXHQvKiBfX198X3QwX3xfdDFffF90Ml98X3QzX3xfdDRffFxuXHQgKiBjMCB8IDAwIC4gICAgLiAgICAuICAgIC5cblx0ICogYzEgfCAgICAuIDExIC4gMjEgLiAgICAuXG5cdCAqIGMyIHwgICAgLiAgICAuICAgIC4gMzIgLlxuXHQgKiBjMyB8ICAgIC4gICAgLiAgICAuICAgIC4gNDNcblx0ICogYzQgfCAgICAuICAgIC4gICAgLiAgICAuIDQ0XG5cdCAqXG5cdCAqIHRoZSBpZGVhIGlzIHRvIGZpbmQgdGhlIGNoZWFwZXN0IHBhdGggdGhyb3VnaCBhIG1uLU1hdHJpeCBiYXNlZCBvbiB0aGUgdmFsdWVzIG9mIHRoZSB0ZW1wbGF0ZSBhbmQgY2FuZGlkYXRlXG5cdCAqIHRoZSBjb3N0IG9mIGVhY2ggY2VsbCBpc3QgdGhlIGRpZmZlcmVuY2UgYmV0d2VlbiB0aGUgY29ycmVzcG9uZGluZyB2YWx1ZXMgb2YgdGVtcGxhdGUgYW5kIGNhbmRpZGF0ZSBwbHVzIHRoZSBjb3N0IG9mIGl0cyBjaGVhcGVzdCBmb3JtZXIgbmVpZ2hib3Jcblx0ICogYSBwZXJmZWN0IG1hdGNoIHdvdWxkIGFjY3VtdWxhdGUgbm8gY29zdCBhbmQgaXRzIHBhdGggd291bGQgYmUgdGhlIHNob3J0ZXMgcGF0aCBwb3NzaWJsZSwgZGlhZ29uYWwgdGhyb3VnaCB0aGUgbWF0cml4XG5cdCAqL1xuXG5cdC8qIGNoZWNrIGlmIG5laWdoYm9ycyBhcmUgd2l0aGluIGJvdW5kcyAqL1xuXHR2YXIgY29vcmRzID0gW1tpLCBqLTFdLCBbaS0xLCBqXSwgW2ktMSwgai0xXV0uZmlsdGVyKCAoW2lpLCBpal0pID0+IHtcblx0XHRyZXR1cm4gaWkgPj0gMCAmJiBpaiA+PSAwXG5cdH0pXG5cblx0LyogZ2V0IHRoZSBjb3N0IG9mIGVhY2ggbmVpZ2hib3IgKi9cblx0dmFyIG5laWdoYm9ycyA9IGNvb3Jkcy5tYXAoIChbaWksIGlqXSwgaSwgYXJyKSA9PiB7XG5cdFx0LyogcmVjdXJzaXZlbHkgZ2V0IHRoZSBjb3N0IG9mIGVhY2ggY2VsbCBhbmQgY2FjaGUgaXMgKi9cblx0XHRyZXR1cm4gY2FjaGVbaWldW2lqXSB8fCB0aGlzLl9yY2R0dyh0ZW1wbGF0ZSwgY2FuZGlkYXRlLCBpaSwgaWosIGNhY2hlKVxuXHR9KVxuXG5cdC8qIGdldCB0aGUgY2hlYXBlc3QuIElmIHRoZSBhcmUgbm8gbmVpZ2hib3JzLCBpdHMgdGhlIFswLCAwXSBjZWxsICovXG5cdHZhciBbZmVlLCBjZWxsXSA9IG5laWdoYm9ycy5zb3J0KCAoYSwgYikgPT4gYVswXSAtIGJbMF0pWzBdIHx8IFswLCBbWzAsIDBdXV1cblxuXHQvKiByZXR1cm4gdGhlIGZ1bGwgY29zdCBhbmQgdGhlIHBhdGggdW50aWwgdGhpcyBwb2ludCAqL1xuXHRyZXR1cm4gY2FjaGVbaV1bal0gPSBbXy5kaXN0YW5jZSh0ZW1wbGF0ZVtpXSwgY2FuZGlkYXRlW2pdKSArIGZlZSwgWy4uLmNlbGwsIFtpLCBqXV1dXG59XG5cbi8qKlxuICogY29tcGFyZSBhIGdlc3R1cmUgd2l0aCBhbGwgdGVtcGxhdGVzXG4gKlxuICogQHBhcmFtIHtBcnJheX0gcG9pbnRzXG4gKiBAcmV0dXJuIHtTdHJpbmd9IG5hbWUgb2YgdGhlIHJlY29nbml6ZWQgZ2VzdHVyZSwgaWYgYW55XG4gKi9cblxubGliLnByb3RvdHlwZS5yZWNvZ25pemUgPSBmdW5jdGlvbihwb2ludHMsIGNhbGxiYWNrKSB7XG5cdGlmIChwb2ludHMubGVuZ3RoIDwgMikgcmV0dXJuIFtdXG5cdHZhciBjYW5kaWRhdGUgPSB0aGlzLl9wcm9jZXNzKHBvaW50cylcblxuXHQvKiBjb21wYXJlIHRoaXMgZ2VzdHVyZSB3aXRoIGFsbCB0ZW1wbGF0ZXMsIGFjY291bnQgZm9yIHJvdGF0aW9uIGluZGVwZW5kZW5jeSAqL1xuXHR2YXIgcmVzID0gdGhpcy5nZXN0dXJlcy8qLmZpbHRlcih2ID0+IHYubmFtZSA9PSBcImNpcmNsZVwiKSovLm1hcCggKHtuYW1lLCB0ZW1wbGF0ZX0pID0+IHtcblx0XHR2YXIgW2Nvc3QsIHBhdGhdID0gdGhpcy5fcmNkdHcodGVtcGxhdGUsIGNhbmRpZGF0ZSlcblx0XHR2YXIgY29uZmlkZW5jZSA9IE1hdGgucG93KDErY29zdCwgLTAuMSAqIChwYXRoLmxlbmd0aC90aGlzLmNvbmZpZy5zYW1wbGVzKSlcblx0XHRyZXR1cm4ge25hbWUsIGNvc3Q6IGNvc3QsIGNvbmZpZGVuY2U6IGNvbmZpZGVuY2V9XG5cdH0pLmZpbHRlciggZSA9PiB0aGlzLmNvbmZpZy5kZWJ1ZyB8fCBlLmNvbmZpZGVuY2UgPiB0aGlzLmNvbmZpZy5jb25maWRlbmNlKVxuXG5cdGlmICh0aGlzLmNvbmZpZy5kZWJ1ZykgcmVzLmZvckVhY2goZSA9PiBjb25zb2xlLmxvZyhlKSlcblxuXHQvKiBzb3J0IGJ5IGxvd2VzdCBkZXZpYXRpb24gKi9cblx0dmFyIGdlc3R1cmUgPSByZXMuc29ydCggKGEsIGIpID0+IGIuY29uZmlkZW5jZSAtIGEuY29uZmlkZW5jZSlbMF1cblxuXHRpZiAoZ2VzdHVyZSkgY2FsbGJhY2sobnVsbCwgZ2VzdHVyZSlcblx0ZWxzZSBjYWxsYmFjayhuZXcgRXJyb3IoXCJubyBnZXN0dXJlIHJlY29nbml6ZWRcIikpXG59XG5cbm1vZHVsZS5leHBvcnRzID0gbGliXG4iXX0=
