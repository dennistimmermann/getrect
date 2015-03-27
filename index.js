"use strict";

/**
 * getrekt - gesture recognizer based on dtw
 * Copyright 2015 Dennis Timmermann <timmermann.dennis@googlemail.com> License MIT
 */

var _ = {}

/**
 * naive downsampling, gets evenly distributed points from arr, based on its index and not on pathlength
 *
 * @param {Array} arr array with samples
 * @param {Integer} n desired number of samples
 * @return {Array} downsampled array
 */

_.shrink = function(arr, n) {
	if (arr.length <= n) return arr
	var ret = new Array(n),
		step = (arr.length-1)/(n-1)

	for (let i = 0; i < n; i++ ) {
		ret[i] = arr[i*step|0]
	}

	return ret
}

_.distance = function(a, b) {
	return Math.sqrt( (a[0] - b[0])**2 + (a[1] - b[1])**2)
}

/**
 * Constructor for our recognizer
 *
 * @param {Object} config Keys: samples (upper samplesize to limit cpu usage, default 32), deviation (maximal variation an template, default 1)
 * @return {Object} new Recognizer
 */

var lib = function(config = {}) {
	this.config = { samples: config.samples || 32, confidence: config.confidence || 0.70 }
	this.gestures = []
};

/**
 * conditions the input array
 *
 * @param {Array} points list of points, formatted as [x,y]
 * @return {[Array, Array]} returns two Arrays, one fixed and one rotation independent, to be later compared with
 */

lib.prototype._process = function(points) {

	/* step 1: downsampling */
	var samples = _.shrink(points, this.config.samples)

	/* step 2: compute the center of mass ... */
	// var [ax, ay] = samples.reduce( ([px, py], [cx, cy], i, arr) => {
	// 	return [px+cx, py+cy]
	// })
	// var center = [ax/samples.length, ay/samples.length]

	/* 			... or center of the axis aligned bounding box ... */
	var[up, right, down, left] = samples.reduce( ([u, r, d, l], [cx, cy], i, arr) => {
		return [Math.min(cy, u), Math.max(cx, r), Math.max(cy, d), Math.min(cx, l)]
	}, [Infinity, -Infinity, -Infinity, Infinity])

	var center = [(left+right)/2, (up+down)/2]
	var start = samples[0]

	/* step 3: get the diameter of the gesture so we can scale it without stretching */
	var radius = samples.reduce( (prev, cur, i, arr) => {
		return Math.max(prev, _.distance(center, cur))
	}, 0)

	/* step 4: compute the normalized coordinates */
	var coordinates = samples.map( ([x, y]) => {
		return [(x-start[0])/radius, (y-start[1])/radius]
	})

	return coordinates
}

/**
 * add new gestures
 *
 * @param {String} name the name of the gesture, this will be returned if the gesture is recognized
 * @param {Array} points
 */

lib.prototype.add = function(name, points) {
	this.gestures.push({name: name, template: this._process(points)})
}

/**
 * compare two gestures, based on dynamic time warping
 *
 * @param {Array} template
 * @param {Array} candidate
 */

lib.prototype._rcdtw = function(template, candidate, i = template.length-1, j = candidate.length-1, cache) {
	cache = cache || template.map(()=> new Array(candidate.length))

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
	var coords = [[i, j-1], [i-1, j], [i-1, j-1]].filter( ([ii, ij]) => {
		return ii >= 0 && ij >= 0
	})

	/* get the cost of each neighbor */
	var neighbors = coords.map( ([ii, ij], i, arr) => {
		/* recursively get the cost of each cell and cache is */
		return cache[ii][ij] || this._rcdtw(template, candidate, ii, ij, cache)
	})

	/* get the cheapest. If the are no neighbors, its the [0, 0] cell */
	var [fee, cell] = neighbors.sort( (a, b) => a[0] - b[0])[0] || [0, [[0, 0]]]

	/* return the full cost and the path until this point */
	return cache[i][j] = [_.distance(template[i], candidate[j]) + fee, [...cell, [i, j]]]
}

/**
 * compare a gesture with all templates
 *
 * @param {Array} points
 * @return {String} name of the recognized gesture, if any
 */

lib.prototype.recognize = function(points, callback) {
	if (points.length < 2) return []
	var candidate = this._process(points)

	/* compare this gesture with all templates, account for rotation independency */
	var res = this.gestures/*.filter(v => v.name == "circle")*/.map( ({name, template}) => {
		var [cost, path] = this._rcdtw(template, candidate)
		var confidence = Math.pow(1+cost, -0.1 * (path.length/this.config.samples))
		return {name, cost: cost, confidence: confidence}
	}).filter( e => this.config.debug || e.confidence > this.config.confidence)

	if (this.config.debug) res.forEach(e => console.log(e))

	/* sort by lowest deviation */
	var gesture = res.sort( (a, b) => b.confidence - a.confidence)[0]

	if (gesture) callback(null, gesture)
	else callback(new Error("no gesture recognized"))
}

module.exports = lib
