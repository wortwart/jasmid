/*
audio.js
*/
var sampleRate = 44100; /* hard-coded in Flash player */

function AudioPlayer(generator, opts) {
	if (!opts) opts = {};
	var latency = opts.latency || 1;
	var checkInterval = latency * 100 /* in ms */

	var audioElement = new Audio();
	var oldAudioAPI = window.AudioContext || window.webkitAudioContext;
	var requestStop = false;

	if (oldAudioAPI) {
		console.log('oldAudioAPI')
		// Uses Webkit Web Audio API if available
		var context = new oldAudioAPI();
		sampleRate = context.sampleRate;

		var channelCount = 2;
		var bufferSize = 4096*4; // Higher for less gitches, lower for less latency

		var node = context.createScriptProcessor(bufferSize, 0, channelCount);

		node.onaudioprocess = function(e) { process(e) };

		function process(e) {
			if (generator.finished) {
				node.disconnect();
				//console.log('finished!', e)
				return;
			}

			var dataLeft = e.outputBuffer.getChannelData(0);
			var dataRight = e.outputBuffer.getChannelData(1);

			var generate = generator.generate(bufferSize);

			for (var i = 0; i < bufferSize; ++i) {
				dataLeft[i] = generate[i*2];
				dataRight[i] = generate[i*2+1];
			}
		}

		// start
		node.connect(context.destination);

		return {
			'stop': function() {
				// pause
				node.disconnect();
				requestStop = true;
			},
			'type': 'Webkit Audio'
		}

	} else {
		// Fall back to creating flash player
		console.warn('Oh no, it\'s Flash ...');
		var c = document.createElement('div');
		c.innerHTML = '<embed type="application/x-shockwave-flash" id="da-swf" src="da.swf" width="8" height="8" allowScriptAccess="always" style="position: fixed; left:-10px;" />';
		document.body.appendChild(c);
		var swf = document.getElementById('da-swf');

		var minBufferDuration = latency * 1000; /* refill buffer when there are only this many ms remaining */
		var bufferFillLength = latency * sampleRate;

		function write(data) {
			var out = new Array(data.length);
			for (var i = data.length-1; i != 0; i--) {
				out[i] = Math.floor(data[i]*32768);
			}
			return swf.write(out.join(' '));
		}

		function checkBuffer() {
			if (swf.bufferedDuration() < minBufferDuration) {
				write(generator.generate(bufferFillLength));
			};
			if (!requestStop && !generator.finished) setTimeout(checkBuffer, checkInterval);
		}

		function checkReady() {
			if (swf.write) {
				checkBuffer();
			} else {
				setTimeout(checkReady, 10);
			}
		}
		checkReady();

		return {
			'stop': function() {
				swf.stop();
				requestStop = true;
			},
			'bufferedDuration': function() {
				return swf.bufferedDuration();
			},
			'type': 'Flash Audio'
		}
	}
}

export {AudioPlayer, sampleRate}