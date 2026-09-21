document.addEventListener('DOMContentLoaded', function() {
    loadParams();
}, false);

window.addEventListener('popstate', () => {
    loadParams();
});

const form = document.getElementById('searchForm');
form.addEventListener('submit', (event) => {
    event.preventDefault();
    search(form);
});

function loadParams() {
    form.reset();
    const urlParams = new URLSearchParams(window.location.search).entries();
    for (const param of urlParams) {
        try {
            let value;
            if (param[0] == "until" || param[0] == "since") {
                value = new Date(param[1] * 1000);
                const offset = new Date().getTimezoneOffset() * 60000;
                value = new Date(value - offset).toISOString().slice(0, -1);
            } else {
                value = param[1];
            }
            const el = document.getElementById(param[0]);
            if (el) {
                el.value = value;
            }
        } catch(e) {
            console.log(e);
        }
    }
    getAccessToken();
    getSettings();
}

function getAccessToken() {
    if (localStorage.getItem("accessToken")) {
        document.getElementById("accessToken").value = localStorage.getItem("accessToken");
    }
}

function clearAccessToken() {
    try {
        localStorage.removeItem("accessToken");
    } catch {}
    form.elements['accessToken'].value = "";
}

const settingKeys = ["exactAuthorMatch", "renderMarkdown", "highlight", "showThumbnails"];

settingKeys.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
        el.addEventListener("change", () => {
            try {
                localStorage.setItem(id, el.checked);
            } catch {}
        });
    }
});

function getSettings() {
    settingKeys.forEach(id => {
        try {
            const val = localStorage.getItem(id);
            if (val !== null) {
                const el = document.getElementById(id);
                if (el) {
                    el.checked = (val === "true");
                }
            }
        } catch {}
    });
}

async function search(form, until=-1) {
    
    if (until < 0) {    // New Search
        document.getElementById("results").innerHTML = "";
        if (until == -1) {
            document.getElementById("apiInfo").innerHTML = "";
        }
    } else {            // Fetch More
        document.getElementById("fetch-"+until).classList.add("is-loading");
    }

    let min_score, max_score, since;
    let psURL;
    let path = "?";
    if (form.elements['kind'].value == "submission") {
        psURL = "https://api.pushshift.io/reddit/submission/search?html_decode=True";
        path += "kind=submission";
    } else {
        psURL = "https://api.pushshift.io/reddit/comment/search?html_decode=True";
        path += "kind=comment";
    }
    if (form.elements['author'].value != '') {
        psURL += "&author=" + form.elements['author'].value;
        if (form.elements['exactAuthorMatch'].checked) {
            psURL += "&exact_author=true";
        }
        path  += "&author=" + form.elements['author'].value;
    }
    if (form.elements['subreddit'].value != '') {
        psURL += "&subreddit=" + form.elements['subreddit'].value;
        path  += "&subreddit=" + form.elements['subreddit'].value;
    }
    if (form.elements['min_score'].value != '') {
        min_score = form.elements['min_score'].value;
        if (isNaN(min_score) || min_score % 1 !== 0) {
            document.getElementById("apiInfo").innerHTML = "'Min Score' must be an integer";
            return;
        }
        psURL += "&min_score=" + min_score;
        path  += "&min_score=" + min_score;
    }
    if (form.elements['max_score'].value != '') {
        max_score = form.elements['max_score'].value;
        if (isNaN(max_score) || max_score % 1 !== 0) {
            document.getElementById("apiInfo").innerHTML = "'Max Score' must be an integer";
            return;
        }
        psURL += "&max_score=" + max_score;
        path  += "&max_score=" + max_score;
    }
    if (min_score && max_score) {
        if (max_score < min_score) {
            document.getElementById("apiInfo").innerHTML = "'Max Score' must be greater than 'Min Score'";
            return;
        }
    }
    if (form.elements['since'].value != '') {
        since = new Date(form.elements['since'].value).valueOf() / 1000;
        psURL += "&since=" + since;
        path  += "&since=" + since;
    }
    if (until >= 0) {
        psURL += "&until=" + until;
    } else if (form.elements['until'].value != '') {
        until = new Date(form.elements['until'].value).valueOf() / 1000;
        if (since) {
            if (until < since) {
                document.getElementById("apiInfo").innerHTML = "'Until' must be after 'Since'";
                return;
            }
        }
        psURL += "&until=" + until;
        path  += "&until=" + until;
    }
    if (form.elements['q'].value != '') {
        const queryVal = form.elements['q'].value.trim();
        if (form.elements['kind'].value == "submission" && queryVal.startsWith("t3_")) {
            psURL += "&ids=" + encodeURIComponent(queryVal);
        } else if (form.elements['kind'].value == "comment" && queryVal.startsWith("t1_")) {
            psURL += "&ids=" + encodeURIComponent(queryVal);
        } else {
            psURL += "&q=" + encodeURIComponent(queryVal);
        }
        path  += "&q=" + encodeURIComponent(queryVal);
    }
    if (form.elements['limit'].value == '') {
        psURL += "&limit=100";
        path  += "&limit=100";
    } else {
        let limit = form.elements['limit'].value;
        if (isNaN(limit) || limit % 1 !== 0) {
            document.getElementById("apiInfo").innerHTML = "'Number to Request' must be an integer";
            return;
        } else if (limit < 1) {
            document.getElementById("apiInfo").innerHTML = "'Number to Request' must be a positive integer";
            return;
        } else if (limit > 1000) {
            document.getElementById("apiInfo").innerHTML = "'Number to Request' must be less than 1000";
            return;
        }
        psURL += "&limit=" + limit;
        path  += "&limit=" + limit;
    }
    
    if (until == -1) {	// Search
        document.getElementById("searchButton").classList.add("is-loading");
        history.pushState(Date.now(), "Reddit Search - Results", window.location.pathname + path);
    }
    let accessToken = parseAccessTokenInput();
    let exactAuthorMatch = form.elements['exactAuthorMatch'].checked;
    let renderMarkdown = form.elements['renderMarkdown'].checked;
    let highlight = form.elements['highlight'].checked;
    let showThumbnails = form.elements['showThumbnails'].checked;
    try {
        localStorage.setItem("accessToken", accessToken);
        localStorage.setItem("exactAuthorMatch", exactAuthorMatch);
        localStorage.setItem("renderMarkdown", renderMarkdown);
        localStorage.setItem("highlight", highlight);
        localStorage.setItem("showThumbnails", showThumbnails);
    } catch {}

    try {
        const json = await load(psURL, accessToken);

        if (!json || typeof json !== "object") {
            throw new Error("Invalid response from Pushshift API");
        }

        if ("detail" in json) {
            let detail = json.detail;
            if (typeof detail === "string") {
                try {
                    const parsed = JSON.parse(detail);
                    if (parsed && parsed.detail) {
                        detail = parsed.detail;
                    }
                } catch {}
            }
            console.log(detail);

            if (detail == "Access token is invalid or malformed." || detail == "Not authenticated") {
                trackEvent('token-invalid');
                clearAccessToken();
                document.getElementById("apiInfo").innerHTML = `
                    Invalid Token - <a href="https://auth.pushshift.io/authorize" target="_blank" rel="noopener noreferrer"
                    title="Request access token from Pushshift" class="has-text-danger">Request Token</a>
                `;
            } else if (detail == "Access token is revoked. This was done either manually or by reautheticating.") {
                trackEvent('token-revoked');
                clearAccessToken();
                document.getElementById("apiInfo").innerHTML = `
                    Revoked Token - <a href="https://auth.pushshift.io/authorize" target="_blank" rel="noopener noreferrer"
                    title="Request new access token from Pushshift" class="has-text-danger">Request New Token</a>
                `;
            } else if (detail == "Access token is expired.") {
                document.getElementById("apiInfo").innerHTML = "Refreshing Token...";
                const token = await refreshToken(accessToken);
                if (token == null) {
                    trackEvent('refresh-fail');
                    clearAccessToken();
                    document.getElementById("apiInfo").innerHTML = `
                        Error Refreshing Token - <a href="https://auth.pushshift.io/authorize" target="_blank" rel="noopener noreferrer"
                        title="Request new access token from Pushshift" class="has-text-danger">Request New Token</a>
                    `;
                } else {
                    trackEvent('refresh-success');
                    document.getElementById("accessToken").value = token;
                    search(form, -2);
                    return;
                }
            } else {
                trackEvent('error-request');
                const errorMsg = (typeof detail === "string" && detail.length > 0) ? detail : "Pushshift May Be Down";
                document.getElementById("apiInfo").innerHTML = `
                    Search Error: ${errorMsg} - <a href='${psURL}' target='_blank' rel='noopener noreferrer'
                    title='View generated Pushshift API request URL' class='has-text-danger'>Generated API URL</a>
                `;
            }
            return;
        }

        if (!Array.isArray(json.data)) {
            throw new Error("Missing data array in response");
        }

        const oldFetchButton = document.getElementById("fetch-" + until);
        if (oldFetchButton) {
            oldFetchButton.remove();
        }

        const resultsContainer = document.getElementById("results");
        const prevCardCount = resultsContainer.querySelectorAll(".card").length;

        const html = generateHTML(json.data, renderMarkdown, showThumbnails);
        resultsContainer.insertAdjacentHTML("beforeend", html);

        const newCards = Array.from(resultsContainer.querySelectorAll(".card")).slice(prevCardCount);

        // Highlight search terms
        const searchTerm = form.elements['q'].value;
        if (highlight && searchTerm.length > 0 && newCards.length > 0) {
            let instance = new Mark(newCards);
            if (!searchTerm.startsWith('"')) {
                let searchArray = searchTerm.split(" ");
                instance.mark(searchArray, {
                    "wildcards": "enabled",
                    "accuracy": "complementary"
                });
            } else {
                let term = searchTerm.replaceAll('"', "");
                instance.mark(term, {
                    "accuracy": "partially",
                    "separateWordSearch": false
                });
            }
        }

        let result_count = json.data.length;
        if (document.getElementById("result_count")) {
            result_count += parseInt(document.getElementById("result_count").innerHTML);
        }
        document.getElementById("apiInfo").innerHTML = `
            ${until == -2 ? "<span class='has-text-weight-bold'>Token Refreshed</span> - " : ""}
            <span id="result_count">${result_count}</span> Result${result_count == 1 ? "" : "s"} - <a href='${psURL}' target='_blank' rel='noopener noreferrer' 
            title='View generated Pushshift API request URL' class='has-text-danger'>Generated API URL</a>
        `;

        // Inject buttons for expanding linked media
        const extensions = [".jpg", ".jpeg", ".png", ".gif", ".gifv", ".mp4"];
        for (const card of newCards) {
            const links = card.querySelectorAll(".expand a");
            for (const link of links) {
                if (link.nextElementSibling == null || link.nextElementSibling.tagName != "BUTTON") {
                    const url = link.href;
                    if (extensions.some(extension => url.includes(extension))) {
                        const button = document.createElement("button");
                        button.classList.add("delete", "closed");
                        button.setAttribute("onclick", "directExpand(this)");
                        link.after(button);
                    }
                }
            }
        }

    } catch (e) {
        console.log(e);
        trackEvent('error-response');
        document.getElementById("apiInfo").innerHTML = `
            Search Error: Pushshift May Be Down - <a href='${psURL}' target='_blank' rel='noopener noreferrer'
            title='View generated Pushshift API request URL' class='has-text-danger'>Generated API URL</a>
        `;
    } finally {
        document.getElementById("searchButton").classList.remove("is-loading");
        if (until >= 0) {
            const fetchBtn = document.getElementById("fetch-" + until);
            if (fetchBtn) {
                fetchBtn.classList.remove("is-loading");
            }
        }
    }
}

function fetchMore(until) {
    search(form, until);
}

function generateHTML(data, renderMarkdown, showThumbnails) {
    let count = 0;
    let html = "";
    let until = 2147483647;
    
    data.forEach(obj => {
        count += 1;
        until = obj.created_utc;
        
        let timestamp = new Date(obj.created_utc * 1000);
        timestamp = timestamp.toString().split(" (")[0];

        const subreddit = escapeHTML(obj.subreddit);
        const author = escapeHTML(obj.author);
        const permalink = obj.permalink ? encodeURI(obj.permalink) : "";
        const scoreText = obj.score != null ? obj.score.toLocaleString() : "0";

        html += `
            <div class="card has-text-grey-light my-3">
                <div class="card-content">
                    <div class="content mb-3">
                        <nav class="level">
                            <div class="level-left">
                                <div class="level-item is-block-mobile">
                                    <a href="https://reddit.com/r/${subreddit}" target="_blank" rel="noopener noreferrer" title="View subreddit on Reddit" class="has-text-danger mr-1">r/${subreddit}</a>
                                    ·
                                    <a href="https://reddit.com/user/${author}" target="_blank" rel="noopener noreferrer" title="View user on Reddit" class="has-text-danger ml-1">u/${author}</a>
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

        if (showThumbnails) {
            if ("thumbnail" in obj && typeof obj.thumbnail === "string" && obj.thumbnail.endsWith(".jpg")) {
                html += `
                        <div class="media-left">
                            <figure class="image is-96x96">
                                <a href="https://reddit.com${permalink}" target="_blank" rel="noopener noreferrer" title="View post on Reddit">
                                    <img src="${escapeHTML(obj.thumbnail)}" alt="Thumbnail" onerror="hideThumbnail(this)">
                                </a>
                            </figure>
                        </div>
                `;
            }
        }

        html +=         `<div class="media-content">`;

        if ("link_id" in obj) {  // Comment
            let link;
            if (obj.permalink) {
                link = "https://reddit.com" + permalink;
            } else {
                link = `https://reddit.com/comments/${encodeURIComponent(obj.link_id.replace("t3_", ""))}/-/${encodeURIComponent(obj.id)}`;
            }
            html += `
                            <p>
                                <a href="${link}" target="_blank" rel="noopener noreferrer" title="View comment on Reddit" class="has-text-light has-text-weight-bold">Comment Link</a> 
                                <span class="has-text-grey-light is-size-7 score">[Score: ${scoreText}]</span>
                            </p>
                        </div>
                    </div>
                    <div class="content mt-3 markdown expand wrap">
                        ${formatText(obj.body, renderMarkdown)}
                    </div>
            `;
        } else {  // Post
            html += `
                            <p>
                                <a href="https://reddit.com${permalink}" target="_blank" rel="noopener noreferrer" title="View post on Reddit" class="has-text-light has-text-weight-bold">${escapeHTML(obj.title)}</a> 
                                <span class="has-text-grey-light is-size-7 score">[Score: ${scoreText}]</span>
                            </p>
            `;
            if (!obj.is_self) {  // Link Post
                const escapedUrl = escapeHTML(obj.url);
                html += `
                            <p class="expand wrap">
                                <a href="${escapedUrl}" target="_blank" rel="noopener noreferrer" title="View linked URL" class="has-text-danger">${escapedUrl}</a>
                            </p>
                        </div>
                    </div>
                `;
            } else {  // Self Post
                html += `
                        </div>
                    </div>
                    <div class="content mt-3 markdown expand wrap">
                        ${formatText(obj.selftext, renderMarkdown)}
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
        html += `
            <button type="submit" class="button is-danger is-fullwidth my-5" 
            id="fetch-${until}" data-umami-event="more-button" onclick="fetchMore(${until})">Fetch More</button>
        `;
    }

    return html;
}

function escapeHTML(str) {
    if (str == null) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

const renderer = SnuOwnd.getRedditRenderer();
renderer.context.link_attributes = function(e, n, t) {
    e.s += ' target="_blank" rel="noopener noreferrer"';
};
const markdownParser = SnuOwnd.getParser(renderer, SnuOwnd.getParser().extensions | SnuOwnd.MKDEXT_FENCED_CODE);

function formatText(text, use_markdown) {
    if (!text) return "";
    if (use_markdown) {
        text = text.replace(/&amp;/g, "&");
        text = text.replace(/(^|\n)&gt; ?/g, "$1> ");
        text = markdownParser.render(text);

        // Link native Giphy embeds
        text = text.replace(/!\[gif\]\(giphy\|(\w+)[\|\w]*\)/g, (match, id) =>
            `<a href="https://media.giphy.com/media/${id}/giphy.gif" target="_blank" rel="noopener noreferrer">${match}</a>`
        );

        return text;
    } else {
        return escapeHTML(text).replaceAll("\n", "<br>");
    }
}

async function load(url, accessToken) {
    let headers = { headers: { "Authorization": `Bearer ${accessToken}` } };
    let response = await fetch(url, headers);
    return await response.json();
}

async function refreshToken(accessToken) {
    const url = "https://auth.pushshift.io/refresh?access_token=" + accessToken;
    let newToken = null;
    try {
        const response = await fetch(url, { method: "POST" });
        const json = await response.json();
        if (response.ok) {
            newToken = json.access_token;
        } else {
            console.log(`HTTP ${response.status}: ${json.detail}`);
        }
    } catch(e) {
        console.log(e);
    }
    return newToken;
}

function parseAccessTokenInput() {
    const text = form.elements['accessToken'].value;

    let accessToken;
    try {
        let json = JSON.parse(text);
        const type = Object.prototype.toString.call(json);
        if (type !== '[object Object]') {
            throw new Error("Not valid JSON object");
        }
        if (!('access_token' in json)) {
            throw new Error("'access_token' missing from JSON");
        }
        accessToken = json['access_token'];
    } catch {
        accessToken = text;
    }

    try {
        accessToken = accessToken.replace(/"+/g, "").trim();
    } catch {}

    form.elements['accessToken'].value = accessToken;
    return accessToken;
}

function directExpand(button) {
    let link = button.previousElementSibling;
    let url = link.href;
    if (button.classList.contains("closed")) {
        let span = document.createElement("span");
        span.style.display = "block";
        if (url.includes(".gifv") || url.includes(".mp4")) { // Video
            url = url.replace("gifv", "mp4");
            let video = document.createElement("video");
            video.controls = true;
            video.autoplay = true;
            video.loop = true;
            video.muted = true;
            let source = document.createElement("source");
            source.src = url;
            source.type = "video/mp4";
            video.appendChild(source);
            span.appendChild(video);
        } else { // Image
            url = url.replace("preview.redd.it", "i.redd.it");
            let img = document.createElement("img");
            img.src = url;
            span.appendChild(img);
        }
        button.after(span);
    } else {
        let span = button.nextElementSibling;
        span.remove();
    }
    button.classList.toggle("closed");
}

function hideThumbnail(element) {
    let thumbnail = element.closest('.media-left');
    thumbnail.style.display = 'none';
}

function trackEvent(eventName, eventData) {
    try {
        if (typeof window !== 'undefined' && window.umami && typeof window.umami.track === 'function') {
            window.umami.track(eventName, eventData);
        }
    } catch {}
}
