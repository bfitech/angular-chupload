
angular.module('chupload', [
]).factory('ChunkUploader', ['$http', function($http){

	function Uploader(
		file, postUrl, postPrefix, postData, chunkSize,
		cbChunkOK, cbFileOK, cbError, getChunkFingerprint
	) {

		// readonly
		this.file = file;

		this.postUrl = postUrl;
		this.postPrefix = '__chupload_';
		this.postData = {};

		this.progress = -1;

		this.chunkSize = 1024 * 100;
		this.chunkMax = -1;
		this.chunkIndex = -1;

		if (postPrefix)
			this.postPrefix = postPrefix;
		if (postData)
			this.postData = postData;

		if (chunkSize) {
			chunkSize = parseInt(chunkSize);
			if (chunkSize > 2 * 1024 * 1024)
				return;
			if (chunkSize < 1024)
				return;
			this.chunkSize = chunkSize;
		}

		this.started = false;
		this.cancelled = false;

		this.cbChunkOK = cbChunkOK ?
			cbChunkOK : function(){};
		this.cbFileOK = cbFileOK ?
			cbFileOK : function(){};
		this.cbError = cbError ?
			cbError : function(){};

		this.getChunkFingerprint = getChunkFingerprint ?
			getChunkFingerprint : null;
	}

	Uploader.prototype.upload = function() {

		// do not reuse instance
		if (this.started)
			return 1;

		// never proceed without destination URL
		if (!this.postUrl)
			return 2;

		// never allow instance reuse
		if (this.chunkIndex > -1 || this.progress > -1)
			return 3;

		// verify file object
		if (!this.file)
			return 4;

		// check browser compatibility
		if ('slice' in this.file)
			this.fileSlice = 'slice';
		else if ('mozSlice' in this.file)
			this.fileSlice = 'mozSlice';
		else if ('webkitSlice' in this.file)
			this.fileSlice = 'webkitSlice';
		else
			return 5;

		// calculate chunk size
		this.chunkMax = Math.floor(this.file.size / this.chunkSize);
		this.chunkIndex = 0;

		// begin upload chunks
		this._uploadChunk();

		return 0;
	};

	Uploader.prototype._uploadChunk = function() {
		var file = this.file,
		    bgn = this.chunkSize * this.chunkIndex,
		    end = bgn + this.chunkSize,
		    chunk = file[this.fileSlice](bgn, end),
		    form = new FormData(),
		    that = this;

		// form
		form.append(this.postPrefix + 'name', this.file.name);
		form.append(this.postPrefix + 'size', this.file.size);
		form.append(this.postPrefix + 'index', this.chunkIndex);
		form.append(this.postPrefix + 'blob', chunk);

		// get fingerprint if applies
		if (this.getChunkFingerprint)
			form.append(
				this.postPrefix + 'fingerprint',
				this.getChunkFingerprint(chunk));

		// additional post data
		for (var i in this.postData)
			form.append(i, this.postData[i]);

		this.started = true;

		// begin sending, don't directly use $http.post to prevent
		// global config being applied
		$http({
			method: 'POST',
			url: this.postUrl,
			data: form,
			transformRequest: angular.identity,
			headers: {
				'Content-Type': undefined,
			}
		}).then(function(ret){
			if (that.chunkIndex >= that.chunkMax) {
				that.progress = -1;
				that.cbFileOK(ret, that);
				return;
			}
			that.chunkIndex++;
			// successful chunk upload
			that.progress = ((that.chunkIndex / that.chunkMax) * 100)
				.toString().replace(/\.([0-9]{2}).+/, '.$1');
			that.cbChunkOK(ret, that);
			// on to the next chunk
			if (that.cancelled)
				return;
			that._uploadChunk();
		}, function(ret){
			that.cbError(ret, that);
		});
	};

	Uploader.prototype.cancel = function() {
		if (!this.started || this.cancelled)
			return false;
		this.cancelled = true;
		return true;
	};

	return {
		/** Uploader class. */
		Uploader: Uploader,

		/**
		 * Generic event handler with default chunk size 10kB and
		 * no fingerprinting.
		 *
		 * @example
		 *
		 * document.querySelector('#file-input').onchange = (event) => {
		 *   ChunkUploader.uploadFiles(event, '/upload');
		 * };
		 */
		uploadFiles: function(
			event, postUrl, postData, chunkSize,
			cbChunkOK, cbFileOK, cbError
		){
			var uploader = this.uploader;
			if (!event.target.files)
				return;
			var i = 0, fileObj;
			while (i < event.target.files.length) {
				fileObj = event.target.files[i];
				(new Uploader(
					fileObj, postUrl, null, postData, chunkSize,
					cbChunkOK, cbFileOK, cbError
				)).upload();
				i++;
			}
		},
	};
}]);

