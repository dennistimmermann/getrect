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

/**
 * Constructor for our recognizer
 *
 * @param {Object} config Keys: samples (upper samplesize to limit cpu usage, default 32), deviation (maximal variation an template, default 1)
 * @return {Object} new Recognizer
 */

var lib = function(config = {}) {
	this.config = { samples: config.samples || 32, deviation: config.deviation || 1 }
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

	/* step 2: compute the angle of the line between each consecutive point */
	var fixed = samples.reduce( ([px, py, tail], [cx, cy], i, arr) => {
		return [cx, cy, [...tail || [], Math.atan2(py - cy, px - cx)]]
	})[2]

	/* step 3: compute the center of mass ... */
	var [ax, ay] = samples.reduce( ([px, py], [cx, cy], i, arr) => {
		return [px+cx, py+cy]
	})
	var center = [ax/samples.length, ay/samples.length]

	/* 			... or center of the axis aligned bounding box ... */
	//var[up, right, down, left] = samples.reduce(function([u, r, d, l], [cx, cy], i, arr) {
	//	return [Math.min(cy, u), Math.max(cx, r), Math.max(cy, d), Math.min(cx, l)]
	//}, [Infinity, -Infinity, -Infinity, Infinity])
	//var center = [(left+right)/2, (up+down)/2]

	/* 			... to compute the angle between it and the starting point ... */
	var rotation = Math.atan2(samples[0][1] - center[1], samples[0][0] - center[0])
	/* 			... so we can substract it from each angle to make the gesture rotation independent */

	var	adjusted = fixed.map(v => {
		return ((v - rotation + Math.PI)%Math.PI)-Math.PI
	})
	// var adjusted = [for (v of fixed) ((v - rotation + Math.PI)%Math.PI)-Math.PI]

	return [fixed, adjusted]
}

/**
 * add new gestures
 *
 * @param {String} name the name of the gesture, this will be returned if the gesture is recognized
 * @param {Array} points
 * @param {Boolean} rotate set to true to make the gesture rotation independent
 */

lib.prototype.add = function(name, points, rotate = false) {
	var [fixed, adjusted] = this._process(points)
	this.gestures.push({name: name, rotate: rotate, template: rotate?adjusted:fixed})
}

/**
 * compare two gestures, based on dynamic time warping
 *
 * @param {Array} template
 * @param {Array} candidate
 */

lib.prototype._dtw = function(template, candidate, t = 0, tl = template.length, c = 0, cl = candidate.length, cost = 0, path = [[0, 0]]) {

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
	var neighbors = [[1, 1], [1, 0], [0, 1]].filter( ([dt, dc], i, arr) => {
		return t+dt < tl && c+dc < cl
	})

	/* if we arrived at the bottom right there a no possible neighbors left and we finished */
	/* the deviation from the template is based on the product of the accumulated cost an the length of the path */
	if (neighbors.length === 0) return {deviation: cost*(path.length/this.config.samples)/this.config.samples, cost: cost, path: path}

	/* step 2: calculate the cost for each potential neighbor */
	var options = neighbors.map( v => {
		return [v, (Math.abs(template[t+v[0]] - candidate[c+v[1]])%Math.PI)]
	})

	/* step 3: get the neighbor with the lowest cost */
	var [cell, fee] = options.sort( (a, b) => a[1] - b[1])[0]
	var [dt, dc] = cell

	/* repeat till we reached the bottom right cell */
	return this._dtw(template, candidate, t+dt, tl, c+dc, cl, cost+fee, [...path, cell])
}

/**
 * compare a gesture with all templates
 *
 * @param {Array} points
 * @return {String} name of the recognized gesture, if any
 */

lib.prototype.recognize = function(points) {
	if (points.length < 2) return []
	var [fixed, adjusted] = this._process(points)

	/* compare this gesture with all templates, account for rotation independency */
	var res = this.gestures/*.filter(v => v.name == "circle")*/.map( ({name, rotate, template}) => { return {name, ...this._dtw(template, rotate?adjusted:fixed)}} )
	// var res = [for({name, rotate, template} of this.gestures) {name, ...this._dtw(template, rotate?adjusted:fixed)}]

	/* sort by lowest deviation */
	res.sort( (a, b) => a.deviation - b.deviation)

	if (this.config.debug) res.forEach(e => console.log(e))
	// if(lib.config.debug) [for (e of res) console.log(e)]

	/* return the most suitable gesture if its derivation isn't out of bounds */
	return res.filter( e => this.config.debug || e.deviation < this.config.deviation)[0]
	// return [for(r of res) if(r.deviation < lib.config.deviation) r][0]

}

module.exports = lib
