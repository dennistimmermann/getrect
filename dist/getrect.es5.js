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
