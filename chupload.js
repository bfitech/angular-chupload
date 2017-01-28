
angular.module('chupload', [
]).factory('ChunkUploader', ['$http', function($http){

	function Uploader(
		file, postUrl, postPrefix, postData, chunkSize,
		cbChunkOK, cbFileOK, cbError, chunkFingerprint
	) {

		// readonly
		this.file = file;

		this.postUrl = postUrl;
		this.postPrefix = '__chupload_';
		this.postData = {};

		this.progress = -1;

		this.chunkSize = 1024 * 100;
		this.chunkIndex = 0;
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


		this.cbChunkOK = cbChunkOK ?
			cbChunkOK : function(){};
		this.cbFileOK = cbFileOK ?
			cbFileOK : function(){};
		this.cbError = cbError ?
			cbError : function(){};

		this.chunkFingerprint = chunkFingerprint ?
			chunkFingerprint : null;
	}

	Uploader.prototype.upload = function() {

		// never proceed without destination URL
		if (!this.postUrl)
			return;

		// never allow instance reuse
		if (this.chunkIndex > -1 || this.chunkProgres > -1)
			return null;

		// verify file object
		if (!this.file)
			return null;

		// check browser compatibility
		if ('slice' in this.file)
			this.fileSlice = 'slice';
		else if ('mozSlice' in this.file)
			this.fileSlice = 'mozSlice';
		else if ('webkitSlice' in this.file)
			this.fileSlice = 'webkitSlice';
		else
			return null;

		// calculate chunk size
		this.chunkMax = Math.floor(this.file.size / this.chunkSize);
		this.chunkIndex = 0;

		// begin upload chunks
		this._uploadChunk();
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

		// hash if exists
		if (this.chunkFingerprint)
			form.append(
				this.postPrefix + 'fingerprint',
				this.chunkFingerprint(chunk));

		// additional post data
		for (var i in this.postData)
			form.append(i, this.postData[i]);

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
			that._uploadChunk();
		}, function(ret){
			that.cbError(ret, that);
		});
	};

	return {
		/** Uploader class. */
		Uploader: Uploader,

		/**
		 * Generic event handler with default chunk size 10kB.
		 *
		 * @example
		 *
		 * document.querySelector('#file-input').onchange = (event) => {
		 *   ChunkUpload.uploadFiles(event, '/upload');
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

