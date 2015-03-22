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
