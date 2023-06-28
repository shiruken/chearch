document.addEventListener('DOMContentLoaded', function() {
    loadParams()
}, false);

function getAccessToken() {
	if (localStorage.getItem("access_token")) {
		document.getElementById("access_token").value = localStorage.getItem("access_token");
	}
}

function clearAccessToken() {
	if (localStorage.getItem("access_token")) {
		localStorage.removeItem("access_token");
		form.elements['access_token'].value = ''
	}
}

function loadParams() {
	const urlParams = new URLSearchParams(window.location.search).entries();
	for(const param of urlParams) {
		try{
			if (param[0] == "until" || param[0] == "since") {
				value = new Date(param[1]*1000)
				offset = new Date().getTimezoneOffset()*60000
				value = new Date(value - offset).toISOString().slice(0,-1)
			} else {
				value = param[1]
			}
			document.getElementById(param[0]).value = value
		}
		catch {
			console.log("something went wrong")
		}
	}
	getAccessToken()
}

async function load(url, access_token) {
	let obj = null;
	try {
		obj = await (await fetch(url, { headers: { "Authorization": `Bearer ${access_token}` } })).json();
	} catch (e) {
		console.log(e);
	}
	return obj
}

function fetchMore(until) {
	getFromPS(form, until)
}

function jsonConverter(data, renderMD, showthumbnails) {
	let count = 0;
	let html = "";
	let until = 2147483647;
	
	data.forEach(obj => {
		count += 1;
		until = obj.created_utc;
		
		let timestamp = new Date(obj.created_utc * 1000);
		timestamp = timestamp.toString().split(" (")[0];

		html += `
			<div class="card has-text-grey-light my-3">
				<div class="card-content">
					<div class="content mb-3">
						<nav class="level">
							<div class="level-left">
								<div class="level-item is-block-mobile">
									<a href="https://reddit.com/r/${obj.subreddit}" title="View subreddit on Reddit" class="has-text-danger mr-1">r/${obj.subreddit}</a>
									·
									<a href="https://reddit.com/user/${obj.author}" title="View user on Reddit" class="has-text-danger ml-1">u/${obj.author}</a>
								</div>
							</div>
							<div class="level-right">
								<div class="level-item is-block-mobile">
									<p class="is-size-7">${timestamp}</p>
								</div>
							</div>
						</nav>
					</div>
					<div class="media mb-1">
		`;

		if (showthumbnails.checked) {
			if ("thumbnail" in obj && obj.thumbnail.endsWith(".jpg")) {
				html += `
						<div class="media-left">
							<figure class="image is-96x96">
								<a href="https://reddit.com${obj.permalink}" title="View post on Reddit"><img src="${obj.thumbnail}" alt="Post Thumbnail"></a>
							</figure>
						</div>
				`;
			}
		}

		html += 		`<div class="media-content">`;

		if ("link_id" in obj) {  // Comment
			let link;
			if (obj.permalink) {
				link = "https://reddit.com" + obj.permalink;
			} else {
				link = `https://reddit.com//comments/${obj.link_id.replace("t3_", "")}/-/${obj.id}`;
			}
			html += `
							<p>
								<a href="${link}" title="View comment on Reddit" class="has-text-light has-text-weight-bold">Comment Link</a> 
								<span class="has-text-grey-light is-size-7">[Score: ${obj.score.toLocaleString()}]</span>
							</p>
						</div>
					</div>
					<div class="content markdown mt-3">
						${formatText(obj.body, renderMD.checked)}
					</div>
			`;
		} else {  // Post
			html += `
							<p>
								<a href="https://reddit.com${obj.permalink}" title="View post on Reddit" class="has-text-light has-text-weight-bold">${obj.title}</a> 
								<span class="has-text-grey-light is-size-7">[Score: ${obj.score.toLocaleString()}]</span>
							</p>
			`;
			if (!obj.is_self) {  // Link Post
				html += `
							<p>
								<a href="${obj.url}" title="View linked URL" class="has-text-danger">${obj.url}</a>
							</p>
						</div>
					</div>
				`;
			} else {  // Self Post
				html += `
						</div>
					</div>
					<div class="content markdown mt-3">
						${formatText(obj.selftext, renderMD.checked)}
					</div>
				`;
			}
		}

		html += `
				</div>
			</div>
		`;

	});

	if (count > 0) {
		html += `<button type="submit" class="button is-danger is-fullwidth my-5" id="fetch-${until}" onclick="fetchMore(${until})">Fetch More</button>`;
	}

	return html;
}

function formatText(text, use_markdown) {
	if (use_markdown) {
		return SnuOwnd.getParser().render(text);
	} else {
		return text.replaceAll("\n", "<br>");
	}
}

function getFromPS(form, until=-1){
	if (until == -1){
		document.getElementById("searchButton").classList.add("is-loading");
		document.getElementById("results").innerHTML="" 
	} else {
		document.getElementById("fetch-"+until).classList.add("is-loading");
	}
	path = "?"
	if (form.elements['kind'].value == "submission") {
		psURL = "https://api.pushshift.io/reddit/submission/search?html_decode=True"
		path += "kind=submission"
	} else {
		psURL = "https://api.pushshift.io/reddit/comment/search?html_decode=True"
		path += "kind=comment"
	}
	if (form.elements['author'].value != '') {
		psURL += "&author=" + form.elements['author'].value
		path  += "&author=" + form.elements['author'].value
	}
	if (form.elements['subreddit'].value != '') {
		psURL += "&subreddit=" + form.elements['subreddit'].value
		path  += "&subreddit=" + form.elements['subreddit'].value
	}
	if (form.elements['min_score'].value != '') {
		psURL += "&min_score=" + form.elements['min_score'].value
		path  += "&min_score=" + form.elements['min_score'].value
	}
	if (form.elements['max_score'].value != '') {
		psURL += "&max_score=" + form.elements['max_score'].value
		path  += "&max_score=" + form.elements['max_score'].value
	}
	if (form.elements['since'].value != '') {
		since = new Date(form.elements['since'].value).valueOf() / 1000
		psURL += "&since=" + since
		path  += "&since=" + since
	}
	if (until != -1) {
		psURL += "&until=" + until
	} else if (form.elements['until'].value != '') {
		until = new Date(form.elements['until'].value).valueOf() / 1000
		psURL += "&until=" + until
		path += "&until=" + until
	}
	if (form.elements['q'].value != '') {
		psURL += "&q=" + encodeURIComponent(form.elements['q'].value)
		path  += "&q=" + encodeURIComponent(form.elements['q'].value)
	}
	if (form.elements['limit'].value == '') {
		psURL += "&limit=100"
		path  += "&limit=100"
	} else {
		psURL += "&limit=" + form.elements['limit'].value;
		path  += "&limit=" + form.elements['limit'].value;
	}
	history.pushState(Date.now(), "Reddit Search - Results", window.location.pathname + path)
	access_token = form.elements['access_token'].value
	localStorage.setItem("access_token", access_token);
	load(psURL, access_token).then(value => {
		try {
			html = jsonConverter(value.data, form.elements['renderMD'], form.elements['thumbnails'])
			document.getElementById("results").innerHTML += html;

			searchTerm = form.elements['q'].value
			if (highlight.checked && searchTerm.length > 0) {
				var instance = new Mark(document.querySelector("#results"));
				if (!searchTerm.startsWith('"')) {
					searchArray = searchTerm.split(" ");
					instance.mark(searchArray, {
						"wildcards": "enabled",
						"accuracy": "complementary"
					});
				} else {
					term = searchTerm.replaceAll('"',"")
					instance.mark(term, {
						"accuracy": "partially",
						"separateWordSearch": false
					});
				}
			}

			document.getElementById("apiInfo").innerHTML = Object.keys(value.data).length + ` Results - <a href='${psURL}' target='_blank' title='View generated Pushshift API request URL' class='has-text-danger'>Generated API URL</a>`
			document.getElementById("searchButton").classList.remove("is-loading");
			try { document.getElementById("fetch-"+until).remove() }
			catch {}

			var list = document.querySelectorAll(".markdown a");
			for (let item of list) {
					link = item.href;
					if (link.endsWith(".jpg") || link.endsWith(".png") || link.endsWith(".gif")) {
							var node = document.createElement("button");
							node.setAttribute("onclick", "directExpand('" + link + "')")
							node.classList.add("button","is-danger","is-small")
							var textnode = document.createTextNode("+");
							node.appendChild(textnode);
							item.after(node);
					}
			}

		}
		catch (error) {
			console.log(error);
			if (value.detail == "Invalid token or expired token.") {
				clearAccessToken()
				document.getElementById("apiInfo").innerHTML = `Invalid or Expired Token - <a href="https://api.pushshift.io/signup" target="_blank" title="Request access token from Pushshift" class="has-text-danger">Request New Token</a>`;
			} else {
	 			document.getElementById("apiInfo").innerHTML = `Search Error: Pushshift may be down - <a href='${psURL}' target='_blank' title='View generated Pushshift API request URL' class='has-text-danger'>Generated API URL</a>`;
			}
			document.getElementById("searchButton").classList.remove("is-loading");
		}
	})
}

function directExpand(link) {
	var img = document.createElement('img');
	img.src = link;
	els = document.querySelector("a[href='" + link + "']");
	els = els.nextElementSibling;
	els.innerHTML = '-'
	if (!els.nextElementSibling || els.nextElementSibling.id != link) {
	  node = document.createElement("div")
	  node.id = link;
	  els.after(node)
	}
	iels = els.nextElementSibling;
	if (!iels.hasChildNodes()) {
	  iels.appendChild(img);
	} else {
	  if (iels.style.display == 'none') {
		els.innerHTML = '-';
		iels.style.display = 'block'
	  } else {
		els.innerHTML = '+';
		iels.style.display = 'none';
	  }
	}
  }

const form = document.getElementById('searchForm');
form.addEventListener('submit', (event) => {
	event.preventDefault();
	getFromPS(form)
});
