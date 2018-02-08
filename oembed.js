(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.Oembed = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
/**
 * OEembed Plugin
 *
 * Copyright (c) 2015 KudaGo
 * MIT license
 *
 * Orignal Author: Richard Chamorro
 * Forked by Kudago to make it jQuery-less
 */

var extend = require('xtend/mutable');
var ajax = require('component-ajax');
var domify = require('domify');
var shortURLList = require('./lib/url-list');
var providers = require('./lib/providers');
var randomString = require('random-string');


/**
 * @constructor
 *
 * @param {Element} elements An element to init oembed on
 * @param {Object} options [description]
 */
function Oembed(elements, options) {
	var defaults = {
		fallback: true,
		maxWidth: null,
		maxHeight: null,
		includeHandle: true,
		urlExpandApi: 'http://api.longurl.org/v2/expand',
		embedMethod: 'auto',
		// "auto", "append", "fill"
		onProviderNotFound: function () {},
		beforeEmbed: function () {},
		afterEmbed: function () {},
		onEmbed: false,
		onError: function (a, b, c, d) {
			console.log('err:', a, b, c, d);
		},
		ajaxOptions: {}
	};

	this.settings = extend(defaults, options);

	//the instance's data storage element
	this.data = {};

	//single/multiple element call
	if (elements instanceof Element) {
		this.embedElement(elements);
	} else {
		[].forEach.call(elements, this.embedElement.bind(this));
	}
}


extend(Oembed.prototype, {

	providers: providers,

	embedElement: function (element) {
		var self = this;
		var resourceURL = self.settings.url ? self.settings.url : element.getAttribute("href");
		var provider;

		if (self.embedAction) {
			self.settings.onEmbed = self.embedAction;
		} else if (!self.settings.onEmbed) {
			self.settings.onEmbed = function (oembedData) {
				self.insertCode(element, self.settings.embedMethod, oembedData);
			};
		}

		if (resourceURL !== null && resourceURL !== undefined) {
			//Check if shorten URL
			for (var j = 0, l = shortURLList.length; j < l; j++) {
				var regExp = new RegExp('://' + shortURLList[j] + '/', "i");

				if (resourceURL.match(regExp) !== null) {
					//AJAX to http://api.longurl.org/v2/expand?url=http://bit.ly/JATvIs&format=json&callback=hhh
					var ajaxopts = extend({
						url: self.settings.urlExpandApi,
						dataType: 'jsonp',
						data: {
							url: resourceURL,
							format: "json"
							//callback: "?"
						},
						success: function (data) {
							resourceURL = data['long-url'];
							provider = self.getOEmbedProvider(data['long-url']);

							//remove fallback
							if (!!self.settings.fallback === false) {
								provider = provider.name.toLowerCase() === 'opengraph' ? null : provider;
							}

							if (provider !== null) {
								provider.params = self.getNormalizedParams(self.settings[provider.name]) || {};
								provider.style.maxWidth = self.settings.maxWidth + 'px';
								provider.style.maxHeight = self.settings.maxHeight + 'px';
								self.embedCode(element, resourceURL, provider);
							} else {
								self.settings.onProviderNotFound.call(element, resourceURL);
							}
						},
						error: function () {
							self.settings.onError.call(element, resourceURL)
						}
					}, self.settings.ajaxOptions || {});

					ajax(ajaxopts);

					return element;
				}
			}
			provider = self.getOEmbedProvider(resourceURL);

			//remove fallback
			if (!!self.settings.fallback === false) {
				provider = provider.name.toLowerCase() === 'opengraph' ? null : provider;
			}
			if (provider !== null) {
				provider.params = self.getNormalizedParams(self.settings[provider.name]) || {};
				provider.maxWidth = self.settings.maxWidth;
				provider.maxHeight = self.settings.maxHeight;
				self.embedCode(element, resourceURL, provider);
			} else {
				self.settings.onProviderNotFound.call(element, resourceURL);
			}
		}
		return element;
	},

	insertCode: function (container, embedMethod, oembedData) {
		var self = this;

		if (oembedData === null)
			return;

		if (embedMethod === 'auto' && container.getAttribute('href') !== null) {
			embedMethod = 'append';
		} else if (embedMethod == 'auto') {
			embedMethod = 'replace';
		}

		//TODO: change this switch construction to more readable state
		switch (embedMethod) {
			case "replace":
				if (oembedData.code instanceof Element) {
					container.parentNode.insertBefore(oembedData.code, container);
				} else {
					container.parentNode.insertBefore(domify(oembedData.code), container);
				}
				container.parentNode.removeChild(container);
				break;
			case "fill":
				if (oembedData.code instanceof Element) {
					container.appendChild(oembedData.code);
				} else {
					container.innerHTML = oembedData.code;
				}
				break;
			case "append":
				var containerWrap = domify('<div class="oembedall-container"></div>');
				container.parentNode.appendChild(containerWrap);
				containerWrap.appendChild(container);
				var oembedContainer = containerWrap;
				if (self.settings.includeHandle) {
					var closehide = domify('<span class="oembedall-closehide">&darr;</span>');
					container.parentNode.insertBefore(closehide, container);
					closehide.addEventListener('click', function () {
						var encodedString = encodeURIComponent(closehide.innerHTML);
						closehide.innerHTML = encodedString == '%E2%86%91' ? '&darr;' : '&uarr;';
						var lastSibling = closehide.parentNode.lastChild;
						if (getComputedStyle(lastSibling).display == 'none') {
							lastSibling.style.display = 'block';
						} else {
							lastSibling.style.display = 'none';
						}
					});
				}
				oembedContainer.appendChild(document.createElement('br'));
				try {
					oembedContainer.appendChild(oembedData.code.clone());
				} catch (e) {
					oembedContainer.appendChild(oembedData.code);
				}
				/* Make videos semi-responsive
				 * If parent div width less than embeded iframe video then iframe gets shrunk to fit smaller width
				 * If parent div width greater thans embed iframe use the max widht
				 * - works on youtubes and vimeo
				 */
				if (self.settings.maxWidth) {
					var post_width = oembedContainer.parentNode.clientWidth;
					if (post_width < self.settings.maxWidth) {
						var iframe_width_orig = oembedContainer.querySelector('iframe').clientWidth;
						var iframe_height_orig = oembedContainer.querySelector('iframe').clientHeight;
						var ratio = iframe_width_orig / post_width;
						oembedContainer.querySelector('iframe').clientWidth = frame_width_orig / ratio;
						oembedContainer.querySelector('iframe').clientHeight = iframe_height_orig / ratio;
					} else {
						if (self.settings.maxWidth) {
							oembedContainer.querySelector('iframe').clientWidth = self.settings.maxWidth;
						}
						if (self.settings.maxHeight) {
							oembedContainer.querySelector('iframe').clientHeight = self.settings.maxHeight;
						}
					}
				}
				break;
		}
	},

	getPhotoCode: function (url, oembedData) {
		var code;
		var alt = oembedData.title ? oembedData.title : '';
		alt += oembedData.author_name ? ' - ' + oembedData.author_name : '';
		alt += oembedData.provider_name ? ' - ' + oembedData.provider_name : '';

		if (oembedData.url) {
			code = '<div><a href="' + url + '" target=\'_blank\'><img src="' + oembedData.url + '" alt="' + alt + '"/></a></div>';
		} else if (oembedData.thumbnail_url) {
			var newURL = oembedData.thumbnail_url.replace('_s', '_b');
			code = '<div><a href="' + url + '" target=\'_blank\'><img src="' + newURL + '" alt="' + alt + '"/></a></div>';
		} else {
			code = '<div>Error loading this picture</div>';
		}

		if (oembedData.html) {
			code += "<div>" + oembedData.html + "</div>";
		}

		return code;
	},

	getRichCode: function (url, oembedData) {
		return oembedData.html;
	},

	getGenericCode: function (url, oembedData) {
		var title = ((oembedData.title) && (oembedData.title !== null)) ? oembedData.title : url;
		var code = '<a href="' + url + '">' + title + '</a>';

		if (oembedData.html) {
			code += "<div>" + oembedData.html + "</div>";
		}

		return code;
	},

	getOEmbedProvider: function (url) {
		for (var i = 0; i < this.providers.length; i++) {
			for (var j = 0, l = this.providers[i].urlschemes.length; j < l; j++) {
				var regExp = new RegExp(this.providers[i].urlschemes[j], "i");

				if (url.match(regExp) !== null)
					return this.providers[i];
			}
		}

		return null;
	},

	embedCode: function (container, externalUrl, embedProvider) {

		var self = this;

		if (self.data['data-external-url'] && embedProvider.embedtag.tag != 'iframe') {
			var oembedData = {code: self.data['data-external-url']};
			self.success(oembedData, externalUrl, container);
		} else if (embedProvider.yql) {
			var from = embedProvider.yql.from || 'htmlstring';
			var url = embedProvider.yql.url ? embedProvider.yql.url(externalUrl) : externalUrl;
			var query = 'SELECT * FROM ' + from
				+ ' WHERE url="' + (url) + '"'
				+ " and " + (/html/.test(from) ? 'xpath' : 'itemPath') + "='" + (embedProvider.yql.xpath || '/') + "'";
			if (from == 'html')
				query += " and compat='html5'";
			var ajaxopts = extend({
				url: "//query.yahooapis.com/v1/public/yql",
				dataType: 'jsonp',
				data: {
					q: query,
					format: "json",
					env: 'store://datatables.org/alltableswithkeys',
					callback: "?"
				},
				success: function (data) {
					var result;

					if (embedProvider.yql.xpath && embedProvider.yql.xpath == '//meta|//title|//link') {
						var meta = {};

						if (data.query == null) {
							data.query = {};
						}
						if (data.query.results == null) {
							data.query.results = {"meta": []};
						}
						for (var i = 0, l = data.query.results.meta.length; i < l; i++) {
							var name = data.query.results.meta[i].name || data.query.results.meta[i].property || null;
							if (name == null)continue;
							meta[name.toLowerCase()] = data.query.results.meta[i].content;
						}
						if (!meta.hasOwnProperty("title") || !meta.hasOwnProperty("og:title")) {
							if (data.query.results.title != null) {
								meta.title = data.query.results.title;
							}
						}
						if (!meta.hasOwnProperty("og:image") && data.query.results.hasOwnProperty("link")) {
							for (var i = 0, l = data.query.results.link.length; i < l; i++) {
								if (data.query.results.link[i].hasOwnProperty("rel")) {
									if (data.query.results.link[i].rel == "apple-touch-icon") {
										if (data.query.results.link[i].href.charAt(0) == "/") {
											meta["og:image"] = url.match(/^(([a-z]+:)?(\/\/)?[^\/]+\/).*$/)[1] + data.query.results.link[i].href;
										} else {
											meta["og:image"] = data.query.results.link[i].href;
										}
									}
								}
							}
						}
						result = embedProvider.yql.datareturn(meta);
					} else {
						result = embedProvider.yql.datareturn ? embedProvider.yql.datareturn(data.query.results) : data.query.results.result;
					}
					if (result === false)return;
					var oembedData = extend({}, result);
					oembedData.code = result;
					self.success(oembedData, externalUrl, container);
				},
				error: self.settings.onError.call(container, externalUrl, embedProvider)
			}, self.settings.ajaxOptions || {});
			ajax(ajaxopts);
		} else if (embedProvider.templateRegex) {
			if (embedProvider.embedtag.tag !== '') {
				var flashvars = embedProvider.embedtag.flashvars || '';
				var tag = embedProvider.embedtag.tag || 'embed';
				var width = embedProvider.embedtag.width || 'auto';
				var height = embedProvider.embedtag.height || 'auto';
				var src = externalUrl.replace(embedProvider.templateRegex, embedProvider.apiendpoint);

				if (!embedProvider.nocache) {
					src += '&jqoemcache=' + randomString({length: 5});
				}

				if (embedProvider.apikey) {
					src = src.replace('_APIKEY_', self.settings.apikeys[embedProvider.name]);
				}

				var code = domify('<' + tag +
					' src="' + src +
					'" width="'+ width +
					'" height="'+ height +
					'" allowfullscreen="' + (embedProvider.embedtag.allowfullscreen || 'true')  +
					'" allowscriptaccess="' + (embedProvider.embedtag.allowfullscreen || 'always') + '"/>')
				code.style.maxHeight = self.settings.maxHeight || 'auto';
				code.style.maxWidth = self.settings.maxWidth || 'auto';

				if (tag == 'embed') {
					code.setAttribute('type', embedProvider.embedtag.type || "application/x-shockwave-flash");
					code.setAttribute('flashvars', externalUrl.replace(embedProvider.templateRegex, flashvars));
				}

				if (tag == 'iframe') {
					code.setAttribute('scrolling', embedProvider.embedtag.scrolling || "no");
					code.setAttribute('frameborder', embedProvider.embedtag.frameborder || "0");
				}

				self.success({code: code}, externalUrl, container);
			} else if (embedProvider.apiendpoint) {
				//Add APIkey if true
				if (embedProvider.apikey)
					embedProvider.apiendpoint = embedProvider.apiendpoint.replace('_APIKEY_', self.settings.apikeys[embedProvider.name]);

				ajaxopts = extend({
					url: externalUrl.replace(embedProvider.templateRegex, embedProvider.apiendpoint),
					dataType: 'jsonp',
					success: function (data) {
						var oembedData = extend({}, data);
						oembedData.code = embedProvider.templateData(data);
						self.success(oembedData, externalUrl, container);
					},
					error: self.settings.onError.call(container, externalUrl, embedProvider)
				}, self.settings.ajaxOptions || {});
				ajax(ajaxopts);
			} else {
				self.success({code: externalUrl.replace(embedProvider.templateRegex, embedProvider.template)}, externalUrl, container);
			}
		} else {

			var requestUrl = self.getRequestUrl(embedProvider, externalUrl);
			ajaxopts = extend({
				url: requestUrl,
				dataType: embedProvider.dataType || 'jsonp',
				success: function (data) {
					var oembedData = extend({}, data);
					switch (oembedData.type) {
						case "file": //Deviant Art has this
						case "photo":
							oembedData.code = self.getPhotoCode(externalUrl, oembedData);
							break;
						case "video":
						case "rich":
							oembedData.code = self.getRichCode(externalUrl, oembedData);
							break;
						default:
							oembedData.code = self.getGenericCode(externalUrl, oembedData);
							break;
					}
					self.success(oembedData, externalUrl, container);
				},
				error: self.settings.onError.call(container, externalUrl, embedProvider)
			}, self.settings.ajaxOptions || {});
			ajax(ajaxopts);
		};
	},

	success: function (oembedData, externalUrl, container) {
		this.data['data-external-url'] = oembedData.code;
		this.settings.beforeEmbed.call(container, oembedData);
		this.settings.onEmbed.call(container, oembedData);
		this.settings.afterEmbed.call(container, oembedData);
	},

	getRequestUrl: function (provider, externalUrl) {
		var url = provider.apiendpoint,
			qs = "",
			i;
		url += (url.indexOf("?") <= 0) ? "?" : "&";
		url = url.replace('#', '%23');

		if (provider.maxWidth !== null && (typeof provider.params.maxwidth === 'undefined' || provider.params.maxwidth === null)) {
			provider.params.maxwidth = provider.maxWidth;
		}

		if (provider.maxHeight !== null && (typeof provider.params.maxheight === 'undefined' || provider.params.maxheight === null)) {
			provider.params.maxheight = provider.maxHeight;
		}

		for (i in provider.params) {
			// We don't want them to jack everything up by changing the callback parameter
			if (i == provider.callbackparameter)
				continue;

			// allows the options to be set to null, don't send null values to the server as parameters
			if (provider.params[i] !== null)
				qs += "&" + escape(i) + "=" + provider.params[i];
		}

		url += "format=" + provider.format + "&url=" + escape(externalUrl) + qs;
		if (provider.dataType != 'json')
			url += "&" + provider.callbackparameter + "=?";

		return url;
	},

	getNormalizedParams: function (params) {
		if (params === null) return null;
		var key, normalizedParams = {};
		for (key in params) {
			if (key !== null) normalizedParams[key.toLowerCase()] = params[key];
		}
		return normalizedParams;
	}

});

module.exports = Oembed;
},{"./lib/providers":3,"./lib/url-list":4,"component-ajax":5,"domify":6,"random-string":7,"xtend/mutable":9}],2:[function(require,module,exports){
/**
 * Constructor Function for OEmbedProvider Class.
 */
function OEmbedProvider(name, type, urlschemesarray, apiendpoint, extraSettings) {
	this.name = name;
	this.type = type; // "photo", "video", "link", "rich", null
	this.urlschemes = urlschemesarray;
	this.apiendpoint = apiendpoint;
	this.maxWidth = 500;
	this.maxHeight = 400;
	extraSettings = extraSettings || {};

	if (extraSettings.useYQL) {

		if (extraSettings.useYQL == 'xml') {
			extraSettings.yql = {
				xpath: "//oembed/html",
				from: 'xml',
				apiendpoint: this.apiendpoint,
				url: function (externalurl) {
					return this.apiendpoint + '?format=xml&url=' + externalurl
				},
				datareturn: function (results) {
					return results.html.replace(/.*\[CDATA\[(.*)\]\]>$/, '$1') || ''
				}
			};
		} else {
			extraSettings.yql = {
				from: 'json',
				apiendpoint: this.apiendpoint,
				url: function (externalurl) {
					return this.apiendpoint + '?format=json&url=' + externalurl
				},
				datareturn: function (results) {
					if (results.json.type != 'video' && (results.json.url || results.json.thumbnail_url)) {
						return '<img src="' + (results.json.url || results.json.thumbnail_url) + '" />';
					}
					return results.json.html || ''
				}
			};
		}
		this.apiendpoint = null;
	}


	for (var property in extraSettings) {
		this[property] = extraSettings[property];
	}

	this.format = this.format || 'json';
	this.callbackparameter = this.callbackparameter || "callback";
	this.embedtag = this.embedtag || {tag: ""};
}

module.exports = OEmbedProvider;
},{}],3:[function(require,module,exports){
var OEmbedProvider = require('./provider');

/* Native & common providers */
var providers = [

	//Video
	new OEmbedProvider("youtube", "video", ["youtube\\.com/watch.+v=[\\w-]+&?", "youtu\\.be/[\\w-]+", "youtube.com/embed"], '//www.youtube.com/embed/$1?wmode=transparent', {
		templateRegex: /.*(?:v\=|be\/|embed\/)([\w\-]+)&?.*/, embedtag: {tag: 'iframe', width: '425', height: '349'}
	}),

	//new OEmbedProvider("youtube", "video", ["youtube\\.com/watch.+v=[\\w-]+&?", "youtu\\.be/[\\w-]+"], '//www.youtube.com/oembed', {useYQL:'json'}),
	//new OEmbedProvider("youtubeiframe", "video", ["youtube.com/embed"],  "$1?wmode=transparent",
	//  {templateRegex:/(.*)/,embedtag : {tag: 'iframe', width:'425',height: '349'}}),
	new OEmbedProvider("wistia", "video", ["wistia.com/m/.+", "wistia.com/embed/.+", "wi.st/m/.+", "wi.st/embed/.+"], '//fast.wistia.com/oembed', {useYQL: 'json'}),
	new OEmbedProvider("xtranormal", "video", ["xtranormal\\.com/watch/.+"], "//www.xtranormal.com/xtraplayr/$1/$2", {
		templateRegex: /.*com\/watch\/([\w\-]+)\/([\w\-]+).*/, embedtag: {tag: 'iframe', width: '320', height: '269'}}),
	new OEmbedProvider("scivee", "video", ["scivee.tv/node/.+"], "//www.scivee.tv/flash/embedCast.swf?", {
		templateRegex: /.*tv\/node\/(.+)/, embedtag: {width: '480', height: '400', flashvars: "id=$1&type=3"}}),
	new OEmbedProvider("veoh", "video", ["veoh.com/watch/.+"], "//www.veoh.com/swf/webplayer/WebPlayer.swf?version=AFrontend.5.7.0.1337&permalinkId=$1&player=videodetailsembedded&videoAutoPlay=0&id=anonymous", {
		templateRegex: /.*watch\/([^\?]+).*/, embedtag: {width: '410', height: '341'}}),
	new OEmbedProvider("gametrailers", "video", ["gametrailers\\.com/video/.+"], "//media.mtvnservices.com/mgid:moses:video:gametrailers.com:$2", {
		templateRegex: /.*com\/video\/([\w\-]+)\/([\w\-]+).*/, embedtag: {width: '512', height: '288' }}),
	new OEmbedProvider("funnyordie", "video", ["funnyordie\\.com/videos/.+"], "//player.ordienetworks.com/flash/fodplayer.swf?", {
		templateRegex: /.*videos\/([^\/]+)\/([^\/]+)?/, embedtag: {width: 512, height: 328, flashvars: "key=$1"}}),
	new OEmbedProvider("colledgehumour", "video", ["collegehumor\\.com/video/.+"], "//www.collegehumor.com/moogaloop/moogaloop.swf?clip_id=$1&use_node_id=true&fullscreen=1",
		{templateRegex: /.*video\/([^\/]+).*/, embedtag: {width: 600, height: 338}}),
	new OEmbedProvider("metacafe", "video", ["metacafe\\.com/watch/.+"], "//www.metacafe.com/fplayer/$1/$2.swf",
		{templateRegex: /.*watch\/(\d+)\/(\w+)\/.*/, embedtag: {width: 400, height: 345}}),
	new OEmbedProvider("bambuser", "video", ["bambuser\\.com\/channel\/.*\/broadcast\/.*"], "//static.bambuser.com/r/player.swf?vid=$1",
		{templateRegex: /.*bambuser\.com\/channel\/.*\/broadcast\/(\w+).*/, embedtag: {width: 512, height: 339 }}),
	new OEmbedProvider("twitvid", "video", ["twitvid\\.com/.+"], "//www.twitvid.com/embed.php?guid=$1&autoplay=0",
		{templateRegex: /.*twitvid\.com\/(\w+).*/, embedtag: {tag: 'iframe', width: 480, height: 360 }}),
	new OEmbedProvider("aniboom", "video", ["aniboom\\.com/animation-video/.+"], "//api.aniboom.com/e/$1",
		{templateRegex: /.*animation-video\/(\d+).*/, embedtag: {width: 594, height: 334}}),
	new OEmbedProvider("vzaar", "video", ["vzaar\\.com/videos/.+", "vzaar.tv/.+"], "//view.vzaar.com/$1/player?",
		{templateRegex: /.*\/(\d+).*/, embedtag: {tag: 'iframe', width: 576, height: 324 }}),
	new OEmbedProvider("snotr", "video", ["snotr\\.com/video/.+"], "//www.snotr.com/embed/$1",
		{templateRegex: /.*\/(\d+).*/, embedtag: {tag: 'iframe', width: 400, height: 330}, nocache: 1 }),
	new OEmbedProvider("youku", "video", ["v.youku.com/v_show/id_.+"], "//player.youku.com/player.php/sid/$1/v.swf",
		{templateRegex: /.*id_(.+)\.html.*/, embedtag: {width: 480, height: 400}, nocache: 1 }),
	new OEmbedProvider("tudou", "video", ["tudou.com/programs/view/.+\/"], "//www.tudou.com/v/$1/v.swf",
		{templateRegex: /.*view\/(.+)\//, embedtag: {width: 480, height: 400}, nocache: 1 }),
	new OEmbedProvider("embedr", "video", ["embedr\\.com/playlist/.+"], "//embedr.com/swf/slider/$1/425/520/default/false/std?",
		{templateRegex: /.*playlist\/([^\/]+).*/, embedtag: {width: 425, height: 520}}),
	new OEmbedProvider("blip", "video", ["blip\\.tv/.+"], "//blip.tv/oembed/"),
	new OEmbedProvider("minoto-video", "video", ["//api.minoto-video.com/publishers/.+/videos/.+", "//dashboard.minoto-video.com/main/video/details/.+", "//embed.minoto-video.com/.+"], "//api.minoto-video.com/services/oembed.json", {useYQL: 'json'}),
	new OEmbedProvider("animoto", "video", ["animoto.com/play/.+"], "//animoto.com/services/oembed"),
	new OEmbedProvider("hulu", "video", ["hulu\\.com/watch/.*"], "//www.hulu.com/api/oembed.json"),
	new OEmbedProvider("ustream", "video", ["ustream\\.tv/recorded/.*"], "//www.ustream.tv/oembed", {useYQL: 'json'}),
	new OEmbedProvider("videojug", "video", ["videojug\\.com/(film|payer|interview).*"], "//www.videojug.com/oembed.json", {useYQL: 'json'}),
	new OEmbedProvider("sapo", "video", ["videos\\.sapo\\.pt/.*"], "//videos.sapo.pt/oembed", {useYQL: 'json'}),
	new OEmbedProvider("vodpod", "video", ["vodpod.com/watch/.*"], "//vodpod.com/oembed.js", {useYQL: 'json'}),
	new OEmbedProvider("vimeo", "video", ["www\.vimeo\.com\/groups\/.*\/videos\/.*", "www\.vimeo\.com\/.*", "vimeo\.com\/groups\/.*\/videos\/.*", "vimeo\.com\/.*"], "//vimeo.com/api/oembed.json"),
	new OEmbedProvider("dailymotion", "video", ["dailymotion\\.com/.+"], '//www.dailymotion.com/services/oembed'),
	new OEmbedProvider("5min", "video", ["www\\.5min\\.com/.+"], '//api.5min.com/oembed.xml', {useYQL: 'xml'}),
	new OEmbedProvider("National Film Board of Canada", "video", ["nfb\\.ca/film/.+"], '//www.nfb.ca/remote/services/oembed/', {useYQL: 'json'}),
	new OEmbedProvider("qik", "video", ["qik\\.com/\\w+"], '//qik.com/api/oembed.json', {useYQL: 'json'}),
	new OEmbedProvider("revision3", "video", ["revision3\\.com"], "//revision3.com/api/oembed/"),
	new OEmbedProvider("dotsub", "video", ["dotsub\\.com/view/.+"], "//dotsub.com/services/oembed", {useYQL: 'json'}),
	new OEmbedProvider("clikthrough", "video", ["clikthrough\\.com/theater/video/\\d+"], "//clikthrough.com/services/oembed"),
	new OEmbedProvider("Kinomap", "video", ["kinomap\\.com/.+"], "//www.kinomap.com/oembed"),
	new OEmbedProvider("VHX", "video", ["vhx.tv/.+"], "//vhx.tv/services/oembed.json"),
	new OEmbedProvider("bambuser", "video", ["bambuser.com/.+"], "//api.bambuser.com/oembed/iframe.json"),
	new OEmbedProvider("justin.tv", "video", ["justin.tv/.+"], '//api.justin.tv/api/embed/from_url.json', {useYQL: 'json'}),
	new OEmbedProvider("vine", "video", ["vine.co/v/.*"], null,
		{
			templateRegex: /https?:\/\/w?w?w?.?vine\.co\/v\/([a-zA-Z0-9]*).*/,
			template: '<iframe src="//vine.co/v/$1/embed/postcard" width="600" height="600" allowfullscreen="true" allowscriptaccess="always" scrolling="no" frameborder="0"></iframe>' +
				'<script async src="//platform.vine.co/static/scripts/embed.js" charset="utf-8"></script>',
			nocache: 1
		}),
	new OEmbedProvider("boxofficebuz", "video", ["boxofficebuz\\.com\\/embed/.+"], "//boxofficebuz.com/embed/$1/$2", {templateRegex: [/.*boxofficebuz\.com\/embed\/(\w+)\/([\w*\-*]+)/], embedtag: {tag: 'iframe', width: 480, height: 360 }}),
	new OEmbedProvider("clipsyndicate", "video", ["clipsyndicate\\.com/video/play/.+", "clipsyndicate\\.com/embed/iframe\?.+"], "//eplayer.clipsyndicate.com/embed/iframe?pf_id=1&show_title=0&va_id=$1&windows=1", {templateRegex: [/.*www\.clipsyndicate\.com\/video\/play\/(\w+)\/.*/, /.*eplayer\.clipsyndicate\.com\/embed\/iframe\?.*va_id=(\w+).*.*/], embedtag: {tag: 'iframe', width: 480, height: 360 }, nocache: 1}),
	new OEmbedProvider("coub", "video", ["coub\\.com/.+"], "//www.coub.com/embed/$1?muted=false&autostart=false&originalSize=false&hideTopBar=false&noSiteButtons=false&startWithHD=false", {templateRegex: [/.*coub\.com\/embed\/(\w+)\?*.*/, /.*coub\.com\/view\/(\w+).*/], embedtag: {tag: 'iframe', width: 480, height: 360 }, nocache: 1}),
	new OEmbedProvider("discoverychannel", "video", ["snagplayer\\.video\\.dp\\.discovery\\.com/.+"], "//snagplayer.video.dp.discovery.com/$1/snag-it-player.htm?auto=no", {templateRegex: [/.*snagplayer\.video\.dp\.discovery\/(\w+).*/], embedtag: {tag: 'iframe', width: 480, height: 360 }}),
	new OEmbedProvider("telly", "video", ["telly\\.com/.+"], "//www.telly.com/embed.php?guid=$1&autoplay=0", {templateRegex: [/.*telly\.com\/embed\.php\?guid=(\w+).*/, /.*telly\.com\/(\w+).*/], embedtag: {tag: 'iframe', width: 480, height: 360 }}),
	new OEmbedProvider("minilogs", "video", ["minilogs\\.com/.+"], "//www.minilogs.com/e/$1", {templateRegex: [/.*minilogs\.com\/e\/(\w+).*/, /.*minilogs\.com\/(\w+).*/], embedtag: {tag: 'iframe', width: 480, height: 360 }, nocache: 1}),
	new OEmbedProvider("viddy", "video", ["viddy\\.com/.+"], "//www.viddy.com/embed/video/$1", {templateRegex: [/.*viddy\.com\/embed\/video\/(\.*)/, /.*viddy\.com\/video\/(\.*)/], embedtag: {tag: 'iframe', width: 480, height: 360 }, nocache: 1}),
	new OEmbedProvider("worldstarhiphop", "video", ["worldstarhiphop\\.com\/embed/.+"], "//www.worldstarhiphop.com/embed/$1", {templateRegex: /.*worldstarhiphop\.com\/embed\/(\w+).*/, embedtag: {tag: 'iframe', width: 480, height: 360 }, nocache: 1}),
	new OEmbedProvider("zapiks", "video", ["zapiks\\.fr\/.+"], "//www.zapiks.fr/index.php?action=playerIframe&media_id=$1&autoStart=fals", {templateRegex: /.*zapiks\.fr\/index.php\?[\w\=\&]*media_id=(\w+).*/, embedtag: {tag: 'iframe', width: 480, height: 360 }, nocache: 1}),

	//Audio
	new OEmbedProvider("official.fm", "rich", ["official.fm/.+"], '//official.fm/services/oembed', {useYQL: 'json'}),
	new OEmbedProvider("chirbit", "rich", ["chirb.it/.+"], '//chirb.it/oembed.json', {useYQL: 'json'}),
	new OEmbedProvider("chirbit", "audio", ["chirb\\.it/.+"], "//chirb.it/wp/$1", {templateRegex: [/.*chirb\.it\/wp\/(\w+).*/, /.*chirb\.it\/(\w+).*/], embedtag: {tag: 'iframe', width: 480, height: 360 }, nocache: 1}),
	new OEmbedProvider("Huffduffer", "rich", ["huffduffer.com/[-.\\w@]+/\\d+"], "//huffduffer.com/oembed"),
	new OEmbedProvider("Spotify", "rich", ["open.spotify.com/(track|album|user)/"], "//embed.spotify.com/oembed/"),
	new OEmbedProvider("shoudio", "rich", ["shoudio.com/.+", "shoud.io/.+"], "//shoudio.com/api/oembed"),
	new OEmbedProvider("mixcloud", "rich", ["mixcloud.com/.+"], '//www.mixcloud.com/oembed/', {useYQL: 'json'}),
	new OEmbedProvider("rdio.com", "rich", ["rd.io/.+", "rdio.com"], "//www.rdio.com/api/oembed/"),
	new OEmbedProvider("Soundcloud", "rich", ["soundcloud.com/.+", "snd.sc/.+"], "//soundcloud.com/oembed", {format: 'js'}),
	new OEmbedProvider("bandcamp", "rich", ["bandcamp\\.com/album/.+"], null,
		{
			yql: {
				xpath: "//meta[contains(@content, \\'EmbeddedPlayer\\')]",
				from: 'html',
				datareturn: function (results) {
					return results.meta ? '<iframe width="400" height="100" src="' + results.meta.content + '" allowtransparency="true" frameborder="0"></iframe>' : false;
				}
			}
		}),

	//Photo
	new OEmbedProvider("deviantart", "photo", ["deviantart.com/.+", "fav.me/.+", "deviantart.com/.+"], "//backend.deviantart.com/oembed", {format: 'jsonp'}),
	new OEmbedProvider("skitch", "photo", ["skitch.com/.+"], null,
		{
			yql: {
				xpath: "json",
				from: 'json',
				url: function (externalurl) {
					return '//skitch.com/oembed/?format=json&url=' + externalurl
				},
				datareturn: function (data) {
					return window.oembed.getPhotoCode(data.json.url, data.json);
				}
			}
		}),
	new OEmbedProvider("mobypicture", "photo", ["mobypicture.com/user/.+/view/.+", "moby.to/.+"], "//api.mobypicture.com/oEmbed"),
	new OEmbedProvider("flickr", "photo", ["flickr\\.com/photos/.+"], "//flickr.com/services/oembed", {callbackparameter: 'jsoncallback'}),
	new OEmbedProvider("photobucket", "photo", ["photobucket\\.com/(albums|groups)/.+"], "//photobucket.com/oembed/"),
	new OEmbedProvider("instagram", "photo", ["instagr\\.?am(\\.com)?/.+"], "//api.instagram.com/oembed"),
	//new OEmbedProvider("yfrog", "photo", ["yfrog\\.(com|ru|com\\.tr|it|fr|co\\.il|co\\.uk|com\\.pl|pl|eu|us)/.+"], "//www.yfrog.com/api/oembed",{useYQL:"json"}),
	new OEmbedProvider("SmugMug", "photo", ["smugmug.com/[-.\\w@]+/.+"], "//api.smugmug.com/services/oembed/"),
	new OEmbedProvider("dribbble", "photo", ["dribbble.com/shots/.+"], "//api.dribbble.com/shots/$1?callback=?",
		{
			templateRegex: /.*shots\/([\d]+).*/,
			templateData: function (data) {
				if (!data.image_teaser_url) {
					return false;
				}
				return  '<img src="' + data.image_teaser_url + '"/>';
			}
		}),
	new OEmbedProvider("chart.ly", "photo", ["chart\\.ly/[a-z0-9]{6,8}"], "//chart.ly/uploads/large_$1.png",
		{templateRegex: /.*ly\/([^\/]+).*/, embedtag: {tag: 'img'}, nocache: 1}),
	//new OEmbedProvider("stocktwits.com", "photo", ["stocktwits\\.com/message/.+"], "//charts.stocktwits.com/production/original_$1.png?",
	//  { templateRegex: /.*message\/([^\/]+).*/, embedtag: { tag: 'img'},nocache:1 }),
	new OEmbedProvider("circuitlab", "photo", ["circuitlab.com/circuit/.+"], "//www.circuitlab.com/circuit/$1/screenshot/540x405/",
		{templateRegex: /.*circuit\/([^\/]+).*/, embedtag: {tag: 'img'}, nocache: 1}),
	new OEmbedProvider("23hq", "photo", ["23hq.com/[-.\\w@]+/photo/.+"], "//www.23hq.com/23/oembed", {useYQL: "json"}),
	new OEmbedProvider("img.ly", "photo", ["img\\.ly/.+"], "//img.ly/show/thumb/$1",
		{templateRegex: /.*ly\/([^\/]+).*/, embedtag: {tag: 'img'}, nocache: 1}),
	new OEmbedProvider("twitgoo.com", "photo", ["twitgoo\\.com/.+"], "//twitgoo.com/show/thumb/$1",
		{templateRegex: /.*com\/([^\/]+).*/, embedtag: {tag: 'img'}, nocache: 1}),
	new OEmbedProvider("imgur.com", "photo", ["imgur\\.com/gallery/.+"], "//imgur.com/$1l.jpg",
		{templateRegex: /.*gallery\/([^\/]+).*/, embedtag: {tag: 'img'}, nocache: 1}),
	new OEmbedProvider("visual.ly", "rich", ["visual\\.ly/.+"], null,
		{
			yql: {
				xpath: "//a[@id=\\'gc_article_graphic_image\\']/img",
				from: 'htmlstring'
			}
		}),
	new OEmbedProvider("achewood", "photo", ["achewood\\.com\\/index.php\\?date=.+"], "//www.achewood.com/comic.php?date=$1", {templateRegex: /.*achewood\.com\/index.php\?date=(\w+).*/, embedtag: {tag: 'iframe', width: 480, height: 360 }, nocache: 1}),
	new OEmbedProvider("fotokritik", "photo", ["fotokritik\\.com/.+"], "//www.fotokritik.com/embed/$1", {templateRegex: [/.*fotokritik\.com\/embed\/(\w+).*/, /.*fotokritik\.com\/(\w+).*/], embedtag: {tag: 'iframe', width: 480, height: 360 }, nocache: 1}),
	new OEmbedProvider("giflike", "photo", ["giflike\\.com/.+"], "//www.giflike.com/embed/$1", {templateRegex: [/.*giflike\.com\/embed\/(\w+).*/, /.*giflike\.com\/a\/(\w+).*/], embedtag: {tag: 'iframe', width: 480, height: 360 }, nocache: 1}),

	//Rich
	new OEmbedProvider("twitter", "rich", ["twitter.com/.+"], "//api.twitter.com/1/statuses/oembed.json"),
	new OEmbedProvider("gmep", "rich", ["gmep.imeducate.com/.*", "gmep.org/.*"], "//gmep.org/oembed.json"),
	new OEmbedProvider("urtak", "rich", ["urtak.com/(u|clr)/.+"], "//oembed.urtak.com/1/oembed"),
	new OEmbedProvider("cacoo", "rich", ["cacoo.com/.+"], "//cacoo.com/oembed.json"),
	new OEmbedProvider("dailymile", "rich", ["dailymile.com/people/.*/entries/.*"], "//api.dailymile.com/oembed"),
	new OEmbedProvider("dipity", "rich", ["dipity.com/timeline/.+"], '//www.dipity.com/oembed/timeline/', {useYQL: 'json'}),
	new OEmbedProvider("sketchfab", "rich", ["sketchfab.com/show/.+"], '//sketchfab.com/oembed', {useYQL: 'json'}),
	new OEmbedProvider("speakerdeck", "rich", ["speakerdeck.com/.+"], '//speakerdeck.com/oembed.json', {useYQL: 'json'}),
	new OEmbedProvider("popplet", "rich", ["popplet.com/app/.*"], "//popplet.com/app/Popplet_Alpha.swf?page_id=$1&em=1",
		{
			templateRegex: /.*#\/([^\/]+).*/,
			embedtag: {
				width: 460,
				height: 460
			}
		}),

	new OEmbedProvider("pearltrees", "rich", ["pearltrees.com/.*"], "//cdn.pearltrees.com/s/embed/getApp?",
		{
			templateRegex: /.*N-f=1_(\d+).*N-p=(\d+).*/,
			embedtag: {
				width: 460,
				height: 460,
				flashvars: "lang=en_US&amp;embedId=pt-embed-$1-693&amp;treeId=$1&amp;pearlId=$2&amp;treeTitle=Diagrams%2FVisualization&amp;site=www.pearltrees.com%2FF"
			}
		}),

	new OEmbedProvider("prezi", "rich", ["prezi.com/.*"], "//prezi.com/bin/preziloader.swf?",
		{
			templateRegex: /.*com\/([^\/]+)\/.*/,
			embedtag: {
				width: 550,
				height: 400,
				flashvars: "prezi_id=$1&amp;lock_to_path=0&amp;color=ffffff&amp;autoplay=no&amp;autohide_ctrls=0"
			}
		}),

	new OEmbedProvider("tourwrist", "rich", ["tourwrist.com/tours/.+"], null,
		{
			templateRegex: /.*tours.([\d]+).*/,
			template: function (wm, tourid) {
				setTimeout(function () {
					if (loadEmbeds)loadEmbeds();
				}, 2000);
				return "<div id='" + tourid + "' class='tourwrist-tour-embed direct'></div> <script type='text/javascript' src='//tourwrist.com/tour_embed.js'></script>";
			}
		}),

	new OEmbedProvider("meetup", "rich", ["meetup\\.(com|ps)/.+"], "//api.meetup.com/oembed"),
	new OEmbedProvider("ebay", "rich", ["ebay\\.*"], "//togo.ebay.com/togo/togo.swf?2008013100",
		{
			templateRegex: /.*\/([^\/]+)\/(\d{10,13}).*/,
			embedtag: {
				width: 355,
				height: 300,
				flashvars: "base=//togo.ebay.com/togo/&lang=en-us&mode=normal&itemid=$2&query=$1"
			}
		}),
	new OEmbedProvider("wikipedia", "rich", ["wikipedia.org/wiki/.+"], "//$1.wikipedia.org/w/api.php?action=parse&page=$2&format=json&section=0&callback=?", {
		templateRegex: /.*\/\/([\w]+).*\/wiki\/([^\/]+).*/,
		templateData: function (data) {
			if (!data.parse)
				return false;
			var text = data.parse['text']['*'].replace(/href="\/wiki/g, 'href="//en.wikipedia.org/wiki');
			return  '<div id="content"><h3><a class="nav-link" href="//en.wikipedia.org/wiki/' + data.parse['displaytitle'] + '">' + data.parse['displaytitle'] + '</a></h3>' + text + '</div>';
		}
	}),
	new OEmbedProvider("imdb", "rich", ["imdb.com/title/.+"], "//www.imdbapi.com/?i=$1&callback=?",
		{
			templateRegex: /.*\/title\/([^\/]+).*/,
			templateData: function (data) {
				if (!data.Title)
					return false;
				return  '<div id="content"><h3><a class="nav-link" href="//imdb.com/title/' + data.imdbID + '/">' + data.Title + '</a> (' + data.Year + ')</h3><p>Rating: ' + data.imdbRating + '<br/>Genre: ' + data.Genre + '<br/>Starring: ' + data.Actors + '</p></div>  <div id="view-photo-caption">' + data.Plot + '</div></div>';
			}
		}),
	new OEmbedProvider("livejournal", "rich", ["livejournal.com/"], "//ljpic.seacrow.com/json/$2$4?jsonp=?"
		, {
			templateRegex: /(\/\/(((?!users).)+)\.livejournal\.com|.*users\.livejournal\.com\/([^\/]+)).*/,
			templateData: function (data) {
				if (!data.username)
					return false;
				return  '<div><img src="' + data.image + '" align="left" style="margin-right: 1em;" /><span class="oembedall-ljuser"><a href="//' + data.username + '.livejournal.com/profile"><img src="//www.livejournal.com/img/userinfo.gif" alt="[info]" width="17" height="17" /></a><a href="//' + data.username + '.livejournal.com/">' + data.username + '</a></span><br />' + data.name + '</div>';
			}
		}),
	new OEmbedProvider("circuitbee", "rich", ["circuitbee\\.com/circuit/view/.+"], "//c.circuitbee.com/build/r/schematic-embed.html?id=$1",
		{
			templateRegex: /.*circuit\/view\/(\d+).*/,
			embedtag: {
				tag: 'iframe',
				width: '500',
				height: '350'
			}
		}),

	new OEmbedProvider("googlecalendar", "rich", ["www.google.com/calendar/embed?.+"], "$1",
		{templateRegex: /(.*)/, embedtag: {tag: 'iframe', width: '800', height: '600' }}),
	new OEmbedProvider("jsfiddle", "rich", ["jsfiddle.net/[^/]+/?"], "//jsfiddle.net/$1/embedded/result,js,resources,html,css/?",
		{templateRegex: /.*net\/([^\/]+).*/, embedtag: {tag: 'iframe', width: '100%', height: '300' }}),
	new OEmbedProvider("jsbin", "rich", ["jsbin.com/.+"], "//jsbin.com/$1/?",
		{templateRegex: /.*com\/([^\/]+).*/, embedtag: {tag: 'iframe', width: '100%', height: '300' }}),
	new OEmbedProvider("jotform", "rich", ["form.jotform.co/form/.+"], "$1?",
		{templateRegex: /(.*)/, embedtag: {tag: 'iframe', width: '100%', height: '507' }}),
	new OEmbedProvider("reelapp", "rich", ["reelapp\\.com/.+"], "//www.reelapp.com/$1/embed",
		{templateRegex: /.*com\/(\S{6}).*/, embedtag: {tag: 'iframe', width: '400', height: '338'}}),
	new OEmbedProvider("linkedin", "rich", ["linkedin.com/pub/.+"], "//www.linkedin.com/cws/member/public_profile?public_profile_url=$1&format=inline&isFramed=true",
		{templateRegex: /(.*)/, embedtag: {tag: 'iframe', width: '368px', height: 'auto'}}),
	new OEmbedProvider("timetoast", "rich", ["timetoast.com/timelines/[0-9]+"], "//www.timetoast.com/flash/TimelineViewer.swf?passedTimelines=$1",
		{templateRegex: /.*timelines\/([0-9]*)/, embedtag: { width: 550, height: 400}, nocache: 1}),
	new OEmbedProvider("pastebin", "rich", ["pastebin\\.com/[\\S]{8}"], "//pastebin.com/embed_iframe.php?i=$1",
		{templateRegex: /.*\/(\S{8}).*/, embedtag: {tag: 'iframe', width: '100%', height: 'auto'}}),
	new OEmbedProvider("mixlr", "rich", ["mixlr.com/.+"], "//mixlr.com/embed/$1?autoplay=ae",
		{templateRegex: /.*com\/([^\/]+).*/, embedtag: {tag: 'iframe', width: '100%', height: 'auto' }}),
	new OEmbedProvider("pastie", "rich", ["pastie\\.org/pastes/.+"], null, {yql: {xpath: '//pre[@class="textmate-source"]'}}),
	new OEmbedProvider("github", "rich", ["gist.github.com/.+"], "//github.com/api/oembed"),
	new OEmbedProvider("github", "rich", ["github.com/[-.\\w@]+/[-.\\w@]+"], "//api.github.com/repos/$1/$2?callback=?"
		, {templateRegex: /.*\/([^\/]+)\/([^\/]+).*/,
			templateData: function (data) {
				if (!data.data.html_url)return false;
				return  '<div class="oembedall-githubrepos"><ul class="oembedall-repo-stats"><li>' + data.data.language + '</li><li class="oembedall-watchers"><a title="Watchers" href="' + data.data.html_url + '/watchers">&#x25c9; ' + data.data.watchers + '</a></li>'
					+ '<li class="oembedall-forks"><a title="Forks" href="' + data.data.html_url + '/network">&#x0265; ' + data.data.forks + '</a></li></ul><h3><a href="' + data.data.html_url + '">' + data.data.name + '</a></h3><div class="oembedall-body"><p class="oembedall-description">' + data.data.description + '</p>'
					+ '<p class="oembedall-updated-at">Last updated: ' + data.data.pushed_at + '</p></div></div>';
			}
		}),
	new OEmbedProvider("facebook", "rich", ["facebook.com"], null
		, {templateRegex: /.*\/([^\/]+)\/([^\/]+).*/,
			template: function (url) {
				// adding script directly to DOM to make sure that it is loaded correctly.
				if (!window.oembed.facebokScriptHasBeenAdded) {
					document.body.appendChild(domify('<div id="fb-root"></div>'));
					var script = document.createElement('script');
					script.type = 'text/javascript';
					script.text = '(function(d, s, id) {var js, fjs = d.getElementsByTagName(s)[0];if (d.getElementById(id)) return;js = d.createElement(s); js.id = id;js.src = "//connect.facebook.net/en_US/sdk.js#xfbml=1&version=v2.0";fjs.parentNode.insertBefore(js, fjs);}(document, "script", "facebook-jssdk"));';
					document.body.appendChild(script);
					window.oembed.facebokScriptHasBeenAdded = true;
				}

				// returning template with url of facebook post.
				return '<div class="fb-post" data-href="' + url + '" data-width="520"><div class="fb-xfbml-parse-ignore"><a href="' + url + '"></div></div>';

			}
		}),
	/*
	 // Saving old implementation of Facebook in case we will need it as example in the future.
	 new OEmbedProvider("facebook", "rich", ["facebook.com/(people/[^\\/]+/\\d+|[^\\/]+$)"], "//graph.facebook.com/$2$3/?callback=?"
	 ,{templateRegex:/.*facebook.com\/(people\/[^\/]+\/(\d+).*|([^\/]+$))/,
	 templateData : function(data){ if(!data.id)return false;
	 var out =  '<div class="oembedall-facebook1"><div class="oembedall-facebook2"><a href="//www.facebook.com/">facebook</a> ';
	 if(data.from) out += '<a href="//www.facebook.com/'+data.from.id+'">'+data.from.name+'</a>';
	 else if(data.link) out += '<a href="'+data.link+'">'+data.name+'</a>';
	 else if(data.username) out += '<a href="//www.facebook.com/'+data.username+'">'+data.name+'</a>';
	 else out += '<a href="//www.facebook.com/'+data.id+'">'+data.name+'</a>';
	 out += '</div><div class="oembedall-facebookBody"><div class="contents">';
	 if(data.picture) out += '<a href="'+data.link+'"><img src="'+data.picture+'"></a>';
	 else out += '<img src="//graph.facebook.com/'+data.id+'/picture">';
	 if(data.from) out += '<a href="'+data.link+'">'+data.name+'</a>';
	 if(data.founded) out += 'Founded: <strong>'+data.founded+'</strong><br>';
	 if(data.category) out += 'Category: <strong>'+data.category+'</strong><br>';
	 if(data.website) out += 'Website: <strong><a href="'+data.website+'">'+data.website+'</a></strong><br>';
	 if(data.gender) out += 'Gender: <strong>'+data.gender+'</strong><br>';
	 if(data.description) out += data.description + '<br>';
	 out += '</div></div>';
	 return out;
	 }
	 }),
	 */
	new OEmbedProvider("stackoverflow", "rich", ["stackoverflow.com/questions/[\\d]+"], "//api.stackoverflow.com/1.1/questions/$1?body=true&jsonp=?"
		, {templateRegex: /.*questions\/([\d]+).*/,
			templateData: function (data) {
				if (!data.questions)
					return false;
				var q = data.questions[0];
				var body = domify(q.body).innerHTML;
				var out = '<div class="oembedall-stoqembed"><div class="oembedall-statscontainer"><div class="oembedall-statsarrow"></div><div class="oembedall-stats"><div class="oembedall-vote"><div class="oembedall-votes">'
					+ '<span class="oembedall-vote-count-post"><strong>' + (q.up_vote_count - q.down_vote_count) + '</strong></span><div class="oembedall-viewcount">vote(s)</div></div>'
					+ '</div><div class="oembedall-status"><strong>' + q.answer_count + '</strong>answer</div></div><div class="oembedall-views">' + q.view_count + ' view(s)</div></div>'
					+ '<div class="oembedall-summary"><h3><a class="oembedall-question-hyperlink" href="//stackoverflow.com/questions/' + q.question_id + '/">' + q.title + '</a></h3>'
					+ '<div class="oembedall-excerpt">' + body.substring(0, 100) + '...</div><div class="oembedall-tags">';
				for (i in q.tags) {
					out += '<a title="" class="oembedall-post-tag" href="//stackoverflow.com/questions/tagged/' + q.tags[i] + '">' + q.tags[i] + '</a>';
				}

				out += '</div><div class="oembedall-fr"><div class="oembedall-user-info"><div class="oembedall-user-gravatar32"><a href="//stackoverflow.com/users/' + q.owner.user_id + '/' + q.owner.display_name + '">'
					+ '<img width="32" height="32" alt="" src="//www.gravatar.com/avatar/' + q.owner.email_hash + '?s=32&amp;d=identicon&amp;r=PG"></a></div><div class="oembedall-user-details">'
					+ '<a href="//stackoverflow.com/users/' + q.owner.user_id + '/' + q.owner.display_name + '">' + q.owner.display_name + '</a><br><span title="reputation score" class="oembedall-reputation-score">'
					+ q.owner.reputation + '</span></div></div></div></div></div>';
				return out;
			}
		}),
	new OEmbedProvider("wordpress", "rich", ["wordpress\\.com/.+", "blogs\\.cnn\\.com/.+", "techcrunch\\.com/.+", "wp\\.me/.+"], "//public-api.wordpress.com/oembed/1.0/?for=jquery-oembed-all"),
	new OEmbedProvider("screenr", "rich", ["screenr\.com"], "//www.screenr.com/embed/$1",
		{templateRegex: /.*\/([^\/]+).*/, embedtag: {tag: 'iframe', width: '650', height: 396}}) ,
	new OEmbedProvider("gigpans", "rich", ["gigapan\\.org/[-.\\w@]+/\\d+"], "//gigapan.org/gigapans/$1/options/nosnapshots/iframe/flash.html",
		{templateRegex: /.*\/(\d+)\/?.*/, embedtag: {tag: 'iframe', width: '100%', height: 400 }}),
	new OEmbedProvider("scribd", "rich", ["scribd\\.com/.+"], "//www.scribd.com/embeds/$1/content?start_page=1&view_mode=list",
		{templateRegex: /.*doc\/([^\/]+).*/, embedtag: {tag: 'iframe', width: '100%', height: 600}}),
	new OEmbedProvider("kickstarter", "rich", ["kickstarter\\.com/projects/.+"], "$1/widget/card.html",
		{templateRegex: /([^\?]+).*/, embedtag: {tag: 'iframe', width: '220', height: 380}}),
	new OEmbedProvider("amazon", "rich", ["amzn.com/B+", "amazon.com.*/(B\\S+)($|\\/.*)"], "//rcm.amazon.com/e/cm?t=_APIKEY_&o=1&p=8&l=as1&asins=$1&ref=qf_br_asin_til&fc1=000000&IS2=1&lt1=_blank&m=amazon&lc1=0000FF&bc1=000000&bg1=FFFFFF&f=ifr",
		{
			apikey: true,
			templateRegex: /.*\/(B[0-9A-Z]+)($|\/.*)/,
			embedtag: {
				tag: 'iframe',
				width: '120px',
				height: '240px'}
		}),
	new OEmbedProvider("slideshare", "rich", ["slideshare\.net"], "//www.slideshare.net/api/oembed/2", {format: 'jsonp'}),
	new OEmbedProvider("roomsharejp", "rich", ["roomshare\\.jp/(en/)?post/.*"], "//roomshare.jp/oembed.json"),
	new OEmbedProvider("lanyard", "rich", ["lanyrd.com/\\d+/.+"], null,
		{
			yql: {
				xpath: '(//div[@class="primary"])[1]',
				from: 'htmlstring',
				datareturn: function (results) {
					if (!results.result)
						return false;
					return '<div class="oembedall-lanyard">' + results.result + '</div>';
				}
			}
		}),
	new OEmbedProvider("asciiartfarts", "rich", ["asciiartfarts.com/\\d+.html"], null,
		{
			yql: {
				xpath: '//pre/font',
				from: 'htmlstring',
				datareturn: function (results) {
					if (!results.result)
						return false;
					return '<pre style="background-color:#000;">' + results.result + '</div>';
				}
			}
		}),
	new OEmbedProvider("coveritlive", "rich", ["coveritlive.com/"], null, {
		templateRegex: /(.*)/,
		template: '<iframe src="$1" allowtransparency="true" scrolling="no" width="615px" frameborder="0" height="625px"></iframe>'}),
	new OEmbedProvider("polldaddy", "rich", ["polldaddy.com/"], null, {
		templateRegex: /(?:https?:\/\/w?w?w?.?polldaddy.com\/poll\/)([0-9]*)\//,
		template: '<script async type="text/javascript" charset="utf-8" src="//static.polldaddy.com/p/$1.js"></script>',
		nocache: 1
	}),
	new OEmbedProvider("360io", "rich", ["360\\.io/.+"], "//360.io/$1", {templateRegex: /.*360\.io\/(\w+).*/, embedtag: {tag: 'iframe', width: 480, height: 360 }, nocache: 1}),
	new OEmbedProvider("bubbli", "rich", ["on\\.bubb\\.li/.+"], "//on.bubb.li/$1", {templateRegex: /.*on\.bubb\.li\/(\w+).*/, embedtag: {tag: 'iframe', width: 480, height: 360}, nocache: 1 }),
	new OEmbedProvider("cloudup", "rich", ["cloudup\\.com/.+"], "//cloudup.com/$1?chromeless", {templateRegex: [/.*cloudup\.com\/(\w+).*/], embedtag: {tag: 'iframe', width: 480, height: 360 }}),
	new OEmbedProvider("codepen", "rich", ["codepen.io/.+"], "//codepen.io/$1/embed/$2", {templateRegex: [/.*io\/(\w+)\/pen\/(\w+).*/, /.*io\/(\w+)\/full\/(\w+).*/], embedtag: {tag: 'iframe', width: '100%', height: '300'}, nocache: 1 }),
	new OEmbedProvider("googleviews", "rich", ["(.*maps\\.google\\.com\\/maps\\?).+(output=svembed).+(cbp=(.*)).*"], "//maps.google.com/maps?layer=c&panoid=$3&ie=UTF8&source=embed&output=svembed&cbp=$5", {templateRegex: /(.*maps\.google\.com\/maps\?).+(panoid=(\w+)&).*(cbp=(.*)).*/, embedtag: {tag: 'iframe', width: 480, height: 360}, nocache: 1 }),
	new OEmbedProvider("googlemaps", "rich", ["google\\.com\/maps\/place/.+"], "//maps.google.com/maps?t=m&q=$1&output=embed", {templateRegex: /.*google\.com\/maps\/place\/([\w\+]*)\/.*/, embedtag: {tag: 'iframe', width: 480, height: 360 }, nocache: 1}),
	new OEmbedProvider("imajize", "rich", ["embed\\.imajize\\.com/.+"], "//embed.imajize.com/$1", {templateRegex: /.*embed\.imajize\.com\/(.*)/, embedtag: {tag: 'iframe', width: 480, height: 360 }, nocache: 1}),
	new OEmbedProvider("mapjam", "rich", ["mapjam\\.com/.+"], "//www.mapjam.com/$1", {templateRegex: /.*mapjam\.com\/(.*)/, embedtag: {tag: 'iframe', width: 480, height: 360 }, nocache: 1}),
	new OEmbedProvider("polar", "rich", ["polarb\\.com/.+"], "//assets-polarb-com.a.ssl.fastly.net/api/v4/publishers/unknown/embedded_polls/iframe?poll_id=$1", {templateRegex: /.*polarb\.com\/polls\/(\w+).*/, embedtag: {tag: 'iframe', width: 480, height: 360 }, nocache: 1}),
	new OEmbedProvider("ponga", "rich", ["ponga\\.com/.+"], "//www.ponga.com/embedded?id=$1", {templateRegex: [/.*ponga\.com\/embedded\?id=(\w+).*/, /.*ponga\.com\/(\w+).*/], embedtag: {tag: 'iframe', width: 480, height: 360 }, nocache: 1}),

	//Use Open Graph Where applicable
	new OEmbedProvider("opengraph", "rich", [".*"], null,
		{
			yql: {
				xpath: "//meta|//title|//link",
				from: 'html',
				datareturn: function (results) {
					if (!results['og:title'] && results['title'] && results['description'])
						results['og:title'] = results['title'];

					if (!results['og:title'] && !results['title'])
						return false;

					var code = domify('<p></p>');
					if (results['og:video']) {
						var embed = domify('<embed src="' + results['og:video'] + '"/>');
						embed.setAttribute('type', results['og:video:type'] || "application/x-shockwave-flash");
						css(embed, 'max-height', settings.maxHeight || 'auto');
						css(embed, 'max-width', settings.maxWidth || 'auto');
						if (results['og:video:width'])
							embed.setAttribute('width', results['og:video:width']);
						if (results['og:video:height'])
							embed.setAttribute('height', results['og:video:height']);
						code.append(embed);
					} else if (results['og:image']) {
						var img = domify('<img src="' + results['og:image'] + '">');
						css(img, 'max-height', settings.maxHeight || 'auto');
						css(img, 'max-width', settings.maxWidth || 'auto');
						if (results['og:image:width'])
							img.setAttribute('width', results['og:image:width']);
						if (results['og:image:height'])
							img.setAttribute('height', results['og:image:height']);
						code.append(img);
					}

					if (results['og:title'])
						code.append('<b>' + results['og:title'] + '</b><br/>');

					if (results['og:description'])
						code.append(results['og:description'] + '<br/>');
					else if (results['description'])
						code.append(results['description'] + '<br/>');

					return code;
				}
			}
		}
	)

];

module.exports = providers;
},{"./provider":2}],4:[function(require,module,exports){
module.exports=[
	"0rz.tw",
	"1link.in",
	"1url.com",
	"2.gp",
	"2big.at",
	"2tu.us",
	"3.ly",
	"307.to",
	"4ms.me",
	"4sq.com",
	"4url.cc",
	"6url.com",
	"7.ly",
	"a.gg",
	"a.nf",
	"aa.cx",
	"abcurl.net",
	"ad.vu",
	"adf.ly",
	"adjix.com",
	"afx.cc",
	"all.fuseurl.com",
	"alturl.com",
	"amzn.to",
	"ar.gy",
	"arst.ch",
	"atu.ca",
	"azc.cc",
	"b23.ru",
	"b2l.me",
	"bacn.me",
	"bcool.bz",
	"binged.it",
	"bit.ly",
	"bizj.us",
	"bloat.me",
	"bravo.ly",
	"bsa.ly",
	"budurl.com",
	"canurl.com",
	"chilp.it",
	"chzb.gr",
	"cl.lk",
	"cl.ly",
	"clck.ru",
	"cli.gs",
	"cliccami.info",
	"clickthru.ca",
	"clop.in",
	"conta.cc",
	"cort.as",
	"cot.ag",
	"crks.me",
	"ctvr.us",
	"cutt.us",
	"dai.ly",
	"decenturl.com",
	"dfl8.me",
	"digbig.com",
	"http:\/\/digg\\.com\/[^\/]+$",
	"disq.us",
	"dld.bz",
	"dlvr.it",
	"do.my",
	"doiop.com",
	"dopen.us",
	"easyuri.com",
	"easyurl.net",
	"eepurl.com",
	"eweri.com",
	"fa.by",
	"fav.me",
	"fb.me",
	"fbshare.me",
	"ff.im",
	"fff.to",
	"fire.to",
	"firsturl.de",
	"firsturl.net",
	"flic.kr",
	"flq.us",
	"fly2.ws",
	"fon.gs",
	"freak.to",
	"fuseurl.com",
	"fuzzy.to",
	"fwd4.me",
	"fwib.net",
	"g.ro.lt",
	"gizmo.do",
	"gl.am",
	"go.9nl.com",
	"go.ign.com",
	"go.usa.gov",
	"goo.gl",
	"goshrink.com",
	"gurl.es",
	"hex.io",
	"hiderefer.com",
	"hmm.ph",
	"href.in",
	"hsblinks.com",
	"htxt.it",
	"huff.to",
	"hulu.com",
	"hurl.me",
	"hurl.ws",
	"icanhaz.com",
	"idek.net",
	"ilix.in",
	"is.gd",
	"its.my",
	"ix.lt",
	"j.mp",
	"jijr.com",
	"kl.am",
	"klck.me",
	"korta.nu",
	"krunchd.com",
	"l9k.net",
	"lat.ms",
	"liip.to",
	"liltext.com",
	"linkbee.com",
	"linkbun.ch",
	"liurl.cn",
	"ln-s.net",
	"ln-s.ru",
	"lnk.gd",
	"lnk.ms",
	"lnkd.in",
	"lnkurl.com",
	"lru.jp",
	"lt.tl",
	"lurl.no",
	"macte.ch",
	"mash.to",
	"merky.de",
	"migre.me",
	"miniurl.com",
	"minurl.fr",
	"mke.me",
	"moby.to",
	"moourl.com",
	"mrte.ch",
	"myloc.me",
	"myurl.in",
	"n.pr",
	"nbc.co",
	"nblo.gs",
	"nn.nf",
	"not.my",
	"notlong.com",
	"nsfw.in",
	"nutshellurl.com",
	"nxy.in",
	"nyti.ms",
	"o-x.fr",
	"oc1.us",
	"om.ly",
	"omf.gd",
	"omoikane.net",
	"on.cnn.com",
	"on.mktw.net",
	"onforb.es",
	"orz.se",
	"ow.ly",
	"ping.fm",
	"pli.gs",
	"pnt.me",
	"politi.co",
	"post.ly",
	"pp.gg",
	"profile.to",
	"ptiturl.com",
	"pub.vitrue.com",
	"qlnk.net",
	"qte.me",
	"qu.tc",
	"qy.fi",
	"r.ebay.com",
	"r.im",
	"rb6.me",
	"read.bi",
	"readthis.ca",
	"reallytinyurl.com",
	"redir.ec",
	"redirects.ca",
	"redirx.com",
	"retwt.me",
	"ri.ms",
	"rickroll.it",
	"riz.gd",
	"rt.nu",
	"ru.ly",
	"rubyurl.com",
	"rurl.org",
	"rww.tw",
	"s4c.in",
	"s7y.us",
	"safe.mn",
	"sameurl.com",
	"sdut.us",
	"shar.es",
	"shink.de",
	"shorl.com",
	"short.ie",
	"short.to",
	"shortlinks.co.uk",
	"shorturl.com",
	"shout.to",
	"show.my",
	"shrinkify.com",
	"shrinkr.com",
	"shrt.fr",
	"shrt.st",
	"shrten.com",
	"shrunkin.com",
	"simurl.com",
	"slate.me",
	"smallr.com",
	"smsh.me",
	"smurl.name",
	"sn.im",
	"snipr.com",
	"snipurl.com",
	"snurl.com",
	"sp2.ro",
	"spedr.com",
	"srnk.net",
	"srs.li",
	"starturl.com",
	"stks.co",
	"su.pr",
	"surl.co.uk",
	"surl.hu",
	"t.cn",
	"t.co",
	"t.lh.com",
	"ta.gd",
	"tbd.ly",
	"tcrn.ch",
	"tgr.me",
	"tgr.ph",
	"tighturl.com",
	"tiniuri.com",
	"tiny.cc",
	"tiny.ly",
	"tiny.pl",
	"tinylink.in",
	"tinyuri.ca",
	"tinyurl.com",
	"tk.",
	"tl.gd",
	"tmi.me",
	"tnij.org",
	"tnw.to",
	"tny.com",
	"to.ly",
	"togoto.us",
	"totc.us",
	"toysr.us",
	"tpm.ly",
	"tr.im",
	"tra.kz",
	"trunc.it",
	"twhub.com",
	"twirl.at",
	"twitclicks.com",
	"twitterurl.net",
	"twitterurl.org",
	"twiturl.de",
	"twurl.cc",
	"twurl.nl",
	"u.mavrev.com",
	"u.nu",
	"u76.org",
	"ub0.cc",
	"ulu.lu",
	"updating.me",
	"ur1.ca",
	"url.az",
	"url.co.uk",
	"url.ie",
	"url360.me",
	"url4.eu",
	"urlborg.com",
	"urlbrief.com",
	"urlcover.com",
	"urlcut.com",
	"urlenco.de",
	"urli.nl",
	"urls.im",
	"urlshorteningservicefortwitter.com",
	"urlx.ie",
	"urlzen.com",
	"usat.ly",
	"use.my",
	"vb.ly",
	"vevo.ly",
	"vgn.am",
	"vl.am",
	"vm.lc",
	"w55.de",
	"wapo.st",
	"wapurl.co.uk",
	"wipi.es",
	"wp.me",
	"x.vu",
	"xr.com",
	"xrl.in",
	"xrl.us",
	"xurl.es",
	"xurl.jp",
	"y.ahoo.it",
	"yatuc.com",
	"ye.pe",
	"yep.it",
	"yfrog.com",
	"yhoo.it",
	"yiyd.com",
	"youtu.be",
	"yuarel.com",
	"z0p.de",
	"zi.ma",
	"zi.mu",
	"zipmyurl.com",
	"zud.me",
	"zurl.ws",
	"zz.gd",
	"zzang.kr",
	"›.ws",
	"✩.ws",
	"✿.ws",
	"❥.ws",
	"➔.ws",
	"➞.ws",
	"➡.ws",
	"➨.ws",
	"➯.ws",
	"➹.ws",
	"➽.ws"
]
},{}],5:[function(require,module,exports){
var type
try {
  type = require('type-of')
} catch (ex) {
  //hide from browserify
  var r = require
  type = r('type')
}

var jsonpID = 0,
    document = window.document,
    key,
    name,
    rscript = /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    scriptTypeRE = /^(?:text|application)\/javascript/i,
    xmlTypeRE = /^(?:text|application)\/xml/i,
    jsonType = 'application/json',
    htmlType = 'text/html',
    blankRE = /^\s*$/

var ajax = module.exports = function(options){
  var settings = extend({}, options || {})
  for (key in ajax.settings) if (settings[key] === undefined) settings[key] = ajax.settings[key]

  ajaxStart(settings)

  if (!settings.crossDomain) settings.crossDomain = /^([\w-]+:)?\/\/([^\/]+)/.test(settings.url) &&
    RegExp.$2 != window.location.host

  var dataType = settings.dataType, hasPlaceholder = /=\?/.test(settings.url)
  if (dataType == 'jsonp' || hasPlaceholder) {
    if (!hasPlaceholder) settings.url = appendQuery(settings.url, 'callback=?')
    return ajax.JSONP(settings)
  }

  if (!settings.url) settings.url = window.location.toString()
  serializeData(settings)

  var mime = settings.accepts[dataType],
      baseHeaders = { },
      protocol = /^([\w-]+:)\/\//.test(settings.url) ? RegExp.$1 : window.location.protocol,
      xhr = ajax.settings.xhr(), abortTimeout

  if (!settings.crossDomain) baseHeaders['X-Requested-With'] = 'XMLHttpRequest'
  if (mime) {
    baseHeaders['Accept'] = mime
    if (mime.indexOf(',') > -1) mime = mime.split(',', 2)[0]
    xhr.overrideMimeType && xhr.overrideMimeType(mime)
  }
  if (settings.contentType || (settings.data && settings.type.toUpperCase() != 'GET'))
    baseHeaders['Content-Type'] = (settings.contentType || 'application/x-www-form-urlencoded')
  settings.headers = extend(baseHeaders, settings.headers || {})

  xhr.onreadystatechange = function(){
    if (xhr.readyState == 4) {
      clearTimeout(abortTimeout)
      var result, error = false
      if ((xhr.status >= 200 && xhr.status < 300) || xhr.status == 304 || (xhr.status == 0 && protocol == 'file:')) {
        dataType = dataType || mimeToDataType(xhr.getResponseHeader('content-type'))
        result = xhr.responseText

        try {
          if (dataType == 'script')    (1,eval)(result)
          else if (dataType == 'xml')  result = xhr.responseXML
          else if (dataType == 'json') result = blankRE.test(result) ? null : JSON.parse(result)
        } catch (e) { error = e }

        if (error) ajaxError(error, 'parsererror', xhr, settings)
        else ajaxSuccess(result, xhr, settings)
      } else {
        ajaxError(null, 'error', xhr, settings)
      }
    }
  }

  var async = 'async' in settings ? settings.async : true
  xhr.open(settings.type, settings.url, async)

  for (name in settings.headers) xhr.setRequestHeader(name, settings.headers[name])

  if (ajaxBeforeSend(xhr, settings) === false) {
    xhr.abort()
    return false
  }

  if (settings.timeout > 0) abortTimeout = setTimeout(function(){
      xhr.onreadystatechange = empty
      xhr.abort()
      ajaxError(null, 'timeout', xhr, settings)
    }, settings.timeout)

  // avoid sending empty string (#319)
  xhr.send(settings.data ? settings.data : null)
  return xhr
}


// trigger a custom event and return false if it was cancelled
function triggerAndReturn(context, eventName, data) {
  //todo: Fire off some events
  //var event = $.Event(eventName)
  //$(context).trigger(event, data)
  return true;//!event.defaultPrevented
}

// trigger an Ajax "global" event
function triggerGlobal(settings, context, eventName, data) {
  if (settings.global) return triggerAndReturn(context || document, eventName, data)
}

// Number of active Ajax requests
ajax.active = 0

function ajaxStart(settings) {
  if (settings.global && ajax.active++ === 0) triggerGlobal(settings, null, 'ajaxStart')
}
function ajaxStop(settings) {
  if (settings.global && !(--ajax.active)) triggerGlobal(settings, null, 'ajaxStop')
}

// triggers an extra global event "ajaxBeforeSend" that's like "ajaxSend" but cancelable
function ajaxBeforeSend(xhr, settings) {
  var context = settings.context
  if (settings.beforeSend.call(context, xhr, settings) === false ||
      triggerGlobal(settings, context, 'ajaxBeforeSend', [xhr, settings]) === false)
    return false

  triggerGlobal(settings, context, 'ajaxSend', [xhr, settings])
}
function ajaxSuccess(data, xhr, settings) {
  var context = settings.context, status = 'success'
  settings.success.call(context, data, status, xhr)
  triggerGlobal(settings, context, 'ajaxSuccess', [xhr, settings, data])
  ajaxComplete(status, xhr, settings)
}
// type: "timeout", "error", "abort", "parsererror"
function ajaxError(error, type, xhr, settings) {
  var context = settings.context
  settings.error.call(context, xhr, type, error)
  triggerGlobal(settings, context, 'ajaxError', [xhr, settings, error])
  ajaxComplete(type, xhr, settings)
}
// status: "success", "notmodified", "error", "timeout", "abort", "parsererror"
function ajaxComplete(status, xhr, settings) {
  var context = settings.context
  settings.complete.call(context, xhr, status)
  triggerGlobal(settings, context, 'ajaxComplete', [xhr, settings])
  ajaxStop(settings)
}

// Empty function, used as default callback
function empty() {}

ajax.JSONP = function(options){
  if (!('type' in options)) return ajax(options)

  var callbackName = 'jsonp' + (++jsonpID),
    script = document.createElement('script'),
    abort = function(){
      //todo: remove script
      //$(script).remove()
      if (callbackName in window) window[callbackName] = empty
      ajaxComplete('abort', xhr, options)
    },
    xhr = { abort: abort }, abortTimeout,
    head = document.getElementsByTagName("head")[0]
      || document.documentElement

  if (options.error) script.onerror = function() {
    xhr.abort()
    options.error()
  }

  window[callbackName] = function(data){
    clearTimeout(abortTimeout)
      //todo: remove script
      //$(script).remove()
    delete window[callbackName]
    ajaxSuccess(data, xhr, options)
  }

  serializeData(options)
  script.src = options.url.replace(/=\?/, '=' + callbackName)

  // Use insertBefore instead of appendChild to circumvent an IE6 bug.
  // This arises when a base node is used (see jQuery bugs #2709 and #4378).
  head.insertBefore(script, head.firstChild);

  if (options.timeout > 0) abortTimeout = setTimeout(function(){
      xhr.abort()
      ajaxComplete('timeout', xhr, options)
    }, options.timeout)

  return xhr
}

ajax.settings = {
  // Default type of request
  type: 'GET',
  // Callback that is executed before request
  beforeSend: empty,
  // Callback that is executed if the request succeeds
  success: empty,
  // Callback that is executed the the server drops error
  error: empty,
  // Callback that is executed on request complete (both: error and success)
  complete: empty,
  // The context for the callbacks
  context: null,
  // Whether to trigger "global" Ajax events
  global: true,
  // Transport
  xhr: function () {
    return new window.XMLHttpRequest()
  },
  // MIME types mapping
  accepts: {
    script: 'text/javascript, application/javascript',
    json:   jsonType,
    xml:    'application/xml, text/xml',
    html:   htmlType,
    text:   'text/plain'
  },
  // Whether the request is to another domain
  crossDomain: false,
  // Default timeout
  timeout: 0
}

function mimeToDataType(mime) {
  return mime && ( mime == htmlType ? 'html' :
    mime == jsonType ? 'json' :
    scriptTypeRE.test(mime) ? 'script' :
    xmlTypeRE.test(mime) && 'xml' ) || 'text'
}

function appendQuery(url, query) {
  return (url + '&' + query).replace(/[&?]{1,2}/, '?')
}

// serialize payload and append it to the URL for GET requests
function serializeData(options) {
  if (type(options.data) === 'object') options.data = param(options.data)
  if (options.data && (!options.type || options.type.toUpperCase() == 'GET'))
    options.url = appendQuery(options.url, options.data)
}

ajax.get = function(url, success){ return ajax({ url: url, success: success }) }

ajax.post = function(url, data, success, dataType){
  if (type(data) === 'function') dataType = dataType || success, success = data, data = null
  return ajax({ type: 'POST', url: url, data: data, success: success, dataType: dataType })
}

ajax.getJSON = function(url, success){
  return ajax({ url: url, success: success, dataType: 'json' })
}

var escape = encodeURIComponent

function serialize(params, obj, traditional, scope){
  var array = type(obj) === 'array';
  for (var key in obj) {
    var value = obj[key];

    if (scope) key = traditional ? scope : scope + '[' + (array ? '' : key) + ']'
    // handle data in serializeArray() format
    if (!scope && array) params.add(value.name, value.value)
    // recurse into nested objects
    else if (traditional ? (type(value) === 'array') : (type(value) === 'object'))
      serialize(params, value, traditional, key)
    else params.add(key, value)
  }
}

function param(obj, traditional){
  var params = []
  params.add = function(k, v){ this.push(escape(k) + '=' + escape(v)) }
  serialize(params, obj, traditional)
  return params.join('&').replace('%20', '+')
}

function extend(target) {
  var slice = Array.prototype.slice;
  slice.call(arguments, 1).forEach(function(source) {
    for (key in source)
      if (source[key] !== undefined)
        target[key] = source[key]
  })
  return target
}
},{"type-of":8}],6:[function(require,module,exports){

/**
 * Expose `parse`.
 */

module.exports = parse;

/**
 * Tests for browser support.
 */

var innerHTMLBug = false;
var bugTestDiv;
if (typeof document !== 'undefined') {
  bugTestDiv = document.createElement('div');
  // Setup
  bugTestDiv.innerHTML = '  <link/><table></table><a href="/a">a</a><input type="checkbox"/>';
  // Make sure that link elements get serialized correctly by innerHTML
  // This requires a wrapper element in IE
  innerHTMLBug = !bugTestDiv.getElementsByTagName('link').length;
  bugTestDiv = undefined;
}

/**
 * Wrap map from jquery.
 */

var map = {
  legend: [1, '<fieldset>', '</fieldset>'],
  tr: [2, '<table><tbody>', '</tbody></table>'],
  col: [2, '<table><tbody></tbody><colgroup>', '</colgroup></table>'],
  // for script/link/style tags to work in IE6-8, you have to wrap
  // in a div with a non-whitespace character in front, ha!
  _default: innerHTMLBug ? [1, 'X<div>', '</div>'] : [0, '', '']
};

map.td =
map.th = [3, '<table><tbody><tr>', '</tr></tbody></table>'];

map.option =
map.optgroup = [1, '<select multiple="multiple">', '</select>'];

map.thead =
map.tbody =
map.colgroup =
map.caption =
map.tfoot = [1, '<table>', '</table>'];

map.polyline =
map.ellipse =
map.polygon =
map.circle =
map.text =
map.line =
map.path =
map.rect =
map.g = [1, '<svg xmlns="http://www.w3.org/2000/svg" version="1.1">','</svg>'];

/**
 * Parse `html` and return a DOM Node instance, which could be a TextNode,
 * HTML DOM Node of some kind (<div> for example), or a DocumentFragment
 * instance, depending on the contents of the `html` string.
 *
 * @param {String} html - HTML string to "domify"
 * @param {Document} doc - The `document` instance to create the Node for
 * @return {DOMNode} the TextNode, DOM Node, or DocumentFragment instance
 * @api private
 */

function parse(html, doc) {
  if ('string' != typeof html) throw new TypeError('String expected');

  // default to the global `document` object
  if (!doc) doc = document;

  // tag name
  var m = /<([\w:]+)/.exec(html);
  if (!m) return doc.createTextNode(html);

  html = html.replace(/^\s+|\s+$/g, ''); // Remove leading/trailing whitespace

  var tag = m[1];

  // body support
  if (tag == 'body') {
    var el = doc.createElement('html');
    el.innerHTML = html;
    return el.removeChild(el.lastChild);
  }

  // wrap map
  var wrap = map[tag] || map._default;
  var depth = wrap[0];
  var prefix = wrap[1];
  var suffix = wrap[2];
  var el = doc.createElement('div');
  el.innerHTML = prefix + html + suffix;
  while (depth--) el = el.lastChild;

  // one element
  if (el.firstChild == el.lastChild) {
    return el.removeChild(el.firstChild);
  }

  // several elements
  var fragment = doc.createDocumentFragment();
  while (el.firstChild) {
    fragment.appendChild(el.removeChild(el.firstChild));
  }

  return fragment;
}

},{}],7:[function(require,module,exports){
/*
 * random-string
 * https://github.com/valiton/node-random-string
 *
 * Copyright (c) 2013 Valiton GmbH, Bastian 'hereandnow' Behrens
 * Licensed under the MIT license.
 */

'use strict';

var numbers = '0123456789',
    letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',
    specials = '!$%^&*()_+|~-=`{}[]:;<>?,./';


function _defaults (opts) {
  opts || (opts = {});
  return {
    length: opts.length || 8,
    numeric: typeof opts.numeric === 'boolean' ? opts.numeric : true,
    letters: typeof opts.letters === 'boolean' ? opts.letters : true,
    special: typeof opts.special === 'boolean' ? opts.special : false
  };
}

function _buildChars (opts) {
  var chars = '';
  if (opts.numeric) { chars += numbers; }
  if (opts.letters) { chars += letters; }
  if (opts.special) { chars += specials; }
  return chars;
}

module.exports = function randomString(opts) {
  opts = _defaults(opts);
  var i, rn,
      rnd = '',
      len = opts.length,
      randomChars = _buildChars(opts);
  for (i = 1; i <= len; i++) {
    rnd += randomChars.substring(rn = Math.floor(Math.random() * randomChars.length), rn + 1);
  }
  return rnd;
};

},{}],8:[function(require,module,exports){
var toString = Object.prototype.toString

module.exports = function(val){
  switch (toString.call(val)) {
    case '[object Function]': return 'function'
    case '[object Date]': return 'date'
    case '[object RegExp]': return 'regexp'
    case '[object Arguments]': return 'arguments'
    case '[object Array]': return 'array'
    case '[object String]': return 'string'
  }

  if (typeof val == 'object' && val && typeof val.length == 'number') {
    try {
      if (typeof val.callee == 'function') return 'arguments';
    } catch (ex) {
      if (ex instanceof TypeError) {
        return 'arguments';
      }
    }
  }

  if (val === null) return 'null'
  if (val === undefined) return 'undefined'
  if (val && val.nodeType === 1) return 'element'
  if (val === Object(val)) return 'object'

  return typeof val
}

},{}],9:[function(require,module,exports){
module.exports = extend

var hasOwnProperty = Object.prototype.hasOwnProperty;

function extend(target) {
    for (var i = 1; i < arguments.length; i++) {
        var source = arguments[i]

        for (var key in source) {
            if (hasOwnProperty.call(source, key)) {
                target[key] = source[key]
            }
        }
    }

    return target
}

},{}]},{},[1])(1)
});
